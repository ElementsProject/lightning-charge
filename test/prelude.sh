#!/bin/bash
set -eo pipefail
shopt -s expand_aliases

# check dependencies
command -v jq > /dev/null || { echo >&2 "jq is required. see https://stedolan.github.io/jq/download/"; exit 1; }
(command -v bitcoind && command -v bitcoin-cli) > /dev/null || { echo >&2 "bitcoind and bitcoin-cli must be in PATH. to install, see https://bitcoin.org/en/full-node#linux-instructions"; exit 1; }
(command -v lightningd && command -v lightning-cli) > /dev/null || { echo >&2 "lightningd and lightning-cli must be in PATH. to install, see https://github.com/ElementsProject/lightning/blob/master/README.md#getting-started"; exit 1; }

trap 'pkill -P $CHARGE_PID && kill `jobs -p` 2> /dev/null' SIGTERM

if [ -n "$VERBOSE" ]; then
  set -x
  dbgout=/dev/stderr
else
  dbgout=/dev/null
  sedq='--quiet'
fi

DIR=`mktemp -d`
BTC_DIR=$DIR/bitcoin

# Alice is the backend for Charge, Bob is paying customer
LN_ALICE_PATH=$DIR/lightning-alice
LN_BOB_PATH=$DIR/lightning-bob

CHARGE_DB=$DIR/charge.sqlite
CHARGE_PORT=`get-port`
CHARGE_TOKEN=`head -c 10 /dev/urandom | base64 | tr -d '+/='`
CHARGE_URL=http://api-token:$CHARGE_TOKEN@localhost:$CHARGE_PORT

alias btc="bitcoin-cli --datadir=$BTC_DIR"
alias lna="lightning-cli --lightning-dir=$LN_ALICE_PATH"
alias lnb="lightning-cli --lightning-dir=$LN_BOB_PATH"

echo Setting up test envirnoment in $DIR

# Setup bitcoind

echo Setting up bitcoind >&2
mkdir -p $BTC_DIR
cat >$BTC_DIR/bitcoin.conf <<EOL
regtest=1
rpcport=`get-port`
port=`get-port`
EOL

bitcoind -datadir=$BTC_DIR $BITCOIND_OPTS &

echo - Waiting for bitcoind to warm up... > $dbgout
sed $sedq '/init message: Done loading/ q' <(tail -F -n+0 $BTC_DIR/regtest/debug.log 2> /dev/null)

echo - Generating some blocks... > $dbgout
btc generate 432 > /dev/null

# Setup lightningd

echo Setting up lightningd >&2

LN_OPTS="$LN_OPTS --network=regtest --bitcoind-poll=1s --bitcoin-datadir=$BTC_DIR --log-level=debug --log-file=debug.log
  --allow-deprecated-apis="$([ -n "$ALLOW_DEPRECATED" ] && echo true || echo false)

lightningd $LN_OPTS --port=`get-port` --lightning-dir=$LN_ALICE_PATH  &> $dbgout &
lightningd $LN_OPTS --port=`get-port` --lightning-dir=$LN_BOB_PATH &> $dbgout &

echo - Waiting for lightningd to warm up... > $dbgout
sed $sedq '/Hello world/ q' <(tail -F -n+0 $LN_ALICE_PATH/debug.log 2> /dev/null)
sed $sedq '/Hello world/ q' <(tail -F -n+0 $LN_BOB_PATH/debug.log 2> /dev/null)

echo - Funding lightning wallet... > $dbgout
btc sendtoaddress $(lnb newaddr | jq -r .address) 1 > $dbgout
btc generate 1 > /dev/null
sed $sedq '/Owning output [0-9]/ q' <(tail -F -n+0 $LN_BOB_PATH/debug.log)

echo - Connecting peers... > $dbgout
aliceid=`lna getinfo | jq -r .id`
lnb connect $aliceid 127.0.0.1 `lna getinfo | jq -r .port` | jq -c . > $dbgout

echo - Setting up channel... > $dbgout
lnb fundchannel $aliceid 16777215 | jq -c . > $dbgout
btc generate 1 > /dev/null

sed $sedq '/state: CHANNELD_AWAITING_LOCKIN -> CHANNELD_NORMAL/ q' <(tail -n+0 $LN_ALICE_PATH/debug.log)
sed $sedq '/state: CHANNELD_AWAITING_LOCKIN -> CHANNELD_NORMAL/ q' <(tail -n+0 $LN_BOB_PATH/debug.log)

[[ -n "$VERBOSE" ]] && lna listpeers | jq -c .peers[0]

# Setup Lightning Charge

echo Setting up charged >&2

LN_PATH=$LN_ALICE_PATH DB_PATH=$CHARGE_DB API_TOKEN=$CHARGE_TOKEN PORT=$CHARGE_PORT \
DEBUG=$DEBUG,lightning-*,knex:query,knex:bindings \
NODE_ENV=test babel-node src/app.js &> $DIR/charge.log &

CHARGE_PID=$!
sed $sedq '/HTTP server running/ q' <(tail -F -n+0 $DIR/charge.log 2> /dev/null)

curl --silent --fail $CHARGE_URL/invoices > /dev/null

echo All services up and running > $dbgout
