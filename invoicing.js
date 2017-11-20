import wrap from './lib/promise-wrap'

const debug = require('debug')('lightning-strike')

module.exports = app => {
  const { payListen, model: { newInvoice, fetchInvoice, listInvoices } } = app

  app.param('invoice', wrap(async (req, res, next, id) => {
    req.invoice = await fetchInvoice(req.params.invoice)
    req.invoice ? next() : res.sendStatus(404)
  }))

  app.get('/invoices', wrap(async (req, res) =>
    res.send(await listInvoices())))

  app.get('/invoice/:invoice', wrap(async (req, res) => {
    const invoice = await fetchInvoice(req.params.invoice)
    if (invoice) res.send(invoice)
    else res.sendStatus(404)
  }))

  app.post('/invoice', wrap(async (req, res) => {
    const invoice = await newInvoice(req.body)
    res.status(201).send(invoice)
  }))


  app.get('/invoice/:invoice/wait', wrap(async (req, res) => {
    if (req.invoice.completed) return res.send(req.invoice)

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
