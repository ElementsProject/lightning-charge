import fs      from 'fs'
import path    from 'path'
import express from 'express'
import qrcode  from 'qrcode'
import fmtbtc  from 'fmtbtc'
import wrap    from './lib/promise-wrap'

const rpath = name => path.join(__dirname, name)

module.exports = (app, payListen) => {
  app.set('url', process.env.URL || '/')
  app.set('static_url', process.env.STATIC_URL || app.settings.url + 'static/')
  app.set('view engine', 'pug')
  app.set('views', rpath('../views'))

  app.locals.fmtbtc = fmtbtc

  fs.existsSync(rpath('www')) // comes pre-built in dist/www
    ? app.use('/static', express.static(rpath('www')))

    : app.use('/static', require('stylus').middleware({ src: rpath('../www'), serve: true }))
         .use('/static', express.static(rpath('../www')))

  app.get('/checkout/:invoice', wrap(async (req, res) => {
    const opt = req.invoice.metadata && req.invoice.metadata.checkout || {}

    if (req.invoice.status == 'paid' && opt.redirect_url)
      return res.redirect(opt.redirect_url)

    if (req.invoice.status == 'unpaid')
      res.locals.qr = await qrcode.toDataURL(`lightning:${req.invoice.payreq}`.toUpperCase(), { margin: 1 })

    res.render('checkout', req.invoice)
  }))

  // like /invoice/:invoice/wait, but user-accessible, doesn't reveal the full invoice fields,
  // and with a fixed timeout.
  app.get('/checkout/:invoice/wait', wrap(async (req, res) => {
    if (req.invoice.status == 'paid')    return res.sendStatus(204)
    if (req.invoice.status == 'expired') return res.sendStatus(410)

    const paid    = await payListen.register(req.invoice.id, 60000)
        , expired = !paid && req.invoice.expires_at <= Date.now()/1000

    res.sendStatus(paid ? 204 : expired ? 410 : 402)
  }))

  app.get('/checkout/:invoice/qr.png', wrap(async (req, res) => {
    qrcode.toFileStream(res.type('png'), `lightning:${req.invoice.payreq}`.toUpperCase())
  }))
}
