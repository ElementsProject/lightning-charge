import wrap from './lib/promise-wrap'

module.exports = (app, payListen, model, auth) => {
  const { newInvoice, fetchInvoice, listInvoices, delExpired } = model

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
        , timeout    = Math.min(+req.query.timeout || 300, expires_in, 1800)
        , paid       = await payListen.register(req.invoice.id, timeout*1000)

    if (paid) res.send(paid)
    else res.sendStatus(timeout == expires_in ? 410 : 402)
    // @TODO remove listener on client disconnect
  }))

  ;(async function expiryJob() {
    await delExpired()
    setTimeout(expiryJob, 14400000) // 4 hours
  })()
}
