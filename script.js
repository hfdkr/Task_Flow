// ─── API Base URL ─────────────────────────────────────────────────────────────
const API = 'http://localhost:3000/api';

// ─── State ────────────────────────────────────────────────────────────────────
let editingTaskId = null;
let activeFilter  = 'all';
let searchQuery   = '';
let pendingDeleteId = null;

// ─── DOM References ───────────────────────────────────────────────────────────
const loginScreen    = document.getElementById('login-screen');
const loginPassword  = document.getElementById('login-password');
const loginBtn       = document.getElementById('login-btn');
const loginError     = document.getElementById('login-error');
const app            = document.getElementById('app');

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

const headerTotalCount = document.getElementById('header-total-count');
const headerDoneCount  = document.getElementById('header-done-count');

const projectFiltersEl = document.getElementById('project-filters');

const errorBanner = document.getElementById('error-banner');
const errorText   = document.getElementById('error-text');

const confirmModal  = document.getElementById('confirm-modal');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmDelete = document.getElementById('confirm-delete');

const membersPanel    = document.getElementById('members-panel');
const newMemberInput  = document.getElementById('new-member-input');
const membersList     = document.getElementById('members-list');


// ─── Error Banner ─────────────────────────────────────────────────────────────

function showError(msg) {
    errorText.textContent = msg;
    errorBanner.classList.remove('hidden');
    // auto-hide after 5 seconds
    setTimeout(() => errorBanner.classList.add('hidden'), 5000);
}

function hideError() {
    errorBanner.classList.add('hidden');
}


// ─── Auth ─────────────────────────────────────────────────────────────────────

// On page load, check if the user already has a valid session
async function checkAuth() {
    try {
        const res  = await fetch(`${API}/me`, { credentials: 'include' });
        const data = await res.json();

        if (data.authenticated) {
            showApp();
        } else {
            showLogin();
        }
    } catch {
        // Server is unreachable
        showLogin();
        showError('Cannot reach the server. Make sure it is running.');
    }
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    app.classList.add('hidden');
}

function showApp() {
    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');
    init();
}

// Login button click
loginBtn.addEventListener('click', handleLogin);
loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

async function handleLogin() {
    const password = loginPassword.value;
    loginError.classList.add('hidden');

    try {
        const res  = await fetch(`${API}/login`, {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            credentials: 'include',
            body:        JSON.stringify({ password })
        });
        const data = await res.json();

        if (data.success) {
            loginPassword.value = '';
            showApp();
        } else {
            loginError.classList.remove('hidden');
        }
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
    const res = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });

    // Session expired — redirect to login
    if (res.status === 401) {
        showLogin();
        throw new Error('Session expired');
    }

    return res.json();
}

async function fetchTasks()          { return (await apiFetch(`${API}/tasks`)).tasks; }
async function fetchMembers()        { return (await apiFetch(`${API}/members`)).members; }

async function createTask(task) {
    return apiFetch(`${API}/tasks`, { method: 'POST', body: JSON.stringify(task) });
}

async function updateTask(id, changes) {
    return apiFetch(`${API}/tasks/${id}`, { method: 'PUT', body: JSON.stringify(changes) });
}

async function removeTask(id) {
    return apiFetch(`${API}/tasks/${id}`, { method: 'DELETE' });
}

async function createMember(name) {
    return apiFetch(`${API}/members`, { method: 'POST', body: JSON.stringify({ name }) });
}

async function removeMember(id) {
    return apiFetch(`${API}/members/${id}`, { method: 'DELETE' });
}


// ─── Members Panel ────────────────────────────────────────────────────────────

function openMembersPanel()  { membersPanel.classList.remove('hidden'); }
function closeMembersPanel() { membersPanel.classList.add('hidden');    }

// Close panel when clicking the dark backdrop
membersPanel.addEventListener('click', e => {
    if (e.target === membersPanel) closeMembersPanel();
});

async function renderMembersPanel() {
    const members = await fetchMembers();

    // Rebuild the member dropdown in the form
    memberSelect.innerHTML = '<option value="">Assign to...</option>';
    members.forEach(m => {
        const opt   = document.createElement('option');
        opt.value   = m.name;
        opt.textContent = m.name;
        memberSelect.appendChild(opt);
    });

    // Rebuild the panel list
    membersList.innerHTML = '';
    if (members.length === 0) {
        membersList.innerHTML = `<p class="font-dm-sans text-[13px] text-text-muted">No members yet. Add one above.</p>`;
        return;
    }

    members.forEach(m => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-bg-element border border-border-strong rounded-[10px] px-[14px] py-[10px]';
        row.innerHTML = `
            <div class="flex items-center gap-[10px]">
                <span class="w-[28px] h-[28px] bg-border-strong rounded-full flex items-center justify-center text-[12px] font-bold text-text-light uppercase">
                    ${m.name.charAt(0)}
                </span>
                <span class="font-dm-sans text-[14px] text-text-main">${m.name}</span>
            </div>
            <button onclick="deleteMember(${m.id})"
                class="text-text-muted hover:text-status-danger transition-colors cursor-pointer text-[16px]">✕</button>
        `;
        membersList.appendChild(row);
    });
}

async function addMember() {
    const name = newMemberInput.value.trim();
    if (!name) return;

    const result = await createMember(name);
    if (!result.success) {
        showError(result.message || 'Failed to add member');
        return;
    }

    newMemberInput.value = '';
    await renderMembersPanel();
}

newMemberInput.addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });

async function deleteMember(id) {
    const result = await removeMember(id);
    if (!result.success) { showError('Failed to remove member'); return; }
    await renderMembersPanel();
}


// ─── Delete Confirmation Modal ────────────────────────────────────────────────

confirmCancel.addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    pendingDeleteId = null;
});

confirmDelete.addEventListener('click', async () => {
    if (pendingDeleteId === null) return;
    confirmModal.classList.add('hidden');

    const result = await removeTask(pendingDeleteId);
    pendingDeleteId = null;

    if (!result.success) { showError('Failed to delete task'); return; }
    await renderTasks();
});

function askDeleteConfirmation(id) {
    pendingDeleteId = id;
    confirmModal.classList.remove('hidden');
}

// Close modal on backdrop click
confirmModal.addEventListener('click', e => {
    if (e.target === confirmModal) {
        confirmModal.classList.add('hidden');
        pendingDeleteId = null;
    }
});


// ─── Task Form Actions ────────────────────────────────────────────────────────

addBtn.addEventListener('click', handleAdd);

async function handleAdd() {
    const title       = titleInput.value.trim();
    const member      = memberSelect.value.trim();
    const project     = projectInput.value.trim();
    const dueDate     = dueDateInput.value;
    const status      = statusSelect.value;
    const priority    = prioritySelect.value;
    const description = descInput.value.trim();

    if (!title || !member) {
        showError('Please fill in the task title and assign a member');
        return;
    }

    hideError();

    if (editingTaskId) {
        const result = await updateTask(editingTaskId, { title, member, project, dueDate, status, priority, description });
        if (!result.success) { showError('Failed to update task'); return; }
        editingTaskId = null;
        addBtn.textContent = '+ Add';
    } else {
        const result = await createTask({ title, member, project, dueDate, status, priority, description });
        if (!result.success) { showError('Failed to add task'); return; }
    }

    clearForm();
    await renderTasks();
}

function clearForm() {
    titleInput.value     = '';
    memberSelect.value   = '';
    projectInput.value   = '';
    dueDateInput.value   = '';
    statusSelect.value   = 'To Do';
    prioritySelect.value = 'Low';
    descInput.value      = '';
}

async function editTask(id) {
    const tasks = await fetchTasks();
    const task  = tasks.find(t => t.id === id);
    if (!task) return;

    titleInput.value     = task.title;
    memberSelect.value   = task.member;
    projectInput.value   = task.project     || '';
    dueDateInput.value   = task.dueDate     || '';
    statusSelect.value   = task.status;
    prioritySelect.value = task.priority;
    descInput.value      = task.description || '';

    editingTaskId      = id;
    addBtn.textContent = 'Update Task';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function changeStatus(id, newStatus) {
    try {
        await updateTask(id, { status: newStatus });
        await renderTasks();
    } catch {
        showError('Failed to change status');
    }
}


// ─── Search ───────────────────────────────────────────────────────────────────

searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.toLowerCase().trim();
    renderTasks();
});


// ─── Filters ─────────────────────────────────────────────────────────────────

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
        <button data-project="all" onclick="setFilter('all')"
            class="filter-btn ${activeFilter === 'all' ? 'active-filter' : ''} font-dm-sans text-[12px] font-medium px-[14px] py-[6px] rounded-full border transition-all duration-200 cursor-pointer">
            All Projects
        </button>
    `;

    projects.forEach(project => {
        const btn = document.createElement('button');
        btn.dataset.project = project;
        btn.onclick = () => setFilter(project);
        btn.className = `filter-btn ${activeFilter === project ? 'active-filter' : ''} font-dm-sans text-[12px] font-medium px-[14px] py-[6px] rounded-full border transition-all duration-200 cursor-pointer`;
        btn.textContent = project;
        projectFiltersEl.appendChild(btn);
    });
}


// ─── Drag and Drop ────────────────────────────────────────────────────────────

let draggedId = null;

function onDragStart(e, id) {
    draggedId = id;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('drag-over'));
}

// Wire up the three drop zones
document.querySelectorAll('.drop-zone').forEach(zone => {
    zone.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', e => {
        // only remove highlight if leaving the zone itself, not a child
        if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', async e => {
        e.preventDefault();
        zone.classList.remove('drag-over');

        const newStatus = zone.dataset.status;
        if (draggedId && newStatus) {
            await updateTask(draggedId, { status: newStatus });
            draggedId = null;
            await renderTasks();
        }
    });
});


// ─── Render ───────────────────────────────────────────────────────────────────

function showLoadingSkeleton() {
    const skeleton = `<div class="skeleton h-[140px] w-full"></div>`;
    todoContainer.innerHTML     = skeleton + skeleton;
    progressContainer.innerHTML = skeleton;
    doneContainer.innerHTML     = skeleton + skeleton;
}

async function renderTasks() {
    const allTasks = await fetchTasks();

    buildFilterButtons(allTasks);

    // Apply project filter
    let tasks = activeFilter === 'all'
        ? allTasks
        : allTasks.filter(t => t.project === activeFilter);

    // Apply search filter
    if (searchQuery) {
        tasks = tasks.filter(t =>
            t.title.toLowerCase().includes(searchQuery)       ||
            t.member.toLowerCase().includes(searchQuery)      ||
            (t.project     && t.project.toLowerCase().includes(searchQuery)) ||
            (t.description && t.description.toLowerCase().includes(searchQuery))
        );
    }

    todoContainer.innerHTML     = '';
    progressContainer.innerHTML = '';
    doneContainer.innerHTML     = '';

    let todo = 0, progress = 0, done = 0;

    tasks.forEach(task => {
        const el = createTaskElement(task);
        if (task.status === 'To Do')       { todoContainer.appendChild(el);     todo++;     }
        if (task.status === 'In Progress') { progressContainer.appendChild(el); progress++; }
        if (task.status === 'Done')        { doneContainer.appendChild(el);     done++;     }
    });

    if (todo === 0)     todoContainer.innerHTML     = emptyState();
    if (progress === 0) progressContainer.innerHTML = emptyState();
    if (done === 0)     doneContainer.innerHTML     = emptyState();

    todoCount.textContent        = todo;
    progressCount.textContent    = progress;
    doneCount.textContent        = done;
    headerTotalCount.textContent = allTasks.length;
    headerDoneCount.textContent  = allTasks.filter(t => t.status === 'Done').length;
}

function isOverdue(dueDate, status) {
    if (!dueDate || status === 'Done') return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
}

function formatDate(dueDate, status) {
    if (!dueDate) return '';
    const date     = new Date(dueDate);
    const overdue  = isOverdue(dueDate, status);
    const label    = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const color    = overdue ? 'text-status-danger' : 'text-text-muted';
    const icon     = overdue ? '⚠ ' : '📅 ';
    return `<span class="font-dm-sans text-[11px] ${color}">${icon}${label}${overdue ? ' · Overdue' : ''}</span>`;
}

function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = `task-card bg-bg-element border border-border-strong rounded-[14px] p-[16px] flex flex-col gap-[12px] hover:border-brand transition-all duration-300 hover:-translate-y-1 cursor-grab active:cursor-grabbing ${isOverdue(task.dueDate, task.status) ? 'overdue-card' : ''}`;
    div.draggable = true;
    div.dataset.id = task.id;

    div.addEventListener('dragstart', e => onDragStart(e, task.id));
    div.addEventListener('dragend',   e => onDragEnd(e));

    const projectBadge = task.project
        ? `<span class="font-dm-sans text-[10px] font-semibold uppercase tracking-[0.6px] px-[8px] py-[3px] rounded-full bg-brand/10 border border-brand/20 text-brand cursor-pointer hover:bg-brand/20 transition-colors" onclick="setFilter('${escapeAttr(task.project)}')" title="Filter by ${escapeAttr(task.project)}">⬡ ${task.project}</span>`
        : '';

    const dateLine = formatDate(task.dueDate, task.status);

    const descriptionBlock = task.description
        ? `<p class="font-dm-sans text-[12px] text-text-muted leading-[1.6]">${task.description}</p>`
        : '';

    div.innerHTML = `
        <div class="flex items-start justify-between gap-[8px]">
            <h4 class="font-dm-sans font-medium text-text-main text-[15px] leading-snug">${task.title}</h4>
            ${projectBadge}
        </div>

        ${descriptionBlock}

        <div class="flex items-center justify-between">
            <div class="avatar-wrap flex items-center gap-[8px]">
                <span class="w-[24px] h-[24px] bg-border-strong rounded-full flex items-center justify-center text-[11px] font-bold text-text-light uppercase">
                    ${task.member.charAt(0)}
                </span>
                <span class="font-dm-sans text-[13px] text-text-muted">${task.member}</span>
            </div>
            <span class="${priorityClass(task.priority)} border font-dm-sans font-bold text-[11px] tracking-[0.5px] uppercase px-[10px] py-[4px] rounded-full">
                ${task.priority}
            </span>
        </div>

        ${dateLine ? `<div>${dateLine}</div>` : ''}

        <hr class="border-border-strong">

        <div class="flex items-center gap-[10px]">
            <div class="relative flex-1">
                <select onchange="changeStatus(${task.id}, this.value)"
                    class="w-full bg-bg-surface border border-border-strong rounded-[8px] px-[12px] py-[8px] text-text-main font-dm-sans text-[13px] outline-none appearance-none cursor-pointer pr-[32px] transition-all duration-300">
                    <option ${task.status === 'To Do'       ? 'selected' : ''}>To Do</option>
                    <option ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option ${task.status === 'Done'        ? 'selected' : ''}>Done</option>
                </select>
                <div class="absolute right-[10px] top-1/2 -translate-y-1/2 pointer-events-none text-text-muted text-[10px]">▼</div>
            </div>
            <button onclick="editTask(${task.id})"
                class="p-[8px] border border-border-strong rounded-[8px] hover:bg-border-subtle transition-colors cursor-pointer">
                <img src="assets/icon (1).png" alt="Edit" class="w-[14px] h-[14px]">
            </button>
            <button onclick="askDeleteConfirmation(${task.id})"
                class="p-[8px] border border-border-strong rounded-[8px] hover:bg-status-danger/20 transition-colors cursor-pointer">
                <img src="assets/icon.png" alt="Delete" class="w-[14px] h-[14px]">
            </button>
        </div>
    `;

    return div;
}

function priorityClass(p) {
    if (p === 'High')   return 'bg-status-danger/10 border-status-danger/20 text-status-danger';
    if (p === 'Medium') return 'bg-status-progress/10 border-status-progress/20 text-status-progress';
    return 'bg-status-done/10 border-status-done/20 text-status-done';
}

function emptyState() {
    return `
        <div class="flex-1 flex flex-col items-center justify-center py-[40px] text-text-muted">
            <div class="w-[48px] h-[48px] border-2 border-dashed border-border-strong rounded-[12px] flex items-center justify-center mb-[12px]">
                <img src="assets/union-1.png" alt="Empty" class="w-[20px] h-[20px]">
            </div>
            <p class="font-dm-sans text-[14px] text-text-muted">Empty</p>
        </div>`;
}

function escapeAttr(str) {
    return str.replace(/'/g, "\\'");
}


// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
    showLoadingSkeleton();
    try {
        await renderMembersPanel();
        await renderTasks();
    } catch (err) {
        showError('Failed to load data. Is the server running?');
    }
}

// ─── Create .gitignore reminder ───────────────────────────────────────────────
// (handled by the .gitignore file — see project root)

checkAuth();