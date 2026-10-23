/* =====================================================================
 * oferter.js — Modul OFERTER: Atrybuty + Konfigurator PC
 * ===================================================================== */
'use strict';

const OFER_API = '/api/oferter';


const OferterState = {
  tab: localStorage.getItem('oferter_active_tab') || 'attrs',
  categories: [],
  selectedCatId: null,
  selectedCatName: '',
  products: [],
  productPage: 1,
  productTotal: 0,
  productSearch: '',
  attrDefs: [],
  selectedProduct: null,
  filterPcOnly: true,
};

// ─── RENDER ROOT ──────────────────────────────────────────────────────────────
function renderOferter() {
  const el = document.getElementById('view-oferter');
  if (!el) return;
  el.innerHTML = `
    <div class="ofer-tabs" id="ofer-tab-bar">
      <button class="ofer-tab ${OferterState.tab==='attrs'?'active':''}" data-tab="attrs">🏷️ Atrybuty</button>
      <button class="ofer-tab ${OferterState.tab==='components'?'active':''}" data-tab="components">🖥️ Komponenty</button>
      <button class="ofer-tab ${OferterState.tab==='quotes'?'active':''}" data-tab="quotes">📋 Oferty</button>
    </div>
    <div id="ofer-pane-attrs"  class="ofer-tab-pane ${OferterState.tab==='attrs'?'active':''}"></div>
    <div id="ofer-pane-components" class="ofer-tab-pane ${OferterState.tab==='components'?'active':''}">
      <div class="ofer-empty"><span class="ofer-empty-icon">🚧</span><h3>W budowie</h3><p>Konfigurator zestawow — wkrotce</p></div>
    </div>
    <div id="ofer-pane-quotes" class="ofer-tab-pane ${OferterState.tab==='quotes'?'active':''}">
      <div class="ofer-empty"><span class="ofer-empty-icon">📋</span><h3>Brak ofert</h3><p>Zapisane oferty pojawia sie tutaj</p></div>
    </div>
  `;
  el.querySelectorAll('.ofer-tab').forEach(btn => {
    btn.addEventListener('click', () => { 
      OferterState.tab = btn.dataset.tab; 
      localStorage.setItem('oferter_active_tab', btn.dataset.tab);
      renderOferter(); 
      if (btn.dataset.tab === 'attrs') loadAttrsTab(); 
      else if (btn.dataset.tab === 'components') initConfiguratorTab();
      else if (btn.dataset.tab === 'quotes') loadQuotesTab();
    });
  });
  if (OferterState.tab === 'attrs') loadAttrsTab();
  else if (OferterState.tab === 'components') initConfiguratorTab();
  else if (OferterState.tab === 'quotes') loadQuotesTab();
}

// ─── ATTRS TAB ────────────────────────────────────────────────────────────────
async function loadAttrsTab() {
  const pane = document.getElementById('ofer-pane-attrs');
  if (!pane) return;

  // Load coverage data
  let coverage = [];
  try {
    const d = await API.get('/oferter/setup/coverage');
    coverage = d.categories || [];
  } catch(e) {}

  // Load all categories for status
  let statusData = { pc_categories: [] };
  try {
    statusData = await API.get('/oferter/setup/status');
  } catch(e) {}

  const pcCats = statusData.pc_categories || [];
  const totalPC = pcCats.length;
  const withAttrs = pcCats.filter(c => c.attr_count > 0).length;

  pane.innerHTML = `
    <!-- Seed panel -->
    <div class="ofer-seed-panel">
      <div class="ofer-seed-text">
        <h4>🌱 Inicjalizacja atrybutow technicznych</h4>
        <p>Jednorazowo dodaj definicje atrybutow (Socket, TDP, Format plyty itp.) do kategorii PC. Bez tego filtry zgodnosci nie beda dzialac.</p>
      </div>
      <button class="btn btn--primary" id="ofer-seed-btn">Uruchom seed atrybutow</button>
      <button class="btn btn--secondary" id="ofer-sync-attrs-btn">Uzupełnij cechy z hurtowni</button>
      <div id="ofer-seed-status" style="font-size:.82rem;"></div>
    </div>

    <!-- Stats -->
    <div class="ofer-stat-strip">
      <div class="ofer-stat-card">
        <div class="ofer-stat-label">Kategorie PC</div>
        <div class="ofer-stat-val">${totalPC}</div>
      </div>
      <div class="ofer-stat-card">
        <div class="ofer-stat-label">Z atrybutami</div>
        <div class="ofer-stat-val ${withAttrs===totalPC&&totalPC>0?'green':'yellow'}">${withAttrs} / ${totalPC}</div>
      </div>
      <div class="ofer-stat-card">
        <div class="ofer-stat-label">Produkty z danymi</div>
        <div class="ofer-stat-val">${coverage.reduce((s,c)=>s+c.products_with_attrs,0)}</div>
      </div>
    </div>

    <!-- Filter -->
    <div class="ofer-toolbar" style="margin-bottom:14px;">
      <span style="font-size:.82rem;font-weight:600;color:var(--text-muted);">Filtr:</span>
      <button class="ofer-filter-chip ${OferterState.filterPcOnly?'active':''}" id="ofer-filter-pc">Tylko komponenty PC</button>
      <button class="ofer-filter-chip ${!OferterState.filterPcOnly?'active':''}" id="ofer-filter-all">Wszystkie kategorie</button>
      <span style="margin-left:auto;font-size:.78rem;color:var(--text-muted);">${coverage.length} kategorii z atrybutami</span>
    </div>

    <!-- Category grid -->
    <div class="ofer-cat-grid" id="ofer-cat-grid"></div>

    <!-- Attribute editor (shown when category selected) -->
    <div id="ofer-attr-editor" style="display:none;"></div>
  `;

  document.getElementById('ofer-seed-btn')?.addEventListener('click', runSeed);
  document.getElementById('ofer-sync-attrs-btn')?.addEventListener('click', runAttrSync);
  document.getElementById('ofer-filter-pc')?.addEventListener('click', () => { OferterState.filterPcOnly = true; loadAttrsTab(); });
  document.getElementById('ofer-filter-all')?.addEventListener('click', () => { OferterState.filterPcOnly = false; loadAttrsTab(); });

  await renderCategoryGrid(coverage);
}

async function renderCategoryGrid(coverage) {
  const grid = document.getElementById('ofer-cat-grid');
  if (!grid) return;

  let cats = [];
  try {
    const d = await API.get('/oferter/setup/categories');
    cats = d.categories || [];
  } catch(e) {}

  const coverageMap = {};
  coverage.forEach(c => { coverageMap[c.id] = c; });

  const display = OferterState.filterPcOnly ? cats.filter(c => c.is_pc_component) : cats;

  const ICONS = {
    'procesor': '🧠', 'plyta': '🖥️', 'chlodz': '❄️', 'pamiec': '💾',
    'dysk': '💿', 'graficzna': '🎮', 'zasilacz': '⚡', 'obudowa': '📦',
    'system': '🪟',
  };
  function getIcon(name) {
    const n = name.toLowerCase().replace(/[ąćęłńóśźż]/g, c => ({ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z'}[c]||c));
    for (const [k, icon] of Object.entries(ICONS)) if (n.includes(k)) return icon;
    return '📂';
  }

  if (!display.length) {
    grid.innerHTML = `<div class="ofer-empty" style="grid-column:1/-1"><span class="ofer-empty-icon">📂</span><h3>Brak kategorii</h3><p>Wygeneruj kategorie w Sourcing → Katalog → Generuj kategorie</p></div>`;
    return;
  }

  grid.innerHTML = display.map(c => {
    const cov = coverageMap[c.id];
    const pct = cov && c.product_count > 0 ? Math.round((cov.products_with_attrs / c.product_count) * 100) : 0;
    const attrCount = c.attr_count || 0;
    const isSelected = OferterState.selectedCatId === c.id;
    return `
      <div class="ofer-cat-card ${c.is_pc_component?'is-pc':''} ${isSelected?'ofer-prod-row selected':''}" data-cat-id="${c.id}" data-cat-name="${c.name}">
        <div class="ofer-cat-header">
          <div class="ofer-cat-icon">${getIcon(c.name)}</div>
          <div>
            <div class="ofer-cat-name">${c.name}</div>
            <div class="ofer-cat-count">${c.product_count || 0} produktow</div>
          </div>
        </div>
        <div class="ofer-cat-meta">
          ${c.is_pc_component ? `<span class="ofer-badge blue">🔧 Komponent PC</span>` : ''}
          <span class="ofer-badge ${attrCount>0?'green':'gray'}">${attrCount} atr.</span>
          ${cov ? `<span class="ofer-badge ${pct>80?'green':pct>40?'yellow':'red'}">${pct}% wypelnione</span>` : ''}
        </div>
        ${attrCount > 0 ? `
          <div class="ofer-coverage-bar-wrap">
            <div class="ofer-coverage-bar-track"><div class="ofer-coverage-bar-fill" style="width:${pct}%"></div></div>
            <div class="ofer-coverage-label">${cov?.products_with_attrs||0} z ${c.product_count||0} produktow ma atrybuty</div>
            ${pct < 100 ? `<button class="btn btn--sm" style="width:100%; margin-top:8px; background:var(--bg-elevated);" onclick="event.stopPropagation(); startBatchExtractAI(this, ${c.id})">▶ Zbiorcza ekstrakcja AI</button>` : ''}
          </div>` : ''}
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.ofer-cat-card').forEach(card => {
    card.addEventListener('click', () => {
      OferterState.selectedCatId = parseInt(card.dataset.catId);
      OferterState.selectedCatName = card.dataset.catName;
      OferterState.productPage = 1;
      OferterState.productSearch = '';
      loadCategoryEditor();
    });
  });
}

window.startBatchExtractAI = async function(btn, catId) {
  const orig = btn.textContent;
  btn.textContent = '⏳ Uruchamianie...';
  btn.disabled = true;
  try {
    const res = await API.post('/oferter/product-attrs/batch-extract/' + catId);
    if(res.ok) {
      btn.textContent = '✅ Ekstrakcja w tle...';
      alert(res.message);
      // Opcjonalnie: setInterval do odpytywania o status
    } else {
      alert(res.error || 'Błąd uruchamiania zadania');
      btn.textContent = orig;
      btn.disabled = false;
    }
  } catch(e) {
    alert('Błąd sieci');
    btn.textContent = orig;
    btn.disabled = false;
  }
};

// ─── CATEGORY ATTR EDITOR ─────────────────────────────────────────────────────
async function loadCategoryEditor() {
  const editor = document.getElementById('ofer-attr-editor');
  if (!editor) return;
  editor.style.display = 'block';

  const catId = OferterState.selectedCatId;

  let attrDefs = [];
  try {
    const d = await API.get(`/oferter/setup/attributes/${catId}`);
    attrDefs = d.attributes || [];
    OferterState.attrDefs = attrDefs;
  } catch(e) {}

  let products = [];
  let total = 0;
  const limit = 30;
  const off = (OferterState.productPage - 1) * limit;
  try {
    const qs = new URLSearchParams({ search: OferterState.productSearch, limit, offset: off });
    const d = await API.get(`/oferter/components/${catId}?${qs}`);
    products = d.products || [];
    total = d.total || 0;
  } catch(e) {}

  editor.innerHTML = `
    <div class="ofer-attr-panel">
      <div class="ofer-attr-panel-header">
        <div class="ofer-attr-panel-title">✏️ Atrybuty: <strong>${OferterState.selectedCatName}</strong></div>
        <button class="btn btn--ghost btn--sm" id="ofer-close-editor">✕ Zamknij</button>
      </div>

      <!-- Attr definitions -->
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
        <div style="font-size:.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Definicje atrybutow kategorii</div>
        ${attrDefs.length ? `
          <table class="ofer-attrdef-table">
            <thead><tr><th>Atrybut</th><th>Typ</th><th>Jednostka</th><th>Filtr</th><th></th></tr></thead>
            <tbody>
              ${attrDefs.map(a => `
                <tr>
                  <td><strong>${a.attr_name}</strong></td>
                  <td><span class="ofer-badge gray">${a.attr_type}</span></td>
                  <td>${a.attr_unit||'—'}</td>
                  <td>${a.is_filter ? '<span class="ofer-badge green">tak</span>' : '<span class="ofer-badge gray">nie</span>'}</td>
                  <td><button class="btn btn--ghost btn--sm ofer-del-attr" data-id="${a.id}">🗑</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="color:var(--text-muted);font-size:.82rem;margin:0;">Brak definicji atrybutow — uruchom seed lub dodaj recznie</p>'}
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <input class="ofer-attr-input" id="ofer-new-attr-name" placeholder="Nazwa atrybutu" style="flex:1;min-width:140px;">
          <select class="ofer-attr-input" id="ofer-new-attr-type" style="width:110px;">
            <option value="text">tekst</option>
            <option value="numeric">liczba</option>
          </select>
          <input class="ofer-attr-input" id="ofer-new-attr-unit" placeholder="Jednostka (np. W, GB)" style="width:130px;">
          <button class="btn btn--primary btn--sm" id="ofer-add-attr-btn">+ Dodaj atrybut</button>
        </div>
      </div>

      <!-- Product list + inline editor -->
      <div class="ofer-split">
        <div class="ofer-split-left">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:8px;">
            <input class="ofer-search" id="ofer-prod-search" placeholder="Szukaj produktu..." value="${OferterState.productSearch}">
          </div>
          <div class="ofer-prod-list" id="ofer-prod-list">
            ${products.length ? products.map(p => {
              const filled = p.attributes ? p.attributes.filter(a => a.value_text || a.value_numeric != null).length : 0;
              const pct = attrDefs.length ? Math.round((filled / attrDefs.length) * 100) : 0;
              const isSelected = OferterState.selectedProduct?.id === p.id;
              return `
                <div class="ofer-prod-row ${isSelected?'selected':''}" data-prod-id="${p.id}">
                  <div class="ofer-prod-name" title="${p.name}">${p.name}</div>
                  <div class="ofer-prod-mfg">${p.manufacturer||''}</div>
                  <span class="ofer-prod-attrs-filled ofer-badge ${pct===100?'green':pct>50?'yellow':'red'}">${filled}/${attrDefs.length}</span>
                  ${p.in_subiekt ? '<span title="Na magazynie">🟢</span>' : ''}
                </div>
              `;
            }).join('') : '<div class="ofer-empty"><span class="ofer-empty-icon" style="font-size:2rem">📦</span><p>Brak produktow w tej kategorii</p></div>'}
          </div>
          <div class="ofer-pagination" id="ofer-pagination">
            ${off > 0 ? `<button class="ofer-page-btn" id="ofer-prev-page">← Poprzednia</button>` : ''}
            <span class="ofer-page-info">${off+1}–${Math.min(off+limit,total)} z ${total}</span>
            ${off+limit < total ? `<button class="ofer-page-btn" id="ofer-next-page">Następna →</button>` : ''}
          </div>
        </div>
        <div class="ofer-split-right" id="ofer-inline-editor">
          <div class="ofer-empty"><span class="ofer-empty-icon" style="font-size:2rem">👈</span><h3>Wybierz produkt</h3><p>Kliknij produkt z listy aby edytowac atrybuty</p></div>
        </div>
      </div>
    </div>
  `;

  // Events
  editor.querySelector('#ofer-close-editor')?.addEventListener('click', () => {
    editor.style.display = 'none';
    OferterState.selectedCatId = null;
  });
  editor.querySelector('#ofer-prod-search')?.addEventListener('input', e => {
    OferterState.productSearch = e.target.value;
    OferterState.productPage = 1;
    clearTimeout(window._oferSearchTimer);
    window._oferSearchTimer = setTimeout(() => loadCategoryEditor(), 350);
  });
  editor.querySelector('#ofer-prev-page')?.addEventListener('click', () => { OferterState.productPage--; loadCategoryEditor(); });
  editor.querySelector('#ofer-next-page')?.addEventListener('click', () => { OferterState.productPage++; loadCategoryEditor(); });
  editor.querySelectorAll('.ofer-prod-row[data-prod-id]').forEach(row => {
    row.addEventListener('click', () => {
      const prod = products.find(p => p.id === parseInt(row.dataset.prodId));
      if (prod) { OferterState.selectedProduct = prod; loadInlineEditor(prod, attrDefs); }
    });
  });
  editor.querySelectorAll('.ofer-del-attr').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Usunac atrybut? Wszystkie wartosci produktow zostana usuniete.')) return;
      await API.del(`/oferter/setup/attributes/${btn.dataset.id}`);
      loadCategoryEditor();
    });
  });
  editor.querySelector('#ofer-add-attr-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('ofer-new-attr-name')?.value?.trim();
    const type = document.getElementById('ofer-new-attr-type')?.value;
    const unit = document.getElementById('ofer-new-attr-unit')?.value?.trim();
    if (!name) return;
    await API.post(`/oferter/setup/attributes/${catId}`, { attr_name: name, attr_type: type, attr_unit: unit || null, is_filter: 1 });
    loadCategoryEditor();
  });

  if (OferterState.selectedProduct) loadInlineEditor(OferterState.selectedProduct, attrDefs);
}

// ─── INLINE ATTR EDITOR ───────────────────────────────────────────────────────
async function loadInlineEditor(product, attrDefs) {
  const panel = document.getElementById('ofer-inline-editor');
  if (!panel) return;

  let fullAttrs = [];
  try {
    const d = await API.get(`/oferter/product-attrs/${product.id}`);
    fullAttrs = d.attributes || [];
  } catch(e) {}

  const stockInfo = product.in_subiekt
    ? `<span class="ofer-badge green">🟢 Na magazynie: ${product.subiekt_stock||0} szt.</span>`
    : `<span class="ofer-badge gray">⚪ Brak w Subiekcie</span>`;

  const buyPrice = product.effective_buy_price ? `${Number(product.effective_buy_price).toFixed(2)} zl` : '—';
  const sellPrice = product.subiekt_sell_price ? `${Number(product.subiekt_sell_price).toFixed(2)} zl` : '—';

  panel.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
      <div style="font-size:.88rem;font-weight:700;color:var(--text-primary);margin-bottom:6px;">${product.name}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:4px;">
        ${stockInfo}
        <span class="ofer-badge gray">EAN: ${product.canonical_ean}</span>
      </div>
      <div style="font-size:.78rem;color:var(--text-muted);">
        Zakup: <strong>${buyPrice}</strong> &nbsp;|&nbsp; Sprzedaz Subiekt: <strong>${sellPrice}</strong>
      </div>
    </div>
    ${fullAttrs.length ? `
      <form id="ofer-attr-save-form">
        <div class="ofer-attr-form">
          ${fullAttrs.map(a => {
            const val = a.attr_type === 'numeric' ? (a.value_numeric ?? '') : (a.value_text || '');
            const supplierHint = (a.supplier_value && val === '')
              ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:3px; display:flex; align-items:center; gap:4px;">
                   <span style="opacity:0.6;">🏭 Hurtownia:</span>
                   <strong style="color:var(--accent); font-family:'JetBrains Mono',monospace;">${a.supplier_value}</strong>
                 </div>`
              : '';
            return `
              <div class="ofer-attr-field">
                <label class="ofer-attr-label">${a.attr_name}${a.attr_unit ? ` [${a.attr_unit}]` : ''}</label>
                <input class="ofer-attr-input ${val !== '' ? 'filled' : (a.supplier_value ? 'supplier-hinted' : '')}"
                  type="${a.attr_type==='numeric'?'number':'text'}"
                  name="attr_${a.attr_def_id}" value="${val}"
                  placeholder="${a.supplier_value || '—'}"
                  data-attr-id="${a.attr_def_id}" data-attr-type="${a.attr_type}">
                ${supplierHint}
              </div>
            `;
          }).join('')}
        </div>
        <div style="padding:0 20px 16px;display:flex;gap:8px;align-items:center;">
          <button type="submit" class="btn btn--primary btn--sm">💾 Zapisz atrybuty</button>
          <button type="button" class="btn btn--sm" style="background:var(--accent); color:#fff; border:none;" id="ofer-auto-extract-btn" data-prod-id="${product.id}">✨ Auto-Wypełnij (AI)</button>
          <div id="ofer-save-status" style="font-size:.8rem;align-self:center;"></div>
        </div>
      </form>
    ` : `<div class="ofer-empty"><p>Najpierw dodaj definicje atrybutow do kategorii</p></div>`}
  `;

  panel.querySelector('#ofer-auto-extract-btn')?.addEventListener('click', async e => {
    const btn = e.currentTarget;
    const prodId = btn.dataset.prodId;
    const origText = btn.textContent;
    btn.textContent = '⏳ Analizowanie (AI)...';
    btn.disabled = true;
    try {
      const res = await API.post(`/oferter/product-attrs/extract/${prodId}`);
      if (res.ok) {
        // Zreloaduj edytor by pokazać nowe dane
        loadInlineEditor(product, attrDefs);
      } else {
        alert('Błąd AI: ' + res.error);
      }
    } catch(err) {
      alert('Błąd połączenia z AI');
    } finally {
      if(btn) { btn.textContent = origText; btn.disabled = false; }
    }
  });

  panel.querySelector('#ofer-attr-save-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const inputs = panel.querySelectorAll('[data-attr-id]');
    const attributes = [];
    inputs.forEach(inp => {
      const id = parseInt(inp.dataset.attrId);
      const type = inp.dataset.attrType;
      const raw = inp.value.trim();
      if (type === 'numeric') {
        attributes.push({ attribute_id: id, value_numeric: raw !== '' ? parseFloat(raw) : null, value_text: null });
      } else {
        attributes.push({ attribute_id: id, value_text: raw || null, value_numeric: null });
      }
    });
    const status = panel.querySelector('#ofer-save-status');
    try {
      await API.post(`/oferter/product-attrs/${product.id}/bulk`, { attributes });
      if (status) { status.textContent = '✅ Zapisano'; setTimeout(() => { status.textContent = ''; }, 2000); }
      // Refresh coverage counts
      inputs.forEach(inp => { if (inp.value.trim()) inp.classList.add('filled'); else inp.classList.remove('filled'); });
    } catch(err) {
      if (status) status.textContent = '❌ Blad zapisu';
    }
  });
}

// ─── SEED ─────────────────────────────────────────────────────────────────────
async function runSeed() {
  const btn = document.getElementById('ofer-seed-btn');
  const status = document.getElementById('ofer-seed-status');
  if (!btn || !status) return;
  btn.disabled = true;
  btn.textContent = '⏳ Trwa seed...';
  status.textContent = '';
  try {
    const d = await API.post('/oferter/setup/seed-attributes', {});
    if (d.ok) {
      const extra = d.sync ? ` • cech z hurtowni: ${d.sync.filled}` : '';
      status.innerHTML = `<span style="color:#10b981">✅ Dodano ${d.totalAdded} atrybutów w ${d.seeded.length} kategoriach${extra}</span>`;
      setTimeout(() => loadAttrsTab(), 500);
    } else {
      status.innerHTML = `<span style="color:#f87171">❌ ${d.error}</span>`;
    }
  } catch(e) {
    status.innerHTML = `<span style="color:#f87171">❌ Blad polaczenia: ${e.message}</span>`;
  }
  btn.disabled = false;
  btn.textContent = 'Uruchom seed atrybutow';
}

async function runAttrSync() {
  const btn = document.getElementById('ofer-sync-attrs-btn');
  const status = document.getElementById('ofer-seed-status');
  if (!btn || !status) return;
  btn.disabled = true;
  btn.textContent = '⏳ Scalam cechy...';
  try {
    const d = await API.post('/oferter/setup/sync-attributes', {});
    if (d.ok) {
      status.innerHTML = `<span style="color:#10b981">✅ ${d.message || 'Cechy uzupełnione z hurtowni do katalogu Master'}</span>`;
      setTimeout(() => loadAttrsTab(), 500);
    } else {
      status.innerHTML = `<span style="color:#f87171">❌ ${d.error}</span>`;
    }
  } catch (e) {
    status.innerHTML = `<span style="color:#f87171">❌ ${e.message}</span>`;
  }
  btn.disabled = false;
  btn.textContent = 'Uzupełnij cechy z hurtowni';
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

window.initOferter = function() {
  renderOferter();
};

window.OferterView = { render() { renderOferter(); } };



const ConfigState = {
  budget: 5000,
  spent: 0,
  preferences: {
    purpose: 'gaming',
    budget: 5000,
    platform: 'any',
    cooler: 'any',
    rgb: 'any',
    caseFormat: 'any'
  },
  cart: {
    cpu: null,
    mb: null,
    cooler: null,
    ram: null,
    disk: [],
    gpu: null,
    psu: null,
    casePc: null,
    os: null,
    keyboard: null,
    mouse: null,
    headset: null,
    monitor: [],
    mousepad: [],
    speakers: [],
    webcam: [],
    microphone: [],
    monitor_mount: [],
    case_fan: [],
    accessories: [],
    services: []
  },
  activeStep: 1,
  steps: [
    { id: 1,  key: 'cpu',         label: '1. Procesor',          type: 'single', categoryIds: [3691], catName: 'Procesory',              catAlias: ['procesor'] },
    { id: 2,  key: 'mb',          label: '2. Płyta główna',       type: 'single', categoryIds: [3695, 3967, 3944, 3956, 3950], catName: null,           catAlias: ['płyty główne', 'mainboards', 'motherboards', 'płyta główna'] },
    { id: 3,  key: 'cooler',      label: '3. Chłodzenie',         type: 'single', categoryIds: [4131], catName: 'Wentylatory Do Procesorów',             catAlias: ['wentylatory do procesor', 'chłodzenie procesor', 'chłodzenie cpu', 'cpu cooler', 'kuhler', 'heatsink', 'chłodzenie wodne', 'chłodzenie aio'], catExclude: ['obudow', 'vga', 'wentylatory do obud'] },
    { id: 4,  key: 'ram',         label: '4. Pamięć RAM',         type: 'single', categoryIds: [4211, 4282], catName: null,            catAlias: ['pamięć ram', 'pamięci ram', 'moduł ram', 'moduły ram', 'dimm', 'so-dimm', 'pamięci do komputerów', 'arbeitsspeicher'], catExclude: ['masow', 'flash', 'pendrive', 'karta pamięci', 'czytnik', 'usb'] },
    { id: 5,  key: 'disk',        label: '5. Dyski',              type: 'multi',  categoryIds: [3947, 4448, 3981, 5157, 4248, 3975, 3740, 4267], catName: null,                     catAlias: ['dyski i akcesoria', 'dyski twarde wewnetrzne ssd', 'dyski twarde wewnetrzne hdd', 'dyski dyski ssd', 'zewnetrzny dysk ssd', 'dyski twarde zewnetrzne', 'dysk ssd', 'dysk hdd', 'nvme'], catExclude: ['obudow', 'kieszen', 'adapter'] },
    { id: 6,  key: 'gpu',         label: '6. Karta graficzna',    type: 'single', categoryIds: [3694, 3987], catName: null,        catAlias: ['karta graficzna', 'karty graficzne'] },
    { id: 7,  key: 'psu',         label: '7. Zasilacz',           type: 'single', categoryIds: [3758], catName: 'Zasilacze',              catAlias: ['zasilacz', 'zasilacze'] },
    { id: 8,  key: 'casePc',      label: '8. Obudowa',            type: 'single', categoryIds: [3697, 3960], catName: null,                catAlias: ['obudowy komputerowe', 'obudowy pc', 'obudowy do komputerow', 'pc case', 'gehause', 'obudow'], catExclude: ['dysk', 'hdd', 'ssd', 'nas', 'zewnetrz', 'wentylator', 'fan', 'vga'] },
    { id: 9,  key: 'os',          label: '9. System OS',          type: 'single', categoryIds: [3733], catName: 'Systemy operacyjne',     catAlias: ['systemy operacyjne', 'system operacyjny', 'operating system'] },
    { id: 10, key: 'accessories', label: '10. Akcesoria',         type: 'accessories' },
    { id: 11, key: 'services',    label: '11. Usługi',            type: 'services' }
  ],
  stepProducts: {}, // Cache of products per step
  compatibility: { messages: [], isValid: true }
};

const CART_ARRAY_KEYS = ['disk', 'monitor', 'mousepad', 'speakers', 'webcam', 'microphone', 'monitor_mount', 'case_fan', 'accessories', 'services'];

function emptyCart() {
  return {
    cpu: null, mb: null, cooler: null, ram: null, disk: [], gpu: null, psu: null, casePc: null, os: null,
    keyboard: null, mouse: null, headset: null,
    monitor: [], mousepad: [], speakers: [], webcam: [], microphone: [], monitor_mount: [], case_fan: [],
    accessories: [], services: []
  };
}

// Extends renderOferter
function initConfiguratorTab() {
  const pane = document.getElementById('ofer-pane-components');
  if (!pane) return;

  const editingBanner = ConfigState.editingQuoteId 
    ? `<div style="background:rgba(99,102,241,0.12); border:1px solid var(--accent); padding:10px 18px; border-radius:12px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; font-size:0.88rem;">` +
        `<span>✏️ Tryb edycji oferty: <strong>#${ConfigState.editingQuoteId}</strong></span>` +
        `<button class="btn btn--sm btn--danger" style="padding:4px 10px;" onclick="cancelQuoteEdit()">Anuluj edycję</button>` +
      `</div>`
    : '';

  pane.innerHTML = `
    ${editingBanner}
    <!-- Unified Budget & Settings Card (COMPACT VERSION) -->
    <div class="ofer-unified-card" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 6px 14px; margin-bottom: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
      <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap; justify-content: space-between;">
        
        <!-- Left Section: Inputs Inline -->
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          
          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 0.76rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; white-space: nowrap; margin-bottom: 0;">💰 Budżet:</label>
            <div style="position: relative; display: flex; align-items: center; width: 90px;">
              <input type="number" id="ofer-pref-budget" class="ofer-attr-input" value="${ConfigState.preferences.budget}" style="width: 100%; padding: 4px 6px; padding-right: 20px; font-weight: 600; font-size: 0.8rem;" oninput="updateBudgetPrefs()">
              <span style="position: absolute; right: 5px; font-size: 0.76rem; color: var(--text-muted); font-weight: 600; pointer-events: none;">zł</span>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 0.76rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; white-space: nowrap; margin-bottom: 0;">📈 Marża:</label>
            <div style="display: flex; width: 100px;">
              <input type="number" id="ofer-pref-margin" class="ofer-attr-input" value="${ConfigState.preferences.marginValue ?? 300}" style="flex: 1; min-width: 0; padding: 4px 6px; border-top-right-radius: 0; border-bottom-right-radius: 0; border-right: none; font-weight: 600; font-size: 0.8rem;" oninput="updateBudgetPrefs()">
              <select id="ofer-pref-margin-type" class="ofer-attr-input" style="width: 38px; padding: 4px 2px; border-top-left-radius: 0; border-bottom-left-radius: 0; background-color: var(--bg-elevated); font-weight: 600; font-size: 0.8rem;" onchange="updateBudgetPrefs()">
                <option value="pln" ${(ConfigState.preferences.marginType || 'pln')==='pln'?'selected':''}>zł</option>
                <option value="pct" ${(ConfigState.preferences.marginType || 'pln')==='pct'?'selected':''}>%</option>
              </select>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 6px;">
            <label style="font-size: 0.76rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; white-space: nowrap; margin-bottom: 0;">🎯 Cel:</label>
            <select id="ofer-pref-purpose" class="ofer-attr-input" style="padding: 4px 6px; font-weight: 600; font-size: 0.8rem; width: 100px;" onchange="updateBudgetPrefs()">
              <option value="gaming" ${ConfigState.preferences.purpose==='gaming'?'selected':''}>🎮 Gaming</option>
              <option value="office" ${ConfigState.preferences.purpose==='office'?'selected':''}>💼 Biurowy</option>
              <option value="workstation" ${ConfigState.preferences.purpose==='workstation'?'selected':''}>🚀 Stacja</option>
            </select>
          </div>
          
        </div>
        
        <!-- Right Section: Stats Inline & Progress -->
        <div style="display: flex; gap: 14px; align-items: center; padding: 4px 10px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 6px; flex-wrap: wrap;">
          <div style="font-size: 0.78rem; color: var(--text-muted);">
            Budżet: <strong id="ofer-budget-val" style="color: var(--text-primary); font-family: 'JetBrains Mono', monospace; font-size: 0.82rem;">0.00 zł</strong>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">
            Wydano: <strong id="ofer-spent-val" style="color: var(--accent); font-family: 'JetBrains Mono', monospace; font-size: 0.82rem;">0.00 zł</strong>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-muted); border-left: 1px solid var(--border); padding-left: 10px;">
            Zostało: <strong id="ofer-rem-val" style="font-family: 'JetBrains Mono', monospace; font-size: 0.84rem;">0.00 zł</strong>
          </div>
          <!-- Inline Progress Bar -->
          <div style="display: flex; align-items: center; gap: 6px; border-left: 1px solid var(--border); padding-left: 10px;">
            <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Postęp:</span>
            <div class="ofer-progress-track" style="width: 80px; height: 5px; background: var(--bg-elevated); border-radius: 3px; overflow: hidden; border: 1px solid var(--border); margin-bottom: 0;">
              <div class="ofer-progress-fill" id="ofer-budget-bar" style="width: 0%; height: 100%; border-radius: 3px; transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.4s;"></div>
            </div>
            <span id="ofer-budget-percent" style="font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; font-weight: 700; color: var(--text-primary); min-width: 28px; text-align: right;">0%</span>
          </div>
        </div>
        
      </div>
    </div>

    <!-- Compatibility Warnings -->
    <div id="ofer-compat-warnings" class="ofer-compat-warnings"></div>

    <div class="ofer-split">
      <!-- Left: Accordion Steps -->
      <div class="ofer-split-left">
        <div class="ofer-accordion" id="ofer-accordion">
          <!-- Rendered dynamically -->
        </div>
      </div>

      <!-- Right: Step Content (Products / Preferences) -->
      <div class="ofer-split-right" id="ofer-step-content" style="padding: 16px;">
        <!-- Rendered dynamically -->
      </div>
    </div>
  `;

  window.updateBudgetPrefs = function() {
    const el = document.getElementById('ofer-pref-budget');
    if (el) {
      ConfigState.preferences.budget = parseFloat(el.value) || 0;
      updateBudget();
    }
    const purp = document.getElementById('ofer-pref-purpose');
    if (purp) ConfigState.preferences.purpose = purp.value;

    const marginEl = document.getElementById('ofer-pref-margin');
    const marginTypeEl = document.getElementById('ofer-pref-margin-type');
    if (marginEl) ConfigState.preferences.marginValue = parseFloat(marginEl.value) || 0;
    if (marginTypeEl) ConfigState.preferences.marginType = marginTypeEl.value;
  };

  /* ─── Global Attribute Filters Customizer Helpers ────────────────────── */
  window.toggleManageFiltersPanel = function() {
    const panel = document.getElementById('ofer-filters-setup-panel');
    const btn = document.getElementById('ofer-manage-filters-btn');
    if (!panel) return;
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      if (btn) btn.classList.add('active');
    } else {
      panel.style.display = 'none';
      if (btn) btn.classList.remove('active');
    }
  };

  window.filterAttrCheckboxesList = function() {
    const query = (document.getElementById('ofer-filter-attr-search')?.value || '').toLowerCase().trim();
    const items = document.querySelectorAll('.ofer-filter-attr-item');
    items.forEach(item => {
      const attrName = item.dataset.attrName?.toLowerCase() || '';
      if (!query || attrName.includes(query)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  };

  window.toggleFilterPreference = function(catId, attrName, isChecked) {
    const storageKey = `oferter_enabled_filters_${catId}`;
    let enabledFilters = [];
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        enabledFilters = JSON.parse(saved);
      } catch (e) {
        enabledFilters = [];
      }
    } else {
      enabledFilters = ConfigState._defaultFilters || [];
    }

    if (isChecked) {
      if (!enabledFilters.includes(attrName)) enabledFilters.push(attrName);
    } else {
      enabledFilters = enabledFilters.filter(name => name !== attrName);
    }

    localStorage.setItem(storageKey, JSON.stringify(enabledFilters));
    loadStepContent();
    
    // Keep panel open after rendering
    setTimeout(() => {
      const panel = document.getElementById('ofer-filters-setup-panel');
      const btn = document.getElementById('ofer-manage-filters-btn');
      if (panel) panel.style.display = 'block';
      if (btn) btn.classList.add('active');
    }, 50);
  };

  window.resetFiltersToDefault = function(catId) {
    localStorage.removeItem(`oferter_enabled_filters_${catId}`);
    loadStepContent();
    setTimeout(() => {
      const panel = document.getElementById('ofer-filters-setup-panel');
      const btn = document.getElementById('ofer-manage-filters-btn');
      if (panel) panel.style.display = 'block';
      if (btn) btn.classList.add('active');
    }, 50);
  };

  window.selectAllFilters = function(catId, allAttrs) {
    localStorage.setItem(`oferter_enabled_filters_${catId}`, JSON.stringify(allAttrs));
    loadStepContent();
    setTimeout(() => {
      const panel = document.getElementById('ofer-filters-setup-panel');
      const btn = document.getElementById('ofer-manage-filters-btn');
      if (panel) panel.style.display = 'block';
      if (btn) btn.classList.add('active');
    }, 50);
  };

  window.clearAllFilters = function(catId) {
    localStorage.setItem(`oferter_enabled_filters_${catId}`, JSON.stringify([]));
    loadStepContent();
    setTimeout(() => {
      const panel = document.getElementById('ofer-filters-setup-panel');
      const btn = document.getElementById('ofer-manage-filters-btn');
      if (panel) panel.style.display = 'block';
      if (btn) btn.classList.add('active');
    }, 50);
  };

  window.cancelQuoteEdit = function() {
    delete ConfigState.editingQuoteId;
    delete ConfigState._loadedClientName;
    delete ConfigState._loadedClientEmail;
    delete ConfigState._loadedNotesClient;
    delete ConfigState._loadedNotesInternal;
    ConfigState.stepProducts = {};
    ConfigState.cart = emptyCart();
    ConfigState.preferences = {
      purpose: 'gaming',
      budget: 5000,
      platform: 'any',
      cooler: 'any',
      rgb: 'any',
      caseFormat: 'any'
    };
    updateBudget();
    checkCompatibility();
    initConfiguratorTab();
    Toast.success('Edycja anulowana.');
  };

  renderAccordion();
  loadStepContent();
}

function updateBudget() {
  let spent = 0;
  Object.values(ConfigState.cart).forEach(item => {
    if (Array.isArray(item)) {
      item.forEach(i => spent += (i.effective_buy_price || i.price || 0));
    } else if (item) {
      spent += (item.effective_buy_price || item.price || 0);
    }
  });
  ConfigState.spent = spent;
  
  const b = ConfigState.preferences.budget || ConfigState.budget;
  const rem = b - spent;
  const pct = Math.min(100, Math.max(0, (spent / b) * 100));
  
  const elSpent = document.getElementById('ofer-spent-val');
  const elRem = document.getElementById('ofer-rem-val');
  const elBar = document.getElementById('ofer-budget-bar');
  const elBudget = document.getElementById('ofer-budget-val');
  
  if (elBudget) elBudget.textContent = b.toFixed(2) + ' zł';
  if (elSpent) elSpent.textContent = spent.toFixed(2) + ' zł';
  if (elRem) {
    elRem.textContent = rem.toFixed(2) + ' zł';
    elRem.style.color = rem < 0 ? '#f87171' : '';
  }
  if (elBar) {
    elBar.style.width = pct + '%';
    elBar.style.background = rem < 0 ? '#f87171' : 'var(--accent-gradient)';
  }
  const elPct = document.getElementById('ofer-budget-percent');
  if (elPct) elPct.textContent = pct.toFixed(0) + '%';

  renderAccordion(); // Update labels (prices)
}

async function checkCompatibility() {
  const ids = [];
  Object.entries(ConfigState.cart).forEach(([key, item]) => {
    if (key === 'services') return;
    if (Array.isArray(item)) item.forEach(i => i && i.id && ids.push(i.id));
    else if (item && item.id) ids.push(item.id);
  });

  if (ids.length === 0) {
    ConfigState.compatibility = { messages: [], isValid: true };
    renderCompatWarnings();
    return;
  }

  try {
    const res = await API.post('/oferter/compatibility', { components: ids });
    if (res.ok) {
      ConfigState.compatibility = res;
      renderCompatWarnings();
    }
  } catch(e) {
    console.error('Compat check error', e);
  }
}

function renderCompatWarnings() {
  const wrn = document.getElementById('ofer-compat-warnings');
  if (!wrn) return;
  const msgs = ConfigState.compatibility.messages || [];
  if (msgs.length === 0) {
    wrn.style.display = 'none';
    wrn.innerHTML = '';
    return;
  }
  wrn.style.display = 'block';
  wrn.innerHTML = msgs.map(m => `
    <div style="padding:10px 14px; margin-bottom:8px; border-radius:8px; display:flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:600; 
      ${m.type==='error'?'background:rgba(248,113,113,0.1); color:#f87171; border:1px solid rgba(248,113,113,0.3);':'background:rgba(245,158,11,0.1); color:#f59e0b; border:1px solid rgba(245,158,11,0.3);'}">
      <span>${m.type==='error'?'❌':'⚠️'}</span> ${m.text}
    </div>
  `).join('');
}

function renderAccordion() {
  const acc = document.getElementById('ofer-accordion');
  if (!acc) return;
  acc.innerHTML = ConfigState.steps.map(step => {
    let selectedText = 'Wybierz...';
    let priceText = '';
    const val = ConfigState.cart[step.key];
    
    if (step.type === 'single' && val) {
      selectedText = val.name;
      priceText = (val.effective_buy_price || 0).toFixed(2) + ' zł';
    } else if (step.type === 'multi' && val && val.length > 0) {
      selectedText = val.length + ' szt.';
      const sum = val.reduce((s,i) => s + (i.effective_buy_price || 0), 0);
      priceText = sum.toFixed(2) + ' zł';
    } else if (step.type === 'accessories') {
      // Collect all chosen accessory items across sub-keys
      const accItems = [
        ...(ConfigState.cart.keyboard   ? [ConfigState.cart.keyboard]  : []),
        ...(ConfigState.cart.mouse      ? [ConfigState.cart.mouse]     : []),
        ...(ConfigState.cart.headset    ? [ConfigState.cart.headset]   : []),
        ...(ConfigState.cart.monitor    || []),
        ...(ConfigState.cart.mousepad   || []),
        ...(ConfigState.cart.speakers   || []),
        ...(ConfigState.cart.webcam     || []),
        ...(ConfigState.cart.microphone || []),
        ...(ConfigState.cart.monitor_mount || []),
        ...(ConfigState.cart.case_fan   || []),
        ...(ConfigState.cart.accessories || [])
      ];
      if (accItems.length > 0) {
        selectedText = accItems.length + ' szt.';
        const sum = accItems.reduce((s,i) => s + (i.effective_buy_price || 0), 0);
        priceText = sum.toFixed(2) + ' zł';
      }
    } else if (step.type === 'services' && val && val.length > 0) {
      selectedText = val.length + ' usług';
      const sum = val.reduce((s,i) => s + (i.price || 0), 0);
      priceText = sum.toFixed(2) + ' zł';
    }

    const accItems = step.type === 'accessories' ? [
      ...(ConfigState.cart.keyboard   ? [ConfigState.cart.keyboard]  : []),
      ...(ConfigState.cart.mouse      ? [ConfigState.cart.mouse]     : []),
      ...(ConfigState.cart.headset    ? [ConfigState.cart.headset]   : []),
      ...(ConfigState.cart.monitor    || []),
      ...(ConfigState.cart.mousepad   || []),
      ...(ConfigState.cart.speakers   || []),
      ...(ConfigState.cart.webcam     || []),
      ...(ConfigState.cart.microphone || []),
      ...(ConfigState.cart.monitor_mount || []),
      ...(ConfigState.cart.case_fan   || []),
      ...(ConfigState.cart.accessories || [])
    ] : null;
    const isCompleted = step.type === 'accessories'
      ? (accItems && accItems.length > 0)
      : (Array.isArray(val) ? val.length > 0 : !!val);
    return `
      <div class="ofer-step ${ConfigState.activeStep === step.id ? 'active' : ''} ${isCompleted ? 'completed' : ''}" data-id="${step.id}">
        <div class="ofer-step-header" onclick="ConfigState.activeStep = ${step.id}; renderAccordion(); loadStepContent();">
          <div class="ofer-step-num">${isCompleted ? '✓' : step.id}</div>
          <div class="ofer-step-title">
            <strong>${step.label}</strong>
            <span class="ofer-step-sel">${selectedText}</span>
          </div>
          <div class="ofer-step-price">${priceText}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function loadStepContent() {
  const right = document.getElementById('ofer-step-content');
  if (!right) return;
  const step = ConfigState.steps.find(s => s.id === ConfigState.activeStep);
  if (!step) return;

  // Reset category-specific state on step change
  ConfigState._catAttrDefs = [];

  const clearBtn = (Array.isArray(ConfigState.cart[step.key]) ? ConfigState.cart[step.key].length > 0 : !!ConfigState.cart[step.key]) ?
    `<button class="btn btn--sm btn--ghost" style="padding:4px 8px; font-size:0.75rem;" onclick="clearStep('${step.key}')"> Wyczyść wybór</button>` : '';

  if (step.type === 'services') {
    right.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:12px;">
        <h3 style="margin:0; font-size:0.98rem; font-weight:700; display:flex; align-items:center; gap:6px;">🛠️ ${step.label}</h3>
        ${clearBtn}
      </div>
      <div id="ofer-step-services">Ładowanie...</div>
    `;
  } else if (step.type === 'accessories') {
    right.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:12px;">
        <h3 style="margin:0; font-size:0.98rem; font-weight:700; display:flex; align-items:center; gap:6px;">🖱️ ${step.label}</h3>
      </div>
      <div id="ofer-step-accessories">Ładowanie...</div>
    `;
  } else {
    right.innerHTML = `
      <div class="ofer-toolbar" style="margin-bottom:10px; padding:6px 12px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; background:var(--bg-card); border:1px solid var(--border); border-radius:10px;">
        <!-- Left side: Icon + Title -->
        <div style="display:flex; align-items:center; gap:8px;">
          <h3 style="margin:0; font-size:0.95rem; font-weight:700; white-space:nowrap;">${step.label}</h3>
          ${clearBtn}
        </div>
        
        <!-- Middle / Right: Unified inputs and checkboxes -->
        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:10px;">
          <!-- Search Input -->
          <input type="text" class="ofer-search" id="ofer-step-search" placeholder="Szukaj..." style="width:160px; padding:4px 8px; font-size:0.8rem; margin:0;">
          
          <!-- Supplier Select -->
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; white-space:nowrap;">Hurtownia:</span>
            <select class="ofer-input" id="ofer-supplier-filter" style="padding:4px 8px; font-size:0.8rem; width:120px; margin:0; height:28px;">
              <option value="">Wszystkie</option>
            </select>
          </div>
          
          <!-- Checkboxes -->
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <label style="margin-bottom:0; font-size:0.75rem; display:flex; align-items:center; gap:4px; cursor:pointer; font-weight:500;">
              <input type="checkbox" id="ofer-step-compat-filter" checked style="margin:0;"> Pasujące
            </label>
            <label style="margin-bottom:0; font-size:0.75rem; display:flex; align-items:center; gap:4px; cursor:pointer; font-weight:500;">
              <input type="checkbox" id="ofer-step-stock-filter" checked style="margin:0;"> Ze stanem
            </label>
          </div>
        </div>
      </div>
      
      <div id="ofer-step-dynamic-filters" style="display:none;"></div>
      <div id="ofer-filters-setup-panel" style="display:none;"></div>
      <div id="ofer-step-list" style="overflow-x:auto;">Ładowanie produktów...</div>
    `;
  }

  if (step.type === 'services') {
    loadServicesForStep();
  } else if (step.type === 'accessories') {
    loadAccessoriesForStep();
  } else {
    // 1. Resolve category IDs from catalog Master (name/alias), hardcoded ShopGold IDs only as extra hits
    let catId = null;
    let categoryIds = [];
    try {
      const catsData = await API.get('/oferter/setup/categories');
      const cats = catsData.categories || [];
      const scoreCat = (c) => scoreStepCategory(c, step);
      const matched = cats.filter(c => scoreCat(c) > 0).sort((a, b) => scoreCat(b) - scoreCat(a));
      categoryIds = matched.map(c => c.id);
      if (step.key === 'cooler' || step.key === 'ram' || step.key === 'os' || step.key === 'casePc') {
        categoryIds = matched.filter(c => scoreCat(c) >= 5).map(c => c.id);
      }
      catId = categoryIds[0] || null;
    } catch (e) {
      categoryIds = step.categoryIds || [];
      catId = categoryIds[0] || null;
    }

    if (!catId) {
      const aliasLabel = step.catName || (Array.isArray(step.catAlias) ? step.catAlias.slice(0, 3).join(', ') : step.catAlias) || step.label;
      document.getElementById('ofer-step-list').innerHTML = `<div class="ofer-empty">Nie znaleziono kategorii dla '${aliasLabel}'</div>`;
      return;
    }

    // Save active category ID in ConfigState to fix product list sorting
    ConfigState._activeCatId = catId;

    // 2. Fetch products (all products for the category)
    try {
      if (!ConfigState.stepProducts[catId]) {
        let mergedProducts = [];
        const seenIds = new Set();
        for (const cid of categoryIds) {
          try {
            const p = await API.get(`/oferter/components/${cid}?limit=9999`);
            const prods = p.products || [];
            prods.forEach(prod => {
              if (!seenIds.has(prod.id)) {
                seenIds.add(prod.id);
                mergedProducts.push(prod);
              }
            });
          } catch(e) {
            console.error(`Error fetching products for category ${cid}:`, e);
          }
        }
        ConfigState.stepProducts[catId] = mergedProducts;
      }

      // Populate supplier filter dropdown
      const supplierSelect = document.getElementById('ofer-supplier-filter');
      if (supplierSelect) {
        const supplierNames = new Set();
        ConfigState.stepProducts[catId].forEach(p => {
          (p.suppliers || []).forEach(s => supplierNames.add(s.supplier_name));
        });
        supplierNames.forEach(name => {
          const opt = document.createElement('option');
          opt.value = name; opt.textContent = name;
          supplierSelect.appendChild(opt);
        });
      }

      // Fetch configured attribute definitions (for type info)
      let attrDefs = [];
      const seenAttrNames = new Set();
      for (const cid of categoryIds) {
        try {
          const d = await API.get(`/oferter/setup/attributes/${cid}`);
          const attrs = d.attributes || [];
          attrs.forEach(a => {
            if (!seenAttrNames.has(a.attr_name)) {
              seenAttrNames.add(a.attr_name);
              attrDefs.push(a);
            }
          });
        } catch(e) {}
      }
      const attrDefMap = {}; // attr_name -> {attr_type, attr_unit}
      attrDefs.forEach(a => { attrDefMap[a.attr_name] = a; });
      const mappedAttrNames = new Set(attrDefs.map(a => a.attr_name));

      // Count how many products have each attribute (popularity score)
      const attrPopularity = {}; // attr_name -> count of products with value
      ConfigState.stepProducts[catId].forEach(p => {
        const seen = new Set();
        (p.attributes || []).forEach(a => {
          if (!seen.has(a.attr_name)) {
            seen.add(a.attr_name);
            attrPopularity[a.attr_name] = (attrPopularity[a.attr_name] || 0) + 1;
          }
        });
      });

      // Sort attrs: configured (mapped) first, then by popularity; take top 8 as default
      const defaultFilters = Object.entries(attrPopularity)
        .sort(([nameA, cntA], [nameB, cntB]) => {
          const aMapped = mappedAttrNames.has(nameA) ? 1 : 0;
          const bMapped = mappedAttrNames.has(nameB) ? 1 : 0;
          if (aMapped !== bMapped) return bMapped - aMapped; // mapped first
          return cntB - cntA; // then by popularity
        })
        .slice(0, 8) // max 8 filtrów domyślnych
        .map(([name]) => name);

      ConfigState._defaultFilters = defaultFilters;

      // Resolve user's customized filter preference from localStorage
      const storageKey = `oferter_enabled_filters_${catId}`;
      let activeFilters = [];
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          activeFilters = Array.isArray(parsed) ? parsed : defaultFilters;
        } catch (e) {
          activeFilters = defaultFilters;
        }
      } else {
        activeFilters = defaultFilters;
      }

      // Build dynamic filter dropdowns only for active filters
      const filterParts = [];
      for (const attrName of activeFilters) {
        const vals = new Set();
        ConfigState.stepProducts[catId].forEach(p => {
          const v = getAttrVal(p, attrName);
          if (v !== null && v !== undefined && v !== '') vals.add(String(v));
        });
        if (vals.size < 1) continue;
        if (vals.size < 2 && !mappedAttrNames.has(attrName) && (attrPopularity[attrName] || 0) < 3) continue;
        const def = attrDefMap[attrName] || { attr_type: 'text', attr_unit: null };
        const isNum = def.attr_type === 'numeric';
        const sorted = Array.from(vals).sort((x, y) => isNum ? parseFloat(x) - parseFloat(y) : x.toString().localeCompare(y.toString(), 'pl'));
        const unit = def.attr_unit ? ` ${def.attr_unit}` : '';
        const opts = sorted.map(v => `<option value="${v}">${v}${unit}</option>`).join('');
        filterParts.push(`
          <div class="ofer-dyn-filter-group">
            <label class="ofer-dyn-filter-label">🔷 ${attrName}${unit ? ` [${def.attr_unit}]` : ''}</label>
            <select class="ofer-input ofer-dynamic-filter" data-attr-name="${attrName}" title="Filtruj po ${attrName}">
              <option value="">Wszystkie</option>
              ${opts}
            </select>
          </div>
        `);
      }
      const filterHtml = filterParts.join('');

      const dynamicFiltersBar = document.getElementById('ofer-step-dynamic-filters');
      if (dynamicFiltersBar) {
        const hasFilters = filterHtml.trim().length > 0;
        dynamicFiltersBar.innerHTML = hasFilters
          ? `<div class="ofer-dyn-filter-header">🎛️ Filtry cech:</div>
             ${filterHtml}
             <button class="btn btn--sm btn--ghost" id="ofer-manage-filters-btn" style="margin-left: auto; padding: 4px 8px; font-size: 0.72rem; display: flex; align-items: center; gap: 4px; border: 1px solid var(--border);" onclick="window.toggleManageFiltersPanel()"><span style="font-size:0.85rem">⚙️</span> Dostosuj filtry</button>`
          : `<div class="ofer-dyn-filter-header" style="border-right: none;">🎛️ Brak aktywnych filtrów cech.</div>
             <button class="btn btn--sm btn--ghost" id="ofer-manage-filters-btn" style="margin-left: auto; padding: 4px 8px; font-size: 0.72rem; display: flex; align-items: center; gap: 4px; border: 1px solid var(--border);" onclick="window.toggleManageFiltersPanel()"><span style="font-size:0.85rem">⚙️</span> Dostosuj filtry</button>`;
        dynamicFiltersBar.style.display = 'flex';
      }

      // Build checklist of all unique attributes in configuration panel
      const allUniqueAttrNames = Object.keys(attrPopularity).sort((a, b) => a.localeCompare(b, 'pl'));
      let checkboxesHtml = '';
      allUniqueAttrNames.forEach(attrName => {
        const isChecked = activeFilters.includes(attrName);
        const activeClass = isChecked ? 'active' : '';
        const checkedAttr = isChecked ? 'checked' : '';
        const escName = attrName.replace(/'/g, "\\'");
        checkboxesHtml += `
          <label class="ofer-filter-attr-item ${activeClass}" data-attr-name="${attrName}">
            <input type="checkbox" ${checkedAttr} onchange="window.toggleFilterPreference(${catId}, '${escName}', this.checked)">
            <span>${attrName}</span>
          </label>
        `;
      });

      const filtersSetupPanel = document.getElementById('ofer-filters-setup-panel');
      if (filtersSetupPanel) {
        filtersSetupPanel.innerHTML = `
          <div class="ofer-filters-setup-header">
            <div class="ofer-filters-setup-title">⚙️ Dostosuj widoczne filtry cech</div>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <input type="text" class="ofer-search" id="ofer-filter-attr-search" placeholder="Szukaj cechy..." style="max-width:180px; padding:4px 8px; font-size:0.75rem; margin:0;" oninput="window.filterAttrCheckboxesList()">
              <div class="ofer-filters-setup-actions">
                <button class="ofer-filters-setup-btn" onclick="window.resetFiltersToDefault(${catId})">Domyślne</button>
                <button class="ofer-filters-setup-btn" onclick="window.selectAllFilters(${catId}, ${JSON.stringify(allUniqueAttrNames).replace(/"/g, '&quot;')})">Zaznacz wszystkie</button>
                <button class="ofer-filters-setup-btn" onclick="window.clearAllFilters(${catId})">Wyczyść</button>
              </div>
            </div>
          </div>
          <div class="ofer-filter-attr-list">
            ${checkboxesHtml}
          </div>
        `;
      }

      // Store attrDefs for use in table rendering
      ConfigState._catAttrDefs = attrDefs;

      // Initialise sort state for this step
      ConfigState.sortCol = 'name';
      ConfigState.sortDir = 1;

      renderStepProductsList(ConfigState.stepProducts[catId], step);

      // Attach all filter/search listeners
      const rerender = () => renderStepProductsList(ConfigState.stepProducts[catId], step, document.getElementById('ofer-step-search')?.value || '');
      document.getElementById('ofer-step-search')?.addEventListener('input', rerender);
      document.getElementById('ofer-step-compat-filter')?.addEventListener('change', rerender);
      document.getElementById('ofer-step-stock-filter')?.addEventListener('change', rerender);
      document.getElementById('ofer-supplier-filter')?.addEventListener('change', rerender);
      dynamicFiltersBar?.querySelectorAll('select').forEach(sel => sel.addEventListener('change', rerender));

    } catch(e) {
      console.error(e);
      document.getElementById('ofer-step-list').innerHTML = `<div class="ofer-empty">Błąd ładowania produktów: ${e.message}</div>`;
    }
  }
}

function sortStep(col) {
  if (ConfigState.sortCol === col) { ConfigState.sortDir *= -1; }
  else { ConfigState.sortCol = col; ConfigState.sortDir = 1; }
  const step = ConfigState.steps.find(s => s.id === ConfigState.activeStep);
  const catId = ConfigState._activeCatId;
  if (step && catId) renderStepProductsList(ConfigState.stepProducts[catId], step, document.getElementById('ofer-step-search')?.value || '');
}
window.sortStep = sortStep;

function renderStepProductsList(products, step, query = '') {
  const container = document.getElementById('ofer-step-list');
  if (!container) return;

  const onlyCompat = document.getElementById('ofer-step-compat-filter')?.checked || false;
  const onlyStock = document.getElementById('ofer-step-stock-filter')?.checked ?? true;
  const supplierFilter = document.getElementById('ofer-supplier-filter')?.value || '';
  const norm = (s) => (s||'').toString().toLowerCase().trim();
  const q = norm(query);

  const activeAttrFilters = [];
  document.querySelectorAll('.ofer-dynamic-filter').forEach(f => {
    if (f.value) activeAttrFilters.push({ name: f.dataset.attrName, value: f.value });
  });

  let filtered = products.filter(p => {
    if (q && !norm(p.name).includes(q) && !norm(p.manufacturer).includes(q)) return false;
    if (supplierFilter && !(p.suppliers || []).some(s => s.supplier_name === supplierFilter)) return false;
    if (onlyStock) {
      const s1 = p.subiekt_stock || 0;
      const s2 = p.supplier_stock || 0;
      if (s1 <= 0 && s2 <= 0) return false;
    }
    for (const f of activeAttrFilters) {
      const v = getAttrVal(p, f.name);
      if (!v || v.toString() !== f.value) return false;
    }
    return true;
  });

  // Compatibility filter
  if (onlyCompat) {
    const cpu = ConfigState.cart.cpu;
    const mb = ConfigState.cart.mb;
    const compactTok = (s) => foldAttrName(s).replace(/[\s\-_]/g, '');
    const sockOk = (hay, needle) => {
      const cpuN = compactTok(needle);
      if (!cpuN) return true;
      const parts = String(hay || '').split(/[,;/|+]| i /i).map(compactTok).filter(Boolean);
      const pool = parts.length ? parts : [compactTok(hay)].filter(Boolean);
      return pool.some(p => p === cpuN || p.includes(cpuN) || cpuN.includes(p));
    };
    const ramOk = (mbType, ramType) => {
      const a = compactTok(mbType), b = compactTok(ramType);
      if (!a || !b) return true;
      const gen = (s) => (s.match(/ddr[0-9]/) || [null])[0];
      if (gen(a) && gen(b)) return gen(a) === gen(b);
      return a.includes(b) || b.includes(a);
    };
    const FORM_RANK_FE = [['eeatx',6],['extendedatx',6],['eatx',6],['microatx',3],['matx',3],['miniitx',2],['itx',2],['ministx',1],['atx',4]];
    const formRk = (s) => {
      const n = compactTok(s);
      let best = null;
      for (const [k, v] of FORM_RANK_FE) {
        if (n.includes(k) && (!best || k.length > best.key.length)) best = { key: k, v };
      }
      return best ? best.v : null;
    };
    if (step.key === 'mb' && cpu) {
      const cpuSocket = getAttrVal(cpu, 'Socket');
      if (cpuSocket) filtered = filtered.filter(p => {
        const s = getAttrVal(p, 'Socket');
        return !s || sockOk(s, cpuSocket);
      });
    } else if (step.key === 'ram' && mb) {
      const mbRam = getAttrVal(mb, 'Typ pamięci RAM') || getAttrVal(mb, 'Typ');
      if (mbRam) filtered = filtered.filter(p => {
        const t = getAttrVal(p, 'Typ') || getAttrVal(p, 'Typ pamięci RAM');
        return !t || ramOk(mbRam, t);
      });
    } else if (step.key === 'cooler' && cpu) {
      const cpuSocket = getAttrVal(cpu, 'Socket');
      if (cpuSocket) filtered = filtered.filter(p => {
        const s = getAttrVal(p, 'Socket') || getAttrVal(p, 'Kompatybilne sockety');
        return !s || sockOk(s, cpuSocket);
      });
    } else if (step.key === 'casePc' && mb) {
      const mbFormat = getAttrVal(mb, 'Format') || getAttrVal(mb, 'Format płyty');
      if (mbFormat) filtered = filtered.filter(p => {
        const f = getAttrVal(p, 'Format płyty') || getAttrVal(p, 'Format');
        if (!f) return true;
        const cr = formRk(f), mr = formRk(mbFormat);
        if (cr != null && mr != null) return mr <= cr;
        return true;
      });
    }
  }

  // Sorting
  const col = ConfigState.sortCol || 'name';
  const dir = ConfigState.sortDir || 1;
  const getBestPrice = p => {
    const ws = (p.suppliers || []).filter(s => (s.stock_quantity ?? 0) > 0).sort((a,b) => (a.price_pln||0)-(b.price_pln||0));
    return ws[0] ? (ws[0].price_pln || 0) : (p.effective_buy_price || 0);
  };
  const getTotalStock = p => (p.suppliers || []).reduce((sum,s) => sum + (s.stock_quantity ?? 0), 0);
  filtered.sort((a, b) => {
    let av, bv;
    if (col === 'price') { av = getBestPrice(a); bv = getBestPrice(b); }
    else if (col === 'stock') { av = getTotalStock(a); bv = getTotalStock(b); }
    else if (col === 'supplier') { av = (a.suppliers || []).filter(s=>(s.stock_quantity??0)>0).sort((x,y)=>(x.price_pln||0)-(y.price_pln||0))[0]?.supplier_name || ''; bv = (b.suppliers || []).filter(s=>(s.stock_quantity??0)>0).sort((x,y)=>(x.price_pln||0)-(y.price_pln||0))[0]?.supplier_name || ''; }
    else { av = norm(a.name); bv = norm(b.name); }
    return av < bv ? -dir : av > bv ? dir : 0;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="ofer-empty">Brak produktów spełniających kryteria.</div>`;
    return;
  }

  // Determine which attr columns to show in table (max 5, those with data)
  const catAttrDefs = (ConfigState._catAttrDefs || []);
  const attrColDefs = catAttrDefs.filter(a => {
    return filtered.some(p => {
      const v = getAttrVal(p, a.attr_name);
      return v !== null && v !== undefined && v !== '';
    });
  }).slice(0, 5);

  const sortIcon = (c) => col === c ? (dir === 1 ? ' ▲' : ' ▼') : ' ⇅';

  // Dynamic attr column headers — shorten long names (strip category prefix, cap length)
  function shortenAttrName(name) {
    // Strip category prefix like "Pamięć / " or "MOC / "
    const slashIdx = name.indexOf(' / ');
    let short = slashIdx >= 0 ? name.slice(slashIdx + 3) : name;
    // Cap at 20 chars
    if (short.length > 20) short = short.slice(0, 18) + '…';
    return short;
  }
  const attrHeaders = attrColDefs.map(a => {
    const short = shortenAttrName(a.attr_name);
    const label = short + (a.attr_unit ? ` [${a.attr_unit}]` : '');
    return `<th style="white-space:nowrap;font-size:0.72rem;color:var(--accent);max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${a.attr_name}${a.attr_unit ? ' ['+a.attr_unit+']' : ''}">${label}</th>`;
  }).join('');

  let html = `
    <table class="ofer-comp-table">
      <thead>
        <tr>
          <th class="ofer-sortable" onclick="sortStep('name')">Produkt${sortIcon('name')}</th>
          ${attrHeaders}
          ${attrColDefs.length === 0 ? '<th>Atrybuty</th>' : ''}
          <th class="ofer-sortable" onclick="sortStep('supplier')" style="min-width: 260px;">Hurtownia${sortIcon('supplier')}</th>
          <th class="ofer-sortable" onclick="sortStep('stock')">Stan${sortIcon('stock')}</th>
          <th class="ofer-sortable" onclick="sortStep('price')">Cena${sortIcon('price')}</th>
          <th>Akcja</th>
        </tr>
      </thead><tbody>`;

  filtered.forEach(p => {
    const price = p.effective_buy_price || 0;
    const stock = p.supplier_stock || p.subiekt_stock || 0;
    let isSel = false;
    if (step.type === 'single') isSel = ConfigState.cart[step.key]?.id === p.id;
    else if (step.type === 'multi') isSel = ConfigState.cart[step.key]?.some(i => i.id === p.id);

    // Dynamic attr cells per column definition
    const attrCells = attrColDefs.length > 0
      ? attrColDefs.map(def => {
          const raw = getAttrVal(p, def.attr_name);
          if (raw === null || raw === undefined || raw === '') {
            return `<td style="color:var(--text-muted);font-size:0.8rem;text-align:center;">—</td>`;
          }
          const display = def.attr_type === 'numeric'
            ? `<strong style="color:var(--text-primary);font-family:'JetBrains Mono',monospace;">${raw}</strong>${def.attr_unit ? `<span style="color:var(--text-muted);font-size:0.72rem;"> ${def.attr_unit}</span>` : ''}`
            : `<span class="ofer-badge" style="background:rgba(99,102,241,.12);color:#818cf8;border:1px solid rgba(99,102,241,.2);font-size:0.72rem;max-width:130px;overflow:hidden;text-overflow:ellipsis;display:inline-block;white-space:nowrap;" title="${raw}">${raw}</span>`;
          return `<td style="text-align:center;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${display}</td>`;
        }).join('')
      : `<td><div style="display:flex;gap:3px;flex-wrap:wrap;max-width:250px;">${
          (p.attributes || []).slice(0,4).map(a => {
            const fullVal = `${a.attr_name}: ${a.value_numeric!==null ? a.value_numeric : a.value_text}${a.attr_unit||''}`;
            return `<span class="ofer-badge gray" style="background:rgba(99,102,241,.06);color:var(--text-primary);border:1px solid var(--border);font-size:0.68rem;padding:2px 6px;border-radius:6px;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;display:inline-block;" title="${fullVal}">${fullVal}</span>`;
          }).join('')
        }</div></td>`;

    // Suppliers list — sort by price, highlight cheapest with stock
    const suppliers = p.suppliers || [];

    // Only suppliers with stock (hide "brak" rows)
    const withStock    = suppliers.filter(s => (s.stock_quantity ?? 0) > 0).sort((a,b) => (a.price_pln||0) - (b.price_pln||0));
    const withoutStock = suppliers.filter(s => (s.stock_quantity ?? 0) <= 0).sort((a,b) => (a.price_pln||0) - (b.price_pln||0));
    const sortedAll    = [...withStock, ...withoutStock];

    // Best price = cheapest supplier with stock; fallback to server value
    const bestSupplier  = withStock[0] || null;
    const bestPrice     = bestSupplier ? (bestSupplier.price_pln || 0) : (p.effective_buy_price || 0);
    const totalStock    = suppliers.reduce((sum, s) => sum + (s.stock_quantity ?? 0), 0);

    // Show ONLY suppliers with stock — no "brak" rows
    const suppList = withStock.slice(0, 5).map((s, i) => {
      const isBest = i === 0;
      return `<div style="font-size:0.75rem;display:flex;align-items:center;gap:4px;${isBest?'color:var(--accent);font-weight:700;':'color:var(--text-primary);'}">
        ${isBest ? '🏆 ' : ''}<span style="min-width:60px;">${s.supplier_name}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;">${(s.price_pln||0).toFixed(2)} zł</span>
        <span style="font-size:0.65rem;background:rgba(16,185,129,.15);color:#10b981;padding:1px 5px;border-radius:8px;margin-left:4px;">${s.stock_quantity} szt.</span>
      </div>`;
    }).join('');
    const suppCell = withStock.length > 0
      ? `<div style="display:flex;flex-direction:column;gap:3px;">${suppList}${withStock.length > 5 ? `<div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px;">+${withStock.length - 5} więcej...</div>` : ''}</div>`
      : '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>';

    html += `
      <tr class="${isSel ? 'selected' : ''}">
        <td>
          <div style="font-weight:600;font-size:0.88rem;line-height:1.2;cursor:pointer;transition:color 0.15s;" class="ofer-prod-name-click" title="Kliknij, aby zobaczyć szczegóły produktu" onclick="window.SourcingView?._showProductDetail(${p.id})">${p.name}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <span style="font-weight:500;">${p.manufacturer || ''}</span>
            ${p.canonical_ean ? `<span style="background:var(--bg-elevated);border:1px solid var(--border);padding:1px 6px;border-radius:4px;font-size:0.68rem;color:var(--text-muted);cursor:pointer;user-select:all;" title="Dwuklik: kopiuj EAN" ondblclick="event.stopPropagation(); navigator.clipboard.writeText('${p.canonical_ean}'); window.Toast?.success('Skopiowano EAN: ${p.canonical_ean}');">EAN: <span style="color:var(--text-primary); font-family:monospace; font-weight:normal;">${p.canonical_ean}</span></span>` : ''}
            ${p.manufacturer_code ? `<span style="background:var(--bg-elevated);border:1px solid var(--border);padding:1px 6px;border-radius:4px;font-size:0.68rem;color:var(--text-muted);cursor:pointer;user-select:all;" title="Dwuklik: kopiuj kod producenta" ondblclick="event.stopPropagation(); navigator.clipboard.writeText('${p.manufacturer_code.replace(/'/g, "\\'")}'); window.Toast?.success('Skopiowano kod producenta: ${p.manufacturer_code.replace(/'/g, "\\'")}');">Kod: <span style="color:var(--text-primary); font-family:monospace; font-weight:normal;">${p.manufacturer_code}</span></span>` : ''}
          </div>
        </td>
        ${attrCells}
        <td>${suppCell}</td>
        <td><span style="color:${totalStock>0?'#10b981':'#f87171'};font-weight:600;">${totalStock} szt.</span></td>
        <td style="font-weight:700;white-space:nowrap;color:${bestSupplier?'var(--text-primary)':'var(--text-muted)'};">${bestPrice.toFixed(2)} zł</td>
        <td>
          <button class="btn btn--sm ${isSel?'btn--danger':'btn--primary'}" onclick="selectComponent('${step.key}',${p.id},${p.category_id})">
            ${isSel?(step.type==='multi'?'Usuń':'Wybrano'):'Wybierz'}
          </button>
        </td>
      </tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function foldAttrName(s) {
  return String(s || '').toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
    .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
    .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ä/g,'a');
}

const ATTR_NAME_GROUPS = [
  ['socket', 'sockel', 'gniazdo', 'kompatybilne sockety', 'kompatybilne podstawki', 'podstawka'],
  ['tdp', 'max tdp', 'moc cieplna'],
  ['wysokosc', 'height', 'hohe'],
  ['typ chlodzenia', 'cooler type', 'cooling type'],
  ['typ pamieci ram', 'memory type', 'ram type'],
  ['format plyty', 'format'],
  ['liczba kosci', 'liczba kości'],
  ['dlugosc karty', 'długość karty'],
  ['maks. wys. chlodzenia', 'maks. wys. chłodzenia'],
  ['maks. dl. karty graficznej', 'maks. dł. karty graficznej'],
];

function foldCatName(s) {
  return String(s || '').toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
    .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z');
}

function containsCatToken(haystack, needle) {
  const h = foldCatName(haystack);
  const n = foldCatName(needle);
  if (!h || !n) return false;
  if (h === n) return true;
  if (n.length < 4) return false;
  if (n.length >= 6 && h.includes(n)) return true;
  const re = new RegExp('(?:^|[^a-z0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-z0-9])');
  return re.test(h);
}

function scoreStepCategory(cat, step) {
  const n = foldCatName(cat.name);
  const excludes = step.catExclude || [];
  if (excludes.some(ex => n.includes(foldCatName(ex)))) return 0;
  // Hardcoded ShopGold IDs are a weak hint — nazwa kategorii wygrywa, bo ID w katalogu Master się rozjeżdżają.
  let best = (step.categoryIds || []).includes(cat.id) ? 4 : 0;
  const aliases = [
    ...(Array.isArray(step.catAlias) ? step.catAlias : step.catAlias ? [step.catAlias] : []),
    step.catName,
  ].filter(Boolean);
  for (const a of aliases) {
    const fa = foldCatName(a);
    if (!fa) continue;
    if (n === fa) best = Math.max(best, 8);
    else if (containsCatToken(n, fa)) best = Math.max(best, fa.length >= 8 ? 5 + n.length / 100 : 2);
  }
  return best;
}

function attrNamesMatch(a, b) {
  const fa = foldAttrName(a);
  const fb = foldAttrName(b);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  const lastA = fa.split(/\s*\/\s*/).pop();
  const lastB = fb.split(/\s*\/\s*/).pop();
  if (lastA && lastB && lastA === lastB) return true;
  return ATTR_NAME_GROUPS.some(g => {
    const aHit = g.some(x => fa === x || lastA === x);
    const bHit = g.some(x => fb === x || lastB === x);
    return aHit && bHit;
  });
}

function getAttrVal(product, attrName) {
  const attrs = product.attributes || [];
  const a = attrs.find(x => attrNamesMatch(x.attr_name, attrName));
  if (!a) return null;
  return a.value_numeric != null ? a.value_numeric : a.value_text;
}

function selectComponent(stepKey, productId, catId) {
  const step = ConfigState.steps.find(s => s.key === stepKey);
  let p = ConfigState.stepProducts[catId]?.find(x => x.id === productId);
  if (!p) {
    for (const prods of Object.values(ConfigState.stepProducts)) {
      p = prods.find(x => x.id === productId);
      if (p) break;
    }
  }
  if (!p || !step) return;

  if (step.type === 'single') {
    if (ConfigState.cart[stepKey]?.id === productId) ConfigState.cart[stepKey] = null;
    else ConfigState.cart[stepKey] = p;
    
    // Auto advance to next step if selecting (not unselecting)
    if (ConfigState.cart[stepKey] && ConfigState.activeStep < 11) {
      ConfigState.activeStep++;
    }
  } else if (step.type === 'multi') {
    const arr = ConfigState.cart[stepKey] || [];
    const idx = arr.findIndex(x => x.id === productId);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(p);
    ConfigState.cart[stepKey] = arr;
  }
  
  updateBudget();
  checkCompatibility();
  loadStepContent();
}

function clearStep(stepKey) {
  const step = ConfigState.steps.find(s => s.key === stepKey);
  if (step.type === 'single') ConfigState.cart[stepKey] = null;
  else if (step.type === 'multi' || step.type === 'services') ConfigState.cart[stepKey] = [];
  else if (step.type === 'accessories') {
    ConfigState.cart.keyboard    = null;
    ConfigState.cart.mouse       = null;
    ConfigState.cart.headset     = null;
    ConfigState.cart.monitor     = [];
    ConfigState.cart.mousepad    = [];
    ConfigState.cart.speakers    = [];
    ConfigState.cart.webcam      = [];
    ConfigState.cart.microphone  = [];
    ConfigState.cart.monitor_mount = [];
    ConfigState.cart.case_fan    = [];
    ConfigState.cart.accessories = [];
  }
  updateBudget();
  checkCompatibility();
  loadStepContent();
}

async function loadServicesForStep() {
  const c = document.getElementById('ofer-step-services');
  if (!c) return;
  try {
    const res = await API.get('/oferter/services');
    const srvs = res.services || [];
    
    const standardHtml = srvs.map(s => {
      const isSel = ConfigState.cart.services.some(x => x.id === s.id);
      return `
        <div class="ofer-service-item ${isSel ? 'selected' : ''}" onclick="toggleService(${s.id}, '${s.name.replace(/'/g, "\\'")}', ${s.price})">
          <div class="ofer-service-info">
            <div class="ofer-service-checkbox">${isSel ? '✓' : ''}</div>
            <div class="ofer-service-name" title="${s.name}">${s.name}</div>
          </div>
          <div class="ofer-service-price">${s.price.toFixed(2)} zł</div>
        </div>
      `;
    }).join('');

    const selectedHtml = ConfigState.cart.services.length > 0 ? ConfigState.cart.services.map(s => {
      const isCustom = s.custom || typeof s.id === 'string';
      return `
        <div class="ofer-service-item selected ${isCustom ? 'custom-selected' : ''}" style="cursor:default; margin-bottom:8px;">
          <div class="ofer-service-info">
            <div class="ofer-service-checkbox ${isCustom ? 'custom' : ''}">${isCustom ? '★' : '✓'}</div>
            <div class="ofer-service-name" title="${s.name}" style="font-weight: 600;">${s.name}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="number" class="ofer-attr-input" style="width:75px; text-align:right; padding:4px 8px; font-size:0.85rem;" 
              value="${s.price}" oninput="updateServicePrice('${s.id}', this.value)" placeholder="Cena">
            <span style="font-size:0.8rem; color:var(--text-muted);">zł</span>
            <button class="btn btn--sm btn--danger" style="padding:4px 8px;" onclick="removeCustomService('${s.id}')">Usuń</button>
          </div>
        </div>
      `;
    }).join('') : '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">Brak wybranych usług</div>';

    c.innerHTML = `
      <div class="ofer-split">
        <!-- Lewa kolumna: Lista standardowych usług -->
        <div class="ofer-split-left" style="padding:16px; display:flex; flex-direction:column; gap:10px; background:var(--bg-card); border-radius:14px;">
          <h4 style="margin:0 0 6px; font-size:0.95rem; color:var(--text-primary);">🛠️ Usługi standardowe</h4>
          <div style="display:flex; flex-direction:column; gap:8px; max-height:400px; overflow-y:auto; padding-right:4px;">
            ${standardHtml}
          </div>
        </div>

        <!-- Prawa kolumna: Koszyk usług i formularz dodawania własnej -->
        <div class="ofer-split-right" style="padding:16px; display:flex; flex-direction:column; gap:16px; background:var(--bg-card); border-radius:14px;">
          <div>
            <h4 style="margin:0 0 10px; font-size:0.95rem; color:var(--text-primary);">📋 Wybrane usługi w ofercie</h4>
            <div style="display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto; padding-right:4px;">
              ${selectedHtml}
            </div>
          </div>

          <div style="border-top:1px solid var(--border); padding-top:14px;">
            <h4 style="margin:0 0 10px; font-size:0.95rem; color:var(--text-primary); margin-bottom:10px;">➕ Dodaj własną usługę</h4>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <input type="text" id="ofer-custom-service-name" class="ofer-attr-input" placeholder="Nazwa usługi (np. Montaż AIO)" style="flex:1; min-width:140px; padding:6px 10px; font-size:0.85rem;">
              <input type="number" id="ofer-custom-service-price" class="ofer-attr-input" placeholder="Cena (zł)" style="width:85px; padding:6px 10px; font-size:0.85rem;">
              <button class="btn btn--primary btn--sm" onclick="addCustomService()">Dodaj</button>
            </div>
          </div>
        </div>
      </div>
      <div style="margin-top:20px; text-align:right;">
        <button class="btn btn--primary" onclick="goToSummary()">Zakończ i przejdź do Podsumowania ➡️</button>
      </div>
    `;
  } catch(e) {
    console.error(e);
    c.innerHTML = '<div class="ofer-empty">Błąd ładowania usług</div>';
  }
}

function toggleService(id, name, price) {
  const arr = ConfigState.cart.services;
  const idx = arr.findIndex(x => x.id.toString() === id.toString());
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push({ id, name, price });
  updateBudget();
  loadServicesForStep();
}

window.toggleService = toggleService;

window.addCustomService = function() {
  const nameInput = document.getElementById('ofer-custom-service-name');
  const priceInput = document.getElementById('ofer-custom-service-price');
  if (!nameInput || !priceInput) return;
  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value) || 0;
  if (!name) {
    Toast.error('Podaj nazwę usługi!');
    return;
  }
  const customId = 'custom-' + Date.now();
  ConfigState.cart.services.push({ id: customId, name, price, custom: true });
  nameInput.value = '';
  priceInput.value = '';
  updateBudget();
  loadServicesForStep();
};

window.removeCustomService = function(id) {
  const arr = ConfigState.cart.services;
  const idx = arr.findIndex(x => x.id.toString() === id.toString());
  if (idx >= 0) arr.splice(idx, 1);
  updateBudget();
  loadServicesForStep();
};

window.updateServicePrice = function(id, val) {
  const price = parseFloat(val) || 0;
  const s = ConfigState.cart.services.find(x => x.id.toString() === id.toString());
  if (s) {
    s.price = price;
    updateBudget();
  }
};

// ─── ACCESSORIES STEP ─────────────────────────────────────────────────────────
const ACC_TABS = [
  { key: 'keyboard',    label: '⌨️ Klawiatura',       icon: '⌨️', type: 'single', categoryIds: [3720, 3849], aliases: ['klawiatur'] },
  { key: 'mouse',       label: '🖱️ Myszka',           icon: '🖱️', type: 'single', categoryIds: [3821, 4516, 4614], aliases: ['mysz', 'myszy', 'myszk', 'mouse'], exclude: ['podklad'] },
  { key: 'headset',     label: '🎧 Słuchawki',         icon: '🎧', type: 'single', categoryIds: [3953, 3904, 5377, 5608], aliases: ['sluchawki', 'headset', 'headsets consumer', 'headsets business'], exclude: ['mikrofon studyj'] },
  { key: 'monitor',     label: '🖥️ Monitory',         icon: '🖥️', type: 'multi',  categoryIds: [3700], aliases: ['monitory'], exclude: ['uchwyt', 'ramion'] },
  { key: 'mousepad',    label: '🟫 Podkładki',         icon: '🟫', type: 'multi',  categoryIds: [4136, 3848, 4153, 3721, 5166], aliases: ['podkladki pod myszki', 'podkladki do myszek', 'podkladka pod mysz', 'mousepad', 'mouse pad'], exclude: ['myszy bezprzewod', 'myszy przewod', 'myszy komputer'] },
  { key: 'speakers',    label: '🔊 Głośniki',          icon: '🔊', type: 'multi',  categoryIds: [4741, 4170, 5388, 4283], aliases: ['glosniki bezprzewodowe', 'glosniki soundbar', 'glosniki przenosne', 'glosniki'] },
  { key: 'webcam',      label: '📷 Kamery',            icon: '📷', type: 'multi',  categoryIds: [3963, 3897, 3725], aliases: ['kamery internetowe', 'webcams', 'pc- & netzwerkkameras'] },
  { key: 'microphone',  label: '🎙️ Mikrofony',        icon: '🎙️', type: 'multi',  categoryIds: [5390, 3883], aliases: ['mikrofony', 'microphone'], exclude: ['sluchawk', 'headset'] },
  { key: 'monitor_mount', label: '🦾 Uchwyty',         icon: '🦾', type: 'multi',  categoryIds: [4422, 4665, 4160], aliases: ['uchwyty do monitorow', 'uchwyty i ramiona do monitorow', 'akcesoria do montazu monitorow', 'ramiona do monitorow'] },
  { key: 'case_fan',    label: '💨 Wentylatory',       icon: '💨', type: 'multi',  categoryIds: [4144, 4588], aliases: ['wentylatory do obudow', 'wentylator do obudow', 'wentylatory do obudów i vga'], exclude: ['procesor', 'cpu cooler', 'chlodzenie wodne'] },
];


async function loadAccessoriesForStep(activeTabKey) {
  const c = document.getElementById('ofer-step-accessories');
  if (!c) return;

  activeTabKey = activeTabKey || ConfigState._accActiveTab || 'keyboard';
  ConfigState._accActiveTab = activeTabKey;
  const tab = ACC_TABS.find(t => t.key === activeTabKey) || ACC_TABS[0];

  // Resolve ALL matching categories (multiple per tab)
  let matchedCats = [];
  let products = [];
  let catId = null;
  try {
    const catsData = await API.get('/oferter/setup/categories');
    const cats = catsData.categories || [];
    matchedCats = cats.filter(cat => {
      if ((tab.exclude || []).some(ex => containsCatToken(cat.name, ex) || foldCatName(cat.name).includes(foldCatName(ex)))) return false;
      const byAlias = (tab.aliases || []).some(a => containsCatToken(cat.name, a));
      const byId = (tab.categoryIds || []).includes(cat.id);
      return byAlias || byId;
    });
    console.log(`[ACC] Tab "${tab.key}" matched ${matchedCats.length} categories:`, matchedCats.map(c=>c.name));

    // Fetch products from ALL matched categories, deduplicate by product id
    const seenIds = new Set();
    for (const cat of matchedCats) {
      if (!ConfigState.stepProducts[cat.id]) {
        const p = await API.get(`/oferter/components/${cat.id}?limit=9999`);
        ConfigState.stepProducts[cat.id] = p.products || [];
      }
      for (const prod of ConfigState.stepProducts[cat.id]) {
        if (!seenIds.has(prod.id)) {
          seenIds.add(prod.id);
          const totalStock = (prod.suppliers||[]).reduce((s,x) => s + (x.stock_quantity||0), 0);
          if (totalStock > 0) products.push(prod);
        }
      }
    }
    // Sort cheapest-available-price first
    const bp = p => { const ws=(p.suppliers||[]).filter(s=>(s.stock_quantity||0)>0).sort((a,b)=>(a.price_pln||0)-(b.price_pln||0)); return ws[0]?(ws[0].price_pln||0):(p.effective_buy_price||0); };
    products.sort((a,b) => bp(a) - bp(b));
    catId = matchedCats[0]?.id || null;
  } catch(e) { console.error(e); }

  // Persist search/filter state per tab
  const stateKey = 'acc_' + activeTabKey;
  const accState = ConfigState[stateKey] || { search: '', supplier: '', stockOnly: true };
  ConfigState[stateKey] = accState;

  // Build tab bar HTML
  const tabBar = ACC_TABS.map(t => {
    const isActive = t.key === activeTabKey;
    const selCount = t.type === 'single'
      ? (ConfigState.cart[t.key] ? 1 : 0)
      : (ConfigState.cart[t.key]?.length || 0);
    return `<button class="ofer-acc-tab ${isActive ? 'active' : ''}" onclick="loadAccessoriesForStep('${t.key}')">
      ${t.icon} ${t.label.replace(/^\S+\s/,'')}${selCount > 0 ? ` <span class="ofer-acc-tab-badge">${selCount}</span>` : ''}
    </button>`;
  }).join('');

  // Collect unique suppliers across all products
  const allSuppliers = [...new Set(
    products.flatMap(pr => (pr.suppliers||[]).map(s => s.supplier_name)).filter(Boolean)
  )].sort();
  const supplierOptions = allSuppliers.map(s =>
    `<option value="${s}" ${accState.supplier===s?'selected':''}>${s}</option>`
  ).join('');

  // Chosen items summary bar
  const chosen = tab.type === 'single'
    ? (ConfigState.cart[tab.key] ? [ConfigState.cart[tab.key]] : [])
    : (ConfigState.cart[tab.key] || []);
  const chosenHtml = chosen.length > 0
    ? `<div style="margin-bottom:10px;padding:8px 14px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.25);border-radius:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <span style="font-size:0.72rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.05em;margin-right:4px;">Wybrane:</span>
        ${chosen.map(i => `<span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border);padding:3px 10px;border-radius:20px;font-size:0.78rem;">
          ${i.name}
          <span style="font-weight:600;color:var(--accent);font-family:'JetBrains Mono',monospace;">${(i.effective_buy_price||0).toFixed(2)} zł</span>
          <button onclick="selectAccessory('${tab.key}','${tab.type}',${i.id})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.85rem;padding:0 2px;" title="Usuń">✕</button>
        </span>`).join('')}
      </div>` : '';

  // ── Build dynamic attribute columns & filters from product data ──────────
  const attrPopularity = {};
  products.forEach(pr => {
    const seen = new Set();
    (pr.attributes || []).forEach(a => {
      if (seen.has(a.attr_name)) return;
      seen.add(a.attr_name);
      const v = a.value_text ?? (a.value_numeric != null ? String(a.value_numeric) : null);
      if (!v || v === '') return;
      if (!attrPopularity[a.attr_name]) attrPopularity[a.attr_name] = { values: new Set(), count: 0, unit: a.attr_unit || '', type: a.attr_type || 'text' };
      attrPopularity[a.attr_name].values.add(v);
      attrPopularity[a.attr_name].count++;
    });
  });

  if (!accState.attrFilters) accState.attrFilters = {};

  // Resolve active filters from localStorage or default to top-6
  const storageKeyF = `oferter_acc_filters_${activeTabKey}`;
  const allAttrNamesAcc = Object.keys(attrPopularity)
    .filter(n => attrPopularity[n].values.size >= 2)
    .sort((a, b) => attrPopularity[b].count - attrPopularity[a].count);
  const top6 = allAttrNamesAcc.slice(0, 6);
  let activeFilterNames;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKeyF));
    if (Array.isArray(stored)) {
      if (stored.length === 0) {
        activeFilterNames = [];
      } else {
        activeFilterNames = stored.filter(name => allAttrNamesAcc.includes(name));
        if (activeFilterNames.length === 0) activeFilterNames = top6;
      }
    } else {
      activeFilterNames = top6;
    }
  } catch(e) {
    activeFilterNames = top6;
  }

  // Build filter dropdowns
  const accFilterHtml = activeFilterNames.map(name => {
    const d = attrPopularity[name];
    if (!d || d.values.size < 2) return '';
    const isNum = d.type === 'numeric';
    const sorted = Array.from(d.values).sort((a, b) => isNum ? parseFloat(a) - parseFloat(b) : a.localeCompare(b, 'pl'));
    const unit = d.unit ? ` [${d.unit}]` : '';
    const sel = accState.attrFilters[name] || '';
    const opts = sorted.map(v => `<option value="${v}"${v === sel ? ' selected' : ''}>${v}${d.unit ? ' ' + d.unit : ''}</option>`).join('');
    return `<div class="ofer-dyn-filter-group">
      <label class="ofer-dyn-filter-label">🔷 ${name}${unit}</label>
      <select class="ofer-input ofer-acc-attr-filter" data-attr-name="${name}" title="Filtruj po ${name}">
        <option value="">Wszystkie</option>${opts}
      </select>
    </div>`;
  }).filter(Boolean).join('');

  // ── Filtering ─────────────────────────────────────────────────────
  const normStr = s => (s||'').toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
    .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z');
  const q = normStr(accState.search);
  let filtered = products.filter(pr => {
    if (accState.supplier) {
      if (!(pr.suppliers||[]).some(s => s.supplier_name === accState.supplier && (s.stock_quantity||0) > 0)) return false;
    }
    if (q) {
      if (!normStr(pr.name).includes(q) && !normStr(pr.manufacturer||'').includes(q)) return false;
    }
    for (const [attrName, selVal] of Object.entries(accState.attrFilters || {})) {
      if (!selVal) continue;
      const attr = (pr.attributes || []).find(a => a.attr_name === attrName);
      const v = attr ? (attr.value_text ?? (attr.value_numeric != null ? String(attr.value_numeric) : '')) : '';
      if (v !== selVal) return false;
    }
    return true;
  });

  // ── Determine attribute columns to show in table (same as components tab) ───
  function getAccAttrVal(pr, attrName) {
    const a = (pr.attributes || []).find(x => x.attr_name === attrName);
    return a ? (a.value_numeric !== null ? a.value_numeric : a.value_text) : null;
  }
  const attrColNames = activeFilterNames.filter(name =>
    filtered.some(pr => { const v = getAccAttrVal(pr, name); return v !== null && v !== undefined && v !== ''; })
  ).slice(0, 5);

  function shortenAccName(name) {
    const s = name.indexOf(' / ');
    let sh = s >= 0 ? name.slice(s + 3) : name;
    if (sh.length > 20) sh = sh.slice(0, 18) + '…';
    return sh;
  }
  const attrHeaders = attrColNames.map(name => {
    const d = attrPopularity[name] || {};
    const label = shortenAccName(name) + (d.unit ? ` [${d.unit}]` : '');
    return `<th style="white-space:nowrap;font-size:0.72rem;color:var(--accent);max-width:120px;overflow:hidden;text-overflow:ellipsis" title="${name}">${label}</th>`;
  }).join('');

  // ── Build product rows ─────────────────────────────────────────────────
  let rows = '';
  if (!catId && products.length === 0) {
    rows = `<div class="ofer-empty"><span class="ofer-empty-icon">📂</span><h3>Brak kategorii</h3><p>Nie znaleziono kategorii dla "${tab.label}".</p></div>`;
  } else if (filtered.length === 0) {
    rows = `<div class="ofer-empty"><span class="ofer-empty-icon">🔍</span><h3>Brak wyników</h3><p>Zmień kryteria wyszukiwania lub filtrowania.</p></div>`;
  } else {
    const trows = filtered.map(pr => {
      let isSel = tab.type === 'single' ? ConfigState.cart[tab.key]?.id === pr.id
                                         : (ConfigState.cart[tab.key] || []).some(i => i.id === pr.id);
      const withStock = (pr.suppliers||[]).filter(s=>(s.stock_quantity||0)>0).sort((a,b)=>(a.price_pln||0)-(b.price_pln||0));
      const bestSup = withStock[0] || null;
      const bestPrice = bestSup ? (bestSup.price_pln||0) : (pr.effective_buy_price||0);
      const totalStock = (pr.suppliers||[]).reduce((s,x)=>s+(x.stock_quantity||0),0);

      const suppList = withStock.slice(0,5).map((s,i) => {
        const isBest = i===0;
        return `<div style="font-size:0.73rem;display:flex;align-items:center;gap:4px;${isBest?'color:var(--accent);font-weight:700;':'color:var(--text-primary);'}">
          ${isBest?'🏆 ':''}<span style="min-width:55px;">${s.supplier_name}</span>
          <span style="font-family:monospace;font-size:0.68rem;">${(s.price_pln||0).toFixed(2)} zł</span>
          <span style="font-size:0.62rem;background:rgba(16,185,129,.15);color:#10b981;padding:1px 4px;border-radius:6px;">${s.stock_quantity} szt.</span>
        </div>`;
      }).join('') + (withStock.length>5 ? `<div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;">+${withStock.length-5} więcej</div>` : '');

      const eanHtml = pr.canonical_ean
        ? `<span style="background:var(--bg-elevated);border:1px solid var(--border);padding:1px 5px;border-radius:4px;font-size:0.66rem;cursor:pointer;user-select:all;" title="Dwuklik: kopiuj EAN" ondblclick="event.stopPropagation();navigator.clipboard.writeText('${pr.canonical_ean}');window.Toast?.success('Skopiowano EAN');"><span style="font-family:monospace;">${pr.canonical_ean}</span></span>`
        : '';

      // Per-attribute column cells
      const attrCells = attrColNames.map(name => {
        const d = attrPopularity[name] || {};
        const raw = getAccAttrVal(pr, name);
        if (raw === null || raw === undefined || raw === '') return `<td style="color:var(--text-muted);font-size:0.8rem;text-align:center;">—</td>`;
        const display = d.type === 'numeric'
          ? `<strong style="color:var(--text-primary);font-family:'JetBrains Mono',monospace;">${raw}</strong>${d.unit ? `<span style="color:var(--text-muted);font-size:0.72rem;"> ${d.unit}</span>` : ''}`
          : `<span class="ofer-badge" style="background:rgba(99,102,241,.12);color:#818cf8;border:1px solid rgba(99,102,241,.2);font-size:0.72rem;max-width:130px;overflow:hidden;text-overflow:ellipsis;display:inline-block;white-space:nowrap;" title="${raw}">${raw}</span>`;
        return `<td style="text-align:center;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${display}</td>`;
      }).join('');

      return `<tr class="${isSel?'selected':''}">
        <td>
          <div class="ofer-prod-name-click" style="font-weight:600;font-size:0.87rem;line-height:1.25;cursor:pointer;" title="Kliknij aby zobaczyć szczegóły" onclick="window.SourcingView?._showProductDetail(${pr.id})">${pr.name}</div>
          <div style="font-size:0.71rem;color:var(--text-muted);margin-top:3px;display:flex;gap:7px;flex-wrap:wrap;align-items:center;">
            <span style="font-weight:500;">${pr.manufacturer||''}</span>
            ${eanHtml}
          </div>
        </td>
        ${attrCells}
        <td><div style="display:flex;flex-direction:column;gap:2px;">${suppList}</div></td>
        <td><span style="color:${totalStock>0?'#10b981':'#f87171'};font-weight:700;">${totalStock} szt.</span></td>
        <td style="font-weight:700;white-space:nowrap;color:${bestSup?'var(--text-primary)':'var(--text-muted)'};">${bestPrice.toFixed(2)} zł</td>
        <td>
          <button class="btn btn--sm ${isSel?'btn--danger':'btn--primary'}" onclick="selectAccessory('${tab.key}','${tab.type}',${pr.id})">
            ${isSel?(tab.type==='multi'?'Usuń':'Wybrano'):'Wybierz'}
          </button>
        </td>
      </tr>`;
    }).join('');
    rows = `<table class="ofer-comp-table">
      <thead><tr>
        <th>Produkt</th>
        ${attrHeaders}
        <th style="min-width:220px;">Hurtownia</th><th>Stan</th><th>Cena</th><th>Akcja</th>
      </tr></thead>
      <tbody>${trows}</tbody>
    </table>`;
  }

  c.innerHTML = `
    <div class="ofer-acc-tabs">${tabBar}</div>
    <div class="ofer-toolbar" style="margin-bottom:8px;padding:6px 12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="text" class="ofer-search" placeholder="Szukaj produktu..." value="${accState.search||''}"
          oninput="ConfigState['${stateKey}'].search=this.value;loadAccessoriesForStep('${activeTabKey}')"
          style="width:200px;padding:4px 8px;font-size:0.8rem;margin:0;">
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:0.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;white-space:nowrap;">Hurtownia:</span>
          <select class="ofer-input" style="padding:4px 8px;font-size:0.8rem;width:130px;margin:0;height:28px;"
            onchange="ConfigState['${stateKey}'].supplier=this.value;loadAccessoriesForStep('${activeTabKey}')">
            <option value="">Wszystkie</option>${supplierOptions}
          </select>
        </div>
        <span style="font-size:0.75rem;color:var(--text-muted);">${filtered.length} / ${products.length} produktów</span>
      </div>
    </div>
    ${accFilterHtml ? `<div class="ofer-dyn-filter-header" style="margin-bottom:6px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
      🎛️ Filtry cech:
      ${accFilterHtml}
      <button class="btn btn--sm btn--ghost" id="ofer-acc-manage-btn"
        style="margin-left:auto;padding:4px 8px;font-size:0.72rem;display:flex;align-items:center;gap:4px;border:1px solid var(--border);"
        onclick="const p=document.getElementById('ofer-acc-panel');const b=this;if(p){p.style.display=p.style.display==='none'?'block':'none';b.classList.toggle('active');}">
        <span style="font-size:0.85rem;">⚙️</span> Dostosuj filtry
      </button>
    </div>` : ''}
    <div id="ofer-acc-panel" class="ofer-filters-setup-header" style="display:none;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border);">
        <div class="ofer-filters-setup-title">⚙️ Dostosuj widoczne filtry cech</div>
        <button class="ofer-filters-setup-btn" id="ofer-acc-reset-btn">Domyślne</button>
      </div>
      <div class="ofer-filter-attr-list" id="ofer-acc-chk-list"></div>
    </div>
    ${chosenHtml}
    <div id="ofer-acc-list" style="overflow-x:auto;">${rows}</div>
  `;

  // Populate "Dostosuj filtry" panel checkboxes
  const chkList = c.querySelector('#ofer-acc-chk-list');
  if (chkList) {
    let curActive;
    try { curActive = JSON.parse(localStorage.getItem(storageKeyF)) || top6; } catch(e) { curActive = top6; }
    chkList.innerHTML = allAttrNamesAcc.map(name => {
      const isChecked = curActive.includes(name);
      const esc = name.replace(/'/g, "\\'");
      return `<label class="ofer-filter-attr-item ${isChecked?'active':''}" data-attr-name="${name}">
        <input type="checkbox" ${isChecked?'checked':''} onchange="window._accToggleFilter('${activeTabKey}','${esc}',this.checked)">
        <span>${name}</span>
      </label>`;
    }).join('');
  }
  c.querySelector('#ofer-acc-reset-btn')?.addEventListener('click', () => {
    localStorage.removeItem(storageKeyF);
    accState.attrFilters = {};
    loadAccessoriesForStep(activeTabKey);
  });

  window._accToggleFilter = function(tKey, attrName, isChecked) {
    const sk = `oferter_acc_filters_${tKey}`;
    let cur; try { cur = JSON.parse(localStorage.getItem(sk)) || top6; } catch(e) { cur = top6.slice(); }
    if (isChecked) { if (!cur.includes(attrName)) cur.push(attrName); }
    else { cur = cur.filter(n => n !== attrName); }
    localStorage.setItem(sk, JSON.stringify(cur));
    loadAccessoriesForStep(tKey);
    setTimeout(() => { const p = document.getElementById('ofer-acc-panel'); if (p) p.style.display = 'block'; }, 50);
  };

  // Bind attribute filter change events
  c.querySelectorAll('.ofer-acc-attr-filter').forEach(sel => {
    sel.addEventListener('change', () => {
      accState.attrFilters[sel.dataset.attrName] = sel.value;
      loadAccessoriesForStep(activeTabKey);
    });
  });
}

// Re-render only the product list part (used by search/filter inputs)
window.renderAccFilteredRows = function(tabKey) {
  loadAccessoriesForStep(tabKey);
};

window.loadAccessoriesForStep = loadAccessoriesForStep;

window.selectAccessory = function(tabKey, tabType, productId) {
  // Search across ALL cached step products (product may be from any matched category)
  let found = null;
  let foundCatId = null;
  for (const [cid, prods] of Object.entries(ConfigState.stepProducts)) {
    const match = prods.find(x => x.id === productId);
    if (match) { found = match; foundCatId = parseInt(cid); break; }
  }
  if (!found) return;

  if (tabType === 'single') {
    ConfigState.cart[tabKey] = ConfigState.cart[tabKey]?.id === productId ? null : { ...found, category_id: foundCatId };
  } else {
    const arr = ConfigState.cart[tabKey] || [];
    const idx = arr.findIndex(x => x.id === productId);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push({ ...found, category_id: foundCatId });
    ConfigState.cart[tabKey] = arr;
  }
  updateBudget();
  renderAccordion();
  loadAccessoriesForStep(tabKey);
};

// --- PHASE 3: SUMMARY AND QUOTES ---

function goToSummary() {
  const right = document.getElementById('ofer-step-content');
  if (!right) return;

  // Oblicz koszty
  let componentsCost = 0;
  let servicesCost = 0;
  
  Object.keys(ConfigState.cart).forEach(key => {
    if (key === 'services') {
      ConfigState.cart.services.forEach(s => servicesCost += s.price);
    } else {
      const item = ConfigState.cart[key];
      if (Array.isArray(item)) item.forEach(i => componentsCost += (i.effective_buy_price || 0));
      else if (item) componentsCost += (item.effective_buy_price || 0);
    }
  });

  const totalBase = componentsCost + servicesCost;
  const initialMarginInput = ConfigState.preferences.marginValue ?? 300;
  const initialMarginType = ConfigState.preferences.marginType ?? 'pln';
  let initialMargin = initialMarginType === 'pct' ? totalBase * (initialMarginInput / 100) : initialMarginInput;
  const initialDiscount = ConfigState.preferences.discountValue ?? 0;
  const finalPrice = totalBase + initialMargin - initialDiscount;

  right.innerHTML = 
    '<div class="ofer-summary-container">' +
      '<h2 style="margin-top:0; color:var(--text-primary); font-size:1.3rem;">📝 Podsumowanie Zestawu</h2>' +
      
      '<div class="ofer-summary-grid">' +
        '<!-- Lewa: Finanse -->' +
        '<div class="ofer-summary-card">' +
          '<h3 class="ofer-summary-title">Finanse</h3>' +
          '<div class="ofer-sum-row"><span>Koszt części:</span> <strong>' + componentsCost.toFixed(2) + ' zł</strong></div>' +
          '<div class="ofer-sum-row"><span>Koszt usług:</span> <strong>' + servicesCost.toFixed(2) + ' zł</strong></div>' +
          '<div class="ofer-sum-row" style="border-top:1px solid var(--border); padding-top:8px; margin-top:8px;">' +
            '<span>Razem Baza (Netto / Zakup):</span> <strong style="font-size:1.1rem">' + totalBase.toFixed(2) + ' zł</strong>' +
          '</div>' +

          '<div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">' +
            '<div class="ofer-attr-field">' +
              '<label class="ofer-attr-label">Narzut własny / Marża</label>' +
              '<div style="display:flex;">' +
                '<input type="number" id="ofer-summary-margin" class="ofer-attr-input" value="' + initialMarginInput + '" style="flex:1; border-top-right-radius:0; border-bottom-right-radius:0; border-right:none;" oninput="calcFinalPrice()">' +
                '<select id="ofer-summary-margin-type" class="ofer-attr-input" style="width:70px; padding:6px; border-top-left-radius:0; border-bottom-left-radius:0;" onchange="calcFinalPrice()">' +
                  '<option value="pln" ' + (initialMarginType === 'pln' ? 'selected' : '') + '>zł</option>' +
                  '<option value="pct" ' + (initialMarginType === 'pct' ? 'selected' : '') + '>%</option>' +
                '</select>' +
              '</div>' +
            '</div>' +
            '<div class="ofer-attr-field">' +
              '<label class="ofer-attr-label">Rabat dla klienta (zł)</label>' +
              '<input type="number" id="ofer-summary-discount" class="ofer-attr-input" value="' + initialDiscount + '" oninput="calcFinalPrice()">' +
            '</div>' +
          '</div>' +
          
          '<div class="ofer-sum-final">' +
            '<span>Do zapłaty przez Klienta:</span>' +
            '<strong id="ofer-summary-final-price" style="color:#10b981; font-size:1.4rem;">' + finalPrice.toFixed(2) + ' zł</strong>' +
          '</div>' +
        '</div>' +

        '<!-- Prawa: Dane Klienta -->' +
        '<div class="ofer-summary-card">' +
          '<h3 class="ofer-summary-title">Dane Klienta i Zapis</h3>' +
          '<div style="display:flex; flex-direction:column; gap:12px;">' +
            '<input type="text" id="ofer-sum-client-name" class="ofer-attr-input" placeholder="Imię i Nazwisko / Nazwa firmy" value="' + (ConfigState._loadedClientName || '') + '">' +
            '<input type="email" id="ofer-sum-client-email" class="ofer-attr-input" placeholder="Adres e-mail (opcjonalnie)" value="' + (ConfigState._loadedClientEmail || '') + '">' +
            '<textarea id="ofer-sum-notes-client" class="ofer-attr-input" placeholder="Uwagi na ofercie (widoczne dla klienta)" style="min-height:60px;">' + (ConfigState._loadedNotesClient || '') + '</textarea>' +
            '<textarea id="ofer-sum-notes-internal" class="ofer-attr-input" placeholder="Notatki wewnętrzne (np. z kim rozmawiano, ustalenia)" style="min-height:60px;">' + (ConfigState._loadedNotesInternal || '') + '</textarea>' +
            
            '<button class="btn btn--primary" style="margin-top:10px; width:100%; justify-content:center; padding:12px;" onclick="saveQuote()">' +
              (ConfigState.editingQuoteId ? '💾 Aktualizuj Ofertę #' + ConfigState.editingQuoteId : '💾 Zapisz Ofertę w Systemie') +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
    
  // Clear selection highlighting in accordion
  document.querySelectorAll('.ofer-step').forEach(s => s.classList.remove('active'));
}

function calcFinalPrice() {
  let componentsCost = 0;
  let servicesCost = 0;
  Object.keys(ConfigState.cart).forEach(key => {
    if (key === 'services') ConfigState.cart.services.forEach(s => servicesCost += s.price);
    else {
      const item = ConfigState.cart[key];
      if (Array.isArray(item)) item.forEach(i => componentsCost += (i.effective_buy_price || 0));
      else if (item) componentsCost += (item.effective_buy_price || 0);
    }
  });

  const base = componentsCost + servicesCost;
  const marginInput = parseFloat(document.getElementById('ofer-summary-margin')?.value || 0);
  const marginType = document.getElementById('ofer-summary-margin-type')?.value || 'pln';
  
  // Update state in real-time
  ConfigState.preferences.marginValue = marginInput;
  ConfigState.preferences.marginType = marginType;

  let margin = marginType === 'pct' ? base * (marginInput / 100) : marginInput;
  const discount = parseFloat(document.getElementById('ofer-summary-discount')?.value || 0);
  ConfigState.preferences.discountValue = discount;
  
  const final = base + margin - discount;
  const el = document.getElementById('ofer-summary-final-price');
  if (el) el.textContent = final.toFixed(2) + ' zł';
}

async function saveQuote() {
  const clientName = document.getElementById('ofer-sum-client-name')?.value.trim();
  const clientEmail = document.getElementById('ofer-sum-client-email')?.value.trim();
  const notesClient = document.getElementById('ofer-sum-notes-client')?.value.trim();
  const notesInternal = document.getElementById('ofer-sum-notes-internal')?.value.trim();

  const title = clientName ? `Oferta dla ${clientName}` : `Oferta z ${new Date().toLocaleDateString()}`;
  let componentsCost = 0;
  let servicesCost = 0;
  
  const compList = [];
  const servList = [];
  
  Object.keys(ConfigState.cart).forEach(key => {
    if (key === 'services') {
      ConfigState.cart.services.forEach(s => {
        servicesCost += s.price || 0;
        servList.push(s);
      });
    } else {
      const item = ConfigState.cart[key];
      if (Array.isArray(item)) {
        item.forEach(i => {
          componentsCost += (i.effective_buy_price || 0);
          compList.push({ ...i, _step: key });
        });
      } else if (item) {
         componentsCost += (item.effective_buy_price || 0);
         compList.push({ ...item, _step: key });
      }
    }
  });

  if (compList.length === 0 && servList.length === 0) {
    Toast.error('Koszyk jest pusty!');
    return;
  }

  const base = componentsCost + servicesCost;
  const marginInput = parseFloat(document.getElementById('ofer-summary-margin')?.value || 0);
  const marginType = document.getElementById('ofer-summary-margin-type')?.value || 'pln';
  const margin = marginType === 'pct' ? base * (marginInput / 100) : marginInput;
  const discount = parseFloat(document.getElementById('ofer-summary-discount')?.value || 0);

  // Store in ConfigState preferences
  ConfigState.preferences.marginValue = marginInput;
  ConfigState.preferences.marginType = marginType;
  ConfigState.preferences.discountValue = discount;

  const payload = {
    title,
    client_name: clientName,
    client_email: clientEmail,
    margin_value: margin,
    discount_value: discount,
    notes_internal: notesInternal,
    notes_client: notesClient,
    total_buy_price: componentsCost + servicesCost,
    components: compList,
    services: servList,
    preferences: ConfigState.preferences
  };

  try {
    let res;
    if (ConfigState.editingQuoteId) {
      res = await API.put(`/oferter/offers/${ConfigState.editingQuoteId}`, payload);
    } else {
      res = await API.post('/oferter/offers', payload);
    }
    
    if (res.ok) {
      Toast.success(ConfigState.editingQuoteId ? 'Oferta została zaktualizowana!' : 'Oferta została zapisana!');
      
      // Clean editing states
      delete ConfigState.editingQuoteId;
      delete ConfigState._loadedClientName;
      delete ConfigState._loadedClientEmail;
      delete ConfigState._loadedNotesClient;
      delete ConfigState._loadedNotesInternal;
      
      ConfigState.stepProducts = {};
      ConfigState.cart = emptyCart();
      ConfigState.preferences = {
        purpose: 'gaming',
        budget: 5000,
        platform: 'any',
        cooler: 'any',
        rgb: 'any',
        caseFormat: 'any'
      };
      updateBudget();
      checkCompatibility();
      
      // Switch to Quotes tab
      document.querySelector('.ofer-tab[data-tab="quotes"]').click();
    } else {
      Toast.error('Błąd zapisu: ' + (res.error || 'Nieznany'));
    }
  } catch (e) {
    Toast.error('Błąd komunikacji: ' + e.message);
  }
}

// --- QUOTES TAB ---
async function loadQuotesTab() {
  const pane = document.getElementById('ofer-pane-quotes');
  if (!pane) return;

  pane.innerHTML = '<div class="ofer-empty">Ładowanie ofert...</div>';

  try {
    const res = await API.get('/oferter/offers');
    const quotes = res.quotes || [];

    if (quotes.length === 0) {
      pane.innerHTML = '<div class="ofer-empty"><span class="ofer-empty-icon">📋</span><h3>Brak ofert</h3><p>Utwórz pierwszą ofertę w Konfiguratorze.</p></div>';
      return;
    }

    pane.innerHTML = 
      '<div class="ofer-card">' +
        '<div class="ofer-card-title">Lista zapisanych ofert</div>' +
        '<div class="table-responsive">' +
          '<table class="table w-full">' +
            '<thead>' +
              '<tr>' +
                '<th>ID</th>' +
                '<th>Klient</th>' +
                '<th>E-mail</th>' +
                '<th>Data utworzenia</th>' +
                '<th>Suma Bazowa</th>' +
                '<th>Marża</th>' +
                '<th>Rabat</th>' +
                '<th>Do zapłaty</th>' +
                '<th class="text-right">Akcje</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' +
              quotes.map(q => {
                const finalPrice = q.total_buy_price + q.margin_value - q.discount_value;
                return '<tr>' +
                  '<td>#' + q.id + '</td>' +
                  '<td>' + (q.client_name || '<span class="text-muted">Brak</span>') + '</td>' +
                  '<td>' + (q.client_email || '<span class="text-muted">Brak</span>') + '</td>' +
                  '<td>' + new Date(q.created_at).toLocaleString() + '</td>' +
                  '<td>' + q.total_buy_price.toFixed(2) + ' zł</td>' +
                  '<td style="color:#10b981">+' + q.margin_value.toFixed(2) + ' zł</td>' +
                  '<td style="color:#f87171">-' + q.discount_value.toFixed(2) + ' zł</td>' +
                  '<td><strong>' + finalPrice.toFixed(2) + ' zł</strong></td>' +
                  '<td class="text-right" style="white-space:nowrap;">' +
                    '<button class="btn btn--sm btn--ghost" style="margin-right:4px;" onclick="editQuote(' + q.id + ')">✏️ Edytuj</button>' +
                    '<button class="btn btn--sm btn--ghost" style="margin-right:4px;" onclick="printQuote(' + q.id + ')">🖨️ PDF</button>' +
                    '<button class="btn btn--sm btn--danger" onclick="deleteQuote(' + q.id + ')">🗑️ Usuń</button>' +
                  '</td>' +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  } catch (e) {
    pane.innerHTML = '<div class="ofer-empty">Błąd ładowania ofert</div>';
  }
}

async function printQuote(id) {
  try {
    const res = await API.get(`/oferter/offers/${id}`);
    if (!res.ok) return Toast.error('Nie udało się pobrać oferty');
    
    const q = res.offer;
    const comps = JSON.parse(q.components || '[]');
    const srvs = JSON.parse(q.services || '[]');

    const win = window.open('', '_blank');
    const finalPrice = q.total_buy_price + q.margin_value - q.discount_value;

    win.document.write(`
      <html>
        <head>
          <title>Oferta #${q.id}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 14px; }
            th { background: #f9f9f9; }
            .total { font-size: 20px; font-weight: bold; text-align: right; color: #10b981; }
            .notes { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; font-size: 14px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <h1>${q.title || 'Oferta Zestawu Komputerowego'}</h1>
          <div class="meta">
            <div>
              <strong>Dla:</strong> ${q.client_name || 'Klient detaliczny'}<br>
              <strong>Firma:</strong> ${q.client_company || '-'}<br>
              <strong>Email:</strong> ${q.client_email || '-'}
            </div>
            <div style="text-align:right">
              <strong>Data:</strong> ${new Date(q.created_at).toLocaleDateString()}<br>
              <strong>Ważność:</strong> 7 dni
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Komponent</th>
                <th>Nazwa modelu</th>
                <th>Cena</th>
              </tr>
            </thead>
            <tbody>
              ${comps.map(c => `
                <tr>
                  <td><strong>${c._step ? c._step.toUpperCase() : 'Część'}</strong></td>
                  <td>${c.name}</td>
                  <td>${Number(c.effective_buy_price || c.price || 0).toFixed(2)} zł</td>
                </tr>
              `).join('')}
              ${srvs.map(s => `
                <tr>
                  <td><strong>USŁUGA</strong></td>
                  <td>${s.name}</td>
                  <td>${Number(s.price || 0).toFixed(2)} zł</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total">
            Razem do zapłaty: ${finalPrice.toFixed(2)} zł
          </div>

          ${q.notes_client ? `<div class="notes"><strong>Uwagi:</strong><br>${q.notes_client.replace(/\n/g, '<br>')}</div>` : ''}
          
          <div style="margin-top:50px; font-size:12px; color:#888; text-align:center;">
            Wygenerowano z systemu ShopGold AI Dashboard • ${window.location.hostname}
          </div>
          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `);
    win.document.close();
  } catch(e) {
    Toast.error('Błąd drukowania: ' + e.message);
  }
}

async function deleteQuote(id) {
  if (!confirm(`Czy na pewno chcesz usunąć ofertę #${id}?`)) return;
  try {
    const res = await API.del(`/oferter/offers/${id}`);
    if (res.ok) {
      Toast.success('Oferta została usunięta.');
      loadQuotesTab();
    } else {
      Toast.error('Błąd usuwania oferty: ' + (res.error || 'Nieznany'));
    }
  } catch (e) {
    Toast.error('Błąd połączenia: ' + e.message);
  }
}
window.deleteQuote = deleteQuote;

async function editQuote(id) {
  try {
    const res = await API.get(`/oferter/offers/${id}`);
    if (!res.ok) return Toast.error('Nie udało się pobrać oferty');
    
    const q = res.offer;
    
    ConfigState.stepProducts = {};
    ConfigState.cart = emptyCart();
    
    // Parse components and services from JSON
    const comps = JSON.parse(q.components || '[]');
    const srvs = JSON.parse(q.services || '[]');
    const prefs = JSON.parse(q.preferences || '{}');
    
    // Populate preferences
    ConfigState.preferences = {
      purpose: prefs.purpose || 'gaming',
      budget: prefs.budget ?? 5000,
      platform: prefs.platform || 'any',
      cooler: prefs.cooler || 'any',
      rgb: prefs.rgb || 'any',
      caseFormat: prefs.caseFormat || 'any',
      marginValue: prefs.marginValue ?? (q.margin_value != null ? q.margin_value : 300),
      marginType: prefs.marginType || 'pln',
      discountValue: prefs.discountValue ?? (q.discount_value != null ? q.discount_value : 0)
    };
    
    comps.forEach(c => {
      const stepKey = c._step;
      if (!stepKey) return;
      if (CART_ARRAY_KEYS.includes(stepKey)) {
        if (!Array.isArray(ConfigState.cart[stepKey])) ConfigState.cart[stepKey] = [];
        ConfigState.cart[stepKey].push(c);
      } else if (Object.prototype.hasOwnProperty.call(ConfigState.cart, stepKey)) {
        ConfigState.cart[stepKey] = c;
      }
    });
    
    // Populate services
    ConfigState.cart.services = srvs;
    
    // Set editing Quote ID and metadata for summary inputs
    ConfigState.editingQuoteId = q.id;
    ConfigState._loadedClientName = q.client_name || '';
    ConfigState._loadedClientEmail = q.client_email || '';
    ConfigState._loadedNotesClient = q.notes_client || '';
    ConfigState._loadedNotesInternal = q.notes_internal || '';
    
    // Recalculate budget and check compatibility
    updateBudget();
    checkCompatibility();
    
    // Switch to Components tab
    OferterState.tab = 'components';
    localStorage.setItem('oferter_active_tab', 'components');
    renderOferter();
    
    Toast.success(`Załadowano ofertę #${q.id} do edycji.`);
  } catch (e) {
    Toast.error('Błąd ładowania oferty do edycji: ' + e.message);
  }
}
window.editQuote = editQuote;
