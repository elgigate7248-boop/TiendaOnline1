// Dual-purpose: browsing for all users + admin tools for admins
const token = localStorage.getItem('token');
const cont = document.getElementById('categorias');
let categorias = [];

function getUserRoles() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const roles = Array.isArray(user.roles)
      ? user.roles.map(r => (r && typeof r === 'object') ? r.nombre : r).filter(Boolean)
      : [];
    return roles;
  } catch { return []; }
}

const esAdmin = getUserRoles().some(r => ['ADMIN','SUPER_ADMIN','VENDEDOR'].includes(r));

function showToast(message, type = 'info') {
  let container = document.getElementById('globalToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'globalToastContainer';
    container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2000;display:flex;flex-direction:column;gap:8px;max-width:360px;';
    document.body.appendChild(container);
  }

  const tone = type === 'success'
    ? { bg: '#198754', border: '#146c43' }
    : type === 'warning'
      ? { bg: '#ffc107', border: '#e6ac00', text: '#111' }
      : type === 'error'
        ? { bg: '#dc3545', border: '#b02a37' }
        : { bg: '#0d6efd', border: '#0a58ca' };

  const toast = document.createElement('div');
  toast.style.cssText = `background:${tone.bg};border:1px solid ${tone.border};color:${tone.text || '#fff'};padding:10px 12px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.2);font-size:14px;opacity:0;transform:translateY(-4px);transition:all .2s ease;`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-4px)';
    setTimeout(() => toast.remove(), 220);
  }, 2600);
}

// Show admin button if admin
if (esAdmin) {
  const btn = document.getElementById('btnNuevaCategoria');
  if (btn) btn.style.display = '';
}

function cargarCategorias() {
  cont.innerHTML = '<div class="text-muted text-center py-3">Cargando categorías...</div>';
  fetch('http://localhost:5000/categoria')
    .then(res => res.json())
    .then(data => {
      categorias = Array.isArray(data) ? data : [];
      renderCategorias();
    })
    .catch(() => {
      cont.innerHTML = '<div class="alert alert-danger">Error al cargar categorías.</div>';
    });
}

function renderCategorias(filtro = '') {
  // Show categories grid, hide products
  cont.parentElement.querySelector('#productosCategoria').style.display = 'none';
  cont.style.display = '';

  let filtradas = categorias.filter(c => c.nombre.toLowerCase().includes(filtro.toLowerCase()));

  let html = `<div class="col-12 mb-3">
    <div class="row align-items-center">
      <div class="col-md-6">
        <input class='form-control' placeholder='Buscar categoría...' oninput='filtrarCategorias(this.value)'>
      </div>
      <div class="col-md-6 text-end mt-2 mt-md-0">
        <small class="text-muted">${filtradas.length} categoría${filtradas.length !== 1 ? 's' : ''}</small>
      </div>
    </div>
  </div>`;

  if (!filtradas.length) {
    html += `<div class="col-12 text-center py-5">
      <div style="font-size:48px;">📂</div>
      <h4 class="mt-3">Sin categorías</h4>
      <p class="text-muted">No se encontraron categorías.</p>
    </div>`;
  } else {
    filtradas.forEach(cat => {
      const id = cat.id_categoria || cat.id;
      const adminMenu = esAdmin ? `
        <div class="dropdown">
          <button class='btn btn-sm btn-outline-secondary rounded-circle' data-bs-toggle='dropdown' aria-label="Opciones">⋯</button>
          <ul class='dropdown-menu dropdown-menu-end'>
            <li><a class='dropdown-item' href='#' onclick='editarCategoria(${id}); return false;'>Editar</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class='dropdown-item text-danger' href='#' onclick='eliminarCategoria(${id}); return false;'>Eliminar</a></li>
          </ul>
        </div>
      ` : '';

      html += `
        <div class="col-md-6 col-lg-4">
          <div class="card h-100 shadow-sm" style="cursor:pointer;" onclick="verProductosCategoria(${id}, '${cat.nombre.replace(/'/g, "\\'")}')">
            <div class="card-body d-flex flex-column">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <h5 class="card-title mb-0">${cat.nombre}</h5>
                ${adminMenu}
              </div>
              ${cat.descripcion ? `<p class="card-text text-muted small flex-grow-1">${cat.descripcion}</p>` : '<p class="card-text text-muted small flex-grow-1">Explora los productos de esta categoría</p>'}
              <div class="mt-auto pt-2">
                <span class="btn btn-sm btn-outline-dark w-100">Ver productos →</span>
              </div>
            </div>
          </div>
        </div>
      `;
    });
  }

  cont.innerHTML = html;
}

window.filtrarCategorias = renderCategorias;

// Show products for a category
window.verProductosCategoria = async function(idCat, nombre) {
  cont.style.display = 'none';
  const seccion = document.getElementById('productosCategoria');
  const titulo = document.getElementById('tituloProductosCat');
  const grid = document.getElementById('gridProductosCat');

  seccion.style.display = '';
  titulo.textContent = nombre;
  grid.innerHTML = '<div class="col-12 text-muted text-center py-3">Cargando productos...</div>';

  try {
    const res = await fetch(`http://localhost:5000/producto`);
    const todos = await res.json();
    const productos = (Array.isArray(todos) ? todos : []).filter(p => String(p.id_categoria) === String(idCat));

    if (!productos.length) {
      grid.innerHTML = `<div class="col-12 text-center py-5">
        <div style="font-size:48px;">📦</div>
        <h4 class="mt-3">Sin productos</h4>
        <p class="text-muted">Esta categoría aún no tiene productos.</p>
        <a href="index.html" class="btn btn-outline-dark btn-sm">Ir al catálogo</a>
      </div>`;
      return;
    }

    grid.innerHTML = '';
    productos.forEach(p => {
      const pid = p.id_producto ?? p.id;
      const col = document.createElement('div');
      col.className = 'col-6 col-md-4 col-lg-3 mb-3';
      col.innerHTML = `
        <a href="detalle-producto.html?id=${pid}" class="text-decoration-none text-dark">
          <div class="card h-100 shadow-sm">
            <img src="${p.imagen || 'https://via.placeholder.com/300x200'}" class="card-img-top" alt="${p.nombre}">
            <div class="card-body">
              <div class="fw-semibold">${p.nombre}</div>
              <div class="fw-bold text-dark">$${Number(p.precio).toLocaleString()}</div>
            </div>
          </div>
        </a>
      `;
      grid.appendChild(col);
    });
  } catch {
    grid.innerHTML = '<div class="col-12"><div class="alert alert-danger">Error al cargar productos.</div></div>';
  }
};

window.volverACategorias = function() {
  document.getElementById('productosCategoria').style.display = 'none';
  cont.style.display = '';
};

// ===== Admin CRUD (only works if admin) =====
window.mostrarFormCategoria = function() {
  document.getElementById('catNombre').value = '';
  const desc = document.getElementById('catDescripcion');
  if (desc) desc.value = '';
  document.getElementById('catMsg').innerHTML = '';
  document.getElementById('formCategoria').onsubmit = crearCategoria;
  new bootstrap.Modal(document.getElementById('modalCategoria')).show();
};

async function crearCategoria(e) {
  e.preventDefault();
  const nombre = document.getElementById('catNombre').value;
  const desc = document.getElementById('catDescripcion');
  const descripcion = desc ? desc.value : '';
  const msg = document.getElementById('catMsg');
  msg.textContent = '';
  try {
    const res = await fetch('http://localhost:5000/categoria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ nombre, descripcion })
    });
    const data = await res.json();
    if (res.ok) {
      msg.innerHTML = '<div class="alert alert-success">Categoría creada.</div>';
      setTimeout(() => { bootstrap.Modal.getInstance(document.getElementById('modalCategoria')).hide(); cargarCategorias(); }, 800);
    } else {
      msg.innerHTML = '<div class="alert alert-danger">' + (data.error || 'Error') + '</div>';
    }
  } catch {
    msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
  }
}

window.editarCategoria = function(id) {
  const cat = categorias.find(c => (c.id_categoria || c.id) == id);
  if (!cat) return;
  document.getElementById('catNombre').value = cat.nombre;
  const desc = document.getElementById('catDescripcion');
  if (desc) desc.value = cat.descripcion || '';
  document.getElementById('catMsg').innerHTML = '';
  document.getElementById('formCategoria').onsubmit = function(e) { actualizarCategoria(e, id); };
  new bootstrap.Modal(document.getElementById('modalCategoria')).show();
};

async function actualizarCategoria(e, id) {
  e.preventDefault();
  const nombre = document.getElementById('catNombre').value;
  const desc = document.getElementById('catDescripcion');
  const descripcion = desc ? desc.value : '';
  const msg = document.getElementById('catMsg');
  msg.textContent = '';
  try {
    const res = await fetch(`http://localhost:5000/categoria/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ nombre, descripcion })
    });
    const data = await res.json();
    if (res.ok) {
      msg.innerHTML = '<div class="alert alert-success">Categoría actualizada.</div>';
      setTimeout(() => { bootstrap.Modal.getInstance(document.getElementById('modalCategoria')).hide(); cargarCategorias(); }, 800);
    } else {
      msg.innerHTML = '<div class="alert alert-danger">' + (data.error || 'Error') + '</div>';
    }
  } catch {
    msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
  }
}

window.eliminarCategoria = function(id) {
  const cat = categorias.find(c => (c.id_categoria || c.id) == id);
  if (!cat) return;
  if (!confirm(`¿Eliminar la categoría "${cat.nombre}"?`)) return;
  fetch(`http://localhost:5000/categoria/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  })
    .then(res => res.json())
    .then(() => {
      cargarCategorias();
      showToast('Categoría eliminada correctamente', 'success');
    })
    .catch(() => showToast('Error al eliminar la categoría', 'error'));
};

cargarCategorias();
