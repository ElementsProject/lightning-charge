// Memoize the results of `fn` for up to `ms` milliseconds.
// Currently only supports functions of a single argument.

const memoize = (ms, fn, cache=new Map) => arg => {
  const cached = cache.has(arg) && cache.get(arg)
  if (cached && cached[0] > Date.now()) {
    return cached[1]
  } else {
    const val = fn(arg)
    cache.set(arg, [ Date.now()+ms, val ])
    val.catch(_ => cache.delete(arg))
    return val
  }
}

module.exports = memoize
