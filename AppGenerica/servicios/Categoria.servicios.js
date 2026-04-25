const db = require("../db");

async function listar() {
  const [rows] = await db.execute(
    "SELECT id_categoria, nombre, descripcion FROM categoria"
  );
  return rows;
}

async function insertar(categoria) {
  const [result] = await db.execute(
    "INSERT INTO categoria (nombre, descripcion) VALUES (?, ?)",
    [
      categoria.nombre,
      categoria.descripcion || null
    ]
  );

  return {
    message: "Categoría registrada correctamente",
    insertId: result.insertId
  };
}

async function actualizar(id, categoria) {
  const [result] = await db.execute(
    `UPDATE categoria
     SET nombre = ?, descripcion = ?
     WHERE id_categoria = ?`,
    [
      categoria.nombre,
      categoria.descripcion || null,
      id
    ]
  );
  return result.affectedRows;
}

async function eliminar(id) {
  const [[uso]] = await db.execute(
    "SELECT COUNT(*) AS total FROM producto WHERE id_categoria = ?",
    [id]
  );
  if (Number(uso?.total || 0) > 0) {
    const err = new Error('No se puede eliminar la categoría porque tiene productos asociados.');
    err.status = 409;
    throw err;
  }
  const [result] = await db.execute(
    "DELETE FROM categoria WHERE id_categoria = ?",
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
