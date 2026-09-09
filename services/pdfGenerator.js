const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const { v4: uuidv4 } = require('uuid');

if (!fs.existsSync(config.pdf.tempDir)) {
  fs.mkdirSync(config.pdf.tempDir, { recursive: true });
}

function generateReport(analysis) {
  return new Promise((resolve, reject) => {
    const filename = `ACE_Report_${uuidv4()}.pdf`;
    const filepath = path.join(config.pdf.tempDir, filename);
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    doc.rect(0, 0, doc.page.width, 70).fill('#1E3A5F');
    doc.fontSize(22).fillColor('#FFFFFF').font('Helvetica-Bold').text('ACE', 50, 18);
    doc.fontSize(9).text('Placement Readiness Evaluation', 50, 45);

    doc.fontSize(16).fillColor('#22303F').text(analysis.candidate_name, 50, 90);
    doc.fontSize(10).fillColor('#5B6B76').text(`Match Score: ${analysis.match_score}% | Track: ${analysis.target_track}`, 50, 115);
    doc.fontSize(10).text(`Readiness: ${analysis.readiness_tier} | CTC Band: ${analysis.salary_band}`, 50, 135);

    doc.end();
    stream.on('finish', () => resolve({ filepath, filename }));
    stream.on('error', reject);
  });
}

function cleanupOldPdfs() {
  const dir = config.pdf.tempDir;
  if (!fs.existsSync(dir)) return;
  const now = Date.now();
  fs.readdirSync(dir).forEach(file => {
    const fp = path.join(dir, file);
    if (now - fs.statSync(fp).mtimeMs > 3600000) fs.unlinkSync(fp);
  });
}

module.exports = { generateReport, cleanupOldPdfs };
