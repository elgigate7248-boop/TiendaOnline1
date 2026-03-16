function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function getRoles(user) {
  if (!user) return [];
  if (Array.isArray(user.roles)) {
    // roles puede venir como array de strings ["ADMIN"]
    // o array de objetos [{ id_rol, nombre: "ADMIN" }]
    return user.roles
      .map(r => (r && typeof r === 'object') ? r.nombre : r)
      .map(r => String(r || '').trim().toUpperCase())
      .filter(Boolean);
  }
  if (user.rol) return [String(user.rol).trim().toUpperCase()];
  return [];
}

function isLoggedIn() {
  return !!localStorage.getItem('token');
}

function renderAuthNav() {
  const guest = document.getElementById('navGuest');
  const userNav = document.getElementById('navUser');
  const adminNav = document.getElementById('navAdmin');
  const userName = document.getElementById('navUserName');

  const logged = isLoggedIn();
  const user = getUser();
  const roles = getRoles(user);
  const canAdmin = roles.includes('ADMIN') || roles.includes('VENDEDOR') || roles.includes('SUPER_ADMIN');
  const isRepartidor = roles.includes('REPARTIDOR');

  // Si es admin, ocultar acceso a "Mis pedidos" (es una vista de cliente)
  const linkMisPedidos = document.querySelector('a[href="mis-pedidos.html"]');
  if (linkMisPedidos) {
    linkMisPedidos.style.display = logged && canAdmin ? 'none' : '';
  }

  // Gestión de productos: solo ADMIN/VENDEDOR/SUPER_ADMIN
  const linkProductosGestion = document.querySelector('a[href="producto.html"]');
  if (linkProductosGestion) {
    if (!logged || !canAdmin) {
      linkProductosGestion.remove();
    }
  }

  if (guest) guest.style.display = logged ? 'none' : '';
  if (userNav) userNav.style.display = logged ? '' : 'none';
  if (adminNav) {
    const showPanel = logged && (canAdmin || isRepartidor);
    adminNav.style.display = showPanel ? '' : 'none';
    if (logged && canAdmin) {
      const vendedorItem = roles.includes('VENDEDOR') || roles.includes('SUPER_ADMIN')
        ? '<li><a class="dropdown-item" href="vendedor.html">Panel de Vendedor</a></li><li><hr class="dropdown-divider"></li>'
        : '';
      adminNav.innerHTML = `
        <div class="dropdown d-inline-block">
          <a class="text-dark text-decoration-none dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
            Administración
          </a>
          <ul class="dropdown-menu">
            <li><h6 class="dropdown-header">Panel</h6></li>
            <li><a class="dropdown-item" href="admin.html">Panel de administración</a></li>
            ${vendedorItem}
            <li><a class="dropdown-item" href="repartidor.html">Panel de Repartidor</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><h6 class="dropdown-header">Gestión</h6></li>
            <li><a class="dropdown-item" href="admin.html#productos">Productos</a></li>
            <li><a class="dropdown-item" href="admin.html#categorias">Categorías</a></li>
            <li><a class="dropdown-item" href="admin.html#usuarios">Usuarios</a></li>
            <li><a class="dropdown-item" href="admin.html#pedidos">Pedidos</a></li>
            <li><a class="dropdown-item" href="admin.html#roles">Roles</a></li>
          </ul>
        </div>
      `;
    } else if (logged && isRepartidor) {
      adminNav.innerHTML = '<a class="text-dark text-decoration-none" href="repartidor.html"><i class="fas fa-truck me-1"></i>Panel Repartidor</a>';
    } else {
      adminNav.innerHTML = '<a class="text-dark text-decoration-none" href="admin.html">Administración</a>';
    }
  }
  if (userName) userName.textContent = logged ? (user.nombre || user.email || 'Mi cuenta') : '';

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.style.display = logged ? '' : 'none';
    btnLogout.onclick = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.href = 'index.html';
    };
  }
}

renderAuthNav();

// ===== Global cart badge =====
(function actualizarBadgeGlobal() {
  const badge = document.getElementById('cartCount');
  if (!badge) return;
  try {
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    const total = carrito.reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
    badge.textContent = String(total);
    badge.style.display = total > 0 ? 'inline-block' : 'none';
  } catch {}
})();

// ===== Global search: autosuggest + dedicated results page =====
(function activarBusquedaGlobal() {
  const forms = document.querySelectorAll('header form[role="search"]');
  if (!forms.length) return;

  const normalizarTexto = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  let catalogoPromise = null;
  async function obtenerCatalogo() {
    if (!catalogoPromise) {
      catalogoPromise = fetch(`${API_BASE}/producto`)
        .then((res) => res.json())
        .then((rows) => Array.isArray(rows) ? rows : [])
        .catch(() => []);
    }
    return catalogoPromise;
  }

  function irABusqueda(q) {
    const value = String(q || '').trim();
    if (!value) return;
    window.location.href = 'busqueda.html?q=' + encodeURIComponent(value);
  }

  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');

  forms.forEach((form) => {
    const input = form.querySelector('input[type="search"]');
    if (!input) return;

    if (q && !input.value) input.value = q;

    form.style.position = 'relative';
    const suggestBox = document.createElement('div');
    suggestBox.style.cssText = 'position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:1200;background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:8px;box-shadow:0 8px 22px rgba(0,0,0,.12);display:none;max-height:300px;overflow:auto;';
    form.appendChild(suggestBox);

    let lastSuggestions = [];
    function renderSuggestions(query) {
      const text = String(query || '').trim();
      if (!text || text.length < 2) {
        suggestBox.style.display = 'none';
        suggestBox.innerHTML = '';
        lastSuggestions = [];
        return;
      }

      obtenerCatalogo().then((catalogo) => {
        const nq = normalizarTexto(text);
        const found = catalogo
          .filter((p) => {
            const nombre = normalizarTexto(p.nombre || '');
            const desc = normalizarTexto(p.descripcion || '');
            return nombre.includes(nq) || desc.includes(nq);
          })
          .slice(0, 6);

        lastSuggestions = found;
        if (!found.length) {
          suggestBox.innerHTML = `<div style="padding:10px 12px;color:#6c757d;font-size:13px;">Sin sugerencias</div>`;
          suggestBox.style.display = 'block';
          return;
        }

        suggestBox.innerHTML = found.map((p) => {
          const id = p.id_producto ?? p.id;
          const precio = Number(p.precio || 0).toLocaleString();
          return `<a href="detalle-producto.html?id=${id}" class="suggest-item" style="display:flex;justify-content:space-between;gap:12px;padding:10px 12px;text-decoration:none;color:#111;border-bottom:1px solid rgba(0,0,0,.06);">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${String(p.nombre || 'Producto')}</span>
            <span style="color:#6c757d;font-size:12px;">$${precio}</span>
          </a>`;
        }).join('') + `<button type="button" class="suggest-more" style="width:100%;border:0;background:#f8f9fa;padding:10px 12px;text-align:left;font-size:13px;color:#0d6efd;cursor:pointer;">Ver todos los resultados de "${text}"</button>`;
        suggestBox.style.display = 'block';

        const moreBtn = suggestBox.querySelector('.suggest-more');
        if (moreBtn) {
          moreBtn.onclick = () => irABusqueda(text);
        }
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      irABusqueda(input.value);
    });

    input.addEventListener('input', () => renderSuggestions(input.value));
    input.addEventListener('focus', () => renderSuggestions(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (input.value.trim()) {
          irABusqueda(input.value);
        } else if (lastSuggestions.length) {
          const first = lastSuggestions[0];
          const id = first.id_producto ?? first.id;
          window.location.href = `detalle-producto.html?id=${id}`;
        }
      }
      if (e.key === 'Escape') {
        suggestBox.style.display = 'none';
      }
    });
    input.addEventListener('search', () => irABusqueda(input.value));
    input.addEventListener('blur', () => {
      setTimeout(() => { suggestBox.style.display = 'none'; }, 140);
    });
  });
})();
