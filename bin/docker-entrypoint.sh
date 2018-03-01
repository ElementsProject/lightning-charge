#!/bin/bash
set -eo pipefail
trap 'kill `jobs -p`' SIGTERM

: ${NETWORK:=testnet}
: ${LIGHTNINGD_OPT:=--log-level=debug}
: ${BITCOIND_OPT:=-debug=rpc}

[[ "$NETWORK" == "mainnet" ]] && NETWORK=bitcoin

[[ -n "$BITCOIND_RPCCONNECT_HACK" ]] && { echo >&2 BITCONID_RPCCONNECT_HACK is now named BITCOIND_RPCCONNECT && exit 1; }

if [ -d /etc/bitcoin ]; then
  echo -n "Connecting to bitcoind configured in /etc/bitcoin... "

  RPC_OPT="-datadir=/etc/bitcoin $([[ -z "$BITCOIND_RPCCONNECT" ]] || echo "-rpcconnect=$BITCOIND_RPCCONNECT")"

elif [ -n "$BITCOIND_URI" ]; then
  [[ "$BITCOIND_URI" =~ ^[a-z]+:\/+(([^:/]+):([^@/]+))@([^:/]+:[0-9]+)/?$ ]] || \
    { echo >&2 "ERROR: invalid bitcoind URI: $BITCOIND_URI"; exit 1; }

  echo -n "Connecting to bitcoind at ${BASH_REMATCH[4]}... "

  RPC_OPT="-rpcconnect=${BASH_REMATCH[4]}"

  if [ "${BASH_REMATCH[2]}" != "__cookie__" ]; then
    RPC_OPT="$RPC_OPT -rpcuser=${BASH_REMATCH[2]} -rpcpassword=${BASH_REMATCH[3]}"
  else
    RPC_OPT="$RPC_OPT -datadir=/tmp/bitcoin"
    [[ "$NETWORK" == "bitcoin" ]] && NET_PATH=/tmp/bitcoin || NET_PATH=/tmp/bitcoin/$NETWORK
    mkdir -p $NET_PATH
    echo "${BASH_REMATCH[1]}" > $NET_PATH/.cookie
  fi

else
  echo -n "Starting bitcoind... "

  mkdir -p /data/bitcoin
  RPC_OPT="-datadir=/data/bitcoin"

  bitcoind -$NETWORK $RPC_OPT $BITCOIND_OPTS &
  echo -n "waiting for cookie... "
  sed --quiet '/^\.cookie$/ q' <(inotifywait -e create,moved_to --format '%f' -qmr /data/bitcoin)
fi

echo -n "waiting for RPC... "
bitcoin-cli -$NETWORK $RPC_OPT -rpcwait getblockchaininfo > /dev/null
echo "ready."


if [ -S /etc/lightning/lightning-rpc ]; then
  echo "Using lightningd unix socket mounted in /etc/lightning/lightning-rpc"
  LN_PATH=/etc/lightning

else
  echo -n "Starting lightningd... "

  LN_PATH=/data/lightning

  lnopt=($LIGHTNINGD_OPT --network=$NETWORK --lightning-dir="$LN_PATH" --log-file=debug.log)
  [[ -z "$LN_ALIAS" ]] || lnopt+=(--alias="$LN_ALIAS")

  lightningd "${lnopt[@]}" $(echo "$RPC_OPT" | sed -r 's/(^| )-/\1--bitcoin-/g') > /dev/null &

  echo -n "waiting for startup... "
  sed --quiet '/Server started with public key/ q' <(tail -F -n0 $LN_PATH/debug.log 2> /dev/null)
  echo "ready."
fi

echo "Starting Lightning Charge"
DEBUG=$DEBUG,lightning-charge,lightning-client \
charged -d /data/charge.db -l $LN_PATH -i 0.0.0.0 $@ $CHARGED_OPTS
