import request from 'superagent'

const debug = require('debug')('lightning-strike')

module.exports = ({ model, payListen }) => {
  const { getHooks, logHook } = model

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
