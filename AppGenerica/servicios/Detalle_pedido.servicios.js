const db = require("../db");


async function listar() {
  const [rows] = await db.execute(`
    SELECT 
      d.id_detalle,
      d.id_pedido,
      p.nombre AS producto,
      d.cantidad,
      d.precio_unitario
    FROM detalle_pedido d
    JOIN producto p ON d.id_producto = p.id_producto
  `);
  return rows;
}

async function insertar(detalle) {
  const [result] = await db.execute(
    `INSERT INTO detalle_pedido 
     (id_pedido, id_producto, cantidad, precio_unitario)
     VALUES (?, ?, ?, ?)`,
    [
      detalle.id_pedido,
      detalle.id_producto,
      detalle.cantidad,
      detalle.precio_unitario
    ]
  );

  return {
    message: "Detalle de pedido registrado correctamente",
    insertId: result.insertId
  };
}

async function actualizar(id, detalle) {
  const [result] = await db.execute(
    `UPDATE detalle_pedido
     SET cantidad = ?, precio_unitario = ?
     WHERE id_detalle = ?`,
    [
      detalle.cantidad,
      detalle.precio_unitario,
      id
    ]
  );
  return result.affectedRows;
}


async function eliminar(id) {
  const [result] = await db.execute(
    "DELETE FROM detalle_pedido WHERE id_detalle = ?",
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
