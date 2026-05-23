// ─── API Base URL ─────────────────────────────────────────────────────────────
const API = 'http://localhost:3000/api';


// ─── DOM References ─────────────────
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

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function fetchTasks() {
    const res = await fetch(`${API}/tasks`);
    const data = await res.json();
    return data.tasks;
}

async function createTask(task) {
    const res = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
    });
    return res.json();
}

async function updateTask(id, changes) {
    const res = await fetch(`${API}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes)
    });
    return res.json();
}

async function removeTask(id) {
    const res = await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
    return res.json();
}


// ─── Actions ──────────────────────────────────────────────────────────────────

addButton.addEventListener('click', handleAdd);

async function handleAdd() {
    const title    = titleInput.value.trim();
    const member   = memberInput.value.trim();
    const status   = statusSelect.value;
    const priority = prioritySelect.value;

    if (!title || !member) {
        alert('Please fill all fields');
        return;
    }

    if (editingTaskId) {
        // Update existing task
        const result = await updateTask(editingTaskId, { title, member, status, priority });

        if (!result.success) {
            alert('Failed to update task');
            return;
        }

        editingTaskId = null;
        addButton.innerHTML = '+ Add';

    } else {
        // Create new task
        const result = await createTask({ title, member, status, priority });

        if (!result.success) {
            alert('Failed to add task');
            return;
        }
    }

    clearInputs();
    await renderTasks();
}
