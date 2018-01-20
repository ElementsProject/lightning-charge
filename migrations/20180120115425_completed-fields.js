
exports.up = db =>
  db.schema.table('invoice', t => {
    t.renameColumn('completed_at', 'paid_at')
    t.dropColumn('completed')
  })

exports.down = async db => {
  await db.schema.table('invoice', t => {
    t.renameColumn('paid_at', 'completed_at')
    t.bool('completed')
  })

  await db('invoice').whereNotNull('pay_index')
                     .update({ completed: true })
}
