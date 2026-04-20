/**
 * MIGRACIÓN: Sistema de trazabilidad de costos y ventas
 *
 * Agrega:
 *   1. Columnas costo_compra y comision_plataforma a la tabla producto
 *   2. Tabla movimiento_inventario (independiente del Kardex)
 *
 * Este script es IDEMPOTENTE: verifica existencia antes de crear.
 *
 * Uso: node tools/migrate-movimiento-inventario.js
 */

const db = require('../db');

async function columnExists(table, column) {
  const [rows] = await db.execute(
    `SHOW COLUMNS FROM \`${table}\` LIKE ?`,
    [column]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function tableExists(table) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table]
  );
  return rows[0].cnt > 0;
}

async function migrate() {
  console.log('🔄 Iniciando migración: Sistema de trazabilidad de costos y ventas\n');

  try {
    // ─── 1. Agregar columna costo_compra a producto ───
    if (await columnExists('producto', 'costo_compra')) {
      console.log('✔️  Columna producto.costo_compra ya existe');
    } else {
      await db.execute(
        `ALTER TABLE producto
         ADD COLUMN costo_compra DECIMAL(12,2) NOT NULL DEFAULT 0
         COMMENT 'Costo de compra o producción por unidad'`
      );
      console.log('✅ Columna producto.costo_compra creada');
    }

    // ─── 2. Agregar columna comision_plataforma a producto ───
    if (await columnExists('producto', 'comision_plataforma')) {
      console.log('✔️  Columna producto.comision_plataforma ya existe');
    } else {
      await db.execute(
        `ALTER TABLE producto
         ADD COLUMN comision_plataforma DECIMAL(5,4) NOT NULL DEFAULT 0.0500
         COMMENT 'Porcentaje de comisión de la plataforma (ej: 0.0500 = 5%)'`
      );
      console.log('✅ Columna producto.comision_plataforma creada (default 5%)');
    }

    // ─── 3. Crear tabla movimiento_inventario ───
    if (await tableExists('movimiento_inventario')) {
      console.log('✔️  Tabla movimiento_inventario ya existe');
    } else {
      await db.execute(`
        CREATE TABLE movimiento_inventario (
          id_movimiento        INT AUTO_INCREMENT PRIMARY KEY,
          id_producto          INT NOT NULL,
          id_vendedor          INT NOT NULL,
          tipo_movimiento      ENUM('ENTRADA', 'SALIDA') NOT NULL,
          cantidad             INT NOT NULL,
          costo_unitario       DECIMAL(12,2) NOT NULL DEFAULT 0
            COMMENT 'Costo de compra/producción por unidad',
          precio_venta_unit    DECIMAL(12,2) DEFAULT NULL
            COMMENT 'Precio de venta unitario (solo para SALIDA)',
          id_pedido            INT DEFAULT NULL
            COMMENT 'Referencia al pedido (solo para SALIDA)',
          id_detalle_pedido    INT DEFAULT NULL
            COMMENT 'Referencia al detalle del pedido (solo para SALIDA)',
          ganancia_bruta       DECIMAL(12,2) DEFAULT NULL
            COMMENT '(precio_venta - costo_compra) * cantidad',
          comision_plataforma  DECIMAL(12,2) DEFAULT NULL
            COMMENT 'porcentaje * precio_venta * cantidad',
          ganancia_neta        DECIMAL(12,2) DEFAULT NULL
            COMMENT 'ganancia_bruta - comision_plataforma',
          referencia           VARCHAR(100) DEFAULT NULL,
          observaciones        TEXT DEFAULT NULL,
          fecha                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

          INDEX idx_mov_producto  (id_producto),
          INDEX idx_mov_vendedor  (id_vendedor),
          INDEX idx_mov_tipo      (tipo_movimiento),
          INDEX idx_mov_pedido    (id_pedido),
          INDEX idx_mov_fecha     (fecha),

          CONSTRAINT fk_mov_inv_producto
            FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
            ON DELETE RESTRICT,
          CONSTRAINT fk_mov_inv_vendedor
            FOREIGN KEY (id_vendedor) REFERENCES usuario(id_usuario)
            ON DELETE RESTRICT,
          CONSTRAINT fk_mov_inv_pedido
            FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido)
            ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          COMMENT='Trazabilidad de movimientos de inventario por vendedor (ENTRADA/SALIDA)'
      `);
      console.log('✅ Tabla movimiento_inventario creada');
    }

    // ─── Resumen ───
    console.log('\n📋 Resumen de la migración:');
    console.log('   • producto.costo_compra          → costo de compra por unidad');
    console.log('   • producto.comision_plataforma    → % de comisión (default 5%)');
    console.log('   • movimiento_inventario           → tabla de trazabilidad ENTRADA/SALIDA');
    console.log('\n🎉 Migración completada correctamente.');

  } catch (err) {
    console.error('❌ Error durante la migración:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
