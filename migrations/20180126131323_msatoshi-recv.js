exports.up = db =>
  db.schema.table('invoice', t =>
    t.string('msatoshi_received').nullable())

exports.down = db =>
  db.schema.table('invoice', t =>
    t.dropColumn('msatoshi_received'))
