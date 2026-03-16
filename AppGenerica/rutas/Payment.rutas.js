const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth');

// Simulación de integración con Stripe
// En producción, aquí iría: const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.post('/create-payment-intent', verificarToken, async (req, res) => {
  try {
    const { amount, currency = 'mxn', metadata = {} } = req.body;
    
    // Validaciones
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        error: 'El monto debe ser mayor a 0' 
      });
    }

    // En producción real con Stripe:
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: Math.round(amount * 100), // Stripe trabaja en centavos
    //   currency,
    //   metadata,
    //   automatic_payment_methods: {
    //     enabled: true,
    //   },
    // });

    // Simulación para desarrollo
    const paymentIntent = {
      id: `pi_test_${Date.now()}`,
      client_secret: `pi_test_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
      amount: Math.round(amount * 100),
      currency,
      status: 'requires_payment_method',
      metadata,
      created: Math.floor(Date.now() / 1000)
    };

    console.log('💳 Payment Intent creado:', {
      id: paymentIntent.id,
      amount: amount,
      currency,
      status: paymentIntent.status
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      currency: currency
    });

  } catch (error) {
    console.error('❌ Error creating payment intent:', error);
    res.status(500).json({ 
      error: 'Error al crear la intención de pago' 
    });
  }
});

router.post('/confirm-payment', verificarToken, async (req, res) => {
  try {
    const { paymentIntentId, pedidoId, metodoPago } = req.body;

    // Validaciones
    if (!paymentIntentId || !pedidoId) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos' 
      });
    }

    // En producción real con Stripe:
    // const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    // 
    // if (paymentIntent.status === 'succeeded') {
    //   // Actualizar estado del pedido a 'Pagado'
    //   await actualizarEstadoPedido(pedidoId, 2); // 2 = Pagado
    //   
    //   // Enviar confirmación por email
    //   await enviarEmailConfirmacion(pedidoId);
    // }

    // Simulación para desarrollo
    const paymentResult = {
      id: paymentIntentId,
      status: 'succeeded',
      amount_received: req.body.amount || 0,
      currency: 'mxn',
      payment_method: 'pm_card_visa'
    };

    console.log('✅ Pago confirmado:', {
      paymentIntentId,
      pedidoId,
      metodoPago,
      status: paymentResult.status
    });

    // Aquí deberías actualizar el estado del pedido en la BD
    // Por ahora solo respondemos éxito

    res.json({
      success: true,
      paymentId: paymentResult.id,
      status: paymentResult.status,
      message: 'Pago procesado correctamente',
      pedidoId: pedidoId
    });

  } catch (error) {
    console.error('❌ Error confirming payment:', error);
    res.status(500).json({ 
      error: 'Error al confirmar el pago' 
    });
  }
});

router.post('/refund', verificarToken, async (req, res) => {
  try {
    const { paymentIntentId, amount, reason = 'requested_by_customer' } = req.body;

    // En producción real con Stripe:
    // const refund = await stripe.refunds.create({
    //   payment_intent: paymentIntentId,
    //   amount: amount ? Math.round(amount * 100) : undefined,
    //   reason,
    // });

    // Simulación para desarrollo
    const refund = {
      id: `re_${Date.now()}`,
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      currency: 'mxn',
      status: 'succeeded',
      reason: reason
    };

    console.log('💰 Reembolso procesado:', refund);

    res.json({
      success: true,
      refundId: refund.id,
      amount: refund.amount ? refund.amount / 100 : 'full',
      status: refund.status,
      message: 'Reembolso procesado correctamente'
    });

  } catch (error) {
    console.error('❌ Error processing refund:', error);
    res.status(500).json({ 
      error: 'Error al procesar el reembolso' 
    });
  }
});

router.get('/payment-methods', verificarToken, async (req, res) => {
  try {
    // En producción real con Stripe:
    // const paymentMethods = await stripe.paymentMethods.list({
    //   customer: customerId,
    //   type: 'card',
    // });

    // Simulación de métodos de pago disponibles
    const paymentMethods = [
      {
        id: 'pm_card_visa',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2024,
        },
        metadata: {
          label: 'Visa terminada en 4242'
        }
      },
      {
        id: 'pm_card_mastercard',
        type: 'card',
        card: {
          brand: 'mastercard',
          last4: '5555',
          exp_month: 10,
          exp_year: 2025,
        },
        metadata: {
          label: 'Mastercard terminada en 5555'
        }
      }
    ];

    res.json({
      paymentMethods: paymentMethods
    });

  } catch (error) {
    console.error('❌ Error fetching payment methods:', error);
    res.status(500).json({ 
      error: 'Error al obtener métodos de pago' 
    });
  }
});

// Webhook para recibir eventos de Stripe (importante para producción)
router.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // En producción real:
    // event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    
    // Simulación para desarrollo
    event = JSON.parse(req.body);
  } catch (err) {
    console.log('❌ Webhook signature verification failed.');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('✅ PaymentIntent succeeded:', paymentIntent.id);
      // Aquí actualizarías el pedido a "Pagado"
      break;
    case 'payment_intent.payment_failed':
      console.log('❌ PaymentIntent failed:', event.data.object.id);
      // Aquí notificarías al cliente del fallo
      break;
    default:
      console.log(`🔔 Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({received: true});
});

module.exports = router;
