#!/bin/bash
echo "Starting bitcoind $BITCOIND_OPTS"
bitcoind -daemon -printtoconsole $BITCOIND_OPTS
echo "Waiting for bitcoind to startup"
sleep 5

echo "Starting lightningd $LIGHTNINGD_OPTS"
lightningd --port 9735 $LIGHTNINGD_OPTS &
echo "Waiting for lightningd to startup"
sleep 5

echo "Starting Lightning Charge"
npm start
