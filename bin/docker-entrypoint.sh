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
  echo "Starting bitcoind"
  bitcoind -printtoconsole -$NETWORK -datadir=$BTC_PATH $BITCOIND_OPTS &>> /data/bitcoin.log &
  echo "Waiting for bitcoind to startup"
  sed '/init message: Done loading/ q' <(tail -F -n0 /data/bitcoin.log 2> /dev/null)
fi

if [ -z "$SKIP_LIGHTNINGD" ]; then
  echo "Starting lightningd"
  lightningd --network=$NETWORK --bitcoin-datadir=$BTC_PATH --lightning-dir=$LN_PATH $LIGHTNINGD_OPT &>> /data/lightning.log &
  echo "Waiting for lightningd to startup"
  sed '/Hello world/ q' <(tail -F -n0 /data/lightning.log 2> /dev/null)
fi

echo "Starting Lightning Charge"
HOST=0.0.0.0 DEBUG=$DEBUG,lightning-charge,lightning-client,knex:query,knex:bindings \
./bin/charged $@ $CHARGED_OPTS
