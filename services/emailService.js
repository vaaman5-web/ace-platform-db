const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Email delivery for verification codes.
 * - Development (no SMTP/email keys): logs the code and returns it so flows can be tested.
 * - Production: uses SMTP via env config (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM).
 *   Falls back to console logging if SMTP is not configured.
 */

function buildCodeEmailHtml(code, providerLabel) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;border:2px solid #000;padding:32px;">
    <div style="border-left:6px solid #FF3000;padding-left:16px;margin-bottom:24px;">
      <h1 style="margin:0;font-size:22px;font-weight:900;letter-spacing:-0.5px;">ACE</h1>
      <p style="margin:4px 0 0;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Adaptive &amp; Continuous Education Skills</p>
    </div>
    <h2 style="font-size:17px;font-weight:800;margin:0 0 8px;">Verify your ${providerLabel} sign-in</h2>
    <p style="font-size:14px;color:#333;margin:0 0 20px;">Enter this 6-digit code to continue. It expires in 10 minutes.</p>
    <div style="background:#F7F7F7;border:1.5px solid #000;padding:18px;text-align:center;margin-bottom:20px;">
      <span style="font-size:34px;font-weight:900;letter-spacing:12px;color:#000;">${code}</span>
    </div>
    <p style="font-size:12px;color:#777;margin:0;">If you didn't request this, you can safely ignore this email.</p>
    <p style="font-size:11px;color:#aaa;margin:16px 0 0;">© 2026 Team ACE · Adaptive &amp; Continuous Education</p>
  </div>`;
}

async function sendVerificationCode(email, code, providerLabel) {
  const html = buildCodeEmailHtml(code, providerLabel || 'email');

  // Real SMTP transport (configure SMTP_* env vars in production)
  if (config.email && config.email.smtpHost && config.email.smtpUser) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: config.email.smtpHost,
        port: config.email.smtpPort || 587,
        secure: (config.email.smtpPort || 587) === 465,
        auth: { user: config.email.smtpUser, pass: config.email.smtpPass }
      });
      await transporter.sendMail({
        from: config.email.from || 'ACE <no-reply@aceskills.app>',
        to: email,
        subject: `Your ACE verification code: ${code}`,
        html
      });
      logger.info('Verification code email sent via SMTP', { to: email });
      return { delivered: true, devCode: null };
    } catch (err) {
      logger.error('SMTP send failed, falling back to console', { error: err.message, to: email });
    }
  }

  // Dev fallback: log it; the API returns it so the flow can be completed without a mail server
  logger.info(`[DEV] Verification code for ${email}: ${code}`);
  console.log('\n========================================');
  console.log(`  EMAIL to: ${email}`);
  console.log(`  ACE verification code: ${code}`);
  console.log('========================================\n');
  return { delivered: false, devCode: code };
}

module.exports = { sendVerificationCode, buildCodeEmailHtml };
