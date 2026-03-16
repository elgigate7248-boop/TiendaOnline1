// Vendedores (ratings + reviews)

async function cargarVendedores() {
  const cont = document.getElementById('vendedores');
  if (!cont) return;
  cont.innerHTML = '<div class="text-muted py-3">Cargando vendedores...</div>';
  try {
    const res = await fetch('http://localhost:5000/resena/vendedores/ratings');
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [];
    let html = `
      <div class="mb-3">
        <h3 class="h5 mb-1">Vendedores (${arr.length})</h3>
        <div class="small text-muted">Calificación, confiabilidad y reseñas de los vendedores</div>
      </div>`;
    if (!arr.length) {
      html += '<div class="alert alert-light border text-center">No hay vendedores registrados aún.</div>';
    } else {
      html += '<div class="row g-3">';
      arr.forEach(v => {
        const rating = Number(v.rating_promedio) || 0;
        const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
        let confiable, confiableClass;
        if (rating >= 4) { confiable = 'Confiable'; confiableClass = 'bg-success'; }
        else if (rating >= 2.5) { confiable = 'Regular'; confiableClass = 'bg-warning text-dark'; }
        else if (v.total_resenas > 0) { confiable = 'No confiable'; confiableClass = 'bg-danger'; }
        else { confiable = 'Sin reseñas'; confiableClass = 'bg-light text-dark'; }

        html += `
          <div class="col-md-6 col-lg-4">
            <div class="card h-100">
              <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 class="fw-bold mb-0">${escapeHtml(v.vendedor_nombre)}</h6>
                    <div class="small text-muted">${escapeHtml(v.vendedor_email)}</div>
                  </div>
                  <span class="badge ${confiableClass}">${confiable}</span>
                </div>
                <div class="mb-2">
                  <span class="text-warning fs-5">${stars}</span>
                  <span class="fw-bold ms-1">${rating || '—'}</span>
                </div>
                <div class="d-flex gap-3 small text-muted">
                  <span>${v.total_productos} productos</span>
                  <span>${v.total_resenas} reseñas</span>
                </div>
                <button class="btn btn-sm btn-outline-primary mt-2 w-100" onclick="verResenasVendedor(${v.id_vendedor}, '${escapeHtml(v.vendedor_nombre).replace(/'/g, "\\'")}')">
                  Ver reseñas
                </button>
              </div>
            </div>
          </div>
        `;
      });
      html += '</div>';
    }
    html += '<div id="resenasVendedorDetalle" class="mt-4"></div>';
    cont.innerHTML = html;
  } catch (err) {
    console.error('Error cargando vendedores:', err);
    renderError('vendedores', 'Error al cargar vendedores.', err.message);
  }
}

window.verResenasVendedor = async function (idVendedor, nombre) {
  const cont = document.getElementById('resenasVendedorDetalle');
  if (!cont) return;
  cont.innerHTML = '<div class="text-muted py-2">Cargando reseñas...</div>';
  try {
    const res = await fetch(`http://localhost:5000/resena/vendedor/${idVendedor}`);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [];
    if (!arr.length) {
      cont.innerHTML = `<div class="card p-3"><h6>Reseñas de ${escapeHtml(nombre)}</h6><p class="text-muted mb-0">Este vendedor aún no tiene reseñas.</p></div>`;
      return;
    }
    let html = `<div class="card p-3"><h6 class="mb-3">Reseñas de ${escapeHtml(nombre)} (${arr.length})</h6>`;
    arr.forEach(r => {
      const stars = '★'.repeat(Math.round(r.rating)) + '☆'.repeat(5 - Math.round(r.rating));
      const fecha = r.fecha ? new Date(r.fecha).toLocaleDateString() : '';
      html += `
        <div class="border-bottom py-2">
          <div class="d-flex justify-content-between">
            <div>
              <span class="text-warning">${stars}</span>
              <span class="fw-semibold ms-1">${escapeHtml(r.usuario)}</span>
            </div>
            <span class="text-muted small">${fecha}</span>
          </div>
          <div class="small text-muted">Producto: ${escapeHtml(r.producto_nombre)}</div>
          <div class="small mt-1">${escapeHtml(r.comentario)}</div>
        </div>
      `;
    });
    html += '</div>';
    cont.innerHTML = html;
  } catch {
    cont.innerHTML = '<div class="alert alert-danger">Error al cargar reseñas.</div>';
  }
};
