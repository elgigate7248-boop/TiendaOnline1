const db = require("../db");

async function listar() {
  const [rows] = await db.execute(`
    SELECT 
      p.id_pedido,
      p.id_usuario,
      p.id_estado,
      p.fecha_pedido,
      p.total,
      u.nombre AS usuario,
      e.nombre_estado AS estado
    FROM pedido p
    JOIN usuario u ON p.id_usuario = u.id_usuario
    JOIN estado_pedido e ON p.id_estado = e.id_estado
    ORDER BY p.fecha_pedido DESC
  `);
  return rows;
}

async function vendedorTienePedido(idPedido, idVendedor) {
  const pedidoId = Number(idPedido);
  const vendedorId = Number(idVendedor);

  if (!Number.isFinite(pedidoId) || pedidoId <= 0) return false;
  if (!Number.isFinite(vendedorId) || vendedorId <= 0) return false;

  const [rows] = await db.execute(
    `
    SELECT 1
    FROM detalle_pedido dp
    JOIN producto pr ON dp.id_producto = pr.id_producto
    WHERE dp.id_pedido = ? AND pr.id_vendedor = ?
    LIMIT 1
    `,
    [pedidoId, vendedorId]
  );

  return Array.isArray(rows) && rows.length > 0;
}


async function listarPorUsuario(idUsuario) {
  const [rows] = await db.execute(
    `
    SELECT 
      p.id_pedido,
      p.id_usuario,
      p.id_estado,
      p.fecha_pedido,
      p.total,
      e.nombre_estado AS estado
    FROM pedido p
    JOIN estado_pedido e ON p.id_estado = e.id_estado
    WHERE p.id_usuario = ?
    `,
    [idUsuario]
  );
  return rows;
}

async function listarPorVendedor(idVendedor) {
  const [rows] = await db.execute(
    `
    SELECT DISTINCT
      p.id_pedido,
      p.id_usuario,
      p.id_estado,
      p.fecha_pedido,
      p.total,
      u.nombre AS nombre_cliente,
      u.email AS email_cliente,
      e.nombre_estado AS estado
    FROM pedido p
    JOIN usuario u ON p.id_usuario = u.id_usuario
    JOIN estado_pedido e ON p.id_estado = e.id_estado
    JOIN detalle_pedido dp ON p.id_pedido = dp.id_pedido
    JOIN producto pr ON dp.id_producto = pr.id_producto
    WHERE pr.id_vendedor = ?
    ORDER BY p.fecha_pedido DESC
    `,
    [idVendedor]
  );
  return rows;
}


async function insertar(pedido) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO pedido (id_usuario, id_estado, fecha_pedido, total)
       VALUES (?, ?, ?, ?)`,
      [
        pedido.id_usuario,
        pedido.id_estado,
        pedido.fecha_pedido || new Date(),
        pedido.total || 0
      ]
    );

    const id_pedido = result.insertId;

    if (pedido.detalles && pedido.detalles.length > 0) {
      for (const detalle of pedido.detalles) {
        const cantidad = Number(detalle.cantidad) || 0;
        const precioUnitario = Number(detalle.precio_unitario) || 0;

        if (!detalle.id_producto || cantidad <= 0 || precioUnitario <= 0) {
          const invalidDetailError = new Error('Detalle de pedido invalido');
          invalidDetailError.status = 400;
          throw invalidDetailError;
        }

        // Validar stock disponible (sin descontar — se descuenta al confirmar)
        const [[prodStock]] = await connection.execute(
          `SELECT stock FROM producto WHERE id_producto = ?`,
          [detalle.id_producto]
        );

        if (!prodStock || prodStock.stock < cantidad) {
          const stockError = new Error(`Stock insuficiente para el producto ${detalle.id_producto}`);
          stockError.status = 400;
          throw stockError;
        }

        await connection.execute(
          `INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario)
           VALUES (?, ?, ?, ?)`,
          [
            id_pedido,
            detalle.id_producto,
            cantidad,
            precioUnitario
          ]
        );
      }
    }

    let id_pago = null;
    if (pedido.metodo_pago) {
      const [pagoResult] = await connection.execute(
        `INSERT INTO pago (id_pedido, metodo_pago, monto, fecha_pago)
         VALUES (?, ?, ?, ?)`,
        [id_pedido, pedido.metodo_pago, pedido.total || 0, new Date()]
      );
      id_pago = pagoResult.insertId;
    }

    await connection.commit();

    return {
      message: "Pedido registrado correctamente",
      insertId: id_pedido,
      id_pago
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function buscarPorId(id) {
  const [rows] = await db.execute(`
    SELECT 
      p.id_pedido,
      p.id_usuario,
      p.id_estado,
      p.fecha_pedido,
      p.total,
      u.nombre  AS usuario,
      u.email   AS email_cliente,
      e.nombre_estado AS estado
    FROM pedido p
    JOIN usuario u ON p.id_usuario = u.id_usuario
    JOIN estado_pedido e ON p.id_estado = e.id_estado
    WHERE p.id_pedido = ?
  `, [id]);

  if (!rows[0]) return null;
  const pedido = rows[0];

  const [detalles] = await db.execute(`
    SELECT
      dp.id_detalle,
      dp.id_producto,
      dp.cantidad,
      dp.precio_unitario,
      pr.nombre           AS nombre_producto,
      pr.imagen,
      pr.ciudad_origen    AS ciudad_origen_producto,
      pr.tiempo_preparacion
    FROM detalle_pedido dp
    JOIN producto pr ON dp.id_producto = pr.id_producto
    WHERE dp.id_pedido = ?
  `, [id]);

  pedido.detalles = Array.isArray(detalles) ? detalles : [];
  return pedido;
}


async function actualizar(id, pedido) {
  const idPedido = Number(id);
  if (!Number.isFinite(idPedido) || idPedido <= 0) {
    const err = new Error('ID de pedido invalido');
    err.status = 400;
    throw err;
  }

  const updates = [];
  const values = [];

  if (pedido.id_usuario !== undefined && pedido.id_usuario !== null && pedido.id_usuario !== '') {
    const idUsuario = Number(pedido.id_usuario);
    if (!Number.isFinite(idUsuario) || idUsuario <= 0) {
      const err = new Error('Usuario invalido');
      err.status = 400;
      throw err;
    }
    updates.push('id_usuario = ?');
    values.push(idUsuario);
  }

  if (pedido.id_estado !== undefined && pedido.id_estado !== null && pedido.id_estado !== '') {
    const idEstado = Number(pedido.id_estado);
    if (!Number.isFinite(idEstado) || idEstado <= 0) {
      const err = new Error('Estado de pedido invalido');
      err.status = 400;
      throw err;
    }
    updates.push('id_estado = ?');
    values.push(idEstado);
  }

  if (pedido.total !== undefined && pedido.total !== null && pedido.total !== '') {
    const total = Number(pedido.total);
    if (!Number.isFinite(total) || total < 0) {
      const err = new Error('Total invalido');
      err.status = 400;
      throw err;
    }
    updates.push('total = ?');
    values.push(total);
  }

  if (pedido.fecha_pedido !== undefined && pedido.fecha_pedido !== null && pedido.fecha_pedido !== '') {
    const fecha = new Date(pedido.fecha_pedido);
    if (Number.isNaN(fecha.getTime())) {
      const err = new Error('Fecha de pedido invalida');
      err.status = 400;
      throw err;
    }
    updates.push('fecha_pedido = ?');
    values.push(fecha);
  }

  if (!updates.length) {
    return 0;
  }

  values.push(idPedido);
  const [result] = await db.execute(
    `UPDATE pedido SET ${updates.join(', ')} WHERE id_pedido = ?`,
    values
  );
  return result.affectedRows;
}

async function eliminar(id) {
  const idPedido = Number(id);
  if (!Number.isFinite(idPedido) || idPedido <= 0) {
    const err = new Error('ID de pedido invalido');
    err.status = 400;
    throw err;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Solo restaurar stock si el pedido fue confirmado (existen movimientos SALIDA)
    const [salidas] = await connection.execute(
      `SELECT id_movimiento, id_producto, cantidad, observaciones
       FROM movimiento_inventario
       WHERE id_pedido = ? AND tipo_movimiento = 'SALIDA'`,
      [idPedido]
    );

    if (salidas && salidas.length > 0) {
      for (const salida of salidas) {
        const cantidad = Number(salida.cantidad) || 0;
        const idProducto = Number(salida.id_producto) || 0;
        if (cantidad <= 0 || idProducto <= 0) continue;

        // Restaurar stock
        await connection.execute(
          `UPDATE producto SET stock = stock + ? WHERE id_producto = ?`,
          [cantidad, idProducto]
        );

        // Revertir lote FIFO si aplica
        const obs = salida.observaciones || '';
        const matchLote = obs.match(/FIFO lote #(\d+)/);
        if (matchLote) {
          const idLoteOriginal = Number(matchLote[1]);
          await connection.execute(
            `UPDATE movimiento_inventario
             SET cantidad_restante = cantidad_restante + ?
             WHERE id_movimiento = ? AND tipo_movimiento = 'ENTRADA'`,
            [cantidad, idLoteOriginal]
          );
        }
      }
    }

    await connection.execute(`DELETE FROM movimiento_inventario WHERE id_pedido = ?`, [idPedido]);
    await connection.execute(`DELETE FROM pago WHERE id_pedido = ?`, [idPedido]);
    await connection.execute(`DELETE FROM detalle_pedido WHERE id_pedido = ?`, [idPedido]);
    const [result] = await connection.execute(`DELETE FROM pedido WHERE id_pedido = ?`, [idPedido]);

    await connection.commit();
    return result.affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listarParaRepartidor() {
  const [rows] = await db.execute(`
    SELECT
      p.id_pedido,
      p.id_usuario,
      p.id_estado,
      p.fecha_pedido,
      p.total,
      u.nombre AS nombre_cliente,
      u.email  AS email_cliente,
      e.nombre_estado AS estado
    FROM pedido p
    JOIN usuario u ON p.id_usuario = u.id_usuario
    JOIN estado_pedido e ON p.id_estado = e.id_estado
    WHERE p.id_estado IN (2, 3, 4)
    ORDER BY p.fecha_pedido ASC
  `);
  return rows;
}

async function obtenerResumenReportes(top = 5) {
  const topLimit = Math.max(1, Math.min(Number(top) || 5, 20));

  const [[totales]] = await db.execute(
    `
    SELECT
      COUNT(*) AS total_pedidos,
      COALESCE(SUM(total), 0) AS ventas_totales,
      COALESCE(AVG(total), 0) AS ticket_promedio
    FROM pedido
    `
  );

  const [porEstado] = await db.execute(
    `
    SELECT
      e.id_estado,
      e.nombre_estado AS estado,
      COUNT(p.id_pedido) AS cantidad,
      COALESCE(SUM(p.total), 0) AS total
    FROM estado_pedido e
    LEFT JOIN pedido p ON p.id_estado = e.id_estado
    GROUP BY e.id_estado, e.nombre_estado
    ORDER BY e.id_estado ASC
    `
  );

  const [topProductos] = await db.query(
    `
    SELECT
      pr.id_producto,
      pr.nombre,
      COALESCE(SUM(dp.cantidad), 0) AS unidades,
      COALESCE(SUM(dp.cantidad * dp.precio_unitario), 0) AS ingresos
    FROM producto pr
    LEFT JOIN detalle_pedido dp ON dp.id_producto = pr.id_producto
    GROUP BY pr.id_producto, pr.nombre
    ORDER BY unidades DESC, ingresos DESC
    LIMIT ?
    `,
    [topLimit]
  );

  const [ventasMensualesRaw] = await db.execute(
    `
    SELECT
      DATE_FORMAT(p.fecha_pedido, '%Y-%m') AS periodo,
      COUNT(*) AS pedidos,
      COALESCE(SUM(p.total), 0) AS ventas
    FROM pedido p
    GROUP BY DATE_FORMAT(p.fecha_pedido, '%Y-%m')
    ORDER BY periodo DESC
    LIMIT 6
    `
  );

  const ventasMensuales = [...ventasMensualesRaw].reverse();

  return {
    totales,
    por_estado: porEstado,
    top_productos: topProductos,
    ventas_mensuales: ventasMensuales
  };
}

async function descontarStockPorConfirmacion(idPedido) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [detalles] = await connection.execute(
      `SELECT id_producto, cantidad FROM detalle_pedido WHERE id_pedido = ?`,
      [idPedido]
    );

    if (Array.isArray(detalles) && detalles.length) {
      for (const d of detalles) {
        const cantidad = Number(d.cantidad) || 0;
        const idProducto = Number(d.id_producto) || 0;
        if (cantidad > 0 && idProducto > 0) {
          const [stockUpdate] = await connection.execute(
            `UPDATE producto SET stock = stock - ? WHERE id_producto = ? AND stock >= ?`,
            [cantidad, idProducto, cantidad]
          );
          if (!stockUpdate.affectedRows) {
            const err = new Error(`Stock insuficiente para producto ${idProducto} al confirmar pedido`);
            err.status = 400;
            throw err;
          }
        }
      }
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function restaurarStockPorCancelacion(idPedido) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verificamos si existen movimientos de inventario SALIDA para este pedido
    const [[movSalida]] = await connection.execute(
      `SELECT COUNT(*) AS total FROM movimiento_inventario WHERE id_pedido = ? AND tipo_movimiento = 'SALIDA'`,
      [idPedido]
    );

    // Si no hay movimientos de salida, el stock nunca se descontó — no restaurar
    if (!movSalida || Number(movSalida.total) === 0) {
      await connection.commit();
      return false;
    }

    // Obtener movimientos SALIDA de este pedido para revertir lotes FIFO
    const [salidas] = await connection.execute(
      `SELECT id_movimiento, id_producto, cantidad, costo_unitario, observaciones
       FROM movimiento_inventario
       WHERE id_pedido = ? AND tipo_movimiento = 'SALIDA'`,
      [idPedido]
    );

    for (const salida of salidas) {
      const cantidad = Number(salida.cantidad) || 0;
      const idProducto = Number(salida.id_producto) || 0;
      if (cantidad <= 0 || idProducto <= 0) continue;

      // Restaurar stock del producto
      await connection.execute(
        `UPDATE producto SET stock = stock + ? WHERE id_producto = ?`,
        [cantidad, idProducto]
      );

      // Revertir cantidad_restante del lote FIFO original (si existe en observaciones)
      const obs = salida.observaciones || '';
      const matchLote = obs.match(/FIFO lote #(\d+)/);
      if (matchLote) {
        const idLoteOriginal = Number(matchLote[1]);
        await connection.execute(
          `UPDATE movimiento_inventario
           SET cantidad_restante = cantidad_restante + ?
           WHERE id_movimiento = ? AND tipo_movimiento = 'ENTRADA'`,
          [cantidad, idLoteOriginal]
        );
      }
    }

    // Eliminar los movimientos SALIDA de este pedido (ya están revertidos)
    await connection.execute(
      `DELETE FROM movimiento_inventario WHERE id_pedido = ? AND tipo_movimiento = 'SALIDA'`,
      [idPedido]
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listar,
  listarPorUsuario,
  listarPorVendedor,
  vendedorTienePedido,
  listarParaRepartidor,
  insertar,
  buscarPorId,
  actualizar,
  eliminar,
  descontarStockPorConfirmacion,
  restaurarStockPorCancelacion,
  obtenerResumenReportes
};
