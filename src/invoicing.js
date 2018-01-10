import wrap from './lib/promise-wrap'

process.env.API_TOKEN || (console.error('API access token is required, please configure.'), process.exit(1))

module.exports = (app, payListen, model, auth) => {
  const { newInvoice, fetchInvoice, listInvoices, delExpired } = model

  app.param('invoice', wrap(async (req, res, next, id) => {
    req.invoice = await fetchInvoice(req.params.invoice)
    if (!req.invoice) return res.sendStatus(404)
    req.invoice_expired = !req.invoice.completed && req.invoice.expires_at < Date.now()/1000
    next()
  }))

  app.get('/invoices', auth, wrap(async (req, res) =>
    res.send(await listInvoices())))

  app.get('/invoice/:invoice', auth, (req, res) =>
    res.send(req.invoice))

  app.post('/invoice', auth, wrap(async (req, res) =>
    res.status(201).send(await newInvoice(req.body))))

  app.get('/invoice/:invoice/wait', auth, wrap(async (req, res) => {
    if (req.invoice.completed) return res.send(req.invoice)
    if (req.invoice_expired)   return res.sendStatus(410)

    const expires_in = req.invoice.expires_at - (Date.now()/1000|0)
        , timeout    = Math.min(+req.query.timeout || 300, expires_in, 1800)
        , paid       = await payListen.register(req.params.invoice, timeout*1000)

    if (paid) res.send(paid)
    else res.sendStatus(timeout == expires_in ? 410 : 402)
    // @TODO remove listener on client disconnect
  }))

  app.get('/payment-stream', auth, (req, res, next) => {
    res.set({
      'Content-Type':  'text/event-stream'
    , 'Cache-Control': 'no-cache'
    , 'Connection':    'keep-alive'
    }).flushHeaders()

    const onPay = invoice => res.write(`data:${ JSON.stringify(invoice) }\n\n`)
    payListen.on('payment', onPay)
    req.on('close', _ => payListen.removeListener('payment', onPay))
  })

  ;(async function expiryJob() {
    await delExpired()
    setTimeout(expiryJob, 14400000) // 4 hours
  })()
}
