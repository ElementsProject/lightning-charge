import big from 'big.js'
import request from 'superagent'

const FIXED_RATES    = { BTC: 1 }
    , BTC_MSAT_RATIO = big('100000000000')

// Fetch current exchange rate from BitcoinAverage
// @TODO cache results?
const getRate = currency =>
  request.get(`https://apiv2.bitcoinaverage.com/indices/global/ticker/short?crypto=BTC&fiat=${currency}`)
    .then(res => res.body['BTC'+currency].last)
    .catch(err => Promise.reject(err.status == 404 ? new Error('Unknown currency: '+currency) : err))

// Convert `amount` units of `currency` to msatoshis
const toMsat = async (currency, amount) =>
  big(amount)
    .div(FIXED_RATES[currency] || await getRate(currency))
    .mul(BTC_MSAT_RATIO)
    .toFixed(0)

module.exports = { getRate, toMsat }
