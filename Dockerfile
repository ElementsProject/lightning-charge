FROM node:8.9-slim as builder

RUN apt-get update && apt-get install -y --no-install-recommends git curl build-essential ca-certificates jq inotify-tools wget \
    autoconf automake build-essential libtool libgmp-dev libsqlite3-dev python python3

# lightningd
ENV LIGHTNINGD_VERSION=master
RUN git clone https://github.com/ElementsProject/lightning.git /opt/lightningd && \
    cd /opt/lightningd && \
    git checkout $LIGHTNINGD_VERSION && \
    make && rm -rf *.c *.h *.o Makefile test

# bitcoind
ENV BITCOIN_VERSION 0.15.1
ENV BITCOIN_URL https://bitcoincore.org/bin/bitcoin-core-0.15.1/bitcoin-0.15.1-x86_64-linux-gnu.tar.gz
ENV BITCOIN_SHA256 387c2e12c67250892b0814f26a5a38f837ca8ab68c86af517f975a2a2710225b
ENV BITCOIN_ASC_URL https://bitcoincore.org/bin/bitcoin-core-0.15.1/SHA256SUMS.asc
ENV BITCOIN_PGP_KEY 01EA5486DE18A882D4C2684590C8019E36C2E964
RUN mkdir -p /tmp/bitcoin \
    && cd /tmp/bitcoin \
	&& wget -qO bitcoin.tar.gz "$BITCOIN_URL" \
	&& echo "$BITCOIN_SHA256 bitcoin.tar.gz" | sha256sum -c - \
	&& gpg --keyserver keyserver.ubuntu.com --recv-keys "$BITCOIN_PGP_KEY" \
	&& wget -qO bitcoin.asc "$BITCOIN_ASC_URL" \
	&& gpg --verify bitcoin.asc \
	&& tar -xzvf bitcoin.tar.gz -C /tmp/bitcoin --strip-components=1 --exclude=*-qt \
    && mkdir -p /opt/bitcoin \
    && cp /tmp/bitcoin/bin/bitcoind /opt/bitcoin/bitcoind \
    && cp /tmp/bitcoin/bin/bitcoin-cli /opt/bitcoin/bitcoin-cli \
	&& rm -rf /tmp/bitcoin

WORKDIR /opt/charged
COPY package*.json ./
RUN npm install

FROM node:8.9-slim

COPY --from=builder /opt/lightningd/lightningd /usr/bin
COPY --from=builder /opt/lightningd/cli/lightning-cli /usr/bin/lightning-cli
COPY --from=builder /opt/bitcoin/bitcoind /usr/bin/bitcoind
COPY --from=builder /opt/bitcoin/bitcoin-cli /usr/bin/bitcoin-cli
COPY --from=builder /opt/charged /opt/charged

WORKDIR /opt/charged
ENV HOME=/tmp
RUN mkdir -p /data

RUN apt-get update && apt-get install -y --no-install-recommends libgmp-dev libsqlite3-dev jq inotify-tools && \
    rm -rf /var/lib/apt/lists/*

COPY . .
RUN ln -s /opt/charged/bin/charged /usr/bin/charged
CMD bin/docker-entrypoint.sh
EXPOSE 9112 9735
