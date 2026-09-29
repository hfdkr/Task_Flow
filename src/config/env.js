const crypto = require('crypto');

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

function resolveSessionSecret() {
    if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
    if (IS_PRODUCTION) {
        throw new Error(
            '[TaskFlow] SESSION_SECRET is not set. Refusing to start in production without one.\n' +
            'Generate one with: openssl rand -hex 32'
        );
    }
    console.warn('[TaskFlow] ⚠ SESSION_SECRET not set — using a random secret for this dev session only (sessions will not survive a restart).');
    return crypto.randomBytes(32).toString('hex');
}

const PORT = parseInt(process.env.PORT || '3000', 10);

// Public base URL used to build links in emails. Never derived from the
// request's Host header — an attacker could forge it and have reset links
// point at their own server ("password reset poisoning").
function resolveAppUrl() {
    const url = process.env.APP_URL
        || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
        || `http://localhost:${PORT}`;
    return url.replace(/\/+$/, '');
}

module.exports = {
    NODE_ENV,
    IS_PRODUCTION,
    PORT,
    APP_URL: resolveAppUrl(),
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '465', 10),
    SMTP_USER: process.env.SMTP_USER || '',
    // Gmail shows app passwords as "abcd efgh ijkl mnop" — the spaces aren't part of it.
    SMTP_PASS: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
    MAIL_FROM: process.env.MAIL_FROM || '',
    SALT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    SESSION_SECRET: resolveSessionSecret(),
    ADMIN_EMAIL: (process.env.ADMIN_EMAIL || '').toLowerCase().trim(),
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
    ADMIN_NAME: process.env.ADMIN_NAME || 'Admin',
};
