const servicio = require('../servicios/Ubicacion.servicios');

exports.obtenerDepartamentos = async (req, res) => {
  try {
    const rows = await servicio.listarDepartamentos();
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Error al listar departamentos' });
  }
};

exports.obtenerCiudades = async (req, res) => {
  try {
    const departamento = req.query.departamento;
    const rows = await servicio.listarCiudadesPorDepartamento(departamento);
    res.json(rows);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Error al listar ciudades' });
  }
};
