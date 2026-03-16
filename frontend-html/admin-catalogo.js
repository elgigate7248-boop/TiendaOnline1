// Productos + Categorías + Atributos

const MAX_IMAGE_FILE_SIZE = 2 * 1024 * 1024; // 2MB

function inicializarUploaderImagenAdmin() {
  if (!(window.UIKit && typeof window.UIKit.bindImageUploader === 'function')) return;
  window.UIKit.bindImageUploader({
    inputUrlId: 'prodImagen',
    inputFileId: 'prodImagenArchivo',
    dropZoneId: 'prodDropZoneAdmin',
    maxSizeBytes: MAX_IMAGE_FILE_SIZE,
    onLoaded: (url) => actualizarPreviewImagenProducto(url),
    onInvalidType: () => showToast('El archivo seleccionado no es una imagen válida.', 'warning'),
    onTooLarge: () => showToast('La imagen supera 2 MB. Elige un archivo más liviano.', 'warning'),
    onError: () => showToast('No se pudo leer la imagen seleccionada.', 'error')
  });
}

async function cargarDepartamentosProducto() {
  const deptoEl = document.getElementById('prodDeptoOrigen');
  const ciudadEl = document.getElementById('prodCiudadOrigen');
  if (!deptoEl) return;
  if (ciudadEl) {
    ciudadEl.innerHTML = '<option value="">Seleccionar...</option>';
    ciudadEl.disabled = true;
  }
  deptoEl.disabled = true;
  try {
    const res = await fetch('http://localhost:5000/ubicacion/departamentos');
    const data = await safeJson(res);
    if (!res.ok) {
      deptoEl.innerHTML = '<option value="">No disponible</option>';
      return;
    }
    deptoEl.innerHTML = '<option value="">Seleccionar...</option>' +
      (Array.isArray(data) ? data : []).map(d => `<option value="${d.codigo_dane}">${escapeHtml(d.nombre)}</option>`).join('');
  } catch {
    deptoEl.innerHTML = '<option value="">No disponible</option>';
  } finally {
    deptoEl.disabled = false;
  }
}

async function cargarCiudadesProductoPorDepto(codigoDepto, ciudadSeleccionada) {
  const ciudadEl = document.getElementById('prodCiudadOrigen');
  if (!ciudadEl) return;
  const dep = String(codigoDepto || '').trim();
  if (!dep) {
    ciudadEl.innerHTML = '<option value="">Seleccionar...</option>';
    ciudadEl.disabled = true;
    return;
  }
  ciudadEl.disabled = true;
  ciudadEl.innerHTML = '<option value="">Cargando...</option>';
  try {
    const res = await fetch('http://localhost:5000/ubicacion/ciudades?departamento=' + encodeURIComponent(dep));
    const data = await safeJson(res);
    if (!res.ok) {
      ciudadEl.innerHTML = '<option value="">No disponible</option>';
      ciudadEl.disabled = true;
      return;
    }
    ciudadEl.innerHTML = '<option value="">Seleccionar...</option>' +
      (Array.isArray(data) ? data : []).map(c => `<option value="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</option>`).join('');
    ciudadEl.disabled = false;
    if (ciudadSeleccionada) ciudadEl.value = ciudadSeleccionada;
  } catch {
    ciudadEl.innerHTML = '<option value="">No disponible</option>';
    ciudadEl.disabled = true;
  }
}

async function initUbicacionProducto() {
  const deptoEl = document.getElementById('prodDeptoOrigen');
  const ciudadEl = document.getElementById('prodCiudadOrigen');
  if (!deptoEl || !ciudadEl) return;
  await cargarDepartamentosProducto();
  deptoEl.onchange = async function () {
    await cargarCiudadesProductoPorDepto(deptoEl.value);
  };
}

// ── Abrir modal CREAR producto ──
async function abrirCrearProducto() {
  const inputArchivo = document.getElementById('prodImagen');
  if (inputArchivo) inputArchivo.value = '';
  actualizarPreviewImagenProducto('');
  document.getElementById('prodMsg').innerHTML = '';
  const deptoEl = document.getElementById('prodDeptoOrigen');
  const ciudadOrigenEl = document.getElementById('prodCiudadOrigen');
  if (deptoEl) deptoEl.value = '';
  if (ciudadOrigenEl) {
    ciudadOrigenEl.value = '';
    ciudadOrigenEl.innerHTML = '<option value="">Seleccionar...</option>';
    ciudadOrigenEl.disabled = true;
  }
  document.getElementById('modalProductoLabel').textContent = 'Nuevo Producto';
  const select = document.getElementById('prodCategoria');
  try {
    const res = await fetchAuth('http://localhost:5000/categoria');
    if (res.ok) {
      const cats = await res.json();
      select.innerHTML = '<option value="">Seleccionar...</option>' +
        cats.map(c => `<option value="${c.id_categoria}">${c.nombre}</option>`).join('');
    } else {
      select.innerHTML = '<option>Error al cargar categorías</option>';
    }
  } catch {
    select.innerHTML = '<option>Error al cargar categorías</option>';
  }
  await initUbicacionProducto();
  const modal = new bootstrap.Modal(document.getElementById('modalProducto'));
  modal.show();
}

// ── Actualizar preview de imagen ──
function actualizarPreviewImagenProducto(url) {
  const preview = document.getElementById('prodImagenPreview');
  if (!preview) return;

  if (url) {
    preview.innerHTML = `<img src="${url}" class="img-fluid rounded" style="max-height: 200px;" alt="Preview">`;
  } else {
    preview.innerHTML = `<img src="https://via.placeholder.com/200x200?text=Sin+imagen" class="img-fluid rounded" style="max-height: 200px;" alt="Preview">`;
  }
}

// ── Event listener para preview de imagen + tab productos ──
document.addEventListener('DOMContentLoaded', function () {
  const inputImagen = document.getElementById('prodImagen');
  if (inputImagen) {
    inputImagen.addEventListener('input', function () {
      actualizarPreviewImagenProducto(inputImagen.value.trim());
    });
  }

  inicializarUploaderImagenAdmin();

  const productosTab = document.querySelector('[data-bs-target="#productos"]');
  if (productosTab) {
    productosTab.addEventListener('shown.bs.tab', function () {
      cargarProductos();
    });
  }
});

// Productos
function cargarProductos() {
  const cont = document.getElementById('productosList');
  if (!cont) return;
  cont.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="text-muted">Cargando productos...</div></td></tr>';
  fetchAuth('http://localhost:5000/producto')
    .then(async res => {
      if (!res.ok) {
        const body = await safeJson(res);
        renderError('productos', 'No se pudieron cargar los productos.', body?.error || body?.mensaje || `HTTP ${res.status}`);
        return null;
      }
      return res.json();
    })
    .then(productos => {
      if (!productos) return;
      const arr = Array.isArray(productos) ? productos : [];

      if (!arr.length) {
        cont.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="text-muted">No hay productos registrados</div></td></tr>';
        return;
      }

      let html = '';
      arr.forEach(p => {
        const id = p.id_producto || p.id;
        const catNombre = p.categoria_nombre ? escapeHtml(p.categoria_nombre) : '<span class="text-muted">Sin categoría</span>';
        const vend = p.vendedor_nombre
          ? `<div>${escapeHtml(p.vendedor_nombre)}</div><div class="small text-muted">${escapeHtml(p.vendedor_email || '')}</div>`
          : '<span class="text-muted">Sin asignar</span>';
        const stockBadge = p.stock > 10 ? 'bg-success' : (p.stock > 0 ? 'bg-warning text-dark' : 'bg-danger');
        const imgThumb = p.imagen
          ? `<img src="${escapeHtml(p.imagen)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">`
          : '<div style="width:40px;height:40px;background:#eee;border-radius:6px;display:flex;align-items:center;justify-content:center;">📦</div>';

        html += `<tr>
          <td class="text-muted small">${id}</td>
          <td>${imgThumb}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(p.nombre)}</div>
            <div class="small text-muted">${p.descripcion ? escapeHtml(p.descripcion.slice(0, 80)) + (p.descripcion.length > 80 ? '...' : '') : '<em>Sin descripción</em>'}</div>
          </td>
          <td><span class="badge bg-light text-dark border">${catNombre}</span></td>
          <td>${vend}</td>
          <td class="text-end fw-semibold">$${Number(p.precio).toLocaleString()}</td>
          <td class="text-center"><span class="badge ${stockBadge}">${p.stock}</span></td>
          <td>
            <div class="d-flex gap-1">
              <button class='btn btn-sm btn-outline-secondary' onclick='gestionarAtributos(${id})' title="Atributos">⚙</button>
              <button class='btn btn-sm btn-outline-primary' onclick='editarProducto(${id})'>Editar</button>
              <button class='btn btn-sm btn-outline-danger' onclick='eliminarProducto(${id})'>Eliminar</button>
            </div>
          </td>
        </tr>`;
      });

      cont.innerHTML = html;
    })
    .catch(err => {
      console.error('Error cargando productos:', err);
      renderError('productos', 'Error al cargar productos.', err.message);
    });
}

// Crear producto (handler por defecto)
const _formProductoInit = document.getElementById('formProducto');
if (_formProductoInit) _formProductoInit.onsubmit = async function (e) {
  e.preventDefault();
  const nombre = document.getElementById('prodNombre').value;
  const descripcion = document.getElementById('prodDescripcion').value;
  const precio = document.getElementById('prodPrecio').value;
  const stock = document.getElementById('prodStock').value;
  const id_categoria = document.getElementById('prodCategoria').value;
  const imagen = document.getElementById('prodImagen').value;
  const ciudad_origen = (document.getElementById('prodCiudadOrigen')?.value || '').trim();
  const msg = document.getElementById('prodMsg');
  msg.textContent = '';
  try {
    const res = await fetchAuth('http://localhost:5000/producto', {
      method: 'POST',
      body: JSON.stringify({ nombre, descripcion, precio, stock, id_categoria, imagen, ciudad_origen })
    });
    const data = await res.json();
    if (res.ok) {
      msg.innerHTML = '<div class="alert alert-success">Producto creado correctamente.</div>';
      setTimeout(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
        cargarProductos();
      }, 1000);
    } else {
      msg.innerHTML = '<div class="alert alert-danger">' + (data.error || 'Error al crear producto') + '</div>';
    }
  } catch {
    msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
  }
};

window.editarProducto = async function (id) {
  try {
    const [resProducto, resCat] = await Promise.all([
      fetchAuth(`http://localhost:5000/producto/${id}`),
      fetchAuth('http://localhost:5000/categoria')
    ]);
    if (!resProducto.ok) {
      showToast('Producto no encontrado', 'warning');
      return;
    }
    const p = await resProducto.json();
    const categorias = await resCat.json();

    const select = document.getElementById('prodCategoria');
    select.innerHTML = '';
    (Array.isArray(categorias) ? categorias : []).forEach(cat => {
      const catId = cat.id_categoria || cat.id;
      select.innerHTML += `<option value="${catId}" ${catId == p.id_categoria ? 'selected' : ''}>${cat.nombre}</option>`;
    });

    document.getElementById('prodNombre').value = p.nombre || '';
    document.getElementById('prodDescripcion').value = p.descripcion || '';
    document.getElementById('prodPrecio').value = p.precio || '';
    document.getElementById('prodStock').value = p.stock || '';
    document.getElementById('prodImagen').value = p.imagen || '';
    await initUbicacionProducto();
    const deptoEl = document.getElementById('prodDeptoOrigen');
    const ciudadOrigenEl = document.getElementById('prodCiudadOrigen');
    if (deptoEl) deptoEl.value = '';
    if (ciudadOrigenEl) {
      const ciudad = (p.ciudad_origen || '').trim();
      if (ciudad) {
        ciudadOrigenEl.disabled = false;
        ciudadOrigenEl.innerHTML = `<option value="${escapeHtml(ciudad)}">${escapeHtml(ciudad)}</option>`;
        ciudadOrigenEl.value = ciudad;
      } else {
        ciudadOrigenEl.value = '';
        ciudadOrigenEl.innerHTML = '<option value="">Seleccionar...</option>';
        ciudadOrigenEl.disabled = true;
      }
    }
    actualizarPreviewImagenProducto(p.imagen || '');
    document.getElementById('prodMsg').innerHTML = '';
    document.getElementById('modalProductoLabel').textContent = 'Editar Producto';

    document.getElementById('formProducto').onsubmit = async function (e) {
      e.preventDefault();
      const btn = this.querySelector('button[type="submit"]');
      const msg = document.getElementById('prodMsg');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
      msg.innerHTML = '';
      const body = {
        nombre: document.getElementById('prodNombre').value,
        descripcion: document.getElementById('prodDescripcion').value,
        precio: document.getElementById('prodPrecio').value,
        stock: document.getElementById('prodStock').value,
        id_categoria: document.getElementById('prodCategoria').value,
        imagen: document.getElementById('prodImagen').value,
        ciudad_origen: (document.getElementById('prodCiudadOrigen')?.value || '').trim()
      };
      try {
        const resUpd = await fetchAuth(`http://localhost:5000/producto/${id}`, {
          method: 'PUT',
          body: JSON.stringify(body)
        });
        const data = await safeJson(resUpd);
        if (resUpd.ok) {
          msg.innerHTML = '<div class="alert alert-success">Producto actualizado correctamente.</div>';
          setTimeout(() => {
            bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
            cargarProductos();
          }, 800);
        } else {
          msg.innerHTML = '<div class="alert alert-danger">' + ((data && (data.error || data.mensaje)) || 'Error al actualizar') + '</div>';
        }
      } catch {
        msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar';
      }
    };

    new bootstrap.Modal(document.getElementById('modalProducto')).show();
  } catch (err) {
    console.error('Error al cargar producto para editar:', err);
    showToast('Error al cargar producto: ' + err.message, 'error');
  }
};

window.eliminarProducto = async function (id) {
  if (!confirm('¿Seguro que deseas eliminar este producto? Esta acción no se puede deshacer.')) return;
  try {
    const res = await fetchAuth(`http://localhost:5000/producto/${id}`, { method: 'DELETE' });
    if (res.ok) {
      cargarProductos();
      showToast('Producto eliminado correctamente', 'success');
    } else {
      const data = await safeJson(res);
      showToast((data && (data.error || data.mensaje)) || 'Error al eliminar el producto.', 'error');
    }
  } catch {
    showToast('Error de conexión al eliminar.', 'error');
  }
};

// Categorías
function cargarCategorias() {
  const cont = document.getElementById('categorias');
  if (!cont) return;
  cont.innerHTML = '<div class="text-muted py-3">Cargando categorías...</div>';
  fetchAuth('http://localhost:5000/categoria')
    .then(async res => {
      if (!res.ok) {
        const body = await safeJson(res);
        renderError('categorias', 'No se pudieron cargar las categorías.', body?.error || body?.mensaje || `HTTP ${res.status}`);
        return null;
      }
      return res.json();
    })
    .then(categorias => {
      if (!categorias) return;
      const arr = Array.isArray(categorias) ? categorias : [];
      let html = `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h3 class="h5 mb-1">Categorías (${arr.length})</h3>
            <div class="small text-muted">Gestiona las categorías de productos</div>
          </div>
          <button class='btn btn-success' onclick='mostrarFormCategoria()'>+ Nueva Categoría</button>
        </div>`;
      if (!arr.length) {
        html += '<div class="alert alert-light border text-center">No hay categorías registradas.</div>';
      } else {
        html += `<div class="card"><div class="table-responsive"><table class='table table-hover align-middle mb-0'>
          <thead><tr><th>ID</th><th>Nombre</th><th>Descripción</th><th></th></tr></thead><tbody>`;
        arr.forEach(c => {
          const id = c.id_categoria || c.id;
          html += `<tr>
            <td class="text-muted small">${id}</td>
            <td class="fw-semibold">${escapeHtml(c.nombre)}</td>
            <td class="text-muted small">${escapeHtml(c.descripcion || '—')}</td>
            <td class="text-end">
              <button class='btn btn-sm btn-outline-warning' onclick='editarCategoria(${id})'>Editar</button>
              <button class='btn btn-sm btn-outline-danger' onclick='eliminarCategoria(${id})'>Eliminar</button>
            </td>
          </tr>`;
        });
        html += '</tbody></table></div></div>';
      }
      cont.innerHTML = html;
    })
    .catch(err => {
      console.error('Error cargando categorías:', err);
      renderError('categorias', 'Error al cargar categorías.', err.message);
    });
}

window.mostrarFormCategoria = function () {
  document.getElementById('catNombre').value = '';
  document.getElementById('catMsg').innerHTML = '';
  document.getElementById('formCategoria').dataset.id = '';
  new bootstrap.Modal(document.getElementById('modalCategoria')).show();
};

const _formCategoria = document.getElementById('formCategoria');
if (_formCategoria) _formCategoria.onsubmit = async function (e) {
  e.preventDefault();
  const nombre = document.getElementById('catNombre').value;
  const id = document.getElementById('formCategoria').dataset.id;
  try {
    const res = await fetchAuth('http://localhost:5000/categoria' + (id ? '/' + id : ''), {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ nombre })
    });
    if (res.ok) {
      document.getElementById('catMsg').innerHTML = '<div class="alert alert-success">Categoría guardada.</div>';
      setTimeout(() => {
        bootstrap.Modal.getInstance(document.getElementById('modalCategoria')).hide();
        cargarCategorias();
      }, 1000);
    }
  } catch {
    showToast('Error al guardar categoría', 'error');
  }
};

window.editarCategoria = async function (id) {
  try {
    const res = await fetchAuth('http://localhost:5000/categoria');
    const categorias = await res.json();
    const c = (Array.isArray(categorias) ? categorias : []).find(item => (item.id_categoria || item.id) == id);
    if (!c) {
      showToast('Categoría no encontrada', 'warning');
      return;
    }

    document.getElementById('catNombre').value = c.nombre;
    document.getElementById('catMsg').innerHTML = '';
    document.getElementById('formCategoria').dataset.id = id;
    new bootstrap.Modal(document.getElementById('modalCategoria')).show();
  } catch (err) {
    console.error(err);
  }
};

window.eliminarCategoria = async function (id) {
  if (!confirm('¿Seguro que deseas eliminar esta categoría?')) return;
  try {
    const res = await fetchAuth(`http://localhost:5000/categoria/${id}`, { method: 'DELETE' });
    if (res.ok) {
      cargarCategorias();
      showToast('Categoría eliminada correctamente', 'success');
    } else {
      showToast('Error al eliminar (puede tener productos asociados)', 'error');
    }
  } catch {
    showToast('Error de conexión', 'error');
  }
};

// Atributos por secciones
let productoAtributosId = null;
window.gestionarAtributos = async function (id) {
  productoAtributosId = id;
  try {
    const res = await fetchAuth(`http://localhost:5000/producto/${id}/atributos`);
    const atributos = await res.json();
    renderFormAtributos(atributos);
    new bootstrap.Modal(document.getElementById('modalAtributos')).show();
  } catch {
    showToast('Error al cargar atributos', 'error');
  }
};

function renderFormAtributos(atributos) {
  const cont = document.getElementById('atributosContainer');
  const porSeccion = {};
  (Array.isArray(atributos) ? atributos : []).forEach(a => {
    if (!porSeccion[a.seccion]) porSeccion[a.seccion] = [];
    porSeccion[a.seccion].push(a);
  });
  cont.innerHTML = '';
  Object.entries(porSeccion).forEach(([seccion, items]) => {
    const divSeccion = document.createElement('div');
    divSeccion.className = 'border rounded p-3 mb-3';
    divSeccion.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <input type="text" class="form-control form-control-sm fw-bold" value="${seccion}" placeholder="Nombre de la sección" data-seccion="${seccion}" />
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="eliminarSeccion(this)">Eliminar sección</button>
      </div>
      <div class="atributos-lista" data-seccion="${seccion}">
        ${items.map(i => `
          <div class="d-flex gap-2 mb-2">
            <input type="text" class="form-control form-control-sm" placeholder="Atributo" value="${i.atributo}" />
            <input type="text" class="form-control form-control-sm" placeholder="Valor" value="${i.valor}" />
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">×</button>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn btn-sm btn-outline-secondary" onclick="agregarAtributo(this)">+ Atributo</button>
    `;
    cont.appendChild(divSeccion);
  });
  if (!Object.keys(porSeccion).length) {
    agregarSeccion();
  }
}

window.agregarSeccion = function () {
  const cont = document.getElementById('atributosContainer');
  const divSeccion = document.createElement('div');
  const idx = Date.now();
  divSeccion.className = 'border rounded p-3 mb-3';
  divSeccion.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <input type="text" class="form-control form-control-sm fw-bold" placeholder="Nombre de la sección" data-seccion="nueva_${idx}" />
      <button type="button" class="btn btn-sm btn-outline-danger" onclick="eliminarSeccion(this)">Eliminar sección</button>
    </div>
    <div class="atributos-lista" data-seccion="nueva_${idx}">
      <div class="d-flex gap-2 mb-2">
        <input type="text" class="form-control form-control-sm" placeholder="Atributo" />
        <input type="text" class="form-control form-control-sm" placeholder="Valor" />
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">×</button>
      </div>
    </div>
    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="agregarAtributo(this)">+ Atributo</button>
  `;
  cont.appendChild(divSeccion);
};

window.eliminarSeccion = function (btn) {
  btn.closest('.border').remove();
};

window.agregarAtributo = function (btn) {
  const lista = btn.previousElementSibling;
  const div = document.createElement('div');
  div.className = 'd-flex gap-2 mb-2';
  div.innerHTML = `
    <input type="text" class="form-control form-control-sm" placeholder="Atributo" />
    <input type="text" class="form-control form-control-sm" placeholder="Valor" />
    <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.parentElement.remove()">×</button>
  `;
  lista.appendChild(div);
};

const _btnAddSeccion = document.getElementById('btnAddSeccion');
if (_btnAddSeccion) _btnAddSeccion.onclick = agregarSeccion;

const _formAtributos = document.getElementById('formAtributos');
if (_formAtributos) _formAtributos.onsubmit = async function (e) {
  e.preventDefault();
  if (!productoAtributosId) return;
  const seccionesDivs = document.querySelectorAll('#atributosContainer .border');
  const atributos = [];
  seccionesDivs.forEach(div => {
    const inputSeccion = div.querySelector('input[data-seccion]');
    const seccion = inputSeccion ? inputSeccion.value.trim() : '';
    if (!seccion) return;
    const lista = div.querySelector('.atributos-lista');
    if (!lista) return;
    lista.querySelectorAll('.d-flex').forEach(item => {
      const inputs = item.querySelectorAll('input');
      if (inputs.length >= 2) {
        const atributo = inputs[0].value.trim();
        const valor = inputs[1].value.trim();
        if (atributo && valor) {
          atributos.push({ seccion, atributo, valor });
        }
      }
    });
  });
  const msg = document.getElementById('atributosMsg');
  try {
    const res = await fetchAuth(`http://localhost:5000/producto/${productoAtributosId}/atributos`, {
      method: 'PUT',
      body: JSON.stringify(atributos)
    });
    if (res.ok) {
      msg.innerHTML = '<div class="alert alert-success">Características guardadas.</div>';
      setTimeout(() => { bootstrap.Modal.getInstance(document.getElementById('modalAtributos')).hide(); }, 1000);
    } else {
      msg.innerHTML = '<div class="alert alert-danger">Error al guardar.</div>';
    }
  } catch {
    msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
  }
};

// Mantener compatibilidad con botones existentes
window.mostrarFormProducto = function () {
  return abrirCrearProducto();
};
