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

module.exports = router;
