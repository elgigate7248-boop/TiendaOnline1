-- Tabla para solicitudes de rol REPARTIDOR
-- Ejecutar en la base de datos antes de iniciar el servidor

CREATE TABLE IF NOT EXISTS repartidor_solicitud (
  id_solicitud      INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario        INT NOT NULL,
  telefono          VARCHAR(30) NOT NULL,
  ciudad            VARCHAR(100) NOT NULL,
  vehiculo          VARCHAR(50) NOT NULL,
  descripcion       TEXT NULL,
  estado            ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
  comentario_admin  TEXT NULL,
  fecha_creacion    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_resolucion  DATETIME NULL,
  CONSTRAINT fk_repartidor_solicitud_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);
