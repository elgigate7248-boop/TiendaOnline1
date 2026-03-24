// ── Rutas de Autenticación ───────────────────────────────────────────────────
const express        = require('express');
const router         = express.Router();
const authCtrl       = require('../controllers/auth.controller');
const { verificarToken } = require('../middleware/auth.middleware');

// Rutas públicas (no requieren token)
router.post('/login',    authCtrl.login);
router.post('/registro', authCtrl.registro);

// Rutas protegidas (requieren token JWT)
router.post('/logout', verificarToken, authCtrl.logout);
router.get('/perfil',  verificarToken, authCtrl.perfil);

// Rutas de actualización de credenciales (sincroniza MySQL + Redis)
router.put('/cambiar-email',    verificarToken, authCtrl.cambiarEmail);
router.put('/cambiar-password', verificarToken, authCtrl.cambiarPassword);

// Menú de navegación (construido desde Redis)
router.get('/menu',              verificarToken, authCtrl.getMenu);
router.delete('/menu/invalidar', authCtrl.invalidarMenu);

// Rutas de administración de Redis (ver y borrar claves)
router.get('/redis/keys',      authCtrl.redisKeys);
router.delete('/redis/flush',  authCtrl.redisFlush);

module.exports = router;
