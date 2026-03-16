const express = require('express');
const router = express.Router();
const controlador = require('../controlador/Direccion.controlador');
const { verificarToken, requiereRol } = require('../middlewares/auth');

router.get('/', verificarToken, controlador.obtenerDirecciones);
router.post('/', verificarToken, controlador.crearDireccion);
router.put('/:id', verificarToken, controlador.actualizarDireccion);
router.delete('/:id', verificarToken, controlador.eliminarDireccion);

module.exports = router;
