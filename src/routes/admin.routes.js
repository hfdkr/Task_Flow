const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { readUsers, writeUsers, readData, writeData, writeTasks } = require('../store/jsonStore');

const router = express.Router();

router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = (await readUsers()).map(({ password, ...u }) => u);
        res.json({ success: true, users });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to load users' }); }
});

router.put('/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { role } = req.body;
        if (!['admin', 'member'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
        if (id === req.session.userId)           return res.status(400).json({ success: false, message: 'Cannot change your own role' });
        const users = await readUsers();
        const idx   = users.findIndex(u => u.id === id);
        if (idx === -1) return res.status(404).json({ success: false, message: 'User not found' });
        users[idx].role = role;
        await writeUsers(users);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to update role' }); }
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.session.userId) return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        const users = await readUsers();
        if (!users.some(u => u.id === id)) return res.status(404).json({ success: false, message: 'User not found' });
        await writeUsers(users.filter(u => u.id !== id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete user' }); }
});

router.delete('/clear-tasks', requireAuth, requireAdmin, async (req, res) => {
    try { await writeTasks([]); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, message: 'Failed to clear tasks' }); }
});

router.delete('/reset', requireAuth, requireAdmin, async (req, res) => {
    try {
        const d = await readData();
        d.tasks = []; d.members = []; d.projects = [];
        await writeData(d);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to reset workspace' }); }
});

module.exports = router;
