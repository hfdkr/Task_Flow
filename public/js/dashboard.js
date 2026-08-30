// ─── Dashboard Render ─────────────────────────────────────────────────────────
async function renderDashboard() {
    let tasks;
    try { tasks = await fetchTasks(); allTasksCache = tasks; }
    catch { return; }

    const total  = tasks.length;
    const todoN  = tasks.filter(t => t.status === 'To Do').length;
    const progN  = tasks.filter(t => t.status === 'In Progress').length;
    const doneN  = tasks.filter(t => t.status === 'Done').length;
    const pct    = total ? Math.round((doneN / total) * 100) : 0;
    const overdue = tasks.filter(t => isOverdue(t.dueDate, t.status));

    animateCount('ds-total', total);
    animateCount('ds-todo', todoN);
    animateCount('ds-prog', progN);
    animateCount('ds-done', doneN);
    setBar('ds-todo-bar', total ? (todoN / total) * 100 : 0);
    setBar('ds-prog-bar', total ? (progN / total) * 100 : 0);
    setBar('ds-done-bar', total ? (doneN / total) * 100 : 0);

    const circumference = 2 * Math.PI * 54;
    const filled = (pct / 100) * circumference;
    const donutFill = document.getElementById('donut-fill');
    if (donutFill) setTimeout(() => { donutFill.setAttribute('stroke-dasharray', `${filled} ${circumference}`); }, 100);
    const donutPct = document.getElementById('donut-pct');
    if (donutPct) animateCount('donut-pct', pct, '%');

    const high = tasks.filter(t => t.priority === 'High').length;
    const medium = tasks.filter(t => t.priority === 'Medium').length;
    const low  = tasks.filter(t => t.priority === 'Low').length;
    const maxP = Math.max(high, medium, low, 1);

    const priChart = document.getElementById('priority-chart');
    if (priChart) {
        priChart.innerHTML = '';
        [{ label:'High', val:high, color:'var(--status-danger)' }, { label:'Medium', val:medium, color:'var(--status-prog)' }, { label:'Low', val:low, color:'var(--status-done)' }].forEach(b => {
            const col = document.createElement('div');
            col.className = 'bar-col'; col.style.cssText = `background:${b.color};opacity:0.8;height:4px`; col.title = `${b.label}: ${b.val}`;
            priChart.appendChild(col);
            setTimeout(() => { col.style.height = `${(b.val / maxP) * 100}%`; }, 100);
        });
    }
    const priLegend = document.getElementById('priority-legend');
    if (priLegend) priLegend.innerHTML = [
        { label:'High', val:high, c:'var(--status-danger)' },
        { label:'Med',  val:medium, c:'var(--status-prog)' },
        { label:'Low',  val:low,  c:'var(--status-done)' },
    ].map(b => `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${b.c};margin-right:4px"></span>${b.label}: ${b.val}</span>`).join('');

    const memberLoad = document.getElementById('member-load');
    if (memberLoad) {
        const byMember = {};
        tasks.forEach(t => { byMember[t.member] = (byMember[t.member] || 0) + 1; });
        const maxLoad = Math.max(...Object.values(byMember), 1);
        memberLoad.innerHTML = Object.entries(byMember).sort((a,b) => b[1]-a[1]).map(([name, count]) => `
            <div>
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                    <span style="font-size:13px;color:var(--text-main);font-weight:500">${escapeHtml(name)}</span>
                    <span style="font-size:12px;color:var(--text-muted)">${count} task${count !== 1 ? 's' : ''}</span>
                </div>
                <div style="height:5px;border-radius:99px;background:var(--border-subtle);overflow:hidden">
                    <div style="height:100%;border-radius:99px;background:var(--brand);width:0%;transition:width 0.7s cubic-bezier(.22,1,.36,1)" data-target="${(count/maxLoad)*100}"></div>
                </div>
            </div>`).join('') || `<p style="font-size:13px;color:var(--text-muted)">No tasks yet</p>`;
        setTimeout(() => memberLoad.querySelectorAll('[data-target]').forEach(el => el.style.width = el.dataset.target + '%'), 100);
    }

    const projectBreakdown = document.getElementById('project-breakdown');
    if (projectBreakdown) {
        const byProject = {};
        tasks.forEach(t => {
            const key = t.project || '(no project)';
            if (!byProject[key]) byProject[key] = { total:0, done:0 };
            byProject[key].total++;
            if (t.status === 'Done') byProject[key].done++;
        });
        projectBreakdown.innerHTML = Object.entries(byProject).sort((a,b) => b[1].total-a[1].total).map(([proj, data]) => {
            const pPct = Math.round((data.done / data.total) * 100);
            return `<div>
                <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                    <span style="font-size:13px;color:var(--text-main);font-weight:500">${escapeHtml(proj)}</span>
                    <span style="font-size:12px;color:var(--text-muted)">${data.done}/${data.total} · ${pPct}%</span>
                </div>
                <div style="height:5px;border-radius:99px;background:var(--border-subtle);overflow:hidden">
                    <div style="height:100%;border-radius:99px;background:var(--status-done);width:0%;transition:width 0.7s cubic-bezier(.22,1,.36,1)" data-target="${pPct}"></div>
                </div>
            </div>`;
        }).join('') || `<p style="font-size:13px;color:var(--text-muted)">No projects yet</p>`;
        setTimeout(() => projectBreakdown.querySelectorAll('[data-target]').forEach(el => el.style.width = el.dataset.target + '%'), 100);
    }

    const overdueList = document.getElementById('overdue-list');
    if (overdueList) {
        overdueList.innerHTML = overdue.length === 0
            ? `<p style="font-size:13px;color:var(--status-done)">✓ No overdue tasks</p>`
            : overdue.map(t => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:10px">
                    <div>
                        <div style="font-size:13px;font-weight:500;color:var(--text-main)">${escapeHtml(t.title)}</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escapeHtml(t.member)} · ${escapeHtml(t.project || '—')}</div>
                    </div>
                    <span style="font-size:11px;color:var(--status-danger)">⚠ ${new Date(t.dueDate).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>
                </div>`).join('');
    }

    const recentList = document.getElementById('recent-list');
    if (recentList) {
        const sorted = [...tasks].sort((a,b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt)).slice(0,5);
        const statusColors = { 'To Do':'var(--status-todo)', 'In Progress':'var(--status-prog)', 'Done':'var(--status-done)' };
        recentList.innerHTML = sorted.map(t => `
            <div style="display:flex;align-items:flex-start;gap:10px">
                <div style="width:8px;height:8px;border-radius:50%;background:${statusColors[t.status]||'var(--text-muted)'};flex-shrink:0;margin-top:4px"></div>
                <div style="flex:1">
                    <div style="font-size:13px;color:var(--text-main);font-weight:500">${escapeHtml(t.title)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escapeHtml(t.member)} · <span style="color:${statusColors[t.status]}">${t.status}</span> · ${relativeTime(t.updatedAt||t.createdAt)}</div>
                </div>
            </div>`).join('') || `<p style="font-size:13px;color:var(--text-muted)">No activity yet</p>`;
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function animateCount(id, target, suffix = '') {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const dur = 600; const t0 = performance.now();
    function step(now) {
        const p = Math.min((now - t0) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(start + (target - start) * e) + suffix;
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function setBar(id, pct) { const el = document.getElementById(id); if (el) setTimeout(() => el.style.width = pct + '%', 100); }

function relativeTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}
