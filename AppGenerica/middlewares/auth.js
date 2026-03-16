const jwt = require('jsonwebtoken');
const rolServicio = require('../servicios/Rol.servicios');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecreto';

async function verificarToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }
    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    // Compatibilidad: algunos tokens antiguos guardan "id" en vez de "id_usuario".
    const idUsuario = payload.id_usuario || payload.id;
    if (!idUsuario) {
      return res.status(401).json({ error: 'Token sin usuario' });
    }
    const rolesRaw = await rolServicio.obtenerRolesPorUsuario(idUsuario);
    const roles = Array.isArray(rolesRaw)
      ? rolesRaw.map(r => (r && typeof r === 'object') ? r.nombre : r).filter(Boolean)
      : [];
    req.usuario = {
      id_usuario: idUsuario,
      id: idUsuario,
      roles,
      rol: roles[0] // compatibilidad hacia atrás
    };
    next();
  } catch (err) {
    res.status(500).json({ error: 'Error en autenticación' });
  }
}

function requiereRol(rolesPermitidos = []) {
  return (req, res, next) => {
    try {
      const permitidosNorm = Array.isArray(rolesPermitidos)
        ? rolesPermitidos.map(r => String(r || '').trim().toUpperCase()).filter(Boolean)
        : [];
      const rolesUsuarioRaw = req.usuario?.roles || [];
      const rolesUsuario = Array.isArray(rolesUsuarioRaw)
        ? rolesUsuarioRaw
          .map(r => (r && typeof r === 'object') ? r.nombre : r)
          .map(r => String(r || '').trim().toUpperCase())
          .filter(Boolean)
        : [];
      if (!rolesUsuario.length) {
        return res.status(403).json({ error: 'Usuario sin roles asignados' });
      }
      const autorizado = rolesUsuario.some(rol => permitidosNorm.includes(rol));
      if (!autorizado) {
        return res.status(403).json({ error: 'Acceso denegado por rol' });
      }
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Error en autorización de roles' });
    }
  };
}

// Alias para compatibilidad
function verificarRol(req, res, next) {
  return requiereRol(['ADMIN', 'SUPER_ADMIN'])(req, res, next);
}

module.exports = { verificarToken, requiereRol, verificarRol };
