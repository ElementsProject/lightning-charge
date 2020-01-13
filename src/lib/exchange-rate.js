import big from 'big.js'
import request from 'superagent'
import memoize from './memoize'

require('superagent-proxy')(request)

const enc = encodeURIComponent

// if none is set, will fallback to using HTTPS_PROXY or ALL_PROXY.
// see https://github.com/Rob--W/proxy-from-env
const RATE_PROXY = process.env.RATE_PROXY

const FIXED_RATES    = { BTC: 1 }
    , BTC_MSAT_RATIO = big('100000000000')
    , BITSTAMP_CURR  = [ 'USD', 'EUR' ]
    , CACHE_TTL      = +process.env.RATE_CACHE_TTL || 30000

// Fetch USD/EUR rates from Bitstamp, use CoinGecko for other currencies
const getRate = memoize(CACHE_TTL, currency =>
  BITSTAMP_CURR.includes(currency.toUpperCase())
  ? getRateBitstamp(currency)
  : getRateCoingecko(currency)
)

const getRateBitstamp = currency =>
  request.get(`https://www.bitstamp.net/api/v2/ticker/btc${currency.toLowerCase()}`)
    .proxy(RATE_PROXY)
    .then(res => res.body.last || Promise.reject('Invalid response from Bitstamp'))

const getRateCoingecko = currency =>
  request.get(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=${enc(currency)}`)
    .proxy(RATE_PROXY)
    .then(res => res.body.bitcoin[currency.toLowerCase()] || Promise.reject(`Unknown currency: ${currency}`))
    .catch(err => Promise.reject(err))

// Convert `amount` units of `currency` to msatoshis
const toMsat = async (currency, amount) =>
  big(amount)
    .div(FIXED_RATES[currency] || await getRate(currency))
    .mul(BTC_MSAT_RATIO)
    .round(0, 3) // round up to nearest msatoshi
    .toFixed(0)

module.exports = { getRate, toMsat }
