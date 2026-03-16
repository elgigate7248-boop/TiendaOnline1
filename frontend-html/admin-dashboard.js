async function cargarDashboard() {
  try {
    const [productosRes, usuariosRes, pedidosRes] = await Promise.all([
      fetchAuth('http://localhost:5000/producto'),
      fetchAuth('http://localhost:5000/usuario'),
      fetchAuth('http://localhost:5000/pedido')
    ]);

    const productos = await productosRes.json();
    const usuarios = await usuariosRes.json();
    const pedidos = await pedidosRes.json();

    document.getElementById('statProductos').textContent = Array.isArray(productos) ? productos.length : 0;
    document.getElementById('statUsuarios').textContent = Array.isArray(usuarios) ? usuarios.length : 0;
    document.getElementById('statPedidos').textContent = Array.isArray(pedidos) ? pedidos.length : 0;

    const totalVentas = Array.isArray(pedidos) ? pedidos.reduce((sum, p) => sum + (Number(p.total) || 0), 0) : 0;
    document.getElementById('statVentas').textContent = `$${totalVentas.toFixed(2)}`;

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
    const res = await fetchAuth('http://localhost:5000/pedido/reportes/resumen/csv?top=5', {
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
    const fileName = fileMatch ? fileMatch[1] : `reporte_tienda_${new Date().toISOString().slice(0, 10)}.csv`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Reporte CSV descargado correctamente', 'success');
  } catch {
    showToast('Error al descargar reporte CSV', 'error');
  }
};

async function cargarEstadisticas() {
  const cont = document.getElementById('estadisticas');
  if (!cont) return;
  cont.innerHTML = '<div class="text-muted py-4 text-center">Cargando estadísticas...</div>';
  try {
    const res = await fetchAuth('http://localhost:5000/pedido/reportes/resumen?top=5');
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
