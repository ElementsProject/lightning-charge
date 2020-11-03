import bech32 from 'bech32'
import wrap from './lib/promise-wrap'

const debug = require('debug')('lightning-charge')

module.exports = (app, payListen, model, auth) => {
  const {
    newInvoice, listInvoicesByLnurlPayEndpoint
  , getLnurlPayEndpoint, listLnurlPayEndpoints
  , setLnurlPayEndpoint, delLnurlPayEndpoint
  } = model

  app.get('/endpoints', auth, wrap(async (req, res) =>
    res.status(200).send(
      (await listLnurlPayEndpoints())
        .map(lnurlpay => addBech23Lnurl(req, lnurlpay))
    )))

  app.post('/endpoint', auth, wrap(async (req, res) =>
    res.status(201).send(
      addBech23Lnurl(req, await setLnurlPayEndpoint(null, req.body))
    )))

  app.put('/endpoint/:id', auth, wrap(async (req, res) =>
    res.status(200).send(
      addBech23Lnurl(req, await setLnurlPayEndpoint(req.params.id, req.body))
    )))

  app.delete('/endpoint/:id', auth, wrap(async (req, res) =>
    res.status(200).send(await delLnurlPayEndpoint(req.params.id))))

  app.get('/endpoint/:id', auth, wrap(async (req, res) =>
    res.status(200).send(
      addBech23Lnurl(req, await getLnurlPayEndpoint(req.params.id))
    )))

  app.get('/endpoint/:id/invoices', auth, wrap(async (req, res) =>
    res.send(await listInvoicesByLnurlPayEndpoint(req.params.id))))

  // this is the actual endpoint users will hit
  app.get('/lnurl/:id', wrap(async (req, res) => {
    const lnurlpay = await getLnurlPayEndpoint(req.params.id)

    res.status(200).send({
      tag: 'payRequest'
    , minSendable: lnurlpay.min
    , maxSendable: lnurlpay.max
    , metadata: makeMetadata(lnurlpay)
    , commentAllowed: lnurlpay.comment
    , callback: `https://${req.hostname}/lnurl/${lnurlpay.id}/callback`
    })
  }))

  app.get('/lnurl/:id/callback', wrap(async (req, res) => {
    const lnurlpay = await getLnurlPayEndpoint(req.params.id)

    if (req.query.amount > lnurlpay.max)
      return res.send({status: 'ERROR', reason: 'amount too large'})
    if (req.query.amount < lnurlpay.min)
      return res.send({status: 'ERROR', reason: 'amount too small'})

    let invoiceMetadata = {...req.query}
    delete invoiceMetadata.amount
    delete invoiceMetadata.fromnodes
    delete invoiceMetadata.nonce
    invoiceMetadata = {...lnurlpay.metadata, ...invoiceMetadata}

    const invoice = await newInvoice({
      descriptionHash: require('crypto')
        .createHash('sha256')
        .update(makeMetadata(lnurlpay))
        .digest('hex')
    , msatoshi: req.query.amount
    , metadata: invoiceMetadata
    , webhook: lnurlpay.webhook
    , lnurlpay_endpoint: lnurlpay.id
    })

    let successAction
    if (lnurlpay.success_url) {
      successAction = {
        tag: 'url'
      , url: lnurlpay.success_url
      , description: lnurlpay.success_text || ''
      }
    } else if (lnurlpay.success_value) {
      // not implemented yet
    } else if (lnurlpay.success_text) {
      successAction = {tag: 'message', message: lnurlpay.success_text}
    }

    res.status(200).send({
      pr: invoice.payreq
    , successAction
    , routes: []
    , disposable: false
    })
  }))
}

function makeMetadata (lnurlpay) {
  const text = lnurlpay.text

  const meta = [['text/plain', text]]
    .concat(lnurlpay.image ? ['image/png;base64', lnurlpay.image] : [])

  return JSON.stringify(meta)
}

function addBech23Lnurl (req, lnurlpay) {
  const hostname = req.hostname || req.params.hostname
  const url = `https://${hostname}/lnurl/${lnurlpay.id}`
  const words = bech32.toWords(Buffer.from(url))
  lnurlpay.bech32 = bech32.encode('lnurl', words, 2500).toUpperCase()
  return lnurlpay
}
