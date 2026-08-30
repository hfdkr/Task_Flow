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

// ─── Kanban Column Reordering — any signed-in user, saved per-browser ─────────
const COLUMN_ORDER_KEY = 'tf-column-order';
const DEFAULT_COLUMN_ORDER = ['To Do', 'In Progress', 'Done'];
let draggedColumnStatus = null;

function getColumnEl(status) {
    return document.querySelector(`.kanban-column[data-col-status="${status}"]`);
}

function applyColumnOrder(order) {
    const container = document.getElementById('kanban-columns-view');
    if (!container) return;
    order.forEach(status => {
        const el = getColumnEl(status);
        if (el) container.appendChild(el);
    });
}

function loadColumnOrder() {
    let order;
    try { order = JSON.parse(localStorage.getItem(COLUMN_ORDER_KEY)); } catch { order = null; }
    const isValid = Array.isArray(order) && order.length === DEFAULT_COLUMN_ORDER.length
        && DEFAULT_COLUMN_ORDER.every(s => order.includes(s));
    applyColumnOrder(isValid ? order : DEFAULT_COLUMN_ORDER);
}

function saveColumnOrder() {
    const order = [...document.querySelectorAll('.kanban-column')].map(el => el.dataset.colStatus);
    localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order));
}

function onColumnDragStart(e, status) {
    draggedColumnStatus = status;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', status);
    getColumnEl(status)?.classList.add('col-dragging');
}

function onColumnDragOver(e) {
    if (!draggedColumnStatus) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('col-drag-over');
}

function onColumnDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('col-drag-over');
}

function onColumnDrop(e, targetStatus) {
    e.preventDefault();
    e.currentTarget.classList.remove('col-drag-over');
    if (!draggedColumnStatus || draggedColumnStatus === targetStatus) return;
    const container = document.getElementById('kanban-columns-view');
    const draggedEl = getColumnEl(draggedColumnStatus);
    const targetEl  = getColumnEl(targetStatus);
    if (!container || !draggedEl || !targetEl) return;
    const columns   = [...container.children];
    const fromAfter = columns.indexOf(draggedEl) < columns.indexOf(targetEl);
    container.insertBefore(draggedEl, fromAfter ? targetEl.nextSibling : targetEl);
    saveColumnOrder();
}

function onColumnDragEnd() {
    document.querySelectorAll('.kanban-column').forEach(el => el.classList.remove('col-dragging', 'col-drag-over'));
    draggedColumnStatus = null;
}

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
