// Usuarios

function ensureUsuarioModal() {
  if (document.getElementById('modalUsuarioCrud')) return;
  const html = `
    <div class="modal fade" id="modalUsuarioCrud" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="formUsuarioCrud">
            <div class="modal-header">
              <h5 class="modal-title" id="modalUsuarioCrudLabel">Nuevo usuario</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="usuarioCrudId">
              <div class="mb-3">
                <label class="form-label fw-semibold">Nombre</label>
                <input type="text" class="form-control" id="usuarioCrudNombre" required>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Email</label>
                <input type="email" class="form-control" id="usuarioCrudEmail" required>
              </div>
              <div class="mb-3">
                <label class="form-label fw-semibold">Teléfono</label>
                <input type="text" class="form-control" id="usuarioCrudTelefono" placeholder="Opcional">
              </div>
              <div class="mb-1" id="usuarioCrudPasswordWrap">
                <label class="form-label fw-semibold">Contraseña</label>
                <input type="password" class="form-control" id="usuarioCrudPassword" minlength="6" placeholder="Mínimo 6 caracteres">
                <div class="form-text">Solo requerida al crear usuario.</div>
              </div>
              <div id="usuarioCrudMsg" class="mt-3"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="btnGuardarUsuarioCrud">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

window.abrirNuevoUsuarioAdmin = function () {
  if (!puedeCrudUsuarios) {
    showToast('Solo ADMIN puede crear usuarios.', 'warning');
    return;
  }
  ensureUsuarioModal();
  document.getElementById('modalUsuarioCrudLabel').textContent = 'Nuevo usuario';
  document.getElementById('usuarioCrudId').value = '';
  document.getElementById('usuarioCrudNombre').value = '';
  document.getElementById('usuarioCrudEmail').value = '';
  document.getElementById('usuarioCrudTelefono').value = '';
  document.getElementById('usuarioCrudPassword').value = '';
  document.getElementById('usuarioCrudPasswordWrap').style.display = '';
  document.getElementById('usuarioCrudPassword').required = true;
  document.getElementById('usuarioCrudMsg').innerHTML = '';
  new bootstrap.Modal(document.getElementById('modalUsuarioCrud')).show();
};

window.editarUsuarioAdmin = async function (id) {
  if (!puedeCrudUsuarios) {
    showToast('Solo ADMIN puede editar usuarios.', 'warning');
    return;
  }
  ensureUsuarioModal();
  try {
    const res = await fetchAuth(`http://localhost:5000/usuario/${id}`);
    const data = await safeJson(res);
    if (!res.ok || !data) {
      showToast((data && (data.error || data.mensaje)) || 'No se pudo cargar el usuario', 'error');
      return;
    }
    document.getElementById('modalUsuarioCrudLabel').textContent = `Editar usuario #${id}`;
    document.getElementById('usuarioCrudId').value = String(id);
    document.getElementById('usuarioCrudNombre').value = data.nombre || '';
    document.getElementById('usuarioCrudEmail').value = data.email || '';
    document.getElementById('usuarioCrudTelefono').value = data.telefono || '';
    document.getElementById('usuarioCrudPassword').value = '';
    document.getElementById('usuarioCrudPasswordWrap').style.display = 'none';
    document.getElementById('usuarioCrudPassword').required = false;
    document.getElementById('usuarioCrudMsg').innerHTML = '';
    new bootstrap.Modal(document.getElementById('modalUsuarioCrud')).show();
  } catch (err) {
    showToast(err.message || 'Error al cargar usuario', 'error');
  }
};

window.eliminarUsuarioAdmin = async function (id) {
  if (!puedeCrudUsuarios) {
    showToast('Solo ADMIN puede eliminar usuarios.', 'warning');
    return;
  }
  if (!confirm(`¿Eliminar el usuario #${id}?`)) return;
  try {
    const res = await fetchAuth(`http://localhost:5000/usuario/${id}`, { method: 'DELETE' });
    const data = await safeJson(res);
    if (!res.ok) {
      showToast((data && (data.error || data.mensaje)) || 'No se pudo eliminar el usuario', 'error');
      return;
    }
    showToast('Usuario eliminado correctamente', 'success');
    cargarUsuarios();
  } catch (err) {
    showToast(err.message || 'Error de conexión', 'error');
  }
};

document.addEventListener('submit', async (e) => {
  if (e.target?.id !== 'formUsuarioCrud') return;
  e.preventDefault();

  const id = document.getElementById('usuarioCrudId').value;
  const nombre = document.getElementById('usuarioCrudNombre').value.trim();
  const email = document.getElementById('usuarioCrudEmail').value.trim();
  const telefono = document.getElementById('usuarioCrudTelefono').value.trim();
  const password = document.getElementById('usuarioCrudPassword').value;
  const msg = document.getElementById('usuarioCrudMsg');
  const btn = document.getElementById('btnGuardarUsuarioCrud');

  msg.innerHTML = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';

  try {
    const isEdit = !!id;
    const body = isEdit
      ? { nombre, email, telefono: telefono || null }
      : { nombre, email, telefono: telefono || null, password };
    const res = await fetchAuth(isEdit ? `http://localhost:5000/usuario/${id}` : 'http://localhost:5000/usuario', {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    });
    const data = await safeJson(res);
    if (!res.ok) {
      msg.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml((data && (data.error || data.mensaje)) || 'No se pudo guardar el usuario')}</div>`;
      return;
    }
    msg.innerHTML = '<div class="alert alert-success py-2">Usuario guardado correctamente.</div>';
    showToast('Usuario guardado correctamente', 'success');
    setTimeout(() => {
      bootstrap.Modal.getInstance(document.getElementById('modalUsuarioCrud')).hide();
      cargarUsuarios();
      try { cargarDashboard(); } catch { }
    }, 700);
  } catch (err) {
    msg.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(err.message || 'Error de conexión')}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
});

async function cargarUsuarios() {
  const cont = document.getElementById('usuarios');
  if (!cont) return;
  cont.innerHTML = '<div class="text-muted py-3">Cargando usuarios...</div>';
  try {
    const [usuariosRes, vendedorRatingsRes] = await Promise.all([
      fetchAuth('http://localhost:5000/usuario'),
      fetch('http://localhost:5000/resena/vendedores/ratings')
    ]);
    if (!usuariosRes.ok) {
      const body = await safeJson(usuariosRes);
      renderError('usuarios', 'No se pudieron cargar los usuarios.', body?.error || body?.mensaje || `HTTP ${usuariosRes.status}`);
      return;
    }
    const usuarios = await usuariosRes.json();
    let vendedorRatings = [];
    try { vendedorRatings = await vendedorRatingsRes.json(); } catch { }
    const ratingsMap = {};
    (Array.isArray(vendedorRatings) ? vendedorRatings : []).forEach(vr => {
      ratingsMap[vr.id_vendedor] = vr;
    });

    const arr = Array.isArray(usuarios) ? usuarios : [];
    let html = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 class="h5 mb-1">Usuarios (${arr.length})</h3>
          <div class="small text-muted">Usuarios registrados con sus roles y calificación de vendedor</div>
        </div>
        ${puedeCrudUsuarios ? `<button class="btn btn-sm btn-success" type="button" onclick="abrirNuevoUsuarioAdmin()">+ Nuevo usuario</button>` : ''}
      </div>`;
    if (!arr.length) {
      html += '<div class="alert alert-light border text-center">No hay usuarios registrados.</div>';
    } else {
      html += `<div class="card"><div class="table-responsive"><table class='table table-hover align-middle mb-0'>
        <thead><tr><th>ID</th><th>Usuario</th><th>Roles</th><th>Calificación Vendedor</th><th>Confiable</th><th>Registro</th>${puedeCrudUsuarios ? '<th>Acciones</th>' : ''}</tr></thead><tbody>`;
      arr.forEach(u => {
        const id = u.id_usuario || u.id;
        const rolesTexto = u.roles_texto || (Array.isArray(u.roles) ? u.roles.map(r => r.nombre || r).join(', ') : (u.rol || ''));
        const rolesArr = rolesTexto ? rolesTexto.split(', ').filter(Boolean) : [];
        const rolesBadges = rolesArr.map(r => {
          const cls = r === 'ADMIN' ? 'bg-danger' : r === 'VENDEDOR' ? 'bg-primary' : r === 'SUPER_ADMIN' ? 'bg-dark' : 'bg-secondary';
          return `<span class="badge ${cls} me-1">${escapeHtml(r)}</span>`;
        }).join('') || '<span class="badge bg-secondary">CLIENTE</span>';

        const esVendedor = rolesArr.includes('VENDEDOR');
        let ratingHtml = '<span class="text-muted">—</span>';
        let confiableHtml = '<span class="text-muted">—</span>';
        if (esVendedor && ratingsMap[id]) {
          const vr = ratingsMap[id];
          const rating = Number(vr.rating_promedio) || 0;
          const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
          ratingHtml = `<span class="text-warning">${stars}</span> <span class="fw-semibold">${rating}</span> <span class="text-muted small">(${vr.total_resenas} reseñas, ${vr.total_productos} prod.)</span>`;
          if (rating >= 4) {
            confiableHtml = '<span class="badge bg-success">Confiable</span>';
          } else if (rating >= 2.5) {
            confiableHtml = '<span class="badge bg-warning text-dark">Regular</span>';
          } else if (vr.total_resenas > 0) {
            confiableHtml = '<span class="badge bg-danger">No confiable</span>';
          } else {
            confiableHtml = '<span class="badge bg-light text-dark">Sin reseñas</span>';
          }
        } else if (esVendedor) {
          ratingHtml = '<span class="text-muted small">Sin reseñas aún</span>';
          confiableHtml = '<span class="badge bg-light text-dark">Nuevo</span>';
        }

        const fecha = u.fecha_registro ? new Date(u.fecha_registro).toLocaleDateString() : '';
        const acciones = puedeCrudUsuarios
          ? `<td>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-primary" type="button" onclick="editarUsuarioAdmin(${id})">Editar</button>
                <button class="btn btn-sm btn-outline-danger" type="button" onclick="eliminarUsuarioAdmin(${id})">Eliminar</button>
              </div>
            </td>`
          : '';

        html += `<tr>
          <td class="text-muted small">${id}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(u.nombre || '')}</div>
            <div class="small text-muted">${escapeHtml(u.email || '')}</div>
          </td>
          <td>${rolesBadges}</td>
          <td>${ratingHtml}</td>
          <td>${confiableHtml}</td>
          <td class="text-muted small">${fecha}</td>
          ${acciones}
        </tr>`;
      });
      html += '</tbody></table></div></div>';
    }
    cont.innerHTML = html;
  } catch (err) {
    console.error('Error cargando usuarios:', err);
    renderError('usuarios', 'Error al cargar usuarios.', err.message);
  }
}
