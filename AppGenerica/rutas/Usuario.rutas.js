const express = require('express');
const router = express.Router();
const ctrl = require('../controlador/Usuario.controlador');
const { verificarToken, requiereRol } = require('../middlewares/auth');
const { createRateLimiter } = require('../middlewares/security');

const authRateLimiter = createRateLimiter({
  id: 'auth-endpoints',
  windowMs: Number(process.env.AUTH_RATE_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.AUTH_RATE_MAX || 20),
  message: 'Demasiados intentos de autenticación. Espera e intenta nuevamente.'
});

router.post('/login', authRateLimiter, ctrl.login);
router.post('/registro', authRateLimiter, ctrl.registrar);

// Rutas protegidas
router.get('/', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN', 'VENDEDOR']), ctrl.listarUsuarios);
router.get('/perfil', verificarToken, ctrl.obtenerPerfil);
router.post('/', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.crearUsuario);
router.get('/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.buscarUsuarioPorId);
router.put('/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.actualizarUsuario);
router.delete('/:id', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.eliminarUsuario);

module.exports = router;
