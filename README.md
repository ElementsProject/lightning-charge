# Lightning Charge

REST API for accepting Lightning payments, built on top of c-lightning.

## Getting Started

### Installation

Setup [c-lightning](https://github.com/ElementsProject/lightning#getting-started), then:

```bash
# Install
$ git clone https://github.com/ElementsProject/lightning-charge && cd lightning-charge
$ npm install

# Configure
$ cp example.env .env
# defaults should work, except for API_TOKEN which is required. LN_PATH is assumed to be ~/.lightning
$ sed -i s/API_TOKEN=$/API_TOKEN=`head -c 20 /dev/urandom | base64 | tr -d '+/='`/ .env

# Start
$ npm start
```

### Running with Docker

You can set everything up with docker (comes bundled with bitcoind+lightningd+charge):

```bash
$ touch sqlite.db
$ echo export API_TOKEN=`head -c 20 /dev/urandom | base64 | tr -d '+/='` > .env

$ docker run -v `pwd`/lightning:/root/.lightning \
             -v `pwd`/bitcoin:/root/.bitcoin \
             -v `pwd`/sqlite.db:/opt/lightning-charge/sqlite.db \
             -v `pwd`/.env:/opt/lightning-charge/.env \
             -p 9112:9112 \
             shesek/lightning-charge

# Instead of mounting an `.env` file, configuration options can also be specified directly via `-e`:
$ docker run [...] -e API_TOKEN=myLongRandomToken -e NODE_ENV=production
```

Runs in `testnet` mode by default.
To run in `regtest` mode, add `-e BITCOIND_OPTS='-regtest' -e LIGHTNINGD_OPTS='--network=regtest'` to the `docker run` command.

### Client libraries

- [NodeJS client](https://github.com/ElementsProject/lightning-charge-client-js)

- [PHP client](https://github.com/ElementsProject/lightning-charge-client-php)


## REST API

All endpoints accept and return data in JSON format.

Authentication is done using HTTP basic authentication headers, with `api-token` as the username and
the value of the `API_TOKEN` environment variable (configure in `.env`) as the password.

Invoices have the following properties: `id`, `msatoshi`, `quoted_currency`, `quoted_amount`, `rhash`, `payreq`, `description`, `created_at`, `expires_at`, `completed_at`, `completed` and `metadata`.

### `POST /invoice`

Create a new invoice.

*Body parameters*: `msatoshi`, `currency`, `amount`, `description`, `expiry` and `metadata`.

You can either specify the amount as `msatoshi` (1 msatoshi = 0.001 satoshis),
or provide a `currency` and `amount` to be converted according to the current exchange rates.
If a currency and amount were provided, they'll be available under `quoted_{currency|amount}`.

`expiry` sets the invoice expiry time in seconds (defaults to one hour).
`metadata` may contain arbitrary invoice-related meta-data.
`description` is embedded in the payment request and presented in the user's wallet (keep it short).

Returns `201 Created` and the invoice on success.

```bash
$ curl http://charge.ln/invoice -d msatoshi=10000
{"id":"KcoQHfHJSx3fVhp3b1Y3h","msatoshi":"10000","completed":false,"rhash":"6823e46a08f50...",
 "payreq":"lntb100n1pd99d02pp...","created_at":1515369962,"expires_at":1515373562}

# with metadata as application/json
$ curl http://charge.ln/invoice -H 'Content-Type: application/json' \
  -d '{"msatoshi":7000,"metadata":{"customer_id":9817,"products":[593,182]}}'
{"id":"PLKV1f8B7sth7w2OeDOt_","msatoshi":"7000","metadata":{"customer_id":9817,"products":[593,182]},...}

# with metadata as application/x-www-form-urlencoded
$ curl http://charge.ln/invoice -d msatoshi=5000 -d metadata[customer_id]=9817 -d metadata[product_id]=7189
{"id":"58H9eoerBpKML9FvnMQtG","msatoshi":"5000","metadata":{"customer_id":"9817","product_id":"7189"},...}

# with fiat-denominated amounts
$ curl http://charge.ln/invoice -d currency=EUR -d amount=0.5
{"id":"OYwwaOQAPMFvg039gj_Rb","msatoshi":"3738106","quoted_currency":"EUR","quoted_amount":"0.5",...}
```

### `GET /invoices`

List all invoices.

```bash
$ curl http://charge.ln/invoices
[{"id":"KcoQHfHJSx3fVhp3b1Y3h","msatoshi":"10000",...},{"id":"PLKV1f8B7sth7w2OeDOt_","msatoshi":"7000"},...]
```

### `GET /invoice/:id`

Get the specified invoice.

```bash
$ curl http://charge.ln/invoice/OYwwaOQAPMFvg039gj_Rb
{"id":"OYwwaOQAPMFvg039gj_Rb","msatoshi":"3738106","quoted_currency":"EUR","quoted_amount":"0.5","completed":false,...}
```

### `GET /invoice/:id/wait?timeout=[sec]`

Long-polling invoice payment notification.

Waits for the invoice to be paid, then returns `200 OK` and the updated invoice.

If `timeout` (defaults to 30s) is reached before the invoice is paid, returns `402 Payment Required`.

If the invoice is expired and can no longer be paid, returns `410 Gone`.

```bash
$ curl http://charge.ln/invoice/OYwwaOQAPMFvg039gj_Rb/wait?timeout=60
# zZZZzzZ
{"id":"OYwwaOQAPMFvg039gj_Rb","msatoshi":"3738106","completed":true,"completed_at":1515371152,...}
```

### `POST /invoice/:id/webhook`

Register a URL as a web hook to be notified once the invoice is paid.

*Body parameters:* `url`.

Returns `201 Created` on success. Once the payment is made, a POST request with the updated invoice will be made to the provided URL.

If the invoice is already paid, returns `405 Method Not Allowed`. If the invoice is expired, returns `410 Gone`.

For security reasons, the provided `url` should contain a secret token used to verify the authenticity of the request
(see an example HMAC-based implementation at woocommerce-gateway-lightning [here](https://github.com/ElementsProject/woocommerce-gateway-lightning/blob/4051a70147a01b4387598a9facd9c00cae4981f8/woocommerce-gateway-lightning.php#L182-L193)
and [here](https://github.com/ElementsProject/woocommerce-gateway-lightning/blob/4051a70147a01b4387598a9facd9c00cae4981f8/woocommerce-gateway-lightning.php#L119)).

```bash
$ curl http://charge.ln/invoice/OYwwaOQAPMFvg039gj_Rb/webhook -d url=http://example.com/callback
Created
```

### `GET /payment-stream`

Returns live invoice payment updates as a [server-sent events](https://streamdata.io/blog/server-sent-events/) stream.

```bash
$ curl http://charge.ln/payment-stream
# zzZZzZZ
data: {"id":"OYwwaOQAPMFvg039gj_Rb","msatoshi":"3738106","completed":true,"completed_at":1515371152,...}
# zZZzzZz
data: {"id":"KcoQHfHJSx3fVhp3b1Y3h","msatoshi":"10000","completed":true,"completed_at":1515681209,...}
# zZZzzzz...
```

## Tests

To run the tests, make sure `bitcoind`, `bitcoin-cli`, `lightningd`, `lightnin-cli`
and [`jq`](https://stedolan.github.io/jq/download/) are in your `PATH`,
then run `npm test`.
This will setup a temporary testing environment with a bitcoind regtest node
and two c-lightning nodes with a funded channel,
then start the Lightning Charge server and run the unit tests
(written with [mocha](https://mochajs.org/) and [supertest](https://github.com/visionmedia/supertest)).

To run in verbose mode, set the `VERBOSE` environment variable: `VERBOSE=1 npm test`.

To pass arguments to mocha, set the `MOCHA_OPTS` environment variable: `MOCHA_OPTS='--reporter nyan' npm test`.

To prevent the test environment files from being deleted after completing the tests, set `KEEP_TMPDIR=1`.

To setup a testing environment without running the tests, run `npm run testenv`.
This will display information about the running services and keep them alive for further inspection.

Tests can also be run inside docker: `$ docker run shesek/lightning-charge npm test`

## License

MIT
