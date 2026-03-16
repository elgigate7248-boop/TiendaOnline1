const express = require('express');
const router = express.Router();
const controlador = require('../controlador/Estado_pedido.controlador');

router.get('/', controlador.obtenerEstados);
router.post('/', controlador.crearEstado);
router.put('/:id', controlador.actualizarEstado);
router.delete('/:id', controlador.eliminarEstado);

module.exports = router;
