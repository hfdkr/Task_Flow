// Outgoing email over SMTP (Gmail by default — see .env.example).
//
// Routes call these through the module object (mailer.sendPasswordResetEmail)
// rather than destructuring, so tests can swap in a fake sender.

const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter;

function isConfigured() {
    return Boolean(env.SMTP_USER && env.SMTP_PASS);
}

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_PORT === 465,
            auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });
    }
    return transporter;
}

function resetEmailHtml(name, link, minutes) {
    // `name` is stored HTML-escaped already (see utils/sanitize.js) and
    // `link` is our own URL with a hex token, so both are safe to embed.
    return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
  <h2 style="margin:0 0 16px">Reset your TaskFlow password</h2>
  <p>Hi ${name},</p>
  <p>We received a request to reset the password for your TaskFlow account. Click the button below to choose a new one.</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${link}" style="background:#6c8fff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:bold;display:inline-block">Set a new password</a>
  </p>
  <p style="font-size:13px;color:#6b7280">This link expires in ${minutes} minutes and can only be used once.</p>
  <p style="font-size:13px;color:#6b7280">If you didn't ask for this, you can ignore this email — your password won't change.</p>
  <p style="font-size:12px;color:#9ca3af;word-break:break-all">If the button doesn't work, paste this link into your browser:<br>${link}</p>
</div>`;
}

// Reverses utils/sanitize.js for the plain-text part of an email.
function unescapeHtml(str) {
    return String(str)
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
}

async function sendPasswordResetEmail({ to, name, link, expiresInMinutes }) {
    if (!isConfigured()) {
        // Never print live reset links into hosted logs.
        if (env.IS_PRODUCTION || process.env.VERCEL) throw new Error('SMTP is not configured (SMTP_USER / SMTP_PASS missing)');
        // Local dev without SMTP: print the link so the flow can still be tested.
        console.warn(`[TaskFlow] SMTP not configured — password reset link for ${to}:\n  ${link}`);
        return;
    }
    await getTransporter().sendMail({
        from: env.MAIL_FROM || `TaskFlow <${env.SMTP_USER}>`,
        to,
        subject: 'Reset your TaskFlow password',
        text: `Hi ${unescapeHtml(name)},\n\nOpen this link to choose a new TaskFlow password:\n${link}\n\n` +
              `It expires in ${expiresInMinutes} minutes and can only be used once.\n` +
              `If you didn't ask for this, ignore this email — your password won't change.`,
        html: resetEmailHtml(name, link, expiresInMinutes),
    });
}

module.exports = { isConfigured, sendPasswordResetEmail };
