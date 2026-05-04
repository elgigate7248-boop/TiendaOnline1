/**
 * ChartFactory — fábrica de gráficos Chart.js para el dashboard de vendedor.
 * Todos los métodos son estáticos. Destruyen la instancia previa antes de redibujar.
 */
const ChartFactory = (() => {

  const _instances = {};

  const PALETTE = {
    purple  : 'rgba(102,126,234,1)',
    purpleA : 'rgba(102,126,234,0.7)',
    green   : 'rgba(39,174,96,1)',
    greenA  : 'rgba(39,174,96,0.7)',
    red     : 'rgba(231,76,60,1)',
    redA    : 'rgba(231,76,60,0.7)',
    orange  : 'rgba(243,156,18,1)',
    orangeA : 'rgba(243,156,18,0.7)',
    blue    : 'rgba(52,152,219,1)',
    blueA   : 'rgba(52,152,219,0.7)',
    gray    : 'rgba(149,165,166,0.6)',
    white70 : 'rgba(255,255,255,0.7)',
    white20 : 'rgba(255,255,255,0.2)',
  };

  const BASE_FONT = { color: '#fff', family: "'Segoe UI', sans-serif" };

  function _destroy(id) {
    if (_instances[id]) { try { _instances[id].destroy(); } catch (_) {} }
    _instances[id] = null;
  }

  function _canvas(id) {
    const el = document.getElementById(id);
    if (!el) { console.warn('[ChartFactory] canvas no encontrado:', id); return null; }
    return el;
  }

  // ── Gráfico de barras horizontales (rankings) ───────────────────────
  function createBarH(id, labels, values, { color = PALETTE.purpleA, label = 'Valor', formatter } = {}) {
    const canvas = _canvas(id);
    if (!canvas) return;
    _destroy(id);

    _instances[id] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label, data: values, backgroundColor: color, borderRadius: 6, borderSkipped: false }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => formatter ? formatter(ctx.parsed.x) : ctx.parsed.x
            }
          }
        },
        scales: {
          x: {
            ticks: { color: PALETTE.white70, callback: v => formatter ? formatter(v) : v },
            grid:  { color: PALETTE.white20 }
          },
          y: {
            ticks: { color: '#fff', font: { size: 11 } },
            grid:  { display: false }
          }
        }
      }
    });
    return _instances[id];
  }

  // ── Gráfico de dona (distribución) ─────────────────────────────────
  function createDonut(id, labels, values, colors, { title = '' } = {}) {
    const canvas = _canvas(id);
    if (!canvas) return;
    _destroy(id);

    _instances[id] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: 'rgba(26,26,46,0.8)',
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#fff', padding: 14, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed / ctx.dataset.data.reduce((a,b)=>a+b,0)*100)}%)`
            }
          }
        }
      }
    });
    return _instances[id];
  }

  // ── Gráfico de burbujas — Matriz Estratégica ────────────────────────
  function createBubble(id, datasets, { xLabel = 'Volumen vendido', yLabel = 'Margen %' } = {}) {
    const canvas = _canvas(id);
    if (!canvas) return;
    _destroy(id);

    _instances[id] = new Chart(canvas, {
      type: 'bubble',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#fff', padding: 14 }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const d = ctx.raw;
                return [
                  ` ${d.nombre || ctx.dataset.label}`,
                  ` Vendido: ${d.x} uds`,
                  ` Margen: ${d.y}%`,
                  ` Capital: $${(d.r_raw || 0).toLocaleString('es-CO')}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: xLabel, color: PALETTE.white70 },
            ticks: { color: PALETTE.white70 },
            grid:  { color: PALETTE.white20 }
          },
          y: {
            title: { display: true, text: yLabel, color: PALETTE.white70 },
            ticks: { color: PALETTE.white70 },
            grid:  { color: PALETTE.white20 }
          }
        }
      }
    });
    return _instances[id];
  }

  // ── Gráfico de barras verticales simples ────────────────────────────
  function createBarV(id, labels, datasets, { formatter } = {}) {
    const canvas = _canvas(id);
    if (!canvas) return;
    _destroy(id);

    _instances[id] = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#fff', padding: 12 }
          },
          tooltip: {
            callbacks: {
              label: ctx => formatter ? formatter(ctx.parsed.y, ctx.dataset.label) : `${ctx.dataset.label}: ${ctx.parsed.y}`
            }
          }
        },
        scales: {
          x: { ticks: { color: PALETTE.white70 }, grid: { color: PALETTE.white20 } },
          y: {
            ticks: { color: PALETTE.white70, callback: v => formatter ? formatter(v) : v },
            grid: { color: PALETTE.white20 }
          }
        }
      }
    });
    return _instances[id];
  }

  // ── Destruir todos ──────────────────────────────────────────────────
  function destroyAll() {
    Object.keys(_instances).forEach(_destroy);
  }

  // ── Helpers de colores condicionales ────────────────────────────────
  function colorPorMargen(pct) {
    if (pct > 20)  return PALETTE.green;
    if (pct > 0)   return PALETTE.orange;
    return PALETTE.red;
  }

  function colorPorEstado(estado) {
    const map = {
      'OK':            PALETTE.green,
      'Bajo':          PALETTE.orange,
      'Crítico':       PALETTE.red,
      'Agotado':       PALETTE.red,
      'Sin rotación':  PALETTE.gray
    };
    return map[estado] || PALETTE.gray;
  }

  return {
    createBarH,
    createBarV,
    createDonut,
    createBubble,
    destroyAll,
    colorPorMargen,
    colorPorEstado,
    PALETTE
  };
})();
