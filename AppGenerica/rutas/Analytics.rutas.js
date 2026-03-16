const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/auth');

// Dashboard Analytics Routes
router.get('/overview', verificarToken, async (req, res) => {
  try {
    const user = req.usuario;
    const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    
    if (!esAdmin) {
      return res.status(403).json({ error: 'No autorizado para ver analytics' });
    }

    const db = require('../db');
    
    // Métricas generales
    const [totalStats] = await db.execute(`
      SELECT 
        COUNT(DISTINCT u.id_usuario) as total_usuarios,
        COUNT(DISTINCT p.id_pedido) as total_pedidos,
        COUNT(DISTINCT pr.id_producto) as total_productos,
        COUNT(DISTINCT c.id_categoria) as total_categorias,
        COALESCE(SUM(p.total), 0) as total_ventas,
        COALESCE(AVG(p.total), 0) as ticket_promedio
      FROM usuario u
      CROSS JOIN pedido p
      CROSS JOIN producto pr
      CROSS JOIN categoria c
    `);

    // Ventas por mes (últimos 6 meses)
    const [ventasMensuales] = await db.execute(`
      SELECT 
        DATE_FORMAT(fecha_pedido, '%Y-%m') as mes,
        COUNT(*) as cantidad_pedidos,
        SUM(total) as total_ventas,
        AVG(total) as ticket_promedio
      FROM pedido 
      WHERE fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_pedido, '%Y-%m')
      ORDER BY mes ASC
    `);

    // Productos más vendidos
    const [productosTop] = await db.execute(`
      SELECT 
        pr.nombre,
        SUM(dp.cantidad) as total_vendido,
        SUM(dp.cantidad * dp.precio_unitario) as total_ingresos
      FROM detalle_pedido dp
      JOIN producto pr ON dp.id_producto = pr.id_producto
      JOIN pedido p ON dp.id_pedido = p.id_pedido
      WHERE p.fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY pr.id_producto, pr.nombre
      ORDER BY total_vendido DESC
      LIMIT 10
    `);

    // Categorías más populares
    const [categoriasTop] = await db.execute(`
      SELECT 
        c.nombre,
        COUNT(DISTINCT dp.id_detalle_pedido) as total_ventas,
        SUM(dp.cantidad) as total_unidades
      FROM categoria c
      JOIN producto pr ON c.id_categoria = pr.id_categoria
      JOIN detalle_pedido dp ON pr.id_producto = dp.id_producto
      JOIN pedido p ON dp.id_pedido = p.id_pedido
      WHERE p.fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY c.id_categoria, c.nombre
      ORDER BY total_ventas DESC
      LIMIT 10
    `);

    // Estado de pedidos
    const [estadosPedidos] = await db.execute(`
      SELECT 
        ep.nombre as estado,
        COUNT(p.id_pedido) as cantidad,
        ROUND(COUNT(p.id_pedido) * 100.0 / (SELECT COUNT(*) FROM pedido), 2) as porcentaje
      FROM pedido p
      JOIN estado_pedido ep ON p.id_estado = ep.id_estado
      GROUP BY p.id_estado, ep.nombre
      ORDER BY cantidad DESC
    `);

    // Usuarios activos vs inactivos
    const [usuariosActividad] = await db.execute(`
      SELECT 
        'Activos' as tipo,
        COUNT(*) as cantidad
      FROM usuario 
      WHERE id_usuario IN (SELECT DISTINCT id_usuario FROM pedido)
      UNION ALL
      SELECT 
        'Inactivos' as tipo,
        COUNT(*) as cantidad
      FROM usuario 
      WHERE id_usuario NOT IN (SELECT DISTINCT id_usuario FROM pedido)
    `);

    // Ingresos por método de pago
    const [ingresosPorMetodo] = await db.execute(`
      SELECT 
        COALESCE(metodo_pago, 'No especificado') as metodo,
        COUNT(*) as cantidad,
        SUM(total) as total_ingresos,
        AVG(total) as ticket_promedio
      FROM pedido
      WHERE fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY metodo_pago
      ORDER BY total_ingresos DESC
    `);

    // Tendencia de crecimiento (últimos 7 días)
    const [tendenciaSemanal] = await db.execute(`
      SELECT 
        DATE(fecha_pedido) as fecha,
        COUNT(*) as pedidos_diarios,
        SUM(total) as ingresos_diarios
      FROM pedido 
      WHERE fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(fecha_pedido)
      ORDER BY fecha ASC
    `);

    // Productos con bajo stock
    const [productosBajoStock] = await db.execute(`
      SELECT 
        pr.nombre,
        pr.stock,
        c.nombre as categoria
      FROM producto pr
      JOIN categoria c ON pr.id_categoria = c.id_categoria
      WHERE pr.stock <= 10
      ORDER BY pr.stock ASC
      LIMIT 10
    `);

    res.json({
      overview: totalStats[0],
      ventasMensuales,
      productosTop,
      categoriasTop,
      estadosPedidos,
      usuariosActividad,
      ingresosPorMetodo,
      tendenciaSemanal,
      productosBajoStock,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en analytics overview:', error);
    res.status(500).json({ 
      error: 'Error al obtener analytics',
      details: error.message 
    });
  }
});

router.get('/ventas', verificarToken, async (req, res) => {
  try {
    const user = req.usuario;
    const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    
    if (!esAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { periodo = '30d' } = req.query;
    let intervalo = 'INTERVAL 30 DAY';
    
    if (periodo === '7d') intervalo = 'INTERVAL 7 DAY';
    if (periodo === '90d') intervalo = 'INTERVAL 90 DAY';
    if (periodo === '1y') intervalo = 'INTERVAL 1 YEAR';

    const db = require('../db');
    
    const [ventas] = await db.execute(`
      SELECT 
        DATE(fecha_pedido) as fecha,
        COUNT(*) as cantidad_pedidos,
        SUM(total) as total_ventas,
        AVG(total) as ticket_promedio,
        COUNT(DISTINCT id_usuario) as usuarios_unicos
      FROM pedido 
      WHERE fecha_pedido >= DATE_SUB(CURDATE(), ${intervalo})
      GROUP BY DATE(fecha_pedido)
      ORDER BY fecha ASC
    `);

    res.json({ ventas });

  } catch (error) {
    console.error('❌ Error en analytics ventas:', error);
    res.status(500).json({ error: 'Error al obtener datos de ventas' });
  }
});

router.get('/productos', verificarToken, async (req, res) => {
  try {
    const user = req.usuario;
    const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    
    if (!esAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const db = require('../db');
    
    // Top productos por ventas
    const [topVentas] = await db.execute(`
      SELECT 
        pr.id_producto,
        pr.nombre,
        pr.precio,
        pr.stock,
        SUM(dp.cantidad) as total_vendido,
        SUM(dp.cantidad * dp.precio_unitario) as ingresos_totales,
        COUNT(DISTINCT dp.id_pedido) as pedidos_unicos
      FROM detalle_pedido dp
      JOIN producto pr ON dp.id_producto = pr.id_producto
      JOIN pedido p ON dp.id_pedido = p.id_pedido
      WHERE p.fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY pr.id_producto, pr.nombre, pr.precio, pr.stock
      ORDER BY total_vendido DESC
      LIMIT 20
    `);

    // Top productos por ingresos
    const [topIngresos] = await db.execute(`
      SELECT 
        pr.id_producto,
        pr.nombre,
        pr.precio,
        pr.stock,
        SUM(dp.cantidad) as total_vendido,
        SUM(dp.cantidad * dp.precio_unitario) as ingresos_totales,
        COUNT(DISTINCT dp.id_pedido) as pedidos_unicos
      FROM detalle_pedido dp
      JOIN producto pr ON dp.id_producto = pr.id_producto
      JOIN pedido p ON dp.id_pedido = p.id_pedido
      WHERE p.fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY pr.id_producto, pr.nombre, pr.precio, pr.stock
      ORDER BY ingresos_totales DESC
      LIMIT 20
    `);

    // Productos sin ventas
    const [sinVentas] = await db.execute(`
      SELECT 
        pr.id_producto,
        pr.nombre,
        pr.precio,
        pr.stock,
        c.nombre as categoria
      FROM producto pr
      JOIN categoria c ON pr.id_categoria = c.id_categoria
      WHERE pr.id_producto NOT IN (
        SELECT DISTINCT id_producto 
        FROM detalle_pedido 
        WHERE id_pedido IN (
          SELECT id_pedido FROM pedido 
          WHERE fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        )
      )
      ORDER BY pr.nombre
      LIMIT 20
    `);

    // Análisis de precios
    const [analisisPrecios] = await db.execute(`
      SELECT 
        CASE 
          WHEN precio < 100 THEN '0-100'
          WHEN precio BETWEEN 100 AND 500 THEN '100-500'
          WHEN precio BETWEEN 500 AND 1000 THEN '500-1000'
          WHEN precio BETWEEN 1000 AND 2000 THEN '1000-2000'
          ELSE '2000+'
        END as rango_precio,
        COUNT(*) as cantidad_productos,
        AVG(precio) as precio_promedio,
        MIN(precio) as precio_minimo,
        MAX(precio) as precio_maximo
      FROM producto
      GROUP BY 
        CASE 
          WHEN precio < 100 THEN '0-100'
          WHEN precio BETWEEN 100 AND 500 THEN '100-500'
          WHEN precio BETWEEN 500 AND 1000 THEN '500-1000'
          WHEN precio BETWEEN 1000 AND 2000 THEN '1000-2000'
          ELSE '2000+'
        END
      ORDER BY precio_promedio
    `);

    res.json({
      topVentas,
      topIngresos,
      sinVentas,
      analisisPrecios
    });

  } catch (error) {
    console.error('❌ Error en analytics productos:', error);
    res.status(500).json({ error: 'Error al obtener analytics de productos' });
  }
});

router.get('/usuarios', verificarToken, async (req, res) => {
  try {
    const user = req.usuario;
    const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    
    if (!esAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const db = require('../db');
    
    // Nuevos usuarios por mes
    const [nuevosUsuarios] = await db.execute(`
      SELECT 
        DATE_FORMAT(fecha_registro, '%Y-%m') as mes,
        COUNT(*) as nuevos_usuarios
      FROM usuario
      WHERE fecha_registro >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_registro, '%Y-%m')
      ORDER BY mes ASC
    `);

    // Usuarios por actividad
    const [usuariosPorActividad] = await db.execute(`
      SELECT 
        CASE 
          WHEN pedidos_totales = 0 THEN 'Sin compras'
          WHEN pedidos_totales BETWEEN 1 AND 3 THEN 'Ocasional'
          WHEN pedidos_totales BETWEEN 4 AND 10 THEN 'Frecuente'
          ELSE 'VIP'
        END as nivel_actividad,
        COUNT(*) as cantidad_usuarios,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM usuario), 2) as porcentaje
      FROM (
        SELECT 
          u.id_usuario,
          COUNT(p.id_pedido) as pedidos_totales
        FROM usuario u
        LEFT JOIN pedido p ON u.id_usuario = p.id_usuario
        GROUP BY u.id_usuario
      ) as usuario_actividad
      GROUP BY nivel_actividad
      ORDER BY cantidad_usuarios DESC
    `);

    // Top clientes por gasto
    const [topClientes] = await db.execute(`
      SELECT 
        u.nombre,
        u.email,
        COUNT(p.id_pedido) as total_pedidos,
        SUM(p.total) as total_gastado,
        AVG(p.total) as ticket_promedio,
        MAX(p.fecha_pedido) as ultima_compra
      FROM usuario u
      JOIN pedido p ON u.id_usuario = p.id_usuario
      GROUP BY u.id_usuario, u.nombre, u.email
      ORDER BY total_gastado DESC
      LIMIT 20
    `);

    // Retención de usuarios
    const [retencion] = await db.execute(`
      SELECT 
        DATE_FORMAT(fecha_registro, '%Y-%m') as mes_registro,
        COUNT(*) as usuarios_registrados,
        COUNT(DISTINCT CASE WHEN p.fecha_pedido <= DATE_ADD(u.fecha_registro, INTERVAL 30 DAY) 
                     THEN u.id_usuario END) as usuarios_activos_30d,
        ROUND(COUNT(DISTINCT CASE WHEN p.fecha_pedido <= DATE_ADD(u.fecha_registro, INTERVAL 30 DAY) 
                     THEN u.id_usuario END) * 100.0 / COUNT(*), 2) as tasa_retencion_30d
      FROM usuario u
      LEFT JOIN pedido p ON u.id_usuario = p.id_usuario
      WHERE u.fecha_registro >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(fecha_registro, '%Y-%m')
      ORDER BY mes_registro ASC
    `);

    res.json({
      nuevosUsuarios,
      usuariosPorActividad,
      topClientes,
      retencion
    });

  } catch (error) {
    console.error('❌ Error en analytics usuarios:', error);
    res.status(500).json({ error: 'Error al obtener analytics de usuarios' });
  }
});

router.get('/kpi', verificarToken, async (req, res) => {
  try {
    const user = req.usuario;
    const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    
    if (!esAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const db = require('../db');
    
    // KPIs principales
    const [kpis] = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 1 DAY) as pedidos_hoy,
        (SELECT COUNT(*) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 7 DAY) as pedidos_semana,
        (SELECT COUNT(*) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 30 DAY) as pedidos_mes,
        (SELECT COALESCE(SUM(total), 0) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 1 DAY) as ingresos_hoy,
        (SELECT COALESCE(SUM(total), 0) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 7 DAY) as ingresos_semana,
        (SELECT COALESCE(SUM(total), 0) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 30 DAY) as ingresos_mes,
        (SELECT COUNT(*) FROM usuario WHERE fecha_registro >= CURDATE() - INTERVAL 1 DAY) as usuarios_nuevos_hoy,
        (SELECT COUNT(*) FROM usuario WHERE fecha_registro >= CURDATE() - INTERVAL 7 DAY) as usuarios_nuevos_semana,
        (SELECT COUNT(*) FROM usuario WHERE fecha_registro >= CURDATE() - INTERVAL 30 DAY) as usuarios_nuevos_mes,
        (SELECT COUNT(*) FROM producto WHERE stock <= 10) as productos_bajo_stock,
        (SELECT COALESCE(AVG(total), 0) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 30 DAY) as ticket_promedio_mes
    `);

    // Comparación con período anterior
    const [comparacion] = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 1 DAY) as pedidos_hoy_actual,
        (SELECT COUNT(*) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 2 DAY AND fecha_pedido < CURDATE() - INTERVAL 1 DAY) as pedidos_ayer,
        (SELECT COALESCE(SUM(total), 0) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 1 DAY) as ingresos_hoy_actual,
        (SELECT COALESCE(SUM(total), 0) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 2 DAY AND fecha_pedido < CURDATE() - INTERVAL 1 DAY) as ingresos_ayer
    `);

    // Calcular variaciones
    const kpisData = kpis[0];
    const compData = comparacion[0];
    
    const variacionPedidos = compData.pedidos_ayer > 0 
      ? ((kpisData.pedidos_hoy - compData.pedidos_ayer) / compData.pedidos_ayer * 100).toFixed(2)
      : 0;
    
    const variacionIngresos = compData.ingresos_ayer > 0
      ? ((kpisData.ingresos_hoy - compData.ingresos_ayer) / compData.ingresos_ayer * 100).toFixed(2)
      : 0;

    res.json({
      kpis: {
        ...kpisData,
        variacionPedidos: parseFloat(variacionPedidos),
        variacionIngresos: parseFloat(variacionIngresos)
      },
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en analytics KPI:', error);
    res.status(500).json({ error: 'Error al obtener KPIs' });
  }
});

module.exports = router;
