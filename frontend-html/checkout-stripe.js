// Sistema de Checkout con Stripe
class StripeCheckout {
  constructor() {
    this.stripe = null;
    this.elements = null;
    this.cardElement = null;
    this.clientSecret = null;
    this.orderData = null;
    this.selectedPaymentMethod = 'card';
    
    // En producción, usa tu clave pública de Stripe
    this.stripePublicKey = 'pk_test_51234567890abcdef'; // Clave de prueba
    
    this.init();
  }

  async init() {
    // Inicializar Stripe
    this.stripe = Stripe(this.stripePublicKey);
    
    // Cargar datos del carrito
    await this.loadOrderData();
    
    // Configurar elementos de Stripe
    this.setupStripeElements();
    
    // Configurar event listeners
    this.setupEventListeners();
    
    // Renderizar resumen del pedido
    this.renderOrderSummary();
  }

  async loadOrderData() {
    // Obtener datos del carrito desde localStorage
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    
    if (!carrito.length) {
      alert('Tu carrito está vacío. Redirigiendo a la tienda...');
      window.location.href = 'index.html';
      return;
    }

    // Calcular totales
    const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const envio = subtotal > 1000 ? 0 : 99; // Envío gratis para compras > $1000
    const iva = subtotal * 0.16;
    const total = subtotal + envio + iva;

    this.orderData = {
      items: carrito,
      subtotal: subtotal,
      envio: envio,
      iva: iva,
      total: total,
      currency: 'mxn'
    };
  }

  setupStripeElements() {
    // Crear elementos de Stripe
    this.elements = this.stripe.elements({
      locale: 'es'
    });

    // Crear elemento de tarjeta
    this.cardElement = this.elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#424770',
          '::placeholder': {
            color: '#aab7c4',
          },
        },
        invalid: {
          color: '#9e2146',
        },
      },
      hidePostalCode: true
    });

    // Montar elemento en el DOM
    this.cardElement.mount('#card-element');

    // Manejar errores en tiempo real
    this.cardElement.on('change', ({error}) => {
      const displayError = document.getElementById('card-errors');
      if (error) {
        displayError.textContent = error.message;
      } else {
        displayError.textContent = '';
      }
    });
  }

  setupEventListeners() {
    // Formulario de pago
    document.getElementById('payment-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.processPayment();
    });

    // Métodos de pago
    document.querySelectorAll('.payment-method-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectPaymentMethod(card.dataset.method);
      });
    });

    // Checkbox de dirección
    document.getElementById('same-as-shipping').addEventListener('change', (e) => {
      if (e.target.checked) {
        // Aquí podrías cargar la dirección de envío guardada
        console.log('Usar misma dirección de envío');
      }
    });

    // Validación de código postal
    document.getElementById('billing-zip').addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    });
  }

  selectPaymentMethod(method) {
    this.selectedPaymentMethod = method;
    
    // Actualizar UI
    document.querySelectorAll('.payment-method-card').forEach(card => {
      card.classList.remove('selected');
    });
    document.querySelector(`[data-method="${method}"]`).classList.add('selected');
    
    // Mostrar/ocultar formularios
    document.getElementById('card-payment-form').style.display = method === 'card' ? 'block' : 'none';
    document.getElementById('paypal-payment-form').style.display = method === 'paypal' ? 'block' : 'none';
    document.getElementById('transfer-payment-form').style.display = method === 'transfer' ? 'block' : 'none';
  }

  renderOrderSummary() {
    const container = document.getElementById('order-items');
    
    container.innerHTML = this.orderData.items.map(item => `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div>
          <div class="fw-semibold">${item.nombre}</div>
          <small class="text-muted">Cantidad: ${item.cantidad}</small>
        </div>
        <span>$${Number(item.precio * item.cantidad).toLocaleString()}</span>
      </div>
    `).join('');

    // Actualizar totales
    document.getElementById('order-subtotal').textContent = `$${Number(this.orderData.subtotal).toLocaleString()}`;
    document.getElementById('order-shipping').textContent = this.orderData.envio === 0 ? 
      '<span class="text-success">GRATIS</span>' : 
      `$${Number(this.orderData.envio).toLocaleString()}`;
    document.getElementById('order-tax').textContent = `$${Number(this.orderData.iva).toLocaleString()}`;
    document.getElementById('order-total').textContent = `$${Number(this.orderData.total).toLocaleString()}`;
  }

  async processPayment() {
    try {
      this.showProcessing(true);
      
      if (this.selectedPaymentMethod === 'card') {
        await this.processCardPayment();
      } else if (this.selectedPaymentMethod === 'paypal') {
        await this.processPayPalPayment();
      } else if (this.selectedPaymentMethod === 'transfer') {
        await this.processTransferPayment();
      }
      
    } catch (error) {
      console.error('Error en el pago:', error);
      this.showError('Ocurrió un error al procesar tu pago. Por favor intenta nuevamente.');
      this.showProcessing(false);
    }
  }

  async processCardPayment() {
    // Validar formulario
    if (!this.validateCardForm()) {
      this.showProcessing(false);
      return;
    }

    try {
      // Crear Payment Intent en el backend
      const response = await fetch('http://localhost:5000/payment/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: this.orderData.total,
          currency: this.orderData.currency,
          metadata: {
            order_id: `order_${Date.now()}`,
            items: JSON.stringify(this.orderData.items)
          }
        })
      });

      if (!response.ok) throw new Error('Error al crear intención de pago');
      
      const { clientSecret, paymentIntentId } = await response.json();
      this.clientSecret = clientSecret;

      // Confirmar pago con Stripe
      const { error, paymentIntent } = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: this.cardElement,
          billing_details: {
            name: document.getElementById('card-name').value,
            email: document.getElementById('card-email').value,
            address: {
              line1: document.getElementById('billing-street').value,
              city: document.getElementById('billing-city').value,
              state: document.getElementById('billing-state').value,
              postal_code: document.getElementById('billing-zip').value,
            }
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Confirmar pago en el backend
      await this.confirmPaymentBackend(paymentIntent.id);

      // Mostrar éxito
      this.showSuccess(paymentIntent.id);

    } catch (error) {
      console.error('Error procesando pago con tarjeta:', error);
      throw error;
    }
  }

  async processPayPalPayment() {
    // Simulación de proceso PayPal
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // En producción, aquí redirigirías a PayPal
    const paymentId = `paypal_${Date.now()}`;
    this.showSuccess(paymentId);
  }

  async processTransferPayment() {
    const reference = document.getElementById('transfer-reference').value;
    
    if (!reference) {
      alert('Por favor ingresa el número de referencia');
      this.showProcessing(false);
      return;
    }

    // Simulación de proceso transferencia
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const paymentId = `transfer_${Date.now()}`;
    this.showSuccess(paymentId);
  }

  validateCardForm() {
    const name = document.getElementById('card-name').value;
    const email = document.getElementById('card-email').value;
    const street = document.getElementById('billing-street').value;
    const city = document.getElementById('billing-city').value;
    const state = document.getElementById('billing-state').value;
    const zip = document.getElementById('billing-zip').value;

    if (!name || !email || !street || !city || !state || !zip) {
      alert('Por favor completa todos los campos requeridos');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Por favor ingresa un email válido');
      return false;
    }

    if (zip.length !== 5) {
      alert('El código postal debe tener 5 dígitos');
      return false;
    }

    return true;
  }

  async confirmPaymentBackend(paymentIntentId) {
    const response = await fetch('http://localhost:5000/payment/confirm-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        paymentIntentId: paymentIntentId,
        pedidoId: `order_${Date.now()}`,
        metodoPago: this.selectedPaymentMethod.toUpperCase()
      })
    });

    if (!response.ok) {
      throw new Error('Error al confirmar pago en el backend');
    }

    return await response.json();
  }

  showProcessing(show) {
    const overlay = document.getElementById('processing-overlay');
    overlay.style.display = show ? 'flex' : 'none';
  }

  showSuccess(paymentId) {
    this.showProcessing(false);
    
    // Actualizar número de pedido
    document.getElementById('order-number').textContent = `#${paymentId}`;
    
    // Mostrar modal de éxito
    const modal = new bootstrap.Modal(document.getElementById('success-modal'));
    modal.show();
    
    // Limpiar carrito
    localStorage.removeItem('carrito');
    
    // Actualizar contador del carrito
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
      cartCount.style.display = 'none';
      cartCount.textContent = '0';
    }
  }

  showError(message) {
    alert(message); // En producción, usar un sistema de notificaciones mejor
  }
}

// Funciones globales
window.applyPromoCode = function() {
  const code = document.getElementById('promo-code').value.toUpperCase();
  
  if (code === 'DESCUENTO10') {
    const discount = checkout.orderData.total * 0.1;
    document.getElementById('order-discount').textContent = `-$${Number(discount).toLocaleString()}`;
    document.getElementById('order-total').textContent = `$${Number(checkout.orderData.total - discount).toLocaleString()}`;
    
    // Mostrar mensaje de éxito
    const promoInput = document.getElementById('promo-code');
    promoInput.classList.add('is-valid');
    promoInput.disabled = true;
    
    setTimeout(() => {
      alert('¡Código de descuento aplicado! 10% de descuento.');
    }, 500);
  } else {
    alert('Código de descuento inválido');
  }
};

window.viewOrder = function() {
  window.location.href = 'mis-pedidos.html';
};

window.continueShopping = function() {
  window.location.href = 'index.html';
};

// Inicialización cuando el DOM esté listo
let checkout;

document.addEventListener('DOMContentLoaded', () => {
  // Verificar autenticación
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Debes iniciar sesión para continuar con el pago');
    window.location.href = 'login.html';
    return;
  }

  // Inicializar checkout
  checkout = new StripeCheckout();
});
