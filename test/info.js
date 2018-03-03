const { ok } = require('assert')

describe('GET /info', function() {
  let charge
  before(() => charge = require('supertest')(process.env.CHARGE_URL))

  it('returns information about the c-lightning node', () =>
    charge.get(`/info`)
      .expect(200)
      .expect(({ body: b }) => ok(b.id && b.version && b.network && b.blockheight))
  )
})
