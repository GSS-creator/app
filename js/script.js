const API = 'https://kk.gss-tec.com';

// ── State ─────────────────────────────────────────────────────────────────────
let currentToken = localStorage.getItem('auth_token') || null;
let currentUser  = localStorage.getItem('auth_user')  || null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const loginSection     = document.getElementById('loginSection');
const registerSection  = document.getElementById('registerSection');
const dashboardSection = document.getElementById('dashboardSection');
const logoutBtn        = document.getElementById('logoutBtn');
const toast            = document.getElementById('toast');
const authNav          = document.getElementById('authNav');
const dashNav          = document.getElementById('dashNav');

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 3500);
}

// ── Button loading helper ─────────────────────────────────────────────────────
function setLoading(btn, loading, label) {
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${label}`;
  } else {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (currentToken) opts.headers['Authorization'] = `Bearer ${currentToken}`;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

const apiGet    = (path)        => api('GET',    path);
const apiPost   = (path, body)  => api('POST',   path, body);
const apiPut    = (path, body)  => api('PUT',    path, body);
const apiPatch  = (path, body)  => api('PATCH',  path, body);
const apiDelete = (path, body)  => api('DELETE', path, body);

// ── Tab switching (auth screens) ──────────────────────────────────────────────
function showTab(tab) {
  loginSection.classList.add('hidden');
  registerSection.classList.add('hidden');
  dashboardSection.classList.add('hidden');
  authNav.classList.remove('hidden');
  dashNav.classList.add('hidden');
  logoutBtn.classList.add('hidden');

  document.querySelectorAll('#authNav .nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  );

  if (tab === 'login')    loginSection.classList.remove('hidden');
  if (tab === 'register') registerSection.classList.remove('hidden');
}

// ── Dashboard panel switching ─────────────────────────────────────────────────
const PANELS = ['profile', 'password', 'users', 'danger'];

function showDash(panel = 'profile') {
  loginSection.classList.add('hidden');
  registerSection.classList.add('hidden');
  authNav.classList.add('hidden');

  dashboardSection.classList.remove('hidden');
  dashNav.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');

  PANELS.forEach(p => {
    document.getElementById(`panel-${p}`).classList.toggle('hidden', p !== panel);
  });

  document.querySelectorAll('#dashNav .nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.dash === panel)
  );

  // Lazy-load users when switching to that panel
  if (panel === 'users') loadUsers();
}

// ── Nav: auth tabs ────────────────────────────────────────────────────────────
document.querySelectorAll('#authNav .nav-btn').forEach(btn =>
  btn.addEventListener('click', () => showTab(btn.dataset.tab))
);

// ── Nav: dashboard panels ─────────────────────────────────────────────────────
document.querySelectorAll('#dashNav .nav-btn').forEach(btn =>
  btn.addEventListener('click', () => showDash(btn.dataset.dash))
);

// Inline "switch" links (data-tab on <a> tags)
document.addEventListener('click', e => {
  const tab = e.target.dataset?.tab;
  if (tab) { e.preventDefault(); showTab(tab); }
});

// ── Register ──────────────────────────────────────────────────────────────────
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;
  const btn      = document.getElementById('registerSubmit');

  if (password !== confirm) return showToast('Passwords do not match', 'error');
  if (password.length < 4)  return showToast('Password must be at least 4 characters', 'error');

  setLoading(btn, true, 'Creating account…');
  try {
    const { ok, data } = await apiPost('/register', { username, password });
    if (ok) {
      showToast(data.message || 'Account created! Please log in.', 'success');
      document.getElementById('registerForm').reset();
      showTab('login');
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch { showToast('Network error', 'error'); }
  finally  { setLoading(btn, false, 'Create account'); }
});

// ── Login ─────────────────────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = document.getElementById('loginSubmit');

  setLoading(btn, true, 'Signing in…');
  try {
    const { ok, data } = await apiPost('/login', { username, password });
    if (ok) {
      currentToken = data.token;
      currentUser  = username;
      localStorage.setItem('auth_token', currentToken);
      localStorage.setItem('auth_user',  currentUser);
      document.getElementById('loginForm').reset();
      renderProfile();
      showDash('profile');
      showToast(`Welcome, ${username}!`, 'success');
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch { showToast('Network error', 'error'); }
  finally  { setLoading(btn, false, 'Sign in'); }
});

// ── Logout (single session) ───────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
  setLoading(logoutBtn, true, 'Logging out…');
  try { await apiPost('/logout', {}); } catch { /* best-effort */ }
  clearSession();
  showToast('Logged out successfully', 'success');
  setLoading(logoutBtn, false, 'Logout');
  showTab('login');
});

// ── Logout from all devices ───────────────────────────────────────────────────
document.getElementById('logoutAllBtn').addEventListener('click', async () => {
  const btn = document.getElementById('logoutAllBtn');
  setLoading(btn, true, 'Logging out…');
  try {
    const { ok, data } = await apiDelete('/me/sessions');
    if (ok) {
      clearSession();
      showToast(data.message || 'Logged out from all devices', 'success');
      showTab('login');
    } else {
      showToast(data.error || 'Failed', 'error');
      setLoading(btn, false, 'Logout from all devices');
    }
  } catch {
    showToast('Network error', 'error');
    setLoading(btn, false, 'Logout from all devices');
  }
});

// ── Change password ───────────────────────────────────────────────────────────
document.getElementById('passwordForm').addEventListener('submit', async e => {
  e.preventDefault();
  const current  = document.getElementById('curPassword').value;
  const next     = document.getElementById('newPassword').value;
  const confirm  = document.getElementById('newPasswordConfirm').value;
  const btn      = document.getElementById('passwordSubmit');

  if (next !== confirm) return showToast('New passwords do not match', 'error');
  if (next.length < 6)  return showToast('New password must be at least 6 characters', 'error');

  setLoading(btn, true, 'Updating…');
  try {
    const { ok, data } = await apiPut('/me/password', {
      current_password: current,
      new_password: next,
    });
    if (ok) {
      document.getElementById('passwordForm').reset();
      // Server invalidates all sessions — force re-login
      clearSession();
      showToast(data.message || 'Password updated. Please log in again.', 'success');
      showTab('login');
    } else {
      showToast(data.error || 'Failed to update password', 'error');
    }
  } catch { showToast('Network error', 'error'); }
  finally  { setLoading(btn, false, 'Update Password'); }
});

// ── Change username ───────────────────────────────────────────────────────────
document.getElementById('usernameForm').addEventListener('submit', async e => {
  e.preventDefault();
  const newUsername = document.getElementById('newUsername').value.trim();
  const btn         = document.getElementById('usernameSubmit');

  setLoading(btn, true, 'Changing…');
  try {
    const { ok, data } = await apiPatch('/me/username', { new_username: newUsername });
    if (ok) {
      currentUser = newUsername;
      localStorage.setItem('auth_user', currentUser);
      document.getElementById('newUsername').value = '';
      renderProfile();
      showToast(data.message || `Username changed to '${newUsername}'`, 'success');
      showDash('profile');
    } else {
      showToast(data.error || 'Failed to change username', 'error');
    }
  } catch { showToast('Network error', 'error'); }
  finally  { setLoading(btn, false, 'Change'); }
});

// ── Delete account ────────────────────────────────────────────────────────────
document.getElementById('deleteForm').addEventListener('submit', async e => {
  e.preventDefault();
  const password = document.getElementById('deletePassword').value;
  const btn      = document.getElementById('deleteSubmit');

  if (!confirm('Are you sure? This will permanently delete your account.')) return;

  setLoading(btn, true, 'Deleting…');
  try {
    const { ok, data } = await apiDelete('/me', { password });
    if (ok) {
      clearSession();
      showToast(data.message || 'Account deleted', 'info');
      showTab('login');
    } else {
      showToast(data.error || 'Failed to delete account', 'error');
    }
  } catch { showToast('Network error', 'error'); }
  finally  { setLoading(btn, false, 'Delete'); }
});

// ── Users list ────────────────────────────────────────────────────────────────
document.getElementById('refreshUsersBtn').addEventListener('click', loadUsers);

async function loadUsers() {
  const container = document.getElementById('usersTable');
  const subtitle  = document.getElementById('usersSubtitle');
  container.innerHTML = '<p class="empty-state">Loading…</p>';
  try {
    const { ok, data } = await apiGet('/users');
    if (!ok) { container.innerHTML = `<p class="empty-state">${data.error || 'Failed to load users'}</p>`; return; }

    const users = data.users || [];
    subtitle.textContent = `${data.total} user${data.total !== 1 ? 's' : ''} registered`;

    if (users.length === 0) {
      container.innerHTML = '<p class="empty-state">No users yet.</p>';
      return;
    }

    const rows = users.map(u => {
      const isMe = u.username === currentUser;
      const date = new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      return `<tr>
        <td>${u.id}</td>
        <td>${escHtml(u.username)}${isMe ? '<span class="badge-me">you</span>' : ''}</td>
        <td>${date}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <table class="users-table">
        <thead><tr><th>#</th><th>Username</th><th>Joined</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch {
    container.innerHTML = '<p class="empty-state">Network error.</p>';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function renderProfile() {
  document.getElementById('welcomeMsg').textContent   = `Welcome, ${currentUser}!`;
  document.getElementById('avatarCircle').textContent = currentUser[0].toUpperCase();
  document.getElementById('tokenDisplay').textContent = currentToken;

  // Fetch full profile for joined date
  apiGet('/me').then(({ ok, data }) => {
    if (ok && data.created_at) {
      const date = new Date(data.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      document.getElementById('memberSince').textContent = `Member since ${date}`;
    }
  }).catch(() => {});
}

function clearSession() {
  currentToken = null;
  currentUser  = null;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
if (currentToken && currentUser) {
  renderProfile();
  showDash('profile');
} else {
  showTab('login');
}
