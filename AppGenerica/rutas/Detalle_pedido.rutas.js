const express = require('express');
const router = express.Router();
const controlador = require('../controlador/Detalle_pedido.controlador');

router.get('/', controlador.obtenerDetalles);
router.post('/', controlador.crearDetalle);
router.put('/:id', controlador.actualizarDetalle);
router.delete('/:id', controlador.eliminarDetalle);

module.exports = router;
