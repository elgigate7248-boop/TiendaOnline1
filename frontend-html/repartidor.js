// ── Auth helpers ────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('token') || ''; }
function getUser()  {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
}
function getRoles() {
  const u = getUser();
  if (Array.isArray(u.roles)) return u.roles.map(r => typeof r === 'object' ? r.nombre : r).filter(Boolean);
  return u.rol ? [u.rol] : [];
}
function cerrarSesion() {
  localStorage.removeItem('token'); localStorage.removeItem('user');
  location.href = 'login.html';
}

// ── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const cont = document.getElementById('toastContainer');
  if (!cont) return;
  const bg = { success:'#198754', error:'#dc3545', info:'#0d6efd' }[type] || '#333';
  const el = document.createElement('div');
  el.style.cssText = `background:${bg};color:#fff;padding:10px 20px;border-radius:10px;font-size:14px;opacity:0;transition:all .25s;box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:340px;`;
  el.textContent = msg;
  cont.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 260); }, 3500);
}

// ── Estado map (5 estados + display repartidor) ───────────────────────────────
const ESTADO_CFG = {
  2: { label: 'Confirmado',        chip: 'estado-preparando', next: 3, nextLabel: 'Iniciar preparación',  nextIcon: 'fa-box-open',    nextCls: 'btn-warning' },
  3: { label: 'Preparando pedido', chip: 'estado-preparando', next: 4, nextLabel: 'Marcar "En camino"',   nextIcon: 'fa-truck',       nextCls: 'btn-primary' },
  4: { label: 'En camino',         chip: 'estado-encamino',   next: 5, nextLabel: 'Marcar "Entregado"',   nextIcon: 'fa-check-circle',nextCls: 'btn-success' },
  5: { label: 'Entregado',         chip: 'estado-entregado',  next: null },
};

// ── State ────────────────────────────────────────────────────────────────────
let todosPedidos = [];
let filtroActivo = 'todos';

// ── Access check ─────────────────────────────────────────────────────────────
function cargarInfoRepartidor() {
  const token = getToken();
  if (!token) { location.href = 'login.html'; return; }
  const roles = getRoles();
  if (!roles.includes('REPARTIDOR') && !roles.includes('ADMIN') && !roles.includes('SUPER_ADMIN')) {
    document.body.innerHTML = `<div class="container py-5 text-center">
      <div style="font-size:64px;">🚫</div>
      <h3 class="mt-3">Acceso denegado</h3>
      <p class="text-muted">Esta página es exclusiva para repartidores.</p>
      <a href="index.html" class="btn btn-dark mt-2">Ir al inicio</a>
    </div>`;
    return;
  }
  const user = getUser();
  const nameEl   = document.getElementById('repartidorName');
  const avatarEl = document.getElementById('userAvatar');
  if (nameEl)   nameEl.textContent   = user.nombre || user.email || 'Repartidor';
  if (avatarEl) avatarEl.textContent = (user.nombre || user.email || 'R')[0].toUpperCase();
}

// ── Fetch pedidos ─────────────────────────────────────────────────────────────
async function cargarPedidos() {
  const cont = document.getElementById('listaPedidos');
  if (!cont) return;
  cont.innerHTML = '<div class="text-center py-4 text-muted"><span class="spinner-border me-2"></span>Cargando pedidos...</div>';
  try {
    const res = await fetch(`${API_BASE}/pedido/repartidor/asignados`, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    todosPedidos = await res.json();
    renderEstadisticas();
    renderPedidos();
  } catch (err) {
    cont.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Error al cargar pedidos: ${err.message}</div>`;
  }
}

// ── Stats ────────────────────────────────────────────────────────────────────
function renderEstadisticas() {
  const confirmados = todosPedidos.filter(p => p.id_estado === 2).length;
  const preparando  = todosPedidos.filter(p => p.id_estado === 3).length;
  const enCamino    = todosPedidos.filter(p => p.id_estado === 4).length;
  const monto       = todosPedidos.reduce((s, p) => s + parseFloat(p.total || 0), 0);

  const map = { statPreparando: preparando + confirmados, statEnCamino: enCamino,
                statTotal: todosPedidos.length, statMonto: `$${monto.toLocaleString('es-CO')}` };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

// ── Filter ───────────────────────────────────────────────────────────────────
function filtrarPedidos(filtro) {
  filtroActivo = filtro;
  document.querySelectorAll('[id^="filtro"]').forEach(el => el.classList.remove('active'));
  const map = { todos:'filtroTodos', preparando:'filtroPrep', encamino:'filtroCamino' };
  document.getElementById(map[filtro])?.classList.add('active');
  renderPedidos();
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderPedidos() {
  const cont = document.getElementById('listaPedidos');
  let pedidos = todosPedidos;
  if (filtroActivo === 'preparando') pedidos = pedidos.filter(p => p.id_estado <= 3);
  if (filtroActivo === 'encamino')   pedidos = pedidos.filter(p => p.id_estado === 4);

  if (!pedidos.length) {
    const msgs = {
      todos:      ['📭', 'No hay pedidos activos', 'Los pedidos aparecen aquí cuando están confirmados, en preparación o en camino.'],
      preparando: ['📦', 'No hay pedidos en preparación', 'Cuando un pedido esté confirmado o preparándose aparecerá aquí.'],
      encamino:   ['🚚', 'No hay pedidos en camino', 'Los pedidos que ya salieron a entregar aparecen aquí.'],
    };
    const [icon, title, sub] = msgs[filtroActivo] || msgs.todos;
    cont.innerHTML = `<div class="text-center py-5 text-muted">
      <div style="font-size:48px;">${icon}</div>
      <h5 class="mt-3">${title}</h5>
      <p class="small">${sub}</p>
    </div>`;
    return;
  }

  cont.innerHTML = `<div class="row g-3">${pedidos.map(renderTarjetaPedido).join('')}</div>`;
}

function renderTarjetaPedido(p) {
  const cfg   = ESTADO_CFG[p.id_estado] || { label: p.estado || '?', chip: '' };
  const fecha = p.fecha_pedido
    ? new Date(p.fecha_pedido).toLocaleDateString('es-CO', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
    : '';

  const accionBtn = cfg.next
    ? `<button class="btn btn-sm ${cfg.nextCls} btn-action w-100 fw-semibold"
               onclick="cambiarEstado(${p.id_pedido}, ${cfg.next})">
         <i class="fas ${cfg.nextIcon} me-1"></i>${cfg.nextLabel}
       </button>`
    : `<div class="d-flex align-items-center justify-content-center gap-2 py-2 rounded bg-success bg-opacity-10 text-success small fw-semibold">
         <i class="fas fa-check-circle"></i> Pedido entregado
       </div>`;

  // Priority indicator
  const fechaObj = p.fecha_pedido ? new Date(p.fecha_pedido) : null;
  const horasTranscurridas = fechaObj ? Math.floor((Date.now() - fechaObj) / 3600000) : 0;
  const urgente = horasTranscurridas > 12 && p.id_estado < 4;
  const urgBadge = urgente ? '<span class="badge bg-danger ms-1" style="font-size:10px;">URGENTE</span>' : '';

  return `
    <div class="col-lg-6">
      <div class="pedido-card p-3 h-100 ${urgente ? 'border border-danger' : ''}">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div>
            <div class="fw-bold">Pedido #${p.id_pedido} ${urgBadge}</div>
            <div class="small text-muted">${fecha}</div>
          </div>
          <span class="estado-chip ${cfg.chip}">${cfg.label}</span>
        </div>

        <div class="row g-2 mb-3 small">
          <div class="col-7">
            <div class="text-muted mb-1"><i class="fas fa-user me-1"></i>Cliente</div>
            <div class="fw-semibold">${p.nombre_cliente || 'N/A'}</div>
            <div class="text-muted" style="font-size:11px;">${p.email_cliente || ''}</div>
          </div>
          <div class="col-5">
            <div class="text-muted mb-1"><i class="fas fa-dollar-sign me-1"></i>Valor</div>
            <div class="fw-bold text-success fs-6">$${Number(p.total).toLocaleString('es-CO')}</div>
          </div>
        </div>

        <div class="mb-3 p-2 rounded small" style="background:#f8f9fa;">
          <div class="text-muted mb-1 fw-semibold"><i class="fas fa-map-marker-alt me-1 text-danger"></i>Entrega</div>
          <div class="fw-semibold">${p.ciudad_destino || p.nombre_cliente || 'Ver contacto cliente'}</div>
          <div class="text-muted">${p.direccion_destino || 'Coordinar con el cliente'}</div>
        </div>

        <div id="accion-${p.id_pedido}">${accionBtn}</div>
      </div>
    </div>`;
}

// ── Cambiar estado ────────────────────────────────────────────────────────────
async function cambiarEstado(idPedido, nuevoEstado) {
  const accionDiv = document.getElementById(`accion-${idPedido}`);
  const btn = accionDiv?.querySelector('button');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Actualizando...'; }

  try {
    const res = await fetch(`${API_BASE}/pedido/${idPedido}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify({ id_estado: nuevoEstado })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al actualizar');
    }
    const LABELS = { 3: 'preparando', 4: 'en camino', 5: 'entregado' };
    showToast(`✅ Pedido #${idPedido} → ${LABELS[nuevoEstado] || nuevoEstado}`, 'success');
    await cargarPedidos();
  } catch (err) {
    showToast(`❌ ${err.message}`, 'error');
    await cargarPedidos();
  }
}

window.cambiarEstado  = cambiarEstado;
window.filtrarPedidos = filtrarPedidos;
window.cerrarSesion   = cerrarSesion;
window.cargarPedidos  = cargarPedidos;

// ── Clock ─────────────────────────────────────────────────────────────────────
function actualizarHora() {
  const el = document.getElementById('currentTime');
  if (el) el.textContent = new Date().toLocaleString('es-CO', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cargarInfoRepartidor();
  cargarPedidos();
  actualizarHora();
  setInterval(actualizarHora, 60000);
  // Auto-refresh every 60s
  setInterval(cargarPedidos, 60000);
});
