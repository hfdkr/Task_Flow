// ─── Imports ──────────────────────────────────────────────────────────────────
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const session      = require('express-session');
const bcrypt       = require('bcrypt');

const app  = express();
const PORT = 3000;
const SALT_ROUNDS = 12;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
    secret:            process.env.SESSION_SECRET || 'taskflow-secret-key-change-in-production',
    resave:            false,
    saveUninitialized: false,
    cookie:            { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// ─── XSS Sanitizer ───────────────────────────────────────────────────────────
function sanitize(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// ─── Email Validator ──────────────────────────────────────────────────────────
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    res.status(401).json({ success: false, message: 'Unauthorized' });
}

// ─── Data File Setup ──────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data.json');

function readData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks: [], members: [], projects: [], users: [] }, null, 2));
    }
    const raw  = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.members)  data.members  = [];
    if (!data.projects) data.projects = [];
    if (!data.users)    data.users    = [];
    return data;
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function readTasks()    { return readData().tasks;   }
function readMembers()  { return readData().members; }
function readProjects() { return readData().projects || []; }
function readUsers()    { return readData().users    || []; }

function writeTasks(tasks)       { const d = readData(); d.tasks    = tasks;    writeData(d); }
function writeMembers(members)   { const d = readData(); d.members  = members;  writeData(d); }
function writeProjects(projects) { const d = readData(); d.projects = projects; writeData(d); }
function writeUsers(users)       { const d = readData(); d.users    = users;    writeData(d); }

// ─── Auth Routes ──────────────────────────────────────────────────────────────

// POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !name.trim())           return res.status(400).json({ success: false, message: 'Name is required' });
        if (!email || !isValidEmail(email))  return res.status(400).json({ success: false, message: 'Valid email is required' });
        if (!password || password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

        const users = readUsers();
        const emailLower = email.toLowerCase().trim();

        if (users.some(u => u.email === emailLower)) {
            return res.status(409).json({ success: false, message: 'An account with this email already exists' });
        }

        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = {
            id:        Date.now(),
            name:      sanitize(name.trim()),
            email:     emailLower,
            password:  hash,
            role:      users.length === 0 ? 'admin' : 'member', // first user is admin
            createdAt: new Date().toISOString()
        };

        users.push(user);
        writeUsers(users);

        // Auto-login after register
        req.session.userId    = user.id;
        req.session.userName  = user.name;
        req.session.userEmail = user.email;
        req.session.userRole  = user.role;

        res.status(201).json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const users     = readUsers();
        const emailLower = email.toLowerCase().trim();
        const user      = users.find(u => u.email === emailLower);

        if (!user) {
            return res.status(401).json({ success: false, message: 'No account found with this email' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Incorrect password' });
        }

        req.session.userId    = user.id;
        req.session.userName  = user.name;
        req.session.userEmail = user.email;
        req.session.userRole  = user.role;

        res.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// GET /api/me
app.get('/api/me', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({
            authenticated: true,
            user: {
                id:    req.session.userId,
                name:  req.session.userName,
                email: req.session.userEmail,
                role:  req.session.userRole
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(__dirname));

// ─── Tasks API ────────────────────────────────────────────────────────────────
app.get('/api/tasks', requireAuth, (req, res) => {
    try {
        res.json({ success: true, tasks: readTasks() });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load tasks' });
    }
});

app.post('/api/tasks', requireAuth, (req, res) => {
    try {
        const { title, member, project, status, priority, description, dueDate } = req.body;
        if (!title || !member) return res.status(400).json({ success: false, message: 'Title and member are required' });
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
            createdBy:   req.session.userId,
            createdAt:   new Date().toISOString()
        };
        tasks.push(newTask);
        writeTasks(tasks);
        res.status(201).json({ success: true, task: newTask });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to create task' });
    }
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
    try {
        const id    = parseInt(req.params.id);
        const { title, member, project, status, priority, description, dueDate } = req.body;
        const tasks = readTasks();
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
        writeTasks(tasks);
        res.json({ success: true, task: tasks[index] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update task' });
    }
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let tasks = readTasks();
        if (!tasks.some(t => t.id === id)) return res.status(404).json({ success: false, message: 'Task not found' });
        writeTasks(tasks.filter(t => t.id !== id));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete task' });
    }
});

// ─── Projects API ─────────────────────────────────────────────────────────────
app.get('/api/projects', requireAuth, (req, res) => {
    try { res.json({ success: true, projects: readProjects() }); }
    catch (err) { res.status(500).json({ success: false, message: 'Failed to load projects' }); }
});

app.post('/api/projects', requireAuth, (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
        const projects = readProjects();
        const clean    = sanitize(name.trim());
        if (projects.some(p => p.name.toLowerCase() === clean.toLowerCase())) {
            return res.status(409).json({ success: false, message: 'Project already exists' });
        }
        const project = { id: Date.now(), name: clean };
        projects.push(project);
        writeProjects(projects);
        res.status(201).json({ success: true, project });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to add project' });
    }
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const projects = readProjects();
        if (!projects.some(p => p.id === id)) return res.status(404).json({ success: false, message: 'Project not found' });
        writeProjects(projects.filter(p => p.id !== id));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete project' });
    }
});

// ─── Members API ──────────────────────────────────────────────────────────────
app.get('/api/members', requireAuth, (req, res) => {
    try { res.json({ success: true, members: readMembers() }); }
    catch (err) { res.status(500).json({ success: false, message: 'Failed to load members' }); }
});

app.post('/api/members', requireAuth, (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
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

app.delete('/api/members/:id', requireAuth, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const members = readMembers();
        if (!members.some(m => m.id === id)) return res.status(404).json({ success: false, message: 'Member not found' });
        writeMembers(members.filter(m => m.id !== id));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete member' });
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`TaskFlow running on http://localhost:${PORT}`));