const db = require('../db');

// ═══════════════════════════════════════════════════════════════════════
// TIMEZONE (reutilizar misma config que Reportes.servicios.js)
// ═══════════════════════════════════════════════════════════════════════
const APP_TZ = process.env.APP_TIMEZONE || '-05:00';
const DB_TZ  = process.env.DB_TIMEZONE  || '+00:00';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTES DE NEGOCIO
// ═══════════════════════════════════════════════════════════════════════
const UMBRAL_STOCK_MUERTO_DIAS   = 30;
const UMBRAL_MARGEN_BAJO_PCT     = 5;
const UMBRAL_ROTACION_RAPIDA     = 10;
const UMBRAL_ROTACION_MEDIA      = 30;
const UMBRAL_PUNTO_REORDEN_DIAS  = 5;
const ELASTICIDAD_PRECIO_DEMANDA = 2.5; // -10% precio → +25% demanda

// ═══════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL — generarRecomendaciones
// ═══════════════════════════════════════════════════════════════════════

/**
 * Genera inteligencia de negocio completa para un vendedor.
 * Consume datos de los endpoints existentes y añade análisis avanzado.
 * @param {number} idVendedor
 * @param {object} filtros — { fecha_inicio, fecha_fin }
 * @returns {object} — { recomendaciones, alertas, insights, metricas_avanzadas, simulaciones, segmentacion }
 */
async function generarRecomendaciones(idVendedor, filtros = {}) {
  const diasDefault = 30;
  const fechaIni = filtros.fecha_inicio || new Date(Date.now() - diasDefault * 86400000).toISOString().slice(0, 10);
  const fechaFin = filtros.fecha_fin   || new Date().toISOString().slice(0, 10);
  const tzIni = fechaIni + ' 00:00:00';
  const tzFin = fechaFin + ' 23:59:59';

  // Calcular días del período
  const msFechaIni = new Date(fechaIni).getTime();
  const msFechaFin = new Date(fechaFin).getTime();
  const diasPeriodo = Math.max(1, Math.round((msFechaFin - msFechaIni) / 86400000));

  // ── Consultas paralelas para máximo rendimiento ──
  const [
    productosVendedor,
    ventasPorProducto,
    historialActual,
    historialAnterior,
    pedidosConDetalles,
    resumenFinanciero
  ] = await Promise.all([
    obtenerProductosVendedor(idVendedor),
    obtenerVentasPorProducto(idVendedor, tzIni, tzFin),
    obtenerResumenPeriodo(idVendedor, tzIni, tzFin),
    obtenerResumenPeriodoAnterior(idVendedor, fechaIni, fechaFin, diasPeriodo),
    obtenerPedidosConDetalles(idVendedor, tzIni, tzFin),
    obtenerResumenFinanciero(idVendedor, tzIni, tzFin)
  ]);

  // ── Mapas de datos ──
  const ventasMap = new Map();
  for (const v of ventasPorProducto) {
    ventasMap.set(v.id_producto, v);
  }

  // ── Generar análisis ──
  const recomendaciones = [];
  const alertas = [];
  const insights = [];

  // Fase 1 — Reglas de negocio
  aplicarReglasNegocio(productosVendedor, ventasMap, diasPeriodo, recomendaciones, alertas);

  // Fase 1 — Caída de ventas y ticket promedio
  analizarTendencias(resumenFinanciero, historialActual, historialAnterior, recomendaciones, alertas, insights);

  // Fase 2 — Métricas avanzadas
  const metricas_avanzadas = calcularMetricasAvanzadas(productosVendedor, ventasMap, diasPeriodo, alertas);

  // Fase 3 — Matriz estratégica
  const matrizEstrategica = generarMatrizEstrategica(productosVendedor, ventasMap);

  // Fase 4 — Segmentación ABC
  const segmentacion = generarSegmentacionABC(productosVendedor, ventasMap);

  // Fase 6 — Cross-selling
  const crossSelling = analizarCrossSelling(pedidosConDetalles);

  // Ordenar recomendaciones por prioridad
  const prioridadOrden = { alta: 0, media: 1, baja: 2 };
  recomendaciones.sort((a, b) => (prioridadOrden[a.prioridad] || 2) - (prioridadOrden[b.prioridad] || 2));
  alertas.sort((a, b) => (prioridadOrden[a.prioridad] || 2) - (prioridadOrden[b.prioridad] || 2));

  return {
    recomendaciones,
    alertas,
    insights,
    metricas_avanzadas,
    matriz_estrategica: matrizEstrategica,
    segmentacion,
    cross_selling: crossSelling,
    periodo: { fecha_inicio: fechaIni, fecha_fin: fechaFin, dias: diasPeriodo }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CONSULTAS A BASE DE DATOS
// ═══════════════════════════════════════════════════════════════════════

async function obtenerProductosVendedor(idVendedor) {
  const [rows] = await db.query(`
    SELECT
      p.id_producto, p.nombre, p.precio, p.costo_compra, p.stock, p.imagen,
      c.nombre AS categoria
    FROM producto p
    LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
    WHERE p.id_vendedor = ?
  `, [idVendedor]);
  return rows;
}

async function obtenerVentasPorProducto(idVendedor, tzIni, tzFin) {
  const [rows] = await db.query(`
    SELECT
      m.id_producto,
      SUM(m.cantidad)                                  AS unidades_vendidas,
      COUNT(DISTINCT m.id_pedido)                       AS pedidos_distintos,
      ROUND(SUM(m.precio_venta_unit * m.cantidad), 2)   AS ingresos_brutos,
      ROUND(SUM(m.costo_unitario * m.cantidad), 2)      AS costo_total,
      ROUND(SUM(m.ganancia_bruta), 2)                   AS ganancia_bruta,
      ROUND(SUM(m.comision_plataforma), 2)              AS comision_total,
      ROUND(SUM(m.ganancia_neta), 2)                    AS ganancia_neta,
      ROUND(AVG(m.precio_venta_unit), 2)                AS precio_venta_promedio,
      ROUND(AVG(m.costo_unitario), 2)                   AS costo_promedio,
      ROUND(
        CASE WHEN SUM(m.costo_unitario * m.cantidad) > 0
          THEN (SUM(m.ganancia_neta) / SUM(m.costo_unitario * m.cantidad)) * 100
          ELSE 0
        END, 2)                                         AS margen_pct
    FROM movimiento_inventario m
    WHERE m.id_vendedor = ?
      AND m.tipo_movimiento = 'SALIDA'
      AND m.fecha >= CONVERT_TZ(?, ?, ?)
      AND m.fecha <= CONVERT_TZ(?, ?, ?)
    GROUP BY m.id_producto
  `, [idVendedor, tzIni, APP_TZ, DB_TZ, tzFin, APP_TZ, DB_TZ]);
  return rows;
}

async function obtenerResumenPeriodo(idVendedor, tzIni, tzFin) {
  const [[row]] = await db.query(`
    SELECT
      COUNT(DISTINCT m.id_pedido)                       AS total_pedidos,
      COALESCE(SUM(m.cantidad), 0)                      AS unidades_vendidas,
      ROUND(COALESCE(SUM(m.precio_venta_unit * m.cantidad), 0), 2) AS total_vendido,
      ROUND(COALESCE(SUM(m.ganancia_neta), 0), 2)       AS ganancia_neta,
      ROUND(
        CASE WHEN COUNT(DISTINCT m.id_pedido) > 0
          THEN SUM(m.precio_venta_unit * m.cantidad) / COUNT(DISTINCT m.id_pedido)
          ELSE 0
        END, 2)                                         AS ticket_promedio
    FROM movimiento_inventario m
    WHERE m.id_vendedor = ?
      AND m.tipo_movimiento = 'SALIDA'
      AND m.fecha >= CONVERT_TZ(?, ?, ?)
      AND m.fecha <= CONVERT_TZ(?, ?, ?)
  `, [idVendedor, tzIni, APP_TZ, DB_TZ, tzFin, APP_TZ, DB_TZ]);
  return row;
}

async function obtenerResumenPeriodoAnterior(idVendedor, fechaIni, fechaFin, diasPeriodo) {
  const anteriorFin = new Date(new Date(fechaIni).getTime() - 86400000);
  const anteriorIni = new Date(anteriorFin.getTime() - (diasPeriodo - 1) * 86400000);
  const tzIniAnt = anteriorIni.toISOString().slice(0, 10) + ' 00:00:00';
  const tzFinAnt = anteriorFin.toISOString().slice(0, 10) + ' 23:59:59';

  const [[row]] = await db.query(`
    SELECT
      COUNT(DISTINCT m.id_pedido)                       AS total_pedidos,
      COALESCE(SUM(m.cantidad), 0)                      AS unidades_vendidas,
      ROUND(COALESCE(SUM(m.precio_venta_unit * m.cantidad), 0), 2) AS total_vendido,
      ROUND(COALESCE(SUM(m.ganancia_neta), 0), 2)       AS ganancia_neta,
      ROUND(
        CASE WHEN COUNT(DISTINCT m.id_pedido) > 0
          THEN SUM(m.precio_venta_unit * m.cantidad) / COUNT(DISTINCT m.id_pedido)
          ELSE 0
        END, 2)                                         AS ticket_promedio
    FROM movimiento_inventario m
    WHERE m.id_vendedor = ?
      AND m.tipo_movimiento = 'SALIDA'
      AND m.fecha >= CONVERT_TZ(?, ?, ?)
      AND m.fecha <= CONVERT_TZ(?, ?, ?)
  `, [idVendedor, tzIniAnt, APP_TZ, DB_TZ, tzFinAnt, APP_TZ, DB_TZ]);
  return row;
}

async function obtenerPedidosConDetalles(idVendedor, tzIni, tzFin) {
  const [rows] = await db.query(`
    SELECT
      m.id_pedido,
      m.id_producto
    FROM movimiento_inventario m
    WHERE m.id_vendedor = ?
      AND m.tipo_movimiento = 'SALIDA'
      AND m.fecha >= CONVERT_TZ(?, ?, ?)
      AND m.fecha <= CONVERT_TZ(?, ?, ?)
    ORDER BY m.id_pedido
  `, [idVendedor, tzIni, APP_TZ, DB_TZ, tzFin, APP_TZ, DB_TZ]);
  return rows;
}

async function obtenerResumenFinanciero(idVendedor, tzIni, tzFin) {
  const [[row]] = await db.query(`
    SELECT
      ROUND(COALESCE(SUM(m.precio_venta_unit * m.cantidad), 0), 2) AS total_vendido,
      ROUND(COALESCE(SUM(m.ganancia_neta), 0), 2) AS ganancia_neta,
      ROUND(COALESCE(SUM(m.comision_plataforma), 0), 2) AS total_comisiones
    FROM movimiento_inventario m
    WHERE m.id_vendedor = ?
      AND m.tipo_movimiento = 'SALIDA'
      AND m.fecha >= CONVERT_TZ(?, ?, ?)
      AND m.fecha <= CONVERT_TZ(?, ?, ?)
  `, [idVendedor, tzIni, APP_TZ, DB_TZ, tzFin, APP_TZ, DB_TZ]);
  return row;
}

// ═══════════════════════════════════════════════════════════════════════
// FASE 1 — REGLAS DE NEGOCIO
// ═══════════════════════════════════════════════════════════════════════

function aplicarReglasNegocio(productos, ventasMap, diasPeriodo, recomendaciones, alertas) {
  for (const prod of productos) {
    const venta = ventasMap.get(prod.id_producto);
    const nombre = prod.nombre;
    const capitalRetenido = Number(((prod.costo_compra || 0) * (prod.stock || 0)).toFixed(2));

    // ── REGLA 1: Stock muerto ──
    if (!venta && prod.stock > 0 && diasPeriodo >= UMBRAL_STOCK_MUERTO_DIAS) {
      recomendaciones.push({
        tipo: 'stock_muerto',
        prioridad: 'alta',
        icono: '⚠️',
        producto: nombre,
        id_producto: prod.id_producto,
        mensaje: `⚠️ "${nombre}" tiene capital retenido de $${capitalRetenido}. Aplica descuento o elimina stock.`,
        accion: 'Aplicar descuento',
        valor_impacto: capitalRetenido
      });
    }

    if (!venta) continue;

    const unidades = Number(venta.unidades_vendidas) || 0;
    const margen = Number(venta.margen_pct) || 0;
    const ganancia = Number(venta.ganancia_neta) || 0;
    const ventasDiarias = unidades / diasPeriodo;

    // ── REGLA 2: Alta rotación ──
    const diasStock = prod.stock > 0 && ventasDiarias > 0
      ? Math.round(prod.stock / ventasDiarias)
      : Infinity;

    if (diasStock < UMBRAL_ROTACION_RAPIDA && prod.stock > 0) {
      const incrementoSugerido = Math.round(ventasDiarias * 15); // stock para 15 días
      const pctIncremento = prod.stock > 0
        ? Math.round((incrementoSugerido / prod.stock) * 100)
        : 100;
      recomendaciones.push({
        tipo: 'alta_rotacion',
        prioridad: 'alta',
        icono: '📈',
        producto: nombre,
        id_producto: prod.id_producto,
        mensaje: `📈 "${nombre}" tiene alta demanda (${ventasDiarias.toFixed(1)} uds/día). Aumenta stock un ${pctIncremento}%.`,
        accion: 'Reabastecer',
        valor_impacto: incrementoSugerido
      });
    }

    // ── REGLA 3: Margen bajo ──
    if (margen > 0 && margen <= UMBRAL_MARGEN_BAJO_PCT) {
      recomendaciones.push({
        tipo: 'margen_bajo',
        prioridad: 'media',
        icono: '💰',
        producto: nombre,
        id_producto: prod.id_producto,
        mensaje: `💰 "${nombre}" tiene margen muy bajo (${margen}%). Revisa precio o costo.`,
        accion: 'Revisar precios',
        valor_impacto: margen
      });
    }

    // ── REGLA 4: Ganancia negativa ──
    if (ganancia < 0) {
      alertas.push({
        tipo: 'ganancia_negativa',
        prioridad: 'alta',
        nivel: 'critico',
        icono: '🚨',
        producto: nombre,
        id_producto: prod.id_producto,
        mensaje: `🚨 Estás perdiendo dinero con "${nombre}" ($${ganancia}). Detener ventas o ajustar costos.`,
        accion: 'Detener ventas'
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FASE 1 — TENDENCIAS (Caída de ventas + Ticket promedio)
// ═══════════════════════════════════════════════════════════════════════

function analizarTendencias(resumenFin, actual, anterior, recomendaciones, alertas, insights) {
  const ventasAct = Number(actual?.total_vendido) || 0;
  const ventasAnt = Number(anterior?.total_vendido) || 0;
  const ticketAct = Number(actual?.ticket_promedio) || 0;
  const ticketAnt = Number(anterior?.ticket_promedio) || 0;
  const pedidosAct = Number(actual?.total_pedidos) || 0;
  const pedidosAnt = Number(anterior?.total_pedidos) || 0;

  // ── REGLA 5: Caída de ventas ──
  if (ventasAnt > 0 && ventasAct < ventasAnt) {
    const variacionPct = Math.round(((ventasAct - ventasAnt) / ventasAnt) * 100);
    let causaProbable = 'Posible causa: bajo stock o productos sin rotación.';
    if (pedidosAct < pedidosAnt) {
      causaProbable = 'Posible causa: menos pedidos recibidos. Revisa visibilidad de productos.';
    }

    recomendaciones.push({
      tipo: 'caida_ventas',
      prioridad: 'alta',
      icono: '📉',
      mensaje: `📉 Ventas bajaron ${Math.abs(variacionPct)}% vs período anterior. ${causaProbable}`,
      accion: 'Analizar productos',
      valor_impacto: Math.abs(variacionPct)
    });

    insights.push({
      tipo: 'tendencia_ventas',
      titulo: 'Por qué bajaron tus ventas',
      descripcion: `Tus ventas pasaron de $${ventasAnt} a $${ventasAct} (${variacionPct}%). ${causaProbable}`,
      nivel: 'critico'
    });
  } else if (ventasAnt > 0 && ventasAct > ventasAnt) {
    const variacionPct = Math.round(((ventasAct - ventasAnt) / ventasAnt) * 100);
    insights.push({
      tipo: 'tendencia_ventas',
      titulo: 'Tus ventas están creciendo',
      descripcion: `Ventas subieron ${variacionPct}% vs período anterior ($${ventasAnt} → $${ventasAct}). ¡Sigue así!`,
      nivel: 'positivo'
    });
  }

  // ── REGLA 6: Ticket promedio bajo ──
  if (ticketAnt > 0 && ticketAct < ticketAnt) {
    const variacionTicket = Math.round(((ticketAct - ticketAnt) / ticketAnt) * 100);
    recomendaciones.push({
      tipo: 'ticket_bajo',
      prioridad: 'media',
      icono: '💡',
      mensaje: `💡 Ticket promedio bajó ${Math.abs(variacionTicket)}% ($${ticketAnt} → $${ticketAct}). Mejora con combos o descuentos por volumen.`,
      accion: 'Crear combos',
      valor_impacto: Math.abs(variacionTicket)
    });
  }

  // Insight de resumen financiero
  if (ventasAct > 0) {
    const comisiones = Number(resumenFin?.total_comisiones) || 0;
    const gananciaFinal = Number(resumenFin?.ganancia_neta) || 0;
    insights.push({
      tipo: 'resumen_periodo',
      titulo: 'Resumen del período',
      descripcion: `Vendiste $${ventasAct}, pagaste $${comisiones} en comisiones y tu ganancia neta fue $${gananciaFinal}.`,
      nivel: 'informativo'
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FASE 2 — MÉTRICAS AVANZADAS
// ═══════════════════════════════════════════════════════════════════════

function calcularMetricasAvanzadas(productos, ventasMap, diasPeriodo, alertas) {
  let capitalInmovilizado = 0;
  const rotacionProductos = [];
  const puntosReorden = [];

  for (const prod of productos) {
    const costo = Number(prod.costo_compra) || 0;
    const stock = Number(prod.stock) || 0;
    capitalInmovilizado += costo * stock;

    const venta = ventasMap.get(prod.id_producto);
    const unidades = venta ? Number(venta.unidades_vendidas) || 0 : 0;
    const ventasDiarias = unidades / diasPeriodo;

    // Rotación real
    const diasPromedio = ventasDiarias > 0 ? Math.round(stock / ventasDiarias) : (stock > 0 ? 999 : 0);
    let clasificacion, color;
    if (diasPromedio > UMBRAL_ROTACION_MEDIA || (stock > 0 && ventasDiarias === 0)) {
      clasificacion = 'LENTO';
      color = 'rojo';
    } else if (diasPromedio > UMBRAL_ROTACION_RAPIDA) {
      clasificacion = 'MEDIO';
      color = 'amarillo';
    } else {
      clasificacion = 'RÁPIDO';
      color = 'verde';
    }

    rotacionProductos.push({
      id_producto: prod.id_producto,
      nombre: prod.nombre,
      stock,
      ventas_diarias: Number(ventasDiarias.toFixed(2)),
      dias_promedio_stock: diasPromedio === 999 ? null : diasPromedio,
      clasificacion,
      color
    });

    // Punto de reorden
    if (ventasDiarias > 0 && stock > 0) {
      const diasRestantes = Math.round(stock / ventasDiarias);
      if (diasRestantes < UMBRAL_PUNTO_REORDEN_DIAS) {
        puntosReorden.push({
          id_producto: prod.id_producto,
          nombre: prod.nombre,
          stock,
          dias_restantes: diasRestantes,
          consumo_diario: Number(ventasDiarias.toFixed(2))
        });

        alertas.push({
          tipo: 'punto_reorden',
          prioridad: 'alta',
          nivel: 'critico',
          icono: '⚠️',
          producto: prod.nombre,
          id_producto: prod.id_producto,
          mensaje: `⚠️ "${prod.nombre}" se agotará en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}. Stock actual: ${stock} uds.`,
          accion: 'Reabastecer urgente'
        });
      }
    }
  }

  return {
    capital_inmovilizado: Number(capitalInmovilizado.toFixed(2)),
    rotacion_productos: rotacionProductos,
    puntos_reorden: puntosReorden,
    total_productos: productos.length,
    productos_con_ventas: ventasMap.size,
    productos_sin_ventas: productos.length - ventasMap.size
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FASE 3 — MATRIZ ESTRATÉGICA (Portafolio)
// ═══════════════════════════════════════════════════════════════════════

function generarMatrizEstrategica(productos, ventasMap) {
  if (ventasMap.size === 0) return [];

  // Calcular medianas de margen y volumen
  const datosConVentas = productos
    .filter(p => ventasMap.has(p.id_producto))
    .map(p => {
      const v = ventasMap.get(p.id_producto);
      return {
        id_producto: p.id_producto,
        nombre: p.nombre,
        margen_pct: Number(v.margen_pct) || 0,
        unidades_vendidas: Number(v.unidades_vendidas) || 0,
        ganancia_neta: Number(v.ganancia_neta) || 0,
        ingresos_brutos: Number(v.ingresos_brutos) || 0
      };
    });

  if (datosConVentas.length === 0) return [];

  const margenes = datosConVentas.map(d => d.margen_pct).sort((a, b) => a - b);
  const volumenes = datosConVentas.map(d => d.unidades_vendidas).sort((a, b) => a - b);
  const medianaMargen = margenes[Math.floor(margenes.length / 2)];
  const medianaVolumen = volumenes[Math.floor(volumenes.length / 2)];

  return datosConVentas.map(d => {
    const altoMargen = d.margen_pct >= medianaMargen;
    const altoVolumen = d.unidades_vendidas >= medianaVolumen;

    let categoria_estrategica, accion_recomendada, icono;
    if (altoMargen && altoVolumen) {
      categoria_estrategica = 'Estrella';
      accion_recomendada = 'Mantener y proteger — es tu mejor producto';
      icono = '⭐';
    } else if (altoMargen && !altoVolumen) {
      categoria_estrategica = 'Oportunidad';
      accion_recomendada = 'Promocionar — tiene buen margen pero bajo volumen';
      icono = '💡';
    } else if (!altoMargen && altoVolumen) {
      categoria_estrategica = 'Optimizar';
      accion_recomendada = 'Optimizar costos o subir precio — vende mucho pero margen bajo';
      icono = '⚠️';
    } else {
      categoria_estrategica = 'Eliminar';
      accion_recomendada = 'Considerar eliminar — bajo margen y bajo volumen';
      icono = '❌';
    }

    return {
      id_producto: d.id_producto,
      nombre: d.nombre,
      margen_pct: d.margen_pct,
      unidades_vendidas: d.unidades_vendidas,
      ganancia_neta: d.ganancia_neta,
      ingresos_brutos: d.ingresos_brutos,
      categoria_estrategica,
      accion_recomendada,
      icono
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// FASE 4 — SEGMENTACIÓN ABC
// ═══════════════════════════════════════════════════════════════════════

function generarSegmentacionABC(productos, ventasMap) {
  const productosConIngresos = productos
    .filter(p => ventasMap.has(p.id_producto))
    .map(p => {
      const v = ventasMap.get(p.id_producto);
      return {
        id_producto: p.id_producto,
        nombre: p.nombre,
        ingresos: Number(v.ingresos_brutos) || 0,
        unidades: Number(v.unidades_vendidas) || 0,
        ganancia_neta: Number(v.ganancia_neta) || 0
      };
    })
    .sort((a, b) => b.ingresos - a.ingresos);

  if (productosConIngresos.length === 0) return [];

  const totalIngresos = productosConIngresos.reduce((s, p) => s + p.ingresos, 0);
  if (totalIngresos === 0) return [];

  let acumulado = 0;
  return productosConIngresos.map(p => {
    acumulado += p.ingresos;
    const pctAcumulado = (acumulado / totalIngresos) * 100;

    let categoria, recomendacion;
    if (pctAcumulado <= 80) {
      categoria = 'A';
      recomendacion = 'Producto estrella — mantener stock alto y priorizar visibilidad';
    } else if (pctAcumulado <= 95) {
      categoria = 'B';
      recomendacion = 'Producto importante — monitorear y buscar oportunidades de crecimiento';
    } else {
      categoria = 'C';
      recomendacion = 'Producto secundario — evaluar si vale la pena mantenerlo';
    }

    return {
      id_producto: p.id_producto,
      nombre: p.nombre,
      ingresos: p.ingresos,
      unidades: p.unidades,
      ganancia_neta: p.ganancia_neta,
      pct_ingresos: Number(((p.ingresos / totalIngresos) * 100).toFixed(2)),
      pct_acumulado: Number(pctAcumulado.toFixed(2)),
      categoria,
      recomendacion
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// FASE 5 — SIMULADOR DE PRECIOS
// ═══════════════════════════════════════════════════════════════════════

async function simularPrecio(idVendedor, idProducto, variacionPct) {
  // Obtener producto
  const [[producto]] = await db.query(`
    SELECT id_producto, nombre, precio, costo_compra, stock,
           COALESCE(comision_plataforma, 0.05) AS comision_pct
    FROM producto
    WHERE id_producto = ? AND id_vendedor = ?
  `, [idProducto, idVendedor]);

  if (!producto) {
    throw new Error('Producto no encontrado o no pertenece al vendedor');
  }

  // Obtener ventas actuales (últimos 30 días)
  const diasDefault = 30;
  const tzIni = new Date(Date.now() - diasDefault * 86400000).toISOString().slice(0, 10) + ' 00:00:00';
  const tzFin = new Date().toISOString().slice(0, 10) + ' 23:59:59';

  const [[ventas]] = await db.query(`
    SELECT
      COALESCE(SUM(m.cantidad), 0) AS unidades_vendidas,
      ROUND(COALESCE(SUM(m.ganancia_neta), 0), 2) AS ganancia_actual
    FROM movimiento_inventario m
    WHERE m.id_producto = ?
      AND m.id_vendedor = ?
      AND m.tipo_movimiento = 'SALIDA'
      AND m.fecha >= CONVERT_TZ(?, ?, ?)
      AND m.fecha <= CONVERT_TZ(?, ?, ?)
  `, [idProducto, idVendedor, tzIni, APP_TZ, DB_TZ, tzFin, APP_TZ, DB_TZ]);

  const precioActual = Number(producto.precio);
  const costoCompra = Number(producto.costo_compra) || 0;
  const comisionPct = Number(producto.comision_pct);
  const unidadesActuales = Number(ventas.unidades_vendidas) || 0;
  const variacion = Number(variacionPct) / 100;

  // Precio simulado
  const precioSimulado = Number((precioActual * (1 + variacion)).toFixed(2));

  // Heurística de elasticidad: si precio baja X%, demanda sube X% * elasticidad
  const cambioDemandaPct = -variacion * ELASTICIDAD_PRECIO_DEMANDA;
  const ventasEstimadas = Math.max(0, Math.round(unidadesActuales * (1 + cambioDemandaPct)));

  // Calcular ganancia estimada
  const comisionUnit = precioSimulado * comisionPct;
  const gananciaUnitaria = precioSimulado - costoCompra - comisionUnit;
  const gananciaEstimada = Number((gananciaUnitaria * ventasEstimadas).toFixed(2));
  const gananciaActual = Number(ventas.ganancia_actual) || 0;

  return {
    producto: producto.nombre,
    id_producto: producto.id_producto,
    precio_actual: precioActual,
    precio_simulado: precioSimulado,
    variacion_precio_pct: Number(variacionPct),
    ventas_actuales: unidadesActuales,
    ventas_estimadas: ventasEstimadas,
    cambio_demanda_pct: Number((cambioDemandaPct * 100).toFixed(1)),
    ganancia_actual: gananciaActual,
    ganancia_estimada: gananciaEstimada,
    diferencia_ganancia: Number((gananciaEstimada - gananciaActual).toFixed(2)),
    costo_compra: costoCompra,
    comision_pct: Number((comisionPct * 100).toFixed(1)),
    nota: `Simulación basada en elasticidad precio-demanda de ${ELASTICIDAD_PRECIO_DEMANDA}. Resultados son estimaciones.`
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FASE 6 — CROSS-SELLING
// ═══════════════════════════════════════════════════════════════════════

function analizarCrossSelling(pedidosConDetalles) {
  // Agrupar productos por pedido
  const pedidoProductos = new Map();
  for (const row of pedidosConDetalles) {
    if (!pedidoProductos.has(row.id_pedido)) {
      pedidoProductos.set(row.id_pedido, new Set());
    }
    pedidoProductos.get(row.id_pedido).add(row.id_producto);
  }

  // Contar co-ocurrencias
  const pares = new Map();
  const nombresProductos = new Map();

  // Necesitamos los nombres — extraer del set de detalles
  for (const row of pedidosConDetalles) {
    if (!nombresProductos.has(row.id_producto)) {
      nombresProductos.set(row.id_producto, row.id_producto);
    }
  }

  for (const [, productos] of pedidoProductos) {
    const arr = [...productos];
    if (arr.length < 2) continue;

    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = [arr[i], arr[j]].sort((a, b) => a - b).join('-');
        pares.set(key, (pares.get(key) || 0) + 1);
      }
    }
  }

  // Filtrar pares con >= 2 co-ocurrencias y ordenar
  const resultados = [];
  for (const [key, count] of pares) {
    if (count >= 2) {
      const [id1, id2] = key.split('-').map(Number);
      resultados.push({
        productos: [id1, id2],
        veces_juntos: count,
        recomendacion: `Crear combo — se compran juntos ${count} veces`
      });
    }
  }

  resultados.sort((a, b) => b.veces_juntos - a.veces_juntos);
  return resultados.slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  generarRecomendaciones,
  simularPrecio
};
