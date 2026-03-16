const express = require('express');
const router = express.Router();
const controlador = require('../controlador/Pago.controlador');
const { verificarToken, requiereRol } = require('../middlewares/auth');

router.get('/', verificarToken, requiereRol(['ADMIN']), controlador.obtenerPagos);
router.post('/', verificarToken, requiereRol(['CLIENTE', 'ADMIN']), controlador.crearPago);
router.put('/:id', verificarToken, requiereRol(['ADMIN']), controlador.actualizarPago);
router.delete('/:id', verificarToken, requiereRol(['ADMIN']), controlador.eliminarPago);

module.exports = router;
