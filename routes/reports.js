const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { generateReport } = require('../services/pdfGenerator');
const db = require('../config/database');
const fs = require('fs');

router.get('/:id/pdf', authenticate, async (req, res, next) => {
  try {
    const r = await db.query('SELECT * FROM analyses WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Report not found' });
    const { filepath, filename } = await generateReport(r.rows[0]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(filepath).pipe(res);
  } catch(e) { next(e); }
});

module.exports = router;
