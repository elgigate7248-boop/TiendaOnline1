// Panel de administración básico: productos, categorías, usuarios, pedidos, roles, dashboard
// Requiere token de admin en localStorage
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

// Extraer correctamente los nombres de los roles desde el formato del backend
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

window.showFeatureToast = function (message) {
  showToast(message, 'info');
};

// Dashboard
async function cargarDashboard() {
  try {
    // Cargar estadísticas básicas
    const [productosRes, usuariosRes, pedidosRes] = await Promise.all([
      fetchAuth(`${API_BASE}/producto`),
      fetchAuth(`${API_BASE}/usuario`),
      fetchAuth(`${API_BASE}/pedido`)
    ]);

    const productos = await productosRes.json();
    const usuarios = await usuariosRes.json();
    const pedidos = await pedidosRes.json();

    // Actualizar contadores
    document.getElementById('statProductos').textContent = Array.isArray(productos) ? productos.length : 0;
    document.getElementById('statUsuarios').textContent = Array.isArray(usuarios) ? usuarios.length : 0;
    document.getElementById('statPedidos').textContent = Array.isArray(pedidos) ? pedidos.length : 0;
    
    // Calcular ventas totales (simulado)
    const totalVentas = Array.isArray(pedidos) ? pedidos.reduce((sum, p) => sum + (Number(p.total) || 0), 0) : 0;
    document.getElementById('statVentas').textContent = `$${totalVentas.toFixed(2)}`;

    // Actividad reciente
    const actividad = [
      `📦 ${productos.length} productos en catálogo`,
      `👥 ${usuarios.length} usuarios registrados`,
      `🛒 ${pedidos.length} pedidos procesados`,
      `💰 $${totalVentas.toFixed(2)} en ventas totales`
    ];
    
    document.getElementById('actividadReciente').innerHTML = actividad.map(item => 
      `<div class="mb-1">${item}</div>`
    ).join('');

  } catch (error) {
    console.error('Error cargando dashboard:', error);
  }
}

function formatearDinero(valor) {
  return `$${Number(valor || 0).toLocaleString()}`;
}

window.descargarReporteCsv = async function () {
  try {
    const res = await fetchAuth(`${API_BASE}/pedido/reportes/resumen/csv?top=5`, {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'text/csv'
      }
    });

    if (!res.ok) {
      const body = await safeJson(res);
      showToast((body && (body.error || body.mensaje)) || 'No se pudo descargar el reporte CSV', 'error');
      return;
    }

    const blob = await res.blob();
    const dispo = res.headers.get('content-disposition') || '';
    const fileMatch = dispo.match(/filename="([^"]+)"/i);
    const fileName = fileMatch ? fileMatch[1] : `reporte_tienda_${new Date().toISOString().slice(0,10)}.csv`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Reporte CSV descargado correctamente', 'success');
  } catch (err) {
    showToast('Error al descargar reporte CSV', 'error');
  }
};

async function cargarEstadisticas() {
  const cont = document.getElementById('estadisticas');
  if (!cont) return;
  cont.innerHTML = '<div class="text-muted py-4 text-center">Cargando estadísticas...</div>';
  try {
    const res = await fetchAuth(`${API_BASE}/pedido/reportes/resumen?top=5`);
    const data = await safeJson(res);
    if (!res.ok || !data) {
      renderError('estadisticas', 'No se pudieron cargar las estadísticas.', data?.error || data?.mensaje || `HTTP ${res.status}`);
      return;
    }

    const totales = data.totales || {};
    const porEstado = Array.isArray(data.por_estado) ? data.por_estado : [];
    const topProductos = Array.isArray(data.top_productos) ? data.top_productos : [];
    const ventasMensuales = Array.isArray(data.ventas_mensuales) ? data.ventas_mensuales : [];

    const estadoHtml = porEstado.length
      ? `<div class="card"><div class="card-body"><h6 class="mb-3">Pedidos por estado</h6><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Estado</th><th class="text-end">Cantidad</th><th class="text-end">Total</th></tr></thead><tbody>${porEstado.map(e => `<tr><td>${escapeHtml(e.estado)}</td><td class="text-end fw-semibold">${Number(e.cantidad || 0)}</td><td class="text-end">${formatearDinero(e.total)}</td></tr>`).join('')}</tbody></table></div></div></div>`
      : '<div class="card"><div class="card-body text-muted">Sin datos de estados.</div></div>';

    const topHtml = topProductos.length
      ? `<div class="card"><div class="card-body"><h6 class="mb-3">Top productos vendidos</h6><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Producto</th><th class="text-end">Unidades</th><th class="text-end">Ingresos</th></tr></thead><tbody>${topProductos.map(p => `<tr><td>${escapeHtml(p.nombre)}</td><td class="text-end fw-semibold">${Number(p.unidades || 0)}</td><td class="text-end">${formatearDinero(p.ingresos)}</td></tr>`).join('')}</tbody></table></div></div></div>`
      : '<div class="card"><div class="card-body text-muted">Sin datos de productos vendidos.</div></div>';

    const mensualHtml = ventasMensuales.length
      ? `<div class="card"><div class="card-body"><h6 class="mb-3">Ventas por mes (últimos 6)</h6><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Periodo</th><th class="text-end">Pedidos</th><th class="text-end">Ventas</th></tr></thead><tbody>${ventasMensuales.map(m => `<tr><td>${escapeHtml(m.periodo)}</td><td class="text-end fw-semibold">${Number(m.pedidos || 0)}</td><td class="text-end">${formatearDinero(m.ventas)}</td></tr>`).join('')}</tbody></table></div></div></div>`
      : '<div class="card"><div class="card-body text-muted">Sin datos mensuales.</div></div>';

    cont.innerHTML = `
      <div class="d-flex justify-content-end mb-3">
        <button class="btn btn-outline-dark btn-sm" type="button" onclick="descargarReporteCsv()">Descargar CSV</button>
      </div>
      <div class="row g-3 mb-3">
        <div class="col-md-4"><div class="card"><div class="card-body"><div class="small text-muted">Total pedidos</div><div class="h4 mb-0">${Number(totales.total_pedidos || 0)}</div></div></div></div>
        <div class="col-md-4"><div class="card"><div class="card-body"><div class="small text-muted">Ventas totales</div><div class="h4 mb-0">${formatearDinero(totales.ventas_totales)}</div></div></div></div>
        <div class="col-md-4"><div class="card"><div class="card-body"><div class="small text-muted">Ticket promedio</div><div class="h4 mb-0">${formatearDinero(totales.ticket_promedio)}</div></div></div></div>
      </div>
      <div class="row g-3">
        <div class="col-lg-6">${estadoHtml}</div>
        <div class="col-lg-6">${topHtml}</div>
        <div class="col-12">${mensualHtml}</div>
      </div>
    `;
  } catch (err) {
    renderError('estadisticas', 'No se pudieron cargar las estadísticas.', err?.message || 'Error de conexión');
  }
}

// ── Abrir modal CREAR producto ──
async function abrirCrearProducto() {
  const inputArchivo = document.getElementById('prodImagen');
  if (inputArchivo) inputArchivo.value = '';
  actualizarPreviewImagenProducto('');
  document.getElementById('prodMsg').innerHTML = '';
  document.getElementById('modalProductoLabel').textContent = 'Nuevo Producto';
  const select = document.getElementById('prodCategoria');
  try {
    const res = await fetchAuth(`${API_BASE}/categoria`);
    if (res.ok) {
      const cats = await res.json();
      select.innerHTML = '<option value="">Seleccionar...</option>' + 
        cats.map(c => `<option value="${c.id_categoria}">${c.nombre}</option>`).join('');
    } else {
      select.innerHTML = '<option>Error al cargar categorías</option>';
    }
  } catch {
    select.innerHTML = '<option>Error al cargar categorías</option>';
  }
  const modal = new bootstrap.Modal(document.getElementById('modalProducto'));
  modal.show();
};

// ── Actualizar preview de imagen ──
function actualizarPreviewImagenProducto(url) {
  const preview = document.getElementById('prodImagenPreview');
  if (!preview) return;
  
  if (url) {
    preview.innerHTML = `<img src="${url}" class="img-fluid rounded" style="max-height: 200px;" alt="Preview">`;
  } else {
    preview.innerHTML = `<img src="https://via.placeholder.com/200x200?text=Sin+imagen" class="img-fluid rounded" style="max-height: 200px;" alt="Preview">`;
  }
}

// ── Event listener para preview de imagen ──
document.addEventListener('DOMContentLoaded', function() {
  const inputImagen = document.getElementById('prodImagen');
  if (inputImagen) {
    inputImagen.addEventListener('input', function() {
      actualizarPreviewImagenProducto(inputImagen.value.trim());
    });
  }

  // Event listener para tabs - cargar productos cuando se activa la pestaña
  const productosTab = document.querySelector('[data-bs-target="#productos"]');
  if (productosTab) {
    productosTab.addEventListener('shown.bs.tab', function() {
      cargarProductos();
    });
  }
});

// Productos
function cargarProductos() {
  const cont = document.getElementById('productosList');
  cont.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="text-muted">Cargando productos...</div></td></tr>';
  fetchAuth(`${API_BASE}/producto`)
    .then(async res => {
      if (!res.ok) {
        const body = await safeJson(res);
        renderError('productos', 'No se pudieron cargar los productos.', body?.error || body?.mensaje || `HTTP ${res.status}`);
        return null;
      }
      return res.json();
    })
    .then(productos => {
      if (!productos) return;
      const arr = Array.isArray(productos) ? productos : [];
      
      if (!arr.length) {
        cont.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="text-muted">No hay productos registrados</div></td></tr>';
        return;
      }
      
      let html = '';
      arr.forEach(p => {
        const id = p.id_producto || p.id;
        const catNombre = p.categoria_nombre ? escapeHtml(p.categoria_nombre) : '<span class="text-muted">Sin categoría</span>';
        const vend = p.vendedor_nombre
          ? `<div>${escapeHtml(p.vendedor_nombre)}</div><div class="small text-muted">${escapeHtml(p.vendedor_email || '')}</div>`
          : '<span class="text-muted">Sin asignar</span>';
        const stockBadge = p.stock > 10 ? 'bg-success' : (p.stock > 0 ? 'bg-warning text-dark' : 'bg-danger');
        const imgThumb = p.imagen ? `<img src="${escapeHtml(p.imagen)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">` : '<div style="width:40px;height:40px;background:#eee;border-radius:6px;display:flex;align-items:center;justify-content:center;">📦</div>';
        
        html += `<tr>
          <td class="text-muted small">${id}</td>
          <td>${imgThumb}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(p.nombre)}</div>
            <div class="small text-muted">${p.descripcion ? escapeHtml(p.descripcion.slice(0,80)) + (p.descripcion.length > 80 ? '...' : '') : '<em>Sin descripción</em>'}</div>
          </td>
          <td><span class="badge bg-light text-dark border">${catNombre}</span></td>
          <td>${vend}</td>
          <td class="text-end fw-semibold">$${Number(p.precio).toLocaleString()}</td>
          <td class="text-center"><span class="badge ${stockBadge}">${p.stock}</span></td>
          <td>
            <div class="d-flex gap-1">
              <button class='btn btn-sm btn-outline-secondary' onclick='gestionarAtributos(${id})' title="Atributos">⚙</button>
              <button class='btn btn-sm btn-outline-primary' onclick='editarProducto(${id})'>Editar</button>
              <button class='btn btn-sm btn-outline-danger' onclick='eliminarProducto(${id})'>Eliminar</button>
            </div>
          </td>
        </tr>`;
      });
      
      cont.innerHTML = html;
    })
    .catch(err => {
      console.error('Error cargando productos:', err);
      renderError('productos', 'Error al cargar productos.', err.message);
    });
}

// Categorías
function cargarCategorias() {
  const cont = document.getElementById('categorias');
  cont.innerHTML = '<div class="text-muted py-3">Cargando categorías...</div>';
  fetchAuth(`${API_BASE}/categoria`)
    .then(async res => {
      if (!res.ok) {
        const body = await safeJson(res);
        renderError('categorias', 'No se pudieron cargar las categorías.', body?.error || body?.mensaje || `HTTP ${res.status}`);
        return null;
      }
      return res.json();
    })
    .then(categorias => {
      if (!categorias) return;
      const arr = Array.isArray(categorias) ? categorias : [];
      let html = `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h3 class="h5 mb-1">Categorías (${arr.length})</h3>
            <div class="small text-muted">Gestiona las categorías de productos</div>
          </div>
          <button class='btn btn-success' onclick='mostrarFormCategoria()'>+ Nueva Categoría</button>
        </div>`;
      if (!arr.length) {
        html += '<div class="alert alert-light border text-center">No hay categorías registradas.</div>';
      } else {
        html += `<div class="card"><div class="table-responsive"><table class='table table-hover align-middle mb-0'>
          <thead><tr><th>ID</th><th>Nombre</th><th>Descripción</th><th></th></tr></thead><tbody>`;
        arr.forEach(c => {
          const id = c.id_categoria || c.id;
          html += `<tr>
            <td class="text-muted small">${id}</td>
            <td class="fw-semibold">${escapeHtml(c.nombre)}</td>
            <td class="text-muted small">${escapeHtml(c.descripcion || '—')}</td>
            <td class="text-end">
              <button class='btn btn-sm btn-outline-warning' onclick='editarCategoria(${id})'>Editar</button>
              <button class='btn btn-sm btn-outline-danger' onclick='eliminarCategoria(${id})'>Eliminar</button>
            </td>
          </tr>`;
        });
        html += '</tbody></table></div></div>';
      }
      cont.innerHTML = html;
    })
    .catch(err => {
      console.error('Error cargando categorías:', err);
      renderError('categorias', 'Error al cargar categorías.', err.message);
    });
}

// Usuarios
function ensureUsuarioModal() {
  if (document.getElementById('modalUsuarioCrud')) return;
  const html = `
    <div class="modal fade" id="modalUsuarioCrud" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="formUsuarioCrud">
            <div class="modal-header">
              <h5 class="modal-title" id="modalUsuarioCrudLabel">Nuevo usuario</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="usuarioCrudId">
              <div class="mb-3">
                <label class="form-label fw-semibold">Nombre</label>
                <input type="text" class="form-control" id="usuarioCrudNombre" required>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Email</label>
                <input type="email" class="form-control" id="usuarioCrudEmail" required>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Teléfono</label>
                <input type="text" class="form-control" id="usuarioCrudTelefono" placeholder="Opcional">
              </div>
              <div class="mb-1" id="usuarioCrudPasswordWrap">
                <label class="form-label fw-semibold">Contraseña</label>
                <input type="password" class="form-control" id="usuarioCrudPassword" minlength="6" placeholder="Mínimo 6 caracteres">
                <div class="form-text">Solo requerida al crear usuario.</div>
              </div>
              <div id="usuarioCrudMsg" class="mt-3"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="btnGuardarUsuarioCrud">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

window.abrirNuevoUsuarioAdmin = function () {
  if (!puedeCrudUsuarios) {
    showToast('Solo ADMIN puede crear usuarios.', 'warning');
    return;
  }
  ensureUsuarioModal();
  document.getElementById('modalUsuarioCrudLabel').textContent = 'Nuevo usuario';
  document.getElementById('usuarioCrudId').value = '';
  document.getElementById('usuarioCrudNombre').value = '';
  document.getElementById('usuarioCrudEmail').value = '';
  document.getElementById('usuarioCrudTelefono').value = '';
  document.getElementById('usuarioCrudPassword').value = '';
  document.getElementById('usuarioCrudPasswordWrap').style.display = '';
  document.getElementById('usuarioCrudPassword').required = true;
  document.getElementById('usuarioCrudMsg').innerHTML = '';
  new bootstrap.Modal(document.getElementById('modalUsuarioCrud')).show();
};

window.editarUsuarioAdmin = async function (id) {
  if (!puedeCrudUsuarios) {
    showToast('Solo ADMIN puede editar usuarios.', 'warning');
    return;
  }
  ensureUsuarioModal();
  try {
    const res = await fetchAuth(`${API_BASE}/usuario/${id}`);
    const data = await safeJson(res);
    if (!res.ok || !data) {
      showToast((data && (data.error || data.mensaje)) || 'No se pudo cargar el usuario', 'error');
      return;
    }
    document.getElementById('modalUsuarioCrudLabel').textContent = `Editar usuario #${id}`;
    document.getElementById('usuarioCrudId').value = String(id);
    document.getElementById('usuarioCrudNombre').value = data.nombre || '';
    document.getElementById('usuarioCrudEmail').value = data.email || '';
    document.getElementById('usuarioCrudTelefono').value = data.telefono || '';
    document.getElementById('usuarioCrudPassword').value = '';
    document.getElementById('usuarioCrudPasswordWrap').style.display = 'none';
    document.getElementById('usuarioCrudPassword').required = false;
    document.getElementById('usuarioCrudMsg').innerHTML = '';
    new bootstrap.Modal(document.getElementById('modalUsuarioCrud')).show();
  } catch (err) {
    showToast(err.message || 'Error al cargar usuario', 'error');
  }
};

window.eliminarUsuarioAdmin = async function (id) {
  if (!puedeCrudUsuarios) {
    showToast('Solo ADMIN puede eliminar usuarios.', 'warning');
    return;
  }
  if (!confirm(`¿Eliminar el usuario #${id}?`)) return;
  try {
    const res = await fetchAuth(`${API_BASE}/usuario/${id}`, { method: 'DELETE' });
    const data = await safeJson(res);
    if (!res.ok) {
      showToast((data && (data.error || data.mensaje)) || 'No se pudo eliminar el usuario', 'error');
      return;
    }
    showToast('Usuario eliminado correctamente', 'success');
    cargarUsuarios();
  } catch (err) {
    showToast(err.message || 'Error de conexión', 'error');
  }
};

document.addEventListener('submit', async (e) => {
  if (e.target?.id !== 'formUsuarioCrud') return;
  e.preventDefault();

  const id = document.getElementById('usuarioCrudId').value;
  const nombre = document.getElementById('usuarioCrudNombre').value.trim();
  const email = document.getElementById('usuarioCrudEmail').value.trim();
  const telefono = document.getElementById('usuarioCrudTelefono').value.trim();
  const password = document.getElementById('usuarioCrudPassword').value;
  const msg = document.getElementById('usuarioCrudMsg');
  const btn = document.getElementById('btnGuardarUsuarioCrud');

  msg.innerHTML = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';

  try {
    const isEdit = !!id;
    const body = isEdit
      ? { nombre, email, telefono: telefono || null }
      : { nombre, email, telefono: telefono || null, password };
    const res = await fetchAuth(isEdit ? `${API_BASE}/usuario/${id}` : `${API_BASE}/usuario`, {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    });
    const data = await safeJson(res);
    if (!res.ok) {
      msg.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml((data && (data.error || data.mensaje)) || 'No se pudo guardar el usuario')}</div>`;
      return;
    }
    msg.innerHTML = '<div class="alert alert-success py-2">Usuario guardado correctamente.</div>';
    showToast('Usuario guardado correctamente', 'success');
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('modalUsuarioCrud')).hide();
      cargarUsuarios();
      try { cargarDashboard(); } catch {}
    }, 700);
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(err.message || 'Error de conexión')}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
});

async function cargarUsuarios() {
  const cont = document.getElementById('usuarios');
  cont.innerHTML = '<div class="text-muted py-3">Cargando usuarios...</div>';
  try {
    const [usuariosRes, vendedorRatingsRes] = await Promise.all([
      fetchAuth(`${API_BASE}/usuario`),
      fetch(`${API_BASE}/resena/vendedores/ratings`)
    ]);
    if (!usuariosRes.ok) {
      const body = await safeJson(usuariosRes);
      renderError('usuarios', 'No se pudieron cargar los usuarios.', body?.error || body?.mensaje || `HTTP ${usuariosRes.status}`);
      return;
    }
    const usuarios = await usuariosRes.json();
    let vendedorRatings = [];
    try { vendedorRatings = await vendedorRatingsRes.json(); } catch {}
    const ratingsMap = {};
    (Array.isArray(vendedorRatings) ? vendedorRatings : []).forEach(vr => {
      ratingsMap[vr.id_vendedor] = vr;
    });

    const arr = Array.isArray(usuarios) ? usuarios : [];
    let html = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 class="h5 mb-1">Usuarios (${arr.length})</h3>
          <div class="small text-muted">Usuarios registrados con sus roles y calificación de vendedor</div>
        </div>
        ${puedeCrudUsuarios ? `<button class="btn btn-sm btn-success" type="button" onclick="abrirNuevoUsuarioAdmin()">+ Nuevo usuario</button>` : ''}
      </div>`;
    if (!arr.length) {
      html += '<div class="alert alert-light border text-center">No hay usuarios registrados.</div>';
    } else {
      html += `<div class="card"><div class="table-responsive"><table class='table table-hover align-middle mb-0'>
        <thead><tr><th>ID</th><th>Usuario</th><th>Roles</th><th>Calificación Vendedor</th><th>Confiable</th><th>Registro</th>${puedeCrudUsuarios ? '<th>Acciones</th>' : ''}</tr></thead><tbody>`;
      arr.forEach(u => {
        const id = u.id_usuario || u.id;
        const rolesTexto = u.roles_texto || (Array.isArray(u.roles) ? u.roles.map(r => r.nombre || r).join(', ') : (u.rol || ''));
        const rolesArr = rolesTexto ? rolesTexto.split(', ').filter(Boolean) : [];
        const rolesBadges = rolesArr.map(r => {
          const cls = r === 'ADMIN' ? 'bg-danger' : r === 'VENDEDOR' ? 'bg-primary' : r === 'SUPER_ADMIN' ? 'bg-dark' : 'bg-secondary';
          return `<span class="badge ${cls} me-1">${escapeHtml(r)}</span>`;
        }).join('') || '<span class="badge bg-secondary">CLIENTE</span>';

        const esVendedor = rolesArr.includes('VENDEDOR');
        let ratingHtml = '<span class="text-muted">—</span>';
        let confiableHtml = '<span class="text-muted">—</span>';
        if (esVendedor && ratingsMap[id]) {
          const vr = ratingsMap[id];
          const rating = Number(vr.rating_promedio) || 0;
          const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
          ratingHtml = `<span class="text-warning">${stars}</span> <span class="fw-semibold">${rating}</span> <span class="text-muted small">(${vr.total_resenas} reseñas, ${vr.total_productos} prod.)</span>`;
          if (rating >= 4) {
            confiableHtml = '<span class="badge bg-success">Confiable</span>';
          } else if (rating >= 2.5) {
            confiableHtml = '<span class="badge bg-warning text-dark">Regular</span>';
          } else if (vr.total_resenas > 0) {
            confiableHtml = '<span class="badge bg-danger">No confiable</span>';
          } else {
            confiableHtml = '<span class="badge bg-light text-dark">Sin reseñas</span>';
          }
        } else if (esVendedor) {
          ratingHtml = '<span class="text-muted small">Sin reseñas aún</span>';
          confiableHtml = '<span class="badge bg-light text-dark">Nuevo</span>';
        }

        const fecha = u.fecha_registro ? new Date(u.fecha_registro).toLocaleDateString() : '';
        const acciones = puedeCrudUsuarios
          ? `<td>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-primary" type="button" onclick="editarUsuarioAdmin(${id})">Editar</button>
                <button class="btn btn-sm btn-outline-danger" type="button" onclick="eliminarUsuarioAdmin(${id})">Eliminar</button>
              </div>
            </td>`
          : '';

        html += `<tr>
          <td class="text-muted small">${id}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(u.nombre || '')}</div>
            <div class="small text-muted">${escapeHtml(u.email || '')}</div>
          </td>
          <td>${rolesBadges}</td>
          <td>${ratingHtml}</td>
          <td>${confiableHtml}</td>
          <td class="text-muted small">${fecha}</td>
          ${acciones}
        </tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    cont.innerHTML = html;
  } catch (err) {
    console.error('Error cargando usuarios:', err);
    renderError('usuarios', 'Error al cargar usuarios.', err.message);
  }
}

// Pedidos
let pedidosCache = [];
let usuariosPedidoCache = [];

function badgeEstadoPedido(idEstado) {
  const estado = Number(idEstado);
  if (estado === 1) return '<span class="badge bg-warning text-dark">Pendiente</span>';
  if (estado === 2) return '<span class="badge bg-info text-dark">Confirmado</span>';
  if (estado === 3) return '<span class="badge bg-primary">Preparando</span>';
  if (estado === 4) return '<span class="badge bg-info">En camino</span>';
  if (estado === 5) return '<span class="badge bg-success">Entregado</span>';
  if (estado === 6) return '<span class="badge bg-danger">Cancelado</span>';
  return '<span class="badge bg-secondary">Desconocido</span>';
}

function toDatetimeLocalValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

function ensurePedidoModal() {
  if (document.getElementById('modalPedidoCrud')) return;
  const html = `
    <div class="modal fade" id="modalPedidoCrud" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="formPedidoCrud">
            <div class="modal-header">
              <h5 class="modal-title" id="modalPedidoCrudLabel">Nuevo pedido</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="pedidoCrudId">
              <div class="mb-3">
                <label class="form-label fw-semibold">Usuario</label>
                <select id="pedidoCrudUsuario" class="form-select" required></select>
              </div>
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Estado</label>
                  <select id="pedidoCrudEstado" class="form-select" required>
                    <option value="1">Pendiente</option>
                    <option value="2">Confirmado</option>
                    <option value="3">Preparando</option>
                    <option value="4">En camino</option>
                    <option value="5">Entregado</option>
                    <option value="6">Cancelado</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Total</label>
                  <input id="pedidoCrudTotal" type="number" min="0" step="0.01" class="form-control" required>
                </div>
              </div>
              <div class="mt-3">
                <label class="form-label fw-semibold">Fecha del pedido</label>
                <input id="pedidoCrudFecha" type="datetime-local" class="form-control">
              </div>
              <div id="pedidoCrudMsg" class="mt-3"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="btnGuardarPedidoCrud">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function cargarUsuariosPedidoSelect(selectedId) {
  const select = document.getElementById('pedidoCrudUsuario');
  if (!select) return;
  if (!usuariosPedidoCache.length) {
    const res = await fetchAuth(`${API_BASE}/usuario`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error((data && (data.error || data.mensaje)) || `HTTP ${res.status}`);
    usuariosPedidoCache = Array.isArray(data) ? data : [];
  }
  select.innerHTML = '<option value="">Seleccionar usuario...</option>';
  usuariosPedidoCache.forEach((u) => {
    const id = u.id_usuario || u.id;
    select.innerHTML += `<option value="${id}">${escapeHtml(u.nombre || '')} - ${escapeHtml(u.email || '')}</option>`;
  });
  if (selectedId) select.value = String(selectedId);
}

window.abrirNuevoPedido = async function () {
  if (!puedeCrudPedidos) {
    showToast('Solo ADMIN puede crear pedidos desde este panel.', 'warning');
    return;
  }
  ensurePedidoModal();
  document.getElementById('modalPedidoCrudLabel').textContent = 'Nuevo pedido';
  document.getElementById('pedidoCrudId').value = '';
  document.getElementById('pedidoCrudEstado').value = '1';
  document.getElementById('pedidoCrudTotal').value = '0';
  document.getElementById('pedidoCrudFecha').value = '';
  document.getElementById('pedidoCrudMsg').innerHTML = '';
  await cargarUsuariosPedidoSelect('');
  new bootstrap.Modal(document.getElementById('modalPedidoCrud')).show();
};

window.editarPedidoAdmin = async function (id) {
  if (!puedeCrudPedidos) {
    showToast('Solo ADMIN puede editar pedidos.', 'warning');
    return;
  }
  const pedido = pedidosCache.find((p) => String(p.id_pedido || p.id) === String(id));
  if (!pedido) {
    showToast('Pedido no encontrado', 'warning');
    return;
  }
  ensurePedidoModal();
  document.getElementById('modalPedidoCrudLabel').textContent = `Editar pedido #${id}`;
  document.getElementById('pedidoCrudId').value = String(id);
  document.getElementById('pedidoCrudEstado').value = String(pedido.id_estado || 1);
  document.getElementById('pedidoCrudTotal').value = String(Number(pedido.total || 0));
  document.getElementById('pedidoCrudFecha').value = toDatetimeLocalValue(pedido.fecha_pedido || pedido.fecha);
  document.getElementById('pedidoCrudMsg').innerHTML = '';
  await cargarUsuariosPedidoSelect(pedido.id_usuario);
  new bootstrap.Modal(document.getElementById('modalPedidoCrud')).show();
};

window.eliminarPedidoAdmin = async function (id) {
  if (!puedeCrudPedidos) {
    showToast('Solo ADMIN puede eliminar pedidos.', 'warning');
    return;
  }
  if (!confirm(`¿Eliminar el pedido #${id}? Esta acción revierte stock asociado y elimina pagos/detalles.`)) return;
  try {
    const res = await fetchAuth(`${API_BASE}/pedido/${id}`, { method: 'DELETE' });
    const data = await safeJson(res);
    if (!res.ok) {
      showToast((data && (data.error || data.mensaje)) || 'No se pudo eliminar el pedido', 'error');
      return;
    }
    showToast('Pedido eliminado correctamente', 'success');
    cargarPedidos();
  } catch (err) {
    showToast(err.message || 'Error de conexión', 'error');
  }
};

function renderPedidosDesdeCache() {
  const cont = document.getElementById('pedidos');
  if (!cont) return;

  const filtro = document.getElementById('filtroEstadoPedido');
  const estadoFiltro = filtro ? filtro.value : '';
  const pedidosFiltrados = estadoFiltro
    ? pedidosCache.filter(p => String(p.id_estado) === String(estadoFiltro))
    : pedidosCache;

  let html = `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h3 class="h5 mb-0">Pedidos (${pedidosFiltrados.length}/${pedidosCache.length})</h3>
      <div class="d-flex gap-2">
        ${puedeCrudPedidos ? `<button class="btn btn-sm btn-success" type="button" onclick="abrirNuevoPedido()">+ Nuevo pedido</button>` : ''}
        <select id="filtroEstadoPedido" class="form-select form-select-sm" style="width:auto;">
          <option value="" ${!estadoFiltro ? 'selected' : ''}>Todos</option>
          <option value="1" ${estadoFiltro === '1' ? 'selected' : ''}>Pendiente</option>
          <option value="2" ${estadoFiltro === '2' ? 'selected' : ''}>Confirmado</option>
          <option value="3" ${estadoFiltro === '3' ? 'selected' : ''}>Preparando</option>
          <option value="4" ${estadoFiltro === '4' ? 'selected' : ''}>En camino</option>
          <option value="5" ${estadoFiltro === '5' ? 'selected' : ''}>Entregado</option>
          <option value="6" ${estadoFiltro === '6' ? 'selected' : ''}>Cancelado</option>
        </select>
        <button class="btn btn-sm btn-outline-dark" type="button" onclick="cargarPedidos()">Refrescar</button>
      </div>
    </div>`;

  if (!pedidosFiltrados.length) {
    html += '<div class="alert alert-light border text-center">No hay pedidos para el filtro seleccionado.</div>';
    cont.innerHTML = html;
    const filtroNuevo = document.getElementById('filtroEstadoPedido');
    if (filtroNuevo) filtroNuevo.onchange = renderPedidosDesdeCache;
    return;
  }

  html += `<div class="card"><div class="table-responsive"><table class='table table-hover align-middle mb-0'><thead><tr><th>ID</th><th>Usuario</th><th>Fecha</th><th class="text-end">Total</th><th>Estado actual</th><th>${puedeCrudPedidos ? 'Editar estado' : 'Estado'}</th>${puedeCrudPedidos ? '<th>Acciones</th>' : ''}</tr></thead><tbody>`;
  pedidosFiltrados.forEach(p => {
    const id = p.id_pedido || p.id;
    const fecha = p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleString() : (p.fecha || '');
    const controlEstado = puedeCrudPedidos
      ? `<select class="form-select form-select-sm" style="width:auto;" onchange="cambiarEstadoPedido(${id}, this.value)">
        <option value="1" ${p.id_estado == 1 ? 'selected' : ''}>Pendiente</option>
        <option value="2" ${p.id_estado == 2 ? 'selected' : ''}>Confirmado</option>
        <option value="3" ${p.id_estado == 3 ? 'selected' : ''}>Preparando</option>
        <option value="4" ${p.id_estado == 4 ? 'selected' : ''}>En camino</option>
        <option value="5" ${p.id_estado == 5 ? 'selected' : ''}>Entregado</option>
        <option value="6" ${p.id_estado == 6 ? 'selected' : ''}>Cancelado</option>
      </select>`
      : badgeEstadoPedido(p.id_estado);
    const acciones = puedeCrudPedidos
      ? `<td>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-outline-primary" type="button" onclick="editarPedidoAdmin(${id})">Editar</button>
            <button class="btn btn-sm btn-outline-danger" type="button" onclick="eliminarPedidoAdmin(${id})">Eliminar</button>
          </div>
        </td>`
      : '';
    html += `<tr><td class="text-muted small">${id}</td><td>${escapeHtml(p.usuario || '')}</td><td class="text-muted small">${escapeHtml(fecha)}</td><td class="text-end fw-semibold">$${Number(p.total).toLocaleString()}</td><td>${badgeEstadoPedido(p.id_estado)}</td><td>${controlEstado}</td>${acciones}</tr>`;
  });
  html += '</tbody></table></div></div>';
  cont.innerHTML = html;

  const filtroNuevo = document.getElementById('filtroEstadoPedido');
  if (filtroNuevo) filtroNuevo.onchange = renderPedidosDesdeCache;
}

document.addEventListener('submit', async (e) => {
  if (e.target?.id !== 'formPedidoCrud') return;
  e.preventDefault();
  const msg = document.getElementById('pedidoCrudMsg');
  const btn = document.getElementById('btnGuardarPedidoCrud');
  const id = document.getElementById('pedidoCrudId').value;
  const id_usuario = document.getElementById('pedidoCrudUsuario').value;
  const id_estado = document.getElementById('pedidoCrudEstado').value;
  const total = document.getElementById('pedidoCrudTotal').value;
  const fecha_pedido = document.getElementById('pedidoCrudFecha').value;

  msg.innerHTML = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';

  try {
    const body = { id_usuario, id_estado, total, fecha_pedido: fecha_pedido || null };
    const isEdit = !!id;
    const url = isEdit ? `${API_BASE}/pedido/${id}` : `${API_BASE}/pedido/admin`;
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetchAuth(url, { method, body: JSON.stringify(body) });
    const data = await safeJson(res);
    if (!res.ok) {
      msg.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml((data && (data.error || data.mensaje)) || 'No se pudo guardar el pedido')}</div>`;
      return;
    }
    msg.innerHTML = '<div class="alert alert-success py-2">Pedido guardado correctamente.</div>';
    showToast('Pedido guardado correctamente', 'success');
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('modalPedidoCrud')).hide();
      cargarPedidos();
      try { cargarDashboard(); } catch {}
    }, 700);
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(err.message || 'Error de conexión')}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
});

function cargarPedidos() {
  const cont = document.getElementById('pedidos');
  cont.innerHTML = '<div class="text-muted py-3">Cargando pedidos...</div>';
  fetchAuth(`${API_BASE}/pedido`)
    .then(async res => {
      if (!res.ok) {
        const body = await safeJson(res);
        renderError('pedidos', 'No se pudieron cargar los pedidos.', body?.error || body?.mensaje || `HTTP ${res.status}`);
        return null;
      }
      return res.json();
    })
    .then(pedidos => {
      if (!pedidos) return;
      pedidosCache = Array.isArray(pedidos) ? pedidos : [];
      renderPedidosDesdeCache();
    })
    .catch(err => {
      console.error('Error cargando pedidos:', err);
      renderError('pedidos', 'Error al cargar pedidos.', err.message);
    });
}

// Vendedores (ratings + reviews)
async function cargarVendedores() {
  const cont = document.getElementById('vendedores');
  if (!cont) return;
  cont.innerHTML = '<div class="text-muted py-3">Cargando vendedores...</div>';
  try {
    const res = await fetch(`${API_BASE}/resena/vendedores/ratings`);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [];
    let html = `
      <div class="mb-3">
        <h3 class="h5 mb-1">Vendedores (${arr.length})</h3>
        <div class="small text-muted">Calificación, confiabilidad y reseñas de los vendedores</div>
      </div>`;
    if (!arr.length) {
      html += '<div class="alert alert-light border text-center">No hay vendedores registrados aún.</div>';
    } else {
      html += '<div class="row g-3">';
      arr.forEach(v => {
        const rating = Number(v.rating_promedio) || 0;
        const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
        let confiable, confiableClass;
        if (rating >= 4) { confiable = 'Confiable'; confiableClass = 'bg-success'; }
        else if (rating >= 2.5) { confiable = 'Regular'; confiableClass = 'bg-warning text-dark'; }
        else if (v.total_resenas > 0) { confiable = 'No confiable'; confiableClass = 'bg-danger'; }
        else { confiable = 'Sin reseñas'; confiableClass = 'bg-light text-dark'; }

        html += `
          <div class="col-md-6 col-lg-4">
            <div class="card h-100">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 class="fw-bold mb-0">${escapeHtml(v.vendedor_nombre)}</h6>
                    <div class="small text-muted">${escapeHtml(v.vendedor_email)}</div>
                  </div>
                  <span class="badge ${confiableClass}">${confiable}</span>
                </div>
                <div class="mb-2">
                  <span class="text-warning fs-5">${stars}</span>
                  <span class="fw-bold ms-1">${rating || '—'}</span>
                </div>
                <div class="d-flex gap-3 small text-muted">
                  <span>${v.total_productos} productos</span>
                  <span>${v.total_resenas} reseñas</span>
                </div>
                <button class="btn btn-sm btn-outline-primary mt-2 w-100" onclick="verResenasVendedor(${v.id_vendedor}, '${escapeHtml(v.vendedor_nombre).replace(/'/g, "\\'")}')">
                  Ver reseñas
                </button>
              </div>
            </div>
          </div>
        `;
      });
      html += '</div>';
    }
    html += '<div id="resenasVendedorDetalle" class="mt-4"></div>';
    cont.innerHTML = html;
  } catch (err) {
    console.error('Error cargando vendedores:', err);
    renderError('vendedores', 'Error al cargar vendedores.', err.message);
  }
}

window.verResenasVendedor = async function(idVendedor, nombre) {
  const cont = document.getElementById('resenasVendedorDetalle');
  if (!cont) return;
  cont.innerHTML = '<div class="text-muted py-2">Cargando reseñas...</div>';
  try {
    const res = await fetch(`${API_BASE}/resena/vendedor/${idVendedor}`);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [];
    if (!arr.length) {
      cont.innerHTML = `<div class="card p-3"><h6>Reseñas de ${escapeHtml(nombre)}</h6><p class="text-muted mb-0">Este vendedor aún no tiene reseñas.</p></div>`;
      return;
    }
    let html = `<div class="card p-3"><h6 class="mb-3">Reseñas de ${escapeHtml(nombre)} (${arr.length})</h6>`;
    arr.forEach(r => {
      const stars = '★'.repeat(Math.round(r.rating)) + '☆'.repeat(5 - Math.round(r.rating));
      const fecha = r.fecha ? new Date(r.fecha).toLocaleDateString() : '';
      html += `
        <div class="border-bottom py-2">
          <div class="d-flex justify-content-between">
            <div>
              <span class="text-warning">${stars}</span>
              <span class="fw-semibold ms-1">${escapeHtml(r.usuario)}</span>
            </div>
            <span class="text-muted small">${fecha}</span>
          </div>
          <div class="small text-muted">Producto: ${escapeHtml(r.producto_nombre)}</div>
          <div class="small mt-1">${escapeHtml(r.comentario)}</div>
        </div>
      `;
    });
    html += '</div>';
    cont.innerHTML = html;
  } catch (err) {
    cont.innerHTML = '<div class="alert alert-danger">Error al cargar reseñas.</div>';
  }
};

// Roles
async function cargarRoles() {
  try {
    const [usuariosRes, rolesRes] = await Promise.all([
      fetchAuth(`${API_BASE}/usuario`),
      fetchAuth(`${API_BASE}/usuario-rol`)
    ]);

    // Usuarios con roles
    if (usuariosRes.ok) {
      const usuarios = await usuariosRes.json();
      const arr = Array.isArray(usuarios) ? usuarios : [];
      let usuariosHtml = '<div class="list-group">';
      arr.forEach(u => {
        const rolesTexto = u.roles_texto || (Array.isArray(u.roles) ? u.roles.map(r => r.nombre || r).join(', ') : '');
        const rolesArr = rolesTexto ? rolesTexto.split(', ').filter(Boolean) : [];
        const badges = rolesArr.length
          ? rolesArr.map(r => {
              const cls = r === 'ADMIN' ? 'bg-danger' : r === 'VENDEDOR' ? 'bg-primary' : r === 'SUPER_ADMIN' ? 'bg-dark' : 'bg-secondary';
              return `<span class="badge ${cls} me-1">${escapeHtml(r)}</span>`;
            }).join('')
          : '<span class="badge bg-secondary">CLIENTE</span>';
        usuariosHtml += `
          <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <strong>${escapeHtml(u.nombre || '')}</strong>
                <div class="text-muted small">${escapeHtml(u.email || '')}</div>
              </div>
              <div>${badges}</div>
            </div>
          </div>`;
      });
      usuariosHtml += '</div>';
      document.getElementById('listaUsuariosRoles').innerHTML = usuariosHtml;
    } else {
      document.getElementById('listaUsuariosRoles').innerHTML = '<div class="alert alert-danger small">Error al cargar usuarios.</div>';
    }

    // Roles disponibles
    if (rolesRes.ok) {
      const roles = await rolesRes.json();
      const arrR = Array.isArray(roles) ? roles : [];
      let rolesHtml = '<div class="list-group">';
      arrR.forEach(r => {
        rolesHtml += `
          <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
              <strong>${escapeHtml(r.nombre)}</strong>
              <span class="badge bg-secondary">ID: ${r.id_rol}</span>
            </div>
          </div>`;
      });
      rolesHtml += '</div>';
      document.getElementById('listaRoles').innerHTML = rolesHtml;
    } else {
      document.getElementById('listaRoles').innerHTML = '<div class="alert alert-danger small">Error al cargar roles.</div>';
    }
  } catch (error) {
    console.error('Error cargando roles:', error);
    document.getElementById('listaUsuariosRoles').innerHTML = '<div class="alert alert-danger small">Error de conexión.</div>';
    document.getElementById('listaRoles').innerHTML = '<div class="alert alert-danger small">Error de conexión.</div>';
  }
}

window.mostrarFormAsignarRol = async function() {
  document.getElementById('rolMsg').innerHTML = '';
  
  // Cargar usuarios y roles en los selects
  try {
    const [usuariosRes, rolesRes] = await Promise.all([
      fetchAuth(`${API_BASE}/usuario`),
      fetchAuth(`${API_BASE}/usuario-rol`)
    ]);

    const usuarios = await usuariosRes.json();
    const roles = await rolesRes.json();

    // Llenar select de usuarios
    const usuarioSelect = document.getElementById('rolUsuario');
    usuarioSelect.innerHTML = '<option value="">Seleccionar usuario...</option>';
    usuarios.forEach(u => {
      usuarioSelect.innerHTML += `<option value="${u.id_usuario || u.id}">${u.nombre} - ${u.email}</option>`;
    });

    // Llenar select de roles (solo ADMIN y VENDEDOR)
    const rolSelect = document.getElementById('rolRol');
    rolSelect.innerHTML = '<option value="">Seleccionar rol...</option>';
    roles.filter(r => ['ADMIN', 'VENDEDOR'].includes(r.nombre)).forEach(r => {
      rolSelect.innerHTML += `<option value="${r.id_rol}">${r.nombre}</option>`;
    });

  } catch (error) {
    console.error('Error cargando datos para asignar rol:', error);
  }

  new bootstrap.Modal(document.getElementById('modalAsignarRol')).show();
};

const _formAsignarRol = document.getElementById('formAsignarRol');
if (_formAsignarRol) _formAsignarRol.onsubmit = async function(e) {
  e.preventDefault();
  const id_usuario = document.getElementById('rolUsuario').value;
  const id_rol = document.getElementById('rolRol').value;
  const msg = document.getElementById('rolMsg');
  
  if (!id_usuario || !id_rol) {
    msg.innerHTML = '<div class="alert alert-danger">Selecciona usuario y rol</div>';
    return;
  }

  try {
    const res = await fetchAuth(`${API_BASE}/usuario-rol/asignar`, {
      method: 'POST',
      body: JSON.stringify({ id_usuario, id_rol })
    });
    const data = await res.json();
    if (res.ok) {
      msg.innerHTML = '<div class="alert alert-success">Rol asignado correctamente.</div>';
      setTimeout(() => { 
        bootstrap.Modal.getInstance(document.getElementById('modalAsignarRol')).hide(); 
        cargarRoles(); 
        cargarUsuarios();
      }, 1000);
    } else {
      msg.innerHTML = '<div class="alert alert-danger">' + (data.error || 'Error al asignar rol') + '</div>';
    }
  } catch {
    msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
  }
};

function initAdmin() {
  try { cargarDashboard(); } catch(e) { console.error('Error init Dashboard:', e); }
  try { cargarProductos(); } catch(e) { console.error('Error init Productos:', e); }
  try { cargarCategorias(); } catch(e) { console.error('Error init Categorias:', e); }
  try { cargarUsuarios(); } catch(e) { console.error('Error init Usuarios:', e); }
  try { cargarPedidos(); } catch(e) { console.error('Error init Pedidos:', e); }
  try { cargarVendedores(); } catch(e) { console.error('Error init Vendedores:', e); }
  try { cargarRoles(); } catch(e) { console.error('Error init Roles:', e); }
  try { cargarSolicitudesVendedor(); } catch(e) { console.error('Error init Solicitudes:', e); }
  try { cargarEstadisticas(); } catch(e) { console.error('Error init Estadisticas:', e); }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}

// Solicitudes para ser vendedor (Admin)
async function cargarSolicitudesVendedor() {
  const cont = document.getElementById('solicitudesVendedorList');
  if (!cont) return;

  const filtro = document.getElementById('filtroSolicitudEstado');
  const estado = filtro ? filtro.value : 'PENDIENTE';
  const qs = estado ? `?estado=${encodeURIComponent(estado)}` : '';

  cont.innerHTML = '<div class="text-muted">Cargando solicitudes...</div>';
  try {
    const res = await fetchAuth(`${API_BASE}/vendedor-solicitud${qs}`);
    const data = await safeJson(res);
    if (!res.ok) {
      renderError('solicitudesVendedorList', 'No se pudieron cargar las solicitudes.', data?.error || data?.mensaje || `HTTP ${res.status}`);
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      cont.innerHTML = '<div class="alert alert-light border">No hay solicitudes para mostrar con el filtro actual.</div>';
      return;
    }

    const table = `
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Tienda</th>
              <th>NIT/RUT</th>
              <th>Ciudad</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const estadoBadge = r.estado === 'PENDIENTE'
                ? '<span class="badge bg-warning text-dark">PENDIENTE</span>'
                : (r.estado === 'APROBADA'
                  ? '<span class="badge bg-success">APROBADA</span>'
                  : '<span class="badge bg-danger">RECHAZADA</span>');
              const fecha = r.fecha_creacion ? new Date(r.fecha_creacion).toLocaleString() : '';
              const usuario = `${escapeHtml(r.usuario_nombre || '')}<div class="small text-muted">${escapeHtml(r.usuario_email || '')}</div>`;
              const acciones = r.estado === 'PENDIENTE'
                ? `
                  <div class="d-flex gap-2 justify-content-end">
                    <button class="btn btn-sm btn-success" type="button" onclick="abrirResolverSolicitud(${r.id_solicitud}, 'aprobar')">Aprobar</button>
                    <button class="btn btn-sm btn-outline-danger" type="button" onclick="abrirResolverSolicitud(${r.id_solicitud}, 'rechazar')">Rechazar</button>
                  </div>
                `
                : '<span class="text-muted small">—</span>';

              return `
                <tr>
                  <td>${r.id_solicitud}</td>
                  <td>${usuario}</td>
                  <td>${escapeHtml(r.nombre_tienda || '')}</td>
                  <td>${escapeHtml(r.nit_rut || '')}</td>
                  <td>${escapeHtml(r.ciudad || '')}</td>
                  <td>${estadoBadge}</td>
                  <td class="small text-muted">${escapeHtml(fecha)}</td>
                  <td class="text-end">${acciones}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    cont.innerHTML = table;
  } catch (err) {
    renderError('solicitudesVendedorList', 'No se pudieron cargar las solicitudes.', err?.message || 'Error de conexión');
  }
}

window.abrirResolverSolicitud = function (idSolicitud, accion) {
  const modalEl = document.getElementById('modalResolverSolicitud');
  if (!modalEl) return;
  const title = document.getElementById('resolverSolicitudTitle');
  const hiddenId = document.getElementById('resolverSolicitudId');
  const hiddenAccion = document.getElementById('resolverSolicitudAccion');
  const comentario = document.getElementById('resolverSolicitudComentario');
  const msg = document.getElementById('resolverSolicitudMsg');
  const btn = document.getElementById('resolverSolicitudSubmit');

  if (title) title.textContent = accion === 'aprobar' ? 'Aprobar solicitud' : 'Rechazar solicitud';
  if (btn) {
    btn.textContent = accion === 'aprobar' ? 'Aprobar' : 'Rechazar';
    btn.className = 'btn ' + (accion === 'aprobar' ? 'btn-success' : 'btn-danger');
  }
  if (hiddenId) hiddenId.value = String(idSolicitud);
  if (hiddenAccion) hiddenAccion.value = accion;
  if (comentario) comentario.value = '';
  if (msg) msg.innerHTML = '';

  new bootstrap.Modal(modalEl).show();
};

const formResolver = document.getElementById('formResolverSolicitud');
if (formResolver) {
  formResolver.onsubmit = async function (e) {
    e.preventDefault();
    const idSolicitud = document.getElementById('resolverSolicitudId').value;
    const accion = document.getElementById('resolverSolicitudAccion').value;
    const comentario_admin = document.getElementById('resolverSolicitudComentario').value;
    const msg = document.getElementById('resolverSolicitudMsg');
    if (msg) msg.innerHTML = '';

    try {
      const endpoint = accion === 'aprobar'
        ? `${API_BASE}/vendedor-solicitud/${idSolicitud}/aprobar`
        : `${API_BASE}/vendedor-solicitud/${idSolicitud}/rechazar`;
      const res = await fetchAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify({ comentario_admin })
      });
      const data = await safeJson(res);
      if (res.ok) {
        if (msg) msg.innerHTML = '<div class="alert alert-success">Acción realizada correctamente.</div>';
        setTimeout(() => {
          bootstrap.Modal.getInstance(document.getElementById('modalResolverSolicitud')).hide();
          cargarSolicitudesVendedor();
        }, 650);
      } else {
        if (msg) msg.innerHTML = '<div class="alert alert-danger">' + ((data && (data.error || data.mensaje)) || `HTTP ${res.status}`) + '</div>';
      }
    } catch {
      if (msg) msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
    }
  };
}

const btnRefrescarSolicitudes = document.getElementById('btnRefrescarSolicitudes');
if (btnRefrescarSolicitudes) {
  btnRefrescarSolicitudes.onclick = cargarSolicitudesVendedor;
}

const filtroSolicitudEstado = document.getElementById('filtroSolicitudEstado');
if (filtroSolicitudEstado) {
  filtroSolicitudEstado.onchange = cargarSolicitudesVendedor;
}

const _formProductoInit = document.getElementById('formProducto');
if (_formProductoInit) _formProductoInit.onsubmit = async function (e) {
  e.preventDefault();
  const nombre = document.getElementById('prodNombre').value;
  const descripcion = document.getElementById('prodDescripcion').value;
  const precio = document.getElementById('prodPrecio').value;
  const stock = document.getElementById('prodStock').value;
  const id_categoria = document.getElementById('prodCategoria').value;
  const imagen = document.getElementById('prodImagen').value;
  const msg = document.getElementById('prodMsg');
  msg.textContent = '';
  try {
    const res = await fetchAuth(`${API_BASE}/producto`, {
      method: 'POST',
      body: JSON.stringify({ nombre, descripcion, precio, stock, id_categoria, imagen })
    });
    const data = await res.json();
    if (res.ok) {
      msg.innerHTML = '<div class="alert alert-success">Producto creado correctamente.</div>';
      setTimeout(() => { bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide(); cargarProductos(); }, 1000);
    } else {
      msg.innerHTML = '<div class="alert alert-danger">' + (data.error || 'Error al crear producto') + '</div>';
    }
  } catch {
    msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
  }
}
window.editarProducto = async function (id) {
  try {
    // Cargar producto individual y categorías en paralelo
    const [resProducto, resCat] = await Promise.all([
      fetchAuth(`${API_BASE}/producto/${id}`),
      fetchAuth(`${API_BASE}/categoria`)
    ]);
    if (!resProducto.ok) {
      showToast('Producto no encontrado', 'warning');
      return;
    }
    const p = await resProducto.json();
    const categorias = await resCat.json();

    // Llenar select de categorías
    const select = document.getElementById('prodCategoria');
    select.innerHTML = '';
    (Array.isArray(categorias) ? categorias : []).forEach(cat => {
      const catId = cat.id_categoria || cat.id;
      select.innerHTML += `<option value="${catId}" ${catId == p.id_categoria ? 'selected' : ''}>${cat.nombre}</option>`;
    });

    // Llenar campos del formulario
    document.getElementById('prodNombre').value = p.nombre || '';
    document.getElementById('prodDescripcion').value = p.descripcion || '';
    document.getElementById('prodPrecio').value = p.precio || '';
    document.getElementById('prodStock').value = p.stock || '';
    document.getElementById('prodImagen').value = p.imagen || '';
    actualizarPreviewImagenProducto(p.imagen || '');
    document.getElementById('prodMsg').innerHTML = '';
    document.getElementById('modalProductoLabel').textContent = 'Editar Producto';

    // Cambiar onsubmit a modo edición
    document.getElementById('formProducto').onsubmit = async function (e) {
      e.preventDefault();
      const btn = this.querySelector('button[type="submit"]');
      const msg = document.getElementById('prodMsg');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
      msg.innerHTML = '';
      const body = {
        nombre: document.getElementById('prodNombre').value,
        descripcion: document.getElementById('prodDescripcion').value,
        precio: document.getElementById('prodPrecio').value,
        stock: document.getElementById('prodStock').value,
        id_categoria: document.getElementById('prodCategoria').value,
        imagen: document.getElementById('prodImagen').value
      };
      try {
        const resUpd = await fetchAuth(`${API_BASE}/producto/${id}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });
        const data = await safeJson(resUpd);
        if (resUpd.ok) {
          msg.innerHTML = '<div class="alert alert-success">Producto actualizado correctamente.</div>';
          setTimeout(() => {
            bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
            cargarProductos();
          }, 800);
        } else {
          msg.innerHTML = '<div class="alert alert-danger">' + ((data && (data.error || data.mensaje)) || 'Error al actualizar') + '</div>';
        }
      } catch (err) {
        msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar';
      }
    };

    new bootstrap.Modal(document.getElementById('modalProducto')).show();
  } catch (err) {
    console.error('Error al cargar producto para editar:', err);
    showToast('Error al cargar producto: ' + err.message, 'error');
  }
}

window.eliminarProducto = async function (id) {
  if (!confirm('¿Seguro que deseas eliminar este producto? Esta acción no se puede deshacer.')) return;
  try {
    const res = await fetchAuth(`${API_BASE}/producto/${id}`, { method: 'DELETE' });
    if (res.ok) {
      cargarProductos();
      showToast('Producto eliminado correctamente', 'success');
    } else {
      const data = await safeJson(res);
      showToast((data && (data.error || data.mensaje)) || 'Error al eliminar el producto.', 'error');
    }
  } catch (err) {
    showToast('Error de conexión al eliminar.', 'error');
  }
}

window.mostrarFormCategoria = function () {
  document.getElementById('catNombre').value = '';
  document.getElementById('catMsg').innerHTML = '';
  new bootstrap.Modal(document.getElementById('modalCategoria')).show();
}

document.getElementById('formCategoria').onsubmit = async function (e) {
  e.preventDefault();
  const nombre = document.getElementById('catNombre').value;
  const id = document.getElementById('formCategoria').dataset.id;
  try {
    const res = await fetchAuth(`${API_BASE}/categoria` + (id ? '/' + id : ''), {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ nombre })
    });
    if (res.ok) {
      document.getElementById('catMsg').innerHTML = '<div class="alert alert-success">Categoría guardada.</div>';
      setTimeout(() => { bootstrap.Modal.getInstance(document.getElementById('modalCategoria')).hide(); cargarCategorias(); }, 1000);
    }
  } catch (err) { showToast('Error al guardar categoría', 'error'); }
}

window.editarCategoria = async function (id) {
  try {
    const res = await fetchAuth(`${API_BASE}/categoria`);
    const categorias = await res.json();
    const c = categorias.find(item => (item.id_categoria || item.id) == id);
    if (!c) {
      showToast('Categoría no encontrada', 'warning');
      return;
    }

    document.getElementById('catNombre').value = c.nombre;
    document.getElementById('catMsg').innerHTML = '';
    document.getElementById('formCategoria').dataset.id = id;
    new bootstrap.Modal(document.getElementById('modalCategoria')).show();
  } catch (err) { console.error(err); }
}

window.eliminarCategoria = async function (id) {
  if (!confirm('¿Seguro que deseas eliminar esta categoría?')) return;
  try {
    const res = await fetchAuth(`${API_BASE}/categoria/${id}`, { method: 'DELETE' });
    if (res.ok) {
      cargarCategorias();
      showToast('Categoría eliminada correctamente', 'success');
    } else showToast('Error al eliminar (puede tener productos asociados)', 'error');
  } catch (err) { showToast('Error de conexión', 'error'); }
}

window.cambiarEstadoPedido = async function (id, id_estado) {
  try {
    const res = await fetchAuth(`${API_BASE}/pedido/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ id_estado })
    });
    const data = await safeJson(res);
    if (res.ok) {
      const pedido = pedidosCache.find(p => String(p.id_pedido || p.id) === String(id));
      if (pedido) pedido.id_estado = Number(id_estado);
      renderPedidosDesdeCache();
      return;
    }
    showToast((data && (data.error || data.mensaje)) || 'Error al cambiar estado', 'error');
    cargarPedidos();
  } catch (err) {
    showToast('Error de conexión', 'error');
    cargarPedidos();
  }
}

// Atributos por secciones
let productoAtributosId = null;
window.gestionarAtributos = async function (id) {
  productoAtributosId = id;
  try {
    const res = await fetchAuth(`${API_BASE}/producto/${id}/atributos`);
    const atributos = await res.json();
    renderFormAtributos(atributos);
    new bootstrap.Modal(document.getElementById('modalAtributos')).show();
  } catch (err) {
    showToast('Error al cargar atributos', 'error');
  }
};

function renderFormAtributos(atributos) {
  const cont = document.getElementById('atributosContainer');
  const porSeccion = {};
  (Array.isArray(atributos) ? atributos : []).forEach(a => {
    if (!porSeccion[a.seccion]) porSeccion[a.seccion] = [];
    porSeccion[a.seccion].push(a);
  });
  cont.innerHTML = '';
  Object.entries(porSeccion).forEach(([seccion, items]) => {
    const divSeccion = document.createElement('div');
    divSeccion.className = 'border rounded p-3 mb-3';
    divSeccion.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <input type="text" class="form-control form-control-sm fw-bold" value="${seccion}" placeholder="Nombre de la sección" data-seccion="${seccion}" />
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="eliminarSeccion(this)">Eliminar sección</button>
      </div>
      <div class="atributos-lista" data-seccion="${seccion}">
        ${items.map(i => `
          <div class="d-flex gap-2 mb-2">
            <input type="text" class="form-control form-control-sm" placeholder="Atributo" value="${i.atributo}" />
            <input type="text" class="form-control form-control-sm" placeholder="Valor" value="${i.valor}" />
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">×</button>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn btn-sm btn-outline-secondary" onclick="agregarAtributo(this)">+ Atributo</button>
    `;
    cont.appendChild(divSeccion);
  });
  if (!Object.keys(porSeccion).length) {
    agregarSeccion();
  }
}

window.agregarSeccion = function () {
  const cont = document.getElementById('atributosContainer');
  const divSeccion = document.createElement('div');
  const idx = Date.now();
  divSeccion.className = 'border rounded p-3 mb-3';
  divSeccion.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <input type="text" class="form-control form-control-sm fw-bold" placeholder="Nombre de la sección" data-seccion="nueva_${idx}" />
      <button type="button" class="btn btn-sm btn-outline-danger" onclick="eliminarSeccion(this)">Eliminar sección</button>
    </div>
    <div class="atributos-lista" data-seccion="nueva_${idx}">
      <div class="d-flex gap-2 mb-2">
        <input type="text" class="form-control form-control-sm" placeholder="Atributo" />
        <input type="text" class="form-control form-control-sm" placeholder="Valor" />
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">×</button>
      </div>
    </div>
    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="agregarAtributo(this)">+ Atributo</button>
  `;
  cont.appendChild(divSeccion);
};

window.eliminarSeccion = function (btn) {
  btn.closest('.border').remove();
};

window.agregarAtributo = function (btn) {
  const lista = btn.previousElementSibling;
  const div = document.createElement('div');
  div.className = 'd-flex gap-2 mb-2';
  div.innerHTML = `
    <input type="text" class="form-control form-control-sm" placeholder="Atributo" />
    <input type="text" class="form-control form-control-sm" placeholder="Valor" />
    <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">×</button>
  `;
  lista.appendChild(div);
};

const _btnAddSeccion = document.getElementById('btnAddSeccion');
if (_btnAddSeccion) _btnAddSeccion.onclick = agregarSeccion;

const _formAtributos = document.getElementById('formAtributos');
if (_formAtributos) _formAtributos.onsubmit = async function (e) {
  e.preventDefault();
  if (!productoAtributosId) return;
  const seccionesDivs = document.querySelectorAll('#atributosContainer .border');
  const atributos = [];
  seccionesDivs.forEach(div => {
    const inputSeccion = div.querySelector('input[data-seccion]');
    const seccion = inputSeccion ? inputSeccion.value.trim() : '';
    if (!seccion) return;
    const lista = div.querySelector('.atributos-lista');
    if (!lista) return;
    lista.querySelectorAll('.d-flex').forEach(item => {
      const inputs = item.querySelectorAll('input');
      if (inputs.length >= 2) {
        const atributo = inputs[0].value.trim();
        const valor = inputs[1].value.trim();
        if (atributo && valor) {
          atributos.push({ seccion, atributo, valor });
        }
      }
    });
  });
  const msg = document.getElementById('atributosMsg');
  try {
    const res = await fetchAuth(`${API_BASE}/producto/${productoAtributosId}/atributos`, {
      method: 'PUT',
      body: JSON.stringify(atributos)
    });
    if (res.ok) {
      msg.innerHTML = '<div class="alert alert-success">Características guardadas.</div>';
      setTimeout(() => { bootstrap.Modal.getInstance(document.getElementById('modalAtributos')).hide(); }, 1000);
    } else {
      msg.innerHTML = '<div class="alert alert-danger">Error al guardar.</div>';
    }
  } catch {
    msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
  }
};

// Mantener compatibilidad con botones existentes
window.mostrarFormProducto = function () {
  return abrirCrearProducto();
};
