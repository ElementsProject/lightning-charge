#!/bin/bash
set -eo pipefail

export DB_PATH=/data/charge.db
export LN_PATH=/data/lightning
export BTC_PATH=/data/bitcoin

: ${NETWORK:=testnet}
: ${LIGHTNINGD_OPT:=--log-level=debug}
: ${BITCOIND_OPT:=-debug=rpc}

mkdir -p $BTC_PATH $LN_PATH

echo "Starting bitcoind"
bitcoind -daemon -$NETWORK -datadir=$BTC_PATH $BITCOIND_OPTS
echo "Waiting for bitcoind to startup"
sed '/init message: Done loading/ q' <(tail -F -n+0 $BTC_PATH/*/debug.log 2> /dev/null)

echo "Starting lightningd"
lightningd --network=$NETWORK --bitcoin-datadir=$BTC_PATH --lightning-dir=$LN_PATH --log-file=debug.log $LIGHTNINGD_OPT &
echo "Waiting for lightningd to startup"
sed '/Hello world/ q' <(tail -F -n+0 $LN_PATH/debug.log 2> /dev/null)

echo "Starting Lightning Charge"
HOST=0.0.0.0 DEBUG=$DEBUG,lightning-charge,lightning-client,knex:query,knex:bindings \
./bin/charged $@ $CHARGED_OPTS
