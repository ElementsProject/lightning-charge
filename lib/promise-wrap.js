module.exports = fn => (req, res, next, ...a) =>
  fn(req, res, next, ...a).catch(next)
