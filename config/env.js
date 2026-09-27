const dotenv = require('dotenv');
const path = require('path');
// Standard behavior: real environment variables take precedence over .env values.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Managed Postgres (Render/Railway/Heroku) requires SSL — enable it automatically in
// production for non-local hosts unless DB_SSL is set explicitly.
const connStr = process.env.DATABASE_URL || '';
const isLocalDb = /localhost|127\.0\.0\.1/.test(connStr);
const autoSsl = process.env.NODE_ENV === 'production' && connStr && !isLocalDb;

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
    ssl: process.env.DB_SSL !== undefined ? process.env.DB_SSL === 'true' : autoSsl,
    // Run schema.sql (and seed.sql if empty) automatically on boot. Set DB_AUTO_MIGRATE=false to disable.
    autoMigrate: process.env.DB_AUTO_MIGRATE !== 'false',
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
    geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  },
  log: { level: 'info', file: 'logs/ace-platform.log' },
  pdf: { tempDir: './tmp/pdfs', cleanupInterval: 3600000 },
  oauth: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri: process.env.GOOGLE_REDIRECT_URI },
    facebook: { clientId: process.env.FACEBOOK_APP_ID, clientSecret: process.env.FACEBOOK_APP_SECRET, redirectUri: process.env.FACEBOOK_REDIRECT_URI },
    x: { clientId: process.env.X_CLIENT_ID, clientSecret: process.env.X_CLIENT_SECRET, redirectUri: process.env.X_REDIRECT_URI },
    linkedin: { clientId: process.env.LINKEDIN_CLIENT_ID, clientSecret: process.env.LINKEDIN_CLIENT_SECRET, redirectUri: process.env.LINKEDIN_REDIRECT_URI },
    smsProviderApiKey: process.env.SMS_API_KEY
  },
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM
  },
  isDev() { return this.node_env === 'development'; },
  isProd() { return this.node_env === 'production'; }
};
