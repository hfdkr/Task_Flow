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

module.exports = {
    NODE_ENV,
    IS_PRODUCTION,
    PORT: parseInt(process.env.PORT || '3000', 10),
    SALT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    SESSION_SECRET: resolveSessionSecret(),
    ADMIN_EMAIL: (process.env.ADMIN_EMAIL || '').toLowerCase().trim(),
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
    ADMIN_NAME: process.env.ADMIN_NAME || 'Admin',
};
