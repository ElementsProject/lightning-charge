#!/bin/bash
set -eo pipefail

export DB_PATH=/data/charge.db
export LN_PATH=/data/lightning
export BTC_PATH=/data/bitcoin

: ${NETWORK:=testnet}
: ${LIGHTNINGD_OPT:=--log-level=debug}
: ${BITCOIND_OPT:=-debug=rpc}
: ${BITCOIND_HOST:=127.0.0.1}

[[ "$NETWORK" == "mainnet" ]] && NETWORK=bitcoin

mkdir -p $LN_PATH

if [ -z "$SKIP_BITCOIND" ]; then
  mkdir -p $BTC_PATH
  echo "Starting bitcoind"
  bitcoind -printtoconsole -$NETWORK -datadir=$BTC_PATH $BITCOIND_OPTS &>> /data/bitcoin.log &
  # We need to wait at least until the cookiefile is created...
  sleep 1
else
  # The path should be out of /data, because /data is the volume concerning this container only
  BTC_PATH=/root/.bitcoin
  echo "Using external bitcoind '$BITCOIND_HOST'"
  # LightningD depends on bitcoin-cli which use the rpcconnect argument to know the host to connect to.
  # We can't configure LightningD to use a different host, but we can configure the underlying bitcoin-cli to use it
  sed -i '/^rpcconnect=/d' $BTC_PATH/bitcoin.conf
  echo "rpcconnect=$BITCOIND_HOST" >> $BTC_PATH/bitcoin.conf
fi

echo "Waiting for bitcoind to startup"
bitcoin-cli -$NETWORK -datadir="$BTC_PATH" -rpcwait getblockchaininfo  &>> /dev/null

if [ -z "$SKIP_LIGHTNINGD" ]; then
  echo "Starting lightningd"
  lightningd --network=$NETWORK --bitcoin-datadir=$BTC_PATH --lightning-dir=$LN_PATH $LIGHTNINGD_OPT &>> /data/lightning.log &
  echo "Waiting for lightningd to startup"
  sed '/Hello world/ q' <(tail -F -n0 /data/lightning.log 2> /dev/null)
fi

echo "Starting Lightning Charge"
HOST=0.0.0.0 DEBUG=$DEBUG,lightning-charge,lightning-client,knex:query,knex:bindings \
./bin/charged $@ $CHARGED_OPTS
