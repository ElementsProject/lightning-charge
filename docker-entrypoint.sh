#!/bin/bash
echo "Starting bitcoind $BITCOIND_OPTS"
bitcoind -daemon -printtoconsole ${BITCOIND_OPTS:- -testnet -prune=550}
echo "Waiting for bitcoind to startup"
sleep 5

echo "Starting lightningd $LIGHTNINGD_OPTS"
lightningd --port 9735 --log-file=debug.log ${LIGHTNINGD_OPTS:- --network=testnet} &
echo "Waiting for lightningd to startup"
sleep 5

echo "Starting Lightning Charge"

HOST=0.0.0.0 DEBUG=$DEBUG,lightning-charge,lightning-client,knex:query,knex:bindings,superagent \
npm start
