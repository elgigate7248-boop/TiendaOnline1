// ── Estado map (alineado con detalle-pedido.js) ───────────────────────────────
const ESTADOS = {
  1: { label: 'Pendiente',         icon: '🕐', badge: 'bg-warning text-dark', paso: 0, color: '#f59e0b' },
  2: { label: 'Confirmado',        icon: '✅', badge: 'bg-info text-dark',    paso: 1, color: '#3b82f6' },
  3: { label: 'Preparando pedido', icon: '📦', badge: 'bg-primary',           paso: 2, color: '#8b5cf6' },
  4: { label: 'En camino',         icon: '🚚', badge: 'bg-info text-white',   paso: 3, color: '#06b6d4' },
  5: { label: 'Entregado',         icon: '🎉', badge: 'bg-success',           paso: 4, color: '#10b981' },
  6: { label: 'Cancelado',         icon: '❌', badge: 'bg-danger',            paso: -1, color: '#ef4444' },
};
const ESTADO_CANCELADO = { label: 'Cancelado', icon: '❌', badge: 'bg-danger', paso: -1, color: '#ef4444' };

const PASOS = ['Pedido<br>realizado', 'Confirmado', 'Preparando', 'En camino', 'Entregado'];

// ── ETA helper ────────────────────────────────────────────────────────────────
function calcularEtaLista(fechaPedido, idEstado) {
  if (idEstado >= 5) return null;
  const etaDias = parseInt(localStorage.getItem('checkoutEtaDias') || '3');
  const base = new Date(fechaPedido || Date.now());
  const eta  = new Date(base);
  eta.setDate(eta.getDate() + etaDias);
  const hoy  = new Date();
  const diff = Math.ceil((eta - hoy) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return '🟢 Hoy o mañana';
  if (diff === 1) return '📅 Mañana';
  const lbl = eta.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
  return `📅 ${lbl} (${diff} días)`;
}

function getEstadoInfo(idEstado, nombreEstado) {
  if (nombreEstado && nombreEstado.toLowerCase().includes('cancel')) return ESTADO_CANCELADO;
  return ESTADOS[idEstado] || { label: nombreEstado || 'Desconocido', icon: '❓', badge: 'bg-secondary', paso: 0 };
}

function renderPasoProgreso(pasoActual) {
  if (pasoActual < 0) {
    return `<div class="small text-danger fw-semibold mt-1">❌ Pedido cancelado</div>`;
  }
  const pct = Math.round((pasoActual / (PASOS.length - 1)) * 100);
  const stepsHtml = PASOS.map((p, i) => {
    const done    = i < pasoActual;
    const current = i === pasoActual;
    const color   = done || current ? '#0d6efd' : '#dee2e6';
    const textCls = done || current ? 'fw-semibold' : 'text-muted';
    return `
      <div class="d-flex flex-column align-items-center" style="min-width:60px;">
        <div style="width:22px;height:22px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;">
          ${done ? '<span style="color:#fff;font-size:11px;">✓</span>' : current ? '<span style="color:#fff;font-size:10px;">●</span>' : ''}
        </div>
        <div class="small text-center mt-1 ${textCls}" style="font-size:10px;line-height:1.2;">${p}</div>
      </div>`;
  }).join(`<div class="flex-grow-1 mt-2" style="height:2px;background:#dee2e6;position:relative;top:-9px;"><div style="height:2px;background:#0d6efd;width:${pct}%;"></div></div>`);
  return `<div class="d-flex align-items-start mt-2 mb-1" style="gap:0;">${stepsHtml}</div>`;
}

const token = localStorage.getItem('token');
const cont  = document.getElementById('pedidos');

if (!token) {
  cont.innerHTML = `
    <div class="text-center py-5">
      <div style="font-size:48px;">🔒</div>
      <h4 class="mt-3">Inicia sesión</h4>
      <p class="text-muted">Debes iniciar sesión para ver tus pedidos.</p>
      <a href="login.html" class="btn btn-dark">Iniciar sesión</a>
    </div>`;
} else {
  cont.innerHTML = '<div class="text-muted text-center py-3"><span class="spinner-border spinner-border-sm me-2"></span>Cargando pedidos...</div>';
  fetch(`${API_BASE}/pedido/mis-pedidos`, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
    .then(pedidos => {
      if (!Array.isArray(pedidos) || !pedidos.length) {
        cont.innerHTML = `
          <div class="text-center py-5">
            <div style="font-size:48px;">📦</div>
            <h4 class="mt-3">Sin pedidos aún</h4>
            <p class="text-muted">Aún no has realizado ningún pedido.</p>
            <a href="index.html" class="btn btn-dark">Explorar catálogo</a>
          </div>`;
        return;
      }

      let html = '<div class="vstack gap-3">';
      pedidos.forEach(p => {
        const id    = p.id_pedido || p.id;
        const est   = getEstadoInfo(p.id_estado, p.estado);
        const fecha = p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString('es-CO', { year:'numeric', month:'short', day:'numeric' }) : '';
        html += `
          <div class="card shadow-sm border-0">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <div class="fw-bold">Pedido #${id}</div>
                  <div class="small text-muted">${fecha}</div>
                </div>
                <div class="text-end">
                  <span class="badge ${est.badge}">${est.icon} ${est.label}</span>
                  <div class="fw-bold mt-1">$${Number(p.total).toLocaleString('es-CO')}</div>
                </div>
              </div>
              ${renderPasoProgreso(est.paso)}
              ${est.paso >= 0 && est.paso < 4 ? (() => {
                const etaStr = calcularEtaLista(p.fecha_pedido, p.id_estado);
                return etaStr ? `<div class="small text-muted mt-2 mb-1"><i class="fas fa-calendar-check me-1 text-primary"></i><b>Entrega estimada:</b> ${etaStr}</div>` : '';
              })() : ''}
              <div class="mt-2 d-flex gap-2 justify-content-end">
                <a href="detalle-pedido.html?id=${id}" class="btn btn-sm btn-outline-dark">Ver detalle →</a>
                ${p.id_estado < 5 && p.id_estado !== 6 && est.paso >= 0 ? `<button class="btn btn-sm btn-outline-danger" onclick="cancelarPedido(${id})"><i class="fas fa-times-circle me-1"></i>Cancelar</button>` : ''}
              </div>
            </div>
          </div>`;
      });
      html += '</div>';
      cont.innerHTML = html;
    })
    .catch(() => {
      cont.innerHTML = '<div class="alert alert-danger">Error al cargar pedidos. Intenta recargar la página.</div>';
    });
}

// ── Cancelar pedido ────────────────────────────────────────────────────────
async function cancelarPedido(idPedido) {
  if (!confirm('¿Estás seguro de que deseas cancelar este pedido? Esta acción no se puede deshacer.')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/pedido/${idPedido}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ id_estado: 6 })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al cancelar pedido');
    }
    alert('✅ Pedido cancelado correctamente');
    window.location.reload();
  } catch (err) {
    alert('❌ ' + err.message);
  }
}
window.cancelarPedido = cancelarPedido;
