const servicio = require('../servicios/Estado_pedido.servicios');

exports.obtenerEstados = async (req, res) => {
  try {
    const estados = await servicio.listar();
    res.json(estados);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al obtener estados' });
  }
};

exports.crearEstado = async (req, res) => {
  try {
    const nombre_estado = req.body.nombre_estado || req.body.NombreEstado;

    if (!nombre_estado) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const resultado = await servicio.insertar({ nombre_estado });
    res.status(201).json(resultado);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al crear estado' });
  }
};

exports.actualizarEstado = async (req, res) => {
  try {
    await servicio.actualizar(req.params.id, req.body);
    res.json({ message: 'Estado actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
};

exports.eliminarEstado = async (req, res) => {
  try {
    await servicio.eliminar(req.params.id);
    res.json({ message: 'Estado eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar estado' });
  }
};
