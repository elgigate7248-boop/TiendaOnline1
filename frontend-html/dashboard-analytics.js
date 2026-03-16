// Dashboard Analytics JavaScript - Tienda Online

class DashboardAnalytics {
  constructor() {
    this.charts = {};
    this.data = {};
    this.init();
  }

  async init() {
    // Verificar autenticación
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    // Inicializar fecha actual
    this.setDefaultDates();
    
    // Cargar datos
    await this.loadAllData();
    
    // Configurar event listeners
    this.setupEventListeners();
    
    // Inicializar charts
    this.initializeCharts();
    
    // Configurar auto-refresh
    this.setupAutoRefresh();
  }

  setDefaultDates() {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    document.getElementById('startDate').value = lastMonth.toISOString().split('T')[0];
    document.getElementById('endDate').value = today.toISOString().split('T')[0];
  }

  async loadAllData() {
    this.showLoading(true);
    
    try {
      // Cargar datos principales
      const [overview, kpi, ventas, productos, usuarios] = await Promise.all([
        this.fetchData('/analytics/overview'),
        this.fetchData('/analytics/kpi'),
        this.fetchData('/analytics/ventas?periodo=30d'),
        this.fetchData('/analytics/productos'),
        this.fetchData('/analytics/usuarios')
      ]);

      this.data = { overview, kpi, ventas, productos, usuarios };
      
      // Actualizar UI
      this.updateKPIs();
      this.updateTables();
      this.updateCharts();
      
    } catch (error) {
      console.error('Error loading data:', error);
      this.showNotification('Error al cargar los datos del dashboard', 'danger');
    } finally {
      this.showLoading(false);
    }
  }

  async fetchData(endpoint) {
    const response = await fetch(`http://localhost:5000${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  updateKPIs() {
    const kpis = this.data.kpi.kpis;
    
    // Actualizar valores principales
    this.updateElement('pedidosHoy', kpis.pedidos_hoy);
    this.updateElement('ingresosHoy', this.formatCurrency(kpis.ingresos_hoy));
    this.updateElement('usuariosNuevosHoy', kpis.usuarios_nuevos_hoy);
    this.updateElement('productosBajoStock', kpis.productos_bajo_stock);
    this.updateElement('ticketPromedio', this.formatCurrency(kpis.ticket_promedio_mes));
    
    // Actualizar overview
    this.updateElement('totalUsuarios', this.data.overview.overview.total_usuarios);
    this.updateElement('totalProductos', this.data.overview.overview.total_productos);
    
    // Actualizar variaciones
    this.updateVariation('pedidosHoyChange', kpis.variacionPedidos);
    this.updateVariation('ingresosHoyChange', kpis.variacionIngresos);
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  updateVariation(id, value) {
    const element = document.getElementById(id);
    if (element) {
      const isPositive = value >= 0;
      const icon = isPositive ? 'fa-arrow-up' : 'fa-arrow-down';
      const color = isPositive ? 'positive' : 'negative';
      
      element.className = `kpi-change ${color}`;
      element.innerHTML = `<i class="fas ${icon}"></i> ${Math.abs(value)}%`;
    }
  }

  updateTables() {
    this.updateProductosTable();
    this.updateClientesTable();
    this.updateBajoStockTable();
  }

  updateProductosTable() {
    const tbody = document.getElementById('productosTable');
    if (!tbody) return;

    const productos = this.data.productos.topVentas.slice(0, 10);
    
    tbody.innerHTML = productos.map(producto => `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <img src="https://picsum.photos/seed/${producto.id_producto}/40/40.jpg" 
                 alt="${producto.nombre}" class="rounded me-3" style="width: 40px; height: 40px; object-fit: cover;">
            <div>
              <div class="fw-semibold">${producto.nombre}</div>
              <small class="text-muted">ID: ${producto.id_producto}</small>
            </div>
          </div>
        </td>
        <td><span class="badge badge-analytics bg-info">Electrónica</span></td>
        <td>${this.formatCurrency(producto.precio)}</td>
        <td>
          <span class="badge ${producto.stock <= 10 ? 'bg-danger' : 'bg-success'}">
            ${producto.stock} unidades
          </span>
        </td>
        <td><strong>${producto.total_vendido}</strong></td>
        <td>${this.formatCurrency(producto.ingresos_totales)}</td>
        <td>
          <span class="badge ${producto.stock <= 10 ? 'bg-danger' : 'bg-success'}">
            ${producto.stock <= 10 ? 'Bajo Stock' : 'Disponible'}
          </span>
        </td>
      </tr>
    `).join('');
  }

  updateClientesTable() {
    const tbody = document.getElementById('clientesTable');
    if (!tbody) return;

    const clientes = this.data.usuarios.topClientes.slice(0, 10);
    
    tbody.innerHTML = clientes.map(cliente => {
      const nivel = this.getNivelCliente(cliente.total_pedidos);
      return `
        <tr>
          <td>
            <div class="d-flex align-items-center">
              <img src="https://picsum.photos/seed/${cliente.email}/40/40.jpg" 
                   alt="${cliente.nombre}" class="rounded-circle me-3" style="width: 40px; height: 40px; object-fit: cover;">
              <div class="fw-semibold">${cliente.nombre}</div>
            </div>
          </td>
          <td>${cliente.email}</td>
          <td><strong>${cliente.total_pedidos}</strong></td>
          <td>${this.formatCurrency(cliente.total_gastado)}</td>
          <td>${this.formatCurrency(cliente.ticket_promedio)}</td>
          <td>${this.formatDate(cliente.ultima_compra)}</td>
          <td><span class="badge ${nivel.class}">${nivel.label}</span></td>
        </tr>
      `;
    }).join('');
  }

  updateBajoStockTable() {
    const tbody = document.getElementById('bajoStockTable');
    if (!tbody) return;

    const productos = this.data.overview.productosBajoStock;
    
    if (productos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            <i class="fas fa-check-circle fa-2x mb-2"></i>
            <div>No hay productos con bajo stock</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = productos.map(producto => `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <img src="https://picsum.photos/seed/${producto.nombre}/40/40.jpg" 
                 alt="${producto.nombre}" class="rounded me-3" style="width: 40px; height: 40px; object-fit: cover;">
            <div class="fw-semibold">${producto.nombre}</div>
          </div>
        </td>
        <td><span class="badge bg-info">${producto.categoria}</span></td>
        <td>
          <span class="badge bg-danger">
            <i class="fas fa-exclamation-triangle me-1"></i>
            ${producto.stock} unidades
          </span>
        </td>
        <td><span class="badge bg-warning">Crítico</span></td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="reabastecerProducto('${producto.nombre}')">
            <i class="fas fa-plus me-1"></i>Reabastecer
          </button>
        </td>
      </tr>
    `).join('');
  }

  getNivelCliente(pedidos) {
    if (pedidos >= 10) return { label: 'VIP', class: 'bg-warning' };
    if (pedidos >= 4) return { label: 'Frecuente', class: 'bg-info' };
    if (pedidos >= 1) return { label: 'Ocasional', class: 'bg-primary' };
    return { label: 'Nuevo', class: 'bg-secondary' };
  }

  initializeCharts() {
    this.createVentasChart();
    this.createMetodosPagoChart();
    this.createIngresosDiariosChart();
    this.createProductosTopChart();
    this.createCategoriasChart();
    this.createUsuariosChart();
    this.createActividadChart();
  }

  createVentasChart() {
    const ctx = document.getElementById('ventasChart');
    if (!ctx) return;

    const data = this.data.overview.ventasMensuales;
    
    this.charts.ventas = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => this.formatMonth(d.mes)),
        datasets: [{
          label: 'Ingresos',
          data: data.map(d => d.total_ventas),
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4
        }, {
          label: 'Pedidos',
          data: data.map(d => d.cantidad_pedidos * 100), // Escalar para visualización
          borderColor: '#28a745',
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          yAxisID: 'y1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            ticks: {
              callback: (value) => this.formatCurrency(value)
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
  }

  createMetodosPagoChart() {
    const ctx = document.getElementById('metodosPagoChart');
    if (!ctx) return;

    const data = this.data.overview.ingresosPorMetodo;
    
    this.charts.metodosPago = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.metodo),
        datasets: [{
          data: data.map(d => d.total_ingresos),
          backgroundColor: [
            '#667eea',
            '#28a745',
            '#ffc107',
            '#dc3545',
            '#17a2b8'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  createIngresosDiariosChart() {
    const ctx = document.getElementById('ingresosDiariosChart');
    if (!ctx) return;

    const data = this.data.overview.tendenciaSemanal;
    
    this.charts.ingresosDiarios = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => this.formatDate(d.fecha)),
        datasets: [{
          label: 'Ingresos Diarios',
          data: data.map(d => d.ingresos_diarios),
          backgroundColor: '#667eea',
          borderColor: '#667eea',
          borderWidth: 0,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => this.formatCurrency(value)
            }
          }
        }
      }
    });
  }

  createProductosTopChart() {
    const ctx = document.getElementById('productosTopChart');
    if (!ctx) return;

    const data = this.data.productos.topVentas.slice(0, 10);
    
    this.charts.productosTop = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.nombre.substring(0, 20) + '...'),
        datasets: [{
          label: 'Unidades Vendidas',
          data: data.map(d => d.total_vendido),
          backgroundColor: '#28a745',
          borderColor: '#28a745',
          borderWidth: 0,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  createCategoriasChart() {
    const ctx = document.getElementById('categoriasChart');
    if (!ctx) return;

    const data = this.data.overview.categoriasTop.slice(0, 6);
    
    this.charts.categorias = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: data.map(d => d.nombre),
        datasets: [{
          data: data.map(d => d.total_ventas),
          backgroundColor: [
            'rgba(102, 126, 234, 0.8)',
            'rgba(40, 167, 69, 0.8)',
            'rgba(255, 193, 7, 0.8)',
            'rgba(220, 53, 69, 0.8)',
            'rgba(23, 162, 184, 0.8)',
            'rgba(108, 117, 125, 0.8)'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  createUsuariosChart() {
    const ctx = document.getElementById('usuariosChart');
    if (!ctx) return;

    const data = this.data.usuarios.nuevosUsuarios;
    
    this.charts.usuarios = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => this.formatMonth(d.mes)),
        datasets: [{
          label: 'Nuevos Usuarios',
          data: data.map(d => d.nuevos_usuarios),
          borderColor: '#ffc107',
          backgroundColor: 'rgba(255, 193, 7, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  createActividadChart() {
    const ctx = document.getElementById('actividadChart');
    if (!ctx) return;

    const data = this.data.usuarios.usuariosPorActividad;
    
    this.charts.actividad = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: data.map(d => d.nivel_actividad),
        datasets: [{
          data: data.map(d => d.cantidad_usuarios),
          backgroundColor: [
            '#dc3545',
            '#ffc107',
            '#17a2b8',
            '#28a745'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  updateCharts() {
    // Los charts ya se inicializaron con los datos cargados
    // Este método puede usarse para actualizaciones futuras
  }

  setupEventListeners() {
    // Date filters
    document.getElementById('startDate').addEventListener('change', () => {
      this.loadAllData();
    });

    document.getElementById('endDate').addEventListener('change', () => {
      this.loadAllData();
    });

    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active class from all items
        document.querySelectorAll('.sidebar-item').forEach(i => {
          i.classList.remove('active');
        });
        
        // Add active class to clicked item
        item.classList.add('active');
        
        // Scroll to section
        const targetId = item.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Scroll spy for sidebar
    window.addEventListener('scroll', () => {
      this.updateActiveNavItem();
    });
  }

  updateActiveNavItem() {
    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
      const sectionHeight = section.offsetHeight;
      const sectionTop = section.offsetTop - 100;
      const sectionId = section.getAttribute('id');

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        document.querySelectorAll('.sidebar-item').forEach(item => {
          item.classList.remove('active');
          if (item.getAttribute('href') === `#${sectionId}`) {
            item.classList.add('active');
          }
        });
      }
    });
  }

  setupAutoRefresh() {
    // Auto-refresh cada 5 minutos
    setInterval(() => {
      this.loadAllData();
    }, 5 * 60 * 1000);
  }

  showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
  }

  showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      console.log(`${type}: ${message}`);
    }
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value);
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short'
    });
  }

  formatMonth(monthString) {
    const [year, month] = monthString.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('es-ES', {
      month: 'short',
      year: '2-digit'
    });
  }
}

// Global functions
window.refreshData = async function() {
  if (window.dashboardAnalytics) {
    await window.dashboardAnalytics.loadAllData();
    window.dashboardAnalytics.showNotification('Datos actualizados', 'success');
  }
};

window.reabastecerProducto = function(productName) {
  if (window.dashboardAnalytics) {
    window.dashboardAnalytics.showNotification(`Solicitud de reabastecimiento para ${productName}`, 'info');
  }
};

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.dashboardAnalytics = new DashboardAnalytics();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DashboardAnalytics;
}
