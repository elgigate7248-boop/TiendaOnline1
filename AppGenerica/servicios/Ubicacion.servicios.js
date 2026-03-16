const db = require("../db");

function mapearErrorTablaNoExiste(error) {
  if (!error) return error;
  if (error.code === 'ER_NO_SUCH_TABLE') {
    const err = new Error('Tablas de ubicación no existen. Ejecuta la migración para crear departamento/ciudad.');
    err.status = 501;
    return err;
  }
  return error;
}

async function listarDepartamentos() {
  try {
    const [rows] = await db.execute(`
      SELECT codigo_dane, nombre
      FROM departamento
      ORDER BY nombre ASC
    `);
    return rows;
  } catch (error) {
    throw mapearErrorTablaNoExiste(error);
  }
}

async function listarCiudadesPorDepartamento(codigoDepartamento) {
  const dep = String(codigoDepartamento || '').trim();
  if (!dep) {
    const err = new Error('El departamento es obligatorio');
    err.status = 400;
    throw err;
  }

  try {
    const [rows] = await db.execute(
      `
      SELECT codigo_dane, nombre, codigo_dane_departamento
      FROM ciudad
      WHERE codigo_dane_departamento = ?
      ORDER BY nombre ASC
      `,
      [dep]
    );
    return rows;
  } catch (error) {
    throw mapearErrorTablaNoExiste(error);
  }
}

module.exports = {
  listarDepartamentos,
  listarCiudadesPorDepartamento
};
