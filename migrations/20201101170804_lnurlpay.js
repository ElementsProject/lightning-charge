exports.up = async db => {
  await db.schema.createTable('lnurlpay_endpoint', t => {
    t.string('id').primary()
    t.string('metadata').notNullable().defaultTo('{}')
    t.integer('min').notNullable()
    t.integer('max').notNullable()
    t.string('currency').nullable()
    t.string('text').notNullable()
    t.string('image').nullable()
    t.string('other_metadata').nullable()
    t.string('success_text').nullable()
    t.string('success_url').nullable()
    t.integer('comment_length').notNullable().defaultTo(0)
    t.string('webhook').nullable()
  })
  await db.schema.table('invoice', t => {
    t.string('lnurlpay_endpoint').nullable()
  })
}

exports.down = async db => {
  await db.schema.dropTable('lnurlpay_endpoint')
  await db.schema.table('invoice', t => {
    t.dropColumn('lnurlpay_endpoint')
  })
}
