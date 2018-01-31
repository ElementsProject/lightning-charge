#!/bin/bash

set -x
set -eo pipefail

VER=`jq -r .version package.json`
NAME=${1:-shesek/lightning-charge}

docker build -t charge .
docker build --build-arg TESTRUNNER=1 -t charge:testrunner .

docker tag charge $NAME:$VER
docker tag charge $NAME:latest
docker tag charge $NAME

docker tag charge:testrunner $NAME:$VER-testrunner
docker tag charge:testrunner $NAME:testrunner

read -p 'Press enter to push'

docker push $NAME
