#!/bin/bash
set -xeo pipefail

docker_name=shesek/lightning-charge
version=`node -p 'require("./package").version'`

export DOCKER_CLI_EXPERIMENTAL=enabled

# Building the arm32v7 image requires registering qemu on the host, which can be done using one of the following:
# sudo apt-get install qemu binfmt-support qemu-user-static
# docker run --rm --privileged multiarch/qemu-user-static:register --reset

docker build -t $docker_name:$version-amd64 .
docker build -t $docker_name:$version-standalone-amd64 --build-arg STANDALONE=1 .
docker build -t $docker_name:$version-standalone-arm32v7 -f arm32v7.Dockerfile .
docker build -t $docker_name:$version-standalone-arm64v8 -f arm64v8.Dockerfile .

# Need to push architecture specific images to make the manifest
docker push $docker_name:$version-standalone-amd64
docker push $docker_name:$version-standalone-arm32v7
docker push $docker_name:$version-standalone-arm64v8

# Tagging a manifest does not work, so we need to create a manifest list for both tags
for target in "$docker_name:$version-standalone" "$docker_name:standalone"
do
  # We need to create the multi arch image for -standalone
  # Make sure experimental docker cli feature is on: echo "{ \"experimental\": \"enabled\" }" >> $HOME/.docker/config.json
  docker manifest create --amend $target $docker_name:$version-standalone-amd64 $docker_name:$version-standalone-arm32v7 $docker_name:$version-standalone-arm64v8
  docker manifest annotate $target $docker_name:$version-standalone-amd64 --os linux --arch amd64
  docker manifest annotate $target $docker_name:$version-standalone-arm32v7 --os linux --arch arm --variant v7
  docker manifest annotate $target $docker_name:$version-standalone-arm64v8 --os linux --arch arm64 --variant v8
  docker manifest push $target -p
done


docker tag $docker_name:$version-standalone-arm32v7 $docker_name:standalone-arm32v7
docker tag $docker_name:$version-standalone-arm64v8 $docker_name:standalone-arm64v8
docker tag $docker_name:$version-standalone-amd64 $docker_name:standalone-amd64
docker tag $docker_name:$version-amd64 $docker_name:$version
docker tag $docker_name:$version-amd64 $docker_name:latest

docker push $docker_name:$version-amd64
docker push $docker_name:standalone-arm32v7
docker push $docker_name:standalone-arm64v8
docker push $docker_name:standalone-amd64
docker push $docker_name:$version
docker push $docker_name:latest
