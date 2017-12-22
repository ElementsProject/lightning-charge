import basicAuth from 'basic-auth'

module.exports = (name, pass, realm='Lightning Kite') => (req, res, next) => {
  const cred = basicAuth(req)

  if (!cred || cred.name !== name || cred.pass !== pass)
    res.set('WWW-Authenticate', `Basic realm="${realm}"`)
       .sendStatus(401)

  else next()
}
