const { ok, equal: eq } = require('assert')
const EventSource = require('eventsource')

describe('Server-Sent-Events', function() {
  let charge, lnBob
  before(() => {
    charge = require('supertest')(process.env.CHARGE_URL)
    lnBob  = require('clightning-client')(process.env.LN_BOB_PATH)
  })

  const mkInvoice = props =>
    charge.post('/invoice').send(props)
      .expect(201).then(r => r.body)

  describe('GET /payment-stream', function() {
    this.slow(1000)

    before(() =>
      setTimeout(async () => {
        lnBob.pay(await mkInvoice({ msatoshi: '87' }).then(inv => inv.payreq))
        lnBob.pay(await mkInvoice({ msatoshi: '78' }).then(inv => inv.payreq))
      }, 250)
    )

    it('streams all incoming payments', async () => {
      const evs  = new EventSource(process.env.CHARGE_URL + '/payment-stream')
          , msgs = []

      await new Promise(resolve =>
        evs.on('message', msg => (msgs.push(JSON.parse(msg.data)), msgs.length == 2 && resolve())))

      evs.close()

      eq(msgs.length, 2)
      ok(msgs[0].status == 'paid' && msgs[1].status == 'paid')
      eq(msgs[0].msatoshi, '87')
      eq(msgs[1].msatoshi, '78')
    })
  })

  after(() => {
    lnBob.client.removeAllListeners('end') // disable automatic reconnection
    lnBob.client.end()
  })
})
