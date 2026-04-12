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

  const datos = {
    nombre: document.getElementById('productoNombre').value,
    precio: parseFloat(document.getElementById('productoPrecio').value),
    stock: parseInt(document.getElementById('productoStock').value),
    id_categoria: parseInt(document.getElementById('productoCategoria').value),
    descripcion: document.getElementById('productoDescripcion').value,
    imagen: document.getElementById('productoImagen').value || null,
    ciudad_origen: document.getElementById('productoCiudadOrigen').value.trim() || null,
    tiempo_preparacion: parseInt(document.getElementById('productoTiempoPreparacion').value) || 1
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
    const res = await fetchAuth(`/pedido/${id}`);
    if (!res.ok) throw new Error('Error al cargar pedido');
    const pedido = await res.json();
    
    const ESTADOS_PEDIDO = [
      { id: 1, nombre: 'Pendiente' },
      { id: 2, nombre: 'Confirmado' },
      { id: 3, nombre: 'Preparando' },
      { id: 4, nombre: 'En camino' },
      { id: 5, nombre: 'Entregado' },
      { id: 6, nombre: 'Cancelado' }
    ];

    const opcionesEstado = ESTADOS_PEDIDO.map(e =>
      `<option value="${e.id}" ${e.id === pedido.id_estado ? 'selected' : ''}>${e.nombre}</option>`
    ).join('');

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
        <select class="form-select form-select-sm" id="selectEstadoPedido" style="max-width:200px;">
          ${opcionesEstado}
        </select>
        <button class="btn btn-sm btn-primary" id="btnCambiarEstado" onclick="cambiarEstadoPedido(${pedido.id_pedido})">
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
