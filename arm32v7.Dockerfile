FROM node:8.15-slim as builder

ARG STANDALONE

RUN mkdir /opt/local && apt-get update && \
  apt-get install -y --no-install-recommends git qemu qemu-user-static qemu-user binfmt-support

WORKDIR /opt/charged

COPY package.json npm-shrinkwrap.json ./
RUN npm install

COPY . .
RUN npm run dist \
    && rm -rf src

FROM arm32v7/node:8.15-slim

WORKDIR /opt/charged
ARG TESTRUNNER
ENV HOME /tmp
ENV NODE_ENV production
ARG STANDALONE
ENV STANDALONE=$STANDALONE

COPY --from=builder /usr/bin/qemu-arm-static /usr/bin/qemu-arm-static

RUN rm -rf /var/lib/apt/lists/* \
    && ln -s /opt/charged/bin/charged /usr/bin/charged \
    && mkdir /data \
    && ln -s /data/lightning /tmp/.lightning

COPY --from=builder /opt/local /usr/local
COPY --from=builder /opt/charged /opt/charged

CMD [ "bin/docker-entrypoint.sh" ]
EXPOSE 9112 9735
