// ── Middleware de Autenticación JWT + Redis ──────────────────────────────────
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/user.repository');

const JWT_SECRET = process.env.JWT_SECRET || 'superSecretKey_cambiar_en_produccion';

/**
 * Verifica el token JWT del header Authorization.
 * Luego verifica la sesion y permisos en Redis.
 * Inyecta `req.usuario` con datos + permisos desde Redis.
 */
async function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Token de autenticación no proporcionado'
    });
  }

  // Formato esperado: "Bearer <token>"
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // ── Verificar sesion activa en Redis ──────────────────────────────────
    const sesionRedis = await userRepo.getSession(token);

    if (sesionRedis) {
      // Sesion encontrada en Redis → usar datos de Redis (incluye permisos)
      req.usuario = sesionRedis;
      req.token = token;
      req.origenPermisos = 'redis';
    } else {
      // Sesion no esta en Redis → usar datos del JWT (fallback)
      console.log('⚠️  Sesion no encontrada en Redis, usando JWT como fallback');
      req.usuario = {
        ...decoded,
        permisos: userRepo.obtenerPermisosPorRol(decoded.rol || 'CLIENTE')
      };
      req.token = token;
      req.origenPermisos = 'jwt';
    }

    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Token expirado, inicia sesión nuevamente'
      : 'Token inválido';

    return res.status(401).json({
      success: false,
      error: message
    });
  }
}

/**
 * Middleware de autorización por roles.
 * Verifica el rol desde Redis (permisos cacheados).
 * @param {string[]} rolesPermitidos  Ej: ['ADMIN', 'VENDEDOR']
 */
function requiereRol(rolesPermitidos) {
  return async (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado'
      });
    }

    // ── Verificar permisos desde Redis ─────────────────────────────────────
    const permisosRedis = await userRepo.getPermisos(req.usuario.email);

    if (permisosRedis) {
      // Permisos encontrados en Redis
      if (!rolesPermitidos.includes(permisosRedis.rol)) {
        return res.status(403).json({
          success: false,
          error: `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}`,
          rol_actual: permisosRedis.rol,
          permisos_actuales: permisosRedis.permisos,
          verificado_en: 'redis'
        });
      }
      console.log(`🛡️  Rol VERIFICADO en Redis → ${permisosRedis.rol} ✓`);
    } else {
      // Fallback: verificar desde JWT
      if (!rolesPermitidos.includes(req.usuario.rol)) {
        return res.status(403).json({
          success: false,
          error: `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}`,
          verificado_en: 'jwt'
        });
      }
      console.log(`⚠️  Rol verificado desde JWT (Redis no disponible) → ${req.usuario.rol}`);
    }

    next();
  };
}

module.exports = { verificarToken, requiereRol };
