const servicio = require('../servicios/Pago.servicios');

exports.obtenerPagos = async (req, res) => {
  try {
    console.log('📋 GET /pago');
    const pagos = await servicio.listar();
    res.json(pagos);
  } catch (err) {
    console.error('❌ Error al obtener pagos:', err.message);
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
};

exports.crearPago = async (req, res) => {
  console.log('📥 Pago recibido:', req.body);
  try {
    const id_pedido = req.body.id_pedido || req.body.IdPedido;
    const metodo_pago = req.body.metodo_pago || req.body.MetodoPago;
    const monto = req.body.monto || req.body.Monto;

    if (!id_pedido || !metodo_pago || !monto) {
      return res.status(400).json({
        error: 'id_pedido, metodo_pago y monto son obligatorios'
      });
    }

    const resultado = await servicio.insertar({
      id_pedido,
      metodo_pago,
      monto
    });

    res.status(201).json(resultado);
  } catch (err) {
    console.error('❌ Error al crear pago:', err.message);
    res.status(500).json({ error: 'Error al registrar pago' });
  }
};

exports.actualizarPago = async (req, res) => {
  try {
    const metodo_pago = req.body.metodo_pago || req.body.MetodoPago;
    const monto = req.body.monto || req.body.Monto;

    const filas = await servicio.actualizar(req.params.id, {
      metodo_pago,
      monto
    });

    res.json({ message: 'Pago actualizado', filas });
  } catch (err) {
    console.error('❌ Error al actualizar pago:', err.message);
    res.status(500).json({ error: 'Error al actualizar pago' });
  }
};

exports.eliminarPago = async (req, res) => {
  try {
    await servicio.eliminar(req.params.id);
    res.json({ message: 'Pago eliminado correctamente' });
  } catch (err) {
    console.error('❌ Error al eliminar pago:', err.message);
    res.status(500).json({ error: 'Error al eliminar pago' });
  }
};
