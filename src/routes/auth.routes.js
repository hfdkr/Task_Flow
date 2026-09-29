const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { kv } = require('../store/kvClient');
const env = require('../config/env');
const mailer = require('../services/mailer');
const { sanitize, isValidEmail } = require('../utils/sanitize');
const { readUsers, writeUsers, readMembers, writeMembers } = require('../store/jsonStore');

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts. Please try again later.' },
});

router.post('/register', authLimiter, async (req, res) => {
    try {
        const { name, email, password, securityQuestion, securityAnswer } = req.body;
        if (!name || !name.trim())            return res.status(400).json({ success: false, message: 'Name is required' });
        if (!email || !isValidEmail(email))   return res.status(400).json({ success: false, message: 'Valid email is required' });
        if (!password || password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        if (!securityQuestion || !securityQuestion.trim()) return res.status(400).json({ success: false, message: 'Please choose a security question' });
        if (!securityAnswer   || !securityAnswer.trim())   return res.status(400).json({ success: false, message: 'Please answer your security question' });

        const users      = await readUsers();
        const emailLower = email.toLowerCase().trim();
        if (users.some(u => u.email === emailLower))
            return res.status(409).json({ success: false, message: 'An account with this email already exists' });

        const hash       = await bcrypt.hash(password, env.SALT_ROUNDS);
        const answerHash = await bcrypt.hash(securityAnswer.trim().toLowerCase(), env.SALT_ROUNDS);
        const user = {
            id: Date.now(), name: sanitize(name.trim()), email: emailLower,
            password: hash, securityQuestion: sanitize(securityQuestion.trim()),
            securityAnswer: answerHash,
            role: users.length === 0 ? 'admin' : 'member',
            createdAt: new Date().toISOString()
        };
        users.push(user);
        await writeUsers(users);

        const members = await readMembers();
        if (!members.some(m => m.name.toLowerCase().trim() === user.name.toLowerCase().trim())) {
            members.push({ id: Date.now() + 1, name: user.name });
            await writeMembers(members);
        }

        req.session.userId    = user.id;
        req.session.userName  = user.name;
        req.session.userEmail = user.email;
        req.session.userRole  = user.role;

        res.status(201).json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt } });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });
        const users      = await readUsers();
        const emailLower = email.toLowerCase().trim();
        const user       = users.find(u => u.email === emailLower);
        if (!user) return res.status(401).json({ success: false, message: 'No account found with this email' });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ success: false, message: 'Incorrect password' });
        req.session.userId      = user.id;
        req.session.userName    = user.name;
        req.session.userEmail   = user.email;
        req.session.userRole    = user.role;
        req.session.userCreated = user.createdAt;
        res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

router.post('/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

router.get('/me', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ authenticated: true, user: { id: req.session.userId, name: req.session.userName, email: req.session.userEmail, role: req.session.userRole, createdAt: req.session.userCreated } });
    } else {
        res.json({ authenticated: false });
    }
});

// ─── Forgot Password ──────────────────────────────────────────────────────────
// Reset tokens used to live in an in-memory Map. On Vercel each request can
// hit a different function instance, so anything kept only in RAM can vanish
// before the next request arrives — these now live in Vercel KV with a TTL
// instead, which every instance can read.
//
// Only a SHA-256 of each token is used as the key, so a leaked Redis dump
// can't be replayed as working reset links. Each token also carries a
// fingerprint of the password hash it was issued against, so once the
// password changes every other outstanding link stops working.
const RESET_TOKEN_TTL_SECONDS = 10 * 60;
const EMAIL_RESET_TTL_SECONDS = 30 * 60;
const EMAIL_RESET_COOLDOWN_SECONDS = 60;
const EMAIL_RESET_DAILY_LIMIT = 5;
const SQ_MAX_FAILURES = 5;
const SQ_LOCKOUT_SECONDS = 15 * 60;
const DAY_SECONDS = 24 * 60 * 60;
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const resetTokenKey      = token => `resettoken:${sha256(token)}`;
const resetCooldownKey   = email => `resetmail:${email}`;
const resetDailyCountKey = email => `resetmail-day:${email}`;
const sqFailuresKey      = email => `sqfail:${email}`;
const passwordFingerprint = hash => sha256(hash).slice(0, 16);
const EMAIL_SENT_MESSAGE = 'If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).';

async function issueResetToken(user, ttlSeconds) {
    const token = crypto.randomBytes(32).toString('hex');
    await kv.set(resetTokenKey(token), { userId: user.id, pwd: passwordFingerprint(user.password) }, { ex: ttlSeconds });
    return token;
}

// Counter that starts expiring from its first hit (fixed window).
async function bumpCounter(key, windowSeconds) {
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, windowSeconds);
    return count;
}

// Per-IP limits are held in memory, so on Vercel each function instance
// counts separately — the KV-backed per-email limits below are what
// actually protect an inbox from being flooded.
const resetEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: { success: false, message: 'Too many reset requests. Please try again later.' },
});

// The response text is identical whether or not the account exists. (Login
// and the security-question lookup already reveal that, so this isn't
// trying to be timing-safe as well.)
router.post('/forgot-password/email', resetEmailLimiter, async (req, res) => {
    try {
        const email = (req.body.email || '').toString().toLowerCase().trim();
        if (!email || !isValidEmail(email)) return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        if (env.IS_PRODUCTION && !mailer.isConfigured()) {
            console.error('[TaskFlow] Password reset email requested but SMTP_USER / SMTP_PASS are not set.');
            return res.status(503).json({ success: false, message: 'Email reset is not available right now. Please use your security question instead.' });
        }

        const user = (await readUsers()).find(u => u.email === email);
        if (!user) return res.json({ success: true, message: EMAIL_SENT_MESSAGE });

        // At most one email per minute (atomic via NX) and a few per day per address.
        const gotSlot = await kv.set(resetCooldownKey(email), 1, { ex: EMAIL_RESET_COOLDOWN_SECONDS, nx: true });
        if (!gotSlot) return res.json({ success: true, message: EMAIL_SENT_MESSAGE });
        if (await bumpCounter(resetDailyCountKey(email), DAY_SECONDS) > EMAIL_RESET_DAILY_LIMIT)
            return res.json({ success: true, message: EMAIL_SENT_MESSAGE });

        const token = await issueResetToken(user, EMAIL_RESET_TTL_SECONDS);
        await mailer.sendPasswordResetEmail({
            to: user.email,
            name: user.name,
            link: `${env.APP_URL}/#reset=${token}`,
            expiresInMinutes: EMAIL_RESET_TTL_SECONDS / 60,
        });
        res.json({ success: true, message: EMAIL_SENT_MESSAGE });
    } catch (err) {
        console.error('Reset email error:', err);
        res.status(500).json({ success: false, message: 'Could not send the reset email. Please try again later.' });
    }
});

router.get('/forgot-password/question', authLimiter, async (req, res) => {
    try {
        const email = (req.query.email || '').toString().toLowerCase().trim();
        if (!email || !isValidEmail(email)) return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        const user = (await readUsers()).find(u => u.email === email);
        if (!user) return res.status(404).json({ success: false, message: 'No account found with that email.' });
        if (!user.securityQuestion || !user.securityAnswer) return res.status(404).json({ success: false, message: 'No security question set for this account.' });
        res.json({ success: true, question: user.securityQuestion });
    } catch (err) { res.status(500).json({ success: false, message: 'Something went wrong.' }); }
});

router.post('/forgot-password/verify', authLimiter, async (req, res) => {
    try {
        const email  = (req.body.email  || '').toString().toLowerCase().trim();
        const answer = (req.body.answer || '').toString().trim().toLowerCase();
        if (!email || !answer) return res.status(400).json({ success: false, message: 'Email and answer are required.' });
        // Per-account lockout in KV, so guessing can't be spread across IPs or instances.
        if (Number(await kv.get(sqFailuresKey(email))) >= SQ_MAX_FAILURES)
            return res.status(429).json({ success: false, message: 'Too many wrong answers. Try again in 15 minutes, or reset by email.' });
        const user = (await readUsers()).find(u => u.email === email);
        if (!user || !user.securityAnswer) return res.status(404).json({ success: false, message: 'No account found with that email.' });
        const match = await bcrypt.compare(answer, user.securityAnswer);
        if (!match) {
            await bumpCounter(sqFailuresKey(email), SQ_LOCKOUT_SECONDS);
            return res.status(401).json({ success: false, message: 'Incorrect answer. Please try again.' });
        }
        await kv.del(sqFailuresKey(email));
        const token = await issueResetToken(user, RESET_TOKEN_TTL_SECONDS);
        res.json({ success: true, token });
    } catch (err) { res.status(500).json({ success: false, message: 'Something went wrong.' }); }
});

router.post('/forgot-password/reset', authLimiter, async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (typeof token !== 'string' || typeof newPassword !== 'string' || !token || !newPassword)
            return res.status(400).json({ success: false, message: 'Missing token or new password.' });
        if (newPassword.length < 6)  return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        // GETDEL reads and consumes the token atomically, so a link can't be used twice.
        const entry = await kv.getdel(resetTokenKey(token));
        const users = entry ? await readUsers() : [];
        const idx   = entry ? users.findIndex(u => u.id === entry.userId) : -1;
        if (idx === -1 || entry.pwd !== passwordFingerprint(users[idx].password))
            return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired. Please request a new one.' });
        users[idx].password = await bcrypt.hash(newPassword, env.SALT_ROUNDS);
        await writeUsers(users);
        await kv.del(sqFailuresKey(users[idx].email));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Something went wrong.' }); }
});

module.exports = router;
