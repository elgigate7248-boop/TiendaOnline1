const express = require('express');
const router = express.Router();
const productoCtrl = require('../controlador/Producto.controlador');
const { verificarToken, requiereRol } = require('../middlewares/auth');

// Públicos
router.get('/', productoCtrl.obtenerProductos);
router.get('/mas-vendidos/:idCategoria', productoCtrl.obtenerMasVendidosPorCategoria);
router.get('/gestion', verificarToken, requiereRol(['VENDEDOR', 'ADMIN', 'SUPER_ADMIN']), productoCtrl.obtenerProductosGestion);
router.get('/:id', productoCtrl.obtenerProducto);

// Crear producto (requiere VENDEDOR/ADMIN/SUPER_ADMIN)
router.post('/', verificarToken, requiereRol(['VENDEDOR', 'ADMIN', 'SUPER_ADMIN']), productoCtrl.crearProducto);

// Atributos por producto
router.get('/:id/atributos', productoCtrl.obtenerAtributos);
router.put('/:id/atributos', verificarToken, requiereRol(['VENDEDOR', 'ADMIN', 'SUPER_ADMIN']), productoCtrl.guardarAtributos);

// PUT/DELETE solo dueño o ADMIN
router.put('/:id', verificarToken, requiereRol(['VENDEDOR', 'ADMIN', 'SUPER_ADMIN']), productoCtrl.actualizarProducto);
router.delete('/:id', verificarToken, requiereRol(['VENDEDOR', 'ADMIN', 'SUPER_ADMIN']), productoCtrl.eliminarProducto);

module.exports = router;
