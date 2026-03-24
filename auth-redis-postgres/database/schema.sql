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

-- ── Dominio: departamento_empresa (departamentos internos de la empresa) ────
CREATE TABLE IF NOT EXISTS departamento_empresa (
    id_departamento INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    descripcion     VARCHAR(255) NULL,
    activo          TINYINT(1) DEFAULT 1
);

INSERT INTO departamento_empresa (nombre, descripcion) VALUES
('Ventas', 'Departamento de ventas y comercial'),
('Administracion', 'Departamento de administracion general'),
('Tecnologia', 'Departamento de tecnologia e informatica'),
('Recursos Humanos', 'Departamento de gestion del talento humano'),
('Logistica', 'Departamento de logistica y distribucion'),
('Bodega', 'Departamento de almacen y bodega'),
('Servicio al Cliente', 'Departamento de atencion al cliente'),
('Contabilidad', 'Departamento de contabilidad y finanzas'),
('Marketing', 'Departamento de marketing y publicidad'),
('Gerencia', 'Gerencia general');

-- ── Dominio: puesto (cargos de empleados) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS puesto (
    id_puesto      INT AUTO_INCREMENT PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    descripcion    VARCHAR(255) NULL,
    salario_minimo DECIMAL(10,2) NULL,
    salario_maximo DECIMAL(10,2) NULL,
    activo         TINYINT(1) DEFAULT 1
);

INSERT INTO puesto (nombre, descripcion, salario_minimo, salario_maximo) VALUES
('Gerente General', 'Direccion general de la empresa', 5000000, 10000000),
('Supervisor', 'Supervision de area o departamento', 3000000, 5000000),
('Vendedor', 'Atencion y ventas al publico', 1500000, 2500000),
('Cajero', 'Manejo de caja y cobros', 1300000, 2000000),
('Bodeguero', 'Manejo de inventario y bodega', 1300000, 2000000),
('Repartidor', 'Entrega de pedidos y envios', 1300000, 2200000),
('Analista de Sistemas', 'Soporte tecnico y desarrollo', 2500000, 4500000),
('Contador', 'Gestion contable y tributaria', 2500000, 4000000),
('Auxiliar Administrativo', 'Apoyo en tareas administrativas', 1300000, 1800000),
('Coordinador de Logistica', 'Coordinacion de envios y rutas', 2000000, 3500000),
('Ejecutivo de Servicio al Cliente', 'Atencion y soporte al cliente', 1500000, 2500000),
('Community Manager', 'Manejo de redes sociales y marketing', 1800000, 3000000);

-- ── Dominio: estado_empleado ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estado_empleado (
    id_estado_empleado INT AUTO_INCREMENT PRIMARY KEY,
    nombre             VARCHAR(30) NOT NULL
);

INSERT INTO estado_empleado (nombre) VALUES ('activo'), ('inactivo'), ('suspendido');

-- ── Dominio: estado_solicitud (para vendedor_solicitud y repartidor_solicitud)
CREATE TABLE IF NOT EXISTS estado_solicitud (
    id_estado_solicitud INT AUTO_INCREMENT PRIMARY KEY,
    nombre              VARCHAR(30) NOT NULL
);

INSERT INTO estado_solicitud (nombre) VALUES ('PENDIENTE'), ('APROBADA'), ('RECHAZADA');

-- ── Tabla empleado (con FKs a dominios) ─────────────────────────────────────
-- empleado.id_departamento_empresa → departamento_empresa.id_departamento
-- empleado.id_puesto               → puesto.id_puesto
-- empleado.id_estado_empleado      → estado_empleado.id_estado_empleado

-- ── Tablas de solicitudes (con FK a estado_solicitud) ───────────────────────
-- vendedor_solicitud.id_estado_solicitud   → estado_solicitud.id_estado_solicitud
-- repartidor_solicitud.id_estado_solicitud → estado_solicitud.id_estado_solicitud

-- La tabla `rol` y `usuario_rol` ya manejan los roles en el proyecto existente.
-- El sistema de auth con Redis usa la tabla `usuario` tal como está.
