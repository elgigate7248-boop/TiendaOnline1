// ── Middleware de Autenticación JWT ──────────────────────────────────────────
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'superSecretKey_cambiar_en_produccion';

/**
 * Verifica el token JWT del header Authorization.
 * Inyecta `req.usuario` con los datos decodificados del token.
 */
function verificarToken(req, res, next) {
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
    req.usuario = decoded;
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
 * @param {string[]} rolesPermitidos  Ej: ['ADMIN', 'VENDEDOR']
 */
function requiereRol(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado'
      });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        success: false,
        error: `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}`
      });
    }

    next();
  };
}

module.exports = { verificarToken, requiereRol };
