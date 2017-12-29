# Lightning Charge

REST API for accepting Lightning payments, built on top of c-lightning.

## Install & Setup

```bash
# Install
$ git clone https://github.com/ElementsProject/lightning-charge && cd lightning-charge
$ npm install

# Configure
$ cp example.env .env && edit .env

# defaults should work, except for API_TOKEN which you must set. you can use:
$ sed -i s/API_TOKEN=.*/API_TOKEN=`tr -cd "[:alnum:]" < /dev/urandom | head -c 64`/ .env

# Setup sqlite schema
$ DB_PATH=sqlite.db knex migrate:latest

# run server
$ npm start
```

## REST API

All endpoints accept and return data in JSON format.

Authentication is done using HTTP basic authentication headers, with `api-token` as the username and
the value of the `API_TOKEN` environment variable (configure in `.env`) as the password.

Invoices have the following properties: `id`, `msatoshi`, `quoted_currency`, `quoted_amount`, `peerid`, `rhash`, `payreq`, `description`, `created_at`, `expires_at`, `completed`, `completed_at` and `metadata`.

### `POST /invoice`

Create a new invoice.

*Body parameters*: `msatoshi`, `currency`, `amount`, `description` and `metadata`.

You can either specify the amount as `msatoshi` (1 msatoshi = 0.001 satoshis),
or provide a `currency` and `amount` to be converted according to the current exchange rates.
You should not specify both.
If a currency and amount were provided, they'll be available under `quoted_{currency|amount}`.

You can optionally specify `metadata` with arbitrary order-related meta-data.

Returns `201 Created` and the invoice on success.

### `GET /invoices`

List invoices.

### `GET /invoice/:id`

Get the specified invoice.

### `GET /invoice/:id/wait?timeout=[sec]`

Long-polling invoice payment notification.

Waits for the invoice to be paid, then returns `200 OK` and the invoice.

If `timeout` (defaults to 30s) is reached before the invoice is paid, returns `402 Payment Required`.

If the invoice is expired, returns `410 Gone`.

### `POST /invoice/:id/webhook`

Register a URL as a web hook to be notified once the invoice is paid.

*Body parameters:* `url`.

Returns `201 Created` on success. Once the payment is made, a POST request with the updated invoice will be made to the provided URL.

If the invoice is already paid, returns `405 Method Not Allowed`. If the invoice is expired, returns `410 Gone`.

For security reasons, the provided `url` should contain a secret token used to verify the authenticity of the request (you can use something like `HMAC(secret_key, rhash)`,
see example implementation in woocommerce-gateway-lightning [here](https://github.com/ElementsProject/woocommerce-gateway-lightning/blob/4051a70147a01b4387598a9facd9c00cae4981f8/woocommerce-gateway-lightning.php#L182-L193)
and [here](https://github.com/ElementsProject/woocommerce-gateway-lightning/blob/4051a70147a01b4387598a9facd9c00cae4981f8/woocommerce-gateway-lightning.php#L119)).

### `GET /payment-stream`

Returns live invoice payment updates as a [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) stream.

### API Examples

```bash
$ CHARGE=$(source .env && echo http://api-token:$API_TOKEN@localhost:$PORT)

# Create new invoice
$ curl -X POST $CHARGE/invoice -d msatoshi=5000 -d metadata[customer_id]=9817 -d metadata[product_id]=7189
{"id":"07W98EUsBtCiyF7BnNcKe","msatoshi":"5000","metadata":{"customer_id":9817,"product_id":7189},"rhash":"3e449cc84d6b2b39df8e375d3cec0d2910e822346f782dc5eb97fea595c175b5","payreq":"lntb500n1pdq55z6pp58ezfejzddv4nnhuwxawnemqd9ygwsg35dauzm30tjll2t9wpwk6sdq0d3hz6um5wf5kkegcqpxpc06kpsp56fjh0jslhatp6kzmp8yxsgdjcfqqckdrrv0n840zqpx496qu5xenrzedlyatesl98dzdt5qcgkjd3l6vhax425jetq2h3gqz2enhk","completed":false,"created_at":1510625370087}

# Create EUR-denominated invoice
$ curl -X POST $CHARGE/invoice -d currency=EUR -d amount=0.5
{"id":"kGsKjn9jbwgqxQzNgQYhE","msatoshi":"7576148","quoted_currency":"EUR","quoted_amount":"0.5", ...}

# Create invoice with json
$ curl -X POST $CHARGE/invoice -H 'Content-Type: application/json' \
  -d '{"msatoshi":5000,"metadata":{"customer_id":9817,"products":[593,182]}'

# Fetch an invoice
$ curl $CHARGE/invoice/07W98EUsBtCiyF7BnNcKe

# Fetch all invoices
$ curl $CHARGE/invoices

# Register a web hook
$ curl -X POST $CHARGE/invoice/07W98EUsBtCiyF7BnNcKe/webhook -d url=https://requestb.in/pfqcmgpf

# Long-poll payment notification for a specific invoice
$ curl $CHARGE/invoice/07W98EUsBtCiyF7BnNcKe/wait?timeout=120

# Stream all incoming payments
$ curl $CHARGE/payment-stream
```

## License

MIT
