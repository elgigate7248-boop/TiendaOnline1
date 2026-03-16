// Sistema de Creación Manual de Pedidos
class CrearPedido {
  constructor() {
    this.productos = [];
    this.clientes = [];
    this.carrito = [];
    this.clienteSeleccionado = null;
    this.init();
  }

  async init() {
    await this.cargarProductos();
    await this.cargarClientes();
    this.setupEventListeners();
    this.actualizarResumen();
  }

  setupEventListeners() {
    // Búsqueda de clientes
    document.getElementById('busquedaCliente').addEventListener('input', (e) => {
      this.buscarClientes(e.target.value);
    });

    // Selección de cliente
    document.getElementById('sugerenciasCliente').addEventListener('click', (e) => {
      if (e.target.classList.contains('customer-suggestion')) {
        this.seleccionarCliente(e.target.dataset.cliente);
      }
    });

    // Búsqueda de productos
    document.getElementById('busquedaProducto').addEventListener('input', (e) => {
      this.filtrarProductos();
    });

    // Filtro por categoría
    document.getElementById('filtroCategoria').addEventListener('change', () => {
      this.filtrarProductos();
    });

    // Formulario
    document.getElementById('formCrearPedido').addEventListener('submit', (e) => {
      e.preventDefault();
      this.prepararConfirmacion();
    });

    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.customer-search')) {
        document.getElementById('sugerenciasCliente').classList.remove('show');
      }
    });
  }

  async cargarProductos() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/producto', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Error al cargar productos');
      
      this.productos = await response.json();
      this.renderProductos();
      this.cargarCategorias();
    } catch (error) {
      console.error('Error:', error);
      this.showError('Error al cargar los productos');
    }
  }

  async cargarClientes() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/usuario', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Error al cargar clientes');
      
      const usuarios = await response.json();
      // Filtrar solo clientes
      this.clientes = usuarios.filter(u => 
        u.rol === 'CLIENTE' || 
        (Array.isArray(u.roles) && u.roles.includes('CLIENTE'))
      );
    } catch (error) {
      console.error('Error:', error);
      this.showError('Error al cargar los clientes');
    }
  }

  cargarCategorias() {
    const categorias = [...new Set(this.productos.map(p => p.categoria))].filter(Boolean);
    const select = document.getElementById('filtroCategoria');
    
    categorias.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    });
  }

  renderProductos(productos = this.productos) {
    const grid = document.getElementById('productosGrid');
    
    if (!productos.length) {
      grid.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="fas fa-box-open fa-3x text-muted mb-3"></i>
          <p class="text-muted">No se encontraron productos</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = productos.map(producto => this.renderProductoCard(producto)).join('');
  }

  renderProductoCard(producto) {
    const enCarrito = this.carrito.find(item => item.id_producto === producto.id_producto);
    const cantidad = enCarrito ? enCarrito.cantidad : 0;
    
    return `
      <div class="col-md-6 col-lg-4">
        <div class="product-card h-100 p-3 ${enCarrito ? 'selected' : ''}" 
             data-producto="${producto.id_producto}"
             onclick="crearPedido.toggleProducto(${producto.id_producto})">
          <div class="d-flex gap-3">
            <div class="flex-shrink-0">
              <img src="${producto.imagen || 'https://picsum.photos/seed/product' + producto.id_producto + '/80/80.jpg'}" 
                   alt="${producto.nombre}" 
                   class="rounded" 
                   style="width: 80px; height: 80px; object-fit: cover;">
            </div>
            <div class="flex-grow-1">
              <h6 class="mb-1">${producto.nombre}</h6>
              <div class="text-muted small mb-2">${producto.categoria || 'Sin categoría'}</div>
              <div class="d-flex justify-content-between align-items-center">
                <div class="fw-bold text-primary">$${Number(producto.precio).toLocaleString()}</div>
                <div class="text-muted small">Stock: ${producto.stock || 0}</div>
              </div>
              ${cantidad > 0 ? `
                <div class="mt-2">
                  <div class="quantity-control">
                    <button type="button" onclick="event.stopPropagation(); crearPedido.actualizarCantidad(${producto.id_producto}, -1)">
                      <i class="fas fa-minus"></i>
                    </button>
                    <input type="number" value="${cantidad}" min="1" max="${producto.stock || 999}" 
                           onchange="event.stopPropagation(); crearPedido.setCantidad(${producto.id_producto}, this.value)">
                    <button type="button" onclick="event.stopPropagation(); crearPedido.actualizarCantidad(${producto.id_producto}, 1)">
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  toggleProducto(idProducto) {
    const producto = this.productos.find(p => p.id_producto === idProducto);
    if (!producto) return;

    const enCarrito = this.carrito.find(item => item.id_producto === idProducto);
    
    if (!enCarrito) {
      // Agregar al carrito
      this.carrito.push({
        id_producto: producto.id_producto,
        nombre: producto.nombre,
        precio_unitario: producto.precio,
        cantidad: 1,
        stock: producto.stock || 0
      });
    } else {
      // Eliminar del carrito
      this.carrito = this.carrito.filter(item => item.id_producto !== idProducto);
    }

    this.renderProductos();
    this.renderCarrito();
    this.actualizarResumen();
  }

  actualizarCantidad(idProducto, cambio) {
    const item = this.carrito.find(item => item.id_producto === idProducto);
    if (!item) return;

    const nuevaCantidad = item.cantidad + cambio;
    if (nuevaCantidad <= 0) {
      this.toggleProducto(idProducto);
    } else if (nuevaCantidad <= item.stock) {
      item.cantidad = nuevaCantidad;
      this.renderProductos();
      this.renderCarrito();
      this.actualizarResumen();
    } else {
      this.showError('No hay stock suficiente');
    }
  }

  setCantidad(idProducto, cantidad) {
    const item = this.carrito.find(item => item.id_producto === idProducto);
    if (!item) return;

    cantidad = Math.max(1, Math.min(cantidad, item.stock));
    item.cantidad = cantidad;
    
    this.renderProductos();
    this.renderCarrito();
    this.actualizarResumen();
  }

  renderCarrito() {
    const container = document.getElementById('carritoItems');
    document.getElementById('countItems').textContent = this.carrito.length;
    
    if (!this.carrito.length) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="fas fa-shopping-cart fa-3x mb-3"></i>
          <p>No hay productos agregados al pedido</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.carrito.map(item => `
      <div class="cart-item">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h6 class="mb-1">${item.nombre}</h6>
            <div class="text-muted small">
              $${Number(item.precio_unitario).toLocaleString()} x ${item.cantidad} = 
              <span class="fw-bold">$${Number(item.precio_unitario * item.cantidad).toLocaleString()}</span>
            </div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <div class="quantity-control">
              <button type="button" onclick="crearPedido.actualizarCantidad(${item.id_producto}, -1)">
                <i class="fas fa-minus"></i>
              </button>
              <input type="number" value="${item.cantidad}" min="1" max="${item.stock}" 
                     onchange="crearPedido.setCantidad(${item.id_producto}, this.value)">
              <button type="button" onclick="crearPedido.actualizarCantidad(${item.id_producto}, 1)">
                <i class="fas fa-plus"></i>
              </button>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger" 
                    onclick="crearPedido.toggleProducto(${item.id_producto})">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  actualizarResumen() {
    const subtotal = this.carrito.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
    const iva = subtotal * 0.16;
    const envio = this.carrito.length > 0 ? 99 : 0; // Envío fijo de $99
    const total = subtotal + iva + envio;

    document.getElementById('subtotal').textContent = `$${Number(subtotal).toLocaleString()}`;
    document.getElementById('iva').textContent = `$${Number(iva).toLocaleString()}`;
    document.getElementById('envio').textContent = `$${Number(envio).toLocaleString()}`;
    document.getElementById('total').textContent = `$${Number(total).toLocaleString()}`;
  }

  buscarClientes(termino) {
    const sugerencias = document.getElementById('sugerenciasCliente');
    
    if (!termino) {
      sugerencias.classList.remove('show');
      return;
    }

    const filtrados = this.clientes.filter(cliente => 
      cliente.nombre.toLowerCase().includes(termino.toLowerCase()) ||
      cliente.email?.toLowerCase().includes(termino.toLowerCase()) ||
      cliente.id_usuario.toString().includes(termino)
    );

    if (filtrados.length === 0) {
      sugerencias.innerHTML = '<div class="customer-suggestion text-muted">No se encontraron clientes</div>';
    } else {
      sugerencias.innerHTML = filtrados.slice(0, 5).map(cliente => `
        <div class="customer-suggestion" data-cliente='${JSON.stringify(cliente)}'>
          <div class="fw-semibold">${cliente.nombre}</div>
          <div class="text-muted small">ID: ${cliente.id_usuario} | ${cliente.email || 'Sin email'}</div>
        </div>
      `).join('');
    }

    sugerencias.classList.add('show');
  }

  seleccionarCliente(clienteData) {
    const cliente = typeof clienteData === 'string' ? JSON.parse(clienteData) : clienteData;
    this.clienteSeleccionado = cliente;
    
    document.getElementById('idCliente').value = cliente.id_usuario;
    document.getElementById('clienteSeleccionado').innerHTML = `
      <div class="fw-semibold">${cliente.nombre}</div>
      <div class="text-muted small">ID: ${cliente.id_usuario} | ${cliente.email || 'Sin email'}</div>
    `;
    document.getElementById('sugerenciasCliente').classList.remove('show');
    document.getElementById('busquedaCliente').value = cliente.nombre;
  }

  filtrarProductos() {
    const busqueda = document.getElementById('busquedaProducto').value.toLowerCase();
    const categoria = document.getElementById('filtroCategoria').value;

    const filtrados = this.productos.filter(producto => {
      const coincideBusqueda = !busqueda || 
        producto.nombre.toLowerCase().includes(busqueda) ||
        producto.categoria?.toLowerCase().includes(busqueda);
      
      const coincideCategoria = !categoria || producto.categoria === categoria;
      
      return coincideBusqueda && coincideCategoria;
    });

    this.renderProductos(filtrados);
  }

  limpiarCarrito() {
    if (!this.carrito.length) return;
    
    if (confirm('¿Estás seguro de limpiar el carrito?')) {
      this.carrito = [];
      this.renderProductos();
      this.renderCarrito();
      this.actualizarResumen();
    }
  }

  prepararConfirmacion() {
    if (!this.clienteSeleccionado) {
      this.showError('Debes seleccionar un cliente');
      return;
    }

    if (!this.carrito.length) {
      this.showError('Debes agregar productos al pedido');
      return;
    }

    const metodoPago = document.getElementById('metodoPago').value;
    if (!metodoPago) {
      this.showError('Debes seleccionar un método de pago');
      return;
    }

    this.renderConfirmacion();
    
    const modal = new bootstrap.Modal(document.getElementById('modalConfirmacion'));
    modal.show();
  }

  renderConfirmacion() {
    const contenido = document.getElementById('contenidoConfirmacion');
    const subtotal = this.carrito.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
    const iva = subtotal * 0.16;
    const envio = 99;
    const total = subtotal + iva + envio;

    contenido.innerHTML = `
      <div class="mb-4">
        <h6 class="text-muted">Cliente</h6>
        <div class="fw-semibold">${this.clienteSeleccionado.nombre}</div>
        <div class="text-muted small">ID: ${this.clienteSeleccionado.id_usuario}</div>
      </div>
      
      <div class="mb-4">
        <h6 class="text-muted">Productos (${this.carrito.length})</h6>
        <div class="table-responsive">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Producto</th>
                <th class="text-center">Cantidad</th>
                <th class="text-end">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${this.carrito.map(item => `
                <tr>
                  <td>${item.nombre}</td>
                  <td class="text-center">${item.cantidad}</td>
                  <td class="text-end">$${Number(item.precio_unitario * item.cantidad).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="mb-4">
        <h6 class="text-muted">Resumen de Pago</h6>
        <div class="d-flex justify-content-between mb-1">
          <span>Subtotal:</span>
          <span>$${Number(subtotal).toLocaleString()}</span>
        </div>
        <div class="d-flex justify-content-between mb-1">
          <span>IVA (16%):</span>
          <span>$${Number(iva).toLocaleString()}</span>
        </div>
        <div class="d-flex justify-content-between mb-1">
          <span>Envío:</span>
          <span>$${Number(envio).toLocaleString()}</span>
        </div>
        <div class="d-flex justify-content-between fw-bold fs-5">
          <span>Total:</span>
          <span>$${Number(total).toLocaleString()}</span>
        </div>
        <div class="mt-2">
          <span class="badge bg-info">Método de pago: ${document.getElementById('metodoPago').options[document.getElementById('metodoPago').selectedIndex].text}</span>
        </div>
      </div>
    `;
  }

  async confirmarPedido() {
    try {
      const token = localStorage.getItem('token');
      const subtotal = this.carrito.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
      const iva = subtotal * 0.16;
      const envio = 99;
      const total = subtotal + iva + envio;

      const pedidoData = {
        id_usuario: this.clienteSeleccionado.id_usuario,
        id_estado: 1, // Pendiente
        total: total,
        metodo_pago: document.getElementById('metodoPago').value,
        detalles: this.carrito.map(item => ({
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario
        })),
        notas: document.getElementById('notasPedido').value
      };

      const response = await fetch('http://localhost:5000/pedido/admin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pedidoData)
      });

      if (!response.ok) throw new Error('Error al crear pedido');
      
      const resultado = await response.json();
      
      // Cerrar modal y redirigir
      bootstrap.Modal.getInstance(document.getElementById('modalConfirmacion')).hide();
      
      this.showSuccess(`Pedido #${resultado.insertId} creado correctamente`);
      
      setTimeout(() => {
        window.location.href = 'gestion-pedidos.html';
      }, 2000);
      
    } catch (error) {
      console.error('Error:', error);
      this.showError('Error al crear el pedido: ' + error.message);
    }
  }

  showError(message) {
    console.error(message);
    alert(message); // Temporal - reemplazar con notificaciones mejores
  }

  showSuccess(message) {
    console.log(message);
    alert(message); // Temporal - reemplazar con notificaciones mejores
  }
}

// Funciones globales para onclick
let crearPedido;

window.limpiarCarrito = () => crearPedido.limpiarCarrito();
window.confirmarPedido = () => crearPedido.confirmarPedido();

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Verificar autenticación y rol
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
  
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN') || roles.includes('VENDEDOR');
  if (!esAdmin) {
    alert('No tienes permisos para acceder a esta página');
    window.location.href = 'index.html';
    return;
  }

  // Inicializar el sistema
  crearPedido = new CrearPedido();
});
