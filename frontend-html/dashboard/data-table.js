/**
 * AdvancedTable — tabla con búsqueda, filtros y ordenamiento dinámico.
 * Uso:
 *   const t = new AdvancedTable({ tableId, columns, searchId });
 *   t.load(arrayDeDatos);
 */
class AdvancedTable {
  /**
   * @param {Object} cfg
   * @param {string}   cfg.tableId   - id del <table>
   * @param {Array}    cfg.columns   - [{key, label, sortable, render, class, tooltip}]
   * @param {string}   [cfg.searchId]  - id del <input> de búsqueda
   * @param {string}   [cfg.counterId] - id del elemento donde mostrar "X / Y productos"
   * @param {Function} [cfg.onRowClick]
   */
  constructor({ tableId, columns, searchId, counterId, onRowClick }) {
    this.table     = document.getElementById(tableId);
    this.columns   = columns;
    this.allData   = [];
    this.filtered  = [];
    this.sortCol   = null;
    this.sortDir   = -1;
    this.filters   = {};
    this.search    = '';
    this.counterId = counterId;
    this.onRowClick = onRowClick;

    if (!this.table) { console.warn('[AdvancedTable] tabla no encontrada:', tableId); return; }

    this.thead = this.table.querySelector('thead');
    this.tbody = this.table.querySelector('tbody');

    this._buildHeader();
    this._bindSearch(searchId);
  }

  // ── Datos ────────────────────────────────────────────────────────────

  load(data) {
    this.allData = Array.isArray(data) ? data : [];
    this._apply();
  }

  // ── Filtros externos ─────────────────────────────────────────────────

  setFilter(key, value) {
    if (!value || value === 'all' || value === '') delete this.filters[key];
    else this.filters[key] = String(value);
    this._apply();
  }

  setSearch(term) {
    this.search = (term || '').toLowerCase().trim();
    this._apply();
  }

  // ── Lógica principal ─────────────────────────────────────────────────

  _apply() {
    this.filtered = this.allData.filter(row => {
      // Búsqueda global
      if (this.search) {
        const haystack = this.columns
          .map(c => String(row[c.key] ?? ''))
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(this.search)) return false;
      }
      // Filtros por columna
      for (const [k, v] of Object.entries(this.filters)) {
        if (String(row[k] ?? '') !== v) return false;
      }
      return true;
    });

    if (this.sortCol) {
      this.filtered.sort((a, b) => {
        const av = a[this.sortCol], bv = b[this.sortCol];
        const an = Number(av), bn = Number(bv);
        if (!isNaN(an) && !isNaN(bn)) return (an - bn) * this.sortDir;
        return String(av ?? '').localeCompare(String(bv ?? '')) * this.sortDir;
      });
    }

    this._render();
    this._updateCounter();
  }

  _render() {
    if (!this.tbody) return;

    if (!this.filtered.length) {
      this.tbody.innerHTML = `
        <tr>
          <td colspan="${this.columns.length}" class="text-center py-5 text-muted">
            <i class="fas fa-inbox fa-2x d-block mb-2 opacity-50"></i>
            Sin datos para mostrar
          </td>
        </tr>`;
      return;
    }

    this.tbody.innerHTML = this.filtered.map((row, i) => {
      const cells = this.columns.map(col => {
        const raw = row[col.key];
        const val = col.render ? col.render(raw, row) : (raw ?? '—');
        return `<td class="${col.class || ''}">${val}</td>`;
      }).join('');
      return `<tr data-idx="${i}">${cells}</tr>`;
    }).join('');

    // Tooltips Bootstrap
    this.tbody.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
      const existing = bootstrap.Tooltip.getInstance(el);
      if (existing) existing.dispose();
      new bootstrap.Tooltip(el, { html: true, placement: 'top' });
    });

    // Click en fila
    if (this.onRowClick) {
      this.tbody.querySelectorAll('tr').forEach(tr => {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
          const idx = Number(tr.dataset.idx);
          this.onRowClick(this.filtered[idx]);
        });
      });
    }

    // Actualizar indicadores de orden en cabecera
    if (this.thead) {
      this.thead.querySelectorAll('th[data-sort]').forEach(th => {
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        if (th.dataset.sort === this.sortCol) {
          icon.className = `sort-icon fas ms-1 ${this.sortDir === 1 ? 'fa-sort-up' : 'fa-sort-down'} text-warning`;
        } else {
          icon.className = 'sort-icon fas fa-sort ms-1 opacity-25';
        }
      });
    }
  }

  // ── Cabecera con soporte de sort ─────────────────────────────────────

  _buildHeader() {
    if (!this.thead) return;

    const tr = this.thead.querySelector('tr') || this.thead.appendChild(document.createElement('tr'));
    tr.innerHTML = this.columns.map(col => {
      const sortAttr    = col.sortable !== false ? `data-sort="${col.key}" style="cursor:pointer"` : '';
      const tooltipAttr = col.tooltip ? `data-bs-toggle="tooltip" title="${col.tooltip}"` : '';
      const sortIcon    = col.sortable !== false
        ? `<i class="sort-icon fas fa-sort ms-1 opacity-25"></i>` : '';
      return `<th ${sortAttr} ${tooltipAttr} class="${col.thClass || ''}">${col.label}${sortIcon}</th>`;
    }).join('');

    // Inicializar tooltips de cabecera
    tr.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el =>
      new bootstrap.Tooltip(el, { placement: 'top' })
    );

    // Event sort
    tr.addEventListener('click', e => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const col = th.dataset.sort;
      if (this.sortCol === col) this.sortDir = -this.sortDir;
      else { this.sortCol = col; this.sortDir = -1; }
      this._apply();
    });
  }

  _bindSearch(searchId) {
    if (!searchId) return;
    const el = document.getElementById(searchId);
    if (!el) return;
    el.addEventListener('input', e => this.setSearch(e.target.value));
  }

  _updateCounter() {
    if (!this.counterId) return;
    const el = document.getElementById(this.counterId);
    if (!el) return;
    el.textContent = `${this.filtered.length} / ${this.allData.length} productos`;
  }

  // ── Helpers públicos ─────────────────────────────────────────────────

  getData()         { return this.filtered; }
  getAllData()       { return this.allData; }
  getCount()        { return { total: this.allData.length, filtered: this.filtered.length }; }
}
