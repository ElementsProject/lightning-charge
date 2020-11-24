import bech32 from 'bech32'
import wrap from './lib/promise-wrap'
import { toMsat } from './lib/exchange-rate'

const debug = require('debug')('lightning-charge')

module.exports = (app, payListen, model, auth, ln) => async {
  // check if method invoicewithdescriptionhash exists
  let help = await ln.help()
  let foundCommand
  for (let i = 0; i < help.help.length; i++) {
    let command = help.help[i].command
    if (command.slice(0, 26) !== 'invoicewithdescriptionhash') continue
    foundCommand = true
    break
  }
  if (!foundCommand) return

  // define routes
  const {
    newInvoice, listInvoicesByLnurlPayEndpoint
  , getLnurlPayEndpoint, listLnurlPayEndpoints
  , setLnurlPayEndpoint, delLnurlPayEndpoint
  } = model

  app.get('/lnurlpays', auth, wrap(async (req, res) =>
    res.status(200).send(
      (await listLnurlPayEndpoints())
        .map(lnurlpay => addBech32Lnurl(req, lnurlpay))
    )))

  app.post('/lnurlpay', auth, wrap(async (req, res) =>
    res.status(201).send(
      addBech32Lnurl(req, await setLnurlPayEndpoint(null, req.body))
    )))

  app.put('/lnurlpay/:id', auth, wrap(async (req, res) => {
    const endpoint = await getLnurlPayEndpoint(req.params.id)
    const updated = {...endpoint, ...req.body}
    res.status(200).send(
      addBech32Lnurl(req, await setLnurlPayEndpoint(req.params.id, updated))
    )
  }))

  app.delete('/lnurlpay/:id', auth, wrap(async (req, res) => {
    const deletedRows = await delLnurlPayEndpoint(req.params.id)
    if (deletedRows) res.status(204)
    else res.status(404)
  }))

  app.get('/lnurlpay/:id', auth, wrap(async (req, res) => {
    const endpoint = await getLnurlPayEndpoint(req.params.id)
    if (endpoint) res.status(200).send(addBech32Lnurl(req, endpoint))
    else res.status(404)
  }))

  app.get('/lnurlpay/:id/invoices', auth, wrap(async (req, res) =>
    res.send(await listInvoicesByLnurlPayEndpoint(req.params.id))))

  // this is the actual endpoint users will hit
  app.get('/lnurl/:id', wrap(async (req, res) => {
    const endpoint = await getLnurlPayEndpoint(req.params.id)

    if (!endpoint) {
      res.status(404)
      return
    }

    const current = endpoint.currency
    const min = currency ? await toMsat(currency, endpoint.min) : endpoint.min
    const max = currency ? await toMsat(currency, endpoint.max) : endpoint.max

    res.status(200).send({
      tag: 'payRequest'
    , minSendable: min
    , maxSendable: max
    , metadata: makeMetadata(endpoint)
    , commentAllowed: endpoint.comment_length
    , callback: `https://${req.hostname}/lnurl/${lnurlpay.id}/callback`
    })
  }))

  app.get('/lnurl/:id/callback', wrap(async (req, res) => {
    const endpoint = await getLnurlPayEndpoint(req.params.id)
    const amount = +req.query.amount

    if (!amount)
      return res.send({status: 'ERROR', reason: `invalid amount '${req.query.amount}'`})

    const current = endpoint.currency
    let min = currency ? await toMsat(currency, endpoint.min) : endpoint.min
    let max = currency ? await toMsat(currency, endpoint.max) : endpoint.max
    // account for currency variation
    min = min * 0.99
    max = max * 1.01

    if (amount > max)
      return res.send({status: 'ERROR', reason: `amount must be smaller than ${Math.floor(max / 1000)} sat`})
    if (amount < min)
      return res.send({status: 'ERROR', reason: `amount must be greater than ${Math.ceil(min / 1000)} sat`})

    let invoiceMetadata = {...req.query}
    delete invoiceMetadata.amount
    delete invoiceMetadata.fromnodes
    delete invoiceMetadata.nonce
    invoiceMetadata = {...endpoint.metadata, ...invoiceMetadata}

    // enforce comment length
    invoiceMetadata.comment =
      (comment.comment && req.query.comment)
      ? (''+req.query.comment).substr(0, endpoint.comment)
      : undefined

    const invoice = await newInvoice({
      description_hash: require('crypto')
        .createHash('sha256')
        .update(makeMetadata(lnurlpay))
        .digest('hex')
    , msatoshi: req.query.amount
    , metadata: invoiceMetadata
    , webhook: endpoint.webhook
    , lnurlpay_endpoint: endpoint.id
    , currency: endpoint.currency
    })

    let successAction
    if (endpoint.success_url) {
      successAction = {
        tag: 'url'
      , url: endpoint.success_url
      , description: endpoint.success_text || ''
      }
    } else if (lnurlpay.success_text) {
      successAction = {tag: 'message', message: endpoint.success_text}
    }

    res.status(200).send({
      pr: invoice.payreq
    , successAction
    , routes: []
    , disposable: false
    })
  }))
}

function makeMetadata (endpoint) {
  return JSON.stringify(
    [['text/plain', endpoint.text]]
      .concat(endpoint.image ? ['image/png;base64', endpoint.image] : [])
      .concat(JSON.parse(endpoint.other_metadata || []))
  )
}

function addBech32Lnurl (req, lnurlpay) {
  let base = process.env.URL || `https://${req.hostname}`
  base = base[base.length - 1] === '/' ? base.slice(0, -1) : base
  const url = `${base}/lnurl/${lnurlpay.id}`
  const words = bech32.toWords(Buffer.from(url))
  lnurlpay.bech32 = bech32.encode('lnurl', words, 2500).toUpperCase()
  return lnurlpay
}
