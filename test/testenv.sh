#!/bin/bash
source test/prelude.sh

cat <<EOL

You can access bitcoind and lightningd via:

  $ bitcoin-cli --datadir=$BTC_DIR
  $ lightning-cli --lightning-dir=$LN_ALICE_PATH
  $ lightning-cli --lightning-dir=$LN_BOB_PATH

Lightning Charge is available at:

  $CHARGE_URL

You can run the unit tests with:

  $ CHARGE_URL=$CHARGE_URL LN_BOB_PATH=$LN_BOB_PATH mocha

EOL

read -p 'Press enter to shutdown and clean up'
source test/teardown.sh
