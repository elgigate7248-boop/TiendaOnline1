const servicio = require('../servicios/MovimientoInventario.servicios');

// POST /movimiento-inventario/entrada
exports.registrarEntrada = async (req, res) => {
  try {
    const idVendedor = req.usuario?.id_usuario || req.usuario?.id;
    if (!idVendedor) {
      return res.status(401).json({ error: 'Vendedor no autenticado' });
    }

    const { id_producto, cantidad, costo_unitario, referencia, observaciones } = req.body;

    if (!id_producto || !cantidad || cantidad <= 0) {
      return res.status(400).json({ error: 'Se requiere id_producto y cantidad > 0' });
    }
    if (costo_unitario == null || costo_unitario < 0) {
      return res.status(400).json({ error: 'Se requiere costo_unitario >= 0' });
    }

    const resultado = await servicio.registrarEntrada({
      id_producto: Number(id_producto),
      id_vendedor: idVendedor,
      cantidad: Number(cantidad),
      costo_unitario: Number(costo_unitario),
      referencia,
      observaciones
    });

    res.status(201).json({
      message: 'Entrada de inventario registrada correctamente',
      data: resultado
    });
  } catch (err) {
    console.error('❌ Error al registrar entrada de inventario:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Error al registrar entrada' });
  }
};

// GET /movimiento-inventario/
exports.listarMovimientos = async (req, res) => {
  try {
    const idVendedor = req.usuario?.id_usuario || req.usuario?.id;
    if (!idVendedor) {
      return res.status(401).json({ error: 'Vendedor no autenticado' });
    }

    const { tipo, id_producto, fecha_inicio, fecha_fin, limit, offset } = req.query;

    const movimientos = await servicio.listarPorVendedor(idVendedor, {
      tipo,
      id_producto: id_producto ? Number(id_producto) : undefined,
      fecha_inicio,
      fecha_fin,
      limit,
      offset
    });

    res.json(movimientos);
  } catch (err) {
    console.error('❌ Error al listar movimientos:', err.message);
    res.status(500).json({ error: 'Error al listar movimientos de inventario' });
  }
};

// GET /movimiento-inventario/resumen
exports.resumenFinanciero = async (req, res) => {
  try {
    const idVendedor = req.usuario?.id_usuario || req.usuario?.id;
    if (!idVendedor) {
      return res.status(401).json({ error: 'Vendedor no autenticado' });
    }

    const { fecha_inicio, fecha_fin } = req.query;

    const resumen = await servicio.resumenFinanciero(idVendedor, {
      fecha_inicio,
      fecha_fin
    });

    res.json(resumen);
  } catch (err) {
    console.error('❌ Error al obtener resumen financiero:', err.message);
    res.status(500).json({ error: 'Error al obtener resumen financiero' });
  }
};

// GET /movimiento-inventario/productos-con-movimientos
exports.productosParaSelector = async (req, res) => {
  try {
    const idVendedor = req.usuario?.id_usuario || req.usuario?.id;
    if (!idVendedor) return res.status(401).json({ error: 'Vendedor no autenticado' });
    const productos = await servicio.productosConMovimientos(idVendedor);
    res.json(productos);
  } catch (err) {
    console.error('❌ Error al obtener productos para selector:', err.message);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

// GET /movimiento-inventario/trazabilidad/:id_producto
exports.trazabilidadProducto = async (req, res) => {
  try {
    const idVendedor = req.usuario?.id_usuario || req.usuario?.id;
    if (!idVendedor) return res.status(401).json({ error: 'Vendedor no autenticado' });

    const idProducto = Number(req.params.id_producto);
    if (!Number.isFinite(idProducto) || idProducto <= 0) {
      return res.status(400).json({ error: 'ID de producto inválido' });
    }

    const data = await servicio.trazabilidadProducto(idProducto, idVendedor);
    res.json(data);
  } catch (err) {
    console.error('❌ Error trazabilidad producto:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Error al obtener trazabilidad' });
  }
};

// GET /movimiento-inventario/factura/:idPedido
exports.facturaPorPedido = async (req, res) => {
  try {
    const idVendedor = req.usuario?.id_usuario || req.usuario?.id;
    if (!idVendedor) {
      return res.status(401).json({ error: 'Vendedor no autenticado' });
    }

    const idPedido = Number(req.params.idPedido);
    if (!Number.isFinite(idPedido) || idPedido <= 0) {
      return res.status(400).json({ error: 'ID de pedido inválido' });
    }

    const factura = await servicio.facturaPorPedido(idPedido, idVendedor);
    res.json(factura);
  } catch (err) {
    console.error('❌ Error al generar factura:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Error al generar factura' });
  }
};
