const TIERS = {
  'Tier 1A Product': {
    salary: '₹45 - ₹65 LPA',
    thresholds: [
      { min: 78, label: 'FAANG Level Competitive' },
      { min: 60, label: 'Strong Contender' },
      { min: 45, label: 'Borderline - Upskilling Needed' },
      { min: 0, label: 'Hard Upskilling Needed' },
    ],
    coreSkills: ['DSA Basics', 'OOP Concepts'],
    gaps: ['System Design', 'Advanced Dynamic Programming', 'Graph Theory'],
    coreLangs: ['Java', 'C++', 'Python'],
    decentLangs: ['C'],
    academicBands: [[9.5, 95], [9, 75], [8.5, 55], [8, 40], [7.5, 28], [7, 18], [6.5, 12], [6, 8]],
    trackBands: [[9, 95], [8.5, 75], [8, 50], [7.5, 30], [7, 18], [6.5, 10], [0, 8]],
  },
  'Tier 1B Product': {
    salary: '₹24 - ₹42 LPA',
    thresholds: [
      { min: 75, label: 'Elite Tier-1B Fit' },
      { min: 58, label: 'Tier-1B Strong Fit' },
      { min: 45, label: 'Borderline - Upskilling Needed' },
      { min: 0, label: 'Upskilling Needed' },
    ],
    coreSkills: ['DBMS', 'OOP', 'SQL'],
    gaps: ['Machine Coding', 'Low Level Design', 'REST APIs'],
    coreLangs: ['Java', 'Python'],
    decentLangs: ['C++', 'JavaScript'],
    academicBands: [[9, 92], [8.5, 80], [8, 70], [7.5, 58], [7, 45], [6.5, 33], [6, 22], [5.5, 12]],
    trackBands: [[8, 90], [7.5, 75], [7, 55], [6.5, 35], [6, 20], [0, 10]],
  },
  'Tier 1A Service': {
    salary: '₹6 - ₹9 LPA',
    thresholds: [
      { min: 70, label: 'High Probability Hire' },
      { min: 52, label: 'Competitive Fit' },
      { min: 40, label: 'Borderline - Upskilling Needed' },
      { min: 0, label: 'Upskilling Needed' },
    ],
    coreSkills: ['Basic DSA', 'SQL', 'Communication'],
    gaps: ['Cloud Certification', 'Git Workflows'],
    coreLangs: ['Java', 'Python', 'C++'],
    decentLangs: ['C', 'JavaScript'],
    academicBands: [[8.5, 90], [8, 80], [7.5, 70], [7, 60], [6.5, 48], [6, 35], [5.5, 22], [0, 10]],
    trackBands: [[7.5, 90], [7, 75], [6.5, 55], [6, 35], [0, 15]],
  },
  'Consulting': {
    salary: '₹8 - ₹12 LPA',
    thresholds: [
      { min: 72, label: 'Consulting Track Ideal' },
      { min: 55, label: 'Good Fit' },
      { min: 42, label: 'Borderline - Upskilling Needed' },
      { min: 0, label: 'Upskilling Needed' },
    ],
    coreSkills: ['SQL', 'Analytics Basics', 'Problem Solving'],
    gaps: ['Case Study Strategy', 'SAP/Cloud Basics'],
    coreLangs: ['Python', 'JavaScript'],
    decentLangs: ['Java', 'C++'],
    academicBands: [[8.5, 90], [8, 80], [7.5, 70], [7, 60], [6.5, 48], [6, 35], [5.5, 22], [0, 10]],
    trackBands: [[7.5, 90], [7, 75], [6.5, 55], [6, 35], [0, 15]],
  },
};

function bandLookup(value, bands) {
  for (const [threshold, pct] of bands) {
    if (value >= threshold) return pct;
  }
  return bands[bands.length - 1]?.[1] || 4;
}

function calculateScore({ cgpa, primaryLang, targetTrack, quizScore }) {
  const cfg = TIERS[targetTrack] || TIERS['Tier 1A Service'];
  const academicW = (bandLookup(cgpa, cfg.academicBands) / 100) * 45;
  const langPct = cfg.coreLangs.includes(primaryLang) ? 85 : cfg.decentLangs.includes(primaryLang) ? 65 : 35;
  const langW = (langPct / 100) * 30;
  const trackW = (bandLookup(cgpa, cfg.trackBands) / 100) * 25;

  let score = Math.round(academicW + langW + trackW);
  let quizFactor = null;
  if (quizScore !== undefined && quizScore !== null) {
    quizFactor = parseFloat((0.7 + (quizScore / 15) * 0.4).toFixed(2));
    score = Math.round(score * quizFactor);
  }

  score = Math.max(4, Math.min(100, score));

  let readinessTier = cfg.thresholds[cfg.thresholds.length - 1].label;
  for (const t of cfg.thresholds) {
    if (score >= t.min) {
      readinessTier = t.label;
      break;
    }
  }

  return {
    score,
    readinessTier,
    salaryBand: cfg.salary,
    verifiedSkills: [primaryLang, 'Aptitude', ...cfg.coreSkills],
    skillGaps: [...cfg.gaps],
    quizFactor,
  };
}

module.exports = { calculateScore };
