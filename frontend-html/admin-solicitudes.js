// Solicitudes para ser vendedor

async function cargarSolicitudesVendedor() {
  const cont = document.getElementById('solicitudesVendedorList');
  if (!cont) return;

  const filtro = document.getElementById('filtroSolicitudEstado');
  const estado = filtro ? filtro.value : 'PENDIENTE';
  const qs = estado ? `?estado=${encodeURIComponent(estado)}` : '';

  cont.innerHTML = '<div class="text-muted">Cargando solicitudes...</div>';
  try {
    const res = await fetchAuth(`${API_BASE}/vendedor-solicitud${qs}`);
    const data = await safeJson(res);
    if (!res.ok) {
      renderError('solicitudesVendedorList', 'No se pudieron cargar las solicitudes.', data?.error || data?.mensaje || `HTTP ${res.status}`);
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      cont.innerHTML = '<div class="alert alert-light border">No hay solicitudes para mostrar con el filtro actual.</div>';
      return;
    }

    const table = `
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Tienda</th>
              <th>NIT/RUT</th>
              <th>Ciudad</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const estadoBadge = r.estado === 'PENDIENTE'
                ? '<span class="badge bg-warning text-dark">PENDIENTE</span>'
                : (r.estado === 'APROBADA'
                  ? '<span class="badge bg-success">APROBADA</span>'
                  : '<span class="badge bg-danger">RECHAZADA</span>');
              const fecha = r.fecha_creacion ? new Date(r.fecha_creacion).toLocaleString() : '';
              const usuario = `${escapeHtml(r.usuario_nombre || '')}<div class="small text-muted">${escapeHtml(r.usuario_email || '')}</div>`;
              const acciones = r.estado === 'PENDIENTE'
                ? `
                  <div class="d-flex gap-2 justify-content-end">
                    <button class="btn btn-sm btn-success" type="button" onclick="abrirResolverSolicitud(${r.id_solicitud}, 'aprobar')">Aprobar</button>
                    <button class="btn btn-sm btn-outline-danger" type="button" onclick="abrirResolverSolicitud(${r.id_solicitud}, 'rechazar')">Rechazar</button>
                  </div>
                `
                : '<span class="text-muted small">—</span>';

              return `
                <tr>
                  <td>${r.id_solicitud}</td>
                  <td>${usuario}</td>
                  <td>${escapeHtml(r.nombre_tienda || '')}</td>
                  <td>${escapeHtml(r.nit_rut || '')}</td>
                  <td>${escapeHtml(r.ciudad || '')}</td>
                  <td>${estadoBadge}</td>
                  <td class="small text-muted">${escapeHtml(fecha)}</td>
                  <td class="text-end">${acciones}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    cont.innerHTML = table;
  } catch (err) {
    renderError('solicitudesVendedorList', 'No se pudieron cargar las solicitudes.', err?.message || 'Error de conexión');
  }
}

window.abrirResolverSolicitud = function (idSolicitud, accion) {
  const modalEl = document.getElementById('modalResolverSolicitud');
  if (!modalEl) return;
  const title = document.getElementById('resolverSolicitudTitle');
  const hiddenId = document.getElementById('resolverSolicitudId');
  const hiddenAccion = document.getElementById('resolverSolicitudAccion');
  const comentario = document.getElementById('resolverSolicitudComentario');
  const msg = document.getElementById('resolverSolicitudMsg');
  const btn = document.getElementById('resolverSolicitudSubmit');

  if (title) title.textContent = accion === 'aprobar' ? 'Aprobar solicitud' : 'Rechazar solicitud';
  if (btn) {
    btn.textContent = accion === 'aprobar' ? 'Aprobar' : 'Rechazar';
    btn.className = 'btn ' + (accion === 'aprobar' ? 'btn-success' : 'btn-danger');
  }
  if (hiddenId) hiddenId.value = String(idSolicitud);
  if (hiddenAccion) hiddenAccion.value = accion;
  if (comentario) comentario.value = '';
  if (msg) msg.innerHTML = '';

  new bootstrap.Modal(modalEl).show();
};

const formResolver = document.getElementById('formResolverSolicitud');
if (formResolver) {
  formResolver.onsubmit = async function (e) {
    e.preventDefault();
    const idSolicitud = document.getElementById('resolverSolicitudId').value;
    const accion = document.getElementById('resolverSolicitudAccion').value;
    const comentario_admin = document.getElementById('resolverSolicitudComentario').value;
    const msg = document.getElementById('resolverSolicitudMsg');
    if (msg) msg.innerHTML = '';

    try {
      const endpoint = accion === 'aprobar'
        ? `${API_BASE}/vendedor-solicitud/${idSolicitud}/aprobar`
        : `${API_BASE}/vendedor-solicitud/${idSolicitud}/rechazar`;
      const res = await fetchAuth(endpoint, {
        method: 'POST',
        body: JSON.stringify({ comentario_admin })
      });
      const data = await safeJson(res);
      if (res.ok) {
        if (msg) msg.innerHTML = '<div class="alert alert-success">Acción realizada correctamente.</div>';
        setTimeout(() => {
          bootstrap.Modal.getInstance(document.getElementById('modalResolverSolicitud')).hide();
          cargarSolicitudesVendedor();
        }, 650);
      } else {
        if (msg) msg.innerHTML = '<div class="alert alert-danger">' + ((data && (data.error || data.mensaje)) || `HTTP ${res.status}`) + '</div>';
      }
    } catch {
      if (msg) msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
    }
  };
}

const btnRefrescarSolicitudes = document.getElementById('btnRefrescarSolicitudes');
if (btnRefrescarSolicitudes) {
  btnRefrescarSolicitudes.onclick = cargarSolicitudesVendedor;
}

const filtroSolicitudEstado = document.getElementById('filtroSolicitudEstado');
if (filtroSolicitudEstado) {
  filtroSolicitudEstado.onchange = cargarSolicitudesVendedor;
}

// ── Solicitudes Repartidor ────────────────────────────────────────────────────
async function cargarSolicitudesRepartidor() {
  const cont = document.getElementById('solicitudesRepartidorList');
  if (!cont) return;

  const filtro = document.getElementById('filtroRepartidorSolicitudEstado');
  const estado = filtro ? filtro.value : 'PENDIENTE';
  const qs = estado ? `?estado=${encodeURIComponent(estado)}` : '';

  cont.innerHTML = '<div class="text-muted">Cargando solicitudes...</div>';
  try {
    const res = await fetchAuth(`${API_BASE}/repartidor-solicitud${qs}`);
    const data = await safeJson(res);
    if (!res.ok) {
      renderError('solicitudesRepartidorList', 'No se pudieron cargar las solicitudes.', data?.error || `HTTP ${res.status}`);
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      cont.innerHTML = '<div class="alert alert-light border">No hay solicitudes para mostrar con el filtro actual.</div>';
      return;
    }

    cont.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Teléfono</th>
              <th>Ciudad</th>
              <th>Vehículo</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => {
              const estadoBadge = r.estado === 'PENDIENTE'
                ? '<span class="badge bg-warning text-dark">PENDIENTE</span>'
                : r.estado === 'APROBADA'
                  ? '<span class="badge bg-success">APROBADA</span>'
                  : '<span class="badge bg-danger">RECHAZADA</span>';
              const fecha   = r.fecha_creacion ? new Date(r.fecha_creacion).toLocaleString() : '';
              const usuario = `${escapeHtml(r.usuario_nombre || '')}<div class="small text-muted">${escapeHtml(r.usuario_email || '')}</div>`;
              const acciones = r.estado === 'PENDIENTE'
                ? `<div class="d-flex gap-2 justify-content-end">
                     <button class="btn btn-sm btn-success" type="button" onclick="abrirResolverRepartidor(${r.id_solicitud}, 'aprobar')">Aprobar</button>
                     <button class="btn btn-sm btn-outline-danger" type="button" onclick="abrirResolverRepartidor(${r.id_solicitud}, 'rechazar')">Rechazar</button>
                   </div>`
                : '<span class="text-muted small">—</span>';

              return `<tr>
                <td>${r.id_solicitud}</td>
                <td>${usuario}</td>
                <td>${escapeHtml(r.telefono || '')}</td>
                <td>${escapeHtml(r.ciudad || '')}</td>
                <td>${escapeHtml(r.vehiculo || '')}</td>
                <td>${estadoBadge}</td>
                <td class="small text-muted">${escapeHtml(fecha)}</td>
                <td class="text-end">${acciones}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    renderError('solicitudesRepartidorList', 'Error al cargar solicitudes.', err?.message || 'Error de conexión');
  }
}

window.abrirResolverRepartidor = function (idSolicitud, accion) {
  const modalEl    = document.getElementById('modalResolverRepartidor');
  if (!modalEl) return;
  document.getElementById('resolverRepartidorId').value     = String(idSolicitud);
  document.getElementById('resolverRepartidorAccion').value = accion;
  document.getElementById('resolverRepartidorComentario').value = '';
  document.getElementById('resolverRepartidorMsg').innerHTML = '';
  const title = document.getElementById('resolverRepartidorTitle');
  const btn   = document.getElementById('resolverRepartidorSubmit');
  if (title) title.textContent = accion === 'aprobar' ? 'Aprobar solicitud de repartidor' : 'Rechazar solicitud de repartidor';
  if (btn) { btn.textContent = accion === 'aprobar' ? 'Aprobar' : 'Rechazar'; btn.className = 'btn ' + (accion === 'aprobar' ? 'btn-success' : 'btn-danger'); }
  new bootstrap.Modal(modalEl).show();
};

const formResolverRepartidor = document.getElementById('formResolverRepartidor');
if (formResolverRepartidor) {
  formResolverRepartidor.onsubmit = async function (e) {
    e.preventDefault();
    const idSolicitud     = document.getElementById('resolverRepartidorId').value;
    const accion          = document.getElementById('resolverRepartidorAccion').value;
    const comentario_admin = document.getElementById('resolverRepartidorComentario').value;
    const msg             = document.getElementById('resolverRepartidorMsg');
    if (msg) msg.innerHTML = '';

    try {
      const endpoint = accion === 'aprobar'
        ? `${API_BASE}/repartidor-solicitud/${idSolicitud}/aprobar`
        : `${API_BASE}/repartidor-solicitud/${idSolicitud}/rechazar`;
      const res = await fetchAuth(endpoint, { method: 'POST', body: JSON.stringify({ comentario_admin }) });
      const data = await safeJson(res);
      if (res.ok) {
        if (msg) msg.innerHTML = '<div class="alert alert-success">Acción realizada correctamente.</div>';
        setTimeout(() => {
          bootstrap.Modal.getInstance(document.getElementById('modalResolverRepartidor')).hide();
          cargarSolicitudesRepartidor();
        }, 650);
      } else {
        if (msg) msg.innerHTML = '<div class="alert alert-danger">' + ((data && (data.error || data.mensaje)) || `HTTP ${res.status}`) + '</div>';
      }
    } catch {
      if (msg) msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
    }
  };
}

const btnRefrescarRepartidor = document.getElementById('btnRefrescarSolicitudesRepartidor');
if (btnRefrescarRepartidor) btnRefrescarRepartidor.onclick = cargarSolicitudesRepartidor;

const filtroRepartidor = document.getElementById('filtroRepartidorSolicitudEstado');
if (filtroRepartidor) filtroRepartidor.onchange = cargarSolicitudesRepartidor;
