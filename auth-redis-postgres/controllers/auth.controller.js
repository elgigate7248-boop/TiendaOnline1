// ── Controlador de Autenticación ─────────────────────────────────────────────
const authService = require('../services/auth.service');

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validación de campos requeridos
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son obligatorios'
      });
    }

    const resultado = await authService.login(email, password);

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token:   resultado.token,
      usuario: resultado.usuario
    });

  } catch (err) {
    console.error('❌ Error en login:', err.message);
    const status = err.status || 500;
    const message = err.status
      ? err.message
      : 'Error interno del servidor al iniciar sesión';

    res.status(status).json({
      success: false,
      error: message
    });
  }
};

/**
 * POST /api/auth/registro
 * Body: { nombre, email, password, rol? }
 */
exports.registro = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    // Validación de campos requeridos
    if (!nombre || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Nombre, email y contraseña son obligatorios'
      });
    }

    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de email inválido'
      });
    }

    // Validación de contraseña (mínimo 6 caracteres)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    const resultado = await authService.registro({ nombre, email, password, rol });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token:   resultado.token,
      usuario: resultado.usuario
    });

  } catch (err) {
    console.error('❌ Error en registro:', err.message);
    const status = err.status || 500;
    const message = err.status
      ? err.message
      : 'Error interno del servidor al registrar usuario';

    res.status(status).json({
      success: false,
      error: message
    });
  }
};

/**
 * POST /api/auth/logout
 * Headers: Authorization: Bearer <token>
 */
exports.logout = async (req, res) => {
  try {
    const email = req.usuario?.email;
    if (email) {
      await authService.logout(email);
    }

    res.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });
  } catch (err) {
    console.error('❌ Error en logout:', err.message);
    res.status(500).json({
      success: false,
      error: 'Error al cerrar sesión'
    });
  }
};

/**
 * GET /api/auth/perfil
 * Headers: Authorization: Bearer <token>
 * Retorna los datos del usuario autenticado (desde el JWT).
 */
exports.perfil = async (req, res) => {
  res.json({
    success: true,
    usuario: req.usuario
  });
};
