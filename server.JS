// ─── Imports ──────────────────────────────────────────────────────────────────
require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');
const session      = require('express-session');
const bcrypt       = require('bcrypt');

const app         = express();
const PORT        = process.env.PORT          || 3000;
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
    secret:            process.env.SESSION_SECRET || 'taskflow-secret-key-change-in-production',
    resave:            false,
    saveUninitialized: false,
    cookie:            { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

function sanitize(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    res.status(401).json({ success: false, message: 'Unauthorized' });
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.userRole === 'admin') return next();
    res.status(403).json({ success: false, message: 'Admin access required' });
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

function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function readTasks()    { return readData().tasks;        }
function readMembers()  { return readData().members;      }
function readProjects() { return readData().projects || []; }
function readUsers()    { return readData().users    || []; }
function writeTasks(tasks)       { const d = readData(); d.tasks    = tasks;    writeData(d); }
function writeMembers(members)   { const d = readData(); d.members  = members;  writeData(d); }
function writeProjects(projects) { const d = readData(); d.projects = projects; writeData(d); }
function writeUsers(users)       { const d = readData(); d.users    = users;    writeData(d); }

// ─── Bootstrap Admin ─────────────────────────────────────────────────────────
async function bootstrapAdmin() {
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
    const adminPwd   = process.env.ADMIN_PASSWORD || '';
    const adminName  = process.env.ADMIN_NAME     || 'Admin';
    if (!adminEmail || !adminPwd) return;
    const users = readUsers();
    if (users.some(u => u.email === adminEmail)) return;
    const hash  = await bcrypt.hash(adminPwd, SALT_ROUNDS);
    const admin = { id: Date.now(), name: adminName, email: adminEmail, password: hash, role: 'admin', createdAt: new Date().toISOString() };
    users.unshift(admin);
    writeUsers(users);
    const members = readMembers();
    if (!members.some(m => m.name.toLowerCase().trim() === adminName.toLowerCase().trim())) {
        members.push({ id: Date.now() + 1, name: adminName });
        writeMembers(members);
    }
    console.log(`[TaskFlow] ✓ Admin created: ${adminEmail}`);
}

// ─── Register ─────────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, securityQuestion, securityAnswer } = req.body;
        if (!name || !name.trim())            return res.status(400).json({ success: false, message: 'Name is required' });
        if (!email || !isValidEmail(email))   return res.status(400).json({ success: false, message: 'Valid email is required' });
        if (!password || password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        if (!securityQuestion || !securityQuestion.trim()) return res.status(400).json({ success: false, message: 'Please choose a security question' });
        if (!securityAnswer   || !securityAnswer.trim())   return res.status(400).json({ success: false, message: 'Please answer your security question' });

        const users      = readUsers();
        const emailLower = email.toLowerCase().trim();
        if (users.some(u => u.email === emailLower))
            return res.status(409).json({ success: false, message: 'An account with this email already exists' });

        const hash       = await bcrypt.hash(password, SALT_ROUNDS);
        const answerHash = await bcrypt.hash(securityAnswer.trim().toLowerCase(), SALT_ROUNDS);
        const user = {
            id: Date.now(), name: sanitize(name.trim()), email: emailLower,
            password: hash, securityQuestion: sanitize(securityQuestion.trim()),
            securityAnswer: answerHash,
            role: users.length === 0 ? 'admin' : 'member',
            createdAt: new Date().toISOString()
        };
        users.push(user);
        writeUsers(users);

        // ── Auto-add to members ──
        const members = readMembers();
        if (!members.some(m => m.name.toLowerCase().trim() === user.name.toLowerCase().trim())) {
            members.push({ id: Date.now() + 1, name: user.name });
            writeMembers(members);
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

// ─── Login ────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });
        const users      = readUsers();
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

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/me', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ authenticated: true, user: { id: req.session.userId, name: req.session.userName, email: req.session.userEmail, role: req.session.userRole, createdAt: req.session.userCreated } });
    } else {
        res.json({ authenticated: false });
    }
});

// ─── Forgot Password ──────────────────────────────────────────────────────────
const resetTokens = new Map();
const RESET_TOKEN_TTL = 10 * 60 * 1000;

app.get('/api/forgot-password/question', (req, res) => {
    try {
        const email = (req.query.email || '').toString().toLowerCase().trim();
        if (!email || !isValidEmail(email)) return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        const user = readUsers().find(u => u.email === email);
        if (!user) return res.status(404).json({ success: false, message: 'No account found with that email.' });
        if (!user.securityQuestion || !user.securityAnswer) return res.status(404).json({ success: false, message: 'No security question set for this account.' });
        res.json({ success: true, question: user.securityQuestion });
    } catch (err) { res.status(500).json({ success: false, message: 'Something went wrong.' }); }
});

app.post('/api/forgot-password/verify', async (req, res) => {
    try {
        const email  = (req.body.email  || '').toString().toLowerCase().trim();
        const answer = (req.body.answer || '').toString().trim().toLowerCase();
        if (!email || !answer) return res.status(400).json({ success: false, message: 'Email and answer are required.' });
        const user = readUsers().find(u => u.email === email);
        if (!user || !user.securityAnswer) return res.status(404).json({ success: false, message: 'No account found with that email.' });
        const match = await bcrypt.compare(answer, user.securityAnswer);
        if (!match) return res.status(401).json({ success: false, message: 'Incorrect answer. Please try again.' });
        const token = require('crypto').randomBytes(32).toString('hex');
        resetTokens.set(token, { userId: user.id, expires: Date.now() + RESET_TOKEN_TTL });
        res.json({ success: true, token });
    } catch (err) { res.status(500).json({ success: false, message: 'Something went wrong.' }); }
});

app.post('/api/forgot-password/reset', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Missing token or new password.' });
        if (newPassword.length < 6)  return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        const entry = resetTokens.get(token);
        if (!entry || entry.expires < Date.now()) { resetTokens.delete(token); return res.status(400).json({ success: false, message: 'Reset link expired. Please start over.' }); }
        const users = readUsers();
        const idx   = users.findIndex(u => u.id === entry.userId);
        if (idx === -1) return res.status(404).json({ success: false, message: 'Account not found.' });
        users[idx].password = await bcrypt.hash(newPassword, SALT_ROUNDS);
        writeUsers(users);
        resetTokens.delete(token);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Something went wrong.' }); }
});

app.use(express.static(__dirname));

// ─── Tasks — ADMIN ONLY for create/update/delete ──────────────────────────────
app.get('/api/tasks', requireAuth, (req, res) => {
    try { res.json({ success: true, tasks: readTasks() }); }
    catch (err) { res.status(500).json({ success: false, message: 'Failed to load tasks' }); }
});

app.post('/api/tasks', requireAuth, requireAdmin, (req, res) => {
    try {
        const { title, member, project, status, priority, description, dueDate } = req.body;
        if (!title || !member) return res.status(400).json({ success: false, message: 'Title and member are required' });
        const tasks   = readTasks();
        const newTask = {
            id: Date.now(), title: sanitize(title), member: sanitize(member),
            project: sanitize(project || ''), description: sanitize(description || ''),
            dueDate: dueDate || '', status: status || 'To Do', priority: priority || 'Low',
            createdBy: req.session.userId, createdAt: new Date().toISOString()
        };
        tasks.push(newTask);
        writeTasks(tasks);
        res.status(201).json({ success: true, task: newTask });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to create task' }); }
});

app.put('/api/tasks/:id', requireAuth, requireAdmin, (req, res) => {
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
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to update task' }); }
});

app.delete('/api/tasks/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const tasks = readTasks();
        if (!tasks.some(t => t.id === id)) return res.status(404).json({ success: false, message: 'Task not found' });
        writeTasks(tasks.filter(t => t.id !== id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete task' }); }
});

// ─── Projects — ADMIN ONLY for create/delete ──────────────────────────────────
app.get('/api/projects', requireAuth, (req, res) => {
    try { res.json({ success: true, projects: readProjects() }); }
    catch (err) { res.status(500).json({ success: false, message: 'Failed to load projects' }); }
});

app.post('/api/projects', requireAuth, requireAdmin, (req, res) => {
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

app.delete('/api/projects/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const projects = readProjects();
        if (!projects.some(p => p.id === id)) return res.status(404).json({ success: false, message: 'Project not found' });
        writeProjects(projects.filter(p => p.id !== id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete project' }); }
});

// ─── Members — ADMIN ONLY for add/delete ──────────────────────────────────────
app.get('/api/members', requireAuth, (req, res) => {
    try { res.json({ success: true, members: readMembers() }); }
    catch (err) { res.status(500).json({ success: false, message: 'Failed to load members' }); }
});

app.post('/api/members', requireAuth, requireAdmin, (req, res) => {
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

app.delete('/api/members/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const members = readMembers();
        if (!members.some(m => m.id === id)) return res.status(404).json({ success: false, message: 'Member not found' });
        writeMembers(members.filter(m => m.id !== id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete member' }); }
});

// ─── Account ──────────────────────────────────────────────────────────────────
app.put('/api/account/profile', requireAuth, async (req, res) => {
    try {
        const { name, email } = req.body;
        if (!name || !name.trim())          return res.status(400).json({ success: false, message: 'Name is required' });
        if (!email || !isValidEmail(email)) return res.status(400).json({ success: false, message: 'Valid email is required' });
        const users      = readUsers();
        const idx        = users.findIndex(u => u.id === req.session.userId);
        if (idx === -1)  return res.status(404).json({ success: false, message: 'User not found' });
        const emailLower = email.toLowerCase().trim();
        if (users.some(u => u.email === emailLower && u.id !== req.session.userId))
            return res.status(409).json({ success: false, message: 'Email already used by another account' });
        users[idx].name  = sanitize(name.trim());
        users[idx].email = emailLower;
        writeUsers(users);
        req.session.userName  = users[idx].name;
        req.session.userEmail = users[idx].email;
        res.json({ success: true, user: { id: users[idx].id, name: users[idx].name, email: users[idx].email, role: users[idx].role, createdAt: users[idx].createdAt } });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to update profile' }); }
});

app.put('/api/account/password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword) return res.status(400).json({ success: false, message: 'Current password is required' });
        if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        const users = readUsers();
        const idx   = users.findIndex(u => u.id === req.session.userId);
        if (idx === -1) return res.status(404).json({ success: false, message: 'User not found' });
        const match = await bcrypt.compare(currentPassword, users[idx].password);
        if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        users[idx].password = await bcrypt.hash(newPassword, SALT_ROUNDS);
        writeUsers(users);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to change password' }); }
});

app.put('/api/account', requireAuth, async (req, res) => {
    try {
        const { name, email, currentPassword, newPassword } = req.body;
        if (!name || !name.trim())          return res.status(400).json({ success: false, message: 'Name is required' });
        if (!email || !isValidEmail(email)) return res.status(400).json({ success: false, message: 'Valid email is required' });
        if (!currentPassword)               return res.status(400).json({ success: false, message: 'Current password is required' });
        const users = readUsers();
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
            users[idx].password = await bcrypt.hash(newPassword, SALT_ROUNDS);
        }
        writeUsers(users);
        req.session.userName  = users[idx].name;
        req.session.userEmail = users[idx].email;
        res.json({ success: true, user: { id: users[idx].id, name: users[idx].name, email: users[idx].email, role: users[idx].role } });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to update account' }); }
});

// ─── Admin: User Management ───────────────────────────────────────────────────
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    try {
        const users = readUsers().map(({ password, ...u }) => u);
        res.json({ success: true, users });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to load users' }); }
});

app.put('/api/admin/users/:id/role', requireAuth, requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { role } = req.body;
        if (!['admin', 'member'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
        if (id === req.session.userId)           return res.status(400).json({ success: false, message: 'Cannot change your own role' });
        const users = readUsers();
        const idx   = users.findIndex(u => u.id === id);
        if (idx === -1) return res.status(404).json({ success: false, message: 'User not found' });
        users[idx].role = role;
        writeUsers(users);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to update role' }); }
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.session.userId) return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        const users = readUsers();
        if (!users.some(u => u.id === id)) return res.status(404).json({ success: false, message: 'User not found' });
        writeUsers(users.filter(u => u.id !== id));
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete user' }); }
});

app.delete('/api/admin/clear-tasks', requireAuth, requireAdmin, (req, res) => {
    try { writeTasks([]); res.json({ success: true }); }
    catch (err) { res.status(500).json({ success: false, message: 'Failed to clear tasks' }); }
});

app.delete('/api/admin/reset', requireAuth, requireAdmin, (req, res) => {
    try {
        const d = readData();
        d.tasks = []; d.members = []; d.projects = [];
        writeData(d);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: 'Failed to reset workspace' }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────
bootstrapAdmin().then(() => {
    app.listen(PORT, () => console.log(`[TaskFlow] Server running → http://localhost:${PORT}`));
}).catch(err => { console.error('[TaskFlow] Bootstrap error:', err); process.exit(1); });