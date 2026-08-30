const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sanitize } = require('../utils/sanitize');
const { readMembers, writeMembers } = require('../store/jsonStore');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
    try { res.json({ success: true, members: readMembers() }); }
    catch (err) { res.status(500).json({ success: false, message: 'Failed to load members' }); }
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
        const members = readMembers();
        const clean   = sanitize(name.trim());
        if (members.some(m => m.name.toLowerCase() === clean.toLowerCase()))
            return res.status(409).json({ success: false, message: 'Member already exists' });
        const member = { id: Date.now(), name: clean };
        members.push(member);
        writeMembers(members);
        res.status(201).json({ success: true, member });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to add member' }); }
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const members = readMembers();
        if (!members.some(m => m.id === id)) return res.status(404).json({ success: false, message: 'Member not found' });
        writeMembers(members.filter(m => m.id !== id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete member' }); }
});

module.exports = router;
