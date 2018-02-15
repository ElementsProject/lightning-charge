import { join } from 'path'
import wrap from './lib/promise-wrap'

const apiToken = process.env.API_TOKEN || (console.error('Please configure your API access token via --api-token or API_TOKEN'), process.exit(1))
    , lnPath   = process.env.LN_PATH   || require('path').join(require('os').homedir(), '.lightning')

;(async () => {
  process.on('unhandledRejection', err => { throw err })

  const db = require('knex')(require('../knexfile'))
      , ln = require('lightning-client')(lnPath)

  await db.migrate.latest({ directory: join(__dirname, '../migrations') })

  const model = require('./model')(db, ln)
      , auth  = require('./lib/auth')('api-token', apiToken)
      , payListen = require('./lib/payment-listener')(lnPath, model)

  const app = require('express')()

  app.set('port', process.env.PORT || 9112)
  app.set('host', process.env.HOST || 'localhost')
  app.set('trust proxy', !!process.env.PROXIED)

  app.use(require('morgan')('dev'))
  app.use(require('body-parser').json())
  app.use(require('body-parser').urlencoded({ extended: true }))

  app.get('/info', auth, wrap(async (req, res) => res.send(await ln.getinfo())))

  require('./invoicing')(app, payListen, model, auth)
  require('./checkout')(app, payListen)

  require('./sse')(app, payListen, auth)
  require('./webhook')(app, payListen, model, auth)
  require('./websocket')(app, payListen)

  const server = app.listen(app.settings.port, app.settings.host, _ => {
    console.log(`HTTP server running on ${ app.settings.host }:${ app.settings.port }`)
    app.emit('listening', server)
  })
})()
