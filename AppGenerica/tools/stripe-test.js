const stripe = require('stripe')('sk_test_51234567890abcdef'); // Clave de prueba

async function testStripeIntegration() {
  console.log('🧪 Probando integración con Stripe...\n');

  try {
    // 1. Crear Payment Intent
    console.log('1️⃣ Creando Payment Intent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 10000, // $100.00 MXN
      currency: 'mxn',
      metadata: {
        order_id: 'test_order_123',
        test: 'true'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('✅ Payment Intent creado:');
    console.log(`   ID: ${paymentIntent.id}`);
    console.log(`   Monto: $${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);
    console.log(`   Status: ${paymentIntent.status}`);
    console.log(`   Client Secret: ${paymentIntent.client_secret}\n`);

    // 2. Simular confirmación de pago
    console.log('2️⃣ Simulando confirmación de pago...');
    
    // Crear un método de pago de prueba
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        token: 'tok_visa', // Token de prueba de Stripe
      },
    });

    // Confirmar el pago
    const confirmedPayment = await stripe.paymentIntents.confirm(
      paymentIntent.id,
      {
        payment_method: paymentMethod.id,
      }
    );

    console.log('✅ Pago confirmado:');
    console.log(`   Status: ${confirmedPayment.status}`);
    console.log(`   Amount received: $${confirmedPayment.amount_received / 100}\n`);

    // 3. Probar reembolso
    console.log('3️⃣ Probando reembolso...');
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntent.id,
      reason: 'requested_by_customer',
    });

    console.log('✅ Reembolso procesado:');
    console.log(`   Refund ID: ${refund.id}`);
    console.log(`   Amount: $${refund.amount / 100}`);
    console.log(`   Status: ${refund.status}\n`);

    // 4. Listar métodos de pago
    console.log('4️⃣ Listando métodos de pago recientes...');
    const paymentMethods = await stripe.paymentMethods.list({
      type: 'card',
      limit: 3,
    });

    console.log('✅ Métodos de pago encontrados:');
    paymentMethods.data.forEach((pm, index) => {
      console.log(`   ${index + 1}. ${pm.card.brand} terminada en ${pm.card.last4}`);
    });

    console.log('\n🎉 ¡Todas las pruebas de Stripe pasaron exitosamente!');
    console.log('📝 La integración está lista para producción.\n');

  } catch (error) {
    console.error('❌ Error en la prueba de Stripe:', error.message);
    console.log('\n💡 Soluciones posibles:');
    console.log('   • Verifica tu clave de API de Stripe');
    console.log('   • Asegúrate de tener conexión a internet');
    console.log('   • Confirma que tu cuenta de Stripe esté activa');
  }
}

// Ejecutar prueba
if (require.main === module) {
  testStripeIntegration();
}

module.exports = { testStripeIntegration };
