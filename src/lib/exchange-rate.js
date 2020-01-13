import big from 'big.js'
import request from 'superagent'
import memoize from './memoize'

require('superagent-proxy')(request)

// if none is set, will fallback to using HTTPS_PROXY or ALL_PROXY.
// see https://github.com/Rob--W/proxy-from-env
const RATE_PROXY = process.env.RATE_PROXY

const FIXED_RATES    = { BTC: 1 }
    , BTC_MSAT_RATIO = big('100000000000')
    , CACHE_TTL      = +process.env.RATE_CACHE_TTL || 30000

const enc = encodeURIComponent

// Fetch current exchange rate from coinmarketcap
const getRate = memoize(CACHE_TTL, currency =>
  request.get(`https://api.coinmarketcap.com/v1/ticker/bitcoin/?convert=${enc(currency)}`)
    .proxy(RATE_PROXY)
    .then(res => res.body[0]['price_'+currency.toLowerCase()])
    .then(rate => rate || Promise.reject(`Unknown currency: ${currency}`))
)

// Convert `amount` units of `currency` to msatoshis
const toMsat = async (currency, amount) =>
  big(amount)
    .div(FIXED_RATES[currency] || await getRate(currency))
    .mul(BTC_MSAT_RATIO)
    .round(0, 3) // round up to nearest msatoshi
    .toFixed(0)

module.exports = { getRate, toMsat }
