const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
router.get('/dashboard', authenticate, authorize('admin'), (req, res) => res.json({ status: 'admin operational' }));
module.exports = router;
