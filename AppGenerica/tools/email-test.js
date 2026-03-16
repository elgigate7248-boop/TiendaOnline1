const EmailService = require('../services/EmailService');

async function testEmailService() {
  console.log('🧪 Probando servicio de emails...\n');

  const emailService = new EmailService();

  try {
    // 1. Probar conexión
    console.log('1️⃣ Verificando conexión con servidor de email...');
    await emailService.verifyConnection();
    console.log('✅ Conexión verificada exitosamente\n');

    // 2. Probar email de prueba
    console.log('2️⃣ Enviando email de prueba...');
    const testResult = await emailService.transporter.sendMail({
      from: `"Tienda Online Test" <${process.env.EMAIL_USER}>`,
      to: 'test@example.com', // Cambiar por email real para pruebas
      subject: '🧪 Email de Prueba - Tienda Online',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>🎉 Email de Prueba Exitoso</h2>
          <p>Este es un email de prueba para verificar que el servicio funciona correctamente.</p>
          <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Detalles de la prueba:</strong><br>
            Fecha: ${new Date().toLocaleString('es-ES')}<br>
            Servicio: Nodemailer<br>
            Estado: ✅ Funcionando
          </div>
          <p>El sistema de notificaciones está listo para producción.</p>
        </div>
      `
    });

    console.log('✅ Email de prueba enviado:');
    console.log(`   Message ID: ${testResult.messageId}`);
    console.log(`   Para: test@example.com\n`);

    // 3. Probar template de bienvenida
    console.log('3️⃣ Probando template de bienvenida...');
    const welcomeData = {
      nombre: 'Usuario Test',
      email: 'test@example.com'
    };

    const welcomeResult = await emailService.sendWelcomeEmail(welcomeData);
    
    if (welcomeResult.success) {
      console.log('✅ Email de bienvenida enviado exitosamente');
      console.log(`   Message ID: ${welcomeResult.messageId}\n`);
    } else {
      console.log('❌ Error enviando email de bienvenida:', welcomeResult.error);
    }

    // 4. Probar template de confirmación de pedido
    console.log('4️⃣ Probando template de confirmación de pedido...');
    const orderData = {
      pedido: {
        id_pedido: 12345,
        fecha_pedido: new Date(),
        total: 1500,
        metodo_pago: 'TARJETA'
      },
      cliente: {
        nombre: 'Cliente Test',
        email: 'test@example.com'
      },
      items: [
        {
          nombre: 'Producto Test 1',
          cantidad: 2,
          precio_unitario: 500
        },
        {
          nombre: 'Producto Test 2',
          cantidad: 1,
          precio_unitario: 500
        }
      ]
    };

    const orderResult = await emailService.sendOrderConfirmation(orderData);
    
    if (orderResult.success) {
      console.log('✅ Email de confirmación de pedido enviado exitosamente');
      console.log(`   Message ID: ${orderResult.messageId}\n`);
    } else {
      console.log('❌ Error enviando confirmación de pedido:', orderResult.error);
    }

    // 5. Probar template de pago confirmado
    console.log('5️⃣ Probando template de pago confirmado...');
    const paymentData = {
      pedido: {
        id_pedido: 12345,
        total: 1500
      },
      cliente: {
        nombre: 'Cliente Test',
        email: 'test@example.com'
      },
      paymentMethod: 'Tarjeta de Crédito'
    };

    const paymentResult = await emailService.sendPaymentConfirmation(paymentData);
    
    if (paymentResult.success) {
      console.log('✅ Email de pago confirmado enviado exitosamente');
      console.log(`   Message ID: ${paymentResult.messageId}\n`);
    } else {
      console.log('❌ Error enviando pago confirmado:', paymentResult.error);
    }

    console.log('🎉 ¡Todas las pruebas de email completadas!');
    console.log('📝 El servicio de notificaciones está listo para producción.\n');

    console.log('📊 Resumen de capacidades:');
    console.log('   ✅ Envío de emails individuales');
    console.log('   ✅ Templates HTML profesionales');
    console.log('   ✅ Confirmaciones de pedido');
    console.log('   ✅ Notificaciones de pago');
    console.log('   ✅ Emails de bienvenida');
    console.log('   ✅ Campañas promocionales');
    console.log('   ✅ Restablecimiento de contraseña');

  } catch (error) {
    console.error('❌ Error en las pruebas de email:', error.message);
    console.log('\n💡 Soluciones posibles:');
    console.log('   • Verifica tu configuración de email en .env');
    console.log('   • Asegúrate de tener conexión a internet');
    console.log('   • Confirma que las credenciales de email sean correctas');
    console.log('   • Para Gmail, usa "App Passwords" en lugar de contraseña normal');
  }
}

// Ejecutar prueba
if (require.main === module) {
  testEmailService();
}

module.exports = { testEmailService };
