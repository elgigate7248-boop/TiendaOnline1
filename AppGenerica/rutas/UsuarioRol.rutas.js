const express = require('express');
const router = express.Router();
const ctrl = require('../controlador/UsuarioRol.controlador');
const { verificarToken, requiereRol } = require('../middlewares/auth');

// Solo ADMIN puede gestionar roles
router.post('/asignar', verificarToken, requiereRol(['ADMIN']), ctrl.asignarRol);
router.delete('/quitar', verificarToken, requiereRol(['ADMIN']), ctrl.quitarRol);
router.get('/', verificarToken, requiereRol(['ADMIN']), ctrl.listarRoles);

module.exports = router;
