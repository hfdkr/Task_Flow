// ─── API Base URL ─────────────────────────────────────────────────────────────
const API = 'http://localhost:3000/api';

// ─── State ────────────────────────────────────────────────────────────────────
let editingTaskId   = null;
let activeFilter    = 'all';
let searchQuery     = '';
let pendingDeleteId = null;
let allTasksCache   = [];
let boardMode       = 'list';

// ─── Mobile Menu ─────────────────────────────────────────────────────────────
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const btn  = document.getElementById('hamburger-btn');
    const isOpen = menu.classList.toggle('open');
    // Animate hamburger → X
    const lines = btn.querySelectorAll('.ham-line');
    if (isOpen) {
        lines[0].style.transform = 'translateY(7px) rotate(45deg)';
        lines[1].style.opacity   = '0';
        lines[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
        lines[0].style.transform = '';
        lines[1].style.opacity   = '';
        lines[2].style.transform = '';
    }
}

function closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const btn  = document.getElementById('hamburger-btn');
    menu.classList.remove('open');
    const lines = btn ? btn.querySelectorAll('.ham-line') : [];
    lines.forEach(l => { l.style.transform = ''; l.style.opacity = ''; });
}

// Close mobile menu when tapping outside
document.addEventListener('click', e => {
    const nav = document.getElementById('mobile-nav');
    if (nav && !nav.contains(e.target)) closeMobileMenu();
});

// ─── Sidebar Toggle ───────────────────────────────────────────────────────────
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('tf-sidebar', sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded');
}

function initSidebar() {
    const saved = localStorage.getItem('tf-sidebar');
    if (saved === 'collapsed') {
        document.getElementById('sidebar').classList.add('collapsed');
    }
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function initTheme() {
    initSidebar();
    const saved = localStorage.getItem('tf-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const chk = document.getElementById('theme-check');
    if (chk) chk.checked = (saved === 'dark');
    const chkM = document.getElementById('theme-check-mobile');
    if (chkM) chkM.checked = (saved === 'dark');
    updateThemeLabel(saved);
}

function toggleTheme(isDark) {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tf-theme', theme);
    updateThemeLabel(theme);
}

function updateThemeLabel(theme) {
    const labelEl = document.querySelector('#sidebar nav ~ div span:first-child');
    if (labelEl) {
        labelEl.innerHTML = theme === 'dark' ? '<i class="fi fi-rr-moon"></i> Dark mode' : '<i class="fi fi-rr-brightness"></i> Light mode';
    }
}

// ─── View Switching ───────────────────────────────────────────────────────────
function switchView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById('view-' + name).classList.add('active');
    const desktopNav = document.querySelector(`[data-view="${name}"]`);
    if (desktopNav) desktopNav.classList.add('active');

    // Sync mobile nav active state
    document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
    const mobileNav = document.getElementById('mob-nav-' + name);
    if (mobileNav) mobileNav.classList.add('active');

    const titles = { dashboard: 'Dashboard', kanban: 'Kanban Board', settings: 'Settings' };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[name] || name;

    // Refresh data for the active view
    if (name === 'dashboard') renderDashboard();
    if (name === 'kanban')    renderTasks();
    if (name === 'settings')  openSettingsView();
}

// ─── DOM References ───────────────────────────────────────────────────────────
const loginScreen   = document.getElementById('login-screen');
const appEl         = document.getElementById('app');

// Legacy hidden inputs (kept for JS compatibility, now display:none)
const titleInput    = document.getElementById('title-input');
const memberSelect  = document.getElementById('member-select');
const projectSelect = document.getElementById('project-select');
const dueDateInput  = document.getElementById('due-date-input');
const statusSelect  = document.getElementById('status-select');
const prioritySelect = document.getElementById('priority-select');
const descInput     = document.getElementById('desc-input');
const searchInput   = document.getElementById('search-input');

const todoContainer     = document.getElementById('todo-container');
const progressContainer = document.getElementById('inprogress-container');
const doneContainer     = document.getElementById('done-container');

const todoCount     = document.getElementById('todo-count');
const progressCount = document.getElementById('inprogress-count');
const doneCount     = document.getElementById('done-count');
const taskTableBody = document.getElementById('task-table-body');
const taskSummary   = document.getElementById('task-summary');

const projectFiltersEl = document.getElementById('project-filters');
const errorBanner      = document.getElementById('error-banner');
const errorText        = document.getElementById('error-text');

const membersPanel     = document.getElementById('members-panel');
const newMemberInput   = document.getElementById('new-member-input');
const membersList      = document.getElementById('members-list');

const projectsPanel    = document.getElementById('projects-panel');
const newProjectInput  = document.getElementById('new-project-input');
const projectsList     = document.getElementById('projects-list');


// ─── Error Banner ─────────────────────────────────────────────────────────────
function showError(msg) {
    errorText.textContent = msg;
    errorBanner.style.display = 'flex';
    setTimeout(() => errorBanner.style.display = 'none', 5000);
}
function hideError() { errorBanner.style.display = 'none'; }


// ─── Auth Tab Switcher ────────────────────────────────────────────────────────
function switchAuthTab(tab) {
    const isSignin = tab === 'signin';
    document.getElementById('form-signin').style.display  = isSignin ? 'block' : 'none';
    document.getElementById('form-signup').style.display  = isSignin ? 'none'  : 'block';
    document.getElementById('tab-signin').style.background  = isSignin ? 'var(--brand)' : 'transparent';
    document.getElementById('tab-signin').style.color       = isSignin ? 'white' : 'var(--text-muted)';
    document.getElementById('tab-signup').style.background  = isSignin ? 'transparent' : 'var(--brand)';
    document.getElementById('tab-signup').style.color       = isSignin ? 'var(--text-muted)' : 'white';
    document.getElementById('auth-subtitle').textContent    = isSignin
        ? 'Welcome back — sign in to continue'
        : 'Create your free account to get started';
    // Clear errors
    setAuthError('signin', ''); setAuthError('signup', '');
}

function setAuthError(form, msg) {
    const el = document.getElementById(`${form}-error`);
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

function setAuthLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.65' : '1';
    btn.style.cursor  = loading ? 'not-allowed' : 'pointer';
}

// Password visibility toggle
function togglePwd(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    btn.textContent = isHidden ? '🙈' : '👁';
}

// Password strength meter
function updateStrength(val) {
    const bars  = document.querySelectorAll('.strength-bar');
    const label = document.getElementById('strength-label');
    if (!bars.length || !label) return;
    let score = 0;
    if (val.length >= 6)  score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const colors  = ['', '#ef4444', '#f59e0b', '#6c8fff', '#10b981'];
    const labels  = ['', 'Weak', 'Fair', 'Good', 'Strong 💪'];
    bars.forEach((b, i) => { b.style.background = i < score ? (colors[score] || 'var(--border-strong)') : 'var(--border-strong)'; });
    label.textContent  = val.length ? labels[score] : '';
    label.style.color  = colors[score] || 'var(--text-muted)';
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
let currentUser = null;

async function checkAuth() {
    initTheme();
    try {
        const res  = await fetch(`${API}/me`, { credentials: 'include' });
        const data = await res.json();
        if (data.authenticated) { currentUser = data.user; showApp(); }
        else showLogin();
    } catch {
        showLogin();
        showError('Cannot reach the server. Make sure it is running.');
    }
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    appEl.classList.add('hidden');
    switchAuthTab('signin');
}

function showApp() {
    loginScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    updateUserUI();
    init();
}

function updateUserUI() {
    if (!currentUser) return;
    const initials = currentUser.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    // Sidebar avatar
    const av = document.getElementById('user-avatar');
    if (av) av.textContent = initials;
    const avM = document.getElementById('user-avatar-mini');
    if (avM) avM.textContent = initials;
    // Name & email
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = currentUser.name;
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = currentUser.email;
    // Role badge
    const badge = document.getElementById('user-role-badge');
    if (badge && currentUser.role === 'admin') {
        badge.style.display = 'block';
    }
    // Show Settings nav only for admins
    const navSettings    = document.getElementById('nav-settings');
    const mobNavSettings = document.getElementById('mob-nav-settings');
    if (currentUser.role === 'admin') {
        if (navSettings)    navSettings.style.display    = 'flex';
        if (mobNavSettings) mobNavSettings.style.display = 'flex';
    } else {
        if (navSettings)    navSettings.style.display    = 'none';
        if (mobNavSettings) mobNavSettings.style.display = 'none';
    }
}

// Enter key support
document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (!loginScreen.classList.contains('hidden')) {
        const signinForm = document.getElementById('form-signin');
        if (signinForm && signinForm.style.display !== 'none') handleSignIn();
        else handleSignUp();
    }
});

async function handleSignIn() {
    const email    = (document.getElementById('signin-email')?.value    || '').trim();
    const password = (document.getElementById('signin-password')?.value || '');
    setAuthError('signin', '');
    if (!email || !password) { setAuthError('signin', 'Please enter your email and password.'); return; }
    setAuthLoading('signin-btn', true);
    try {
        const res  = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (data.success) { currentUser = data.user; showApp(); }
        else setAuthError('signin', data.message || 'Invalid credentials.');
    } catch {
        setAuthError('signin', 'Cannot reach server. Is it running?');
    } finally {
        setAuthLoading('signin-btn', false);
    }
}

async function handleSignUp() {
    const name     = (document.getElementById('signup-name')?.value     || '').trim();
    const email    = (document.getElementById('signup-email')?.value    || '').trim();
    const password = (document.getElementById('signup-password')?.value || '');
    setAuthError('signup', '');
    if (!name)            { setAuthError('signup', 'Please enter your name.');             return; }
    if (!email)           { setAuthError('signup', 'Please enter your email.');            return; }
    if (password.length < 6) { setAuthError('signup', 'Password must be at least 6 characters.'); return; }
    setAuthLoading('signup-btn', true);
    try {
        const res  = await fetch(`${API}/register`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ name, email, password }) });
        const data = await res.json();
        if (data.success) { currentUser = data.user; showApp(); }
        else setAuthError('signup', data.message || 'Registration failed.');
    } catch {
        setAuthError('signup', 'Cannot reach server. Is it running?');
    } finally {
        setAuthLoading('signup-btn', false);
    }
}

async function logout() {
    await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
    currentUser = null;
    showLogin();
}


// ─── API Helpers ──────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
    const res = await fetch(url, { ...options, credentials:'include', headers:{ 'Content-Type':'application/json', ...(options.headers||{}) } });
    if (res.status === 401) { showLogin(); throw new Error('Session expired'); }
    return res.json();
}

async function fetchTasks()         { return (await apiFetch(`${API}/tasks`)).tasks; }
async function fetchMembers()       { return (await apiFetch(`${API}/members`)).members; }
async function createTask(task)     { return apiFetch(`${API}/tasks`, { method:'POST', body: JSON.stringify(task) }); }
async function updateTask(id, c)    { return apiFetch(`${API}/tasks/${id}`, { method:'PUT', body: JSON.stringify(c) }); }
async function removeTask(id)       { return apiFetch(`${API}/tasks/${id}`, { method:'DELETE' }); }
async function createMember(name)   { return apiFetch(`${API}/members`, { method:'POST', body: JSON.stringify({ name }) }); }
async function removeMember(id)     { return apiFetch(`${API}/members/${id}`, { method:'DELETE' }); }
async function fetchProjects()      { return (await apiFetch(`${API}/projects`)).projects; }
async function createProject(name)  { return apiFetch(`${API}/projects`, { method:'POST', body: JSON.stringify({ name }) }); }
async function removeProject(id)    { return apiFetch(`${API}/projects/${id}`, { method:'DELETE' }); }


// ─── Members Panel ────────────────────────────────────────────────────────────
function openMembersPanel()  { if (membersPanel) membersPanel.classList.remove('hidden'); }
function closeMembersPanel() { if (membersPanel) membersPanel.classList.add('hidden'); }
if (membersPanel)    membersPanel.addEventListener('click', e => { if (e.target === membersPanel) closeMembersPanel(); });
if (newMemberInput)  newMemberInput.addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });

// Avatar palette — cycles through distinct hues for member avatars
const AVATAR_COLORS = [
    { bg: 'rgba(108,143,255,0.18)', border: 'rgba(108,143,255,0.35)', color: '#6c8fff' },  // blue
    { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.3)',   color: '#ef6060' },   // red
    { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)',  color: '#f59e0b' },   // amber
    { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.3)',  color: '#10b981' },   // green
    { bg: 'rgba(168,85,247,0.15)',  border: 'rgba(168,85,247,0.3)',  color: '#a855f7' },   // purple
    { bg: 'rgba(236,72,153,0.15)',  border: 'rgba(236,72,153,0.3)',  color: '#ec4899' },   // pink
];

function memberAvatarStyle(idx) {
    const c = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    return `background:${c.bg};border:1.5px solid ${c.border};color:${c.color}`;
}

function memberInitials(name) {
    return String(name || '?').trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

async function renderMembersPanel() {
    const members = await fetchMembers();

    // Sync hidden member-select (used by legacy form code)
    memberSelect.innerHTML = '<option value="">Assign to...</option>';
    // Sync modal member selects
    const modalMemberSelect = document.getElementById('modal-member-select');
    if (modalMemberSelect) modalMemberSelect.innerHTML = '<option value="">Assign to...</option>';

    members.forEach((m, idx) => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = m.name;
        memberSelect.appendChild(opt);
        if (modalMemberSelect) {
            const opt2 = document.createElement('option');
            opt2.value = opt2.textContent = m.name;
            modalMemberSelect.appendChild(opt2);
        }
    });

    membersList.innerHTML = '';
    if (!members.length) {
        membersList.innerHTML = `<p style="font-size:13px;color:var(--text-muted)">No members yet. Add one above.</p>`;
        return;
    }
    members.forEach((m, idx) => {
        const isAdmin = m.role === 'admin' || idx === 0; // first member or explicit admin
        const avatarStyle = memberAvatarStyle(idx);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:var(--bg-element);border:1px solid var(--border-strong);border-radius:12px;padding:12px 16px;transition:border-color 0.18s';
        row.onmouseover = () => row.style.borderColor = 'var(--border-strong)';
        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px">
                <span style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;${avatarStyle}">${memberInitials(m.name)}</span>
                <div>
                    <div style="font-size:14px;font-weight:600;color:var(--text-main)">${m.name}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:1px">${isAdmin ? 'Admin' : 'Member'}</div>
                </div>
            </div>
            <button onclick="deleteMember(${m.id})" style="color:var(--text-muted);font-size:15px;cursor:pointer;background:none;border:none;transition:color 0.18s;padding:4px" onmouseover="this.style.color='var(--status-danger)'" onmouseout="this.style.color='var(--text-muted)'">✕</button>`;
        membersList.appendChild(row);
    });
}

async function addMember() {
    const name = newMemberInput.value.trim();
    if (!name) return;
    const result = await createMember(name);
    if (!result.success) { showError(result.message || 'Failed to add member'); return; }
    newMemberInput.value = '';
    await renderMembersPanel();
    await renderDashboard();
}

async function deleteMember(id) {
    const result = await removeMember(id);
    if (!result.success) { showError('Failed to remove member'); return; }
    await renderMembersPanel();
    await renderDashboard();
}


// ─── Projects Panel ───────────────────────────────────────────────────────────
function openProjectsPanel()  { if (projectsPanel) projectsPanel.classList.remove('hidden'); }
function closeProjectsPanel() { if (projectsPanel) projectsPanel.classList.add('hidden'); }
if (projectsPanel)   projectsPanel.addEventListener('click', e => { if (e.target === projectsPanel) closeProjectsPanel(); });
if (newProjectInput) newProjectInput.addEventListener('keydown', e => { if (e.key === 'Enter') addProject(); });

async function renderProjectsPanel() {
    const projects = await fetchProjects();
    // Rebuild project select dropdowns
    const current = projectSelect.value;
    projectSelect.innerHTML = '<option value="">No project...</option>';
    const modalProjectSelect = document.getElementById('modal-project-select');
    if (modalProjectSelect) modalProjectSelect.innerHTML = '<option value="">No project...</option>';
    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = p.name;
        projectSelect.appendChild(opt);
        if (modalProjectSelect) {
            const opt2 = document.createElement('option');
            opt2.value = opt2.textContent = p.name;
            modalProjectSelect.appendChild(opt2);
        }
    });
    if (projects.some(p => p.name === current)) projectSelect.value = current;

    // Render panel list
    projectsList.innerHTML = '';
    if (!projects.length) {
        projectsList.innerHTML = `<p style="font-size:13px;color:var(--text-muted)">No projects yet. Add one above.</p>`;
        return;
    }
    projects.forEach(p => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:var(--bg-element);border:1px solid var(--border-strong);border-radius:10px;padding:10px 14px';
        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px">
                <span style="width:30px;height:30px;background:var(--brand-dim);border:1px solid rgba(108,143,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--brand)">◫</span>
                <span style="font-size:14px;color:var(--text-main)">${p.name}</span>
            </div>
            <button onclick="deleteProject(${p.id})" style="color:var(--text-muted);font-size:16px;cursor:pointer;background:none;border:none;transition:color 0.18s" onmouseover="this.style.color='var(--status-danger)'" onmouseout="this.style.color='var(--text-muted)'">✕</button>`;
        projectsList.appendChild(row);
    });
}

async function addProject() {
    const name = newProjectInput.value.trim();
    if (!name) return;
    const result = await createProject(name);
    if (!result.success) { showError(result.message || 'Failed to add project'); return; }
    newProjectInput.value = '';
    await renderProjectsPanel();
}

async function deleteProject(id) {
    const result = await removeProject(id);
    if (!result.success) { showError('Failed to remove project'); return; }
    await renderProjectsPanel();
}


// ─── Delete Modal ─────────────────────────────────────────────────────────────
function askDeleteConfirmation(id) {
    pendingDeleteId = id;
    showDangerModal('🗑', 'Delete Task?', 'This task will be permanently deleted. This cannot be undone.', async () => {
        const result = await removeTask(pendingDeleteId);
        pendingDeleteId = null;
        if (!result.success) { showError('Failed to delete task'); return; }
        await renderTasks();
        await renderDashboard();
    });
}


// ─── Task Form ────────────────────────────────────────────────────────────────

async function handleModalSubmit() {
    const title   = (document.getElementById('modal-title-input')?.value || '').trim();
    const member  = (document.getElementById('modal-member-select')?.value || '').trim();
    if (!title || !member) { showError('Please fill in the task title and assign a member'); return; }
    hideError();

    const payload = {
        title,
        member,
        project:     (document.getElementById('modal-project-select')?.value  || '').trim(),
        dueDate:      document.getElementById('modal-due-date')?.value         || '',
        status:       document.getElementById('modal-status-select')?.value    || 'To Do',
        priority:     document.getElementById('modal-priority-select')?.value  || 'Medium',
        description: (document.getElementById('modal-desc-input')?.value       || '').trim(),
    };

    if (editingTaskId) {
        const result = await updateTask(editingTaskId, payload);
        if (!result.success) { showError('Failed to update task'); return; }
        editingTaskId = null;
    } else {
        const result = await createTask(payload);
        if (!result.success) { showError('Failed to add task'); return; }
    }
    clearForm();
    closeTaskModal();
    await renderTasks();
    await renderDashboard();
}

function clearForm() {
    const ids = ['modal-title-input','modal-desc-input','modal-due-date'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const statusEl   = document.getElementById('modal-status-select');
    const priorityEl = document.getElementById('modal-priority-select');
    const memberEl   = document.getElementById('modal-member-select');
    const projectEl  = document.getElementById('modal-project-select');
    if (statusEl)   statusEl.value   = 'To Do';
    if (priorityEl) priorityEl.value = 'Medium';
    if (memberEl)   memberEl.value   = '';
    if (projectEl)  projectEl.value  = '';
    editingTaskId = null;
}

async function editTask(id) {
    const tasks = await fetchTasks();
    const task  = tasks.find(t => t.id === id);
    if (!task) return;
    openTaskModal(task.status);
    // Fill modal fields
    document.getElementById('modal-title-input').value   = task.title;
    document.getElementById('modal-desc-input').value    = task.description || '';
    document.getElementById('modal-status-select').value = task.status;
    document.getElementById('modal-priority-select').value = task.priority;
    document.getElementById('modal-member-select').value = task.member;
    document.getElementById('modal-project-select').value = task.project || '';
    document.getElementById('modal-due-date').value      = task.dueDate || '';
    document.getElementById('task-modal-title').textContent = 'Edit Task';
    document.getElementById('modal-submit-btn').textContent  = 'Update Task';
    editingTaskId = id;
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function openTaskModal(defaultStatus) {
    const modal = document.getElementById('task-modal');
    if (!modal) return;
    // Reset to "New Task" state unless called from editTask
    if (!editingTaskId) {
        clearForm();
        document.getElementById('task-modal-title').textContent  = 'New Task';
        document.getElementById('modal-submit-btn').textContent  = 'Create Task';
        // Set default status if column + button was clicked
        if (defaultStatus) {
            const sel = document.getElementById('modal-status-select');
            if (sel) sel.value = defaultStatus;
        }
        // Default due date to today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('modal-due-date').value = today;
    }
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('modal-title-input')?.focus(), 50);
}

function closeTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.add('hidden');
    clearForm();
}

document.addEventListener('click', e => {
    const modal = document.getElementById('task-modal');
    if (modal && e.target === modal) closeTaskModal();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeTaskModal();
    }
});

async function changeStatus(id, newStatus) {
    try { await updateTask(id, { status: newStatus }); await renderTasks(); await renderDashboard(); }
    catch { showError('Failed to change status'); }
}


// ─── Search + Filter ──────────────────────────────────────────────────────────
if (searchInput) searchInput.addEventListener('input', () => { searchQuery = searchInput.value.toLowerCase().trim(); renderTasks(); });

function setBoardMode(mode) {
    boardMode = mode === 'kanban' ? 'kanban' : 'list';
    const view = document.getElementById('view-kanban');
    if (view) view.dataset.boardMode = boardMode;
    document.getElementById('board-mode-list')?.classList.toggle('active', boardMode === 'list');
    document.getElementById('board-mode-kanban')?.classList.toggle('active', boardMode === 'kanban');
}

function setFilter(project) {
    activeFilter = project;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active-filter', btn.dataset.project === project);
    });
    renderTasks();
}

function buildFilterButtons(tasks) {
    const projects = [...new Set(tasks.map(t => t.project).filter(p => p && p.trim()))].sort();
    const btnBase = 'font-size:13px;font-weight:500;padding:7px 18px;border-radius:99px;border:1px solid var(--border-strong);background:transparent;cursor:pointer;color:var(--text-muted);transition:all 0.2s;';
    const btnActive = 'font-size:13px;font-weight:600;padding:7px 18px;border-radius:99px;border:1px solid var(--brand);background:var(--brand-dim);cursor:pointer;color:var(--brand);transition:all 0.2s;';
    projectFiltersEl.innerHTML = `<button class="filter-btn" data-project="all" onclick="setFilter('all')" style="${activeFilter==='all'?btnActive:btnBase}" onmouseover="if(this.dataset.project!==activeFilter)this.style.borderColor='var(--brand)';this.style.color='var(--brand)'" onmouseout="if(this.dataset.project!==activeFilter){this.style.borderColor='var(--border-strong)';this.style.color='var(--text-muted)';}">All Projects</button>`;
    projects.forEach(project => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.dataset.project = project;
        btn.onclick = () => setFilter(project);
        btn.style.cssText = activeFilter === project ? btnActive : btnBase;
        btn.textContent = project;
        btn.onmouseover = () => { if (activeFilter !== project) { btn.style.borderColor = 'var(--brand)'; btn.style.color = 'var(--brand)'; } };
        btn.onmouseout  = () => { if (activeFilter !== project) { btn.style.borderColor = 'var(--border-strong)'; btn.style.color = 'var(--text-muted)'; } };
        projectFiltersEl.appendChild(btn);
    });
}


// ─── Drag and Drop ────────────────────────────────────────────────────────────
let draggedId = null;

function onDragStart(e, id) { draggedId = id; e.currentTarget.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
function onDragEnd(e) { e.currentTarget.classList.remove('dragging'); document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('drag-over')); }

document.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', async e => {
        e.preventDefault(); zone.classList.remove('drag-over');
        const newStatus = zone.dataset.status;
        if (draggedId && newStatus) { await updateTask(draggedId, { status: newStatus }); draggedId = null; await renderTasks(); await renderDashboard(); }
    });
});


// ─── Kanban Render ────────────────────────────────────────────────────────────
function showLoadingSkeleton() {
    const sk = `<div class="skeleton" style="height:140px;width:100%"></div>`;
    todoContainer.innerHTML = sk + sk; progressContainer.innerHTML = sk; doneContainer.innerHTML = sk + sk;
}

async function renderTasks() {
    const allTasks = await fetchTasks();
    allTasksCache = allTasks;
    buildFilterButtons(allTasks);
    let tasks = activeFilter === 'all' ? allTasks : allTasks.filter(t => t.project === activeFilter);
    if (searchQuery) tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(searchQuery) ||
        t.member.toLowerCase().includes(searchQuery) ||
        (t.project && t.project.toLowerCase().includes(searchQuery)) ||
        (t.description && t.description.toLowerCase().includes(searchQuery))
    );
    renderTaskTable(tasks, allTasks);
    todoContainer.innerHTML = progressContainer.innerHTML = doneContainer.innerHTML = '';
    let todo = 0, progress = 0, done = 0;
    tasks.forEach(task => {
        const el = createTaskElement(task);
        if (task.status === 'To Do')       { todoContainer.appendChild(el);     todo++; }
        if (task.status === 'In Progress') { progressContainer.appendChild(el); progress++; }
        if (task.status === 'Done')        { doneContainer.appendChild(el);     done++; }
    });
    if (!todo)     todoContainer.innerHTML     = emptyState();
    if (!progress) progressContainer.innerHTML = emptyState();
    if (!done)     doneContainer.innerHTML     = emptyState();
    todoCount.textContent     = todo;
    progressCount.textContent = progress;
    doneCount.textContent     = done;
}

function isOverdue(dueDate, status) {
    if (!dueDate || status === 'Done') return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
}

function formatDate(dueDate, status) {
    if (!dueDate) return '';
    const date    = new Date(dueDate);
    const overdue = isOverdue(dueDate, status);
    const label   = date.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    const color   = overdue ? 'var(--status-danger)' : 'var(--text-muted)';
    const icon    = overdue ? '⚠ ' : '📅 ';
    return `<span style="font-size:11px;color:${color}">${icon}${label}${overdue?' · Overdue':''}</span>`;
}

function priorityStyle(p) {
    if (p === 'High')   return 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:var(--status-danger)';
    if (p === 'Medium') return 'background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);color:var(--status-prog)';
    return 'background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);color:var(--status-done)';
}

function statusStyle(status) {
    if (status === 'Done') return 'background:rgba(16,185,129,0.16);border:1px solid rgba(16,185,129,0.28);color:#4ade80';
    if (status === 'In Progress') return 'background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.32);color:#fbbf24';
    return 'background:rgba(79,142,247,0.16);border:1px solid rgba(79,142,247,0.32);color:#65a3ff';
}

function renderTaskTable(tasks, allTasks) {
    if (!taskTableBody) return;
    if (!tasks.length) {
        taskTableBody.innerHTML = `<tr><td class="empty-row" colspan="7">No tasks match this view.</td></tr>`;
    } else {
        taskTableBody.innerHTML = tasks.map(createTaskRow).join('');
    }

    if (taskSummary) {
        const projectCount = new Set(allTasks.map(t => t.project).filter(Boolean)).size;
        const totalLabel = `${allTasks.length} total task${allTasks.length === 1 ? '' : 's'}`;
        taskSummary.textContent = `Showing ${tasks.length} task${tasks.length === 1 ? '' : 's'} of ${totalLabel} across ${projectCount} project${projectCount === 1 ? '' : 's'}`;
    }
}

function createTaskRow(task) {
    const ac = AVATAR_COLORS[memberColorIndex(task.member)];
    const initials = memberInitials(task.member || '?');
    const dueDate = formatTableDate(task.dueDate);
    const project = task.project || 'No project';

    return `
        <tr>
            <td><div class="table-task-title">${escapeHtml(task.title)}</div></td>
            <td><span class="pill status-pill" style="${statusStyle(task.status)}">${escapeHtml(statusLabel(task.status))}</span></td>
            <td><span class="pill priority-pill" style="${priorityStyle(task.priority)}">${escapeHtml(task.priority)}</span></td>
            <td>
                <div class="member-cell">
                    <span class="member-avatar" style="background:${ac.color};">${escapeHtml(initials)}</span>
                    <span>${escapeHtml(task.member)}</span>
                </div>
            </td>
            <td>${escapeHtml(project)}</td>
            <td><span class="table-date"><i class="fi fi-rr-calendar"></i>${dueDate}</span></td>
            <td>
                <div class="table-actions">
                    <button class="icon-action" onclick="editTask(${task.id})" title="Edit task"><i class="fi fi-rr-pencil"></i></button>
                    <button class="icon-action delete" onclick="askDeleteConfirmation(${task.id})" title="Delete task"><i class="fi fi-rr-trash"></i></button>
                </div>
            </td>
        </tr>`;
}

function statusLabel(status) {
    return status === 'In Progress' ? 'In progress' : status;
}

function formatTableDate(dueDate) {
    if (!dueDate) return 'No date';
    const date = new Date(dueDate);
    return date.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).replace(',', '');
}

function memberColorIndex(name) {
    name = String(name || '?');
    // Stable color based on name chars
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % AVATAR_COLORS.length;
}

function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = `task-card${isOverdue(task.dueDate, task.status) ? ' overdue-card' : ''}`;
    div.draggable = true;
    div.dataset.id = task.id;
    div.addEventListener('dragstart', e => onDragStart(e, task.id));
    div.addEventListener('dragend',   e => onDragEnd(e));

    const dateLine = formatDate(task.dueDate, task.status);
    const descBlock = task.description ? `<p style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-top:2px">${task.description}</p>` : '';

    const colorIdx = memberColorIndex(task.member);
    const ac = AVATAR_COLORS[colorIdx];
    const avatarStyle = `background:${ac.bg};border:1.5px solid ${ac.border};color:${ac.color}`;
    const initials = memberInitials(task.member);

    div.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <span style="${priorityStyle(task.priority)};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:3px 9px;border-radius:99px;flex-shrink:0">${task.priority}</span>
            <div style="display:flex;gap:4px;margin-left:auto">
                <button onclick="editTask(${task.id})" title="Edit" style="padding:5px 7px;border:1px solid var(--border-strong);border-radius:7px;cursor:pointer;background:none;color:var(--text-muted);font-size:13px;transition:all 0.18s;line-height:1" onmouseover="this.style.background='var(--bg-hover)';this.style.color='var(--brand)'" onmouseout="this.style.background='none';this.style.color='var(--text-muted)'">✏</button>
                <button onclick="askDeleteConfirmation(${task.id})" title="Delete" style="padding:5px 7px;border:1px solid var(--border-strong);border-radius:7px;cursor:pointer;background:none;color:var(--text-muted);font-size:13px;transition:all 0.18s;line-height:1" onmouseover="this.style.background='rgba(239,68,68,0.12)';this.style.color='var(--status-danger)'" onmouseout="this.style.background='none';this.style.color='var(--text-muted)'">🗑</button>
            </div>
        </div>
        <div>
            <h4 style="font-size:15px;font-weight:600;color:var(--text-main);line-height:1.35;margin-bottom:2px">${task.title}</h4>
            ${descBlock}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
            <div>${dateLine ? `<div>${dateLine}</div>` : ''}</div>
            <div class="avatar-wrap" style="position:relative">
                <span style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;cursor:default;${avatarStyle}">${initials}</span>
                <span class="avatar-tooltip">${task.member}</span>
            </div>
        </div>`;
    return div;
}

function emptyState() {
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;color:var(--text-muted)">
        <div style="width:44px;height:44px;border:2px dashed var(--border-strong);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;font-size:18px">·</div>
        <p style="font-size:14px">Empty</p>
    </div>`;
}

function escapeAttr(str) { return String(str ?? '').replace(/'/g, "\\'"); }
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}


// ─── Dashboard Render ─────────────────────────────────────────────────────────
async function renderDashboard() {
    let tasks;
    try { tasks = await fetchTasks(); allTasksCache = tasks; }
    catch { return; }

    const total    = tasks.length;
    const todoN    = tasks.filter(t => t.status === 'To Do').length;
    const progN    = tasks.filter(t => t.status === 'In Progress').length;
    const doneN    = tasks.filter(t => t.status === 'Done').length;
    const pct      = total ? Math.round((doneN / total) * 100) : 0;
    const overdue  = tasks.filter(t => isOverdue(t.dueDate, t.status));

    // ── Stat counters ──────────────────────────────────────
    animateCount('ds-total', total);
    animateCount('ds-todo',  todoN);
    animateCount('ds-prog',  progN);
    animateCount('ds-done',  doneN);

    // Progress bars
    setBar('ds-todo-bar', total ? (todoN / total) * 100 : 0);
    setBar('ds-prog-bar', total ? (progN / total) * 100 : 0);
    setBar('ds-done-bar', total ? (doneN / total) * 100 : 0);

    // ── Donut ──────────────────────────────────────────────
    const circumference = 2 * Math.PI * 54; // r=54 → ~339.3
    const filled = (pct / 100) * circumference;
    const donutFill = document.getElementById('donut-fill');
    if (donutFill) {
        setTimeout(() => { donutFill.setAttribute('stroke-dasharray', `${filled} ${circumference}`); }, 100);
    }
    const donutPct = document.getElementById('donut-pct');
    if (donutPct) animateCount('donut-pct', pct, '%');

    // ── Priority bar chart ──────────────────────────────────
    const high   = tasks.filter(t => t.priority === 'High').length;
    const medium = tasks.filter(t => t.priority === 'Medium').length;
    const low    = tasks.filter(t => t.priority === 'Low').length;
    const maxP   = Math.max(high, medium, low, 1);

    const priChart = document.getElementById('priority-chart');
    if (priChart) {
        priChart.innerHTML = '';
        const bars = [
            { label: 'High',   val: high,   color: 'var(--status-danger)' },
            { label: 'Medium', val: medium, color: 'var(--status-prog)'   },
            { label: 'Low',    val: low,    color: 'var(--status-done)'   },
        ];
        bars.forEach(b => {
            const col = document.createElement('div');
            col.className = 'bar-col';
            col.style.cssText = `background:${b.color};opacity:0.8;height:4px`;
            col.title = `${b.label}: ${b.val}`;
            priChart.appendChild(col);
            setTimeout(() => { col.style.height = `${(b.val / maxP) * 100}%`; }, 100);
        });
    }
    const priLegend = document.getElementById('priority-legend');
    if (priLegend) priLegend.innerHTML = [
        { label:'High', val:high, c:'var(--status-danger)' },
        { label:'Med',  val:medium, c:'var(--status-prog)' },
        { label:'Low',  val:low, c:'var(--status-done)' },
    ].map(b => `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${b.c};margin-right:4px"></span>${b.label}: ${b.val}</span>`).join('');

    // ── Member load ────────────────────────────────────────
    const memberLoad = document.getElementById('member-load');
    if (memberLoad) {
        const byMember = {};
        tasks.forEach(t => { byMember[t.member] = (byMember[t.member] || 0) + 1; });
        const maxLoad = Math.max(...Object.values(byMember), 1);
        memberLoad.innerHTML = Object.entries(byMember).sort((a,b) => b[1]-a[1]).map(([name, count]) => `
            <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                    <span style="font-size:13px;color:var(--text-main);font-weight:500">${name}</span>
                    <span style="font-size:12px;color:var(--text-muted)">${count} task${count!==1?'s':''}</span>
                </div>
                <div style="height:5px;border-radius:99px;background:var(--border-subtle);overflow:hidden">
                    <div style="height:100%;border-radius:99px;background:var(--brand);width:0%;transition:width 0.7s cubic-bezier(.22,1,.36,1)" data-target="${(count/maxLoad)*100}"></div>
                </div>
            </div>`).join('') || `<p style="font-size:13px;color:var(--text-muted)">No tasks yet</p>`;
        setTimeout(() => memberLoad.querySelectorAll('[data-target]').forEach(el => el.style.width = el.dataset.target + '%'), 100);
    }

    // ── Project breakdown ──────────────────────────────────
    const projectBreakdown = document.getElementById('project-breakdown');
    if (projectBreakdown) {
        const byProject = {};
        tasks.forEach(t => {
            const key = t.project || '(no project)';
            if (!byProject[key]) byProject[key] = { total:0, done:0 };
            byProject[key].total++;
            if (t.status === 'Done') byProject[key].done++;
        });
        projectBreakdown.innerHTML = Object.entries(byProject).sort((a,b) => b[1].total-a[1].total).map(([proj, data]) => {
            const pPct = Math.round((data.done / data.total) * 100);
            return `<div>
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                    <span style="font-size:13px;color:var(--text-main);font-weight:500">${proj}</span>
                    <span style="font-size:12px;color:var(--text-muted)">${data.done}/${data.total} · ${pPct}%</span>
                </div>
                <div style="height:5px;border-radius:99px;background:var(--border-subtle);overflow:hidden">
                    <div style="height:100%;border-radius:99px;background:var(--status-done);width:0%;transition:width 0.7s cubic-bezier(.22,1,.36,1)" data-target="${pPct}"></div>
                </div>
            </div>`;
        }).join('') || `<p style="font-size:13px;color:var(--text-muted)">No projects yet</p>`;
        setTimeout(() => projectBreakdown.querySelectorAll('[data-target]').forEach(el => el.style.width = el.dataset.target + '%'), 100);
    }

    // ── Overdue ────────────────────────────────────────────
    const overdueList = document.getElementById('overdue-list');
    if (overdueList) {
        overdueList.innerHTML = overdue.length === 0
            ? `<p style="font-size:13px;color:var(--status-done)">✓ No overdue tasks</p>`
            : overdue.map(t => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:10px">
                    <div>
                        <div style="font-size:13px;font-weight:500;color:var(--text-main)">${t.title}</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${t.member} · ${t.project||'—'}</div>
                    </div>
                    <span style="font-size:11px;color:var(--status-danger)">⚠ ${new Date(t.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                </div>`).join('');
    }

    // ── Recent activity ────────────────────────────────────
    const recentList = document.getElementById('recent-list');
    if (recentList) {
        const sorted = [...tasks].sort((a,b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt)).slice(0, 5);
        const statusColors = { 'To Do':'var(--status-todo)', 'In Progress':'var(--status-prog)', 'Done':'var(--status-done)' };
        recentList.innerHTML = sorted.map(t => `
            <div style="display:flex;align-items:flex-start;gap:10px">
                <div style="width:8px;height:8px;border-radius:50%;background:${statusColors[t.status]||'var(--text-muted)'};flex-shrink:0;margin-top:4px"></div>
                <div style="flex:1">
                    <div style="font-size:13px;color:var(--text-main);font-weight:500">${t.title}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${t.member} · <span style="color:${statusColors[t.status]}">${t.status}</span> · ${relativeTime(t.updatedAt||t.createdAt)}</div>
                </div>
            </div>`).join('') || `<p style="font-size:13px;color:var(--text-muted)">No activity yet</p>`;
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function animateCount(id, target, suffix = '') {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const dur   = 600;
    const t0    = performance.now();
    function step(now) {
        const p = Math.min((now - t0) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(start + (target - start) * e) + suffix;
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function setBar(id, pct) {
    const el = document.getElementById(id);
    if (el) setTimeout(() => el.style.width = pct + '%', 100);
}

function relativeTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}


// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    setBoardMode(boardMode);
    showLoadingSkeleton();
    try {
        await renderMembersPanel();
        await renderProjectsPanel();
        await renderDashboard();
        await renderTasks();
    } catch (err) {
        showError('Failed to load data. Is the server running?');
    }
}

// ─── Admin Settings ───────────────────────────────────────────────────────────

function openSettingsView() {
    switchView('settings');
    if (currentUser?.role === 'admin') {
        document.getElementById('settings-locked').style.display  = 'none';
        document.getElementById('settings-content').style.display = 'block';
        // Pre-fill my account fields
        const nameEl  = document.getElementById('settings-name');
        const emailEl = document.getElementById('settings-email');
        if (nameEl)  nameEl.value  = currentUser.name  || '';
        if (emailEl) emailEl.value = currentUser.email || '';
        renderUsersTable();
    } else {
        document.getElementById('settings-locked').style.display  = 'flex';
        document.getElementById('settings-content').style.display = 'none';
    }
}

async function renderUsersTable() {
    const table = document.getElementById('users-table');
    const badge = document.getElementById('users-count-badge');
    if (!table) return;
    table.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:12px 0">Loading…</div>`;
    try {
        const data = await apiFetch(`${API}/admin/users`);
        const users = data.users || [];
        if (badge) badge.textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
        if (!users.length) { table.innerHTML = `<p style="color:var(--text-muted);font-size:13px">No users found.</p>`; return; }

        table.innerHTML = '';
        // Header row
        table.innerHTML = `
            <div style="display:grid;grid-template-columns:2fr 2fr 100px 100px auto;gap:12px;padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-muted)">
                <span>Name</span><span>Email</span><span>Role</span><span>Joined</span><span></span>
            </div>`;

        users.forEach(u => {
            const isSelf    = u.id === currentUser.id;
            const isAdmin   = u.role === 'admin';
            const initials  = u.name.trim().split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
            const joinDate  = new Date(u.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
            const row = document.createElement('div');
            row.style.cssText = 'display:grid;grid-template-columns:2fr 2fr 100px 100px auto;gap:12px;align-items:center;padding:12px 14px;background:var(--bg-element);border:1px solid var(--border-strong);border-radius:12px';
            row.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;min-width:0">
                    <div style="width:32px;height:32px;border-radius:50%;background:${isSelf ? 'var(--brand-dim)' : 'var(--border-strong)'};border:1px solid ${isSelf ? 'rgba(108,143,255,0.3)' : 'transparent'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${isSelf ? 'var(--brand)' : 'var(--text-light)'};flex-shrink:0">${initials}</div>
                    <div style="min-width:0">
                        <div style="font-size:13px;font-weight:600;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.name}${isSelf ? ' <span style="font-size:10px;color:var(--brand)">(you)</span>' : ''}</div>
                    </div>
                </div>
                <div style="font-size:13px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.email}</div>
                <div>
                    <select onchange="changeUserRole(${u.id}, this.value)" ${isSelf ? 'disabled' : ''}
                        style="background:${isAdmin ? 'var(--brand-dim)' : 'var(--bg-hover)'};border:1px solid ${isAdmin ? 'rgba(108,143,255,0.3)' : 'var(--border-strong)'};color:${isAdmin ? 'var(--brand)' : 'var(--text-muted)'};border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;cursor:${isSelf ? 'not-allowed' : 'pointer'};appearance:none;width:100%">
                        <option value="member" ${u.role === 'member' ? 'selected' : ''}>Member</option>
                        <option value="admin"  ${u.role === 'admin'  ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <div style="font-size:12px;color:var(--text-muted)">${joinDate}</div>
                <button onclick="adminDeleteUser(${u.id})" ${isSelf ? 'disabled' : ''}
                    style="background:none;border:none;color:${isSelf ? 'var(--border-strong)' : 'var(--text-muted)'};font-size:16px;cursor:${isSelf ? 'not-allowed' : 'pointer'};padding:4px 8px;border-radius:6px;transition:all 0.18s"
                    onmouseover="if(!this.disabled)this.style.background='rgba(239,68,68,0.12)';if(!this.disabled)this.style.color='var(--status-danger)'"
                    onmouseout="this.style.background='none';this.style.color='${isSelf ? 'var(--border-strong)' : 'var(--text-muted)'}'">✕</button>`;
            table.appendChild(row);
        });
    } catch (e) {
        table.innerHTML = `<p style="color:var(--status-danger);font-size:13px">Failed to load users.</p>`;
    }
}

async function changeUserRole(userId, newRole) {
    try {
        const res = await apiFetch(`${API}/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
        if (!res.success) showError(res.message || 'Failed to change role');
        else renderUsersTable();
    } catch { showError('Failed to change role'); }
}

async function adminDeleteUser(userId) {
    showDangerModal(
        '🗑', 'Delete User?', 'This will permanently remove their account. Tasks they created will remain.',
        async () => {
            const res = await apiFetch(`${API}/admin/users/${userId}`, { method: 'DELETE' });
            if (!res.success) showError(res.message || 'Failed to delete user');
            else renderUsersTable();
        }
    );
}

async function adminAddUser() {
    const name  = (document.getElementById('add-user-name')?.value  || '').trim();
    const email = (document.getElementById('add-user-email')?.value || '').trim();
    const pwd   = (document.getElementById('add-user-pwd')?.value   || '').trim();
    const msg   = document.getElementById('add-user-msg');

    const show = (text, ok) => {
        if (!msg) return;
        msg.textContent = text;
        msg.style.color = ok ? 'var(--status-done)' : 'var(--status-danger)';
        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 4000);
    };

    if (!name || !email || !pwd) { show('All three fields are required.', false); return; }
    if (pwd.length < 6)          { show('Password must be at least 6 characters.', false); return; }

    try {
        const res = await apiFetch(`${API}/admin/users`, { method: 'POST', body: JSON.stringify({ name, email, password: pwd }) });
        if (res.success) {
            show(`✓ User "${name}" added successfully.`, true);
            document.getElementById('add-user-name').value  = '';
            document.getElementById('add-user-email').value = '';
            document.getElementById('add-user-pwd').value   = '';
            renderUsersTable();
        } else {
            show(res.message || 'Failed to add user.', false);
        }
    } catch { show('Server error. Is it running?', false); }
}

async function saveMyAccount() {
    const name   = (document.getElementById('settings-name')?.value   || '').trim();
    const email  = (document.getElementById('settings-email')?.value  || '').trim();
    const newpwd = (document.getElementById('settings-newpwd')?.value || '');
    const curpwd = (document.getElementById('settings-curpwd')?.value || '');
    const msg    = document.getElementById('settings-account-msg');

    const show = (text, ok) => {
        if (!msg) return;
        msg.textContent = text;
        msg.style.color = ok ? 'var(--status-done)' : 'var(--status-danger)';
        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 4000);
    };

    if (!name || !email)  { show('Name and email are required.', false); return; }
    if (!curpwd)          { show('Enter your current password to save.', false); return; }

    try {
        const res = await apiFetch(`${API}/account`, {
            method: 'PUT',
            body: JSON.stringify({ name, email, currentPassword: curpwd, newPassword: newpwd || undefined })
        });
        if (res.success) {
            currentUser.name  = res.user.name;
            currentUser.email = res.user.email;
            updateUserUI();
            document.getElementById('settings-curpwd').value = '';
            document.getElementById('settings-newpwd').value = '';
            show('✓ Account updated successfully.', true);
        } else {
            show(res.message || 'Failed to update account.', false);
        }
    } catch { show('Server error.', false); }
}

function adminClearTasks() {
    showDangerModal('🗑', 'Clear All Tasks?', 'Every task in the workspace will be permanently deleted. This cannot be undone.', async () => {
        const res = await apiFetch(`${API}/admin/clear-tasks`, { method: 'DELETE' });
        if (res.success) { showError('✓ All tasks cleared.'); await renderDashboard(); await renderTasks(); }
        else showError(res.message || 'Failed to clear tasks.');
    });
}

function adminResetWorkspace() {
    showDangerModal('💥', 'Reset Workspace?', 'All tasks, members and projects will be permanently deleted. User accounts will be kept.', async () => {
        const res = await apiFetch(`${API}/admin/reset`, { method: 'DELETE' });
        if (res.success) { showError('✓ Workspace reset.'); await init(); }
        else showError(res.message || 'Failed to reset workspace.');
    });
}

// ─── Danger Modal (generic) ───────────────────────────────────────────────────
let _dangerCallback = null;
function showDangerModal(icon, title, desc, onConfirm) {
    document.getElementById('danger-icon').textContent  = icon;
    document.getElementById('danger-title').textContent = title;
    document.getElementById('danger-desc').textContent  = desc;
    _dangerCallback = onConfirm;
    document.getElementById('danger-modal').classList.remove('hidden');
}
function closeDangerModal() {
    document.getElementById('danger-modal').classList.add('hidden');
    _dangerCallback = null;
}
document.getElementById('danger-confirm-btn').addEventListener('click', async () => {
    if (_dangerCallback) { const cb = _dangerCallback; closeDangerModal(); await cb(); }
});
document.getElementById('danger-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('danger-modal')) closeDangerModal();
});

checkAuth();
// ─── Account Settings Modal ───────────────────────────────────────────────────

function openAccountModal() {
    const modal = document.getElementById('account-modal');
    if (!modal || !currentUser) return;
    modal.classList.remove('hidden');

    // Fill header
    const initials = currentUser.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const bigAv = document.getElementById('acct-avatar-big');
    if (bigAv) bigAv.textContent = initials;
    const headerName = document.getElementById('acct-header-name');
    if (headerName) headerName.textContent = currentUser.name;
    const headerRole = document.getElementById('acct-header-role');
    if (headerRole) headerRole.textContent = currentUser.role === 'admin' ? '⭐ Admin' : 'Member';

    // Fill profile tab
    const nameEl  = document.getElementById('acct-name');
    const emailEl = document.getElementById('acct-email');
    if (nameEl)  nameEl.value  = currentUser.name  || '';
    if (emailEl) emailEl.value = currentUser.email || '';

    // Fill info card
    const roleEl   = document.getElementById('acct-info-role');
    const joinedEl = document.getElementById('acct-info-joined');
    if (roleEl)   roleEl.textContent   = currentUser.role === 'admin' ? 'Admin' : 'Member';
    if (joinedEl) joinedEl.textContent = currentUser.createdAt
        ? new Date(currentUser.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '—';

    // Sync preferences toggles
    const themeChk = document.getElementById('acct-theme-check');
    if (themeChk) themeChk.checked = (localStorage.getItem('tf-theme') || 'dark') === 'dark';
    const sidebarChk = document.getElementById('acct-sidebar-check');
    if (sidebarChk) sidebarChk.checked = localStorage.getItem('tf-sidebar') === 'collapsed';

    // Reset to profile tab
    switchAccountTab('profile');
    clearAccountMsgs();
}

function closeAccountModal() {
    const modal = document.getElementById('account-modal');
    if (modal) modal.classList.add('hidden');
    clearAccountMsgs();
}

// Close on backdrop click
document.addEventListener('click', e => {
    const modal = document.getElementById('account-modal');
    if (modal && e.target === modal) closeAccountModal();
});

// Close on Escape key
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAccountModal();
});

function clearAccountMsgs() {
    ['acct-profile-msg', 'acct-security-msg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    // Clear password fields
    ['acct-cur-pwd', 'acct-new-pwd', 'acct-confirm-pwd'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    // Reset strength meter
    updateStrength('');
}

function switchAccountTab(tab) {
    const tabs   = ['profile', 'security', 'preferences'];
    tabs.forEach(t => {
        const panel = document.getElementById(`acct-panel-${t}`);
        const btn   = document.getElementById(`acct-tab-${t}`);
        if (panel) panel.style.display = t === tab ? 'block' : 'none';
        if (btn) {
            btn.style.borderBottomColor = t === tab ? 'var(--brand)' : 'transparent';
            btn.style.color             = t === tab ? 'var(--brand)' : 'var(--text-muted)';
        }
    });
}

function showAccountMsg(panelId, text, ok) {
    const el = document.getElementById(panelId);
    if (!el) return;
    el.textContent       = text;
    el.style.display     = 'block';
    el.style.color       = ok ? 'var(--status-done)'   : 'var(--status-danger)';
    el.style.background  = ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';
    el.style.border      = `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`;
    if (ok) setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── Save Profile ──────────────────────────────────────────────
async function saveProfile() {
    const name  = (document.getElementById('acct-name')?.value  || '').trim();
    const email = (document.getElementById('acct-email')?.value || '').trim();

    if (!name)  { showAccountMsg('acct-profile-msg', 'الاسم مطلوب.', false); return; }
    if (!email) { showAccountMsg('acct-profile-msg', 'البريد الإلكتروني مطلوب.', false); return; }

    try {
        const res = await apiFetch(`${API}/account/profile`, {
            method: 'PUT',
            body: JSON.stringify({ name, email })
        });
        if (res.success) {
            currentUser.name  = res.user.name;
            currentUser.email = res.user.email;
            updateUserUI();
            // Update modal header live
            const headerName = document.getElementById('acct-header-name');
            if (headerName) headerName.textContent = res.user.name;
            const bigAv = document.getElementById('acct-avatar-big');
            if (bigAv) bigAv.textContent = res.user.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            showAccountMsg('acct-profile-msg', ' Profile saved successfully.', true);
        } else {
            showAccountMsg('acct-profile-msg', res.message || 'Update failed.', false);
        }
    } catch {
        showAccountMsg('acct-profile-msg', 'Server connection error.', false);
    }
}

// ── Save Password ─────────────────────────────────────────────
async function savePassword() {
    const curPwd     = document.getElementById('acct-cur-pwd')?.value     || '';
    const newPwd     = document.getElementById('acct-new-pwd')?.value     || '';
    const confirmPwd = document.getElementById('acct-confirm-pwd')?.value || '';

    if (!curPwd)              { showAccountMsg('acct-security-msg', 'Enter your current password.', false); return; }
    if (newPwd.length < 6)   { showAccountMsg('acct-security-msg', 'The new password must be at least 6 characters long.', false); return; }
    if (newPwd !== confirmPwd){ showAccountMsg('acct-security-msg', 'The new password does not match.', false); return; }

    try {
        const res = await apiFetch(`${API}/account/password`, {
            method: 'PUT',
            body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd })
        });
        if (res.success) {
            document.getElementById('acct-cur-pwd').value     = '';
            document.getElementById('acct-new-pwd').value     = '';
            document.getElementById('acct-confirm-pwd').value = '';
            updateStrength('');
            showAccountMsg('acct-security-msg', '✓ Password changed successfully.', true);
        } else {
            showAccountMsg('acct-security-msg', res.message || 'Password change failed.', false);
        }
    } catch {
        showAccountMsg('acct-security-msg', 'Server connection error.', false);
    }
}

// ── Sidebar preference ────────────────────────────────────────
function setPrefSidebar(collapsed) {
    const sidebar = document.getElementById('sidebar');
    if (collapsed) {
        sidebar.classList.add('collapsed');
        localStorage.setItem('tf-sidebar', 'collapsed');
    } else {
        sidebar.classList.remove('collapsed');
        localStorage.setItem('tf-sidebar', 'expanded');
    }
}