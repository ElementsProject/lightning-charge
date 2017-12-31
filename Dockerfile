FROM ubuntu:16.04

ENV BITCOIND_ARGS='-testnet'
ENV LIGHTNINGD_ARGS='--network=testnet'
ENV LIGHTNINGD_VERSION=master

ENV HOST=0.0.0.0
ENV DEBUG=lightning-charge,lightning-client,knex:query,knex:bindings,superagent

# bitcoind & lightningd dependencies
RUN gpg --keyserver hkp://keyserver.ubuntu.com --recv-keys D46F45428842CE5E && \
    gpg --export --armor D46F45428842CE5E | apt-key add - && \
    echo deb http://ppa.launchpad.net/bitcoin/bitcoin/ubuntu xenial main | tee /etc/apt/sources.list.d/bitcoin-bitcoin-xenial.list && \
    apt-get update -qq && \
    apt-get install -qq -y --no-install-recommends python python3 git make automake autoconf libtool bitcoind build-essential libprotobuf-c-dev libsodium-dev libbase58-dev libsqlite3-dev libgmp-dev libsqlite3-dev git net-tools valgrind curl ca-certificates jq

# lightningd
RUN git clone https://github.com/ElementsProject/lightning.git /opt/lightningd && \
    cd /opt/lightningd && \
    git checkout $LIGHTNINGD_VERSION && \
    make && cp lightningd/lightning* cli/lightning-cli /usr/bin/

# nodejs 8 & node-canvas dependencies
RUN curl -s https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - && \
    echo deb http://deb.nodesource.com/node_8.x xenial main | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update -qq && \
    apt-get install -qq -y nodejs

# Lightning Charge
WORKDIR /opt/lightning-charge
COPY package*.json ./
RUN npm install
COPY . .
ENTRYPOINT /opt/lightning-charge/docker-entrypoint.sh
EXPOSE 9112
