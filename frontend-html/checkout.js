// Mostrar resumen del carrito
function getCarrito() {
  return JSON.parse(localStorage.getItem('carrito') || '[]');
}

function actualizarBadgeCarrito() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  const carrito = getCarrito();
  const total = carrito.reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
  badge.textContent = String(total);
  badge.style.display = total > 0 ? 'inline-block' : 'none';
}

async function cargarDepartamentos() {
  const deptoEl = document.getElementById('depto');
  if (!deptoEl) return;
  deptoEl.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/ubicacion/departamentos`);
    const data = await res.json();
    if (!res.ok) {
      deptoEl.innerHTML = '<option value="">No disponible</option>';
      return;
    }
    deptoEl.innerHTML = '<option value="">Seleccionar...</option>' +
      (Array.isArray(data) ? data : []).map(d => `<option value="${d.codigo_dane}">${d.nombre}</option>`).join('');
  } catch {
    deptoEl.innerHTML = '<option value="">No disponible</option>';
  } finally {
    deptoEl.disabled = false;
  }
}

async function cargarCiudadesPorDepartamento(codigoDepto, ciudadSeleccionada) {
  const ciudadEl = document.getElementById('ciudad');
  if (!ciudadEl) return;
  const dep = (codigoDepto || '').trim();
  if (!dep) {
    ciudadEl.innerHTML = '<option value="">Seleccionar...</option>';
    ciudadEl.disabled = true;
    return;
  }

  ciudadEl.disabled = true;
  ciudadEl.innerHTML = '<option value="">Cargando...</option>';
  try {
    const res = await fetch(`${API_BASE}/ubicacion/ciudades?departamento=` + encodeURIComponent(dep));
    const data = await res.json();
    if (!res.ok) {
      ciudadEl.innerHTML = '<option value="">No disponible</option>';
      ciudadEl.disabled = true;
      return;
    }
    ciudadEl.innerHTML = '<option value="">Seleccionar...</option>' +
      (Array.isArray(data) ? data : []).map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
    ciudadEl.disabled = false;
    if (ciudadSeleccionada) {
      ciudadEl.value = ciudadSeleccionada;
    }
  } catch {
    ciudadEl.innerHTML = '<option value="">No disponible</option>';
    ciudadEl.disabled = true;
  }
}

function renderResumen() {
  const carrito = getCarrito();
  const cont = document.getElementById('resumen');
  if (!carrito.length) {
    cont.innerHTML = `
      <div class="text-center py-4">
        <div style="font-size:36px;">🛒</div>
        <p class="text-muted mt-2 mb-0">Tu carrito está vacío</p>
        <a href="index.html" class="btn btn-outline-dark btn-sm mt-2">Ir al catálogo</a>
      </div>
    `;
    const form = document.getElementById('checkoutForm');
    if (form) form.style.display = 'none';
    return;
  }
  const totalItems = carrito.reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
  let total = 0;
  let html = `<div class="small text-muted mb-2">${totalItems} producto${totalItems !== 1 ? 's' : ''}</div>`;
  carrito.forEach(item => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;
    html += `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <div class="fw-semibold small">${item.nombre}</div>
          <div class="text-muted" style="font-size:12px;">Cantidad: ${item.cantidad} × $${Number(item.precio).toLocaleString()}</div>
        </div>
        <div class="fw-semibold">$${Number(subtotal).toLocaleString()}</div>
      </div>
    `;
  });
  html += `
    <div class="d-flex justify-content-between align-items-center pt-3">
      <span class="fw-bold">Total</span>
      <span class="fw-bold fs-5">$${Number(total).toLocaleString()}</span>
    </div>
  `;
  cont.innerHTML = html;
}
renderResumen();
actualizarBadgeCarrito();

// ── ETA helpers ──────────────────────────────────────────────────────────────
function calcularEtaCheckout(ciudadDestino) {
  const carrito = getCarrito();
  if (!carrito.length || !ciudadDestino) return null;
  let maxPrep = 0;
  let mismaOrigen = true;
  carrito.forEach(item => {
    const prep = Number(item.tiempo_preparacion) || 1;
    maxPrep = Math.max(maxPrep, prep);
    const orig = String(item.ciudad_origen || '').trim().toLowerCase();
    const dest = ciudadDestino.trim().toLowerCase();
    if (orig && orig !== dest) mismaOrigen = false;
  });
  const transit = mismaOrigen ? 1 : 3;
  const totalDias = maxPrep + transit;
  const eta = new Date();
  eta.setDate(eta.getDate() + totalDias);
  const label = eta.toLocaleDateString('es-CO', { weekday: 'long', month: 'short', day: 'numeric' });
  return { dias: totalDias, label, tipo: mismaOrigen ? '🚀 Entrega express' : '📦 Envío estándar' };
}

function actualizarEtaDisplay() {
  const ciudadEl = document.getElementById('ciudad');
  const etaDiv   = document.getElementById('etaEstimada');
  const etaTxt   = document.getElementById('etaTexto');
  if (!etaDiv || !etaTxt) return;
  const ciudad = ciudadEl?.value || '';
  const eta = calcularEtaCheckout(ciudad);
  if (eta) {
    etaTxt.textContent = `${eta.tipo} · Aprox. ${eta.dias} día${eta.dias !== 1 ? 's' : ''} · ${eta.label}`;
    etaDiv.style.display = 'block';
  } else {
    etaDiv.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  const deptoEl = document.getElementById('depto');
  const ciudadEl = document.getElementById('ciudad');
  await cargarDepartamentos();

  if (deptoEl) {
    deptoEl.addEventListener('change', async function () {
      await cargarCiudadesPorDepartamento(deptoEl.value);
      actualizarEtaDisplay();
    });
  }
  if (ciudadEl) {
    ciudadEl.addEventListener('change', actualizarEtaDisplay);
  }

  const destinoDepto = (localStorage.getItem('destinoDepto') || '').trim();
  const destinoCiudad = (localStorage.getItem('destinoCiudad') || '').trim();
  if (deptoEl && destinoDepto) {
    deptoEl.value = destinoDepto;
    await cargarCiudadesPorDepartamento(destinoDepto, destinoCiudad);
  } else if (ciudadEl && destinoCiudad) {
    ciudadEl.disabled = false;
    ciudadEl.innerHTML = `<option value="${destinoCiudad}">${destinoCiudad}</option>`;
    ciudadEl.value = destinoCiudad;
  }
  actualizarEtaDisplay();

  const savedFields = {
    direccion: 'checkoutDireccion',
    indicaciones: 'checkoutIndicaciones',
    telefono: 'checkoutTelefono',
    nombreDestinatario: 'checkoutNombreDestinatario'
  };
  Object.entries(savedFields).forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    const val = (localStorage.getItem(key) || '').trim();
    if (el && val && !el.value) el.value = val;
  });
});

// Enviar pedido al backend (requiere login)
document.getElementById('checkoutForm').onsubmit = async function (e) {
  e.preventDefault();
  const nombreDestinatario = (document.getElementById('nombreDestinatario')?.value || '').trim();
  const direccion    = document.getElementById('direccion').value.trim();
  const depto        = (document.getElementById('depto')?.value || '').trim();
  const ciudad       = document.getElementById('ciudad').value.trim();
  const telefono     = document.getElementById('telefono').value.trim();
  const indicaciones = (document.getElementById('indicaciones')?.value || '').trim();
  const metodoPago   = document.getElementById('metodoPago').value;
  const carrito = getCarrito();
  const msg = document.getElementById('checkoutMsg');
  const btn = this.querySelector('button[type="submit"]');
  msg.textContent = '';
  const token = localStorage.getItem('token');
  if (!token) {
    msg.innerHTML = '<div class="alert alert-warning">Debes <a href="login.html?redirect=checkout.html">iniciar sesión</a> para comprar.</div>';
    return;
  }
  if (!carrito.length) {
    msg.innerHTML = '<div class="alert alert-warning">Tu carrito está vacío.</div>';
    return;
  }
  if (!nombreDestinatario || !direccion || !depto || !ciudad || !telefono) {
    msg.innerHTML = '<div class="alert alert-warning">Completa nombre del destinatario, dirección, departamento, ciudad y teléfono.</div>';
    return;
  }

  // Guardar datos de envío para reutilizar
  localStorage.setItem('checkoutNombreDestinatario', nombreDestinatario);
  localStorage.setItem('destinoDepto', depto);
  localStorage.setItem('destinoCiudad', ciudad);
  localStorage.setItem('checkoutDireccion', direccion);
  localStorage.setItem('checkoutIndicaciones', indicaciones);
  localStorage.setItem('checkoutTelefono', telefono);

  // Guardar ETA calculada para mostrar en detalle-pedido
  const eta = calcularEtaCheckout(ciudad);
  if (eta) localStorage.setItem('checkoutEtaDias', eta.dias);
  else localStorage.removeItem('checkoutEtaDias');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Procesando...';

  try {
    const pedido = {
      id_estado: 1,
      metodo_pago: metodoPago,
      total: carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0),
      detalles: carrito.map(item => ({ id_producto: item.id, cantidad: item.cantidad, precio_unitario: item.precio }))
    };
    const res = await fetch(`${API_BASE}/pedido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(pedido)
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.removeItem('carrito');
      actualizarBadgeCarrito();
      const idPedido = data.insertId || data.id_pedido || '';
      window.location.href = idPedido
        ? `detalle-pedido.html?id=${idPedido}`
        : 'mis-pedidos.html';
    } else {
      msg.innerHTML = '<div class="alert alert-danger">' + (data.error || 'Error al realizar pedido') + '</div>';
      btn.disabled = false;
      btn.textContent = 'Confirmar pedido';
    }
  } catch {
    msg.innerHTML = '<div class="alert alert-danger">Error de conexión. Intenta de nuevo.</div>';
    btn.disabled = false;
    btn.textContent = 'Confirmar pedido';
  }
}
