module.exports = {
  client:     'sqlite3'
, connection: process.env.DB_PATH || 'sqlite.db'
, useNullAsDefault: true
}
