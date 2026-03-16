// Roles + Asignar rol

async function cargarRoles() {
  try {
    const [usuariosRes, rolesRes] = await Promise.all([
      fetchAuth('http://localhost:5000/usuario'),
      fetchAuth('http://localhost:5000/usuario-rol')
    ]);

    if (usuariosRes.ok) {
      const usuarios = await usuariosRes.json();
      const arr = Array.isArray(usuarios) ? usuarios : [];
      let usuariosHtml = '<div class="list-group">';
      arr.forEach(u => {
        const rolesTexto = u.roles_texto || (Array.isArray(u.roles) ? u.roles.map(r => r.nombre || r).join(', ') : '');
        const rolesArr = rolesTexto ? rolesTexto.split(', ').filter(Boolean) : [];
        const badges = rolesArr.length
          ? rolesArr.map(r => {
            const cls = r === 'ADMIN' ? 'bg-danger' : r === 'VENDEDOR' ? 'bg-primary' : r === 'SUPER_ADMIN' ? 'bg-dark' : 'bg-secondary';
            return `<span class="badge ${cls} me-1">${escapeHtml(r)}</span>`;
          }).join('')
          : '<span class="badge bg-secondary">CLIENTE</span>';
        usuariosHtml += `
          <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <strong>${escapeHtml(u.nombre || '')}</strong>
                <div class="text-muted small">${escapeHtml(u.email || '')}</div>
              </div>
              <div>${badges}</div>
            </div>
          </div>`;
      });
      usuariosHtml += '</div>';
      document.getElementById('listaUsuariosRoles').innerHTML = usuariosHtml;
    } else {
      document.getElementById('listaUsuariosRoles').innerHTML = '<div class="alert alert-danger small">Error al cargar usuarios.</div>';
    }

    if (rolesRes.ok) {
      const rolesData = await rolesRes.json();
      const arrR = Array.isArray(rolesData) ? rolesData : [];
      let rolesHtml = '<div class="list-group">';
      arrR.forEach(r => {
        rolesHtml += `
          <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
              <strong>${escapeHtml(r.nombre)}</strong>
              <span class="badge bg-secondary">ID: ${r.id_rol}</span>
            </div>
          </div>`;
      });
      rolesHtml += '</div>';
      document.getElementById('listaRoles').innerHTML = rolesHtml;
    } else {
      document.getElementById('listaRoles').innerHTML = '<div class="alert alert-danger small">Error al cargar roles.</div>';
    }
  } catch (error) {
    console.error('Error cargando roles:', error);
    document.getElementById('listaUsuariosRoles').innerHTML = '<div class="alert alert-danger small">Error de conexión.</div>';
    document.getElementById('listaRoles').innerHTML = '<div class="alert alert-danger small">Error de conexión.</div>';
  }
}

window.mostrarFormAsignarRol = async function () {
  document.getElementById('rolMsg').innerHTML = '';
  try {
    const [usuariosRes, rolesRes] = await Promise.all([
      fetchAuth('http://localhost:5000/usuario'),
      fetchAuth('http://localhost:5000/usuario-rol')
    ]);

    const usuarios = await usuariosRes.json();
    const rolesData = await rolesRes.json();

    const usuarioSelect = document.getElementById('rolUsuario');
    usuarioSelect.innerHTML = '<option value="">Seleccionar usuario...</option>';
    (Array.isArray(usuarios) ? usuarios : []).forEach(u => {
      usuarioSelect.innerHTML += `<option value="${u.id_usuario || u.id}">${u.nombre} - ${u.email}</option>`;
    });

    const rolSelect = document.getElementById('rolRol');
    rolSelect.innerHTML = '<option value="">Seleccionar rol...</option>';
    (Array.isArray(rolesData) ? rolesData : [])
      .filter(r => ['ADMIN', 'VENDEDOR'].includes(r.nombre))
      .forEach(r => {
        rolSelect.innerHTML += `<option value="${r.id_rol}">${r.nombre}</option>`;
      });

  } catch (error) {
    console.error('Error cargando datos para asignar rol:', error);
  }

  new bootstrap.Modal(document.getElementById('modalAsignarRol')).show();
};

const _formAsignarRol = document.getElementById('formAsignarRol');
if (_formAsignarRol) _formAsignarRol.onsubmit = async function (e) {
  e.preventDefault();
  const id_usuario = document.getElementById('rolUsuario').value;
  const id_rol = document.getElementById('rolRol').value;
  const msg = document.getElementById('rolMsg');

  if (!id_usuario || !id_rol) {
    msg.innerHTML = '<div class="alert alert-danger">Selecciona usuario y rol</div>';
    return;
  }

  try {
    const res = await fetchAuth('http://localhost:5000/usuario-rol/asignar', {
      method: 'POST',
      body: JSON.stringify({ id_usuario, id_rol })
    });
    const data = await res.json();
    if (res.ok) {
      msg.innerHTML = '<div class="alert alert-success">Rol asignado correctamente.</div>';
      setTimeout(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalAsignarRol')).hide();
        cargarRoles();
        cargarUsuarios();
      }, 1000);
    } else {
      msg.innerHTML = '<div class="alert alert-danger">' + (data.error || 'Error al asignar rol') + '</div>';
    }
  } catch {
    msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
  }
};
