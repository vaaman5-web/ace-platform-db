const { Pool } = require('pg');
const config = require('./env');
const logger = require('../utils/logger');

const pool = new Pool(
  config.db.connectionString
    ? { connectionString: config.db.connectionString, ssl: config.db.ssl ? { rejectUnauthorized: false } : false }
    : { host: config.db.host, port: config.db.port, database: config.db.name, user: config.db.user, password: config.db.password }
);

pool.on('error', (err) => logger.error('Postgres unexpected error', { error: err.message }));

async function query(text, params = []) {
  const start = Date.now();
  const res = await pool.query(text, params);
  logger.debug('Query executed', { text: text.substring(0, 60), duration: `${Date.now() - start}ms` });
  return res;
}

async function healthCheck() {
  try {
    const res = await pool.query('SELECT NOW()');
    return { status: 'healthy', serverTime: res.rows[0].now };
  } catch (err) {
    return { status: 'unhealthy', error: err.message };
  }
}

module.exports = { pool, query, healthCheck };
