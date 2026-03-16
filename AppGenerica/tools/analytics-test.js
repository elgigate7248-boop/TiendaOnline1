const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middlewares/auth');

// Test Analytics API
router.get('/test', verificarToken, async (req, res) => {
  try {
    const user = req.usuario;
    const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    
    if (!esAdmin) {
      return res.status(403).json({ error: 'No autorizado para analytics' });
    }

    const db = require('../db');
    
    // Test query básica
    const [testResult] = await db.execute('SELECT COUNT(*) as count FROM usuario');
    
    console.log('🧪 Analytics API test exitoso');
    
    res.json({ 
      success: true,
      message: 'Analytics API funcionando correctamente',
      testCount: testResult[0].count,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en analytics test:', error);
    res.status(500).json({ 
      error: 'Error en analytics test',
      details: error.message 
    });
  }
});

// Test KPI calculation
router.get('/test-kpi', verificarToken, async (req, res) => {
  try {
    const user = req.usuario;
    const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    
    if (!esAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const db = require('../db');
    
    // Test KPIs
    const [kpis] = await db.execute(`
      SELECT 
        (SELECT COUNT(*) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 1 DAY) as pedidos_hoy,
        (SELECT COALESCE(SUM(total), 0) FROM pedido WHERE fecha_pedido >= CURDATE() - INTERVAL 1 DAY) as ingresos_hoy,
        (SELECT COUNT(*) FROM usuario WHERE fecha_registro >= CURDATE() - INTERVAL 1 DAY) as usuarios_nuevos_hoy,
        (SELECT COUNT(*) FROM producto WHERE stock <= 10) as productos_bajo_stock
    `);

    console.log('🧪 KPIs test exitoso:', kpis[0]);
    
    res.json({ 
      success: true,
      kpis: kpis[0],
      message: 'KPIs calculados correctamente'
    });

  } catch (error) {
    console.error('❌ Error en KPIs test:', error);
    res.status(500).json({ 
      error: 'Error en KPIs test',
      details: error.message 
    });
  }
});

// Test chart data
router.get('/test-charts', verificarToken, async (req, res) => {
  try {
    const user = req.usuario;
    const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    
    if (!esAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const db = require('../db');
    
    // Test ventas mensuales
    const [ventasMensuales] = await db.execute(`
      SELECT 
        DATE_FORMAT(fecha_pedido, '%Y-%m') as mes,
        COUNT(*) as cantidad_pedidos,
        SUM(total) as total_ventas
      FROM pedido 
      WHERE fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
      GROUP BY DATE_FORMAT(fecha_pedido, '%Y-%m')
      ORDER BY mes ASC
    `);

    // Test productos top
    const [productosTop] = await db.execute(`
      SELECT 
        pr.nombre,
        SUM(dp.cantidad) as total_vendido
      FROM detalle_pedido dp
      JOIN producto pr ON dp.id_producto = pr.id_producto
      JOIN pedido p ON dp.id_pedido = p.id_pedido
      WHERE p.fecha_pedido >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY pr.id_producto, pr.nombre
      ORDER BY total_vendido DESC
      LIMIT 5
    `);

    console.log('🧪 Charts data test exitoso');
    
    res.json({ 
      success: true,
      ventasMensuales,
      productosTop,
      message: 'Datos para charts generados correctamente'
    });

  } catch (error) {
    console.error('❌ Error en charts test:', error);
    res.status(500).json({ 
      error: 'Error en charts test',
      details: error.message 
    });
  }
});

module.exports = router;
