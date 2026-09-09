const rateLimit = require('express-rate-limit');
module.exports = {
  generalLimiter: rateLimit({ windowMs: 900000, max: 100 }),
  authLimiter: rateLimit({ windowMs: 900000, max: 20 }),
  analysisLimiter: rateLimit({ windowMs: 60000, max: 30 })
};
