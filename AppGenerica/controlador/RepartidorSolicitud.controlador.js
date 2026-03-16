const repartidorSolicitudServicio = require('../servicios/RepartidorSolicitud.servicios');
const rolServicio = require('../servicios/Rol.servicios');

async function crearSolicitud(req, res) {
  try {
    const idUsuario = req.usuario?.id_usuario;
    if (!idUsuario) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const existente = await repartidorSolicitudServicio.obtenerSolicitudPorUsuario(idUsuario);
    if (existente && existente.estado === 'PENDIENTE') {
      return res.status(400).json({ error: 'Ya tienes una solicitud pendiente' });
    }

    const { telefono, ciudad, vehiculo, descripcion } = req.body;

    if (!telefono || !ciudad || !vehiculo) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: teléfono, ciudad y vehículo' });
    }

    const id = await repartidorSolicitudServicio.crearSolicitud({
      id_usuario: idUsuario,
      telefono,
      ciudad,
      vehiculo,
      descripcion
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
    const solicitud = await repartidorSolicitudServicio.obtenerSolicitudPorUsuario(idUsuario);
    res.json(solicitud || null);
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar solicitud', details: err.message });
  }
}

async function listar(req, res) {
  try {
    const { estado } = req.query;
    const rows = await repartidorSolicitudServicio.listarSolicitudes(estado || null);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar solicitudes', details: err.message });
  }
}

async function aprobar(req, res) {
  try {
    const idSolicitud = req.params.id;
    const { comentario_admin } = req.body;

    const solicitud = await repartidorSolicitudServicio.obtenerPorId(idSolicitud);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (solicitud.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'Solo se pueden aprobar solicitudes pendientes' });
    }

    const roles = await rolServicio.listar();
    const rolRepartidor = roles.find(r => r.nombre === 'REPARTIDOR');
    if (!rolRepartidor) return res.status(500).json({ error: 'Rol REPARTIDOR no existe en la base de datos' });

    await rolServicio.asignarRolAUsuario(solicitud.id_usuario, rolRepartidor.id_rol);
    await repartidorSolicitudServicio.actualizarEstado(idSolicitud, 'APROBADA', comentario_admin || null);

    res.json({ mensaje: 'Solicitud aprobada y rol REPARTIDOR asignado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al aprobar solicitud', details: err.message });
  }
}

async function rechazar(req, res) {
  try {
    const idSolicitud = req.params.id;
    const { comentario_admin } = req.body;

    const solicitud = await repartidorSolicitudServicio.obtenerPorId(idSolicitud);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (solicitud.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: 'Solo se pueden rechazar solicitudes pendientes' });
    }

    await repartidorSolicitudServicio.actualizarEstado(idSolicitud, 'RECHAZADA', comentario_admin || null);
    res.json({ mensaje: 'Solicitud rechazada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al rechazar solicitud', details: err.message });
  }
}

module.exports = { crearSolicitud, miSolicitud, listar, aprobar, rechazar };
