const servicio = require('../servicios/Categoria.servicios');

async function obtenerCategorias(req, res) {
  try {
    console.log('📋 GET /categoria');
    const categorias = await servicio.listar();
    res.json(categorias);
  } catch (err) {
    console.error('❌ Error al obtener categorías:', err.message);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
}

async function crearCategoria(req, res) {
  try {
    const nombre = req.body.nombre || req.body.Nombre;
    const descripcion = req.body.descripcion || req.body.Descripcion;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const resultado = await servicio.insertar({ nombre, descripcion });
    res.status(201).json(resultado);
  } catch (err) {
    console.error('❌ Error al crear categoría:', err.message);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
}

async function actualizarCategoria(req, res) {
  try {
    const { id } = req.params;
    const nombre = req.body.nombre || req.body.Nombre;
    const descripcion = req.body.descripcion || req.body.Descripcion;

    const filas = await servicio.actualizar(id, { nombre, descripcion });
    res.json({ message: 'Categoría actualizada', filas });
  } catch (err) {
    console.error('❌ Error al actualizar categoría:', err.message);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
}

async function eliminarCategoria(req, res) {
  try {
    await servicio.eliminar(req.params.id);
    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (err) {
    console.error('❌ Error al eliminar categoría:', err.message);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
}

module.exports = {
  obtenerCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria
};
