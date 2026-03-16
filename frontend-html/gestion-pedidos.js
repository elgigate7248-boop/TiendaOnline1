// Sistema de Gestión de Pedidos - Panel Administrativo
class GestionPedidos {
  constructor() {
    this.pedidos = [];
    this.filtros = {
      busqueda: '',
      estado: '',
      fechaDesde: '',
      fechaHasta: ''
    };
    this.ordenamiento = 'fecha_desc';
    this.init();
  }

  async init() {
    await this.cargarPedidos();
    await this.cargarEstadisticas();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Búsqueda en tiempo real
    document.getElementById('busquedaPedido').addEventListener('input', (e) => {
      this.filtros.busqueda = e.target.value;
      this.aplicarFiltros();
    });

    // Filtros
    document.getElementById('filtroEstado').addEventListener('change', (e) => {
      this.filtros.estado = e.target.value;
      this.aplicarFiltros();
    });

    document.getElementById('fechaDesde').addEventListener('change', (e) => {
      this.filtros.fechaDesde = e.target.value;
      this.aplicarFiltros();
    });

    document.getElementById('fechaHasta').addEventListener('change', (e) => {
      this.filtros.fechaHasta = e.target.value;
      this.aplicarFiltros();
    });

    // Ordenamiento
    document.getElementById('ordenamiento').addEventListener('change', (e) => {
      this.ordenamiento = e.target.value;
      this.renderPedidos();
    });
  }

  async cargarPedidos() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        this.showError('No autorizado');
        return;
      }

      const response = await fetch('http://localhost:5000/pedido', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Error al cargar pedidos');
      
      this.pedidos = await response.json();
      this.renderPedidos();
      this.updateCount();
    } catch (error) {
      console.error('Error:', error);
      this.showError('Error al cargar los pedidos');
    }
  }

  async cargarEstadisticas() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/pedido/reportes/resumen', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Error al cargar estadísticas');
      
      const stats = await response.json();
      this.renderEstadisticas(stats);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  renderEstadisticas(stats) {
    const totales = stats.totales || {};
    
    document.getElementById('totalPedidos').textContent = totales.total_pedidos || 0;
    document.getElementById('ventasTotales').textContent = `$${Number(totales.ventas_totales || 0).toLocaleString()}`;
    document.getElementById('pedidosPendientes').textContent = this.pedidos.filter(p => p.id_estado === 1).length;
    document.getElementById('ticketPromedio').textContent = `$${Number(totales.ticket_promedio || 0).toLocaleString()}`;
  }

  aplicarFiltros() {
    let filtrados = [...this.pedidos];

    // Búsqueda
    if (this.filtros.busqueda) {
      const busqueda = this.filtros.busqueda.toLowerCase();
      filtrados = filtrados.filter(p => 
        p.id_pedido.toString().includes(busqueda) ||
        p.usuario?.toLowerCase().includes(busqueda) ||
        p.total.toString().includes(busqueda)
      );
    }

    // Estado
    if (this.filtros.estado) {
      filtrados = filtrados.filter(p => p.id_estado == this.filtros.estado);
    }

    // Fechas
    if (this.filtros.fechaDesde) {
      const desde = new Date(this.filtros.fechaDesde);
      filtrados = filtrados.filter(p => new Date(p.fecha_pedido) >= desde);
    }

    if (this.filtros.fechaHasta) {
      const hasta = new Date(this.filtros.fechaHasta);
      hasta.setHours(23, 59, 59, 999);
      filtrados = filtrados.filter(p => new Date(p.fecha_pedido) <= hasta);
    }

    this.renderPedidos(filtrados);
  }

  renderPedidos(pedidos = this.pedidos) {
    const container = document.getElementById('listaPedidos');
    
    if (!pedidos.length) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
          <h5>No se encontraron pedidos</h5>
          <p class="text-muted">Intenta ajustar los filtros de búsqueda</p>
        </div>
      `;
      return;
    }

    // Ordenamiento
    pedidos = this.ordenarPedidos(pedidos);

    const html = pedidos.map(pedido => this.renderPedidoCard(pedido)).join('');
    container.innerHTML = html;
  }

  ordenarPedidos(pedidos) {
    const sorted = [...pedidos];
    
    switch(this.ordenamiento) {
      case 'fecha_desc':
        return sorted.sort((a, b) => new Date(b.fecha_pedido) - new Date(a.fecha_pedido));
      case 'fecha_asc':
        return sorted.sort((a, b) => new Date(a.fecha_pedido) - new Date(b.fecha_pedido));
      case 'total_desc':
        return sorted.sort((a, b) => b.total - a.total);
      case 'total_asc':
        return sorted.sort((a, b) => a.total - b.total);
      default:
        return sorted;
    }
  }

  renderPedidoCard(pedido) {
    const estados = {
      1: { text: 'Pendiente', class: 'warning', icon: 'clock' },
      2: { text: 'Pagado', class: 'info', icon: 'credit-card' },
      3: { text: 'Enviado', class: 'primary', icon: 'truck' },
      4: { text: 'Entregado', class: 'success', icon: 'check-circle' },
      5: { text: 'Cancelado', class: 'danger', icon: 'times-circle' }
    };

    const estado = estados[pedido.id_estado] || { text: 'Desconocido', class: 'secondary', icon: 'question' };
    const fecha = new Date(pedido.fecha_pedido).toLocaleDateString('es-ES');
    
    return `
      <div class="card pedido-card mb-3">
        <div class="card-body">
          <div class="row align-items-center">
            <div class="col-md-3">
              <h6 class="mb-1 fw-bold">#${pedido.id_pedido}</h6>
              <small class="text-muted">${fecha}</small>
            </div>
            <div class="col-md-3">
              <div class="fw-semibold">${pedido.usuario || 'Cliente'}</div>
              <small class="text-muted">ID: ${pedido.id_usuario}</small>
            </div>
            <div class="col-md-2">
              <div class="fw-bold fs-5">$${Number(pedido.total).toLocaleString()}</div>
            </div>
            <div class="col-md-2">
              <span class="estado-badge bg-${estado.class} text-white">
                <i class="fas fa-${estado.icon} me-1"></i>
                ${estado.text}
              </span>
            </div>
            <div class="col-md-2 text-end">
              <div class="action-buttons">
                <button class="btn btn-sm btn-outline-primary" onclick="gestionPedidos.verDetalle(${pedido.id_pedido})" title="Ver detalle">
                  <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="gestionPedidos.cambiarEstado(${pedido.id_pedido}, ${pedido.id_estado})" title="Cambiar estado">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="gestionPedidos.imprimirPedido(${pedido.id_pedido})" title="Imprimir">
                  <i class="fas fa-print"></i>
                </button>
                ${pedido.id_estado !== 4 && pedido.id_estado !== 5 ? 
                  `<button class="btn btn-sm btn-outline-danger" onclick="gestionPedidos.cancelarPedido(${pedido.id_pedido})" title="Cancelar">
                    <i class="fas fa-times"></i>
                  </button>` : ''
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async verDetalle(idPedido) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/pedido/${idPedido}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Error al cargar detalle');
      
      const pedido = await response.json();
      this.renderModalDetalle(pedido);
      
      const modal = new bootstrap.Modal(document.getElementById('modalDetallePedido'));
      modal.show();
    } catch (error) {
      console.error('Error:', error);
      this.showError('Error al cargar el detalle del pedido');
    }
  }

  renderModalDetalle(pedido) {
    const contenido = document.getElementById('contenidoModalDetalle');
    
    // Obtener detalles del pedido (simulado - debería venir del backend)
    const detalles = pedido.detalles || [];
    
    contenido.innerHTML = `
      <div class="row mb-3">
        <div class="col-md-6">
          <h6 class="text-muted">Información General</h6>
          <p><strong>Pedido:</strong> #${pedido.id_pedido}</p>
          <p><strong>Cliente:</strong> ${pedido.usuario}</p>
          <p><strong>Fecha:</strong> ${new Date(pedido.fecha_pedido).toLocaleDateString('es-ES')}</p>
          <p><strong>Total:</strong> $${Number(pedido.total).toLocaleString()}</p>
        </div>
        <div class="col-md-6">
          <h6 class="text-muted">Estado Actual</h6>
          <div class="mb-3">
            <span class="badge bg-${this.getEstadoClass(pedido.id_estado)} text-white fs-6">
              ${this.getEstadoText(pedido.id_estado)}
            </span>
          </div>
          <div class="timeline">
            <div class="timeline-item">
              <div class="fw-semibold">Pedido creado</div>
              <small class="text-muted">${new Date(pedido.fecha_pedido).toLocaleString('es-ES')}</small>
            </div>
            ${this.renderTimeline(pedido.id_estado)}
          </div>
        </div>
      </div>
      
      <h6 class="text-muted mb-3">Productos del Pedido</h6>
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Producto</th>
              <th class="text-center">Cantidad</th>
              <th class="text-end">Precio Unit.</th>
              <th class="text-end">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${detalles.map(d => `
              <tr>
                <td>${d.nombre_producto || `Producto #${d.id_producto}`}</td>
                <td class="text-center">${d.cantidad}</td>
                <td class="text-end">$${Number(d.precio_unitario).toLocaleString()}</td>
                <td class="text-end fw-semibold">$${Number(d.cantidad * d.precio_unitario).toLocaleString()}</td>
              </tr>
            `).join('') || '<tr><td colspan="4" class="text-center text-muted">No hay detalles disponibles</td></tr>'}
          </tbody>
          <tfoot>
            <tr class="table-active">
              <th colspan="3">Total</th>
              <th class="text-end fw-bold">$${Number(pedido.total).toLocaleString()}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  renderTimeline(estado) {
    const timeline = {
      2: '<div class="timeline-item"><div class="fw-semibold">Pago confirmado</div><small class="text-muted">Procesando...</small></div>',
      3: '<div class="timeline-item"><div class="fw-semibold">Enviado</div><small class="text-muted">En camino...</small></div>',
      4: '<div class="timeline-item"><div class="fw-semibold">Entregado</div><small class="text-muted">Completado</small></div>',
      5: '<div class="timeline-item"><div class="fw-semibold text-danger">Cancelado</div><small class="text-muted">Pedido anulado</small></div>'
    };
    
    return timeline[estado] || '';
  }

  cambiarEstado(idPedido, estadoActual) {
    document.getElementById('pedidoIdEstado').textContent = idPedido;
    document.getElementById('nuevoEstado').value = estadoActual;
    document.getElementById('notasEstado').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('modalCambiarEstado'));
    modal.show();
  }

  async guardarCambioEstado() {
    try {
      const idPedido = document.getElementById('pedidoIdEstado').textContent;
      const nuevoEstado = document.getElementById('nuevoEstado').value;
      const notas = document.getElementById('notasEstado').value;
      
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/pedido/${idPedido}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id_estado: nuevoEstado,
          notas: notas
        })
      });

      if (!response.ok) throw new Error('Error al actualizar estado');
      
      // Cerrar modal y recargar
      bootstrap.Modal.getInstance(document.getElementById('modalCambiarEstado')).hide();
      await this.cargarPedidos();
      await this.cargarEstadisticas();
      
      this.showSuccess('Estado actualizado correctamente');
    } catch (error) {
      console.error('Error:', error);
      this.showError('Error al actualizar el estado');
    }
  }

  async cancelarPedido(idPedido) {
    if (!confirm('¿Estás seguro de cancelar este pedido? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/pedido/${idPedido}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id_estado: 5 // Cancelado
        })
      });

      if (!response.ok) throw new Error('Error al cancelar pedido');
      
      await this.cargarPedidos();
      await this.cargarEstadisticas();
      
      this.showSuccess('Pedido cancelado correctamente');
    } catch (error) {
      console.error('Error:', error);
      this.showError('Error al cancelar el pedido');
    }
  }

  async exportarPedidos() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/pedido/reportes/resumen/csv', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Error al exportar');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      this.showSuccess('Pedidos exportados correctamente');
    } catch (error) {
      console.error('Error:', error);
      this.showError('Error al exportar los pedidos');
    }
  }

  imprimirPedido(idPedido) {
    window.print();
  }

  crearPedidoManual() {
    // Redirigir a formulario de creación de pedidos
    window.location.href = 'crear-pedido.html';
  }

  updateCount() {
    document.getElementById('countPedidos').textContent = this.pedidos.length;
  }

  getEstadoClass(estado) {
    const classes = {
      1: 'warning',
      2: 'info', 
      3: 'primary',
      4: 'success',
      5: 'danger'
    };
    return classes[estado] || 'secondary';
  }

  getEstadoText(estado) {
    const texts = {
      1: 'Pendiente',
      2: 'Pagado',
      3: 'Enviado', 
      4: 'Entregado',
      5: 'Cancelado'
    };
    return texts[estado] || 'Desconocido';
  }

  showError(message) {
    // Implementar notificación de error
    console.error(message);
    alert(message); // Temporal - reemplazar con notificaciones mejores
  }

  showSuccess(message) {
    // Implementar notificación de éxito
    console.log(message);
    alert(message); // Temporal - reemplazar con notificaciones mejores
  }
}

// Funciones globales para onclick
let gestionPedidos;

window.aplicarFiltros = () => gestionPedidos.aplicarFiltros();
window.exportarPedidos = () => gestionPedidos.exportarPedidos();
window.crearPedidoManual = () => gestionPedidos.crearPedidoManual();
window.imprimirPedido = () => gestionPedidos.imprimirPedido();

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
  gestionPedidos = new GestionPedidos();
});
