function initAdmin() {
  try { cargarDashboard(); } catch (e) { console.error('Error init Dashboard:', e); }
  try { cargarProductos(); } catch (e) { console.error('Error init Productos:', e); }
  try { cargarCategorias(); } catch (e) { console.error('Error init Categorias:', e); }
  try { cargarUsuarios(); } catch (e) { console.error('Error init Usuarios:', e); }
  try { cargarPedidos(); } catch (e) { console.error('Error init Pedidos:', e); }
  try { cargarVendedores(); } catch (e) { console.error('Error init Vendedores:', e); }
  try { cargarRoles(); } catch (e) { console.error('Error init Roles:', e); }
  try { cargarSolicitudesVendedor(); } catch (e) { console.error('Error init Solicitudes Vendedor:', e); }
  try { cargarSolicitudesRepartidor(); } catch (e) { console.error('Error init Solicitudes Repartidor:', e); }
  try { cargarEstadisticas(); } catch (e) { console.error('Error init Estadisticas:', e); }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
