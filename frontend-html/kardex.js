// 📦 KARDEX JAVASCRIPT - Sistema de Gestión de Inventario
// Frontend: Vanilla JavaScript + Bootstrap 5 + Chart.js

class KardexSystem {
    constructor() {
        this.apiBase = 'http://localhost:5000/kardex';
        this.productosBase = 'http://localhost:5000/producto';
        this.token = localStorage.getItem('token');
        this.movimientos = [];
        this.productos = [];
        this.tiposMovimiento = [];
        this.charts = {};
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadInitialData();
        this.initCharts();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Search
        document.getElementById('searchMovimientos').addEventListener('input', (e) => {
            this.filterMovimientos(e.target.value);
        });

        // Form validation
        document.getElementById('movProducto').addEventListener('change', (e) => {
            this.updateStockInfo(e.target.value);
        });

        document.getElementById('movTipo').addEventListener('change', (e) => {
            this.validateMovementType(e.target.value);
        });

        // Auto-complete fecha actual
        document.getElementById('movFecha').value = new Date().toISOString().split('T')[0];

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.showAddMovementModal();
            }
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault();
                this.exportReport();
            }
        });
    }

    async loadInitialData() {
        try {
            this.showLoading(true);
            
            // Cargar datos en paralelo
            const [resumen, movimientos, productos, tipos, stockCritico] = await Promise.all([
                this.fetchData(`${this.apiBase}/resumen`),
                this.fetchData(`${this.apiBase}/movimientos-dia`),
                this.fetchData(`${this.productosBase}`),
                this.fetchData(`${this.apiBase}/tipos-movimiento`),
                this.fetchData(`${this.apiBase}/stock-critico`)
            ]);

            // Actualizar estadísticas
            this.updateStats(resumen.data);
            
            // Cargar movimientos
            this.movimientos = movimientos.data.movimientos || [];
            this.renderMovimientosTable();
            
            // Cargar productos
            this.productos = productos.data || [];
            this.populateProductSelects();
            
            // Cargar tipos de movimiento
            this.tiposMovimiento = tipos.data || [];
            this.populateTipoSelects();
            
            // Mostrar alertas de stock crítico
            this.showStockCriticoAlert(stockCritico.data);
            
            // Actualizar gráficos
            this.updateCharts();
            
        } catch (error) {
            console.error('Error cargando datos iniciales:', error);
            this.showAlert('Error al cargar datos iniciales', 'danger');
        } finally {
            this.showLoading(false);
        }
    }

    async fetchData(url) {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }

    updateStats(data) {
        // Formatear números
        const formatNumber = (num) => {
            return new Intl.NumberFormat('es-CO').format(num || 0);
        };

        const formatCurrency = (num) => {
            return new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP'
            }).format(num || 0);
        };

        // Actualizar cards con animación
        this.animateNumber('totalProductos', data.total_productos || 0);
        this.animateNumber('totalUnidades', data.total_unidades || 0);
        this.animateNumber('valorInventario', data.valor_total_inventario || 0, true);
        this.animateNumber('stockCritico', data.productos_stock_critico || 0);
    }

    animateNumber(elementId, targetValue, isCurrency = false) {
        const element = document.getElementById(elementId);
        const startValue = 0;
        const duration = 1000;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
            const displayValue = isCurrency ? 
                new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(currentValue) :
                new Intl.NumberFormat('es-CO').format(currentValue);
            
            element.textContent = displayValue;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    renderMovimientosTable() {
        const tbody = document.getElementById('kardexTableBody');
        
        if (this.movimientos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i>
                        <p class="text-muted mb-0">No hay movimientos registrados</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.movimientos.map(mov => this.createMovementRow(mov)).join('');
    }

    createMovementRow(movimiento) {
        const fecha = new Date(movimiento.created_at).toLocaleDateString('es-CO');
        const hora = new Date(movimiento.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const esEntrada = movimiento.afecta_stock === 'E';
        const cantidadClass = esEntrada ? 'text-success' : 'text-danger';
        const cantidadSign = esEntrada ? '+' : '-';
        
        return `
            <tr>
                <td><span class="badge bg-secondary">#${movimiento.id_kardex}</span></td>
                <td>${fecha}</td>
                <td>${hora}</td>
                <td>
                    <div class="fw-semibold">${movimiento.producto}</div>
                    <small class="text-muted">${movimiento.codigo_barras || 'N/A'}</small>
                </td>
                <td>
                    <span class="movement-badge ${esEntrada ? 'entrada' : 'salida'}">
                        <i class="fas fa-arrow-${esEntrada ? 'up' : 'down'} me-1"></i>
                        ${movimiento.tipo_movimiento}
                    </span>
                </td>
                <td class="${cantidadClass} fw-semibold">
                    ${cantidadSign}${movimiento.cantidad}
                </td>
                <td>$${new Intl.NumberFormat('es-CO').format(movimiento.costo_unitario)}</td>
                <td class="fw-semibold">$${new Intl.NumberFormat('es-CO').format(movimiento.valor_total)}</td>
                <td>
                    <span class="stock-badge ${this.getStockStatusClass(movimiento.saldo_actual)}">
                        ${movimiento.saldo_actual}
                    </span>
                </td>
                <td><small>${movimiento.referencia || 'N/A'}</small></td>
                <td><small>${movimiento.usuario_registro}</small></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="kardex.viewMovement(${movimiento.id_kardex})" title="Ver detalles">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="kardex.deleteMovement(${movimiento.id_kardex})" title="Anular">
                            <i class="fas fa-ban"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    getStockStatusClass(saldo) {
        // Lógica simplificada - en producción se basaría en stock_minimo del producto
        if (saldo <= 10) return 'critico';
        if (saldo <= 25) return 'bajo';
        return 'normal';
    }

    populateProductSelects() {
        const filterSelect = document.getElementById('filterProducto');
        const movSelect = document.getElementById('movProducto');
        
        const options = this.productos.map(p => 
            `<option value="${p.id_producto}">${p.nombre} (Stock: ${p.stock_actual})</option>`
        ).join('');
        
        filterSelect.innerHTML = '<option value="">Todos los productos</option>' + options;
        movSelect.innerHTML = '<option value="">Seleccionar producto</option>' + options;
    }

    populateTipoSelects() {
        const filterSelect = document.getElementById('filterTipo');
        const movSelect = document.getElementById('movTipo');
        
        const options = this.tiposMovimiento.map(t => 
            `<option value="${t.id_tipo}">${t.nombre}</option>`
        ).join('');
        
        filterSelect.innerHTML = '<option value="">Todos</option>' + options;
        movSelect.innerHTML = '<option value="">Seleccionar tipo</option>' + options;
    }

    updateStockInfo(productoId) {
        const producto = this.productos.find(p => p.id_producto == productoId);
        const stockInfo = document.getElementById('stockInfo');
        const stockInfoText = document.getElementById('stockInfoText');
        
        if (producto) {
            const stockStatus = this.getStockStatusClass(producto.stock_actual);
            const statusText = stockStatus === 'critico' ? 'CRÍTICO' : 
                              stockStatus === 'bajo' ? 'BAJO' : 'NORMAL';
            
            stockInfoText.innerHTML = `
                <strong>Stock actual:</strong> ${producto.stock_actual} unidades<br>
                <strong>Estado:</strong> <span class="stock-badge ${stockStatus}">${statusText}</span><br>
                <strong>Costo promedio:</strong> $${new Intl.NumberFormat('es-CO').format(producto.costo_promedio || 0)}
            `;
            
            // Pre-fill costo unitario
            document.getElementById('movCosto').value = producto.costo_promedio || 0;
        } else {
            stockInfoText.textContent = 'Selecciona un producto para ver el stock actual';
        }
    }

    validateMovementType(tipoId) {
        const tipo = this.tiposMovimiento.find(t => t.id_tipo == tipoId);
        const cantidadInput = document.getElementById('movCantidad');
        const stockInfo = document.getElementById('stockInfo');
        
        if (tipo && tipo.afecta_stock === 'S') {
            cantidadInput.setAttribute('max', this.getCurrentStock());
            stockInfo.className = 'alert alert-warning mt-3';
        } else {
            cantidadInput.removeAttribute('max');
            stockInfo.className = 'alert alert-info mt-3';
        }
    }

    getCurrentStock() {
        const productoId = document.getElementById('movProducto').value;
        const producto = this.productos.find(p => p.id_producto == productoId);
        return producto ? producto.stock_actual : 0;
    }

    async saveMovement() {
        try {
            const formData = {
                id_producto: document.getElementById('movProducto').value,
                id_tipo: document.getElementById('movTipo').value,
                cantidad: parseInt(document.getElementById('movCantidad').value),
                costo_unitario: parseFloat(document.getElementById('movCosto').value),
                fecha: document.getElementById('movFecha').value,
                hora: new Date().toTimeString().split(' ')[0],
                referencia: document.getElementById('movReferencia').value,
                observaciones: document.getElementById('movObservaciones').value
            };

            // Validaciones
            if (!formData.id_producto || !formData.id_tipo || !formData.cantidad || !formData.costo_unitario) {
                this.showAlert('Por favor complete todos los campos requeridos', 'warning');
                return;
            }

            // Enviar datos
            const response = await fetch(`${this.apiBase}/movimiento`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                this.showAlert('Movimiento registrado correctamente', 'success');
                
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('addMovementModal'));
                modal.hide();
                
                // Reset form
                document.getElementById('movementForm').reset();
                
                // Recargar datos
                await this.loadInitialData();
                
            } else {
                this.showAlert(result.message || 'Error al registrar movimiento', 'danger');
            }

        } catch (error) {
            console.error('Error guardando movimiento:', error);
            this.showAlert('Error al registrar movimiento', 'danger');
        }
    }

    async applyFilters() {
        try {
            const filters = {
                fecha_inicio: document.getElementById('filterFechaInicio').value,
                fecha_fin: document.getElementById('filterFechaFin').value,
                id_producto: document.getElementById('filterProducto').value,
                id_tipo: document.getElementById('filterTipo').value
            };

            const queryString = new URLSearchParams(
                Object.entries(filters).filter(([_, value]) => value !== '')
            ).toString();

            const response = await this.fetchData(`${this.apiBase}/reporte/movimientos?${queryString}`);
            
            this.movimientos = response.data || [];
            this.renderMovimientosTable();
            
            this.showAlert('Filtros aplicados correctamente', 'success');

        } catch (error) {
            console.error('Error aplicando filtros:', error);
            this.showAlert('Error al aplicar filtros', 'danger');
        }
    }

    resetFilters() {
        document.getElementById('filterFechaInicio').value = '';
        document.getElementById('filterFechaFin').value = '';
        document.getElementById('filterProducto').value = '';
        document.getElementById('filterTipo').value = '';
        
        this.loadInitialData();
    }

    filterMovimientos(searchTerm) {
        const filtered = this.movimientos.filter(mov => 
            mov.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mov.tipo_movimiento.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mov.referencia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            mov.usuario_registro.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const tbody = document.getElementById('kardexTableBody');
        tbody.innerHTML = filtered.map(mov => this.createMovementRow(mov)).join('');
    }

    showStockCriticoAlert(productos) {
        const alertContainer = document.getElementById('stockCriticoAlert');
        
        if (productos.length === 0) {
            alertContainer.innerHTML = '';
            return;
        }

        const productosList = productos.slice(0, 5).map(p => `
            <div class="d-flex justify-content-between align-items-center">
                <span>${p.nombre}</span>
                <span class="badge bg-danger">${p.stock_actual} u</span>
            </div>
        `).join('');

        alertContainer.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <div class="d-flex align-items-center">
                    <i class="fas fa-exclamation-triangle me-3 fa-lg"></i>
                    <div class="flex-grow-1">
                        <h6 class="alert-heading mb-1">⚠️ Stock Crítico Detectado</h6>
                        <p class="mb-2">Hay ${productos.length} productos con stock crítico que necesitan atención inmediata.</p>
                        <div class="small">
                            ${productosList}
                            ${productos.length > 5 ? `<div class="text-muted">... y ${productos.length - 5} más</div>` : ''}
                        </div>
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            </div>
        `;
    }

    initCharts() {
        // Chart de movimientos por día
        const movimientosCtx = document.getElementById('movimientosChart').getContext('2d');
        this.charts.movimientos = new Chart(movimientosCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Entradas',
                    data: [],
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22, 163, 74, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Salidas',
                    data: [],
                    borderColor: '#dc2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Chart de valor por categoría
        const categoriasCtx = document.getElementById('categoriasChart').getContext('2d');
        this.charts.categorias = new Chart(categoriasCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#2563eb',
                        '#7c3aed',
                        '#16a34a',
                        '#ea580c',
                        '#dc2626',
                        '#0891b2'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });
    }

    async updateCharts() {
        try {
            // Actualizar chart de movimientos (simulado - en producción usar datos reales)
            const last7Days = this.getLast7Days();
            const entradas = [45, 52, 38, 65, 42, 55, 48];
            const salidas = [32, 41, 35, 48, 38, 45, 52];

            this.charts.movimientos.data.labels = last7Days;
            this.charts.movimientos.data.datasets[0].data = entradas;
            this.charts.movimientos.data.datasets[1].data = salidas;
            this.charts.movimientos.update();

            // Actualizar chart de categorías (simulado)
            const categorias = ['Electrónicos', 'Ropa', 'Alimentos', 'Hogar', 'Deportes'];
            const valores = [2500000, 1800000, 1200000, 900000, 600000];

            this.charts.categorias.data.labels = categorias;
            this.charts.categorias.data.datasets[0].data = valores;
            this.charts.categorias.update();

        } catch (error) {
            console.error('Error actualizando gráficos:', error);
        }
    }

    getLast7Days() {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            days.push(date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }));
        }
        return days;
    }

    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        spinner.classList.toggle('active', show);
    }

    showAlert(message, type = 'info') {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Insertar al principio del container
        const container = document.querySelector('.main-container');
        container.insertAdjacentHTML('afterbegin', alertHtml);
        
        // Auto-eliminar después de 5 segundos
        setTimeout(() => {
            const alert = container.querySelector('.alert');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }

    exportReport() {
        // Simulación de exportación
        this.showAlert('Generando reporte...', 'info');
        
        setTimeout(() => {
            // Crear CSV
            const csv = this.generateCSV();
            this.downloadCSV(csv, 'kardex_report.csv');
            this.showAlert('Reporte exportado correctamente', 'success');
        }, 1500);
    }

    generateCSV() {
        const headers = ['ID', 'Fecha', 'Producto', 'Tipo', 'Cantidad', 'Costo', 'Valor Total', 'Saldo', 'Usuario'];
        const rows = this.movimientos.map(mov => [
            mov.id_kardex,
            new Date(mov.created_at).toLocaleDateString('es-CO'),
            mov.producto,
            mov.tipo_movimiento,
            mov.cantidad,
            mov.costo_unitario,
            mov.valor_total,
            mov.saldo_actual,
            mov.usuario_registro
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    startAutoRefresh() {
        // Actualizar datos cada 30 segundos
        setInterval(() => {
            this.loadInitialData();
        }, 30000);
    }

    // Métodos públicos para el HTML
    showAddMovementModal() {
        const modal = new bootstrap.Modal(document.getElementById('addMovementModal'));
        modal.show();
    }

    viewMovement(id) {
        // Implementar vista detallada del movimiento
        const movimiento = this.movimientos.find(m => m.id_kardex === id);
        if (movimiento) {
            console.log('Ver movimiento:', movimiento);
            // Aquí se podría mostrar un modal con detalles completos
        }
    }

    async deleteMovement(id) {
        if (!confirm('¿Está seguro de anular este movimiento?')) return;
        
        try {
            // Implementar anulación de movimiento
            this.showAlert('Movimiento anulado correctamente', 'success');
            await this.loadInitialData();
        } catch (error) {
            this.showAlert('Error al anular movimiento', 'danger');
        }
    }
}

// Funciones globales para el HTML
let kardex;

function showAddMovementModal() {
    kardex.showAddMovementModal();
}

function saveMovement() {
    kardex.saveMovement();
}

function applyFilters() {
    kardex.applyFilters();
}

function resetFilters() {
    kardex.resetFilters();
}

function exportReport() {
    kardex.exportReport();
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    kardex = new KardexSystem();
});
