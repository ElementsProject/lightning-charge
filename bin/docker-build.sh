#!/bin/bash

set -x
set -eo pipefail

VER=`jq -r .version package.json`
NAME=${1:-shesek/lightning-charge}

docker build -t charge .

docker tag charge $NAME:$VER
docker tag charge $NAME:latest
docker tag charge $NAME

read -p 'Press enter to push'

docker push $NAME
