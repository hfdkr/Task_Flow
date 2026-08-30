// ─── API Base URL ─────────────────────────────────────────────────────────────
const API = '/api';

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
