import request from 'superagent'

const debug = require('debug')('lightning-strike')

module.exports = ({ model, payListen }) => {
  const { getHooks, logHook } = model

  async function execHooks(invoice_id) {
    debug('execHooks(%s)', invoice_id)
    const hooks = await getHooks(invoice_id)
    debug('execHooks(%s): %j', invoice_id, hooks.map(h => h.url))

    return Promise.all(hooks.map(hook =>
      request.post(hook.url)
        .then(res  => res.ok ? res : Promise.reject(new Error('invalid status code '+res.status)))
        .then(res  => logHook(hook.id, null, res))
        .catch(err => logHook(hook.id, err))
    ))
  }

  payListen.on('payment', invoice =>
    execHooks(invoice.id)
      .then(results => debug('%s webhook results: %j', invoice.id, results)))

}
