function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
}

function getRoles(user) {
  if (!user) return [];
  if (Array.isArray(user.roles)) {
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
  const vendedorNav = document.getElementById('navVendedor');
  const userName = document.getElementById('navUserName');

  const logged = isLoggedIn();
  const user = getUser();
  const roles = getRoles(user);
  const canAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
  const isVendedor = roles.includes('VENDEDOR');

  const linkMisPedidos = document.querySelector('a[href="mis-pedidos.html"]');
  if (linkMisPedidos) {
    linkMisPedidos.style.display = logged && (canAdmin || isVendedor) ? 'none' : '';
  }

  const linkProductosGestion = document.querySelector('a[href="producto.html"]');
  if (linkProductosGestion) {
    if (!logged || !(canAdmin || isVendedor)) linkProductosGestion.remove();
  }

  if (guest) guest.style.display = logged ? 'none' : '';
  if (userNav) userNav.style.display = logged ? '' : 'none';
  
  // Panel de administración (solo ADMIN y SUPER_ADMIN)
  if (adminNav) {
    adminNav.style.display = logged && canAdmin ? '' : 'none';
    if (logged && canAdmin) {
      adminNav.innerHTML = `
        <div class="dropdown d-inline-block">
          <a class="text-dark text-decoration-none dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
            Administración
          </a>
          <ul class="dropdown-menu">
            <li><h6 class="dropdown-header">Panel</h6></li>
            <li><a class="dropdown-item" href="admin.html">Panel de administración</a></li>
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
    } else {
      adminNav.innerHTML = '<a class="text-dark text-decoration-none" href="admin.html">Administración</a>';
    }
  }
  
  // Panel de vendedor (solo VENDEDORES)
  if (vendedorNav) {
    vendedorNav.style.display = logged && isVendedor ? '' : 'none';
  }
  
  if (userName) userName.textContent = logged ? (user.nombre || user.email || 'Mi cuenta') : '';

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.style.display = logged ? '' : 'none';
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.href = 'index.html';
    });
  }
}

window.auth = {
  getUser,
  getRoles,
  isLoggedIn,
  renderAuthNav
};
