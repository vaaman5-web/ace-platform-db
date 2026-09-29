const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const config = require('../config/env');

async function run() {
  if (!config.db.autoMigrate) {
    console.log('[auto-migrate] Disabled (DB_AUTO_MIGRATE=false) — skipping.');
    return;
  }

  // 1. Schema (idempotent CREATE TABLE IF NOT EXISTS)
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(schema);
  console.log('[auto-migrate] Schema ensured.');

  // 2. Seed only when the table is empty, so restarts never duplicate rows
  const res = await db.query('SELECT COUNT(*)::int AS n FROM companies');
  if (res.rows[0].n > 0) {
    console.log(`[auto-migrate] Companies table has ${res.rows[0].n} rows — skipping seed.`);
    return;
  }
  const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  await db.query(seed);
  console.log('[auto-migrate] Companies table seeded.');
}

module.exports = { run };
