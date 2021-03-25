FROM node:12.16-slim as builder

ARG STANDALONE

RUN mkdir /opt/local && apt-get update && \
  apt-get install -y --no-install-recommends git qemu qemu-user-static qemu-user binfmt-support wget ca-certificates

RUN wget -qO /usr/bin/tini "https://github.com/krallin/tini/releases/download/v0.19.0/tini-arm64" \
    && echo "07952557df20bfd2a95f9bef198b445e006171969499a1d361bd9e6f8e5e0e81 /usr/bin/tini" | sha256sum -c - \
    && chmod +x /usr/bin/tini

WORKDIR /opt/charged

COPY package.json npm-shrinkwrap.json ./
RUN npm install

COPY . .
RUN npm run dist \
    && rm -rf src

FROM arm64v8/node:12.16-slim

WORKDIR /opt/charged
ARG TESTRUNNER
ENV HOME /tmp
ENV NODE_ENV production
ARG STANDALONE
ENV STANDALONE=$STANDALONE

COPY --from=builder /usr/bin/qemu-aarch64-static /usr/bin/qemu-aarch64-static

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
