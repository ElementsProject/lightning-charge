import request from 'superagent'
import wrap from './lib/promise-wrap'

const debug = require('debug')('lightning-charge')

module.exports = (app, payListen, model, auth) => {
  const { addHook, getHooks, logHook } = model

  app.post('/invoice/:invoice/webhook', auth, wrap(async (req, res) => {
    if (req.invoice.completed) return res.sendStatus(405)
    if (req.invoice_expired)   return res.sendStatus(410)
    await addHook(req.params.invoice, req.body.url)
    res.sendStatus(201)
  }))

  async function execHooks(invoice) {
    debug('execHooks(%s)', invoice.id)
    const hooks = await getHooks(invoice.id)
    debug('execHooks(%s): %j', invoice.id, hooks.map(h => h.url))

    return Promise.all(hooks.map(hook =>
      request.post(hook.url)
        .type('json').send(invoice)
        .then(res  => res.ok ? res : Promise.reject(new Error('invalid status code '+res.status)))
        .then(res  => logHook(hook.id, null, res))
        .catch(err => logHook(hook.id, err))
    ))
  }

  payListen.on('payment', invoice =>
    execHooks(invoice)
      .then(results => debug('%s webhook results: %j', invoice.id, results)))

}
