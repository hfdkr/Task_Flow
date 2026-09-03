const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { kv } = require('../store/kvClient');
const env = require('../config/env');
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
const RESET_TOKEN_TTL_SECONDS = 10 * 60;
const resetTokenKey = token => `resettoken:${token}`;

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
        const user = (await readUsers()).find(u => u.email === email);
        if (!user || !user.securityAnswer) return res.status(404).json({ success: false, message: 'No account found with that email.' });
        const match = await bcrypt.compare(answer, user.securityAnswer);
        if (!match) return res.status(401).json({ success: false, message: 'Incorrect answer. Please try again.' });
        const token = crypto.randomBytes(32).toString('hex');
        await kv.set(resetTokenKey(token), { userId: user.id }, { ex: RESET_TOKEN_TTL_SECONDS });
        res.json({ success: true, token });
    } catch (err) { res.status(500).json({ success: false, message: 'Something went wrong.' }); }
});

router.post('/forgot-password/reset', authLimiter, async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Missing token or new password.' });
        if (newPassword.length < 6)  return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        const entry = await kv.get(resetTokenKey(token));
        if (!entry) { return res.status(400).json({ success: false, message: 'Reset link expired. Please start over.' }); }
        const users = await readUsers();
        const idx   = users.findIndex(u => u.id === entry.userId);
        if (idx === -1) return res.status(404).json({ success: false, message: 'Account not found.' });
        users[idx].password = await bcrypt.hash(newPassword, env.SALT_ROUNDS);
        await writeUsers(users);
        await kv.del(resetTokenKey(token));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Something went wrong.' }); }
});

module.exports = router;
