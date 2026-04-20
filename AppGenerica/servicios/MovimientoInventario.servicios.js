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
 * Actualiza el stock y el costo_compra del producto.
 *
 * @param {Object} datos
 * @param {number} datos.id_producto
 * @param {number} datos.id_vendedor
 * @param {number} datos.cantidad
 * @param {number} datos.costo_unitario - Costo de compra/producción por unidad
 * @param {string} [datos.referencia]
 * @param {string} [datos.observaciones]
 * @returns {Object} { id_movimiento, nuevo_stock, nuevo_costo_compra }
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

    // Calcular nuevo costo promedio ponderado
    const stockAnterior = costos.stock;
    const costoAnterior = costos.costo_compra;
    let nuevoCostoCompra;

    if (stockAnterior <= 0) {
      nuevoCostoCompra = costo_unitario;
    } else {
      nuevoCostoCompra =
        ((stockAnterior * costoAnterior) + (cantidad * costo_unitario)) /
        (stockAnterior + cantidad);
    }
    nuevoCostoCompra = Math.round(nuevoCostoCompra * 100) / 100;

    const nuevoStock = stockAnterior + cantidad;

    // Actualizar producto: stock y costo_compra
    await conn.execute(
      `UPDATE producto SET stock = ?, costo_compra = ? WHERE id_producto = ?`,
      [nuevoStock, nuevoCostoCompra, id_producto]
    );

    // Insertar movimiento
    const [result] = await conn.execute(
      `INSERT INTO movimiento_inventario
        (id_producto, id_vendedor, tipo_movimiento, cantidad, costo_unitario,
         referencia, observaciones)
       VALUES (?, ?, 'ENTRADA', ?, ?, ?, ?)`,
      [
        id_producto,
        id_vendedor,
        cantidad,
        costo_unitario,
        referencia || null,
        observaciones || null
      ]
    );

    await conn.commit();

    return {
      id_movimiento: result.insertId,
      nuevo_stock: nuevoStock,
      nuevo_costo_compra: nuevoCostoCompra
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
 * Registra movimientos de SALIDA por cada detalle del pedido.
 * Calcula ganancia bruta, comisión y ganancia neta.
 *
 * Debe ser llamada dentro de una transacción existente o autónomamente.
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
      const cantidad = Number(det.cantidad) || 0;
      const precioVenta = Number(det.precio_unitario) || 0;
      const costoCompra = Number(det.costo_compra) || 0;
      const comisionPct = det.comision_plataforma != null
        ? Number(det.comision_plataforma)
        : COMISION_DEFAULT;
      const idVendedor = det.id_vendedor;

      if (!idVendedor || cantidad <= 0) continue;

      // Cálculos financieros
      const gananciaBruta = Math.round(((precioVenta - costoCompra) * cantidad) * 100) / 100;
      const comisionMonto = Math.round((comisionPct * precioVenta * cantidad) * 100) / 100;
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
          cantidad,
          costoCompra,
          precioVenta,
          idPedido,
          det.id_detalle,
          gananciaBruta,
          comisionMonto,
          gananciaNeta,
          `PEDIDO-${idPedido}`,
          `Venta confirmada - Pedido #${idPedido}`
        ]
      );

      movimientos.push({
        id_movimiento: result.insertId,
        id_producto: det.id_producto,
        id_vendedor: idVendedor,
        cantidad,
        precio_venta: precioVenta,
        costo_compra: costoCompra,
        ganancia_bruta: gananciaBruta,
        comision_plataforma: comisionMonto,
        ganancia_neta: gananciaNeta
      });
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
    query += ` LIMIT ${lim} OFFSET ${off}`;
  }

  const [rows] = await db.execute(query, params);
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
        AS total_invertido,
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
  existenSalidasParaPedido
};
