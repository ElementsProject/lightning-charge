const { ok, equal: eq } = require('assert')

describe('Invoice API', function() {
  let charge, lnBob
  before(() => {
    charge = require('supertest')(process.env.CHARGE_URL)
    lnBob  = require('lightning-client')(process.env.LN_BOB_PATH)
  })

  describe('POST /invoice', () => {
    it('creates invoices', () =>
      charge.post('/invoice')
        .send({ msatoshi: '100' })
        .expect(201)
        .expect('Content-Type', /json/)
        .expect(({ body }) => {
          ok(body.id && body.rhash && body.payreq)
          eq(body.msatoshi, '100')
          eq(body.completed, false)
        })
    )

    it('can attach metadata', () =>
      charge.post('/invoice').type('json')
        .send({ msatoshi: '100', metadata: { customer_id: 1978, products: [ 123, 456 ] } })
        .expect(201)
        .expect(({ body }) => {
          eq(body.metadata.customer_id, 1978)
          eq(body.metadata.products.length, 2)
        })
    )

    it('accepts amounts denominated in fiat currencies', () =>
      charge.post('/invoice')
        .send({ currency: 'ILS', amount: '0.05' })
        .expect(201)
        .expect(({ body }) => {
          eq(body.quoted_currency, 'ILS')
          eq(body.quoted_amount, '0.05')
          ok(/^\d+$/.test(body.msatoshi))
        })
    )

    it('can override the expiry time', () =>
      charge.post('/invoice')
        .send({ msatoshi: '20', expiry: 5 /*seconds*/ })
        .expect(201)
        .expect(r => r.body.expires_at*1000 - Date.now() < 5000)
    )
  })

  const mkInvoice = props =>
    charge.post('/invoice').send(props)
      .expect(201).then(r => r.body)

  describe('GET /invoices', () => {
    it('retrieves all invoices', () =>
      charge.get('/invoices')
        .expect(200)
        .expect(({ body }) => {
          ok(Array.isArray(body))
          ok(body[0].id && body[1].created_at && body[2].rhash)
        })
    )
  })

  describe('GET /invoice/:invoice', () => {
    let inv
    before(async () =>
      inv = await mkInvoice({ msatoshi: '180000' })
    )

    it('retrieves an invoice by id', () =>
      charge.get(`/invoice/${ inv.id }`)
        .expect(200)
        .expect(({ body }) => {
          eq(body.id, inv.id)
          eq(body.msatoshi, '180000')
          eq(body.rhash, inv.rhash)
          eq(body.completed, false)
        })
    )
  })

  describe('GET /invoice/:invoice/wait', function() {
    this.slow(500)

    let inv1, inv2, inv3
    before(async () => {
      inv1 = await mkInvoice({ msatoshi: '50' })
      inv2 = await mkInvoice({ msatoshi: '60' })
      inv3 = await mkInvoice({ msatoshi: '70', expiry: 1 /* second */ })

      setTimeout(() => lnBob.pay(inv1.payreq), 250)
    })

    it('blocks until the invoice is paid', () =>
      charge.get(`/invoice/${ inv1.id }/wait?timeout=1`)
        .expect(200)
        .expect(r => ok(r.body.completed && r.body.completed_at))
    )

    it('... or until the timeout is reached', () =>
      charge.get(`/invoice/${ inv2.id }/wait?timeout=0.25`)
        .expect(402)
    )

    it('doesn\'t keep you waiting for expired invoices', async () => {
      const timeLeft = inv3.expires_at*1000 - Date.now()
      if (timeLeft > 0) await new Promise(resolve => setTimeout(resolve, timeLeft))
      await charge.get(`/invoice/${ inv3.id }/wait`)
        .expect(410)
    })
  })

  describe('GET /payment-stream', function() {
    this.slow(1000)

    before(() =>
      setTimeout(async () => {
        lnBob.pay(await mkInvoice({ msatoshi: '87' }).then(inv => inv.payreq))
        lnBob.pay(await mkInvoice({ msatoshi: '78' }).then(inv => inv.payreq))
      }, 250)
    )

    it('streams all incoming payments', () =>
      charge.get('/payment-stream')
        .parse(sseParser(events => events.length == 2))
        .expect(({ res: { events } }) => {
          eq(events.length, 2)
          ok(events[0].completed && events[1].completed)
          eq(events[0].msatoshi, '87')
          eq(events[1].msatoshi, '78')
        })
    )
  })

  after(() => {
    lnBob.client.removeAllListeners('end') // disable automatic reconnection
    lnBob.client.end()
  })
})

// Superagent parser for HTTP server-sent events responses
// the `testUntil` predicate function determines when to terminate the connection and stop reading
const sseParser = testUntil => (res, fn) => {
  res.events = []
  res.on('data', b => {
    const s = b.toString()
    eq(s.substr(0, 5), 'data:')
    res.events.push(JSON.parse(s.substr(5)))
    if (testUntil(res.events)) res.req.socket.end()
  })
  res.req.socket.on('end', () => fn(null))
}
