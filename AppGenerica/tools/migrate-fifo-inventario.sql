-- =====================================================
-- MIGRACIÓN: Sistema FIFO para inventario
-- Agregar cantidad_restante a movimiento_inventario
-- Ejecutar en MySQL Workbench sobre la base de datos "tienda"
-- =====================================================

-- 1. Agregar columna cantidad_restante (solo relevante para ENTRADA)
ALTER TABLE movimiento_inventario
  ADD COLUMN IF NOT EXISTS cantidad_restante INT DEFAULT NULL
  COMMENT 'Unidades aún disponibles en este lote (solo ENTRADA, FIFO)';

-- 2. Índice para consultas FIFO eficientes
CREATE INDEX idx_mov_fifo
  ON movimiento_inventario (id_producto, id_vendedor, tipo_movimiento, fecha, cantidad_restante);

-- 3. Migrar datos existentes: inicializar cantidad_restante para ENTRADAS existentes
--    Para cada ENTRADA, cantidad_restante = cantidad - unidades ya consumidas por SALIDAS
--    Si no hay SALIDAS registradas, cantidad_restante = cantidad

-- Paso 3a: Inicializar todas las ENTRADAS con cantidad_restante = cantidad
UPDATE movimiento_inventario
SET cantidad_restante = cantidad
WHERE tipo_movimiento = 'ENTRADA'
  AND cantidad_restante IS NULL;

-- Paso 3b: Descontar de los lotes más antiguos las unidades ya vendidas (FIFO retroactivo)
-- Esto se hace mejor con el script JS: migrate-fifo-datos.js
-- porque MySQL puro no permite iteraciones FIFO fácilmente.
