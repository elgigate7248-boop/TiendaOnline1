const express = require('express');
const router = express.Router();
const ctrl = require('../controlador/VendedorSolicitud.controlador');
const { verificarToken, requiereRol } = require('../middlewares/auth');

// Cliente solicita convertirse en vendedor
router.post('/', verificarToken, requiereRol(['CLIENTE']), ctrl.crearSolicitud);

// Cliente consulta su solicitud
router.get('/mia', verificarToken, requiereRol(['CLIENTE', 'VENDEDOR', 'ADMIN']), ctrl.miSolicitud);

// Admin lista solicitudes
router.get('/', verificarToken, requiereRol(['ADMIN']), ctrl.listar);

// Admin aprueba/rechaza
router.post('/:id/aprobar', verificarToken, requiereRol(['ADMIN']), ctrl.aprobar);
router.post('/:id/rechazar', verificarToken, requiereRol(['ADMIN']), ctrl.rechazar);

module.exports = router;
