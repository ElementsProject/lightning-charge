const { ok, equal: eq } = require('assert')
const WebSocket = require('ws')

describe('WebSocket API', function() {
  let charge, lnBob
  before(() => {
    charge = require('supertest')(process.env.CHARGE_URL)
    lnBob  = require('clightning-client')(process.env.LN_BOB_PATH)
  })

  const mkInvoice = props =>
    charge.post('/invoice').send(props)
      .expect(201).then(r => r.body)

  describe('GET /ws', function() {
    this.slow(1000)

    before(() =>
      setTimeout(async () => {
        lnBob.pay(await mkInvoice({ msatoshi: '89' }).then(inv => inv.payreq))
        lnBob.pay(await mkInvoice({ msatoshi: '98' }).then(inv => inv.payreq))
      }, 250)
    )

    it('streams all incoming payments', async () => {
      const ws   = new WebSocket(process.env.CHARGE_URL + '/ws')
          , msgs = []

      await new Promise(resolve =>
        ws.on('message', msg => (msgs.push(JSON.parse(msg)), msgs.length == 2 && resolve())))

      ws.close()

      eq(msgs.length, 2)
      ok(msgs[0].status == 'paid' && msgs[1].status == 'paid')
      eq(msgs[0].msatoshi, '89')
      eq(msgs[1].msatoshi, '98')
    })
  })

  after(() => {
    lnBob.client.removeAllListeners('end') // disable automatic reconnection
    lnBob.client.end()
  })
})
