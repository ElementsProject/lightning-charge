#!/bin/bash

if [[ -z "$CHARGE_URL" || -z "$LN_BOB_PATH" ]]; then
  source test/prelude.sh
fi

echo Running unit tests

CHARGE_URL=$CHARGE_URL LN_BOB_PATH=$LN_BOB_PATH \
mocha $@ $MOCHA_OPTS

[[ -n "$VERBOSE" ]] && lna listpeers | jq -c .peers[0]

source test/teardown.sh
