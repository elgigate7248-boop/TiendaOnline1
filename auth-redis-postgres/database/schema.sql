-- ══════════════════════════════════════════════════════════════════════════════
-- Schema MySQL — Referencia de tablas del proyecto (Aiven + Local)
-- ══════════════════════════════════════════════════════════════════════════════
-- NOTA: Estas tablas ya existen en ambas BDs (Aiven remota y MySQL local).
-- Este archivo se incluye como referencia de la estructura utilizada.

-- ── Tabla de usuarios ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuario (
    id_usuario  INT AUTO_INCREMENT PRIMARY KEY,
    nombre      VARCHAR(100)        NOT NULL,
    email       VARCHAR(150) UNIQUE NOT NULL,
    contrasena  VARCHAR(255)        NOT NULL,   -- Hash bcrypt
    telefono    VARCHAR(20)         NULL,
    fecha_registro DATE             NULL,
    rol         VARCHAR(20)         NULL DEFAULT 'CLIENTE'
);

CREATE INDEX idx_usuario_email ON usuario (email);

-- ── Dominio geográfico: estado (departamentos colombianos) ──────────────────
CREATE TABLE IF NOT EXISTS estado (
    id_estado     INT AUTO_INCREMENT PRIMARY KEY,
    nombre_estado VARCHAR(50) NOT NULL
);

-- Datos iniciales: 33 departamentos de Colombia
INSERT INTO estado (id_estado, nombre_estado) VALUES
(1,'Amazonas'),(2,'Antioquia'),(3,'Arauca'),(4,'Atlantico'),
(5,'Bogota D.C.'),(6,'Bolivar'),(7,'Boyaca'),(8,'Caldas'),
(9,'Caqueta'),(10,'Casanare'),(11,'Cauca'),(12,'Cesar'),
(13,'Choco'),(14,'Cordoba'),(15,'Cundinamarca'),(16,'Guainia'),
(17,'Guaviare'),(18,'Huila'),(19,'La Guajira'),(20,'Magdalena'),
(21,'Meta'),(22,'Narino'),(23,'Norte de Santander'),
(24,'Putumayo'),(25,'Quindio'),(26,'Risaralda'),
(27,'San Andres y Providencia'),(28,'Santander'),(29,'Sucre'),
(30,'Tolima'),(31,'Valle del Cauca'),(32,'Vaupes'),(33,'Vichada');

-- ── Tabla de direcciones (con FKs a estado y ciudad) ────────────────────────
CREATE TABLE IF NOT EXISTS direccion (
    id_direccion      INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario        INT          NOT NULL,
    ciudad            VARCHAR(80)  NULL,
    id_estado         INT          NULL,          -- FK → estado (departamento)
    id_ciudad         CHAR(5)      NULL,          -- FK → ciudad (codigo DANE)
    direccion_detalle VARCHAR(255) NULL,
    codigo_postal     VARCHAR(10)  NULL,

    INDEX idx_direccion_estado (id_estado),
    INDEX idx_direccion_ciudad (id_ciudad),

    CONSTRAINT fk_direccion_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_direccion_estado  FOREIGN KEY (id_estado)  REFERENCES estado(id_estado),
    CONSTRAINT fk_direccion_ciudad  FOREIGN KEY (id_ciudad)  REFERENCES ciudad(codigo_dane)
);

-- ── Tabla estado_pedido (dominio de estados de pedido) ──────────────────────
CREATE TABLE IF NOT EXISTS estado_pedido (
    id_estado     INT AUTO_INCREMENT PRIMARY KEY,
    nombre_estado VARCHAR(30) NOT NULL
);

-- pedido.id_estado → estado_pedido.id_estado (FK ya existente)

-- La tabla `rol` y `usuario_rol` ya manejan los roles en el proyecto existente.
-- El sistema de auth con Redis usa la tabla `usuario` tal como está.
