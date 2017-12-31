#!/bin/bash
echo "Starting bitcoind $BITCOIND_ARGS"
bitcoind -daemon -printtoconsole $BITCOIND_ARGS
echo "Waiting for bitcoind to startup"
sleep 5

echo "Starting lightningd $LIGHTNINGD_ARGS"
lightningd --port 9735 $LIGHTNINGD_ARGS &
echo "Waiting for lightningd to startup"
sleep 5

echo "Starting Lightning Charge"
npm start
