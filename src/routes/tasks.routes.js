const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sanitize } = require('../utils/sanitize');
const { readTasks, writeTasks } = require('../store/jsonStore');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
    try { res.json({ success: true, tasks: await readTasks() }); }
    catch (err) { res.status(500).json({ success: false, message: 'Failed to load tasks' }); }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { title, member, project, status, priority, description, dueDate } = req.body;
        if (!title || !member) return res.status(400).json({ success: false, message: 'Title and member are required' });
        const tasks   = await readTasks();
        const newTask = {
            id: Date.now(), title: sanitize(title), member: sanitize(member),
            project: sanitize(project || ''), description: sanitize(description || ''),
            dueDate: dueDate || '', status: status || 'To Do', priority: priority || 'Low',
            createdBy: req.session.userId, createdAt: new Date().toISOString()
        };
        tasks.push(newTask);
        await writeTasks(tasks);
        res.status(201).json({ success: true, task: newTask });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to create task' }); }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const id    = parseInt(req.params.id);
        const { title, member, project, status, priority, description, dueDate } = req.body;
        const tasks = await readTasks();
        const index = tasks.findIndex(t => t.id === id);
        if (index === -1) return res.status(404).json({ success: false, message: 'Task not found' });
        tasks[index] = {
            ...tasks[index],
            ...(title       !== undefined && { title:       sanitize(title)       }),
            ...(member      !== undefined && { member:      sanitize(member)      }),
            ...(project     !== undefined && { project:     sanitize(project)     }),
            ...(description !== undefined && { description: sanitize(description) }),
            ...(dueDate     !== undefined && { dueDate }),
            ...(status      !== undefined && { status }),
            ...(priority    !== undefined && { priority }),
            updatedAt: new Date().toISOString()
        };
        await writeTasks(tasks);
        res.json({ success: true, task: tasks[index] });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to update task' }); }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const tasks = await readTasks();
        if (!tasks.some(t => t.id === id)) return res.status(404).json({ success: false, message: 'Task not found' });
        await writeTasks(tasks.filter(t => t.id !== id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete task' }); }
});

module.exports = router;
