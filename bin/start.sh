#!/bin/bash
[ -f .env ] && source .env

./bin/charged "$@"
