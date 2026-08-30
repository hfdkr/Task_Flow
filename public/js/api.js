// ─── API Helpers ──────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options, credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    if (res.status === 401) { showLogin(); throw new Error('Session expired'); }
    return res.json();
}

async function fetchTasks()   { return (await apiFetch(`${API}/tasks`)).tasks; }
async function fetchMembers() { return (await apiFetch(`${API}/members`)).members; }
async function createTask(task)   { return apiFetch(`${API}/tasks`,       { method: 'POST',   body: JSON.stringify(task) }); }
async function updateTask(id, c)  { return apiFetch(`${API}/tasks/${id}`, { method: 'PUT',    body: JSON.stringify(c) }); }
async function removeTask(id)     { return apiFetch(`${API}/tasks/${id}`, { method: 'DELETE' }); }
async function createMember(name) { return apiFetch(`${API}/members`,       { method: 'POST',   body: JSON.stringify({ name }) }); }
async function removeMember(id)   { return apiFetch(`${API}/members/${id}`, { method: 'DELETE' }); }
async function fetchProjects()    { return (await apiFetch(`${API}/projects`)).projects; }
async function createProject(name){ return apiFetch(`${API}/projects`,       { method: 'POST',   body: JSON.stringify({ name }) }); }
async function removeProject(id)  { return apiFetch(`${API}/projects/${id}`, { method: 'DELETE' }); }

async function fetchAllUsers() {
    try { const data = await apiFetch(`${API}/admin/users`); return data.users || []; }
    catch { return []; }
}
