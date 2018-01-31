# Lightning Charge

[![build status](https://api.travis-ci.org/ElementsProject/lightning-charge.svg)](https://travis-ci.org/ElementsProject/lightning-charge)
[![npm release](https://img.shields.io/npm/v/lightning-charge.svg)](https://www.npmjs.com/package/lightning-charge)


A drop-in solution for accepting lightning payments, built on top of [c-lightning](https://github.com/ElementsProject/lightning).

- Simple HTTP REST API, optimized for developer friendliness and ease of integration. Near-zero configuration.

- Supports invoice metadata, fiat currency conversion, long polling, web hooks, websockets and server-sent-events.

- Built-in checkout page, can be iframed or redirected to.

:zap: radically low fees :zap: nano payments :zap: instant confirmations :zap:

## Getting Started

Setup [c-lightning](https://github.com/ElementsProject/lightning#getting-started) and nodejs (v7.6 or newer), then:

```bash
$ npm install -g lightning-charge

$ charged --api-token mySecretToken # defaults: --ln-path ~/.lightning --db-path ./charge.db --port 9112

# configuration options may alternatively be provided using environment variables:
$ LN_PATH=~/.lightning DB_PATH=charge.db API_TOKEN=mySecretToken PORT=9112 charged
```

Your chosen `--api-token` will be used to authenticate requests made to the Lightning Charge REST API.

See `$ charged --help` for the full list of available options.

### Docker

Deploy with docker, comes bundled with `bitcoind`+`lightningd`+`charged`:

```bash
$ mkdir data # make sure to create the folder _before_ running docker
$ docker run -u `id -u` -v `pwd`/data:/data -p 9112:9112 \
             -e API_TOKEN=mySecretToken \
             shesek/lightning-charge
```

Runs in `testnet` mode by default, set `NETWORK` to override.

If you want to experiment in regtest mode and don't care about persisting data, this should do:

```bash
$ docker run -e NETWORK=regtest -e API_TOKEN=mySecretToken -p 9112:9112 shesek/lightning-charge
```

To connect to an existing bitcoind instance running on the same machine,
mount the bitcoin data directory to `/etc/bitcoin` (e.g. `-v $HOME/.bitcoin:/etc/bitcoin`).
To connect to a remote bitcoind instance, set `BITCOIND_URI=http://[user]:[pass]@[host]:[port]`
(or use `__cookie__:...` as the login for cookie-based authentication).

### Client libraries

Clients libraries are available for [JavaScript](https://github.com/ElementsProject/lightning-charge-client-js)
and [PHP](https://github.com/ElementsProject/lightning-charge-client-php).
For other languages, you can use the REST API directly using a standard HTTP library.

## REST API

All endpoints accept and return data in JSON format.

Authentication is done using HTTP basic authentication headers, with `api-token` as the username and
the api token (configured with `--api-token`/`-t` or using the `API_TOKEN` environment variable) as the password.

Invoices have the following properties: `id`, `msatoshi`, `quoted_currency`, `quoted_amount`, `rhash`, `payreq`, `description`, `created_at`, `expires_at`, `paid_at`, `metadata` and `status` (one of `unpaid|paid|expired`).

The `completed` (replaced with `status`) and `completed_at` (renamed to `paid_at`) fields are deprecated,
but currently still available. They will eventually be removed.

The code samples below assumes you've set `CHARGE=http://api-token:mySecretToken@localhost:9112`.

### `POST /invoice`

Create a new invoice.

*Body parameters*: `msatoshi`, `currency`, `amount`, `description`, `expiry` and `metadata`.

You can specify the amount as `msatoshi` (1 satoshi = 1000 msatoshis),
or provide a `currency` and `amount` to be converted according to the current exchange rates.
If a currency and amount were provided, they'll be available under `quoted_{currency|amount}`.

`expiry` sets the invoice expiry time in seconds (defaults to one hour).
`metadata` may contain arbitrary invoice-related meta-data.
`description` is embedded in the payment request and presented by the user's wallet (keep it short).

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

Subscribe to payment updates as a [server-sent events](https://streamdata.io/blog/server-sent-events/) stream.

```bash
$ curl $CHARGE/payment-stream
# zzZZzZZ
data:{"id":"OYwwaOQAPMFvg039gj_Rb","msatoshi":"3738106","status":"paid","paid_at":1515371152,...}
# zZZzzZz
data:{"id":"KcoQHfHJSx3fVhp3b1Y3h","msatoshi":"10000","status":"paid","paid_at":1515681209,...}
# zZZzzzz...
```

## WebSocket API

### `GET /ws`

Subscribe to payment updates over WebSocket.

```javascript
const ws = new WebSocket('http://api-token:[TOKEN]@charge.ln/ws')

ws.on('message', msg => {
  const inv = JSON.parse(msg)
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

Tests can also be run using docker: `$ docker run shesek/lightning-charge:testrunner npm test`

## License

MIT
