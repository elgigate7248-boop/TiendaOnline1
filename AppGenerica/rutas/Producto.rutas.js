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
router.put('/:id', verificarToken, requiereRol(['VENDEDOR', 'ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const servicio = require('../servicios/Producto.servicios');
    const producto = await servicio.buscarPorId(req.params.id);
    if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    const roles = Array.isArray(req.usuario.roles) ? req.usuario.roles : [];
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    if (!esAdmin && producto.id_vendedor !== req.usuario.id_usuario) {
      return res.status(403).json({ mensaje: 'No puedes editar este producto' });
    }
    const filas = await servicio.actualizar(req.params.id, req.body);
    res.json({ mensaje: 'Producto actualizado', filas });
  } catch (err) {
    res.status(err.status || 500).json({ mensaje: err.message || 'Error al actualizar producto' });
  }
});

router.delete('/:id', verificarToken, requiereRol(['VENDEDOR', 'ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const servicio = require('../servicios/Producto.servicios');
    const producto = await servicio.buscarPorId(req.params.id);
    if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    const roles = Array.isArray(req.usuario.roles) ? req.usuario.roles : [];
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    if (!esAdmin && producto.id_vendedor !== req.usuario.id_usuario) {
      return res.status(403).json({ mensaje: 'No puedes eliminar este producto' });
    }
    const filas = await servicio.eliminar(req.params.id);
    res.json({ mensaje: 'Producto eliminado', filas });
  } catch (err) {
    res.status(err.status || 500).json({ mensaje: err.message || 'Error al eliminar producto' });
  }
});

module.exports = router;
