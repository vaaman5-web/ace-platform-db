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

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/quiz', quizRoutes);
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
