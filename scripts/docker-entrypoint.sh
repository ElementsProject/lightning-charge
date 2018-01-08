#!/bin/bash
echo "Starting bitcoind $BITCOIND_OPTS"
bitcoind -daemon ${BITCOIND_OPTS:- -testnet -prune=550}
echo "Waiting for bitcoind to startup"
sed '/init message: Done loading/ q' <(tail -F -n+0 ~/.bitcoin/*/debug.log 2> /dev/null)

echo "Starting lightningd $LIGHTNINGD_OPTS"
lightningd --port 9735 --log-file=debug.log ${LIGHTNINGD_OPTS:- --network=testnet} &
echo "Waiting for lightningd to startup"
sed '/Hello world/ q' <(tail -F -n+0 ~/.lightning/debug.log 2> /dev/null)

echo "Starting Lightning Charge"
HOST=0.0.0.0 DEBUG=$DEBUG,lightning-charge,lightning-client,knex:query,knex:bindings,superagent \
npm start
