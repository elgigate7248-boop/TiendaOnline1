const db = require('../db');

// ═══════════════════════════════════════════════════════════════════════
// TIMEZONE & HELPERS
// ═══════════════════════════════════════════════════════════════════════

// Timezone de la aplicación (Colombia UTC-5). Se usa en CONVERT_TZ.
const APP_TZ = process.env.APP_TIMEZONE || '-05:00';
const DB_TZ  = process.env.DB_TIMEZONE  || '+00:00';

/**
 * Normaliza fechas del frontend a UTC para comparación consistente.
 * El frontend envía '2026-04-01' (fecha local Colombia).
 * Convertimos a rango UTC para que WHERE funcione sin importar la TZ del server MySQL.
 */
function normalizarRangoFechas(fecha_inicio, fecha_fin) {
  const resultado = { whereExtra: '', params: [] };

  if (fecha_inicio) {
    resultado.whereExtra += ' AND m.fecha >= CONVERT_TZ(?, ?, ?)';
    resultado.params.push(fecha_inicio + ' 00:00:00', APP_TZ, DB_TZ);
  }
  if (fecha_fin) {
    resultado.whereExtra += ' AND m.fecha <= CONVERT_TZ(?, ?, ?)';
    resultado.params.push(fecha_fin + ' 23:59:59', APP_TZ, DB_TZ);
  }

  return resultado;
}

/**
 * Genera un objeto de advertencia cuando no hay movimientos SALIDA.
 * Esto evita que el vendedor/admin crea que "todo está en cero"
 * cuando en realidad puede haber un bug o pedidos sin confirmar.
 */
function generarAdvertencia(rows) {
  if (!rows || (Array.isArray(rows) && rows.length === 0)) {
    return {
      advertencia: 'No se encontraron movimientos de venta (SALIDA) en el rango seleccionado. '
        + 'Esto puede significar que no hay ventas confirmadas o que los movimientos '
        + 'de inventario no se registraron correctamente al confirmar pedidos.'
    };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// REPORTES VENDEDOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * Top productos de un vendedor.
 * Fuente: movimiento_inventario SALIDA (datos reales post-confirmación).
 * Soporta ordenar_por: cantidad (default) | ingresos | margen.
 * Valor:
 *   - cantidad  → qué producto mover más
 *   - ingresos  → qué producto genera más dinero (puede vender poco pero caro)
 *   - margen    → qué producto deja mayor ganancia neta por peso invertido
 */
async function vendedorTopProductos(idVendedor, filtros = {}) {
  const { fecha_inicio, fecha_fin, limit: lim, ordenar_por } = filtros;
  const topN = Math.max(1, Math.min(Number(lim) || 10, 50));

  const rango = normalizarRangoFechas(fecha_inicio, fecha_fin);
  const params = [idVendedor, ...rango.params];

  let orderCol;
  switch (ordenar_por) {
    case 'ingresos': orderCol = 'ingresos_brutos'; break;
    case 'margen':   orderCol = 'margen_pct'; break;
    default:         orderCol = 'unidades_vendidas';
  }

  const [rows] = await db.query(`
    SELECT
      m.id_producto,
      p.nombre,
      p.imagen,
      SUM(m.cantidad)                                  AS unidades_vendidas,
      COUNT(DISTINCT m.id_pedido)                       AS pedidos_distintos,
      ROUND(SUM(m.precio_venta_unit * m.cantidad), 2)   AS ingresos_brutos,
      ROUND(SUM(m.ganancia_neta), 2)                    AS ganancia_neta,
      ROUND(
        CASE WHEN SUM(m.costo_unitario * m.cantidad) > 0
          THEN (SUM(m.ganancia_neta) / SUM(m.costo_unitario * m.cantidad)) * 100
          ELSE 0
        END, 2)                                         AS margen_pct
    FROM movimiento_inventario m
    JOIN producto p ON m.id_producto = p.id_producto
    WHERE m.id_vendedor = ?
      AND m.tipo_movimiento = 'SALIDA'
      ${rango.whereExtra}
    GROUP BY m.id_producto, p.nombre, p.imagen
    ORDER BY ${orderCol} DESC
    LIMIT ?
  `, [...params, topN]);

  const warn = generarAdvertencia(rows);
  return warn ? { ...warn, data: rows } : rows;
}

/**
 * Productos más rentables de un vendedor.
 * Ordena por ganancia neta total (precio_venta - costo_FIFO - comisión).
 * Valor: Decidir qué productos generan mayor margen real, no solo volumen.
 */
async function vendedorProductosRentables(idVendedor, filtros = {}) {
  const { fecha_inicio, fecha_fin, limit: lim } = filtros;
  const topN = Math.max(1, Math.min(Number(lim) || 10, 50));

  const rango = normalizarRangoFechas(fecha_inicio, fecha_fin);
  const params = [idVendedor, ...rango.params];

  const [rows] = await db.query(`
    SELECT
      m.id_producto,
      p.nombre,
      p.imagen,
      SUM(m.cantidad)                                  AS unidades_vendidas,
      ROUND(SUM(m.precio_venta_unit * m.cantidad), 2)  AS ingresos_brutos,
      ROUND(SUM(m.costo_unitario * m.cantidad), 2)     AS costo_total,
      ROUND(SUM(m.ganancia_bruta), 2)                  AS ganancia_bruta,
      ROUND(SUM(m.comision_plataforma), 2)             AS comision_total,
      ROUND(SUM(m.ganancia_neta), 2)                   AS ganancia_neta,
      ROUND(
        CASE WHEN SUM(m.costo_unitario * m.cantidad) > 0
          THEN (SUM(m.ganancia_neta) / SUM(m.costo_unitario * m.cantidad)) * 100
          ELSE 0
        END, 2)                                        AS margen_pct
    FROM movimiento_inventario m
    JOIN producto p ON m.id_producto = p.id_producto
    WHERE m.id_vendedor = ?
      AND m.tipo_movimiento = 'SALIDA'
      ${rango.whereExtra}
    GROUP BY m.id_producto, p.nombre, p.imagen
    ORDER BY ganancia_neta DESC
    LIMIT ?
  `, [...params, topN]);

  const warn = generarAdvertencia(rows);
  return warn ? { ...warn, data: rows } : rows;
}

/**
 * Historial de ganancias de un vendedor agrupado por período.
 * Agrupación: dia | semana | mes.
 * Valor: Identificar tendencias, estacionalidad y días pico de ganancia.
 */
async function vendedorHistorialGanancias(idVendedor, filtros = {}) {
  const { fecha_inicio, fecha_fin, agrupacion } = filtros;

  // Aplicar CONVERT_TZ para agrupar por la fecha local del negocio, no la del server
  const fechaLocal = `CONVERT_TZ(m.fecha, '${DB_TZ}', '${APP_TZ}')`;

  let groupExpr, selectExpr;
  switch (agrupacion) {
    case 'semana':
      groupExpr = `YEARWEEK(${fechaLocal}, 1)`;
      selectExpr = `CONCAT(YEAR(${fechaLocal}), '-W', LPAD(WEEK(${fechaLocal}, 1), 2, '0'))`;
      break;
    case 'mes':
      groupExpr = `DATE_FORMAT(${fechaLocal}, '%Y-%m')`;
      selectExpr = `DATE_FORMAT(${fechaLocal}, '%Y-%m')`;
      break;
    default: // dia
      groupExpr = `DATE(${fechaLocal})`;
      selectExpr = `DATE(${fechaLocal})`;
  }

  const rango = normalizarRangoFechas(fecha_inicio, fecha_fin);
  const params = [idVendedor, ...rango.params];

  const [rows] = await db.execute(`
    SELECT
      ${selectExpr}                                     AS periodo,
      COUNT(DISTINCT m.id_pedido)                       AS pedidos,
      SUM(m.cantidad)                                   AS unidades,
      ROUND(SUM(m.precio_venta_unit * m.cantidad), 2)   AS ingresos_brutos,
      ROUND(SUM(m.ganancia_bruta), 2)                   AS ganancia_bruta,
      ROUND(SUM(m.comision_plataforma), 2)              AS comision_total,
      ROUND(SUM(m.ganancia_neta), 2)                    AS ganancia_neta
    FROM movimiento_inventario m
    WHERE m.id_vendedor = ?
      AND m.tipo_movimiento = 'SALIDA'
      ${rango.whereExtra}
    GROUP BY ${groupExpr}
    ORDER BY periodo ASC
  `, params);

  const warn = generarAdvertencia(rows);
  return warn ? { ...warn, data: rows } : rows;
}

/**
 * Resumen financiero consolidado del vendedor.
 * Valor: Vista 360° — cuánto vendió, cuánto pagó en comisiones, cuánto ganó realmente.
 */
async function vendedorResumenFinanciero(idVendedor, filtros = {}) {
  const { fecha_inicio, fecha_fin } = filtros;

  const rango = normalizarRangoFechas(fecha_inicio, fecha_fin);
  const params = [idVendedor, ...rango.params];

  const [[resumen]] = await db.execute(`
    SELECT
      COUNT(DISTINCT m.id_pedido)                       AS total_pedidos,
      SUM(m.cantidad)                                   AS unidades_vendidas,
      ROUND(SUM(m.precio_venta_unit * m.cantidad), 2)   AS total_vendido,
      ROUND(SUM(m.costo_unitario * m.cantidad), 2)      AS total_costo,
      ROUND(SUM(m.ganancia_bruta), 2)                   AS ganancia_bruta,
      ROUND(SUM(m.comision_plataforma), 2)              AS total_comisiones,
      ROUND(SUM(m.ganancia_neta), 2)                    AS ganancia_neta
    FROM movimiento_inventario m
    WHERE m.id_vendedor = ?
      AND m.tipo_movimiento = 'SALIDA'
      ${rango.whereExtra}
  `, params);

  // Valor actual del inventario del vendedor
  const [[inventario]] = await db.execute(`
    SELECT
      COUNT(*)                                 AS total_productos,
      COALESCE(SUM(stock), 0)                  AS unidades_en_stock,
      ROUND(COALESCE(SUM(costo_compra * stock), 0), 2) AS valor_inventario
    FROM producto
    WHERE id_vendedor = ?
  `, [idVendedor]);

  const warn = generarAdvertencia(
    resumen.total_pedidos > 0 ? [resumen] : []
  );

  return { ...(warn || {}), ...resumen, inventario };
}

/**
 * Análisis de inventario: rotación y stock muerto.
 * Valor: Saber qué reabastecer y qué dejar de comprar.
 *   - Mayor rotación → reabastecer pronto
 *   - Stock muerto → liquidar o descontinuar
 */
async function vendedorAnalisisInventario(idVendedor, filtros = {}) {
  const { fecha_inicio, fecha_fin, limit: lim } = filtros;
  const topN = Math.max(1, Math.min(Number(lim) || 10, 50));
  const diasDefault = 30;

  const fechaIni = fecha_inicio || new Date(Date.now() - diasDefault * 86400000).toISOString().slice(0, 10);
  const fechaFin = fecha_fin || new Date().toISOString().slice(0, 10);

  // Params con CONVERT_TZ para consistencia de timezone
  const tzIni = fechaIni + ' 00:00:00';
  const tzFin = fechaFin + ' 23:59:59';

  // Productos con mayor rotación + métrica de conversión (vendido / comprado)
  const [mayorRotacion] = await db.query(`
    SELECT
      p.id_producto,
      p.nombre,
      p.stock,
      p.precio,
      p.costo_compra,
      COALESCE(v.unidades_vendidas, 0)   AS unidades_vendidas,
      COALESCE(e.unidades_compradas, 0)  AS unidades_compradas,
      ROUND(
        CASE WHEN p.stock > 0
          THEN COALESCE(v.unidades_vendidas, 0) / p.stock
          ELSE COALESCE(v.unidades_vendidas, 0)
        END, 2)                          AS indice_rotacion,
      ROUND(
        CASE WHEN COALESCE(e.unidades_compradas, 0) > 0
          THEN (COALESCE(v.unidades_vendidas, 0) / e.unidades_compradas) * 100
          ELSE 0
        END, 2)                          AS pct_conversion_inventario
    FROM producto p
    LEFT JOIN (
      SELECT id_producto, SUM(cantidad) AS unidades_vendidas
      FROM movimiento_inventario
      WHERE id_vendedor = ?
        AND tipo_movimiento = 'SALIDA'
        AND fecha >= CONVERT_TZ(?, ?, ?)
        AND fecha <= CONVERT_TZ(?, ?, ?)
      GROUP BY id_producto
    ) v ON p.id_producto = v.id_producto
    LEFT JOIN (
      SELECT id_producto, SUM(cantidad) AS unidades_compradas
      FROM movimiento_inventario
      WHERE id_vendedor = ?
        AND tipo_movimiento = 'ENTRADA'
        AND fecha >= CONVERT_TZ(?, ?, ?)
        AND fecha <= CONVERT_TZ(?, ?, ?)
      GROUP BY id_producto
    ) e ON p.id_producto = e.id_producto
    WHERE p.id_vendedor = ?
      AND COALESCE(v.unidades_vendidas, 0) > 0
    ORDER BY indice_rotacion DESC
    LIMIT ?
  `, [
    idVendedor, tzIni, APP_TZ, DB_TZ, tzFin, APP_TZ, DB_TZ,
    idVendedor, tzIni, APP_TZ, DB_TZ, tzFin, APP_TZ, DB_TZ,
    idVendedor, topN
  ]);

  // Stock muerto: productos del vendedor sin ventas en el período
  const [stockMuerto] = await db.query(`
    SELECT
      p.id_producto,
      p.nombre,
      p.stock,
      p.precio,
      p.costo_compra,
      ROUND(p.costo_compra * p.stock, 2) AS capital_retenido
    FROM producto p
    WHERE p.id_vendedor = ?
      AND p.stock > 0
      AND p.id_producto NOT IN (
        SELECT DISTINCT id_producto
        FROM movimiento_inventario
        WHERE id_vendedor = ?
          AND tipo_movimiento = 'SALIDA'
          AND fecha >= CONVERT_TZ(?, ?, ?)
          AND fecha <= CONVERT_TZ(?, ?, ?)
      )
    ORDER BY capital_retenido DESC
    LIMIT ?
  `, [idVendedor, idVendedor, tzIni, APP_TZ, DB_TZ, tzFin, APP_TZ, DB_TZ, topN]);

  // Métrica global de conversión del vendedor: total vendido / total comprado
  const [[conversion]] = await db.execute(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE 0 END), 0)
        AS total_comprado,
      COALESCE(SUM(CASE WHEN tipo_movimiento = 'SALIDA' THEN cantidad ELSE 0 END), 0)
        AS total_vendido,
      ROUND(
        CASE WHEN SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE 0 END) > 0
          THEN (SUM(CASE WHEN tipo_movimiento = 'SALIDA' THEN cantidad ELSE 0 END)
                / SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE 0 END)) * 100
          ELSE 0
        END, 2) AS pct_conversion_global
    FROM movimiento_inventario
    WHERE id_vendedor = ?
      AND fecha >= CONVERT_TZ(?, ?, ?)
      AND fecha <= CONVERT_TZ(?, ?, ?)
  `, [idVendedor, tzIni, APP_TZ, DB_TZ, tzFin, APP_TZ, DB_TZ]);

  return {
    mayor_rotacion: mayorRotacion,
    stock_muerto: stockMuerto,
    conversion_inventario: conversion
  };
}

// ═══════════════════════════════════════════════════════════════════════
// REPORTES ADMIN
// ═══════════════════════════════════════════════════════════════════════

/**
 * Top vendedores con ranking ponderado.
 * score = (total_vendido_normalizado * 0.4) + (ganancia_neta_normalizada * 0.6)
 * Esto premia a quien genera ganancia real, no solo volumen.
 * ordenar_por: score (default) | ventas | ganancias | pedidos | comisiones
 * Fuente: movimiento_inventario SALIDA — datos financieros reales.
 */
async function adminTopVendedores(filtros = {}) {
  const { fecha_inicio, fecha_fin, ordenar_por, limit: lim } = filtros;
  const topN = Math.max(1, Math.min(Number(lim) || 10, 50));

  const rango = normalizarRangoFechas(fecha_inicio, fecha_fin);
  const params = [...rango.params];

  let orderCol;
  switch (ordenar_por) {
    case 'ventas':      orderCol = 'total_vendido'; break;
    case 'ganancias':   orderCol = 'ganancia_neta_vendedor'; break;
    case 'pedidos':     orderCol = 'total_pedidos'; break;
    case 'comisiones':  orderCol = 'comision_generada'; break;
    default:            orderCol = 'score_ponderado';
  }

  // Subquery para calcular max values para normalización del score
  const [rows] = await db.query(`
    SELECT
      sub.*,
      ROUND(
        CASE WHEN max_vendido > 0 AND max_ganancia > 0
          THEN (sub.total_vendido / max_vendido) * 40
             + (sub.ganancia_neta_vendedor / max_ganancia) * 60
          ELSE 0
        END, 2) AS score_ponderado
    FROM (
      SELECT
        m.id_vendedor,
        u.nombre                                          AS nombre_vendedor,
        u.email                                           AS email_vendedor,
        COUNT(DISTINCT m.id_pedido)                       AS total_pedidos,
        SUM(m.cantidad)                                   AS unidades_vendidas,
        ROUND(SUM(m.precio_venta_unit * m.cantidad), 2)   AS total_vendido,
        ROUND(SUM(m.ganancia_bruta), 2)                   AS ganancia_bruta_vendedor,
        ROUND(SUM(m.comision_plataforma), 2)              AS comision_generada,
        ROUND(SUM(m.ganancia_neta), 2)                    AS ganancia_neta_vendedor
      FROM movimiento_inventario m
      JOIN usuario u ON m.id_vendedor = u.id_usuario
      WHERE m.tipo_movimiento = 'SALIDA'
        ${rango.whereExtra}
      GROUP BY m.id_vendedor, u.nombre, u.email
    ) sub
    CROSS JOIN (
      SELECT
        MAX(tv) AS max_vendido,
        MAX(gn) AS max_ganancia
      FROM (
        SELECT
          SUM(m2.precio_venta_unit * m2.cantidad) AS tv,
          SUM(m2.ganancia_neta) AS gn
        FROM movimiento_inventario m2
        WHERE m2.tipo_movimiento = 'SALIDA'
          ${rango.whereExtra}
        GROUP BY m2.id_vendedor
      ) norm
    ) maxvals
    ORDER BY ${orderCol} DESC
    LIMIT ?
  `, [...params, ...params, topN]);

  const warn = generarAdvertencia(rows);
  return warn ? { ...warn, data: rows } : rows;
}

/**
 * Productos más vendidos a nivel global (toda la plataforma).
 * Valor: Entender la demanda real de los compradores.
 */
async function adminTopProductosGlobal(filtros = {}) {
  const { fecha_inicio, fecha_fin, limit: lim, ordenar_por } = filtros;
  const topN = Math.max(1, Math.min(Number(lim) || 10, 50));

  const rango = normalizarRangoFechas(fecha_inicio, fecha_fin);
  const params = [...rango.params];

  let orderCol;
  switch (ordenar_por) {
    case 'ingresos':  orderCol = 'ingresos_brutos'; break;
    case 'comision':  orderCol = 'comision_generada'; break;
    default:          orderCol = 'unidades_vendidas';
  }

  const [rows] = await db.query(`
    SELECT
      m.id_producto,
      p.nombre,
      p.imagen,
      c.nombre                                          AS categoria,
      u.nombre                                          AS vendedor,
      SUM(m.cantidad)                                   AS unidades_vendidas,
      COUNT(DISTINCT m.id_pedido)                       AS pedidos_distintos,
      ROUND(SUM(m.precio_venta_unit * m.cantidad), 2)   AS ingresos_brutos,
      ROUND(SUM(m.comision_plataforma), 2)              AS comision_generada
    FROM movimiento_inventario m
    JOIN producto p ON m.id_producto = p.id_producto
    LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
    LEFT JOIN usuario u ON p.id_vendedor = u.id_usuario
    WHERE m.tipo_movimiento = 'SALIDA'
      ${rango.whereExtra}
    GROUP BY m.id_producto, p.nombre, p.imagen, c.nombre, u.nombre
    ORDER BY ${orderCol} DESC
    LIMIT ?
  `, [...params, topN]);

  const warn = generarAdvertencia(rows);
  return warn ? { ...warn, data: rows } : rows;
}

/**
 * Ingresos de la plataforma (comisiones).
 * Agrupado por período para ver tendencia de ingresos propios.
 * Valor: La plataforma vive de las comisiones — este es EL reporte del negocio.
 */
async function adminIngresosPlataforma(filtros = {}) {
  const { fecha_inicio, fecha_fin, agrupacion } = filtros;

  const fechaLocal = `CONVERT_TZ(m.fecha, '${DB_TZ}', '${APP_TZ}')`;

  let groupExpr, selectExpr;
  switch (agrupacion) {
    case 'semana':
      groupExpr = `YEARWEEK(${fechaLocal}, 1)`;
      selectExpr = `CONCAT(YEAR(${fechaLocal}), '-W', LPAD(WEEK(${fechaLocal}, 1), 2, '0'))`;
      break;
    case 'dia':
      groupExpr = `DATE(${fechaLocal})`;
      selectExpr = `DATE(${fechaLocal})`;
      break;
    default: // mes
      groupExpr = `DATE_FORMAT(${fechaLocal}, '%Y-%m')`;
      selectExpr = `DATE_FORMAT(${fechaLocal}, '%Y-%m')`;
  }

  const rango = normalizarRangoFechas(fecha_inicio, fecha_fin);
  const params = [...rango.params];

  // Detalle por período
  const [detalle] = await db.execute(`
    SELECT
      ${selectExpr}                                     AS periodo,
      COUNT(DISTINCT m.id_pedido)                       AS pedidos,
      SUM(m.cantidad)                                   AS unidades,
      ROUND(SUM(m.precio_venta_unit * m.cantidad), 2)   AS volumen_ventas,
      ROUND(SUM(m.comision_plataforma), 2)              AS comision_recaudada,
      ROUND(SUM(m.ganancia_neta), 2)                    AS ganancia_vendedores
    FROM movimiento_inventario m
    WHERE m.tipo_movimiento = 'SALIDA'
      ${rango.whereExtra}
    GROUP BY ${groupExpr}
    ORDER BY periodo ASC
  `, params);

  // Totales acumulados
  const [[totales]] = await db.execute(`
    SELECT
      COUNT(DISTINCT m.id_pedido)                       AS total_pedidos,
      ROUND(SUM(m.precio_venta_unit * m.cantidad), 2)   AS volumen_total_ventas,
      ROUND(SUM(m.comision_plataforma), 2)              AS comision_total_recaudada,
      ROUND(SUM(m.ganancia_neta), 2)                    AS ganancia_total_vendedores,
      COUNT(DISTINCT m.id_vendedor)                     AS vendedores_activos
    FROM movimiento_inventario m
    WHERE m.tipo_movimiento = 'SALIDA'
      ${rango.whereExtra}
  `, params);

  return { totales, detalle };
}

/**
 * Estadísticas generales del sistema.
 * Valor: Panorama completo de salud del negocio con crecimiento vs período anterior.
 */
async function adminEstadisticas(filtros = {}) {
  const { fecha_inicio, fecha_fin } = filtros;

  // ----- Contadores globales -----
  const [[globales]] = await db.execute(`
    SELECT
      (SELECT COUNT(*) FROM usuario)                    AS total_usuarios,
      (SELECT COUNT(*) FROM pedido)                     AS total_pedidos,
      (SELECT COUNT(*) FROM producto)                   AS total_productos,
      (SELECT COUNT(DISTINCT id_vendedor) FROM producto WHERE id_vendedor IS NOT NULL)
                                                        AS total_vendedores
  `);

  // ----- Pedidos y ventas en el rango (con CONVERT_TZ) -----
  let whereRango = '';
  const paramsRango = [];
  if (fecha_inicio) {
    whereRango += ' AND p.fecha_pedido >= CONVERT_TZ(?, ?, ?)';
    paramsRango.push(fecha_inicio + ' 00:00:00', APP_TZ, DB_TZ);
  }
  if (fecha_fin) {
    whereRango += ' AND p.fecha_pedido <= CONVERT_TZ(?, ?, ?)';
    paramsRango.push(fecha_fin + ' 23:59:59', APP_TZ, DB_TZ);
  }

  const [[pedidosRango]] = await db.execute(`
    SELECT
      COUNT(*)                        AS pedidos_periodo,
      COALESCE(SUM(p.total), 0)       AS ventas_periodo,
      COALESCE(AVG(p.total), 0)       AS ticket_promedio
    FROM pedido p
    WHERE 1=1 ${whereRango}
  `, paramsRango);

  // ----- Usuarios activos (compraron en el rango) -----
  const [[usuariosActivos]] = await db.execute(`
    SELECT COUNT(DISTINCT p.id_usuario) AS usuarios_activos
    FROM pedido p
    WHERE 1=1 ${whereRango}
  `, paramsRango);

  // ----- Pedidos por estado -----
  const [porEstado] = await db.execute(`
    SELECT
      ep.nombre_estado AS estado,
      COUNT(p.id_pedido) AS cantidad
    FROM estado_pedido ep
    LEFT JOIN pedido p ON p.id_estado = ep.id_estado
    GROUP BY ep.id_estado, ep.nombre_estado
    ORDER BY ep.id_estado
  `);

  // ----- Crecimiento: comparar rango actual vs rango anterior de misma duración -----
  let crecimiento = null;
  if (fecha_inicio && fecha_fin) {
    const msInicio = new Date(fecha_inicio).getTime();
    const msFin = new Date(fecha_fin + ' 23:59:59').getTime();
    const duracionMs = msFin - msInicio;
    const anteriorInicio = new Date(msInicio - duracionMs).toISOString().slice(0, 10);
    const anteriorFin = new Date(msInicio - 1).toISOString().slice(0, 10);

    const [[anterior]] = await db.execute(`
      SELECT
        COUNT(*)                   AS pedidos_anterior,
        COALESCE(SUM(total), 0)    AS ventas_anterior
      FROM pedido
      WHERE fecha_pedido >= ? AND fecha_pedido <= ?
    `, [anteriorInicio, anteriorFin + ' 23:59:59']);

    const pedidosAnt = Number(anterior.pedidos_anterior) || 0;
    const ventasAnt = Number(anterior.ventas_anterior) || 0;
    const pedidosAct = Number(pedidosRango.pedidos_periodo) || 0;
    const ventasAct = Number(pedidosRango.ventas_periodo) || 0;

    crecimiento = {
      periodo_anterior: { inicio: anteriorInicio, fin: anteriorFin, pedidos: pedidosAnt, ventas: ventasAnt },
      variacion_pedidos_pct: pedidosAnt > 0 ? Math.round(((pedidosAct - pedidosAnt) / pedidosAnt) * 10000) / 100 : null,
      variacion_ventas_pct:  ventasAnt > 0  ? Math.round(((ventasAct - ventasAnt) / ventasAnt) * 10000) / 100  : null
    };
  }

  return {
    globales,
    periodo: {
      ...pedidosRango,
      usuarios_activos: usuariosActivos.usuarios_activos
    },
    por_estado: porEstado,
    crecimiento
  };
}

module.exports = {
  // Vendedor
  vendedorTopProductos,
  vendedorProductosRentables,
  vendedorHistorialGanancias,
  vendedorResumenFinanciero,
  vendedorAnalisisInventario,
  // Admin
  adminTopVendedores,
  adminTopProductosGlobal,
  adminIngresosPlataforma,
  adminEstadisticas
};
