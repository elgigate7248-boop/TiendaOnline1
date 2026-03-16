const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    // Verificar si hay credenciales de email configuradas
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Email service desactivado - No hay credenciales configuradas');
      this.transporter = null;
      return;
    }

    // Configurar transporter para desarrollo/producción
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false, // true para 465, false para otros puertos
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false // Para desarrollo
      }
    });

    // Verificar conexión
    this.verifyConnection();
  }

  async verifyConnection() {
    if (!this.transporter) {
      console.log('📧 Email service: Desactivado (sin credenciales)');
      return;
    }

    try {
      await this.transporter.verify();
      console.log('✅ Email service conectado exitosamente');
    } catch (error) {
      console.error('❌ Error conectando email service:', error);
    }
  }

  async sendOrderConfirmation(orderData) {
    if (!this.transporter) {
      console.log('📧 Email desactivado - Pedido confirmación no enviado');
      return { success: false, error: 'Email service desactivado' };
    }

    try {
      const { pedido, cliente, items } = orderData;
      
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Tienda Online'}" <${process.env.EMAIL_USER}>`,
        to: cliente.email,
        subject: `✅ Tu pedido #${pedido.id_pedido} ha sido confirmado`,
        html: this.getOrderConfirmationTemplate(orderData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email de confirmación enviado:', result.messageId);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error enviando email de confirmación:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPaymentConfirmation(orderData) {
    try {
      const { pedido, cliente, paymentMethod } = orderData;
      
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Tienda Online'}" <${process.env.EMAIL_USER}>`,
        to: cliente.email,
        subject: `💳 Pago recibido - Pedido #${pedido.id_pedido}`,
        html: this.getPaymentConfirmationTemplate(orderData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('💳 Email de pago confirmado enviado:', result.messageId);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error enviando email de pago:', error);
      return { success: false, error: error.message };
    }
  }

  async sendShippingNotification(orderData) {
    try {
      const { pedido, cliente, trackingInfo } = orderData;
      
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Tienda Online'}" <${process.env.EMAIL_USER}>`,
        to: cliente.email,
        subject: `📦 Tu pedido #${pedido.id_pedido} ha sido enviado`,
        html: this.getShippingNotificationTemplate(orderData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📦 Email de envío enviado:', result.messageId);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error enviando email de envío:', error);
      return { success: false, error: error.message };
    }
  }

  async sendOrderDelivered(orderData) {
    try {
      const { pedido, cliente } = orderData;
      
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Tienda Online'}" <${process.env.EMAIL_USER}>`,
        to: cliente.email,
        subject: `🎉 Tu pedido #${pedido.id_pedido} ha sido entregado`,
        html: this.getOrderDeliveredTemplate(orderData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('🎉 Email de entrega enviado:', result.messageId);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error enviando email de entrega:', error);
      return { success: false, error: error.message };
    }
  }

  async sendOrderCancelled(orderData) {
    try {
      const { pedido, cliente, motivo } = orderData;
      
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Tienda Online'}" <${process.env.EMAIL_USER}>`,
        to: cliente.email,
        subject: `❌ Tu pedido #${pedido.id_pedido} ha sido cancelado`,
        html: this.getOrderCancelledTemplate(orderData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('❌ Email de cancelación enviado:', result.messageId);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error enviando email de cancelación:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(userData) {
    try {
      const { nombre, email } = userData;
      
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Tienda Online'}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `🎉 ¡Bienvenido a Tienda Online, ${nombre}!`,
        html: this.getWelcomeEmailTemplate(userData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('🎉 Email de bienvenida enviado:', result.messageId);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error enviando email de bienvenida:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordReset(userData) {
    try {
      const { nombre, email, resetToken } = userData;
      
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Tienda Online'}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `🔐 Restablecer tu contraseña`,
        html: this.getPasswordResetTemplate(userData)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('🔐 Email de reset de contraseña enviado:', result.messageId);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Error enviando email de reset:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPromoEmail(promoData) {
    try {
      const { clientes, promo, asunto, contenido } = promoData;
      
      const emails = clientes.map(cliente => ({
        from: `"${process.env.EMAIL_FROM_NAME || 'Tienda Online'}" <${process.env.EMAIL_USER}>`,
        to: cliente.email,
        subject: asunto,
        html: this.getPromoEmailTemplate({ ...promoData, cliente })
      }));

      // Enviar emails en batch (máximo 10 concurrentes)
      const results = await this.sendBatchEmails(emails);
      
      console.log(`📢 Campaña promocional enviada: ${results.success}/${emails.length} exitosos`);
      
      return results;
    } catch (error) {
      console.error('❌ Error enviando campaña promocional:', error);
      return { success: false, error: error.message };
    }
  }

  async sendBatchEmails(emails) {
    const batchSize = 10;
    let results = { success: 0, failed: 0, errors: [] };
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (email) => {
        try {
          await this.transporter.sendMail(email);
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message, email: email.to };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(result.reason?.error || 'Error desconocido');
        }
      });
      
      // Pequeña pausa entre batches para no sobrecargar el servidor
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  // Templates de email
  getOrderConfirmationTemplate({ pedido, cliente, items }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Confirmación de Pedido</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .order-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .product-item { border-bottom: 1px solid #eee; padding: 15px 0; }
        .product-item:last-child { border-bottom: none; }
        .total { font-size: 18px; font-weight: bold; color: #667eea; text-align: right; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 ¡Pedido Confirmado!</h1>
            <p>Tu orden ha sido recibida exitosamente</p>
        </div>
        
        <div class="content">
            <h2>Gracias por tu compra, ${cliente.nombre}!</h2>
            <p>Hemos recibido tu pedido y lo estamos procesando. Aquí están los detalles:</p>
            
            <div class="order-info">
                <h3>📋 Información del Pedido</h3>
                <p><strong>Número de Pedido:</strong> #${pedido.id_pedido}</p>
                <p><strong>Fecha:</strong> ${new Date(pedido.fecha_pedido).toLocaleDateString('es-ES')}</p>
                <p><strong>Estado:</strong> <span style="color: #28a745;">Confirmado</span></p>
                <p><strong>Método de Pago:</strong> ${pedido.metodo_pago}</p>
            </div>
            
            <h3>🛍️ Productos Comprados</h3>
            ${items.map(item => `
                <div class="product-item">
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <strong>${item.nombre}</strong><br>
                            <small>Cantidad: ${item.cantidad}</small>
                        </div>
                        <div style="text-align: right;">
                            <strong>$${Number(item.precio_unitario * item.cantidad).toLocaleString()}</strong>
                        </div>
                    </div>
                </div>
            `).join('')}
            
            <div class="total">
                Total: $${Number(pedido.total).toLocaleString()}
            </div>
            
            <div style="text-align: center;">
                <a href="http://localhost:5000/frontend-html/mis-pedidos.html" class="btn">
                    Ver Mis Pedidos
                </a>
            </div>
            
            <p><strong>📦 ¿Qué sigue?</strong></p>
            <ul>
                <li>Recibirás un email cuando tu pedido sea enviado</li>
                <li>Puedes rastrear tu pedido en tu cuenta</li>
                <li>Para cualquier duda, contacta a soporte@tiendaonline.com</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>© 2025 Tienda Online - Todos los derechos reservados</p>
            <p>Este email fue enviado a ${cliente.email}</p>
        </div>
    </div>
</body>
</html>`;
  }

  getPaymentConfirmationTemplate({ pedido, cliente, paymentMethod }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Pago Confirmado</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .payment-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💳 Pago Recibido</h1>
            <p>Tu pago ha sido procesado exitosamente</p>
        </div>
        
        <div class="content">
            <h2>¡Excelente, ${cliente.nombre}!</h2>
            <p>Hemos recibido tu pago y tu pedido está siendo preparado para envío.</p>
            
            <div class="payment-info">
                <h3>💰 Detalles del Pago</h3>
                <p><strong>Pedido:</strong> #${pedido.id_pedido}</p>
                <p><strong>Monto:</strong> $${Number(pedido.total).toLocaleString()}</p>
                <p><strong>Método:</strong> ${paymentMethod}</p>
                <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
            </div>
            
            <p><strong>📦 Próximos pasos:</strong></p>
            <ul>
                <li>Tu pedido será empaquetado en las próximas 24 horas</li>
                <li>Recibirás un email con el número de seguimiento</li>
                <li>El tiempo de entrega estimado es de 3-5 días hábiles</li>
            </ul>
            
            <p>Gracias por confiar en Tienda Online. ¡Que disfrutes tu compra!</p>
        </div>
        
        <div class="footer">
            <p>© 2025 Tienda Online - Todos los derechos reservados</p>
        </div>
    </div>
</body>
</html>`;
  }

  getShippingNotificationTemplate({ pedido, cliente, trackingInfo }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Pedido Enviado</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .tracking-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .btn { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Pedido Enviado</h1>
            <p>Tu pedido está en camino</p>
        </div>
        
        <div class="content">
            <h2>¡Buenas noticias, ${cliente.nombre}!</h2>
            <p>Tu pedido #${pedido.id_pedido} ha sido enviado y está en camino a tu dirección.</p>
            
            <div class="tracking-info">
                <h3>📍 Información de Seguimiento</h3>
                <p><strong>Número de Guía:</strong> ${trackingInfo.guia}</p>
                <p><strong>Transportista:</strong> ${trackingInfo.transportista}</p>
                <p><strong>Fecha de Envío:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
                <p><strong>Entrega Estimada:</strong> ${trackingInfo.fechaEntrega}</p>
                
                <div style="text-align: center; margin-top: 20px;">
                    <a href="${trackingInfo.urlSeguimiento}" class="btn" target="_blank">
                        Rastrear Paquete
                    </a>
                </div>
            </div>
            
            <p><strong>📦 ¿Qué esperar?</strong></p>
            <ul>
                <li>Recibirás actualizaciones por email sobre el estado del envío</li>
                <li>El paquete será entregado en tu dirección registrada</li>
                <li>Si no estás presente, el transportista dejará un aviso</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>© 2025 Tienda Online - Todos los derechos reservados</p>
        </div>
    </div>
</body>
</html>`;
  }

  getOrderDeliveredTemplate({ pedido, cliente }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Pedido Entregado</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .success-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .btn { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Pedido Entregado</h1>
            <p>¡Tu pedido ha llegado!</p>
        </div>
        
        <div class="content">
            <h2>¡Felicidades, ${cliente.nombre}!</h2>
            <p>Tu pedido #${pedido.id_pedido} ha sido entregado exitosamente.</p>
            
            <div class="success-info">
                <h3>✅ Entrega Completada</h3>
                <p><strong>Pedido:</strong> #${pedido.id_pedido}</p>
                <p><strong>Fecha de Entrega:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
                <p><strong>Total Pagado:</strong> $${Number(pedido.total).toLocaleString()}</p>
            </div>
            
            <p><strong>🌟 ¿Qué sigue?</strong></p>
            <ul>
                <li>Revisa que todos los productos estén en buen estado</li>
                <li>Si tienes algún problema, contáctanos de inmediato</li>
                <li>¡No olvides dejar tu reseña en nuestra tienda!</li>
            </ul>
            
            <div style="text-align: center;">
                <a href="http://localhost:5000/frontend-html/index.html" class="btn">
                    Comprar Nuevamente
                </a>
                <a href="#" class="btn">
                    Dejar Reseña
                </a>
            </div>
            
            <p>Gracias por tu compra en Tienda Online. ¡Esperamos verte pronto!</p>
        </div>
        
        <div class="footer">
            <p>© 2025 Tienda Online - Todos los derechos reservados</p>
        </div>
    </div>
</body>
</html>`;
  }

  getOrderCancelledTemplate({ pedido, cliente, motivo }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Pedido Cancelado</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .cancel-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>❌ Pedido Cancelado</h1>
            <p>Tu pedido ha sido cancelado</p>
        </div>
        
        <div class="content">
            <h2>Lamentamos la cancelación, ${cliente.nombre}</h2>
            <p>Tu pedido #${pedido.id_pedido} ha sido cancelado por el siguiente motivo:</p>
            
            <div class="cancel-info">
                <h3>📋 Detalles de la Cancelación</h3>
                <p><strong>Pedido:</strong> #${pedido.id_pedido}</p>
                <p><strong>Fecha de Cancelación:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
                <p><strong>Motivo:</strong> ${motivo || 'No especificado'}</p>
                <p><strong>Reembolso:</strong> ${pedido.total > 0 ? 'Procesado en 3-5 días hábiles' : 'No aplica'}</p>
            </div>
            
            <p><strong>💡 ¿Qué significa esto?</strong></p>
            <ul>
                <li>Si pagaste con tarjeta, el reembolso se procesará automáticamente</li>
                <li>El tiempo de procesamiento puede ser de 3-5 días hábiles</li>
                <li>Recibirás un email cuando el reembolso se complete</li>
            </ul>
            
            <p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos:</p>
            <ul>
                <li>Email: soporte@tiendaonline.com</li>
                <li>Teléfono: (123) 456-7890</li>
                <li>Chat en vivo en nuestra web</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>© 2025 Tienda Online - Todos los derechos reservados</p>
        </div>
    </div>
</body>
</html>`;
  }

  getWelcomeEmailTemplate({ nombre, email }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Bienvenido a Tienda Online</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .welcome-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .btn { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 ¡Bienvenido a Tienda Online!</h1>
            <p>Estamos emocionados de tenerte con nosotros</p>
        </div>
        
        <div class="content">
            <h2>Hola, ${nombre}!</h2>
            <p>Gracias por registrarte en Tienda Online. Tu cuenta ha sido creada exitosamente y ya estás listo para disfrutar de una experiencia de compra increíble.</p>
            
            <div class="welcome-info">
                <h3>🎁 Beneficios de tu cuenta</h3>
                <ul>
                    <li>✅ Acceso a ofertas exclusivas</li>
                    <li>✅ Programa de lealtad y puntos</li>
                    <li>✅ Seguimiento de pedidos en tiempo real</li>
                    <li>✅ Guardar direcciones y métodos de pago</li>
                    <li>✅ Recomendaciones personalizadas</li>
                </ul>
            </div>
            
            <div style="text-align: center;">
                <a href="http://localhost:5000/frontend-html/index.html" class="btn">
                    Explorar Catálogo
                </a>
            </div>
            
            <p><strong>🛍️ ¿Qué puedes hacer ahora?</strong></p>
            <ul>
                <li>Explorar nuestro catálogo de productos</li>
                <li>Crear tu primera lista de deseos</li>
                <li>Aprovechar nuestras ofertas de bienvenida</li>
                <li>Configurar tus preferencias de notificación</li>
            </ul>
            
            <p>Si tienes alguna pregunta, nuestro equipo de soporte está aquí para ayudarte.</p>
        </div>
        
        <div class="footer">
            <p>© 2025 Tienda Online - Todos los derechos reservados</p>
        </div>
    </div>
</body>
</html>`;
  }

  getPasswordResetTemplate({ nombre, email, resetToken }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Restablecer Contraseña</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .reset-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .btn { display: inline-block; padding: 12px 24px; background: #ffc107; color: #333; text-decoration: none; border-radius: 5px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Restablecer Contraseña</h1>
            <p>Crea una nueva contraseña para tu cuenta</p>
        </div>
        
        <div class="content">
            <h2>Hola, ${nombre}!</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si no fuiste tú, puedes ignorar este email.</p>
            
            <div class="reset-info">
                <h3>🔑 Crear Nueva Contraseña</h3>
                <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
                <a href="http://localhost:5000/frontend-html/reset-password.html?token=${resetToken}&email=${email}" class="btn">
                    Restablecer Contraseña
                </a>
                <p><small>Este enlace expirará en 1 hora por seguridad.</small></p>
            </div>
            
            <p><strong>🛡️ Tips para una contraseña segura:</strong></p>
            <ul>
                <li>Usa al menos 8 caracteres</li>
                <li>Incluye números y símbolos</li>
                <li>Evita usar información personal</li>
                <li>No reuses contraseñas de otros sitios</li>
            </ul>
            
            <p>Si necesitas ayuda adicional, no dudes en contactarnos.</p>
        </div>
        
        <div class="footer">
            <p>© 2025 Tienda Online - Todos los derechos reservados</p>
        </div>
    </div>
</body>
</html>`;
  }

  getPromoEmailTemplate({ promo, cliente }) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${promo.titulo}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .promo-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .btn { display: inline-block; padding: 12px 24px; background: #ff6b6b; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔥 ${promo.titulo}</h1>
            <p>${promo.subtitulo}</p>
        </div>
        
        <div class="content">
            <h2>¡Hola, ${cliente.nombre}!</h2>
            <p>Tenemos una oferta especial que no querrás perderte:</p>
            
            <div class="promo-info">
                <h3>🎁 ${promo.descripcion}</h3>
                <p><strong>Descuento:</strong> ${promo.descuento}%</p>
                <p><strong>Válido hasta:</strong> ${new Date(promo.fechaFin).toLocaleDateString('es-ES')}</p>
                <p><strong>Código:</strong> <strong style="color: #ff6b6b; font-size: 18px;">${promo.codigo}</strong></p>
            </div>
            
            <div style="text-align: center;">
                <a href="http://localhost:5000/frontend-html/index.html?promo=${promo.codigo}" class="btn">
                    ¡Aprovechar Oferta!
                </a>
            </div>
            
            <p><strong>📝 Términos y condiciones:</strong></p>
            <ul>
                <li>Válido para productos seleccionados</li>
                <li>No acumulable con otras promociones</li>
                <li>Aplica hasta agotar existencias</li>
                <li>Sujeto a términos y condiciones de Tienda Online</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>© 2025 Tienda Online - Todos los derechos reservados</p>
            <p>Si no deseas recibir estos emails, <a href="#">haz clic aquí para darte de baja</a></p>
        </div>
    </div>
</body>
</html>`;
  }
}

module.exports = EmailService;
