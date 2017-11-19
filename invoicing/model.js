import nanoid from 'nanoid'

const debug = require('debug')('lightning-strike')

module.exports = ({ db, ln }) => {
  const peerid = ln.getinfo().then(info => info.id)

  const newInvoice = async ({ msatoshi, metadata, webhook }) => {
    const id = nanoid()
        , { rhash, bolt11: payreq } = await ln.invoice(msatoshi, id, 'ln-strike')
        , invoice = {
            id, metadata, msatoshi: ''+msatoshi
          , rhash, payreq, peerid: await peerid
          , completed: false
          , created_at: Date.now()
          }

    debug('saving invoice:', invoice)
    await db('invoice').insert({ ...invoice, metadata: JSON.stringify(invoice.metadata || null) })

    if (webhook) await addHook(id, webhook)

    return invoice
  }

  const listInvoices = _ =>
    db('invoice').then(rows => rows.map(formatInvoice))

  const fetchInvoice = id =>
      db('invoice').where({ id }).first().then(r => r && formatInvoice(r))

  const markPaid = id =>
    db('invoice').where({ id, completed: false }).update({ completed: true, completed_at: Date.now() })

  const getLastPaid = _ =>
    db('invoice')
      .where({ completed: true })
      .orderBy('completed_at', 'desc')
      .first('id')
      .then(r => r && r.id)

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

const formatInvoice = invoice => ({ ...invoice, completed: !!invoice.completed, metadata: JSON.parse(invoice.metadata) })
