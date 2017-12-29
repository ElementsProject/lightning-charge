import nanoid from 'nanoid'
import { toMsat } from './lib/exchange-rate'

const debug  = require('debug')('lightning-charge')
    , format = invoice => ({ ...invoice, completed: !!invoice.completed, metadata: JSON.parse(invoice.metadata) })
    , now    = _ => Date.now() / 1000 | 0

const defaultDesc = process.env.INVOICE_DESC_DEFAULT || 'Lightning Charge invoice'

module.exports = ({ db, ln }) => {
  const peerid = ln.getinfo().then(info => info.id)

  const newInvoice = async props => {
    // @TODO validation
    const { currency, amount, expiry, metadata, webhook } = props

        , id          = nanoid()
        , msatoshi    = props.msatoshi ? ''+props.msatoshi : await toMsat(currency, amount)
        , description = props.description || defaultDesc

        , { rhash, bolt11, expiry_time } = await ln.invoice(msatoshi, id, description, expiry)

        , invoice = {
            id, description, metadata, msatoshi
          , quoted_currency: currency, quoted_amount: amount
          , rhash, payreq: bolt11, peerid: (await peerid)
          , expires_at: expiry_time, created_at: now()
          , completed: false
          }

    debug('saving invoice:', invoice)
    await db('invoice').insert({ ...invoice, metadata: JSON.stringify(invoice.metadata || null) })

    if (webhook) await addHook(id, webhook)

    return invoice
  }

  const listInvoices = _ =>
    db('invoice').then(rows => rows.map(format))

  const fetchInvoice = id =>
      db('invoice').where({ id }).first().then(r => r && format(r))

  const markPaid = id => Promise.all([
    db('vars').where({ key: 'last-paid-invoice' }).update({ value: id })
  , db('invoice').where({ id, completed: false }).update({ completed: true, completed_at: now() })
  ]).then(rets => rets[1])


  const getLastPaid = _ =>
    db('vars').where({ key: 'last-paid-invoice' })
      .first().then(r => r && r.value)

  const addHook = (invoice_id, url) =>
    db('invoice_webhook').insert({ invoice_id, url, created_at: Date.now() })

  const getHooks = invoice_id =>
    db('invoice_webhook').where({ invoice_id })

  const logHook = (id, err, res) =>
    db('invoice_webhook').where({ id }).update(
      !err ? { requested_at: Date.now(), success: true,  resp_code: res.status }
           : { requested_at: Date.now(), success: false, resp_error: err }
    )

  return { newInvoice, listInvoices, fetchInvoice
         , getLastPaid, markPaid
         , addHook, getHooks, logHook }
}

