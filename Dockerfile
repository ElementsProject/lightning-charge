FROM node:8.9-slim as builder

RUN apt-get update && apt-get install -y --no-install-recommends autoconf automake build-essential git libtool libgmp-dev \
  libsqlite3-dev python python3 wget zlib1g-dev

ARG TESTRUNNER
ARG LIGHTNINGD_VERSION=v0.6

RUN git clone https://github.com/ElementsProject/lightning.git /opt/lightningd \
    && cd /opt/lightningd \
    && git checkout $LIGHTNINGD_VERSION \
    && DEVELOPER=$TESTRUNNER ./configure \
    && make

ENV BITCOIN_VERSION 0.16.2
ENV BITCOIN_URL https://bitcoincore.org/bin/bitcoin-core-$BITCOIN_VERSION/bitcoin-$BITCOIN_VERSION-x86_64-linux-gnu.tar.gz
ENV BITCOIN_SHA256 71f217e30e98d5ccc1fb574b9499595e87e118e596278fad5507a7b84650859c
ENV BITCOIN_ASC_URL https://bitcoincore.org/bin/bitcoin-core-$BITCOIN_VERSION/SHA256SUMS.asc
ENV BITCOIN_PGP_KEY 01EA5486DE18A882D4C2684590C8019E36C2E964
RUN mkdir /opt/bitcoin && cd /opt/bitcoin \
    && wget -qO bitcoin.tar.gz "$BITCOIN_URL" \
    && echo "$BITCOIN_SHA256 bitcoin.tar.gz" | sha256sum -c - \
    && gpg --keyserver keyserver.ubuntu.com --recv-keys "$BITCOIN_PGP_KEY" \
    && wget -qO bitcoin.asc "$BITCOIN_ASC_URL" \
    && gpg --verify bitcoin.asc \
    && BD=bitcoin-$BITCOIN_VERSION/bin \
    && tar -xzvf bitcoin.tar.gz $BD/bitcoind $BD/bitcoin-cli --strip-components=1

WORKDIR /opt/charged

COPY package*.json ./
RUN npm install \
   && test -n "$TESTRUNNER" || { \
      cp -r node_modules node_modules.dev \
      && npm prune --production \
      && mv -f node_modules node_modules.prod \
      && mv -f node_modules.dev node_modules; }

# https://github.com/npm/npm/issues/19356#issuecomment-361475985

COPY . .
RUN npm run dist \
    && rm -rf src \
    && test -n "$TESTRUNNER" || (rm -rf test node_modules && mv -f node_modules.prod node_modules)

FROM node:8.9-slim

WORKDIR /opt/charged
ARG TESTRUNNER
ENV HOME /tmp
ENV NODE_ENV production

RUN apt-get update && apt-get install -y --no-install-recommends inotify-tools libgmp-dev libsqlite3-dev \
      $(test -n "$TESTRUNNER" && echo jq) \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /opt/charged/bin/charged /usr/bin/charged \
    && mkdir /data \
    && ln -s /data/lightning /tmp/.lightning

COPY --from=builder /opt/lightningd/cli/lightning-cli /usr/bin
COPY --from=builder /opt/lightningd/lightningd/lightning* /usr/bin/
COPY --from=builder /opt/bitcoin/bin /usr/bin
COPY --from=builder /opt/charged /opt/charged

CMD bin/docker-entrypoint.sh
EXPOSE 9112 9735
