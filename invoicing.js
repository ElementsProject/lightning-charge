import wrap from './lib/promise-wrap'

const debug = require('debug')('lightning-strike')

module.exports = app => {
  const { payListen, model: { newInvoice, fetchInvoice, listInvoices } } = app

  app.param('invoice', wrap(async (req, res, next, id) => {
    req.invoice = await fetchInvoice(req.params.invoice)
    if (!req.invoice) return res.sendStatus(404)
    req.invoice_expired = !req.invoice.completed && req.invoice.expires_at && req.invoice.expires_at < Date.now()/1000
    next()
  }))

  app.get('/invoices', wrap(async (req, res) =>
    res.send(await listInvoices())))

  app.get('/invoice/:invoice', (req, res) =>
    res.send(req.invoice))

  app.post('/invoice', wrap(async (req, res) => {
    const invoice = await newInvoice(req.body)
    res.status(201).send(invoice)
  }))

  app.get('/invoice/:invoice/wait', wrap(async (req, res) => {
    if (req.invoice.completed) return res.send(req.invoice)
    if (req.invoice_expired)   return res.sendStatus(410)

    const timeout = Math.min(+req.query.timeout || 300, 1800)*1000
        , paid    = await payListen.register(req.params.invoice, timeout)

    if (paid) res.send(paid)
    else res.sendStatus(402)
    // @TODO properly handle client disconnect
  }))

  app.get('/payment-stream', (req, res, next) => {
    res.set({
      'Content-Type':  'text/event-stream'
    , 'Cache-Control': 'no-cache'
    , 'Connection':    'keep-alive'
    }).flushHeaders()

    const onPay = invoice => res.write(`data:${ JSON.stringify(invoice) }\n\n`)
    payListen.on('payment', onPay)
    req.on('close', _ => payListen.removeListener('payment', onPay))
  })
}
