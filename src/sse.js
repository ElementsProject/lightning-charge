module.exports = (app, payListen, auth) =>
  app.get('/payment-stream', auth, (req, res, next) => {
    res.set({
      'Content-Type':  'text/event-stream'
    , 'Cache-Control': 'no-cache'
    , 'Connection':    'keep-alive'
    }).flushHeaders()

    const onPay = inv => res.write(`id:${ inv.pay_index }\ndata:${ JSON.stringify(inv) }\n\n`)
    payListen.on('payment', onPay)
    req.on('close', _ => payListen.removeListener('payment', onPay))
  })
