// Data store — backed by Vercel KV (Upstash Redis under the hood).
//
// Vercel serverless functions have no writable/persistent local disk (every
// invocation can run on a fresh container, and /tmp is wiped between them),
// so this can no longer be a JSON file on disk. Instead the whole dataset is
// kept as one JSON document in Vercel KV. Every function call in this file
// is now async — callers must `await` them.
//
// Locally (outside Vercel) this still works as long as KV_REST_API_URL /
// KV_REST_API_TOKEN are set in your .env (see .env.example) — `vercel env
// pull` writes them for you.

const { kv } = require('./kvClient');

const DATA_KEY = 'taskflow:data';

async function readData() {
    let data = await kv.get(DATA_KEY);
    if (!data) {
        data = { tasks: [], members: [], projects: [], users: [] };
        await kv.set(DATA_KEY, data);
    }
    if (!data.members)  data.members  = [];
    if (!data.projects) data.projects = [];
    if (!data.users)    data.users    = [];
    return data;
}

async function writeData(data) {
    await kv.set(DATA_KEY, data);
}

const readTasks    = async () => (await readData()).tasks;
const readMembers  = async () => (await readData()).members;
const readProjects = async () => (await readData()).projects || [];
const readUsers    = async () => (await readData()).users || [];

async function writeTasks(tasks)       { const d = await readData(); d.tasks    = tasks;    await writeData(d); }
async function writeMembers(members)   { const d = await readData(); d.members  = members;  await writeData(d); }
async function writeProjects(projects) { const d = await readData(); d.projects = projects; await writeData(d); }
async function writeUsers(users)       { const d = await readData(); d.users    = users;    await writeData(d); }

module.exports = {
    readData, writeData,
    readTasks, readMembers, readProjects, readUsers,
    writeTasks, writeMembers, writeProjects, writeUsers,
};
