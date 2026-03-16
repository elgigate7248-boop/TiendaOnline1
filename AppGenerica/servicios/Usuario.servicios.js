const db = require("../db");

async function listarUsuarios() {
  const [rows] = await db.execute(`
    SELECT u.id_usuario, u.nombre, u.email, u.telefono, u.fecha_registro,
           GROUP_CONCAT(r.nombre SEPARATOR ', ') AS roles_texto
    FROM usuario u
    LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
    LEFT JOIN rol r ON r.id_rol = ur.id_rol
    GROUP BY u.id_usuario
    ORDER BY u.id_usuario
  `);
  return rows;
}


async function crearUsuario(usuario) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const fechaRegistro = usuario.fecha_registro ? new Date(usuario.fecha_registro) : new Date();
    const [result] = await conn.execute(
      "INSERT INTO usuario (nombre, email, telefono, contrasena, fecha_registro) VALUES (?, ?, ?, ?, ?)",
      [usuario.nombre, usuario.email, usuario.telefono || null, usuario.password || null, fechaRegistro]
    );
    const idUsuario = result.insertId;

    let roles = Array.isArray(usuario.roles) ? usuario.roles : [];
    if (roles.length === 0) {
      const [rowsRol] = await conn.execute(
        "SELECT id_rol FROM rol WHERE nombre = ? LIMIT 1",
        ["CLIENTE"]
      );
      if (rowsRol && rowsRol[0] && rowsRol[0].id_rol != null) {
        roles = [rowsRol[0].id_rol];
      }
    }

    if (roles.length > 0) {
      for (const idRol of roles) {
        await conn.execute(
          "INSERT INTO usuario_rol (id_usuario, id_rol) VALUES (?, ?)",
          [idUsuario, idRol]
        );
      }
    }
    await conn.commit();
    return idUsuario;
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      throw new Error('El correo ya está registrado.');
    }
    throw new Error('Error al registrar usuario: ' + err.message);
  } finally {
    conn.release();
  }
}

async function buscarUsuarioPorEmail(email) {
  const [rows] = await db.execute(
    "SELECT * FROM usuario WHERE email = ?",
    [email]
  );
  return rows[0];
}


async function buscarUsuarioPorId(id) {
  const [rows] = await db.execute(
    "SELECT * FROM usuario WHERE id_usuario = ?",
    [id]
  );
  return rows[0];
}

async function buscarPorId(id) {
  return buscarUsuarioPorId(id);
}

async function actualizarUsuario(id, usuario) {
  const idUsuario = Number(id);
  if (!Number.isFinite(idUsuario) || idUsuario <= 0) {
    const err = new Error('ID de usuario invalido');
    err.status = 400;
    throw err;
  }

  const updates = [];
  const values = [];

  if (usuario.nombre !== undefined) {
    updates.push('nombre = ?');
    values.push(usuario.nombre);
  }
  if (usuario.email !== undefined) {
    updates.push('email = ?');
    values.push(usuario.email);
  }
  if (usuario.telefono !== undefined) {
    updates.push('telefono = ?');
    values.push(usuario.telefono || null);
  }
  if (usuario.fecha_registro !== undefined) {
    updates.push('fecha_registro = ?');
    values.push(usuario.fecha_registro ? new Date(usuario.fecha_registro) : new Date());
  }

  if (!updates.length) return 0;

  values.push(idUsuario);
  const [result] = await db.execute(
    `UPDATE usuario SET ${updates.join(', ')} WHERE id_usuario = ?`,
    values
  );
  return result.affectedRows;
}

async function eliminarUsuario(id) {
  const idUsuario = Number(id);
  if (!Number.isFinite(idUsuario) || idUsuario <= 0) {
    const err = new Error('ID de usuario invalido');
    err.status = 400;
    throw err;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE FROM usuario_rol WHERE id_usuario = ?", [idUsuario]);
    const [result] = await conn.execute("DELETE FROM usuario WHERE id_usuario = ?", [idUsuario]);
    await conn.commit();
    return result.affectedRows;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  listarUsuarios,
  crearUsuario,
  buscarUsuarioPorId,
  buscarPorId,
  buscarUsuarioPorEmail,
  actualizarUsuario,
  eliminarUsuario
};
