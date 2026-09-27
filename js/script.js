const API = 'https://auth-api.gss-tec.com';

// ── State ─────────────────────────────────────────────────────────────────────
let currentToken = localStorage.getItem('auth_token') || null;
let currentUser  = localStorage.getItem('auth_user')  || null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const loginSection    = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
const dashboardSection= document.getElementById('dashboardSection');
const logoutBtn       = document.getElementById('logoutBtn');
const toast           = document.getElementById('toast');
const navBtns         = document.querySelectorAll('.nav-btn');

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 3500);
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function showTab(tab) {
  loginSection.classList.add('hidden');
  registerSection.classList.add('hidden');
  dashboardSection.classList.add('hidden');

  navBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  if (tab === 'login')     loginSection.classList.remove('hidden');
  if (tab === 'register')  registerSection.classList.remove('hidden');
  if (tab === 'dashboard') {
    dashboardSection.classList.remove('hidden');
    document.getElementById('welcomeMsg').textContent = `Welcome, ${currentUser}!`;
    document.getElementById('avatarCircle').textContent = currentUser[0].toUpperCase();
    document.getElementById('tokenDisplay').textContent = currentToken;
    logoutBtn.classList.remove('hidden');
    navBtns.forEach(b => b.classList.add('hidden'));
  } else {
    logoutBtn.classList.add('hidden');
    navBtns.forEach(b => b.classList.remove('hidden'));
  }
}

// Nav button clicks
navBtns.forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

// Inline "switch" links
document.addEventListener('click', e => {
  const tab = e.target.dataset?.tab;
  if (tab) { e.preventDefault(); showTab(tab); }
});

// ── API helper ────────────────────────────────────────────────────────────────
async function apiPost(path, body, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ── Button loading state ──────────────────────────────────────────────────────
function setLoading(btn, loading, label) {
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${label}`;
  } else {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// ── Register ──────────────────────────────────────────────────────────────────
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;
  const btn      = document.getElementById('registerSubmit');

  if (password !== confirm) {
    return showToast('Passwords do not match', 'error');
  }
  if (password.length < 4) {
    return showToast('Password must be at least 4 characters', 'error');
  }

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
  } catch {
    showToast('Network error — is the server running?', 'error');
  } finally {
    setLoading(btn, false, 'Create account');
  }
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
      showToast(`Welcome, ${username}!`, 'success');
      document.getElementById('loginForm').reset();
      showTab('dashboard');
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch {
    showToast('Network error — is the server running?', 'error');
  } finally {
    setLoading(btn, false, 'Sign in');
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
  if (!currentToken) return;
  setLoading(logoutBtn, true, 'Logging out…');
  try {
    await apiPost('/logout', {}, { Authorization: `Bearer ${currentToken}` });
  } catch { /* ignore network errors on logout */ }

  currentToken = null;
  currentUser  = null;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  showToast('Logged out successfully', 'success');
  setLoading(logoutBtn, false, 'Logout');
  showTab('login');
});

// ── Init: restore session if token exists ─────────────────────────────────────
if (currentToken && currentUser) {
  showTab('dashboard');
} else {
  showTab('login');
}
