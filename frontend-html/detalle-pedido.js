// ── Estado map (compatible con 5 estados DB) ──────────────────────────────
const ESTADOS_MAP = {
  1: { label: 'Pendiente',         icon: 'fa-clock',         color: '#f59e0b', paso: 0 },
  2: { label: 'Confirmado',        icon: 'fa-check-circle',  color: '#3b82f6', paso: 1 },
  3: { label: 'Preparando pedido', icon: 'fa-box',           color: '#8b5cf6', paso: 2 },
  4: { label: 'En camino',         icon: 'fa-truck',         color: '#06b6d4', paso: 3 },
  5: { label: 'Entregado',         icon: 'fa-check-double',  color: '#10b981', paso: 4 },
  6: { label: 'Cancelado',         icon: 'fa-times-circle',  color: '#ef4444', paso: -1 },
};
const ESTADO_CANCELADO = { label: 'Cancelado', icon: 'fa-times-circle', color: '#ef4444', paso: -1 };

const PASOS = [
  { label: 'Pedido\nrealizado',  icon: 'fa-shopping-cart' },
  { label: 'Confirmado',         icon: 'fa-check' },
  { label: 'Preparando',         icon: 'fa-box-open' },
  { label: 'En camino',          icon: 'fa-truck' },
  { label: 'Entregado',          icon: 'fa-home' },
];

function getEstInfo(idEstado, nombreEstado) {
  if (nombreEstado && nombreEstado.toLowerCase().includes('cancel')) return ESTADO_CANCELADO;
  return ESTADOS_MAP[idEstado] || { label: nombreEstado || 'Desconocido', icon: 'fa-question', color: '#6b7280', paso: 0 };
}

function calcularETA(fechaPedido, idEstado, detalles, ciudadDestino) {
  if (idEstado >= 5) return null;

  // Use stored days from checkout if available
  const storedDias = parseInt(localStorage.getItem('checkoutEtaDias') || '0');

  let totalDias = storedDias || 2;
  if (!storedDias && Array.isArray(detalles) && detalles.length) {
    const dest = String(ciudadDestino || '').trim().toLowerCase();
    let maxPrep = 0;
    let mismaOrigen = true;
    detalles.forEach(d => {
      const prep = Number(d.tiempo_preparacion) || 1;
      maxPrep = Math.max(maxPrep, prep);
      const orig = String(d.ciudad_origen_producto || '').trim().toLowerCase();
      if (orig && dest && orig !== dest) mismaOrigen = false;
    });
    const transit = mismaOrigen ? 1 : 3;
    totalDias = maxPrep + transit;
  }

  const base = new Date(fechaPedido || Date.now());
  const eta  = new Date(base);
  eta.setDate(eta.getDate() + totalDias);
  const hoy  = new Date();
  const diff = Math.ceil((eta - hoy) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Hoy o mañana';
  if (diff === 1) return 'Mañana';
  const label = eta.toLocaleDateString('es-CO', { weekday: 'long', month: 'short', day: 'numeric' });
  return `${label} (aprox. ${diff} día${diff !== 1 ? 's' : ''})`;
}

function renderTracker(pasoActual) {
  if (pasoActual < 0) {
    return `<div class="d-flex align-items-center gap-2 py-2 text-danger fw-semibold">
      <i class="fas fa-times-circle"></i> Pedido cancelado
    </div>`;
  }
  const stepsHtml = PASOS.map((paso, i) => {
    const state = i < pasoActual ? 'done' : i === pasoActual ? 'active' : '';
    const icon  = i < pasoActual ? 'fa-check' : paso.icon;
    const label = paso.label.replace('\n', '<br>');
    return `<div class="tracker-step ${state}">
      <div class="step-circle"><i class="fas ${icon}" style="font-size:13px;"></i></div>
      <div class="step-label">${label}</div>
    </div>`;
  }).join('');
  return `<div class="d-flex align-items-start" style="gap:0;overflow-x:auto;padding-bottom:4px;">${stepsHtml}</div>`;
}


// ── Main ───────────────────────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const pedidoId = params.get('id');
const token = localStorage.getItem('token');
const cont = document.getElementById('detallePedido');
const bcId = document.getElementById('breadcrumbId');

if (!token) {
  cont.innerHTML = `<div class="text-center py-5">
    <div style="font-size:48px;">🔒</div>
    <h4 class="mt-3">Inicia sesión</h4>
    <p class="text-muted">Debes iniciar sesión para ver el detalle del pedido.</p>
    <a href="login.html" class="btn btn-dark">Iniciar sesión</a>
  </div>`;
} else if (!pedidoId) {
  cont.innerHTML = '<div class="alert alert-warning">ID de pedido no especificado.</div>';
} else {
  if (bcId) bcId.textContent = `Pedido #${pedidoId}`;
  fetch(`${API_BASE}/pedido/${pedidoId}`, {
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
    .then(pedido => {
      if (!pedido) { cont.innerHTML = '<div class="alert alert-info">Pedido no encontrado.</div>'; return; }

      const id    = pedido.id_pedido || pedido.id;
      const est   = getEstInfo(pedido.id_estado, pedido.estado);
      const fecha = pedido.fecha_pedido
        ? new Date(pedido.fecha_pedido).toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })
        : '';

      // Dirección de envío guardada en localStorage (la guarda checkout.js)
      const dir         = localStorage.getItem('checkoutDireccion') || '';
      const ciudad      = localStorage.getItem('destinoCiudad') || '';
      const depto       = localStorage.getItem('destinoDepto') || '';
      const tel         = localStorage.getItem('checkoutTelefono') || '';
      const indic       = localStorage.getItem('checkoutIndicaciones') || '';
      const destinatario= localStorage.getItem('checkoutNombreDestinatario') || '';
      const dirLine     = [dir, ciudad, depto].filter(Boolean).join(', ');

      const eta = calcularETA(pedido.fecha_pedido, pedido.id_estado, pedido.detalles, ciudad);

      const detalles = Array.isArray(pedido.detalles) ? pedido.detalles : [];
      const esCancelado = pedido.id_estado === 6 || (pedido.estado || '').toLowerCase().includes('cancel');

      const simBtn = esCancelado
        ? `<div class="badge bg-danger py-2 px-3"><i class="fas fa-times-circle me-1"></i>Pedido cancelado</div>`
        : pedido.id_estado === 5
          ? `<div class="badge bg-success py-2 px-3"><i class="fas fa-check-circle me-1"></i>Pedido completado</div>`
          : '';

      // Botón cancelar pedido (solo si no está entregado/cancelado)
      const cancelBtn = pedido.id_estado < 5 && pedido.id_estado !== 6 && !esCancelado
        ? `<button class="btn btn-outline-danger w-100 mt-2" onclick="cancelarPedido(${id})">
             <i class="fas fa-times-circle me-1"></i>Cancelar pedido
           </button>`
        : '';

      let html = `
        <div class="row g-4">
          <div class="col-lg-8">

            <!-- Cabecera -->
            <div class="card shadow-sm border-0 mb-4">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
                  <div>
                    <h2 class="h5 fw-bold mb-0">Pedido #${id}</h2>
                    <div class="small text-muted">${fecha}</div>
                  </div>
                  <div class="text-end">
                    <span class="badge fs-6 px-3 py-2" style="background:${est.color};">
                      <i class="fas ${est.icon} me-1"></i>${est.label}
                    </span>
                    <div class="fw-bold fs-5 mt-1">$${Number(pedido.total).toLocaleString('es-CO')}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tracker -->
            <div class="card shadow-sm border-0 mb-4">
              <div class="card-header bg-white border-0 pb-0">
                <h6 class="mb-0 fw-bold"><i class="fas fa-route me-2 text-primary"></i>Estado del envío</h6>
              </div>
              <div class="card-body pt-2">
                ${renderTracker(est.paso)}
                ${!esCancelado && eta ? `
                <div class="mt-3 eta-badge d-inline-block">
                  <i class="fas fa-calendar-check me-2"></i>
                  <strong>Entrega estimada:</strong> ${eta}
                </div>` : ''}
                <div class="mt-3">${simBtn}</div>
              </div>
            </div>

            <!-- Productos -->
            <div class="card shadow-sm border-0 mb-4">
              <div class="card-header bg-white border-0 pb-0">
                <h6 class="mb-0 fw-bold"><i class="fas fa-boxes me-2 text-primary"></i>Productos</h6>
              </div>
              <div class="card-body p-0">`;

      if (detalles.length) {
        html += `<div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr><th>Producto</th><th class="text-center">Cant.</th><th class="text-end">Precio</th><th class="text-end">Subtotal</th></tr>
            </thead>
            <tbody>`;
        detalles.forEach(d => {
          const nombre = d.nombre_producto || d.producto?.nombre || `Producto #${d.id_producto}`;
          const sub = d.cantidad * d.precio_unitario;
          html += `<tr>
            <td class="fw-semibold ps-3">${nombre}</td>
            <td class="text-center">${d.cantidad}</td>
            <td class="text-end">$${Number(d.precio_unitario).toLocaleString('es-CO')}</td>
            <td class="text-end pe-3 fw-bold">$${Number(sub).toLocaleString('es-CO')}</td>
          </tr>`;
        });
        html += `</tbody></table></div>`;
      } else {
        html += `<div class="px-3 py-3 text-muted small">No se encontraron detalles de productos en este pedido.</div>`;
      }

      html += `</div></div></div><!-- col -->

          <div class="col-lg-4">

            <!-- Resumen total -->
            <div class="card shadow-sm border-0 mb-4">
              <div class="card-body">
                <h6 class="fw-bold mb-3"><i class="fas fa-receipt me-2 text-primary"></i>Resumen de pago</h6>
                <div class="d-flex justify-content-between mb-2">
                  <span class="text-muted">Subtotal productos</span>
                  <span>$${Number(pedido.total).toLocaleString('es-CO')}</span>
                </div>
                <div class="d-flex justify-content-between mb-2">
                  <span class="text-muted">Envío</span>
                  <span class="text-success">Gratis</span>
                </div>
                <div class="d-flex justify-content-between border-top pt-2 mt-2">
                  <span class="fw-bold">Total</span>
                  <span class="fw-bold fs-5">$${Number(pedido.total).toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>

            <!-- Dirección -->
            <div class="card shadow-sm border-0 mb-4">
              <div class="card-body">
                <h6 class="fw-bold mb-3"><i class="fas fa-map-marker-alt me-2 text-danger"></i>Dirección de entrega</h6>
                ${dirLine
                  ? `<div class="small">
                       ${destinatario ? `<div class="fw-bold">${destinatario}</div>` : ''}
                       <div class="fw-semibold">${dirLine}</div>
                       ${tel ? `<div class="text-muted mt-1"><i class="fas fa-phone me-1"></i>${tel}</div>` : ''}
                       ${indic ? `<div class="text-muted mt-1"><i class="fas fa-info-circle me-1"></i>${indic}</div>` : ''}
                     </div>`
                  : `<div class="small text-muted">No se registró dirección de entrega en este pedido.</div>`}
              </div>
            </div>

            <a href="mis-pedidos.html" class="btn btn-outline-dark w-100">
              <i class="fas fa-arrow-left me-2"></i>Volver a mis pedidos
            </a>
            ${cancelBtn}

          </div>
        </div>`;

      cont.innerHTML = html;
    })
    .catch(() => {
      cont.innerHTML = '<div class="alert alert-danger">Error al cargar el detalle del pedido. Intenta recargar la página.</div>';
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
