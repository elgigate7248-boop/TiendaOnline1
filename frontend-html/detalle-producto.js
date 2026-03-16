const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const cont = document.getElementById('detalleProducto');
const contSimilares = document.getElementById('similares');
const contResenas = document.getElementById('resenas');
const btnSimPrev = document.getElementById('btnSimPrev');
const btnSimNext = document.getElementById('btnSimNext');

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function getRoles() {
  const user = getUser();
  if (Array.isArray(user.roles)) {
    return user.roles
      .map(r => (r && typeof r === 'object') ? r.nombre : r)
      .filter(Boolean);
  }
  return user.rol ? [user.rol] : [];
}

function getToken() {
  return localStorage.getItem('token');
}

async function cargarResenas(idProducto) {
  const contResenas = document.getElementById('resenas');
  if (!contResenas) return;
  contResenas.innerHTML = '<div class="text-muted">Cargando reseñas...</div>';

  try {
    const res = await fetch(`${API_BASE}/resena/producto/${idProducto}`);
    const resenas = await res.json();

    const roles = getRoles();
    const puedeResenar = !!getToken() && roles.includes('CLIENTE');

    // Calcular promedio y distribución
    const total = resenas.length;
    const promedio = total ? (resenas.reduce((s, r) => s + Number(r.rating), 0) / total).toFixed(1) : '0.0';
    const distrib = [5,4,3,2,1].map(stars => ({
      stars,
      count: resenas.filter(r => Number(r.rating) === stars).length,
      percent: total ? (resenas.filter(r => Number(r.rating) === stars).length / total * 100) : 0
    }));

    let html = '';
    if (puedeResenar) {
      html += `
        <button class="btn btn-primary mb-3" type="button" data-bs-toggle="collapse" data-bs-target="#formResenaCollapse">
          Escribir una reseña
        </button>
        <div class="collapse mb-4" id="formResenaCollapse">
          <form id="formResena">
            <div class="mb-2">
              <label class="form-label">Puntuación</label>
              <select class="form-select" id="resenaRating" required>
                <option value="">--</option>
                <option value="5">5 estrellas</option>
                <option value="4">4 estrellas</option>
                <option value="3">3 estrellas</option>
                <option value="2">2 estrellas</option>
                <option value="1">1 estrella</option>
              </select>
            </div>
            <div class="mb-2">
              <label class="form-label">Comentario</label>
              <textarea class="form-control" id="resenaComentario" rows="3" required></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Publicar reseña</button>
            <div id="resenaMsg" class="mt-2"></div>
          </form>
        </div>
      `;
    } else if (!getToken()) {
      html += '<div class="alert alert-light border">Inicia sesión como <b>CLIENTE</b> para dejar una reseña. <a href="login.html?redirect=detalle-producto.html?id=' + encodeURIComponent(idProducto) + '">Ir a login</a></div>';
    } else {
      html += '<div class="alert alert-light border">Solo los usuarios con rol <b>CLIENTE</b> pueden dejar reseñas.</div>';
    }

    // Resumen estadístico
    html += `
      <div class="row mb-4">
        <div class="col-md-4">
          <div class="fw-bold fs-3">${promedio} <small class="text-muted fw-normal">/5</small></div>
          <div class="text-muted">${total} reseña${total !== 1 ? 's' : ''}</div>
        </div>
        <div class="col-md-8">
          ${distrib.map(d => `
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="small">${d.stars} ⭐</span>
              <div class="progress flex-grow-1" style="height:8px;">
                <div class="progress-bar bg-warning" style="width:${d.percent}%"></div>
              </div>
              <span class="small text-muted" style="min-width:28px;">${d.count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Ordenamiento
    html += `
      <div class="d-flex align-items-center gap-2 mb-3">
        <span class="small fw-semibold">Ordenar por:</span>
        <select class="form-select form-select-sm" id="sortResenas" style="width:auto;">
          <option value="reciente">Más reciente</option>
          <option value="mayor">Mayor puntuación</option>
          <option value="menor">Menor puntuación</option>
        </select>
      </div>
    `;

    if (!total) {
      html += '<div class="text-muted">Aún no hay reseñas. Sé el primero en comentar.</div>';
      contResenas.innerHTML = html;
      return;
    }

    const renderResenas = (orden) => {
      let sorted = [...resenas];
      if (orden === 'mayor') sorted.sort((a,b) => Number(b.rating) - Number(a.rating));
      else if (orden === 'menor') sorted.sort((a,b) => Number(a.rating) - Number(b.rating));
      else sorted.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

      const itemsHtml = sorted
        .map(r => {
          const fecha = r.fecha ? new Date(r.fecha).toLocaleString() : '';
          return `
            <div class="card shadow-sm mb-2">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <div class="fw-semibold">${escapeHtml(r.usuario || 'Usuario')}</div>
                    <div class="text-muted small">${fecha}</div>
                  </div>
                  <div class="badge bg-success">${r.rating}/5</div>
                </div>
                <div class="mt-2">${escapeHtml((r.comentario || '').toString())}</div>
              </div>
            </div>
          `;
        })
        .join('');
      contResenas.innerHTML = html + itemsHtml;
    };

    renderResenas('reciente');

    const sortSelect = document.getElementById('sortResenas');
    if (sortSelect) {
      sortSelect.onchange = () => renderResenas(sortSelect.value);
    }

    const form = document.getElementById('formResena');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const msg = document.getElementById('resenaMsg');
        msg.textContent = '';
        const rating = document.getElementById('resenaRating').value;
        const comentario = document.getElementById('resenaComentario').value;

        try {
          const token = getToken();
          const resp = await fetch(`${API_BASE}/resena/producto/${idProducto}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ rating, comentario })
          });
          const body = await resp.json();
          if (resp.ok) {
            msg.innerHTML = '<div class="alert alert-success">Reseña publicada.</div>';
            await cargarResenas(idProducto);
          } else {
            msg.innerHTML = '<div class="alert alert-danger">' + (body.error || 'No se pudo publicar') + '</div>';
          }
        } catch {
          msg.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
        }
      };
    }
  } catch {
    contResenas.innerHTML = '<div class="text-muted">No se pudieron cargar las reseñas.</div>';
  }
}

function pushVisto(producto) {
  try {
    const vistos = JSON.parse(localStorage.getItem('vistos') || '[]');
    const pid = producto.id_producto || producto.id;
    const limpio = {
      id: pid,
      nombre: producto.nombre,
      precio: Number(producto.precio) || 0,
      id_categoria: producto.id_categoria,
      imagen: producto.imagen || null,
      ts: Date.now()
    };
    const sinDup = vistos.filter(v => String(v.id) !== String(pid));
    sinDup.unshift(limpio);
    localStorage.setItem('vistos', JSON.stringify(sinDup.slice(0, 12)));
  } catch {
    // ignore
  }
}

async function cargarSimilares(prod) {
  if (!contSimilares) return;
  try {
    const res = await fetch(`${API_BASE}/producto`);
    const productos = await res.json();
    const similares = (productos || [])
      .filter(p => String(p.id_producto) !== String(prod.id_producto))
      .filter(p => String(p.id_categoria) === String(prod.id_categoria))
      .slice(0, 6);

    if (!similares.length) {
      contSimilares.innerHTML = '<div class="text-muted">No hay productos similares para mostrar.</div>';
      return;
    }

    contSimilares.innerHTML = '';
    similares.forEach(p => {
      const item = document.createElement('div');
      item.className = 'ml-hitem';
      item.innerHTML = `
        <a href="detalle-producto.html?id=${p.id_producto}" class="text-decoration-none text-dark">
          <div class="card h-100 shadow-sm">
            <img src="${p.imagen || 'https://via.placeholder.com/300x200'}" class="card-img-top" alt="${p.nombre}">
            <div class="card-body">
              <div class="small text-muted">Nuevo</div>
              <div class="fw-semibold">${p.nombre}</div>
              <div class="text-muted">$${p.precio}</div>
            </div>
          </div>
        </a>
      `;
      contSimilares.appendChild(item);
    });

    const scrollByCards = (dir) => {
      const first = contSimilares.querySelector('.ml-hitem');
      const amount = first ? first.getBoundingClientRect().width + 12 : 240;
      contSimilares.scrollBy({ left: dir * amount * 2, behavior: 'smooth' });
    };

    if (btnSimPrev) btnSimPrev.onclick = () => scrollByCards(-1);
    if (btnSimNext) btnSimNext.onclick = () => scrollByCards(1);
  } catch {
    contSimilares.innerHTML = '<div class="text-muted">No se pudieron cargar los similares.</div>';
  }
}
if (!id) {
  cont.innerHTML = '<div class="alert alert-danger">ID de producto no especificado.</div>';
} else {
  fetch(`${API_BASE}/producto/${id}`)
    .then(res => res.json())
    .then(prod => {
      if (!prod) {
        cont.innerHTML = '<div class="alert alert-info">Producto no encontrado.</div>';
        return;
      }

      const bc = document.getElementById('breadcrumbProducto');
      if (bc) bc.textContent = prod.nombre || 'Producto';

      const img = prod.imagen || 'https://via.placeholder.com/800x600';
      const thumbs = [img, img, img];

      let html = `
        <div class="pdp-grid">
          <div class="pdp-card p-3 p-md-4">
            <div class="pdp-gallery">
              <div class="pdp-thumbs" id="thumbs"></div>
              <div>
                <img id="mainImg" src="${img}" class="pdp-main-img" alt="${prod.nombre}">
              </div>
            </div>

            <div class="mt-4">
              <h2 class="h4 fw-bold">${prod.nombre}</h2>
              <div class="text-muted">Stock disponible: <b>${prod.stock ?? ''}</b></div>
              <div class="fw-bold fs-3 mt-2">$${prod.precio}</div>
              <div class="mt-3">
                <button class="btn btn-primary" type="button" onclick="agregarAlCarrito(${prod.id_producto || prod.id}, '${escapeHtml(prod.nombre)}', ${prod.precio}, '${escapeHtml(prod.imagen || '')}', '${escapeHtml(prod.ciudad_origen || '')}', ${prod.tiempo_preparacion || 1})">Agregar al carrito</button>
                <a class="btn btn-outline-dark ms-2" href="carrito.html">Ver carrito</a>
              </div>
            </div>

            <div id="seccionDescripcion" class="mt-4" style="display:none;">
              <h3 class="h6 fw-bold">Descripción</h3>
              <p id="textoDescripcion" class="small"></p>
            </div>

            <div id="seccionAtributos" class="mt-4" style="display:none;">
              <h3 class="h6 fw-bold">Características del producto</h3>
              <div id="atributosList"></div>
            </div>
          </div>

          <div class="pdp-card p-3 p-md-4">
            <div class="fw-semibold mb-2">Opciones de compra</div>
            <div class="text-muted mb-3">Envío y pagos (demo)</div>
            <div class="d-grid gap-2">
              <button class="btn btn-dark" type="button" onclick="comprarAhora(${prod.id_producto || prod.id}, '${escapeHtml(prod.nombre)}', ${prod.precio}, '${escapeHtml(prod.imagen || '')}', '${escapeHtml(prod.ciudad_origen || '')}', ${prod.tiempo_preparacion || 1})">Comprar ahora</button>
              <button class="btn btn-outline-dark" type="button" onclick="agregarAlCarrito(${prod.id_producto || prod.id}, '${escapeHtml(prod.nombre)}', ${prod.precio}, '${escapeHtml(prod.imagen || '')}', '${escapeHtml(prod.ciudad_origen || '')}', ${prod.tiempo_preparacion || 1})">Agregar al carrito</button>
            </div>

            <hr>
            <div class="small text-muted">Lo que tienes que saber de este producto (próximo paso: descripción + características desde BD).</div>
          </div>
        </div>
      `;

      cont.innerHTML = html;

      const thumbsCont = document.getElementById('thumbs');
      const mainImg = document.getElementById('mainImg');
      if (thumbsCont && mainImg) {
        thumbsCont.innerHTML = '';
        thumbs.forEach((t) => {
          const el = document.createElement('div');
          el.className = 'pdp-thumb';
          el.innerHTML = `<img src="${t}" alt="thumb">`;
          el.addEventListener('click', () => {
            mainImg.src = t;
          });
          thumbsCont.appendChild(el);
        });
      }

      // Mostrar descripción si existe
      const secDesc = document.getElementById('seccionDescripcion');
      const txtDesc = document.getElementById('textoDescripcion');
      if (secDesc && txtDesc) {
        if (prod.descripcion && prod.descripcion.trim()) {
          txtDesc.textContent = prod.descripcion;
          secDesc.style.display = 'block';
        } else {
          secDesc.style.display = 'none';
        }
      }

      // Cargar y mostrar atributos por secciones
      const secAtr = document.getElementById('seccionAtributos');
      const listAtr = document.getElementById('atributosList');
      if (secAtr && listAtr) {
        fetch(`${API_BASE}/producto/${prod.id_producto || prod.id}/atributos`)
          .then(r => r.json())
          .then(atributos => {
            if (!Array.isArray(atributos) || !atributos.length) {
              secAtr.style.display = 'none';
              return;
            }
            const porSeccion = {};
            atributos.forEach(a => {
              if (!porSeccion[a.seccion]) porSeccion[a.seccion] = [];
              porSeccion[a.seccion].push(a);
            });
            listAtr.innerHTML = '';
            Object.entries(porSeccion).forEach(([seccion, items]) => {
              const divSeccion = document.createElement('div');
              divSeccion.className = 'mb-3';
              divSeccion.innerHTML = `<h4 class="h6 fw-bold mb-2">${seccion}</h4>`;
              const table = document.createElement('table');
              table.className = 'table table-sm table-borderless';
              items.forEach(i => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td class="fw-semibold">${i.atributo}</td><td>${i.valor}</td>`;
                table.appendChild(tr);
              });
              divSeccion.appendChild(table);
              listAtr.appendChild(divSeccion);
            });
            secAtr.style.display = 'block';
          })
          .catch(() => {
            secAtr.style.display = 'none';
          });
      }

      pushVisto(prod);
      cargarSimilares(prod);
      cargarResenas(prod.id_producto || prod.id);
    })
    .catch(() => {
      cont.innerHTML = '<div class="alert alert-danger">Error al cargar el producto.</div>';
    });
}

function agregarAlCarrito(id, nombre, precio, imagen, ciudad_origen, tiempo_preparacion) {
  let carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
  const idx = carrito.findIndex(i => String(i.id) === String(id));
  if (idx >= 0) {
    carrito[idx].cantidad++;
  } else {
    carrito.push({ id, nombre, precio, cantidad: 1, imagen: imagen || null, ciudad_origen: ciudad_origen || null, tiempo_preparacion: Number(tiempo_preparacion) || 1 });
  }
  localStorage.setItem('carrito', JSON.stringify(carrito));

  const badge = document.getElementById('cartCount');
  if (badge) {
    const total = carrito.reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
    badge.textContent = String(total);
    badge.style.display = total > 0 ? 'inline-block' : 'none';
  }

  mostrarToast('Producto agregado al carrito');
}

function comprarAhora(id, nombre, precio, imagen, ciudad_origen, tiempo_preparacion) {
  let carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
  const idx = carrito.findIndex(i => String(i.id) === String(id));
  if (idx < 0) {
    carrito.push({ id, nombre, precio, cantidad: 1, imagen: imagen || null, ciudad_origen: ciudad_origen || null, tiempo_preparacion: Number(tiempo_preparacion) || 1 });
    localStorage.setItem('carrito', JSON.stringify(carrito));
  }
  window.location.href = 'checkout.html';
}

function mostrarToast(msg) {
  let toast = document.getElementById('toastCarrito');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastCarrito';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#333;color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;z-index:9999;opacity:0;transition:opacity 0.3s;box-shadow:0 4px 16px rgba(0,0,0,0.2);';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.agregarAlCarrito = agregarAlCarrito;
window.comprarAhora = comprarAhora;
