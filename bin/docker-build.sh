#!/bin/bash

set -x
set -eo pipefail

VER=`jq -r .version package.json`
NAME=${1:-shesek/lightning-charge}

docker build -t charge .
docker build -t charge-standalone --build-arg STANDALONE=1 .

docker tag charge $NAME:$VER
docker tag charge $NAME:latest
docker tag charge-standalone $NAME:$VER-standalone
docker tag charge-standalone $NAME:standalone

read -p 'Press enter to push'

docker push $NAME
