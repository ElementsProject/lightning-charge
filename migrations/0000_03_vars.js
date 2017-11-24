exports.up = async db => {
  await db.schema.createTable('vars', t => {
    t.string('key').primary()
    t.string('value').nullable()
  })
  await db('vars').insert({ key: 'last-paid-invoice', value: null })
}

exports.down = db =>
  db.schema.dropTable('vars')
