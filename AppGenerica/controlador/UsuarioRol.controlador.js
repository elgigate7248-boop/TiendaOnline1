const usuarioServicio = require('../servicios/Usuario.servicios');
const rolServicio = require('../servicios/Rol.servicios');

async function asignarRol(req, res) {
  try {
    const { id_usuario, id_rol } = req.body;
    if (!id_usuario || !id_rol) {
      return res.status(400).json({ error: 'id_usuario e id_rol son obligatorios' });
    }

    // Verificar que el usuario exista
    const usuario = await usuarioServicio.buscarPorId(id_usuario);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar que el rol exista
    const rol = await rolServicio.buscarPorId(id_rol);
    if (!rol) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    // Verificar que el rol sea ADMIN o VENDEDOR
    if (!['ADMIN', 'VENDEDOR'].includes(rol.nombre)) {
      return res.status(400).json({ error: 'Solo se pueden asignar roles ADMIN o VENDEDOR' });
    }

    // Verificar si ya tiene el rol
    const rolesActuales = await rolServicio.obtenerRolesPorUsuario(id_usuario);
    const yaTieneRol = rolesActuales.some(r => r.id_rol === id_rol);
    if (yaTieneRol) {
      return res.status(400).json({ error: 'El usuario ya tiene asignado este rol' });
    }

    await rolServicio.asignarRolAUsuario(id_usuario, id_rol);
    res.json({ mensaje: 'Rol asignado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al asignar rol', details: err.message });
  }
}

async function quitarRol(req, res) {
  try {
    const { id_usuario, id_rol } = req.body;
    if (!id_usuario || !id_rol) {
      return res.status(400).json({ error: 'id_usuario e id_rol son obligatorios' });
    }

    await rolServicio.quitarRolAUsuario(id_usuario, id_rol);
    res.json({ mensaje: 'Rol quitado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al quitar rol', details: err.message });
  }
}

async function listarRoles(req, res) {
  try {
    const roles = await rolServicio.listar();
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar roles', details: err.message });
  }
}

module.exports = {
  asignarRol,
  quitarRol,
  listarRoles
};
