import wrap from './lib/promise-wrap'

const debug = require('debug')('lightning-charge')

// maximum wait time for long-polling
const maxWait = +process.env.MAX_WAIT || 600

module.exports = (app, payListen, model, auth, lnconf) => {
  const { newInvoice, fetchInvoice, listInvoices, delInvoice, delExpired } = model

  app.on('listening', server => server.timeout = maxWait*1000 + 500)

  app.param('invoice', wrap(async (req, res, next, id) => {
    req.invoice = await fetchInvoice(req.params.invoice)
    if (!req.invoice) return res.sendStatus(404)
    next()
  }))

  app.get('/invoices', auth, wrap(async (req, res) =>
    res.send(await listInvoices())))

  app.get('/invoice/:invoice', auth, (req, res) =>
    res.send(req.invoice))

  app.post('/invoice', auth, wrap(async (req, res) =>
    res.status(201).send(await newInvoice(req.body))))

  app.get('/invoice/:invoice/wait', auth, wrap(async (req, res) => {
    if (req.invoice.status == 'paid')    return res.send(req.invoice)
    if (req.invoice.status == 'expired') return res.sendStatus(410)

    const expires_in = req.invoice.expires_at - (Date.now()/1000|0)
        , timeout    = Math.min(+req.query.timeout || 300, expires_in, maxWait)
        , paid       = await payListen.register(req.invoice.id, timeout*1000)

    if (paid) res.send(paid)
    else res.sendStatus(timeout == expires_in ? 410 : 402)
    // @TODO remove listener on client disconnect
  }))

  app.delete('/invoice/:invoice', auth, wrap(async (req, res) => {
    await delInvoice(req.params.invoice, req.body.status)
    res.sendStatus(204)
  }))

  // Enable automatic cleanup for expired invoices if enabled on c-lightning,
  // using the same configurations.

  // Disabled until the following issues are addressed:
  // https://github.com/ElementsProject/lightning/issues/2180
  // https://github.com/ElementsProject/lightning/issues/2181

  /*
  if (lnconf['autocleaninvoice-cycle'] && lnconf['autocleaninvoice-expired-by']) {
    const cycle = lnconf['autocleaninvoice-cycle'] * 1000
        , ttl   = lnconf['autocleaninvoice-expired-by']

    debug(`Running autoclean job every ${cycle/1000}s to delete invoices expired over ${ttl}s ago`)

    ;(async function expiryJob() {
      debug('Cleaning up expired invoices')
      await delExpired(ttl)
      setTimeout(expiryJob, cycle)
    })()
  }
  */
}
