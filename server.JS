const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const path = require('path');

app.use(express.static(__dirname));

const fs = require('fs');

const DATA_FILE = path.join(__dirname, 'data.json');

function readTasks() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks: [] }, null, 2));
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw).tasks;
}

function writeTasks(tasks) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks }, null, 2));
}

app.get('/api/tasks', (req, res) => {
    try {
        const tasks = readTasks();
        res.json({ success: true, tasks });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});