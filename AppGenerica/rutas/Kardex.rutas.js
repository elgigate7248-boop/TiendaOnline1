// 📦 API REST KARDEX - Sistema de Gestión de Inventario
// Backend: Node.js + Express + MySQL
// Proyecto: Tienda Online

const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, verificarRol } = require('../middlewares/auth');

// =============================================
// 📊 1️⃣ OBTENER RESUMEN DE INVENTARIO
// =============================================
router.get('/resumen', [verificarToken, verificarRol], async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) AS total_productos,
                SUM(stock_actual) AS total_unidades,
                SUM(valor_inventario) AS valor_total_inventario,
                AVG(costo_promedio) AS costo_promedio_general,
                SUM(CASE WHEN stock_actual <= stock_minimo THEN 1 ELSE 0 END) AS productos_stock_critico,
                SUM(CASE WHEN stock_actual > stock_minimo AND stock_actual <= (stock_minimo * 1.5) THEN 1 ELSE 0 END) AS productos_stock_bajo,
                SUM(CASE WHEN stock_actual > (stock_minimo * 1.5) THEN 1 ELSE 0 END) AS productos_stock_normal
            FROM producto
            WHERE estado = 'activo'
        `;
        
        const [result] = await db.execute(query);
        
        res.json({
            success: true,
            data: result[0],
            message: 'Resumen de inventario obtenido correctamente'
        });
        
    } catch (error) {
        console.error('Error al obtener resumen de inventario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener resumen de inventario',
            error: error.message
        });
    }
});

// =============================================
// 📋 2️⃣ OBTENER KARDEX POR PRODUCTO
// =============================================
router.get('/producto/:id_producto', [verificarToken, verificarRol], async (req, res) => {
    try {
        const { id_producto } = req.params;
        const { fecha_inicio, fecha_fin } = req.query;
        
        let query = `
            SELECT 
                k.id_kardex,
                k.fecha,
                k.hora,
                tm.nombre AS tipo_movimiento,
                tm.afecta_stock,
                k.cantidad,
                k.costo_unitario,
                k.saldo_anterior,
                k.saldo_actual,
                k.valor_total,
                k.valor_inventario,
                k.referencia,
                k.observaciones,
                k.usuario_registro,
                k.created_at
            FROM kardex k
            INNER JOIN tipos_movimiento tm ON k.id_tipo = tm.id_tipo
            WHERE k.id_producto = ?
        `;
        
        const params = [id_producto];
        
        if (fecha_inicio && fecha_fin) {
            query += ' AND k.fecha BETWEEN ? AND ?';
            params.push(fecha_inicio, fecha_fin);
        }
        
        query += ' ORDER BY k.fecha DESC, k.hora DESC, k.id_kardex DESC';
        
        const [movimientos] = await db.execute(query, params);
        
        // Obtener información del producto
        const [producto] = await db.execute(
            'SELECT * FROM producto WHERE id_producto = ?',
            [id_producto]
        );
        
        res.json({
            success: true,
            data: {
                producto: producto[0] || null,
                movimientos: movimientos
            },
            message: 'Kardex del producto obtenido correctamente'
        });
        
    } catch (error) {
        console.error('Error al obtener kardex del producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener kardex del producto',
            error: error.message
        });
    }
});

// =============================================
// 📦 3️⃣ OBTENER PRODUCTOS CON STOCK CRÍTICO
// =============================================
router.get('/stock-critico', [verificarToken, verificarRol], async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id_producto,
                p.nombre,
                p.stock_actual,
                p.stock_minimo,
                (p.stock_minimo - p.stock_actual) AS unidades_faltantes,
                p.costo_promedio,
                (p.stock_minimo - p.stock_actual) * p.costo_promedio AS valor_compra_recomendado,
                p.ultima_compra,
                DATEDIFF(CURDATE(), p.ultima_compra) AS dias_ultima_compra,
                CASE 
                    WHEN p.stock_actual = 0 THEN 'AGOTADO'
                    WHEN p.stock_actual <= p.stock_minimo THEN 'CRÍTICO'
                    ELSE 'BAJO'
                END AS nivel_critico
            FROM producto p
            WHERE p.estado = 'activo'
            AND p.stock_actual <= p.stock_minimo
            ORDER BY (p.stock_minimo - p.stock_actual) DESC
        `;
        
        const [productos] = await db.execute(query);
        
        res.json({
            success: true,
            data: productos,
            message: 'Productos con stock crítico obtenidos correctamente'
        });
        
    } catch (error) {
        console.error('Error al obtener productos con stock crítico:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener productos con stock crítico',
            error: error.message
        });
    }
});

// =============================================
// 📈 4️⃣ OBTENER VALOR TOTAL DEL INVENTARIO
// =============================================
router.get('/valor-inventario', [verificarToken, verificarRol], async (req, res) => {
    try {
        const query = `
            SELECT 
                SUM(valor_inventario) AS valor_total,
                COUNT(*) AS total_productos,
                SUM(stock_actual) AS total_unidades,
                AVG(costo_promedio) AS costo_promedio_general,
                MIN(valor_inventario) AS valor_minimo,
                MAX(valor_inventario) AS valor_maximo,
                STDDEV(valor_inventario) AS desviacion_estandar
            FROM producto
            WHERE estado = 'activo'
        `;
        
        const [result] = await db.execute(query);
        
        // Obtener valor por categorías
        const queryCategorias = `
            SELECT 
                c.nombre AS categoria,
                COUNT(p.id_producto) AS cantidad_productos,
                SUM(p.stock_actual) AS total_unidades,
                SUM(p.valor_inventario) AS valor_total_categoria,
                AVG(p.costo_promedio) AS costo_promedio_categoria
            FROM producto p
            INNER JOIN categoria c ON p.id_categoria = c.id_categoria
            WHERE p.estado = 'activo'
            GROUP BY c.id_categoria, c.nombre
            ORDER BY valor_total_categoria DESC
        `;
        
        const [categorias] = await db.execute(queryCategorias);
        
        res.json({
            success: true,
            data: {
                general: result[0],
                por_categoria: categorias
            },
            message: 'Valor del inventario obtenido correctamente'
        });
        
    } catch (error) {
        console.error('Error al obtener valor del inventario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener valor del inventario',
            error: error.message
        });
    }
});

// =============================================
// 🔄 5️⃣ REGISTRAR MOVIMIENTO KARDEX
// =============================================
router.post('/movimiento', [verificarToken, verificarRol], async (req, res) => {
    try {
        const {
            id_producto,
            id_tipo,
            fecha,
            hora,
            cantidad,
            costo_unitario,
            referencia,
            observaciones
        } = req.body;
        
        const usuario_registro = req.usuario.email;
        
        // Validar datos requeridos
        if (!id_producto || !id_tipo || !cantidad || !costo_unitario) {
            return res.status(400).json({
                success: false,
                message: 'Faltan datos requeridos para el movimiento'
            });
        }
        
        // Obtener stock actual y configuración
        const [stockResult] = await db.execute(
            'SELECT stock_actual FROM producto WHERE id_producto = ?',
            [id_producto]
        );
        
        if (stockResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        const [tipoResult] = await db.execute(
            'SELECT afecta_stock FROM tipos_movimiento WHERE id_tipo = ?',
            [id_tipo]
        );
        
        if (tipoResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tipo de movimiento no encontrado'
            });
        }
        
        const stock_actual = stockResult[0].stock_actual;
        const afecta_stock = tipoResult[0].afecta_stock;
        
        // Validar stock para salidas
        if (afecta_stock === 'S' && stock_actual < cantidad) {
            return res.status(400).json({
                success: false,
                message: `Stock insuficiente. Stock actual: ${stock_actual}, Solicitado: ${cantidad}`
            });
        }
        
        // Calcular nuevo saldo
        const nuevo_saldo = afecta_stock === 'E' ? 
            stock_actual + cantidad : 
            stock_actual - cantidad;
        
        // Calcular valores
        const valor_total = cantidad * costo_unitario;
        
        // Obtener costo promedio actual
        const [costoResult] = await db.execute(
            'SELECT costo_promedio FROM producto WHERE id_producto = ?',
            [id_producto]
        );
        
        let costo_promedio = costoResult[0].costo_promedio;
        
        // Si es entrada, recalcular costo promedio
        if (afecta_stock === 'E') {
            if (stock_actual === 0) {
                costo_promedio = costo_unitario;
            } else {
                costo_promedio = ((stock_actual * costo_promedio) + (cantidad * costo_unitario)) / nuevo_saldo;
            }
            
            // Actualizar costo promedio en producto
            await db.execute(
                'UPDATE producto SET costo_promedio = ?, ultima_compra = ?, ultimo_costo = ? WHERE id_producto = ?',
                [costo_promedio, fecha || new Date().toISOString().split('T')[0], costo_unitario, id_producto]
            );
        }
        
        const valor_inventario = nuevo_saldo * costo_promedio;
        
        // Insertar movimiento en kardex
        const [insertResult] = await db.execute(`
            INSERT INTO kardex (
                id_producto, id_tipo, fecha, hora, cantidad, costo_unitario,
                saldo_anterior, saldo_actual, valor_total, valor_inventario,
                referencia, observaciones, usuario_registro
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id_producto, id_tipo, fecha || new Date().toISOString().split('T')[0], 
            hora || new Date().toTimeString().split(' ')[0], cantidad, costo_unitario,
            stock_actual, nuevo_saldo, valor_total, valor_inventario,
            referencia, observaciones, usuario_registro
        ]);
        
        // Actualizar stock del producto
        await db.execute(
            'UPDATE producto SET stock_actual = ?, valor_inventario = ? WHERE id_producto = ?',
            [nuevo_saldo, valor_inventario, id_producto]
        );
        
        res.status(201).json({
            success: true,
            data: {
                id_kardex: insertResult.insertId,
                nuevo_saldo,
                costo_promedio,
                valor_inventario
            },
            message: 'Movimiento registrado correctamente'
        });
        
    } catch (error) {
        console.error('Error al registrar movimiento:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar movimiento',
            error: error.message
        });
    }
});

// =============================================
// 📊 6️⃣ OBTENER MOVIMIENTOS DEL DÍA
// =============================================
router.get('/movimientos-dia', [verificarToken, verificarRol], async (req, res) => {
    try {
        const { fecha } = req.query;
        const fecha_consulta = fecha || new Date().toISOString().split('T')[0];
        
        const query = `
            SELECT 
                k.id_kardex,
                p.nombre AS producto,
                p.codigo_barras,
                tm.nombre AS tipo_movimiento,
                tm.afecta_stock,
                k.cantidad,
                k.costo_unitario,
                k.valor_total,
                k.saldo_actual,
                k.referencia,
                k.observaciones,
                k.usuario_registro,
                k.created_at
            FROM kardex k
            INNER JOIN producto p ON k.id_producto = p.id_producto
            INNER JOIN tipos_movimiento tm ON k.id_tipo = tm.id_tipo
            WHERE DATE(k.created_at) = ?
            ORDER BY k.created_at DESC
        `;
        
        const [movimientos] = await db.execute(query, [fecha_consulta]);
        
        // Resumen del día
        const [resumen] = await db.execute(`
            SELECT 
                COUNT(*) AS total_movimientos,
                SUM(CASE WHEN tm.afecta_stock = 'E' THEN k.cantidad ELSE 0 END) AS total_entradas,
                SUM(CASE WHEN tm.afecta_stock = 'S' THEN k.cantidad ELSE 0 END) AS total_salidas,
                SUM(k.valor_total) AS valor_total_movimientos
            FROM kardex k
            INNER JOIN tipos_movimiento tm ON k.id_tipo = tm.id_tipo
            WHERE DATE(k.created_at) = ?
        `, [fecha_consulta]);
        
        res.json({
            success: true,
            data: {
                movimientos,
                resumen: resumen[0]
            },
            message: 'Movimientos del día obtenidos correctamente'
        });
        
    } catch (error) {
        console.error('Error al obtener movimientos del día:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener movimientos del día',
            error: error.message
        });
    }
});

// =============================================
// 📋 7️⃣ OBTENER TIPOS DE MOVIMIENTO
// =============================================
router.get('/tipos-movimiento', [verificarToken, verificarRol], async (req, res) => {
    try {
        const query = `
            SELECT 
                id_tipo,
                nombre,
                afecta_stock,
                descripcion,
                estado
            FROM tipos_movimiento
            WHERE estado = 'activo'
            ORDER BY nombre
        `;
        
        const [tipos] = await db.execute(query);
        
        res.json({
            success: true,
            data: tipos,
            message: 'Tipos de movimiento obtenidos correctamente'
        });
        
    } catch (error) {
        console.error('Error al obtener tipos de movimiento:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tipos de movimiento',
            error: error.message
        });
    }
});

// =============================================
// 🔄 8️⃣ AJUSTAR STOCK MANUALMENTE
// =============================================
router.put('/ajustar-stock/:id_producto', [verificarToken, verificarRol], async (req, res) => {
    try {
        const { id_producto } = req.params;
        const { nuevo_stock, motivo, costo_unitario } = req.body;
        const usuario_registro = req.usuario.email;
        
        // Obtener stock actual
        const [stockResult] = await db.execute(
            'SELECT stock_actual, costo_promedio FROM producto WHERE id_producto = ?',
            [id_producto]
        );
        
        if (stockResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }
        
        const stock_actual = stockResult[0].stock_actual;
        const costo_promedio_actual = stockResult[0].costo_promedio;
        const diferencia = nuevo_stock - stock_actual;
        
        if (diferencia === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay cambios en el stock'
            });
        }
        
        // Determinar tipo de movimiento
        const id_tipo = diferencia > 0 ? 5 : 6; // AJUSTE_ENTRADA o AJUSTE_SALIDA
        const cantidad = Math.abs(diferencia);
        const costo_final = costo_unitario || costo_promedio_actual;
        
        // Calcular valores
        const valor_total = cantidad * costo_final;
        const valor_inventario = nuevo_stock * costo_final;
        
        // Insertar movimiento de ajuste
        await db.execute(`
            INSERT INTO kardex (
                id_producto, id_tipo, fecha, hora, cantidad, costo_unitario,
                saldo_anterior, saldo_actual, valor_total, valor_inventario,
                referencia, observaciones, usuario_registro
            ) VALUES (?, ?, CURDATE(), CURTIME(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id_producto, id_tipo, cantidad, costo_final,
            stock_actual, nuevo_stock, valor_total, valor_inventario,
            'AJUSTE_MANUAL', motivo || 'Ajuste manual de stock', usuario_registro
        ]);
        
        // Actualizar stock del producto
        await db.execute(
            'UPDATE producto SET stock_actual = ?, valor_inventario = ? WHERE id_producto = ?',
            [nuevo_stock, valor_inventario, id_producto]
        );
        
        res.json({
            success: true,
            data: {
                stock_anterior: stock_actual,
                nuevo_stock,
                diferencia,
                valor_inventario
            },
            message: 'Stock ajustado correctamente'
        });
        
    } catch (error) {
        console.error('Error al ajustar stock:', error);
        res.status(500).json({
            success: false,
            message: 'Error al ajustar stock',
            error: error.message
        });
    }
});

// =============================================
// 📊 9️⃣ REPORTES DE KARDEX
// =============================================

// Reporte de movimientos por período
router.get('/reporte/movimientos', [verificarToken, verificarRol], async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, id_producto, id_tipo } = req.query;
        
        let query = `
            SELECT 
                k.id_kardex,
                k.fecha,
                k.hora,
                p.nombre AS producto,
                p.codigo_barras,
                tm.nombre AS tipo_movimiento,
                tm.afecta_stock,
                k.cantidad,
                k.costo_unitario,
                k.saldo_anterior,
                k.saldo_actual,
                k.valor_total,
                k.valor_inventario,
                k.referencia,
                k.observaciones,
                k.usuario_registro
            FROM kardex k
            INNER JOIN producto p ON k.id_producto = p.id_producto
            INNER JOIN tipos_movimiento tm ON k.id_tipo = tm.id_tipo
            WHERE 1=1
        `;
        
        const params = [];
        
        if (fecha_inicio && fecha_fin) {
            query += ' AND k.fecha BETWEEN ? AND ?';
            params.push(fecha_inicio, fecha_fin);
        }
        
        if (id_producto) {
            query += ' AND k.id_producto = ?';
            params.push(id_producto);
        }
        
        if (id_tipo) {
            query += ' AND k.id_tipo = ?';
            params.push(id_tipo);
        }
        
        query += ' ORDER BY k.fecha DESC, k.hora DESC';
        
        const [movimientos] = await db.execute(query, params);
        
        res.json({
            success: true,
            data: movimientos,
            message: 'Reporte de movimientos obtenido correctamente'
        });
        
    } catch (error) {
        console.error('Error al generar reporte de movimientos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar reporte de movimientos',
            error: error.message
        });
    }
});

// Reporte de valorización de inventario
router.get('/reporte/valorizacion', [verificarToken, verificarRol], async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id_producto,
                p.nombre,
                p.codigo_barras,
                p.stock_actual,
                p.costo_promedio,
                p.precio_venta,
                p.valor_inventario,
                (p.precio_venta - p.costo_promedio) AS margen_utilidad,
                CASE 
                    WHEN p.costo_promedio > 0 THEN 
                        ROUND(((p.precio_venta - p.costo_promedio) / p.costo_promedio) * 100, 2)
                    ELSE 0
                END AS porcentaje_utilidad,
                CASE 
                    WHEN p.stock_actual <= p.stock_minimo THEN 'CRÍTICO'
                    WHEN p.stock_actual <= (p.stock_minimo * 1.5) THEN 'BAJO'
                    WHEN p.stock_actual >= p.stock_maximo THEN 'EXCESO'
                    ELSE 'NORMAL'
                END AS estado_stock
            FROM producto p
            WHERE p.estado = 'activo'
            ORDER BY p.valor_inventario DESC
        `;
        
        const [productos] = await db.execute(query);
        
        // Totales
        const [totales] = await db.execute(`
            SELECT 
                COUNT(*) AS total_productos,
                SUM(stock_actual) AS total_unidades,
                SUM(valor_inventario) AS valor_total_inventario,
                AVG(costo_promedio) AS costo_promedio_general,
                SUM((precio_venta - costo_promedio) * stock_actual) AS utilidad_total_potencial
            FROM producto
            WHERE estado = 'activo'
        `);
        
        res.json({
            success: true,
            data: {
                productos,
                totales: totales[0]
            },
            message: 'Reporte de valorización obtenido correctamente'
        });
        
    } catch (error) {
        console.error('Error al generar reporte de valorización:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar reporte de valorización',
            error: error.message
        });
    }
});

module.exports = router;
