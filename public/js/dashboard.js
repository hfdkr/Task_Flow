// ─── Dashboard — chart theming helpers ────────────────────────────────────────
function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function chartFontDefaults() {
    return { family: "'DM Sans', sans-serif", size: 12 };
}

function chartTooltipTheme() {
    return {
        backgroundColor: cssVar('--bg-element'),
        borderColor: cssVar('--border-strong'),
        borderWidth: 1,
        titleColor: cssVar('--text-main'),
        bodyColor: cssVar('--text-muted'),
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
        titleFont: chartFontDefaults(),
        bodyFont: chartFontDefaults(),
    };
}

function chartLegendTheme(extra = {}) {
    return {
        position: 'bottom',
        labels: {
            color: cssVar('--text-muted'),
            font: chartFontDefaults(),
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 14,
            boxWidth: 8,
            boxHeight: 8,
        },
        ...extra,
    };
}

function chartGridTheme() {
    return { color: cssVar('--border-subtle'), drawTicks: false };
}

function chartTickTheme() {
    return { color: cssVar('--text-muted'), font: chartFontDefaults() };
}

// ─── Dashboard — chart instances (destroyed + recreated on every render) ─────
const dashCharts = {};

function destroyChart(key) {
    if (dashCharts[key]) { dashCharts[key].destroy(); delete dashCharts[key]; }
}

function renderStatusChart(todoN, progN, doneN) {
    const canvas = document.getElementById('status-chart');
    if (!canvas) return;
    destroyChart('status');
    const total = todoN + progN + doneN;
    dashCharts.status = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['To Do', 'In Progress', 'Done'],
            datasets: [{
                data: [todoN, progN, doneN],
                backgroundColor: [cssVar('--status-todo'), cssVar('--status-prog'), cssVar('--status-done')],
                borderColor: cssVar('--bg-surface'),
                borderWidth: 2,
                hoverOffset: 6,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '70%',
            plugins: {
                legend: chartLegendTheme(),
                tooltip: { ...chartTooltipTheme(), callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } },
            },
        },
        plugins: [{
            id: 'centerText',
            afterDraw(chart) {
                const { ctx, chartArea } = chart;
                if (!chartArea) return;
                const cx = (chartArea.left + chartArea.right) / 2;
                const cy = (chartArea.top + chartArea.bottom) / 2;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = "800 24px Syne, sans-serif";
                ctx.fillStyle = cssVar('--text-main');
                ctx.fillText(String(total), cx, cy - 8);
                ctx.font = "11px 'DM Sans', sans-serif";
                ctx.fillStyle = cssVar('--text-muted');
                ctx.fillText('tasks', cx, cy + 12);
                ctx.restore();
            },
        }],
    });
}

function renderPriorityChart(high, medium, low) {
    const canvas = document.getElementById('priority-chart');
    if (!canvas) return;
    destroyChart('priority');
    dashCharts.priority = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['High', 'Medium', 'Low'],
            datasets: [{
                data: [high, medium, low],
                backgroundColor: [cssVar('--status-danger'), cssVar('--status-prog'), cssVar('--status-done')],
                borderRadius: 6,
                maxBarThickness: 56,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: chartTooltipTheme() },
            scales: {
                x: { grid: { display: false }, ticks: chartTickTheme() },
                y: { beginAtZero: true, ticks: { ...chartTickTheme(), precision: 0 }, grid: chartGridTheme() },
            },
        },
    });
}

function renderMemberChart(byMember) {
    const canvas = document.getElementById('member-chart');
    if (!canvas) return;
    destroyChart('member');
    const entries = Object.entries(byMember).sort((a, b) => b[1] - a[1]).slice(0, 8);
    dashCharts.member = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: entries.map(([name]) => name),
            datasets: [{
                data: entries.map(([, count]) => count),
                backgroundColor: cssVar('--brand'),
                borderRadius: 6,
                maxBarThickness: 18,
            }],
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: chartTooltipTheme() },
            scales: {
                x: { beginAtZero: true, ticks: { ...chartTickTheme(), precision: 0 }, grid: chartGridTheme() },
                y: { grid: { display: false }, ticks: chartTickTheme() },
            },
        },
    });
}

function renderProjectChart(byProject) {
    const canvas = document.getElementById('project-chart');
    if (!canvas) return;
    destroyChart('project');
    const entries = Object.entries(byProject).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
    dashCharts.project = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: entries.map(([name]) => name),
            datasets: [
                { label: 'Done', data: entries.map(([, d]) => d.done), backgroundColor: cssVar('--status-done'), borderRadius: 4, maxBarThickness: 18 },
                { label: 'Remaining', data: entries.map(([, d]) => d.total - d.done), backgroundColor: cssVar('--border-strong'), borderRadius: 4, maxBarThickness: 18 },
            ],
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: chartLegendTheme(), tooltip: chartTooltipTheme() },
            scales: {
                x: { stacked: true, beginAtZero: true, ticks: { ...chartTickTheme(), precision: 0 }, grid: chartGridTheme() },
                y: { stacked: true, grid: { display: false }, ticks: chartTickTheme() },
            },
        },
    });
}

function buildTrendData(tasks, days = 14) {
    const dayKey = d => d.toISOString().slice(0, 10);
    const buckets = new Map();
    const labels = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        buckets.set(dayKey(d), { created: 0, completed: 0 });
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    tasks.forEach(t => {
        if (t.createdAt) {
            const bucket = buckets.get(dayKey(new Date(t.createdAt)));
            if (bucket) bucket.created++;
        }
        if (t.status === 'Done' && t.updatedAt) {
            const bucket = buckets.get(dayKey(new Date(t.updatedAt)));
            if (bucket) bucket.completed++;
        }
    });
    const values = [...buckets.values()];
    return { labels, created: values.map(v => v.created), completed: values.map(v => v.completed) };
}

function renderTrendChart(tasks) {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;
    destroyChart('trend');
    const { labels, created, completed } = buildTrendData(tasks);
    dashCharts.trend = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Created', data: created, borderColor: cssVar('--brand'), backgroundColor: cssVar('--brand-dim'), fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2 },
                { label: 'Completed', data: completed, borderColor: cssVar('--status-done'), backgroundColor: 'transparent', fill: false, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2 },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: chartLegendTheme(), tooltip: chartTooltipTheme() },
            scales: {
                x: { grid: { display: false }, ticks: { ...chartTickTheme(), maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } },
                y: { beginAtZero: true, ticks: { ...chartTickTheme(), precision: 0 }, grid: chartGridTheme() },
            },
        },
    });
}

// ─── Dashboard Render ─────────────────────────────────────────────────────────
async function renderDashboard() {
    let tasks, members;
    try {
        [tasks, members] = await Promise.all([fetchTasks(), fetchMembers()]);
        allTasksCache = tasks;
    } catch { return; }

    const total  = tasks.length;
    const todoN  = tasks.filter(t => t.status === 'To Do').length;
    const progN  = tasks.filter(t => t.status === 'In Progress').length;
    const doneN  = tasks.filter(t => t.status === 'Done').length;
    const pct    = total ? Math.round((doneN / total) * 100) : 0;
    const overdue = tasks.filter(t => isOverdue(t.dueDate, t.status));

    animateCount('ds-total', total);
    animateCount('ds-rate', pct, '%');
    animateCount('ds-overdue-count', overdue.length);
    animateCount('ds-members', members.length);
    const updatedEl = document.getElementById('ds-updated');
    if (updatedEl) updatedEl.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    renderStatusChart(todoN, progN, doneN);
    renderTrendChart(tasks);

    const high = tasks.filter(t => t.priority === 'High').length;
    const medium = tasks.filter(t => t.priority === 'Medium').length;
    const low  = tasks.filter(t => t.priority === 'Low').length;
    renderPriorityChart(high, medium, low);

    const byMember = {};
    tasks.forEach(t => { byMember[t.member] = (byMember[t.member] || 0) + 1; });
    renderMemberChart(byMember);

    const byProject = {};
    tasks.forEach(t => {
        const key = t.project || '(no project)';
        if (!byProject[key]) byProject[key] = { total: 0, done: 0 };
        byProject[key].total++;
        if (t.status === 'Done') byProject[key].done++;
    });
    renderProjectChart(byProject);

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
