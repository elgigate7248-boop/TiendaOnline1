// Carrito en localStorage
function getCarrito() {
  return JSON.parse(localStorage.getItem('carrito') || '[]');
}
function setCarrito(carrito) {
  localStorage.setItem('carrito', JSON.stringify(carrito));
}

function getDestinoCiudad() {
  return (localStorage.getItem('destinoCiudad') || '').trim();
}

function setDestinoCiudad(value) {
  localStorage.setItem('destinoCiudad', String(value || '').trim());
}

function getDestinoDepto() {
  return (localStorage.getItem('destinoDepto') || '').trim();
}

function setDestinoDepto(value) {
  localStorage.setItem('destinoDepto', String(value || '').trim());
}

function getCheckoutDireccion() {
  return (localStorage.getItem('checkoutDireccion') || '').trim();
}

function setCheckoutDireccion(value) {
  localStorage.setItem('checkoutDireccion', String(value || '').trim());
}

function getCheckoutIndicaciones() {
  return (localStorage.getItem('checkoutIndicaciones') || '').trim();
}

function setCheckoutIndicaciones(value) {
  localStorage.setItem('checkoutIndicaciones', String(value || '').trim());
}

async function cargarDepartamentosDomicilio() {
  const deptoEl = document.getElementById('domicilioDepto');
  const ciudadEl = document.getElementById('domicilioCiudad');
  if (!deptoEl) return;
  if (ciudadEl) {
    ciudadEl.innerHTML = '<option value="">Seleccionar...</option>';
    ciudadEl.disabled = true;
  }
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

async function cargarCiudadesDomicilioPorDepartamento(codigoDepto, ciudadSeleccionada) {
  const ciudadEl = document.getElementById('domicilioCiudad');
  if (!ciudadEl) return;
  const dep = String(codigoDepto || '').trim();
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
    if (ciudadSeleccionada) ciudadEl.value = ciudadSeleccionada;
  } catch {
    ciudadEl.innerHTML = '<option value="">No disponible</option>';
    ciudadEl.disabled = true;
  }
}

function renderDomicilioResumen() {
  const cont = document.getElementById('domicilioResumen');
  if (!cont) return;

  const dir = getCheckoutDireccion();
  const depto = getDestinoDepto();
  const ciudad = getDestinoCiudad();
  const indic = getCheckoutIndicaciones();

  if (!dir && !depto && !ciudad) {
    cont.innerHTML = '<div class="small text-muted">Agrega un domicilio para calcular la entrega.</div>';
    return;
  }

  const parts = [];
  if (dir) parts.push(dir);
  if (ciudad) parts.push(ciudad);
  cont.innerHTML = `
    <div class="small">
      <div class="fw-semibold">${parts.join(' · ')}</div>
      ${indic ? `<div class="text-muted" style="font-size:12px;">${indic}</div>` : ''}
    </div>
  `;
}

function estimarEntrega(origen, destino, tiempoPreparacion) {
  const o    = String(origen || '').trim().toLowerCase();
  const d    = String(destino || '').trim().toLowerCase();
  const prep = Math.max(0, Number(tiempoPreparacion) || 1);
  if (!d) return null;
  const misma = o && o === d;
  const transit = misma ? 1 : 3;
  const min = prep + transit;
  const max = prep + (misma ? 2 : 5);
  const tipo = misma ? '🚀 Entrega rápida' : '📦 Envío estándar';
  return { min, max, tipo };
}

function formatearRangoDias(eta) {
  if (!eta) return 'Calculado al ingresar ciudad';
  if (eta.min === eta.max) return `${eta.min} día${eta.min !== 1 ? 's' : ''}`;
  return `${eta.min}-${eta.max} días`;
}
function vaciarCarrito() {
  setCarrito([]);
  renderCarrito();
}
function eliminarDelCarrito(id) {
  let carrito = getCarrito();
  carrito = carrito.filter(item => item.id !== id && String(item.id) !== String(id));
  setCarrito(carrito);
  renderCarrito();
}

function actualizarBadgeCarrito() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  const carrito = getCarrito();
  const total = carrito.reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
  badge.textContent = String(total);
  badge.style.display = total > 0 ? 'inline-block' : 'none';
}
function renderCarrito() {
  const carrito = getCarrito();
  const contItems = document.getElementById('carritoItems');
  const contResumen = document.getElementById('carritoResumen');
  const btnContinuar = document.getElementById('btnContinuarCompra');
  const destinoCiudad = getDestinoCiudad();

  if (btnContinuar) {
    btnContinuar.classList.toggle('disabled', !carrito.length);
    btnContinuar.setAttribute('aria-disabled', carrito.length ? 'false' : 'true');
  }

  if (!contItems || !contResumen) {
    return;
  }
  if (!carrito.length) {
    contItems.innerHTML = `
      <div class="text-center py-5">
        <div style="font-size:48px;">🛒</div>
        <h4 class="mt-3">Tu carrito está vacío</h4>
        <p class="text-muted">Agrega productos desde el catálogo para empezar a comprar.</p>
        <a href="index.html" class="btn btn-dark">Ver catálogo</a>
      </div>
    `;
    contResumen.innerHTML = '<div class="text-muted">No hay productos.</div>';
    actualizarBadgeCarrito();
    return;
  }
  let total = 0;
  const totalItems = carrito.reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
  let html = `<div class="small text-muted mb-3">${totalItems} producto${totalItems !== 1 ? 's' : ''}</div>`;
  html += '<div class="vstack gap-3">';
  carrito.forEach(item => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;
    const eta = estimarEntrega(item.ciudad_origen, destinoCiudad, item.tiempo_preparacion);
    const img = item.imagen || 'https://via.placeholder.com/80x80?text=+';
    html += `
      <div class="border rounded-3 p-3 bg-white">
        <div class="d-flex gap-3">
          <div style="width:84px;">
            <img src="${img}" alt="" class="img-fluid rounded" style="width:84px;height:84px;object-fit:cover;">
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between gap-2">
              <div>
                <div class="fw-semibold">${item.nombre}</div>
                <div class="small text-muted">Origen: ${item.ciudad_origen ? item.ciudad_origen : '—'}</div>
                <div class="small text-muted">Llega en: ${formatearRangoDias(eta)} ${eta ? `· ${eta.tipo}` : ''}</div>
              </div>
              <div class="text-end">
                <div class="fw-semibold">$${Number(subtotal).toLocaleString()}</div>
                <div class="small text-muted">$${Number(item.precio).toLocaleString()} c/u</div>
              </div>
            </div>
            <div class="d-flex align-items-center justify-content-between mt-2">
              <div class="d-flex align-items-center gap-2">
                <button class="btn btn-sm btn-outline-secondary" type="button" onclick="cambiarCantidad(${item.id}, -1)">−</button>
                <span class="fw-semibold">${item.cantidad}</span>
                <button class="btn btn-sm btn-outline-secondary" type="button" onclick="cambiarCantidad(${item.id}, 1)">+</button>
              </div>
              <button class="btn btn-sm btn-outline-danger" type="button" onclick="eliminarDelCarrito(${item.id})">Eliminar</button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  contItems.innerHTML = html;

  contResumen.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <span class="text-muted">Producto</span>
      <span>$${Number(total).toLocaleString()}</span>
    </div>
    <div class="d-flex justify-content-between align-items-center pt-2 border-top">
      <span class="fw-bold">Total</span>
      <span class="fw-bold fs-5">$${Number(total).toLocaleString()}</span>
    </div>
  `;

  actualizarBadgeCarrito();
}
function cambiarCantidad(id, delta) {
  let carrito = getCarrito();
  const item = carrito.find(i => i.id === id || String(i.id) === String(id));
  if (!item) return;
  item.cantidad = Math.max(1, (Number(item.cantidad) || 1) + delta);
  setCarrito(carrito);
  renderCarrito();
}

renderCarrito();
window.vaciarCarrito = vaciarCarrito;
window.eliminarDelCarrito = eliminarDelCarrito;
window.cambiarCantidad = cambiarCantidad;

document.addEventListener('DOMContentLoaded', async function () {
  await cargarDepartamentosDomicilio();

  const deptoEl = document.getElementById('domicilioDepto');
  const ciudadEl = document.getElementById('domicilioCiudad');
  const dirEl = document.getElementById('domicilioDireccion');
  const indicEl = document.getElementById('domicilioIndicaciones');
  const msgEl = document.getElementById('domicilioMsg');
  const btnGuardar = document.getElementById('btnGuardarDomicilio');

  if (deptoEl) {
    deptoEl.addEventListener('change', async function () {
      await cargarCiudadesDomicilioPorDepartamento(deptoEl.value);
    });
  }

  const destinoDepto = getDestinoDepto();
  const destinoCiudad = getDestinoCiudad();
  if (deptoEl && destinoDepto) {
    deptoEl.value = destinoDepto;
    await cargarCiudadesDomicilioPorDepartamento(destinoDepto, destinoCiudad);
  } else if (ciudadEl && destinoCiudad) {
    ciudadEl.disabled = false;
    ciudadEl.innerHTML = `<option value="${destinoCiudad}">${destinoCiudad}</option>`;
    ciudadEl.value = destinoCiudad;
  }

  if (dirEl) dirEl.value = getCheckoutDireccion();
  if (indicEl) indicEl.value = getCheckoutIndicaciones();

  renderDomicilioResumen();

  if (btnGuardar) {
    btnGuardar.addEventListener('click', async function () {
      if (msgEl) msgEl.textContent = '';
      const direccion = (dirEl?.value || '').trim();
      const dep = (deptoEl?.value || '').trim();
      const ciudad = (ciudadEl?.value || '').trim();
      const indic = (indicEl?.value || '').trim();

      if (!direccion || !dep || !ciudad) {
        if (msgEl) msgEl.innerHTML = '<div class="alert alert-warning py-2 mb-0">Completa dirección, departamento y ciudad.</div>';
        return;
      }

      setCheckoutDireccion(direccion);
      setDestinoDepto(dep);
      setDestinoCiudad(ciudad);
      setCheckoutIndicaciones(indic);

      renderDomicilioResumen();
      renderCarrito();

      try {
        const collapseEl = document.getElementById('domicilioForm');
        if (collapseEl && window.bootstrap) {
          const c = window.bootstrap.Collapse.getOrCreateInstance(collapseEl);
          c.hide();
        }
      } catch {}
    });
  }
});

function checkout() {
  const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
  if (carrito.length === 0) {
    alert('Tu carrito está vacío');
    return;
  }
  window.location.href = 'checkout-stripe.html';
}
window.checkout = checkout;
