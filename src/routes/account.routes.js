const express = require('express');
const bcrypt = require('bcrypt');
const env = require('../config/env');
const { requireAuth } = require('../middleware/auth');
const { sanitize, isValidEmail } = require('../utils/sanitize');
const { readUsers, writeUsers } = require('../store/jsonStore');

const router = express.Router();

router.put('/profile', requireAuth, async (req, res) => {
    try {
        const { name, email } = req.body;
        if (!name || !name.trim())          return res.status(400).json({ success: false, message: 'Name is required' });
        if (!email || !isValidEmail(email)) return res.status(400).json({ success: false, message: 'Valid email is required' });
        const users      = await readUsers();
        const idx        = users.findIndex(u => u.id === req.session.userId);
        if (idx === -1)  return res.status(404).json({ success: false, message: 'User not found' });
        const emailLower = email.toLowerCase().trim();
        if (users.some(u => u.email === emailLower && u.id !== req.session.userId))
            return res.status(409).json({ success: false, message: 'Email already used by another account' });
        users[idx].name  = sanitize(name.trim());
        users[idx].email = emailLower;
        await writeUsers(users);
        req.session.userName  = users[idx].name;
        req.session.userEmail = users[idx].email;
        res.json({ success: true, user: { id: users[idx].id, name: users[idx].name, email: users[idx].email, role: users[idx].role, createdAt: users[idx].createdAt } });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to update profile' }); }
});

router.put('/password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword) return res.status(400).json({ success: false, message: 'Current password is required' });
        if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        const users = await readUsers();
        const idx   = users.findIndex(u => u.id === req.session.userId);
        if (idx === -1) return res.status(404).json({ success: false, message: 'User not found' });
        const match = await bcrypt.compare(currentPassword, users[idx].password);
        if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        users[idx].password = await bcrypt.hash(newPassword, env.SALT_ROUNDS);
        await writeUsers(users);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to change password' }); }
});

router.put('/', requireAuth, async (req, res) => {
    try {
        const { name, email, currentPassword, newPassword } = req.body;
        if (!name || !name.trim())          return res.status(400).json({ success: false, message: 'Name is required' });
        if (!email || !isValidEmail(email)) return res.status(400).json({ success: false, message: 'Valid email is required' });
        if (!currentPassword)               return res.status(400).json({ success: false, message: 'Current password is required' });
        const users = await readUsers();
        const idx   = users.findIndex(u => u.id === req.session.userId);
        if (idx === -1) return res.status(404).json({ success: false, message: 'User not found' });
        const match = await bcrypt.compare(currentPassword, users[idx].password);
        if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        const emailLower = email.toLowerCase().trim();
        if (users.some(u => u.email === emailLower && u.id !== req.session.userId))
            return res.status(409).json({ success: false, message: 'Email already used by another account' });
        users[idx].name  = sanitize(name.trim());
        users[idx].email = emailLower;
        if (newPassword) {
            if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
            users[idx].password = await bcrypt.hash(newPassword, env.SALT_ROUNDS);
        }
        await writeUsers(users);
        req.session.userName  = users[idx].name;
        req.session.userEmail = users[idx].email;
        res.json({ success: true, user: { id: users[idx].id, name: users[idx].name, email: users[idx].email, role: users[idx].role } });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to update account' }); }
});

module.exports = router;
