import { toMsat } from '../src/lib/exchange-rate'

const { ok, equal: eq } = require('assert')

describe('Lnurlpay API', function() {
  let charge, lnBob
  before(() => {
    charge = require('supertest')(process.env.CHARGE_URL)
    lnBob  = require('clightning-client')(process.env.LN_BOB_PATH)
  })

  const mkLnurlPay = (other = {}) =>
    charge.post('/lnurlpay')
      .send({
        id: 'test'
      , min: 100000
      , max: 200000
      , metadata: {a: 1}
      , text: 'test lnurlpay'
      , other_metadata: [['nothing', 'nothing']]
      , success_text: 'thank you'
      , success_url: 'https://charge.example.com/success'
      , comment_length: 100
      , ...other
      })

  describe('basic lnurlpay endpoint management', () => {
    it('can create an lnurlpay endpoint', () =>
      mkLnurlPay()
        .expect(201)
        .expect('Content-Type', /json/)
        .expect(({ body }) => {
          ok(body.id && body.comment_length && body.text)
          eq(body.min, '100000')
          eq(body.max, '200000')
        })
    )

    it('can fetch endpoint', async () => {
      await mkLnurlPay({ webhook: 'https://x.example.com/wh' })
      charge.get('/lnurlpay/test')
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(({ body }) => {
          eq(body.webhook, 'https://x.example.com/wh')
          eq(body.metadata, {a: 1})
        })
    })

    it('can list endpoints', async () => {
      await mkLnurlPay({ id: 'test1', amount: 30000 })
      await mkLnurlPay({ id: 'test2', text: 'abc' })
      await mkLnurlPay({ id: 'test2', text: 'xyz' })
      charge.get('/lnurlpays')
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(({ body }) => {
          eq(body.length, 2)
          eq(body.find(({ id }) => id === 'test1').min, '30000')
          eq(body.find(({ id }) => id === 'test1').max, '30000')
          eq(body.find(({ id }) => id === 'test2').text, 'xyz')
        })
    })

    it('can update endpoints', async () => {
      await mkLnurlPay({ id: 'test1' })
      await mkLnurlPay({ id: 'test2', text: 'abc', metadata: {a: 3} })
      await charge.put('/lnurlpay/test2', { text: 'xyz' })
      charge.get('/lnurlpays')
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(({ body }) => {
          eq(body.length, 2)
          eq(body.find(({ id }) => id === 'test2').text, 'xyz')
          eq(body.find(({ id }) => id === 'test2').metadata, {a: 3})
        })
    })

    it('can delete endpoints', async () => {
      await mkLnurlPay({ id: 'test1' })
      await mkLnurlPay({ id: 'test2' })
      await charge.del('/lnurlpay/test1')
        .expect(204)
      charge.get('/lnurlpays')
        .expect(200)
        .expect(({ body }) => {
          eq(body.length, 0)
        })
    })
  })

  describe('invoice generation through the lnurl-pay protocol', () => {
    it('can return lnurlpay params', async () => {
      await mkLnurlPay({ id: 'one', min: 100000, max: 200000, comment_length: 100 })
      await mkLnurlPay({ id: 'other', amount: 123123, comment_length: undefined })
      await charge.get('/lnurl/one')
        .expect(({ body }) => {
          eq(body.tag, 'payRequest')
          eq(body.metadata, `[["text/plain", "test lnurlpay"]]`)
          eq(body.maxSendable, 200000)
          eq(body.minSendable, 100000)
          eq(body.commentAllowed, 100)
          eq(body.callback, 'https://charge.example.com/lnurl/one/cb')
        })
      await charge.get('/lnurl/other')
        .expect(({ body }) => {
          eq(body.tag, 'payRequest')
          eq(body.metadata, `[["text/plain", "test lnurlpay"]]`)
          eq(body.maxSendable, 123123)
          eq(body.minSendable, 123123)
          eq(body.commentAllowed, 0)
          eq(body.callback, 'https://charge.example.com/lnurl/other/cb')
        })
    })

    it('can return invoice', async () => {
      await mkLnurlPay()
      charge.get('/lnurl/test/cb?amount=112233')
        .expect(({ body }) => {
          console.log(body)
          ok(body.pr && body.routes)
          eq(body.pr.slice(0, 12), 'lnbcrt112233')
          eq(body.pr.successAction, { tag: 'url', description: 'thank you', url: 'https://charge.example.com/success' })
        })
    })

    it('uses the "currency" parameter correctly', async () => {
      await mkLnurlPay({ currency: 'USD', min: 1, max: 2 })
      charge.get(`/lnurl/test/cb?amount=${toMsat('USD', 1.5)}`)
        .expect(({ body }) => {
          console.log(body)
          ok(body.pr && body.routes)
          eq(body.pr.slice(0, 12), 'lnbcrt112233')
          eq(body.pr.successAction, { tag: 'url', description: 'thank you', url: 'https://charge.example.com/success' })
        })
    })
  })

  describe('invoice from lnurlpay endpoints management', () => {
    it('can list invoices', async () => {
      await mkLnurlPay()
      await charge.get('/lnurl/test/cb?amount=150000')
      await charge.get('/lnurl/test/cb?amount=200000')
      charge.get('/lnurlpay/test/invoices')
        .expect(200)
        .expect(({ body }) => {
          eq(body.length, 2)
          ok(body.find(({ amount }) => amount === 150000))
          ok(body.find(({ amount }) => amount === 200000))
        })
    })

    it('can include arbitrary metadata on an invoice', async () => {
      await mkLnurlPay()
      await charge.get('/lnurl/test?v=1')
        .expect(({ body }) => {
          eq(body.callback, 'https://charge.example.com/lnurl/test?v=1')
        })
      await charge.get('/lnurl/test/cb?amount=100000&v=1')
      await charge.get('/lnurl/test/cb?amount=200000&v=2')
      charge.get('/lnurlpay/test/invoices')
        .expect(200)
        .expect(({ body }) => {
          eq(body.length, 2)
          eq(body.find(({ amount }) => amount === 150000).metadata, {v: 1, a: 1})
          eq(body.find(({ amount }) => amount === 200000).metadata, {v: 2, a: 1})
        })
    })
  })
})
