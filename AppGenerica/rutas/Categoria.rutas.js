const express = require('express');
const router = express.Router();
const ctrl = require('../controlador/Categoria.controlador');
const { verificarToken, requiereRol } = require('../middlewares/auth');

router.get('/', ctrl.obtenerCategorias);

router.post('/', verificarToken, requiereRol(['ADMIN']), ctrl.crearCategoria);
router.put('/:id', verificarToken, requiereRol(['ADMIN']), ctrl.actualizarCategoria);
router.delete('/:id', verificarToken, requiereRol(['ADMIN']), ctrl.eliminarCategoria);

module.exports = router;
