const servicio = require('../servicios/Detalle_pedido.servicios');

exports.obtenerDetalles = async (req, res) => {
  try {
    console.log('📋 GET /detalle-pedido');
    const detalles = await servicio.listar();
    res.json(detalles);
  } catch (err) {
    console.error('❌ Error al obtener detalles:', err.message);
    res.status(500).json({ error: 'Error al obtener detalles del pedido' });
  }
};

exports.crearDetalle = async (req, res) => {
  console.log('📥 Detalle recibido:', req.body);
  try {
    const id_pedido = req.body.id_pedido || req.body.IdPedido;
    const id_producto = req.body.id_producto || req.body.IdProducto;
    const cantidad = req.body.cantidad || req.body.Cantidad;
    const precio_unitario = req.body.precio_unitario || req.body.PrecioUnitario;

    if (!id_pedido || !id_producto || !cantidad || !precio_unitario) {
      return res.status(400).json({
        error: 'Todos los campos son obligatorios'
      });
    }

    const resultado = await servicio.insertar({
      id_pedido,
      id_producto,
      cantidad,
      precio_unitario
    });

    res.status(201).json(resultado);
  } catch (err) {
    console.error('❌ Error al crear detalle:', err.message);
    res.status(500).json({ error: 'Error al crear detalle del pedido' });
  }
};

exports.actualizarDetalle = async (req, res) => {
  try {
    const cantidad = req.body.cantidad || req.body.Cantidad;
    const precio_unitario = req.body.precio_unitario || req.body.PrecioUnitario;

    const filas = await servicio.actualizar(req.params.id, {
      cantidad,
      precio_unitario
    });

    res.json({ message: 'Detalle actualizado', filas });
  } catch (err) {
    console.error('❌ Error al actualizar detalle:', err.message);
    res.status(500).json({ error: 'Error al actualizar detalle' });
  }
};

exports.eliminarDetalle = async (req, res) => {
  try {
    await servicio.eliminar(req.params.id);
    res.json({ message: 'Detalle eliminado correctamente' });
  } catch (err) {
    console.error('❌ Error al eliminar detalle:', err.message);
    res.status(500).json({ error: 'Error al eliminar detalle' });
  }
};
