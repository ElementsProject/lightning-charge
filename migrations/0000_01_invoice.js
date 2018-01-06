
exports.up = db =>
  db.schema.createTable('invoice', t => {
    t.string ('id').primary()
    t.string ('msatoshi').notNullable()
    t.string ('quoted_currency').nullable()
    t.string ('quoted_amount').nullable()
    t.string ('rhash').notNullable().unique()
    t.string ('payreq').notNullable()
    t.bool   ('completed').notNullable()
    t.integer('pay_index').nullable()
    t.string ('description').nullable()
    t.string ('metadata').nullable()
    t.integer('created_at').notNullable()
    t.integer('expires_at').notNullable()
    t.integer('completed_at').nullable()
  })

exports.down = db =>
  db.schema.dropTable('invoice')
