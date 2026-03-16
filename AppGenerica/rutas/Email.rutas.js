const express = require('express');
const router = express.Router();
const EmailService = require('../services/EmailService');
const { verificarToken } = require('../middlewares/auth');

const emailService = new EmailService();

// Enviar email de prueba
router.post('/test', verificarToken, async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    
    if (!to || !subject || !message) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos: to, subject, message' 
      });
    }

    // En desarrollo, enviar email simple
    const result = await emailService.transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Tienda Online'}" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: `<p>${message}</p>`
    });

    console.log('📧 Email de prueba enviado:', result.messageId);
    
    res.json({ 
      success: true, 
      messageId: result.messageId,
      message: 'Email de prueba enviado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error enviando email de prueba:', error);
    res.status(500).json({ 
      error: 'Error al enviar email de prueba',
      details: error.message
    });
  }
});

// Enviar confirmación de pedido
router.post('/order-confirmation', verificarToken, async (req, res) => {
  try {
    const { pedidoId, clienteEmail, clienteNombre } = req.body;
    
    if (!pedidoId || !clienteEmail || !clienteNombre) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos del pedido' 
      });
    }

    // Obtener detalles completos del pedido
    const pedido = await obtenerPedidoCompleto(pedidoId);
    
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const orderData = {
      pedido: pedido,
      cliente: {
        nombre: clienteNombre,
        email: clienteEmail
      },
      items: pedido.detalles || []
    };

    const result = await emailService.sendOrderConfirmation(orderData);
    
    res.json(result);

  } catch (error) {
    console.error('❌ Error enviando confirmación de pedido:', error);
    res.status(500).json({ 
      error: 'Error al enviar confirmación de pedido',
      details: error.message
    });
  }
});

// Enviar confirmación de pago
router.post('/payment-confirmation', verificarToken, async (req, res) => {
  try {
    const { pedidoId, clienteEmail, clienteNombre, paymentMethod } = req.body;
    
    if (!pedidoId || !clienteEmail || !clienteNombre || !paymentMethod) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos del pago' 
      });
    }

    const pedido = await obtenerPedidoCompleto(pedidoId);
    
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const orderData = {
      pedido: pedido,
      cliente: {
        nombre: clienteNombre,
        email: clienteEmail
      },
      paymentMethod: paymentMethod
    };

    const result = await emailService.sendPaymentConfirmation(orderData);
    
    res.json(result);

  } catch (error) {
    console.error('❌ Error enviando confirmación de pago:', error);
    res.status(500).json({ 
      error: 'Error al enviar confirmación de pago',
      details: error.message
    });
  }
});

// Enviar notificación de envío
router.post('/shipping-notification', verificarToken, async (req, res) => {
  try {
    const { pedidoId, clienteEmail, clienteNombre, trackingInfo } = req.body;
    
    if (!pedidoId || !clienteEmail || !clienteNombre || !trackingInfo) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos de envío' 
      });
    }

    const pedido = await obtenerPedidoCompleto(pedidoId);
    
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const orderData = {
      pedido: pedido,
      cliente: {
        nombre: clienteNombre,
        email: clienteEmail
      },
      trackingInfo: trackingInfo
    };

    const result = await emailService.sendShippingNotification(orderData);
    
    res.json(result);

  } catch (error) {
    console.error('❌ Error enviando notificación de envío:', error);
    res.status(500).json({ 
      error: 'Error al enviar notificación de envío',
      details: error.message
    });
  }
});

// Enviar notificación de entrega
router.post('/delivery-notification', verificarToken, async (req, res) => {
  try {
    const { pedidoId, clienteEmail, clienteNombre } = req.body;
    
    if (!pedidoId || !clienteEmail || !clienteNombre) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos de entrega' 
      });
    }

    const pedido = await obtenerPedidoCompleto(pedidoId);
    
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const orderData = {
      pedido: pedido,
      cliente: {
        nombre: clienteNombre,
        email: clienteEmail
      }
    };

    const result = await emailService.sendOrderDelivered(orderData);
    
    res.json(result);

  } catch (error) {
    console.error('❌ Error enviando notificación de entrega:', error);
    res.status(500).json({ 
      error: 'Error al enviar notificación de entrega',
      details: error.message
    });
  }
});

// Enviar notificación de cancelación
router.post('/cancellation-notification', verificarToken, async (req, res) => {
  try {
    const { pedidoId, clienteEmail, clienteNombre, motivo } = req.body;
    
    if (!pedidoId || !clienteEmail || !clienteNombre) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos de cancelación' 
      });
    }

    const pedido = await obtenerPedidoCompleto(pedidoId);
    
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const orderData = {
      pedido: pedido,
      cliente: {
        nombre: clienteNombre,
        email: clienteEmail
      },
      motivo: motivo || 'Cancelado por solicitud del cliente'
    };

    const result = await emailService.sendOrderCancelled(orderData);
    
    res.json(result);

  } catch (error) {
    console.error('❌ Error enviando notificación de cancelación:', error);
    res.status(500).json({ 
      error: 'Error al enviar notificación de cancelación',
      details: error.message
    });
  }
});

// Enviar email de bienvenida
router.post('/welcome-email', verificarToken, async (req, res) => {
  try {
    const { nombre, email } = req.body;
    
    if (!nombre || !email) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos: nombre, email' 
      });
    }

    const userData = { nombre, email };
    const result = await emailService.sendWelcomeEmail(userData);
    
    res.json(result);

  } catch (error) {
    console.error('❌ Error enviando email de bienvenida:', error);
    res.status(500).json({ 
      error: 'Error al enviar email de bienvenida',
      details: error.message
    });
  }
});

// Enviar email de reset de contraseña
router.post('/password-reset', async (req, res) => {
  try {
    const { nombre, email, resetToken } = req.body;
    
    if (!nombre || !email || !resetToken) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos: nombre, email, resetToken' 
      });
    }

    const userData = { nombre, email, resetToken };
    const result = await emailService.sendPasswordReset(userData);
    
    res.json(result);

  } catch (error) {
    console.error('❌ Error enviando email de reset:', error);
    res.status(500).json({ 
      error: 'Error al enviar email de reset de contraseña',
      details: error.message
    });
  }
});

// Enviar campaña promocional (solo admin)
router.post('/promo-campaign', verificarToken, async (req, res) => {
  try {
    const user = req.usuario;
    const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    
    if (!esAdmin) {
      return res.status(403).json({ error: 'No autorizado para enviar campañas' });
    }

    const { clientes, promo, asunto, contenido } = req.body;
    
    if (!clientes || !promo || !asunto) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos para la campaña' 
      });
    }

    const promoData = { clientes, promo, asunto, contenido };
    const result = await emailService.sendPromoEmail(promoData);
    
    res.json(result);

  } catch (error) {
    console.error('❌ Error enviando campaña promocional:', error);
    res.status(500).json({ 
      error: 'Error al enviar campaña promocional',
      details: error.message
    });
  }
});

// Obtener estadísticas de emails
router.get('/stats', verificarToken, async (req, res) => {
  try {
    const user = req.usuario;
    const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
    const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    
    if (!esAdmin) {
      return res.status(403).json({ error: 'No autorizado para ver estadísticas' });
    }

    // Aquí podrías implementar estadísticas reales de emails enviados
    const stats = {
      totalEmails: 0,
      emailsHoy: 0,
      emailsEstaSemana: 0,
      tasaApertura: 0,
      tasaClic: 0,
      campañasActivas: 0
    };

    res.json(stats);

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de emails:', error);
    res.status(500).json({ 
      error: 'Error al obtener estadísticas de emails',
      details: error.message
    });
  }
});

// Función auxiliar para obtener pedido completo
async function obtenerPedidoCompleto(pedidoId) {
  try {
    const db = require('../db');
    
    // Obtener datos básicos del pedido
    const [pedidos] = await db.execute(`
      SELECT p.*, u.nombre as nombre_usuario, u.email as email_usuario
      FROM pedido p
      JOIN usuario u ON p.id_usuario = u.id_usuario
      WHERE p.id_pedido = ?
    `, [pedidoId]);

    if (!pedidos.length) return null;

    const pedido = pedidos[0];

    // Obtener detalles del pedido
    const [detalles] = await db.execute(`
      SELECT dp.*, pr.nombre as nombre_producto
      FROM detalle_pedido dp
      LEFT JOIN producto pr ON dp.id_producto = pr.id_producto
      WHERE dp.id_pedido = ?
    `, [pedidoId]);

    pedido.detalles = detalles;
    return pedido;

  } catch (error) {
    console.error('Error obteniendo pedido completo:', error);
    return null;
  }
}

module.exports = router;
