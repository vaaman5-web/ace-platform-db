const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
  await db.query(sql);
  console.log('Database seeded with verified placement records');
  process.exit(0);
}
run();
