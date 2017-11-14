import { Router } from 'express'
import PaymentListener from '../lib/payment-listener'

const debug = require('debug')('lightning-strike')

const wrap = fn => (req, res, next, ...a) => fn(req, res, next, ...a).catch(next)

module.exports = ({ db, ln }) => {

  const model     = require('./model')({ db, ln })
      , payListen = new PaymentListener(ln.rpcPath, model)
      , { listInvoices, fetchInvoice, newInvoice, addHook } = model

  require('./webhook')({ model, payListen })

  const r = Router()

  r.param('invoice', wrap(async (req, res, next, id) => {
    req.invoice = await fetchInvoice(req.params.invoice)
    req.invoice ? next() : res.sendStatus(404)
  }))

  r.get('/invoices', wrap(async (req, res) =>
    res.send(await listInvoices())))

  r.get('/invoice/:invoice', wrap(async (req, res) => {
    const invoice = await fetchInvoice(req.params.invoice)
    if (invoice) res.send(invoice)
    else res.sendStatus(404)
  }))

  r.post('/invoice', wrap(async (req, res) => {
    const invoice = await newInvoice(req.body)
    res.status(201).send(invoice)
  }))

  r.post('/invoice/:invoice/webhook', wrap(async (req, res) => {
    if (req.invoice.completed) return res.sendStatus(405)
    await addHook(req.params.invoice, req.body.url)
    res.sendStatus(201)
  }))

  r.get('/invoice/:invoice/wait', wrap(async (req, res) => {
    if (req.invoice.completed) return res.send(req.invoice)

    const timeout = Math.min(+req.query.timeout || 300, 1800)*1000
        , paid    = await payListen.register(req.params.invoice, timeout)

    if (paid) res.send(paid)
    else res.sendStatus(402)
    // @TODO properly handle client disconnect
  }))

  r.get('/payment-stream', (req, res, next) => {
    res.set({
      'Content-Type':  'text/event-stream'
    , 'Cache-Control': 'no-cache'
    , 'Connection':    'keep-alive'
    }).flushHeaders()

    const onPay = invoice => res.write(`data:${ JSON.stringify(invoice) }\n\n`)
    payListen.on('payment', onPay)
    req.on('close', _ => payListen.removeListener('payment', onPay))
  })

  return r
}
