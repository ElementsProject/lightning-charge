#!/bin/bash
set -eo pipefail

: ${NETWORK:=testnet}
: ${LIGHTNINGD_OPT:=--log-level=debug --log-file=debug.log}
: ${BITCOIND_OPT:=-debug=rpc}

[[ "$NETWORK" == "mainnet" ]] && NETWORK=bitcoin

if [ -d /etc/bitcoin ]; then
  echo -n "Connecting to bitcoind configured in /etc/bitcoin... "
  BTC_PATH=/etc/bitcoin

  # temporary workaround to allow mounting the bitcoind datadir as-is,
  # but specify a different rpc host to connect to. this will modify
  # the external bitcoind config file which might result in side effects.
  # should be eventually replaced with a better solution.
  # https://github.com/ElementsProject/lightning/issues/804
  # https://github.com/ElementsProject/lightning/issues/329
  if [ -n "$BITCOIND_RPCCONNECT_HACK" ]; then
    sed -i '/^rpcconnect=/ d' $BTC_PATH/bitcoin.conf
    echo "rpcconnect=$BITCOIND_RPCCONNECT_HACK" >> $BTC_PATH/bitcoin.conf
  fi

elif [ -n "$BITCOIND_URI" ]; then
  [[ "$BITCOIND_URI" =~ ^[a-z]+:\/+(([^:]+):([^@]+))@([^:/]+):([0-9]+)/?$ ]] || \
    { echo >&2 "ERROR: invalid bitcoind URI: $BITCOIND_URI"; exit 1; }

  echo -n "Connecting to bitcoind at ${BASH_REMATCH[4]}:${BASH_REMATCH[5]}... "

  BTC_PATH=/tmp/bitcoin
  mkdir $BTC_PATH

  echo -e "$NETWORK=1\nrpconnect=${BASH_REMATCH[4]}\nrpcport=${BASH_REMATCH[5]}" > $BTC_PATH/bitcoin.conf

  if [ "${BASH_REMATCH[2]}" != "__cookie__" ]; then
    echo -e "rpcuser=${BASH_REMATCH[2]}\nrpcpassword=${BASH_REMATCH[3]}" >> $BTC_PATH/bitcoin.conf
  else
    [[ "$NETWORK" == "bitcoin" ]] && NET_PATH=$BTC_PATH || NET_PATH=$BTC_PATH/$NETWORK
    mkdir -p $NET_PATH
    echo "${BASH_REMATCH[1]}" > $NET_PATH/.cookie
  fi

else
  echo -n "Starting bitcoind... "

  BTC_PATH=/data/bitcoin
  mkdir -p $BTC_PATH

  bitcoind -$NETWORK -datadir=$BTC_PATH $BITCOIND_OPTS &
  echo -n "waiting for cookie... "
  sed --quiet '/^\.cookie$/ q' <(inotifywait -e create,moved_to --format '%f' -qmr $BTC_PATH)
fi

echo -n "waiting for RPC... "
bitcoin-cli -$NETWORK -datadir=$BTC_PATH -rpcwait getblockchaininfo > /dev/null
echo "ready."

if [ -S /etc/lightning/lightning-rpc ]; then
  echo "Using lightningd unix socket mounted in /etc/lightning/lightning-rpc"
  LN_PATH=/etc/lightning

else
  echo -n "Starting lightningd... "

  LN_PATH=/data/lightning
  lightningd --network=$NETWORK --bitcoin-datadir=$BTC_PATH --lightning-dir=$LN_PATH $LIGHTNINGD_OPT > /dev/null &
  echo -n "waiting for startup... "
  sed --quiet '/Server started with public key/ q' <(tail -F -n0 /data/lightning/debug.log 2> /dev/null)
  echo "ready."
fi

echo "Starting Lightning Charge"
DEBUG=$DEBUG,lightning-charge,lightning-client \
charged -d /data/charge.db -l $LN_PATH -i 0.0.0.0 $@ $CHARGED_OPTS
