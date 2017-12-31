import path    from 'path'
import express from 'express'
import qrcode  from 'qrcode'
import moveDec from 'move-decimal-point'
import wrap    from './lib/promise-wrap'

module.exports = app => {
  const { payListen } = app

  app.set('url', process.env.URL || '/')
  app.set('static_url', process.env.STATIC_URL || app.settings.url + 'static/')
  app.set('view engine', 'pug')
  app.set('views', path.join(__dirname, 'views'))

  app.locals.formatMsat = msat => moveDec(msat, -8) + ' mBTC'

  app.use('/static', (r => (
    r.get('/checkout.js', require('browserify-middleware')('./client/checkout.js'))
  , r.use(require('stylus').middleware({ src: './styl', serve: true }))
  , r.use('/styl', express.static('./styl'))
  , r.use('/', express.static('./static'))
  , r
  ))(express.Router()))

  app.get('/checkout/:invoice', wrap(async (req, res) => {
    const opt = req.invoice.metadata && req.invoice.metadata.checkout || {}

    if (req.invoice.completed && opt.redirect_url)
      return res.redirect(opt.redirect_url)

    res.render('checkout', { ...req.invoice, expired: req.invoice_expired, qr: await makeQR(req.invoice) })
  }))

  // like /invoice/:invoice/wait, but user-accessible, doesn't reveal the full invoice fields,
  // and with a fixed timeout.
  app.get('/checkout/:invoice/wait', wrap(async (req, res) => {
    if (req.invoice_expired) return res.sendStatus(410)
    const completed = (req.invoice.completed || await payListen.register(req.invoice.id, 60000))
    res.sendStatus(completed ? 204 : 402)
  }))

}

const makeQR = ({ payreq }) => qrcode.toDataURL(`lightning:${payreq}`, { margin: 1 })
