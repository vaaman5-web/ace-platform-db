const db = require('../config/database');

async function findBestMatches(score, targetTrack, limit = 3) {
  const targetType = targetTrack.includes('Product') ? 'Product' : 'Service';
  const result = await db.query(
    `SELECT id, name, type, ctc_band, difficulty_pct, difficulty_cat, rounds_desc, key_skills
     FROM companies
     WHERE type = $1 AND is_active = TRUE
     ORDER BY ABS(difficulty_pct - $2) ASC, display_rank ASC
     LIMIT $3`,
    [targetType, score, limit]
  );
  return result.rows.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    ctc: c.ctc_band,
    difficulty: `${c.difficulty_pct}%`,
    rounds: c.rounds_desc
  }));
}

module.exports = { findBestMatches };
