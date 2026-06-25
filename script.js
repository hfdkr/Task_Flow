// ─── API Base URL ─────────────────────────────────────────────────────────────
const API = 'http://localhost:3000/api';

// ─── State ────────────────────────────────────────────────────────────────────
let editingTaskId = null;
let activeFilter = 'all';
let searchQuery = '';
let pendingDeleteId = null;
let allTasksCache = [];
let boardMode = 'list';

// ─── Mobile Menu ──────────────────────────────────────────────────────────────
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('hamburger-btn');
    const isOpen = menu.classList.toggle('open');
    const lines = btn.querySelectorAll('.ham-line');
    if (isOpen) {
        lines[0].style.transform = 'translateY(7px) rotate(45deg)';
        lines[1].style.opacity = '0';
        lines[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
        lines[0].style.transform = '';
        lines[1].style.opacity = '';
        lines[2].style.transform = '';
    }
}

function closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('hamburger-btn');
    menu.classList.remove('open');
    const lines = btn ? btn.querySelectorAll('.ham-line') : [];
    lines.forEach(l => { l.style.transform = ''; l.style.opacity = ''; });
}

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
    if (saved === 'collapsed') document.getElementById('sidebar').classList.add('collapsed');
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
    ['theme-check', 'theme-check-mobile', 'acct-theme-check'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = isDark;
    });
}

function updateThemeLabel(theme) {
    const labelEl = document.querySelector('#sidebar nav ~ div span:first-child');
    if (labelEl) {
        labelEl.innerHTML = theme === 'dark'
            ? `<span class="theme-label flex items-center gap-2"><img class="theme-icon h-[12px] w-[12px]" src="./assets/Icon (5).png" alt="Dark Mode"> Dark mode</span>`
            : `<span class="theme-label flex items-center gap-2"><img class="theme-icon h-[12px] w-[12px]" src="./assets/Icon.svg" alt="Light Mode"> Light mode</span>`;
    }
}

// ─── View Switching ───────────────────────────────────────────────────────────
function switchView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-' + name).classList.add('active');
    const desktopNav = document.querySelector(`[data-view="${name}"]`);
    if (desktopNav) desktopNav.classList.add('active');
    document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
    const mobileNav = document.getElementById('mob-nav-' + name);
    if (mobileNav) mobileNav.classList.add('active');
    const titles = { dashboard: 'Dashboard', kanban: 'Kanban Board', settings: 'Settings' };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[name] || name;
    if (name === 'dashboard') renderDashboard();
    if (name === 'kanban') renderTasks();
    if (name === 'settings') openSettingsView();
}

// ─── DOM References ───────────────────────────────────────────────────────────
const loginScreen      = document.getElementById('login-screen');
const appEl            = document.getElementById('app');
const titleInput       = document.getElementById('title-input');
const memberSelect     = document.getElementById('member-select');
const projectSelect    = document.getElementById('project-select');
const dueDateInput     = document.getElementById('due-date-input');
const statusSelect     = document.getElementById('status-select');
const prioritySelect   = document.getElementById('priority-select');
const descInput        = document.getElementById('desc-input');
const searchInput      = document.getElementById('search-input');
const todoContainer    = document.getElementById('todo-container');
const progressContainer = document.getElementById('inprogress-container');
const doneContainer    = document.getElementById('done-container');
const todoCount        = document.getElementById('todo-count');
const progressCount    = document.getElementById('inprogress-count');
const doneCount        = document.getElementById('done-count');
const taskTableBody    = document.getElementById('task-table-body');
const taskSummary      = document.getElementById('task-summary');
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

// ─── isAdmin helper ───────────────────────────────────────────────────────────
function isAdmin() { return currentUser?.role === 'admin'; }

// ─── Auth Tab Switcher ────────────────────────────────────────────────────────
function switchAuthTab(tab) {
    const isSignin = tab === 'signin';
    document.getElementById('form-signin').style.display = isSignin ? 'block' : 'none';
    document.getElementById('form-signup').style.display = isSignin ? 'none' : 'block';
    document.getElementById('tab-signin').style.background = isSignin ? 'var(--brand)' : 'transparent';
    document.getElementById('tab-signin').style.color = isSignin ? 'white' : 'var(--text-muted)';
    document.getElementById('tab-signup').style.background = isSignin ? 'transparent' : 'var(--brand)';
    document.getElementById('tab-signup').style.color = isSignin ? 'var(--text-muted)' : 'white';
    document.getElementById('auth-subtitle').textContent = isSignin ? 'Welcome back — sign in to continue' : 'Create your free account to get started';
    setAuthError('signin', ''); setAuthError('signup', '');
}

function setAuthError(form, msg) {
    const el = document.getElementById(`${form}-error`);
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
    if (msg && !msg.startsWith('✓')) {
        el.style.color = 'var(--status-danger)';
        el.style.background = 'rgba(239,68,68,0.08)';
        el.style.border = '1px solid rgba(239,68,68,0.2)';
    }
}

function setAuthLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.65' : '1';
    btn.style.cursor = loading ? 'not-allowed' : 'pointer';
}

function togglePwd(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    btn.innerHTML = isHidden ? '<i class="fi fi-rr-eye-crossed"></i>' : '<i class="fi fi-rr-eye"></i>';
}

function updateStrength(val) {
    const bars = document.querySelectorAll('.strength-bar');
    const label = document.getElementById('strength-label');
    if (!bars.length || !label) return;
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const colors = ['', '#ef4444', '#f59e0b', '#6c8fff', '#10b981'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong 💪'];
    bars.forEach((b, i) => { b.style.background = i < score ? (colors[score] || 'var(--border-strong)') : 'var(--border-strong)'; });
    label.textContent = val.length ? labels[score] : '';
    label.style.color = colors[score] || 'var(--text-muted)';
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
let currentUser = null;

async function checkAuth() {
    initTheme();
    try {
        const res = await fetch(`${API}/me`, { credentials: 'include' });
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
    const av = document.getElementById('user-avatar');
    if (av) av.textContent = initials;
    const avM = document.getElementById('user-avatar-mini');
    if (avM) avM.textContent = initials;
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = currentUser.name;
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = currentUser.email;
    const badge = document.getElementById('user-role-badge');
    if (badge) badge.style.display = isAdmin() ? 'block' : 'none';
    const navSettings    = document.getElementById('nav-settings');
    const mobNavSettings = document.getElementById('mob-nav-settings');
    if (isAdmin()) {
        if (navSettings) navSettings.style.display = 'flex';
        if (mobNavSettings) mobNavSettings.style.display = 'flex';
    } else {
        if (navSettings) navSettings.style.display = 'none';
        if (mobNavSettings) mobNavSettings.style.display = 'none';
    }
}

document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (!loginScreen.classList.contains('hidden')) {
        const signinForm = document.getElementById('form-signin');
        if (signinForm && signinForm.style.display !== 'none') handleSignIn();
        else handleSignUp();
    }
});

async function handleSignIn() {
    const email    = (document.getElementById('signin-email')?.value || '').trim();
    const password = (document.getElementById('signin-password')?.value || '');
    setAuthError('signin', '');
    if (!email || !password) { setAuthError('signin', 'Please enter your email and password.'); return; }
    setAuthLoading('signin-btn', true);
    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) { currentUser = data.user; showApp(); }
        else setAuthError('signin', data.message || 'Invalid credentials.');
    } catch { setAuthError('signin', 'Cannot reach server. Is it running?'); }
    finally { setAuthLoading('signin-btn', false); }
}

async function handleSignUp() {
    const name     = (document.getElementById('signup-name')?.value || '').trim();
    const email    = (document.getElementById('signup-email')?.value || '').trim();
    const password = (document.getElementById('signup-password')?.value || '');
    const sq       = (document.getElementById('signup-sq')?.value || '').trim();
    const sa       = (document.getElementById('signup-sa')?.value || '').trim();
    setAuthError('signup', '');
    if (!name)              { setAuthError('signup', 'Please enter your name.'); return; }
    if (!email)             { setAuthError('signup', 'Please enter your email.'); return; }
    if (password.length < 6){ setAuthError('signup', 'Password must be at least 6 characters.'); return; }
    if (!sq)                { setAuthError('signup', 'Please choose a security question.'); return; }
    if (!sa)                { setAuthError('signup', 'Please answer your security question.'); return; }
    setAuthLoading('signup-btn', true);
    try {
        const res = await fetch(`${API}/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, password, securityQuestion: sq, securityAnswer: sa })
        });
        const data = await res.json();
        if (data.success) { currentUser = data.user; showApp(); }
        else setAuthError('signup', data.message || 'Registration failed.');
    } catch { setAuthError('signup', 'Cannot reach server. Is it running?'); }
    finally { setAuthLoading('signup-btn', false); }
}

async function logout() {
    await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
    currentUser = null;
    showLogin();
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
let _resetToken = null;

function openForgotPassword() {
    _resetToken = null;
    document.getElementById('forgot-step1').style.display = 'block';
    document.getElementById('forgot-step2').style.display = 'none';
    document.getElementById('forgot-question-block').style.display = 'none';
    document.getElementById('forgot-email').value = '';
    document.getElementById('forgot-answer').value = '';
    document.getElementById('forgot-error').style.display = 'none';
    const newpwd = document.getElementById('forgot-newpwd');
    const confirmpwd = document.getElementById('forgot-confirmpwd');
    if (newpwd) newpwd.value = '';
    if (confirmpwd) confirmpwd.value = '';
    const resetErr = document.getElementById('forgot-reset-error');
    if (resetErr) resetErr.style.display = 'none';
    updateStrength('');
    document.getElementById('forgot-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('forgot-email')?.focus(), 80);
}

function closeForgotPassword() {
    document.getElementById('forgot-modal').classList.add('hidden');
    _resetToken = null;
}

document.addEventListener('click', e => {
    const modal = document.getElementById('forgot-modal');
    if (modal && e.target === modal) closeForgotPassword();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeForgotPassword(); closeTaskModal(); closeAccountModal(); }
});

function setForgotLoading(btnId, loading, originalText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.65' : '1';
    btn.style.cursor = loading ? 'not-allowed' : 'pointer';
    if (loading) btn.textContent = 'Please wait...';
    else if (originalText) btn.textContent = originalText;
}

async function loadSecurityQuestion() {
    const email = (document.getElementById('forgot-email')?.value || '').trim();
    const errEl = document.getElementById('forgot-error');
    errEl.style.display = 'none';
    if (!email) { errEl.textContent = 'Please enter your email address.'; errEl.style.display = 'block'; return; }
    setForgotLoading('forgot-find-btn', true, 'Find →');
    try {
        const res  = await fetch(`${API}/forgot-password/question?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (!data.success) { errEl.textContent = data.message || 'No account found with that email.'; errEl.style.display = 'block'; return; }
        document.getElementById('forgot-question-text').textContent = data.question;
        document.getElementById('forgot-question-block').style.display = 'block';
        const block = document.getElementById('forgot-question-block');
        block.style.opacity = '0'; block.style.transform = 'translateY(8px)'; block.style.transition = 'opacity 0.25s, transform 0.25s';
        setTimeout(() => { block.style.opacity = '1'; block.style.transform = 'translateY(0)'; }, 20);
        setTimeout(() => document.getElementById('forgot-answer')?.focus(), 150);
    } catch { errEl.textContent = 'Server error. Is the server running?'; errEl.style.display = 'block'; }
    finally { setForgotLoading('forgot-find-btn', false, 'Find →'); }
}

async function verifySecurityAnswer() {
    const email  = (document.getElementById('forgot-email')?.value || '').trim();
    const answer = (document.getElementById('forgot-answer')?.value || '').trim();
    const errEl  = document.getElementById('forgot-error');
    errEl.style.display = 'none';
    if (!answer) { errEl.textContent = 'Please enter your answer.'; errEl.style.display = 'block'; return; }
    setForgotLoading('forgot-verify-btn', true, 'Verify Answer →');
    try {
        const res  = await fetch(`${API}/forgot-password/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, answer }) });
        const data = await res.json();
        if (!data.success) {
            errEl.textContent = data.message || 'Incorrect answer. Please try again.'; errEl.style.display = 'block';
            const inp = document.getElementById('forgot-answer');
            if (inp) { inp.style.borderColor = 'var(--status-danger)'; setTimeout(() => inp.style.borderColor = '', 1500); }
            return;
        }
        _resetToken = data.token;
        const step1 = document.getElementById('forgot-step1');
        const step2 = document.getElementById('forgot-step2');
        step1.style.transition = 'opacity 0.2s'; step1.style.opacity = '0';
        setTimeout(() => {
            step1.style.display = 'none'; step2.style.display = 'block'; step2.style.opacity = '0'; step2.style.transition = 'opacity 0.25s';
            setTimeout(() => { step2.style.opacity = '1'; }, 20);
            setTimeout(() => document.getElementById('forgot-newpwd')?.focus(), 150);
        }, 200);
    } catch { errEl.textContent = 'Server error. Please try again.'; errEl.style.display = 'block'; }
    finally { setForgotLoading('forgot-verify-btn', false, 'Verify Answer →'); }
}

async function submitNewPassword() {
    const newPwd     = document.getElementById('forgot-newpwd')?.value || '';
    const confirmPwd = document.getElementById('forgot-confirmpwd')?.value || '';
    const errEl      = document.getElementById('forgot-reset-error');
    errEl.style.display = 'none';
    if (newPwd.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; return; }
    if (newPwd !== confirmPwd) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; return; }
    try {
        const res  = await fetch(`${API}/forgot-password/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: _resetToken, newPassword: newPwd }) });
        const data = await res.json();
        if (!data.success) { errEl.textContent = data.message || 'Reset failed. Please start over.'; errEl.style.display = 'block'; return; }
        closeForgotPassword();
        const signinErr = document.getElementById('signin-error');
        if (signinErr) {
            signinErr.textContent = '✓ Password reset successfully! Sign in with your new password.';
            signinErr.style.color = 'var(--status-done)'; signinErr.style.background = 'rgba(16,185,129,0.08)';
            signinErr.style.border = '1px solid rgba(16,185,129,0.2)'; signinErr.style.display = 'block';
            setTimeout(() => { signinErr.style.display = 'none'; }, 6000);
        }
        switchAuthTab('signin'); updateStrength('');
    } catch { errEl.textContent = 'Server error. Please try again.'; errEl.style.display = 'block'; }
}

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options, credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    if (res.status === 401) { showLogin(); throw new Error('Session expired'); }
    return res.json();
}

async function fetchTasks()   { return (await apiFetch(`${API}/tasks`)).tasks; }
async function fetchMembers() { return (await apiFetch(`${API}/members`)).members; }
async function createTask(task)   { return apiFetch(`${API}/tasks`,       { method: 'POST',   body: JSON.stringify(task) }); }
async function updateTask(id, c)  { return apiFetch(`${API}/tasks/${id}`, { method: 'PUT',    body: JSON.stringify(c) }); }
async function removeTask(id)     { return apiFetch(`${API}/tasks/${id}`, { method: 'DELETE' }); }
async function createMember(name) { return apiFetch(`${API}/members`,       { method: 'POST',   body: JSON.stringify({ name }) }); }
async function removeMember(id)   { return apiFetch(`${API}/members/${id}`, { method: 'DELETE' }); }
async function fetchProjects()    { return (await apiFetch(`${API}/projects`)).projects; }
async function createProject(name){ return apiFetch(`${API}/projects`,       { method: 'POST',   body: JSON.stringify({ name }) }); }
async function removeProject(id)  { return apiFetch(`${API}/projects/${id}`, { method: 'DELETE' }); }

async function fetchAllUsers() {
    try { const data = await apiFetch(`${API}/admin/users`); return data.users || []; }
    catch { return []; }
}

// ─── Members Panel ────────────────────────────────────────────────────────────
function openMembersPanel() { if (membersPanel) membersPanel.classList.remove('hidden'); }
function closeMembersPanel() { if (membersPanel) membersPanel.classList.add('hidden'); }
if (membersPanel) membersPanel.addEventListener('click', e => { if (e.target === membersPanel) closeMembersPanel(); });
if (newMemberInput) newMemberInput.addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });

const AVATAR_COLORS = [
    { bg: 'rgba(108,143,255,0.18)', border: 'rgba(108,143,255,0.35)', color: '#6c8fff' },
    { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.3)',    color: '#ef6060' },
    { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)',   color: '#f59e0b' },
    { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.3)',   color: '#10b981' },
    { bg: 'rgba(168,85,247,0.15)',  border: 'rgba(168,85,247,0.3)',   color: '#a855f7' },
    { bg: 'rgba(236,72,153,0.15)',  border: 'rgba(236,72,153,0.3)',   color: '#ec4899' },
];

function memberAvatarStyle(idx) {
    const c = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    return `background:${c.bg};border:1.5px solid ${c.border};color:${c.color}`;
}

function memberInitials(name) {
    return String(name || '?').trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

async function renderMembersPanel() {
    const [members, users] = await Promise.all([fetchMembers(), fetchAllUsers()]);

    memberSelect.innerHTML = '<option value="">Assign to...</option>';
    const modalMemberSelect = document.getElementById('modal-member-select');
    if (modalMemberSelect) modalMemberSelect.innerHTML = '<option value="">Assign to...</option>';

    members.forEach(m => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = m.name;
        memberSelect.appendChild(opt);
        if (modalMemberSelect) {
            const opt2 = document.createElement('option');
            opt2.value = opt2.textContent = m.name;
            modalMemberSelect.appendChild(opt2);
        }
    });

    // ── Show/hide Add input for admin only ──
    const addMemberRow = document.getElementById('add-member-row');
    if (addMemberRow) addMemberRow.style.display = isAdmin() ? 'flex' : 'none';

    membersList.innerHTML = '';
    if (!members.length) {
        membersList.innerHTML = `<p style="font-size:13px;color:var(--text-muted)">No members yet.</p>`;
        return;
    }

    members.forEach((m, idx) => {
        const matchedUser = users.find(u => u.name.toLowerCase().trim() === m.name.toLowerCase().trim());
        const memberIsAdmin = matchedUser ? matchedUser.role === 'admin' : false;
        const avatarStyle = memberAvatarStyle(idx);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:var(--bg-element);border:1px solid var(--border-strong);border-radius:12px;padding:12px 16px;transition:border-color 0.18s';
        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px">
                <span style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;${avatarStyle}">${memberInitials(m.name)}</span>
                <div>
                    <div style="font-size:14px;font-weight:600;color:var(--text-main)">${m.name}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:1px">
                        ${memberIsAdmin ? `<span class="flex items-center gap-1" style="color:var(--brand);font-weight:600"><img class="w-[14px] h-[14px]" src="./assets/Icon (2).png" alt="Admin"> Admin</span>` : `Member`}
                    </div>
                </div>
            </div>
            ${isAdmin() ? `<button onclick="deleteMember(${m.id})" style="color:var(--text-muted);font-size:15px;cursor:pointer;background:none;border:none;transition:color 0.18s;padding:4px" onmouseover="this.style.color='var(--status-danger)'" onmouseout="this.style.color='var(--text-muted)'">✕</button>` : ''}`;
        membersList.appendChild(row);
    });
}

async function addMember() {
    if (!isAdmin()) return;
    const name = newMemberInput.value.trim();
    if (!name) return;
    const result = await createMember(name);
    if (!result.success) { showError(result.message || 'Failed to add member'); return; }
    newMemberInput.value = '';
    await renderMembersPanel();
    await renderDashboard();
}

async function deleteMember(id) {
    if (!isAdmin()) return;
    const result = await removeMember(id);
    if (!result.success) { showError('Failed to remove member'); return; }
    await renderMembersPanel();
    await renderDashboard();
}

// ─── Projects Panel ───────────────────────────────────────────────────────────
function openProjectsPanel() { if (projectsPanel) projectsPanel.classList.remove('hidden'); }
function closeProjectsPanel() { if (projectsPanel) projectsPanel.classList.add('hidden'); }
if (projectsPanel) projectsPanel.addEventListener('click', e => { if (e.target === projectsPanel) closeProjectsPanel(); });
if (newProjectInput) newProjectInput.addEventListener('keydown', e => { if (e.key === 'Enter') addProject(); });

async function renderProjectsPanel() {
    const projects = await fetchProjects();
    const current  = projectSelect.value;
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

    // ── Show/hide Add input for admin only ──
    const addProjectRow = document.getElementById('add-project-row');
    if (addProjectRow) addProjectRow.style.display = isAdmin() ? 'flex' : 'none';

    projectsList.innerHTML = '';
    if (!projects.length) {
        projectsList.innerHTML = `<p style="font-size:13px;color:var(--text-muted)">No projects yet.</p>`;
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
            ${isAdmin() ? `<button onclick="deleteProject(${p.id})" style="color:var(--text-muted);font-size:16px;cursor:pointer;background:none;border:none;transition:color 0.18s" onmouseover="this.style.color='var(--status-danger)'" onmouseout="this.style.color='var(--text-muted)'">✕</button>` : ''}`;
        projectsList.appendChild(row);
    });
}

async function addProject() {
    if (!isAdmin()) return;
    const name = newProjectInput.value.trim();
    if (!name) return;
    const result = await createProject(name);
    if (!result.success) { showError(result.message || 'Failed to add project'); return; }
    newProjectInput.value = '';
    await renderProjectsPanel();
}

async function deleteProject(id) {
    if (!isAdmin()) return;
    const result = await removeProject(id);
    if (!result.success) { showError('Failed to remove project'); return; }
    await renderProjectsPanel();
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function askDeleteConfirmation(id) {
    if (!isAdmin()) return;
    pendingDeleteId = id;
    showDangerModal('<i class="fi fi-rr-trash"></i>', 'Delete Task?', 'This task will be permanently deleted. This cannot be undone.', async () => {
        const result = await removeTask(pendingDeleteId);
        pendingDeleteId = null;
        if (!result.success) { showError('Failed to delete task'); return; }
        await renderTasks();
        await renderDashboard();
    });
}

// ─── Task Form ────────────────────────────────────────────────────────────────
function showModalError(msg) {
    const el = document.getElementById('modal-error-msg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

async function handleModalSubmit() {
    if (!isAdmin()) return;
    const title  = (document.getElementById('modal-title-input')?.value || '').trim();
    const member = (document.getElementById('modal-member-select')?.value || '').trim();
    if (!title || !member) { showModalError('Please fill in the task title and assign a member.'); return; }
    showModalError('');
    const payload = {
        title, member,
        project:     (document.getElementById('modal-project-select')?.value || '').trim(),
        dueDate:     document.getElementById('modal-due-date')?.value || '',
        status:      document.getElementById('modal-status-select')?.value || 'To Do',
        priority:    document.getElementById('modal-priority-select')?.value || 'Medium',
        description: (document.getElementById('modal-desc-input')?.value || '').trim(),
    };
    if (editingTaskId) {
        const result = await updateTask(editingTaskId, payload);
        if (!result.success) { showError('Failed to update task'); return; }
        editingTaskId = null;
    } else {
        const result = await createTask(payload);
        if (!result.success) { showError('Failed to add task'); return; }
    }
    clearForm(); closeTaskModal();
    await renderTasks(); await renderDashboard();
}

function clearForm() {
    ['modal-title-input', 'modal-desc-input', 'modal-due-date'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
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
    if (!isAdmin()) return;
    const tasks = await fetchTasks();
    const task  = tasks.find(t => t.id === id);
    if (!task) return;
    openTaskModal(task.status);
    document.getElementById('modal-title-input').value   = task.title;
    document.getElementById('modal-desc-input').value    = task.description || '';
    document.getElementById('modal-status-select').value  = task.status;
    document.getElementById('modal-priority-select').value = task.priority;
    document.getElementById('modal-member-select').value  = task.member;
    document.getElementById('modal-project-select').value = task.project || '';
    document.getElementById('modal-due-date').value       = task.dueDate || '';
    document.getElementById('task-modal-title').textContent  = 'Edit Task';
    document.getElementById('modal-submit-btn').textContent  = 'Update Task';
    editingTaskId = id;
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function openTaskModal(defaultStatus) {
    if (!isAdmin()) return;
    const modal = document.getElementById('task-modal');
    if (!modal) return;
    if (!editingTaskId) {
        clearForm();
        document.getElementById('task-modal-title').textContent = 'New Task';
        document.getElementById('modal-submit-btn').textContent = 'Create Task';
        if (defaultStatus) { const sel = document.getElementById('modal-status-select'); if (sel) sel.value = defaultStatus; }
        document.getElementById('modal-due-date').value = new Date().toISOString().split('T')[0];
    }
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('modal-title-input')?.focus(), 50);
}

function closeTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.add('hidden');
    clearForm(); showModalError('');
}

document.addEventListener('click', e => {
    const modal = document.getElementById('task-modal');
    if (modal && e.target === modal) closeTaskModal();
});

async function changeStatus(id, newStatus) {
    if (!isAdmin()) return;
    try { await updateTask(id, { status: newStatus }); await renderTasks(); await renderDashboard(); }
    catch { showError('Failed to change status'); }
}

// ─── Pagination ───────────────────────────────────────────────────────────────
let currentPage = 1;
const PAGE_SIZE = 10;

function setPage(page) { currentPage = page; renderTasks(); }

function renderPagination(total) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const pagination = document.querySelector('.pagination');
    if (!pagination) return;
    const prevBtn = pagination.children[0];
    const nextBtn = pagination.children[pagination.children.length - 1];
    while (pagination.children.length > 2) pagination.removeChild(pagination.children[1]);
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
        btn.textContent = i;
        btn.onclick = () => setPage(i);
        pagination.insertBefore(btn, nextBtn);
    }
    prevBtn.onclick = () => { if (currentPage > 1) setPage(currentPage - 1); };
    nextBtn.onclick = () => { if (currentPage < totalPages) setPage(currentPage + 1); };
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    prevBtn.style.opacity = currentPage <= 1 ? '0.4' : '';
    nextBtn.style.opacity = currentPage >= totalPages ? '0.4' : '';
}

// ─── Search + Filter ──────────────────────────────────────────────────────────
if (searchInput) searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.toLowerCase().trim();
    currentPage = 1;
    renderTasks();
});

function setBoardMode(mode) {
    boardMode = mode === 'kanban' ? 'kanban' : 'list';
    const view = document.getElementById('view-kanban');
    if (view) view.dataset.boardMode = boardMode;
    document.getElementById('board-mode-list')?.classList.toggle('active', boardMode === 'list');
    document.getElementById('board-mode-kanban')?.classList.toggle('active', boardMode === 'kanban');
}

function setFilter(project) {
    activeFilter = project;
    currentPage = 1;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.toggle('active-filter', btn.dataset.project === project));
    renderTasks();
}

function buildFilterButtons(tasks) {
    const projects = [...new Set(tasks.map(t => t.project).filter(p => p && p.trim()))].sort();
    const btnBase   = 'font-size:13px;font-weight:500;padding:7px 18px;border-radius:99px;border:1px solid var(--border-strong);background:transparent;cursor:pointer;color:var(--text-muted);transition:all 0.2s;';
    const btnActive = 'font-size:13px;font-weight:600;padding:7px 18px;border-radius:99px;border:1px solid var(--brand);background:var(--brand-dim);cursor:pointer;color:var(--brand);transition:all 0.2s;';
    projectFiltersEl.innerHTML = `<button class="filter-btn" data-project="all" onclick="setFilter('all')" style="${activeFilter === 'all' ? btnActive : btnBase}">All Projects</button>`;
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

// ─── Drag and Drop — Admin Only ───────────────────────────────────────────────
let draggedId = null;

function onDragStart(e, id) {
    if (!isAdmin()) { e.preventDefault(); return; }
    draggedId = id; e.currentTarget.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move';
}
function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('drag-over'));
}

document.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', e => { if (!isAdmin()) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', async e => {
        if (!isAdmin()) return;
        e.preventDefault(); zone.classList.remove('drag-over');
        const newStatus = zone.dataset.status;
        if (draggedId && newStatus) { await updateTask(draggedId, { status: newStatus }); draggedId = null; await renderTasks(); await renderDashboard(); }
    });
});

// ─── Kanban Render ────────────────────────────────────────────────────────────
function showLoadingSkeleton() {
    const sk = `<div class="skeleton" style="height:140px;width:100%"></div>`;
    todoContainer.innerHTML = sk + sk;
    progressContainer.innerHTML = sk;
    doneContainer.innerHTML = sk + sk;
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

    // ── Hide New Task button for non-admins ──
    const newTaskBtn = document.querySelector('.primary-action');
    if (newTaskBtn) newTaskBtn.style.display = isAdmin() ? 'flex' : 'none';

    // ── Hide column + buttons for non-admins ──
    document.querySelectorAll('.kanban-col-add-btn').forEach(btn => {
        btn.style.display = isAdmin() ? 'flex' : 'none';
    });

    renderTaskTable(tasks, allTasks);
    todoContainer.innerHTML = progressContainer.innerHTML = doneContainer.innerHTML = '';
    let todo = 0, progress = 0, done = 0;
    tasks.forEach(task => {
        const el = createTaskElement(task);
        if (task.status === 'To Do')      { todoContainer.appendChild(el); todo++; }
        if (task.status === 'In Progress'){ progressContainer.appendChild(el); progress++; }
        if (task.status === 'Done')       { doneContainer.appendChild(el); done++; }
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
    const label   = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const color   = overdue ? 'var(--status-danger)' : 'var(--text-muted)';
    const icon    = overdue ? '<i class="fi fi-rr-triangle-warning"></i> ' : '<i class="fi fi-rr-calendar-day"></i> ';
    return `<span style="font-size:11px;color:${color}">${icon}${label}${overdue ? ' · Overdue' : ''}</span>`;
}

function priorityStyle(p) {
    if (p === 'High')   return 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:var(--status-danger)';
    if (p === 'Medium') return 'background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);color:var(--status-prog)';
    return 'background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);color:var(--status-done)';
}

function statusStyle(status) {
    if (status === 'Done')        return 'background:rgba(16,185,129,0.16);border:1px solid rgba(16,185,129,0.28);color:#4ade80';
    if (status === 'In Progress') return 'background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.32);color:#fbbf24';
    return 'background:rgba(79,142,247,0.16);border:1px solid rgba(79,142,247,0.32);color:#65a3ff';
}

function renderTaskTable(tasks, allTasks) {
    if (!taskTableBody) return;
    const totalFiltered = tasks.length;
    const start    = (currentPage - 1) * PAGE_SIZE;
    const pageSlice = tasks.slice(start, start + PAGE_SIZE);
    if (!totalFiltered) {
        taskTableBody.innerHTML = `<tr><td class="empty-row" colspan="7">No tasks match this view.</td></tr>`;
    } else {
        taskTableBody.innerHTML = pageSlice.map(createTaskRow).join('');
    }
    renderPagination(totalFiltered);
    if (taskSummary) {
        const projectCount = new Set(allTasks.map(t => t.project).filter(Boolean)).size;
        const end = Math.min(start + PAGE_SIZE, totalFiltered);
        taskSummary.textContent = totalFiltered
            ? `Showing ${start + 1}–${end} of ${totalFiltered} task${totalFiltered === 1 ? '' : 's'} across ${projectCount} project${projectCount === 1 ? '' : 's'}`
            : `Showing 0 tasks of ${allTasks.length} total`;
    }
}

function createTaskRow(task) {
    const ac       = AVATAR_COLORS[memberColorIndex(task.member)];
    const initials = memberInitials(task.member || '?');
    const dueDate  = formatTableDate(task.dueDate);
    const project  = task.project || 'No project';
    // Actions column — only show edit/delete for admins
    const actions  = isAdmin()
        ? `<div class="table-actions">
               <button class="icon-action" onclick="editTask(${task.id})" title="Edit task"><i class="fi fi-rr-pencil"></i></button>
               <button class="icon-action delete" onclick="askDeleteConfirmation(${task.id})" title="Delete task"><i class="fi fi-rr-trash"></i></button>
           </div>`
        : `<span style="font-size:12px;color:var(--text-muted)">—</span>`;
    return `
        <tr>
            <td><div class="table-task-title">${escapeHtml(task.title)}</div></td>
            <td><span class="pill status-pill" style="${statusStyle(task.status)}">${escapeHtml(statusLabel(task.status))}</span></td>
            <td><span class="pill priority-pill" style="${priorityStyle(task.priority)}">${escapeHtml(task.priority)}</span></td>
            <td><div class="member-cell"><span class="member-avatar" style="background:${ac.color};">${escapeHtml(initials)}</span><span>${escapeHtml(task.member)}</span></div></td>
            <td>${escapeHtml(project)}</td>
            <td><span class="table-date"><i class="fi fi-rr-calendar"></i>${dueDate}</span></td>
            <td>${actions}</td>
        </tr>`;
}

function statusLabel(status) { return status === 'In Progress' ? 'In progress' : status; }

function formatTableDate(dueDate) {
    if (!dueDate) return 'No date';
    return new Date(dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(',', '');
}

function memberColorIndex(name) {
    name = String(name || '?');
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % AVATAR_COLORS.length;
}

function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = `task-card${isOverdue(task.dueDate, task.status) ? ' overdue-card' : ''}`;
    div.draggable = isAdmin();
    div.dataset.id = task.id;
    div.addEventListener('dragstart', e => onDragStart(e, task.id));
    div.addEventListener('dragend',   e => onDragEnd(e));

    const dateLine  = formatDate(task.dueDate, task.status);
    const descBlock = task.description ? `<p style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-top:2px">${escapeHtml(task.description)}</p>` : '';
    const colorIdx  = memberColorIndex(task.member);
    const ac        = AVATAR_COLORS[colorIdx];
    const avatarStyle = `background:${ac.bg};border:1.5px solid ${ac.border};color:${ac.color}`;
    const initials  = memberInitials(task.member);

    // Edit/Delete buttons only for admins
    const actionBtns = isAdmin() ? `
        <button onclick="editTask(${task.id})" title="Edit" style="padding:5px 7px;border:1px solid var(--border-strong);border-radius:7px;cursor:pointer;background:none;color:var(--text-muted);font-size:13px;transition:all 0.18s;line-height:1" onmouseover="this.style.background='var(--bg-hover)';this.style.color='var(--brand)'" onmouseout="this.style.background='none';this.style.color='var(--text-muted)'"><i class="fi fi-rr-pen-clip"></i></button>
        <button onclick="askDeleteConfirmation(${task.id})" title="Delete" style="padding:5px 7px;border:1px solid var(--border-strong);border-radius:7px;cursor:pointer;background:none;color:var(--text-muted);font-size:13px;transition:all 0.18s;line-height:1" onmouseover="this.style.background='rgba(239,68,68,0.12)';this.style.color='var(--status-danger)'" onmouseout="this.style.background='none';this.style.color='var(--text-muted)'"><i class="fi fi-rr-trash"></i></button>` : '';

    div.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <span style="${priorityStyle(task.priority)};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:3px 9px;border-radius:99px;flex-shrink:0">${task.priority}</span>
            <div style="display:flex;gap:4px;margin-left:auto">${actionBtns}</div>
        </div>
        <div>
            <h4 style="font-size:15px;font-weight:600;color:var(--text-main);line-height:1.35;margin-bottom:2px">${escapeHtml(task.title)}</h4>
            ${descBlock}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
            <div>${dateLine ? `<div>${dateLine}</div>` : ''}</div>
            <div class="avatar-wrap" style="position:relative">
                <span style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;cursor:default;${avatarStyle}">${initials}</span>
                <span class="avatar-tooltip">${escapeHtml(task.member)}</span>
            </div>
        </div>`;
    return div;
}

function emptyState() {
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;color:var(--text-muted)">
        <div class="w-11 h-11 border-2 border-dashed rounded-xl flex items-center justify-center mb-2.5">
            <i class="fi fi-rr-calendar-minus text-[18px] leading-none"></i>
        </div>
        <p style="font-size:14px">Empty</p>
    </div>`;
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}

// ─── Dashboard Render ─────────────────────────────────────────────────────────
async function renderDashboard() {
    let tasks;
    try { tasks = await fetchTasks(); allTasksCache = tasks; }
    catch { return; }

    const total  = tasks.length;
    const todoN  = tasks.filter(t => t.status === 'To Do').length;
    const progN  = tasks.filter(t => t.status === 'In Progress').length;
    const doneN  = tasks.filter(t => t.status === 'Done').length;
    const pct    = total ? Math.round((doneN / total) * 100) : 0;
    const overdue = tasks.filter(t => isOverdue(t.dueDate, t.status));

    animateCount('ds-total', total);
    animateCount('ds-todo', todoN);
    animateCount('ds-prog', progN);
    animateCount('ds-done', doneN);
    setBar('ds-todo-bar', total ? (todoN / total) * 100 : 0);
    setBar('ds-prog-bar', total ? (progN / total) * 100 : 0);
    setBar('ds-done-bar', total ? (doneN / total) * 100 : 0);

    const circumference = 2 * Math.PI * 54;
    const filled = (pct / 100) * circumference;
    const donutFill = document.getElementById('donut-fill');
    if (donutFill) setTimeout(() => { donutFill.setAttribute('stroke-dasharray', `${filled} ${circumference}`); }, 100);
    const donutPct = document.getElementById('donut-pct');
    if (donutPct) animateCount('donut-pct', pct, '%');

    const high = tasks.filter(t => t.priority === 'High').length;
    const medium = tasks.filter(t => t.priority === 'Medium').length;
    const low  = tasks.filter(t => t.priority === 'Low').length;
    const maxP = Math.max(high, medium, low, 1);

    const priChart = document.getElementById('priority-chart');
    if (priChart) {
        priChart.innerHTML = '';
        [{ label:'High', val:high, color:'var(--status-danger)' }, { label:'Medium', val:medium, color:'var(--status-prog)' }, { label:'Low', val:low, color:'var(--status-done)' }].forEach(b => {
            const col = document.createElement('div');
            col.className = 'bar-col'; col.style.cssText = `background:${b.color};opacity:0.8;height:4px`; col.title = `${b.label}: ${b.val}`;
            priChart.appendChild(col);
            setTimeout(() => { col.style.height = `${(b.val / maxP) * 100}%`; }, 100);
        });
    }
    const priLegend = document.getElementById('priority-legend');
    if (priLegend) priLegend.innerHTML = [
        { label:'High', val:high, c:'var(--status-danger)' },
        { label:'Med',  val:medium, c:'var(--status-prog)' },
        { label:'Low',  val:low,  c:'var(--status-done)' },
    ].map(b => `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${b.c};margin-right:4px"></span>${b.label}: ${b.val}</span>`).join('');

    const memberLoad = document.getElementById('member-load');
    if (memberLoad) {
        const byMember = {};
        tasks.forEach(t => { byMember[t.member] = (byMember[t.member] || 0) + 1; });
        const maxLoad = Math.max(...Object.values(byMember), 1);
        memberLoad.innerHTML = Object.entries(byMember).sort((a,b) => b[1]-a[1]).map(([name, count]) => `
            <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                    <span style="font-size:13px;color:var(--text-main);font-weight:500">${escapeHtml(name)}</span>
                    <span style="font-size:12px;color:var(--text-muted)">${count} task${count !== 1 ? 's' : ''}</span>
                </div>
                <div style="height:5px;border-radius:99px;background:var(--border-subtle);overflow:hidden">
                    <div style="height:100%;border-radius:99px;background:var(--brand);width:0%;transition:width 0.7s cubic-bezier(.22,1,.36,1)" data-target="${(count/maxLoad)*100}"></div>
                </div>
            </div>`).join('') || `<p style="font-size:13px;color:var(--text-muted)">No tasks yet</p>`;
        setTimeout(() => memberLoad.querySelectorAll('[data-target]').forEach(el => el.style.width = el.dataset.target + '%'), 100);
    }

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
                    <span style="font-size:13px;color:var(--text-main);font-weight:500">${escapeHtml(proj)}</span>
                    <span style="font-size:12px;color:var(--text-muted)">${data.done}/${data.total} · ${pPct}%</span>
                </div>
                <div style="height:5px;border-radius:99px;background:var(--border-subtle);overflow:hidden">
                    <div style="height:100%;border-radius:99px;background:var(--status-done);width:0%;transition:width 0.7s cubic-bezier(.22,1,.36,1)" data-target="${pPct}"></div>
                </div>
            </div>`;
        }).join('') || `<p style="font-size:13px;color:var(--text-muted)">No projects yet</p>`;
        setTimeout(() => projectBreakdown.querySelectorAll('[data-target]').forEach(el => el.style.width = el.dataset.target + '%'), 100);
    }

    const overdueList = document.getElementById('overdue-list');
    if (overdueList) {
        overdueList.innerHTML = overdue.length === 0
            ? `<p style="font-size:13px;color:var(--status-done)">✓ No overdue tasks</p>`
            : overdue.map(t => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:10px">
                    <div>
                        <div style="font-size:13px;font-weight:500;color:var(--text-main)">${escapeHtml(t.title)}</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escapeHtml(t.member)} · ${escapeHtml(t.project || '—')}</div>
                    </div>
                    <span style="font-size:11px;color:var(--status-danger)">⚠ ${new Date(t.dueDate).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>
                </div>`).join('');
    }

    const recentList = document.getElementById('recent-list');
    if (recentList) {
        const sorted = [...tasks].sort((a,b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt)).slice(0,5);
        const statusColors = { 'To Do':'var(--status-todo)', 'In Progress':'var(--status-prog)', 'Done':'var(--status-done)' };
        recentList.innerHTML = sorted.map(t => `
            <div style="display:flex;align-items:flex-start;gap:10px">
                <div style="width:8px;height:8px;border-radius:50%;background:${statusColors[t.status]||'var(--text-muted)'};flex-shrink:0;margin-top:4px"></div>
                <div style="flex:1">
                    <div style="font-size:13px;color:var(--text-main);font-weight:500">${escapeHtml(t.title)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escapeHtml(t.member)} · <span style="color:${statusColors[t.status]}">${t.status}</span> · ${relativeTime(t.updatedAt||t.createdAt)}</div>
                </div>
            </div>`).join('') || `<p style="font-size:13px;color:var(--text-muted)">No activity yet</p>`;
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function animateCount(id, target, suffix = '') {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const dur = 600; const t0 = performance.now();
    function step(now) {
        const p = Math.min((now - t0) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(start + (target - start) * e) + suffix;
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function setBar(id, pct) { const el = document.getElementById(id); if (el) setTimeout(() => el.style.width = pct + '%', 100); }

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
    if (isAdmin()) {
        document.getElementById('settings-locked').style.display = 'none';
        document.getElementById('settings-content').style.display = 'block';
        const nameEl  = document.getElementById('settings-name');
        const emailEl = document.getElementById('settings-email');
        if (nameEl)  nameEl.value  = currentUser.name  || '';
        if (emailEl) emailEl.value = currentUser.email || '';
        renderUsersTable();
    } else {
        document.getElementById('settings-locked').style.display = 'flex';
        document.getElementById('settings-content').style.display = 'none';
    }
}

async function renderUsersTable() {
    const table = document.getElementById('users-table');
    const badge = document.getElementById('users-count-badge');
    if (!table) return;
    table.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:12px 0">Loading…</div>`;
    try {
        const data  = await apiFetch(`${API}/admin/users`);
        const users = data.users || [];
        if (badge) badge.textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
        if (!users.length) { table.innerHTML = `<p style="color:var(--text-muted);font-size:13px">No users found.</p>`; return; }
        table.innerHTML = `
            <div style="display:grid;grid-template-columns:2fr 2fr 100px 100px auto;gap:12px;padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-muted)">
                <span>Name</span><span>Email</span><span>Role</span><span>Joined</span><span></span>
            </div>`;
        users.forEach(u => {
            const isSelf   = u.id === currentUser.id;
            const uIsAdmin = u.role === 'admin';
            const initials = u.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            const joinDate = new Date(u.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
            const row = document.createElement('div');
            row.style.cssText = 'display:grid;grid-template-columns:2fr 2fr 100px 100px auto;gap:12px;align-items:center;padding:12px 14px;background:var(--bg-element);border:1px solid var(--border-strong);border-radius:12px';
            row.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;min-width:0">
                    <div style="width:32px;height:32px;border-radius:50%;background:${isSelf?'var(--brand-dim)':'var(--border-strong)'};border:1px solid ${isSelf?'rgba(108,143,255,0.3)':'transparent'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${isSelf?'var(--brand)':'var(--text-light)'};flex-shrink:0">${initials}</div>
                    <div style="min-width:0">
                        <div style="font-size:13px;font-weight:600;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(u.name)}${isSelf?' <span style="font-size:10px;color:var(--brand)">(you)</span>':''}</div>
                    </div>
                </div>
                <div style="font-size:13px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(u.email)}</div>
                <div>
                    <select onchange="changeUserRole(${u.id}, this.value)" ${isSelf?'disabled':''}
                        style="background:${uIsAdmin?'var(--brand-dim)':'var(--bg-hover)'};border:1px solid ${uIsAdmin?'rgba(108,143,255,0.3)':'var(--border-strong)'};color:${uIsAdmin?'var(--brand)':'var(--text-muted)'};border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;cursor:${isSelf?'not-allowed':'pointer'};appearance:none;width:100%">
                        <option value="member" ${u.role==='member'?'selected':''}>Member</option>
                        <option value="admin"  ${u.role==='admin' ?'selected':''}>Admin</option>
                    </select>
                </div>
                <div style="font-size:12px;color:var(--text-muted)">${joinDate}</div>
                <button onclick="adminDeleteUser(${u.id})" ${isSelf?'disabled':''}
                    style="background:none;border:none;color:${isSelf?'var(--border-strong)':'var(--text-muted)'};font-size:16px;cursor:${isSelf?'not-allowed':'pointer'};padding:4px 8px;border-radius:6px;transition:all 0.18s"
                    onmouseover="if(!this.disabled)this.style.background='rgba(239,68,68,0.12)';if(!this.disabled)this.style.color='var(--status-danger)'"
                    onmouseout="this.style.background='none';this.style.color='${isSelf?'var(--border-strong)':'var(--text-muted)'}'">✕</button>`;
            table.appendChild(row);
        });
    } catch (e) {
        table.innerHTML = `<p style="color:var(--status-danger);font-size:13px">Failed to load users.</p>`;
    }
}

async function changeUserRole(userId, newRole) {
    try {
        const res = await apiFetch(`${API}/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
        if (!res.success) { showError(res.message || 'Failed to change role'); }
        else {
            await renderUsersTable();
            await renderMembersPanel();
            if (userId === currentUser?.id) { currentUser.role = newRole; updateUserUI(); }
        }
    } catch { showError('Failed to change role'); }
}

async function adminDeleteUser(userId) {
    showDangerModal('<i class="fi fi-rr-trash"></i>', 'Delete User?', 'This will permanently remove their account. Tasks they created will remain.', async () => {
        const res = await apiFetch(`${API}/admin/users/${userId}`, { method: 'DELETE' });
        if (!res.success) showError(res.message || 'Failed to delete user');
        else { await renderUsersTable(); await renderMembersPanel(); }
    });
}

async function saveMyAccount() {
    const name   = (document.getElementById('settings-name')?.value || '').trim();
    const email  = (document.getElementById('settings-email')?.value || '').trim();
    const newpwd = (document.getElementById('settings-newpwd')?.value || '');
    const curpwd = (document.getElementById('settings-curpwd')?.value || '');
    const msg    = document.getElementById('settings-account-msg');
    const show   = (text, ok) => {
        if (!msg) return;
        msg.textContent = text; msg.style.color = ok ? 'var(--status-done)' : 'var(--status-danger)'; msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 4000);
    };
    if (!name || !email) { show('Name and email are required.', false); return; }
    if (!curpwd)         { show('Enter your current password to save.', false); return; }
    try {
        const res = await apiFetch(`${API}/account`, { method: 'PUT', body: JSON.stringify({ name, email, currentPassword: curpwd, newPassword: newpwd || undefined }) });
        if (res.success) {
            currentUser.name  = res.user.name;
            currentUser.email = res.user.email;
            updateUserUI();
            document.getElementById('settings-curpwd').value = '';
            document.getElementById('settings-newpwd').value = '';
            show('✓ Account updated successfully.', true);
        } else { show(res.message || 'Failed to update account.', false); }
    } catch { show('Server error.', false); }
}

function adminClearTasks() {
    showDangerModal('<i class="fi fi-rr-trash"></i>', 'Clear All Tasks?', 'Every task in the workspace will be permanently deleted. This cannot be undone.', async () => {
        const res = await apiFetch(`${API}/admin/clear-tasks`, { method: 'DELETE' });
        if (res.success) { showError('✓ All tasks cleared.'); await renderDashboard(); await renderTasks(); }
        else showError(res.message || 'Failed to clear tasks.');
    });
}

function adminResetWorkspace() {
    showDangerModal('<i class="fi fi-rr-trash"></i>', 'Reset Workspace?', 'All tasks, members and projects will be permanently deleted. User accounts will be kept.', async () => {
        const res = await apiFetch(`${API}/admin/reset`, { method: 'DELETE' });
        if (res.success) { showError('✓ Workspace reset.'); await init(); }
        else showError(res.message || 'Failed to reset workspace.');
    });
}

// ─── Danger Modal ─────────────────────────────────────────────────────────────
let _dangerCallback = null;
function showDangerModal(icon, title, desc, onConfirm) {
    document.getElementById('danger-icon').innerHTML = icon;
    document.getElementById('danger-title').textContent = title;
    document.getElementById('danger-desc').textContent = desc;
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

// ─── Account Modal ────────────────────────────────────────────────────────────
function openAccountModal() {
    const modal = document.getElementById('account-modal');
    if (!modal || !currentUser) return;
    modal.classList.remove('hidden');
    const initials   = currentUser.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const bigAv      = document.getElementById('acct-avatar-big');
    if (bigAv) bigAv.textContent = initials;
    const headerName = document.getElementById('acct-header-name');
    if (headerName) headerName.textContent = currentUser.name;
    const headerRole = document.getElementById('acct-header-role');
    if (headerRole) headerRole.innerHTML = isAdmin() ? '<span class="flex items-center gap-1 w-[14px] h-[14px]"><img src="./assets/Icon (2).png" alt="Admin"> Admin</span>' : 'Member';
    const nameEl  = document.getElementById('acct-name');
    const emailEl = document.getElementById('acct-email');
    if (nameEl)  nameEl.value  = currentUser.name  || '';
    if (emailEl) emailEl.value = currentUser.email || '';
    const roleEl   = document.getElementById('acct-info-role');
    const joinedEl = document.getElementById('acct-info-joined');
    if (roleEl)   roleEl.textContent   = isAdmin() ? 'Admin' : 'Member';
    if (joinedEl) joinedEl.textContent = currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) : '—';
    const themeChk   = document.getElementById('acct-theme-check');
    if (themeChk)   themeChk.checked   = (localStorage.getItem('tf-theme') || 'dark') === 'dark';
    const sidebarChk = document.getElementById('acct-sidebar-check');
    if (sidebarChk) sidebarChk.checked = localStorage.getItem('tf-sidebar') === 'collapsed';
    switchAccountTab('profile');
    clearAccountMsgs();
}

function closeAccountModal() {
    const modal = document.getElementById('account-modal');
    if (modal) modal.classList.add('hidden');
    clearAccountMsgs();
}

document.addEventListener('click', e => {
    const modal = document.getElementById('account-modal');
    if (modal && e.target === modal) closeAccountModal();
});

function clearAccountMsgs() {
    ['acct-profile-msg', 'acct-security-msg'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    ['acct-cur-pwd', 'acct-new-pwd', 'acct-confirm-pwd'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    updateStrength('');
}

function switchAccountTab(tab) {
    ['profile','security','preferences'].forEach(t => {
        const panel = document.getElementById(`acct-panel-${t}`);
        const btn   = document.getElementById(`acct-tab-${t}`);
        if (panel) panel.style.display = t === tab ? 'block' : 'none';
        if (btn) { btn.style.borderBottomColor = t === tab ? 'var(--brand)' : 'transparent'; btn.style.color = t === tab ? 'var(--brand)' : 'var(--text-muted)'; }
    });
}

function showAccountMsg(panelId, text, ok) {
    const el = document.getElementById(panelId);
    if (!el) return;
    el.textContent = text; el.style.display = 'block';
    el.style.color      = ok ? 'var(--status-done)'        : 'var(--status-danger)';
    el.style.background = ok ? 'rgba(16,185,129,0.08)'     : 'rgba(239,68,68,0.08)';
    el.style.border     = `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`;
    if (ok) setTimeout(() => { el.style.display = 'none'; }, 4000);
}

async function saveProfile() {
    const name  = (document.getElementById('acct-name')?.value  || '').trim();
    const email = (document.getElementById('acct-email')?.value || '').trim();
    if (!name)  { showAccountMsg('acct-profile-msg', 'Name is required.', false); return; }
    if (!email) { showAccountMsg('acct-profile-msg', 'Email is required.', false); return; }
    try {
        const res = await apiFetch(`${API}/account/profile`, { method: 'PUT', body: JSON.stringify({ name, email }) });
        if (res.success) {
            currentUser.name = res.user.name; currentUser.email = res.user.email;
            updateUserUI();
            const headerName = document.getElementById('acct-header-name'); if (headerName) headerName.textContent = res.user.name;
            const bigAv = document.getElementById('acct-avatar-big'); if (bigAv) bigAv.textContent = res.user.name.trim().split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
            showAccountMsg('acct-profile-msg', '✓ Profile saved successfully.', true);
        } else { showAccountMsg('acct-profile-msg', res.message || 'Update failed.', false); }
    } catch { showAccountMsg('acct-profile-msg', 'Server connection error.', false); }
}

async function savePassword() {
    const curPwd     = document.getElementById('acct-cur-pwd')?.value     || '';
    const newPwd     = document.getElementById('acct-new-pwd')?.value     || '';
    const confirmPwd = document.getElementById('acct-confirm-pwd')?.value || '';
    if (!curPwd)            { showAccountMsg('acct-security-msg', 'Enter your current password.', false); return; }
    if (newPwd.length < 6)  { showAccountMsg('acct-security-msg', 'New password must be at least 6 characters.', false); return; }
    if (newPwd !== confirmPwd){ showAccountMsg('acct-security-msg', 'Passwords do not match.', false); return; }
    try {
        const res = await apiFetch(`${API}/account/password`, { method: 'PUT', body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }) });
        if (res.success) {
            document.getElementById('acct-cur-pwd').value = '';
            document.getElementById('acct-new-pwd').value = '';
            document.getElementById('acct-confirm-pwd').value = '';
            updateStrength('');
            showAccountMsg('acct-security-msg', '✓ Password changed successfully.', true);
        } else { showAccountMsg('acct-security-msg', res.message || 'Password change failed.', false); }
    } catch { showAccountMsg('acct-security-msg', 'Server connection error.', false); }
}

function setPrefSidebar(collapsed) {
    const sidebar = document.getElementById('sidebar');
    if (collapsed) { sidebar.classList.add('collapsed'); localStorage.setItem('tf-sidebar', 'collapsed'); }
    else           { sidebar.classList.remove('collapsed'); localStorage.setItem('tf-sidebar', 'expanded'); }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
checkAuth();