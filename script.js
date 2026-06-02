// ─── API Base URL ─────────────────────────────────────────────────────────────
const API = 'http://localhost:3000/api';

// ─── State ────────────────────────────────────────────────────────────────────
let editingTaskId   = null;
let activeFilter    = 'all';
let searchQuery     = '';
let pendingDeleteId = null;
let allTasksCache   = [];

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
    // Update label
    const lbl = document.querySelector('#sidebar label + span, #sidebar .toggle-label');
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
    if (labelEl) labelEl.textContent = theme === 'dark' ? '🌙 Dark mode' : '☀️ Light mode';
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

    const titles = { dashboard: 'Dashboard', kanban: 'Kanban Board' };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[name] || name;

    // Refresh data for the active view
    if (name === 'dashboard') renderDashboard();
    if (name === 'kanban')    renderTasks();
}

// ─── DOM References ───────────────────────────────────────────────────────────
const loginScreen   = document.getElementById('login-screen');
const loginPassword = document.getElementById('login-password');
const loginBtn      = document.getElementById('login-btn');
const loginError    = document.getElementById('login-error');
const appEl         = document.getElementById('app');

const titleInput    = document.getElementById('title-input');
const memberSelect  = document.getElementById('member-select');
const projectInput  = document.getElementById('project-input');
const dueDateInput  = document.getElementById('due-date-input');
const statusSelect  = document.getElementById('status-select');
const prioritySelect = document.getElementById('priority-select');
const descInput     = document.getElementById('desc-input');
const addBtn        = document.getElementById('add-btn');
const searchInput   = document.getElementById('search-input');

const todoContainer     = document.getElementById('todo-container');
const progressContainer = document.getElementById('inprogress-container');
const doneContainer     = document.getElementById('done-container');

const todoCount     = document.getElementById('todo-count');
const progressCount = document.getElementById('inprogress-count');
const doneCount     = document.getElementById('done-count');

const projectFiltersEl = document.getElementById('project-filters');
const errorBanner      = document.getElementById('error-banner');
const errorText        = document.getElementById('error-text');
const confirmModal     = document.getElementById('confirm-modal');
const confirmCancel    = document.getElementById('confirm-cancel');
const confirmDelete    = document.getElementById('confirm-delete');
const membersPanel     = document.getElementById('members-panel');
const newMemberInput   = document.getElementById('new-member-input');
const membersList      = document.getElementById('members-list');


// ─── Error Banner ─────────────────────────────────────────────────────────────
function showError(msg) {
    errorText.textContent = msg;
    errorBanner.style.display = 'flex';
    setTimeout(() => errorBanner.style.display = 'none', 5000);
}
function hideError() { errorBanner.style.display = 'none'; }


// ─── Auth ─────────────────────────────────────────────────────────────────────
async function checkAuth() {
    initTheme();
    try {
        const res  = await fetch(`${API}/me`, { credentials: 'include' });
        const data = await res.json();
        data.authenticated ? showApp() : showLogin();
    } catch {
        showLogin();
        showError('Cannot reach the server. Make sure it is running.');
    }
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    appEl.classList.add('hidden');
}

function showApp() {
    loginScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    init();
}

loginBtn.addEventListener('click', handleLogin);
loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
loginBtn.addEventListener('mouseover', () => loginBtn.style.opacity = '0.85');
loginBtn.addEventListener('mouseout',  () => loginBtn.style.opacity = '1');

async function handleLogin() {
    const password = loginPassword.value;
    loginError.classList.add('hidden');
    try {
        const res  = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ password }) });
        const data = await res.json();
        if (data.success) { loginPassword.value = ''; showApp(); }
        else loginError.classList.remove('hidden');
    } catch {
        showError('Login failed. Is the server running?');
    }
}

async function logout() {
    await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
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


// ─── Members Panel ────────────────────────────────────────────────────────────
function openMembersPanel()  { membersPanel.classList.remove('hidden'); }
function closeMembersPanel() { membersPanel.classList.add('hidden'); }
membersPanel.addEventListener('click', e => { if (e.target === membersPanel) closeMembersPanel(); });
newMemberInput.addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });

async function renderMembersPanel() {
    const members = await fetchMembers();
    memberSelect.innerHTML = '<option value="">Assign to...</option>';
    members.forEach(m => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = m.name;
        memberSelect.appendChild(opt);
    });
    membersList.innerHTML = '';
    if (!members.length) {
        membersList.innerHTML = `<p style="font-size:13px;color:var(--text-muted)">No members yet. Add one above.</p>`;
        return;
    }
    members.forEach(m => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:var(--bg-element);border:1px solid var(--border-strong);border-radius:10px;padding:10px 14px';
        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px">
                <span style="width:30px;height:30px;background:var(--border-strong);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--text-light);text-transform:uppercase">${m.name.charAt(0)}</span>
                <span style="font-size:14px;color:var(--text-main)">${m.name}</span>
            </div>
            <button onclick="deleteMember(${m.id})" style="color:var(--text-muted);font-size:16px;cursor:pointer;background:none;border:none;transition:color 0.18s" onmouseover="this.style.color='var(--status-danger)'" onmouseout="this.style.color='var(--text-muted)'">✕</button>`;
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


// ─── Delete Modal ─────────────────────────────────────────────────────────────
confirmCancel.addEventListener('click', () => { confirmModal.classList.add('hidden'); pendingDeleteId = null; });
confirmDelete.addEventListener('click', async () => {
    if (pendingDeleteId === null) return;
    confirmModal.classList.add('hidden');
    const result = await removeTask(pendingDeleteId);
    pendingDeleteId = null;
    if (!result.success) { showError('Failed to delete task'); return; }
    await renderTasks();
    await renderDashboard();
});
function askDeleteConfirmation(id) { pendingDeleteId = id; confirmModal.classList.remove('hidden'); }
confirmModal.addEventListener('click', e => { if (e.target === confirmModal) { confirmModal.classList.add('hidden'); pendingDeleteId = null; } });


// ─── Task Form ────────────────────────────────────────────────────────────────
addBtn.addEventListener('click', handleAdd);

async function handleAdd() {
    const title = titleInput.value.trim(), member = memberSelect.value.trim();
    if (!title || !member) { showError('Please fill in the task title and assign a member'); return; }
    hideError();

    const payload = { title, member, project: projectInput.value.trim(), dueDate: dueDateInput.value, status: statusSelect.value, priority: prioritySelect.value, description: descInput.value.trim() };

    if (editingTaskId) {
        const result = await updateTask(editingTaskId, payload);
        if (!result.success) { showError('Failed to update task'); return; }
        editingTaskId = null;
        addBtn.textContent = '+ Add';
    } else {
        const result = await createTask(payload);
        if (!result.success) { showError('Failed to add task'); return; }
    }
    clearForm();
    await renderTasks();
    await renderDashboard();
}

function clearForm() {
    titleInput.value = ''; memberSelect.value = ''; projectInput.value = '';
    dueDateInput.value = ''; statusSelect.value = 'To Do'; prioritySelect.value = 'Low'; descInput.value = '';
}

async function editTask(id) {
    const tasks = await fetchTasks();
    const task  = tasks.find(t => t.id === id);
    if (!task) return;
    titleInput.value = task.title; memberSelect.value = task.member;
    projectInput.value = task.project||''; dueDateInput.value = task.dueDate||'';
    statusSelect.value = task.status; prioritySelect.value = task.priority; descInput.value = task.description||'';
    editingTaskId = id;
    addBtn.textContent = 'Update Task';
    // Switch to kanban if not there
    switchView('kanban');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function changeStatus(id, newStatus) {
    try { await updateTask(id, { status: newStatus }); await renderTasks(); await renderDashboard(); }
    catch { showError('Failed to change status'); }
}


// ─── Search + Filter ──────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => { searchQuery = searchInput.value.toLowerCase().trim(); renderTasks(); });

function setFilter(project) {
    activeFilter = project;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active-filter', btn.dataset.project === project);
    });
    renderTasks();
}

function buildFilterButtons(tasks) {
    const projects = [...new Set(tasks.map(t => t.project).filter(p => p && p.trim()))].sort();
    projectFiltersEl.innerHTML = `
        <button data-project="all" onclick="setFilter('all')" class="filter-btn ${activeFilter==='all'?'active-filter':''}" style="font-size:12px;font-weight:500;padding:5px 14px;border-radius:99px;border:1px solid;transition:all 0.2s;cursor:pointer">All Projects</button>`;
    projects.forEach(project => {
        const btn = document.createElement('button');
        btn.dataset.project = project;
        btn.onclick = () => setFilter(project);
        btn.className = `filter-btn ${activeFilter===project?'active-filter':''}`;
        btn.style.cssText = 'font-size:12px;font-weight:500;padding:5px 14px;border-radius:99px;border:1px solid;transition:all 0.2s;cursor:pointer';
        btn.textContent = project;
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

function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = `task-card${isOverdue(task.dueDate, task.status) ? ' overdue-card' : ''}`;
    div.draggable = true;
    div.dataset.id = task.id;
    div.addEventListener('dragstart', e => onDragStart(e, task.id));
    div.addEventListener('dragend',   e => onDragEnd(e));

    const projectBadge = task.project
        ? `<span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;padding:3px 8px;border-radius:99px;background:var(--brand-dim);border:1px solid rgba(108,143,255,0.2);color:var(--brand);cursor:pointer" onclick="setFilter('${escapeAttr(task.project)}')">${task.project}</span>`
        : '';
    const dateLine = formatDate(task.dueDate, task.status);
    const descBlock = task.description ? `<p style="font-size:12px;color:var(--text-muted);line-height:1.6">${task.description}</p>` : '';

    div.innerHTML = `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            <h4 style="font-size:15px;font-weight:500;color:var(--text-main);line-height:1.35">${task.title}</h4>
            ${projectBadge}
        </div>
        ${descBlock}
        <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:8px">
                <span style="width:24px;height:24px;background:var(--border-strong);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text-light);text-transform:uppercase">${task.member.charAt(0)}</span>
                <span style="font-size:13px;color:var(--text-muted)">${task.member}</span>
            </div>
            <span style="${priorityStyle(task.priority)};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;padding:3px 10px;border-radius:99px">${task.priority}</span>
        </div>
        ${dateLine ? `<div>${dateLine}</div>` : ''}
        <hr style="border-color:var(--border-strong)">
        <div style="display:flex;align-items:center;gap:8px">
            <div style="position:relative;flex:1">
                <select onchange="changeStatus(${task.id}, this.value)" style="width:100%;background:var(--bg-surface);border:1px solid var(--border-strong);border-radius:8px;padding:7px 32px 7px 12px;color:var(--text-main);font-size:13px;outline:none;appearance:none;cursor:pointer">
                    <option${task.status==='To Do'?' selected':''}>To Do</option>
                    <option${task.status==='In Progress'?' selected':''}>In Progress</option>
                    <option${task.status==='Done'?' selected':''}>Done</option>
                </select>
                <div style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--text-muted);font-size:10px">▼</div>
            </div>
            <button onclick="editTask(${task.id})" title="Edit" style="padding:7px 10px;border:1px solid var(--border-strong);border-radius:8px;cursor:pointer;background:none;color:var(--text-muted);font-size:14px;transition:all 0.18s" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='none'">✏</button>
            <button onclick="askDeleteConfirmation(${task.id})" title="Delete" style="padding:7px 10px;border:1px solid var(--border-strong);border-radius:8px;cursor:pointer;background:none;color:var(--text-muted);font-size:14px;transition:all 0.18s" onmouseover="this.style.background='rgba(239,68,68,0.15)';this.style.color='var(--status-danger)'" onmouseout="this.style.background='none';this.style.color='var(--text-muted)'">🗑</button>
        </div>`;
    return div;
}

function emptyState() {
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;color:var(--text-muted)">
        <div style="width:44px;height:44px;border:2px dashed var(--border-strong);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;font-size:18px">·</div>
        <p style="font-size:14px">Empty</p>
    </div>`;
}

function escapeAttr(str) { return str.replace(/'/g, "\\'"); }


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
    showLoadingSkeleton();
    try {
        await renderMembersPanel();
        await renderDashboard();
        await renderTasks();
    } catch (err) {
        showError('Failed to load data. Is the server running?');
    }
}

checkAuth();