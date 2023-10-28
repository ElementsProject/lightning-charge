# Lightning Charge

[![build status](https://api.travis-ci.org/ElementsProject/lightning-charge.svg)](https://travis-ci.org/ElementsProject/lightning-charge)
[![npm release](https://img.shields.io/npm/v/lightning-charge.svg)](https://www.npmjs.com/package/lightning-charge)
[![docker release](https://img.shields.io/docker/pulls/shesek/lightning-charge.svg)](https://hub.docker.com/r/shesek/lightning-charge/)
[![MIT license](https://img.shields.io/github/license/elementsproject/lightning-charge.svg)](https://github.com/ElementsProject/lightning-charge/blob/master/LICENSE)
[![Pull Requests Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![IRC](https://img.shields.io/badge/chat-on%20freenode-brightgreen.svg)](https://webchat.freenode.net/?channels=lightning-charge)


A drop-in solution for accepting lightning payments, built on top of [c-lightning](https://github.com/ElementsProject/lightning).

- Simple HTTP REST API, optimized for developer friendliness and ease of integration. Near-zero configuration.

- Supports invoice metadata, fiat currency conversion, long polling, web hooks, websockets and server-sent-events.

- Built-in checkout page, can be iframed or redirected to.

:zap: radically low fees :zap: nano payments :zap: instant confirmations :zap:

## Getting Started

Setup [c-lightning](https://github.com/ElementsProject/lightning#getting-started) and nodejs (v7.6 or newer), then:

```bash
$ npm install -g lightning-charge

$ charged --api-token mySecretToken # defaults: --ln-path ~/.lightning/testnet --db-path ./charge.db --port 9112

```

> Note: if you're running into permission issues, try following
[these instructions](https://docs.npmjs.com/getting-started/fixing-npm-permissions#option-two-change-npms-default-directory).

That's it! The Lightning Charge REST API is now running and ready to process payments.
You can access it at `http://localhost:9112` using the API access token configured with `--api-token`.

Configuration options may alternatively be provided using environment variables:

```bash
$ LN_PATH=~/.lightning/testnet DB_PATH=charge.db API_TOKEN=mySecretToken PORT=9112 charged
```

Listens for connections on `127.0.0.1` by default. Set `-i 0.0.0.0` to bind on all available interfaces.
Note that Charge does not have TLS encryption and should not normally be exposed directly to the public
internet. For remote access, you should setup an SSH tunnel or a TLS-enabled reverse proxy like nginx.

See `$ charged --help` for the full list of available options.

### Deploy with Docker

To deploy Lightning Charge with Docker, run these commands:

```bash
$ mkdir data # make sure to create the folder _before_ running docker
$ docker run -it -u `id -u` -v `pwd`/data:/data -p 9735:9735 -p 9112:9112 \
             shesek/lightning-charge --api-token mySecretToken
```

This will start `bitcoind`, `lightningd` and `charged` and hook them up together.
You will then be able to access the REST API at `http://localhost:9112` using `mySecretToken`.

Runs in `testnet` mode by default, set `NETWORK` to override.

If you want to experiment in `regtest` mode and don't care about persisting data, this should do:

```bash
$ docker run -it -e NETWORK=regtest -p 9112:9112 shesek/lightning-charge --api-token mySecretToken
```

To connect to an existing `lightningd` instance running on the same machine,
mount the lightning data directory to `/etc/lightning` (e.g. `-v $HOME/.lightning:/etc/lightning`).
Connecting to remote lightningd instances is currently not supported.

To connect to an existing `bitcoind` instance running on the same machine,
mount the bitcoin data directory to `/etc/bitcoin` (e.g. `-v $HOME/.bitcoin:/etc/bitcoin`).
To connect to a remote bitcoind instance, set `BITCOIND_URI=http://[user]:[pass]@[host]:[port]`
(or use `__cookie__:...` as the login for cookie-based authentication).

### Deploy to Azure

[One-click deployment on Azure](https://github.com/NicolasDorier/lightning-charge-azure)
(by [@NicolasDorier](https://github.com/NicolasDorier)).

An instructional video is [available here](https://www.youtube.com/watch?v=D4RqULSA4uU).

## Client libraries

Clients libraries are available for [JavaScript](https://github.com/ElementsProject/lightning-charge-client-js)
and [PHP](https://github.com/ElementsProject/lightning-charge-client-php).
For other languages, you can use the REST API directly using a standard HTTP library.

## LApps

Below are example LApps built on top of Lightning Charge:

- [FileBazaar](https://github.com/ElementsProject/filebazaar): an ecommerce tool for content creators that produce digital files like photos, videos, or music.

- [Lightning Publisher](https://github.com/ElementsProject/wordpress-lightning-publisher): accept bitcoin payments for content on WordPress blogs.

- [nanotip](https://github.com/ElementsProject/nanotip): a simple web server for accepting lightning donations (a lightning tip jar).

- [paypercall](https://github.com/ElementsProject/paypercall): easily charge for HTTP APIs on a pay-per-call basis.

- [nanopos](https://github.com/ElementsProject/nanopos): a simple point-of-sale system for physical stores.

- [ifpaytt](https://github.com/ElementsProject/ifpaytt): trigger IFTTT actions with lightning payments.

- [WooCommerce Lightning](https://github.com/ElementsProject/woocommerce-gateway-lightning): a lightning gateway for the WooCommerce e-commerce software.

- [Lightning Jukebox](https://github.com/ElementsProject/lightning-jukebox): a lightning powered jukebox. Pay with Bitcoin to choose your music.

Third party Lapps:

- [Satoshi's Place](https://github.com/LightningK0ala/satoshis.place): a collaborative art board, pay with lightning to draw on a pixel grid. (live on [satoshis.place](https://satoshis.place/))

- [Pollo feed](https://github.com/j-chimienti/pollofeed): a lightning powered chicken feeder. (live on [pollofeed.com](https://pollofeed.com/))

- [lightning-captive-portal](https://github.com/poperbu/lightning-captive-portal/): Wi-Fi access through a nodogsplash captive portal with Lightning payments.

## REST API

All endpoints accept and return data in JSON format.

Authentication is done using HTTP basic authentication headers, with `api-token` as the username and
the api token (configured with `--api-token`/`-t` or using the `API_TOKEN` environment variable) as the password.

Invoices have the following properties: `id`, `msatoshi`, `msatoshi_received`, `quoted_currency`, `quoted_amount`, `rhash`, `payreq`, `description`, `created_at`, `expires_at`, `paid_at`, `metadata` and `status` (one of `unpaid|paid|expired`).

The code samples below assume you've set `CHARGE=http://api-token:mySecretToken@localhost:9112`.

### `GET /info`

Get information about the c-lightning node.

```bash
$ curl $CHARGE/info
{"id":"032c6ba19a2141c5fee6ac8b6ff6cf24456fd4e8e206716a39af3300876c3a4835","port":42259,"address":[],"version":"v0.5.2-2016-11-21-1937-ge97ee3d","blockheight":434,"network":"regtest"}
```

### `POST /invoice`

Create a new invoice.

*Body parameters*: `msatoshi`, `currency`, `amount`, `description`, `expiry`, `metadata` and `webhook`.

You can specify the amount as `msatoshi` (1 satoshi = 1000 msatoshis),
or provide a `currency` and `amount` to be converted according to the current exchange rates (via bitcoinaverage).
If a currency and amount were provided, they'll be available under `quoted_{currency|amount}`.

`expiry` sets the invoice expiry time in seconds (defaults to one hour).
`metadata` may contain arbitrary invoice-related meta-data.
`description` is embedded in the payment request and presented by the user's wallet (keep it short).

`webhook` may contain a URL to be registered as a webhook
(see [`POST /invoice/:id/webhook`](https://github.com/ElementsProject/lightning-charge#post-invoiceidwebhook)).

Returns `201 Created` and the invoice on success.

```bash
$ curl -X POST $CHARGE/invoice -d msatoshi=10000
{"id":"KcoQHfHJSx3fVhp3b1Y3h","msatoshi":"10000","status":"unpaid","rhash":"6823e46a08f50...",
 "payreq":"lntb100n1pd99d02pp...","created_at":1515369962,"expires_at":1515373562}

# with fiat-denominated amounts
$ curl -X POST $CHARGE/invoice -d currency=EUR -d amount=0.5
{"id":"OYwwaOQAPMFvg039gj_Rb","msatoshi":"3738106","quoted_currency":"EUR","quoted_amount":"0.5",...}

# without amount (accept all payments)
$ curl -X POST $CHARGE/invoice
{"id":"W8CF0UqY7qfAHCfnchqk9","msatoshi":null,...}

# with metadata as application/json
$ curl -X POST $CHARGE/invoice -H 'Content-Type: application/json' \
  -d '{"msatoshi":7000,"metadata":{"customer_id":9817,"products":[593,182]}}'
{"id":"PLKV1f8B7sth7w2OeDOt_","msatoshi":"7000","metadata":{"customer_id":9817,"products":[593,182]},...}

# with metadata as application/x-www-form-urlencoded
$ curl -X POST $CHARGE/invoice -d msatoshi=5000 -d metadata[customer_id]=9817 -d metadata[product_id]=7189
{"id":"58H9eoerBpKML9FvnMQtG","msatoshi":"5000","metadata":{"customer_id":"9817","product_id":"7189"},...}
```

### `GET /invoices`

List all invoices.

```bash
$ curl $CHARGE/invoices
[{"id":"KcoQHfHJSx3fVhp3b1Y3h","msatoshi":"10000",...},{"id":"PLKV1f8B7sth7w2OeDOt_","msatoshi":"7000"},...]
```

### `GET /invoice/:id`

Get the specified invoice.

```bash
$ curl $CHARGE/invoice/OYwwaOQAPMFvg039gj_Rb
{"id":"OYwwaOQAPMFvg039gj_Rb","msatoshi":"3738106","quoted_currency":"EUR","quoted_amount":"0.5","status":"unpaid",...}
```

### `DELETE /invoice/:id`

Delete the specified invoice.

*Body parameters:* `status`

The current status of the invoice needs to be specified in the request body.

```bash
$ curl -X DELETE $CHARGE/invoice/OYwwaOQAPMFvg039gj_Rb -d status=unpaid
204 No Content
```

### `GET /invoice/:id/wait?timeout=[sec]`

Long-polling invoice payment notification.

Waits for the invoice to be paid, then returns `200 OK` and the updated invoice.

If `timeout` (defaults to 30s) is reached before the invoice is paid, returns `402 Payment Required`.

If the invoice is expired and can no longer be paid, returns `410 Gone`.

```bash
$ curl $CHARGE/invoice/OYwwaOQAPMFvg039gj_Rb/wait?timeout=60
# zZZZzzZ
{"id":"OYwwaOQAPMFvg039gj_Rb","msatoshi":"3738106","status":"paid","paid_at":1515371152,...}
```

### `POST /invoice/:id/webhook`

Register a URL as a web hook to be notified once the invoice is paid.

*Body parameters:* `url`.

Returns `201 Created` on success. Once the payment is made, a POST request with the updated invoice will be made to the provided URL.

If the invoice is already paid, returns `405 Method Not Allowed`. If the invoice is expired, returns `410 Gone`.

Webhooks can also be registered during invoice creation using the `webhook` parameter.

For security reasons, the provided `url` should contain a secret token used to verify the authenticity of the request
(see an example HMAC-based implementation at woocommerce-gateway-lightning
[here](https://github.com/ElementsProject/woocommerce-gateway-lightning/blob/84592d7bcfc41db129b02d1927a6060a05c5c11e/woocommerce-gateway-lightning.php#L214-L225),
[here](https://github.com/ElementsProject/woocommerce-gateway-lightning/blob/84592d7bcfc41db129b02d1927a6060a05c5c11e/woocommerce-gateway-lightning.php#L131-L134)
and [here](https://github.com/ElementsProject/woocommerce-gateway-lightning/blob/84592d7bcfc41db129b02d1927a6060a05c5c11e/woocommerce-gateway-lightning.php#L109-L115)).

```bash
$ curl -X POST $CHARGE/invoice/OYwwaOQAPMFvg039gj_Rb/webhook -d url=http://example.com/callback
Created
```

### `GET /payment-stream`

Subscribe to payment updates as a [server-sent events](https://apifriends.com/api-streaming/server-sent-events/) stream.

```bash
$ curl $CHARGE/payment-stream
# zzZZzZZ
data:{"id":"OYwwaOQAPMFvg039gj_Rb","msatoshi":"3738106","status":"paid","paid_at":1515371152,...}
# zZZzzZz
data:{"id":"KcoQHfHJSx3fVhp3b1Y3h","msatoshi":"10000","status":"paid","paid_at":1515681209,...}
# zZZzzzz...
```

Or via JavaScript:

```js
const es = new EventSource('http://api-token:[TOKEN]@localhost:9112/payment-stream')

es.addEventListener('message', msg => {
  const inv = JSON.parse(msg.data)
  console.log('Paid invoice:', inv)
})
```

(`EventSource` is natively available in modern browsers,
or via the [`eventsource` library](https://github.com/EventSource/eventsource) in nodejs)

## WebSocket API

### `GET /ws`

Subscribe to payment updates over WebSocket.

```javascript
const ws = new WebSocket('http://api-token:[TOKEN]@localhost:9112/ws')

ws.addEventListener('message', msg => {
  const inv = JSON.parse(msg.data)
  console.log('Paid invoice:', inv)
})
```

## Tests

Requires `bitcoind`, `bitcoin-cli`, `lightningd`, `lightning-cli`
and [`jq`](https://stedolan.github.io/jq/download/) to be in your `PATH`.

```bash
$ git clone https://github.com/ElementsProject/lightning-charge.git
$ cd lightning-charge
$ npm install
$ npm test
```

This will setup a temporary testing environment with a bitcoind regtest node
and two c-lightning nodes with a funded channel,
then start the Lightning Charge server and run the unit tests
(written with [mocha](https://mochajs.org/) and [supertest](https://github.com/visionmedia/supertest)).

To run in verbose mode, set the `VERBOSE` environment variable: `$ VERBOSE=1 npm test`.

To pass arguments to mocha, use `$ npm test -- [mocha opts]`.

To prevent the test environment files from being deleted after completing the tests, set `KEEP_TMPDIR=1`.

To setup a testing environment without running the tests, run `$ npm run testenv`.
This will display information about the running services and keep them alive for further inspection.

Tests can also be run using docker: `$ docker build --build-arg TESTRUNNER=1 -t charge . && docker run -it --entrypoint npm charge test`

## License

MIT
