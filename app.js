import LightningClient from 'lightning-client'
import PaymentListener from './lib/payment-listener'

const app = require('express')()
    , db  = require('knex')(require('./knexfile'))
    , ln  = new LightningClient(process.env.LN_PATH || require('path').join(process.env.HOME, '/.lightning'))

app.model     = require('./model')({ db, ln })
app.payListen = new PaymentListener(ln.rpcPath, app.model)

app.set('port', process.env.PORT || 9112)
app.set('host', process.env.HOST || 'localhost')
app.set('trust proxy', !!process.env.PROXIED)

app.use(require('morgan')('dev'))
app.use(require('body-parser').json())
app.use(require('body-parser').urlencoded({ extended: true }))

require('./invoicing')(app)
require('./webhook')(app)
require('./checkout')(app)

app.listen(app.settings.port, app.settings.host, _ =>
  console.log(`HTTP server running on ${ app.settings.host }:${ app.settings.port }`))

// strict handling for uncaught promise rejections
process.on('unhandledRejection', err => { throw err })
