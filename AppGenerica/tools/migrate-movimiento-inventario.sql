-- =====================================================
-- MIGRACIÓN: Sistema de trazabilidad de costos y ventas
-- Ejecutar en MySQL Workbench sobre la base de datos "tienda"
-- =====================================================

-- 1. Agregar columna costo_compra a producto
ALTER TABLE producto
  ADD COLUMN IF NOT EXISTS costo_compra DECIMAL(12,2) NOT NULL DEFAULT 0
  COMMENT 'Costo de compra o producción por unidad';

-- 2. Agregar columna comision_plataforma a producto
ALTER TABLE producto
  ADD COLUMN IF NOT EXISTS comision_plataforma DECIMAL(5,4) NOT NULL DEFAULT 0.0500
  COMMENT 'Porcentaje de comisión de la plataforma (ej: 0.0500 = 5%)';

-- 3. Crear tabla movimiento_inventario
CREATE TABLE IF NOT EXISTS movimiento_inventario (
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
  COMMENT='Trazabilidad de movimientos de inventario por vendedor (ENTRADA/SALIDA)';
