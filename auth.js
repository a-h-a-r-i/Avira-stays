// ── Auth ─────────────────────────────────────────────────────────────────────

const ADMIN_USER = 'admin';
let   ADMIN_PASS = 'avira2024'; // overridden by saved settings

// Default caretaker accounts per property
const DEFAULT_CARETAKERS = {
  'sudhakar': { properties: ['Avy Abode', 'Ira Abode'], user: 'sudhakar', pass: 'sudhakar123' },
  'mango':    { properties: ['MangoGreens'],             user: 'mango',    pass: 'mango123'    }
};

let currentRole       = null; // 'admin' | 'caretaker'
let currentProperties = [];  // array of properties visible to this caretaker

function doLogin() {
  const user = document.getElementById('loginUser').value.trim().toLowerCase();
  const pass = document.getElementById('loginPass').value;
  const err  = document.getElementById('loginError');
  err.textContent = '';

  const settings = DB.getSettings();

  // ── Admin ──
  const adminPass = settings.adminPass || ADMIN_PASS;
  if (user === ADMIN_USER && pass === adminPass) {
    currentRole       = 'admin';
    currentProperties = [];
    startApp();
    return;
  }

  // ── Per-caretaker logins ──
  for (const key of Object.keys(DEFAULT_CARETAKERS)) {
    const def    = DEFAULT_CARETAKERS[key];
    const ctUser = (settings['ct_' + key + '_user'] || def.user).toLowerCase();
    const ctPass =  settings['ct_' + key + '_pass'] || def.pass;

    if (user === ctUser && pass === ctPass) {
      currentRole       = 'caretaker';
      currentProperties = def.properties;
      startApp();
      return;
    }
  }

  err.textContent = 'Invalid credentials.';
}

function doLogout() {
  currentRole       = null;
  currentProperties = [];
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').textContent = '';
}

function startApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  if (currentRole === 'admin') {
    document.getElementById('userLabel').textContent = 'Admin';
  } else {
    document.getElementById('userLabel').textContent = currentProperties.join(' & ') + ' · Caretaker';
  }

  document.querySelectorAll('[data-admin]').forEach(el => {
    el.style.display = currentRole === 'admin' ? '' : 'none';
  });
  showTab('dashboard');
  initApp();
}
function isAdmin() { return currentRole === 'admin'; }
function caretakerProperty() { return currentProperties; } // returns array

// ── Settings helpers ──────────────────────────────────────────────────────────

function saveAdminPassword() {
  const np  = document.getElementById('newAdminPass').value.trim();
  const np2 = document.getElementById('newAdminPass2').value.trim();
  const msg = document.getElementById('adminPassMsg');
  if (!np) { msg.textContent = 'Enter a new password.'; msg.className = 'error'; return; }
  if (np !== np2) { msg.textContent = 'Passwords do not match.'; msg.className = 'error'; return; }
  const s = DB.getSettings();
  s.adminPass = np;
  DB.saveSettings(s);
  document.getElementById('newAdminPass').value  = '';
  document.getElementById('newAdminPass2').value = '';
  msg.textContent = 'Admin password updated.';
  msg.className = 'success';
  setTimeout(() => msg.textContent = '', 2500);
}

function saveCaretakerCreds(key) {
  const u   = document.getElementById('ct_' + key + '_user').value.trim();
  const p   = document.getElementById('ct_' + key + '_pass').value.trim();
  const msg = document.getElementById('ct_' + key + '_msg');
  if (!u || !p) { msg.textContent = 'Fill both fields.'; msg.className = 'error'; return; }
  const s = DB.getSettings();
  s['ct_' + key + '_user'] = u;
  s['ct_' + key + '_pass'] = p;
  DB.saveSettings(s);
  msg.textContent = 'Saved.';
  msg.className = 'success';
  setTimeout(() => msg.textContent = '', 2000);
}

// ── Password visibility toggle ────────────────────────────────────────────────
const EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF  = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = show ? EYE_OFF : EYE_OPEN;
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}

// Initialise all pw-eye buttons with the open-eye SVG on page load
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.pw-eye').forEach(btn => {
    btn.innerHTML = EYE_OPEN;
    btn.setAttribute('aria-label', 'Show password');
  });
});
