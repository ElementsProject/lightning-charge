
exports.up = db =>
  db.schema.createTable('invoice_webhook', t => {
    t.increments('id').primary()
    t.string    ('invoice_id').references('invoice.id').notNullable()
    t.string    ('url').notNullable()
    t.timestamp ('created_at').notNullable()
    t.bigInteger('requested_at').nullable()
    t.boolean   ('success').nullable()
    t.integer   ('resp_code').nullable()
    t.string    ('resp_error').nullable()
  })

exports.down = db =>
  db.schema.dropTable('invoice_webhook')
