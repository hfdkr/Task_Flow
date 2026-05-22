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
