// ─── Imports ──────────────────────────────────────────────────────────────────
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const session      = require('express-session');

const app  = express();
const PORT = 3000;

// ─── Password (change this!) ──────────────────────────────────────────────────
// Store your password in a .env file in production; this is the default.
const APP_PASSWORD = process.env.APP_PASSWORD || 'taskflow123';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
    secret:            'taskflow-secret-key-change-in-production',
    resave:            false,
    saveUninitialized: false,
    cookie:            { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 } // 24h
}));

// ─── XSS Sanitizer ───────────────────────────────────────────────────────────
// Strips HTML tags from any string to prevent script injection
function sanitize(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
// Protects all /api routes — returns 401 if not logged in
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) return next();
    res.status(401).json({ success: false, message: 'Unauthorized' });
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────

// POST /api/login — check password, create session
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === APP_PASSWORD) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Wrong password' });
    }
});

// POST /api/logout — destroy session
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// GET /api/me — lets the frontend check if a session is still valid on page load
app.get('/api/me', (req, res) => {
    res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(__dirname));

// ─── Data File Setup ──────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data.json');

function readData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks: [], members: [] }, null, 2));
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    // backward-compat: if file only has tasks array
    if (!data.members) data.members = [];
    return data;
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function readTasks()       { return readData().tasks;   }
function readMembers()     { return readData().members; }

function writeTasks(tasks) {
    const data = readData();
    data.tasks = tasks;
    writeData(data);
}

function writeMembers(members) {
    const data = readData();
    data.members = members;
    writeData(data);
}

// ─── Tasks API ────────────────────────────────────────────────────────────────

// GET /api/tasks
app.get('/api/tasks', requireAuth, (req, res) => {
    try {
        res.json({ success: true, tasks: readTasks() });
    } catch (err) {
        console.error('GET /api/tasks error:', err);
        res.status(500).json({ success: false, message: 'Failed to load tasks' });
    }
});

// POST /api/tasks
app.post('/api/tasks', requireAuth, (req, res) => {
    try {
        const { title, member, project, status, priority, description, dueDate } = req.body;

        if (!title || !member) {
            return res.status(400).json({ success: false, message: 'Title and member are required' });
        }

        const tasks   = readTasks();
        const newTask = {
            id:          Date.now(),
            title:       sanitize(title),
            member:      sanitize(member),
            project:     sanitize(project  || ''),
            description: sanitize(description || ''),
            dueDate:     dueDate || '',
            status:      status   || 'To Do',
            priority:    priority || 'Low',
            createdAt:   new Date().toISOString()
        };

        tasks.push(newTask);
        writeTasks(tasks);
        res.status(201).json({ success: true, task: newTask });
    } catch (err) {
        console.error('POST /api/tasks error:', err);
        res.status(500).json({ success: false, message: 'Failed to create task' });
    }
});

// PUT /api/tasks/:id
app.put('/api/tasks/:id', requireAuth, (req, res) => {
    try {
        const id     = parseInt(req.params.id);
        const { title, member, project, status, priority, description, dueDate } = req.body;

        const tasks = readTasks();
        const index = tasks.findIndex(t => t.id === id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        tasks[index] = {
            ...tasks[index],
            ...(title       !== undefined && { title:       sanitize(title)       }),
            ...(member      !== undefined && { member:      sanitize(member)      }),
            ...(project     !== undefined && { project:     sanitize(project)     }),
            ...(description !== undefined && { description: sanitize(description) }),
            ...(dueDate     !== undefined && { dueDate                            }),
            ...(status      !== undefined && { status                             }),
            ...(priority    !== undefined && { priority                           }),
            updatedAt: new Date().toISOString()
        };

        writeTasks(tasks);
        res.json({ success: true, task: tasks[index] });
    } catch (err) {
        console.error('PUT /api/tasks/:id error:', err);
        res.status(500).json({ success: false, message: 'Failed to update task' });
    }
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', requireAuth, (req, res) => {
    try {
        const id    = parseInt(req.params.id);
        let   tasks = readTasks();

        if (!tasks.some(t => t.id === id)) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        writeTasks(tasks.filter(t => t.id !== id));
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/tasks/:id error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete task' });
    }
});

// ─── Members API ──────────────────────────────────────────────────────────────

// GET /api/members
app.get('/api/members', requireAuth, (req, res) => {
    try {
        res.json({ success: true, members: readMembers() });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load members' });
    }
});

// POST /api/members
app.post('/api/members', requireAuth, (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        const members = readMembers();
        const clean   = sanitize(name.trim());

        if (members.some(m => m.name.toLowerCase() === clean.toLowerCase())) {
            return res.status(409).json({ success: false, message: 'Member already exists' });
        }

        const member = { id: Date.now(), name: clean };
        members.push(member);
        writeMembers(members);
        res.status(201).json({ success: true, member });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to add member' });
    }
});

// DELETE /api/members/:id
app.delete('/api/members/:id', requireAuth, (req, res) => {
    try {
        const id      = parseInt(req.params.id);
        const members = readMembers();

        if (!members.some(m => m.id === id)) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        writeMembers(members.filter(m => m.id !== id));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete member' });
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`TaskFlow running on http://localhost:${PORT}`));