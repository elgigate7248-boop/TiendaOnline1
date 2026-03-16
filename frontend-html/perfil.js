function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function getToken() {
  return localStorage.getItem('token') || '';
}

async function cargarCategorias() {
  try {
    const res = await fetch(`${API_BASE}/categoria`);
    return await res.json();
  } catch {
    return [];
  }
}

async function cargarMasVendidosPorCategoria(idCategoria, limit = 4) {
  try {
    const res = await fetch(`${API_BASE}/producto/mas-vendidos/${idCategoria}?limit=${limit}`);
    return await res.json();
  } catch {
    return [];
  }
}

function renderCheckboxes(categorias, seleccionadas) {
  const cont = document.getElementById('categoriasIntereses');
  if (!cont) return;
  cont.innerHTML = '';
  categorias.forEach(cat => {
    const checked = seleccionadas.includes(String(cat.id_categoria));
    const div = document.createElement('div');
    div.className = 'col-auto';
    div.innerHTML = `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="${cat.id_categoria}" id="cat${cat.id_categoria}" ${checked ? 'checked' : ''}>
        <label class="form-check-label" for="cat${cat.id_categoria}">${cat.nombre}</label>
      </div>
    `;
    cont.appendChild(div);
  });
}

async function renderRecomendados(seleccionadas) {
  const cont = document.getElementById('recomendados');
  if (!cont) return;
  cont.innerHTML = '';
  if (!Array.isArray(seleccionadas) || !seleccionadas.length) {
    cont.innerHTML = '<div class="text-muted">Selecciona al menos una categoría para ver recomendaciones.</div>';
    return;
  }
  const limit = Math.floor(12 / seleccionadas.length);
  for (const idCat of seleccionadas) {
    const productos = await cargarMasVendidosPorCategoria(idCat, limit);
    productos.forEach(p => {
      const col = document.createElement('div');
      col.className = 'col-6 col-md-4 col-lg-3 mb-3';
      col.innerHTML = `
        <a href="detalle-producto.html?id=${p.id_producto}" class="text-decoration-none text-dark">
          <div class="card h-100 shadow-sm">
            <img src="${p.imagen || 'https://via.placeholder.com/300x200'}" class="card-img-top top-vendidos-img" alt="${p.nombre}">
            <div class="card-body">
              <div class="small text-muted">Nuevo</div>
              <div class="fw-semibold">${p.nombre}</div>
              <div class="text-muted">$${p.precio}</div>
            </div>
          </div>
        </a>
      `;
      cont.appendChild(col);
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = getUser();
  const token = getToken();
  if (!token || !user.id_usuario) {
    window.location.href = 'login.html';
    return;
  }

  // Mostrar avatar inicial
  const avatar = document.getElementById('avatarInicial');
  if (avatar && user.nombre) {
    avatar.textContent = user.nombre.charAt(0).toUpperCase();
  }

  // Mostrar datos del usuario
  const datosCont = document.getElementById('datosUsuario');
  if (datosCont) {
    const rolesArr = Array.isArray(user.roles)
      ? user.roles.map(r => (r && typeof r === 'object') ? r.nombre : r).filter(Boolean)
      : [];
    const rolesBadges = rolesArr.map(r => {
      const cls = r === 'ADMIN' ? 'bg-danger' : r === 'VENDEDOR' ? 'bg-primary' : 'bg-secondary';
      return `<span class="badge ${cls} me-1">${r}</span>`;
    }).join('');

    datosCont.innerHTML = `
      <h5 class="fw-bold mb-1">${user.nombre || 'Usuario'}</h5>
      <div class="text-muted small mb-2">${user.email || ''}</div>
      <div>${rolesBadges || '<span class="badge bg-secondary">CLIENTE</span>'}</div>
    `;
  }

  // Solicitud vendedor
  const estadoCont = document.getElementById('vendedorSolicitudEstado');
  const btnAbrir = document.getElementById('btnAbrirSolicitudVendedor');
  const modalEl = document.getElementById('modalSolicitudVendedor');
  const form = document.getElementById('formSolicitudVendedor');
  const vsMsg = document.getElementById('vsMsg');

  const fetchAuth = (url, opts = {}) => {
    return fetch(url, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
  };

  async function cargarSolicitudVendedor() {
    if (!estadoCont) return;
    estadoCont.innerHTML = '<div class="text-muted">Cargando estado...</div>';
    try {
      const res = await fetchAuth(`${API_BASE}/vendedor-solicitud/mia`);
      const data = await res.json();

      if (!res.ok) {
        estadoCont.innerHTML = '<div class="text-muted">No se pudo consultar el estado.</div>';
        return;
      }

      if (!data) {
        estadoCont.innerHTML = '<div class="alert alert-light border">No tienes solicitudes. Puedes enviar una para convertirte en vendedor.</div>';
        if (btnAbrir) btnAbrir.disabled = false;
        return;
      }

      if (data.estado === 'PENDIENTE') {
        estadoCont.innerHTML = '<div class="alert alert-warning">Solicitud <b>pendiente</b>. Un administrador la revisará.</div>';
        if (btnAbrir) btnAbrir.disabled = true;
      } else if (data.estado === 'APROBADA') {
        estadoCont.innerHTML = '<div class="alert alert-success">Solicitud <b>aprobada</b>. Ya puedes operar como vendedor. Cierra sesión e inicia de nuevo para refrescar permisos.</div>';
        if (btnAbrir) btnAbrir.disabled = true;
      } else if (data.estado === 'RECHAZADA') {
        estadoCont.innerHTML = `<div class="alert alert-danger">Solicitud <b>rechazada</b>. ${data.comentario_admin ? ('<div class="small mt-1">' + data.comentario_admin + '</div>') : ''}</div>`;
        if (btnAbrir) btnAbrir.disabled = false;
      } else {
        estadoCont.innerHTML = '<div class="text-muted">Estado desconocido.</div>';
        if (btnAbrir) btnAbrir.disabled = false;
      }
    } catch {
      estadoCont.innerHTML = '<div class="text-muted">No se pudo consultar el estado.</div>';
      if (btnAbrir) btnAbrir.disabled = false;
    }
  }

  if (btnAbrir && modalEl) {
    btnAbrir.onclick = async () => {
      if (vsMsg) vsMsg.innerHTML = '';
      new bootstrap.Modal(modalEl).show();
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (vsMsg) vsMsg.innerHTML = '';

      const payload = {
        nombre_tienda: document.getElementById('vsNombreTienda').value,
        telefono: document.getElementById('vsTelefono').value,
        ciudad: document.getElementById('vsCiudad').value,
        nit_rut: document.getElementById('vsNitRut').value,
        direccion_fiscal: document.getElementById('vsDireccionFiscal').value,
        nombre_legal: document.getElementById('vsNombreLegal').value,
        doc_representante: document.getElementById('vsDocRepresentante').value,
        descripcion: document.getElementById('vsDescripcion').value
      };

      try {
        const res = await fetchAuth(`${API_BASE}/vendedor-solicitud`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          if (vsMsg) vsMsg.innerHTML = '<div class="alert alert-success">Solicitud enviada.</div>';
          setTimeout(() => {
            bootstrap.Modal.getInstance(modalEl).hide();
            cargarSolicitudVendedor();
          }, 700);
        } else {
          if (vsMsg) vsMsg.innerHTML = '<div class="alert alert-danger">' + (data.error || 'Error al enviar') + '</div>';
        }
      } catch {
        if (vsMsg) vsMsg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
      }
    };
  }

  await cargarSolicitudVendedor();

  // ── Solicitud Repartidor ─────────────────────────────────────────────────
  const rsrEstadoCont = document.getElementById('repartidorSolicitudEstado');
  const rsrBtnAbrir   = document.getElementById('btnAbrirSolicitudRepartidor');
  const rsrModalEl    = document.getElementById('modalSolicitudRepartidor');
  const rsrForm       = document.getElementById('formSolicitudRepartidor');
  const rsrMsg        = document.getElementById('rsrMsg');

  async function cargarSolicitudRepartidor() {
    if (!rsrEstadoCont) return;
    rsrEstadoCont.innerHTML = '<div class="text-muted small">Cargando estado...</div>';
    try {
      const res = await fetchAuth(`${API_BASE}/repartidor-solicitud/mia`);
      const data = await res.json();

      if (!res.ok) {
        rsrEstadoCont.innerHTML = '';
        if (rsrBtnAbrir) rsrBtnAbrir.disabled = false;
        return;
      }

      if (!data) {
        rsrEstadoCont.innerHTML = '<div class="alert alert-light border small">Aún no has enviado solicitud. Puedes aplicar para convertirte en repartidor.</div>';
        if (rsrBtnAbrir) rsrBtnAbrir.disabled = false;
        return;
      }

      if (data.estado === 'PENDIENTE') {
        rsrEstadoCont.innerHTML = '<div class="alert alert-warning small">Solicitud <b>pendiente</b>. Un administrador la revisará pronto.</div>';
        if (rsrBtnAbrir) rsrBtnAbrir.disabled = true;
      } else if (data.estado === 'APROBADA') {
        rsrEstadoCont.innerHTML = '<div class="alert alert-success small">🎉 Solicitud <b>aprobada</b>. Ya tienes el rol de repartidor. Cierra sesión e inicia nuevamente para activar tu acceso.</div>';
        if (rsrBtnAbrir) rsrBtnAbrir.disabled = true;
      } else if (data.estado === 'RECHAZADA') {
        rsrEstadoCont.innerHTML = `<div class="alert alert-danger small">Solicitud <b>rechazada</b>.${data.comentario_admin ? ' <div class="mt-1">' + data.comentario_admin + '</div>' : ''}</div>`;
        if (rsrBtnAbrir) rsrBtnAbrir.disabled = false;
      }
    } catch {
      rsrEstadoCont.innerHTML = '';
      if (rsrBtnAbrir) rsrBtnAbrir.disabled = false;
    }
  }

  if (rsrBtnAbrir && rsrModalEl) {
    rsrBtnAbrir.onclick = () => {
      if (rsrMsg) rsrMsg.innerHTML = '';
      new bootstrap.Modal(rsrModalEl).show();
    };
  }

  if (rsrForm) {
    rsrForm.onsubmit = async (e) => {
      e.preventDefault();
      if (rsrMsg) rsrMsg.innerHTML = '';

      const payload = {
        telefono:    document.getElementById('rsrTelefono').value.trim(),
        ciudad:      document.getElementById('rsrCiudad').value.trim(),
        vehiculo:    document.getElementById('rsrVehiculo').value,
        descripcion: document.getElementById('rsrDescripcion').value.trim()
      };

      try {
        const res = await fetchAuth(`${API_BASE}/repartidor-solicitud`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          if (rsrMsg) rsrMsg.innerHTML = '<div class="alert alert-success">✅ Solicitud enviada correctamente.</div>';
          setTimeout(() => {
            bootstrap.Modal.getInstance(rsrModalEl).hide();
            cargarSolicitudRepartidor();
          }, 800);
        } else {
          if (rsrMsg) rsrMsg.innerHTML = '<div class="alert alert-danger">' + (data.error || 'Error al enviar la solicitud') + '</div>';
        }
      } catch {
        if (rsrMsg) rsrMsg.innerHTML = '<div class="alert alert-danger">Error de conexión. Intenta de nuevo.</div>';
      }
    };
  }

  await cargarSolicitudRepartidor();

  // Cargar categorías y preferencias guardadas
  const categorias = await cargarCategorias();
  const preferidas = JSON.parse(localStorage.getItem('preferenciasCategorias') || '[]');
  renderCheckboxes(categorias, preferidas);
  await renderRecomendados(preferidas);

  // Guardar preferencias
  const btnGuardar = document.getElementById('btnGuardarIntereses');
  const msg = document.getElementById('msgIntereses');
  if (btnGuardar) {
    btnGuardar.onclick = () => {
      const checks = document.querySelectorAll('#categoriasIntereses input[type="checkbox"]:checked');
      const ids = Array.from(checks).map(cb => cb.value);
      localStorage.setItem('preferenciasCategorias', JSON.stringify(ids));
      if (msg) {
        msg.innerHTML = '<div class="alert alert-success">Preferencias guardadas.</div>';
        setTimeout(() => msg.innerHTML = '', 3000);
      }
      renderRecomendados(ids);
    };
  }
});
