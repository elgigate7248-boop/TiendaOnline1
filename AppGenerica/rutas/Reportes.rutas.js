const express = require('express');
const router = express.Router();
const ctrl = require('../controlador/Reportes.controlador');
const { verificarToken, requiereRol } = require('../middlewares/auth');

// ═══════════════════════════════════════════════════════════════════════
// REPORTES VENDEDOR
// Requieren: autenticación + rol VENDEDOR (o ADMIN/SUPER_ADMIN)
// ═══════════════════════════════════════════════════════════════════════
const authVendedor = [verificarToken, requiereRol(['VENDEDOR', 'ADMIN', 'SUPER_ADMIN'])];

// GET /reportes/vendedor/top-productos?ordenar_por=cantidad|ingresos|margen&fecha_inicio=&fecha_fin=&limit=
router.get('/vendedor/top-productos', authVendedor, ctrl.vendedorTopProductos);

// GET /reportes/vendedor/productos-rentables?fecha_inicio=&fecha_fin=&limit=
router.get('/vendedor/productos-rentables', authVendedor, ctrl.vendedorProductosRentables);

// GET /reportes/vendedor/historial-ganancias?agrupacion=dia|semana|mes&fecha_inicio=&fecha_fin=
router.get('/vendedor/historial-ganancias', authVendedor, ctrl.vendedorHistorialGanancias);

// GET /reportes/vendedor/resumen?fecha_inicio=&fecha_fin=
router.get('/vendedor/resumen', authVendedor, ctrl.vendedorResumenFinanciero);

// GET /reportes/vendedor/analisis-inventario?fecha_inicio=&fecha_fin=&limit=
router.get('/vendedor/analisis-inventario', authVendedor, ctrl.vendedorAnalisisInventario);

// ═══════════════════════════════════════════════════════════════════════
// REPORTES ADMIN
// Requieren: autenticación + rol ADMIN/SUPER_ADMIN
// ═══════════════════════════════════════════════════════════════════════
const authAdmin = [verificarToken, requiereRol(['ADMIN', 'SUPER_ADMIN'])];

// GET /reportes/admin/top-vendedores?ordenar_por=score|ventas|ganancias|pedidos|comisiones&fecha_inicio=&fecha_fin=&limit=
router.get('/admin/top-vendedores', authAdmin, ctrl.adminTopVendedores);

// GET /reportes/admin/top-productos?ordenar_por=cantidad|ingresos|comision&fecha_inicio=&fecha_fin=&limit=
router.get('/admin/top-productos', authAdmin, ctrl.adminTopProductosGlobal);

// GET /reportes/admin/ingresos-plataforma?agrupacion=dia|semana|mes&fecha_inicio=&fecha_fin=
router.get('/admin/ingresos-plataforma', authAdmin, ctrl.adminIngresosPlataforma);

// GET /reportes/admin/estadisticas?fecha_inicio=&fecha_fin=
router.get('/admin/estadisticas', authAdmin, ctrl.adminEstadisticas);

module.exports = router;
