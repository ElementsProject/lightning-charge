#!/bin/bash
set -eo pipefail

: ${NETWORK:=testnet}

echo "Starting bitcoind"
bitcoind -daemon -$NETWORK -prune=550 $BITCOIND_OPTS
echo "Waiting for bitcoind to startup"
sed '/init message: Done loading/ q' <(tail -F -n+0 ~/.bitcoin/*/debug.log 2> /dev/null)

echo "Starting lightningd"
lightningd --network=$NETWORK --port 9735 --log-file=debug.log $LIGHTNINGD_OPT &
echo "Waiting for lightningd to startup"
sed '/Hello world/ q' <(tail -F -n+0 ~/.lightning/debug.log 2> /dev/null)

echo "Starting Lightning Charge"
HOST=0.0.0.0 DEBUG=$DEBUG,lightning-charge,lightning-client,knex:query,knex:bindings,superagent \
./scripts/charged $@ $CHARGED_OPTS
