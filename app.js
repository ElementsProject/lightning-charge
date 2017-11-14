import LightningClient from 'lightning-client'

// strict handling for uncaught promise rejections
process.on('unhandledRejection', err => { throw err })

const app = require('express')()
    , db  = require('knex')({ client: 'sqlite3', connection: process.env.DB_PATH })
    , ln  = new LightningClient(process.env.LN_PATH)

app.set('port', process.env.PORT || 9112)
app.set('host', process.env.HOST || 'localhost')
app.set('trust proxy', !!process.env.PROXIED)

app.use(require('morgan')('dev'))
app.use(require('body-parser').json())
app.use(require('body-parser').urlencoded({ extended: true }))

app.use(require('./invoicing')({ db, ln }))

app.listen(app.settings.port, app.settings.host, _ =>
  console.log(`HTTP server running on ${ app.settings.host }:${ app.settings.port }`))
