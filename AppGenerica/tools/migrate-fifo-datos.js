/**
 * Script de migración: Inicializar cantidad_restante en lotes ENTRADA existentes
 * usando lógica FIFO retroactiva.
 *
 * Uso: node tools/migrate-fifo-datos.js
 *
 * 1. Pone cantidad_restante = cantidad en todas las ENTRADAS sin valor.
 * 2. Para cada producto/vendedor, suma las unidades vendidas (SALIDA)
 *    y las descuenta de los lotes más antiguos (FIFO).
 */

const db = require('../db');

async function migrar() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Paso 1: Inicializar todas las ENTRADAS que no tengan cantidad_restante
    const [initResult] = await conn.execute(`
      UPDATE movimiento_inventario
      SET cantidad_restante = cantidad
      WHERE tipo_movimiento = 'ENTRADA'
        AND cantidad_restante IS NULL
    `);
    console.log(`✅ ENTRADAS inicializadas: ${initResult.affectedRows}`);

    // Paso 2: Obtener combinaciones producto/vendedor con SALIDAS
    const [combos] = await conn.execute(`
      SELECT DISTINCT id_producto, id_vendedor
      FROM movimiento_inventario
      WHERE tipo_movimiento = 'SALIDA'
    `);

    for (const { id_producto, id_vendedor } of combos) {
      // Total de unidades vendidas para este producto/vendedor
      const [[{ total_vendido }]] = await conn.execute(`
        SELECT COALESCE(SUM(cantidad), 0) AS total_vendido
        FROM movimiento_inventario
        WHERE id_producto = ? AND id_vendedor = ? AND tipo_movimiento = 'SALIDA'
      `, [id_producto, id_vendedor]);

      if (total_vendido <= 0) continue;

      // Obtener lotes ENTRADA ordenados FIFO
      const [lotes] = await conn.execute(`
        SELECT id_movimiento, cantidad, cantidad_restante
        FROM movimiento_inventario
        WHERE id_producto = ? AND id_vendedor = ? AND tipo_movimiento = 'ENTRADA'
        ORDER BY fecha ASC, id_movimiento ASC
      `, [id_producto, id_vendedor]);

      let pendiente = total_vendido;

      for (const lote of lotes) {
        if (pendiente <= 0) break;

        const disponible = lote.cantidad_restante ?? lote.cantidad;
        const consumir = Math.min(disponible, pendiente);
        const nuevoRestante = disponible - consumir;

        await conn.execute(`
          UPDATE movimiento_inventario
          SET cantidad_restante = ?
          WHERE id_movimiento = ?
        `, [nuevoRestante, lote.id_movimiento]);

        pendiente -= consumir;
      }

      if (pendiente > 0) {
        console.warn(`⚠️ Producto ${id_producto} / Vendedor ${id_vendedor}: ${pendiente} unidades vendidas sin lote ENTRADA correspondiente`);
      }
    }

    await conn.commit();
    console.log('✅ Migración FIFO completada exitosamente');
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error en migración FIFO:', err);
    throw err;
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrar();
