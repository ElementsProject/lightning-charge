
exports.up = db =>
  db.schema.createTable('invoice', t => {
    t.string    ('id').primary()
    t.bigInteger('msatoshi').notNullable()
    t.string    ('rhash').notNullable()
    t.string    ('payreq').notNullable()
    t.bool      ('completed').notNullable()
    t.string    ('metadata').nullable()
    t.timestamp ('created_at').notNullable()
    t.timestamp ('completed_at').nullable()
  })

exports.down = db =>
  db.schema.dropTable('invoice')
