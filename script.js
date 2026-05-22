const titleInput = document.querySelectorAll("input")[0];
const memberInput = document.querySelectorAll("input")[1];

const statusSelect = document.querySelectorAll("select")[0];
const prioritySelect = document.querySelectorAll("select")[1];

const addButton = document.querySelector("button");

const todoContainer = document.getElementById("todo-container");
const progressContainer = document.getElementById("inprogress-container");
const doneContainer = document.getElementById("done-container");

const todoCount = document.getElementById("todo-count");
const progressCount = document.getElementById("inprogress-count");
const doneCount = document.getElementById("done-count");

const headerTotalCount = document.getElementById("header-total-count");

const headerDoneCount = document.getElementById("header-done-count");

let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

let editingTaskId = null;

function saveToLocalStorage() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

addButton.addEventListener('click', addTask);

function addTask() {

    const title = titleInput.value.trim();
    const member = memberInput.value.trim();

    const status = statusSelect.value;
    const priority = prioritySelect.value;

    if (!title || !member) {

        alert('Please fill all fields');

        return;
    }

    if (editingTaskId) {

        tasks = tasks.map(task => {

            if (task.id === editingTaskId) {

                return {
                    ...task,
                    title,
                    member,
                    status,
                    priority
                };
            }

            return task;
        });

        editingTaskId = null;

        addButton.innerHTML = '+ Add';

    } else {

        const task = {
            id: Date.now(),
            title,
            member,
            status,
            priority
        };

        tasks.push(task);
    }

    saveToLocalStorage();

    clearInputs();

    renderTasks();
}

function clearInputs() {

    titleInput.value = '';
    memberInput.value = '';

    statusSelect.value = 'To Do';
    prioritySelect.value = 'Low';
}

function deleteTask(id) {

    tasks = tasks.filter(task => task.id !== id);

    saveToLocalStorage();

    renderTasks();
}

function editTask(id) {

    const task = tasks.find(task => task.id === id);

    if (!task) return;

    titleInput.value = task.title;
    memberInput.value = task.member;

    statusSelect.value = task.status;
    prioritySelect.value = task.priority;

    editingTaskId = id;

    addButton.innerHTML = 'Update Task';

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

function changeStatus(id, newStatus) {

    tasks = tasks.map(task => {

        if (task.id === id) {

            return {
                ...task,
                status: newStatus
            };
        }

        return task;
    });

    saveToLocalStorage();

    renderTasks();
}

function renderTasks() {

    todoContainer.innerHTML = '';
    progressContainer.innerHTML = '';
    doneContainer.innerHTML = '';

    let todo = 0;
    let progress = 0;
    let done = 0;

    tasks.forEach(task => {

        const card = createTaskCard(task);

        if (task.status === 'To Do') {

            todoContainer.innerHTML += card;

            todo++;
        }

        if (task.status === 'In Progress') {

            progressContainer.innerHTML += card;

            progress++;
        }

        if (task.status === 'Done') {

            doneContainer.innerHTML += card;

            done++;
        }
    });

    if (todo === 0) {

        todoContainer.innerHTML = emptyState();
    }

    if (progress === 0) {

        progressContainer.innerHTML = emptyState();
    }

    if (done === 0) {

        doneContainer.innerHTML = emptyState();
    }

    todoCount.textContent = todo;
    progressCount.textContent = progress;
    doneCount.textContent = done;

    headerTotalCount.textContent = tasks.length;
    headerDoneCount.textContent = done;
}

function createTaskCard(task) {

    return `
    
        <div class="bg-bg-element border border-border-strong rounded-[14px] p-[16px] flex flex-col gap-[16px] hover:border-brand transition-all duration-300 hover:-translate-y-1">

            <h4 class="font-dm-sans font-medium text-text-main text-[16px]">

                ${task.title}

            </h4>

            <div class="flex items-center justify-between">

                <div class="flex items-center gap-[8px]">

                    <span
                        class="w-[24px] h-[24px] bg-border-strong rounded-full flex items-center justify-center text-[11px] font-bold text-text-light uppercase">

                        ${task.member.charAt(0)}

                    </span>

                    <span class="font-dm-sans text-[13px] text-text-muted">

                        ${task.member}

                    </span>

                </div>

                <span
                    class="${priorityClass(task.priority)} border font-dm-sans font-bold text-[11px] tracking-[0.5px] uppercase px-[10px] py-[4px] rounded-full">

                    ${task.priority}

                </span>

            </div>

            <hr class="border-border-strong">

            <div class="flex items-center gap-[12px]">

                <div class="relative flex-1">

                    <select
                        onchange="changeStatus(${task.id}, this.value)"
                        onfocus="this.nextElementSibling.classList.add('rotate-180')"
                        onblur="this.nextElementSibling.classList.remove('rotate-180')"
                        class="w-full bg-bg-surface border border-border-strong rounded-[8px] px-[12px] py-[8px] text-text-main font-dm-sans text-[13px] outline-none appearance-none cursor-pointer pr-[40px] transition-all duration-300">

                        <option ${task.status === 'To Do' ? 'selected' : ''}>
                            To Do
                        </option>

                        <option ${task.status === 'In Progress' ? 'selected' : ''}>
                            In Progress
                        </option>

                        <option ${task.status === 'Done' ? 'selected' : ''}>
                            Done
                        </option>

                    </select>

                    <div
                        class="absolute right-[12px] top-1/2 -translate-y-1/2 pointer-events-none text-text-muted transition-transform duration-300">

                        ▼

                    </div>

                </div>

                <button
                    onclick="editTask(${task.id})"
                    class="p-[8px] border border-border-strong rounded-[8px] hover:bg-border-subtle transition-colors cursor-pointer">

                    ✏️

                </button>

                <button
                    onclick="deleteTask(${task.id})"
                    class="p-[8px] border border-border-strong rounded-[8px] hover:bg-status-danger/20 transition-colors cursor-pointer">

                    🗑️

                </button>

            </div>

        </div>
    `;
}