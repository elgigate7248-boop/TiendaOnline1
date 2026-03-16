const express = require('express');
const router = express.Router();
const ctrl = require('../controlador/RepartidorSolicitud.controlador');
const { verificarToken, requiereRol } = require('../middlewares/auth');

// Cliente solicita convertirse en repartidor
router.post('/', verificarToken, requiereRol(['CLIENTE']), ctrl.crearSolicitud);

// Usuario consulta su propia solicitud
router.get('/mia', verificarToken, requiereRol(['CLIENTE', 'REPARTIDOR', 'ADMIN', 'SUPER_ADMIN']), ctrl.miSolicitud);

// Admin lista todas las solicitudes
router.get('/', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.listar);

// Admin aprueba o rechaza
router.post('/:id/aprobar',  verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.aprobar);
router.post('/:id/rechazar', verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN']), ctrl.rechazar);

module.exports = router;
