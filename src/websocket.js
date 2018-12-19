import WebSocket from 'ws'
import basicAuth from 'basic-auth'

module.exports = (app, payListen, apiToken) => {
  const verifyClient = info => {
    const cred = basicAuth(info.req)
    return cred && cred.name === 'api-token' && cred.pass === apiToken
  }

  app.on('listening', server => {
    const wss = new WebSocket.Server({ server, path: '/ws', verifyClient })

    payListen.on('payment', inv => {
      const msg = JSON.stringify(inv)

      wss.clients.forEach(client =>
        (client.readyState === WebSocket.OPEN) && client.send(msg))
    })
  })
}
