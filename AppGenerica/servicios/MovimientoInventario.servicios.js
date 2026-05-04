const db = require('../db');

// ─── Constantes ───
const COMISION_DEFAULT = 0.05; // 5%

// ─── Helpers ───

/**
 * Obtiene el costo de compra y comisión actuales de un producto.
 * Si el producto no tiene costo_compra, retorna 0.
 */
async function obtenerCostosProducto(idProducto, conn) {
  const executor = conn || db;
  const [rows] = await executor.execute(
    `SELECT costo_compra, comision_plataforma, precio, stock, id_vendedor
     FROM producto WHERE id_producto = ?`,
    [idProducto]
  );
  if (!rows[0]) return null;
  return {
    costo_compra: Number(rows[0].costo_compra) || 0,
    comision_plataforma: rows[0].comision_plataforma != null
      ? Number(rows[0].comision_plataforma)
      : COMISION_DEFAULT,
    precio_venta: Number(rows[0].precio) || 0,
    stock: Number(rows[0].stock) || 0,
    id_vendedor: rows[0].id_vendedor
  };
}

// ─── ENTRADA: Compra / Producción ───

/**
 * Registra una entrada de inventario (compra o producción).
 * Crea un lote FIFO con cantidad_restante para trazabilidad.
 * Solo actualiza el stock del producto (NO sobreescribe costo_compra global).
 *
 * @param {Object} datos
 * @param {number} datos.id_producto
 * @param {number} datos.id_vendedor
 * @param {number} datos.cantidad
 * @param {number} datos.costo_unitario - Costo de compra/producción por unidad
 * @param {string} [datos.referencia]
 * @param {string} [datos.observaciones]
 * @returns {Object} { id_movimiento, nuevo_stock }
 */
async function registrarEntrada(datos) {
  const { id_producto, id_vendedor, cantidad, costo_unitario, referencia, observaciones } = datos;

  if (!id_producto || !id_vendedor || !cantidad || cantidad <= 0) {
    const err = new Error('Datos de entrada inválidos: se requiere id_producto, id_vendedor y cantidad > 0');
    err.status = 400;
    throw err;
  }
  if (costo_unitario == null || costo_unitario < 0) {
    const err = new Error('El costo unitario debe ser >= 0');
    err.status = 400;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const costos = await obtenerCostosProducto(id_producto, conn);
    if (!costos) {
      const err = new Error('Producto no encontrado');
      err.status = 404;
      throw err;
    }

    // Verificar que el vendedor es dueño del producto
    if (costos.id_vendedor && costos.id_vendedor !== id_vendedor) {
      const err = new Error('No puedes registrar entrada para un producto que no te pertenece');
      err.status = 403;
      throw err;
    }

    const nuevoStock = costos.stock + cantidad;

    // Actualizar producto: solo stock (el costo real se rastrea por lote FIFO)
    await conn.execute(
      `UPDATE producto SET stock = ?, costo_compra = ? WHERE id_producto = ?`,
      [nuevoStock, costo_unitario, id_producto]
    );

    // Insertar movimiento ENTRADA con cantidad_restante (lote FIFO)
    const [result] = await conn.execute(
      `INSERT INTO movimiento_inventario
        (id_producto, id_vendedor, tipo_movimiento, cantidad, costo_unitario,
         cantidad_restante, referencia, observaciones)
       VALUES (?, ?, 'ENTRADA', ?, ?, ?, ?, ?)`,
      [
        id_producto,
        id_vendedor,
        cantidad,
        costo_unitario,
        cantidad,           // cantidad_restante = cantidad (lote completo disponible)
        referencia || null,
        observaciones || null
      ]
    );

    await conn.commit();

    return {
      id_movimiento: result.insertId,
      nuevo_stock: nuevoStock
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// ─── SALIDA: Venta (llamada desde Pedido.servicios al confirmar) ───

/**
 * Registra movimientos de SALIDA por cada detalle del pedido usando FIFO.
 * Consume lotes de entrada en orden cronológico (más antiguo primero).
 * Genera múltiples movimientos SALIDA si una venta cruza varios lotes.
 *
 * @param {number} idPedido
 * @param {Object} [externalConn] - Conexión de transacción externa (opcional)
 * @returns {Array} movimientos creados
 */
async function registrarSalidasPorPedido(idPedido, externalConn) {
  const conn = externalConn || await db.getConnection();
  const isOwnConn = !externalConn;

  try {
    if (isOwnConn) await conn.beginTransaction();

    // Obtener detalles del pedido con info del producto
    const [detalles] = await conn.execute(
      `SELECT
         dp.id_detalle,
         dp.id_producto,
         dp.cantidad,
         dp.precio_unitario,
         p.costo_compra,
         p.comision_plataforma,
         p.id_vendedor
       FROM detalle_pedido dp
       JOIN producto p ON dp.id_producto = p.id_producto
       WHERE dp.id_pedido = ?`,
      [idPedido]
    );

    if (!detalles || detalles.length === 0) {
      return [];
    }

    const movimientos = [];

    for (const det of detalles) {
      const cantidadTotal = Number(det.cantidad) || 0;
      const precioVenta = Number(det.precio_unitario) || 0;
      const comisionPct = det.comision_plataforma != null
        ? Number(det.comision_plataforma)
        : COMISION_DEFAULT;
      const idVendedor = det.id_vendedor;
      const costoFallback = Number(det.costo_compra) || 0;

      if (!idVendedor || cantidadTotal <= 0) continue;

      // ─── FIFO: obtener lotes ENTRADA con stock disponible ───
      const [lotes] = await conn.execute(
        `SELECT id_movimiento, costo_unitario, cantidad_restante
         FROM movimiento_inventario
         WHERE id_producto = ? AND id_vendedor = ?
           AND tipo_movimiento = 'ENTRADA'
           AND cantidad_restante > 0
         ORDER BY fecha ASC, id_movimiento ASC
         FOR UPDATE`,
        [det.id_producto, idVendedor]
      );

      let pendiente = cantidadTotal;

      // Consumir lotes FIFO
      for (const lote of lotes) {
        if (pendiente <= 0) break;

        const disponible = Number(lote.cantidad_restante);
        const consumir = Math.min(disponible, pendiente);
        const costoLote = Number(lote.costo_unitario) || 0;

        // Decrementar cantidad_restante del lote
        await conn.execute(
          `UPDATE movimiento_inventario SET cantidad_restante = cantidad_restante - ? WHERE id_movimiento = ?`,
          [consumir, lote.id_movimiento]
        );

        // Cálculos financieros con costo REAL del lote
        const gananciaBruta = Math.round(((precioVenta - costoLote) * consumir) * 100) / 100;
        const comisionMonto = Math.round((comisionPct * precioVenta * consumir) * 100) / 100;
        const gananciaNeta = Math.round((gananciaBruta - comisionMonto) * 100) / 100;

        const [result] = await conn.execute(
          `INSERT INTO movimiento_inventario
            (id_producto, id_vendedor, tipo_movimiento, cantidad, costo_unitario,
             precio_venta_unit, id_pedido, id_detalle_pedido,
             ganancia_bruta, comision_plataforma, ganancia_neta,
             referencia, observaciones)
           VALUES (?, ?, 'SALIDA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            det.id_producto,
            idVendedor,
            consumir,
            costoLote,
            precioVenta,
            idPedido,
            det.id_detalle,
            gananciaBruta,
            comisionMonto,
            gananciaNeta,
            `PEDIDO-${idPedido}`,
            `FIFO lote #${lote.id_movimiento} — Pedido #${idPedido}`
          ]
        );

        movimientos.push({
          id_movimiento: result.insertId,
          id_producto: det.id_producto,
          id_vendedor: idVendedor,
          cantidad: consumir,
          precio_venta: precioVenta,
          costo_compra: costoLote,
          lote_origen: lote.id_movimiento,
          ganancia_bruta: gananciaBruta,
          comision_plataforma: comisionMonto,
          ganancia_neta: gananciaNeta
        });

        pendiente -= consumir;
      }

      // Fallback: si quedan unidades sin lote ENTRADA (inventario previo al FIFO)
      if (pendiente > 0) {
        const gananciaBruta = Math.round(((precioVenta - costoFallback) * pendiente) * 100) / 100;
        const comisionMonto = Math.round((comisionPct * precioVenta * pendiente) * 100) / 100;
        const gananciaNeta = Math.round((gananciaBruta - comisionMonto) * 100) / 100;

        const [result] = await conn.execute(
          `INSERT INTO movimiento_inventario
            (id_producto, id_vendedor, tipo_movimiento, cantidad, costo_unitario,
             precio_venta_unit, id_pedido, id_detalle_pedido,
             ganancia_bruta, comision_plataforma, ganancia_neta,
             referencia, observaciones)
           VALUES (?, ?, 'SALIDA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            det.id_producto,
            idVendedor,
            pendiente,
            costoFallback,
            precioVenta,
            idPedido,
            det.id_detalle,
            gananciaBruta,
            comisionMonto,
            gananciaNeta,
            `PEDIDO-${idPedido}`,
            `Sin lote FIFO (costo producto) — Pedido #${idPedido}`
          ]
        );

        movimientos.push({
          id_movimiento: result.insertId,
          id_producto: det.id_producto,
          id_vendedor: idVendedor,
          cantidad: pendiente,
          precio_venta: precioVenta,
          costo_compra: costoFallback,
          lote_origen: null,
          ganancia_bruta: gananciaBruta,
          comision_plataforma: comisionMonto,
          ganancia_neta: gananciaNeta
        });
      }
    }

    if (isOwnConn) await conn.commit();
    return movimientos;

  } catch (error) {
    if (isOwnConn) await conn.rollback();
    throw error;
  } finally {
    if (isOwnConn) conn.release();
  }
}

// ─── CONSULTAS ───

/**
 * Lista movimientos de inventario de un vendedor con filtros opcionales.
 */
async function listarPorVendedor(idVendedor, filtros = {}) {
  const { tipo, id_producto, fecha_inicio, fecha_fin, limit, offset } = filtros;

  let query = `
    SELECT
      m.id_movimiento,
      m.id_producto,
      m.tipo_movimiento,
      m.cantidad,
      m.costo_unitario,
      m.precio_venta_unit,
      m.id_pedido,
      m.ganancia_bruta,
      m.comision_plataforma,
      m.ganancia_neta,
      m.referencia,
      m.observaciones,
      m.fecha,
      p.nombre AS nombre_producto,
      p.imagen AS imagen_producto
    FROM movimiento_inventario m
    JOIN producto p ON m.id_producto = p.id_producto
    WHERE m.id_vendedor = ?
  `;
  const params = [idVendedor];

  if (tipo) {
    query += ' AND m.tipo_movimiento = ?';
    params.push(tipo);
  }
  if (id_producto) {
    query += ' AND m.id_producto = ?';
    params.push(id_producto);
  }
  if (fecha_inicio) {
    query += ' AND m.fecha >= ?';
    params.push(fecha_inicio);
  }
  if (fecha_fin) {
    query += ' AND m.fecha <= ?';
    params.push(fecha_fin + ' 23:59:59');
  }

  query += ' ORDER BY m.fecha DESC';

  if (limit) {
    const lim = Math.max(1, Math.min(Number(limit) || 50, 500));
    const off = Math.max(0, Number(offset) || 0);
    query += ' LIMIT ? OFFSET ?';
    params.push(lim, off);
  }

  const [rows] = await db.query(query, params);
  return rows;
}

/**
 * Obtiene el resumen financiero de un vendedor.
 */
async function resumenFinanciero(idVendedor, filtros = {}) {
  const { fecha_inicio, fecha_fin } = filtros;

  let whereExtra = '';
  const params = [idVendedor];

  if (fecha_inicio) {
    whereExtra += ' AND m.fecha >= ?';
    params.push(fecha_inicio);
  }
  if (fecha_fin) {
    whereExtra += ' AND m.fecha <= ?';
    params.push(fecha_fin + ' 23:59:59');
  }

  const [[resumen]] = await db.execute(`
    SELECT
      COUNT(CASE WHEN tipo_movimiento = 'ENTRADA' THEN 1 END) AS total_entradas,
      COUNT(CASE WHEN tipo_movimiento = 'SALIDA' THEN 1 END)  AS total_salidas,
      COALESCE(SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE 0 END), 0)
        AS unidades_compradas,
      COALESCE(SUM(CASE WHEN tipo_movimiento = 'SALIDA' THEN cantidad ELSE 0 END), 0)
        AS unidades_vendidas,
      COALESCE(SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN costo_unitario * cantidad ELSE 0 END), 0)
        AS total_invertido_movimientos,
      COALESCE(SUM(CASE WHEN tipo_movimiento = 'SALIDA' THEN precio_venta_unit * cantidad ELSE 0 END), 0)
        AS total_ventas,
      COALESCE(SUM(CASE WHEN tipo_movimiento = 'SALIDA' THEN ganancia_bruta ELSE 0 END), 0)
        AS ganancia_bruta_total,
      COALESCE(SUM(CASE WHEN tipo_movimiento = 'SALIDA' THEN comision_plataforma ELSE 0 END), 0)
        AS comision_total,
      COALESCE(SUM(CASE WHEN tipo_movimiento = 'SALIDA' THEN ganancia_neta ELSE 0 END), 0)
        AS ganancia_neta_total
    FROM movimiento_inventario m
    WHERE m.id_vendedor = ?
    ${whereExtra}
  `, params);

  // Calcular total invertido desde los productos del vendedor (costo_compra * stock)
  const [[invProductos]] = await db.execute(`
    SELECT COALESCE(SUM(costo_compra * stock), 0) AS total_invertido_productos
    FROM producto
    WHERE id_vendedor = ? AND costo_compra > 0
  `, [idVendedor]);

  // Usar el mayor entre movimientos de entrada y el valor actual del inventario
  const invertidoMovimientos = Number(resumen.total_invertido_movimientos) || 0;
  const invertidoProductos = Number(invProductos.total_invertido_productos) || 0;
  resumen.total_invertido = invertidoMovimientos > 0 ? invertidoMovimientos : invertidoProductos;

  return resumen;
}

/**
 * Genera datos tipo "factura" para un pedido específico, filtrado por vendedor.
 */
async function facturaPorPedido(idPedido, idVendedor) {
  // Obtener info del pedido
  const [[pedido]] = await db.execute(`
    SELECT p.id_pedido, p.fecha_pedido, p.total,
           u.nombre AS nombre_cliente, u.email AS email_cliente
    FROM pedido p
    JOIN usuario u ON p.id_usuario = u.id_usuario
    WHERE p.id_pedido = ?
  `, [idPedido]);

  if (!pedido) {
    const err = new Error('Pedido no encontrado');
    err.status = 404;
    throw err;
  }

  // Obtener movimientos de SALIDA de ese pedido que pertenezcan al vendedor
  const [items] = await db.execute(`
    SELECT
      m.id_movimiento,
      m.id_producto,
      p.nombre AS nombre_producto,
      m.cantidad,
      m.costo_unitario AS costo_compra,
      m.precio_venta_unit AS precio_venta,
      (m.precio_venta_unit * m.cantidad) AS subtotal_venta,
      m.ganancia_bruta,
      m.comision_plataforma,
      m.ganancia_neta
    FROM movimiento_inventario m
    JOIN producto p ON m.id_producto = p.id_producto
    WHERE m.id_pedido = ?
      AND m.id_vendedor = ?
      AND m.tipo_movimiento = 'SALIDA'
    ORDER BY m.id_movimiento
  `, [idPedido, idVendedor]);

  if (!items.length) {
    const err = new Error('No se encontraron movimientos de venta para este pedido con tu usuario');
    err.status = 404;
    throw err;
  }

  // Calcular totales
  const totales = items.reduce((acc, item) => {
    acc.total_venta += Number(item.subtotal_venta) || 0;
    acc.total_costo += (Number(item.costo_compra) || 0) * (Number(item.cantidad) || 0);
    acc.total_ganancia_bruta += Number(item.ganancia_bruta) || 0;
    acc.total_comision += Number(item.comision_plataforma) || 0;
    acc.total_ganancia_neta += Number(item.ganancia_neta) || 0;
    return acc;
  }, {
    total_venta: 0,
    total_costo: 0,
    total_ganancia_bruta: 0,
    total_comision: 0,
    total_ganancia_neta: 0
  });

  // Redondear
  Object.keys(totales).forEach(k => {
    totales[k] = Math.round(totales[k] * 100) / 100;
  });

  return {
    pedido: {
      id_pedido: pedido.id_pedido,
      fecha: pedido.fecha_pedido,
      total_pedido: pedido.total,
      cliente: pedido.nombre_cliente,
      email_cliente: pedido.email_cliente
    },
    items,
    totales
  };
}

// ─── TRAZABILIDAD FIFO ───

/**
 * Devuelve la trazabilidad completa de un producto para un vendedor:
 *   - Todas sus ENTRADAs (lotes) con cantidades originales y restantes
 *   - Para cada ENTRADA, las SALIDAs que consumieron ese lote (vinculadas
 *     por el campo observaciones: "FIFO lote #<id>")
 *   - SALIDAs sin lote identificado (fallback) agrupadas aparte
 *   - Historial completo (ENTRADA + SALIDA) ordenado cronológicamente
 *
 * @param {number} idProducto
 * @param {number} idVendedor
 * @returns {Object}
 */
async function trazabilidadProducto(idProducto, idVendedor) {
  // ── 1. Info del producto ────────────────────────────────────────────
  const [[producto]] = await db.execute(
    `SELECT id_producto, nombre, imagen, precio, costo_compra, stock, id_vendedor
     FROM producto WHERE id_producto = ? AND id_vendedor = ?`,
    [idProducto, idVendedor]
  );
  if (!producto) {
    const err = new Error('Producto no encontrado o no te pertenece');
    err.status = 404;
    throw err;
  }

  // ── 2. Todas las ENTRADAs del producto ──────────────────────────────
  const [entradas] = await db.execute(
    `SELECT
       id_movimiento,
       fecha,
       cantidad,
       costo_unitario,
       cantidad_restante,
       referencia,
       observaciones
     FROM movimiento_inventario
     WHERE id_producto = ? AND id_vendedor = ? AND tipo_movimiento = 'ENTRADA'
     ORDER BY fecha ASC, id_movimiento ASC`,
    [idProducto, idVendedor]
  );

  // ── 3. Todas las SALIDAs del producto ───────────────────────────────
  const [salidas] = await db.execute(
    `SELECT
       m.id_movimiento,
       m.fecha,
       m.cantidad,
       m.costo_unitario,
       m.precio_venta_unit,
       m.id_pedido,
       m.ganancia_bruta,
       m.comision_plataforma,
       m.ganancia_neta,
       m.observaciones,
       m.referencia
     FROM movimiento_inventario m
     WHERE m.id_producto = ? AND m.id_vendedor = ? AND m.tipo_movimiento = 'SALIDA'
     ORDER BY m.fecha ASC, m.id_movimiento ASC`,
    [idProducto, idVendedor]
  );

  // ── 4. Parsear lote_origen de observaciones ─────────────────────────
  // Formato esperado: "FIFO lote #123 — Pedido #45"
  // Regex extrae el primer número luego de "lote #"
  const LOTE_RE = /lote\s*#(\d+)/i;

  const salidasConLote    = [];
  const salidasSinLote    = [];

  salidas.forEach(s => {
    const match = LOTE_RE.exec(s.observaciones || '');
    if (match) {
      salidasConLote.push({ ...s, lote_origen_id: Number(match[1]) });
    } else {
      salidasSinLote.push({ ...s, lote_origen_id: null });
    }
  });

  // ── 5. Agrupar SALIDAs por lote ─────────────────────────────────────
  const salidasPorLote = {};
  salidasConLote.forEach(s => {
    const k = s.lote_origen_id;
    if (!salidasPorLote[k]) salidasPorLote[k] = [];
    salidasPorLote[k].push({
      id_movimiento  : s.id_movimiento,
      fecha          : s.fecha,
      cantidad       : Number(s.cantidad),
      costo_unitario : Number(s.costo_unitario),
      precio_venta   : Number(s.precio_venta_unit),
      id_pedido      : s.id_pedido,
      ganancia_bruta : Number(s.ganancia_bruta),
      comision       : Number(s.comision_plataforma),
      ganancia_neta  : Number(s.ganancia_neta)
    });
  });

  // ── 6. Construir entradas enriquecidas ──────────────────────────────
  const entradasEnriquecidas = entradas.map(e => {
    const cantidad_original  = Number(e.cantidad);
    const cantidad_restante  = Number(e.cantidad_restante);
    const cantidad_consumida = cantidad_original - cantidad_restante;
    const salidas_del_lote   = salidasPorLote[e.id_movimiento] || [];

    // Suma de cantidades de SALIDAs vinculadas (para detectar discrepancias)
    const consumido_por_salidas = salidas_del_lote.reduce((s, x) => s + x.cantidad, 0);

    return {
      id_movimiento     : e.id_movimiento,
      fecha             : e.fecha,
      cantidad_original,
      cantidad_restante,
      cantidad_consumida,
      consumido_por_salidas,
      costo_unitario    : Number(e.costo_unitario),
      inversion_total   : Math.round(Number(e.costo_unitario) * cantidad_original * 100) / 100,
      referencia        : e.referencia,
      observaciones     : e.observaciones,
      pct_consumido     : cantidad_original > 0
        ? Math.round((cantidad_consumida / cantidad_original) * 10000) / 100
        : 0,
      estado_lote       : cantidad_restante === 0
        ? 'Agotado'
        : (cantidad_restante < cantidad_original ? 'Parcial' : 'Disponible'),
      salidas           : salidas_del_lote
    };
  });

  // ── 7. Historial completo (ENTRADA + SALIDA mezclados) ──────────────
  const historial = [
    ...entradas.map(e => ({
      id_movimiento : e.id_movimiento,
      fecha         : e.fecha,
      tipo          : 'ENTRADA',
      cantidad      : Number(e.cantidad),
      costo_unitario: Number(e.costo_unitario),
      precio_venta  : null,
      ganancia_neta : null,
      id_pedido     : null,
      observaciones : e.observaciones,
      referencia    : e.referencia
    })),
    ...salidas.map(s => ({
      id_movimiento : s.id_movimiento,
      fecha         : s.fecha,
      tipo          : 'SALIDA',
      cantidad      : Number(s.cantidad),
      costo_unitario: Number(s.costo_unitario),
      precio_venta  : Number(s.precio_venta_unit),
      ganancia_neta : Number(s.ganancia_neta),
      id_pedido     : s.id_pedido,
      lote_origen_id: LOTE_RE.exec(s.observaciones || '') ? Number(LOTE_RE.exec(s.observaciones)[1]) : null,
      observaciones : s.observaciones,
      referencia    : s.referencia
    }))
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id_movimiento - b.id_movimiento);

  // ── 8. KPIs del portafolio del producto ─────────────────────────────
  const totalComprado  = entradas.reduce((s, e) => s + Number(e.cantidad), 0);
  const totalVendido   = salidas.reduce((s, x)  => s + Number(x.cantidad), 0);
  const totalStockFIFO = entradas.reduce((s, e) => s + Number(e.cantidad_restante), 0);
  const totalInvertido = entradas.reduce((s, e) => s + Number(e.costo_unitario) * Number(e.cantidad), 0);
  const totalIngresos  = salidas.reduce((s, x)  => s + Number(x.precio_venta_unit) * Number(x.cantidad), 0);
  const totalGanancia  = salidas.reduce((s, x)  => s + Number(x.ganancia_neta), 0);

  return {
    producto: {
      id_producto  : producto.id_producto,
      nombre       : producto.nombre,
      imagen       : producto.imagen,
      precio_venta : Number(producto.precio),
      stock_sistema: Number(producto.stock)
    },
    kpis: {
      total_comprado   : totalComprado,
      total_vendido    : totalVendido,
      stock_fifo       : totalStockFIFO,
      total_lotes      : entradas.length,
      lotes_agotados   : entradasEnriquecidas.filter(e => e.estado_lote === 'Agotado').length,
      lotes_parciales  : entradasEnriquecidas.filter(e => e.estado_lote === 'Parcial').length,
      lotes_disponibles: entradasEnriquecidas.filter(e => e.estado_lote === 'Disponible').length,
      total_invertido  : Math.round(totalInvertido * 100) / 100,
      total_ingresos   : Math.round(totalIngresos * 100) / 100,
      total_ganancia   : Math.round(totalGanancia * 100) / 100,
      salidas_sin_lote : salidasSinLote.length
    },
    entradas: entradasEnriquecidas,
    salidas_sin_lote: salidasSinLote.map(s => ({
      id_movimiento : s.id_movimiento,
      fecha         : s.fecha,
      cantidad      : Number(s.cantidad),
      costo_unitario: Number(s.costo_unitario),
      precio_venta  : Number(s.precio_venta_unit),
      id_pedido     : s.id_pedido,
      ganancia_neta : Number(s.ganancia_neta),
      observaciones : s.observaciones
    })),
    historial
  };
}

/**
 * Devuelve lista de productos del vendedor con sus lotes de inventario,
 * para poblar el selector de trazabilidad.
 */
async function productosConMovimientos(idVendedor) {
  const [rows] = await db.execute(
    `SELECT DISTINCT
       p.id_producto,
       p.nombre,
       p.imagen,
       p.stock
     FROM producto p
     INNER JOIN movimiento_inventario m ON m.id_producto = p.id_producto
     WHERE p.id_vendedor = ?
       AND m.id_vendedor = ?
     ORDER BY p.nombre ASC`,
    [idVendedor, idVendedor]
  );
  return rows;
}

/**
 * Verifica si ya se registraron salidas para un pedido.
 */
async function existenSalidasParaPedido(idPedido) {
  const [[row]] = await db.execute(
    `SELECT COUNT(*) AS cnt FROM movimiento_inventario
     WHERE id_pedido = ? AND tipo_movimiento = 'SALIDA'`,
    [idPedido]
  );
  return (row.cnt || 0) > 0;
}

module.exports = {
  registrarEntrada,
  registrarSalidasPorPedido,
  listarPorVendedor,
  resumenFinanciero,
  facturaPorPedido,
  existenSalidasParaPedido,
  trazabilidadProducto,
  productosConMovimientos
};
