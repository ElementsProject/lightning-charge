#!/bin/bash
echo Cleaning up test environment...

kill -TERM $$ # trapped (in prelude.sh) to kill all child processes

if [ -z "$KEEP_TMPDIR" ]; then sleep 1 && rm -rf $DIR; fi
