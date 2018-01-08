#!/bin/bash

source test/prelude.sh

echo Running unit tests

CHARGE_URL=$CHARGE_URL LN_BOB_PATH=$LN_BOB_PATH \
mocha $MOCHA_OPTS

[[ -n "$VERBOSE" ]] && lna getpeers | jq -c .peers[0]

source test/teardown.sh
