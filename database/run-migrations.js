const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(sql);
  console.log('Database schema successfully migrated');
  process.exit(0);
}
run();
