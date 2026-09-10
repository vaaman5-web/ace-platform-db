const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

module.exports = {
  node_env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '0.0.0.0',
  db: {
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'ace_platform',
    user: process.env.DB_USER || 'ace_user',
    password: process.env.DB_PASSWORD || 'ace_password',
    ssl: process.env.DB_SSL === 'true',
    poolMin: 2,
    poolMax: 20
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'super_secret_jwt_key_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_key_2026',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  rateLimit: {
    windowMs: 900000,
    max: 100,
    authMax: 20
  },
  cors: { origin: process.env.CORS_ORIGIN || '*' },
  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'
  },
  log: { level: 'info', file: 'logs/ace-platform.log' },
  pdf: { tempDir: './tmp/pdfs', cleanupInterval: 3600000 },
  isDev() { return this.node_env === 'development'; },
  isProd() { return this.node_env === 'production'; }
};
