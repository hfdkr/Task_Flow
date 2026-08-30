// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    setBoardMode(boardMode);
    showLoadingSkeleton();
    try {
        await renderMembersPanel();
        await renderProjectsPanel();
        await renderDashboard();
        await renderTasks();
    } catch (err) {
        showError('Failed to load data. Is the server running?');
    }
}

// ─── Admin Settings ───────────────────────────────────────────────────────────
function openSettingsView() {
    if (isAdmin()) {
        document.getElementById('settings-locked').style.display = 'none';
        document.getElementById('settings-content').style.display = 'block';
        const nameEl  = document.getElementById('settings-name');
        const emailEl = document.getElementById('settings-email');
        if (nameEl)  nameEl.value  = currentUser.name  || '';
        if (emailEl) emailEl.value = currentUser.email || '';
        renderUsersTable();
    } else {
        document.getElementById('settings-locked').style.display = 'flex';
        document.getElementById('settings-content').style.display = 'none';
    }
}

async function renderUsersTable() {
    const table = document.getElementById('users-table');
    const badge = document.getElementById('users-count-badge');
    if (!table) return;
    table.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:12px 0">Loading…</div>`;
    try {
        const data  = await apiFetch(`${API}/admin/users`);
        const users = data.users || [];
        if (badge) badge.textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
        if (!users.length) { table.innerHTML = `<p style="color:var(--text-muted);font-size:13px">No users found.</p>`; return; }
        table.innerHTML = `
            <div style="display:grid;grid-template-columns:2fr 2fr 100px 100px auto;gap:12px;padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-muted)">
                <span>Name</span><span>Email</span><span>Role</span><span>Joined</span><span></span>
            </div>`;
        users.forEach(u => {
            const isSelf   = u.id === currentUser.id;
            const uIsAdmin = u.role === 'admin';
            const initials = u.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            const joinDate = new Date(u.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
            const row = document.createElement('div');
            row.style.cssText = 'display:grid;grid-template-columns:2fr 2fr 100px 100px auto;gap:12px;align-items:center;padding:12px 14px;background:var(--bg-element);border:1px solid var(--border-strong);border-radius:12px';
            row.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;min-width:0">
                    <div style="width:32px;height:32px;border-radius:50%;background:${isSelf?'var(--brand-dim)':'var(--border-strong)'};border:1px solid ${isSelf?'rgba(108,143,255,0.3)':'transparent'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${isSelf?'var(--brand)':'var(--text-light)'};flex-shrink:0">${initials}</div>
                    <div style="min-width:0">
                        <div style="font-size:13px;font-weight:600;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(u.name)}${isSelf?' <span style="font-size:10px;color:var(--brand)">(you)</span>':''}</div>
                    </div>
                </div>
                <div style="font-size:13px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(u.email)}</div>
                <div>
                    <select onchange="changeUserRole(${u.id}, this.value)" ${isSelf?'disabled':''}
                        style="background:${uIsAdmin?'var(--brand-dim)':'var(--bg-hover)'};border:1px solid ${uIsAdmin?'rgba(108,143,255,0.3)':'var(--border-strong)'};color:${uIsAdmin?'var(--brand)':'var(--text-muted)'};border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;cursor:${isSelf?'not-allowed':'pointer'};appearance:none;width:100%">
                        <option value="member" ${u.role==='member'?'selected':''}>Member</option>
                        <option value="admin"  ${u.role==='admin' ?'selected':''}>Admin</option>
                    </select>
                </div>
                <div style="font-size:12px;color:var(--text-muted)">${joinDate}</div>
                <button onclick="adminDeleteUser(${u.id})" ${isSelf?'disabled':''}
                    style="background:none;border:none;color:${isSelf?'var(--border-strong)':'var(--text-muted)'};font-size:16px;cursor:${isSelf?'not-allowed':'pointer'};padding:4px 8px;border-radius:6px;transition:all 0.18s"
                    onmouseover="if(!this.disabled)this.style.background='rgba(239,68,68,0.12)';if(!this.disabled)this.style.color='var(--status-danger)'"
                    onmouseout="this.style.background='none';this.style.color='${isSelf?'var(--border-strong)':'var(--text-muted)'}'">✕</button>`;
            table.appendChild(row);
        });
    } catch (e) {
        table.innerHTML = `<p style="color:var(--status-danger);font-size:13px">Failed to load users.</p>`;
    }
}

async function changeUserRole(userId, newRole) {
    try {
        const res = await apiFetch(`${API}/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role: newRole }) });
        if (!res.success) { showError(res.message || 'Failed to change role'); }
        else {
            await renderUsersTable();
            await renderMembersPanel();
            if (userId === currentUser?.id) { currentUser.role = newRole; updateUserUI(); }
        }
    } catch { showError('Failed to change role'); }
}

async function adminDeleteUser(userId) {
    showDangerModal('<i class="fi fi-rr-trash"></i>', 'Delete User?', 'This will permanently remove their account. Tasks they created will remain.', async () => {
        const res = await apiFetch(`${API}/admin/users/${userId}`, { method: 'DELETE' });
        if (!res.success) showError(res.message || 'Failed to delete user');
        else { await renderUsersTable(); await renderMembersPanel(); }
    });
}

async function saveMyAccount() {
    const name   = (document.getElementById('settings-name')?.value || '').trim();
    const email  = (document.getElementById('settings-email')?.value || '').trim();
    const newpwd = (document.getElementById('settings-newpwd')?.value || '');
    const curpwd = (document.getElementById('settings-curpwd')?.value || '');
    const msg    = document.getElementById('settings-account-msg');
    const show   = (text, ok) => {
        if (!msg) return;
        msg.textContent = text; msg.style.color = ok ? 'var(--status-done)' : 'var(--status-danger)'; msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 4000);
    };
    if (!name || !email) { show('Name and email are required.', false); return; }
    if (!curpwd)         { show('Enter your current password to save.', false); return; }
    try {
        const res = await apiFetch(`${API}/account`, { method: 'PUT', body: JSON.stringify({ name, email, currentPassword: curpwd, newPassword: newpwd || undefined }) });
        if (res.success) {
            currentUser.name  = res.user.name;
            currentUser.email = res.user.email;
            updateUserUI();
            document.getElementById('settings-curpwd').value = '';
            document.getElementById('settings-newpwd').value = '';
            show('✓ Account updated successfully.', true);
        } else { show(res.message || 'Failed to update account.', false); }
    } catch { show('Server error.', false); }
}

function adminClearTasks() {
    showDangerModal('<i class="fi fi-rr-trash"></i>', 'Clear All Tasks?', 'Every task in the workspace will be permanently deleted. This cannot be undone.', async () => {
        const res = await apiFetch(`${API}/admin/clear-tasks`, { method: 'DELETE' });
        if (res.success) { showError('✓ All tasks cleared.'); await renderDashboard(); await renderTasks(); }
        else showError(res.message || 'Failed to clear tasks.');
    });
}

function adminResetWorkspace() {
    showDangerModal('<i class="fi fi-rr-trash"></i>', 'Reset Workspace?', 'All tasks, members and projects will be permanently deleted. User accounts will be kept.', async () => {
        const res = await apiFetch(`${API}/admin/reset`, { method: 'DELETE' });
        if (res.success) { showError('✓ Workspace reset.'); await init(); }
        else showError(res.message || 'Failed to reset workspace.');
    });
}

// ─── Danger Modal ─────────────────────────────────────────────────────────────
let _dangerCallback = null;
function showDangerModal(icon, title, desc, onConfirm) {
    document.getElementById('danger-icon').innerHTML = icon;
    document.getElementById('danger-title').textContent = title;
    document.getElementById('danger-desc').textContent = desc;
    _dangerCallback = onConfirm;
    document.getElementById('danger-modal').classList.remove('hidden');
}
function closeDangerModal() {
    document.getElementById('danger-modal').classList.add('hidden');
    _dangerCallback = null;
}
document.getElementById('danger-confirm-btn').addEventListener('click', async () => {
    if (_dangerCallback) { const cb = _dangerCallback; closeDangerModal(); await cb(); }
});
document.getElementById('danger-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('danger-modal')) closeDangerModal();
});

// ─── Account Modal ────────────────────────────────────────────────────────────
function openAccountModal() {
    const modal = document.getElementById('account-modal');
    if (!modal || !currentUser) return;
    modal.classList.remove('hidden');
    const initials   = currentUser.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const bigAv      = document.getElementById('acct-avatar-big');
    if (bigAv) bigAv.textContent = initials;
    const headerName = document.getElementById('acct-header-name');
    if (headerName) headerName.textContent = currentUser.name;
    const headerRole = document.getElementById('acct-header-role');
    if (headerRole) headerRole.innerHTML = isAdmin() ? '<span class="flex items-center gap-1 w-[14px] h-[14px]"><img src="./assets/Icon (2).png" alt="Admin"> Admin</span>' : 'Member';
    const nameEl  = document.getElementById('acct-name');
    const emailEl = document.getElementById('acct-email');
    if (nameEl)  nameEl.value  = currentUser.name  || '';
    if (emailEl) emailEl.value = currentUser.email || '';
    const roleEl   = document.getElementById('acct-info-role');
    const joinedEl = document.getElementById('acct-info-joined');
    if (roleEl)   roleEl.textContent   = isAdmin() ? 'Admin' : 'Member';
    if (joinedEl) joinedEl.textContent = currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }) : '—';
    const themeChk   = document.getElementById('acct-theme-check');
    if (themeChk)   themeChk.checked   = (localStorage.getItem('tf-theme') || 'dark') === 'dark';
    const sidebarChk = document.getElementById('acct-sidebar-check');
    if (sidebarChk) sidebarChk.checked = localStorage.getItem('tf-sidebar') === 'collapsed';
    switchAccountTab('profile');
    clearAccountMsgs();
}

function closeAccountModal() {
    const modal = document.getElementById('account-modal');
    if (modal) modal.classList.add('hidden');
    clearAccountMsgs();
}

document.addEventListener('click', e => {
    const modal = document.getElementById('account-modal');
    if (modal && e.target === modal) closeAccountModal();
});

function clearAccountMsgs() {
    ['acct-profile-msg', 'acct-security-msg'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    ['acct-cur-pwd', 'acct-new-pwd', 'acct-confirm-pwd'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    updateStrength('');
}

function switchAccountTab(tab) {
    ['profile','security','preferences'].forEach(t => {
        const panel = document.getElementById(`acct-panel-${t}`);
        const btn   = document.getElementById(`acct-tab-${t}`);
        if (panel) panel.style.display = t === tab ? 'block' : 'none';
        if (btn) { btn.style.borderBottomColor = t === tab ? 'var(--brand)' : 'transparent'; btn.style.color = t === tab ? 'var(--brand)' : 'var(--text-muted)'; }
    });
}

function showAccountMsg(panelId, text, ok) {
    const el = document.getElementById(panelId);
    if (!el) return;
    el.textContent = text; el.style.display = 'block';
    el.style.color      = ok ? 'var(--status-done)'        : 'var(--status-danger)';
    el.style.background = ok ? 'rgba(16,185,129,0.08)'     : 'rgba(239,68,68,0.08)';
    el.style.border     = `1px solid ${ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`;
    if (ok) setTimeout(() => { el.style.display = 'none'; }, 4000);
}

async function saveProfile() {
    const name  = (document.getElementById('acct-name')?.value  || '').trim();
    const email = (document.getElementById('acct-email')?.value || '').trim();
    if (!name)  { showAccountMsg('acct-profile-msg', 'Name is required.', false); return; }
    if (!email) { showAccountMsg('acct-profile-msg', 'Email is required.', false); return; }
    try {
        const res = await apiFetch(`${API}/account/profile`, { method: 'PUT', body: JSON.stringify({ name, email }) });
        if (res.success) {
            currentUser.name = res.user.name; currentUser.email = res.user.email;
            updateUserUI();
            const headerName = document.getElementById('acct-header-name'); if (headerName) headerName.textContent = res.user.name;
            const bigAv = document.getElementById('acct-avatar-big'); if (bigAv) bigAv.textContent = res.user.name.trim().split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
            showAccountMsg('acct-profile-msg', '✓ Profile saved successfully.', true);
        } else { showAccountMsg('acct-profile-msg', res.message || 'Update failed.', false); }
    } catch { showAccountMsg('acct-profile-msg', 'Server connection error.', false); }
}

async function savePassword() {
    const curPwd     = document.getElementById('acct-cur-pwd')?.value     || '';
    const newPwd     = document.getElementById('acct-new-pwd')?.value     || '';
    const confirmPwd = document.getElementById('acct-confirm-pwd')?.value || '';
    if (!curPwd)            { showAccountMsg('acct-security-msg', 'Enter your current password.', false); return; }
    if (newPwd.length < 6)  { showAccountMsg('acct-security-msg', 'New password must be at least 6 characters.', false); return; }
    if (newPwd !== confirmPwd){ showAccountMsg('acct-security-msg', 'Passwords do not match.', false); return; }
    try {
        const res = await apiFetch(`${API}/account/password`, { method: 'PUT', body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }) });
        if (res.success) {
            document.getElementById('acct-cur-pwd').value = '';
            document.getElementById('acct-new-pwd').value = '';
            document.getElementById('acct-confirm-pwd').value = '';
            updateStrength('');
            showAccountMsg('acct-security-msg', '✓ Password changed successfully.', true);
        } else { showAccountMsg('acct-security-msg', res.message || 'Password change failed.', false); }
    } catch { showAccountMsg('acct-security-msg', 'Server connection error.', false); }
}

function setPrefSidebar(collapsed) {
    const sidebar = document.getElementById('sidebar');
    if (collapsed) { sidebar.classList.add('collapsed'); localStorage.setItem('tf-sidebar', 'collapsed'); }
    else           { sidebar.classList.remove('collapsed'); localStorage.setItem('tf-sidebar', 'expanded'); }
}
