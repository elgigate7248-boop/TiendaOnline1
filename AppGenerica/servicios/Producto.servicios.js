const db = require("../db");
const MAX_IMAGE_CHARS = Number(process.env.MAX_IMAGE_CHARS || (4 * 1024 * 1024)); // ~4MB en texto/base64

let _hasCiudadOrigenPromise;
async function hasCiudadOrigen() {
  if (!_hasCiudadOrigenPromise) {
    _hasCiudadOrigenPromise = (async () => {
      try {
        const [rows] = await db.execute("SHOW COLUMNS FROM producto LIKE 'ciudad_origen'");
        return Array.isArray(rows) && rows.length > 0;
      } catch {
        return false;
      }
    })();
  }
  return _hasCiudadOrigenPromise;
}

function normalizarImagen(imagen) {
  const value = (imagen ?? '').toString().trim();
  if (!value) return null;
  if (value.length > MAX_IMAGE_CHARS) {
    const err = new Error('La imagen es demasiado grande para almacenarse. Usa una imagen mas liviana.');
    err.status = 413;
    throw err;
  }
  return value;
}

function mapearErrorDbImagen(error) {
  if (error && (error.code === 'ER_DATA_TOO_LONG' || error.errno === 1406)) {
    const err = new Error('La imagen supera el tamano permitido por la base de datos. Usa una imagen mas liviana.');
    err.status = 413;
    return err;
  }
  return error;
}


async function listar() {
  const includeCiudad = await hasCiudadOrigen();
  const [rows] = await db.execute(`
    SELECT 
      p.id_producto,
      p.nombre,
      p.descripcion,
      p.precio,
      p.stock,
      p.id_categoria,
      p.imagen,
      ${includeCiudad ? 'p.ciudad_origen,' : ''}
      p.id_vendedor,
      c.nombre AS categoria_nombre,
      v.nombre AS vendedor_nombre,
      v.email  AS vendedor_email
    FROM producto p
    LEFT JOIN categoria c ON c.id_categoria = p.id_categoria
    LEFT JOIN usuario v ON v.id_usuario = p.id_vendedor
  `);
  return rows;
}

async function listarPorVendedor(idVendedor) {
  const includeCiudad = await hasCiudadOrigen();
  const [rows] = await db.execute(
    `
    SELECT 
      p.id_producto,
      p.nombre,
      p.descripcion,
      p.precio,
      p.stock,
      p.id_categoria,
      p.imagen,
      ${includeCiudad ? 'p.ciudad_origen,' : ''}
      p.id_vendedor,
      c.nombre AS categoria_nombre,
      v.nombre AS vendedor_nombre,
      v.email  AS vendedor_email
    FROM producto p
    LEFT JOIN categoria c ON c.id_categoria = p.id_categoria
    LEFT JOIN usuario v ON v.id_usuario = p.id_vendedor
    WHERE p.id_vendedor = ?
    `,
    [idVendedor]
  );
  return rows;
}


async function buscarPorId(id) {
  const includeCiudad = await hasCiudadOrigen();
  const [rows] = await db.execute(
    `
    SELECT 
      p.id_producto,
      p.nombre,
      p.descripcion,
      p.precio,
      p.stock,
      p.id_categoria,
      p.imagen,
      ${includeCiudad ? 'p.ciudad_origen,' : ''}
      p.id_vendedor,
      p.costo_compra,
      p.comision_plataforma
    FROM producto p
    WHERE p.id_producto = ?
    `,
    [id]
  );
  return rows[0];
}


async function masVendidosPorCategoria(idCategoria, limit = 6) {
  const top = Math.max(1, Math.min(Number(limit) || 6, 24));
  const includeCiudad = await hasCiudadOrigen();
  const [rows] = await db.query(
    `
    SELECT
      p.id_producto,
      p.nombre,
      p.precio,
      p.stock,
      p.id_categoria,
      p.imagen,
      ${includeCiudad ? 'p.ciudad_origen,' : ''}
      COALESCE(SUM(dp.cantidad), 0) AS vendidos
    FROM producto p
    LEFT JOIN detalle_pedido dp ON dp.id_producto = p.id_producto
    WHERE p.id_categoria = ?
    GROUP BY p.id_producto
    ORDER BY vendidos DESC, p.id_producto DESC
    LIMIT ?
    `,
    [idCategoria, top]
  );
  return rows;
}


async function crearProducto(datos, idVendedor) {
  const { id_categoria, nombre, descripcion, precio, stock, imagen, ciudad_origen, costo_compra, comision_plataforma } = datos;
  const includeCiudad = await hasCiudadOrigen();
  const costoVal = (costo_compra != null && costo_compra !== '') ? Number(costo_compra) : 0;
  const comisionVal = (comision_plataforma != null && comision_plataforma !== '') ? Number(comision_plataforma) : 0.05;
  const sql = includeCiudad
    ? `INSERT INTO producto (id_categoria, nombre, descripcion, precio, stock, imagen, ciudad_origen, id_vendedor, costo_compra, comision_plataforma) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    : `INSERT INTO producto (id_categoria, nombre, descripcion, precio, stock, imagen, id_vendedor, costo_compra, comision_plataforma) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  try {
    const imagenNormalizada = normalizarImagen(imagen);
    const values = includeCiudad
      ? [id_categoria, nombre, descripcion, precio, stock, imagenNormalizada, ciudad_origen || null, idVendedor || null, costoVal, comisionVal]
      : [id_categoria, nombre, descripcion, precio, stock, imagenNormalizada, idVendedor || null, costoVal, comisionVal];
    const [result] = await db.execute(sql, values);
    return result.insertId;
  } catch (error) {
    throw mapearErrorDbImagen(error);
  }
}


async function insertar(producto) {
  try {
    const includeCiudad = await hasCiudadOrigen();
    const imagenNormalizada = normalizarImagen(producto.imagen);
    const sql = includeCiudad
      ? `INSERT INTO producto (nombre, precio, stock, id_categoria, imagen, ciudad_origen)
       VALUES (?, ?, ?, ?, ?, ?)`
      : `INSERT INTO producto (nombre, precio, stock, id_categoria, imagen)
       VALUES (?, ?, ?, ?, ?)`;
    const values = includeCiudad
      ? [producto.nombre, producto.precio, producto.stock, producto.id_categoria, imagenNormalizada, producto.ciudad_origen || null]
      : [producto.nombre, producto.precio, producto.stock, producto.id_categoria, imagenNormalizada];
    const [result] = await db.execute(sql, values);

    return {
      message: "Producto creado correctamente",
      insertId: result.insertId
    };
  } catch (error) {
    throw mapearErrorDbImagen(error);
  }
}


async function actualizar(id, producto) {
  try {
    const includeCiudad = await hasCiudadOrigen();
    const imagenNormalizada = normalizarImagen(producto.imagen);
    const costoVal = (producto.costo_compra != null && producto.costo_compra !== '') ? Number(producto.costo_compra) : undefined;
    const comisionVal = (producto.comision_plataforma != null && producto.comision_plataforma !== '') ? Number(producto.comision_plataforma) : undefined;
    let setClauses = 'nombre = ?, precio = ?, stock = ?, id_categoria = ?, imagen = ?';
    let values = [producto.nombre, producto.precio, producto.stock, producto.id_categoria, imagenNormalizada];
    if (includeCiudad) {
      setClauses += ', ciudad_origen = ?';
      values.push(producto.ciudad_origen || null);
    }
    if (costoVal !== undefined) {
      setClauses += ', costo_compra = ?';
      values.push(costoVal);
    }
    if (comisionVal !== undefined) {
      setClauses += ', comision_plataforma = ?';
      values.push(comisionVal);
    }
    values.push(id);
    const sql = `UPDATE producto SET ${setClauses} WHERE id_producto = ?`;
    const [result] = await db.execute(sql, values);
    return result.affectedRows;
  } catch (error) {
    throw mapearErrorDbImagen(error);
  }
}


async function eliminar(id) {
  const idProducto = Number(id);
  if (!Number.isFinite(idProducto) || idProducto <= 0) {
    const err = new Error('ID de producto inválido');
    err.status = 400;
    throw err;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [[usoEnPedidos]] = await connection.execute(
      `SELECT COUNT(*) AS total
       FROM detalle_pedido
       WHERE id_producto = ?`,
      [idProducto]
    );

    if (Number(usoEnPedidos?.total || 0) > 0) {
      const err = new Error('No se puede eliminar el producto porque ya está asociado a pedidos.');
      err.status = 409;
      throw err;
    }

    await connection.execute(
      `DELETE FROM producto_atributo WHERE id_producto = ?`,
      [idProducto]
    );

    const [result] = await connection.execute(
      `DELETE FROM producto WHERE id_producto = ?`,
      [idProducto]
    );

    await connection.commit();
    return result.affectedRows;
  } catch (error) {
    await connection.rollback();
    if (error && (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451)) {
      const err = new Error('No se puede eliminar el producto porque tiene registros relacionados.');
      err.status = 409;
      throw err;
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function obtenerAtributosPorProducto(idProducto) {
  const [rows] = await db.execute(
    `SELECT seccion, atributo, valor FROM producto_atributo WHERE id_producto = ? ORDER BY seccion, atributo`,
    [idProducto]
  );
  return rows;
}

async function crearAtributo(idProducto, seccion, atributo, valor) {
  const [result] = await db.execute(
    `INSERT INTO producto_atributo (id_producto, seccion, atributo, valor) VALUES (?, ?, ?, ?)`,
    [idProducto, seccion, atributo, valor]
  );
  return result.insertId;
}

async function eliminarAtributo(idAtributo) {
  const [result] = await db.execute(
    `DELETE FROM producto_atributo WHERE id_atributo = ?`,
    [idAtributo]
  );
  return result.affectedRows;
}

async function reemplazarAtributos(idProducto, atributos) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM producto_atributo WHERE id_producto = ?', [idProducto]);
    if (Array.isArray(atributos) && atributos.length) {
      for (const a of atributos) {
        await conn.execute(
          'INSERT INTO producto_atributo (id_producto, seccion, atributo, valor) VALUES (?, ?, ?, ?)',
          [idProducto, a.seccion, a.atributo, a.valor]
        );
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  listar,
  listarPorVendedor,
  buscarPorId,
  masVendidosPorCategoria,
  crearProducto,
  insertar,
  actualizar,
  eliminar,
  obtenerAtributosPorProducto,
  crearAtributo,
  eliminarAtributo,
  reemplazarAtributos
};
