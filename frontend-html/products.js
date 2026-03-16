async function getCatalogo() {
  try {
    const res = await fetch('http://localhost:5000/producto');
    if (!res.ok) throw new Error("Fallo en red");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch(e) {
    console.warn("Backend no disponible o error al obtener productos.");
    return [];
  }
}

function getVistosRecientemente() {
  try { return JSON.parse(localStorage.getItem('vistos') || '[]'); } catch { return []; }
}

function agregarAVistos(producto) {
  let vistos = getVistosRecientemente();
  vistos = vistos.filter(v => (v.id_producto ?? v.id) != (producto.id_producto ?? producto.id)); // Eliminar existente
  vistos.unshift(producto); // Agregar la posicion más reciente al inicio
  if (vistos.length > 5) vistos.pop(); // Mantener solo máximo 5
  localStorage.setItem('vistos', JSON.stringify(vistos));
}

function limpiarVistos() {
  localStorage.removeItem('vistos');
  if (window.ui) ui.renderVistos();
}

window.products = {
  getCatalogo,
  getVistosRecientemente,
  agregarAVistos,
  limpiarVistos
};
