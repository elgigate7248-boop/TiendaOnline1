const db = require('../db');

async function crearSolicitud(payload) {
  const { id_usuario, telefono, ciudad, vehiculo, descripcion } = payload;

  const [result] = await db.execute(
    `INSERT INTO repartidor_solicitud
      (id_usuario, telefono, ciudad, vehiculo, descripcion, estado)
     VALUES (?, ?, ?, ?, ?, 'PENDIENTE')`,
    [id_usuario, telefono, ciudad, vehiculo, descripcion || null]
  );

  return result.insertId;
}

async function obtenerSolicitudPorUsuario(idUsuario) {
  const [rows] = await db.execute(
    `SELECT * FROM repartidor_solicitud WHERE id_usuario = ? ORDER BY fecha_creacion DESC LIMIT 1`,
    [idUsuario]
  );
  return rows[0];
}

async function listarSolicitudes(estado = null) {
  const params = [];
  let where = '';
  if (estado) {
    where = 'WHERE rs.estado = ?';
    params.push(estado);
  }

  const [rows] = await db.execute(
    `SELECT rs.*, u.nombre AS usuario_nombre, u.email AS usuario_email
     FROM repartidor_solicitud rs
     JOIN usuario u ON u.id_usuario = rs.id_usuario
     ${where}
     ORDER BY rs.fecha_creacion DESC`,
    params
  );
  return rows;
}

async function actualizarEstado(idSolicitud, estado, comentario_admin = null) {
  const [result] = await db.execute(
    `UPDATE repartidor_solicitud
     SET estado = ?, comentario_admin = ?, fecha_resolucion = NOW()
     WHERE id_solicitud = ?`,
    [estado, comentario_admin, idSolicitud]
  );
  return result.affectedRows;
}

async function obtenerPorId(idSolicitud) {
  const [rows] = await db.execute(
    'SELECT * FROM repartidor_solicitud WHERE id_solicitud = ?',
    [idSolicitud]
  );
  return rows[0];
}

module.exports = {
  crearSolicitud,
  obtenerSolicitudPorUsuario,
  listarSolicitudes,
  actualizarEstado,
  obtenerPorId
};
