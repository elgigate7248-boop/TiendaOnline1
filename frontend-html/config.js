// URL base del backend.
// En localhost usa el servidor local; en producción (Vercel) usa el backend desplegado.
const API_BASE = (function () {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  return 'https://tiendaonline1.onrender.com';
})();
