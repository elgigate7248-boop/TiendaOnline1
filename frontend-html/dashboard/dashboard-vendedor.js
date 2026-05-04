/**
 * Dashboard Analítico de Vendedor — lógica principal
 * Consume: GET /reportes/vendedor/productos-detalle
 * Depende de: config.js (API_BASE), data-table.js, chart-factory.js, Bootstrap 5, Chart.js
 */

// ── Auth ─────────────────────────────────────────────────────────────────────
const _token = localStorage.getItem('token');
let   _user  = {};
try { _user = JSON.parse(localStorage.getItem('user') || '{}'); } catch (_) {}

const _roles = Array.isArray(_user.roles)
  ? _user.roles.map(r => r.nombre || r)
  : (_user.rol ? [_user.rol] : []);

if (!_token) {
  location.href = '../login.html';
  throw new Error('Sin sesión');
}
if (!_roles.includes('VENDEDOR') && !_roles.includes('ADMIN') && !_roles.includes('SUPER_ADMIN')) {
  location.href = '../index.html';
  throw new Error('Sin permisos');
}

// ── Estado global ─────────────────────────────────────────────────────────────
let _productos    = [];
let _resumen      = {};
let _tablaMain    = null;
let _tablaReab    = null;
let _cargando     = false;

// ── Utilidades ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = {
  moneda : v => `$${Number(v || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
  pct    : v => `${Number(v || 0).toFixed(1)}%`,
  num    : v => Number(v || 0).toLocaleString('es-CO'),
  dec    : (v, d = 2) => Number(v || 0).toFixed(d)
};

async function fetchAuth(url) {
  const res = await fetch(API_BASE + url, {
    headers: { 'Authorization': 'Bearer ' + _token, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Badges ────────────────────────────────────────────────────────────────────
function badgeEstado(estado) {
  const map = {
    'OK'           : ['success', 'check-circle'],
    'Bajo'         : ['warning', 'exclamation-triangle'],
    'Crítico'      : ['danger',  'fire'],
    'Agotado'      : ['dark',    'times-circle'],
    'Sin rotación' : ['secondary','pause-circle']
  };
  const [cls, icon] = map[estado] || ['secondary', 'question-circle'];
  return `<span class="badge bg-${cls} badge-estado">
    <i class="fas fa-${icon} me-1"></i>${estado}
  </span>`;
}

function badgeRotacion(clase) {
  const map = {
    'Rápido'    : ['success',   'bolt'],
    'Medio'     : ['warning',   'clock'],
    'Lento'     : ['danger',    'snail'],
    'Sin ventas': ['secondary', 'minus']
  };
  const [cls, icon] = map[clase] || ['secondary', 'minus'];
  return `<span class="badge bg-${cls} badge-rot"><i class="fas fa-${icon} me-1"></i>${clase}</span>`;
}

function badgeMatriz(clasif) {
  const map = {
    'Mantener'   : 'badge-mantener',
    'Promocionar': 'badge-promocionar',
    'Revisar'    : 'badge-revisar',
    'Eliminar'   : 'badge-eliminar',
    'Sin datos'  : 'badge-secondary'
  };
  return `<span class="badge ${map[clasif] || 'bg-secondary'}">${clasif}</span>`;
}

function badgeMargen(pct) {
  const p = Number(pct);
  if (p > 20)  return `<span class="badge bg-success">${fmt.pct(p)}</span>`;
  if (p > 0)   return `<span class="badge bg-warning text-dark">${fmt.pct(p)}</span>`;
  return `<span class="badge bg-danger">${fmt.pct(p)}</span>`;
}

// ── Inicialización de la tabla principal ──────────────────────────────────────
function initTablaMain() {
  const columns = [
    {
      key: 'nombre', label: 'Producto', sortable: true,
      render: (v, row) => `<div class="prod-cell">
        ${row.imagen ? `<img src="${row.imagen}" class="prod-thumb me-2" onerror="this.style.display='none'">` : ''}
        <span class="prod-name">${v}</span>
      </div>`
    },
    { key: 'cantidad_comprada', label: 'Comprado', sortable: true, class: 'text-center',
      render: v => `<span class="fw-semibold">${fmt.num(v)}</span>`,
      tooltip: 'Total unidades ingresadas al inventario (ENTRADA FIFO)' },
    { key: 'cantidad_vendida',  label: 'Vendido',  sortable: true, class: 'text-center',
      render: v => `<span class="fw-semibold">${fmt.num(v)}</span>`,
      tooltip: 'Total unidades vendidas (SALIDA FIFO)' },
    { key: 'stock_actual', label: 'Stock', sortable: true, class: 'text-center',
      render: (v, row) => {
        const cls = v === 0 ? 'text-danger' : (v <= 5 ? 'text-warning' : 'text-success');
        return `<span class="${cls} fw-bold">${fmt.num(v)}</span>`;
      },
      tooltip: 'Unidades restantes en lotes FIFO activos' },
    { key: 'ingresos_brutos', label: 'Ingresos', sortable: true, class: 'text-end',
      render: v => fmt.moneda(v), tooltip: 'Precio venta × cantidad vendida' },
    { key: 'costo_total', label: 'Costos', sortable: true, class: 'text-end',
      render: (v, row) => {
        const badge = row.costo_estimado
          ? ` <span class="badge bg-secondary ms-1" style="font-size:0.6rem"
                data-bs-toggle="tooltip"
                title="Costo estimado: los movimientos de SALIDA tenían costo=0 (sin lote FIFO al momento de la venta). Se usó el costo promedio de compra como aproximación.">
                ~est
              </span>`
          : '';
        return `<span class="text-danger">${fmt.moneda(v)}</span>${badge}`;
      },
      tooltip: 'Costo FIFO real × cantidad vendida (~ = estimado por costo promedio de compra)' },
    { key: 'comision_total', label: 'Comisión', sortable: true, class: 'text-end',
      render: v => `<span class="text-warning">${fmt.moneda(v)}</span>`,
      tooltip: 'Comisión de plataforma cobrada' },
    { key: 'ganancia_neta', label: 'Ganancia neta', sortable: true, class: 'text-end',
      render: v => {
        const cls = Number(v) > 0 ? 'text-success fw-bold' : 'text-danger fw-bold';
        return `<span class="${cls}">${fmt.moneda(v)}</span>`;
      },
      tooltip: 'Ingresos − Costos FIFO − Comisión' },
    { key: 'margen_pct', label: 'Margen %', sortable: true, class: 'text-center',
      render: v => badgeMargen(v),
      tooltip: '(Ganancia neta / Costo total) × 100' },
    { key: 'roi', label: 'ROI', sortable: true, class: 'text-center',
      render: v => badgeMargen(v),
      tooltip: '(Ganancia neta / Costo total) × 100' },
    { key: 'rotacion_clase', label: 'Rotación', sortable: true, class: 'text-center',
      render: (v, row) => {
        const dias = row.rotacion_dias !== null ? `<br><small class="opacity-75">${fmt.dec(row.rotacion_dias,1)} días/ud</small>` : '';
        return badgeRotacion(v) + dias;
      }
    },
    { key: 'estado_inventario', label: 'Estado', sortable: true, class: 'text-center',
      render: v => badgeEstado(v) },
    { key: 'id_producto', label: '', sortable: false, class: 'text-center',
      render: (v) => `<a href="../trazabilidad.html?id_producto=${v}"
          class="btn btn-sm"
          style="background:rgba(42,82,152,0.25);border:1px solid rgba(42,82,152,0.45);color:#63b3ed;white-space:nowrap;padding:3px 8px;font-size:.72rem"
          title="Ver trazabilidad FIFO de este producto">
          <i class="fas fa-search me-1"></i>Trazabilidad
        </a>` }
  ];

  _tablaMain = new AdvancedTable({
    tableId   : 'tablaProductosPrincipal',
    columns,
    searchId  : 'buscarProducto',
    counterId : 'contadorProductos'
  });
}

// ── Inicialización de la tabla de reabastecimiento ────────────────────────────
function initTablaReab() {
  const columns = [
    { key: 'nombre', label: 'Producto', sortable: true,
      render: (v, row) => `<div class="prod-cell">
        ${row.imagen ? `<img src="${row.imagen}" class="prod-thumb me-2" onerror="this.style.display='none'">` : ''}
        <span>${v}</span></div>` },
    { key: 'stock_actual', label: 'Stock actual', sortable: true, class: 'text-center',
      render: v => `<strong>${fmt.num(v)}</strong> uds` },
    { key: 'ventas_por_dia', label: 'Ventas / día', sortable: true, class: 'text-center',
      render: v => Number(v) > 0 ? `${fmt.dec(v, 2)} uds/día` : '<span class="text-muted">—</span>' },
    { key: 'dias_para_agotar', label: 'Días restantes', sortable: true, class: 'text-center',
      render: (v, row) => {
        if (v === null) return '<span class="text-muted">—</span>';
        if (v === 0)    return '<span class="badge bg-dark">Agotado</span>';
        if (v <= 3)     return `<span class="badge bg-danger">${v} días ⚠️</span>`;
        if (v <= 10)    return `<span class="badge bg-warning text-dark">${v} días</span>`;
        if (v <= 30)    return `<span class="badge bg-info text-dark">${v} días</span>`;
        return `<span class="badge bg-success">${v} días</span>`;
      }
    },
    { key: 'capital_invertido', label: 'Capital retenido', sortable: true, class: 'text-end',
      render: v => fmt.moneda(v) },
    { key: 'estado_inventario', label: 'Urgencia', sortable: true, class: 'text-center',
      render: v => badgeEstado(v) }
  ];

  _tablaReab = new AdvancedTable({
    tableId: 'tablaReabastecimiento',
    columns
  });
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function renderKPIs() {
  const r = _resumen;
  $('kpiCapitalInmovilizado')?.classList.toggle('kpi-danger', (r.capital_inmovilizado_total || 0) > 0);
  setText('kpiCapitalInmovilizadoVal',  fmt.moneda(r.capital_inmovilizado_total));
  setText('kpiMargenPromedioVal',        fmt.pct(r.margen_promedio));
  setText('kpiProductosRiesgoVal',       r.productos_en_riesgo ?? 0);
  setText('kpiRoiPromedioVal',           fmt.pct(r.roi_promedio));
  setText('kpiTotalIngresosVal',         fmt.moneda(r.total_ingresos));
  setText('kpiTotalGananciaVal',         fmt.moneda(r.total_ganancia_neta));
  setText('kpiProductosRentablesVal',    r.productos_rentables ?? 0);
  setText('kpiTotalProductosVal',        r.total_productos ?? 0);

  // Color dinámico margen
  const kpiMarg = $('kpiMargenPromedioVal');
  if (kpiMarg) {
    kpiMarg.className = 'kpi-value ' + (r.margen_promedio > 20 ? 'text-success' : r.margen_promedio > 0 ? 'text-warning' : 'text-danger');
  }
}

function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

// ── Rankings ──────────────────────────────────────────────────────────────────
function renderRankings() {
  const top5 = (arr) => arr.slice(0, 5);

  const masVendidos    = top5([..._productos].sort((a, b) => b.cantidad_vendida - a.cantidad_vendida));
  const masRentables   = top5([..._productos].sort((a, b) => b.ganancia_neta - a.cantidad_vendida).sort((a, b) => b.ganancia_neta - a.ganancia_neta));
  const peorMargen     = top5([..._productos].filter(p => p.cantidad_vendida > 0).sort((a, b) => a.margen_pct - b.margen_pct));
  const mayorCapital   = top5([..._productos].sort((a, b) => b.capital_invertido - a.capital_invertido));

  renderRankingList('rankingVendidosList', masVendidos,   p => `${fmt.num(p.cantidad_vendida)} uds`, 'purple');
  renderRankingList('rankingRentablesList', masRentables, p => fmt.moneda(p.ganancia_neta),          'green');
  renderRankingList('rankingPeorMargenList', peorMargen,  p => badgeMargen(p.margen_pct),             'red');
  renderRankingList('rankingCapitalList',    mayorCapital, p => fmt.moneda(p.capital_invertido),      'orange');

  // Gráficos de ranking
  ChartFactory.createBarH(
    'chartMasVendidos',
    masVendidos.map(p => truncate(p.nombre, 20)),
    masVendidos.map(p => p.cantidad_vendida),
    { color: ChartFactory.PALETTE.purpleA, label: 'Unidades vendidas' }
  );
  ChartFactory.createBarH(
    'chartMasRentables',
    masRentables.map(p => truncate(p.nombre, 20)),
    masRentables.map(p => p.ganancia_neta),
    { color: ChartFactory.PALETTE.greenA, label: 'Ganancia neta', formatter: v => fmt.moneda(v) }
  );
}

function renderRankingList(containerId, items, valFn, colorKey) {
  const el = $(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<li class="list-group-item bg-transparent text-muted">Sin datos</li>';
    return;
  }
  el.innerHTML = items.map((p, i) => `
    <li class="list-group-item bg-transparent border-bottom-subtle d-flex justify-content-between align-items-center py-2">
      <div class="d-flex align-items-center gap-2">
        <span class="rank-badge rank-${colorKey}">${i + 1}</span>
        <span class="text-white small">${truncate(p.nombre, 28)}</span>
      </div>
      <span class="fw-semibold small">${valFn(p)}</span>
    </li>
  `).join('');
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + '…' : (str || '');
}

// ── Gráfico de dona — Distribución de rotación ────────────────────────────────
function renderChartRotacion() {
  const rapido = _productos.filter(p => p.rotacion_clase === 'Rápido').length;
  const medio  = _productos.filter(p => p.rotacion_clase === 'Medio').length;
  const lento  = _productos.filter(p => p.rotacion_clase === 'Lento').length;
  const sinV   = _productos.filter(p => p.rotacion_clase === 'Sin ventas').length;

  ChartFactory.createDonut(
    'chartRotacion',
    ['Rápido', 'Medio', 'Lento', 'Sin ventas'],
    [rapido, medio, lento, sinV],
    [ChartFactory.PALETTE.green, ChartFactory.PALETTE.orange, ChartFactory.PALETTE.red, ChartFactory.PALETTE.gray]
  );
}

// ── Gráfico de dona — Distribución de estado ──────────────────────────────────
function renderChartEstado() {
  const counts = {};
  _productos.forEach(p => { counts[p.estado_inventario] = (counts[p.estado_inventario] || 0) + 1; });
  const labels  = Object.keys(counts);
  const values  = Object.values(counts);
  const palette = labels.map(l => ChartFactory.colorPorEstado(l));

  ChartFactory.createDonut('chartEstadoInventario', labels, values, palette);
}

// ── Matriz Estratégica ────────────────────────────────────────────────────────
function renderMatriz() {
  const cuadrantes = { Mantener: [], Promocionar: [], Revisar: [], Eliminar: [], 'Sin datos': [] };
  _productos.forEach(p => (cuadrantes[p.matriz_clasificacion] || cuadrantes['Sin datos']).push(p));

  const renderQ = (id, items, fn) => {
    const el = $(id);
    if (!el) return;
    if (!items.length) { el.innerHTML = '<p class="text-muted small text-center my-2">Sin productos</p>'; return; }
    el.innerHTML = items.map(p => `
      <div class="matriz-item d-flex justify-content-between align-items-center py-1 border-bottom border-opacity-10">
        <span class="small text-truncate me-2" style="max-width:140px">${p.nombre}</span>
        <div class="d-flex gap-1 flex-shrink-0">
          ${badgeMargen(p.margen_pct)}
        </div>
      </div>
    `).join('');
  };

  renderQ('matrizMantener',    cuadrantes['Mantener'],    p => p);
  renderQ('matrizPromocionar', cuadrantes['Promocionar'], p => p);
  renderQ('matrizRevisar',     cuadrantes['Revisar'],     p => p);
  renderQ('matrizEliminar',    cuadrantes['Eliminar'],    p => p);

  // Contadores
  ['Mantener','Promocionar','Revisar','Eliminar'].forEach(k => {
    setText(`cnt${k}`, cuadrantes[k].length);
  });

  // Gráfico de burbujas
  const colores = {
    'Mantener':    ChartFactory.PALETTE.greenA,
    'Promocionar': ChartFactory.PALETTE.blueA,
    'Revisar':     ChartFactory.PALETTE.orangeA,
    'Eliminar':    ChartFactory.PALETTE.redA
  };

  const datasets = Object.entries(cuadrantes)
    .filter(([k]) => k !== 'Sin datos')
    .map(([k, items]) => ({
      label: k,
      backgroundColor: colores[k] || ChartFactory.PALETTE.gray,
      data: items.map(p => ({
        x      : p.cantidad_vendida,
        y      : p.margen_pct,
        r      : Math.max(6, Math.min(30, Math.sqrt(p.capital_invertido || 1) / 2)),
        r_raw  : p.capital_invertido,
        nombre : p.nombre
      }))
    }));

  ChartFactory.createBubble('chartMatrizBurbuja', datasets);
}

// ── Problemas y Recomendaciones ───────────────────────────────────────────────
function renderProblemasYRecomendaciones() {
  // Alertas globales
  const alertas = [];
  const conMargenNeg  = _productos.filter(p => p.margen_pct <= 0 && p.cantidad_vendida > 0);
  const agotados      = _productos.filter(p => p.estado_inventario === 'Agotado');
  const criticos      = _productos.filter(p => p.estado_inventario === 'Crítico');
  const sinRotacion   = _productos.filter(p => p.rotacion_clase === 'Lento' && p.stock_actual > 10);
  const sinVentas     = _productos.filter(p => p.cantidad_vendida === 0 && p.stock_actual > 0);
  const capitalMuerto = sinVentas.reduce((s, p) => s + (p.capital_invertido || 0), 0);

  if (conMargenNeg.length)
    alertas.push({ nivel: 'danger',  icono: 'exclamation-triangle', titulo: `${conMargenNeg.length} producto(s) con margen negativo o cero`,
      desc: `Estos productos están vendiendo por debajo del costo. Sube el precio o negocia mejor costo.` });
  if (criticos.length)
    alertas.push({ nivel: 'danger',  icono: 'fire', titulo: `${criticos.length} producto(s) en estado CRÍTICO (stock < 3 días)`,
      desc: `Reabastecer urgentemente para no perder ventas.` });
  if (agotados.length)
    alertas.push({ nivel: 'warning', icono: 'times-circle', titulo: `${agotados.length} producto(s) agotado(s) con historial de ventas`,
      desc: `Productos que se vendían bien y ya no tienen stock disponible.` });
  if (sinRotacion.length)
    alertas.push({ nivel: 'warning', icono: 'warehouse', titulo: `${sinRotacion.length} producto(s) con rotación lenta y alto stock`,
      desc: `Considera descuentos o promociones para liberar capital.` });
  if (sinVentas.length && capitalMuerto > 0)
    alertas.push({ nivel: 'info',    icono: 'lock', titulo: `Capital inmovilizado en productos sin venta: ${fmt.moneda(capitalMuerto)}`,
      desc: `${sinVentas.length} producto(s) con stock pero sin ventas en el período. Evalúa liquidar o promocionar.` });

  const conCostoEstimado = _productos.filter(p => p.costo_estimado);
  if (conCostoEstimado.length)
    alertas.push({ nivel: 'warning', icono: 'flask', titulo: `${conCostoEstimado.length} producto(s) con costo estimado (~est)`,
      desc: `Los movimientos de SALIDA de estos productos tenían costo_unitario=0 en la base de datos (el lote FIFO no estaba disponible al momento de la venta o el campo "costo_compra" del producto era 0). Se usó el costo promedio de las compras (ENTRADA) como aproximación. Productos afectados: ${conCostoEstimado.map(p => p.nombre).join(', ')}.` });

  const elAlertas = $('alertasProblemas');
  if (elAlertas) {
    if (!alertas.length) {
      elAlertas.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle me-2"></i>¡Sin problemas detectados en el período seleccionado!</div>`;
    } else {
      elAlertas.innerHTML = alertas.map(a => `
        <div class="alert alert-${a.nivel} d-flex gap-3 align-items-start">
          <i class="fas fa-${a.icono} fa-lg mt-1 flex-shrink-0"></i>
          <div>
            <div class="fw-semibold">${a.titulo}</div>
            <div class="small opacity-75 mt-1">${a.desc}</div>
          </div>
        </div>
      `).join('');
    }
  }

  // Recomendaciones por producto
  const conRecs = _productos.filter(p => p.recomendaciones && p.recomendaciones.length > 0)
    .sort((a, b) => {
      const prio = { critico: 0, urgente: 1, medio: 2, oportunidad: 3, positivo: 4 };
      const minA = Math.min(...a.recomendaciones.map(r => prio[r.tipo] ?? 5));
      const minB = Math.min(...b.recomendaciones.map(r => prio[r.tipo] ?? 5));
      return minA - minB;
    });

  const elRecs = $('recomendacionesContainer');
  if (!elRecs) return;

  if (!conRecs.length) {
    elRecs.innerHTML = '<p class="text-muted text-center mt-3">No hay recomendaciones en este período.</p>';
    return;
  }

  const tipoConfig = {
    critico    : { cls: 'rec-critico',     icono: 'bomb',             label: 'CRÍTICO' },
    urgente    : { cls: 'rec-urgente',     icono: 'exclamation',      label: 'URGENTE' },
    medio      : { cls: 'rec-medio',       icono: 'info-circle',      label: 'ATENCIÓN' },
    oportunidad: { cls: 'rec-oportunidad', icono: 'lightbulb',        label: 'OPORTUNIDAD' },
    positivo   : { cls: 'rec-positivo',    icono: 'star',             label: 'POSITIVO' }
  };

  elRecs.innerHTML = conRecs.map(p => {
    const recs = p.recomendaciones.map(r => {
      const cfg = tipoConfig[r.tipo] || tipoConfig.medio;
      return `<div class="rec-item ${cfg.cls}">
        <i class="fas fa-${cfg.icono} me-2"></i>
        <span class="rec-label">${cfg.label}</span>
        ${r.mensaje}
      </div>`;
    }).join('');
    return `
      <div class="rec-card">
        <div class="rec-card-header">
          <i class="fas fa-box me-2 opacity-75"></i>
          <strong>${p.nombre}</strong>
          <div class="ms-auto d-flex gap-1">
            ${badgeMargen(p.margen_pct)}
            ${badgeEstado(p.estado_inventario)}
          </div>
        </div>
        <div class="rec-card-body">${recs}</div>
      </div>`;
  }).join('');
}

// ── Reabastecimiento ──────────────────────────────────────────────────────────
function renderReabastecimiento() {
  const conStock = _productos.filter(p => p.stock_actual > 0 || p.estado_inventario === 'Agotado');
  const ordenado = [...conStock].sort((a, b) => {
    // Agotados primero, luego por días restantes asc
    if (a.estado_inventario === 'Agotado' && b.estado_inventario !== 'Agotado') return -1;
    if (b.estado_inventario === 'Agotado' && a.estado_inventario !== 'Agotado') return 1;
    if (a.dias_para_agotar === null && b.dias_para_agotar === null) return 0;
    if (a.dias_para_agotar === null) return 1;
    if (b.dias_para_agotar === null) return -1;
    return a.dias_para_agotar - b.dias_para_agotar;
  });

  _tablaReab?.load(ordenado);
}

// ── Carga de datos ────────────────────────────────────────────────────────────
async function cargarDatos() {
  if (_cargando) return;
  _cargando = true;

  const fi = $('fechaInicio')?.value || '';
  const ff = $('fechaFin')?.value   || '';
  const params = new URLSearchParams();
  if (fi) params.set('fecha_inicio', fi);
  if (ff) params.set('fecha_fin',    ff);

  mostrarLoading(true);
  setError('');

  try {
    const res  = await fetchAuth(`/reportes/vendedor/productos-detalle?${params}`);
    const data = res.data;

    _productos = data.productos  || [];
    _resumen   = data.resumen    || {};

    renderKPIs();
    _tablaMain?.load(_productos);
    renderRankings();
    renderChartRotacion();
    renderChartEstado();
    renderMatriz();
    renderProblemasYRecomendaciones();
    renderReabastecimiento();

    setText('ultimaActualizacion', new Date().toLocaleTimeString('es-CO'));

  } catch (err) {
    console.error('[Dashboard Vendedor]', err);
    setError('Error al cargar los datos: ' + (err.message || 'Error desconocido'));
  } finally {
    _cargando = false;
    mostrarLoading(false);
  }
}

function mostrarLoading(show) {
  const el = $('loadingOverlay');
  if (el) el.style.display = show ? 'flex' : 'none';
  const btn = $('btnActualizar');
  if (btn) { btn.disabled = show; btn.innerHTML = show
    ? '<i class="fas fa-spinner fa-spin me-1"></i>Cargando...'
    : '<i class="fas fa-sync-alt me-1"></i>Actualizar'; }
}

function setError(msg) {
  const el = $('errorBanner');
  if (!el) return;
  el.style.display = msg ? 'block' : 'none';
  el.textContent = msg;
}

// ── Filtros de la tabla principal ─────────────────────────────────────────────
function setupFiltros() {
  $('filtroRotacion')?.addEventListener('change', e => _tablaMain?.setFilter('rotacion_clase',   e.target.value));
  $('filtroEstado')?.addEventListener('change',   e => _tablaMain?.setFilter('estado_inventario', e.target.value));
  $('filtroMatriz')?.addEventListener('change',   e => _tablaMain?.setFilter('matriz_clasificacion', e.target.value));

  $('btnLimpiarFiltros')?.addEventListener('click', () => {
    ['filtroRotacion','filtroEstado','filtroMatriz'].forEach(id => {
      const el = $(id); if (el) el.value = '';
    });
    const buscar = $('buscarProducto'); if (buscar) buscar.value = '';
    _tablaMain?.setFilter('rotacion_clase', '');
    _tablaMain?.setFilter('estado_inventario', '');
    _tablaMain?.setFilter('matriz_clasificacion', '');
    _tablaMain?.setSearch('');
  });
}

// ── Fechas por defecto ────────────────────────────────────────────────────────
function initFechas() {
  const hoy  = new Date();
  const hace = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate());
  const fi = $('fechaInicio');
  const ff = $('fechaFin');
  if (fi) fi.value = hace.toISOString().slice(0, 10);
  if (ff) ff.value = hoy.toISOString().slice(0, 10);

  $('btnActualizar')?.addEventListener('click', cargarDatos);
}

// ── Nombre de usuario ─────────────────────────────────────────────────────────
function initUserInfo() {
  const nombre = _user.nombre || _user.email || 'Vendedor';
  setText('vendedorNombre', nombre);
  const avatar = $('userAvatar');
  if (avatar) avatar.textContent = nombre[0]?.toUpperCase() || 'V';
}

// ── Cerrar sesión ─────────────────────────────────────────────────────────────
window.cerrarSesion = function () {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.href = '../login.html';
};

// ── Arranque ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initUserInfo();
  initFechas();
  initTablaMain();
  initTablaReab();
  setupFiltros();
  cargarDatos();
});
