const servicio = require("../servicios/Pedido.servicios");
const EmailService = require("../services/EmailService");

exports.obtenerPedidos = async (req, res) => {
  try {
    console.log('📋 GET /pedido');
    const pedidos = await servicio.listar();
    res.json(pedidos);
  } catch (err) {
    console.error('❌ Error al obtener pedidos:', err.message);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
};

exports.obtenerMisPedidos = async (req, res) => {
  try {
    console.log('📋 GET /pedido/mis-pedidos');
    const idUsuario = req.usuario?.id;
    if (!idUsuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const pedidos = await servicio.listarPorUsuario(idUsuario);
    res.json(pedidos);
  } catch (err) {
    console.error('❌ Error al obtener mis pedidos:', err.message);
    res.status(500).json({ error: 'Error al obtener mis pedidos' });
  }
};

exports.obtenerPedidosVendedor = async (req, res) => {
  try {
    console.log('📋 GET /pedido/mis-pedidos-vendedor');
    const idVendedor = req.usuario?.id_usuario || req.usuario?.id;
    if (!idVendedor) {
      return res.status(401).json({ error: 'Vendedor no autenticado' });
    }

    const pedidos = await servicio.listarPorVendedor(idVendedor);
    res.json(pedidos);
  } catch (err) {
    console.error('❌ Error al obtener pedidos del vendedor:', err.message);
    res.status(500).json({ error: 'Error al obtener pedidos del vendedor' });
  }
};

exports.obtenerPedidosRepartidor = async (req, res) => {
  try {
    console.log('📋 GET /pedido/repartidor/asignados');
    const pedidos = await servicio.listarParaRepartidor();
    res.json(pedidos);
  } catch (err) {
    console.error('❌ Error al obtener pedidos para repartidor:', err.message);
    res.status(500).json({ error: 'Error al obtener pedidos para repartidor' });
  }
};

exports.crearPedido = async (req, res) => {
  console.log('📥 Pedido recibido:', req.body);
  try {
    const id_usuario = req.usuario?.id_usuario || req.usuario?.id;
    const id_estado = req.body.id_estado || req.body.IdEstado || 1;
    const metodo_pago = req.body.metodo_pago || req.body.metodoPago || req.body.MetodoPago;
    const detalles = Array.isArray(req.body.detalles) ? req.body.detalles : [];

    if (!id_usuario) {
      return res.status(400).json({
        error: 'Usuario autenticado requerido para crear pedido'
      });
    }

    if (!detalles.length) {
      return res.status(400).json({
        error: 'El pedido debe incluir al menos un detalle'
      });
    }

    const totalCalculado = detalles.reduce((acc, detalle) => {
      const cantidad = Number(detalle.cantidad) || 0;
      const precio = Number(detalle.precio_unitario) || 0;
      return acc + (cantidad * precio);
    }, 0);

    if (totalCalculado <= 0) {
      return res.status(400).json({
        error: 'El total del pedido no es valido'
      });
    }

    const resultado = await servicio.insertar({
      id_usuario,
      id_estado,
      total: totalCalculado,
      detalles,
      metodo_pago
    });

    // Enviar email de confirmación del pedido
    try {
      const emailService = new EmailService();
      const orderData = {
        pedido: {
          id_pedido: resultado.insertId,
          fecha_pedido: new Date(),
          total: totalCalculado,
          metodo_pago: metodo_pago || 'Pendiente'
        },
        cliente: {
          nombre: req.usuario?.nombre || 'Cliente',
          email: req.usuario?.email || 'cliente@tienda.com'
        },
        items: detalles
      };

      await emailService.sendOrderConfirmation(orderData);
      console.log('📧 Email de confirmación enviado para pedido:', resultado.insertId);
    } catch (emailError) {
      console.error('❌ Error enviando email de confirmación:', emailError.message);
      // No fallar el pedido si el email falla
    }

    res.status(201).json(resultado);
  } catch (err) {
    console.error('❌ Error al crear pedido:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Error al crear pedido' });
  }
};

exports.crearPedidoAdmin = async (req, res) => {
  try {
    const id_usuario = Number(req.body.id_usuario || req.body.IdUsuario);
    const id_estado = Number(req.body.id_estado || req.body.IdEstado || 1);
    const total = Number(req.body.total || req.body.Total || 0);
    const fecha_pedido = req.body.fecha_pedido || req.body.FechaPedido || new Date();

    if (!Number.isFinite(id_usuario) || id_usuario <= 0) {
      return res.status(400).json({ error: 'Usuario invalido' });
    }
    if (!Number.isFinite(id_estado) || id_estado <= 0) {
      return res.status(400).json({ error: 'Estado de pedido invalido' });
    }
    if (!Number.isFinite(total) || total < 0) {
      return res.status(400).json({ error: 'Total invalido' });
    }

    const resultado = await servicio.insertar({
      id_usuario,
      id_estado,
      total,
      fecha_pedido,
      detalles: []
    });

    res.status(201).json(resultado);
  } catch (err) {
    console.error('❌ Error al crear pedido desde admin:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Error al crear pedido' });
  }
};

exports.obtenerPedidoPorId = async (req, res) => {
  try {
    const pedido = await servicio.buscarPorId(req.params.id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    res.json(pedido);
  } catch (err) {
    console.error('❌ Error al buscar pedido:', err.message);
    res.status(500).json({ error: 'Error al buscar pedido' });
  }
};

// Transiciones de estado permitidas por rol
// Estados: 1=Pendiente, 2=Confirmado, 3=Preparando, 4=En camino, 5=Entregado, 6=Cancelado
const TRANSICIONES_POR_ROL = {
  CLIENTE:    { 1: [6], 2: [6] },
  VENDEDOR:   { 1: [2, 6], 2: [3, 6], 3: [4] },
  REPARTIDOR: { 2: [3], 3: [4], 4: [5] },
  ADMIN:      null, // null = cualquier transición
  SUPER_ADMIN: null
};

exports.actualizarPedido = async (req, res) => {
  try {
    const userRoles = req.usuario.roles || (req.usuario.rol ? [req.usuario.rol] : []);
    const isCliente = userRoles.includes('CLIENTE');
    const isVendedor = userRoles.includes('VENDEDOR');
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');

    const pedido = await servicio.buscarPorId(req.params.id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // CLIENTE solo puede modificar sus propios pedidos
    if (isCliente) {
      if (pedido.id_usuario !== req.usuario.id_usuario && pedido.id_usuario !== req.usuario.id) {
        return res.status(403).json({ error: 'Solo puedes modificar tus propios pedidos' });
      }
    }

    if (isVendedor && !isAdmin) {
      const idVendedor = req.usuario.id_usuario || req.usuario.id;
      const tienePedidoAsignado = await servicio.vendedorTienePedido(req.params.id, idVendedor);
      if (!tienePedidoAsignado) {
        return res.status(403).json({ error: 'No puedes modificar pedidos que no contienen tus productos' });
      }
    }

    // Validar transición de estado por rol
    const nuevoEstado = Number(req.body.id_estado || req.body.IdEstado);
    if (nuevoEstado && !isAdmin) {
      const estadoActual = pedido.id_estado;
      let permitido = false;

      for (const rol of userRoles) {
        const transiciones = TRANSICIONES_POR_ROL[rol];
        if (transiciones === null) { permitido = true; break; }
        if (transiciones && transiciones[estadoActual] && transiciones[estadoActual].includes(nuevoEstado)) {
          permitido = true; break;
        }
      }

      if (!permitido) {
        return res.status(403).json({
          error: `No puedes cambiar el estado de ${estadoActual} a ${nuevoEstado} con tu rol`
        });
      }
    }

    if (isVendedor && !isAdmin) {
      if (
        req.body.id_usuario !== undefined ||
        req.body.IdUsuario !== undefined ||
        req.body.total !== undefined ||
        req.body.Total !== undefined ||
        req.body.fecha_pedido !== undefined ||
        req.body.FechaPedido !== undefined
      ) {
        return res.status(403).json({ error: 'Vendedor solo puede actualizar el estado del pedido' });
      }

      if (!nuevoEstado) {
        return res.status(400).json({ error: 'Debes enviar id_estado para actualizar el pedido' });
      }
    }

    const payload = {
      id_usuario: req.body.id_usuario || req.body.IdUsuario,
      id_estado: req.body.id_estado || req.body.IdEstado,
      total: req.body.total || req.body.Total,
      fecha_pedido: req.body.fecha_pedido || req.body.FechaPedido
    };
    const filas = await servicio.actualizar(req.params.id, payload);
    if (!filas) {
      return res.status(404).json({ error: 'Pedido no encontrado o sin cambios' });
    }
    res.json({ message: 'Pedido actualizado', filas });
  } catch (err) {
    console.error('❌ Error al actualizar pedido:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Error al actualizar pedido' });
  }
};

exports.eliminarPedido = async (req, res) => {
  try {
    const filas = await servicio.eliminar(req.params.id);
    if (!filas) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    res.json({ message: 'Pedido eliminado correctamente' });
  } catch (err) {
    console.error('❌ Error al eliminar pedido:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Error al eliminar pedido' });
  }
};

exports.obtenerResumenReportes = async (req, res) => {
  try {
    const top = req.query.top;
    const resumen = await servicio.obtenerResumenReportes(top);
    res.json(resumen);
  } catch (err) {
    console.error('❌ Error al obtener resumen de reportes:', err.message);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
};

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

exports.exportarResumenReportesCsv = async (req, res) => {
  try {
    const top = req.query.top;
    const resumen = await servicio.obtenerResumenReportes(top);
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10);
    const lines = [];

    lines.push('Seccion,Campo,Valor');
    lines.push(`Totales,Total pedidos,${csvEscape(resumen.totales?.total_pedidos || 0)}`);
    lines.push(`Totales,Ventas totales,${csvEscape(resumen.totales?.ventas_totales || 0)}`);
    lines.push(`Totales,Ticket promedio,${csvEscape(resumen.totales?.ticket_promedio || 0)}`);
    lines.push('');

    lines.push('Pedidos por estado');
    lines.push('Estado,Cantidad,Total');
    (resumen.por_estado || []).forEach((item) => {
      lines.push(`${csvEscape(item.estado)},${csvEscape(item.cantidad)},${csvEscape(item.total)}`);
    });
    lines.push('');

    lines.push('Top productos');
    lines.push('Producto,Unidades,Ingresos');
    (resumen.top_productos || []).forEach((item) => {
      lines.push(`${csvEscape(item.nombre)},${csvEscape(item.unidades)},${csvEscape(item.ingresos)}`);
    });
    lines.push('');

    lines.push('Ventas mensuales');
    lines.push('Periodo,Pedidos,Ventas');
    (resumen.ventas_mensuales || []).forEach((item) => {
      lines.push(`${csvEscape(item.periodo)},${csvEscape(item.pedidos)},${csvEscape(item.ventas)}`);
    });

    const csv = '\uFEFF' + lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_tienda_${fecha}.csv"`);
    res.status(200).send(csv);
  } catch (err) {
    console.error('❌ Error al exportar reporte CSV:', err.message);
    res.status(500).json({ error: 'Error al exportar reporte CSV' });
  }
};
