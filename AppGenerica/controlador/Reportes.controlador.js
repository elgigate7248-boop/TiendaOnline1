const reportesSvc = require('../servicios/Reportes.servicios');

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

function getIdVendedor(req) {
  return req.usuario?.id_usuario || req.usuario?.id;
}

function getFiltros(query) {
  return {
    fecha_inicio: query.fecha_inicio || undefined,
    fecha_fin: query.fecha_fin || undefined,
    agrupacion: query.agrupacion || undefined,
    ordenar_por: query.ordenar_por || undefined,
    limit: query.limit || query.top || undefined
  };
}

// ═══════════════════════════════════════════════════════════════════════
// VENDEDOR
// ═══════════════════════════════════════════════════════════════════════

exports.vendedorTopProductos = async (req, res) => {
  try {
    const idVendedor = getIdVendedor(req);
    if (!idVendedor) return res.status(401).json({ error: 'Vendedor no autenticado' });

    const data = await reportesSvc.vendedorTopProductos(idVendedor, getFiltros(req.query));
    res.json({ reporte: 'top_productos_vendidos', data });
  } catch (err) {
    console.error('❌ Reporte vendedor top-productos:', err.message);
    res.status(500).json({ error: 'Error al generar reporte de top productos' });
  }
};

exports.vendedorProductosRentables = async (req, res) => {
  try {
    const idVendedor = getIdVendedor(req);
    if (!idVendedor) return res.status(401).json({ error: 'Vendedor no autenticado' });

    const data = await reportesSvc.vendedorProductosRentables(idVendedor, getFiltros(req.query));
    res.json({ reporte: 'productos_mas_rentables', data });
  } catch (err) {
    console.error('❌ Reporte vendedor productos-rentables:', err.message);
    res.status(500).json({ error: 'Error al generar reporte de productos rentables' });
  }
};

exports.vendedorHistorialGanancias = async (req, res) => {
  try {
    const idVendedor = getIdVendedor(req);
    if (!idVendedor) return res.status(401).json({ error: 'Vendedor no autenticado' });

    const filtros = getFiltros(req.query);
    if (!filtros.agrupacion) filtros.agrupacion = 'dia';

    const data = await reportesSvc.vendedorHistorialGanancias(idVendedor, filtros);
    res.json({ reporte: 'historial_ganancias', agrupacion: filtros.agrupacion, data });
  } catch (err) {
    console.error('❌ Reporte vendedor historial-ganancias:', err.message);
    res.status(500).json({ error: 'Error al generar historial de ganancias' });
  }
};

exports.vendedorResumenFinanciero = async (req, res) => {
  try {
    const idVendedor = getIdVendedor(req);
    if (!idVendedor) return res.status(401).json({ error: 'Vendedor no autenticado' });

    const data = await reportesSvc.vendedorResumenFinanciero(idVendedor, getFiltros(req.query));
    res.json({ reporte: 'resumen_financiero', data });
  } catch (err) {
    console.error('❌ Reporte vendedor resumen-financiero:', err.message);
    res.status(500).json({ error: 'Error al generar resumen financiero' });
  }
};

exports.vendedorAnalisisInventario = async (req, res) => {
  try {
    const idVendedor = getIdVendedor(req);
    if (!idVendedor) return res.status(401).json({ error: 'Vendedor no autenticado' });

    const data = await reportesSvc.vendedorAnalisisInventario(idVendedor, getFiltros(req.query));
    res.json({ reporte: 'analisis_inventario', data });
  } catch (err) {
    console.error('❌ Reporte vendedor analisis-inventario:', err.message);
    res.status(500).json({ error: 'Error al generar análisis de inventario' });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════

exports.adminTopVendedores = async (req, res) => {
  try {
    const data = await reportesSvc.adminTopVendedores(getFiltros(req.query));
    res.json({ reporte: 'top_vendedores', data });
  } catch (err) {
    console.error('❌ Reporte admin top-vendedores:', err.message);
    res.status(500).json({ error: 'Error al generar reporte de top vendedores' });
  }
};

exports.adminTopProductosGlobal = async (req, res) => {
  try {
    const data = await reportesSvc.adminTopProductosGlobal(getFiltros(req.query));
    res.json({ reporte: 'top_productos_global', data });
  } catch (err) {
    console.error('❌ Reporte admin top-productos:', err.message);
    res.status(500).json({ error: 'Error al generar reporte de productos globales' });
  }
};

exports.adminIngresosPlataforma = async (req, res) => {
  try {
    const filtros = getFiltros(req.query);
    if (!filtros.agrupacion) filtros.agrupacion = 'mes';

    const data = await reportesSvc.adminIngresosPlataforma(filtros);
    res.json({ reporte: 'ingresos_plataforma', agrupacion: filtros.agrupacion, data });
  } catch (err) {
    console.error('❌ Reporte admin ingresos-plataforma:', err.message);
    res.status(500).json({ error: 'Error al generar reporte de ingresos de plataforma' });
  }
};

exports.adminEstadisticas = async (req, res) => {
  try {
    const data = await reportesSvc.adminEstadisticas(getFiltros(req.query));
    res.json({ reporte: 'estadisticas_generales', data });
  } catch (err) {
    console.error('❌ Reporte admin estadísticas:', err.message);
    res.status(500).json({ error: 'Error al generar estadísticas generales' });
  }
};
