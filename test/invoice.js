const { ok, equal: eq } = require('assert')

describe('Invoice API', function() {
  let charge, lnBob
  before(() => {
    charge = require('supertest')(process.env.CHARGE_URL)
    lnBob  = require('clightning-client')(process.env.LN_BOB_PATH)
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
          eq(body.status, 'unpaid')
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

    ;[ 'USD' /* from bitstamp */, 'ILS' /* from coingecko */ ].forEach(currency =>
      it('accepts amounts denominated in fiat currencies - ' + currency, () =>
        charge.post('/invoice')
          .send({ currency, amount: '0.05' })
          .expect(201)
          .expect(({ body }) => {
            eq(body.quoted_currency, currency)
            eq(body.quoted_amount, '0.05')
            ok(/^\d+$/.test(body.msatoshi))
          })
      )
    )

    it('can override the expiry time', () =>
      charge.post('/invoice')
        .send({ msatoshi: '20', expiry: 5 /*seconds*/ })
        .expect(201)
        .expect(r => ok(r.body.expires_at*1000 - Date.now() < 5000))
    )

    it('can create invoices that accept any amount', () => {
      charge.post('/invoice')
        .expect(201)
        .expect(r => ok(r.body.msatoshi == null))
    })

    it('rounds amounts up to the nearest msatoshi', () =>
      charge.post('/invoice')
        .send({ currency: 'BTC', amount: '0.0000000000000001' })
        .expect(201)
        .expect(r => eq(r.body.msatoshi, 1))
    )

    it('casts description to string', () =>
      charge.post('/invoice')
        .send({ description: 1234 })
        .expect(201)
        .expect(r => ok(r.body.description === '1234'))
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
          eq(body.status, 'unpaid')
        })
    )

    describe('msatoshi_received', () => {
      let inv
      before(async () => {
        inv = await mkInvoice()
        await lnBob.pay(inv.payreq, 432)
      })
      it('contains the actual amount paid', () =>
        charge.get(`/invoice/${ inv.id }`)
          .expect(200)
          .expect(r => eq(r.body.msatoshi_received, '432'))
      )
    })
  })

  describe('DELETE /invoice/:invoice', () => {
    it('deletes an invoice by its id and status', async () => {
      const inv = await mkInvoice()
      charge.del(`/invoice/${ inv.id }`)
        .send({ status: 'unpaid' })
        .expect(204)
    })

    it("won't delete the invoice if the status mismatches", async () => {
      const inv = await mkInvoice()

      await charge.del(`/invoice/${ inv.id }`)
        .send({ status: 'paid' })
        .expect(400)

      await lnBob.pay(inv.payreq, 1000)

      await charge.del(`/invoice/${ inv.id }`)
        .send({ status: 'paid' })
        .expect(204)
    })
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
        .expect(r => ok(r.body.status == 'paid' && r.body.paid_at))
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

  after(() => {
    lnBob.client.removeAllListeners('end') // disable automatic reconnection
    lnBob.client.end()
  })
})
