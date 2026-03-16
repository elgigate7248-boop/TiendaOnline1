// Punto de entrada principal
document.addEventListener('DOMContentLoaded', async () => {
  // Inicializar Autenticación y Nav
  if (window.auth) auth.renderAuthNav();

  // Inicializar Carrito badge
  if (window.cart) cart.actualizarBadgeCarrito();

  // Configurar Interfaz estática (Footers, componentes visuales...)
  if (window.ui) {
    ui.setYear();
    
    // Si estamos en la página que tiene #productos
    if (document.getElementById('productos')) {
      await ui.renderCatalogo();
      ui.initBuscador();
    }
    
    if (document.getElementById('vistosList') || document.getElementById('vistos')) {
      ui.renderVistos();
    }

    if (document.getElementById('masVendidos')) {
      ui.renderMasVendidos();
    }
  }

  // Handle URL Query searches automatically si venimos de otra pagina (busqueda local)
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) {
    const input = document.getElementById('busqueda');
    if (input) {
      input.value = q;
      input.dispatchEvent(new Event('input'));
    }
  }
});
