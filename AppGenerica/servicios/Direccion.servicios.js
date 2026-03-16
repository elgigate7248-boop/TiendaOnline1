const db = require("../db");


async function listar() {
  const [rows] = await db.execute(`
    SELECT id_direccion, id_usuario, ciudad, codigo_postal
    FROM direccion
  `);
  return rows;
}


async function insertar(direccion) {
  const [result] = await db.execute(
    `INSERT INTO direccion (id_usuario, ciudad, codigo_postal)
     VALUES (?, ?, ?)`,
    [
      direccion.id_usuario,
      direccion.ciudad || null,
      direccion.codigo_postal || null
    ]
  );

  return {
    message: "Dirección registrada correctamente",
    insertId: result.insertId
  };
}


async function actualizar(id, direccion) {
  const [result] = await db.execute(
    `UPDATE direccion
     SET ciudad = ?, codigo_postal = ?
     WHERE id_direccion = ?`,
    [
      direccion.ciudad || null,
      direccion.codigo_postal || null,
      id
    ]
  );

  return result.affectedRows;
}


async function eliminar(id) {
  const [result] = await db.execute(
    "DELETE FROM direccion WHERE id_direccion = ?",
    [id]
  );
  return result.affectedRows;
}

module.exports = {
  listar,
  insertar,
  actualizar,
  eliminar
};
