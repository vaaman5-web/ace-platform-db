/**
 * Migration: multi-method authentication (Google, Facebook, X, LinkedIn, Mobile/Phone, Email).
 * Idempotent — safe to run on existing databases.
 * Run: node database/run-auth-migration.js
 */
const db = require('../config/database');

async function run() {
  console.log('Applying auth migration...');
  await db.query(`
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'email';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_partial
      ON users (email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
      ON users (phone) WHERE phone IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_provider_id_unique
      ON users (auth_provider, provider_id) WHERE provider_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_full_name_unique
      ON users (full_name) WHERE auth_provider <> 'email';
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS phone_verifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      phone VARCHAR(20) NOT NULL,
      code_hash VARCHAR(255) NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone);
  `);
  console.log('Auth migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
