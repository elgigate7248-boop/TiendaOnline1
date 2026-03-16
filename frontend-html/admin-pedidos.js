// Pedidos

let pedidosCache = [];
let usuariosPedidoCache = [];

function badgeEstadoPedido(idEstado) {
  const estado = Number(idEstado);
  if (estado === 1) return '<span class="badge bg-warning text-dark">Pendiente</span>';
  if (estado === 2) return '<span class="badge bg-primary">Pagado</span>';
  if (estado === 3) return '<span class="badge bg-info text-dark">Enviado</span>';
  if (estado === 4) return '<span class="badge bg-success">Entregado</span>';
  if (estado === 5) return '<span class="badge bg-danger">Cancelado</span>';
  return '<span class="badge bg-secondary">Desconocido</span>';
}

function toDatetimeLocalValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

function ensurePedidoModal() {
  if (document.getElementById('modalPedidoCrud')) return;
  const html = `
    <div class="modal fade" id="modalPedidoCrud" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="formPedidoCrud">
            <div class="modal-header">
              <h5 class="modal-title" id="modalPedidoCrudLabel">Nuevo pedido</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="pedidoCrudId">
              <div class="mb-3">
                <label class="form-label fw-semibold">Usuario</label>
                <select id="pedidoCrudUsuario" class="form-select" required></select>
              </div>
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Estado</label>
                  <select id="pedidoCrudEstado" class="form-select" required>
                    <option value="1">Pendiente</option>
                    <option value="2">Pagado</option>
                    <option value="3">Enviado</option>
                    <option value="4">Entregado</option>
                    <option value="5">Cancelado</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-semibold">Total</label>
                  <input id="pedidoCrudTotal" type="number" min="0" step="0.01" class="form-control" required>
                </div>
              </div>
              <div class="mt-3">
                <label class="form-label fw-semibold">Fecha del pedido</label>
                <input id="pedidoCrudFecha" type="datetime-local" class="form-control">
              </div>
              <div id="pedidoCrudMsg" class="mt-3"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="btnGuardarPedidoCrud">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function cargarUsuariosPedidoSelect(selectedId) {
  const select = document.getElementById('pedidoCrudUsuario');
  if (!select) return;
  if (!usuariosPedidoCache.length) {
    const res = await fetchAuth('http://localhost:5000/usuario');
    const data = await safeJson(res);
    if (!res.ok) throw new Error((data && (data.error || data.mensaje)) || `HTTP ${res.status}`);
    usuariosPedidoCache = Array.isArray(data) ? data : [];
  }
  select.innerHTML = '<option value="">Seleccionar usuario...</option>';
  usuariosPedidoCache.forEach((u) => {
    const id = u.id_usuario || u.id;
    select.innerHTML += `<option value="${id}">${escapeHtml(u.nombre || '')} - ${escapeHtml(u.email || '')}</option>`;
  });
  if (selectedId) select.value = String(selectedId);
}

window.abrirNuevoPedido = async function () {
  if (!puedeCrudPedidos) {
    showToast('Solo ADMIN puede crear pedidos desde este panel.', 'warning');
    return;
  }
  ensurePedidoModal();
  document.getElementById('modalPedidoCrudLabel').textContent = 'Nuevo pedido';
  document.getElementById('pedidoCrudId').value = '';
  document.getElementById('pedidoCrudEstado').value = '1';
  document.getElementById('pedidoCrudTotal').value = '0';
  document.getElementById('pedidoCrudFecha').value = '';
  document.getElementById('pedidoCrudMsg').innerHTML = '';
  await cargarUsuariosPedidoSelect('');
  new bootstrap.Modal(document.getElementById('modalPedidoCrud')).show();
};

window.editarPedidoAdmin = async function (id) {
  if (!puedeCrudPedidos) {
    showToast('Solo ADMIN puede editar pedidos.', 'warning');
    return;
  }
  const pedido = pedidosCache.find((p) => String(p.id_pedido || p.id) === String(id));
  if (!pedido) {
    showToast('Pedido no encontrado', 'warning');
    return;
  }
  ensurePedidoModal();
  document.getElementById('modalPedidoCrudLabel').textContent = `Editar pedido #${id}`;
  document.getElementById('pedidoCrudId').value = String(id);
  document.getElementById('pedidoCrudEstado').value = String(pedido.id_estado || 1);
  document.getElementById('pedidoCrudTotal').value = String(Number(pedido.total || 0));
  document.getElementById('pedidoCrudFecha').value = toDatetimeLocalValue(pedido.fecha_pedido || pedido.fecha);
  document.getElementById('pedidoCrudMsg').innerHTML = '';
  await cargarUsuariosPedidoSelect(pedido.id_usuario);
  new bootstrap.Modal(document.getElementById('modalPedidoCrud')).show();
};

window.eliminarPedidoAdmin = async function (id) {
  if (!puedeCrudPedidos) {
    showToast('Solo ADMIN puede eliminar pedidos.', 'warning');
    return;
  }
  if (!confirm(`¿Eliminar el pedido #${id}? Esta acción revierte stock asociado y elimina pagos/detalles.`)) return;
  try {
    const res = await fetchAuth(`http://localhost:5000/pedido/${id}`, { method: 'DELETE' });
    const data = await safeJson(res);
    if (!res.ok) {
      showToast((data && (data.error || data.mensaje)) || 'No se pudo eliminar el pedido', 'error');
      return;
    }
    showToast('Pedido eliminado correctamente', 'success');
    cargarPedidos();
  } catch (err) {
    showToast(err.message || 'Error de conexión', 'error');
  }
};

function renderPedidosDesdeCache() {
  const cont = document.getElementById('pedidos');
  if (!cont) return;

  const filtro = document.getElementById('filtroEstadoPedido');
  const estadoFiltro = filtro ? filtro.value : '';
  const pedidosFiltrados = estadoFiltro
    ? pedidosCache.filter(p => String(p.id_estado) === String(estadoFiltro))
    : pedidosCache;

  let html = `
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <h3 class="h5 mb-0">Pedidos (${pedidosFiltrados.length}/${pedidosCache.length})</h3>
      <div class="d-flex gap-2">
        ${puedeCrudPedidos ? `<button class="btn btn-sm btn-success" type="button" onclick="abrirNuevoPedido()">+ Nuevo pedido</button>` : ''}
        <select id="filtroEstadoPedido" class="form-select form-select-sm" style="width:auto;">
          <option value="" ${!estadoFiltro ? 'selected' : ''}>Todos</option>
          <option value="1" ${estadoFiltro === '1' ? 'selected' : ''}>Pendiente</option>
          <option value="2" ${estadoFiltro === '2' ? 'selected' : ''}>Pagado</option>
          <option value="3" ${estadoFiltro === '3' ? 'selected' : ''}>Enviado</option>
          <option value="4" ${estadoFiltro === '4' ? 'selected' : ''}>Entregado</option>
          <option value="5" ${estadoFiltro === '5' ? 'selected' : ''}>Cancelado</option>
        </select>
        <button class="btn btn-sm btn-outline-dark" type="button" onclick="cargarPedidos()">Refrescar</button>
      </div>
    </div>`;

  if (!pedidosFiltrados.length) {
    html += '<div class="alert alert-light border text-center">No hay pedidos para el filtro seleccionado.</div>';
    cont.innerHTML = html;
    const filtroNuevo = document.getElementById('filtroEstadoPedido');
    if (filtroNuevo) filtroNuevo.onchange = renderPedidosDesdeCache;
    return;
  }

  html += `<div class="card"><div class="table-responsive"><table class='table table-hover align-middle mb-0'><thead><tr><th>ID</th><th>Usuario</th><th>Fecha</th><th class="text-end">Total</th><th>Estado actual</th><th>${puedeCrudPedidos ? 'Editar estado' : 'Estado'}</th>${puedeCrudPedidos ? '<th>Acciones</th>' : ''}</tr></thead><tbody>`;
  pedidosFiltrados.forEach(p => {
    const id = p.id_pedido || p.id;
    const fecha = p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleString() : (p.fecha || '');
    const controlEstado = puedeCrudPedidos
      ? `<select class="form-select form-select-sm" style="width:auto;" onchange="cambiarEstadoPedido(${id}, this.value)">
        <option value="1" ${p.id_estado == 1 ? 'selected' : ''}>Pendiente</option>
        <option value="2" ${p.id_estado == 2 ? 'selected' : ''}>Pagado</option>
        <option value="3" ${p.id_estado == 3 ? 'selected' : ''}>Enviado</option>
        <option value="4" ${p.id_estado == 4 ? 'selected' : ''}>Entregado</option>
        <option value="5" ${p.id_estado == 5 ? 'selected' : ''}>Cancelado</option>
      </select>`
      : badgeEstadoPedido(p.id_estado);
    const acciones = puedeCrudPedidos
      ? `<td>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-outline-primary" type="button" onclick="editarPedidoAdmin(${id})">Editar</button>
            <button class="btn btn-sm btn-outline-danger" type="button" onclick="eliminarPedidoAdmin(${id})">Eliminar</button>
          </div>
        </td>`
      : '';
    html += `<tr><td class="text-muted small">${id}</td><td>${escapeHtml(p.usuario || '')}</td><td class="text-muted small">${escapeHtml(fecha)}</td><td class="text-end fw-semibold">$${Number(p.total).toLocaleString()}</td><td>${badgeEstadoPedido(p.id_estado)}</td><td>${controlEstado}</td>${acciones}</tr>`;
  });
  html += '</tbody></table></div></div>';
  cont.innerHTML = html;

  const filtroNuevo = document.getElementById('filtroEstadoPedido');
  if (filtroNuevo) filtroNuevo.onchange = renderPedidosDesdeCache;
}

document.addEventListener('submit', async (e) => {
  if (e.target?.id !== 'formPedidoCrud') return;
  e.preventDefault();
  const msg = document.getElementById('pedidoCrudMsg');
  const btn = document.getElementById('btnGuardarPedidoCrud');
  const id = document.getElementById('pedidoCrudId').value;
  const id_usuario = document.getElementById('pedidoCrudUsuario').value;
  const id_estado = document.getElementById('pedidoCrudEstado').value;
  const total = document.getElementById('pedidoCrudTotal').value;
  const fecha_pedido = document.getElementById('pedidoCrudFecha').value;

  msg.innerHTML = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';

  try {
    const body = { id_usuario, id_estado, total, fecha_pedido: fecha_pedido || null };
    const isEdit = !!id;
    const url = isEdit ? `http://localhost:5000/pedido/${id}` : 'http://localhost:5000/pedido/admin';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetchAuth(url, { method, body: JSON.stringify(body) });
    const data = await safeJson(res);
    if (!res.ok) {
      msg.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml((data && (data.error || data.mensaje)) || 'No se pudo guardar el pedido')}</div>`;
      return;
    }
    msg.innerHTML = '<div class="alert alert-success py-2">Pedido guardado correctamente.</div>';
    showToast('Pedido guardado correctamente', 'success');
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('modalPedidoCrud')).hide();
      cargarPedidos();
      try { cargarDashboard(); } catch { }
    }, 700);
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(err.message || 'Error de conexión')}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
});

function cargarPedidos() {
  const cont = document.getElementById('pedidos');
  if (!cont) return;
  cont.innerHTML = '<div class="text-muted py-3">Cargando pedidos...</div>';
  fetchAuth('http://localhost:5000/pedido')
    .then(async res => {
      if (!res.ok) {
        const body = await safeJson(res);
        renderError('pedidos', 'No se pudieron cargar los pedidos.', body?.error || body?.mensaje || `HTTP ${res.status}`);
        return null;
      }
      return res.json();
    })
    .then(pedidos => {
      if (!pedidos) return;
      pedidosCache = Array.isArray(pedidos) ? pedidos : [];
      renderPedidosDesdeCache();
    })
    .catch(err => {
      console.error('Error cargando pedidos:', err);
      renderError('pedidos', 'Error al cargar pedidos.', err.message);
    });
}

window.cambiarEstadoPedido = async function (id, id_estado) {
  try {
    const res = await fetchAuth(`http://localhost:5000/pedido/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ id_estado })
    });
    const data = await safeJson(res);
    if (res.ok) {
      const pedido = pedidosCache.find(p => String(p.id_pedido || p.id) === String(id));
      if (pedido) pedido.id_estado = Number(id_estado);
      renderPedidosDesdeCache();
      return;
    }
    showToast((data && (data.error || data.mensaje)) || 'Error al cambiar estado', 'error');
    cargarPedidos();
  } catch {
    showToast('Error de conexión', 'error');
    cargarPedidos();
  }
};
