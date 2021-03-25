FROM node:12.16-slim as builder

ARG STANDALONE

RUN mkdir /opt/local && apt-get update && \
  apt-get install -y --no-install-recommends git qemu qemu-user-static qemu-user binfmt-support wget ca-certificates

RUN wget -qO /usr/bin/tini "https://github.com/krallin/tini/releases/download/v0.19.0/tini-armhf" \
    && echo "5a9b35f09ad2fb5d08f11ceb84407803a1deff96cbdc0d1222f9f8323f3f8ad4 /usr/bin/tini" | sha256sum -c - \
    && chmod +x /usr/bin/tini

WORKDIR /opt/charged

COPY package.json npm-shrinkwrap.json ./
RUN npm install

COPY . .
RUN npm run dist \
    && rm -rf src

FROM arm32v7/node:12.16-slim

WORKDIR /opt/charged
ARG TESTRUNNER
ENV HOME /tmp
ENV NODE_ENV production
ARG STANDALONE
ENV STANDALONE=$STANDALONE

COPY --from=builder /usr/bin/qemu-arm-static /usr/bin/qemu-arm-static

RUN apt-get update && apt-get install -y --no-install-recommends inotify-tools \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /opt/charged/bin/charged /usr/bin/charged \
    && mkdir /data \
    && ln -s /data/lightning /tmp/.lightning

COPY --from=builder /opt/local /usr/local
COPY --from=builder /opt/charged /opt/charged
COPY --from=builder /usr/bin/tini /usr/bin/

ENTRYPOINT [ "tini", "-g", "--", "bin/docker-entrypoint.sh" ]
EXPOSE 9112 9735
