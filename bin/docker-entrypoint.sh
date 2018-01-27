#!/bin/bash
set -eo pipefail

export DB_PATH=/data/charge.db
export LN_PATH=/data/lightning
export BTC_PATH=/data/bitcoin

: ${NETWORK:=testnet}
: ${LIGHTNINGD_OPT:=--log-level=debug}
: ${BITCOIND_OPT:=-debug=rpc}

[[ "$NETWORK" == "mainnet" ]] && NETWORK=bitcoin

mkdir -p $BTC_PATH $LN_PATH

if [ -z "$SKIP_BITCOIND" ]; then
  echo -n "Starting bitcoind... "
  bitcoind -printtoconsole -$NETWORK -datadir=$BTC_PATH $BITCOIND_OPTS &>> /data/bitcoin.log &
  echo -n "waiting for cookie... "
  sed --quiet '/^\.cookie$/ q' <(inotifywait -e create,moved_to --format '%f' -qmr $BTC_PATH)
  echo -n "waiting for RPC... "
  bitcoin-cli -$NETWORK -datadir=$BTC_PATH -rpcwait getblockchaininfo > /dev/null
  echo "ready."
fi

if [ -z "$SKIP_LIGHTNINGD" ]; then
  echo -n "Starting lightningd... "
  lightningd --network=$NETWORK --bitcoin-datadir=$BTC_PATH --lightning-dir=$LN_PATH $LIGHTNINGD_OPT &>> /data/lightning.log &
  echo -n "waiting for startup... "
  sed --quiet '/Hello world/ q' <(tail -F -n0 /data/lightning.log 2> /dev/null)
  echo "ready."
fi

echo "Starting Lightning Charge"
HOST=0.0.0.0 DEBUG=$DEBUG,lightning-charge,lightning-client,knex:query,knex:bindings \
./bin/charged $@ $CHARGED_OPTS
