// ─── Auth ─────────────────────────────────────────────────────────────────────
let currentUser = null;

async function checkAuth() {
    initTheme();
    try {
        const res = await fetch(`${API}/me`, { credentials: 'include' });
        const data = await res.json();
        if (data.authenticated) { currentUser = data.user; showApp(); }
        else showLogin();
    } catch {
        showLogin();
        showError('Cannot reach the server. Make sure it is running.');
    }
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    appEl.classList.add('hidden');
    switchAuthTab('signin');
}

function showApp() {
    loginScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    updateUserUI();
    init();
}

function updateUserUI() {
    if (!currentUser) return;
    const initials = currentUser.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const av = document.getElementById('user-avatar');
    if (av) av.textContent = initials;
    const avM = document.getElementById('user-avatar-mini');
    if (avM) avM.textContent = initials;
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = currentUser.name;
    const emailEl = document.getElementById('user-email');
    if (emailEl) emailEl.textContent = currentUser.email;
    const badge = document.getElementById('user-role-badge');
    if (badge) badge.style.display = isAdmin() ? 'block' : 'none';
    const navSettings    = document.getElementById('nav-settings');
    const mobNavSettings = document.getElementById('mob-nav-settings');
    if (isAdmin()) {
        if (navSettings) navSettings.style.display = 'flex';
        if (mobNavSettings) mobNavSettings.style.display = 'flex';
    } else {
        if (navSettings) navSettings.style.display = 'none';
        if (mobNavSettings) mobNavSettings.style.display = 'none';
    }
}

document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (!loginScreen.classList.contains('hidden')) {
        const signinForm = document.getElementById('form-signin');
        if (signinForm && signinForm.style.display !== 'none') handleSignIn();
        else handleSignUp();
    }
});

async function handleSignIn() {
    const email    = (document.getElementById('signin-email')?.value || '').trim();
    const password = (document.getElementById('signin-password')?.value || '');
    setAuthError('signin', '');
    if (!email || !password) { setAuthError('signin', 'Please enter your email and password.'); return; }
    setAuthLoading('signin-btn', true);
    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include', body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) { currentUser = data.user; showApp(); }
        else setAuthError('signin', data.message || 'Invalid credentials.');
    } catch { setAuthError('signin', 'Cannot reach server. Is it running?'); }
    finally { setAuthLoading('signin-btn', false); }
}

async function handleSignUp() {
    const name     = (document.getElementById('signup-name')?.value || '').trim();
    const email    = (document.getElementById('signup-email')?.value || '').trim();
    const password = (document.getElementById('signup-password')?.value || '');
    const sq       = (document.getElementById('signup-sq')?.value || '').trim();
    const sa       = (document.getElementById('signup-sa')?.value || '').trim();
    setAuthError('signup', '');
    if (!name)              { setAuthError('signup', 'Please enter your name.'); return; }
    if (!email)             { setAuthError('signup', 'Please enter your email.'); return; }
    if (password.length < 6){ setAuthError('signup', 'Password must be at least 6 characters.'); return; }
    if (!sq)                { setAuthError('signup', 'Please choose a security question.'); return; }
    if (!sa)                { setAuthError('signup', 'Please answer your security question.'); return; }
    setAuthLoading('signup-btn', true);
    try {
        const res = await fetch(`${API}/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, password, securityQuestion: sq, securityAnswer: sa })
        });
        const data = await res.json();
        if (data.success) { currentUser = data.user; showApp(); }
        else setAuthError('signup', data.message || 'Registration failed.');
    } catch { setAuthError('signup', 'Cannot reach server. Is it running?'); }
    finally { setAuthLoading('signup-btn', false); }
}

async function logout() {
    await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
    currentUser = null;
    showLogin();
}

// ─── Forgot Password ──────────────────────────────────────────────────────────
let _resetToken = null;

function openForgotPassword() {
    _resetToken = null;
    document.getElementById('forgot-step1').style.display = 'block';
    document.getElementById('forgot-step2').style.display = 'none';
    document.getElementById('forgot-question-block').style.display = 'none';
    document.getElementById('forgot-email').value = '';
    document.getElementById('forgot-answer').value = '';
    document.getElementById('forgot-error').style.display = 'none';
    const newpwd = document.getElementById('forgot-newpwd');
    const confirmpwd = document.getElementById('forgot-confirmpwd');
    if (newpwd) newpwd.value = '';
    if (confirmpwd) confirmpwd.value = '';
    const resetErr = document.getElementById('forgot-reset-error');
    if (resetErr) resetErr.style.display = 'none';
    updateStrength('');
    document.getElementById('forgot-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('forgot-email')?.focus(), 80);
}

function closeForgotPassword() {
    document.getElementById('forgot-modal').classList.add('hidden');
    _resetToken = null;
}

document.addEventListener('click', e => {
    const modal = document.getElementById('forgot-modal');
    if (modal && e.target === modal) closeForgotPassword();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeForgotPassword(); closeTaskModal(); closeAccountModal(); }
});

function setForgotLoading(btnId, loading, originalText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.style.opacity = loading ? '0.65' : '1';
    btn.style.cursor = loading ? 'not-allowed' : 'pointer';
    if (loading) btn.textContent = 'Please wait...';
    else if (originalText) btn.textContent = originalText;
}

async function loadSecurityQuestion() {
    const email = (document.getElementById('forgot-email')?.value || '').trim();
    const errEl = document.getElementById('forgot-error');
    errEl.style.display = 'none';
    if (!email) { errEl.textContent = 'Please enter your email address.'; errEl.style.display = 'block'; return; }
    setForgotLoading('forgot-find-btn', true, 'Find →');
    try {
        const res  = await fetch(`${API}/forgot-password/question?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (!data.success) { errEl.textContent = data.message || 'No account found with that email.'; errEl.style.display = 'block'; return; }
        document.getElementById('forgot-question-text').textContent = data.question;
        document.getElementById('forgot-question-block').style.display = 'block';
        const block = document.getElementById('forgot-question-block');
        block.style.opacity = '0'; block.style.transform = 'translateY(8px)'; block.style.transition = 'opacity 0.25s, transform 0.25s';
        setTimeout(() => { block.style.opacity = '1'; block.style.transform = 'translateY(0)'; }, 20);
        setTimeout(() => document.getElementById('forgot-answer')?.focus(), 150);
    } catch { errEl.textContent = 'Server error. Is the server running?'; errEl.style.display = 'block'; }
    finally { setForgotLoading('forgot-find-btn', false, 'Find →'); }
}

async function verifySecurityAnswer() {
    const email  = (document.getElementById('forgot-email')?.value || '').trim();
    const answer = (document.getElementById('forgot-answer')?.value || '').trim();
    const errEl  = document.getElementById('forgot-error');
    errEl.style.display = 'none';
    if (!answer) { errEl.textContent = 'Please enter your answer.'; errEl.style.display = 'block'; return; }
    setForgotLoading('forgot-verify-btn', true, 'Verify Answer →');
    try {
        const res  = await fetch(`${API}/forgot-password/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, answer }) });
        const data = await res.json();
        if (!data.success) {
            errEl.textContent = data.message || 'Incorrect answer. Please try again.'; errEl.style.display = 'block';
            const inp = document.getElementById('forgot-answer');
            if (inp) { inp.style.borderColor = 'var(--status-danger)'; setTimeout(() => inp.style.borderColor = '', 1500); }
            return;
        }
        _resetToken = data.token;
        const step1 = document.getElementById('forgot-step1');
        const step2 = document.getElementById('forgot-step2');
        step1.style.transition = 'opacity 0.2s'; step1.style.opacity = '0';
        setTimeout(() => {
            step1.style.display = 'none'; step2.style.display = 'block'; step2.style.opacity = '0'; step2.style.transition = 'opacity 0.25s';
            setTimeout(() => { step2.style.opacity = '1'; }, 20);
            setTimeout(() => document.getElementById('forgot-newpwd')?.focus(), 150);
        }, 200);
    } catch { errEl.textContent = 'Server error. Please try again.'; errEl.style.display = 'block'; }
    finally { setForgotLoading('forgot-verify-btn', false, 'Verify Answer →'); }
}

async function submitNewPassword() {
    const newPwd     = document.getElementById('forgot-newpwd')?.value || '';
    const confirmPwd = document.getElementById('forgot-confirmpwd')?.value || '';
    const errEl      = document.getElementById('forgot-reset-error');
    errEl.style.display = 'none';
    if (newPwd.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display = 'block'; return; }
    if (newPwd !== confirmPwd) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; return; }
    try {
        const res  = await fetch(`${API}/forgot-password/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: _resetToken, newPassword: newPwd }) });
        const data = await res.json();
        if (!data.success) { errEl.textContent = data.message || 'Reset failed. Please start over.'; errEl.style.display = 'block'; return; }
        closeForgotPassword();
        const signinErr = document.getElementById('signin-error');
        if (signinErr) {
            signinErr.textContent = '✓ Password reset successfully! Sign in with your new password.';
            signinErr.style.color = 'var(--status-done)'; signinErr.style.background = 'rgba(16,185,129,0.08)';
            signinErr.style.border = '1px solid rgba(16,185,129,0.2)'; signinErr.style.display = 'block';
            setTimeout(() => { signinErr.style.display = 'none'; }, 6000);
        }
        switchAuthTab('signin'); updateStrength('');
    } catch { errEl.textContent = 'Server error. Please try again.'; errEl.style.display = 'block'; }
}
