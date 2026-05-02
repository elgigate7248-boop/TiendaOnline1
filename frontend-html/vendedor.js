// Panel de vendedor: gestión de productos, pedidos y estadísticas
const token = localStorage.getItem('token');
let user = {};
try {
  user = JSON.parse(localStorage.getItem('user') || '{}');
} catch {
  user = {};
}

// Extraer correctamente los nombres de los roles desde el formato del backend
const roles = Array.isArray(user.roles) 
  ? user.roles.map(r => r.nombre || r) 
  : (user.rol ? [user.rol] : []);

const esVendedor = roles.includes('VENDEDOR');

console.log('Token:', token ? 'presente' : 'ausente');
console.log('Usuario:', user);
console.log('Roles extraídos:', roles);
console.log('Es vendedor:', esVendedor);

if (!token) {
  showToast('Debes iniciar sesión para acceder al panel.', 'warning');
  setTimeout(() => { location.href = 'login.html'; }, 700);
  throw new Error('Sin sesión');
}

if (!esVendedor) {
  showToast('No tienes permisos para acceder al panel de vendedores. Roles: ' + roles.join(', '), 'error');
  setTimeout(() => { location.href = 'index.html'; }, 900);
  throw new Error('Sin permisos');
}

function fetchAuth(url, opts = {}) {
  const fullUrl = url.startsWith('/') ? API_BASE + url : url;
  return fetch(fullUrl, {
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
  const content = `
    <div class="alert alert-warning mb-0">
      <div class="fw-semibold">${title}</div>
      ${msg ? `<div class="small text-muted mt-1">${msg}</div>` : ''}
    </div>
  `;
  const isTableBody = el.tagName === 'TBODY';
  el.innerHTML = isTableBody
    ? `<tr><td colspan="100">${content}</td></tr>` 
    : content;
}

// showToast global — ui-kit.js lo expone en UIKit.showToast, no globalmente
function showToast(message, type = 'info') {
  if (window.UIKit && typeof UIKit.showToast === 'function') {
    UIKit.showToast(message, type);
  } else {
    console.warn('[Toast]', type, message);
  }
}

// Variables globales
let productosData = [];
let pedidosData = [];
let categoriasData = [];
let productoEditandoId = null;
let ventasChartInstance = null;
let productosChartInstance = null;
let pedidosCargados = false;

const ESTADOS_PEDIDO = [
  { id: 1, nombre: 'Pendiente' },
  { id: 2, nombre: 'Confirmado' },
  { id: 3, nombre: 'Preparando' },
  { id: 4, nombre: 'En camino' },
  { id: 5, nombre: 'Entregado' },
  { id: 6, nombre: 'Cancelado' }
];

const TRANSICIONES_VENDEDOR = {
  1: [2, 6],
  2: [3, 6],
  3: [4]
};

// Cargar información del vendedor
async function cargarInfoVendedor() {
  try {
    const res = await fetchAuth('/usuario/perfil');
    if (!res.ok) throw new Error('Error al cargar perfil');
    const data = await res.json();
    
    const nameEl = document.getElementById('vendedorName');
    if (nameEl) nameEl.textContent = data.nombre || data.email || 'Vendedor';
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) avatarEl.textContent = (data.nombre || data.email || 'V')[0].toUpperCase();
    const perfilNombre = document.getElementById('perfilNombre');
    if (perfilNombre) perfilNombre.value = data.nombre || '';
    const perfilEmail = document.getElementById('perfilEmail');
    if (perfilEmail) perfilEmail.value = data.email || '';
    const perfilFecha = document.getElementById('perfilFechaRegistro');
    if (perfilFecha) perfilFecha.value = data.fecha_registro ? new Date(data.fecha_registro).toLocaleDateString() : 'N/A';
  } catch (err) {
    console.error('Error al cargar info vendedor:', err);
    const nameEl = document.getElementById('vendedorName');
    if (nameEl) nameEl.textContent = 'Error cargando datos';
  }
}

// Cargar categorías
async function cargarCategorias() {
  try {
    const res = await fetchAuth('/categoria');
    if (!res.ok) throw new Error('Error al cargar categorías');
    const categorias = await res.json();
    categoriasData = categorias;
    
    // Actualizar selects de categorías
    const selectProducto = document.getElementById('productoCategoria');
    const selectFiltro = document.getElementById('filtroCategoria');
    
    if (selectProducto) {
      selectProducto.innerHTML = '<option value="">Selecciona una categoría</option>' +
        categorias.map(cat => `<option value="${cat.id_categoria}">${cat.nombre}</option>`).join('');
    }
    
    if (selectFiltro) {
      selectFiltro.innerHTML = '<option value="">Todas las categorías</option>' +
        categorias.map(cat => `<option value="${cat.id_categoria}">${cat.nombre}</option>`).join('');
    }
  } catch (err) {
    console.error('Error al cargar categorías:', err);
  }
}

// Cargar productos del vendedor
async function cargarProductos() {
  try {
    const tbody = document.getElementById('productosTableBody');
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">
          <div class="spinner-border spinner-border-sm me-2" role="status"></div>
          Cargando productos...
        </td>
      </tr>
    `;
    
    const busqueda = document.getElementById('buscadorProducto');
    const filtroEstado = document.getElementById('filtroEstado');
    const filtroCategoria = document.getElementById('filtroCategoria');
    if (busqueda) busqueda.value = '';
    if (filtroEstado) filtroEstado.value = '';
    if (filtroCategoria) filtroCategoria.value = '';
    
    const res = await fetchAuth('/producto/gestion');
    if (!res.ok) throw new Error('Error al cargar productos');
    const productos = await res.json();
    productosData = productos;
    
    if (!productos || productos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No tienes productos registrados</td></tr>';
      return;
    }
    
    renderProductos(productos);
    actualizarEstadisticasProductos(productos);
  } catch (err) {
    console.error('Error al cargar productos:', err);
    renderError('productosTableBody', 'Error al cargar productos', err.message);
  }
}

function aplicarFiltrosProductos() {
  const termino = (document.getElementById('buscadorProducto')?.value || '').toLowerCase();
  const estado = document.getElementById('filtroEstado')?.value || '';
  const categoriaId = parseInt(document.getElementById('filtroCategoria')?.value || '0');

  let resultado = productosData;

  if (termino) {
    resultado = resultado.filter(p =>
      p.nombre.toLowerCase().includes(termino) ||
      p.descripcion?.toLowerCase().includes(termino)
    );
  }

  if (estado === 'activo') {
    resultado = resultado.filter(p => p.stock > 5);
  } else if (estado === 'sin-stock') {
    resultado = resultado.filter(p => p.stock <= 0);
  } else if (estado === 'bajo-stock') {
    resultado = resultado.filter(p => p.stock > 0 && p.stock <= 5);
  }

  if (categoriaId) {
    resultado = resultado.filter(p => p.id_categoria === categoriaId);
  }

  renderProductos(resultado);
}

function renderProductos(productos) {
  const tbody = document.getElementById('productosTableBody');
  
  tbody.innerHTML = productos.map(producto => {
    const categoria = categoriasData.find(cat => cat.id_categoria === producto.id_categoria);
    const imgSrc = producto.imagen || 'https://via.placeholder.com/50x50?text=N/A';
    const stockBadge = producto.stock > 0
      ? `<span class="badge bg-success">Activo</span>`
      : `<span class="badge bg-danger">Sin stock</span>`;

    return `
      <tr>
        <td><img src="${escapeHtml(imgSrc)}" width="50" height="50" style="object-fit:cover;border-radius:6px;" onerror="this.src='https://via.placeholder.com/50x50?text=N/A'"></td>
        <td>
          <div class="fw-semibold">${escapeHtml(producto.nombre)}</div>
          <div class="small text-muted">#${producto.id_producto}</div>
        </td>
        <td>${categoria ? escapeHtml(categoria.nombre) : 'N/A'}</td>
        <td>$${parseFloat(producto.precio || 0).toFixed(2)}</td>
        <td>${producto.stock ?? 0}</td>
        <td>${stockBadge}</td>
        <td>
          <div class="btn-group" role="group">
            <button class="btn btn-sm btn-outline-info" onclick="editarProducto(${producto.id_producto})" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="eliminarProducto(${producto.id_producto})" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Cargar pedidos del vendedor
async function cargarPedidos() {
  if (pedidosCargados && pedidosData.length > 0) return;
  
  try {
    const tbody = document.getElementById('pedidosTableBody');
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">
          <div class="spinner-border spinner-border-sm me-2" role="status"></div>
          Cargando pedidos...
        </td>
      </tr>
    `;
    
    const res = await fetchAuth('/pedido/mis-pedidos-vendedor');
    if (!res.ok) throw new Error('Error al cargar pedidos');
    const pedidos = await res.json();
    pedidosData = pedidos;
    pedidosCargados = true;
    
    if (!pedidos || pedidos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No tienes pedidos registrados</td></tr>';
      return;
    }
    
    renderPedidos(pedidos);
    actualizarEstadisticasPedidos(pedidos);
  } catch (err) {
    console.error('Error al cargar pedidos:', err);
    renderError('pedidosTableBody', 'Error al cargar pedidos', err.message);
  }
}

function renderPedidos(pedidos) {
  const tbody = document.getElementById('pedidosTableBody');
  
  tbody.innerHTML = pedidos.map(pedido => `
    <tr>
      <td>${pedido.id_pedido}</td>
      <td>${escapeHtml(pedido.nombre_cliente || 'N/A')}</td>
      <td>${new Date(pedido.fecha_pedido).toLocaleDateString()}</td>
      <td>$${parseFloat(pedido.total || 0).toFixed(2)}</td>
      <td>
        <span class="badge bg-${getEstadoBadgeClass(pedido.estado)}">
          ${pedido.estado || 'Pendiente'}
        </span>
      </td>
      <td>
        <div class="btn-group" role="group">
          <button class="btn btn-sm btn-outline-info" onclick="verPedido(${pedido.id_pedido})" title="Ver detalles">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function getEstadoBadgeClass(estado) {
  switch (estado?.toLowerCase()) {
    case 'pendiente': return 'warning';
    case 'confirmado': return 'info';
    case 'preparando': case 'preparando pedido': return 'primary';
    case 'en camino': return 'info';
    case 'entregado': return 'success';
    case 'cancelado': return 'danger';
    default: return 'secondary';
  }
}

// Actualizar estadísticas de productos
function actualizarEstadisticasProductos(productos) {
  const totalEl = document.getElementById('totalProductos');
  if (totalEl) totalEl.textContent = productos.length;
}

// Actualizar estadísticas de pedidos
function actualizarEstadisticasPedidos(pedidos) {
  const ingresos = pedidos.reduce((sum, p) => sum + parseFloat(p.total || 0), 0);
  const activos = pedidos.filter(p => ['pendiente','confirmado','preparando','preparando pedido','en camino'].includes((p.estado || '').toLowerCase())).length;

  const ventasEl = document.getElementById('ventasMes');
  const ingresosEl = document.getElementById('ingresosMes');
  const activosEl = document.getElementById('pedidosActivos');

  if (ventasEl) ventasEl.textContent = pedidos.length;
  if (ingresosEl) ingresosEl.textContent = `$${ingresos.toFixed(2)}`;
  if (activosEl) activosEl.textContent = activos;
}

// Funciones de productos
function abrirCrearProducto() {
  productoEditandoId = null;
  document.getElementById('modalProductoTitle').innerHTML = '<i class="fas fa-box me-2"></i>Crear Producto';
  document.getElementById('productoForm').reset();
  const modal = new bootstrap.Modal(document.getElementById('modalProducto'));
  modal.show();
}

function editarProducto(id) {
  const producto = productosData.find(p => p.id_producto === id);
  if (!producto) return;
  
  productoEditandoId = id;
  document.getElementById('modalProductoTitle').innerHTML = '<i class="fas fa-edit me-2"></i>Editar Producto';
  
  // Llenar formulario
  document.getElementById('productoNombre').value = producto.nombre || '';
  document.getElementById('productoPrecio').value = producto.precio || '';
  document.getElementById('productoStock').value = producto.stock || '';
  document.getElementById('productoCategoria').value = producto.id_categoria || '';
  document.getElementById('productoDescripcion').value = producto.descripcion || '';
  document.getElementById('productoImagen').value = producto.imagen || '';
  document.getElementById('productoCiudadOrigen').value = producto.ciudad_origen || '';
  document.getElementById('productoTiempoPreparacion').value = producto.tiempo_preparacion ?? 1;
  document.getElementById('productoCostoCompra').value = producto.costo_compra || '';
  const comisionPct = producto.comision_plataforma != null ? (Number(producto.comision_plataforma) * 100) : 5;
  document.getElementById('productoComision').value = comisionPct;
  
  const modal = new bootstrap.Modal(document.getElementById('modalProducto'));
  modal.show();
}

async function guardarProducto() {
  const form = document.getElementById('productoForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  // Validar formulario antes de enviar
  if (!validarFormularioProducto()) {
    return;
  }

  // Bloquear el botón inmediatamente para evitar envíos duplicados
  const btn = document.querySelector('#modalProducto .modal-footer .btn-primary');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Guardando...';
  }

  const comisionInputVal = parseFloat(document.getElementById('productoComision').value);
  const comisionDecimal = Number.isFinite(comisionInputVal) ? comisionInputVal / 100 : 0.05;

  const datos = {
    nombre: document.getElementById('productoNombre').value,
    precio: parseFloat(document.getElementById('productoPrecio').value),
    stock: parseInt(document.getElementById('productoStock').value),
    id_categoria: parseInt(document.getElementById('productoCategoria').value),
    descripcion: document.getElementById('productoDescripcion').value,
    imagen: document.getElementById('productoImagen').value || null,
    ciudad_origen: document.getElementById('productoCiudadOrigen').value.trim() || null,
    tiempo_preparacion: parseInt(document.getElementById('productoTiempoPreparacion').value) || 1,
    costo_compra: parseFloat(document.getElementById('productoCostoCompra').value) || 0,
    comision_plataforma: comisionDecimal
  };

  try {
    const url = productoEditandoId 
      ? `/producto/${productoEditandoId}`
      : '/producto';

    const method = productoEditandoId ? 'PUT' : 'POST';

    const res = await fetchAuth(url, { method, body: JSON.stringify(datos) });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.mensaje || 'Error al guardar producto');
    }

    showToast(productoEditandoId ? '✅ Producto actualizado correctamente' : '✅ Producto creado correctamente', 'success');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalProducto')).hide();
    cargarProductos();
  } catch (err) {
    console.error('Error al guardar producto:', err);
    showToast(err.message || 'Error al guardar producto', 'error');
  } finally {
    // Rehabilitar siempre, tanto si tuvo éxito como si falló
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar Producto';
    }
  }
}

async function eliminarProducto(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) return;
  
  try {
    const res = await fetchAuth(`/producto/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar producto');
    
    showToast('Producto eliminado correctamente', 'success');
    cargarProductos();
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    showToast('Error al eliminar producto', 'error');
  }
}

function verProducto(id) {
  const producto = productosData.find(p => p.id_producto === id);
  if (!producto) return;
  
  // Implementar vista de producto (podría ser un modal)
  showToast(`Ver producto ${id} - Funcionalidad en desarrollo`, 'info');
}

// Funciones de pedidos
async function verPedido(id) {
  try {
    pedidoActualId = id;
    const res = await fetchAuth(`/pedido/${id}`);
    if (!res.ok) throw new Error('Error al cargar pedido');
    const pedido = await res.json();

    const estadoActual = Number(pedido.id_estado || 0);
    const estadosPermitidos = TRANSICIONES_VENDEDOR[estadoActual] || [];
    const opcionesEstado = estadosPermitidos.length
      ? estadosPermitidos
        .map((idEstado) => ESTADOS_PEDIDO.find((estado) => estado.id === idEstado))
        .filter(Boolean)
        .map((estado) => `<option value="${estado.id}">${estado.nombre}</option>`)
        .join('')
      : '<option value="">Sin cambios disponibles</option>';

    // Mostrar detalles en modal
    const detallesHtml = `
      <div class="row">
        <div class="col-md-6">
          <h6>Información del Pedido</h6>
          <p><strong>ID:</strong> ${pedido.id_pedido}</p>
          <p><strong>Fecha:</strong> ${new Date(pedido.fecha_pedido).toLocaleString()}</p>
          <p><strong>Cliente:</strong> ${pedido.nombre_cliente || pedido.usuario || 'N/A'}</p>
          <p><strong>Email:</strong> ${pedido.email_cliente || 'N/A'}</p>
          <p><strong>Estado:</strong> <span class="badge bg-${getEstadoBadgeClass(pedido.estado)}">${pedido.estado}</span></p>
        </div>
        <div class="col-md-6">
          <h6>Resumen</h6>
          <p><strong>Total:</strong> $${parseFloat(pedido.total || 0).toFixed(2)}</p>
        </div>
      </div>
      <hr>
      <h6><i class="fas fa-exchange-alt me-1"></i>Cambiar Estado del Pedido</h6>
      <div class="d-flex gap-2 align-items-center mb-3">
        <select class="form-select form-select-sm" id="selectEstadoPedido" style="max-width:200px;" ${estadosPermitidos.length ? '' : 'disabled'}>
          ${opcionesEstado}
        </select>
        <button class="btn btn-sm btn-primary" id="btnCambiarEstado" onclick="cambiarEstadoPedido(${pedido.id_pedido})" ${estadosPermitidos.length ? '' : 'disabled'}>
          <i class="fas fa-save me-1"></i>Guardar
        </button>
      </div>
      <hr>
      <h6>Productos del Pedido</h6>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Precio Unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${pedido.detalles ? pedido.detalles.map(det => `
              <tr>
                <td>${escapeHtml(det.nombre_producto)}</td>
                <td>${det.cantidad}</td>
                <td>$${parseFloat(det.precio_unitario || 0).toFixed(2)}</td>
                <td>$${(det.cantidad * parseFloat(det.precio_unitario || 0)).toFixed(2)}</td>
              </tr>
            `).join('') : '<tr><td colspan="4">No hay detalles disponibles</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    
    document.getElementById('pedidoDetalles').innerHTML = detallesHtml;

    // Show/hide factura button (available when pedido is confirmed or beyond)
    const btnFactura = document.getElementById('btnVerFactura');
    if (btnFactura) {
      btnFactura.style.display = estadoActual >= 2 ? 'inline-block' : 'none';
    }

    const modal = new bootstrap.Modal(document.getElementById('modalPedido'));
    modal.show();
  } catch (err) {
    console.error('Error al ver pedido:', err);
    showToast('Error al cargar detalles del pedido', 'error');
  }
}

async function cambiarEstadoPedido(idPedido) {
  const select = document.getElementById('selectEstadoPedido');
  const btn = document.getElementById('btnCambiarEstado');
  if (!select) return;

  const nuevoEstado = parseInt(select.value);
  if (!Number.isFinite(nuevoEstado)) {
    showToast('Este pedido no tiene cambios de estado disponibles para vendedor', 'info');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Guardando...';

  try {
    const res = await fetchAuth(`/pedido/${idPedido}`, {
      method: 'PUT',
      body: JSON.stringify({ id_estado: nuevoEstado })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al actualizar estado');
    }
    showToast('Estado del pedido actualizado correctamente', 'success');
    bootstrap.Modal.getInstance(document.getElementById('modalPedido')).hide();
    pedidosCargados = false;
    cargarPedidos();
  } catch (err) {
    console.error('Error al cambiar estado:', err);
    showToast(err.message || 'Error al cambiar estado del pedido', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save me-1"></i>Guardar';
  }
}

// Funciones de filtros y búsqueda
function setupEventListeners() {
  // Búsqueda de productos
  const buscadorProducto = document.getElementById('buscadorProducto');
  if (buscadorProducto) {
    buscadorProducto.addEventListener('input', aplicarFiltrosProductos);
  }
  
  // Filtro de estado de productos
  const filtroEstado = document.getElementById('filtroEstado');
  if (filtroEstado) {
    filtroEstado.addEventListener('change', aplicarFiltrosProductos);
  }
  
  // Filtro de categoría de productos
  const filtroCategoria = document.getElementById('filtroCategoria');
  if (filtroCategoria) {
    filtroCategoria.addEventListener('change', aplicarFiltrosProductos);
  }
  
  // Búsqueda de pedidos
  const busquedaPedido = document.getElementById('busquedaPedido');
  if (busquedaPedido) {
    busquedaPedido.addEventListener('input', () => {
      const termino = busquedaPedido.value.toLowerCase();
      const pedidosFiltrados = pedidosData.filter(p => 
        p.nombre_cliente?.toLowerCase().includes(termino) ||
        p.email_cliente?.toLowerCase().includes(termino)
      );
      renderPedidos(pedidosFiltrados);
    });
  }
  
  // Formulario de perfil
  const perfilForm = document.getElementById('perfilForm');
  if (perfilForm) {
    perfilForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Implementar guardado de perfil
      showToast('Funcionalidad de guardar perfil en desarrollo', 'info');
    });
  }

  // Preview de imagen del producto en tiempo real
  const productoImagen = document.getElementById('productoImagen');
  if (productoImagen) {
    productoImagen.addEventListener('input', function () {
      const preview = document.getElementById('previewImagen');
      if (this.value) {
        preview.src = this.value;
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }
    });
  }
}

// Funciones de recarga
function recargarProductos() {
  cargarProductos();
}

function recargarPedidos() {
  pedidosCargados = false;
  cargarPedidos();
}

// Funciones de perfil
function mostrarPerfil() {
  const perfilTab = document.getElementById('perfil-tab');
  if (perfilTab) {
    perfilTab.click();
  }
}

// Cerrar sesión
function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.href = 'login.html';
}

// Inicializar gráficos con datos reales
async function inicializarGraficos() {
  renderGraficoVentasMensuales();
  renderGraficoEstadoProductos();
  await cargarTopProductos();
}

function renderGraficoVentasMensuales() {
  const ventasCtx = document.getElementById('ventasChart');
  if (!ventasCtx) return;

  // Calcular últimos 6 meses desde pedidosData (datos reales del vendedor)
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const now = new Date();
  const periodos = [];
  const totalesPorMes = {};

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    periodos.push({ key, label: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
    totalesPorMes[key] = 0;
  }

  pedidosData.forEach(p => {
    const fecha = new Date(p.fecha_pedido);
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    if (Object.prototype.hasOwnProperty.call(totalesPorMes, key)) {
      totalesPorMes[key] += parseFloat(p.total || 0);
    }
  });

  const labels = periodos.map(m => m.label);
  const data   = periodos.map(m => +totalesPorMes[m.key].toFixed(2));

  if (ventasChartInstance) ventasChartInstance.destroy();
  ventasChartInstance = new Chart(ventasCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ingresos ($)',
        data,
        borderColor: 'rgb(39, 174, 96)',
        backgroundColor: 'rgba(39, 174, 96, 0.15)',
        tension: 0.3,
        fill: true,
        pointBackgroundColor: 'rgb(39, 174, 96)'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: 'white' } },
        title: { display: true, text: 'Ventas Mensuales (últimos 6 meses)', color: 'white' }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: 'white',
            callback: v => `$${v.toLocaleString()}`
          },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        x: {
          ticks: { color: 'white' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        }
      }
    }
  });
}

function renderGraficoEstadoProductos() {
  const productosCtx = document.getElementById('productosChart');
  if (!productosCtx) return;

  const activos   = productosData.filter(p => p.stock > 5).length;
  const bajoStock = productosData.filter(p => p.stock > 0 && p.stock <= 5).length;
  const sinStock  = productosData.filter(p => p.stock <= 0).length;

  if (productosChartInstance) productosChartInstance.destroy();
  productosChartInstance = new Chart(productosCtx, {
    type: 'doughnut',
    data: {
      labels: ['Con stock', 'Bajo stock', 'Sin stock'],
      datasets: [{
        data: [activos, bajoStock, sinStock],
        backgroundColor: ['rgb(39,174,96)', 'rgb(243,156,18)', 'rgb(231,76,60)']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: 'white' } },
        title: { display: true, text: 'Estado de Productos', color: 'white' }
      }
    }
  });
}

async function cargarTopProductos() {
  const tbody = document.getElementById('topProductosBody');
  if (!tbody) return;

  try {
    const res = await fetchAuth('/pedido/reportes/resumen?top=10');
    if (!res.ok) throw new Error('Error al obtener reportes');
    const { top_productos } = await res.json();

    // Filtrar solo productos del vendedor actual
    const misIds = new Set(productosData.map(p => p.id_producto));
    const misTop = (top_productos || []).filter(p => misIds.has(p.id_producto));

    if (!misTop.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin datos de ventas aún</td></tr>';
      return;
    }

    tbody.innerHTML = misTop.slice(0, 5).map((p, i) => `
      <tr>
        <td>
          <span class="badge bg-secondary me-1">#${i + 1}</span>
          ${escapeHtml(p.nombre)}
        </td>
        <td>${p.unidades}</td>
        <td>$${parseFloat(p.ingresos || 0).toFixed(2)}</td>
        <td>
          ${p.unidades > 0
            ? '<span class="badge bg-success">Vendido</span>'
            : '<span class="badge bg-secondary">Sin ventas</span>'}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error al cargar top productos:', err);
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error al cargar estadísticas</td></tr>';
  }
}

// Funciones adicionales
function actualizarTiempoActual() {
  const el = document.getElementById('currentTime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleString('es-ES', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Alias para compatibilidad con llamadas en el HTML
function showFeatureToast(msg) { showToast(msg, 'info'); }
function mostrarToastPersonalizado(mensaje, tipo = 'success') { showToast(mensaje, tipo); }

// Inicialización del panel
document.addEventListener('DOMContentLoaded', () => {
  cargarInfoVendedor();
  cargarCategorias();
  cargarProductos();
  setupEventListeners();

  actualizarTiempoActual();
  setInterval(actualizarTiempoActual, 60000);

  cargarPedidos();

  document.getElementById('estadisticas-tab')?.addEventListener('shown.bs.tab', () => inicializarGraficos());
  document.getElementById('inventario-tab')?.addEventListener('shown.bs.tab', () => inicializarInventario());
  document.getElementById('inteligencia-tab')?.addEventListener('shown.bs.tab', () => inicializarInteligencia());
});

// Validación de formularios con clases Bootstrap is-invalid
function validarFormularioProducto() {
  const nombre = document.getElementById('productoNombre');
  const precio = document.getElementById('productoPrecio');
  const stock = document.getElementById('productoStock');
  const categoria = document.getElementById('productoCategoria');
  
  let valido = true;
  
  if (!nombre.value.trim()) {
    nombre.classList.add('is-invalid');
    valido = false;
  } else {
    nombre.classList.remove('is-invalid');
  }
  
  if (!precio.value || parseFloat(precio.value) <= 0) {
    precio.classList.add('is-invalid');
    valido = false;
  } else {
    precio.classList.remove('is-invalid');
  }
  
  if (stock.value === '' || parseInt(stock.value) < 0) {
    stock.classList.add('is-invalid');
    valido = false;
  } else {
    stock.classList.remove('is-invalid');
  }
  
  if (!categoria.value) {
    categoria.classList.add('is-invalid');
    valido = false;
  } else {
    categoria.classList.remove('is-invalid');
  }
  
  return valido;
}

// ══════════════════════════════════════════════════
// INVENTARIO — Movimientos, Resumen Financiero, Factura
// ══════════════════════════════════════════════════

let inventarioCargado = false;
let pedidoActualId = null;

function inicializarInventario() {
  if (!inventarioCargado) {
    poblarSelectProductosEntrada();
  }
  cargarResumenFinanciero();
  cargarMovimientos();
  inventarioCargado = true;
}

function poblarSelectProductosEntrada() {
  const select = document.getElementById('entradaProducto');
  if (!select) return;
  const opciones = productosData.map(p =>
    `<option value="${p.id_producto}">${escapeHtml(p.nombre)} (Stock: ${p.stock ?? 0})</option>`
  ).join('');
  select.innerHTML = '<option value="">Selecciona un producto</option>' + opciones;
}

async function cargarResumenFinanciero() {
  try {
    const res = await fetchAuth('/movimiento-inventario/resumen');
    if (!res.ok) throw new Error('Error al cargar resumen');
    const data = await res.json();

    const el = (id, val) => {
      const e = document.getElementById(id);
      if (e) e.textContent = val;
    };
    el('invGananciaNeta', '$' + Number(data.ganancia_neta_total || 0).toFixed(2));
    el('invTotalVentas', '$' + Number(data.total_ventas || 0).toFixed(2));
    el('invComisionTotal', '$' + Number(data.comision_total || 0).toFixed(2));
    el('invTotalInvertido', '$' + Number(data.total_invertido || 0).toFixed(2));
  } catch (err) {
    console.error('Error al cargar resumen financiero:', err);
  }
}

async function cargarMovimientos() {
  const tbody = document.getElementById('movimientosTableBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3"><div class="spinner-border spinner-border-sm me-2"></div>Cargando...</td></tr>';

  try {
    const tipo = document.getElementById('filtroTipoMov')?.value || '';
    let url = '/movimiento-inventario/?limit=100';
    if (tipo) url += '&tipo=' + tipo;

    const res = await fetchAuth(url);
    if (!res.ok) throw new Error('Error al cargar movimientos');
    const movimientos = await res.json();

    if (!movimientos || movimientos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No hay movimientos registrados</td></tr>';
      return;
    }

    tbody.innerHTML = movimientos.map(m => {
      const esEntrada = m.tipo_movimiento === 'ENTRADA';
      const badgeClass = esEntrada ? 'bg-success' : 'bg-danger';
      const badgeIcon = esEntrada ? 'fa-arrow-down' : 'fa-arrow-up';
      const fecha = new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      const costoUnit = Number(m.costo_unitario || 0).toFixed(2);
      const precioVenta = m.precio_venta_unit != null ? ('$' + Number(m.precio_venta_unit).toFixed(2)) : '-';
      const gananciaNeta = m.ganancia_neta != null ? ('$' + Number(m.ganancia_neta).toFixed(2)) : '-';
      const ref = m.referencia || '-';

      return `<tr>
        <td class="small">${fecha}</td>
        <td><span class="badge ${badgeClass}"><i class="fas ${badgeIcon} me-1"></i>${m.tipo_movimiento}</span></td>
        <td>${escapeHtml(m.nombre_producto || '')}</td>
        <td>${m.cantidad}</td>
        <td>$${costoUnit}</td>
        <td>${precioVenta}</td>
        <td>${gananciaNeta}</td>
        <td class="small">${escapeHtml(ref)}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Error al cargar movimientos:', err);
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-3">Error al cargar movimientos</td></tr>';
  }
}

async function registrarEntradaInventario() {
  const idProducto = document.getElementById('entradaProducto').value;
  const cantidad = document.getElementById('entradaCantidad').value;
  const costoUnitario = document.getElementById('entradaCostoUnitario').value;
  const referencia = document.getElementById('entradaReferencia').value;
  const observaciones = document.getElementById('entradaObservaciones').value;

  if (!idProducto || !cantidad || !costoUnitario) {
    showToast('Completa producto, cantidad y costo unitario', 'warning');
    return;
  }

  const btn = document.getElementById('btnRegistrarEntrada');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Registrando...';

  try {
    const res = await fetchAuth('/movimiento-inventario/entrada', {
      method: 'POST',
      body: JSON.stringify({
        id_producto: Number(idProducto),
        cantidad: Number(cantidad),
        costo_unitario: Number(costoUnitario),
        referencia: referencia || null,
        observaciones: observaciones || null
      })
    });

    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err?.error || 'Error al registrar entrada');
    }

    showToast('Entrada de inventario registrada correctamente', 'success');
    document.getElementById('formEntradaInventario').reset();
    cargarResumenFinanciero();
    cargarMovimientos();
    cargarProductos();
    poblarSelectProductosEntrada();
  } catch (err) {
    console.error('Error al registrar entrada:', err);
    showToast(err.message || 'Error al registrar entrada', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-plus-circle me-1"></i>Registrar Entrada';
  }
}

// ── Factura ──

async function verFacturaPedido() {
  if (!pedidoActualId) return;

  const facturaBody = document.getElementById('facturaContenido');
  facturaBody.innerHTML = '<div class="text-center py-4"><div class="spinner-border"></div><p class="mt-2 text-muted">Generando factura...</p></div>';

  const modalFactura = new bootstrap.Modal(document.getElementById('modalFactura'));
  modalFactura.show();

  try {
    const res = await fetchAuth('/movimiento-inventario/factura/' + pedidoActualId);
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err?.error || 'No se pudo generar la factura');
    }
    const data = await res.json();

    const fechaStr = data.pedido.fecha ? new Date(data.pedido.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';

    let html = `
      <div style="background: rgba(255,255,255,0.05); border-radius:12px; padding:20px;">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h5 class="mb-1">Factura Vendedor</h5>
            <p class="text-muted mb-0">Pedido #${data.pedido.id_pedido}</p>
          </div>
          <div class="text-end">
            <p class="mb-0 small text-muted">${fechaStr}</p>
            <p class="mb-0 small">Cliente: <strong>${escapeHtml(data.pedido.cliente || 'N/A')}</strong></p>
          </div>
        </div>
        <hr style="border-color: rgba(255,255,255,0.2);">
        <div class="table-responsive">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Producto</th>
                <th class="text-end">Cant.</th>
                <th class="text-end">Costo Compra</th>
                <th class="text-end">P. Venta</th>
                <th class="text-end">Subtotal</th>
                <th class="text-end">Comisi&oacute;n</th>
                <th class="text-end">Ganancia Neta</th>
              </tr>
            </thead>
            <tbody>`;

    for (const item of data.items) {
      html += `
              <tr>
                <td>${escapeHtml(item.nombre_producto)}</td>
                <td class="text-end">${item.cantidad}</td>
                <td class="text-end">$${Number(item.costo_compra || 0).toFixed(2)}</td>
                <td class="text-end">$${Number(item.precio_venta || 0).toFixed(2)}</td>
                <td class="text-end">$${Number(item.subtotal_venta || 0).toFixed(2)}</td>
                <td class="text-end text-warning">-$${Number(item.comision_plataforma || 0).toFixed(2)}</td>
                <td class="text-end text-success fw-bold">$${Number(item.ganancia_neta || 0).toFixed(2)}</td>
              </tr>`;
    }

    html += `
            </tbody>
            <tfoot style="border-top: 2px solid rgba(255,255,255,0.3);">
              <tr>
                <td colspan="4" class="text-end fw-bold">TOTALES</td>
                <td class="text-end fw-bold">$${Number(data.totales.total_venta).toFixed(2)}</td>
                <td class="text-end text-warning fw-bold">-$${Number(data.totales.total_comision).toFixed(2)}</td>
                <td class="text-end text-success fw-bold">$${Number(data.totales.total_ganancia_neta).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="row mt-3">
          <div class="col-md-4">
            <div class="p-2 rounded" style="background:rgba(40,167,69,0.15);">
              <small class="text-muted d-block">Ganancia Bruta</small>
              <strong class="text-success">$${Number(data.totales.total_ganancia_bruta).toFixed(2)}</strong>
            </div>
          </div>
          <div class="col-md-4">
            <div class="p-2 rounded" style="background:rgba(255,193,7,0.15);">
              <small class="text-muted d-block">Comisi&oacute;n Plataforma</small>
              <strong class="text-warning">-$${Number(data.totales.total_comision).toFixed(2)}</strong>
            </div>
          </div>
          <div class="col-md-4">
            <div class="p-2 rounded" style="background:rgba(40,167,69,0.25);">
              <small class="text-muted d-block">Ganancia Neta Final</small>
              <strong class="text-success fs-5">$${Number(data.totales.total_ganancia_neta).toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </div>`;

    facturaBody.innerHTML = html;
  } catch (err) {
    console.error('Error al generar factura:', err);
    facturaBody.innerHTML = `<div class="alert alert-warning"><i class="fas fa-exclamation-triangle me-2"></i>${escapeHtml(err.message)}</div>`;
  }
}

function cambiarPassword() {
  showToast('Funcionalidad de cambiar contrase\u00f1a en desarrollo', 'info');
}
function exportarDatos() {
  showToast('Funcionalidad de exportar datos en desarrollo', 'info');
}
function verAyuda() {
  showToast('Funcionalidad de ayuda en desarrollo', 'info');
}

// ══════════════════════════════════════════════════
// INTELIGENCIA DE NEGOCIO
// ══════════════════════════════════════════════════

let biData = null;
let biCargado = false;

function inicializarInteligencia() {
  // Fecha por defecto: últimos 30 días
  const hoy = new Date();
  const hace30 = new Date(Date.now() - 30 * 86400000);
  const inputFin = document.getElementById('biFechaFin');
  const inputIni = document.getElementById('biFechaInicio');
  if (inputFin) inputFin.value = hoy.toISOString().slice(0, 10);
  if (inputIni) inputIni.value = hace30.toISOString().slice(0, 10);

  // Poblar selector del simulador
  poblarSelectSimulador();

  if (!biCargado) {
    cargarInteligenciaNegocio();
  }
}

function poblarSelectSimulador() {
  const select = document.getElementById('simProducto');
  if (!select || !productosData.length) return;
  select.innerHTML = '<option value="">Selecciona producto</option>' +
    productosData.map(p =>
      `<option value="${p.id_producto}">${escapeHtml(p.nombre)} ($${parseFloat(p.precio || 0).toFixed(2)})</option>`
    ).join('');
}

async function cargarInteligenciaNegocio() {
  const fechaIni = document.getElementById('biFechaInicio')?.value || '';
  const fechaFin = document.getElementById('biFechaFin')?.value || '';

  // Mostrar loading en recomendaciones
  const recList = document.getElementById('biRecomendacionesList');
  if (recList) {
    recList.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border spinner-border-sm me-2"></div>
        <span class="text-muted">Analizando tu negocio...</span>
      </div>
    `;
  }

  try {
    let url = '/reportes/vendedor/inteligencia-negocio?';
    if (fechaIni) url += `fecha_inicio=${fechaIni}&`;
    if (fechaFin) url += `fecha_fin=${fechaFin}&`;

    const res = await fetchAuth(url);
    if (!res.ok) throw new Error('Error al cargar inteligencia de negocio');
    const json = await res.json();
    biData = json.data;
    biCargado = true;

    renderInteligenciaNegocio(biData);
  } catch (err) {
    console.error('Error inteligencia de negocio:', err);
    if (recList) {
      recList.innerHTML = `
        <div class="alert alert-warning mb-0">
          <i class="fas fa-exclamation-triangle me-2"></i>${escapeHtml(err.message)}
        </div>
      `;
    }
  }
}

function renderInteligenciaNegocio(data) {
  if (!data) return;

  // Período info
  const periodoEl = document.getElementById('biPeriodoInfo');
  if (periodoEl && data.periodo) {
    periodoEl.textContent = `${data.periodo.fecha_inicio} → ${data.periodo.fecha_fin} (${data.periodo.dias} días)`;
  }

  // KPIs
  renderBIKpis(data);

  // Alertas
  renderBIAlertas(data.alertas || []);

  // Recomendaciones
  renderBIRecomendaciones(data.recomendaciones || []);

  // Insights
  renderBIInsights(data.insights || []);

  // Matriz Estratégica
  renderBIMatriz(data.matriz_estrategica || []);

  // Segmentación ABC
  renderBIABC(data.segmentacion || []);

  // Rotación
  renderBIRotacion(data.metricas_avanzadas?.rotacion_productos || []);

  // Cross-Selling
  renderBICrossSelling(data.cross_selling || []);
}

function renderBIKpis(data) {
  const ma = data.metricas_avanzadas || {};
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

  el('biCapitalInmovilizado', '$' + Number(ma.capital_inmovilizado || 0).toLocaleString('es-CO', { minimumFractionDigits: 2 }));
  el('biProductosConVentas', ma.productos_con_ventas || 0);
  el('biProductosSinVentas', ma.productos_sin_ventas || 0);
  el('biTotalAlertas', (data.alertas || []).length);
}

function renderBIAlertas(alertas) {
  const container = document.getElementById('biAlertasContainer');
  const list = document.getElementById('biAlertasList');
  if (!container || !list) return;

  if (!alertas.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  list.innerHTML = alertas.map(a => {
    const nivel = a.nivel || (a.prioridad === 'alta' ? 'critico' : 'medio');
    return `
      <div class="bi-alerta ${nivel}">
        <span class="bi-alerta-icono">${a.icono || '⚠️'}</span>
        <div class="bi-alerta-contenido">
          <div class="bi-alerta-mensaje">${escapeHtml(a.mensaje)}</div>
          ${a.accion ? `<span class="badge bg-danger bi-alerta-accion"><i class="fas fa-bolt me-1"></i>${escapeHtml(a.accion)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderBIRecomendaciones(recs) {
  const list = document.getElementById('biRecomendacionesList');
  const countEl = document.getElementById('biTotalRecomendaciones');
  if (!list) return;
  if (countEl) countEl.textContent = recs.length;

  if (!recs.length) {
    list.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="fas fa-check-circle fa-2x mb-2 d-block text-success opacity-75"></i>
        <strong>¡Todo en orden!</strong> No hay recomendaciones pendientes.
      </div>
    `;
    return;
  }

  list.innerHTML = recs.map(r => {
    const prioridadClass = `prioridad-${r.prioridad || 'baja'}`;
    const prioridadBadge = r.prioridad === 'alta'
      ? '<span class="badge bg-danger ms-2">Alta</span>'
      : r.prioridad === 'media'
        ? '<span class="badge bg-warning text-dark ms-2">Media</span>'
        : '<span class="badge bg-info ms-2">Baja</span>';

    return `
      <div class="bi-rec-card ${prioridadClass}">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <div class="mb-1" style="color: rgba(255,255,255,0.9); font-size: 0.9rem;">
              ${escapeHtml(r.mensaje)}
            </div>
            <div>
              ${r.producto ? `<span class="bi-badge bi-badge-oportunidad">${escapeHtml(r.producto)}</span>` : ''}
              ${prioridadBadge}
              <span class="badge bg-secondary ms-1">${escapeHtml(r.tipo || '')}</span>
            </div>
          </div>
          ${r.accion ? `
            <button class="btn btn-sm btn-outline-light flex-shrink-0 ms-3" 
                    onclick="showToast('Acción: ${escapeHtml(r.accion)}', 'info')" 
                    title="${escapeHtml(r.accion)}">
              <i class="fas fa-arrow-right"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderBIInsights(insights) {
  const container = document.getElementById('biInsightsContainer');
  const list = document.getElementById('biInsightsList');
  if (!container || !list) return;

  if (!insights.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  const nivelIcono = { critico: 'fa-exclamation-circle text-danger', positivo: 'fa-check-circle text-success', informativo: 'fa-info-circle text-info' };
  const nivelClase = { critico: 'critico', positivo: 'positivo', informativo: 'informativo' };

  list.innerHTML = insights.map(ins => `
    <div class="col-md-4">
      <div class="bi-insight-card">
        <h6>
          <i class="fas ${nivelIcono[ins.nivel] || 'fa-info-circle text-info'} me-2"></i>
          ${escapeHtml(ins.titulo)}
        </h6>
        <p>${escapeHtml(ins.descripcion)}</p>
      </div>
    </div>
  `).join('');
}

function renderBIMatriz(matriz) {
  const body = document.getElementById('biMatrizBody');
  if (!body) return;

  if (!matriz.length) {
    body.innerHTML = '<div class="text-center text-muted py-3 small">No hay datos de ventas para clasificar productos</div>';
    return;
  }

  const catClass = { Estrella: 'estrella', Oportunidad: 'oportunidad', Optimizar: 'optimizar', Eliminar: 'eliminar' };

  body.innerHTML = matriz.map(m => `
    <div class="bi-matriz-item">
      <div>
        <strong style="color: rgba(255,255,255,0.9);">${m.icono} ${escapeHtml(m.nombre)}</strong>
        <div class="small" style="color: rgba(255,255,255,0.5);">${escapeHtml(m.accion_recomendada)}</div>
      </div>
      <div class="text-end">
        <span class="bi-badge bi-badge-${catClass[m.categoria_estrategica] || 'optimizar'}">${escapeHtml(m.categoria_estrategica)}</span>
        <div class="small mt-1" style="color: rgba(255,255,255,0.5);">
          Margen: ${m.margen_pct}% · ${m.unidades_vendidas} uds
        </div>
      </div>
    </div>
  `).join('');
}

function renderBIABC(segmentacion) {
  const body = document.getElementById('biABCBody');
  if (!body) return;

  if (!segmentacion.length) {
    body.innerHTML = '<div class="text-center text-muted py-3 small">No hay datos de ventas para segmentar</div>';
    return;
  }

  // Resumen por categoría
  const resumen = { A: { count: 0, ingresos: 0 }, B: { count: 0, ingresos: 0 }, C: { count: 0, ingresos: 0 } };
  segmentacion.forEach(s => {
    if (resumen[s.categoria]) {
      resumen[s.categoria].count++;
      resumen[s.categoria].ingresos += s.ingresos;
    }
  });

  let html = `
    <div class="d-flex gap-2 mb-3">
      <span class="bi-badge bi-badge-a">A: ${resumen.A.count} productos (80% ingresos)</span>
      <span class="bi-badge bi-badge-b">B: ${resumen.B.count} productos (15% ingresos)</span>
      <span class="bi-badge bi-badge-c">C: ${resumen.C.count} productos (5% ingresos)</span>
    </div>
  `;

  html += segmentacion.slice(0, 15).map(s => {
    const catLower = s.categoria.toLowerCase();
    return `
      <div class="bi-matriz-item">
        <div>
          <span class="bi-badge bi-badge-${catLower} me-2">${s.categoria}</span>
          <span style="color: rgba(255,255,255,0.9);">${escapeHtml(s.nombre)}</span>
        </div>
        <div class="text-end small" style="color: rgba(255,255,255,0.5);">
          $${Number(s.ingresos).toLocaleString('es-CO')} (${s.pct_ingresos}%)
        </div>
      </div>
    `;
  }).join('');

  body.innerHTML = html;
}

function renderBIRotacion(productos) {
  const tbody = document.getElementById('biRotacionBody');
  if (!tbody) return;

  if (!productos.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted small">Sin datos</td></tr>';
    return;
  }

  // Ordenar: primero los lentos (más críticos)
  const sorted = [...productos].sort((a, b) => {
    const orden = { 'LENTO': 0, 'MEDIO': 1, 'RÁPIDO': 2 };
    return (orden[a.clasificacion] || 1) - (orden[b.clasificacion] || 1);
  });

  tbody.innerHTML = sorted.slice(0, 15).map(p => {
    const colorClass = p.color === 'verde' ? 'bi-rotacion-rapido'
      : p.color === 'amarillo' ? 'bi-rotacion-medio'
      : 'bi-rotacion-lento';
    const indicador = p.color === 'verde' ? '🟢' : p.color === 'amarillo' ? '🟡' : '🔴';
    const diasTxt = p.dias_promedio_stock !== null ? `${p.dias_promedio_stock}d` : '∞';

    return `
      <tr>
        <td class="small">${escapeHtml(p.nombre)}</td>
        <td>${p.stock}</td>
        <td>${p.ventas_diarias}</td>
        <td class="${colorClass} fw-bold">${diasTxt}</td>
        <td><span class="${colorClass}">${indicador} ${p.clasificacion}</span></td>
      </tr>
    `;
  }).join('');
}

function renderBICrossSelling(crossSelling) {
  const card = document.getElementById('biCrossSellingCard');
  const body = document.getElementById('biCrossSellingBody');
  if (!card || !body) return;

  if (!crossSelling.length) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  // Map product IDs to names
  const nombreMap = new Map(productosData.map(p => [p.id_producto, p.nombre]));

  body.innerHTML = crossSelling.map(cs => {
    const nombre1 = nombreMap.get(cs.productos[0]) || `Producto #${cs.productos[0]}`;
    const nombre2 = nombreMap.get(cs.productos[1]) || `Producto #${cs.productos[1]}`;
    return `
      <div class="bi-cross-item">
        <div>
          <i class="fas fa-link me-2 text-info"></i>
          <strong>${escapeHtml(nombre1)}</strong>
          <span class="mx-2 text-muted">+</span>
          <strong>${escapeHtml(nombre2)}</strong>
        </div>
        <div>
          <span class="badge bg-info">${cs.veces_juntos}x juntos</span>
          <span class="badge bg-success ms-1">Crear combo</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── Simulador de Precios ──

async function ejecutarSimulacion() {
  const idProducto = document.getElementById('simProducto')?.value;
  const variacion = document.getElementById('simVariacion')?.value;
  const resultadoEl = document.getElementById('simResultado');

  if (!idProducto || variacion === '' || variacion === undefined) {
    showToast('Selecciona un producto y variación de precio', 'warning');
    return;
  }

  resultadoEl.innerHTML = `
    <div class="text-center py-3">
      <div class="spinner-border spinner-border-sm me-2"></div>
      <span class="text-muted small">Simulando...</span>
    </div>
  `;

  try {
    const res = await fetchAuth(`/reportes/vendedor/simular-precio?id_producto=${idProducto}&variacion=${variacion}`);
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err?.error || 'Error en simulación');
    }
    const json = await res.json();
    const d = json.data;

    const diffClass = d.diferencia_ganancia >= 0 ? 'bi-sim-positivo' : 'bi-sim-negativo';
    const diffIcon = d.diferencia_ganancia >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

    resultadoEl.innerHTML = `
      <div class="bi-sim-resultado">
        <div class="mb-2 fw-bold" style="color: rgba(255,255,255,0.9);">
          <i class="fas fa-calculator me-1"></i> ${escapeHtml(d.producto)}
        </div>
        <div class="bi-sim-row">
          <span class="bi-sim-label">Precio actual</span>
          <span class="bi-sim-value">$${Number(d.precio_actual).toFixed(2)}</span>
        </div>
        <div class="bi-sim-row">
          <span class="bi-sim-label">Precio simulado (${d.variacion_precio_pct > 0 ? '+' : ''}${d.variacion_precio_pct}%)</span>
          <span class="bi-sim-value">$${Number(d.precio_simulado).toFixed(2)}</span>
        </div>
        <div class="bi-sim-row">
          <span class="bi-sim-label">Ventas actuales (30d)</span>
          <span class="bi-sim-value">${d.ventas_actuales} uds</span>
        </div>
        <div class="bi-sim-row">
          <span class="bi-sim-label">Ventas estimadas</span>
          <span class="bi-sim-value ${d.ventas_estimadas > d.ventas_actuales ? 'bi-sim-positivo' : 'bi-sim-negativo'}">
            ${d.ventas_estimadas} uds (${d.cambio_demanda_pct > 0 ? '+' : ''}${d.cambio_demanda_pct}%)
          </span>
        </div>
        <div class="bi-sim-row">
          <span class="bi-sim-label">Ganancia actual</span>
          <span class="bi-sim-value">$${Number(d.ganancia_actual).toFixed(2)}</span>
        </div>
        <div class="bi-sim-row">
          <span class="bi-sim-label">Ganancia estimada</span>
          <span class="bi-sim-value ${diffClass}">
            $${Number(d.ganancia_estimada).toFixed(2)}
            <i class="fas ${diffIcon} ms-1"></i>
          </span>
        </div>
        <div class="bi-sim-row" style="border-top: 2px solid rgba(255,255,255,0.15); margin-top: 4px; padding-top: 10px;">
          <span class="bi-sim-label fw-bold">Diferencia</span>
          <span class="bi-sim-value ${diffClass} fs-6">
            ${d.diferencia_ganancia >= 0 ? '+' : ''}$${Number(d.diferencia_ganancia).toFixed(2)}
          </span>
        </div>
        <div class="mt-2 small" style="color: rgba(255,255,255,0.4);">
          <i class="fas fa-info-circle me-1"></i>${escapeHtml(d.nota)}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Error simulación:', err);
    resultadoEl.innerHTML = `<div class="alert alert-warning mb-0 small">${escapeHtml(err.message)}</div>`;
  }
}
