const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const hpp = require('hpp');
const path = require('path');

const config = require('./config/env');
const logger = require('./utils/logger');
const db = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const { cleanupOldPdfs } = require('./services/pdfGenerator');

const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const analysisRoutes = require('./routes/analysis');
const quizRoutes = require('./routes/quiz');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');

const app = express();

app.use(helmet({ contentSecurityPolicy: config.isProd() ? undefined : false }));
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(hpp());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

if (config.isDev()) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
}

app.use('/api/', generalLimiter);
app.use(express.static(path.join(__dirname, 'public')));

// FastAPI (:8001) owns auth, companies, analysis, quiz (graded), powerbi, ml.
// Node keeps /api/ai/plan (LLM study plan) plus PDF reports and admin.
// /api/ai/quiz falls through to FastAPI, which strips the answer key,
// issues a set_id and grades submissions server-side.
app.use('/api/ai', (req, res, next) => {
  if (req.path.startsWith('/plan') || req.path.startsWith('/llm-quiz') || req.path.startsWith('/chat')) return aiRoutes(req, res, next);
  return next();
});
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', async (_req, res) => {
  const dbHealth = await db.healthCheck();
  res.status(dbHealth.status === 'healthy' ? 200 : 503).json({
    service: 'ACE Platform Backend',
    version: '2.0.0',
    status: dbHealth.status,
    database: dbHealth,
    timestamp: new Date().toISOString()
  });
});

// FastAPI (:8001) is the primary engine (TensorFlow scoring, auth, Power BI).
// The Node service keeps only its exclusive routes: AI LLM, PDF reports, admin.
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001';
app.use('/api', async (req, res, next) => {
  const nodeOwned = ['/api/ai/plan', '/api/ai/llm-quiz', '/api/ai/chat', '/api/reports', '/api/admin', '/api/health'];
  if (nodeOwned.some((p) => req.originalUrl === p || req.originalUrl.startsWith(p + '/') || req.originalUrl.startsWith(p + '?'))) return next();
  try {
    const url = FASTAPI_URL + req.originalUrl;
    const fetchOpts = { method: req.method, headers: { ...req.headers, host: new URL(FASTAPI_URL).host } };
    delete fetchOpts.headers['content-length'];
    if (!['GET', 'HEAD'].includes(req.method)) {
      // express.json() has already consumed the stream — re-serialize the parsed body
      fetchOpts.body = req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : await new Promise((resolve) => { const c = []; req.on('data', (ch) => c.push(ch)); req.on('end', () => resolve(Buffer.concat(c))); });
      fetchOpts.headers['content-type'] = fetchOpts.headers['content-type'] || 'application/json';
    }
    const upstream = await fetch(url, fetchOpts);
    res.status(upstream.status);
    upstream.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) res.setHeader(k, v); });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(502).json({ error: 'FastAPI gateway unavailable', detail: err.message });
  }
});

// React + TS + Tailwind SPA (built into public/app by `npm run build` in frontend/)
app.get('/app', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

setInterval(cleanupOldPdfs, config.pdf.cleanupInterval);

async function start() {
  try {
    await db.healthCheck();
    app.listen(config.port, config.host, () => {
      logger.info(`ACE Platform running on http://${config.host}:${config.port}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

start();
module.exports = app;
