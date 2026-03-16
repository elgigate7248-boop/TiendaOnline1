const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

const roles = Array.isArray(user.roles)
  ? user.roles.map(r => r.nombre || r)
  : (user.rol ? [user.rol] : []);

const puedeAdministrar = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
const puedeCrudPedidos = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
const puedeCrudUsuarios = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');

console.log('Token:', token ? 'presente' : 'ausente');
console.log('Usuario:', user);
console.log('Roles extraídos:', roles);
console.log('Puede administrar:', puedeAdministrar);

if (!token) {
  showToast('Debes iniciar sesión para acceder al panel.', 'warning');
  setTimeout(() => { location.href = 'login.html'; }, 700);
}

if (!puedeAdministrar) {
  showToast('No tienes permisos para acceder al panel de administración. Roles: ' + roles.join(', '), 'error');
  setTimeout(() => { location.href = 'index.html'; }, 900);
}

function fetchAuth(url, opts = {}) {
  return fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
  });
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function renderError(containerId, title, details) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const msg = (details && typeof details === 'string') ? details : '';
  el.innerHTML = `
    <div class="alert alert-warning">
      <div class="fw-semibold">${title}</div>
      ${msg ? `<div class="small text-muted mt-1">${msg}</div>` : ''}
    </div>
  `;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  if (window.UIKit && typeof window.UIKit.showToast === 'function') {
    window.UIKit.showToast(message, type);
    return;
  }
  let container = document.getElementById('globalToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'globalToastContainer';
    container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2000;display:flex;flex-direction:column;gap:8px;max-width:360px;';
    document.body.appendChild(container);
  }

  const tone = type === 'success'
    ? { bg: '#198754', border: '#146c43' }
    : type === 'warning'
      ? { bg: '#ffc107', border: '#e6ac00', text: '#111' }
      : type === 'error'
        ? { bg: '#dc3545', border: '#b02a37' }
        : { bg: '#0d6efd', border: '#0a58ca' };

  const toast = document.createElement('div');
  toast.style.cssText = `background:${tone.bg};border:1px solid ${tone.border};color:${tone.text || '#fff'};padding:10px 12px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.2);font-size:14px;opacity:0;transform:translateY(-4px);transition:all .2s ease;`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-4px)';
    setTimeout(() => toast.remove(), 220);
  }, 2600);
}

window.showFeatureToast = function (message) {
  showToast(message, 'info');
};
