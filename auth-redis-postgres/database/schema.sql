-- ══════════════════════════════════════════════════════════════════════════════
-- Schema MySQL — Tabla de usuarios (ya existente en Aiven)
-- ══════════════════════════════════════════════════════════════════════════════
-- NOTA: Esta tabla ya existe en la base de datos Aiven del proyecto.
-- Este archivo se incluye como referencia de la estructura utilizada.

CREATE TABLE IF NOT EXISTS usuario (
    id_usuario  INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(100)        NOT NULL,
    email       VARCHAR(150) UNIQUE NOT NULL,
    password    VARCHAR(255)        NOT NULL,   -- Hash bcrypt
    created_at  TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Índice para búsquedas rápidas por email
CREATE INDEX idx_usuario_email ON usuario (email);

-- La tabla `rol` y `usuario_rol` ya manejan los roles en el proyecto existente.
-- El sistema de auth con Redis usa la tabla `usuario` tal como está.
