import nanoid from 'nanoid'
import { toMsat } from './lib/exchange-rate'

const debug  = require('debug')('lightning-charge')
    , status = inv => inv.completed ? 'paid' : inv.expires_at > now() ? 'unpaid' : 'expired'
    , format = inv => ({ ...inv, completed: !!inv.completed, status: status(inv), metadata: JSON.parse(inv.metadata) })
    , now    = _ => Date.now() / 1000 | 0

// @XXX `completed` is deprecated as a public field and will eventually be hidden
// from external APIs (but will remain in use internally) in favor of the `status` field.

const defaultDesc = process.env.INVOICE_DESC_DEFAULT || 'Lightning Charge Invoice'

module.exports = (db, ln) => {
  const newInvoice = async props => {
    const { currency, amount, expiry, description, metadata, webhook } = props

    const id       = nanoid()
        , msatoshi = props.msatoshi ? ''+props.msatoshi : await toMsat(currency, amount)
        , lninv    = await ln.invoice(msatoshi, id, description || defaultDesc, expiry)

    const invoice = {
            id, description, msatoshi
          , quoted_currency: currency, quoted_amount: amount
          , rhash: lninv.rhash, payreq: lninv.bolt11
          , expires_at: lninv.expiry_time, created_at: now()
          , metadata: JSON.stringify(metadata || null)
          , completed: false
          }

    debug('saving invoice:', invoice)
    await db('invoice').insert(invoice)

    if (webhook) await addHook(id, webhook)

    return format(invoice)
  }

  const listInvoices = _ =>
    db('invoice').then(rows => rows.map(format))

  const fetchInvoice = id =>
      db('invoice').where({ id }).first().then(r => r && format(r))

  const delInvoice = async id => {
    await ln.delinvoice(id)
    await db('invoice').where({ id }).delete()
  }

  const markPaid = (id, pay_index) =>
    db('invoice').where({ id, completed: false })
                 .update({ completed: true, completed_at: now(), pay_index })

  const getLastPaid = _ =>
    db('invoice').where({ completed: true })
                 .max('pay_index as index')
                 .first().then(r => r.index)

  const delExpired = _ =>
    db('invoice').select('id')
      // fetch unpaid invoices expired over a day ago
      .where({ completed: false })
      .where('expires_at', '<', now() - 86400)
      // make sure they're really unpaid
      .then(invs => Promise.all(invs.map(i => ln.listinvoice(i.id))))
      .then(invs => invs.filter(i => i[0] && !i[0].complete).map(i => i[0].label))
      // finally, delete them
      .then(invs => Promise.all(invs.map(delInvoice)))

  const addHook = (invoice_id, url) =>
    db('invoice_webhook').insert({ invoice_id, url, created_at: now() })

  const getHooks = invoice_id =>
    db('invoice_webhook').where({ invoice_id })

  const logHook = (id, err, res) =>
    db('invoice_webhook').where({ id }).update(
      !err ? { requested_at: now(), success: true,  resp_code: res.status }
           : { requested_at: now(), success: false, resp_error: err })

  return { newInvoice, listInvoices, fetchInvoice
         , getLastPaid, markPaid, delExpired
         , addHook, getHooks, logHook }
}

