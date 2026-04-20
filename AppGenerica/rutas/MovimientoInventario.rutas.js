const express = require('express');
const router = express.Router();
const ctrl = require('../controlador/MovimientoInventario.controlador');
const { verificarToken, requiereRol } = require('../middlewares/auth');

// Todas las rutas requieren autenticación + rol VENDEDOR (o ADMIN/SUPER_ADMIN)
const auth = [verificarToken, requiereRol(['VENDEDOR', 'ADMIN', 'SUPER_ADMIN'])];

// POST /movimiento-inventario/entrada — Registrar compra/producción
router.post('/entrada', auth, ctrl.registrarEntrada);

// GET /movimiento-inventario/ — Listar movimientos del vendedor
// Query params: tipo, id_producto, fecha_inicio, fecha_fin, limit, offset
router.get('/', auth, ctrl.listarMovimientos);

// GET /movimiento-inventario/resumen — Resumen financiero del vendedor
// Query params: fecha_inicio, fecha_fin
router.get('/resumen', auth, ctrl.resumenFinanciero);

// GET /movimiento-inventario/factura/:idPedido — Vista tipo factura de un pedido
router.get('/factura/:idPedido', auth, ctrl.facturaPorPedido);

module.exports = router;
