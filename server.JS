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

app.post('/api/tasks', (req, res) => {
    try {
        const { title, member, status, priority } = req.body;

        if (!title || !member) {
            return res.status(400).json({ message: 'Title and member required' });
        }

        const tasks = readTasks();

        const newTask = {
            id: Date.now(),
            title,
            member,
            status,
            priority,
            createdAt: new Date().toISOString()
        };

        tasks.push(newTask);
        writeTasks(tasks);

        res.status(201).json({ success: true, task: newTask });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/tasks/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { title, member, status, priority } = req.body;

        const tasks = readTasks();
        const index = tasks.findIndex(t => t.id === id);

        if (index === -1) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const updated = {
            ...tasks[index],
            ...(title && { title }),
            ...(member && { member }),
            ...(status && { status }),
            ...(priority && { priority }),
            updatedAt: new Date().toISOString()
        };

        tasks[index] = updated;
        writeTasks(tasks);

        res.json({ success: true, task: updated });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});