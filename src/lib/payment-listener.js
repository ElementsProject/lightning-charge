import { EventEmitter } from 'events'
import { LightningClient } from 'clightning-client'

const debug = require('debug')('lightning-charge')

class PaymentListener extends EventEmitter {
  constructor(rpcPath, model) {
    super()
    this.ln = new LightningClient(rpcPath)
    this.model = model

    this.ln.client.on('connect', async _ =>
      this.pollNext(await model.getLastPaid()))
  }

  async pollNext(last_index) {
    const { label: id, pay_index, paid_at, msatoshi_received } = await this.ln.waitanyinvoice(last_index)

    if (await this.model.markPaid(id, pay_index, paid_at, msatoshi_received)) {
      const invoice = await this.model.fetchInvoice(id)
      debug('invoice %s paid: %o', invoice.id, invoice)
      this.emit('payment', invoice)
      this.emit('paid:'+id, invoice)
    } else {
      console.error('WARN: invoice %s from waitanyinvoice does not exists locally, or is already marked as paid', id)
    }

    this.pollNext(pay_index)
  }

  register(id, timeout) {
    debug('register(%s)', id)
    return new Promise((resolve, reject) => {

      const onPay = invoice => {
        clearTimeout(timer)
        this.removeListener(`paid:${ id }`, onPay)
        resolve(invoice)
      }
      this.on(`paid:${ id }`, onPay)

      const timer = setTimeout(_ => {
        debug('invoice %s listener timed out', id)
        this.removeListener(`paid:${ id }`, onPay)
        resolve(false)
      }, timeout)
    })
  }
}

// optional new
module.exports = (...a) => new PaymentListener(...a)
