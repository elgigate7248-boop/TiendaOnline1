const vendedorSolicitudServicio = require('../servicios/VendedorSolicitud.servicios');
const rolServicio = require('../servicios/Rol.servicios');

async function crearSolicitud(req, res) {
  try {
    const idUsuario = req.usuario?.id_usuario;
    if (!idUsuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const existente = await vendedorSolicitudServicio.obtenerSolicitudPorUsuario(idUsuario);
    if (existente && existente.estado === 'PENDIENTE') {
      return res.status(400).json({ error: 'Ya tienes una solicitud pendiente' });
    }

    const {
      nombre_tienda,
      telefono,
      ciudad,
      descripcion,
      nit_rut,
      direccion_fiscal,
      nombre_legal,
      doc_representante
    } = req.body;

    if (!nombre_tienda || !telefono || !ciudad || !nit_rut || !direccion_fiscal || !nombre_legal || !doc_representante) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios'
      });
    }

    const id = await vendedorSolicitudServicio.crearSolicitud({
      id_usuario: idUsuario,
      nombre_tienda,
      telefono,
      ciudad,
      descripcion,
      nit_rut,
      direccion_fiscal,
      nombre_legal,
      doc_representante
    });

    res.status(201).json({ mensaje: 'Solicitud enviada', id_solicitud: id });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear solicitud', details: err.message });
  }
}

async function miSolicitud(req, res) {
  try {
    const idUsuario = req.usuario?.id_usuario;
    if (!idUsuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const solicitud = await vendedorSolicitudServicio.obtenerSolicitudPorUsuario(idUsuario);
    res.json(solicitud || null);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar solicitud', details: err.message });
  }
}

async function listar(req, res) {
  try {
    const { estado } = req.query;
    const rows = await vendedorSolicitudServicio.listarSolicitudes(estado || null);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar solicitudes', details: err.message });
  }
}

async function aprobar(req, res) {
  try {
    const idSolicitud = req.params.id;
    const { comentario_admin } = req.body;

    const solicitud = await vendedorSolicitudServicio.obtenerPorId(idSolicitud);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

    if (solicitud.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'Solo se pueden aprobar solicitudes pendientes' });
    }

    // Buscar id_rol VENDEDOR
    const roles = await rolServicio.listar();
    const rolVendedor = roles.find(r => r.nombre === 'VENDEDOR');
    if (!rolVendedor) return res.status(500).json({ error: 'Rol VENDEDOR no existe' });

    await rolServicio.asignarRolAUsuario(solicitud.id_usuario, rolVendedor.id_rol);
    await vendedorSolicitudServicio.actualizarEstado(idSolicitud, 'APROBADA', comentario_admin || null);

    res.json({ mensaje: 'Solicitud aprobada y rol VENDEDOR asignado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al aprobar solicitud', details: err.message });
  }
}

async function rechazar(req, res) {
  try {
    const idSolicitud = req.params.id;
    const { comentario_admin } = req.body;

    const solicitud = await vendedorSolicitudServicio.obtenerPorId(idSolicitud);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

    if (solicitud.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'Solo se pueden rechazar solicitudes pendientes' });
    }

    await vendedorSolicitudServicio.actualizarEstado(idSolicitud, 'RECHAZADA', comentario_admin || null);
    res.json({ mensaje: 'Solicitud rechazada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al rechazar solicitud', details: err.message });
  }
}

module.exports = {
  crearSolicitud,
  miSolicitud,
  listar,
  aprobar,
  rechazar
};
