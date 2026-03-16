const db = require('../db');

async function obtenerRolesPorUsuario(idUsuario) {
  const [rows] = await db.execute(
    `SELECT r.id_rol, r.nombre
     FROM rol r
     JOIN usuario_rol ur ON r.id_rol = ur.id_rol
     WHERE ur.id_usuario = ?`,
    [idUsuario]
  );

  return rows.map(r => ({ id_rol: r.id_rol, nombre: r.nombre }));
}

async function listar() {
  const [rows] = await db.execute('SELECT id_rol, nombre FROM rol ORDER BY nombre');
  return rows;
}

async function buscarPorId(idRol) {
  const [rows] = await db.execute('SELECT id_rol, nombre FROM rol WHERE id_rol = ?', [idRol]);
  return rows[0];
}

async function asignarRolAUsuario(idUsuario, idRol) {
  const [result] = await db.execute(
    'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES (?, ?)',
    [idUsuario, idRol]
  );
  return result.insertId;
}

async function quitarRolAUsuario(idUsuario, idRol) {
  const [result] = await db.execute(
    'DELETE FROM usuario_rol WHERE id_usuario = ? AND id_rol = ?',
    [idUsuario, idRol]
  );
  return result.affectedRows;
}

module.exports = {
  obtenerRolesPorUsuario,
  listar,
  buscarPorId,
  asignarRolAUsuario,
  quitarRolAUsuario
};
