import nanoid from 'nanoid'
import { toMsat } from './lib/exchange-rate'

const debug  = require('debug')('lightning-charge')
    , status = inv => inv.pay_index ? 'paid' : inv.expires_at > now() ? 'unpaid' : 'expired'
    , format = inv => ({ ...inv, completed: !!inv.pay_index, completed_at: inv.paid_at
                       , status: status(inv), msatoshi: (inv.msatoshi || null), metadata: JSON.parse(inv.metadata) })
    , now    = _ => Date.now() / 1000 | 0

// @XXX the `completed` and `completed_at` field are deprecated
// in favor `status` and `paid_at`, and will eventually be removed
// from the public API.

// @XXX invoices that accept any amount are stored as msatoshi='' (empty string)
// and converted to null when formatted. this is due to sqlite's lack of support
// for ALTER TABLE, which makes dropping the NOT NULL constraint complicated
// (requires creating a new table, copying over the data and replacing the old one).
// This will eventually be done in a future release.

const defaultDesc = process.env.INVOICE_DESC_DEFAULT || 'Lightning Charge Invoice'

module.exports = (db, ln) => {
  const newInvoice = async props => {
    const { currency, amount, expiry, description, metadata, webhook } = props

    const id       = nanoid()
        , msatoshi = props.msatoshi ? ''+props.msatoshi : currency ? await toMsat(currency, amount) : ''
        , lninv    = await ln.invoice(msatoshi || 'any', id, description || defaultDesc, expiry)

    const invoice = {
            id, description, msatoshi
          , quoted_currency: currency, quoted_amount: amount
          , rhash: lninv.payment_hash, payreq: lninv.bolt11
          , expires_at: lninv.expires_at, created_at: now()
          , metadata: JSON.stringify(metadata || null)
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

  const markPaid = (id, pay_index, paid_at, msatoshi_received) =>
    db('invoice').where({ id, pay_index: null })
                 .update({ pay_index, paid_at, msatoshi_received })

  const getLastPaid = _ =>
    db('invoice').max('pay_index as index')
                 .first().then(r => r.index)

  const delExpired = _ =>
    db('invoice').select('id')
      // fetch unpaid invoices expired over a day ago
      .where({ pay_index: null })
      .where('expires_at', '<', now() - 86400)
      // delete from c-lightning
      .then(invs => Promise.all(invs.map(inv =>
        ln.delinvoice(inv.id, 'expired')
          .then(deleted => deleted.label)
          .catch(_ => null))))
      .then(ids => ids.filter(id => id != null))
      // delete locally
      .then(ids => ids.length && db('invoice').whereIn('id', ids).delete())

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

