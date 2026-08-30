const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

function readData() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks: [], members: [], projects: [], users: [] }, null, 2));
    }
    const raw  = fs.readFileSync(DATA_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.members)  data.members  = [];
    if (!data.projects) data.projects = [];
    if (!data.users)    data.users    = [];
    return data;
}

function writeData(data) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const readTasks    = () => readData().tasks;
const readMembers  = () => readData().members;
const readProjects = () => readData().projects || [];
const readUsers    = () => readData().users || [];

function writeTasks(tasks)       { const d = readData(); d.tasks    = tasks;    writeData(d); }
function writeMembers(members)   { const d = readData(); d.members  = members;  writeData(d); }
function writeProjects(projects) { const d = readData(); d.projects = projects; writeData(d); }
function writeUsers(users)       { const d = readData(); d.users    = users;    writeData(d); }

module.exports = {
    DATA_FILE,
    readData, writeData,
    readTasks, readMembers, readProjects, readUsers,
    writeTasks, writeMembers, writeProjects, writeUsers,
};
