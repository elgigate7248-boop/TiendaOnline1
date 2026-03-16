const paramsBusqueda = new URLSearchParams(window.location.search);
const termino = (paramsBusqueda.get('q') || '').trim();
const contResultados = document.getElementById('resultadosBusqueda');
const resumen = document.getElementById('resumenBusqueda');
const inputBusqueda = document.getElementById('busquedaResultados');
const ordenBusqueda = document.getElementById('ordenBusqueda');
const paginacionWrap = document.getElementById('paginacionBusquedaWrap');
const paginacionLista = document.getElementById('paginacionBusqueda');
const PAGE_SIZE = 12;
let resultadosActuales = [];
let paginaActual = 1;

function normalizar(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function escapeHtml(str) {
  if (window.UIKit && typeof window.UIKit.escapeHtml === 'function') {
    return window.UIKit.escapeHtml(str);
  }
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function construirRegexTerminos(query) {
  const tokens = String(query || '')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .map((t) => escapeRegExp(t));
  if (!tokens.length) return null;
  return new RegExp(`(${tokens.join('|')})`, 'gi');
}

function resaltarCoincidencias(texto, regexTerminos) {
  const raw = String(texto || '');
  if (!regexTerminos) return escapeHtml(raw);

  let result = '';
  let lastIndex = 0;
  let match;
  regexTerminos.lastIndex = 0;
  while ((match = regexTerminos.exec(raw)) !== null) {
    const index = match.index;
    const matched = match[0];
    result += escapeHtml(raw.slice(lastIndex, index));
    result += `<mark class="px-0">${escapeHtml(matched)}</mark>`;
    lastIndex = index + matched.length;
  }
  result += escapeHtml(raw.slice(lastIndex));
  return result;
}

function puntajeRelevancia(producto, qNorm) {
  const nombre = normalizar(producto.nombre);
  const desc = normalizar(producto.descripcion);
  let score = 0;
  if (nombre === qNorm) score += 120;
  if (nombre.startsWith(qNorm)) score += 80;
  if (nombre.includes(qNorm)) score += 50;
  if (desc.includes(qNorm)) score += 25;
  if (Number(producto.stock) > 0) score += 5;
  return score;
}

function getCarrito() {
  try {
    return JSON.parse(localStorage.getItem('carrito') || '[]');
  } catch {
    return [];
  }
}

function setCarrito(items) {
  localStorage.setItem('carrito', JSON.stringify(items));
}

function actualizarBadgeCarrito() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  const total = getCarrito().reduce((acc, i) => acc + (Number(i.cantidad) || 0), 0);
  badge.textContent = String(total);
  badge.style.display = total > 0 ? 'inline-block' : 'none';
}

function toast(msg) {
  if (window.UIKit && typeof window.UIKit.showToast === 'function') {
    window.UIKit.showToast(msg, 'success');
    return;
  }
  let t = document.getElementById('toastBusqueda');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toastBusqueda';
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#333;color:#fff;padding:10px 14px;border-radius:8px;z-index:2100;opacity:0;transition:opacity .2s;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2200);
}

function actualizarResumen() {
  if (!resumen) return;
  const total = resultadosActuales.length;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  resumen.textContent = `${total} resultado${total !== 1 ? 's' : ''} para "${termino}" · Página ${paginaActual} de ${totalPaginas}`;
}

function agregarAlCarrito(prod) {
  const id = prod.id_producto ?? prod.id;
  if (!id) return;
  const carrito = getCarrito();
  const existente = carrito.find((i) => String(i.id) === String(id));
  if (existente) existente.cantidad = (Number(existente.cantidad) || 0) + 1;
  else carrito.push({ id, nombre: prod.nombre, precio: Number(prod.precio) || 0, cantidad: 1 });
  setCarrito(carrito);
  actualizarBadgeCarrito();
  toast('Producto agregado al carrito');
}

function ordenarResultados(lista) {
  const criterio = ordenBusqueda ? ordenBusqueda.value : 'relevancia';
  const arr = [...lista];
  if (criterio === 'precio_asc') return arr.sort((a, b) => (Number(a.precio) || 0) - (Number(b.precio) || 0));
  if (criterio === 'precio_desc') return arr.sort((a, b) => (Number(b.precio) || 0) - (Number(a.precio) || 0));
  if (criterio === 'nombre_asc') return arr.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
  if (criterio === 'nombre_desc') return arr.sort((a, b) => String(b.nombre || '').localeCompare(String(a.nombre || ''), 'es'));
  return arr.sort((a, b) => {
    const sa = Number(a._score) || 0;
    const sb = Number(b._score) || 0;
    return sb - sa;
  });
}

function renderResultados() {
  const regexTerminos = construirRegexTerminos(termino);
  const ordenados = ordenarResultados(resultadosActuales);
  const total = ordenados.length;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  paginaActual = Math.max(1, Math.min(paginaActual, totalPaginas));
  const inicio = (paginaActual - 1) * PAGE_SIZE;
  const fin = inicio + PAGE_SIZE;
  const paginados = ordenados.slice(inicio, fin);
  contResultados.innerHTML = '';
  renderPaginacion(totalPaginas);
  actualizarResumen();

  paginados.forEach((p) => {
    const col = document.createElement('div');
    col.className = 'col-12 col-sm-6 col-lg-4 mb-4';
    const nombreSafe = resaltarCoincidencias(p.nombre, regexTerminos);
    const descSafe = resaltarCoincidencias(p.descripcion || '', regexTerminos);
    col.innerHTML = `
      <div class="card h-100 shadow-sm">
        <img src="${p.imagen || 'https://via.placeholder.com/300x200'}" class="card-img-top" alt="${escapeHtml(p.nombre)}">
        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${nombreSafe}</h5>
          <p class="card-text text-muted flex-grow-1">${descSafe}</p>
          <p class="card-text fw-bold mb-3">$${Number(p.precio || 0).toLocaleString()}</p>
          <div class="d-flex gap-2">
            <button class="btn btn-primary w-100" type="button">Agregar al carrito</button>
            <a class="btn btn-outline-dark w-100" href="detalle-producto.html?id=${p.id_producto ?? p.id}">Ver</a>
          </div>
        </div>
      </div>
    `;
    const btn = col.querySelector('button');
    btn.addEventListener('click', () => agregarAlCarrito(p));
    contResultados.appendChild(col);
  });
}

function itemPagina(label, page, disabled = false, active = false) {
  const li = document.createElement('li');
  li.className = `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;
  const btn = document.createElement('button');
  btn.className = 'page-link';
  btn.type = 'button';
  btn.textContent = label;
  if (!disabled) {
    btn.addEventListener('click', () => {
      paginaActual = page;
      renderResultados();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  li.appendChild(btn);
  return li;
}

function renderPaginacion(totalPaginas) {
  if (!paginacionWrap || !paginacionLista) return;
  paginacionLista.innerHTML = '';
  if (totalPaginas <= 1) {
    paginacionWrap.style.display = 'none';
    return;
  }
  paginacionWrap.style.display = '';

  paginacionLista.appendChild(itemPagina('Anterior', paginaActual - 1, paginaActual === 1, false));

  const maxVisibles = 5;
  let start = Math.max(1, paginaActual - Math.floor(maxVisibles / 2));
  let end = Math.min(totalPaginas, start + maxVisibles - 1);
  if ((end - start + 1) < maxVisibles) {
    start = Math.max(1, end - maxVisibles + 1);
  }

  if (start > 1) {
    paginacionLista.appendChild(itemPagina('1', 1));
    if (start > 2) {
      const dots = document.createElement('li');
      dots.className = 'page-item disabled';
      dots.innerHTML = '<span class="page-link">...</span>';
      paginacionLista.appendChild(dots);
    }
  }

  for (let p = start; p <= end; p += 1) {
    paginacionLista.appendChild(itemPagina(String(p), p, false, p === paginaActual));
  }

  if (end < totalPaginas) {
    if (end < totalPaginas - 1) {
      const dots = document.createElement('li');
      dots.className = 'page-item disabled';
      dots.innerHTML = '<span class="page-link">...</span>';
      paginacionLista.appendChild(dots);
    }
    paginacionLista.appendChild(itemPagina(String(totalPaginas), totalPaginas));
  }

  paginacionLista.appendChild(itemPagina('Siguiente', paginaActual + 1, paginaActual === totalPaginas, false));
}

async function cargarResultados() {
  if (inputBusqueda) inputBusqueda.value = termino;

  if (!termino) {
    resumen.textContent = 'Escribe un término para buscar.';
    contResultados.innerHTML = '<div class="col-12"><div class="alert alert-light border">No se indicó término de búsqueda.</div></div>';
    return;
  }

  contResultados.innerHTML = '<div class="col-12 text-muted py-3">Buscando productos...</div>';
  try {
    const res = await fetch('http://localhost:5000/producto');
    const productos = await res.json();
    const lista = Array.isArray(productos) ? productos : [];
    const q = normalizar(termino);

    const filtrados = lista.filter((p) => {
      const nombre = normalizar(p.nombre);
      const desc = normalizar(p.descripcion);
      return nombre.includes(q) || desc.includes(q);
    }).map((p) => ({ ...p, _score: puntajeRelevancia(p, q) }));

    if (!filtrados.length) {
      contResultados.innerHTML = '<div class="col-12"><div class="alert alert-light border">No encontramos productos para tu búsqueda.</div></div>';
      if (paginacionWrap) paginacionWrap.style.display = 'none';
      return;
    }

    resultadosActuales = filtrados;
    paginaActual = 1;
    renderResultados();
  } catch {
    contResultados.innerHTML = '<div class="col-12"><div class="alert alert-danger">Error al cargar resultados de búsqueda.</div></div>';
    if (paginacionWrap) paginacionWrap.style.display = 'none';
  }
}

actualizarBadgeCarrito();
if (ordenBusqueda) {
  ordenBusqueda.addEventListener('change', () => {
    if (!resultadosActuales.length) return;
    paginaActual = 1;
    renderResultados();
  });
}
cargarResultados();

