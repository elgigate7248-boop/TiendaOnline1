function getCarrito() {
  return JSON.parse(localStorage.getItem('carrito') || '[]');
}

function setCarrito(carrito) {
  localStorage.setItem('carrito', JSON.stringify(carrito));
  actualizarBadgeCarrito();
}

function contarItems(carrito) {
  return carrito.reduce((acc, item) => acc + (Number(item.cantidad) || 0), 0);
}

function actualizarBadgeCarrito() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  const total = contarItems(getCarrito());
  badge.textContent = String(total);
  badge.style.display = total > 0 ? 'inline-block' : 'none';
}

function agregarAlCarrito(prod) {
  const id = prod.id_producto ?? prod.id;
  if (id == null) return;

  const carrito = getCarrito();
  const existente = carrito.find(item => item.id == id);

  if (existente) {
    existente.cantidad = (Number(existente.cantidad) || 0) + 1;
  } else {
    carrito.push({
      id,
      nombre: prod.nombre,
      precio: Number(prod.precio) || 0,
      cantidad: 1,
      imagen: prod.imagen || null,
      ciudad_origen: prod.ciudad_origen || prod.ciudadOrigen || null
    });
  }

  setCarrito(carrito);
  if (window.ui) ui.mostrarToast('Producto agregado al carrito con éxito 🛒');
}

function eliminarDelCarrito(id) {
  let carrito = getCarrito();
  carrito = carrito.filter(item => item.id != id);
  setCarrito(carrito);
}

function cambiarCantidad(id, cantidad) {
  let carrito = getCarrito();
  const index = carrito.findIndex(item => item.id == id);
  if (index !== -1) {
    const nuevaCant = parseInt(cantidad, 10);
    if (nuevaCant <= 0) {
      carrito.splice(index, 1);
    } else {
      carrito[index].cantidad = nuevaCant;
    }
  }
  setCarrito(carrito);
}

function calcularTotal() {
  const carrito = getCarrito();
  return carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
}

window.cart = {
  getCarrito, setCarrito, contarItems, actualizarBadgeCarrito, agregarAlCarrito, eliminarDelCarrito, cambiarCantidad, calcularTotal
};
