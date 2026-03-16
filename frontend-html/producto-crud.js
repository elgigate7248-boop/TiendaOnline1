// producto-crud.js — CRUD completo de productos
const API = 'http://localhost:5000';

function getToken() {
  return localStorage.getItem('token') || '';
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function cargarDepartamentosProducto() {
  const deptoEl = document.getElementById('prodDeptoOrigen');
  const ciudadEl = document.getElementById('prodCiudadOrigen');
  if (!deptoEl) return;
  if (ciudadEl) {
    ciudadEl.innerHTML = '<option value="">Seleccionar...</option>';
    ciudadEl.disabled = true;
  }
  deptoEl.disabled = true;
  try {
    const res = await fetch(`${API}/ubicacion/departamentos`);
    const data = await safeJson(res);
    if (!res.ok) {
      deptoEl.innerHTML = '<option value="">No disponible</option>';
      return;
    }
    deptoEl.innerHTML = '<option value="">Seleccionar...</option>' +
      (Array.isArray(data) ? data : []).map(d => `<option value="${d.codigo_dane}">${escapeHtml(d.nombre)}</option>`).join('');
  } catch {
    deptoEl.innerHTML = '<option value="">No disponible</option>';
  } finally {
    deptoEl.disabled = false;
  }
}

async function cargarCiudadesProductoPorDepto(codigoDepto, ciudadSeleccionada) {
  const ciudadEl = document.getElementById('prodCiudadOrigen');
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
    const res = await fetch(`${API}/ubicacion/ciudades?departamento=${encodeURIComponent(dep)}`);
    const data = await safeJson(res);
    if (!res.ok) {
      ciudadEl.innerHTML = '<option value="">No disponible</option>';
      ciudadEl.disabled = true;
      return;
    }
    ciudadEl.innerHTML = '<option value="">Seleccionar...</option>' +
      (Array.isArray(data) ? data : []).map(c => `<option value="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</option>`).join('');
    ciudadEl.disabled = false;
    if (ciudadSeleccionada) ciudadEl.value = ciudadSeleccionada;
  } catch {
    ciudadEl.innerHTML = '<option value="">No disponible</option>';
    ciudadEl.disabled = true;
  }
}

async function initUbicacionProducto(ciudadSeleccionada) {
  const deptoEl = document.getElementById('prodDeptoOrigen');
  const ciudadEl = document.getElementById('prodCiudadOrigen');
  if (!deptoEl || !ciudadEl) return;
  await cargarDepartamentosProducto();
  deptoEl.onchange = async function () {
    await cargarCiudadesProductoPorDepto(deptoEl.value);
  };

  deptoEl.value = '';
  ciudadEl.value = '';
  ciudadEl.innerHTML = '<option value="">Seleccionar...</option>';
  ciudadEl.disabled = true;

  const ciudad = String(ciudadSeleccionada || '').trim();
  if (ciudad) {
    ciudadEl.disabled = false;
    ciudadEl.innerHTML = `<option value="${escapeHtml(ciudad)}">${escapeHtml(ciudad)}</option>`;
    ciudadEl.value = ciudad;
  }
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function getRoles(user) {
  if (!user) return [];
  if (Array.isArray(user.roles)) {
    return user.roles
      .map(r => (r && typeof r === 'object') ? r.nombre : r)
      .map(r => String(r || '').trim().toUpperCase())
      .filter(Boolean);
  }
  if (user.rol) return [String(user.rol).trim().toUpperCase()];
  return [];
}

function puedeGestionarProductos() {
  if (!getToken()) return false;
  const roles = getRoles(getUser());
  return roles.includes('ADMIN') || roles.includes('SUPER_ADMIN') || roles.includes('VENDEDOR');
}

function fetchAuth(url, opts = {}) {
  const token = getToken();
  const headers = { ...(opts.headers || {}), 'Authorization': 'Bearer ' + token };
  const method = String(opts.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  return fetch(url, {
    ...opts,
    headers
  });
}

function escapeHtml(str) {
  if (window.UIKit && typeof window.UIKit.escapeHtml === 'function') {
    return window.UIKit.escapeHtml(str);
  }
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

let allProductos = [];
let allCategorias = [];
const MAX_IMAGE_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// ── Cargar datos iniciales ──
async function init() {
  if (!puedeGestionarProductos()) {
    showToast('No tienes permisos para acceder a Gestión de Productos.', 'warning');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
    return;
  }

  try {
    const [resProd, resCat] = await Promise.all([
      fetchAuth(`${API}/producto/gestion`),
      fetch(`${API}/categoria`)
    ]);
    if (!resProd.ok) {
      if (resProd.status === 401) {
        showToast('Tu sesión expiró. Inicia sesión nuevamente.', 'warning');
        setTimeout(() => { window.location.href = 'login.html?redirect=producto.html'; }, 800);
        return;
      }
      if (resProd.status === 403) {
        showToast('No tienes permisos para gestionar productos.', 'warning');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
        return;
      }
      throw new Error(`No autorizado (HTTP ${resProd.status})`);
    }
    const prodData = await resProd.json();
    allProductos = Array.isArray(prodData) ? prodData : [];
    const catData = await resCat.json();
    allCategorias = Array.isArray(catData) ? catData : [];
  } catch (err) {
    console.error('Error cargando datos iniciales:', err);
    allProductos = [];
    allCategorias = [];
  }

  // Populate category filter
  const filtro = document.getElementById('filtroCategoria');
  filtro.innerHTML = '<option value="">Todas las categorías</option>';
  allCategorias.forEach(c => {
    filtro.innerHTML += `<option value="${c.id_categoria || c.id}">${escapeHtml(c.nombre)}</option>`;
  });

  await cargarProductos();
  setupEventListeners();
}

// ── Cargar y renderizar productos ──
async function cargarProductos() {
  const cont = document.getElementById('productosList');
  cont.innerHTML = '<div class="text-muted text-center py-4">Cargando productos...</div>';
  try {
    const res = await fetchAuth(`${API}/producto/gestion`);
    if (!res.ok) {
      if (res.status === 401) {
        cont.innerHTML = '<div class="alert alert-warning">Tu sesión expiró. Serás redirigido al login...</div>';
        setTimeout(() => { window.location.href = 'login.html?redirect=producto.html'; }, 900);
        return;
      }
      if (res.status === 403) {
        cont.innerHTML = '<div class="alert alert-warning">No tienes permisos para gestionar productos.</div>';
        return;
      }
      throw new Error(`No autorizado (HTTP ${res.status})`);
    }
    const data = await res.json();
    allProductos = Array.isArray(data) ? data : [];
    renderProductos();
  } catch (err) {
    cont.innerHTML = '<div class="alert alert-danger">Error al cargar productos: ' + escapeHtml(err.message) + '</div>';
  }
}

function renderProductos() {
  const cont = document.getElementById('productosList');
  let filtered = [...allProductos];

  // Apply filters
  const buscar = (document.getElementById('filtroBuscar')?.value || '').toLowerCase().trim();
  const catId = document.getElementById('filtroCategoria')?.value || '';
  const stockFilter = document.getElementById('filtroStock')?.value || '';

  if (buscar) {
    filtered = filtered.filter(p => (p.nombre || '').toLowerCase().includes(buscar) || (p.descripcion || '').toLowerCase().includes(buscar));
  }
  if (catId) {
    filtered = filtered.filter(p => String(p.id_categoria) === String(catId));
  }
  if (stockFilter === 'disponible') filtered = filtered.filter(p => p.stock > 0);
  else if (stockFilter === 'agotado') filtered = filtered.filter(p => p.stock <= 0);
  else if (stockFilter === 'bajo') filtered = filtered.filter(p => p.stock > 0 && p.stock <= 10);

  if (!filtered.length) {
    cont.innerHTML = `
      <div class="text-center py-5">
        <div style="font-size:48px;">📦</div>
        <h5 class="mt-2">${allProductos.length ? 'No se encontraron productos con estos filtros' : 'No hay productos registrados'}</h5>
        <p class="text-muted">${allProductos.length ? 'Intenta con otros criterios de búsqueda.' : 'Haz clic en "+ Nuevo Producto" para agregar el primero.'}</p>
      </div>`;
    return;
  }

  let html = `<div class="small text-muted mb-2">${filtered.length} producto${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}</div>`;
  html += `<div class="card shadow-sm"><div class="table-responsive"><table class="table table-hover align-middle mb-0">
    <thead class="table-light">
      <tr>
        <th style="width:50px;">ID</th>
        <th style="width:60px;"></th>
        <th>Producto</th>
        <th>Categoría</th>
        <th>Vendedor</th>
        <th class="text-end">Precio</th>
        <th class="text-center">Stock</th>
        <th style="width:180px;">Acciones</th>
      </tr>
    </thead><tbody>`;

  filtered.forEach(p => {
    const id = p.id_producto || p.id;
    const catNombre = p.categoria_nombre ? escapeHtml(p.categoria_nombre) : '<span class="text-muted">—</span>';
    const vend = p.vendedor_nombre
      ? `<div class="small">${escapeHtml(p.vendedor_nombre)}</div><div class="small text-muted">${escapeHtml(p.vendedor_email || '')}</div>`
      : '<span class="text-muted small">Sin asignar</span>';
    const stockClass = p.stock > 10 ? 'bg-success' : (p.stock > 0 ? 'bg-warning text-dark' : 'bg-danger');
    const imgThumb = p.imagen
      ? `<img src="${escapeHtml(p.imagen)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;" onerror="this.outerHTML='<div style=\\'width:40px;height:40px;background:#f0f0f0;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;\\'>📦</div>'">`
      : '<div style="width:40px;height:40px;background:#f0f0f0;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;">📦</div>';
    const desc = p.descripcion
      ? escapeHtml(p.descripcion.length > 70 ? p.descripcion.slice(0, 70) + '...' : p.descripcion)
      : '<em class="text-muted">Sin descripción</em>';

    html += `<tr>
      <td class="text-muted small">${id}</td>
      <td>${imgThumb}</td>
      <td>
        <div class="fw-semibold">${escapeHtml(p.nombre)}</div>
        <div class="small text-muted">${desc}</div>
      </td>
      <td><span class="badge bg-light text-dark border">${catNombre}</span></td>
      <td>${vend}</td>
      <td class="text-end fw-semibold">$${Number(p.precio || 0).toLocaleString()}</td>
      <td class="text-center"><span class="badge ${stockClass}">${p.stock}</span></td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-primary" onclick="abrirEditar(${id})">Editar</button>
          <button class="btn btn-sm btn-outline-danger" onclick="abrirEliminar(${id})">Eliminar</button>
        </div>
      </td>
    </tr>`;
  });

  html += '</tbody></table></div></div>';
  cont.innerHTML = html;
}

// ── Event listeners ──
function setupEventListeners() {
  document.getElementById('btnNuevoProducto').onclick = abrirCrear;
  document.getElementById('filtroBuscar').oninput = renderProductos;
  document.getElementById('filtroCategoria').onchange = renderProductos;
  document.getElementById('filtroStock').onchange = renderProductos;
  document.getElementById('btnLimpiarFiltros').onclick = () => {
    document.getElementById('filtroBuscar').value = '';
    document.getElementById('filtroCategoria').value = '';
    document.getElementById('filtroStock').value = '';
    renderProductos();
  };

  inicializarUploaderImagen();
}

function renderPreviewImagen(url) {
  const preview = document.getElementById('prodImagenPreview');
  if (!preview) return;
  if (url) {
    preview.innerHTML = `<img src="${escapeHtml(url)}" alt="Vista previa" style="max-height:120px;border-radius:8px;max-width:100%;object-fit:contain;" onerror="this.outerHTML='<span class=\\'text-muted small\\'>No se pudo cargar la imagen</span>'">`;
  } else {
    preview.innerHTML = '';
  }
}

function inicializarUploaderImagen() {
  if (window.UIKit && typeof window.UIKit.bindImageUploader === 'function') {
    window.UIKit.bindImageUploader({
      inputUrlId: 'prodImagen',
      inputFileId: 'prodImagenArchivo',
      dropZoneId: 'prodDropZoneCrud',
      maxSizeBytes: MAX_IMAGE_FILE_SIZE,
      onLoaded: (url) => renderPreviewImagen(url),
      onInvalidType: () => showToast('El archivo seleccionado no es una imagen válida.', 'warning'),
      onTooLarge: () => showToast('La imagen supera 2 MB. Elige un archivo más liviano.', 'warning'),
      onError: () => showToast('No se pudo leer la imagen seleccionada.', 'error')
    });
    return;
  }

  const inputUrl = document.getElementById('prodImagen');
  if (!inputUrl) return;
  inputUrl.addEventListener('input', () => renderPreviewImagen(inputUrl.value.trim()));
}

// ── Cargar categorías en el modal ──
function cargarCategoriasModal(selectedId) {
  const select = document.getElementById('prodCategoria');
  select.innerHTML = '<option value="">Seleccionar categoría...</option>';
  allCategorias.forEach(c => {
    const cid = c.id_categoria || c.id;
    select.innerHTML += `<option value="${cid}" ${String(cid) === String(selectedId) ? 'selected' : ''}>${escapeHtml(c.nombre)}</option>`;
  });
}

// ── Abrir modal CREAR ──
function abrirCrear() {
  document.getElementById('prodId').value = '';
  document.getElementById('prodNombre').value = '';
  document.getElementById('prodDescripcion').value = '';
  document.getElementById('prodPrecio').value = '';
  document.getElementById('prodStock').value = '';
  document.getElementById('prodImagen').value = '';
  const imgFile = document.getElementById('prodImagenArchivo');
  if (imgFile) imgFile.value = '';
  document.getElementById('prodImagenPreview').innerHTML = '';
  document.getElementById('prodMsg').innerHTML = '';
  document.getElementById('modalProductoLabel').textContent = 'Nuevo Producto';
  document.getElementById('btnGuardarProducto').textContent = 'Crear Producto';
  cargarCategoriasModal('');
  initUbicacionProducto('');

  document.getElementById('formProducto').onsubmit = async function (e) {
    e.preventDefault();
    const btn = document.getElementById('btnGuardarProducto');
    const msg = document.getElementById('prodMsg');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Creando...';
    msg.innerHTML = '';

    const body = {
      nombre: document.getElementById('prodNombre').value,
      descripcion: document.getElementById('prodDescripcion').value,
      precio: document.getElementById('prodPrecio').value,
      stock: document.getElementById('prodStock').value,
      id_categoria: document.getElementById('prodCategoria').value,
      imagen: document.getElementById('prodImagen').value,
      ciudad_origen: (document.getElementById('prodCiudadOrigen')?.value || '').trim()
    };

    try {
      const res = await fetchAuth(`${API}/producto`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        msg.innerHTML = '<div class="alert alert-success py-2">Producto creado correctamente.</div>';
        setTimeout(() => {
          bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
          cargarProductos();
        }, 700);
      } else {
        msg.innerHTML = '<div class="alert alert-danger py-2">' + escapeHtml((data && (data.error || data.mensaje)) || 'Error al crear producto') + '</div>';
      }
    } catch {
      msg.innerHTML = '<div class="alert alert-danger py-2">Error de conexión.</div>';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Crear Producto';
    }
  };

  new bootstrap.Modal(document.getElementById('modalProducto')).show();
}

// ── Abrir modal EDITAR ──
window.abrirEditar = async function (id) {
  const msg = document.getElementById('prodMsg');
  msg.innerHTML = '';
  document.getElementById('modalProductoLabel').textContent = 'Editar Producto';
  document.getElementById('btnGuardarProducto').textContent = 'Guardar Cambios';

  try {
    const res = await fetch(`${API}/producto/${id}`);
    if (!res.ok) {
      showToast('Producto no encontrado', 'warning');
      return;
    }
    const p = await res.json();

    document.getElementById('prodId').value = id;
    document.getElementById('prodNombre').value = p.nombre || '';
    document.getElementById('prodDescripcion').value = p.descripcion || '';
    document.getElementById('prodPrecio').value = p.precio || '';
    document.getElementById('prodStock').value = p.stock ?? '';
    document.getElementById('prodImagen').value = p.imagen || '';
    const imgFile = document.getElementById('prodImagenArchivo');
    if (imgFile) imgFile.value = '';
    renderPreviewImagen(p.imagen || '');
    cargarCategoriasModal(p.id_categoria);
    await initUbicacionProducto(p.ciudad_origen || '');

    document.getElementById('formProducto').onsubmit = async function (e) {
      e.preventDefault();
      const btn = document.getElementById('btnGuardarProducto');
      const msgEl = document.getElementById('prodMsg');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
      msgEl.innerHTML = '';

      const body = {
        nombre: document.getElementById('prodNombre').value,
        descripcion: document.getElementById('prodDescripcion').value,
        precio: document.getElementById('prodPrecio').value,
        stock: document.getElementById('prodStock').value,
        id_categoria: document.getElementById('prodCategoria').value,
        imagen: document.getElementById('prodImagen').value,
        ciudad_origen: (document.getElementById('prodCiudadOrigen')?.value || '').trim()
      };

      try {
        const resUpd = await fetchAuth(`${API}/producto/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        const data = await resUpd.json().catch(() => null);
        if (resUpd.ok) {
          msgEl.innerHTML = '<div class="alert alert-success py-2">Producto actualizado correctamente.</div>';
          setTimeout(() => {
            bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
            cargarProductos();
          }, 700);
        } else {
          msgEl.innerHTML = '<div class="alert alert-danger py-2">' + escapeHtml((data && (data.error || data.mensaje)) || 'Error al actualizar') + '</div>';
        }
      } catch {
        msgEl.innerHTML = '<div class="alert alert-danger py-2">Error de conexión.</div>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar Cambios';
      }
    };

    new bootstrap.Modal(document.getElementById('modalProducto')).show();
  } catch (err) {
    showToast('Error al cargar producto: ' + err.message, 'error');
  }
};

// ── Abrir modal ELIMINAR ──
window.abrirEliminar = function (id) {
  const producto = allProductos.find(p => (p.id_producto || p.id) == id);
  document.getElementById('eliminarNombre').textContent = producto ? producto.nombre : `#${id}`;
  document.getElementById('eliminarMsg').innerHTML = '';

  const btn = document.getElementById('btnConfirmarEliminar');
  btn.disabled = false;
  btn.textContent = 'Eliminar';
  btn.onclick = async function () {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Eliminando...';
    try {
      const res = await fetchAuth(`${API}/producto/${id}`, { method: 'DELETE' });
      if (res.ok) {
        bootstrap.Modal.getInstance(document.getElementById('modalEliminar')).hide();
        cargarProductos();
      } else {
        const data = await res.json().catch(() => null);
        document.getElementById('eliminarMsg').innerHTML = '<div class="alert alert-danger py-2 small">' + escapeHtml((data && (data.error || data.mensaje)) || 'Error al eliminar') + '</div>';
        btn.disabled = false;
        btn.textContent = 'Eliminar';
      }
    } catch {
      document.getElementById('eliminarMsg').innerHTML = '<div class="alert alert-danger py-2 small">Error de conexión.</div>';
      btn.disabled = false;
      btn.textContent = 'Eliminar';
    }
  };

  new bootstrap.Modal(document.getElementById('modalEliminar')).show();
};

// ── Init ──
document.addEventListener('DOMContentLoaded', init);
