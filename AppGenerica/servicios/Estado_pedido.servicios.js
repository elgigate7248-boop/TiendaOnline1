const db = require("../db");

async function listar() {
  const [rows] = await db.execute(
    "SELECT * FROM estado_pedido"
  );
  return rows;
}

async function insertar(estado) {
  const [result] = await db.execute(
    "INSERT INTO estado_pedido (nombre_estado) VALUES (?)",
    [estado.nombre_estado]
  );

  return {
    message: "Estado de pedido creado",
    insertId: result.insertId
  };
}

async function actualizar(id, estado) {
  const [result] = await db.execute(
    "UPDATE estado_pedido SET nombre_estado = ? WHERE id_estado = ?",
    [estado.nombre_estado, id]
  );
  return result.affectedRows;
}

async function eliminar(id) {
  const [result] = await db.execute(
    "DELETE FROM estado_pedido WHERE id_estado = ?",
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
