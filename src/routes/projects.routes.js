const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sanitize } = require('../utils/sanitize');
const { readProjects, writeProjects } = require('../store/jsonStore');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
    try { res.json({ success: true, projects: readProjects() }); }
    catch (err) { res.status(500).json({ success: false, message: 'Failed to load projects' }); }
});

router.post('/', requireAuth, requireAdmin, (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
        const projects = readProjects();
        const clean    = sanitize(name.trim());
        if (projects.some(p => p.name.toLowerCase() === clean.toLowerCase()))
            return res.status(409).json({ success: false, message: 'Project already exists' });
        const project = { id: Date.now(), name: clean };
        projects.push(project);
        writeProjects(projects);
        res.status(201).json({ success: true, project });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to add project' }); }
});

router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const projects = readProjects();
        if (!projects.some(p => p.id === id)) return res.status(404).json({ success: false, message: 'Project not found' });
        writeProjects(projects.filter(p => p.id !== id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete project' }); }
});

module.exports = router;
