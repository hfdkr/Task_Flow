// Import required libraries
const express = require('express'); // framework to build the API
const cors = require('cors'); // allows the frontend to communicate with the backend

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// start the server and listen on the defined port

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const path = require('path'); // library for handling file paths

// serve frontend files (index.html, assets...) directly from the same folder
app.use(express.static(__dirname));

// ─── Data File Setup ────
const fs = require('fs');

// full path to data.json which stores all tasks
const DATA_FILE = path.join(__dirname, 'data.json');

// ─── Read Tasks from File ─────────────────────
function readTasks() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks: [] }, null, 2));
    }
    // read the file content as a string
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw).tasks;
}

// ─── Write Tasks to File ───────────
function writeTasks(tasks) {
     // convert the tasks array to JSON and save it to the file
    fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks }, null, 2));
}

// ─── GET /api/tasks ────────
// returns all tasks stored in the file
app.get('/api/tasks', (req, res) => {
    try {
        const tasks = readTasks(); // read tasks from data.json
        res.json({ success: true, tasks }); // send them back as JSON
    } catch (err) {
        res.status(500).json({ success: false }); // something went wrong on the serve
    }
});

// ─── POST /api/tasks ──────────────────────────
// creates a new task and saves it to the file
app.post('/api/tasks', (req, res) => {
    try {
        // extract the fields sent by the frontend
        const { title, member, status, priority } = req.body;

        // validate: title and member are required
        if (!title || !member) {
            return res.status(400).json({ message: 'Title and member required' });
        }

        const tasks = readTasks(); // load existing tasks
        // build the new task object
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

// ─── PUT /api/tasks/:id ───────
// updates an existing task by its ID
app.put('/api/tasks/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id); // get the task ID from the URL
        const { title, member, status, priority } = req.body; // get updated fields

        const tasks = readTasks(); // load all tasks
        const index = tasks.findIndex(t => t.id === id); // find the task position

        // if no task found with that ID, return 404
        if (index === -1) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // merge the old task with the new values (only update fields that were sent)
        const updated = {
            ...tasks[index], // keep all existing fields
            ...(title && { title }),
            ...(member && { member }),
            ...(status && { status }),
            ...(priority && { priority }),
            updatedAt: new Date().toISOString()
        };

        tasks[index] = updated; // replace the old task with the updated one
        writeTasks(tasks);  // save to the file

        res.json({ success: true, task: updated });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// ─── DELETE /api/tasks/:id ───────
// deletes a task by its ID
app.delete('/api/tasks/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);  // get the task ID from the URL
        let tasks = readTasks();  // load all tasks

        // check if the task actually exists

        const exists = tasks.some(t => t.id === id);
        if (!exists) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // remove the task by filtering it out of the array
        tasks = tasks.filter(t => t.id !== id);
        writeTasks(tasks); // save the updated array to the file

        res.json({ success: true, message: 'Task deleted' });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});