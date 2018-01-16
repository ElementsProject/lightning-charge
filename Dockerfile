FROM ubuntu:17.04

ENV LIGHTNINGD_VERSION=master
ENV BITCOIN_PPA_KEY=C70EF1F0305A1ADB9986DBD8D46F45428842CE5E

RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates jq dirmngr

# bitcoind
RUN gpg --keyserver hkp://keyserver.ubuntu.com --recv-keys $BITCOIN_PPA_KEY && \
    gpg --export --armor $BITCOIN_PPA_KEY | apt-key add - && \
    echo deb http://ppa.launchpad.net/bitcoin/bitcoin/ubuntu zesty main | tee /etc/apt/sources.list.d/bitcoin.list && \
    apt-get update -o Dir::Etc::sourcelist=sources.list.d/bitcoin.list -o Dir::Etc::sourceparts=- -o APT::Get::List-Cleanup=0 && \
    apt-get install -y bitcoind

# lightningd
RUN apt-get install -y --no-install-recommends autoconf automake build-essential libtool libgmp-dev libsqlite3-dev python python3 && \
    git clone https://github.com/ElementsProject/lightning.git /opt/lightningd && \
    cd /opt/lightningd && \
    git checkout $LIGHTNINGD_VERSION && \
    make && cp lightningd/lightning* cli/lightning-cli /usr/bin/

# nodejs 8
RUN curl -s https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - && \
    echo deb http://deb.nodesource.com/node_8.x zesty main | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update -o Dir::Etc::sourcelist=sources.list.d/nodesource.list -o Dir::Etc::sourceparts=- -o APT::Get::List-Cleanup=0 && \
    apt-get install -y nodejs

# Lightning Charge
WORKDIR /opt/charged
COPY package*.json ./
RUN npm install
COPY . .
RUN ln -s /opt/charged/bin/charged /usr/bin/charged
CMD bin/docker-entrypoint.sh
EXPOSE 9112 9735
