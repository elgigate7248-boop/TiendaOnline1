function mostrarToast(msg) {
  let toast = document.getElementById('toastCarrito');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastCarrito';
    toast.className = 'toast show position-fixed bottom-0 end-0 m-3 align-items-center text-white bg-dark border-0';
    toast.style.zIndex = '10000';
    toast.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div></div>`;
    document.body.appendChild(toast);
  } else {
    toast.querySelector('.toast-body').textContent = msg;
    toast.classList.add('show');
  }
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function renderCardTemplate(prod) {
  const id = prod.id_producto ?? prod.id;
  const imgUrl = prod.imagen || 'https://via.placeholder.com/300x200?text=Sin+Imagen';
  const nombre = prod.nombre || 'Producto sin nombre';
  const precio = Number(prod.precio || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const categoria = prod.categoria || 'Varios';
  
  return `
    <div class="col-12 col-sm-6 col-lg-4 mb-4 product-card-wrapper" data-nombre="${normalizar(nombre)}" data-categoria="${normalizar(categoria)}" data-marca="${normalizar(prod.marca||'')}">
      <div class="card h-100 shadow-sm ml-product-card border-0">
        <div class="overflow-hidden" style="border-radius: 12px 12px 0 0;">
           <img src="${imgUrl}" class="card-img-top" alt="Imagen de ${nombre}" loading="lazy">
        </div>
        <div class="card-body d-flex flex-column">
          <div class="small text-brand mb-1 fw-bold">${categoria}</div>
          <h3 class="card-title h6 fw-semibold mb-2">${nombre}</h3>
          <p class="card-text fw-bold fs-5 text-dark mb-3 mt-auto">$${precio}</p>
          <div class="d-flex gap-2">
            <button class="btn btn-primary btn-add-cart flex-grow-1" type="button" aria-label="Agregar al carrito">Agregar al carrito</button>
            <a href="detalle-producto.html?id=${id}" class="btn btn-outline-secondary btn-ver-detalle" aria-label="Ver producto ${nombre}">Ver</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function renderCatalogo() {
  const cont = document.getElementById('productos');
  if (!cont) return;
  cont.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Cargando...</span>
      </div>
      <p class="mt-2 text-muted">Cargando catálogo...</p>
    </div>
  `;
  
  const catalogo = await products.getCatalogo();
  if (!catalogo || catalogo.length === 0) {
    cont.innerHTML = '<div class="col-12"><div class="alert alert-info">No hay productos disponibles.</div></div>';
    return;
  }
  
  cont.innerHTML = '';
  catalogo.forEach(prod => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderCardTemplate(prod).trim();
    const el = wrapper.firstChild;
    
    // Add event listeners
    const btnCart = el.querySelector('.btn-add-cart');
    btnCart.addEventListener('click', (e) => {
      e.preventDefault();
      cart.agregarAlCarrito(prod);
    });

    const btnVer = el.querySelector('.btn-ver-detalle');
    btnVer.addEventListener('click', () => {
      products.agregarAVistos(prod);
    });

    cont.appendChild(el);
  });
}

function renderVistos() {
  const cont = document.getElementById('vistosList') || document.getElementById('vistos');
  if (!cont) return;

  const vistos = products.getVistosRecientemente();
  if (!vistos.length) {
    cont.innerHTML = '<div class="col-12"><div class="text-muted">Aún no has visto productos.</div></div>';
    return;
  }

  cont.innerHTML = '';
  vistos.forEach(prod => {
    const id = prod.id_producto ?? prod.id;
    const precio = Number(prod.precio || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
    cont.innerHTML += `
      <div class="col-12 col-sm-6 col-lg-2 mb-3">
        <div class="card h-100 shadow-sm ml-product-card border-0 bg-white">
          <div class="overflow-hidden" style="border-radius: 12px 12px 0 0;">
            <img src="${prod.imagen || 'https://via.placeholder.com/300x200'}" class="card-img-top" alt="Visto: ${prod.nombre}" style="height: 120px;" loading="lazy">
          </div>
          <div class="card-body p-2 text-center">
            <div class="fw-semibold small text-truncate" title="${prod.nombre}">${prod.nombre}</div>
            <div class="text-muted small">$${precio}</div>
            <a class="stretched-link" href="detalle-producto.html?id=${id}" aria-label="Ver detalle de ${prod.nombre}" onclick='products.agregarAVistos(${JSON.stringify(prod).replace(/"/g, "&quot;")})'></a>
          </div>
        </div>
      </div>
    `;
  });
}

async function renderMasVendidos() {
  const cont = document.getElementById('masVendidos');
  if (!cont) return;
  const catalogo = await products.getCatalogo();
  
  // Como no hay endpoint específico de destacados, usamos los primeros 4 del catálogo real.
  const destacados = catalogo.slice(0, 4);

  if (!destacados.length) {
    cont.innerHTML = '<div class="col-12"><div class="text-muted">No hay productos destacados por el momento.</div></div>';
    return;
  }

  cont.innerHTML = '';
  destacados.forEach(p => {
    const id = p.id_producto ?? p.id;
    const item = document.createElement('div');
    item.className = 'col-6 col-md-3 mb-3';
    item.innerHTML = `
      <div class="card h-100 shadow-sm ml-product-card border-0">
        <a href="detalle-producto.html?id=${id}" class="text-decoration-none text-dark" onclick='products.agregarAVistos(${JSON.stringify(p).replace(/"/g, "&quot;")})'>
          <div class="overflow-hidden" style="border-radius: 12px 12px 0 0;">
            <img src="${p.imagen || 'https://via.placeholder.com/300x200'}" class="card-img-top top-vendidos-img" alt="${p.nombre}" loading="lazy">
          </div>
          <div class="card-body p-3">
            <div class="badge bg-warning text-dark mb-2">Destacado</div>
            <h3 class="h6 fw-bold text-truncate" title="${p.nombre}">${p.nombre}</h3>
            <div class="text-success fw-bold">$${Number(p.precio).toLocaleString('en-US')}</div>
          </div>
        </a>
        <div class="card-footer bg-transparent border-0 p-3 pt-0">
          <button class="btn btn-sm btn-outline-primary w-100" onclick='cart.agregarAlCarrito(${JSON.stringify(p).replace(/"/g, "&quot;")})'>Comprar</button>
        </div>
      </div>
    `;
    cont.appendChild(item);
  });
}

function normalizar(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function initBuscador() {
  const input = document.getElementById('busqueda');
  const searchForm = document.getElementById('formBuscador');
  
  if (!input || !searchForm) return;

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
  });

  input.addEventListener('input', () => {
    const q = normalizar(input.value);
    
    // Filter product cards in the page
    const cards = document.querySelectorAll('.product-card-wrapper');
    let foundCount = 0;

    cards.forEach(card => {
      const nombre = card.dataset.nombre || '';
      const cat = card.dataset.categoria || '';
      const marca = card.dataset.marca || '';

      if (nombre.includes(q) || cat.includes(q) || marca.includes(q)) {
        card.style.display = '';
        foundCount++;
      } else {
        card.style.display = 'none';
      }
    });

    const noResultsMsg = document.getElementById('noResultsMessage');
    const cont = document.getElementById('productos');
    if (foundCount === 0 && cont) {
      if (!noResultsMsg) {
        const div = document.createElement('div');
        div.id = 'noResultsMessage';
        div.className = 'col-12 mt-4';
        div.innerHTML = `<div class="alert alert-warning text-center">No se encontraron productos para "<b>${input.value}</b>".</div>`;
        cont.parentElement.insertBefore(div, cont.nextSibling); // Insert after product container
      } else {
        noResultsMsg.style.display = 'block';
        noResultsMsg.querySelector('b').textContent = input.value;
      }
    } else if (noResultsMsg) {
      noResultsMsg.style.display = 'none';
    }
  });
}

function setYear() {
  const el = document.getElementById('currentYear');
  if (el) {
    el.textContent = new Date().getFullYear();
  }
}

// Clean button for vistos
document.addEventListener('DOMContentLoaded', () => {
  const btnLimpiar = document.getElementById('btnLimpiarVistos');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', products.limpiarVistos);
  }
});

window.ui = {
  mostrarToast,
  renderCatalogo,
  renderVistos,
  renderMasVendidos,
  initBuscador,
  setYear
};
