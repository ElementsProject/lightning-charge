import knex from 'knex'
import express from 'express'
import Lightning from 'lightning-client'
import PaymentListener from './lib/payment-listener'

const db = knex(require('./knexfile'))
    , ln = new Lightning(process.env.LN_PATH || require('path').join(process.env.HOME, '.lightning'))

const model = require('./model')(db, ln)
    , payListen = new PaymentListener(ln.rpcPath, model)

const app = express()

app.set('port', process.env.PORT || 9112)
app.set('host', process.env.HOST || 'localhost')
app.set('trust proxy', !!process.env.PROXIED)

app.use(require('morgan')('dev'))
app.use(require('body-parser').json())
app.use(require('body-parser').urlencoded({ extended: true }))

require('./invoicing')(app, payListen, model)
require('./webhook')(app, payListen, model)
require('./checkout')(app, payListen)

app.listen(app.settings.port, app.settings.host, _ =>
  console.log(`HTTP server running on ${ app.settings.host }:${ app.settings.port }`))

process.on('unhandledRejection', err => { throw err })
