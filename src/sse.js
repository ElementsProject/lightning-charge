module.exports = (app, payListen, auth) =>
  app.get('/payment-stream', auth, (req, res) => {
    res.set({
      'X-Accel-Buffering': 'no'
    , 'Cache-Control': 'no-cache'
    , 'Content-Type': 'text/event-stream'
    , 'Connection': 'keep-alive'
    }).flushHeaders()

    const onPay = inv => res.write(`id:${ inv.pay_index }\ndata:${ JSON.stringify(inv) }\n\n`)
    payListen.on('payment', onPay)

    const keepAlive = setInterval(_ => res.write(': keepalive\n\n'), 25000)

    req.on('close', _ => (payListen.removeListener('payment', onPay)
                        , clearInterval(keepAlive)))
  })
