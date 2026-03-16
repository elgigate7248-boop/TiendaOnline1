// Menú lateral dinámico según rol
function renderSidebar() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const logged = !!localStorage.getItem('token');
  const roles = Array.isArray(user.roles) ? user.roles : (user.rol ? [user.rol] : []);
  const esAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
  let html = `<h6 class='text-muted'>USUARIO</h6><ul class='list-unstyled mb-4'>
    <li><a href='index.html'>Página principal</a></li>
    <li><a href='index.html'>Lista de productos</a></li>
    <li><a href='favoritos.html'>Mis productos favoritos</a></li>
  </ul>`;
  if (esAdmin) {
    html += `<h6 class='text-muted'>ADMIN</h6><ul class='list-unstyled mb-4'>
      <li><a href='dashboard-analytics.html'><i class='fas fa-chart-line me-2'></i>Dashboard Analytics</a></li>
      <li><a href='kardex.html'><i class='fas fa-warehouse me-2'></i>Kardex - Inventario</a></li>
      <li><a href='gestion-pedidos.html'>Gestión de Pedidos</a></li>
      <li><a href='ordenes.html'>Órdenes</a></li>
      <li><a href='ventas.html'>Histórico de ventas</a></li>
      <li><a href='gastos.html'>Gastos</a></li>
      <li><a href='estadisticas.html'>Estadística de ventas y gastos</a></li>
      <li><a href='admin.html'>Administra tus productos</a></li>
      <li><a href='categorias.html'>Administra tus categorías</a></li>
      <li><a href='faq.html'>Preguntas Frecuentes</a></li>
    </ul>`;
  }

  html += `<h6 class='text-muted'>CUENTA</h6><ul class='list-unstyled mb-0'>`;
  if (logged) {
    html += `<li><a href='login.html' onclick='return cerrarSesion()'>Cerrar sesión</a></li>`;
  } else {
    html += `<li><a href='login.html'>Iniciar sesión</a></li>`;
  }
  html += `</ul>`;
  document.getElementById('sidebar').innerHTML = html;
}

function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  return true;
}

renderSidebar();
