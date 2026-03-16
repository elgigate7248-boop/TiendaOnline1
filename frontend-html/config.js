// URL base del backend.
// En localhost usa el servidor local; en producción (Vercel) usa el backend desplegado.
const API_BASE = (function () {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  // ← Reemplaza esta URL cuando despliegues el backend (Railway, Render, etc.)
  return 'https://TU_BACKEND_URL_AQUI.com';
})();
