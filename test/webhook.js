const { ok, equal: eq } = require('assert')

describe('Webhooks', function() {
  let charge, lnBob, cbServer, cbURL, cbRecv=[]
  before(() => {
    charge = require('supertest')(process.env.CHARGE_URL)
    lnBob  = require('clightning-client')(process.env.LN_BOB_PATH)

    // Setup mock web server to listen for webhook callback requests
    const cbApp = require('express')()
    cbApp.use(require('body-parser').json())
    cbApp.post('/payment/callback', (req, res) => {
      cbRecv.push(req.body)
      res.sendStatus(204)
    })

    cbServer = require('http').createServer(cbApp).listen(0) // bind to any open port
    cbURL = `http://localhost:${ cbServer.address().port }/payment/callback`
  })

  const mkInvoice = props =>
    charge.post('/invoice').send(props)
      .expect(201).then(r => r.body)

  describe('POST /invoice/:id/webhook', function() {
    this.slow(500)

    let inv1, inv2
    before(async () => {
      inv1 = await mkInvoice({ msatoshi: '50' })
      inv2 = await mkInvoice({ msatoshi: '60', expiry: 1 /* second */ })
    })

    it('attaches webhook URLs to invoices', () =>
      charge.post(`/invoice/${ inv1.id }/webhook`)
        .send({ url: cbURL })
        .expect(201)
    )

    it('notifies the webhook once the invoice is paid', async () => {
      await lnBob.pay(inv1.payreq)
      await new Promise(resolve => setTimeout(resolve, 150))

      eq(cbRecv.length, 1)
      const recv = cbRecv[0]
      ok(recv.status == 'paid' && recv.paid_at)
      eq(recv.id, inv1.id)
    })

    it('prevents attaching new webhooks to paid invoices', () =>
      charge.post(`/invoice/${ inv1.id }/webhook`)
        .send({ url: cbURL })
        .expect(405)
    )

    it('prevents attaching new webhooks to expired invoices', async () => {
      const timeLeft = inv2.expires_at*1000 - Date.now()
      if (timeLeft > 0) await new Promise(resolve => setTimeout(resolve, timeLeft))
      await charge.post(`/invoice/${ inv2.id }/webhook`).send({ url: cbURL })
        .expect(410)
    })
  })

  describe('POST /invoice with "webhook" parameter', function() {
    this.slow(500)

    it('allows attaching a webhook URL during invoice creation', async () => {
      const inv = await mkInvoice({ msatoshi: 50, webhook: cbURL })

      await lnBob.pay(inv.payreq)
      await new Promise(resolve => setTimeout(resolve, 150))

      eq(cbRecv.length, 2)
      const recv = cbRecv[1]
      ok(recv.status == 'paid' && recv.paid_at)
      eq(recv.id, inv.id)
    })

  })

  after(() => {
    lnBob.client.removeAllListeners('end') // disable automatic reconnection
    lnBob.client.end()
    cbServer.close()
  })
})
