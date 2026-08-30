// ─── Members Panel ────────────────────────────────────────────────────────────
function openMembersPanel() { if (membersPanel) membersPanel.classList.remove('hidden'); }
function closeMembersPanel() { if (membersPanel) membersPanel.classList.add('hidden'); }
if (membersPanel) membersPanel.addEventListener('click', e => { if (e.target === membersPanel) closeMembersPanel(); });
if (newMemberInput) newMemberInput.addEventListener('keydown', e => { if (e.key === 'Enter') addMember(); });

const AVATAR_COLORS = [
    { bg: 'rgba(108,143,255,0.18)', border: 'rgba(108,143,255,0.35)', color: '#6c8fff' },
    { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.3)',    color: '#ef6060' },
    { bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.3)',   color: '#f59e0b' },
    { bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.3)',   color: '#10b981' },
    { bg: 'rgba(168,85,247,0.15)',  border: 'rgba(168,85,247,0.3)',   color: '#a855f7' },
    { bg: 'rgba(236,72,153,0.15)',  border: 'rgba(236,72,153,0.3)',   color: '#ec4899' },
];

function memberAvatarStyle(idx) {
    const c = AVATAR_COLORS[idx % AVATAR_COLORS.length];
    return `background:${c.bg};border:1.5px solid ${c.border};color:${c.color}`;
}

function memberInitials(name) {
    return String(name || '?').trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

async function renderMembersPanel() {
    const [members, users] = await Promise.all([fetchMembers(), fetchAllUsers()]);

    memberSelect.innerHTML = '<option value="">Assign to...</option>';
    const modalMemberSelect = document.getElementById('modal-member-select');
    if (modalMemberSelect) modalMemberSelect.innerHTML = '<option value="">Assign to...</option>';

    members.forEach(m => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = m.name;
        memberSelect.appendChild(opt);
        if (modalMemberSelect) {
            const opt2 = document.createElement('option');
            opt2.value = opt2.textContent = m.name;
            modalMemberSelect.appendChild(opt2);
        }
    });

    // ── Show/hide Add input for admin only ──
    const addMemberRow = document.getElementById('add-member-row');
    if (addMemberRow) addMemberRow.style.display = isAdmin() ? 'flex' : 'none';

    membersList.innerHTML = '';
    if (!members.length) {
        membersList.innerHTML = `<p style="font-size:13px;color:var(--text-muted)">No members yet.</p>`;
        return;
    }

    members.forEach((m, idx) => {
        const matchedUser = users.find(u => u.name.toLowerCase().trim() === m.name.toLowerCase().trim());
        const memberIsAdmin = matchedUser ? matchedUser.role === 'admin' : false;
        const avatarStyle = memberAvatarStyle(idx);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:var(--bg-element);border:1px solid var(--border-strong);border-radius:12px;padding:12px 16px;transition:border-color 0.18s';
        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px">
                <span style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;${avatarStyle}">${memberInitials(m.name)}</span>
                <div>
                    <div style="font-size:14px;font-weight:600;color:var(--text-main)">${m.name}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:1px">
                        ${memberIsAdmin ? `<span class="flex items-center gap-1" style="color:var(--brand);font-weight:600"><img class="w-[14px] h-[14px]" src="./assets/Icon (2).png" alt="Admin"> Admin</span>` : `Member`}
                    </div>
                </div>
            </div>
            ${isAdmin() ? `<button onclick="deleteMember(${m.id})" style="color:var(--text-muted);font-size:15px;cursor:pointer;background:none;border:none;transition:color 0.18s;padding:4px" onmouseover="this.style.color='var(--status-danger)'" onmouseout="this.style.color='var(--text-muted)'">✕</button>` : ''}`;
        membersList.appendChild(row);
    });
}

async function addMember() {
    if (!isAdmin()) return;
    const name = newMemberInput.value.trim();
    if (!name) return;
    const result = await createMember(name);
    if (!result.success) { showError(result.message || 'Failed to add member'); return; }
    newMemberInput.value = '';
    await renderMembersPanel();
    await renderDashboard();
}

async function deleteMember(id) {
    if (!isAdmin()) return;
    const result = await removeMember(id);
    if (!result.success) { showError('Failed to remove member'); return; }
    await renderMembersPanel();
    await renderDashboard();
}

// ─── Projects Panel ───────────────────────────────────────────────────────────
function openProjectsPanel() { if (projectsPanel) projectsPanel.classList.remove('hidden'); }
function closeProjectsPanel() { if (projectsPanel) projectsPanel.classList.add('hidden'); }
if (projectsPanel) projectsPanel.addEventListener('click', e => { if (e.target === projectsPanel) closeProjectsPanel(); });
if (newProjectInput) newProjectInput.addEventListener('keydown', e => { if (e.key === 'Enter') addProject(); });

async function renderProjectsPanel() {
    const projects = await fetchProjects();
    const current  = projectSelect.value;
    projectSelect.innerHTML = '<option value="">No project...</option>';
    const modalProjectSelect = document.getElementById('modal-project-select');
    if (modalProjectSelect) modalProjectSelect.innerHTML = '<option value="">No project...</option>';
    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = p.name;
        projectSelect.appendChild(opt);
        if (modalProjectSelect) {
            const opt2 = document.createElement('option');
            opt2.value = opt2.textContent = p.name;
            modalProjectSelect.appendChild(opt2);
        }
    });
    if (projects.some(p => p.name === current)) projectSelect.value = current;

    // ── Show/hide Add input for admin only ──
    const addProjectRow = document.getElementById('add-project-row');
    if (addProjectRow) addProjectRow.style.display = isAdmin() ? 'flex' : 'none';

    projectsList.innerHTML = '';
    if (!projects.length) {
        projectsList.innerHTML = `<p style="font-size:13px;color:var(--text-muted)">No projects yet.</p>`;
        return;
    }
    projects.forEach(p => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:var(--bg-element);border:1px solid var(--border-strong);border-radius:10px;padding:10px 14px';
        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px">
                <span style="width:30px;height:30px;background:var(--brand-dim);border:1px solid rgba(108,143,255,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--brand)">◫</span>
                <span style="font-size:14px;color:var(--text-main)">${p.name}</span>
            </div>
            ${isAdmin() ? `<button onclick="deleteProject(${p.id})" style="color:var(--text-muted);font-size:16px;cursor:pointer;background:none;border:none;transition:color 0.18s" onmouseover="this.style.color='var(--status-danger)'" onmouseout="this.style.color='var(--text-muted)'">✕</button>` : ''}`;
        projectsList.appendChild(row);
    });
}

async function addProject() {
    if (!isAdmin()) return;
    const name = newProjectInput.value.trim();
    if (!name) return;
    const result = await createProject(name);
    if (!result.success) { showError(result.message || 'Failed to add project'); return; }
    newProjectInput.value = '';
    await renderProjectsPanel();
}

async function deleteProject(id) {
    if (!isAdmin()) return;
    const result = await removeProject(id);
    if (!result.success) { showError('Failed to remove project'); return; }
    await renderProjectsPanel();
}
