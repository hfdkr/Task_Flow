// ─── API Base URL ─────────────────────────────────────────────────────────────
const API = 'http://localhost:3000/api';


// ─── DOM References ─────────────────
const titleInput    = document.querySelectorAll("input")[0];
const memberInput   = document.querySelectorAll("input")[1];
const projectInput  = document.querySelectorAll("input")[2];

const statusSelect   = document.querySelectorAll("select")[0];
const prioritySelect = document.querySelectorAll("select")[1];

const addButton = document.querySelector("button");

const todoContainer     = document.getElementById("todo-container");
const progressContainer = document.getElementById("inprogress-container");
const doneContainer     = document.getElementById("done-container");

const todoCount     = document.getElementById("todo-count");
const progressCount = document.getElementById("inprogress-count");
const doneCount     = document.getElementById("done-count");

const headerTotalCount = document.getElementById("header-total-count");
const headerDoneCount  = document.getElementById("header-done-count");

const projectFiltersEl = document.getElementById("project-filters");

let editingTaskId    = null;
let activeFilter     = 'all';

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function fetchTasks() {
    const res  = await fetch(`${API}/tasks`);
    const data = await res.json();
    return data.tasks;
}

async function createTask(task) {
    const res = await fetch(`${API}/tasks`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(task)
    });
    return res.json();
}

async function updateTask(id, changes) {
    const res = await fetch(`${API}/tasks/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(changes)
    });
    return res.json();
}

async function removeTask(id) {
    const res = await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
    return res.json();
}


// ─── Filter ───────────────────────────────────────────────────────────────────

function setFilter(project) {
    activeFilter = project;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.project === project) {
            btn.classList.add('active-filter');
        } else {
            btn.classList.remove('active-filter');
        }
    });

    renderTasks();
}

function buildFilterButtons(tasks) {
    // Collect unique, non-empty project names
    const projects = [...new Set(
        tasks.map(t => t.project).filter(p => p && p.trim())
    )].sort();

    // Keep "All Projects" button, rebuild the rest
    projectFiltersEl.innerHTML = `
        <button
            data-project="all"
            onclick="setFilter('all')"
            class="filter-btn ${activeFilter === 'all' ? 'active-filter' : ''} font-dm-sans text-[12px] font-medium px-[14px] py-[6px] rounded-full border border-border-strong text-text-muted transition-all duration-200 cursor-pointer">
            All Projects
        </button>
    `;

    projects.forEach(project => {
        const btn = document.createElement('button');
        btn.dataset.project = project;
        btn.onclick = () => setFilter(project);
        btn.className = `filter-btn ${activeFilter === project ? 'active-filter' : ''} font-dm-sans text-[12px] font-medium px-[14px] py-[6px] rounded-full border border-border-strong text-text-muted transition-all duration-200 cursor-pointer`;
        btn.textContent = project;
        projectFiltersEl.appendChild(btn);
    });
}


// ─── Actions ──────────────────────────────────────────────────────────────────

addButton.addEventListener('click', handleAdd);

async function handleAdd() {
    const title    = titleInput.value.trim();
    const member   = memberInput.value.trim();
    const project  = projectInput.value.trim();
    const status   = statusSelect.value;
    const priority = prioritySelect.value;

    if (!title || !member) {
        alert('Please fill in title and assigned member');
        return;
    }

    if (editingTaskId) {
        const result = await updateTask(editingTaskId, { title, member, project, status, priority });

        if (!result.success) {
            alert('Failed to update task');
            return;
        }

        editingTaskId = null;
        addButton.innerHTML = '+ Add';

    } else {
        const result = await createTask({ title, member, project, status, priority });

        if (!result.success) {
            alert('Failed to add task');
            return;
        }
    }

    clearInputs();
    await renderTasks();
}

async function deleteTask(id) {
    const result = await removeTask(id);
    if (!result.success) {
        alert('Failed to delete task');
        return;
    }
    await renderTasks();
}

async function editTask(id) {
    const tasks = await fetchTasks();
    const task  = tasks.find(t => t.id === id);

    if (!task) return;

    titleInput.value     = task.title;
    memberInput.value    = task.member;
    projectInput.value   = task.project || '';
    statusSelect.value   = task.status;
    prioritySelect.value = task.priority;

    editingTaskId = id;
    addButton.innerHTML = 'Update Task';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function changeStatus(id, newStatus) {
    await updateTask(id, { status: newStatus });
    await renderTasks();
}


// ─── Render ───────────────────────────────────────────────────────────────────

function clearInputs() {
    titleInput.value     = '';
    memberInput.value    = '';
    projectInput.value   = '';
    statusSelect.value   = 'To Do';
    prioritySelect.value = 'Low';
}

async function renderTasks() {
    const allTasks = await fetchTasks();

    // Rebuild filter buttons from full task list
    buildFilterButtons(allTasks);

    // Apply active filter
    const tasks = activeFilter === 'all'
        ? allTasks
        : allTasks.filter(t => t.project === activeFilter);

    todoContainer.innerHTML     = '';
    progressContainer.innerHTML = '';
    doneContainer.innerHTML     = '';

    let todo = 0, progress = 0, done = 0;

    tasks.forEach(task => {
        const card = createTaskCard(task);

        if (task.status === 'To Do')       { todoContainer.innerHTML     += card; todo++;     }
        if (task.status === 'In Progress') { progressContainer.innerHTML += card; progress++; }
        if (task.status === 'Done')        { doneContainer.innerHTML     += card; done++;     }
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


function createTaskCard(task) {
    const projectBadge = task.project
        ? `<span class="font-dm-sans text-[10px] font-semibold uppercase tracking-[0.6px] px-[8px] py-[3px] rounded-full bg-brand/10 border border-brand/20 text-brand cursor-pointer hover:bg-brand/20 transition-colors" onclick="setFilter('${escapeAttr(task.project)}')" title="Filter by ${escapeAttr(task.project)}">
               ⬡ ${task.project}
           </span>`
        : '';

    return `
        <div class="bg-bg-element border border-border-strong rounded-[14px] p-[16px] flex flex-col gap-[16px] hover:border-brand transition-all duration-300 hover:-translate-y-1">

            <div class="flex items-start justify-between gap-[8px]">
                <h4 class="font-dm-sans font-medium text-text-main text-[16px]">
                    ${task.title}
                </h4>
                ${projectBadge}
            </div>

            <div class="flex items-center justify-between">
                <div class="flex items-center gap-[8px]">
                    <span class="w-[24px] h-[24px] bg-border-strong rounded-full flex items-center justify-center text-[11px] font-bold text-text-light uppercase">
                        ${task.member.charAt(0)}
                    </span>
                    <span class="font-dm-sans text-[13px] text-text-muted">
                        ${task.member}
                    </span>
                </div>
                <span class="${priorityClass(task.priority)} border font-dm-sans font-bold text-[11px] tracking-[0.5px] uppercase px-[10px] py-[4px] rounded-full">
                    ${task.priority}
                </span>
            </div>

            <hr class="border-border-strong">

            <div class="flex items-center gap-[12px]">
                <div class="relative flex-1">
                    <select
                        onchange="changeStatus(${task.id}, this.value)"
                        class="w-full bg-bg-surface border border-border-strong rounded-[8px] px-[12px] py-[8px] text-text-main font-dm-sans text-[13px] outline-none appearance-none cursor-pointer pr-[40px] transition-all duration-300">
                        <option ${task.status === 'To Do'       ? 'selected' : ''}>To Do</option>
                        <option ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option ${task.status === 'Done'        ? 'selected' : ''}>Done</option>
                    </select>
                    <div class="absolute right-[12px] top-1/2 -translate-y-1/2 pointer-events-none text-text-muted transition-transform duration-300">▼</div>
                </div>

                <button onclick="editTask(${task.id})"
                    class="p-[8px] border border-border-strong rounded-[8px] hover:bg-border-subtle transition-colors cursor-pointer">
                    <img src="assets/icon (1).png" alt="Edit" class="w-[14px] h-[14px]">
                </button>

                <button onclick="deleteTask(${task.id})"
                    class="p-[8px] border border-border-strong rounded-[8px] hover:bg-status-danger/20 transition-colors cursor-pointer">
                    <img src="assets/icon.png" alt="Delete" class="w-[14px] h-[14px]">
                </button>
            </div>

        </div>
    `;
}

function escapeAttr(str) {
    return str.replace(/'/g, "\\'");
}

function priorityClass(priority) {
    if (priority === 'High')   return 'bg-status-danger/10 border-status-danger/20 text-status-danger';
    if (priority === 'Medium') return 'bg-status-progress/10 border-status-progress/20 text-status-progress';
    return 'bg-status-done/10 border-status-done/20 text-status-done';
}

function emptyState() {
    return `
        <div class="flex-1 flex flex-col items-center justify-center py-[40px] text-text-muted h-full">
            <div class="w-[48px] h-[48px] border-2 border-dashed border-border-strong rounded-[12px] flex items-center justify-center mb-[12px]">
                <img src="assets/union-1.png" alt="Empty" class="w-[20px] h-[20px]">
            </div>
            <p class="font-dm-sans text-[14px] text-text-muted">Empty</p>
        </div>
    `;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
renderTasks();