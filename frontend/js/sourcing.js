/* ===== sourcing.js — Smart Sourcing & Pricing View (rozbudowana) ===== */
'use strict';

window.SourcingView = (() => {
  /* ── state ── */
  let activeTab = localStorage.getItem('sg_sourcing_tab') || 'subiekt';
  let previewData = null;
  let compareData = null;
  let sortCol = null, sortAsc = true;
  let filterAvail = false, filterSavings = '', filterSearch = '', filterMfg = '', filterSupplierId = '';
  let comparePage = 0, comparePageSize = 100;
  let promoThreshold = 10, promoAvail = false, promoSearch = '', promoMfg = '';
  let promoPriceMin = '', promoPriceMax = '';
  let promoPage = 0, promoPageSize = 100;
  let promoSortCol = null, promoSortAsc = true;
  let dealsThreshold = 50, dealsAvail = true, dealsOnlyNew = true, dealsSearch = '', dealsMfg = '', dealsInSubiekt = 'all';
  let dealsPriceMin = '', dealsPriceMax = '';
  let dealsPage = 0, dealsPageSize = 100;
  let dealsSortCol = 'savings', dealsSortAsc = false;
  let _dealsCache = null;
  let missingSupplier = '', missingSearch = '', missingAvail = '', missingMfg = '';
  let missingSortCol = null, missingSortAsc = true;
  let restockSupplier = '', restockSearch = '', restockDays = 30, restockOnlyNeeded = true;
  let restockAvail = '', restockMfg = '';
  let restockPage = 0, restockPageSize = 100;
  let restockSortCol = null, restockSortAsc = true;
  let logsExpanded = false, logsSupplier = null;

  /* ── sg-sync state ── */
  let sgSyncInstanceId = parseInt(localStorage.getItem('sg_sync_iid')) || null;
  let sgSyncSupplierId = null;
  let sgSyncDryRunResults = null;
  let sgSyncLogsExpanded = true;
  let sgSyncRulesExpanded = true;
  let sgSyncScheduleExpanded = true;

  /* ── Client-side tab data cache (5 min TTL) ─────────────────── */
  const _tabCache = {};
  const TAB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  function getTabCache(key) {
    const e = _tabCache[key];
    if (!e) return null;
    if (Date.now() - e.ts > TAB_CACHE_TTL) { delete _tabCache[key]; return null; }
    return e.data;
  }
  function setTabCache(key, data) { _tabCache[key] = { data, ts: Date.now() }; }
  function clearTabCache(key) { if (key) delete _tabCache[key]; else Object.keys(_tabCache).forEach(k => delete _tabCache[k]); }

  /* ── Skeleton loader HTML ────────────────────────────────── */
  function skeletonRows(cols = 5, rows = 12) {
    const cells = Array(cols).fill('<td><div class="sk-cell"></div></td>').join('');
    return Array(rows).fill(`<tr>${cells}</tr>`).join('');
  }
  function skeletonTable(cols = 5, rows = 12) {
    return `<div class="compare-table-wrap"><table class="compare-table sk-table"><tbody>${skeletonRows(cols, rows)}</tbody></table></div>`;
  }

  /* â”€â”€ render entry â”€â”€ */
  /* ── Słownik kodów gwarancji Action ──────────────────── */
  const ACTION_WARRANTY_LABELS = {
    'B000M':'Brak gwarancji','W000M':'Gwarancja Wieczysta',
    'E024M':'Gwarancja Europejska 24 m-ce',
    'F000M':'Fabryczna','F001M':'Fabryczna 1 m-c','F003M':'Fabryczna 3 m-ce',
    'F004M':'Fabryczna 4 m-ce','F006M':'Fabryczna 6 m-cy','F012M':'Fabryczna 12 m-cy',
    'F018M':'Fabryczna 18 m-cy','F024M':'Fabryczna 24 m-ce','F036M':'Fabryczna 36 m-cy',
    'F048M':'Fabryczna 48 m-cy','F060M':'Fabryczna 60 m-cy','F072M':'Fabryczna 72 m-ce',
    'F084M':'Fabryczna 84 m-ce','F096M':'Fabryczna 96 m-cy','F120M':'Fabryczna 120 m-cy',
    'F144M':'Fabryczna 144 m-ce','F180M':'Fabryczna 180 m-cy','F216M':'Fabryczna 216 m-cy',
    'F240M':'Fabryczna 240 m-cy','F300M':'Fabryczna 300 m-cy',
    'G001M':'Gwar. 1 m-c','G003M':'Gwar. 3 m-ce','G005M':'Gwar. 5 m-cy',
    'G006M':'Gwar. 6 m-cy','G009M':'Gwar. 9 m-cy','G012M':'Gwar. 12 m-cy',
    'G021M':'Gwar. 21 m-cy','G024M':'Gwar. 24 m-ce','G026M':'Gwar. 26 m-cy',
    'G030M':'Gwar. 30 m-cy','G036M':'Gwar. 36 m-cy','G048M':'Gwar. 48 m-cy',
    'G060M':'Gwar. 60 m-cy','G072M':'Gwar. 72 m-ce','G084M':'Gwar. 84 m-ce',
    'G096M':'Gwar. 96 m-cy','G099M':'Gwar. 99 m-cy','G120M':'Gwar. 120 m-cy',
    'G144M':'Gwar. 144 m-ce','G180M':'Gwar. 180 m-cy','G300M':'Gwar. 300 m-cy','G360M':'Gwar. 360 m-cy',
    'R001M':'Rękojmia 1 m-c','R003M':'Rękojmia 3 m-ce','R012M':'Rękojmia 12 m-cy',
    'R024M':'Rękojmia 24 m-ce','R034M':'Rękojmia 34 m-ce','R036M':'Rękojmia 36 m-cy',
    'R048M':'Rękojmia 48 m-cy','R060M':'Rękojmia 60 m-cy','R099M':'Rękojmia 99 m-cy',
  };

  function fmtWarranty(code) {
    if (!code || code === 'B000M') return '<span style="color:var(--text-muted)">—</span>';
    const label = ACTION_WARRANTY_LABELS[code];
    if (label) return '<span title="' + code + '" style="cursor:default">' + label + '</span>';
    return code;
  }

  function render() {
    const el = document.getElementById('view-sourcing');
    if (!el) return;
    el.innerHTML = html_shell();
    bindTabSwitcher();
    renderTab(activeTab);
  }

  function html_shell() {
    const tabs = ['subiekt','suppliers','email','compare','promotions','deals','missing','restock','listing','catalog','sgsync'];
    const labels = {
      subiekt:'📥 Import Subiekta', suppliers:'🏭 Hurtownie', email: '📬 Email Oferty',
      compare:'📊 Porownanie cen', promotions:'🔥 Promocje', deals:'🔔 Super Ceny',
      missing:'🆕 Brakujace', restock:'📦 Zamowienia', listing:'🛒 Niewystawione',
      catalog:'📚 Katalog Master', sgsync:'🔄 Sync ShopGold'
    };
    return `
<div class="sourcing-tabs">
  ${tabs.map(t=>`<button class="sourcing-tab${activeTab===t?' active':''}${t==='sgsync'?' sourcing-tab--highlight':''}" data-tab="${t}">${labels[t]}</button>`).join('')}
</div>
${tabs.map(t=>`<div id="src-tab-${t}" class="sourcing-tab-content${activeTab===t?' active':''}"></div>`).join('')}`;
  }

  function bindTabSwitcher() {
    document.querySelectorAll('.sourcing-tab[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        localStorage.setItem('sg_sourcing_tab', activeTab);
        document.querySelectorAll('.sourcing-tab[data-tab]').forEach(b => b.classList.toggle('active', b===btn));
        document.querySelectorAll('.sourcing-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`src-tab-${activeTab}`)?.classList.add('active');
        renderTab(activeTab);
      });
    });
  }

  function renderTab(tab) {
    if (tab === 'subiekt')    renderSubiekt();
    if (tab === 'suppliers')  renderSuppliers();
    if (tab === 'email')      renderEmailMonitor();
    if (tab === 'compare')    renderCompare();
    if (tab === 'promotions') renderPromotions();
    if (tab === 'deals')      renderDeals();
    if (tab === 'missing')    renderMissing();
    if (tab === 'restock')    renderRestock();
    if (tab === 'listing')    renderListing();
    if (tab === 'catalog')    renderCatalog();
    if (tab === 'sgsync')     renderSgSync();
  }

  /* ═══════════════════════════════════════════════════════
     TAB 1 — SUBIEKT IMPORT
  ═══════════════════════════════════════════════════════ */
  async function renderSubiekt() {
    const el = document.getElementById('src-tab-subiekt');
    el.innerHTML = '<div class="sourcing-empty"><span class="empty-icon">⏳</span><p>Ladowanie...</p></div>';
    let status = {};
    try { status = await API.get('/sourcing/subiekt/status'); } catch {}
    el.innerHTML = `
<div class="subiekt-status" id="sub-status-bar">
  <div class="status-dot ${status.count>0?'ok':'empty'}"></div>
  <div class="status-info">
    <span class="status-count">${status.count>0?`${status.count} produktow w bazie`:'Brak danych — wgraj plik Subiekta'}</span>
    ${status.last_import?`<span class="status-date">Ostatni import: ${fmtDate(status.last_import)}</span>`:''}
  </div>
</div>
<div class="card" style="padding:24px;margin-bottom:20px">
  <h3 style="margin:0 0 16px;font-size:1rem;font-weight:700">Wgraj plik z Subiekta</h3>
  <div class="drop-zone" id="sub-drop">
    <input type="file" id="sub-file-input" accept=".xlsx,.xls,.csv">
    <span class="drop-icon">📂</span>
    <h3>Przeciagnij plik lub kliknij</h3>
    <p>Format: .xlsx, .xls lub .csv (eksport z Subiekt GT)</p>
  </div>
  <div id="sub-map-panel"></div>
</div>
<div class="card listing-import-card">
  <h3 style="margin:0 0 6px;font-size:1rem;font-weight:700">&#128203; Plik wystawien marketplace</h3>
  <p style="font-size:.82rem;color:var(--text-muted);margin:0 0 14px">Wgraj eksport wystawien z platform sprzedazowych (xlsx/csv). Wymagana kolumna: <strong>zrodlo nazwa</strong> (platforma) oraz <strong>EAN</strong>.</p>
  <div id="listing-status-bar" style="margin-bottom:12px"></div>
  <div class="drop-zone" id="listing-drop" style="padding:28px 24px">
    <input type="file" id="listing-file-input" accept=".xlsx,.xls,.csv">
    <span class="drop-icon" style="font-size:2.2rem">&#128202;</span>
    <h3 style="font-size:.92rem">Przeciagnij plik wystawien lub kliknij</h3>
    <p>Format: .xlsx, .xls lub .csv</p>
  </div>
  <div id="listing-import-status" style="margin-top:10px"></div>
</div>`;
    bindSubiektDrop(status.column_map || {});
    bindListingDrop();
    // Dynamically add delete button for subiekt data
    if (status.count > 0) {
      const bar = document.getElementById('sub-status-bar');
      if (bar && !document.getElementById('sub-clear-btn')) {
        const btn = document.createElement('button');
        btn.id = 'sub-clear-btn';
        btn.className = 'btn btn--danger btn--sm';
        btn.style.cssText = 'margin-left:auto;flex-shrink:0';
        btn.innerHTML = '&#x1F5D1; Usu\u0144 dane Subiekta';
        btn.onclick = async function() {
          if (!confirm('Usun\u0105\u0107 WSZYSTKIE dane Subiekta z bazy?')) return;
          try { await API.del('/sourcing/subiekt'); Toast.success('Dane Subiekta usuni\u0119te'); renderSubiekt(); }
          catch(e) { Toast.error(e.message); }
        };
        bar.appendChild(btn);
      }
    }
  }

  function bindSubiektDrop(savedMap) {
    const input = document.getElementById('sub-file-input');
    const zone  = document.getElementById('sub-drop');
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); handleSubiektFile(e.dataTransfer.files[0], savedMap); });
    input.addEventListener('change', () => { if (input.files[0]) handleSubiektFile(input.files[0], savedMap); });
  }

  async function handleSubiektFile(file, savedMap) {
    if (!file) return;
    const panel = document.getElementById('sub-map-panel');
    panel.innerHTML = '<p style="color:var(--text-muted);margin-top:14px">⏳ Analizuje plik...</p>';
    try {
      const fd = new FormData(); fd.append('file', file);
      previewData = await API.upload('/sourcing/subiekt/preview', fd);
      previewData._file = file;
      renderColumnMap(previewData, savedMap, file);
    } catch(e) { panel.innerHTML = `<p style="color:#f87171;margin-top:14px">❌ ${escHtml(e.message)}</p>`; }
  }

  const FIELDS = [
    {key:'ean',       label:'Kod EAN',                required:true},
    {key:'name',      label:'Nazwa produktu',          required:false},
    {key:'stock',     label:'Stan magazynowy',         required:false},
    {key:'buy_price', label:'Cena zakupu netto',       required:false},
    {key:'buy_price_gross', label:'Cena zakupu brutto', required:false},
    {key:'sell_price',label:'Cena sprzedaży detal',    required:false},
    {key:'sell_price_allegro', label:'Cena sprzedaży Allegro', required:false},
    {key:'sell_price_idealpc', label:'Cena sprzedaży IdealPC', required:false},
    {key:'sold_12m',  label:'Sprzedaz 12 mies.',       required:false},
    {key:'sold_30d',  label:'Sprzedaz 30 dni',         required:false},
    {key:'buy_price_date', label:'Data ost. zakupu',   required:false},
  ];

  function renderColumnMap(data, savedMap, file) {
    const panel = document.getElementById('sub-map-panel');
    const opts = ['', ...data.columns].map(c => `<option value="${escHtml(c)}">${escHtml(c)||'— nie mapuj —'}</option>`).join('');
    const fields = FIELDS.map(f => `
<div class="map-field">
  <label>${f.label} ${f.required?'<span class="required">*</span>':''}</label>
  <select id="map_${f.key}">${opts}</select>
</div>`).join('');

    const previewRows = (data.preview||[]).slice(0,5).map(row =>
      `<tr>${data.columns.slice(0,8).map(c=>`<td>${escHtml(String(row[c]??''))}</td>`).join('')}</tr>`
    ).join('');

    panel.innerHTML = `
<div class="column-map-panel">
  <h4>🗂 Mapowanie kolumn (${data.fileType === 'csv' ? 'CSV' : 'Excel'})</h4>
  <p class="map-subtitle">Przypisz kolumny z pliku do pol systemowych. Pole EAN jest wymagane.</p>
  <div class="column-map-grid">${fields}</div>
  <div class="preview-table-wrap" style="overflow-x:auto">
    <table><thead><tr>${data.columns.slice(0,8).map(c=>`<th>${escHtml(c)}</th>`).join('')}</tr></thead>
    <tbody>${previewRows}</tbody></table>
  </div>
  <div style="margin-top:18px;display:flex;gap:10px">
    <button class="btn btn--primary" id="sub-import-btn">✅ Importuj do bazy</button>
    <button class="btn btn--ghost" onclick="document.getElementById('sub-map-panel').innerHTML=''">Anuluj</button>
  </div>
</div>`;

    FIELDS.forEach(f => {
      const sel = document.getElementById(`map_${f.key}`);
      if (sel && savedMap[f.key]) sel.value = savedMap[f.key];
    });

    document.getElementById('sub-import-btn').addEventListener('click', async () => {
      const map = {};
      FIELDS.forEach(f => { const s = document.getElementById(`map_${f.key}`); if (s) map[f.key] = s.value; });
      if (!map.ean) { Toast.error('Musisz zmapowac kolumne EAN'); return; }
      setBtn('sub-import-btn', true);
      try {
        const fd = new FormData(); fd.append('file', file); fd.append('columnMap', JSON.stringify(map));
        const r = await API.upload('/sourcing/subiekt/import', fd);
        Toast.success(`✅ Zaimportowano ${r.imported} produktow z Subiekta`);
        previewData = null;
        renderSubiekt();
      } catch(e) { Toast.error(e.message); setBtn('sub-import-btn', false); }
    });
  }


  /* -- Listing file drop zone (inside subiekt tab) -- */
  function bindListingDrop() {
    const zone  = document.getElementById('listing-drop');
    const input = document.getElementById('listing-file-input');
    if (!zone || !input) return;
    loadListingImportStatus();
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); handleListingFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files[0]) handleListingFile(input.files[0]); });
  }

  async function loadListingImportStatus() {
    const bar = document.getElementById('listing-status-bar');
    if (!bar) return;
    try {
      const s = await API.get('/sourcing/listing/status');
      if (s.row_count > 0) {
        bar.innerHTML =
          '<div class="listing-status-pill" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<span class="status-dot ok" style="width:8px;height:8px;flex-shrink:0"></span>' +
          '<div style="display:flex;flex-direction:column;gap:2px">' +
          '<span>' + s.row_count + ' wystawień (z Sellasist) | import: ' + fmtDate(s.last_import) + '</span>' +
          '<span style="font-size:0.75rem;color:var(--text-muted)">platformy: <strong>' + s.platforms.join(', ') + '</strong></span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-left:auto">' +
          '<button class="btn btn--secondary btn--sm" id="lst-sync-btn">🔄 Odśwież Sellasist</button>' +
          '<button class="btn btn--danger btn--sm" id="lst-del-btn">&#x1F5D1; Wyczyść</button>' +
          '</div></div>';
        document.getElementById('lst-del-btn')?.addEventListener('click', async () => {
          if (!confirm('Usunąć wszystkie dane wystawień z bazy?')) return;
          try {
            await API.del('/sourcing/listing');
            Toast.success('Dane wystawień usunięte');
            loadListingImportStatus();
            listingPage = 0; listingSort = ''; listingAsc = true;
          } catch(e) { Toast.error(e.message); }
        });
        document.getElementById('lst-sync-btn')?.addEventListener('click', async () => {
          if (!confirm('Czy na pewno chcesz rozpocząć synchronizację danych z Sellasist?')) return;
          const btn = document.getElementById('lst-sync-btn');
          btn.disabled = true; btn.textContent = '⏳ Synchronizacja...';
          try {
            await API.post('/sellasist/sync', {});
            Toast.info('Synchronizacja rozpoczęta w tle. Zobacz zakładkę Ustawienia by śledzić postęp.');
          } catch(e) { Toast.error(e.message); btn.disabled = false; btn.textContent = '🔄 Odśwież Sellasist'; }
        });
      } else {
        bar.innerHTML = '<div class="listing-status-pill inactive"><span>Brak danych — zsynchronizuj z Sellasist w Ustawieniach</span></div>';
      }
    } catch(e) { }
  }

  async function handleListingFile(file) {
    if (!file) return;
    const statusEl = document.getElementById('listing-import-status');
    if (statusEl) statusEl.innerHTML = '<p style="color:var(--text-muted);font-size:.82rem">&#9203; Importuje...</p>';
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await API.upload('/sourcing/listing/import', fd);
      Toast.success('Zaimportowano ' + r.imported + ' wystawien | platformy: ' + r.platforms.join(', '));
      if (statusEl) statusEl.innerHTML = '';
      loadListingImportStatus();
    } catch(e) {
      Toast.error(e.message);
      if (statusEl) statusEl.innerHTML = '<p style="color:#f87171;font-size:.82rem">&#10060; ' + escHtml(e.message) + '</p>';
    }
  }
  /* ═══════════════════════════════════════════════════════
     TAB 2 — SUPPLIERS (z odśwież wszystkie, zastąp plik, logi, waluta)
  ═══════════════════════════════════════════════════════ */
  async function renderSuppliers() {
    const el = document.getElementById('src-tab-suppliers');
    el.innerHTML = '<div class="sourcing-empty"><span class="empty-icon">⏳</span><p>Ladowanie...</p></div>';
    let list = [];
    try { 
      list = await API.get('/sourcing/suppliers'); 
      if (list && list.length) {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }
    } catch {}

    const autoCount = list.filter(s => s.source_type !== 'file').length;
    const cards = list.length ? list.map(s => supplierCard(s)).join('') :
      `<div class="sourcing-empty"><span class="empty-icon">🏭</span><h3>Brak hurtowni</h3><p>Dodaj pierwsza hurtownie ponizej</p></div>`;

    el.innerHTML = `
<div class="suppliers-header-row">
  <h3 style="margin:0;font-size:1rem;font-weight:700">Hurtownie (${list.length})</h3>
  <div style="display:flex;gap:8px;align-items:center">
    <button class="btn btn--outline btn--sm" id="btn-mfg-manager" onclick="SourcingView._renderManufacturerManagerModal()">🛠️ Zarządzaj Producentami</button>
    <button class="btn btn--outline btn--sm" id="btn-attr-manager" onclick="SourcingView._renderAttrManagerModal()">⚙️ Mapowanie Cech</button>
    ${autoCount > 0 ? `<button class="btn btn--secondary btn--sm" id="sup-refresh-all-btn">🔄 Odśwież wszystkie</button>` : ''}
    <button class="btn btn--primary btn--sm" id="sup-subiekt-import-btn">📥 Import z Subiekta</button>
    <button class="btn btn--ghost btn--sm" id="sup-show-logs-btn">${logsExpanded?'â–˛':'â–Ľ'} Logi operacji</button>
  </div>
</div>
<div id="sup-refresh-all-progress" style="display:none" class="sourcing-progress-wrap"></div>
<div class="supplier-grid" id="supplier-grid">${cards}</div>
<div id="sup-logs-panel" style="display:${logsExpanded?'block':'none'}"></div>
<div class="add-supplier-form">
  <h4>&#x2795; Dodaj hurtownię</h4>
  <div class="source-type-toggle">
    <button id="st-url" class="active" onclick="SourcingView._setSourceType('url')">🔗 Link (URL)</button>
    <button id="st-file" onclick="SourcingView._setSourceType('file')">📁 Plik z dysku</button>
    <button id="st-ftp" onclick="SourcingView._setSourceType('ftp')">🔒 FTP/SFTP</button>
    <button id="st-elko_api" onclick="SourcingView._setSourceType('elko_api')">⚡ Elko API</button>
    <button id="st-impakt_api" onclick="SourcingView._setSourceType('impakt_api')">🔌 Impakt API</button>
    <button id="st-ntt_api" onclick="SourcingView._setSourceType('ntt_api')">🔌 NTT API</button>
    <button id="st-action_api" onclick="SourcingView._setSourceType('action_api')">🔌 Action API</button>
  </div>
  <div class="form-row-supplier two-col">
    <div class="form-group"><label class="form-label">Nazwa hurtowni</label>
      <input class="form-input" id="sup-name" placeholder="np. ABC Hurtownia" maxlength="80"></div>
    <div class="form-group" id="sup-url-wrap"><label class="form-label">URL do pliku XML / Excel / CSV</label>
      <input class="form-input" id="sup-url" placeholder="https://hurtownia.pl/cennik.xml"></div>
  </div>
  <div id="sup-url-auth-wrap" style="display:none;margin-bottom:14px">
    <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">🔐 Logowanie HTTP (opcjonalne — tylko gdy URL wymaga hasła)</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="form-group"><label class="form-label">Login (HTTP Basic Auth)</label>
        <input class="form-input" id="sup-url-user" placeholder="login"></div>
      <div class="form-group"><label class="form-label">Hasło (HTTP Basic Auth)</label>
        <input class="form-input" id="sup-url-pass" type="password" placeholder="hasło"></div>
    </div>
  </div>
  <div id="sup-file-wrap" style="display:none;margin-bottom:14px">
    <label class="form-label">Plik cennika (.xlsx / .xml / .csv)</label>
    <input type="file" id="sup-file-input" accept=".xlsx,.xls,.xml,.csv" class="form-input" style="padding:6px">
  </div>
  <div id="sup-ftp-wrap" style="display:none;margin-bottom:14px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">
      <div class="form-group"><label class="form-label">Host FTP / SFTP</label>
        <input class="form-input" id="sup-ftp-host" placeholder="ftp.hurtownia.pl lub paco.also.com"></div>
      <div class="form-group"><label class="form-label">Port (21=FTP, 22=SFTP)</label>
        <input class="form-input" id="sup-ftp-port" type="number" value="21" min="1" max="65535"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">
      <div class="form-group"><label class="form-label">Login FTP</label>
        <input class="form-input" id="sup-ftp-user" placeholder="login"></div>
      <div class="form-group"><label class="form-label">Haslo FTP</label>
        <input class="form-input" id="sup-ftp-pass" type="password" placeholder="haslo"></div>
    </div>
    <div class="form-group"><label class="form-label">Sciezka pliku na serwerze (np. /cennik.txt.zip)</label>
      <input class="form-input" id="sup-ftp-path" placeholder="/cenniki/cennik.xml"></div>
    <label style="display:flex;align-items:center;gap:8px;font-size:.82rem;cursor:pointer;margin-top:6px">
      <input type="checkbox" id="sup-ftp-secure"> FTPS (TLS) — nie zaznaczaj dla SFTP/port 22
    </label>
  </div>
  <div id="sup-elko-fields" class="supplier-form-section" style="display:none">
    <!-- Elko sub-tabs -->
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:14px">
      <button id="elko-tab-api" class="elko-subtab active" onclick="SourcingView._setElkoTab('api')"
        style="padding:7px 18px;font-size:.82rem;font-weight:600;border:none;background:none;cursor:pointer;color:var(--color-accent);border-bottom:2px solid var(--color-accent);margin-bottom:-2px;transition:.15s">
        🔌 Elko API
      </button>
      <button id="elko-tab-files" class="elko-subtab" onclick="SourcingView._setElkoTab('files')"
        style="padding:7px 18px;font-size:.82rem;font-weight:600;border:none;background:none;cursor:pointer;color:var(--text-muted);border-bottom:2px solid transparent;margin-bottom:-2px;transition:.15s">
        📂 Pliki per marka
      </button>
    </div>

    <!-- TAB: API -->
    <div id="elko-panel-api">
      <div class="form-group">
        <label class="form-label">Klucz API Elko <span style="color:var(--color-warning)">*</span></label>
        <textarea class="form-input" id="sup-elko-key" placeholder="Wklej tutaj pełny klucz API Elko (token / Bearer)" rows="3" style="font-family:monospace;font-size:.78rem;resize:vertical;min-height:60px;word-break:break-all"></textarea>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn--ghost btn--sm" id="elko-test-btn" style="font-size:.78rem" onclick="SourcingView._testElkoApi()">
          🔍 Testuj połączenie API
        </button>
        <div id="elko-test-result" style="font-size:.78rem;color:var(--text-muted)"></div>
      </div>
      <div style="margin-top:12px">
        <label class="form-label" style="margin-bottom:6px;display:block">📦 Marki do pobrania przez API</label>
        <div class="elko-brands-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px">
          <label class="elko-brand-cb" style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer;padding:4px 6px;border-radius:6px;transition:.15s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
            <input type="checkbox" class="elko-brand-check" value="adata" style="accent-color:var(--color-accent)"> Adata
          </label><label class="elko-brand-cb" style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer;padding:4px 6px;border-radius:6px;transition:.15s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
            <input type="checkbox" class="elko-brand-check" value="fellowes" style="accent-color:var(--color-accent)"> Fellowes
          </label><label class="elko-brand-cb" style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer;padding:4px 6px;border-radius:6px;transition:.15s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
            <input type="checkbox" class="elko-brand-check" value="intenso" style="accent-color:var(--color-accent)"> Intenso
          </label><label class="elko-brand-cb" style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer;padding:4px 6px;border-radius:6px;transition:.15s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
            <input type="checkbox" class="elko-brand-check" value="kingston" style="accent-color:var(--color-accent)"> Kingston
          </label><label class="elko-brand-cb" style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer;padding:4px 6px;border-radius:6px;transition:.15s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
            <input type="checkbox" class="elko-brand-check" value="mediarange" style="accent-color:var(--color-accent)"> Mediarange
          </label><label class="elko-brand-cb" style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer;padding:4px 6px;border-radius:6px;transition:.15s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
            <input type="checkbox" class="elko-brand-check" value="samsung" style="accent-color:var(--color-accent)"> Samsung
          </label><label class="elko-brand-cb" style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer;padding:4px 6px;border-radius:6px;transition:.15s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
            <input type="checkbox" class="elko-brand-check" value="sandisk" style="accent-color:var(--color-accent)"> SanDisk
          </label><label class="elko-brand-cb" style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer;padding:4px 6px;border-radius:6px;transition:.15s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
            <input type="checkbox" class="elko-brand-check" value="transcend" style="accent-color:var(--color-accent)"> Transcend
          </label><label class="elko-brand-cb" style="display:flex;align-items:center;gap:6px;font-size:.85rem;cursor:pointer;padding:4px 6px;border-radius:6px;transition:.15s" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background=''">
            <input type="checkbox" class="elko-brand-check" value="trust" style="accent-color:var(--color-accent)"> Trust
          </label>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:.8rem;cursor:pointer">
          <input type="checkbox" id="elko-all-brands" onchange="document.querySelectorAll('.elko-brand-check').forEach(cb=>cb.checked=this.checked)">
          Zaznacz wszystkie marki
        </label>
      </div>
      <div style="margin-top:10px;padding:8px;background:var(--bg-elevated);border-radius:6px;font-size:.78rem;color:var(--text-muted)">
        💡 Dane pobrane przez API są przeliczane z EUR na PLN (kurs NBP). Jeśli API nie działa — użyj zakładki "Pliki per marka".
      </div>
    </div>

    <!-- TAB: PLIKI PER MARKA -->
    <div id="elko-panel-files" style="display:none">
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:12px;padding:8px;background:var(--bg-elevated);border-radius:6px">
        📂 Wgraj plik Excel/CSV dla każdej marki z osobna. Pliki zostaną scalone po dodaniu hurtowni. Możesz wgrać pliki też później przez przycisk <strong>📎 Pliki</strong> na karcie hurtowni.
      </div>
      <div id="elko-brand-slots" style="display:flex;flex-direction:column;gap:8px">
        ${[
          {key:'adata',name:'Adata'}, {key:'fellowes',name:'Fellowes'}, {key:'intenso',name:'Intenso'},
          {key:'kingston',name:'Kingston'}, {key:'mediarange',name:'MediaRange'}, {key:'samsung',name:'Samsung'},
          {key:'sandisk',name:'SanDisk'}, {key:'transcend',name:'Transcend'}, {key:'trust',name:'Trust'}
        ].map(b => `
        <div class="elko-brand-slot" style="display:grid;grid-template-columns:110px 1fr;gap:8px;align-items:center;padding:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px">
          <div style="font-size:.85rem;font-weight:600">${b.name}</div>
          <div style="display:flex;gap:6px;align-items:center">
            <input type="file" id="elko-file-${b.key}" data-brand-key="${b.key}" data-brand-name="${b.name}"
              accept=".xlsx,.xls,.csv"
              style="flex:1;font-size:.75rem;padding:4px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);cursor:pointer">
            <span id="elko-file-status-${b.key}" style="font-size:.72rem;color:var(--text-muted);white-space:nowrap"></span>
          </div>
        </div>`).join('')}
      </div>
      <div style="margin-top:10px;font-size:.75rem;color:var(--text-muted)">
        💡 Pliki per markę działają też bez klucza API — wystarczy wgrać cennik Excel. Waluta jest wykrywana automatycznie z nazwy kolumny (np. "PriceEUR") lub można ją ustawić w ustawieniach hurtowni.
      </div>
    </div>
  </div>
  <div id="sup-impakt-fields" class="supplier-form-section" style="display:none">
    <div style="font-size:.82rem;font-weight:600;color:var(--text-secondary);margin-bottom:10px">🔌 Impakt / eTrade API (Basic Auth)</div>
    <div class="form-group">
      <label class="form-label">URL API <span style="color:var(--text-muted);font-weight:400">(domyślnie: https://api.etrade.pl)</span></label>
      <input class="form-input" id="sup-impakt-url" placeholder="https://api.etrade.pl" value="https://api.etrade.pl">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div class="form-group"><label class="form-label">Login API <span style="color:var(--color-warning)">*</span></label>
        <input class="form-input" id="sup-impakt-user" placeholder="ADMIN" autocomplete="off"></div>
      <div class="form-group"><label class="form-label">Hasło API <span style="color:var(--color-warning)">*</span></label>
        <input class="form-input" id="sup-impakt-pass" type="password" placeholder="hasło" autocomplete="off"></div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn btn--ghost btn--sm" id="impakt-test-btn" style="font-size:.78rem" onclick="SourcingView._testImpaktApi()">
        🔍 Testuj połączenie API
      </button>
      <div id="impakt-test-result" style="font-size:.78rem;color:var(--text-muted)"></div>
    </div>
    <div style="margin-top:10px;padding:8px;background:var(--bg-elevated);border-radius:6px;font-size:.78rem;color:var(--text-muted)">
      💡 Autoryzacja przez HTTP Basic Auth (login+hasło). Cennik pobierany jest z /v1/products (paginacja). Ceny w PLN.
    </div>
  </div>
  <div id="sup-ntt-fields" class="supplier-form-section" style="display:none">
    <div style="font-size:.82rem;font-weight:600;color:var(--text-secondary);margin-bottom:10px">🔌 NTT API</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div class="form-group"><label class="form-label">Client ID <span style="color:var(--color-warning)">*</span></label>
        <input class="form-input" id="sup-ntt-client-id" placeholder="clientId" autocomplete="off"></div>
      <div class="form-group"><label class="form-label">User ID <span style="color:var(--color-warning)">*</span></label>
        <input class="form-input" id="sup-ntt-user-id" placeholder="userId" autocomplete="off"></div>
    </div>
    <div class="form-group" style="margin-bottom:10px"><label class="form-label">Client Secret <span style="color:var(--color-warning)">*</span></label>
      <input class="form-input" id="sup-ntt-client-secret" type="password" placeholder="clientSecret" autocomplete="off"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn btn--ghost btn--sm" id="ntt-test-btn" style="font-size:.78rem" onclick="SourcingView._testNTTApi()">
        🔍 Testuj połączenie API NTT
      </button>
      <div id="ntt-test-result" style="font-size:.78rem;color:var(--text-muted)"></div>
    </div>
    <div style="margin-top:10px;padding:8px;background:var(--bg-elevated);border-radius:6px;font-size:.78rem;color:var(--text-muted)">
      💡 Autoryzacja przez token pobierany automatycznie przed ściągnięciem cennika. Mapowanie kolumn będzie dostępne po pierwszym udanym imporcie.
    </div>
  </div>
  <div id="sup-action-fields" class="supplier-form-section" style="display:none">
    <div style="font-size:.82rem;font-weight:600;color:var(--text-secondary);margin-bottom:10px">🔌 Action REST API</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div class="form-group"><label class="form-label">Customer ID (Opcjonalny) <span style="color:var(--color-warning)">*</span></label>
        <input class="form-input" id="sup-action-customer-id" placeholder="np. 326411" autocomplete="off"></div>
      <div class="form-group"><label class="form-label">User Name <span style="color:var(--color-warning)">*</span></label>
        <input class="form-input" id="sup-action-user-name" placeholder="np. slawekideal" autocomplete="off"></div>
    </div>
    <div class="form-group" style="margin-bottom:10px"><label class="form-label">Action Api Key <span style="color:var(--color-warning)">*</span></label>
      <input class="form-input" id="sup-action-api-key" type="password" placeholder="wklej klucz z iserwis" autocomplete="off"></div>
    <div style="margin-top:10px;padding:8px;background:var(--bg-elevated);border-radius:6px;font-size:.78rem;color:var(--text-muted)">
      💡 Klucz generuje się w panelu na stronie: https://is3.action.pl/dataexchange
    </div>
  </div>
  <div class="form-row-supplier two-col">
    <div class="form-group"><label class="form-label">Waluta cennika</label>
      <select class="form-select" id="sup-currency">
        <option value="PLN">PLN — Zloty</option>
        <option value="EUR">EUR — Euro</option>
        <option value="USD">USD — Dolar</option>
        <option value="CZK">CZK — Korona Czeska</option>
        <option value="GBP">GBP &mdash; Funt</option>
      </select>
    </div>
    <div class="form-group" id="sup-rate-wrap" style="display:none">
      <label class="form-label">Kurs reczny (0 = NBP)</label>
      <input class="form-input" id="sup-rate" type="number" step="0.0001" min="0" placeholder="0 = automatyczny NBP" value="0">
    </div>
  </div>
  <button class="btn btn--primary" id="sup-add-btn">&#x1F3ED; Dodaj i wczytaj cennik</button>
</div>`;

    bindSupplierActions(list);
    // Fix broken arrow chars in logs button
    (function(){ const b=document.getElementById('sup-show-logs-btn'); if(b) b.innerHTML=(logsExpanded?'&#x25B2;':'&#x25BC;')+' Logi operacji'; })();
    if (logsExpanded) loadLogs(null, 'sup-logs-panel');
    // Load Elko brand file SKU counts for elko_api suppliers
    loadElkoBrandFileSku(list);
  }

  function supplierCard(s) {
    const refreshed    = s.last_refresh     ? fmtDate(s.last_refresh)     : 'Nigdy';
    const fileCreated  = s.file_created_at  ? fmtDate(s.file_created_at)  : null;
    const currency = s.currency || 'PLN';
    const rate = (s.exchange_rate && s.exchange_rate != 1) ? ` (kurs: ${s.exchange_rate})` : '';
    const schedActive = s.schedule_enabled && s.schedule_cron;
    const cronLabel = s.schedule_cron ? escHtml(s.schedule_cron) : '\u2014';
    const typeIcon  = s.source_type === 'url' ? '&#x1F517;' : s.source_type === 'ftp' ? '&#x1F512;' : s.source_type === 'impakt_api' || s.source_type === 'ntt_api' || s.source_type === 'action_api' ? '&#x1F50C;' : '&#x1F4C1;';
    const typeLabel = s.source_type === 'url' ? 'URL' : s.source_type === 'ftp' && s.ftp_port == 22 ? 'SFTP' : s.source_type === 'ftp' ? 'FTP' : s.source_type === 'impakt_api' ? 'Impakt API' : s.source_type === 'elko_api' ? 'Elko API' : s.source_type === 'ntt_api' ? 'NTT API' : s.source_type === 'action_api' ? 'Action API' : 'Plik';
    const fileSizeHtml = s.file_size_bytes ? `<div class="supplier-meta-row">💾 Rozmiar: <strong>${fmtBytes(s.file_size_bytes)}</strong></div>` : '';
    const ftpInfoHtml  = (s.source_type === 'ftp' && s.ftp_host) ? `<div class="supplier-meta-row url-row" style="display:flex;align-items:center;gap:4px">
      <button class="btn-preview-main-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}" title="Podgląd pliku" style="padding:0 4px;font-size:1.05rem;background:none;border:none;cursor:pointer">👁️</button>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🔒 ${escHtml(s.ftp_host)}:${s.ftp_port||21}${escHtml(s.ftp_path||'')}</span>
    </div>` : '';
    return `
<div class="supplier-card" data-id="${s.id}" style="${s.is_active === 0 ? 'border-color:rgba(239,68,68,.35);opacity:.7;' : ''}">
  <div class="supplier-card-header">
    <div class="supplier-icon">${typeIcon}</div>
    <div class="supplier-info">
      <h4>${escHtml(s.name)}</h4>
      <span class="supplier-type ${s.source_type}">${typeLabel}</span>
      ${currency !== 'PLN' ? `<span class="sup-currency-badge">${currency}${rate}</span>` : ''}
    </div>
    <button class="btn-toggle-active" data-id="${s.id}" data-active="${s.is_active !== 0 ? '1' : '0'}" title="${s.is_active !== 0 ? 'Wyłącz hurtownię' : 'Włącz hurtownię'}" style="margin-left:auto;border:none;background:none;font-size:1.4rem;cursor:pointer;padding:4px 8px;border-radius:8px;transition:.15s;opacity:${s.is_active !== 0 ? '1' : '.5'}">${s.is_active !== 0 ? '🟢' : '🔴'}</button>
  </div>
  <div class="supplier-meta" style="${s.is_active === 0 ? 'opacity:.45;' : ''}">
    <div class="supplier-meta-row">📦 SKU: <strong>${s.product_count||0}</strong></div>
    ${s.source_type === 'elko_api' && s.extra_files_count > 0 ? '<div class="supplier-brand-files" data-sid="'+s.id+'"></div>' : ''}
    ${fileCreated ? `<div class="supplier-meta-row">📅 Data pliku: <strong>${fileCreated}</strong></div>` : ''}
    ${fileSizeHtml}
    <div class="supplier-meta-row">🔄 Wczytano: <strong>${refreshed}</strong></div>
    ${s.source_url ? `<div class="supplier-meta-row url-row" style="display:flex;align-items:center;gap:4px">
      <button class="btn-preview-main-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}" title="Podgląd pliku" style="padding:0 4px;font-size:1.05rem;background:none;border:none;cursor:pointer">👁️</button>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(s.source_url.slice(0,60))}${s.source_url.length>60?'…':''}</span>
    </div>` : ''}
    ${s.source_type === 'file' ? `<div class="supplier-meta-row url-row" style="display:flex;align-items:center;gap:4px">
      <button class="btn-preview-main-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}" title="Podgląd pliku" style="padding:0 4px;font-size:1.05rem;background:none;border:none;cursor:pointer">👁️</button>
      <span>Plik z dysku</span>
    </div>` : ''}
    ${ftpInfoHtml}
  </div>
  <div class="supplier-schedule-row">
    <span class="schedule-badge ${schedActive?'active':'inactive'}">${schedActive?'⏰':'⏸'} ${schedActive?cronLabel:'Harmonogram wyłączony'}</span>
    ${s.last_scheduled_run ? `<span class="schedule-last">auto: ${fmtDate(s.last_scheduled_run)}</span>` : ''}
  </div>
  ${(s.extra_files_count > 0) ? `<div class="supplier-files-row">📎 Pliki dodatkowe: <strong>${s.extra_files_count}</strong></div>` : ''}
  <div class="supplier-card-actions">
    <button class="btn-refresh-supplier" data-id="${s.id}" data-type="${s.source_type}"><span class="sup-refresh-icon">🔄</span> Odswież</button>
    ${s.source_type==='file'?`<button class="btn-replace-file" data-id="${s.id}">📂 Zastąp plik</button>`:''}
    <button class="btn-analyze-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}" style="background:var(--color-accent);color:#fff;border:none" title="Wymuś analizę pliku">⚙️ Analiza</button>
    <button class="btn-schedule-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}" data-cron="${escHtml(s.schedule_cron||'')}" data-enabled="${s.schedule_enabled?'1':'0'}">⏰ Harmonogram</button>
    <button class="btn-files-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}">📎 Pliki</button>
    <button class="btn-data-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}">🗃 Dane</button>
    <button class="btn-cats-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}">🏷️ Kategorie</button>
    <button class="btn-mapping-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}">🗺️ Mapowanie</button>
    <button class="btn-config-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}" data-currency="${currency}" data-rate="${s.exchange_rate||1}" data-stype="${s.source_type}" data-urluser="${s.url_user||''}" data-urlpass="${s.url_pass||''}">⚙️ Ust.</button>
    <button class="btn-logs-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}">📋 Logi</button>
    <button class="btn-del-supplier" data-id="${s.id}">🗑</button>
  </div>
</div>`;
  }

  /* ── Subiekt Import Modal (accessible from Hurtownie tab) ──────── */
  async function _openSubiektImportModal() {
    let status = {};
    try { status = await API.get('/sourcing/subiekt/status'); } catch {}

    const statusHtml = status.count > 0
      ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:10px;margin-bottom:16px">
           <span style="color:#10b981;font-size:1.1rem">✅</span>
           <div>
             <div style="font-weight:600;font-size:.88rem">${status.count} produktów w bazie Subiekta</div>
             ${status.last_import ? `<div style="font-size:.75rem;color:var(--text-muted)">Ostatni import: ${fmtDate(status.last_import)}</div>` : ''}
           </div>
         </div>`
      : `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:10px;margin-bottom:16px">
           <span style="font-size:1.1rem">⚠️</span>
           <div style="font-size:.85rem;color:var(--text-secondary)">Brak danych Subiekta — wgraj plik eksportu poniżej</div>
         </div>`;

    Modal.show({
      title: '📥 Import danych z Subiekta',
      body: `
        ${statusHtml}
        <div style="border:2px dashed var(--border);border-radius:12px;padding:28px;text-align:center;cursor:pointer;transition:border-color .2s;background:var(--bg-surface)" id="sub-modal-drop">
          <input type="file" id="sub-modal-file" accept=".xlsx,.xls,.csv" style="display:none">
          <div style="font-size:2rem;margin-bottom:6px">📂</div>
          <div style="font-weight:600;font-size:.92rem">Przeciągnij plik z Subiekta lub kliknij</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:4px">Format: .xlsx, .xls lub .csv (eksport z Subiekt GT)</div>
        </div>
        <div id="sub-modal-map-panel" style="margin-top:16px"></div>
      `,
      width: 720,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`,
    });

    // Bind drop zone events
    setTimeout(() => {
      const zone = document.getElementById('sub-modal-drop');
      const input = document.getElementById('sub-modal-file');
      if (!zone || !input) return;
      
      zone.addEventListener('click', () => input.click());
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--color-accent)'; });
      zone.addEventListener('dragleave', () => { zone.style.borderColor = 'var(--border)'; });
      zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.style.borderColor = 'var(--border)';
        if (e.dataTransfer.files[0]) _handleSubiektModalFile(e.dataTransfer.files[0], status.column_map || {});
      });
      input.addEventListener('change', () => {
        if (input.files[0]) _handleSubiektModalFile(input.files[0], status.column_map || {});
      });
    }, 50);
  }

  async function _handleSubiektModalFile(file, savedMap) {
    const panel = document.getElementById('sub-modal-map-panel');
    if (!panel) return;
    panel.innerHTML = '<div style="color:var(--text-muted);padding:12px;text-align:center"><span style="font-size:1.3rem">⏳</span> Analizuję plik...</div>';
    try {
      const fd = new FormData(); fd.append('file', file);
      const data = await API.upload('/sourcing/subiekt/preview', fd);
      data._file = file;

      const firstRow = data.preview?.[0] || {};
      const opts = ['', ...data.columns].map(c => {
        if (!c) return `<option value="">— nie mapuj —</option>`;
        const sampleVal = firstRow[c];
        const sampleStr = sampleVal !== undefined && sampleVal !== null && String(sampleVal).trim() !== '' 
            ? ` (np. ${String(sampleVal).substring(0, 30)})` 
            : '';
        return `<option value="${escHtml(c)}">${escHtml(c)}${escHtml(sampleStr)}</option>`;
      }).join('');
      const fields = FIELDS.map(f => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
          <label style="min-width:160px;font-size:.82rem;font-weight:${f.required?700:400}">${f.label} ${f.required?'<span style="color:#f87171">*</span>':''}</label>
          <select id="sub_modal_map_${f.key}" class="form-select" style="flex:1;font-size:.82rem;height:32px">${opts}</select>
        </div>
      `).join('');

      const previewRows = (data.preview || []).slice(0, 3).map(row =>
        `<tr>${data.columns.slice(0, 7).map(c => `<td style="font-size:.75rem;padding:3px 6px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(String(row[c] ?? ''))}</td>`).join('')}</tr>`
      ).join('');

      panel.innerHTML = `
        <div style="border:1px solid var(--border);border-radius:10px;padding:14px;background:var(--bg-elevated)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <span style="font-size:1rem">🗂</span>
            <span style="font-weight:700;font-size:.9rem">Mapowanie kolumn</span>
            <span style="font-size:.75rem;color:var(--text-muted);margin-left:auto">${data.fileType === 'csv' ? 'CSV' : 'Excel'} • ${data.columns.length} kolumn</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px">${fields}</div>
          <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
            <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">Podgląd danych (${(data.preview||[]).length} wierszy):</div>
            <div style="overflow-x:auto;max-height:120px">
              <table class="sourcing-table" style="font-size:.72rem;width:100%">
                <thead><tr>${data.columns.slice(0, 7).map(c => `<th style="padding:3px 6px;font-size:.7rem">${escHtml(c)}</th>`).join('')}</tr></thead>
                <tbody>${previewRows}</tbody>
              </table>
            </div>
          </div>
          <div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end">
            <button class="btn btn--primary" id="sub-modal-import-btn" style="display:flex;align-items:center;gap:6px">
              <span>✅</span> Importuj do bazy
            </button>
          </div>
        </div>
      `;

      // Restore saved map
      FIELDS.forEach(f => {
        const sel = document.getElementById(`sub_modal_map_${f.key}`);
        if (sel && savedMap[f.key]) sel.value = savedMap[f.key];
      });

      // Import handler
      document.getElementById('sub-modal-import-btn')?.addEventListener('click', async () => {
        const map = {};
        FIELDS.forEach(f => { const s = document.getElementById(`sub_modal_map_${f.key}`); if (s) map[f.key] = s.value; });
        if (!map.ean) { Toast.error('Musisz zmapować kolumnę EAN'); return; }
        setBtn('sub-modal-import-btn', true);
        try {
          const fd = new FormData(); fd.append('file', file); fd.append('columnMap', JSON.stringify(map));
          const r = await API.upload('/sourcing/subiekt/import', fd);
          Toast.success(`✅ Zaimportowano ${r.imported} produktów z Subiekta`);
          Modal.hide();
          renderSuppliers();
        } catch (e) { Toast.error(e.message); setBtn('sub-modal-import-btn', false); }
      });
    } catch (e) {
      panel.innerHTML = `<div style="color:#f87171;padding:12px;text-align:center">❌ ${escHtml(e.message)}</div>`;
    }
  }

  let _sourceType = 'url';
  // _setSourceType is defined in the api object below and exported via window.SourcingView


  function bindSupplierActions(list) {
    // Refresh all URL suppliers
    document.getElementById('sup-refresh-all-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('sup-refresh-all-btn');
      const prog = document.getElementById('sup-refresh-all-progress');
      btn.disabled = true; btn.textContent = '⏳ Odswiezam...';
      prog.style.display = 'block';
      prog.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem">Laczenie z hurtowniami...</div>';
      try {
        const r = await API.post('/sourcing/suppliers/refresh-all', {});
        const ok = r.results.filter(x => x.status === 'ok').length;
        const err = r.results.filter(x => x.status === 'error').length;
        prog.innerHTML = r.results.map(x =>
          `<div style="font-size:.82rem;padding:2px 0">
            ${x.status==='ok'?'✅':'❌'} <strong>${escHtml(x.name)}</strong>:
            ${x.status==='ok'?`${x.imported} SKU`:escHtml(x.error||'')}
          </div>`
        ).join('');
        Toast.success(`Odswiezono: ${ok} OK, ${err} bledow`);
        setTimeout(() => renderSuppliers(), 3000);
      } catch(e) { Toast.error(e.message); prog.innerHTML = ''; btn.disabled = false; }
    });

    // Subiekt import modal from suppliers tab
    document.getElementById('sup-subiekt-import-btn')?.addEventListener('click', () => {
      _openSubiektImportModal();
    });

    // Logs toggle
    document.getElementById('sup-show-logs-btn')?.addEventListener('click', () => {
      logsExpanded = !logsExpanded;
      document.getElementById('sup-logs-panel').style.display = logsExpanded ? 'block' : 'none';
      document.getElementById('sup-show-logs-btn').innerHTML = (logsExpanded ? '&#x25B2;' : '&#x25BC;') + ' Logi operacji';
      if (logsExpanded) loadLogs(null, 'sup-logs-panel');
    });

    // Per-supplier refresh
    document.querySelectorAll('.btn-refresh-supplier').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const sup = list.find(s => String(s.id) === String(id));
        const isActionApi = sup && sup.source_type === 'action_api';

        btn.innerHTML = '<span class="spin-inline"></span> Ładuje...'; btn.disabled = true;

        // Action API uses SSE streaming (may take several minutes)
        if (isActionApi) {
          // Insert progress bar under the card
          const card = btn.closest('.supplier-card');
          let progBar = card.querySelector('.action-prog-bar');
          if (!progBar) {
            progBar = document.createElement('div');
            progBar.className = 'action-prog-bar';
            progBar.style.cssText = 'padding:6px 12px;font-size:.78rem;color:var(--text-muted);background:var(--bg-elevated);border-radius:0 0 10px 10px;border-top:1px solid var(--border)';
            card.appendChild(progBar);
          }
          progBar.textContent = '⏳ Łączenie z Action API...';

          try {
            const token = localStorage.getItem('sg_token') || '';
            const company = localStorage.getItem('sg_company') || '';
            const response = await fetch(`/api/sourcing/suppliers/${id}/refresh`, {
              method: 'POST',
              headers: { 'X-User-Token': token, 'X-Company-Id': company }
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n\n');
              buffer = lines.pop();
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                  const ev = JSON.parse(line.substring(6));
                  if (ev.status === 'progress' && ev.message) {
                    progBar.textContent = '⏳ ' + ev.message;
                  } else if (ev.status === 'done') {
                    progBar.textContent = '✅ Zsynchronizowano ' + (ev.imported || 0) + ' SKU';
                    Toast.success(`✅ Action API: wczytano ${ev.imported || 0} SKU`);
                    setTimeout(() => { progBar.remove(); renderSuppliers(); }, 3000);
                  } else if (ev.status === 'error') {
                    throw new Error(ev.error || 'Nieznany błąd');
                  }
                } catch (parseErr) {
                  if (parseErr.message && parseErr.message.includes('Unexpected')) continue;
                  throw parseErr;
                }
              }
            }
          } catch(e) {
            Toast.error('Action API: ' + e.message);
            if (card.querySelector('.action-prog-bar')) card.querySelector('.action-prog-bar').remove();
          }
          btn.innerHTML = '🔄 Odswież'; btn.disabled = false;
          return;
        }

        // Normal (non-Action) suppliers
        try {
          let fd = null;
          if (sup && sup.source_type === 'file') {
            const inp = document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls,.xml,.csv';
            await new Promise(res => { inp.onchange = res; inp.click(); });
            if (!inp.files[0]) { btn.innerHTML='🔄 Odswież'; btn.disabled=false; return; }
            fd = new FormData(); fd.append('file', inp.files[0]);
          }
          const r = fd
            ? await API.upload(`/sourcing/suppliers/${id}/refresh`, fd)
            : await API.post(`/sourcing/suppliers/${id}/refresh`, {});
          Toast.success(`✅ Wczytano ${r.imported} SKU`);
          renderSuppliers();
        } catch(e) { Toast.error(e.message); btn.innerHTML='🔄 Odswież'; btn.disabled=false; }
      });
    });


    // Replace file
    document.querySelectorAll('.btn-replace-file').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const inp = document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls,.xml,.csv';
        await new Promise(res => { inp.onchange = res; inp.click(); });
        if (!inp.files[0]) return;
        btn.disabled = true; btn.textContent = '⏳ Zastepuje...';
        try {
          const fd = new FormData(); fd.append('file', inp.files[0]);
          const r = await API.upload(`/sourcing/suppliers/${id}/replace-file`, fd);
          Toast.success(`✅ Plik zastapiony — wczytano ${r.imported} SKU`);
          renderSuppliers();
        } catch(e) { Toast.error(e.message); btn.disabled=false; btn.textContent='📂 Zastąp plik'; }
      });
    });

    // Config (currency, rate, col_settings, name, urls, ftp)
    document.querySelectorAll('.btn-config-supplier').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const sup = list.find(s=>String(s.id)===String(id));
        const stype = btn.dataset.stype;
        Modal.show({
          title: `⚙️ Ustawienia: ${escHtml(btn.dataset.name)}`,
          body: `<div style="display:flex;flex-direction:column;gap:12px">
            <div class="form-group"><label class="form-label">Nazwa hurtowni</label>
              <input class="form-input" id="cfg-name" value="${escHtml(sup.name||'')}"></div>
            ${stype === 'url' ? `<div class="form-group"><label class="form-label">Link URL (plik XML/CSV)</label><input class="form-input" id="cfg-source-url" value="${escHtml(sup.source_url||'')}"></div>` : ''}
            ${stype === 'ftp' ? `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Host FTP</label><input class="form-input" id="cfg-ftp-host" value="${escHtml(sup.ftp_host||'')}"></div>
                <div class="form-group"><label class="form-label">Sciezka pliku</label><input class="form-input" id="cfg-ftp-path" value="${escHtml(sup.ftp_path||'')}"></div>
                <div class="form-group"><label class="form-label">Login</label><input class="form-input" id="cfg-ftp-user" value="${escHtml(sup.ftp_user||'')}"></div>
                <div class="form-group"><label class="form-label">Haslo (zostaw puste aby nie zmieniac)</label><input class="form-input" type="password" id="cfg-ftp-pass" placeholder="******"></div>
              </div>
            ` : ''}
            <div class="form-group"><label class="form-label">Waluta cennika</label>
              <select class="form-select" id="cfg-currency">
                ${['PLN','EUR','USD','CZK','GBP','HUF','RON'].map(c=>`<option value="${c}"${btn.dataset.currency===c?' selected':''}>${c}</option>`).join('')}
              </select></div>
            <div class="form-group"><label class="form-label">Kurs reczny (0 = automatyczny NBP)</label>
              <input class="form-input" id="cfg-rate" type="number" step="0.0001" min="0" value="${btn.dataset.rate||0}"></div>
            <div class="form-group"><label class="form-label">Ustawienia kolumn (JSON)</label>
              <textarea class="form-input" id="cfg-cols" style="min-height:80px;font-family:monospace;font-size:.78rem" placeholder='{"ean_field":"EAN","price_field":"CenaNetto","avail_field":"Dostepnosc","mfg_field":"Producent"}'></textarea>
              <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">Klucze: ean_field, price_field, avail_field, name_field, mfg_field</div>
            </div>
            ${stype === 'ntt_api' ? `<div style="border-top:1px solid var(--border);padding-top:10px">
              <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">🔌 Autoryzacja NTT API</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Client ID</label><input class="form-input" id="cfg-ntt-client-id" value="${escHtml(sup.ntt_client_id||'')}"></div>
                <div class="form-group"><label class="form-label">User ID</label><input class="form-input" id="cfg-ntt-user-id" value="${escHtml(sup.ntt_user_id||'')}"></div>
              </div>
              <div class="form-group"><label class="form-label">Client Secret</label><input class="form-input" id="cfg-ntt-client-secret" type="password" value="${escHtml(sup.ntt_client_secret||'')}"></div>
            </div>` : ''}
            ${stype === 'action_api' ? `<div style="border-top:1px solid var(--border);padding-top:10px">
              <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">🔌 Autoryzacja Action API</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Customer ID</label><input class="form-input" id="cfg-action-customer-id" value="${escHtml(sup.action_customer_id||'')}"></div>
                <div class="form-group"><label class="form-label">User Name</label><input class="form-input" id="cfg-action-user-name" value="${escHtml(sup.action_user_name||'')}"></div>
              </div>
              <div class="form-group"><label class="form-label">Action API Key</label><input class="form-input" id="cfg-action-api-key" type="password" value="${escHtml(sup.action_api_key||'')}"></div>
            </div>` : ''}
            ${stype === 'url' ? `<div style="border-top:1px solid var(--border);padding-top:10px">
              <div style="font-size:.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">🔐 Logowanie HTTP (opcjonalne)</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Login</label><input class="form-input" id="cfg-url-user" value="${escHtml(btn.dataset.urluser||'')}"></div>
                <div class="form-group"><label class="form-label">Hasło</label><input class="form-input" id="cfg-url-pass" type="password" value="${escHtml(btn.dataset.urlpass||'')}"></div>
              </div>
            </div>` : ''}
          </div>`,
          footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Anuluj</button>
                   <button class="btn btn--primary" id="cfg-save-btn" onclick="SourcingView._saveSupConfig('${id}')">Zapisz</button>`
        });
        const cs = list.find(s=>String(s.id)===String(id))?.col_settings;
        if(cs && cs!=='{}') document.getElementById('cfg-cols').value = cs;
      });
    });

    // Logs per supplier
    document.querySelectorAll('.btn-logs-supplier').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        Modal.show({
          title: `📋 Logi: ${escHtml(btn.dataset.name)}`,
          body: `<div id="modal-logs-content"><div style="color:var(--text-muted)">Ladowanie...</div></div>`,
          footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`
        });
        loadLogs(id, 'modal-logs-content');
      });
    });

    // Delete
    document.querySelectorAll('.btn-del-supplier').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Usunac te hurtownie i jej cennik?')) return;
        try { await API.del(`/sourcing/suppliers/${btn.dataset.id}`); Toast.success('Usunieto'); renderSuppliers(); }
        catch(e) { Toast.error(e.message); }
      });
    });

    // Toggle active/inactive
    document.querySelectorAll('.btn-toggle-active').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const currentlyActive = btn.dataset.active === '1';
        const newState = currentlyActive ? 0 : 1;
        try {
          await API.patch(`/sourcing/suppliers/${id}`, { is_active: newState });
          Toast.success(newState ? 'Hurtownia aktywna' : 'Hurtownia nieaktywna');
          renderSuppliers();
        } catch(e) { Toast.error(e.message); }
      });
    });

    // Schedule
    document.querySelectorAll('.btn-schedule-supplier').forEach(btn => {
      btn.addEventListener('click', () => showScheduleModal(btn.dataset.id, btn.dataset.name, btn.dataset.cron, btn.dataset.enabled === '1'));
    });

    // Main file preview
    document.querySelectorAll('.btn-preview-main-supplier').forEach(btn => {
      btn.addEventListener('click', () => showPreviewFileModal(btn.dataset.id, null, 'Główny Plik: ' + btn.dataset.name));
    });

    // Analyze main file (Mapping)
    document.querySelectorAll('.btn-analyze-supplier').forEach(btn => {
      btn.addEventListener('click', () => {
        Toast.success('Analiza uruchomiona. Trwa pobieranie kolumn...');
        setTimeout(() => _openMappingModal(btn.dataset.id, btn.dataset.name), 500);
      });
    });

    // Extra Files
    document.querySelectorAll('.btn-files-supplier').forEach(btn => {
      btn.addEventListener('click', () => showFilesModal(btn.dataset.id, btn.dataset.name));
    });

    // Add supplier
    document.getElementById('sup-add-btn')?.addEventListener('click', async () => {
      const name = document.getElementById('sup-name').value.trim();
      const url  = document.getElementById('sup-url').value.trim();
      const fileInp = document.getElementById('sup-file-input');
      const currency = document.getElementById('sup-currency').value;
      const rate = document.getElementById('sup-rate').value;
      if (!name) { Toast.error('Podaj nazwe hurtowni'); return; }
      if (_sourceType==='url'  && !url) { Toast.error('Podaj URL do cennika'); return; }
      if (_sourceType==='file' && !fileInp.files[0]) { Toast.error('Wybierz plik cennika'); return; }
      if (_sourceType==='ftp'  && !document.getElementById('sup-ftp-host')?.value.trim()) { Toast.error('Podaj host FTP'); return; }
      if (_sourceType==='ftp'  && !document.getElementById('sup-ftp-path')?.value.trim()) { Toast.error('Podaj sciezke pliku FTP'); return; }

      // Impakt: require login + password
      if (_sourceType === 'impakt_api') {
        const hasUser = !!document.getElementById('sup-impakt-user')?.value.trim();
        const hasPass = !!document.getElementById('sup-impakt-pass')?.value.trim();
        if (!hasUser || !hasPass) {
          Toast.error('Podaj login i hasło do Impakt API');
          return;
        }
      }

      // NTT: require clientId, userId, clientSecret
      if (_sourceType === 'ntt_api') {
        const hasClientId = !!document.getElementById('sup-ntt-client-id')?.value.trim();
        const hasUserId = !!document.getElementById('sup-ntt-user-id')?.value.trim();
        const hasClientSecret = !!document.getElementById('sup-ntt-client-secret')?.value.trim();
        if (!hasClientId || !hasUserId || !hasClientSecret) {
          Toast.error('Podaj Client ID, User ID oraz Client Secret do NTT API');
          return;
        }
      }

      // Action: require userName, actionApiKey
      if (_sourceType === 'action_api') {
        const hasUserName = !!document.getElementById('sup-action-user-name')?.value.trim();
        const hasApiKey = !!document.getElementById('sup-action-api-key')?.value.trim();
        if (!hasUserName || !hasApiKey) {
          Toast.error('Podaj User Name oraz Action API Key');
          return;
        }
      }

      // Elko: require either API key OR at least one brand file
      if (_sourceType === 'elko_api') {
        const hasApiKey = !!document.getElementById('sup-elko-key')?.value.trim();
        const hasBrandFile = ['adata','fellowes','intenso','kingston','mediarange','samsung','sandisk','transcend','trust']
          .some(bk => document.getElementById(`elko-file-${bk}`)?.files[0]);
        if (!hasApiKey && !hasBrandFile) {
          Toast.error('Podaj klucz API Elko lub wgraj co najmniej jeden plik per markę');
          return;
        }
      }

      setBtn('sup-add-btn', true);
      try {
        const fd = new FormData();
        fd.append('name', name); fd.append('source_type', _sourceType);
        fd.append('currency', currency); fd.append('exchange_rate', rate);
        if (_sourceType==='url') {
          fd.append('source_url', url);
          fd.append('url_user', document.getElementById('sup-url-user')?.value.trim()||'');
          fd.append('url_pass', document.getElementById('sup-url-pass')?.value||'');
        }
        if (_sourceType==='file') fd.append('file', fileInp.files[0]);
        if (_sourceType==='ftp') {
          fd.append('ftp_host',   document.getElementById('sup-ftp-host').value.trim());
          fd.append('ftp_port',   document.getElementById('sup-ftp-port').value || '21');
          fd.append('ftp_user',   document.getElementById('sup-ftp-user').value.trim());
          fd.append('ftp_pass',   document.getElementById('sup-ftp-pass').value);
          fd.append('ftp_path',   document.getElementById('sup-ftp-path').value.trim());
          fd.append('ftp_secure', document.getElementById('sup-ftp-secure').checked ? '1' : '0');
        }
        if (_sourceType==='elko_api') {
          const apiKey = document.getElementById('sup-elko-key')?.value.trim();
          if (apiKey) fd.append('elko_api_key', apiKey);
          const checkedBrands = [...document.querySelectorAll('.elko-brand-check:checked')].map(cb => cb.value);
          fd.append('elko_vendor_codes', JSON.stringify(checkedBrands));
          fd.set('currency', 'EUR');
        }
        if (_sourceType==='impakt_api') {
          fd.append('impakt_user', document.getElementById('sup-impakt-user').value.trim());
          fd.append('impakt_pass', document.getElementById('sup-impakt-pass').value);
          fd.append('impakt_api_url', document.getElementById('sup-impakt-url').value.trim() || 'https://api.etrade.pl');
        }
        if (_sourceType==='ntt_api') {
          fd.append('ntt_client_id', document.getElementById('sup-ntt-client-id').value.trim());
          fd.append('ntt_client_secret', document.getElementById('sup-ntt-client-secret').value);
          fd.append('ntt_user_id', document.getElementById('sup-ntt-user-id').value.trim());
        }
        if (_sourceType==='action_api') {
          fd.append('action_customer_id', document.getElementById('sup-action-customer-id').value.trim());
          fd.append('action_user_name', document.getElementById('sup-action-user-name').value.trim());
          fd.append('action_api_key', document.getElementById('sup-action-api-key').value.trim());
        }
        const addResult = await API.upload('/sourcing/suppliers', fd);
        const supplierId = addResult.id;

        // After creating, upload brand files if any were selected
        if (_sourceType === 'elko_api' && supplierId) {
          const uploaded = await SourcingView._uploadElkoBrandFiles(supplierId);
          if (uploaded > 0) {
            Toast.success(`✅ Hurtownia Elko dodana + ${uploaded} plik(ów) per markę wgrano`);
          } else {
            Toast.success('✅ Hurtownia dodana i cennik wczytany');
          }
        } else {
          Toast.success('✅ Hurtownia dodana i cennik wczytany');
        }
        renderSuppliers();
      } catch(e) { Toast.error(e.message); setBtn('sup-add-btn', false); }
    });


    // Currency selector
    document.getElementById('sup-currency').addEventListener('change', e => {
      document.getElementById('sup-rate-wrap').style.display = e.target.value !== 'PLN' ? 'block' : 'none';
    });

    // Data & Mapping Modals
    document.querySelectorAll('.btn-data-supplier').forEach(btn => {
      btn.addEventListener('click', () => {
        showSupplierDataModal(btn.dataset.id, btn.dataset.name);
      });
    });

    document.querySelectorAll('.btn-cats-supplier').forEach(btn => {
      btn.addEventListener('click', () => {
        showSupplierCatsModal(btn.dataset.id, btn.dataset.name);
      });
    });

    document.querySelectorAll('.btn-mapping-supplier').forEach(btn => {
      btn.addEventListener('click', () => {
        showSupplierMappingModal(btn.dataset.id, btn.dataset.name);
      });
    });
  }

  /* ══ SUPPLIER CATEGORIES MODAL ══════════════════════════════════════════ */
  async function showSupplierCatsModal(id, name) {
    const modalId = 'modal-supplier-cats';
    let m = document.getElementById(modalId);
    if (!m) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="${modalId}" class="modal-overlay" style="display:none;z-index:9999;padding:10px">
          <div class="modal" style="max-width:1200px;width:98%;max-height:92vh;display:flex;flex-direction:column">
            <div class="modal-header" style="flex-shrink:0">
              <h3 id="${modalId}-title">Kategorie Hurtowni</h3>
              <div style="display:flex;align-items:center;gap:4px">
                <button class="modal-maximize" onclick="toggleModalMax(this)" title="Maksymalizuj / Przywróć">⛶</button>
                <button class="modal-close" onclick="document.getElementById('${modalId}').style.display='none'">&times;</button>
              </div>
            </div>
            <div class="modal-body" style="flex:1;overflow:auto;min-height:0">
              <div style="display:flex;gap:10px;margin-bottom:10px;position:sticky;top:0;background:var(--bg-card);z-index:1;padding-bottom:8px">
                <input type="text" id="${modalId}-search" class="form-input" placeholder="🔍 Szukaj kategorii..." style="flex:1">
              </div>
              <div id="${modalId}-content">Ładowanie...</div>
            </div>
          </div>
        </div>
      `);
      m = document.getElementById(modalId);
      document.getElementById(`${modalId}-search`).addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll(`#${modalId}-content .cat-row`).forEach(row => {
          row.style.display = (row.dataset.cat || '').toLowerCase().includes(q) ? '' : 'none';
        });
      });
    }

    document.getElementById(`${modalId}-title`).textContent = `🏷️ Kategorie Hurtowni: ${name}`;
    m.style.display = 'flex';
    const cont = document.getElementById(`${modalId}-content`);
    cont.innerHTML = '<div class="sourcing-empty">⏳ Wczytywanie kategorii...</div>';

    try {
      const [res, abCatsRes] = await Promise.all([
        API.get(`/sourcing/suppliers/${id}/raw-categories`),
        API.get('/sourcing/catalog/category-tree').catch(() => null)
      ]);

      if (!res.categories || !res.categories.length) {
        cont.innerHTML = '<div class="sourcing-empty">Brak danych o kategoriach tej hurtowni. Odśwież dane hurtowni aby załadować kategorie.</div>';
        return;
      }

      // Build AB category options for remapping dropdown
      const abOptions = ['<option value="">-- brak mapowania --</option>'];
      if (abCatsRes && abCatsRes.tree) {
        function flattenTree(nodes, depth = 0) {
          for (const n of nodes) {
            abOptions.push(`<option value="${n.id}">${'  '.repeat(depth)}${escHtml(n.name)} (${n.total_count || n.product_count || 0})</option>`);
            if (n.children && n.children.length) flattenTree(n.children, depth + 1);
          }
        }
        flattenTree(abCatsRes.tree);
      }
      const abOptsHtml = abOptions.join('');

      let html = `
        <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:10px;">
          Znaleziono <strong>${res.total}</strong> unikalnych kategorii. Możesz przypisać kategorie do drzewa AB.
        </div>
        <table class="sourcing-table" style="width:100%;font-size:.84rem">
          <thead><tr>
            <th style="width:40%">Oryginalna kategoria hurtowni</th>
            <th class="num" style="width:8%">Prod.</th>
            <th style="width:28%">Przypisana do AB</th>
            <th style="width:24%">Akcja</th>
          </tr></thead>
          <tbody>
      `;

      res.categories.forEach(cat => {
        const mappedPath = cat.mapping ? escHtml(cat.mapping.full_path || cat.mapping.cat_name || '') : '';
        const mappedCatId = cat.mapping ? cat.mapping.cat_id : '';
        const catLeaf = cat.leaf;
        const rowId = `cat-map-row-${escHtml(catLeaf).replace(/[^a-z0-9]/gi, '_')}`;

        // Pre-select dropdown to matched category
        const preselectedOpts = abOptsHtml.replace(
          mappedCatId ? `value="${mappedCatId}"` : '____NOMATCH____',
          mappedCatId ? `value="${mappedCatId}" selected` : '____NOMATCH____'
        );

        html += `<tr class="cat-row" data-cat="${escHtml(cat.raw_cat)}" id="${rowId}">
          <td>
            <div style="font-weight:500;max-width:400px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(cat.raw_cat)}">${escHtml(cat.raw_cat)}</div>
            ${cat.raw_cat !== cat.leaf ? `<div style="font-size:.72rem;color:var(--text-muted)">Liść: ${escHtml(cat.leaf)}</div>` : ''}
          </td>
          <td class="num" style="font-weight:600">${cat.cnt}</td>
          <td>
            <span id="${rowId}-label" style="font-size:.8rem;color:${mappedPath ? 'var(--accent)' : 'var(--text-muted)'}">
              ${mappedPath || '<em>nie przypisana</em>'}
            </span>
          </td>
          <td>
            <div style="display:flex;gap:5px;align-items:center">
              <select class="form-input cat-ab-select" data-leaf="${escHtml(catLeaf)}" data-row="${rowId}" data-supplier="${id}"
                style="font-size:.78rem;padding:2px 6px;height:26px;flex:1">
                ${preselectedOpts}
              </select>
              <button class="btn btn--primary btn--sm cat-ab-save-btn" data-row="${rowId}" data-leaf="${escHtml(catLeaf)}" data-supplier="${id}"
                style="font-size:.74rem;padding:2px 8px;white-space:nowrap">
                💾
              </button>
            </div>
          </td>
        </tr>`;
      });

      html += '</tbody></table>';
      cont.innerHTML = html;

      // Restore existing selections
      res.categories.forEach(cat => {
        if (cat.mapping && cat.mapping.ab_category_id) {
          const rowId = `cat-map-row-${cat.leaf.replace(/[^a-z0-9]/gi, '_')}`;
          const sel = document.querySelector(`#${rowId} .cat-ab-select`);
          if (sel) sel.value = cat.mapping.ab_category_id;
        }
      });

      // Save button handlers
      cont.querySelectorAll('.cat-ab-save-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const rowId = btn.dataset.row;
          const leaf = btn.dataset.leaf;
          const supplierId = btn.dataset.supplier;
          const sel = document.querySelector(`#${rowId} .cat-ab-select`);
          const abCatId = sel ? sel.value : '';
          const origText = btn.textContent;
          btn.disabled = true; btn.textContent = '⏳';
          try {
            // Find or create the leaf category for this supplier and remap it
            const catData = await API.get(`/sourcing/catalog/categories?q=${encodeURIComponent(leaf)}`);
            const existing = Array.isArray(catData) ? catData.find(c => c.name.toLowerCase() === leaf.toLowerCase()) : null;
            if (existing) {
              await API.post('/sourcing/catalog/remap-category', { categoryId: existing.id, abCategoryId: abCatId ? parseInt(abCatId) : null });
              const lbl = document.getElementById(`${rowId}-label`);
              if (lbl) {
                const abName = sel.options[sel.selectedIndex]?.text?.trim() || '';
                lbl.innerHTML = abCatId ? `<span style="color:var(--accent)">${escHtml(abName)}</span>` : '<em>nie przypisana</em>';
              }
              Toast.success(`Przypisano: ${leaf} → ${sel.options[sel.selectedIndex]?.text?.trim() || 'brak'}`);
            } else {
              Toast.error(`Nie znaleziono kategorii "${leaf}" w bazie. Najpierw uruchom "Ustaw hurtownię AB" dla tej hurtowni.`);
            }
          } catch(e) {
            Toast.error(e.message);
          } finally {
            btn.disabled = false; btn.textContent = origText;
          }
        });
      });

    } catch(e) {
      cont.innerHTML = `<div class="sourcing-empty">❌ Błąd: ${escHtml(e.message)}</div>`;
    }
  }

  /* ══ DATA MODAL ══════════════════════════════════════════════════════════ */
  async function showSupplierDataModal(id, name, page=1, search='', manufacturer='', avail='') {
    const modalId = 'modal-supplier-data';
    let m = document.getElementById(modalId);
    if (!m) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="${modalId}" class="modal-overlay" style="display:none;z-index:9999;padding:10px">
          <div class="modal" style="max-width:1400px;width:98%;max-height:92vh;display:flex;flex-direction:column">
            <div class="modal-header" style="flex-shrink:0">
              <h3 id="${modalId}-title">Dane Hurtowni</h3>
              <div style="display:flex;align-items:center;gap:4px">
                <button class="modal-maximize" onclick="toggleModalMax(this)" title="Maksymalizuj / Przywróć">⛶</button>
                <button class="modal-close" onclick="document.getElementById('${modalId}').style.display='none'">&times;</button>
              </div>
            </div>
            <div class="modal-body" style="flex:1;overflow:auto;min-height:0">
              <div style="display:flex; gap:8px; margin-bottom:15px;position:sticky;top:0;background:var(--bg-card);z-index:1;padding-bottom:10px;flex-wrap:wrap">
                <input type="text" id="${modalId}-search" class="form-input" placeholder="Szukaj po kodzie, nazwie, EAN..." style="flex:2;min-width:200px" value="${escHtml(search)}">
                <select id="${modalId}-mfg" class="form-input" style="min-width:150px">
                  <option value="">Wszyscy producenci</option>
                </select>
                <select id="${modalId}-avail" class="form-input" style="min-width:130px">
                  <option value="">Wszystkie stany</option>
                  <option value="available">✅ Dostępne</option>
                  <option value="unavailable">❌ Niedostępne</option>
                  <option value="incoming">📦 Oczekiwane</option>
                </select>
                <button class="btn btn--primary" id="${modalId}-search-btn">Szukaj</button>
              </div>
              <div id="${modalId}-content">Ładowanie...</div>
            </div>
          </div>
        </div>
      `);
      m = document.getElementById(modalId);
      
      document.getElementById(`${modalId}-search-btn`).addEventListener('click', () => {
        const query = document.getElementById(`${modalId}-search`).value;
        const mfg = document.getElementById(`${modalId}-mfg`).value;
        const av = document.getElementById(`${modalId}-avail`).value;
        showSupplierDataModal(id, name, 1, query, mfg, av);
      });
      document.getElementById(`${modalId}-search`).addEventListener('keypress', e => {
        if(e.key === 'Enter') document.getElementById(`${modalId}-search-btn`).click();
      });
      document.getElementById(`${modalId}-avail`).addEventListener('change', () => {
        document.getElementById(`${modalId}-search-btn`).click();
      });
    }
    
    document.getElementById(`${modalId}-title`).textContent = `Dane Hurtowni: ${name}`;
    m.style.display = 'flex';
    const cont = document.getElementById(`${modalId}-content`);
    cont.innerHTML = '<div class="sourcing-empty">⏳ Wczytywanie danych...</div>';
    
    // Restore avail filter value in select
    const availSel = document.getElementById(`${modalId}-avail`);
    if (availSel) availSel.value = avail;

    try {
      const res = await API.get(`/sourcing/suppliers/${id}/products?page=${page}&search=${encodeURIComponent(search)}&manufacturer=${encodeURIComponent(manufacturer)}&availability=${encodeURIComponent(avail)}`);
      
      const mfgSel = document.getElementById(`${modalId}-mfg`);
      if (mfgSel && res.manufacturers) {
        mfgSel.innerHTML = '<option value="">Wszyscy producenci</option>' + res.manufacturers.map(m => `<option value="${escHtml(m)}"${manufacturer === m ? ' selected' : ''}>${escHtml(m)}</option>`).join('');
      }
      
      if (!res.products || !res.products.length) {
        cont.innerHTML = '<div class="sourcing-empty">Brak produktów do wyświetlenia.</div>';
        return;
      }
      
      const availIcon = { available:'✅', unavailable:'❌', incoming:'📦', unknown:'❓' };
      let html = `<table class="sourcing-table" style="width:100%;font-size:0.85rem">
        <thead>
          <tr>
            <th>Producent</th>
            <th>Kod Producenta</th>
            <th>EAN</th>
            <th>Nazwa</th>
            <th>Cena zak.</th>
            <th>Ilość</th>
            <th>Dost.</th>
          </tr>
        </thead>
        <tbody>`;
        
      res.products.forEach(p => {
        const icon = availIcon[p.availability] || '❓';
        html += `<tr>
          <td>${escHtml(p.manufacturer||'-')}</td>
          <td style="font-family:monospace;font-weight:600">${escHtml(p.manufacturer_code||'-')}</td>
          <td>${escHtml(p.ean||'-')}</td>
          <td><div style="max-width:360px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(p.name||'')}">${escHtml(p.name||'—')}</div></td>
          <td style="font-weight:600">${p.price!=null ? parseFloat(p.price).toFixed(2)+' zł' : '-'}</td>
          <td>${p.stock!=null ? p.stock : '-'}</td>
          <td title="${escHtml(p.availability||'')}">${icon}</td>
        </tr>`;
      });
      html += '</tbody></table>';

      
      // Pagination
      const totalPages = Math.ceil(res.total / res.limit);
      if (totalPages > 1) {
        html += `<div style="display:flex; justify-content:center; gap:5px; margin-top:15px; align-items:center;">`;
        if (page > 1) html += `<button class="btn btn--ghost btn--sm" onclick="SourcingView._showSupplierData(${id}, '${escHtml(name)}', ${page-1}, '${escHtml(search)}', '${escHtml(manufacturer)}', '${escHtml(avail)}')">Poprzednia</button>`;
        html += `<span style="padding:4px 8px;font-size:0.85rem;display:flex;align-items:center;gap:4px">
          Str. <input type="number" min="1" max="${totalPages}" value="${page}" 
                 style="width:50px;text-align:center;padding:2px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);border-radius:4px"
                 onchange="if(this.value>=1 && this.value<=${totalPages}) SourcingView._showSupplierData(${id}, '${escHtml(name)}', parseInt(this.value), '${escHtml(search)}', '${escHtml(manufacturer)}', '${escHtml(avail)}')"> 
          z ${totalPages} (${res.total} prod.)
        </span>`;
        if (page < totalPages) html += `<button class="btn btn--ghost btn--sm" onclick="SourcingView._showSupplierData(${id}, '${escHtml(name)}', ${page+1}, '${escHtml(search)}', '${escHtml(manufacturer)}', '${escHtml(avail)}')">Następna</button>`;
        html += `</div>`;
      } else {
        html += `<div style="text-align:center; margin-top:10px; font-size:0.8rem; color:#888;">Razem: ${res.total} produktów</div>`;
      }
      
      cont.innerHTML = html;
    } catch(e) {
      cont.innerHTML = `<div class="sourcing-empty" style="color:var(--danger)">Wystąpił błąd: ${e.message}</div>`;
    }
  }
  
  /* ══ MAPPING MODAL ═══════════════════════════════════════════════════════ */
  async function showSupplierMappingModal(id, name) {
    const modalId = 'modal-supplier-mapping';
    let m = document.getElementById(modalId);
    if (!m) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="${modalId}" class="modal-overlay" style="display:none;z-index:9999;padding:10px">
          <div class="modal" style="max-width:1400px;width:98%;max-height:92vh;display:flex;flex-direction:column">
            <div class="modal-header" style="flex-shrink:0">
              <h3 id="${modalId}-title">Mapowanie Hurtowni</h3>
              <div style="display:flex;align-items:center;gap:4px">
                <button class="modal-maximize" onclick="toggleModalMax(this)" title="Maksymalizuj / Przywróć">⛶</button>
                <button class="modal-close" onclick="document.getElementById('${modalId}').style.display='none'">&times;</button>
              </div>
            </div>
            <div class="modal-body" style="flex:1;overflow:auto;min-height:0">
              <div style="margin-bottom:15px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--bg-card);z-index:1;padding-bottom:10px">
                <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;">
                  <input type="checkbox" id="${modalId}-filter-unmapped" onchange="document.getElementById('${modalId}').classList.toggle('show-only-unmapped', this.checked)">
                  Pokaż tylko niezmapowane
                </label>
                <button class="btn btn--primary" id="${modalId}-save-btn">Zapisz Mapowanie</button>
              </div>
              <style>
                #${modalId}.show-only-unmapped tr.is-mapped { display: none !important; }
              </style>
              <div id="${modalId}-content">Ładowanie...</div>
            </div>
          </div>
        </div>
      `);
      m = document.getElementById(modalId);
    }
    
    document.getElementById(`${modalId}-title`).textContent = `Mapowanie Kolumn: ${name}`;
    m.style.display = 'flex';
    document.getElementById(`${modalId}-filter-unmapped`).checked = false;
    m.classList.remove('show-only-unmapped');
    
    const cont = document.getElementById(`${modalId}-content`);
    cont.innerHTML = '<div class="sourcing-empty">&#x23F3; Skanowanie struktury plik&oacute;w/API hurtowni...</div>';

    // ─── Znane pola dla każdego typu hurtowni (fallback gdy plik nie jest pobrany) ───
    // WAŻNE: każde pole SOURCE pojawia się tylko RAZ w obrębie jednego typu hurtowni
    // (brak duplikatów — 2 pola źródłowe nie mapują do tego samego targetu)
    const KNOWN_FIELDS_BY_TYPE = {

      // ─── ELKO eCommerce API (JSON) ──────────────────────────────────────────────
      elko_api: [
        // Identyfikatory
        'ean', 'vendorPartNumber', 'manufacturerPartNumber', 'sku', 'itemCode',
        'articleNo', 'referencNo', 'vendorCode', 'partNo', 'gtin', 'upc',
        // Nazwy i opisy
        'name', 'nameEn', 'namePl', 'shortDescription', 'longDescription',
        'descriptionPl', 'descriptionEn',
        // Producent / Marka
        'vendorName', 'brand', 'producerName', 'producerCode',
        // Ceny
        'price', 'priceNet', 'priceExpEur', 'pricePln', 'priceB2B',
        'priceGross', 'priceWithTax',
        'srpPriceNet', 'srpPrice', 'rrp',
        'currency',
        // Dostępność
        'qty', 'inStock', 'stockStatus', 'availableQty',
        'incomingQty', 'incomingStock',
        'deliveryDate', 'eta', 'shippingTimeInHour', 'leadTime',
        // Kategoria
        'categoryName', 'categoryId', 'categoryPath',
        'mainCategory', 'subCategory', 'mainCategoryTree', 'subCategoryTree',
        // Wymiary i waga
        'weight', 'weightNet', 'weightGross',
        'sizeWidth', 'sizeHeight', 'sizeLength',
        'packageWidth', 'packageHeight', 'packageDepth', 'packageWeight',
        // Warunki
        'vat', 'vatRate',
        'warrantyMonths', 'warrantyPeriod',
        'condition', 'isNew', 'isUsed',
        // Inne
        'imageUrl', 'productUrl', 'countryOfOrigin', 'energyClass',
        'isActive', 'tags', 'replacedBy', 'packageContent',
      ],

      // ─── Impakt API (JSON) ───────────────────────────────────────────────────────
      impakt_api: [
        // Identyfikatory
        'ean', 'index', 'partNumber', 'manufacturerCode', 'sku',
        // Nazwy i opisy
        'name', 'title', 'descriptionShort', 'description',
        // Producent
        'producer', 'producerCode',
        // Ceny
        'price', 'price_netto', 'price_brutto',
        // Dostępność
        'quantity', 'inStock', 'availability', 'unit',
        // Kategoria
        'category', 'categoryId', 'categoryPath',
        // Warunki
        'warranty', 'warrantyMonths', 'vat', 'vatRate',
        // Wymiary
        'weight', 'weightNet', 'width', 'height', 'depth',
        // Inne
        'imageUrl', 'images',
      ],

      // ─── Action SA / AB SA / ALSO — typowy format CSV z nagłówkami PL ───────────
      // Pola skanowane dynamicznie z pliku — tu jako fallback gdy plik nie jest pobrany
      ftp: [
        // Identyfikatory
        'Indeks', 'KodKreskowy', 'KodEAN', 'EAN', 'EAN13',
        'KodProducenta', 'SymbolProducenta', 'NrKatalogowy', 'Referencja',
        'SymbolKarty', 'TWR_KOD', 'TWR_EAN',
        // Nazwy
        'Nazwa', 'NazwaProduktu', 'Opis', 'OpisKrotki', 'Tytuł',
        'NamePL', 'NameEN',
        // Producent
        'Producent', 'Marka', 'Vendor', 'NazwaProducenta',
        // Ceny
        'CenaNetto', 'Cena', 'CenaZak', 'CenaBrutto', 'CenaSRP',
        'PriceNet', 'PricePLN', 'PriceGross', 'SRP',
        'Waluta', 'Currency',
        // Dostępność
        'Stan', 'Ilosc', 'IloscDostepna', 'StanMagazynowy',
        'Dostepnosc', 'NaStanie', 'Qty', 'Quantity',
        'IloscNadchodzaca', 'DataDostawy', 'ETA',
        'CzasDostawy', 'ShippingTime',
        // Kategoria
        'Kategoria', 'NazwaKategorii', 'GrupaTowarowa', 'Grupa',
        'CategoryName', 'CategoryPath',
        // Warunki
        'Gwarancja', 'GwarancjaMiesiace', 'WarrantyMonths',
        'VAT', 'StawkaVAT',
        'StanProduktu', 'Kondycja',
        // Wymiary
        'Waga', 'WagaNetto', 'WagaBrutto', 'WeightKg',
        'Szerokosc', 'Wysokosc', 'Glebokosc',
        'Width', 'Height', 'Depth',
        // Inne
        'URLZdjecia', 'Zdjecie', 'LinkProduktu',
        'KrajPochodzenia', 'KlasaEnergetyczna',
      ],

      // ─── Hurtownie plikowe (file upload) — te same co FTP ────────────────────────
      file: [
        'Indeks', 'KodKreskowy', 'EAN', 'EAN13', 'KodProducenta', 'SymbolProducenta',
        'NrKatalogowy', 'Referencja', 'TWR_KOD', 'TWR_EAN',
        'Nazwa', 'OpisKrotki', 'Opis',
        'Producent', 'Marka',
        'CenaNetto', 'CenaZak', 'CenaBrutto', 'CenaSRP', 'Waluta',
        'Stan', 'Ilosc', 'IloscDostepna', 'StanMagazynowy', 'Dostepnosc',
        'IloscNadchodzaca', 'DataDostawy', 'ETA', 'CzasDostawy',
        'Kategoria', 'NazwaKategorii', 'GrupaTowarowa',
        'Gwarancja', 'GwarancjaMiesiace', 'VAT', 'StanProduktu',
        'Waga', 'WagaNetto', 'Szerokosc', 'Wysokosc', 'Glebokosc',
        'URLZdjecia', 'KrajPochodzenia',
      ],

      // ─── Action API (JSON) ───────────────────────────────────────────────────────
      action_api: [
        'ean', 'Ean', 'eanCode', 'code', 'reference', 'sku', 'gtin', 'barcode',
        'name', 'Name', 'title',
        'producer', 'manufacturer', 'brand', 'Producer',
        'price', 'priceNet', 'Price', 'cena',
        'stock', 'quantity', 'available', 'Stock', 'stan',
      ],

      // ─── NTT API (JSON) ──────────────────────────────────────────────────────────
      ntt_api: [
        // Identyfikatory
        'ean', 'EAN', 'code', 'reference', 'sku', 'gtin', 'barcode',
        // Nazwa
        'name', 'product_name', 'produktNazwa',
        // Producent
        'manufacturer_name', 'manufacturer', 'brand', 'producent',
        // Cena
        'price', 'price_netto', 'priceNetto', 'cena',
        // Stan magazynowy
        'stock', 'stan', 'quantity', 'qty', 'ilosc',
        // Kategoria
        'category_name', 'category', 'kategoria',
        // Inne
        'vat', 'weight', 'description', 'image_url', 'product_url',
      ],

      // ─── URL feed (XML/CSV przez HTTP) — pola angielskie ─────────────────────────
      url: [
        'ean', 'gtin', 'sku', 'partNumber', 'manufacturerPartNumber', 'mpn',
        'name', 'title', 'description', 'shortDescription',
        'brand', 'manufacturer', 'vendor',
        'price', 'netPrice', 'grossPrice', 'srp', 'rrp', 'currency',
        'stock', 'qty', 'quantity', 'availability', 'inStock',
        'incomingQty', 'deliveryDate', 'eta', 'shippingTime',
        'category', 'categoryName', 'categoryPath',
        'warranty', 'vat', 'condition',
        'weight', 'width', 'height', 'depth',
        'imageUrl', 'productUrl',
      ],
    };

    try {
      const res = await API.get(`/sourcing/suppliers/${id}/mapping`);
      let fields = res.fields || [];
      const colSettings = res.colSettings || {};
      const sampleRow = res.sampleRow || {};
      const fallbackProduct = res.fallbackProduct || {};
      const sourceType = res.source_type || '';
      const totalProducts = res.total_products || 0;

      // Determine display name and icon for each type
      const TYPE_META = {
        elko_api:   { icon: '&#x26A1;', name: 'Elko API',   desc: 'dane pobierane przez API JSON' },
        impakt_api: { icon: '&#x1F50C;', name: 'Impakt API', desc: 'dane pobierane przez API JSON' },
        ntt_api:    { icon: '&#x1F50C;', name: 'NTT API',    desc: 'dane pobierane przez API NTT (online.ntt.pl)' },
        action_api: { icon: '&#x1F50C;', name: 'Action API', desc: 'dane pobierane przez API Action (api.action.pl)' },
        ftp:        { icon: '&#x1F4C2;', name: 'FTP/SFTP',  desc: 'plik CSV/Excel przez FTP' },
        file:       { icon: '&#x1F4C4;', name: 'Plik',       desc: 'wgrany plik CSV/Excel' },
        url:        { icon: '&#x1F310;', name: 'URL Feed',   desc: 'plik CSV/XML przez URL' },
      };

      let infoHtml = '';
      if (fields.length === 0 && KNOWN_FIELDS_BY_TYPE[sourceType]) {
        fields = KNOWN_FIELDS_BY_TYPE[sourceType];
        const meta = TYPE_META[sourceType] || { icon: '&#x1F4E6;', name: sourceType, desc: '' };
        infoHtml = `<div style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);border-radius:8px;padding:10px 14px;font-size:.82rem;color:var(--text-secondary);margin-bottom:12px">
          ${meta.icon} <strong>${meta.name}</strong> &mdash; ${meta.desc}. Poni&#x17C;ej pokazano typowe pola tego typu hurtowni.
          Mapowanie zostanie zastosowane przy nast&#x119;pnym od&#x15B;wie&#x17C;eniu (${totalProducts} produkt&oacute;w w bazie).
        </div>`;
      } else if (fields.length === 0) {
        infoHtml = `<div style="background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);border-radius:8px;padding:10px 14px;font-size:.82rem;color:var(--text-secondary);margin-bottom:12px">
          &#x2139;&#xFE0F; Nie wykryto struktury p&oacute;l. Kliknij <strong>&#x1F504; Od&#x15B;wie&#x17C;</strong> na karcie hurtowni, aby pobra&#x107; plik i zeskanowa&#x107; nag&#x142;&oacute;wki.
        </div>`;
      }

      // All mappable system fields (complete list)
      const TARGET_COLS = [
        { val: '', label: '-- Brak mapowania --' },
        { val: 'ean_field',            label: '&#x1F511; Kod EAN / GTIN / Barcode' },
        { val: 'manufacturer_code',    label: '&#x1F3F7;&#xFE0F; Kod producenta (PartNo / MPN)' },
        { val: 'price_field',          label: '&#x1F4B0; Cena zakupu (netto)' },
        { val: 'price_gross_field',    label: '&#x1F4B0; Cena zakupu (brutto)' },
        { val: 'srp_field',            label: '&#x1F4B0; Sugerowana cena detaliczna (SRP/RRP)' },
        { val: 'avail_field',          label: '&#x1F4E6; Dost&#x0119;pno&#x015B;&#x0107; / Stan magazynowy' },
        { val: 'incoming_stock_field', label: '&#x1F4E6; Stan w nadchodz&#x0105;cej dostawie' },
        { val: 'eta_field',            label: '&#x1F4C5; Data dostawy (ETA)' },
        { val: 'shipping_time_field',  label: '&#x1F69A; Czas dostawy (godz.)' },
        { val: 'name_field',           label: '&#x1F4DD; Nazwa produktu' },
        { val: 'mfg_field',            label: '&#x1F3ED; Producent / Marka' },
        { val: 'desc_field',           label: '&#x1F4C4; Opis produktu' },
        { val: 'cat_field',            label: '&#x1F5C2;&#xFE0F; Kategoria' },
        { val: 'warr_field',           label: '&#x1F6E1;&#xFE0F; Gwarancja' },
        { val: 'condition_field',      label: '&#x1F504; Stan produktu (nowy/u&#x017C;ywany)' },
        { val: 'vat_field',            label: '&#x1F9FE; Stawka VAT' },
        { val: 'currency_field',       label: '&#x1F4B1; Waluta (per wiersz)' },
        { val: 'weight_field',         label: '&#x2696;&#xFE0F; Waga' },
        { val: 'width_field',          label: '&#x1F4D0; Szeroko&#x015B;&#x0107;' },
        { val: 'height_field',         label: '&#x1F4CF; Wysoko&#x015B;&#x0107;' },
        { val: 'depth_field',          label: '&#x1F4CF; G&#x0142;&#x0119;boko&#x015B;&#x0107;' },
      ];
      const TARGET_LABEL = Object.fromEntries(TARGET_COLS.filter(t => t.val).map(t => [t.val, t.label]));

      // Comprehensive AUTO_MAP (Action / Akyga / Elko / Impakt / NTT / MCM / Platinet etc.)
      const AUTO_MAP = {
        ean_field: [
          'ean','ean13','eancode','gtin','upc','isbn','barcode',
          'kod_ean','kodean','ean_kod','kod kreskowy','kod_kreskowy',
          'product_ean','ean_number','twrean',
        ],
        manufacturer_code: [
          'vendorpartnumber','manufacturerpartnumber','manufacturercode',
          'vendorpartno','partno','part_number','part number','part no','part_no',
          'mpn','sku','symbol','symkar','indeks',
          'nr katalogowy','nr_katalogowy','numer_katalogowy','catalog_number',
          'item_code','item code','vendor_code','vendor code',
          'product_code','productcode','product code',
          'reference','ref','pn','referenceno','articleno','artikelnr','artikelnummer',
          'kod_produktu','symbol_producenta','twrcode',
          'vendorcode','itemcode',
        ],
        price_field: [
          'price','pricenet','price_net','priceexpeur','priceeur','pricev2','netprice',
          'cena','cena_netto','cena netto','netto',
          'b2b_price','cena_zakupu','price_wholesale','price_netto',
          'pricepln','priceexppln','priceexpv2','priceb2b',
          'cena1','price1','hek','cenazak','cost','wholesale','hurtowa',
        ],
        price_gross_field: [
          'pricegross','price_gross','pricebrutto','pricewithtax',
          'brutto','cena_brutto','cena brutto','gross_price','price_brutto',
        ],
        srp_field: [
          'srp','srpnet','srppricenet','srpprice','suggestedretailprice',
          'priceretail','price_retail','retail','rrp','msrp',
          'sugerowana','suggested_price','srp_net_price',
        ],
        avail_field: [
          'qty','quantity','instock','stock','availability','stockstatus','stockquantity',
          'availableqty','availablequantity',
          'stan','dostepnosc','ilosc','magazyn','stan_magazynowy','quantity_available',
          'inbox','ilosc_dostepna','na_stanie',
        ],
        incoming_stock_field: [
          'incomingqty','incomingstock','incomingquantity',
          'delivery_qty','dostawa_ilosc','incoming_qty','incoming_stock',
        ],
        eta_field: [
          'eta','etadate','estimatedarrival','deliverydate','delivery_date',
          'data_dostawy','data dostaw','dostawa_data','incomingdate',
        ],
        shipping_time_field: [
          'shippingtimeinhour','shippingtime','deliverytime','leadtime',
          'shipping_time','czas_dostawy','czas dostawy','delivery_time','lead_time',
        ],
        name_field: [
          'name','nameen','namepl','productname','title',
          'nazwa','product_name','opikar','nazwa_produktu',
          'description_short','short_desc','shortdescription','opis_krotki',
          'item description','towar','artykul',
        ],
        mfg_field: [
          'vendorname','vendor','brand','manufacturer','producername','producercode',
          'producent','marka','dostawca','producent_nazwa','nazwa_producenta','marka_produktu','producer',
        ],
        desc_field: [
          'description','descriptionen','descriptionpl','longdescription','long_description',
          'opis','desc','opis_produktu','long_desc','opis_dlugi','full_description',
          'packagecontent','packagecontentpl',
        ],
        cat_field: [
          'category','categoryname','categoryid','categorypath','categorytree',
          'maincategory','subcategory','maincategorytree','subcategorytree',
          'kategoria','category_name','nazwa_kategorii','kategoria_id','cat',
          'product_category','grupa','group','typ','type','rodzaj','dzial','klasa','class',
        ],
        warr_field: [
          'warranty','warrantymonths','warrantyperiod','guaranteeperiod',
          'gwarancja','guarantee','warranty_months','gwarancja_miesiac','gwarancja_miesiace','okres_gwarancji',
        ],
        condition_field: [
          'condition','productcondition','state','isnew','isused','isrefurbished',
          'stan_towaru','nowy_uzywany','stan_produktu','used','kondycja','bazar',
        ],
        vat_field: [
          'vat','vatrate','taxrate',
          'stawka_vat','tax','tax_rate','podatek',
        ],
        currency_field: [
          'currency','pricecurrency','waluta','cur','curr','currencycode',
        ],
        weight_field: [
          'weight','weightnet','weightgross','weightkg',
          'waga','waga_netto','waga_brutto','masa','masa_netto','weight_net','net_weight','weight_g','weight_kg','waga_kg',
          'packageweight',
        ],
        width_field: [
          'width','sizewidth','packagewidth',
          'szerokosc','szer','width_mm',
        ],
        height_field: [
          'height','sizeheight','packageheight',
          'wysokosc','wys','height_mm',
        ],
        depth_field: [
          'depth','length','sizelength','packagedepth',
          'glebokosc','glab','dlugosc','depth_mm','length_mm',
        ],
      };
      
      // Helper: find auto-mapping for a field name
      // usedTargets tracks which target columns are already taken (prevents 2 source fields
      // mapping to the same target e.g. both 'ean' and 'ean13' mapping to ean_field)
      const usedTargets = new Set();

      // Pre-fill usedTargets from existing manual colSettings
      for (const [k, v] of Object.entries(colSettings)) {
        if (v) usedTargets.add(k);
      }

      function findAutoMap(fieldName) {
        const fLow = String(fieldName).toLowerCase().trim();
        const fNorm = fLow.replace(/[\s\-]/g, '_');
        // Exact match first
        for (const [target, pats] of Object.entries(AUTO_MAP)) {
          if (usedTargets.has(target)) continue; // skip already-assigned targets
          if (pats.includes(fLow) || pats.includes(fNorm)) {
            usedTargets.add(target);
            return target;
          }
        }
        // Substring match (lower priority)
        for (const [target, pats] of Object.entries(AUTO_MAP)) {
          if (usedTargets.has(target)) continue;
          if (pats.some(p => fLow.includes(p) || (p.length > 3 && p.includes(fLow)))) {
            usedTargets.add(target);
            return target;
          }
        }
        return '';
      }

      let mappedCount = 0;
      let html = `<div style="margin-bottom:12px">${infoHtml}</div>`;
      html += `<div style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
        <span id="${modalId}-stats" style="font-size:.82rem;color:var(--text-muted)"></span>
        <button class="btn btn--ghost btn--sm" id="${modalId}-automap-btn">&#x1F50D; Auto-mapuj wszystko</button>
      </div>`;
      html += `<table class="sourcing-table" style="width:100%;font-size:0.85rem" id="${modalId}-table">
        <thead>
          <tr>
            <th style="width:30%">Pole w Hurtowni</th>
            <th style="width:45%">Przypisz do (ShopGold)</th>
            <th style="width:25%">Status</th>
          </tr>
        </thead>
        <tbody>`;
        
      fields.forEach(f => {
        const fLow = String(f).toLowerCase().trim();
        
        // 1. Check for manual override in colSettings
        let mappedTo = '';
        for (const [k, v] of Object.entries(colSettings)) {
          if (v && String(v).toLowerCase() === fLow) {
            mappedTo = k; break;
          }
        }
        
        // 2. Use findAutoMap (respects usedTargets — no duplicate targets)
        const autoMappedTo = mappedTo ? '' : findAutoMap(f);
        
        // Effective mapped value = manual override OR auto
        const effectiveMapped = mappedTo || autoMappedTo;
        const isMapped = !!effectiveMapped;
        if (isMapped) mappedCount++;
        const rowClass = isMapped ? 'is-mapped' : 'not-mapped';

        
        // Build select - pre-select auto-mapped or manually mapped value
        let selectHtml = `<select class="form-input" style="padding:4px 8px;font-size:0.82rem;height:32px" data-field="${escHtml(f)}">`;
        TARGET_COLS.forEach(tc => {
          const sel = (effectiveMapped === tc.val) ? 'selected' : '';
          selectHtml += `<option value="${tc.val}" ${sel}>${tc.label}</option>`;
        });
        selectHtml += `</select>`;
        
        // Status badge
        let statusHtml;
        if (mappedTo) {
          statusHtml = `<span style="background:rgba(16,185,129,.2);color:#10b981;padding:3px 8px;border-radius:12px;font-size:0.75rem;font-weight:600">✅ Ręcznie: ${TARGET_LABEL[mappedTo] || mappedTo}</span>`;
        } else if (autoMappedTo) {
          statusHtml = `<span style="background:rgba(99,102,241,.15);color:#818cf8;padding:3px 8px;border-radius:12px;font-size:0.75rem;font-weight:600">🔍 Auto: ${TARGET_LABEL[autoMappedTo] || autoMappedTo}</span>`;
        } else {
          statusHtml = `<span style="background:rgba(248,113,113,.12);color:#f87171;padding:3px 8px;border-radius:12px;font-size:0.75rem;font-weight:600">❌ Niezmapowane</span>`;
        }
        
        let sampleVals = Array.isArray(sampleRow[f]) ? sampleRow[f] : [sampleRow[f]];
        sampleVals = sampleVals.filter(v => v !== undefined && v !== null && String(v).trim() !== '');
        
        // Use fallback logic for API suppliers where raw sampleRow might be empty
        if (sampleVals.length === 0 && isMapped) {
           let fb = '';
           if (effectiveMapped === 'ean_field') fb = fallbackProduct.ean;
           else if (effectiveMapped === 'price_field') fb = fallbackProduct.price;
           else if (effectiveMapped === 'price_gross_field') fb = fallbackProduct.price_gross;
           else if (effectiveMapped === 'name_field') fb = fallbackProduct.name;
           else if (effectiveMapped === 'mfg_field') fb = fallbackProduct.manufacturer;
           else if (effectiveMapped === 'avail_field') fb = fallbackProduct.stock_quantity;
           else if (effectiveMapped === 'desc_field') fb = fallbackProduct.description;
           else if (effectiveMapped === 'cat_field') fb = fallbackProduct.category;
           else if (effectiveMapped === 'manufacturer_code') fb = fallbackProduct.manufacturer_code;
           
           if (fb !== undefined && fb !== null && String(fb).trim() !== '') {
             sampleVals = [fb];
           }
        }
        
        let sampleBadge = '';
        if (sampleVals.length > 0) {
          const encodedSamples = escHtml(JSON.stringify(sampleVals));
          const v = sampleVals[0];
          const txt = String(v).substring(0, 45);
          
          if (sampleVals.length > 1) {
            sampleBadge = `
              <div class="sample-cycler" data-samples="${encodedSamples}" data-idx="0" style="display:inline-flex;align-items:center;background:#f1f5f9;color:#475569;font-size:.7rem;font-weight:500;border-radius:6px;border:1px solid #e2e8f0;margin-top:4px;max-width:100%">
                <button type="button" onclick="cycleSample(this, -1)" style="border:none;background:rgba(0,0,0,0.05);cursor:pointer;padding:3px 6px;border-radius:6px 0 0 6px;color:#64748b;font-weight:bold" title="Poprzednia wartość">❮</button>
                <span class="sample-text" style="padding:3px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(String(v))}">np. ${escHtml(txt)}</span>
                <button type="button" onclick="cycleSample(this, 1)" style="border:none;background:rgba(0,0,0,0.05);cursor:pointer;padding:3px 6px;border-radius:0 6px 6px 0;color:#64748b;font-weight:bold" title="Następna wartość">❯</button>
              </div>`;
          } else {
            sampleBadge = `<span style="display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#f1f5f9;color:#475569;font-size:.7rem;font-weight:500;padding:3px 8px;border-radius:6px;border:1px solid #e2e8f0;margin-top:4px" title="${escHtml(String(v))}">np. ${escHtml(txt)}</span>`;
          }
        }
            
        html += `<tr class="${rowClass}" style="${isMapped ? '' : 'background:rgba(248,113,113,.04)'}">
          <td style="padding:8px 10px;max-width:250px">
            <div style="font-family:monospace;font-weight:600;font-size:0.82rem;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis" title="${escHtml(f)}">${escHtml(f)}</div>
            ${sampleBadge ? `<div style="margin-top:2px">${sampleBadge}</div>` : ''}
          </td>
          <td style="padding:6px 10px">
            <div style="display:flex;align-items:center;">
              ${selectHtml}
            </div>
          </td>
          <td style="padding:6px 10px">${statusHtml}</td>
        </tr>`;
      });
      html += '</tbody></table>';

      if (fields.length === 0 && !KNOWN_FIELDS_BY_TYPE[sourceType]) {
        html = '<div class="sourcing-empty">Brak danych o strukturze. Zaktualizuj hurtowni&#x119; aby pobra&#x107; nag&#x142;&oacute;wki.</div>';
      }

      cont.innerHTML = html;

      // Update stats badge
      const statsEl = document.getElementById(`${modalId}-stats`);
      if (statsEl && fields.length > 0) {
        const pct = Math.round(mappedCount / fields.length * 100);
        const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f87171';
        statsEl.innerHTML = `<span style="color:${color};font-weight:600">${mappedCount}/${fields.length} zmapowanych (${pct}%)</span>`;
      }

      // Auto-map all button
      const autoBtn = document.getElementById(`${modalId}-automap-btn`);
      if (autoBtn) {
        autoBtn.onclick = () => {
          let applied = 0;
          document.querySelectorAll(`#${modalId}-table select`).forEach(sel => {
            if (!sel.value) {
              const auto = findAutoMap(sel.dataset.field);
              if (auto) { sel.value = auto; applied++; }
            }
          });
          Toast.info(`Auto-mapowanie: zastosowano ${applied} nowych mapowa&#x0144;. Sprawdź i zapisz.`);
        };
      }

      const saveBtn = document.getElementById(`${modalId}-save-btn`);
      saveBtn.onclick = async () => {
        saveBtn.disabled = true; saveBtn.textContent = 'Zapisywanie...';

        try {
          const selects = document.querySelectorAll(`#${modalId}-table select`);
          const newSettings = {};
          selects.forEach(sel => {
            if (sel.value) {
               newSettings[sel.value] = sel.dataset.field; // Map Target -> Field (backend format)
            }
          });
          
          await API.post(`/sourcing/suppliers/${id}/mapping`, { colSettings: newSettings });
          Toast.success('Zapisano mapowanie. Kliknij "Odśwież" hurtownię, aby nałożyć nowe ustawienia.');
          document.getElementById(modalId).style.display = 'none';
        } catch(err) {
          Toast.error(err.message);
        } finally {
          saveBtn.disabled = false; saveBtn.textContent = 'Zapisz Mapowanie';
        }
      };
      
    } catch(e) {
      cont.innerHTML = `<div class="sourcing-empty" style="color:var(--danger)">Wystąpił błąd: ${e.message}</div>`;
    }
  }

  window.cycleSample = function(btn, dir) {
    const cycler = btn.closest('.sample-cycler');
    if (!cycler) return;
    try {
      const samples = JSON.parse(cycler.getAttribute('data-samples'));
      let idx = parseInt(cycler.getAttribute('data-idx'));
      idx += dir;
      if (idx < 0) idx = samples.length - 1;
      if (idx >= samples.length) idx = 0;
      cycler.setAttribute('data-idx', idx);
      
      const v = samples[idx];
      const txt = String(v).substring(0, 45);
      const span = cycler.querySelector('.sample-text');
      span.textContent = 'np. ' + txt;
      span.title = v;
    } catch(e) { console.error('Cycle sample err:', e); }
  };

  /* ══ SCHEDULE MODAL ══════════════════════════════════════════════════════ */
  const CRON_PRESETS = [
    { label: 'Co godzinę',           expr: '0 * * * *'   },
    { label: 'Co 4 godziny',         expr: '0 */4 * * *' },
    { label: 'Co 12 godzin',         expr: '0 */12 * * *'},
    { label: 'Raz dziennie (2:00)',   expr: '0 2 * * *'   },
    { label: 'Raz w tygodniu (pon.)', expr: '0 3 * * 1'   },
    { label: 'Własny…',              expr: 'custom'       },
  ];
  function cronDescription(expr) {
    if (!expr) return '—';
    const p = CRON_PRESETS.find(x => x.expr === expr && x.expr !== 'custom');
    return p ? p.label : expr;
  }

  function showScheduleModal(id, name, currentCron, currentEnabled) {
    const isCustom = !!(currentCron && !CRON_PRESETS.find(p => p.expr === currentCron && p.expr !== 'custom'));
    const presetOpts = CRON_PRESETS.map(p =>
      `<option value="${p.expr}"${(p.expr === currentCron || (p.expr==='custom' && isCustom)) ? ' selected' : ''}>${p.label}</option>`
    ).join('');
    Modal.show({
      title: `⏰ Harmonogram: ${escHtml(name)}`,
      body: `<div style="display:flex;flex-direction:column;gap:14px">
  <div class="form-group">
    <label class="form-label">Włącz automatyczne pobieranie</label>
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
      <input type="checkbox" id="sched-enabled" style="width:18px;height:18px" ${currentEnabled?'checked':''}>
      <span id="sched-lbl" style="font-size:.9rem">${currentEnabled?'Aktywny':'Wyłączony'}</span>
    </label>
  </div>
  <div class="form-group">
    <label class="form-label">Częstotliwość</label>
    <select class="form-select" id="sched-preset">${presetOpts}</select>
  </div>
  <div class="form-group" id="sched-custom-wrap" style="display:${isCustom?'block':'none'}">
    <label class="form-label">Własne wyrażenie CRON (5 pól)</label>
    <input class="form-input" id="sched-cron-input" placeholder="np. 0 */6 * * *" value="${escHtml(isCustom ? currentCron : '')}">
    <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">Format: minuta godzina dzień miesiąc dzień-tygodnia</div>
  </div>
  <div class="sched-info-box">
    ⏰ Aktualny: <strong>${escHtml(cronDescription(currentCron))}</strong>
    ${currentCron ? '' : '<em style="color:var(--text-muted)"> — brak harmonogramu</em>'}
  </div>
</div>`,
      footer: `<button class="btn btn--ghost btn--sm" onclick="Modal.hide()">Anuluj</button>
<button class="btn btn--secondary btn--sm" id="sched-now-btn">🔄 Odśwież teraz</button>
<button class="btn btn--primary" id="sched-save-btn">💾 Zapisz</button>`
    });
    document.getElementById('sched-preset').addEventListener('change', e => {
      document.getElementById('sched-custom-wrap').style.display = e.target.value==='custom' ? 'block' : 'none';
    });
    document.getElementById('sched-enabled').addEventListener('change', e => {
      document.getElementById('sched-lbl').textContent = e.target.checked ? 'Aktywny' : 'Wyłączony';
    });
    document.getElementById('sched-now-btn').addEventListener('click', async () => {
      const b = document.getElementById('sched-now-btn');
      b.disabled=true; b.textContent='⏳...';
      try { const r = await API.post(`/sourcing/suppliers/${id}/refresh`,{}); Toast.success(`✅ ${r.imported} SKU`); }
      catch(e) { Toast.error(e.message); }
      b.disabled=false; b.textContent='🔄 Odśwież teraz';
    });
    document.getElementById('sched-save-btn').addEventListener('click', async () => {
      const enabled  = document.getElementById('sched-enabled').checked;
      const preset   = document.getElementById('sched-preset').value;
      const cron_expr = preset === 'custom' ? document.getElementById('sched-cron-input').value.trim() : preset;
      try {
        await API.patch(`/sourcing/suppliers/${id}/schedule`, { cron_expr, enabled });
        Toast.success(enabled ? `✅ Harmonogram: ${cronDescription(cron_expr)}` : '⏸ Harmonogram wyłączony');
        Modal.hide(); renderSuppliers();
      } catch(e) { Toast.error(e.message); }
    });
  }

  /* ══ EXTRA FILES MODAL ═══════════════════════════════════════════════════ */
  async function showFilesModal(supplierId, supplierName) {
    Modal.show({
      title: `📎 Pliki dodatkowe: ${escHtml(supplierName)}`,
      body:  `<div id="sf-modal-body"><div style="color:var(--text-muted)">Ładowanie...</div></div>`,
      footer:`<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`
    });
    await renderFilesModalBody(supplierId);
  }

  async function renderFilesModalBody(supplierId) {
    const el = document.getElementById('sf-modal-body');
    if (!el) return;
    try {
      const files = await API.get(`/sourcing/suppliers/${supplierId}/files`);
      const ftLabel  = t => t==='full' ? '📦 Pełny' : t==='categories' ? '🏷️ Kategorie' : t==='attributes' ? '🛠️ Atrybuty' : t==='descriptions' ? '📝 Opisy' : '⚡ Stany/Ceny';
      const srcLabel = s => s==='url'  ? '🔗 URL'   : '📁 Plik';
      const fileRows = files.length ? files.map(f => `
<div class="sf-row" id="sf-row-${f.id}">
  <div class="sf-row-info" id="sf-info-${f.id}">
    <button class="btn btn--ghost btn--sm sf-preview-btn" data-fid="${f.id}" data-label="${escHtml(f.label)}" title="Podgląd pliku (Oczko)" style="padding:0 4px; margin-right:4px; font-size:1.05rem;">👁️</button>
    <span class="sf-label">${escHtml(f.label)}</span>
    <span class="sf-badge ft-${f.file_type}">${ftLabel(f.file_type)}</span>
    <span class="sf-badge src-${f.source_type}">${srcLabel(f.source_type)}</span>
    ${f.source_url ? `<input class="form-input sf-url-input-readonly" value="${escHtml(f.source_url)}" readonly title="Kliknij by zaznaczyć całość" style="height:24px;font-size:.75rem;padding:2px 6px;margin-left:4px;flex:1;max-width:250px;border-color:transparent;background:var(--bg-elevated);cursor:pointer" onclick="this.select()">` : ''}
    <span class="sf-date">${f.last_refresh ? 'odśw: '+fmtDate(f.last_refresh) : 'nie odświeżono'}</span>
    <span class="sf-badge ${f.schedule_enabled?'ft-full':'ft-stock_price'}" style="margin-left:4px">${f.schedule_enabled?'⏰ '+f.schedule_cron:'⏸ Brak harmonogramu'}</span>
  </div>
  <div class="sf-row-actions" id="sf-actions-${f.id}">
    <button class="btn btn--ghost btn--sm sf-schedule-btn" data-fid="${f.id}" data-name="${escHtml(f.label)}" data-cron="${escHtml(f.schedule_cron||'')}" data-enabled="${f.schedule_enabled?'1':'0'}" title="Harmonogram">⏰</button>
    <button class="btn btn--ghost btn--sm sf-ref-btn" data-fid="${f.id}" data-src="${f.source_type}" title="Odśwież">🔄</button>
    <button class="btn btn--ghost btn--sm sf-edit-btn" data-fid="${f.id}" title="Edytuj">✏️</button>
    <button class="btn btn--danger btn--sm sf-del-btn" data-fid="${f.id}" title="Usuń">🗑</button>
  </div>
  <div class="sf-edit-form" id="sf-edit-${f.id}" style="display:none; gap:6px; flex-wrap:wrap; padding:8px; background:var(--bg-elevated); border-radius:6px; width:100%; align-items:center; margin-top:6px;">
    <input class="form-input" id="sf-el-${f.id}" value="${escHtml(f.label)}" style="width:150px;font-size:.8rem" placeholder="Etykieta (Opis)">
    ${f.source_type === 'url' ? `<input class="form-input" id="sf-eu-${f.id}" value="${escHtml(f.source_url||'')}" style="flex:1;min-width:200px;font-size:.8rem" placeholder="https://...">` : '<div style="flex:1"></div>'}
    <select class="form-select" id="sf-ef-${f.id}" style="width:140px;font-size:.8rem;height:28px;padding:2px 6px">
      <option value="full" ${f.file_type==='full'?'selected':''}>📦 Pełny</option>
      <option value="stock_price" ${f.file_type==='stock_price'?'selected':''}>⚡ Stany/Ceny</option>
      <option value="categories" ${f.file_type==='categories'?'selected':''}>🏷️ Kategorie</option>
      <option value="attributes" ${f.file_type==='attributes'?'selected':''}>🛠️ Atrybuty</option>
      <option value="descriptions" ${f.file_type==='descriptions'?'selected':''}>📝 Opisy</option>
    </select>
    <button class="btn btn--primary btn--sm sf-save-btn" data-fid="${f.id}" style="height:28px;padding:0 8px">Zapisz</button>
    <button class="btn btn--secondary btn--sm sf-cancel-btn" data-fid="${f.id}" style="height:28px;padding:0 8px">Anuluj</button>
  </div>
</div>`).join('')
      : `<div style="color:var(--text-muted);font-size:.85rem;padding:6px 0">Brak plików dodatkowych.</div>`;

      el.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
<div class="sf-list">${fileRows}</div>
<hr style="border-color:var(--border);margin:2px 0">
<div style="font-size:.82rem;font-weight:700;color:var(--text-secondary)">➕ Dodaj plik dodatkowy</div>
<div class="form-group">
  <label class="form-label">Etykieta</label>
  <input class="form-input" id="sf-label" placeholder='np. "Stany i ceny" lub "Pełny cennik XML"' maxlength="60">
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
  <div class="form-group">
    <label class="form-label">Typ pliku</label>
    <select class="form-select" id="sf-file-type">
      <option value="full">📦 Pełny (wszystkie dane)</option>
      <option value="stock_price" selected>⚡ Stany + Ceny</option>
      <option value="categories">🏷️ Kategorie</option>
      <option value="attributes">🛠️ Atrybuty</option>
      <option value="descriptions">📝 Opisy</option>
    </select>
  </div>
  <div class="form-group">
    <label class="form-label">Źródło</label>
    <select class="form-select" id="sf-source-type">
      <option value="url">🔗 Link URL</option>
      <option value="file">📁 Plik z dysku</option>
    </select>
  </div>
</div>
<div id="sf-url-wrap" class="form-group">
  <label class="form-label">URL pliku</label>
  <input class="form-input" id="sf-url" placeholder="https://hurtownia.pl/stany.xml">
</div>
<div id="sf-file-wrap" class="form-group" style="display:none">
  <label class="form-label">Plik (.xlsx/.xml/.csv)</label>
  <input type="file" class="form-input" id="sf-file-input" accept=".xlsx,.xls,.xml,.csv" style="padding:6px">
</div>
<button class="btn btn--primary btn--sm" id="sf-add-btn">➕ Dodaj plik</button>
</div>`;

      document.getElementById('sf-source-type').addEventListener('change', e => {
        document.getElementById('sf-url-wrap').style.display  = e.target.value==='url'  ? 'block':'none';
        document.getElementById('sf-file-wrap').style.display = e.target.value==='file' ? 'block':'none';
      });

      el.querySelectorAll('.sf-ref-btn').forEach(b => {
        b.addEventListener('click', async () => {
          b.disabled=true; b.textContent='⏳';
          try {
            let r;
            if (b.dataset.src === 'file') {
              const inp = document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls,.xml,.csv';
              await new Promise(res => { inp.onchange=res; inp.click(); });
              if (!inp.files[0]) { b.disabled=false; b.textContent='🔄'; return; }
              const fd = new FormData(); fd.append('file', inp.files[0]);
              r = await API.upload(`/sourcing/suppliers/${supplierId}/files/${b.dataset.fid}/refresh`, fd);
            } else {
              r = await API.post(`/sourcing/suppliers/${supplierId}/files/${b.dataset.fid}/refresh`, {});
            }
            Toast.success(`✅ Wczytano ${r.imported} rekordów`);
            await renderFilesModalBody(supplierId);
          } catch(e) { Toast.error(e.message); b.disabled=false; b.textContent='🔄'; }
        });
      });

      el.querySelectorAll('.sf-preview-btn').forEach(b => {
        b.addEventListener('click', () => {
          showPreviewFileModal(supplierId, b.dataset.fid, 'Plik: ' + b.dataset.label);
        });
      });

      el.querySelectorAll('.sf-del-btn').forEach(b => {
        b.addEventListener('click', async () => {
          if (!confirm('Usunąć ten plik dodatkowy?')) return;
          try {
            await API.del(`/sourcing/suppliers/${supplierId}/files/${b.dataset.fid}`);
            Toast.success('Usunięto');
            await renderFilesModalBody(supplierId);
            renderSuppliers();
          } catch(e) { Toast.error(e.message); }
        });
      });

      // Edit buttons
      el.querySelectorAll('.sf-edit-btn').forEach(b => {
        b.addEventListener('click', () => {
          const fid = b.dataset.fid;
          document.getElementById(`sf-info-${fid}`).style.display = 'none';
          document.getElementById(`sf-actions-${fid}`).style.display = 'none';
          document.getElementById(`sf-edit-${fid}`).style.display = 'flex';
        });
      });
      el.querySelectorAll('.sf-cancel-btn').forEach(b => {
        b.addEventListener('click', () => {
          const fid = b.dataset.fid;
          document.getElementById(`sf-info-${fid}`).style.display = 'flex';
          document.getElementById(`sf-actions-${fid}`).style.display = 'flex';
          document.getElementById(`sf-edit-${fid}`).style.display = 'none';
        });
      });
      el.querySelectorAll('.sf-save-btn').forEach(b => {
        b.addEventListener('click', async () => {
          const fid = b.dataset.fid;
          const payload = {
            label: document.getElementById(`sf-el-${fid}`).value,
            file_type: document.getElementById(`sf-ef-${fid}`).value
          };
          const urlInput = document.getElementById(`sf-eu-${fid}`);
          if (urlInput) payload.source_url = urlInput.value.trim();

          try {
            b.disabled = true;
            await API.patch(`/sourcing/suppliers/${supplierId}/files/${fid}`, payload);
            Toast.success('Zapisano zmiany pliku');
            await renderFilesModalBody(supplierId);
          } catch(e) {
            Toast.error(e.message);
            b.disabled = false;
          }
        });
      });

      // Schedule button listener
      el.querySelectorAll('.sf-schedule-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const fid = btn.dataset.fid;
          const name = btn.dataset.name;
          const cronVal = btn.dataset.cron;
          const enabled = btn.dataset.enabled === '1';
          
          Modal.show({
            title: `⏰ Harmonogram pliku: ${escHtml(name)}`,
            body: `<div style="display:flex;flex-direction:column;gap:12px">
              <label style="display:flex;align-items:center;gap:8px">
                <input type="checkbox" id="sf-sched-enabled"${enabled?' checked':''}>
                Włącz automatyczne pobieranie tego pliku
              </label>
              <div class="form-group">
                <label class="form-label">Wyrażenie CRON (np. <code>0 * * * *</code> = co godzinę)</label>
                <input class="form-input" id="sf-sched-cron" value="${escHtml(cronVal||'0 * * * *')}">
                <div style="font-size:.7rem;color:var(--text-muted);margin-top:4px">
                  0 * * * * = co pełną godzinę<br>
                  */15 * * * * = co 15 minut<br>
                  0 2 * * * = codziennie o 2:00
                </div>
              </div>
            </div>`,
            footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Anuluj</button>
                     <button class="btn btn--primary" id="sf-sched-save-btn">Zapisz</button>`
          });
          
          document.getElementById('sf-sched-save-btn').onclick = async () => {
            const btnSave = document.getElementById('sf-sched-save-btn');
            btnSave.disabled = true; btnSave.textContent = 'Zapisywanie...';
            try {
              const payload = {
                enabled: document.getElementById('sf-sched-enabled').checked,
                cron: document.getElementById('sf-sched-cron').value.trim()
              };
              await API.patch(`/sourcing/suppliers/${supplierId}/files/${fid}/schedule`, payload);
              Toast.success('Zapisano harmonogram pliku');
              Modal.hide();
              renderFilesModalBody(supplierId);
            } catch(e) {
              Toast.error(e.message);
              btnSave.disabled = false; btnSave.textContent = 'Zapisz';
            }
          };
        });
      });

      document.getElementById('sf-add-btn').addEventListener('click', async () => {
        const label       = document.getElementById('sf-label').value.trim();
        const file_type   = document.getElementById('sf-file-type').value;
        const source_type = document.getElementById('sf-source-type').value;
        const source_url  = document.getElementById('sf-url')?.value.trim();
        const fileInp     = document.getElementById('sf-file-input');
        if (!label)                              { Toast.error('Podaj etykietę pliku'); return; }
        if (source_type==='url' && !source_url)  { Toast.error('Podaj URL'); return; }
        if (source_type==='file' && !fileInp?.files[0]) { Toast.error('Wybierz plik'); return; }
        const btn = document.getElementById('sf-add-btn');
        btn.disabled=true; btn.textContent='⏳...';
        try {
          const fd = new FormData();
          fd.append('label', label); fd.append('file_type', file_type); fd.append('source_type', source_type);
          if (source_type==='url')  fd.append('source_url', source_url);
          if (source_type==='file') fd.append('file', fileInp.files[0]);
          await API.upload(`/sourcing/suppliers/${supplierId}/files`, fd);
          Toast.success('✅ Plik dodatkowy dodany');
          await renderFilesModalBody(supplierId);
          renderSuppliers();
        } catch(e) { Toast.error(e.message); btn.disabled=false; btn.textContent='➕ Dodaj plik'; }
      });

    } catch(e) { el.innerHTML = `<div style="color:#f87171">${escHtml(e.message)}</div>`; }
  }

  async function loadLogs(supplierId, targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;
    try {
      const url = supplierId ? `/sourcing/logs?supplier_id=${supplierId}&limit=50` : '/sourcing/logs?limit=100';
      const logs = await API.get(url);
      if (!logs.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:.82rem;padding:8px">Brak logów</div>'; return; }
      el.innerHTML = `
<div class="sourcing-logs-panel">
  ${logs.map(l => `
  <div class="log-entry log-${l.status}">
    <span class="log-icon">${l.status==='ok'?'✅':l.status==='warn'?'⚠️':'❌'}</span>
    <div class="log-body">
      <div class="log-action">${escHtml(l.action)}</div>
      <div class="log-details">${escHtml(l.details||'')}</div>
    </div>
    <span class="log-time">${fmtDate(l.created_at)}</span>
  </div>`).join('')}
</div>`;
    } catch(e) { if(el) el.innerHTML = `<div style="color:#f87171;font-size:.82rem">${escHtml(e.message)}</div>`; }
  }

  /* ═══════════════════════════════════════════════════════
     TAB 3 — COMPARE
  ═══════════════════════════════════════════════════════ */
  async function renderCompare() {
    const el = document.getElementById('src-tab-compare');
    const params = new URLSearchParams();
    if (filterAvail)      params.set('onlyAvailable','true');
    if (filterSavings)   params.set('minSavingsPct', filterSavings);
    if (filterSearch)    params.set('search', filterSearch);
    if (filterMfg)       params.set('manufacturer', filterMfg);
    if (filterSupplierId) params.set('supplier_id', filterSupplierId);
    params.set('limit', String(comparePageSize));
    params.set('offset', String(comparePage * comparePageSize));
    if (sortCol) params.set('sortCol', sortCol);
    params.set('sortAsc', sortAsc ? 'true' : 'false');
    const cacheKey = `compare:${params}`;
    const cached = getTabCache(cacheKey);
    if (cached) {
      compareData = cached;
      renderCompareTable(el, cached);
      _bgRefresh(el, `/sourcing/compare?${params}`, cacheKey, d => { compareData = d; renderCompareTable(el, d); });
    } else {
      el.innerHTML = `<div style="padding:12px">${skeletonTable(8, 15)}</div>`;
      try {
        const d = await API.get(`/sourcing/compare?${params}`);
        setTabCache(cacheKey, d); compareData = d; renderCompareTable(el, d);
      } catch(e) { el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">⚠️</span><h3>Błąd</h3><p>${escHtml(e.message)}</p></div>`; }
    }
  }

  /* ── Background refresh helper ── */
  async function _bgRefresh(el, url, cacheKey, onDone) {
    const badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;bottom:16px;right:16px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);color:#f59e0b;font-size:.72rem;padding:5px 14px;border-radius:20px;z-index:999;display:flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(0,0,0,.2)';
    badge.innerHTML = '<div class="loader" style="width:10px;height:10px;border-width:2px;border-color:#f59e0b;border-bottom-color:transparent;margin:0;flex-shrink:0"></div> Odświeżam...';
    document.body.appendChild(badge);
    try {
      const fresh = await API.get(url);
      setTabCache(cacheKey, fresh);
      // Only update DOM if the tab element is still visible
      if (el.closest('.sourcing-tab-content.active')) onDone(fresh);
    } catch(_) {}
    badge.remove();
  }

  /* kolumny — widoczność (localStorage) */

  const CMP_ALL_COLS = ['ean','name','stock','sold_30d','buy_price','best_price','best_supplier','savings','savings_pct','signal'];
  const CMP_COL_LABELS = {ean:'EAN',name:'Nazwa',stock:'Stan',sold_30d:'Spr.30d',buy_price:'C.zakupu',best_price:'Najlepsza',best_supplier:'Hurtownia',savings:'Oszcz.zł',savings_pct:'Oszcz.%',signal:'Sygnał'};
  function getCmpHiddenCols() { try { return JSON.parse(localStorage.getItem('cmp_hidden')||'[]'); } catch { return []; } }
  function saveCmpHiddenCols(arr) { localStorage.setItem('cmp_hidden', JSON.stringify(arr)); }

  function renderCompareTable(el, data) {
    const rows = data.rows || [];
    const suppliers = data.suppliers || [];

    if (!data.rows && !data.suppliers) {
      el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">🔍</span><h3>Brak wynikow</h3>
        <p>Zaimportuj produkty z Subiekta i dodaj cenniki hurtowni.</p></div>`;
      return;
    }
    if (data.total != null && comparePage > 0 && rows.length === 0 && data.total > 0) {
      comparePage = Math.max(0, Math.ceil(data.total / comparePageSize) - 1);
      renderCompare();
      return;
    }

    const green  = data.stats?.green ?? rows.filter(r=>r.signal==='green').length;
    const yellow = data.stats?.yellow ?? rows.filter(r=>r.signal==='yellow').length;
    const red    = data.stats?.red ?? rows.filter(r=>r.signal==='red').length;
    const totalSav = data.stats?.totalSav ?? rows.reduce((s,r)=>s+(r.savings||0),0);
    const sorted = rows;
    const hidden = getCmpHiddenCols();
    const isHidden = col => hidden.includes(col);

    let CMP_COL_DEFS = [
      {key:'ean', label:'EAN', frozen:true, width:'120px'},
      {key:'name', label:'Nazwa', frozen:true, width:'250px'},
      {key:'manufacturer', label:'Producent', width:'130px'},
      {key:'stock', label:'Stan', width:'70px'},
      {key:'sold_30d', label:'Spr.30d', width:'80px'},
      {key:'buy_price', label:'C.zakupu', width:'100px'},
      {key:'buy_price_date', label:'Data zakupu', width:'100px'},
      {key:'best_price', label:'Najlepsza', width:'100px'},
      {key:'best_supplier', label:'Hurtownia', width:'130px'},
      {key:'savings', label:'Oszcz.zł', width:'90px'},
      {key:'savings_pct', label:'Oszcz.%', width:'80px'},
      {key:'signal', label:'Sygnał', width:'120px'},
      {key:'condition', label:'Stan', width:'80px'},
      {key:'warranty', label:'Gwarancja', width:'100px'}
    ];
    suppliers.forEach(s => {
      CMP_COL_DEFS.push({key: `sup_${s.id}`, label: s.name + (s.currency && s.currency !== 'PLN' ? ` (${s.currency})` : ''), width:'110px'});
    });

    const order = getColOrder('compare', CMP_COL_DEFS).filter(k => !isHidden(k));

    const savedWidths = (() => {
      try { return JSON.parse(localStorage.getItem('sg_colw_cmp-table') || '{}'); } catch { return {}; }
    })();

    const thead = order.map(k => {
      const d = CMP_COL_DEFS.find(x => x.key === k);
      if (!d) return '';
      let width = d?.width || '100px';

      // Load saved width from localStorage
      if (savedWidths[k]) {
        width = savedWidths[k] + 'px';
      }

      // Defensive minimum clamping for critical columns like 'name'
      let minWidth = width;
      if (k === 'name') {
        const parsedW = parseInt(width) || 250;
        if (parsedW < 150) {
          width = '250px';
          minWidth = '250px';
        }
      }

      const thAlign = (k === 'stock' || k === 'sold_30d') ? 'text-align:center;' : '';
      return `<th data-col="${k}" class="sortable cmp-th${sortCol===k?' sorted':''}" style="${thAlign}overflow:hidden;width:${width};min-width:${minWidth};position:relative">${escHtml(d.label)} <span class="sort-icon">${sortIcon(k)}</span><div class="col-resizer"></div></th>`;
    }).join('');

    const sigMap = {green:'🟢',yellow:'🟡',red:'🔴',none:'—'};
    const sigTitle = {green:'Opłacalne (Kup taniej)',yellow:'Neutralne (Podobna cena)',red:'Drożej (Nie opłaca się)',none:'Brak analizy'};
    const sigCls = {green:'green',yellow:'yellow',red:'red',none:'none'};

    function cmpCell(key, r) {
      switch(key) {
        case 'ean': return `<td class="ean-cell" ondblclick="navigator.clipboard.writeText('${r.ean}'); window.Toast?.success('Skopiowano EAN: ${r.ean}')" title="Dwuklik aby skopiować" style="cursor:pointer">${escHtml(r.ean)}</td>`;
        case 'name': {
          const refBtn = r.best_supplier_id ? `<span class="refresh-sup-btn" data-sup-id="${r.best_supplier_id}" data-sup-name="${escHtml(r.best_supplier||'')}" title="Odśwież cennik: ${escHtml(r.best_supplier||'')}" style="cursor:pointer;margin-left:6px;font-size:0.85rem">🔄</span>` : '';
          return `<td class="name-cell name-dblclick" data-ean="${r.ean}" title="Dwuklik = szczegoly produktu">${escHtml(r.name||'—')}${refBtn}</td>`;
        }
        case 'manufacturer': return `<td class="mfg-cell">${escHtml(r.manufacturer||'—')}</td>`;
        case 'stock': return `<td style="text-align:center">${r.stock??'—'}</td>`;
        case 'sold_30d': return `<td style="text-align:center">${r.sold_30d??'—'}</td>`;
        case 'buy_price': {
          const staleWarn = r.buy_price_stale ? '<div style="font-size:.62rem;color:#f59e0b;white-space:nowrap" title="Cena zakupu starsza niż 3 miesiące">⚠️ stara cena</div>' : '';
          return `<td class="price-cell">${fmtPLN(r.buy_price)}${staleWarn}</td>`;
        }
        case 'buy_price_date': {
          if (!r.buy_price_date) return '<td style="color:var(--text-muted);font-size:.75rem">—</td>';
          let dateStr = String(r.buy_price_date);
          let d;
          if (/^4\d{4}(\.\d+)?$/.test(dateStr)) {
            d = new Date((parseFloat(dateStr) - 25569) * 86400 * 1000);
          } else {
            d = new Date(dateStr);
            if (!isNaN(d.getTime()) && d.getFullYear() > 40000) {
              d = new Date((d.getFullYear() - 25569) * 86400 * 1000);
            }
          }
          if (isNaN(d.getTime())) return '<td style="color:var(--text-muted);font-size:.75rem">—</td>';
          const formatted = d.toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'});
          const isStale = r.buy_price_stale;
          return `<td style="font-size:.75rem;white-space:nowrap;${isStale?'color:#f59e0b;font-weight:600':'color:var(--text-muted)'}" title="${isStale?'Starsza niż 3 miesiące':''}">${formatted}${isStale?' ⚠️':''}</td>`;
        }
        case 'best_price': return `<td class="price-cell best-price price-clickable" data-ean="${r.ean}" title="Kliknij aby zobaczyc wszystkie oferty">${fmtPLN(r.best_price)}</td>`;
        case 'best_supplier': return `<td>${escHtml(r.best_supplier||'—')}</td>`;
        case 'savings': return `<td class="savings-cell ${r.savings>0?'savings-pos':r.savings<0?'savings-neg':''}">${r.savings!=null?(r.savings>0?'+':'')+fmtPLN(r.savings):'—'}</td>`;
        case 'savings_pct': return `<td class="savings-cell ${r.savings_pct>0?'savings-pos':r.savings_pct<0?'savings-neg':''}">${r.savings_pct!=null?r.savings_pct.toFixed(1)+'%':'—'}</td>`;
        case 'signal': {
          const staleNote = r.buy_price_stale ? '<div style="font-size:.58rem;color:#f59e0b;line-height:1">stara cena zak.</div>' : '';
          return `<td style="text-align:center"><span class="signal-badge ${sigCls[r.signal]||'none'}" title="${(sigTitle[r.signal]||'')}${r.buy_price_stale?' (cena zakupu starsza niż 3 mies.)':''}" style="padding:4px;font-size:1.1rem;background:transparent;box-shadow:none">${sigMap[r.signal]||'—'}</span>${staleNote}</td>`;
        }
        case 'condition': {
          const cond = r.condition || 'new';
          if (cond === 'used') return `<td style="text-align:center"><span style="display:inline-flex;align-items:center;gap:3px;background:#f59e0b22;color:#f59e0b;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap">🔶 Używany</span></td>`;
          return '<td style="text-align:center;color:var(--text-muted);font-size:.72rem">Nowy</td>';
        }
        case 'warranty': return `<td style="font-size:.78rem;color:var(--text-secondary)">${r.warranty ? fmtWarranty(r.warranty) : '—'}</td>`;
        default: 
          if (key.startsWith('sup_')) {
            const sid = parseInt(key.split('_')[1], 10);
            const sp = r.supplier_prices?.[sid];
            if (!sp) return `<td class="price-cell-empty">—</td>`;
            const avail = sp.availability==='available'?'✅':sp.availability==='unavailable'?'❌':'❓';
            const stockTxt = sp.stock_quantity != null ? ` <span style="font-size:0.75rem;color:var(--text-muted)">(${sp.stock_quantity} szt)</span>` : '';
            const origPrice = sp.orig_price && sp.currency && sp.currency!=='PLN' ? `<div style="font-size:.68rem;color:var(--text-muted)">${parseFloat(sp.orig_price).toFixed(2)} ${sp.currency}</div>` : '';
            return `<td class="price-cell price-clickable${r.best_supplier_id===sid?' best-price':''}" data-ean="${r.ean}" title="${avail} — kliknij aby zobaczyc wszystkie oferty">${fmtPLN(sp.price)}${stockTxt}${origPrice}</td>`;
          }
          return '<td></td>';
      }
    }

    // Pagination — rows already sliced on the server
    const totalRows = data.total != null ? data.total : sorted.length;
    const totalPages = Math.ceil(totalRows / comparePageSize) || 1;
    if (comparePage >= totalPages) comparePage = Math.max(0, totalPages - 1);
    if (comparePage < 0) comparePage = 0;
    const pageStart = totalRows === 0 ? 0 : comparePage * comparePageSize;
    const pageEnd = Math.min(pageStart + sorted.length, totalRows);
    const pageRows = sorted;

    const tbody = pageRows.map(r => {
      const usedCls = (r.condition === 'used') ? ' class="row-used"' : '';
      return `<tr data-ean="${r.ean}"${usedCls}>${order.map(k => cmpCell(k, r)).join('')}</tr>`;
    }).join('');

    const exportUrl = `/api/sourcing/compare/export?${new URLSearchParams({onlyAvailable:filterAvail,minSavingsPct:filterSavings||'',search:filterSearch})}`;

    // Build manufacturer list from both API allManufacturers AND current row data
    const mfgSet = new Set();
    // Filter out SKU/EAN-like values from manufacturer list
    const isValidMfg = (m) => {
      if (!m || m.trim().length < 2) return false;
      const t = m.trim();
      if (/^\d+$/.test(t)) return false;
      if (/^[\d\-\.\s]+$/.test(t)) return false;
      if (/^[A-Z]{1,4}[-_]?\d{3,}$/i.test(t)) return false;
      if (/^\d+[A-Z][-\w]*\d/i.test(t)) return false;
      if (/^\d+[A-Z]{1,4}$/i.test(t) && t.length >= 4) return false;
      if (/^\d+[-]/.test(t) && /\d/.test(t.slice(t.indexOf('-')))) return false;
      const digits = t.replace(/[^0-9]/g, '');
      const letters = t.replace(/[^A-Za-z\u00C0-\u024F]/g, '');
      if (digits.length > 0 && letters.length > 0 && digits.length / t.length > 0.4) return false;
      if (digits.length >= 8 && digits.length <= 14 && digits.length / t.length > 0.5) return false;
      if (/[\\/#]/.test(t)) return false;
      if (/^[A-Z0-9]{6,}$/i.test(t) && /\d/.test(t) && /[A-Z]/i.test(t) && !/\s/.test(t)) return false;
      if (/^[A-Z]{1,5}\d{2,}/i.test(t) && !/ /.test(t)) return false;
      // Multi-hyphen product codes (A-HDMI-DVI-1, A-CM-DPF-02)
      const hp = t.split('-');
      if (hp.length >= 3) return false;
      // Two-segment hyphen codes with digits (CM-M01R, CM-H92FB)
      if (hp.length === 2 && /[A-Z]/i.test(t) && /\d/.test(t) && t.length <= 15) return false;
      // Short all-uppercase codes (COJBG, COKBC, CONBD) — whitelist known brands
      const KNOWN = new Set(['ASUS','ACER','DELL','DEXP','EPSON','SONY','BEKO','BOSCH','NZXT','EVGA','ZOTAC','ATEN','AXLE','BENQ','EKWB','FLIR','GEIL','HAMA','HORI','IBOX','KOSS','MOZA','NIBE','OMEN','ONYX','OPPO','POCO','RODE','ROLI','SVEN','VIVO','VOGEL','WACOM','WERA','WIKO','XBOX','XGIMI','VESA']);
      if (/^[A-Z]{4,6}$/.test(t) && !KNOWN.has(t)) return false;
      // Model names with color: "13 BLACK", "22 BLACK 256GB", "16S BLACK"
      if (/^\d+\w?\s+[A-Z]/i.test(t) && /\b(BLACK|WHITE|BLUE|RED|GREEN|GOLD|SILVER|GREY|GRAY|ORANGE|PINK|PURPLE|BROWN|YELLOW|BEIGE|CREAM|FROST|UMBRA|ELITE|ULTRA|PRO)\b/i.test(t)) return false;
      // "17PRO BLACK", "23ULTRA ELITEBLACK"
      if (/^\d+[A-Z]+\s/i.test(t) && t.length <= 30) return false;
      // "COLOR 6 BLACK", "COLOR 6 BLUE"
      if (/^COLOR\s+\d/i.test(t)) return false;
      // Digit + space patterns (model names)
      if (/^\d+\s/.test(t) && t.length <= 25) return false;
      // Single letter + hyphen + code (A-HDMI, A-DVI)
      if (/^[A-Z]-[A-Z]{2,}/i.test(t) && t.length <= 20 && !/\s/.test(t)) return false;
      // Strings with parentheses — product codes
      if (/[()]/.test(t)) return false;
      // Hardware model names with tech keywords + digits
      if (/\b(ARGB|RGB|TG|DDR[3-6]|WIFI|ATX|MATX|ITX|NVME|SATA|PCIE|SSD|HDD|LP|PLUS|USB|HDMI|VGA|DVI|DP|LGA|AM[4-5]|SO-?DIMM|ECC|GDDR\d)\b/i.test(t) && /\d/.test(t)) return false;
      // Letter + digits + space + color (A21 PLUS TG ARGB BLACK)
      if (/^[A-Z]\d+\s/i.test(t) && /\b(BLACK|WHITE|BLUE|RED|GREEN|GOLD|SILVER|GREY|GRAY)\b/i.test(t)) return false;
      // Short alphanumeric codes: letter(s) + digits + space (A310 LP 4G)
      if (/^[A-Z]{1,3}\d{2,}\s/i.test(t)) return false;
      return true;
    };
    (compareData.allManufacturers || []).forEach(m => m && isValidMfg(m) && mfgSet.add(m));
    rows.forEach(r => r.manufacturer && isValidMfg(r.manufacturer) && mfgSet.add(r.manufacturer));
    const mfgOptions = [...mfgSet].sort((a,b) => a.localeCompare(b,'pl'))
      .map(m => `<option value="${escHtml(m)}"${filterMfg===m?' selected':''}>${escHtml(m)}</option>`).join('');

    el.innerHTML = `
<div class="compare-toolbar">
  <div class="toolbar-group"><label>🔍</label>
    <input class="compare-search" id="cmp-search" placeholder="Szukaj EAN/nazwa..." value="${escHtml(filterSearch)}">
  </div>
  <div class="toolbar-group">
    <label>Producent</label>
    <select id="cmp-mfg" class="form-input" style="min-width:130px">
      <option value="">Wszyscy</option>
      ${mfgOptions}
    </select>
  </div>
  <div class="toolbar-group">
    <label>Hurtownia</label>
    <select id="cmp-supplier" class="form-input" style="min-width:130px">
      <option value="">Wszystkie</option>
      ${compareData.suppliers.map(s=>`<option value="${s.id}"${filterSupplierId==s.id?' selected':''}>${escHtml(s.name)}</option>`).join('')}
    </select>
  </div>
  <div class="toolbar-group toggle-switch">
    <input type="checkbox" id="cmp-avail" ${filterAvail?'checked':''}><label for="cmp-avail">Tylko dostępne w hurt.</label>
  </div>
  <div class="toolbar-group">
    <label>Oszczędność ≥</label>
    <select id="cmp-savings" class="form-input">
      <option value="">Wszystkie</option>
      ${[5,10,15,20,30].map(v=>`<option value="${v}"${filterSavings===v?' selected':''}>${v}%</option>`).join('')}
    </select>
  </div>
  <div class="toolbar-group" style="margin-left:auto;gap:4px">
    <span style="font-size:.7rem;color:var(--text-muted)">Wyśw: <strong>${pageStart+1}–${pageEnd}</strong>/<strong>${totalRows}</strong></span>
    <input type="number" id="cmp-page-size" class="prof-input" style="width:45px;padding:2px 4px;font-size:.75rem" value="${comparePageSize}" min="10" max="5000" step="10" title="Wyników na stronę">
    <button class="btn btn--ghost btn--sm" id="cmp-pg-prev" ${comparePage<=0?'disabled':''} style="padding:2px 6px">←</button>
    <span style="font-size:.7rem;color:var(--text-muted)">${comparePage+1}/${totalPages}</span>
    <button class="btn btn--ghost btn--sm" id="cmp-pg-next" ${comparePage>=totalPages-1?'disabled':''} style="padding:2px 6px">→</button>
    <div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>
    <button class="btn btn--ghost btn--sm" id="cmp-cols-btn" title="Edytuj układ" style="padding:2px 6px">⚙️</button>
    <button class="btn btn--ghost btn--sm" id="cmp-refresh-btn" title="Odśwież wyniki" style="padding:2px 6px">🔄</button>
    <a class="btn btn--ghost btn--sm" href="${exportUrl}" download title="Pobierz plik CSV" style="padding:2px 6px">⬇️ CSV</a>
  </div>
</div>
<div class="compare-table-wrap src-scroll-x">
${rows.length === 0 
  ? `<div class="sourcing-empty" style="margin-top:20px;padding-bottom:40px"><span class="empty-icon">🔍</span><h3>Brak wynikow</h3><p>Brak produktów spełniających kryteria filtrowania.</p></div>`
  : `<table class="compare-table" id="cmp-table">
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>`
}
</div>
<div style="font-size:.72rem;color:var(--text-muted);margin-top:6px;padding:0 4px">
  💡 Kliknij na cenę aby zobaczyć oferty hurtowni &nbsp;|&nbsp; Dwuklik na nazwę = szczegóły produktu &nbsp;|&nbsp; Przeciągnij krawędź nagłówka = zmień szerokość kolumny
</div>`;

    // Fix broken encoding chars (garbled UTF-8 from Windows-1252 mojibake)
    (function() {
      const b = document.getElementById('cmp-cols-btn');
      if (b) b.innerHTML = '&#9881; Edytuj układ';
      document.querySelectorAll('.sort-icon').forEach(sp => {
        if (sp.textContent && sp.textContent.trim() !== '\u2191' && sp.textContent.trim() !== '\u2193') {
          sp.innerHTML = '&#x2195;';
        }
      });
    })();
    // Filtry
    let searchTimer;
    document.getElementById('cmp-search').addEventListener('input', e => {
      clearTimeout(searchTimer); searchTimer = setTimeout(() => { filterSearch = e.target.value; comparePage = 0; renderCompare(); }, 400);
    });
    document.getElementById('cmp-avail').addEventListener('change', e => { filterAvail = e.target.checked; comparePage = 0; renderCompare(); });
    const mfgSel = document.getElementById('cmp-mfg');
    if (mfgSel) mfgSel.addEventListener('change', e => { filterMfg = e.target.value; comparePage = 0; renderCompare(); });
    const supSel = document.getElementById('cmp-supplier');
    if (supSel) supSel.addEventListener('change', e => { filterSupplierId = e.target.value; comparePage = 0; renderCompare(); });
    document.getElementById('cmp-savings').addEventListener('change', e => { filterSavings = e.target.value; comparePage = 0; renderCompare(); });
    document.getElementById('cmp-refresh-btn').addEventListener('click', () => { comparePage=0; renderCompare(); });
    document.getElementById('cmp-pg-prev')?.addEventListener('click', () => { comparePage--; renderCompare(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.getElementById('cmp-pg-next')?.addEventListener('click', () => { comparePage++; renderCompare(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.getElementById('cmp-page-size')?.addEventListener('change', e => { const v = parseInt(e.target.value); if (v >= 10) { comparePageSize = v; comparePage = 0; renderCompare(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });

    // Kolumny toggle
    document.getElementById('cmp-cols-btn').addEventListener('click', () => {
      let CMP_COL_DEFS = [
        {key:'ean', label:'EAN', frozen:true, width:'120px'},
        {key:'name', label:'Nazwa', frozen:true, width:'250px'},
        {key:'manufacturer', label:'Producent', width:'130px'},
        {key:'stock', label:'Stan', width:'70px'},
        {key:'sold_30d', label:'Spr.30d', width:'80px'},
        {key:'buy_price', label:'C.zakupu', width:'100px'},
        {key:'buy_price_date', label:'Data zakupu', width:'100px'},
        {key:'best_price', label:'Najlepsza', width:'100px'},
        {key:'best_supplier', label:'Hurtownia', width:'130px'},
        {key:'savings', label:'Oszcz.zł', width:'90px'},
        {key:'savings_pct', label:'Oszcz.%', width:'80px'},
        {key:'signal', label:'Sygnał', width:'120px'},
        {key:'condition', label:'Stan', width:'80px'},
        {key:'warranty', label:'Gwarancja', width:'100px'}
      ];
      compareData.suppliers.forEach(s => {
        CMP_COL_DEFS.push({key: `sup_${s.id}`, label: s.name + (s.currency && s.currency !== 'PLN' ? ` (${s.currency})` : ''), width:'110px'});
      });
      showColLayoutModal('compare', CMP_COL_DEFS, (newOrder) => {
        saveColOrder('compare', newOrder);
        const allKeys = CMP_COL_DEFS.map(x => x.key);
        const newHidden = allKeys.filter(k => !newOrder.includes(k));
        saveCmpHiddenCols(newHidden);
        renderCompareTable(el, compareData);
      });
    });

    // Sortowanie
    document.querySelectorAll('#cmp-table th[data-col]').forEach(th => {
      th.addEventListener('click', e => {
        if (e.target.closest('input')) return;
        const col = th.dataset.col;
        if (sortCol === col) sortAsc = !sortAsc;
        else { sortCol = col; sortAsc = true; }
        comparePage = 0;
        renderCompare();
      });
    });

    // KLIKNIĘCIE NA CENĘ → modal ofert hurtowni
    document.querySelectorAll('.price-clickable[data-ean]').forEach(td => {
      td.addEventListener('click', () => showSupplierPricesModal(td.dataset.ean, compareData));
    });

    // KLIK LUB DWUKLIK NA NAZWĘ → popup produktu
    document.querySelectorAll('.name-dblclick[data-ean]').forEach(td => {
      td.addEventListener('dblclick', () => _showProductDetail(td.dataset.ean));
      td.addEventListener('click', () => _showProductDetail(td.dataset.ean));
    });

    // Resize + reorder kolumn
    bindColResizers(document.getElementById('cmp-table'));
    document.querySelectorAll('#cmp-table .ean-copy[data-ean]').forEach(td => {
      td.addEventListener('dblclick', () => copyEan(td.dataset.ean));
    });
  }

  /* ═══════════════════════════════════════════════════════
     UTILITIES: resize kolumn (JS) + zmiana kolejności (drag)
  ═══════════════════════════════════════════════════════ */
  let _resizeState = null;
  (function() {
    document.addEventListener('mousemove', e => {
      if (!_resizeState) return;
      const isNumCol = _resizeState.col === '#';
      const minW = isNumCol ? 40 : 20;
      const w = Math.max(minW, _resizeState.w0 + e.clientX - _resizeState.x0);
      _resizeState.th.style.width = w + 'px';
      _resizeState.th.style.minWidth = minW + 'px';
      _resizeState.th.style.maxWidth = isNumCol ? '40px' : w + 'px';

      // Dynamic real-time synchronization for Restock tables
      if (_resizeState.tableId === 'rst-table' && _resizeState.col) {
        document.querySelectorAll('[data-rst-table] th, .restock-table th').forEach(oth => {
          let ocol = oth.dataset.col;
          if (!ocol) {
            ocol = oth.textContent.replace(/[▲▼↕↑↓]/g, '').trim();
          }
          if (ocol === _resizeState.col) {
            oth.style.width = w + 'px';
            oth.style.minWidth = minW + 'px';
            oth.style.maxWidth = isNumCol ? '40px' : w + 'px';
          }
        });
      }
    });
    document.addEventListener('mouseup', () => {
      if (_resizeState) {
        // Save column width to localStorage
        try {
          const tid = _resizeState.tableId || 'unknown';
          const col = _resizeState.col || _resizeState.th.dataset.col || _resizeState.th.textContent.replace(/[▲▼↕↑↓]/g, '').trim();
          let w = _resizeState.th.offsetWidth;
          if (col === '#') w = 40;
          const saved = JSON.parse(localStorage.getItem('sg_colw_' + tid) || '{}');
          saved[col] = w;
          localStorage.setItem('sg_colw_' + tid, JSON.stringify(saved));

          // Re-sync on mouseup to ensure perfect symmetry across all restock tables
          if (tid === 'rst-table' && col) {
            document.querySelectorAll('[data-rst-table] th, .restock-table th').forEach(oth => {
              let ocol = oth.dataset.col || oth.textContent.replace(/[▲▼↕↑↓]/g, '').trim();
              if (ocol === col) {
                oth.style.width = w + 'px';
                oth.style.minWidth = '20px';
              }
            });
          }
        } catch(_) {}
        _resizeState = null; document.body.classList.remove('src-resizing');
      }
    });
  })();

  function initColResize(tableId) {
    const table = typeof tableId === 'string' ? document.getElementById(tableId) : tableId;
    if (!table) return;

    let tid = typeof tableId === 'string' ? tableId : (table.id || 'unknown');
    let storageKey = tid;
    if (storageKey.startsWith('rst-table') || table.hasAttribute('data-rst-table') || table.classList.contains('restock-table')) {
      storageKey = 'rst-table';
    }

    // Apply saved widths from localStorage
    const savedWidths = (() => { try { return JSON.parse(localStorage.getItem('sg_colw_' + storageKey) || '{}'); } catch { return {}; } })();

    table.querySelectorAll(':scope > thead > tr > th, :scope > tr > th, thead th').forEach(th => {
      let col = th.dataset.col;
      if (!col) {
        col = th.textContent.replace(/[▲▼↕↑↓]/g, '').trim();
      }
      if (!col) return;

      if (savedWidths[col]) {
        let w = savedWidths[col];
        if (col === '#' && w > 80) w = 40;
        th.style.width = w + 'px';
        th.style.minWidth = col === '#' ? '40px' : '20px';
        th.style.maxWidth = col === '#' ? '40px' : w + 'px';
      } else if (col === '#') {
        th.style.width = '40px';
        th.style.minWidth = '40px';
        th.style.maxWidth = '40px';
      }

      // Support both dynamically injected .col-rh and statically templated .col-resizer
      let handle = th.querySelector('.col-rh, .col-resizer');
      if (!handle) {
        th.style.position = 'relative'; th.style.overflow = 'hidden';
        handle = document.createElement('div');
        handle.className = 'col-rh';
        handle.title = 'Przeciągnij aby zmienić szerokość';
        th.appendChild(handle);
      }

      if (handle.dataset.resizeBound) return;
      handle.dataset.resizeBound = 'true';

      handle.addEventListener('mousedown', e => {
        let col = th.dataset.col;
        if (!col) {
          col = th.textContent.replace(/[▲▼↕↑↓]/g, '').trim();
        }

        // Freeze all column widths on mousedown to allow strict Excel-like resizing
        if (table && !table.dataset.resized) {
          const ths = Array.from(table.querySelectorAll(':scope > thead > tr > th, :scope > tr > th, thead th'));
          ths.forEach(t => {
            const w = t.getBoundingClientRect().width;
            let c = t.dataset.col || t.textContent.replace(/[▲▼↕↑↓]/g, '').trim();
            t.style.width = c === '#' ? '40px' : `${w}px`;
            t.style.minWidth = c === '#' ? '40px' : '20px';
            t.style.maxWidth = c === '#' ? '40px' : `${w}px`;
          });
          table.style.width = 'max-content';
          table.dataset.resized = 'true';
        }

        _resizeState = { th, x0: e.clientX, w0: th.offsetWidth, tableId: storageKey, col };
        document.body.classList.add('src-resizing');
        e.stopPropagation(); e.preventDefault();
      });
      handle.addEventListener('click', e => { e.stopPropagation(); });
    });
  }

  /* ═══════════════════════════════════════════════════════
     COLUMN LAYOUT SYSTEM  (saved to localStorage per tab)
  ═══════════════════════════════════════════════════════ */

  function getColOrder(tabKey, colDefs) {
    try {
      const raw = localStorage.getItem('sg_cols_' + tabKey);
      if (!raw) return colDefs.map(c => c.key);
      const stored = JSON.parse(raw);
      const allKeys = colDefs.map(c => c.key);
      const valid   = stored.filter(k => allKeys.includes(k));
      const added   = allKeys.filter(k => !valid.includes(k));
      return [...valid, ...added];
    } catch(e) { return colDefs.map(c => c.key); }
  }

  function saveColOrder(tabKey, order) {
    try { localStorage.setItem('sg_cols_' + tabKey, JSON.stringify(order)); } catch(e) {}
  }

  function showColLayoutModal(tabKey, colDefs, onApply) {
    let order = [...getColOrder(tabKey, colDefs)];
    const defsMap = Object.fromEntries(colDefs.map(c => [c.key, c]));

    function renderChips() {
      return order.map(k => {
        const d = defsMap[k]; if (!d) return '';
        const frozen = !!d.frozen;
        return `<div class="col-chip${frozen?' col-chip--frozen':''}" data-key="${k}" draggable="${frozen?'false':'true'}">
          <span class="col-chip-grip">${frozen ? '🔒' : '&#9776;'}</span>
          <span class="col-chip-label">${escHtml(d.label||k)}</span>
        </div>`;
      }).join('');
    }

    Modal.show({
      title: `✏️ Układ kolumn`,
      body: `<div class="col-layout-hint">Przeciągnij kafelki aby zmienić kolejność kolumn.<br>
Kliknij <strong>Zapisz układ</strong> aby zastosować zmiany.</div>
<div id="col-chips" class="col-chips">${renderChips()}</div>`,
      footer: `<button class="btn btn--ghost btn--sm" id="col-reset-btn">â†ş Domyślne</button>
<button class="btn btn--secondary" onclick="Modal.hide()">Anuluj</button>
<button class="btn btn--primary" id="col-save-btn">✓ Zapisz układ</button>`,
    });

    let dragKey = null;
    function bindDrag() {
      const wrap = document.getElementById('col-chips');
      if (!wrap) return;
      wrap.querySelectorAll('.col-chip:not(.col-chip--frozen)').forEach(chip => {
        chip.addEventListener('dragstart', e => {
          dragKey = chip.dataset.key;
          e.dataTransfer.effectAllowed = 'move';
        });
        chip.addEventListener('dragover', e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        });
        chip.addEventListener('drop', e => {
          e.preventDefault();
          const targetKey = chip.dataset.key;
          if (dragKey && dragKey !== targetKey) {
            const arr = order.filter(k => k !== dragKey);
            const tgIdx = arr.indexOf(targetKey);
            if (tgIdx >= 0) {
              arr.splice(tgIdx, 0, dragKey);
              order = arr;
              wrap.innerHTML = renderChips();
              bindDrag();
            }
          }
        });
      });
    }
    bindDrag();

    document.getElementById('col-save-btn').addEventListener('click', () => {
      onApply(order);
      Modal.hide();
    });
    document.getElementById('col-reset-btn').addEventListener('click', () => {
      order = [...getColOrder(tabKey, colDefs, true)]; // reset
      document.getElementById('col-chips').innerHTML = renderChips();
      bindDrag();
    });
  }

  /* ═══════════════════════════════════════════════════════
     COLUMN LAYOUT SYSTEM  (saved to localStorage per tab)
  ═══════════════════════════════════════════════════════ */

  function getColOrder(tabKey, colDefs) {
    try {
      const raw = localStorage.getItem('sg_cols_' + tabKey);
      if (!raw) return colDefs.map(c => c.key);
      const stored = JSON.parse(raw);
      const allKeys = colDefs.map(c => c.key);
      const valid   = stored.filter(k => allKeys.includes(k));
      const added   = allKeys.filter(k => !valid.includes(k));
      return [...valid, ...added];
    } catch(e) { return colDefs.map(c => c.key); }
  }

  function saveColOrder(tabKey, order) {
    try { localStorage.setItem('sg_cols_' + tabKey, JSON.stringify(order)); } catch(e) {}
  }

  function showColLayoutModal(tabKey, colDefs, onApply) {
    let order = [...getColOrder(tabKey, colDefs)];
    const defsMap = Object.fromEntries(colDefs.map(c => [c.key, c]));

    function renderChips() {
      return order.map(k => {
        const d = defsMap[k]; if (!d) return '';
        const frozen = !!d.frozen;
        return `<div class="col-chip${frozen?' col-chip--frozen':''}" data-key="${k}" draggable="${frozen?'false':'true'}">
          <span class="col-chip-grip">${frozen ? '🔒' : '&#9776;'}</span>
          <span class="col-chip-label">${escHtml(d.label||k)}</span>
        </div>`;
      }).join('');
    }

    Modal.show({
      title: `✏️ Układ kolumn`,
      body: `<div class="col-layout-hint">Przeciągnij kafelki aby zmienić kolejność kolumn.<br>
Kliknij <strong>Zapisz układ</strong> aby zastosować zmiany.</div>
<div id="col-chips" class="col-chips">${renderChips()}</div>`,
      footer: `<button class="btn btn--ghost btn--sm" id="col-reset-btn">â†ş Domyślne</button>
<button class="btn btn--secondary" onclick="Modal.hide()">Anuluj</button>
<button class="btn btn--primary" id="col-save-btn">✓ Zapisz układ</button>`,
    });

    let dragKey = null;
    function bindDrag() {
      const wrap = document.getElementById('col-chips');
      if (!wrap) return;
      wrap.querySelectorAll('.col-chip:not(.col-chip--frozen)').forEach(chip => {
        chip.addEventListener('dragstart', e => {
          dragKey = chip.dataset.key;
          setTimeout(() => chip.classList.add('col-chip--dragging'), 0);
          e.dataTransfer.effectAllowed = 'move';
        });
        chip.addEventListener('dragend', () => {
          chip.classList.remove('col-chip--dragging');
          wrap.querySelectorAll('.col-chip').forEach(c => c.classList.remove('col-chip--over'));
          dragKey = null;
        });
        chip.addEventListener('dragover', e => {
          e.preventDefault();
          wrap.querySelectorAll('.col-chip').forEach(c => c.classList.remove('col-chip--over'));
          chip.classList.add('col-chip--over');
        });
        chip.addEventListener('dragleave', () => chip.classList.remove('col-chip--over'));
        chip.addEventListener('drop', e => {
          e.preventDefault();
          chip.classList.remove('col-chip--over');
          if (!dragKey || dragKey === chip.dataset.key) return;
          const fi = order.indexOf(dragKey), ti = order.indexOf(chip.dataset.key);
          if (fi >= 0 && ti >= 0) {
            order.splice(fi, 1); order.splice(ti, 0, dragKey);
            wrap.innerHTML = renderChips(); bindDrag();
          }
        });
      });
    }
    bindDrag();

    document.getElementById('col-reset-btn')?.addEventListener('click', () => {
      order = colDefs.map(c => c.key);
      document.getElementById('col-chips').innerHTML = renderChips(); bindDrag();
    });
    document.getElementById('col-save-btn')?.addEventListener('click', () => {
      saveColOrder(tabKey, order); Modal.hide(); onApply(order);
    });
  }

  /** Kopiuje EAN do schowka i pokazuje Toast */
  function copyEan(ean) {
    navigator.clipboard?.writeText(String(ean)).then(() => {
      Toast.success('Skopiowano EAN: ' + ean);
    }).catch(() => {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = String(ean); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta); Toast.success('Skopiowano EAN: ' + ean);
    });
  }

  function sortRows(rows) {
    if (!sortCol) return rows.sort((a,b) => (b.savings_pct||0) - (a.savings_pct||0));
    return rows.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol && sortCol.startsWith('sup_')) {
        const sid = parseInt(sortCol.replace('sup_',''));
        av = a.supplier_prices?.[sid]?.price ?? Infinity;
        bv = b.supplier_prices?.[sid]?.price ?? Infinity;
      }
      if (av == null) av = sortAsc ? Infinity : -Infinity;
      if (bv == null) bv = sortAsc ? Infinity : -Infinity;
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? av - bv : bv - av;
    });
  }
  function sortIcon(col) { if (sortCol !== col) return 'â†•'; return sortAsc ? '↑' : '↓'; }
  function fmtPLN(v) { if (v==null||v==='') return '—'; return parseFloat(v).toFixed(2).replace('.',',')+' zł'; }
  function fmtDate(str) { if (!str) return '—'; return new Date(str).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

  function fmtBytes(b) {
    if (!b || b <= 0) return '?';
    const k = 1024, s = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + '\u00a0' + s[i];
  }

  /* ═══════════════════════════════════════════════════════
     PRODUCT DETAIL MODAL (Compare tab)
  ═══════════════════════════════════════════════════════ */
  function showProductModal(ean, data) {
    const r = data.rows.find(x => x.ean === ean);
    if (!r) return;
    const offers = [];
    if (data.suppliers && r.supplier_prices) {
      for (const s of data.suppliers) {
        const sp = r.supplier_prices[s.id];
        if (sp) offers.push({ name: s.name, price: sp.price, orig: sp.orig_price, currency: s.currency, avail: sp.availability, condition: sp.condition, warranty: sp.warranty });
      }
      offers.sort((a,b) => a.price - b.price);
    }
    const offerRows = offers.map((o,i) => `<tr${i===0?' class="best-row"':''}>
      <td>${i===0?'⭐ ':''}${escHtml(o.name)}</td>
      <td class="price-cell${i===0?' best-price':''}">${fmtPLN(o.price)}</td>
      <td>${o.avail==='available'?'✅':'❌'}</td>
      <td>${(o.condition||'new')==='used'?'<span style="color:#f59e0b;font-weight:600">🔶 Używany</span>':'Nowy'}</td>
      <td style="font-size:.78rem;color:var(--text-secondary)">${fmtWarranty(o.warranty)}</td>
    </tr>`).join('');
    Modal.show({
      title: `📦 ${escHtml(r.name || ean)}`,
      body: `
<div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:16px">
  <div style="width:80px;height:80px;background:var(--bg-elevated);border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0">📦</div>
  <div style="flex:1;min-width:200px">
    <h3 style="margin:0 0 6px;font-size:1rem">${escHtml(r.name||'—')}</h3>
    <div style="font-family:monospace;font-size:.8rem;color:var(--text-muted);margin-bottom:10px">EAN: ${escHtml(ean)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:.82rem">
      ${r.manufacturer?`<div class="prod-stat-mini"><span>Producent</span><strong>${escHtml(r.manufacturer)}</strong></div>`:''}
      ${r.buy_price!=null?`<div class="prod-stat-mini"><span>Cena zakupu</span><strong>${fmtPLN(r.buy_price)}</strong></div>`:''}
      ${r.best_price!=null?`<div class="prod-stat-mini"><span>Najlepsza cena</span><strong style="color:#10b981">${fmtPLN(r.best_price)}</strong></div>`:''}
      ${r.best_supplier?`<div class="prod-stat-mini"><span>Hurtownia</span><strong>${escHtml(r.best_supplier)}</strong></div>`:''}
      ${r.stock!=null?`<div class="prod-stat-mini"><span>Stan</span><strong>${r.stock}</strong></div>`:''}
      ${r.sold_30d!=null?`<div class="prod-stat-mini"><span>Spr. 30d</span><strong>${r.sold_30d}</strong></div>`:''}
      ${r.savings_pct!=null?`<div class="prod-stat-mini"><span>Oszczędność</span><strong class="${r.savings_pct>0?'savings-pos':'savings-neg'}">${r.savings_pct>0?'+':''}${r.savings_pct.toFixed(1)}%</strong></div>`:''}
      ${r.condition==='used'?'<div class="prod-stat-mini"><span>Stan</span><strong style="color:#f59e0b">🔶 Używany</strong></div>':''}
      ${r.warranty?`<div class="prod-stat-mini"><span>Gwarancja</span><strong>${fmtWarranty(r.warranty)}</strong></div>`:''}
    </div>
  </div>
</div>
${offers.length?`<div style="font-size:.82rem;font-weight:600;margin-bottom:6px">Oferty hurtowni (${offers.length})</div>
<table class="compare-table" style="font-size:.82rem">
  <thead><tr><th>Hurtownia</th><th>Cena PLN</th><th>Dost.</th><th>Stan</th><th>Gwarancja</th></tr></thead>
  <tbody>${offerRows}</tbody>
</table>`:'<div style="color:var(--text-muted);font-size:.82rem">Brak ofert hurtowni</div>'}`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`,
    });
  }

  /* ═══════════════════════════════════════════════════════
     SUPPLIER PRICES MODAL (click on price cell)
  ═══════════════════════════════════════════════════════ */
  async function showSupplierPricesModal(ean, data) {
    const r = data.rows.find(x => x.ean === ean);
    if (!r) return;
    const offers = [];
    if (data.suppliers && r.supplier_prices) {
      for (const s of data.suppliers) {
        const sp = r.supplier_prices[s.id];
        if (sp) offers.push({ name: s.name, price: sp.price, orig: sp.orig_price, currency: s.currency, avail: sp.availability, condition: sp.condition, warranty: sp.warranty });
      }
      offers.sort((a,b) => a.price - b.price);
    }
    const offerRows = offers.map((o,i) => {
      const origNote = o.orig && o.currency && o.currency!=='PLN' ? ` <span style="font-size:.7rem;color:var(--text-muted)">(${parseFloat(o.orig).toFixed(2)} ${o.currency})</span>` : '';
      return `<tr${i===0?' class="best-row"':''}>
        <td>${i===0?'⭐ ':''}${escHtml(o.name)}</td>
        <td class="price-cell${i===0?' best-price':''}">${fmtPLN(o.price)}${origNote}</td>
        <td>${o.avail==='available'?'✅ Dostępny':o.avail==='unavailable'?'❌ Brak':'❓'}</td>
        <td>${(o.condition||'new')==='used'?'<span style="color:#f59e0b;font-weight:600">🔶 Używany</span>':'Nowy'}</td>
        <td style="font-size:.78rem;color:var(--text-secondary)">${fmtWarranty(o.warranty)}</td>
      </tr>`;
    }).join('');

    // ── Subiekt section ──────────────────────────────────────────────────
    const subAvail = r.in_subiekt
      ? `<span style="color:#10b981;font-weight:600">✅ W ofercie</span>`
      : `<span style="color:#94a3b8">— Brak w Subiekcie</span>`;
    const subStock = r.stock != null ? r.stock : null;
    const subStockHtml = subStock != null
      ? (subStock > 10 ? `<span style="color:#10b981">${subStock} szt</span>`
        : subStock > 0 ? `<span style="color:#f59e0b">${subStock} szt (mało)</span>`
        : `<span style="color:#ef4444">0 szt (brak)</span>`)
      : `<span style="color:#94a3b8">—</span>`;
    const subSellPrice = r.sell_price != null ? r.sell_price : null;
    const subBuyPrice = r.buy_price != null ? r.buy_price : null;

    const subiektSection = r.in_subiekt || subStock != null || subSellPrice != null ? `
<div style="background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:16px;align-items:center">
  <div style="font-size:.72rem;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0">📦 Nasz Subiekt</div>
  <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:.82rem">
    <div><span style="color:var(--text-muted)">Status: </span>${subAvail}</div>
    ${subStock != null ? `<div><span style="color:var(--text-muted)">Stan mag.: </span>${subStockHtml}</div>` : ''}
    ${subSellPrice != null ? `<div><span style="color:var(--text-muted)">Cena sprzedaży: </span><strong style="color:var(--text-primary)">${fmtPLN(subSellPrice)}</strong></div>` : ''}
    ${subBuyPrice != null ? `<div><span style="color:var(--text-muted)">Cena zakupu: </span><strong>${fmtPLN(subBuyPrice)}</strong></div>` : ''}
    ${subSellPrice != null && offers.length > 0 && offers[0].price ? `<div><span style="color:var(--text-muted)">Marża: </span><strong style="color:${subSellPrice - offers[0].price > 0 ? '#10b981' : '#ef4444'}">${subSellPrice > 0 ? ((subSellPrice - offers[0].price) / subSellPrice * 100).toFixed(1) + '%' : '—'}</strong></div>` : ''}
  </div>
</div>` : '';

    Modal.show({
      title: `💰 Oferty dla: ${escHtml(r.name || ean)}`,
      body: `
<div style="margin-bottom:10px;font-size:.82rem;color:var(--text-secondary)">
  EAN: <strong style="font-family:monospace">${escHtml(ean)}</strong>
  ${r.savings_pct!=null?`&nbsp;|&nbsp; Oszczędność: <strong class="${r.savings_pct>0?'savings-pos':'savings-neg'}">${r.savings_pct>0?'+':''}${r.savings_pct.toFixed(1)}%</strong>`:''}
</div>
${subiektSection}
${offers.length?`<table class="compare-table" style="font-size:.82rem">
  <thead><tr><th>Hurtownia</th><th>Cena PLN</th><th>Dostępność</th><th>Stan</th><th>Gwarancja</th></tr></thead>
  <tbody>${offerRows}</tbody>
</table>`:'<div style="color:var(--text-muted);padding:16px;text-align:center">Brak ofert hurtowni dla tego produktu</div>'}
<div class="price-history-section" id="ph-section">
  ${loadingHtml}
</div>`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`,
    });


    try {
      const resp = await fetch(`/api/sourcing/price-history?ean=${encodeURIComponent(ean)}&days=30`);
      const phData = await resp.json();
      
      const sec = document.getElementById('ph-section');
      if (!sec) return; // modal closed
      
      if (!phData.history || phData.history.length === 0) {
        sec.innerHTML = `<div style="color:var(--text-muted);font-size:.82rem;text-align:center;padding:10px">Brak historii cen dla tego produktu</div>`;
        return;
      }

      // Render sparkline and history
      let svgLine = '';
      let svgPoints = '';
      let svgArea = '';
      const minP = phData.summary.min;
      const maxP = phData.summary.max;
      const history = phData.history;
      
      if (history.length > 1) {
        // Group by day to get min price per day
        const byDay = {};
        for(const h of history) {
          const d = h.recorded_at.split(' ')[0];
          if(!byDay[d] || h.price_pln < byDay[d].price_pln) byDay[d] = h;
        }
        const daily = Object.values(byDay).sort((a,b)=>new Date(a.recorded_at)-new Date(b.recorded_at));
        
        if (daily.length > 1) {
          const w = 100;
          const h = 40;
          const pMin = Math.max(0, minP - (maxP-minP)*0.1);
          const pMax = maxP + (maxP-minP)*0.1;
          const range = pMax - pMin || 1;
          
          let dPath = '';
          const pts = [];
          daily.forEach((pt, i) => {
            const x = (i / (daily.length - 1)) * w;
            const y = h - ((pt.price_pln - pMin) / range) * h;
            if (i === 0) dPath += `M${x},${y} `;
            else dPath += `L${x},${y} `;
            pts.push({x, y, date: pt.recorded_at.split(' ')[0], price: pt.price_pln});
          });
          
          svgLine = `<path class="sparkline-line" d="${dPath}"></path>`;
          svgArea = `<path class="sparkline-area" d="${dPath} L${w},${h} L0,${h} Z"></path>`;
          svgPoints = pts.map(p => `<circle class="sparkline-point" cx="${p.x}" cy="${p.y}" r="2"><title>${p.date}: ${fmtPLN(p.price)}</title></circle>`).join('');
          
          svgLine = `<svg viewBox="-2 -2 104 44" class="sparkline-chart" preserveAspectRatio="none">${svgArea}${svgLine}${svgPoints}</svg>`;
        }
      }
      
      const trendIcon = phData.summary.trend === 'up' ? '↗' : phData.summary.trend === 'down' ? '↘' : '→';
      const trendClass = phData.summary.trend === 'up' ? 'trend-up' : phData.summary.trend === 'down' ? 'trend-down' : 'trend-stable';

      const tableRows = [...history].reverse().map(h => {
        return `<tr>
          <td>${h.recorded_at.substring(0, 16)}</td>
          <td>${escHtml(h.supplier_name)}</td>
          <td class="ph-price">${fmtPLN(h.price_pln)}</td>
        </tr>`;
      }).join(''); // show newest first

      sec.innerHTML = `
        <div class="price-history-header">
          <span>📈 Historia cen (30 dni)</span>
        </div>
        <div class="price-history-summary">
          <div class="ph-stat"><span>Minimum</span><strong>${fmtPLN(phData.summary.min)}</strong></div>
          <div class="ph-stat"><span>Maksimum</span><strong>${fmtPLN(phData.summary.max)}</strong></div>
          <div class="ph-stat"><span>Średnia</span><strong>${fmtPLN(phData.summary.avg)}</strong></div>
          <div class="ph-stat"><span>Trend</span><strong class="${trendClass}">${trendIcon}</strong></div>
        </div>
        ${svgLine ? `<div class="sparkline-container" style="margin-top:12px">${svgLine}</div>` : ''}
        <div style="max-height:150px;overflow-y:auto;margin-top:12px;border:1px solid var(--border);border-radius:4px;">
          <table class="price-history-table">
            <thead><tr><th>Data i czas</th><th>Hurtownia</th><th>Cena PLN</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      `;

    } catch (e) {
      console.error(e);
      const sec = document.getElementById('ph-section');
      if(sec) sec.innerHTML = `<div style="color:#ef4444;font-size:.82rem;text-align:center">Błąd ładowania historii: ${e.message}</div>`;
    }
  }

  /* Helper: prosty modal dla zakładek Promo/Brakujące (bez pełnych danych compareData) */
  function showProductModalSimple(ean, rows, nameKey, priceKey, supplierKey) {
    const r = rows.find(x => x.ean === ean);
    if (!r) return;
    Modal.show({
      title: `📦 ${escHtml(r[nameKey] || ean)}`,
      body: `
<div style="display:flex;gap:18px;flex-wrap:wrap">
  <div style="width:80px;height:80px;background:var(--bg-elevated);border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0">📦</div>
  <div style="flex:1;min-width:200px">
    <h3 style="margin:0 0 6px;font-size:1rem">${escHtml(r[nameKey]||'—')}</h3>
    <div style="font-family:monospace;font-size:.8rem;color:var(--text-muted);margin-bottom:10px">EAN: ${escHtml(ean)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.82rem">
      ${r.manufacturer?`<div class="prod-stat-mini"><span>Producent</span><strong>${escHtml(r.manufacturer)}</strong></div>`:''}
      ${r[priceKey]!=null?`<div class="prod-stat-mini"><span>Najlepsza cena</span><strong style="color:#10b981">${fmtPLN(r[priceKey])}</strong></div>`:''}
      ${r[supplierKey]?`<div class="prod-stat-mini"><span>Hurtownia</span><strong>${escHtml(r[supplierKey])}</strong></div>`:''}
      ${r.availability!=null?`<div class="prod-stat-mini"><span>Dostępność</span><strong>${r.availability==='available'?'✅ Dostępny':'❌ Niedostępny'}</strong></div>`:''}
      ${r.stock!=null?`<div class="prod-stat-mini"><span>Stan Subiekt</span><strong>${r.stock}</strong></div>`:''}
      ${r.savings_pct!=null?`<div class="prod-stat-mini"><span>Oszczędność</span><strong class="savings-pos">-${r.savings_pct.toFixed(1)}%</strong></div>`:''}
    </div>
  </div>
</div>`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`,
    });
  }

  /* Helper: modal ofert dla zakładki Promocje */
  function showPromoOffersModal(ean, rows, suppliers) {
    const r = rows.find(x => x.ean === ean);
    if (!r) return;

    const offers = [];
    if (suppliers && r.supplier_prices) {
      for (const s of suppliers) {
        const sp = r.supplier_prices[s.id];
        if (sp) offers.push({ name: s.name, price: sp.price, orig: sp.orig_price, currency: s.currency, avail: sp.availability, condition: sp.condition, warranty: sp.warranty });
      }
      offers.sort((a,b) => a.price - b.price);
    }
    
    // Add reference price as an artificial row if not already in offers
    let refNote = '';
    if (r.ref_price && offers.length === 1) {
       refNote = `<div style="margin-top:10px;font-size:0.8rem;color:var(--text-muted)">Cena referencyjna (${escHtml(r.ref_label)}): <strong>${fmtPLN(r.ref_price)}</strong></div>`;
    }

    const offerRows = offers.map((o,i) => {
      const origNote = o.orig && o.currency && o.currency!=='PLN' ? ` <span style="font-size:.7rem;color:var(--text-muted)">(${parseFloat(o.orig).toFixed(2)} ${o.currency})</span>` : '';
      return `<tr${i===0?' class="best-row"':''}>
        <td>${i===0?'⭐ ':''}${escHtml(o.name)}</td>
        <td class="price-cell${i===0?' best-price':''}">${fmtPLN(o.price)}${origNote}</td>
        <td>${o.avail==='available'?'✅ Dostępny':o.avail==='unavailable'?'❌ Brak':'❓'}</td>
        <td>${(o.condition||'new')==='used'?'<span style="color:#f59e0b;font-weight:600">🔶 Używany</span>':'Nowy'}</td>
        <td style="font-size:.78rem;color:var(--text-secondary)">${fmtWarranty(o.warranty)}</td>
      </tr>`;
    }).join('');

    // ── Subiekt section ──────────────────────────────────────────────
    const subAvailP = r.in_subiekt
      ? `<span style="color:#10b981;font-weight:600">✅ W ofercie</span>`
      : `<span style="color:#94a3b8">— Brak w Subiekcie</span>`;
    const subStockP = r.stock != null ? r.stock : null;
    const subStockHtmlP = subStockP != null
      ? (subStockP > 10 ? `<span style="color:#10b981">${subStockP} szt</span>`
        : subStockP > 0 ? `<span style="color:#f59e0b">${subStockP} szt (mało)</span>`
        : `<span style="color:#ef4444">0 szt (brak)</span>`)
      : `<span style="color:#94a3b8">—</span>`;
    const subSellPriceP = r.sell_price != null ? r.sell_price : null;
    const subBuyPriceP = r.buy_price != null ? r.buy_price : null;
    const subiektSectionP = r.in_subiekt || subStockP != null || subSellPriceP != null ? `
<div style="background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:16px;align-items:center">
  <div style="font-size:.72rem;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0">📦 Nasz Subiekt</div>
  <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:.82rem">
    <div><span style="color:var(--text-muted)">Status: </span>${subAvailP}</div>
    ${subStockP != null ? `<div><span style="color:var(--text-muted)">Stan mag.: </span>${subStockHtmlP}</div>` : ''}
    ${subSellPriceP != null ? `<div><span style="color:var(--text-muted)">Cena sprzedaży: </span><strong style="color:var(--text-primary)">${fmtPLN(subSellPriceP)}</strong></div>` : ''}
    ${subBuyPriceP != null ? `<div><span style="color:var(--text-muted)">Cena zakupu: </span><strong>${fmtPLN(subBuyPriceP)}</strong></div>` : ''}
    ${subSellPriceP != null && offers.length > 0 && offers[0].price ? `<div><span style="color:var(--text-muted)">Marża: </span><strong style="color:${subSellPriceP - offers[0].price > 0 ? '#10b981' : '#ef4444'}">${subSellPriceP > 0 ? ((subSellPriceP - offers[0].price) / subSellPriceP * 100).toFixed(1) + '%' : '—'}</strong></div>` : ''}
  </div>
</div>` : '';

    Modal.show({
      title: `🔥 Oferty dla: ${escHtml(r.name||ean)}`,
      body: `
<div style="margin-bottom:10px;font-size:.82rem;color:var(--text-secondary)">
  EAN: <strong style="font-family:monospace">${escHtml(ean)}</strong>
  &nbsp;|&nbsp; Oszczędność: <strong class="savings-pos">-${r.savings_pct?.toFixed(1)}%</strong>
</div>
${subiektSectionP}
<table class="compare-table">
  <thead><tr><th>Hurtownia</th><th>Cena PLN</th><th>Dostępność</th><th>Stan</th><th>Gwarancja</th></tr></thead>
  <tbody>
    ${offerRows || `<tr><td colspan="5" style="text-align:center">Brak innych ofert</td></tr>`}
  </tbody>
</table>
${refNote}
`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`,
    });
  }

  /* ═══════════════════════════════════════════════════════
     TAB 4 — PROMOTIONS
  ═══════════════════════════════════════════════════════ */
  // Patch: remove duplicate supplier cell after encoding fix
  const _origShowPromo = showPromoOffersModal;
  showPromoOffersModal = function(ean, rows, suppliers) {
    _origShowPromo(ean, rows, suppliers);
  };

  const PROMO_COL_DEFS = [
    { key:'#',            label:'#',           frozen:true, width:'40px' },
    { key:'ean',          label:'EAN',         width:'120px' },
    { key:'manufacturer', label:'Producent',   width:'140px' },
    { key:'name',         label:'Nazwa',       width:'280px' },
    { key:'badge',        label:'',            width:'40px' },
    { key:'best_price',   label:'Super cena',  width:'100px' },
    { key:'best_supplier',label:'Hurtownia',   width:'140px' },
    { key:'ref_price',    label:'Cena ref.',   width:'90px' },
    { key:'ref_label',    label:'Odniesienie', width:'110px' },
    { key:'savings',      label:'Oszcz.',      width:'80px' },
    { key:'availability', label:'Dostępność',  width:'100px' },
    { key:'in_subiekt',   label:'W ofercie',   width:'100px' },
    { key:'stock',        label:'Stan Subiekt',width:'100px' },
    { key:'stock_qty',    label:'Ilość w hurt.',width:'100px' },
    { key:'buy_price',    label:'C. zakupu',   width:'90px' },
    { key:'sell_price',   label:'C. sprzedaży',width:'90px' },
    { key:'condition',    label:'Stan',        width:'80px' },
    { key:'warranty',     label:'Gwarancja',   width:'120px' },
  ];

  function promoCell(key, r, i, offset) {
    switch(key) {
      case '#':            return `<td class="row-num">${(offset||0)+i+1}</td>`;
      case 'ean':          return `<td class="ean-cell ean-copy" ondblclick="navigator.clipboard.writeText('${r.ean}'); window.Toast?.success('Skopiowano EAN: ${r.ean}')" title="Dwuklik = kopiuj EAN" style="cursor:pointer">${escHtml(r.ean)}</td>`;
      case 'manufacturer': return `<td style="white-space:nowrap;color:var(--text-secondary)">${escHtml(r.manufacturer||'—')}</td>`;
      case 'name': {
        const refBtn = r.best_supplier_id ? `<span class="refresh-sup-btn" data-sup-id="${r.best_supplier_id}" data-sup-name="${escHtml(r.best_supplier||'')}" title="Odśwież cennik: ${escHtml(r.best_supplier||'')}" style="cursor:pointer;margin-left:6px;font-size:0.85rem">🔄</span>` : '';
        return `<td class="name-dblclick" data-ean="${r.ean}" style="max-width:1000px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" title="${escHtml(r.name||'')}">${escHtml(r.name||'—')}${refBtn}</td>`;
      }
      case 'badge':        return `<td style="text-align:center"><span class="promo-badge promo-flash" title="Super cena" style="padding:0;background:transparent;font-size:1.2rem;box-shadow:none">🔥</span></td>`;
      case 'best_price':   return `<td class="promo-price price-clickable" data-ean="${r.ean}" title="Kliknij = oferty">${fmtPLN(r.best_price)}</td>`;
      case 'best_supplier':return `<td>${escHtml(r.best_supplier||'—')}</td>`;
      case 'ref_price':    return `<td class="promo-ref">${fmtPLN(r.ref_price)}</td>`;
      case 'ref_label':    return `<td style="font-size:.75rem;color:var(--text-muted)">${escHtml(r.ref_label||'')}</td>`;
      case 'savings':      return `<td class="savings-cell savings-pos">-${r.savings_pct?.toFixed(1)||0}%</td>`;
      case 'availability': {
        const qty = r.stock_quantity;
        const avail = r.availability || 'unknown';
        let badgeClass = 'unknown';
        let text = 'Nieznany';
        if (avail === 'available' || (qty != null && qty > 0)) {
          badgeClass = 'available';
          text = qty != null ? `${qty} szt` : 'Dostępny';
        } else if (avail === 'unavailable' || avail === 'out_of_stock' || (qty != null && qty === 0)) {
          badgeClass = 'unavailable';
          text = 'Brak';
        } else if (avail === 'incoming') {
          badgeClass = 'unknown';
          text = qty != null ? `W drodze (${qty})` : 'W drodze';
        }
        return `<td><span class="avail-dot ${badgeClass}"></span>${text}</td>`;
      }
      case 'in_subiekt':   return `<td>${r.in_subiekt?'<span class="signal-badge green">W ofercie</span>':'<span class="signal-badge none">Brak w Sub.</span>'}</td>`;
      case 'stock':        return `<td>${r.stock??'—'}</td>`;
      case 'stock_qty':    return `<td>${r.stock_quantity != null ? r.stock_quantity + ' szt' : '—'}</td>`;
      case 'buy_price':    return `<td class="price-cell">${fmtPLN(r.buy_price)}</td>`;
      case 'sell_price':   return `<td class="price-cell">${fmtPLN(r.sell_price)}</td>`;
      case 'condition': {
        const cond = r.condition || 'new';
        if (cond === 'used') return `<td style="text-align:center"><span style="display:inline-flex;align-items:center;gap:3px;background:#f59e0b22;color:#f59e0b;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap">🔶 Używany</span></td>`;
        return '<td style="text-align:center;color:var(--text-muted);font-size:.72rem">Nowy</td>';
      }
      case 'warranty':     return `<td style="font-size:.78rem;color:var(--text-secondary)">${r.warranty ? fmtWarranty(r.warranty) : '—'}</td>`;
      default:             return '<td></td>';
    }
  }

  let _promoCache = null; // cached API response for client-side filtering

  function renderPromoFiltered() {
    if (!_promoCache) return;
    const { rows, suppliers, exportUrl, order } = _promoCache;

    // Snapshot current live column widths from DOM before rebuilding thead
    const liveWidthsPromo = {};
    const existingPromoTable = document.getElementById('promo-table');
    if (existingPromoTable) {
      existingPromoTable.querySelectorAll(':scope > thead > tr > th[data-col]').forEach(th => {
        const w = th.getBoundingClientRect().width;
        if (w > 0) liveWidthsPromo[th.dataset.col] = w;
      });
    }

    const thead = order.map(k => {
      const d = PROMO_COL_DEFS.find(c => c.key===k);
      const width = d?.width || '100px';
      const sortable = !['#','badge'].includes(k);
      const sortIc = promoSortCol===k ? (promoSortAsc ? '↑' : '↓') : (sortable ? '↕' : '');
      const clsStr = k==='#' ? 'row-num-th promo-sortable' : (sortable ? 'promo-sortable' : '');

      // Priority: 1) live DOM width (pagination), 2) localStorage, 3) default
      let styleStr;
      if (liveWidthsPromo[k]) {
        const w = (k === '#' && liveWidthsPromo[k] > 80) ? 40 : Math.round(liveWidthsPromo[k]);
        styleStr = k === '#' ? `width:${w}px;min-width:${w}px;max-width:${w}px;` : `width:${w}px;min-width:${w}px;`;
      } else {
        let savedWStr = '';
        try {
          const savedWidths = JSON.parse(localStorage.getItem('sg_colw_promo-table') || '{}');
          if (savedWidths[k]) {
            let w = savedWidths[k];
            if (k === '#' && w > 80) w = 40;
            savedWStr = k === '#' ? `width:${w}px;min-width:${w}px;max-width:${w}px;` : `width:${w}px;min-width:${w}px;`;
          }
        } catch(_) {}
        styleStr = savedWStr || (k === '#' ? `width:${width};min-width:${width};max-width:${width};` : `width:${width};`);
      }

      return `<th class="${clsStr}" ${sortable?`data-sort="${k}" `:''}data-col="${k}" style="${styleStr}position:relative">
        <div style="cursor:${sortable?'pointer':'default'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${escHtml(d?.label||k)} ${sortIc}
        </div>
        <div class="col-resizer"></div>
      </th>`;
    }).join('');

    // Client-side filters
    let filteredRows = rows;
    if (promoMfg) {
      const mfgLower = promoMfg.toLowerCase();
      filteredRows = rows.filter(r => (r.manufacturer||'').toLowerCase().includes(mfgLower));
    }
    if (promoPriceMin !== '') {
      const min = parseFloat(promoPriceMin);
      if (!isNaN(min)) filteredRows = filteredRows.filter(r => r.best_price >= min);
    }
    if (promoPriceMax !== '') {
      const max = parseFloat(promoPriceMax);
      if (!isNaN(max)) filteredRows = filteredRows.filter(r => r.best_price <= max);
    }
    // Sort
    let sortedPromo = filteredRows;
    if (promoSortCol) {
      sortedPromo = [...filteredRows].sort((a, b) => {
        let av = a[promoSortCol], bv = b[promoSortCol];
        if (av == null) av = promoSortAsc ? Infinity : -Infinity;
        if (bv == null) bv = promoSortAsc ? Infinity : -Infinity;
        if (typeof av === 'string') return promoSortAsc ? av.localeCompare(bv,'pl') : bv.localeCompare(av,'pl');
        return promoSortAsc ? av - bv : bv - av;
      });
    }
    const totalPromo = sortedPromo.length;
    const totalPromoPages = Math.ceil(totalPromo / promoPageSize) || 1;
    if (promoPage >= totalPromoPages) promoPage = totalPromoPages - 1;
    if (promoPage < 0) promoPage = 0;
    const promoStart = promoPage * promoPageSize;
    const promoEnd = Math.min(promoStart + promoPageSize, totalPromo);
    const promoPageRows = sortedPromo.slice(promoStart, promoEnd);

    const tbody = promoPageRows.length === 0 
        ? `<tr><td colspan="${order.length}"><div class="sourcing-empty" style="padding:40px 0"><span class="empty-icon">🔍</span><h3>Brak promocji</h3><p>Brak produktów spełniających kryteria filtrowania.</p></div></td></tr>`
        : promoPageRows.map((r,i) => `<tr data-ean="${r.ean}">${order.map(k=>promoCell(k,r,i,promoStart)).join('')}</tr>`).join('');

    // Update only the table
    const tableEl = document.getElementById('promo-table');
    if (tableEl) {
      tableEl.innerHTML = `<thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody>`;
    }

    // Update pagination counter
    const pagerInfo = document.getElementById('promo-pager-info');
    if (pagerInfo) pagerInfo.innerHTML = `Wy\u015bw: <strong>${promoStart+1}\u2013${promoEnd}</strong>/<strong>${totalPromo}</strong>`;
    const pagerPage = document.getElementById('promo-pager-page');
    if (pagerPage) pagerPage.textContent = `${promoPage+1}/${totalPromoPages}`;
    const prevBtn = document.getElementById('promo-pg-prev');
    if (prevBtn) prevBtn.disabled = promoPage <= 0;
    const nextBtn = document.getElementById('promo-pg-next');
    if (nextBtn) nextBtn.disabled = promoPage >= totalPromoPages - 1;

    // Re-bind sort headers (only on inner div to avoid column resize conflict)
    document.querySelectorAll('#promo-table .promo-sortable[data-sort] > div:not(.col-resizer):not(.col-rh)').forEach(div => {
      div.addEventListener('click', () => {
        const th = div.closest('th');
        const col = th.dataset.sort;
        if (promoSortCol === col) promoSortAsc = !promoSortAsc;
        else { promoSortCol = col; promoSortAsc = true; }
        renderPromoFiltered();
      });
    });
    // Re-bind row interactions (EAN copy, price click, name dblclick)
    bindPromoRowActions();
    initColResize('promo-table');
  }

  function bindPromoRowActions() {
    document.querySelectorAll('#promo-table .ean-cell').forEach(td => {
      td.addEventListener('dblclick', () => {
        const ean = td.closest('tr')?.dataset.ean;
        if (ean) { navigator.clipboard.writeText(ean); window.Toast?.success('Skopiowano EAN: ' + ean); }
      });
    });
    document.querySelectorAll('#promo-table .price-clickable').forEach(td => {
      td.addEventListener('click', () => {
        const ean = td.closest('tr')?.dataset.ean;
        if (ean && _promoCache) showPromoOffersModal(ean, _promoCache.rows, _promoCache.suppliers);
      });
    });
    document.querySelectorAll('#promo-table .name-dblclick').forEach(td => {
      td.addEventListener('dblclick', () => {
        const ean = td.dataset.ean || td.closest('tr')?.dataset.ean;
        if (ean) _showProductDetailByEan(ean);
      });
      td.addEventListener('click', () => {
        const ean = td.dataset.ean || td.closest('tr')?.dataset.ean;
        if (ean) _showProductDetailByEan(ean);
      });
    });
  }

  async function renderPromotions() {
    const el = document.getElementById('src-tab-promotions');
    const p = new URLSearchParams({ threshold: promoThreshold, onlyAvailable: promoAvail, search: promoSearch });
    const cacheKey = `promotions:${p}`;
    const cached = getTabCache(cacheKey);

    async function _doRender(data) {
      const { rows, suppliers } = data;
      if (!rows && !suppliers) {
        el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">🔥</span><h3>Brak danych</h3>
          <p>Wystąpił problem z pobraniem danych z serwera.</p></div>`;
        _promoCache = null;
        return;
      }
      const exportUrl = `/api/sourcing/promotions/export?${p}`;
      const order = getColOrder('promotions', PROMO_COL_DEFS);

      // Cache data for client-side filtering
      _promoCache = { rows, suppliers, exportUrl, order };

      // Build manufacturer datalist from the shared clean source
      let mfgListHtml = '';
      try {
        const mfgRes = await API.get('/sourcing/suppliers/manufacturers');
        const cleanMfgs = Array.isArray(mfgRes) ? mfgRes : (mfgRes.manufacturers || []);
        mfgListHtml = cleanMfgs.map(m => `<option value="${escHtml(m)}">`).join('');
      } catch(_) {
        // Fallback to local dedupe from rows
        mfgListHtml = [...new Set(rows.map(r=>r.manufacturer).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pl')).map(m=>`<option value="${escHtml(m)}">`).join('');
      }

      // Apply client-side filters for initial render
      let filteredRows = rows;
      if (promoMfg) {
        const mfgLower = promoMfg.toLowerCase();
        filteredRows = rows.filter(r => (r.manufacturer||'').toLowerCase().includes(mfgLower));
      }
      if (promoPriceMin !== '') {
        const min = parseFloat(promoPriceMin);
        if (!isNaN(min)) filteredRows = filteredRows.filter(r => r.best_price >= min);
      }
      if (promoPriceMax !== '') {
        const max = parseFloat(promoPriceMax);
        if (!isNaN(max)) filteredRows = filteredRows.filter(r => r.best_price <= max);
      }
      let sortedPromo = filteredRows;
      if (promoSortCol) {
        sortedPromo = [...filteredRows].sort((a, b) => {
          let av = a[promoSortCol], bv = b[promoSortCol];
          if (av == null) av = promoSortAsc ? Infinity : -Infinity;
          if (bv == null) bv = promoSortAsc ? Infinity : -Infinity;
          if (typeof av === 'string') return promoSortAsc ? av.localeCompare(bv,'pl') : bv.localeCompare(av,'pl');
          return promoSortAsc ? av - bv : bv - av;
        });
      }
      const totalPromo = sortedPromo.length;
      const totalPromoPages = Math.ceil(totalPromo / promoPageSize) || 1;
      if (promoPage >= totalPromoPages) promoPage = totalPromoPages - 1;
      if (promoPage < 0) promoPage = 0;
      const promoStart = promoPage * promoPageSize;
      const promoEnd = Math.min(promoStart + promoPageSize, totalPromo);
      const promoPageRows = sortedPromo.slice(promoStart, promoEnd);

      const thead = order.map(k => {
        const d = PROMO_COL_DEFS.find(c => c.key===k);
        const width = d?.width || '100px';
        const sortable = !['#','badge'].includes(k);
        const sortIc = promoSortCol===k ? (promoSortAsc ? '↑' : '↓') : (sortable ? '↕' : '');
        const clsStr = k==='#' ? 'row-num-th promo-sortable' : (sortable ? 'promo-sortable' : '');
        
        let savedWStr = '';
        try {
          const savedWidths = JSON.parse(localStorage.getItem('sg_colw_promo-table') || '{}');
          if (savedWidths[k]) {
            let w = savedWidths[k];
            if (k === '#' && w > 80) w = 40;
            savedWStr = k === '#' ? `width:${w}px;min-width:${w}px;max-width:${w}px;` : `width:${w}px;min-width:${w}px;`;
          }
        } catch(_) {}
        const styleStr = savedWStr || (k === '#' ? `width:${width};min-width:${width};max-width:${width};` : `width:${width};`);
        
        return `<th class="${clsStr}" ${sortable?`data-sort="${k}" `:''}data-col="${k}" style="${styleStr}position:relative">
          <div style="cursor:${sortable?'pointer':'default'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escHtml(d?.label||k)} ${sortIc}
          </div>
          <div class="col-resizer"></div>
        </th>`;
      }).join('');

      const tbody = promoPageRows.length === 0 
        ? `<tr><td colspan="${order.length}"><div class="sourcing-empty" style="padding:40px 0"><span class="empty-icon">🔍</span><h3>Brak promocji</h3><p>Dodaj więcej hurtowni lub zmień parametry wyszukiwania (aktualny próg: ${promoThreshold}%).</p></div></td></tr>`
        : promoPageRows.map((r,i) => `<tr data-ean="${r.ean}">${order.map(k=>promoCell(k,r,i,promoStart)).join('')}</tr>`).join('');
      el.innerHTML = `
<div class="compare-toolbar" style="margin-bottom:16px">
  <div class="toolbar-group"><label>🔍</label>
    <input class="compare-search" id="promo-search" placeholder="Szukaj EAN/nazwa..." value="${escHtml(promoSearch)}">
  </div>
  <div class="toolbar-group"><label>🏭</label>
    <input class="compare-search" id="promo-mfg" list="promo-mfg-list" placeholder="Producent..." value="${escHtml(promoMfg)}" style="max-width:150px" autocomplete="off">
    <datalist id="promo-mfg-list">${mfgListHtml}</datalist>
  </div>
  <div class="toolbar-group"><label>💰 Cena:</label>
    <input type="number" id="promo-price-min" class="prof-input" placeholder="od" style="width:60px;padding:4px 6px;font-size:.8rem" value="${promoPriceMin}" min="0" step="1">
    <span style="color:var(--text-muted);font-size:.8rem">–</span>
    <input type="number" id="promo-price-max" class="prof-input" placeholder="do" style="width:60px;padding:4px 6px;font-size:.8rem" value="${promoPriceMax}" min="0" step="1">
  </div>
  <div class="toolbar-group"><label>Próg:</label>
    <select id="promo-thresh">
      ${[5,10,15,20,30].map(v=>`<option value="${v}"${promoThreshold===v?' selected':''}>${v}%</option>`).join('')}
    </select>
  </div>
  <div class="toolbar-group toggle-switch">
    <input type="checkbox" id="promo-avail" ${promoAvail?'checked':''}><label for="promo-avail">Tylko dostępne</label>
  </div>
  <div class="toolbar-group" style="margin-left:auto;gap:4px">
    <span style="font-size:.7rem;color:var(--text-muted)"><strong style="color:var(--text-primary)">${rows.length}</strong> super cen</span>
    <div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>
    <span id="promo-pager-info" style="font-size:.7rem;color:var(--text-muted)">Wyśw: <strong>${promoStart+1}–${promoEnd}</strong>/<strong>${totalPromo}</strong></span>
    <input type="number" id="promo-page-size" class="prof-input" style="width:45px;padding:2px 4px;font-size:.75rem" value="${promoPageSize}" min="10" max="5000" step="10" title="Wyników na stronę">
    <button class="btn btn--ghost btn--sm" id="promo-pg-prev" ${promoPage<=0?'disabled':''} style="padding:2px 6px">←</button>
    <span id="promo-pager-page" style="font-size:.7rem;color:var(--text-muted)">${promoPage+1}/${totalPromoPages}</span>
    <button class="btn btn--ghost btn--sm" id="promo-pg-next" ${promoPage>=totalPromoPages-1?'disabled':''} style="padding:2px 6px">→</button>
    <div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>
    <button class="btn btn--ghost btn--sm" id="promo-cols-btn" title="Edytuj układ" style="padding:2px 6px">⚙️</button>
    <a class="btn btn--ghost btn--sm" href="${exportUrl}" download title="Pobierz plik CSV" style="padding:2px 6px">⬇️ CSV</a>
  </div>
</div>
<div class="promo-table-wrap src-scroll-x">
<table class="promo-table" id="promo-table" style="table-layout:fixed;width:auto;min-width:100%"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>
<div style="font-size:.72rem;color:var(--text-muted);margin-top:6px;padding:0 4px">
  💡 Kliknij na cenę = oferty &nbsp;|&nbsp; Dwuklik na EAN = kopiuj &nbsp;|&nbsp; Dwuklik na nazwę = szczegóły
</div>`;
      let t;
      // API-level filters: these need a full re-fetch
      document.getElementById('promo-search').addEventListener('input', e => { clearTimeout(t); t=setTimeout(()=>{ promoSearch=e.target.value; promoPage=0; renderPromotions(); },400); });
      document.getElementById('promo-thresh').addEventListener('change', e => { promoThreshold=parseInt(e.target.value); promoPage=0; renderPromotions(); });
      document.getElementById('promo-avail').addEventListener('change', e => { promoAvail=e.target.checked; promoPage=0; renderPromotions(); });

      // Client-side filters: only re-render table, keep toolbar alive
      document.getElementById('promo-mfg')?.addEventListener('input', e => { clearTimeout(t); t=setTimeout(()=>{ promoMfg=e.target.value; promoPage=0; renderPromoFiltered(); },300); });
      document.getElementById('promo-price-min')?.addEventListener('input', e => { clearTimeout(t); t=setTimeout(()=>{ promoPriceMin=e.target.value; promoPage=0; renderPromoFiltered(); },400); });
      document.getElementById('promo-price-max')?.addEventListener('input', e => { clearTimeout(t); t=setTimeout(()=>{ promoPriceMax=e.target.value; promoPage=0; renderPromoFiltered(); },400); });
      document.getElementById('promo-cols-btn').addEventListener('click', () => showColLayoutModal('promotions', PROMO_COL_DEFS, (newOrder) => { saveColOrder('promotions', newOrder); renderPromotions(); }));
      document.getElementById('promo-pg-prev')?.addEventListener('click', () => { promoPage--; renderPromoFiltered(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      document.getElementById('promo-pg-next')?.addEventListener('click', () => { promoPage++; renderPromoFiltered(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      document.getElementById('promo-page-size')?.addEventListener('change', e => { const v = parseInt(e.target.value); if (v >= 10) { promoPageSize = v; promoPage = 0; renderPromoFiltered(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });

      // Sorting for promotions (only on inner div to avoid column resize conflict)
      document.querySelectorAll('#promo-table .promo-sortable[data-sort] > div:not(.col-resizer):not(.col-rh)').forEach(div => {
        div.addEventListener('click', () => {
          const th = div.closest('th');
          const col = th.dataset.sort;
          if (promoSortCol === col) promoSortAsc = !promoSortAsc;
          else { promoSortCol = col; promoSortAsc = true; }
          renderPromoFiltered();
        });
      });

      bindPromoRowActions();
      initColResize('promo-table');
    } // end _doRender

    if (cached) {
      await _doRender(cached);
      _bgRefresh(el, `/sourcing/promotions?${p}`, cacheKey, d => { setTabCache(cacheKey, d); _doRender(d); });
    } else {
      el.innerHTML = `<div style="padding:12px">${skeletonTable(7, 14)}</div>`;
      try {
        const data = await API.get(`/sourcing/promotions?${p}`);
        setTabCache(cacheKey, data);
        await _doRender(data);
      } catch(e) { el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">⚠️</span><h3>Błąd</h3><p>${escHtml(e.message)}</p></div>`; }
    }
  }

  /* ═══════════════════════════════════════════════════════
     TAB: SUPER PRICES (SUPER CENY)
  ═══════════════════════════════════════════════════════ */

  /* Helper: modal ofert dla zakładki Super Ceny */
  function showDealsOffersModal(ean, rows, suppliers) {
    const r = rows.find(x => x.ean === ean);
    if (!r) return;

    const offers = [];
    if (suppliers && r.supplier_prices) {
      for (const s of suppliers) {
        const sp = r.supplier_prices[s.id];
        if (sp) offers.push({ name: s.name, price: sp.price, orig: sp.orig_price, currency: s.currency, avail: sp.availability, condition: sp.condition, warranty: sp.warranty });
      }
      offers.sort((a,b) => a.price - b.price);
    }
    
    // Add reference price as an artificial row if not already in offers
    let refNote = '';
    if (r.ref_price && offers.length === 1) {
       refNote = `<div style="margin-top:10px;font-size:0.8rem;color:var(--text-muted)">Cena referencyjna (${escHtml(r.ref_label)}): <strong>${fmtPLN(r.ref_price)}</strong></div>`;
    }

    const offerRows = offers.map((o,i) => {
      const origNote = o.orig && o.currency && o.currency!=='PLN' ? ` <span style="font-size:.7rem;color:var(--text-muted)">(${parseFloat(o.orig).toFixed(2)} ${o.currency})</span>` : '';
      return `<tr${i===0?' class="best-row"':''}>
        <td>${i===0?'⭐ ':''}${escHtml(o.name)}</td>
        <td class="price-cell${i===0?' best-price':''}">${fmtPLN(o.price)}${origNote}</td>
        <td>${o.avail==='available'?'✅ Dostępny':o.avail==='unavailable'?'❌ Brak':'❓'}</td>
        <td>${(o.condition||'new')==='used'?'<span style="color:#f59e0b;font-weight:600">🔶 Używany</span>':'Nowy'}</td>
        <td style="font-size:.78rem;color:var(--text-secondary)">${fmtWarranty(o.warranty)}</td>
      </tr>`;
    }).join('');

    // ── Subiekt section ──────────────────────────────────────────────────
    const subAvailD = r.in_subiekt
      ? `<span style="color:#10b981;font-weight:600">✅ W ofercie</span>`
      : `<span style="color:#94a3b8">— Brak w Subiekcie</span>`;
    const subStockD = r.stock != null ? r.stock : null;
    const subStockHtmlD = subStockD != null
      ? (subStockD > 10 ? `<span style="color:#10b981">${subStockD} szt</span>`
        : subStockD > 0 ? `<span style="color:#f59e0b">${subStockD} szt (mało)</span>`
        : `<span style="color:#ef4444">0 szt (brak)</span>`)
      : `<span style="color:#94a3b8">—</span>`;
    const subSellPriceD = r.sell_price != null ? r.sell_price : null;
    const subBuyPriceD = r.buy_price != null ? r.buy_price : null;
    const subiektSectionD = r.in_subiekt || subStockD != null || subSellPriceD != null ? `
<div style="background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:16px;align-items:center">
  <div style="font-size:.72rem;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0">📦 Nasz Subiekt</div>
  <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:.82rem">
    <div><span style="color:var(--text-muted)">Status: </span>${subAvailD}</div>
    ${subStockD != null ? `<div><span style="color:var(--text-muted)">Stan mag.: </span>${subStockHtmlD}</div>` : ''}
    ${subSellPriceD != null ? `<div><span style="color:var(--text-muted)">Cena sprzedaży: </span><strong style="color:var(--text-primary)">${fmtPLN(subSellPriceD)}</strong></div>` : ''}
    ${subBuyPriceD != null ? `<div><span style="color:var(--text-muted)">Cena zakupu: </span><strong>${fmtPLN(subBuyPriceD)}</strong></div>` : ''}
    ${subSellPriceD != null && offers.length > 0 && offers[0].price ? `<div><span style="color:var(--text-muted)">Marża: </span><strong style="color:${subSellPriceD - offers[0].price > 0 ? '#10b981' : '#ef4444'}">${subSellPriceD > 0 ? ((subSellPriceD - offers[0].price) / subSellPriceD * 100).toFixed(1) + '%' : '—'}</strong></div>` : ''}
  </div>
</div>` : '';

    Modal.show({
      title: `🔔 Oferty dla: ${escHtml(r.name||ean)}`,
      body: `
<div style="margin-bottom:10px;font-size:.82rem;color:var(--text-secondary)">
  EAN: <strong style="font-family:monospace">${escHtml(ean)}</strong>
  &nbsp;|&nbsp; Typ okazji: <strong>${r.deal_type === 'Subiekt' ? 'Marża Subiekt' : 'Arbitraż'}</strong>
  &nbsp;|&nbsp; Oszczędność: <strong class="savings-pos" style="color:#10b981">-${r.savings_pct?.toFixed(1)}%</strong>
</div>
${subiektSectionD}
<table class="compare-table">
  <thead><tr><th>Hurtownia</th><th>Cena PLN</th><th>Dostępność</th><th>Stan</th><th>Gwarancja</th></tr></thead>
  <tbody>
    ${offerRows || `<tr><td colspan="5" style="text-align:center">Brak innych ofert</td></tr>`}
  </tbody>
</table>
${refNote}
`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`,
    });
  }


  const DEALS_COL_DEFS = [
    { key:'#',            label:'#',           frozen:true, width:'40px' },
    { key:'badge',        label:'Okr.',        width:'76px' },
    { key:'ean',          label:'EAN',         width:'120px' },
    { key:'manufacturer', label:'Producent',   width:'110px' },
    { key:'name',         label:'Nazwa',       width:'260px' },
    { key:'best_price',   label:'Super cena',  width:'100px' },
    { key:'best_supplier',label:'Hurtownia',   width:'110px' },
    { key:'savings',      label:'Oszcz. %',    width:'72px' },
    { key:'availability', label:'Dostępność',  width:'80px' },
    { key:'in_subiekt',   label:'W Sub.',      width:'72px' },
    { key:'stock',        label:'Stan Sub.',   width:'72px' },
    { key:'stock_qty',    label:'Stan hurt.',  width:'76px' },
    { key:'buy_price',    label:'C. zakupu',   width:'86px' },
    { key:'sell_price',   label:'C. sprz.',    width:'82px' },
    { key:'first_seen',   label:'Data dod.',   width:'120px' },
    { key:'condition',    label:'Stan',        width:'60px' },
    { key:'warranty',     label:'Gwarancja',   width:'90px' },
  ];

  function dealsCell(key, r, i, offset) {
    switch(key) {
      case '#':            return `<td class="row-num">${(offset||0)+i+1}</td>`;
      case 'badge': {
        if (r.is_new) {
          return `<td style="text-align:center"><span style="display:inline-block;background:linear-gradient(135deg, #ec4899, #ef4444);color:#fff;font-size:0.68rem;font-weight:800;padding:2px 6px;border-radius:4px;box-shadow:0 0 10px rgba(239,68,68,0.75);text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;animation:pulse-glow 2s infinite" title="Nowość: produkt dodany niedawno lub po długiej nieobecności">NOWOŚĆ!</span></td>`;
        }
        return `<td style="text-align:center"><span style="display:inline-block;background:linear-gradient(135deg, #10b981, #059669);color:#fff;font-size:0.68rem;font-weight:700;padding:2px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap">OKAZJA</span></td>`;
      }
      case 'ean':          return `<td class="ean-cell ean-copy" ondblclick="navigator.clipboard.writeText('${r.ean}'); window.Toast?.success('Skopiowano EAN: ${r.ean}')" title="Dwuklik = kopiuj EAN" style="cursor:pointer">${escHtml(r.ean)}</td>`;
      case 'manufacturer': return `<td style="white-space:nowrap;color:var(--text-secondary)">${escHtml(r.manufacturer||'—')}</td>`;
      case 'name': {
        const refBtn = r.best_supplier_id ? `<span class="refresh-sup-btn" data-sup-id="${r.best_supplier_id}" data-sup-name="${escHtml(r.best_supplier||'')}" title="Odśwież cennik: ${escHtml(r.best_supplier||'')}" style="cursor:pointer;margin-left:6px;font-size:0.85rem">🔄</span>` : '';
        return `<td class="name-dblclick" data-ean="${r.ean}" style="max-width:1000px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" title="${escHtml(r.name||'')}">${escHtml(r.name||'—')}${refBtn}</td>`;
      }
      case 'best_price': {
        // Show super price vs ref_price (buy_price) with strikethrough
        const refStr = r.ref_price != null ? `<span style="font-size:0.68rem;color:var(--text-muted);text-decoration:line-through;margin-left:4px">${fmtPLN(r.ref_price)}</span>` : '';
        return `<td class="promo-price price-clickable" data-ean="${r.ean}" title="Kliknij = oferty" style="font-weight:700;color:var(--color-success);white-space:nowrap">${fmtPLN(r.best_price)}${refStr}</td>`;
      }
      case 'best_supplier':return `<td>${escHtml(r.best_supplier||'—')}</td>`;
      case 'ref_label':    return `<td style="font-size:.75rem;color:var(--text-muted)">${escHtml(r.ref_label||'')}</td>`;
      case 'savings': {
        const pct = r.savings_pct;
        const isGood = pct != null && pct > 0;
        const color = isGood ? '#10b981' : '#f87171';
        const sign = isGood ? '+' : '';
        const label = pct != null ? `${sign}${pct.toFixed(1)}%` : '—';
        const title = r.ref_price != null && r.best_price != null
          ? `Cena hurtowa ${fmtPLN(r.best_price)} vs cena zakupu ${fmtPLN(r.ref_price)}`
          : 'Oszczędność na zakupie';
        return `<td class="savings-cell" style="font-weight:700;color:${color}" title="${title}">${label}</td>`;
      }
      case 'deal_type': {
        const isSub = r.deal_type === 'Subiekt';
        return `<td><span class="signal-badge ${isSub?'green':'yellow'}" style="font-size:0.75rem">${isSub?'Marża Subiekt':'Arbitraż'}</span></td>`;
      }
      case 'availability': {
        const qty = r.stock_quantity;
        const avail = r.availability || 'unknown';
        let badgeClass = 'unknown';
        let text = 'Nieznany';
        if (avail === 'available' || (qty != null && qty > 0)) {
          badgeClass = 'available';
          text = qty != null ? `${qty} szt` : 'Dostępny';
        } else if (avail === 'unavailable' || avail === 'out_of_stock' || (qty != null && qty === 0)) {
          badgeClass = 'unavailable';
          text = 'Brak';
        } else if (avail === 'incoming') {
          badgeClass = 'unknown';
          text = qty != null ? `W drodze (${qty})` : 'W drodze';
        }
        return `<td><span class="avail-dot ${badgeClass}"></span>${text}</td>`;
      }
      case 'in_subiekt':   return `<td>${r.in_subiekt?'<span class="signal-badge green">W ofercie</span>':'<span class="signal-badge none">Brak w Sub.</span>'}</td>`;
      case 'stock':        return `<td>${r.stock??'—'}</td>`;
      case 'stock_qty':    return `<td>${r.stock_quantity != null ? r.stock_quantity + ' szt' : '—'}</td>`;
      case 'first_seen':   return `<td style="font-size:.75rem;color:var(--text-secondary)">${r.first_seen_at ? fmtDate(r.first_seen_at) : '—'}</td>`;
      case 'buy_price':    return `<td class="price-cell" title="Cena zakupu z Subiekta">${r.buy_price != null ? fmtPLN(r.buy_price) : '—'}</td>`;
      case 'sell_price':   return `<td class="price-cell" title="Cena sprzedaży z Subiekta">${r.sell_price != null ? fmtPLN(r.sell_price) : '—'}</td>`;
      case 'condition': {
        const cond = r.condition || 'new';
        if (cond === 'used') return `<td style="text-align:center"><span style="display:inline-flex;align-items:center;gap:3px;background:#f59e0b22;color:#f59e0b;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap">🔶 Używany</span></td>`;
        return '<td style="text-align:center;color:var(--text-muted);font-size:.72rem">Nowy</td>';
      }
      case 'warranty':     return `<td style="font-size:.78rem;color:var(--text-secondary)">${r.warranty ? fmtWarranty(r.warranty) : '—'}</td>`;
      default:             return '<td></td>';
    }
  }

  function renderDealsFiltered() {
    if (!_dealsCache) return;
    const { rows, suppliers, order } = _dealsCache;

    // Snapshot current live column widths from DOM before rebuilding thead
    const liveWidths = {};
    const existingTable = document.getElementById('deals-table');
    if (existingTable) {
      existingTable.querySelectorAll(':scope > thead > tr > th[data-col]').forEach(th => {
        const w = th.getBoundingClientRect().width;
        if (w > 0) liveWidths[th.dataset.col] = w;
      });
    }

    const thead = order.map(k => {
      const d = DEALS_COL_DEFS.find(c => c.key===k);
      const width = d?.width || '100px';
      const sortable = !['#','badge'].includes(k);
      const sortIc = dealsSortCol===k ? (dealsSortAsc ? '↑' : '↓') : (sortable ? '↕' : '');
      const clsStr = k==='#' ? 'row-num-th deals-sortable' : (sortable ? 'deals-sortable' : '');

      // Priority: 1) live DOM width (pagination), 2) localStorage (user resize), 3) default
      let styleStr;
      if (liveWidths[k]) {
        const w = (k === '#' && liveWidths[k] > 80) ? 40 : Math.round(liveWidths[k]);
        styleStr = k === '#' ? `width:${w}px;min-width:${w}px;max-width:${w}px;` : `width:${w}px;min-width:${w}px;`;
      } else {
        let savedWStr = '';
        try {
          const savedWidths = JSON.parse(localStorage.getItem('sg_colw_deals-table') || '{}');
          if (savedWidths[k]) {
            let w = savedWidths[k];
            if (k === '#' && w > 80) w = 40;
            savedWStr = k === '#' ? `width:${w}px;min-width:${w}px;max-width:${w}px;` : `width:${w}px;min-width:${w}px;`;
          }
        } catch(_) {}
        styleStr = savedWStr || (k === '#' ? `width:${width};min-width:${width};max-width:${width};` : `width:${width};`);
      }

      return `<th class="${clsStr}" ${sortable?`data-sort="${k}" `:''}data-col="${k}" style="${styleStr}position:relative">
        <div style="cursor:${sortable?'pointer':'default'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${escHtml(d?.label||k)} ${sortIc}
        </div>
        <div class="col-resizer"></div>
      </th>`;
    }).join('');

    // Client-side filters
    let filteredRows = rows;
    if (dealsOnlyNew) {
      filteredRows = filteredRows.filter(r => r.is_new);
    }
    if (dealsInSubiekt !== 'all') {
      const wantInSubiekt = dealsInSubiekt === 'yes';
      filteredRows = filteredRows.filter(r => r.in_subiekt === wantInSubiekt);
    }
    if (dealsMfg) {
      const mfgLower = dealsMfg.toLowerCase();
      filteredRows = filteredRows.filter(r => (r.manufacturer||'').toLowerCase().includes(mfgLower));
    }
    if (dealsPriceMin !== '') {
      const min = parseFloat(dealsPriceMin);
      if (!isNaN(min)) filteredRows = filteredRows.filter(r => r.best_price >= min);
    }
    if (dealsPriceMax !== '') {
      const max = parseFloat(dealsPriceMax);
      if (!isNaN(max)) filteredRows = filteredRows.filter(r => r.best_price <= max);
    }

    // Sort
    let sortedDeals = [...filteredRows].sort((a, b) => {
      if (!dealsOnlyNew) {
        const aNew = a.is_new ? 1 : 0;
        const bNew = b.is_new ? 1 : 0;
        if (aNew !== bNew) {
          return bNew - aNew;
        }
      }
      if (dealsSortCol) {
        let sortKey = dealsSortCol;
        if (sortKey === 'savings') sortKey = 'savings_pct';
        if (sortKey === 'stock_qty' || sortKey === 'availability') sortKey = 'stock_quantity';
        let av = a[sortKey], bv = b[sortKey];
        if (av == null) av = dealsSortAsc ? Infinity : -Infinity;
        if (bv == null) bv = dealsSortAsc ? Infinity : -Infinity;
        if (typeof av === 'string') return dealsSortAsc ? av.localeCompare(bv,'pl') : bv.localeCompare(av,'pl');
        return dealsSortAsc ? av - bv : bv - av;
      }
      return 0;
    });

    const totalDeals = sortedDeals.length;
    const totalDealsPages = Math.ceil(totalDeals / dealsPageSize) || 1;
    if (dealsPage >= totalDealsPages) dealsPage = totalDealsPages - 1;
    if (dealsPage < 0) dealsPage = 0;
    const dealsStart = dealsPage * dealsPageSize;
    const dealsEnd = Math.min(dealsStart + dealsPageSize, totalDeals);
    const dealsPageRows = sortedDeals.slice(dealsStart, dealsEnd);

    const tbody = dealsPageRows.length === 0 
        ? `<tr><td colspan="${order.length}"><div class="sourcing-empty" style="padding:40px 0"><span class="empty-icon">🔍</span><h3>Brak okazji</h3><p>Brak produktów spełniających kryteria filtrowania.</p></div></td></tr>`
        : dealsPageRows.map((r,i) => `<tr data-ean="${r.ean}">${order.map(k=>dealsCell(k,r,i,dealsStart)).join('')}</tr>`).join('');

    // Update only the table
    const tableEl = document.getElementById('deals-table');
    if (tableEl) {
      tableEl.innerHTML = `<thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody>`;
    }

    // Update pagination counter
    const pagerInfo = document.getElementById('deals-pager-info');
    if (pagerInfo) pagerInfo.innerHTML = `Wyśw: <strong>${dealsStart+1}–${dealsEnd}</strong>/<strong>${totalDeals}</strong>`;
    const pagerPage = document.getElementById('deals-pager-page');
    if (pagerPage) pagerPage.textContent = `${dealsPage+1}/${totalDealsPages}`;
    const prevBtn = document.getElementById('deals-pg-prev');
    if (prevBtn) prevBtn.disabled = dealsPage <= 0;
    const nextBtn = document.getElementById('deals-pg-next');
    if (nextBtn) nextBtn.disabled = dealsPage >= totalDealsPages - 1;

    // Update CSV export link with correct client-side filters
    const exportLink = document.getElementById('deals-export-btn');
    if (exportLink) {
      const p = new URLSearchParams({
        threshold: dealsThreshold,
        onlyAvailable: dealsAvail,
        search: dealsSearch,
        onlyNew: dealsOnlyNew,
        inSubiekt: dealsInSubiekt
      });
      exportLink.href = `/api/sourcing/deals/export?${p}`;
    }

    // Re-bind sort headers (only on inner div to avoid column resize conflict)
    document.querySelectorAll('#deals-table .deals-sortable[data-sort] > div:not(.col-resizer):not(.col-rh)').forEach(div => {
      div.addEventListener('click', () => {
        const th = div.closest('th');
        const col = th.dataset.sort;
        if (dealsSortCol === col) dealsSortAsc = !dealsSortAsc;
        else { dealsSortCol = col; dealsSortAsc = true; }
        renderDealsFiltered();
      });
    });
    // Re-bind row interactions (EAN copy, price click, name dblclick)
    bindDealsRowActions();
    initColResize('deals-table');
  }

  function bindDealsRowActions() {
    document.querySelectorAll('#deals-table .ean-cell').forEach(td => {
      td.addEventListener('dblclick', () => {
        const ean = td.closest('tr')?.dataset.ean;
        if (ean) { navigator.clipboard.writeText(ean); window.Toast?.success('Skopiowano EAN: ' + ean); }
      });
    });
    document.querySelectorAll('#deals-table .price-clickable').forEach(td => {
      td.addEventListener('click', () => {
        const ean = td.closest('tr')?.dataset.ean;
        if (ean && _dealsCache) showDealsOffersModal(ean, _dealsCache.rows, _dealsCache.suppliers);
      });
    });
    document.querySelectorAll('#deals-table .name-dblclick').forEach(td => {
      td.addEventListener('dblclick', () => {
        const ean = td.dataset.ean || td.closest('tr')?.dataset.ean;
        if (ean) _showProductDetailByEan(ean);
      });
      td.addEventListener('click', () => {
        const ean = td.dataset.ean || td.closest('tr')?.dataset.ean;
        if (ean) _showProductDetailByEan(ean);
      });
    });
  }

  async function renderDeals() {
    // Inject Custom CSS dynamically for NOWOŚĆ! pulse glow
    if (!document.getElementById('deals-custom-styles')) {
      const style = document.createElement('style');
      style.id = 'deals-custom-styles';
      style.textContent = `
        @keyframes pulse-glow {
          0% { box-shadow: 0 0 6px rgba(239, 68, 68, 0.5); }
          50% { box-shadow: 0 0 16px rgba(239, 68, 68, 0.95); }
          100% { box-shadow: 0 0 6px rgba(239, 68, 68, 0.5); }
        }
      `;
      document.head.appendChild(style);
    }

    const el = document.getElementById('src-tab-deals');
    const p = new URLSearchParams({ threshold: dealsThreshold, onlyAvailable: dealsAvail, search: dealsSearch, inSubiekt: dealsInSubiekt });
    const cacheKey = `deals:${p}`;
    const cached = getTabCache(cacheKey);

    async function _doRenderDeals(apiData) {
      const { rows, suppliers } = apiData;
      if (!rows && !suppliers) {
        el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">🔔</span><h3>Brak danych</h3>
          <p>Wystąpił problem z pobraniem danych z serwera.</p></div>`;
        _dealsCache = null;
        return;
      }
      const exportUrl = `/api/sourcing/deals/export?${p}&onlyNew=${dealsOnlyNew}`;
      const order = getColOrder('deals', DEALS_COL_DEFS);

      // Cache data for client-side filtering
      _dealsCache = { rows, suppliers, exportUrl, order };

      // Build manufacturer datalist from the shared clean source
      let mfgListHtml = '';
      try {
        const mfgRes = await API.get('/sourcing/suppliers/manufacturers');
        const cleanMfgs = Array.isArray(mfgRes) ? mfgRes : (mfgRes.manufacturers || []);
        mfgListHtml = cleanMfgs.map(m => `<option value="${escHtml(m)}">`).join('');
      } catch(_) {
        // Fallback to local dedupe from rows
        mfgListHtml = [...new Set(rows.map(r=>r.manufacturer).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pl')).map(m=>`<option value="${escHtml(m)}">`).join('');
      }

      // Apply client-side filters for initial render
      let filteredRows = rows;
      if (dealsOnlyNew) {
        filteredRows = filteredRows.filter(r => r.is_new);
      }
      if (dealsInSubiekt !== 'all') {
        const wantInSubiekt = dealsInSubiekt === 'yes';
        filteredRows = filteredRows.filter(r => r.in_subiekt === wantInSubiekt);
      }
      if (dealsMfg) {
        const mfgLower = dealsMfg.toLowerCase();
        filteredRows = filteredRows.filter(r => (r.manufacturer||'').toLowerCase().includes(mfgLower));
      }
      if (dealsPriceMin !== '') {
        const min = parseFloat(dealsPriceMin);
        if (!isNaN(min)) filteredRows = filteredRows.filter(r => r.best_price >= min);
      }
      if (dealsPriceMax !== '') {
        const max = parseFloat(dealsPriceMax);
        if (!isNaN(max)) filteredRows = filteredRows.filter(r => r.best_price <= max);
      }

      let sortedDeals = [...filteredRows].sort((a, b) => {
        if (!dealsOnlyNew) {
          const aNew = a.is_new ? 1 : 0;
          const bNew = b.is_new ? 1 : 0;
          if (aNew !== bNew) {
            return bNew - aNew;
          }
        }
        if (dealsSortCol) {
          let sortKey = dealsSortCol;
          if (sortKey === 'savings') sortKey = 'savings_pct';
          if (sortKey === 'stock_qty' || sortKey === 'availability') sortKey = 'stock_quantity';
          let av = a[sortKey], bv = b[sortKey];
          if (av == null) av = dealsSortAsc ? Infinity : -Infinity;
          if (bv == null) bv = dealsSortAsc ? Infinity : -Infinity;
          if (typeof av === 'string') return dealsSortAsc ? av.localeCompare(bv,'pl') : bv.localeCompare(av,'pl');
          return dealsSortAsc ? av - bv : bv - av;
        }
        return 0;
      });

      const totalDeals = sortedDeals.length;
      const totalDealsPages = Math.ceil(totalDeals / dealsPageSize) || 1;
      if (dealsPage >= totalDealsPages) dealsPage = totalDealsPages - 1;
      if (dealsPage < 0) dealsPage = 0;
      const dealsStart = dealsPage * dealsPageSize;
      const dealsEnd = Math.min(dealsStart + dealsPageSize, totalDeals);
      const dealsPageRows = sortedDeals.slice(dealsStart, dealsEnd);

      const thead = order.map(k => {
        const d = DEALS_COL_DEFS.find(c => c.key===k);
        const width = d?.width || '100px';
        const sortable = !['#','badge'].includes(k);
        const sortIc = dealsSortCol===k ? (dealsSortAsc ? '↑' : '↓') : (sortable ? '↕' : '');
        const clsStr = k==='#' ? 'row-num-th deals-sortable' : (sortable ? 'deals-sortable' : '');
        
        let savedWStr = '';
        try {
          const savedWidths = JSON.parse(localStorage.getItem('sg_colw_deals-table') || '{}');
          if (savedWidths[k]) {
            let w = savedWidths[k];
            if (k === '#' && w > 80) w = 40;
            savedWStr = k === '#' ? `width:${w}px;min-width:${w}px;max-width:${w}px;` : `width:${w}px;min-width:${w}px;`;
          }
        } catch(_) {}
        const styleStr = savedWStr || (k === '#' ? `width:${width};min-width:${width};max-width:${width};` : `width:${width};`);
        
        return `<th class="${clsStr}" ${sortable?`data-sort="${k}" `:''}data-col="${k}" style="${styleStr}position:relative">
          <div style="cursor:${sortable?'pointer':'default'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escHtml(d?.label||k)} ${sortIc}
          </div>
          <div class="col-resizer"></div>
        </th>`;
      }).join('');

      const tbody = dealsPageRows.length === 0 
        ? `<tr><td colspan="${order.length}"><div class="sourcing-empty" style="padding:40px 0"><span class="empty-icon">🔍</span><h3>Brak okazji</h3><p>Brak produktów spełniających kryteria (aktualny próg marży: ${dealsThreshold}%).</p></div></td></tr>`
        : dealsPageRows.map((r,i) => `<tr data-ean="${r.ean}">${order.map(k=>dealsCell(k,r,i,dealsStart)).join('')}</tr>`).join('');

      el.innerHTML = `
<div class="compare-toolbar" style="margin-bottom:16px">
  <div class="toolbar-group"><label>🔍</label>
    <input class="compare-search" id="deals-search" placeholder="Szukaj EAN/nazwa..." value="${escHtml(dealsSearch)}">
  </div>
  <div class="toolbar-group"><label>🏭</label>
    <input class="compare-search" id="deals-mfg" list="deals-mfg-list" placeholder="Producent..." value="${escHtml(dealsMfg)}" style="max-width:150px" autocomplete="off">
    <datalist id="deals-mfg-list">${mfgListHtml}</datalist>
  </div>
  <div class="toolbar-group"><label>💰 Cena:</label>
    <input type="number" id="deals-price-min" class="prof-input" placeholder="od" style="width:60px;padding:4px 6px;font-size:.8rem" value="${dealsPriceMin}" min="0" step="1">
    <span style="color:var(--text-muted);font-size:.8rem">–</span>
    <input type="number" id="deals-price-max" class="prof-input" placeholder="do" style="width:60px;padding:4px 6px;font-size:.8rem" value="${dealsPriceMax}" min="0" step="1">
  </div>
  <div class="toolbar-group"><label>Marża:</label>
    <select id="deals-thresh">
      ${[20,30,40,50,60].map(v=>`<option value="${v}"${dealsThreshold===v?' selected':''}>${v}%</option>`).join('')}
    </select>
  </div>
  <div class="toolbar-group"><label>W Subiekcie:</label>
    <select id="deals-insub">
      <option value="all"${dealsInSubiekt==='all'?' selected':''}>Wszystkie</option>
      <option value="yes"${dealsInSubiekt==='yes'?' selected':''}>Tylko w Subiekcie</option>
      <option value="no"${dealsInSubiekt==='no'?' selected':''}>Tylko poza Subiektem</option>
    </select>
  </div>
  <div class="toolbar-group toggle-switch">
    <input type="checkbox" id="deals-only-new" ${dealsOnlyNew?'checked':''}><label for="deals-only-new">Tylko nowe</label>
  </div>
  <div class="toolbar-group toggle-switch">
    <input type="checkbox" id="deals-avail" ${dealsAvail?'checked':''}><label for="deals-avail">Tylko dostępne</label>
  </div>
  <div class="toolbar-group" style="margin-left:auto;gap:4px">
    <span style="font-size:.7rem;color:var(--text-muted)"><strong style="color:var(--text-primary)">${rows.length}</strong> okazji</span>
    <div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>
    <span id="deals-pager-info" style="font-size:.7rem;color:var(--text-muted)">Wyśw: <strong>${dealsStart+1}–${dealsEnd}</strong>/<strong>${totalDeals}</strong></span>
    <input type="number" id="deals-page-size" class="prof-input" style="width:45px;padding:2px 4px;font-size:.75rem" value="${dealsPageSize}" min="10" max="5000" step="10" title="Wyników na stronę">
    <button class="btn btn--ghost btn--sm" id="deals-pg-prev" ${dealsPage<=0?'disabled':''} style="padding:2px 6px">←</button>
    <span id="deals-pager-page" style="font-size:.7rem;color:var(--text-muted)">${dealsPage+1}/${totalDealsPages}</span>
    <button class="btn btn--ghost btn--sm" id="deals-pg-next" ${dealsPage>=totalDealsPages-1?'disabled':''} style="padding:2px 6px">→</button>
    <div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>
    <button class="btn btn--ghost btn--sm" id="deals-cols-btn" title="Edytuj układ" style="padding:2px 6px">⚙️</button>
    <a class="btn btn--ghost btn--sm" id="deals-export-btn" href="${exportUrl}" download title="Pobierz plik CSV" style="padding:2px 6px">⬇️ CSV</a>
  </div>
</div>
<div class="promo-table-wrap src-scroll-x">
<table class="promo-table" id="deals-table" style="table-layout:fixed;width:auto;min-width:100%"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>
<div style="font-size:.72rem;color:var(--text-muted);margin-top:6px;padding:0 4px">
  💡 Kliknij na cenę = oferty &nbsp;|&nbsp; Dwuklik na EAN = kopiuj &nbsp;|&nbsp; Dwuklik na nazwę = szczegóły
</div>`;

      let t;
      // API-level filters
      document.getElementById('deals-search').addEventListener('input', e => { clearTimeout(t); t=setTimeout(()=>{ dealsSearch=e.target.value; dealsPage=0; renderDeals(); },400); });
      document.getElementById('deals-thresh').addEventListener('change', e => { dealsThreshold=parseInt(e.target.value); dealsPage=0; renderDeals(); });
      document.getElementById('deals-avail').addEventListener('change', e => { dealsAvail=e.target.checked; dealsPage=0; renderDeals(); });
      document.getElementById('deals-insub').addEventListener('change', e => { dealsInSubiekt=e.target.value; dealsPage=0; renderDeals(); });

      // Client-side filters
      document.getElementById('deals-only-new').addEventListener('change', e => { dealsOnlyNew=e.target.checked; dealsPage=0; renderDealsFiltered(); });
      document.getElementById('deals-mfg')?.addEventListener('input', e => { clearTimeout(t); t=setTimeout(()=>{ dealsMfg=e.target.value; dealsPage=0; renderDealsFiltered(); },300); });
      document.getElementById('deals-price-min')?.addEventListener('input', e => { clearTimeout(t); t=setTimeout(()=>{ dealsPriceMin=e.target.value; dealsPage=0; renderDealsFiltered(); },400); });
      document.getElementById('deals-price-max')?.addEventListener('input', e => { clearTimeout(t); t=setTimeout(()=>{ dealsPriceMax=e.target.value; dealsPage=0; renderDealsFiltered(); },400); });
      
      document.getElementById('deals-cols-btn').addEventListener('click', () => showColLayoutModal('deals', DEALS_COL_DEFS, (newOrder) => { saveColOrder('deals', newOrder); renderDeals(); }));
      document.getElementById('deals-pg-prev')?.addEventListener('click', () => { dealsPage--; renderDealsFiltered(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      document.getElementById('deals-pg-next')?.addEventListener('click', () => { dealsPage++; renderDealsFiltered(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      document.getElementById('deals-page-size')?.addEventListener('change', e => { const v = parseInt(e.target.value); if (v >= 10) { dealsPageSize = v; dealsPage = 0; renderDealsFiltered(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });

      // Sorting
      document.querySelectorAll('#deals-table .deals-sortable[data-sort] > div:not(.col-resizer):not(.col-rh)').forEach(div => {
        div.addEventListener('click', () => {
          const th = div.closest('th');
          const col = th.dataset.sort;
          if (dealsSortCol === col) dealsSortAsc = !dealsSortAsc;
          else { dealsSortCol = col; dealsSortAsc = true; }
          renderDealsFiltered();
        });
      });

      bindDealsRowActions();
      initColResize('deals-table');
    } // end _doRenderDeals

    if (cached) {
      await _doRenderDeals(cached);
      _bgRefresh(el, `/sourcing/deals?${p}`, cacheKey, d => { setTabCache(cacheKey, d); _doRenderDeals(d); });
    } else {
      el.innerHTML = `<div style="padding:12px">${skeletonTable(8, 14)}</div>`;
      try {
        const data = await API.get(`/sourcing/deals?${p}`);
        setTabCache(cacheKey, data);
        await _doRenderDeals(data);
      } catch(e) { el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">⚠️</span><h3>Błąd</h3><p>${escHtml(e.message)}</p></div>`; }
    }
  }


  /* ═══════════════════════════════════════════════════════
     TAB 5 — MISSING (z paginacja 500/strona)
  ═══════════════════════════════════════════════════════ */
  let missingOffset = 0;

  async function renderMissing(resetPage = true) {
    if (resetPage) missingOffset = 0;
    const el = document.getElementById('src-tab-missing');
    el.innerHTML = '<div class="sourcing-empty"><span class="empty-icon">⏳</span><p>Ladowanie...</p></div>';
    try {
      const p = new URLSearchParams({ search: missingSearch, limit: 500, offset: missingOffset });
      if (missingSupplier) p.set('supplier_id', missingSupplier);
      if (missingAvail)    p.set('availability', missingAvail);
      if (missingMfg)      p.set('manufacturer', missingMfg);
      const { rows, total, limit, offset, suppliers, manufacturers } = await API.get(`/sourcing/missing?${p}`);

      const supOpts = ['<option value="">— Wszystkie hurtownie —</option>',
        ...suppliers.map(s=>`<option value="${s.id}"${missingSupplier===String(s.id)?' selected':''}>${escHtml(s.name)}</option>`)].join('');
      const mfgOpts = ['<option value="">— Wszyscy producenci —</option>',
        ...manufacturers.map(m=>`<option value="${escHtml(m)}"${missingMfg===m?' selected':''}>${escHtml(m)}</option>`)].join('');

      const MISSING_COL_DEFS = [
        { key:'#',            label:'#',                  frozen:true, width:'40px' },
        { key:'ean',          label:'EAN',                width:'120px' },
        { key:'name',         label:'Nazwa',              width:'250px' },
        { key:'manufacturer', label:'Producent',          width:'130px' },
        { key:'manufacturer_code', label:'Kod prod.',     width:'100px' },
        { key:'best_supplier',label:'Najtansza hurtownia',width:'150px' },
        { key:'best_price',   label:'Cena zakupu (najlepsza)', width:'100px' },
        { key:'availability', label:'Dost./Ilość',        width:'100px' },
        { key:'condition',    label:'Stan',               width:'80px' },
        { key:'warranty',     label:'Gwarancja',          width:'100px' },
      ];
      const misColOrder = getColOrder('missing', MISSING_COL_DEFS);
      const misHead = misColOrder.map(k => {
        const d = MISSING_COL_DEFS.find(c=>c.key===k);
        const width = d?.width || '100px';
        const sortable = !['#'].includes(k);
        const sortIc = missingSortCol===k ? (missingSortAsc ? '↑' : '↓') : (sortable ? '↕' : '');
        const clsStr = k==='#' ? 'row-num-th mis-sortable' : (sortable ? 'mis-sortable' : '');
        
        let savedWStr = '';
        try {
          const savedWidths = JSON.parse(localStorage.getItem('sg_colw_mis-table') || '{}');
          if (savedWidths[k]) {
            let w = savedWidths[k];
            if (k === '#' && w > 80) w = 40;
            savedWStr = k === '#' ? `width:${w}px;min-width:${w}px;max-width:${w}px;` : `width:${w}px;min-width:${w}px;`;
          }
        } catch(_) {}
        const styleStr = savedWStr || (k === '#' ? `width:${width};min-width:${width};max-width:${width};` : `width:${width};`);
        
        return `<th class="${clsStr}" ${sortable?`data-sort="${k}" `:''}data-col="${k}" style="${styleStr}position:relative">
          <div style="cursor:${sortable?'pointer':'default'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escHtml(d?.label||k)} ${sortIc}
          </div>
          <div class="col-resizer"></div>
        </th>`;
      }).join('');
      function misCell(key, r, i) {
        switch(key) {
          case '#':            return `<td class="row-num">${i + missingOffset + 1}</td>`;
          case 'ean':          return `<td class="ean-cell ean-copy" ondblclick="navigator.clipboard.writeText('${r.ean}'); window.Toast?.success('Skopiowano EAN: ${r.ean}')" title="Dwuklik = kopiuj EAN" style="cursor:pointer">${escHtml(r.ean)}</td>`;
          case 'name': {
            const refBtn = r.best_supplier_id ? `<span class="refresh-sup-btn" data-sup-id="${r.best_supplier_id}" data-sup-name="${escHtml(r.best_supplier||'')}" title="Odśwież cennik: ${escHtml(r.best_supplier||'')}" style="cursor:pointer;margin-left:6px;font-size:0.85rem">🔄</span>` : '';
            return `<td class="name-dblclick" data-ean="${r.ean}" style="max-width:1000px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" title="${escHtml(r.name||'Brak nazwy')}">${escHtml(r.name||'(brak nazwy w pliku dostawcy)')}${refBtn}</td>`;
          }
          case 'manufacturer': return `<td style="white-space:nowrap;color:var(--text-secondary)">${escHtml(r.manufacturer||'—')}</td>`;
          case 'manufacturer_code': return `<td style="font-size:.78rem;color:var(--text-secondary)">${escHtml(r.manufacturer_code||'—')}</td>`;
          case 'best_supplier':return `<td style="white-space:nowrap">${escHtml(r.best_supplier||'—')}</td>`;
          case 'best_price':   return `<td class="price-cell best-price price-clickable" data-ean="${r.ean}" title="Kliknij = oferty">${fmtPLN(r.best_price)}</td>`;
          case 'availability': {
            const qty = r.stock_quantity != null ? r.stock_quantity : 0;
            const icon = qty > 5 ? '<span style="color:#10b981" title="Dostępny">✅</span>' : qty > 0 ? '<span style="color:#f59e0b" title="Mało">⚠️</span>' : '<span style="color:#ef4444" title="Brak">❌</span>';
            return `<td class="num">${icon} ${qty}</td>`;
          }
          case 'condition': {
            const cond = r.condition || 'new';
            if (cond === 'used') return `<td style="text-align:center"><span style="display:inline-flex;align-items:center;gap:3px;background:#f59e0b22;color:#f59e0b;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap">🔶 Używany</span></td>`;
            return '<td style="text-align:center;color:var(--text-muted);font-size:.72rem">Nowy</td>';
          }
          case 'warranty':     return `<td style="font-size:.78rem;color:var(--text-secondary)">${r.warranty ? fmtWarranty(r.warranty) : '—'}</td>`;
          default:             return '<td></td>';
        }
      }
      // Sort missing rows if needed
      let sortedMissing = rows;
      if (missingSortCol) {
        sortedMissing = [...rows].sort((a, b) => {
          let av = a[missingSortCol], bv = b[missingSortCol];
          if (av == null) av = missingSortAsc ? Infinity : -Infinity;
          if (bv == null) bv = missingSortAsc ? Infinity : -Infinity;
          if (typeof av === 'string') return missingSortAsc ? av.localeCompare(bv,'pl') : bv.localeCompare(av,'pl');
          return missingSortAsc ? av - bv : bv - av;
        });
      }
      const colspan = misColOrder.length;
      const tbody = sortedMissing.length
        ? sortedMissing.map((r,i) => `<tr data-ean="${r.ean}">${misColOrder.map(k=>misCell(k,r,i)).join('')}</tr>`).join('')
        : `<tr><td colspan="${colspan}" style="text-align:center;padding:32px;color:var(--text-muted)">Brak produktow</td></tr>`;

      const pages = Math.ceil(total / limit);
      const curPage = Math.floor(offset / limit) + 1;
      const pagerHtml = `
  <div class="toolbar-group" style="margin-left:auto;gap:4px">
    <span style="font-size:.7rem;color:var(--text-muted)">Wyśw: <strong>${offset+1}–${Math.min(offset+limit, total)}</strong>/<strong>${total}</strong></span>
    <button class="btn btn--ghost btn--sm" id="mis-prev" ${offset===0?'disabled':''} style="padding:2px 6px">←</button>
    <span style="font-size:.7rem;color:var(--text-muted)">${curPage}/${pages||1}</span>
    <button class="btn btn--ghost btn--sm" id="mis-next" ${offset+limit>=total?'disabled':''} style="padding:2px 6px">→</button>
    <div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>
    <button class="btn btn--ghost btn--sm" id="mis-cols-btn" title="Edytuj układ" style="padding:2px 6px">⚙️</button>
  </div>`;

      el.innerHTML = `
<div class="missing-toolbar">
  <div class="toolbar-group"><label>🏭</label><select id="mis-sup">${supOpts}</select></div>
  <div class="toolbar-group"><label>🏷</label><select id="mis-mfg">${mfgOpts}</select></div>
  <div class="toolbar-group"><label>Dost.:</label>
    <select id="mis-avail">
      <option value=""${!missingAvail?' selected':''}>Wszystkie</option>
      <option value="available"${missingAvail==='available'?' selected':''}>Dostepne</option>
      <option value="unavailable"${missingAvail==='unavailable'?' selected':''}>Niedostepne</option>
    </select>
  </div>
  <div class="toolbar-group"><label>🔍</label>
    <input class="compare-search" id="mis-search" placeholder="Szukaj EAN/nazwa..." value="${escHtml(missingSearch)}">
  </div>
  ${pagerHtml}
</div>
<div class="missing-table-wrap src-scroll-x">
<table class="missing-table" id="mis-table" style="table-layout:fixed;width:auto;min-width:100%"><thead><tr>${misHead}</tr></thead><tbody>${tbody}</tbody></table></div>
<div style="font-size:.72rem;color:var(--text-muted);margin-top:6px;padding:0 4px">
  Kliknij na cene = oferty | Dwuklik na EAN = kopiuj | Dwuklik na nazwe = szczegoly
</div>`;

      let t;
      document.getElementById('mis-sup').addEventListener('change', e => { missingSupplier=e.target.value; renderMissing(); });
      document.getElementById('mis-mfg').addEventListener('change', e => { missingMfg=e.target.value; renderMissing(); });
      document.getElementById('mis-avail').addEventListener('change', e => { missingAvail=e.target.value; renderMissing(); });
      document.getElementById('mis-search').addEventListener('input', e => { clearTimeout(t); t=setTimeout(()=>{ missingSearch=e.target.value; renderMissing(); },400); });
      document.getElementById('mis-prev')?.addEventListener('click', () => { missingOffset = Math.max(0, missingOffset - 500); renderMissing(false); });
      document.getElementById('mis-next')?.addEventListener('click', () => { missingOffset += 500; renderMissing(false); });
      document.getElementById('mis-cols-btn')?.addEventListener('click', () => showColLayoutModal('missing', MISSING_COL_DEFS, (newOrder) => { saveColOrder('missing', newOrder); renderMissing(); }));

      // Sorting for missing (only on inner div to avoid column resize conflict)
      document.querySelectorAll('#mis-table .mis-sortable[data-sort] > div:not(.col-resizer):not(.col-rh)').forEach(div => {
        div.addEventListener('click', () => {
          const th = div.closest('th');
          const col = th.dataset.sort;
          if (missingSortCol === col) missingSortAsc = !missingSortAsc;
          else { missingSortCol = col; missingSortAsc = true; }
          renderMissing();
        });
      });

      document.querySelectorAll('#mis-table .price-clickable[data-ean]').forEach(td => {
        td.addEventListener('click', () => _showProductDetail(td.dataset.ean));
      });
      document.querySelectorAll('#mis-table .name-dblclick[data-ean]').forEach(td => {
        td.addEventListener('dblclick', () => _showProductDetail(td.dataset.ean));
        td.addEventListener('click', () => _showProductDetail(td.dataset.ean));
      });
      document.querySelectorAll('#mis-table .ean-copy[data-ean]').forEach(td => {
        td.addEventListener('dblclick', () => copyEan(td.dataset.ean));
      });
      initColResize('mis-table');
    } catch(e) { el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">⚠️</span><h3>Blad</h3><p>${escHtml(e.message)}</p></div>`; }
  }


  /* ═══════════════════════════════════════════════════════
     TAB 6 — RESTOCK (filtr producent + dostepnosc + "do zamowienia")
  ═══════════════════════════════════════════════════════ */
  async function renderRestock() {
    const el = document.getElementById('src-tab-restock');
    el.innerHTML = '<div class="sourcing-empty"><span class="empty-icon">⏳</span><p>Ladowanie...</p></div>';
    try {
      const p = new URLSearchParams({ search: restockSearch, days: restockDays, onlyNeeded: restockOnlyNeeded });
      if (restockSupplier) p.set('supplier_id', restockSupplier);
      if (restockAvail)    p.set('availability', restockAvail);
      if (restockMfg)      p.set('manufacturer', restockMfg);
      const { groups, total, suppliers, manufacturers } = await API.get(`/sourcing/restock?${p}`);
      const supOpts = ['<option value="">— Wszystkie hurtownie —</option>',
        ...suppliers.map(s=>`<option value="${s.id}"${restockSupplier===String(s.id)?' selected':''}>${escHtml(s.name)}</option>`)].join('');
      const mfgOpts = ['<option value="">— Wszyscy producenci —</option>',
        ...(manufacturers||[]).map(m=>`<option value="${escHtml(m)}"${restockMfg===m?' selected':''}>${escHtml(m)}</option>`)].join('');
      const exportUrl = `/api/sourcing/restock/export?${p}`;

      // Apply sorting within groups
      let sortedGroups = groups.map(g => {
        let sortedRows = [...g.rows];
        if (restockSortCol) {
          sortedRows.sort((a,b) => {
            let av = a[restockSortCol], bv = b[restockSortCol];
            if (av == null) av = restockSortAsc ? Infinity : -Infinity;
            if (bv == null) bv = restockSortAsc ? Infinity : -Infinity;
            if (typeof av === 'string') return restockSortAsc ? av.localeCompare(bv,'pl') : bv.localeCompare(av,'pl');
            return restockSortAsc ? av - bv : bv - av;
          });
        }
        return { ...g, rows: sortedRows };
      });

      // Flatten to apply global pagination
      let allRows = sortedGroups.flatMap(g => g.rows);
      let totalItems = allRows.length;
      let totalPages = Math.ceil(totalItems / restockPageSize) || 1;
      if (restockPage >= totalPages) restockPage = Math.max(0, totalPages - 1);

      let startIdx = restockPage * restockPageSize;
      let pagedRows = allRows.slice(startIdx, startIdx + restockPageSize);

      // Re-group the paged slice
      let pageGroups = [];
      let curGrp = null;
      for (let r of pagedRows) {
        let sup = r.best_supplier || 'Brak oferty';
        if (!curGrp || curGrp.supplier !== sup) {
          curGrp = { supplier: sup, rows: [], origGroup: groups.find(g => (g.supplier||'Brak oferty') === sup) };
          pageGroups.push(curGrp);
        }
        curGrp.rows.push(r);
      }

      const RESTOCK_COL_DEFS = [
        { key: '#',               label: '#',                  width: '40px',   cls: 'row-num-th' },
        { key: 'ean',             label: 'EAN',                width: '120px',  sortable: true },
        { key: 'name',            label: 'Nazwa',              width: '250px',  sortable: true },
        { key: 'manufacturer',    label: 'Producent',          width: '130px',  sortable: true },
        { key: 'stock',           label: 'Magazyn',            width: '80px',   sortable: true, align: 'center' },
        { key: 'sold_30d',        label: 'Spr.30d',            width: '80px',   sortable: true, align: 'center' },
        { key: 'needed_qty',      label: `Potrzeba (${restockDays}d)`, width: '110px', align: 'right' },
        { key: 'suggested_qty',   label: 'Do zamowienia',      width: '110px', align: 'right' },
        { key: 'buy_price',       label: 'C. zakupu',          width: '90px' },
        { key: 'best_price',      label: 'C. hurtowni',        width: '100px',  sortable: true },
        { key: 'availability',    label: 'Dost.',              width: '80px' },
        { key: 'condition',       label: 'Kondycja',           width: '80px' }
      ];

      let rstSavedWidths = {};
      try {
        rstSavedWidths = JSON.parse(localStorage.getItem('sg_colw_rst-table') || '{}');
      } catch(_) {}

      const rstThead = RESTOCK_COL_DEFS.map(d => {
        const width = d.width || '100px';
        const sortable = !!d.sortable;
        const sortIc = sortable ? (restockSortCol===d.key ? (restockSortAsc ? '↑' : '↓') : '↕') : '';
        const clsStr = d.cls || (sortable ? 'rst-sortable' : '');
        
        let savedWStr = '';
        if (rstSavedWidths[d.key]) {
          let w = rstSavedWidths[d.key];
          if (d.key === '#' && w > 80) w = 40;
          savedWStr = d.key === '#' ? `width:${w}px;min-width:${w}px;max-width:${w}px;` : `width:${w}px;min-width:${w}px;`;
        }
        const styleStr = savedWStr || (d.key === '#' ? `width:${width};min-width:${width};max-width:${width};` : `width:${width};min-width:${width};`);
        const alignStyle = d.align ? `text-align:${d.align};` : '';
        
        return `<th class="${clsStr}" ${sortable?`data-sort="${d.key}" `:''}data-col="${d.key}" style="${styleStr}${alignStyle}position:relative">
          <div style="cursor:${sortable?'pointer':'default'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escHtml(d.label)} ${sortIc}
          </div>
          <div class="col-resizer"></div>
        </th>`;
      }).join('');

      const groupsHtml = !pageGroups.length
        ? '<div class="sourcing-empty" style="padding:40px"><span class="empty-icon">📦</span><h3>Brak pozycji</h3><p>Zmien filtry lub zaimportuj dane Subiekta.</p></div>'
        : pageGroups.map((g, grpIdx) => {
          const origRows = g.origGroup ? g.origGroup.rows : g.rows;
          const needed_total = origRows.reduce((s,r) => s+(r.suggested_qty||0), 0);
          const cost_total   = origRows.reduce((s,r) => s+(r.best_price||0)*Math.max(0,r.suggested_qty||0), 0);
          
          let trs = g.rows.map((r) => {
            const needClass = r.suggested_qty > 0 ? '' : 'style="opacity:.5"';
            let globalIdx = allRows.indexOf(r) + 1;
            return `<tr ${needClass}>
              <td class="row-num">${globalIdx}</td>
              <td class="ean-cell ean-copy" data-ean="${r.ean}" title="Dwuklik = kopiuj EAN" style="cursor:pointer">${escHtml(r.ean)}</td>
              <td class="name-dblclick" data-ean="${r.ean}" title="${escHtml(r.name||'—')}" style="cursor:pointer">${escHtml(r.name||'—')}</td>
              <td style="color:var(--text-secondary)" title="${escHtml(r.manufacturer||'—')}">${escHtml(r.manufacturer||'—')}</td>
              <td style="text-align:center">${r.stock??0}</td>
              <td style="text-align:center">${r.sold_30d??0}</td>
              <td style="text-align:right">${r.needed_qty??0}
                <input class="restock-qty-input" data-ean="${r.ean}" type="number" min="0" value="${r.qty_override!==null?r.qty_override:(r.sold_30d??0)}" title="Reczna korekta bazy 30d" style="display:none">
              </td>
              <td class="restock-suggested" style="text-align:right">${r.suggested_qty>0?`<strong style="color:#10b981">${r.suggested_qty}</strong>`:'✓'}</td>
              <td class="price-cell">${fmtPLN(r.buy_price)}</td>
              <td class="price-cell best-price price-clickable" data-ean="${r.ean}" title="Kliknij = oferty" style="cursor:pointer">${fmtPLN(r.best_price)}</td>
              <td><span class="avail-dot ${r.availability||'unknown'}"></span>${r.availability==='available'?'Tak':r.availability==='unavailable'?'Nie':'?'}</td>
              <td style="text-align:center">${(r.condition||'new')==='used'?'<span style="display:inline-flex;align-items:center;gap:3px;background:#f59e0b22;color:#f59e0b;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap">🔶 Używany</span>':'<span style="color:var(--text-muted);font-size:.72rem">Nowy</span>'}</td>
            </tr>`;
          }).join('');
          return `
<div class="restock-group-header">🏭 ${escHtml(g.supplier)}
  <span class="group-count">${origRows.length} SKU &nbsp;| Do zam.: <strong>${needed_total}</strong> szt. &nbsp;| Est. koszt: ${fmtPLN(cost_total)} zl</span>
</div>
<div class="src-scroll-x">
<table class="restock-table" id="rst-table-${grpIdx}" data-rst-table style="table-layout:fixed;width:auto;min-width:100%"><thead><tr>${rstThead}</tr></thead><tbody>${trs}</tbody></table></div>`;
        }).join('');

      const pagerHtml = `
  <div class="toolbar-group" style="margin-left:auto;gap:4px">
    <span style="font-size:.7rem;color:var(--text-muted)"><strong style="color:var(--text-primary)">${total}</strong> poz.</span>
    <div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>
    <span style="font-size:.7rem;color:var(--text-muted)">Wyśw: <strong>${startIdx+1}–${Math.min(startIdx+restockPageSize, totalItems)}</strong>/<strong>${totalItems}</strong></span>
    <button class="btn btn--ghost btn--sm rst-prev-btn" ${restockPage===0?'disabled':''} style="padding:2px 6px">←</button>
    <span style="font-size:.7rem;color:var(--text-muted)">${restockPage+1}/${totalPages||1}</span>
    <button class="btn btn--ghost btn--sm rst-next-btn" ${restockPage>=totalPages-1?'disabled':''} style="padding:2px 6px">→</button>
    <div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>
    <a class="btn btn--ghost btn--sm" href="${exportUrl}" download title="Pobierz plik CSV" style="padding:2px 6px">⬇️ CSV</a>
  </div>`;

      el.innerHTML = `
<div class="restock-toolbar" style="flex-wrap:wrap;gap:10px">
  <div class="toolbar-group"><label>🏭 Hurtownia:</label><select id="rst-sup">${supOpts}</select></div>
  <div class="toolbar-group"><label>🏷 Producent:</label><select id="rst-mfg">${mfgOpts}</select></div>
  <div class="toolbar-group">
    <label>Zapas na dni:</label>
    <select id="rst-days">
      ${[7,14,30,45,60,90].map(d=>`<option value="${d}"${restockDays===d?' selected':''}>${d} dni</option>`).join('')}
    </select>
    <input type="number" id="rst-days-custom" min="1" max="365" placeholder="lub wpisz" style="width:90px"
      class="restock-qty-input" value="" title="Wpisz recznie liczbe dni">
  </div>
  <div class="toolbar-group toggle-switch">
    <input type="checkbox" id="rst-only" ${restockOnlyNeeded?'checked':''}>
    <label for="rst-only">Tylko do zamowienia</label>
  </div>
  <div class="toolbar-group"><label>Dostepnosc:</label>
    <select id="rst-avail">
      <option value=""${!restockAvail?' selected':''}>Wszystkie</option>
      <option value="available"${restockAvail==='available'?' selected':''}>Dostepne</option>
      <option value="unavailable"${restockAvail==='unavailable'?' selected':''}>Niedostepne</option>
    </select>
  </div>
  <div class="toolbar-group"><label>🔍</label>
    <input class="compare-search" id="rst-search" placeholder="Szukaj EAN/nazwa..." value="${escHtml(restockSearch)}">
  </div>
  ${pagerHtml}
</div>
<div class="restock-wrap" id="rst-wrap">${groupsHtml}</div>`;

      let t;
      document.getElementById('rst-sup').addEventListener('change', e => { restockSupplier=e.target.value; renderRestock(); });
      document.getElementById('rst-mfg').addEventListener('change', e => { restockMfg=e.target.value; renderRestock(); });
      document.getElementById('rst-avail').addEventListener('change', e => { restockAvail=e.target.value; renderRestock(); });
      document.getElementById('rst-days').addEventListener('change', e => { restockDays=parseInt(e.target.value); renderRestock(); });
      document.getElementById('rst-days-custom').addEventListener('change', e => { const v=parseInt(e.target.value); if(v>0){restockDays=v;renderRestock();} });
      document.getElementById('rst-only').addEventListener('change', e => { restockOnlyNeeded=e.target.checked; renderRestock(); });
      document.getElementById('rst-search').addEventListener('input', e => { clearTimeout(t); t=setTimeout(()=>{ restockSearch=e.target.value; restockPage=0; renderRestock(); },400); });
      document.querySelectorAll('.rst-prev-btn').forEach(btn => btn.addEventListener('click', () => { restockPage--; renderRestock(); }));
      document.querySelectorAll('.rst-next-btn').forEach(btn => btn.addEventListener('click', () => { restockPage++; renderRestock(); }));

      document.querySelectorAll('.restock-qty-input[data-ean]').forEach(inp => {
        inp.addEventListener('change', async () => {
          const ean = inp.dataset.ean, qty = parseInt(inp.value)||0;
          try { await API.patch('/sourcing/restock/override', {ean, qty}); renderRestock(); }
          catch(e) { Toast.error('Blad zapisu: ' + e.message); }
        });
      });

      // Resize dla wszystkich tabel restock
      document.querySelectorAll('[data-rst-table]').forEach((t) => {
        initColResize(t.id);
      });

      // Sorting for restock (only on inner div to avoid column resize conflict)
      document.querySelectorAll('.rst-sortable[data-sort] > div:not(.col-resizer):not(.col-rh)').forEach(div => {
        div.addEventListener('click', () => {
          const th = div.closest('th');
          const col = th.dataset.sort;
          if (restockSortCol === col) restockSortAsc = !restockSortAsc;
          else { restockSortCol = col; restockSortAsc = true; }
          renderRestock();
        });
      });

      // Premium interactions
      document.querySelectorAll('#rst-wrap .price-clickable[data-ean]').forEach(td => {
        td.addEventListener('click', () => showSupplierPricesModal(td.dataset.ean, { rows: allRows, suppliers }));
      });
      document.querySelectorAll('#rst-wrap .name-dblclick[data-ean]').forEach(td => {
        td.addEventListener('dblclick', () => showProductModal(td.dataset.ean, { rows: allRows, suppliers }));
        td.addEventListener('click', () => showProductModal(td.dataset.ean, { rows: allRows, suppliers }));
      });
      document.querySelectorAll('#rst-wrap .ean-copy[data-ean]').forEach(td => {
        td.addEventListener('dblclick', () => copyEan(td.dataset.ean));
      });

    } catch(e) { el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">⚠️</span><h3>Blad</h3><p>${escHtml(e.message)}</p></div>`; }
  }

  /* â”€â”€ expose public API â”€â”€ */
  /* ═══════════════════════════════════════════════════════
     MODAL: Ceny w hurtowniach (klik na cenę)
  ═══════════════════════════════════════════════════════ */
  function showSupplierPricesModal(ean, data) {
    if (!data) return;
    const row = data.rows.find(r => r.ean === ean);
    if (!row) return;
    const { suppliers } = data;

    // Zbierz wszystkie oferty dla EAN
    const offers = [];
    for (const s of suppliers) {
      const sp = row.supplier_prices?.[s.id];
      if (!sp) continue;
      offers.push({
        supplier: s.name,
        supplier_id: s.id,
        price: sp.price,
        orig_price: sp.orig_price,
        currency: sp.currency || s.currency || 'PLN',
        availability: sp.availability,
      });
    }

    // Sortuj: dostępne najpierw, potem wg ceny ASC
    offers.sort((a, b) => {
      const aAvail = a.availability === 'available' ? 0 : 1;
      const bAvail = b.availability === 'available' ? 0 : 1;
      if (aAvail !== bAvail) return aAvail - bAvail;
      return (a.price || 0) - (b.price || 0);
    });

    const sigMap = {green:'🟢',yellow:'🟡',red:'🔴',none:'—'};
    const sigTitle = {green:'Opłacalne (Kup taniej)',yellow:'Neutralne (Podobna cena)',red:'Drożej (Nie opłaca się)',none:'Brak analizy'};

    const rows = offers.length ? offers.map((o, i) => {
      const avail = o.availability === 'available'
        ? '<span class="avail-badge avail-ok">✅ Dostępny</span>'
        : o.availability === 'unavailable'
          ? '<span class="avail-badge avail-no">❌ Niedostępny</span>'
          : '<span class="avail-badge avail-unk">âť“ Nieznana</span>';
      const isBest = o.price === Math.min(...offers.filter(x=>x.availability==='available').map(x=>x.price));
      const origInfo = o.orig_price && o.currency !== 'PLN'
        ? `<div style="font-size:.72rem;color:var(--text-muted)">${parseFloat(o.orig_price).toFixed(2)} ${o.currency}</div>` : '';
      return `<tr${i===0?' class="best-row"':''}>
        <td>${i===0&&o.availability==='available'?'â­ ':''}${escHtml(o.supplier)}</td>
        <td class="price-cell">${fmtPLN(o.price)}${origInfo}</td>
        <td>${avail}</td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted)">Brak ofert dla tego EAN</td></tr>`;

    Modal.show({
      title: `💰 Oferty hurtowni — ${escHtml(row.name || ean)}`,
      body: `
<div style="margin-bottom:12px;display:flex;gap:16px;flex-wrap:wrap;font-size:.82rem;color:var(--text-secondary)">
  <span>EAN: <strong style="color:var(--text-primary);font-family:monospace">${escHtml(ean)}</strong></span>
  <span>Cena zakupu: <strong style="color:var(--text-primary)">${fmtPLN(row.buy_price)}</strong></span>
  <span>Sygnał: <strong title="${sigTitle[row.signal]||''}">${sigMap[row.signal]||'—'}</strong></span>
</div>
<div style="overflow-x:auto">
<table class="compare-table" style="min-width:340px">
  <thead><tr><th>Hurtownia</th><th>Cena PLN</th><th>Dostępność</th></tr></thead>
  <tbody>${rows}</tbody>
</table></div>
<div style="font-size:.72rem;color:var(--text-muted);margin-top:10px">
  Sortowanie: dostępne najpierw → cena rosnąco
</div>`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`,
    });
  }

  /* ═══════════════════════════════════════════════════════
     MODAL: Szczegóły produktu (dwuklik na nazwę)
  ═══════════════════════════════════════════════════════ */
  async function showProductModal(ean, data) {
    if (!data) return;
    const row = data.rows.find(r => r.ean === ean);
    if (!row) return;
    const { suppliers } = data;

    Modal.show({
      title: `📦 ${escHtml(row.name || ean)}`,
      body: `<div id="prod-modal-body" style="min-height:120px;display:flex;align-items:center;justify-content:center"><span style="color:var(--text-muted)">⏳ Ładowanie...</span></div>`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`,
    });

    let product = null;
    try { product = await API.get(`/products?ean=${encodeURIComponent(ean)}&limit=1`).then(r => r.items?.[0] || null); } catch {}

    const imgHtml = product?.image_url
      ? `<img src="${escHtml(product.image_url)}" alt="miniatura" style="max-width:120px;max-height:120px;object-fit:contain;border-radius:8px;border:1px solid var(--border)">`
      : `<div style="width:100px;height:100px;background:var(--bg-elevated);border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:2rem">📦</div>`;

    const descHtml = product?.description
      ? `<div style="font-size:.8rem;color:var(--text-secondary);line-height:1.5;max-height:80px;overflow:auto">${escHtml(product.description).slice(0,400)}${product.description.length>400?'…':''}</div>` : '';

    const offers = suppliers
      .map(s => ({ s, sp: row.supplier_prices?.[s.id] }))
      .filter(x => x.sp)
      .sort((a,b) => {
        const aa = a.sp.availability==='available'?0:1, bb = b.sp.availability==='available'?0:1;
        if (aa !== bb) return aa-bb;
        return (a.sp.price||0) - (b.sp.price||0);
      });

    const offersHtml = offers.length ? `
<div style="margin-top:14px">
  <div style="font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:6px">🏭 Oferty hurtowni</div>
  ${offers.map(({s,sp}) => {
    const qty = sp.stock_quantity;
    const availVal = sp.availability || 'unknown';
    let avail = '❓';
    let text = 'Nieznany';
    if (availVal === 'available' || (qty != null && qty > 0)) {
      avail = '✅';
      text = qty != null ? `${qty} szt` : 'Dostępny';
    } else if (availVal === 'unavailable' || availVal === 'out_of_stock' || (qty != null && qty === 0)) {
      avail = '❌';
      text = 'Brak';
    } else if (availVal === 'incoming') {
      avail = '⏳';
      text = qty != null ? `W drodze (${qty})` : 'W drodze';
    }
    const stockStr = text !== 'Nieznany' ? ` (${text})` : '';
    return `<div style="display:flex;gap:10px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.82rem">
      <span style="flex:1">${avail} ${escHtml(s.name)}${stockStr}</span>
      <strong style="color:${sp.availability==='available'?'#10b981':'var(--text-muted)'}">${fmtPLN(sp.price)}</strong>
    </div>`;
  }).join('')}
</div>` : '';

    document.getElementById('prod-modal-body').innerHTML = `
<div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap">
  <div style="flex-shrink:0">${imgHtml}</div>
  <div style="flex:1;min-width:220px">
    <h3 style="margin:0 0 8px;font-size:1rem;line-height:1.4">${escHtml(row.name||'—')}</h3>
    <div style="font-family:monospace;font-size:.8rem;color:var(--text-muted);margin-bottom:10px">EAN: ${escHtml(ean)}</div>
    ${descHtml}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:12px;font-size:.82rem">
      <div class="prod-stat-mini"><span>Stan mag.</span><strong>${row.stock??'—'}</strong></div>
      <div class="prod-stat-mini"><span>Spr. 30d</span><strong>${row.sold_30d??'—'}</strong></div>
      <div class="prod-stat-mini"><span>C. zakupu</span><strong>${fmtPLN(row.buy_price)}</strong></div>
      <div class="prod-stat-mini"><span>C. sprzedaży</span><strong>${fmtPLN(row.sell_price)}</strong></div>
      <div class="prod-stat-mini"><span>Najlepsza oferta</span><strong style="color:#10b981">${fmtPLN(row.best_price)}</strong></div>
      <div class="prod-stat-mini"><span>Sygnał</span><strong title="${sigTitle[row.signal]||''}">${sigMap[row.signal]||'—'}</strong></div>
    </div>
  </div>
</div>
${offersHtml}`;
  }

  /* ═══════════════════════════════════════════════════════
     TAB 7 — LISTING GAP ANALYSIS (Niewystawione produkty)
  ═══════════════════════════════════════════════════════ */
  let lstPresentOn = [], lstMissingOn = [], listingSearch = '', listingPage = 0;
  let listingSort = '', listingAsc = true;
  let lstInStock = true;
  const LISTING_PAGE_SIZE = 200;

  async function renderListing() {
    const el = document.getElementById('src-tab-listing');
    if (!el) return;
    el.innerHTML = '<div class="sourcing-empty"><span class="empty-icon">&#9203;</span><p>Ladowanie...</p></div>';

    let status;
    try { status = await API.get('/sourcing/listing/status'); } catch { status = { row_count: 0, platforms: [] }; }

    if (!status.row_count) {
      el.innerHTML = `
<div class="sourcing-empty">
  <span class="empty-icon">&#128203;</span>
  <h3>Brak danych o wystawieniach</h3>
  <p>Użyj przycisku <strong>Synchronizuj z Sellasist</strong> w zakładce Ustawienia -> Integracje,<br>
  aby pobrać listę produktów i informacje o tym, gdzie są wystawione.</p>
</div>`;
      return;
    }

    // Load coverage + gaps in parallel
    let coverage = [], gapData = { rows: [], total: 0, platforms: [] };
    try { coverage = await API.get('/sourcing/listing/coverage'); } catch {}
    try {
      const qs = new URLSearchParams({ present_on: lstPresentOn.join(','), missing_on: lstMissingOn.join(','), search: listingSearch, limit: LISTING_PAGE_SIZE, offset: listingPage * LISTING_PAGE_SIZE, sort: listingSort, asc: listingAsc ? '1' : '0', in_stock: lstInStock });
      gapData = await API.get('/sourcing/listing/gaps?' + qs);
    } catch(e) {
      el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">&#10060;</span><h3>Blad</h3><p>${escHtml(e.message)}</p></div>`;
      return;
    }

    const platforms = gapData.platforms;
    const platOptsPresent = platforms.map(p =>
      `<option value="${escHtml(p)}"${lstPresentOn.includes(p)?' selected':''}>${p}</option>`
    ).join('');
    const platOptsMissing = platforms.map(p =>
      `<option value="${escHtml(p)}"${lstMissingOn.includes(p)?' selected':''}>${p}</option>`
    ).join('');

    // Coverage bars
    const coverageBars = coverage.map(c => `
<div class="listing-cov-row">
  <span class="listing-cov-name">${escHtml(c.platform)}</span>
  <div class="listing-cov-bar-wrap">
    <div class="listing-cov-bar" style="width:${c.pct}%"></div>
  </div>
  <span class="listing-cov-pct">${c.listed}/${c.total} (${c.pct}%)</span>
  <button class="btn btn--ghost btn--sm listing-filter-btn" data-platform="${escHtml(c.platform)}">Pokaż luki</button>
</div>`).join('');

    // Build table rows
    const totalPages = Math.ceil(gapData.total / LISTING_PAGE_SIZE);
    const rows = gapData.rows.map((r, i) => {
      const presentBadges = r.present_on.map(p => {
        const isPrymus = p.toLowerCase().includes('prymus') || p.includes('PanFlash') || p.includes('PanKabelek');
        return `<span class="listing-badge present ${isPrymus ? 'prymus-badge' : ''}">${escHtml(p)}</span>`;
      }).join('');
      const missingBadges = r.missing_on.map(p => {
        const isPrymus = p.toLowerCase().includes('prymus') || p.includes('PanFlash') || p.includes('PanKabelek');
        return `<span class="listing-badge missing ${isPrymus ? 'prymus-badge-missing' : ''}">${escHtml(p)}</span>`;
      }).join('');
      const buyGross = r.buy_price_gross != null ? fmtPLN(r.buy_price_gross) : (r.buy_price != null ? fmtPLN(r.buy_price * 1.23) : '-');
      const sellGross = r.sell_price_gross != null ? fmtPLN(r.sell_price_gross) : (r.sell_price != null ? fmtPLN(r.sell_price) : '-');
      return `<tr>
        <td class="row-num">${listingPage * LISTING_PAGE_SIZE + i + 1}</td>
        <td class="ean-cell ean-copy" data-ean="${escHtml(r.ean)}" title="Kliknij — kopiuj" style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.74rem">${escHtml(r.ean)}</td>
        <td style="max-width:100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.78rem" title="${escHtml(r.name||'')}">${escHtml(r.name||'(brak nazwy)')}</td>
        <td style="max-width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.78rem" title="${escHtml(r.manufacturer||'')}">${escHtml(r.manufacturer||'-')}</td>
        <td style="text-align:right">${r.stock??'-'}</td>
        <td style="text-align:right">${r.sold_30d??'-'}</td>
        <td style="text-align:right;font-weight:600">${buyGross}</td>
        <td style="text-align:right;color:var(--green)">${sellGross}</td>
        <td style="max-width:380px;white-space:normal;line-height:1.7">${presentBadges||'<span style="color:var(--text-muted);font-size:.72rem">brak</span>'}</td>
        <td style="max-width:380px;white-space:normal;line-height:1.7">${missingBadges||'<span style="color:#10b981;font-size:.72rem">&#10003; wszędzie</span>'}</td>
      </tr>`;
    }).join('');

    const exportUrl = `/api/sourcing/listing/gaps/export.csv?present_on=${encodeURIComponent(lstPresentOn.join(','))}&missing_on=${encodeURIComponent(lstMissingOn.join(','))}&search=${encodeURIComponent(listingSearch)}&in_stock=${lstInStock}`;
    
    const covExpanded = localStorage.getItem('listingCovExpanded') === 'true';

    el.innerHTML = `
<div class="listing-header-section">
  <div class="listing-coverage-panel" style="padding:10px 16px;">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-size:.8rem;font-weight:700;color:var(--text-muted);white-space:nowrap">&#128202; Pokrycie platform:</span>
      <div id="cov-list-wrap" style="display:flex;flex-wrap:wrap;gap:8px;flex:1">
        ${coverage.map(c => `<div style="display:flex;align-items:center;gap:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:4px 10px;font-size:.75rem">
          <span style="font-weight:600;color:var(--text-primary);white-space:nowrap">${escHtml(c.platform)}</span>
          <div style="width:60px;height:5px;background:var(--bg-base);border-radius:3px;overflow:hidden"><div style="height:100%;width:${c.pct}%;background:linear-gradient(90deg,#6366f1,#10b981)"></div></div>
          <span style="color:var(--text-muted);white-space:nowrap">${c.pct}%</span>
          <button class="btn btn--ghost btn--sm listing-filter-btn" data-platform="${escHtml(c.platform)}" style="padding:1px 6px;font-size:.65rem">Luki</button>
        </div>`).join('')}
      </div>
    </div>
  </div>
</div>

<div class="compare-toolbar" style="margin-top:10px;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 14px">

  <!-- Wystawione na — dropdown trigger -->
  <div class="lst-dd-wrap" id="dd-wrap-present" style="position:relative">
    <button class="lst-dd-btn" id="dd-btn-present">
      &#127760; Wystawione na
      <span id="dd-badge-present" class="lst-dd-badge" style="display:${lstPresentOn.length?'inline-flex':'none'}">${lstPresentOn.length}</span>
      <span style="margin-left:4px;font-size:.7rem;opacity:.6">&#9660;</span>
    </button>
    <div class="lst-dd-panel" id="dd-panel-present" style="display:none">
      <select id="lst-present-on" multiple style="width:100%;min-width:200px;min-height:120px;border:none;background:transparent;color:var(--text-primary);font-size:.82rem;outline:none;padding:4px">${platOptsPresent}</select>
    </div>
  </div>

  <!-- Brakuje na — dropdown trigger -->
  <div class="lst-dd-wrap" id="dd-wrap-missing" style="position:relative">
    <button class="lst-dd-btn" id="dd-btn-missing">
      &#127760; Brakuje na
      <span id="dd-badge-missing" class="lst-dd-badge" style="display:${lstMissingOn.length?'inline-flex':'none'}">${lstMissingOn.length}</span>
      <span style="margin-left:4px;font-size:.7rem;opacity:.6">&#9660;</span>
    </button>
    <div class="lst-dd-panel" id="dd-panel-missing" style="display:none">
      <select id="lst-missing-on" multiple style="width:100%;min-width:200px;min-height:120px;border:none;background:transparent;color:var(--text-primary);font-size:.82rem;outline:none;padding:4px">${platOptsMissing}</select>
    </div>
  </div>

  <!-- Szukaj -->
  <input class="compare-search" id="lst-search" placeholder="&#128269; Szukaj EAN lub nazwy..." value="${escHtml(listingSearch)}" style="min-width:200px;flex:1">

  <!-- Tylko dostępne -->
  <label class="toggle-switch" style="display:flex;align-items:center;gap:7px;font-size:.8rem;color:var(--text-muted);cursor:pointer;white-space:nowrap">
    <input type="checkbox" id="lst-in-stock" ${lstInStock ? 'checked' : ''}>
    Stan &gt; 0
  </label>

  <button class="btn btn--primary btn--sm" id="lst-apply-filters">Zastosuj</button>
  <button class="btn btn--ghost btn--sm" id="lst-clear-filters">&#10005; Wyczyść</button>
  <button class="btn btn--ghost btn--sm" id="lst-refresh-btn" title="Odśwież tabelę">&#x21BB; Odśwież</button>
  <button class="btn btn--secondary btn--sm" id="lst-sync-sellasist-btn" title="Pobierz nowe dane z Sellasist (w tle)">🔌 Synchronizuj</button>
  <a class="btn btn--secondary btn--sm" href="${exportUrl}" download style="margin-left:auto">&#8659; CSV</a>
</div>

<div class="listing-pager" style="font-size:.82rem;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:center;gap:12px">
  <span>Znaleziono: <strong>${gapData.total}</strong> produktow</span>
  ${totalPages > 1 ? `<button class="btn btn--ghost btn--sm" id="lst-prev" ${listingPage===0?'disabled':''}>&#8249; Poprz.</button>
  <span>str. ${listingPage+1}/${totalPages}</span>
  <button class="btn btn--ghost btn--sm" id="lst-next" ${listingPage>=totalPages-1?'disabled':''}>Nast. &#8250;</button>` : ''}
</div>

<div class="compare-table-wrap">
  <table class="compare-table">
    <thead><tr>
      <th class="row-num-th">#</th>
      <th class="lst-th" data-col="ean" style="cursor:pointer">EAN ${listingSort==='ean'?(listingAsc?'&#x25B2;':'&#x25BC;'):'&#x2195;'}</th>
      <th class="lst-th" data-col="name" style="cursor:pointer">Nazwa ${listingSort==='name'?(listingAsc?'&#x25B2;':'&#x25BC;'):'&#x2195;'}</th>
      <th class="lst-th" data-col="manufacturer" style="cursor:pointer">Producent ${listingSort==='manufacturer'?(listingAsc?'&#x25B2;':'&#x25BC;'):'&#x2195;'}</th>
      <th class="lst-th" data-col="stock" style="text-align:right;cursor:pointer">Stan ${listingSort==='stock'?(listingAsc?'&#x25B2;':'&#x25BC;'):'&#x2195;'}</th>
      <th class="lst-th" data-col="sold_30d" style="text-align:right;cursor:pointer">Spr.30d ${listingSort==='sold_30d'?(listingAsc?'&#x25B2;':'&#x25BC;'):'&#x2195;'}</th>
      <th class="lst-th" data-col="buy_price_gross" style="text-align:right;cursor:pointer" title="Cena zakupu brutto (z VAT 23%)">Zakup brutto ${listingSort==='buy_price_gross'?(listingAsc?'&#x25B2;':'&#x25BC;'):'&#x2195;'}</th>
      <th class="lst-th" data-col="sell_price" style="text-align:right;cursor:pointer" title="Cena sprzedaży brutto">Sprzedaż brutto ${listingSort==='sell_price'?(listingAsc?'&#x25B2;':'&#x25BC;'):'&#x2195;'}</th>
      <th>Wystawione na</th>
      <th>Brakuje na</th>
    </tr></thead>
    <tbody>${rows||'<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">Brak wynikow dla wybranych filtrów</td></tr>'}</tbody>
  </table>
</div>`;

    // Bind controls
    let _lstTimer;

    // Custom dropdown toggle for 'Wystawione na' / 'Brakuje na'
    ['present', 'missing'].forEach(key => {
      const btn   = document.getElementById('dd-btn-' + key);
      const panel = document.getElementById('dd-panel-' + key);
      if (!btn || !panel) return;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        // close the other
        const other = document.getElementById('dd-panel-' + (key === 'present' ? 'missing' : 'present'));
        if (other) other.style.display = 'none';
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      });
    });
    document.addEventListener('click', () => {
      document.getElementById('dd-panel-present')?.style && (document.getElementById('dd-panel-present').style.display = 'none');
      document.getElementById('dd-panel-missing')?.style && (document.getElementById('dd-panel-missing').style.display = 'none');
    });
    document.getElementById('dd-panel-present')?.addEventListener('click', e => e.stopPropagation());
    document.getElementById('dd-panel-missing')?.addEventListener('click', e => e.stopPropagation());

    document.getElementById('lst-apply-filters').addEventListener('click', () => {
      lstPresentOn = Array.from(document.getElementById('lst-present-on').selectedOptions).map(o => o.value);
      lstMissingOn = Array.from(document.getElementById('lst-missing-on').selectedOptions).map(o => o.value);
      lstInStock = document.getElementById('lst-in-stock').checked;
      // close dropdowns
      document.getElementById('dd-panel-present').style.display = 'none';
      document.getElementById('dd-panel-missing').style.display = 'none';
      listingPage = 0; renderListing();
    });
    document.getElementById('lst-clear-filters')?.addEventListener('click', () => {
      lstPresentOn = []; lstMissingOn = []; lstInStock = false;
      listingPage = 0; renderListing();
    });
    document.getElementById('lst-refresh-btn')?.addEventListener('click', () => {
      renderListing();
    });
    document.getElementById('lst-sync-sellasist-btn')?.addEventListener('click', async () => {
      try {
        Toast.info('Uruchamianie synchronizacji z Sellasist...');
        await API.post('/sellasist/sync', {});
        Toast.success('Synchronizacja wystartowała. Odśwież tabelę za kilka minut.');
      } catch(e) {
        Toast.error('Błąd synchronizacji: ' + e.message);
      }
    });
    document.getElementById('lst-search').addEventListener('input', e => {
      clearTimeout(_lstTimer); _lstTimer = setTimeout(() => { listingSearch = e.target.value; listingPage = 0; renderListing(); }, 400);
    });
    document.getElementById('lst-in-stock').addEventListener('change', e => {
      lstInStock = e.target.checked; listingPage = 0; renderListing();
    });
    document.getElementById('lst-prev')?.addEventListener('click', () => { listingPage--; renderListing(); });
    document.getElementById('lst-next')?.addEventListener('click', () => { listingPage++; renderListing(); });

    // Column sort
    el.querySelectorAll('.lst-th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (listingSort === col) listingAsc = !listingAsc;
        else { listingSort = col; listingAsc = true; }
        listingPage = 0;
        renderListing();
      });
    });

    // Quick filter buttons from coverage bars
    el.querySelectorAll('.listing-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => { lstMissingOn = [btn.dataset.platform]; listingPage = 0; renderListing(); });
    });

    // EAN copy
    el.querySelectorAll('.ean-copy').forEach(td => {
      td.addEventListener('click', () => {
        navigator.clipboard?.writeText(td.dataset.ean).then(() => Toast.success('Skopiowano EAN'));
      });
    });

    // Włącz regulację szerokości kolumn
    if (typeof initColResize === 'function') {
      setTimeout(() => {
        const t = el.querySelector('.compare-table');
        if (t) initColResize(t);
      }, 50);
    }
  }
    /* ═══════════════════════════════════════════════════════
     EXPORT API
  ═══════════════════════════════════════════════════════ */
  async function _saveSupConfig(id) {
      const payload = {
        name:          document.getElementById('cfg-name')?.value,
        currency:      document.getElementById('cfg-currency').value,
        exchange_rate: document.getElementById('cfg-rate').value,
        col_settings:  document.getElementById('cfg-cols').value,
        source_url:    document.getElementById('cfg-source-url')?.value,
        url_user:      document.getElementById('cfg-url-user')?.value,
        url_pass:      document.getElementById('cfg-url-pass')?.value,
        ftp_host:      document.getElementById('cfg-ftp-host')?.value,
        ftp_path:      document.getElementById('cfg-ftp-path')?.value,
        ftp_user:      document.getElementById('cfg-ftp-user')?.value,
        ntt_client_id: document.getElementById('cfg-ntt-client-id')?.value,
        ntt_client_secret: document.getElementById('cfg-ntt-client-secret')?.value,
        ntt_user_id:   document.getElementById('cfg-ntt-user-id')?.value,
        action_customer_id: document.getElementById('cfg-action-customer-id')?.value,
        action_user_name:   document.getElementById('cfg-action-user-name')?.value,
        action_api_key:     document.getElementById('cfg-action-api-key')?.value
      };
      
      const ftp_pass = document.getElementById('cfg-ftp-pass')?.value;
      if (ftp_pass && ftp_pass.trim() !== '') {
        payload.ftp_pass = ftp_pass;
      }
      
      // Remove undefined fields
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      try {
        if (payload.col_settings) JSON.parse(payload.col_settings); // walidacja
        await API.patch(`/sourcing/suppliers/${id}`, payload);
        Toast.success('Zapisano ustawienia');
        Modal.hide();
        renderSuppliers();
      } catch(e) { Toast.error(e.message); }
  }

  function _setSourceType(type) {
      _sourceType = type;
      // highlight active tab button
      ['url','file','ftp','elko_api','impakt_api','ntt_api','action_api'].forEach(t => {
        const b = document.getElementById(`st-${t}`);
        if(b) b.classList.toggle('active', t === type);
      });
      const w1 = document.getElementById('sup-url-wrap');       if(w1) w1.style.display      = type==='url'      ? 'block':'none';
      const w2 = document.getElementById('sup-url-auth-wrap');  if(w2) w2.style.display      = type==='url'      ? 'block':'none';
      const w3 = document.getElementById('sup-file-wrap');      if(w3) w3.style.display      = type==='file'     ? 'block':'none';
      const w4 = document.getElementById('sup-ftp-wrap');       if(w4) w4.style.display      = type==='ftp'      ? 'block':'none';
      const w5 = document.getElementById('sup-elko-fields');    if(w5) w5.style.display      = type==='elko_api' ? 'block':'none';
      const w6 = document.getElementById('sup-impakt-fields');  if(w6) w6.style.display      = type==='impakt_api'? 'block':'none';
      const w7 = document.getElementById('sup-ntt-fields');     if(w7) w7.style.display      = type==='ntt_api'? 'block':'none';
      const w8 = document.getElementById('sup-action-fields');  if(w8) w8.style.display      = type==='action_api'? 'block':'none';
      // when Elko API is selected, force EUR currency
      if (type === 'elko_api') {
        const currSel = document.getElementById('sup-currency');
        if(currSel) { currSel.value = 'EUR'; }
        const rateWrap = document.getElementById('sup-rate-wrap');
        if(rateWrap) rateWrap.style.display = 'block';
      }
  }

  function _setElkoTab(tab) {
    const apiPanel   = document.getElementById('elko-panel-api');
    const filesPanel = document.getElementById('elko-panel-files');
    const apiBtn     = document.getElementById('elko-tab-api');
    const filesBtn   = document.getElementById('elko-tab-files');
    if (!apiPanel || !filesPanel) return;
    const isApi = tab === 'api';
    apiPanel.style.display   = isApi ? 'block' : 'none';
    filesPanel.style.display = isApi ? 'none'  : 'block';
    if (apiBtn) {
      apiBtn.style.color        = isApi ? 'var(--color-accent)' : 'var(--text-muted)';
      apiBtn.style.borderBottom = isApi ? '2px solid var(--color-accent)' : '2px solid transparent';
    }
    if (filesBtn) {
      filesBtn.style.color        = !isApi ? 'var(--color-accent)' : 'var(--text-muted)';
      filesBtn.style.borderBottom = !isApi ? '2px solid var(--color-accent)' : '2px solid transparent';
    }
  }

  /** Load Elko brand file SKU counts and inject into supplier cards */
  async function loadElkoBrandFileSku(suppliers) {
    const elkoSuppliers = suppliers.filter(s => s.source_type === 'elko_api' && s.extra_files_count > 0);
    for (const s of elkoSuppliers) {
      try {
        const files = await API.get(`/sourcing/suppliers/${s.id}/files`);
        const container = document.querySelector(`.supplier-brand-files[data-sid="${s.id}"]`);
        if (!container || !files.length) continue;
        const items = files
          .filter(f => f.label && f.label.startsWith('Elko:'))
          .map(f => {
            const brandName = f.label.replace('Elko: ', '').trim();
            const cnt = f.product_count || 0;
            const refreshed = f.last_refresh ? new Date(f.last_refresh).toLocaleDateString('pl-PL') : '—';
            return `<div style="display:flex;align-items:center;gap:6px;font-size:.75rem;padding:2px 0">
              <span style="color:var(--text-muted)">&#128196;</span>
              <span style="min-width:80px;font-weight:500">${escHtml(brandName)}</span>
              <span style="color:var(--text-secondary)">${cnt} SKU</span>
              <span style="color:var(--text-muted);font-size:.65rem">(${refreshed})</span>
            </div>`;
          });
        if (items.length) {
          container.innerHTML = `<div style="margin-top:4px;padding:6px 0;border-top:1px solid var(--border)">
            <div style="font-size:.7rem;color:var(--text-muted);margin-bottom:2px;font-weight:600">&#128230; Pliki per marka:</div>
            ${items.join('')}
          </div>`;
        }
      } catch(_) { /* ignore load errors */ }
    }
  }

  async function _testElkoApi() {
    const key = document.getElementById('sup-elko-key')?.value.trim();
    const resultEl = document.getElementById('elko-test-result');
    const btn = document.getElementById('elko-test-btn');
    if (!key) { if(resultEl) resultEl.textContent = '\u26a0\ufe0f Wklej klucz API'; return; }
    if (btn) { btn.disabled = true; btn.textContent = '\u23f3 Testuje...'; }
    if (resultEl) resultEl.textContent = '';
    try {
      const r = await API.post('/sourcing/elko/test', { api_key: key });
      if (r.ok) {
        if (resultEl) resultEl.innerHTML = '<span style="color:#4ade80">\u2705 OK — ' + escHtml(r.method) + ' @ ' + escHtml(r.endpoint.replace('https://api.elko.cloud','')) + '</span>';
      } else {
        const attempts = (r.attempts || []).map(function(a){ return a.auth + '@' + a.url.replace('https://api.elko.cloud','') + ' \u2192 ' + a.status; }).join(', ');
        if (resultEl) resultEl.innerHTML = '<span style="color:#f87171">\u274c ' + escHtml(r.message) + '</span><br><small style="color:var(--text-muted)">' + escHtml(attempts) + '</small>';
      }
    } catch(e) {
      if (resultEl) resultEl.innerHTML = '<span style="color:#f87171">\u274c ' + escHtml(e.message) + '</span>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '\ud83d\udd0d Testuj polaczenie API'; }
    }
  }

  async function _uploadElkoBrandFiles(supplierId) {
    const brandNames = {
      adata:'Adata', fellowes:'Fellowes', intenso:'Intenso', kingston:'Kingston',
      mediarange:'MediaRange', samsung:'Samsung', sandisk:'SanDisk', transcend:'Transcend', trust:'Trust'
    };
    let uploaded = 0;
    for (const [bk, bn] of Object.entries(brandNames)) {
      const inp = document.getElementById('elko-file-' + bk);
      const statusEl = document.getElementById('elko-file-status-' + bk);
      if (!inp || !inp.files[0]) continue;
      try {
        const fd = new FormData();
        fd.append('file', inp.files[0]);
        fd.append('brand_key', bk);
        fd.append('brand_name', bn);
        const r = await API.upload('/sourcing/suppliers/' + supplierId + '/elko-brand-file', fd);
        if (statusEl) statusEl.textContent = '\u2705 ' + r.imported + ' SKU';
        uploaded++;
      } catch(e) {
        if (statusEl) statusEl.textContent = '\u274c ' + e.message;
      }
    }
    return uploaded;
  }

  async function _testImpaktApi() {
    const user = document.getElementById('sup-impakt-user')?.value.trim();
    const pass = document.getElementById('sup-impakt-pass')?.value;
    const apiUrl = document.getElementById('sup-impakt-url')?.value.trim();
    const resultEl = document.getElementById('impakt-test-result');
    const btn = document.getElementById('impakt-test-btn');
    if (!user || !pass) { if(resultEl) resultEl.textContent = '\u26a0\ufe0f Podaj login i hasło'; return; }
    if (btn) { btn.disabled = true; btn.textContent = '\u23f3 Testuję...'; }
    if (resultEl) resultEl.textContent = '';
    try {
      const result = await API.post('/sourcing/suppliers/0/test-impakt', { user, pass, api_url: apiUrl });
      if (result.ok) {
        if (resultEl) resultEl.innerHTML = '<span style="color:#4ade80">\u2705 OK — ' + (result.pages || 0) + ' stron produktów</span>';
      } else {
        if (resultEl) resultEl.innerHTML = '<span style="color:#f87171">\u274c ' + escHtml(result.message || 'Blad') + '</span>';
      }
    } catch(e) {
      if (resultEl) resultEl.innerHTML = '<span style="color:#f87171">\u274c ' + escHtml(e.message) + '</span>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '\ud83d\udd0d Testuj połączenie API'; }
    }
  }

  async function _testNTTApi() {
    const clientId = document.getElementById('sup-ntt-client-id')?.value.trim();
    const userId = document.getElementById('sup-ntt-user-id')?.value.trim();
    const clientSecret = document.getElementById('sup-ntt-client-secret')?.value;
    const resultEl = document.getElementById('ntt-test-result');
    const btn = document.getElementById('ntt-test-btn');
    if (!clientId || !userId || !clientSecret) { if(resultEl) resultEl.textContent = '\u26a0\ufe0f Wypełnij wszystkie pola'; return; }
    if (btn) { btn.disabled = true; btn.textContent = '\u23f3 Testuję...'; }
    if (resultEl) resultEl.textContent = '';
    try {
      const result = await API.post('/sourcing/suppliers/0/test-ntt', { client_id: clientId, client_secret: clientSecret, user_id: userId });
      if (result.ok) {
        if (resultEl) resultEl.innerHTML = '<span style="color:#4ade80">\u2705 ' + escHtml(result.message) + '</span>';
      } else {
        if (resultEl) resultEl.innerHTML = '<span style="color:#f87171">\u274c ' + escHtml(result.message || 'Blad') + '</span>';
      }
    } catch(e) {
      if (resultEl) resultEl.innerHTML = '<span style="color:#f87171">\u274c ' + escHtml(e.message) + '</span>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '\ud83d\udd0d Testuj połączenie API NTT'; }
    }
  }

  document.addEventListener('click', async (e) => {
    const refreshBtn = e.target.closest('.refresh-sup-btn');
    if (refreshBtn) {
      e.stopPropagation(); // prevent row click (e.g. details popup)
      const supId = refreshBtn.dataset.supId;
      const supName = refreshBtn.dataset.supName;
      if (!supId) return;
      if (!confirm(`Czy na pewno chcesz odświeżyć cennik hurtowni "${supName}"? Proces ten może potrwać dłuższą chwilę.`)) return;
      
      try {
        window.Toast?.info(`Rozpoczęto odświeżanie hurtowni: ${supName}...`);
        await API.post(`/sourcing/suppliers/${supId}/refresh`);
        window.Toast?.success(`Hurtownia "${supName}" została zaktualizowana.`);
        // Reload current view
        const activeTab = document.querySelector('.sourcing-tab.active')?.dataset.tab;
        if (activeTab === 'compare') renderCompare();
        else if (activeTab === 'promotions') renderPromotions();
        else if (activeTab === 'deals') renderDeals();
        else if (activeTab === 'missing') renderMissing();
      } catch (err) {
        window.Toast?.error(`Błąd odświeżania ${supName}: ${err.message}`);
      }
    }
  });

  /* ═══════════════════════════════════════════════════════
     TAB 8 — CATALOG MASTER (zunifikowany katalog)
  ═══════════════════════════════════════════════════════ */
  let catPage = 1, catSearch = '', catMfg = '', catMfgSearch = '', catSupplier = '', catInSubiekt = '', catCondition = 'new', catAvail = 'available';
  let catSort = 'last_updated', catOrder = 'desc', catLimit = 50;
  let catSelectedSuppliers = []; // multi-checkbox supplier IDs
  let catAttrFilters = {}; // { attrId: value } for dynamic attr filters
  // AB Category Tree state
  let catTreeData = null;            // cache for category tree
  let catTreeExpanded = new Set();   // expanded node IDs
  let catTreePanelOpen = true;       // panel visibility
  let catSelectedCategoryId = null;  // currently selected category (null = all)
  let catSelectedIsUnmapped = false; // true = showing unmapped only
  let catTreeSearchVal = '';         // tree search query
  let _catLastRender = null;         // { html, ts } — cached last rendered HTML for instant tab revisit

  /* ── Fast partial refresh: only updates products table, keeps sidebar ── */
  async function _refreshCatalogProducts() {
    const area = document.getElementById('cat-products-area');
    if (!area) { renderCatalog(); return; }

    // Show skeleton shimmer only in tbody while keeping header visible
    const tbody = area.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = Array(10).fill(`<tr>${Array(7).fill('<td><div class="sk-cell" style="height:12px;border-radius:3px"></div></td>').join('')}</tr>`).join('');
    }

    const activeCatId = catSelectedCategoryId || window.catCategoryId || '';
    let catUrl = `/sourcing/catalog?page=${catPage}&limit=${catLimit}&search=${encodeURIComponent(catSearch)}&manufacturer=${encodeURIComponent(catMfg)}&manufacturerSearch=${encodeURIComponent(catMfgSearch)}&categoryId=${activeCatId}&sort=${catSort}&order=${catOrder}&inSubiekt=${catInSubiekt}&condition=${encodeURIComponent(catCondition)}&availability=${encodeURIComponent(catAvail)}`;
    if (catSelectedSuppliers.length > 0) catUrl += `&supplierIds=${encodeURIComponent(JSON.stringify(catSelectedSuppliers))}`;
    else if (catSupplier) catUrl += `&supplier=${encodeURIComponent(catSupplier)}`;
    for (const [attrId, val] of Object.entries(catAttrFilters)) {
      if (!val) continue;
      if (Array.isArray(val)) catUrl += `&attrFilter[${attrId}]=${encodeURIComponent(val.join(','))}`;
      else if (typeof val === 'object') catUrl += `&attrFilter[${attrId}]=${encodeURIComponent((val.min||'')+'|'+(val.max||''))}`;
      else catUrl += `&attrFilter[${attrId}]=${encodeURIComponent(val)}`;
    }

    let data = {};
    try {
      data = await API.get(catUrl);
    } catch(e) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="padding:20px;text-align:center;color:var(--text-muted)">⚠️ Błąd: ${escHtml(e.message)}</td></tr>`;
      return;
    }

    // Full re-render when there's a category/filter change (filters html may change)
    // But we do it without wiping the tree — call renderCatalog which will now
    // reconstruct `cat-products-area` content only
    renderCatalog();
  }

  async function renderCatalog() {
    const el = document.getElementById('src-tab-catalog');
    if (!el) return;

    // If catalog shell is already rendered, just refresh the products area (partial render)
    const productsArea = document.getElementById('cat-products-area');
    if (productsArea) {
      // Show skeleton in table body immediately for instant feedback
      const tbody = productsArea.querySelector('tbody');
      if (tbody) {
        tbody.innerHTML = Array(8).fill(`<tr>${Array(7).fill('<td><div class="sk-cell" style="height:12px;border-radius:3px;margin:1px 0"></div></td>').join('')}</tr>`).join('');
      }
      // Clear the area marker so renderCatalog does a full re-render of the content div
      productsArea.id = 'cat-products-area-refreshing';
      // Force paint so skeleton shimmer is visible
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
      // Now do a clean render (will rebuild productsArea)
      await _doRenderCatalog(el);
      return;
    }

    // First render: show skeleton while loading the full shell
    el.innerHTML = `<div style="padding:12px">${skeletonTable(7, 12)}</div>`;
    // Force browser paint so skeleton is visible before fetch starts
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
    await _doRenderCatalog(el);
  }

  async function _doRenderCatalog(el) {
    console.time('[Catalog] total');
    console.time('[Catalog] fetch');

    let stats = {}, data = {}, manufacturers = [], categories = [];
    try {
      // Build query with multi-supplier and attr filters
      // Use catSelectedCategoryId for tree-based filtering (overrides old catCategoryId)
      const activeCatId = catSelectedCategoryId || window.catCategoryId || '';
      let catUrl = `/sourcing/catalog?page=${catPage}&limit=${catLimit}&search=${encodeURIComponent(catSearch)}&manufacturer=${encodeURIComponent(catMfg)}&manufacturerSearch=${encodeURIComponent(catMfgSearch)}&categoryId=${activeCatId}&sort=${catSort}&order=${catOrder}&inSubiekt=${catInSubiekt}&condition=${encodeURIComponent(catCondition)}&availability=${encodeURIComponent(catAvail)}`;
      if (catSelectedSuppliers.length > 0) {
        catUrl += `&supplierIds=${encodeURIComponent(JSON.stringify(catSelectedSuppliers))}`;
      } else if (catSupplier) {
        catUrl += `&supplier=${encodeURIComponent(catSupplier)}`;
      }
      // Attr filters
      for (const [attrId, val] of Object.entries(catAttrFilters)) {
        if (!val) continue;
        if (Array.isArray(val)) {
          catUrl += `&attrFilter[${attrId}]=${encodeURIComponent(val.join(','))}`;
        } else if (typeof val === 'object') {
          catUrl += `&attrFilter[${attrId}]=${encodeURIComponent((val.min || '') + '|' + (val.max || ''))}`;
        } else {
          catUrl += `&attrFilter[${attrId}]=${encodeURIComponent(val)}`;
        }
      }

      // ── All fetches in ONE parallel batch (including tree!) ──
      // Use client-side tabCache for static data (stats, mfg, categories)
      const cachedStats = getTabCache('cat:stats');
      const cachedMfg = getTabCache('cat:mfg');
      const cachedCats = getTabCache('cat:cats');

      const fetchPromises = [
        cachedStats || API.get('/sourcing/catalog/stats'),
        API.get(catUrl),  // product listing is always fresh (filtered)
        cachedMfg || API.get('/sourcing/catalog/manufacturers'),
        cachedCats || API.get('/sourcing/catalog/categories'),
      ];
      // Include category-tree in parallel if not cached
      const needTree = !catTreeData;
      if (needTree) fetchPromises.push(API.get('/sourcing/catalog/category-tree').catch(() => null));

      // Also fetch attributes + filters in parallel if a category is selected
      const catIdForAttrs = window.catCategoryId;
      if (catIdForAttrs) {
        fetchPromises.push(API.get(`/sourcing/catalog/categories/${catIdForAttrs}/attributes`).catch(() => []));
        fetchPromises.push(API.get(`/sourcing/catalog/categories/${catIdForAttrs}/filters`).catch(() => []));
      }

      const results = await Promise.all(fetchPromises);
      stats = results[0];
      data = results[1];
      manufacturers = results[2];
      categories = results[3];

      // Cache static data for next time
      if (!cachedStats) setTabCache('cat:stats', stats);
      if (!cachedMfg) setTabCache('cat:mfg', manufacturers);
      if (!cachedCats) setTabCache('cat:cats', categories);
      if (needTree) catTreeData = results[4];

      // Extract pre-fetched attributes + filters
      var prefetchedAttrs = catIdForAttrs ? results[needTree ? 5 : 4] : null;
      var prefetchedFilters = catIdForAttrs ? results[needTree ? 6 : 5] : null;

      console.timeEnd('[Catalog] fetch');
      console.time('[Catalog] html');

    } catch(e) {
      el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">⚠️</span><p>Błąd: ${escHtml(e.message)}</p></div>`;
      return;
    }

    const mfgOpts = manufacturers.map(m => `<option value="${escHtml(m.manufacturer)}"${catMfg===m.manufacturer?' selected':''}>${escHtml(m.manufacturer)} (${m.cnt})</option>`).join('');
    const supOpts = (stats.suppliers||[]).map(s => `<option value="${escHtml(s.name)}"${catSupplier===s.name?' selected':''}>${escHtml(s.name)} (${s.product_count})</option>`).join('');
    const catOpts = categories.map(c => `<option value="${c.id}"${window.catCategoryId==c.id?' selected':''}>${escHtml(c.name)} (${c.product_count})</option>`).join('');

    // Stats cards removed as per request

    // Filters — use pre-fetched data instead of additional awaits
    let dynFiltersHtml = '';
    let namingSchemaHtml = '';
    if (window.catCategoryId && prefetchedAttrs) {
      const attrs = prefetchedAttrs;
      if (attrs && attrs.length) {
        dynFiltersHtml = '<div class="catalog-filters" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' + 
          '<div style="font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;gap:4px;margin-right:4px;">🏷️ Filtry:</div>' +
          attrs.map(a => `
            <div class="cat-attr-chip" title="${escHtml(a.attr_name)}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:6px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);font-size:.76rem;color:var(--text-secondary);">
              ${escHtml(a.attr_name)}
            </div>
          `).join('') +
        '</div>';
      } else {
        dynFiltersHtml = `<div class="catalog-filters" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px;font-size:.8rem;color:var(--text-muted);">
          <span>Brak zdefiniowanych filtrów dla tej kategorii.</span>
          <button class="btn btn--ghost btn--sm" style="font-size:.76rem" onclick="SourcingView._generateAttrs(${window.catCategoryId})">🤖 Generuj filtry</button>
        </div>`;
      }
    }


    // Dynamic category attribute filters — use pre-fetched data
    let dynAttrFiltersHtml = '';
    if (window.catCategoryId && prefetchedFilters) {
      try {
        const catFilters = prefetchedFilters;
        if (catFilters && catFilters.length) {
          dynAttrFiltersHtml = `<div class="cat-dyn-filters">
            <span style="font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;gap:4px;margin-right:4px">🔎 Filtry:</span>
            ${catFilters.map(f => {
              const isNumeric = f.values.length > 0 && f.values.every(v => !isNaN(parseFloat(String(v).replace(',', '.'))));
              if (isNumeric) {
                const minVal = catAttrFilters[f.id]?.min || '';
                const maxVal = catAttrFilters[f.id]?.max || '';
                return `
                  <div class="cat-dyn-filter-group" data-attr-id="${f.id}">
                    <span class="cat-dyn-filter-label">${escHtml(f.attr_name)}${f.attr_unit ? ` (${escHtml(f.attr_unit)})` : ''}</span>
                    <input type="number" class="cat-dyn-filter-min form-input" placeholder="Od" value="${minVal}" style="width:60px;height:24px;font-size:.75rem">
                    <span style="color:var(--text-muted)">-</span>
                    <input type="number" class="cat-dyn-filter-max form-input" placeholder="Do" value="${maxVal}" style="width:60px;height:24px;font-size:.75rem">
                  </div>`;
              } else {
                const selected = catAttrFilters[f.id] || [];
                const selArr = Array.isArray(selected) ? selected : [selected];
                return `
                  <div class="cat-dyn-filter-group" data-attr-id="${f.id}" style="position:relative">
                    <span class="cat-dyn-filter-label">${escHtml(f.attr_name)}${f.attr_unit ? ` (${escHtml(f.attr_unit)})` : ''}</span>
                    <div class="cat-multi-select" style="position:relative;display:inline-block">
                      <button class="btn btn--ghost btn--sm cat-multi-select-btn" style="height:24px;padding:0 8px;font-size:.75rem;min-width:100px;text-align:left;justify-content:space-between">
                        ${selArr.length > 0 ? (selArr.length === 1 ? escHtml(selArr[0]) : `Wybrano: ${selArr.length}`) : 'Wszystkie'} <span style="font-size:.6rem">▼</span>
                      </button>
                      <div class="cat-multi-select-dropdown" style="display:none;position:absolute;top:100%;left:0;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;padding:6px;z-index:100;min-width:180px;max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.15)">
                        ${f.values.length > 0 ? f.values.map(v => {
                          const checked = selArr.includes(v);
                          return `<label style="display:flex;align-items:center;gap:6px;font-size:.75rem;padding:4px;cursor:pointer;white-space:nowrap;color:var(--text-primary)">
                            <input type="checkbox" value="${escHtml(v)}" ${checked ? 'checked' : ''} class="cat-multi-cb"> ${escHtml(v)}
                          </label>`;
                        }).join('') : '<div style="padding:4px;font-size:.75rem;color:var(--text-muted);text-align:center">Brak przypisanych wartości</div>'}
                      </div>
                    </div>
                  </div>`;
              }
            }).join('')}
          </div>`;
        }
      } catch(e) { console.error('Failed to load attr filters:', e); }
    }


    const catSearchVal = window._catCatSearchVal || '';

    // Multi-checkbox supplier panel
    const suppliersArr = (stats.suppliers||[]);
    const supplierCheckboxes = suppliersArr.map(s => {
      const checked = catSelectedSuppliers.includes(s.name);
      return `<label style="display:flex;align-items:center;gap:6px;font-size:.75rem;padding:4px;cursor:pointer;white-space:nowrap;color:var(--text-primary)">
        <input type="checkbox" value="${escHtml(s.name)}" ${checked ? 'checked' : ''} class="cat-multi-cb-sup"> ${escHtml(s.name)} <span style="font-size:.68rem;color:var(--text-muted)">(${s.product_count})</span>
      </label>`;
    }).join('');

    const supplierFilterHtml = `
  <div style="position:relative; z-index:100">
    <div class="cat-multi-select" style="position:relative;display:inline-block">
      <button class="btn btn--ghost btn--sm cat-multi-select-btn" style="height:32px;padding:0 8px;font-size:.82rem;min-width:140px;text-align:left;justify-content:space-between;border:1px solid var(--border)">
        ${catSelectedSuppliers.length > 0 ? `Hurtownie (${catSelectedSuppliers.length})` : 'Wszystkie hurtownie'} <span style="font-size:.6rem">▼</span>
      </button>
      <div class="cat-multi-select-dropdown" style="display:none;position:absolute;top:100%;left:0;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;padding:6px;z-index:100;min-width:200px;max-height:300px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,0.15)">
        <div style="display:flex;gap:4px;margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:6px">
          <button class="btn btn--ghost btn--sm" style="flex:1;font-size:.7rem" onclick="SourcingView._catSelectAllSup(true)">Zaznacz</button>
          <button class="btn btn--ghost btn--sm" style="flex:1;font-size:.7rem" onclick="SourcingView._catSelectAllSup(false)">Odznacz</button>
        </div>
        ${supplierCheckboxes || '<div style="font-size:.75rem;color:var(--text-muted);text-align:center">Brak hurtowni</div>'}
      </div>
    </div>
  </div>`;

    const filtersHtml = `
<div class="catalog-filters">
  <div style="position:relative;max-width:240px;flex-shrink:0">
    <input class="form-input" id="cat-search" placeholder="Szukaj (EAN, nazwa, kod prod.)..." value="${escHtml(catSearch)}" style="width:100%;padding-right:28px">
    <button id="cat-search-clear" type="button" title="Wyczyść filtr" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;padding:2px 5px;line-height:1;border-radius:50%;transition:color .15s,background .15s;display:${catSearch ? 'block' : 'none'}" onmouseover="this.style.color='var(--text-primary)';this.style.background='var(--bg-hover)'" onmouseout="this.style.color='var(--text-muted)';this.style.background='none'">✕</button>
  </div>
  <div style="position:relative">
    <input class="form-input" id="cat-category-search" placeholder="🔍 Szukaj kategorii..." value="${escHtml(catSearchVal)}" style="max-width:200px;font-size:.82rem" autocomplete="off">
    <div id="cat-category-suggestions" class="cat-suggest-dropdown" style="display:none"></div>
  </div>
  <select class="form-select" id="cat-category" style="max-width:200px">
    <option value="">Wszystkie kategorie</option>${catOpts}
  </select>
  ${supplierFilterHtml}
  <div style="position:relative">
    <input class="form-input" id="cat-mfg-search" placeholder="🏭 Szukaj producenta..." value="${escHtml(catMfgSearch)}" style="max-width:180px;font-size:.82rem" autocomplete="off">
    <div id="cat-mfg-suggestions" class="cat-suggest-dropdown" style="display:none"></div>
  </div>
  <select class="form-select" id="cat-in-subiekt" style="max-width:140px">
    <option value=""${catInSubiekt===''?' selected':''}>Subiekt: Wszystkie</option>
    <option value="yes"${catInSubiekt==='yes'?' selected':''}>📦 W Subiekcie</option>
    <option value="no"${catInSubiekt==='no'?' selected':''}>❌ Brak w Subiekcie</option>
  </select>
  <select class="form-select" id="cat-condition" style="max-width:140px">
    <option value=""${catCondition===''?' selected':''}>Stan: Wszystkie</option>
    <option value="new"${catCondition==='new'?' selected':''}>✨ Nowe</option>
    <option value="used"${catCondition==='used'?' selected':''}>♻️ Używane</option>
    <option value="bazar"${catCondition==='bazar'?' selected':''}>🛠️ Bazar</option>
  </select>
  <select class="form-select" id="cat-avail" style="max-width:140px">
    <option value=""${catAvail===''?' selected':''}>Dostępność: Wszystkie</option>
    <option value="available"${catAvail==='available'?' selected':''}>✅ Dostępne</option>
    <option value="unavailable"${catAvail==='unavailable'?' selected':''}>❌ Niedostępne</option>
  </select>
  <div style="display:flex;align-items:center;gap:6px;border-left:1px solid var(--border);padding-left:12px;margin-left:auto">
    <button class="btn btn--ghost btn--sm" style="font-size:.76rem;color:var(--accent)" onclick="SourcingView._showDuplicates()" title="Menedżer Duplikatów">🔍 Skan</button>
    <button class="btn btn--ghost btn--sm" style="font-size:.76rem;color:#10b981" onclick="SourcingView._batchGenAttrs()" title="Generuj filtry AI">🤖 Filtry</button>
    <button class="btn btn--ghost btn--sm" style="font-size:.76rem" onclick="SourcingView._syncCatalogAttrs()" title="Uzupełnij cechy produktów z hurtowni do katalogu Master">🧩 Cechy z hurtowni</button>
    <button class="btn btn--ghost btn--sm" style="font-size:.76rem;color:#f59e0b" onclick="SourcingView._batchNormalize()" title="Normalizuj nazwy AI">📝 Nazwy</button>
    ${window.catCategoryId ? `<button class="btn btn--ghost btn--sm" style="font-size:.76rem;color:#8b5cf6" onclick="SourcingView._showNamingSchemaModal(${window.catCategoryId})" title="Schemat nazwy">📐 Schemat</button>` : ''}
  </div>
  ${window.catCategoryId ? `<button class="btn btn--ghost btn--sm" style="font-size:.76rem;border-left:1px solid var(--border);border-radius:0;margin-left:6px;padding-left:12px" onclick="SourcingView._editFilters(${window.catCategoryId})">✏️ Edytuj filtry</button>` : ''}
  <span style="font-size:.82rem;color:var(--text-muted);margin-left:12px">${data.total || 0} wyników | str. ${data.page}/${data.pages || 1}</span>
</div>

    <!-- Dynamic category attribute filters moved up here logically -->
    ${dynAttrFiltersHtml}
    ${dynFiltersHtml}`;

    // Table
    const items = data.items || [];
    
    const CAT_COL_DEFS = [
      { key: 'canonical_ean',      label: 'EAN',           width: '120px', sortable: true },
      { key: 'name',               label: 'Nazwa',         width: '250px', sortable: true },
      { key: 'manufacturer',       label: 'Producent',     width: '140px', sortable: true },
      { key: 'manufacturer_code',  label: 'Kod prod.',     width: '100px', sortable: false },
      { key: 'best_price_pln',     label: 'Najl. cena',   width: '100px', sortable: true, cls: 'num' },
      { key: 'total_stock',        label: 'Dost./Ilość', width: '90px',  sortable: true, cls: 'num' },
      { key: 'weight_g',           label: 'Waga',          width: '80px',  sortable: true, cls: 'num' },
      { key: 'dimensions',         label: 'Wymiary',       width: '120px', sortable: false },
      { key: 'suppliers',          label: 'Hurtownie',     width: '200px', sortable: false },
      { key: 'subiekt_buy_price',  label: 'C. zakupu Sub.',width: '105px', sortable: false, cls: 'num' },
      { key: 'subiekt_sell_price', label: 'C. sprzed. Sub.',width: '110px',sortable: false, cls: 'num' },
      { key: 'last_updated',       label: 'Aktualiz.',    width: '100px', sortable: true }
    ];

    let catSavedWidths = {};
    try {
      catSavedWidths = JSON.parse(localStorage.getItem('sg_colw_catalog-table') || '{}');
    } catch(_) {}

    const catThead = CAT_COL_DEFS.map(d => {
      const width = d.width || '100px';
      const sortable = !!d.sortable;
      const sortIc = sortable ? (catSort === d.key ? (catOrder === 'asc' ? ' ▲' : ' ▼') : '') : '';
      const clsStr = d.cls || '';
      
      let savedWStr = '';
      if (catSavedWidths[d.key]) {
        savedWStr = `width:${catSavedWidths[d.key]}px;min-width:${catSavedWidths[d.key]}px;`;
      }
      const styleStr = savedWStr || `width:${width};`;
      const thCls = clsStr ? ` class="${clsStr}"` : '';
      
      return `<th${thCls} data-col="${d.key}" style="${styleStr}position:relative">
        <div ${sortable ? `onclick="SourcingView._catSortBy('${d.key}')"` : ''} style="cursor:${sortable?'pointer':'default'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${escHtml(d.label)}${sortIc}
        </div>
        <div class="col-resizer"></div>
      </th>`;
    }).join('');

    const rowsHtml = items.length ? items.map(p => {
      const eans = (p.all_eans || []).join(', ');
      // Highlight best-price supplier with bold
      const bestSup = p.best_supplier_name || '';
      const suppliers = (p.supplier_names || []).map(s => {
        const isBest = bestSup && s === bestSup;
        return `<span class="cat-supplier-tag${isBest ? ' cat-supplier-best' : ''}">${escHtml(s)}</span>`;
      }).join(' ');
      const w = p.weight_g > 0 ? (p.weight_g >= 1000 ? (p.weight_g/1000).toFixed(2) + ' kg' : p.weight_g.toFixed(0) + ' g') : '—';
      const dims = (p.width_mm > 0 || p.height_mm > 0) 
        ? `${p.width_mm||0}×${p.height_mm||0}×${p.depth_mm||0} mm` : '—';
      // Subiekt indicator
      const inSub = p.in_subiekt;
      const subBadge = inSub
        ? `<span class="cat-subiekt-badge" title="W Subiekcie | Stan: ${p.subiekt_stock ?? '?'}">📦 ${p.subiekt_stock ?? '?'}</span>`
        : '';
      const nameClass = inSub ? ' cat-name-subiekt' : '';
      // Price cell — clickable
      const priceHtml = p.best_price_pln
        ? `<span class="cat-price-click" data-ean="${escHtml(p.canonical_ean)}" data-name="${escHtml(p.name||'')}" title="Kliknij — porównaj ceny hurtowni">${p.best_price_pln.toFixed(2)} zł</span>`
        : '—';
      // Name display: normalized > original, with tooltip for originals
      const displayName = p.normalized_name || p.name || '—';
      const origNames = typeof p.original_names === 'string' ? JSON.parse(p.original_names || '{}') : (p.original_names || {});
      const origTooltip = Object.entries(origNames).map(([k,v]) => `[${k}]: ${v}`).join('\n');
      const nameLockedIcon = p.name_locked ? ' 🔒' : '';
      const nameHtml = p.normalized_name 
        ? `<span class="cat-norm-name" title="${escHtml(origTooltip)}">${escHtml(displayName)}${nameLockedIcon}</span><div class="cat-orig-name" title="Oryginalna nazwa">${escHtml(p.name || '')}</div>`
        : `${escHtml(displayName)}`;
      // Name actions
      const nameActions = `<div class="cat-name-actions"><button class="cat-name-btn" onclick="SourcingView._normalizeName(${p.id})" title="Normalizuj AI">🤖</button><button class="cat-name-btn" onclick="SourcingView._editName(${p.id}, '${escHtml(displayName).replace(/'/g, "\\'")}')" title="Edytuj ręcznie">✏️</button></div>`;
      return `<tr data-pid="${p.id}">
        <td class="cat-ean-cell" data-ean="${escHtml(p.canonical_ean)}" style="font-family:monospace;font-size:.78rem;white-space:nowrap;cursor:copy" title="Dwuklik = kopiuj EAN">${escHtml(p.canonical_ean)}</td>
        <td class="cat-name-cell ${nameClass}">${subBadge}${nameHtml}${nameActions}</td>
        <td>${escHtml(p.manufacturer || '—')}</td>
        <td style="font-size:.78rem;padding:2px 4px">
          <div style="display:inline-flex;gap:2px;align-items:center">
             <input type="text" class="form-input cat-inline-mfg-code" data-pid="${p.id}" value="${escHtml(p.manufacturer_code || '')}" data-orig="${escHtml(p.manufacturer_code || '')}" placeholder="Brak" style="padding:2px 4px;height:24px;font-size:0.75rem;width:80px;background:transparent;border:1px solid transparent;transition:all 0.2s" onfocus="this.style.background='var(--bg-surface)';this.style.borderColor='var(--border)'" onblur="this.style.background='transparent';this.style.borderColor='transparent'" onchange="SourcingView._saveInlineMfgCode(${p.id}, this)">
          </div>
        </td>
        <td class="num">${priceHtml}</td>
        <td class="num">${p.total_stock > 5 ? '<span style="color:#10b981" title="Dostępny">✅</span>' : p.total_stock > 0 ? '<span style="color:#f59e0b" title="Mało">⚠️</span>' : '<span style="color:#ef4444" title="Brak">❌</span>'} ${p.total_stock || 0}</td>
        <td class="num">${w}</td>
        <td style="font-size:.75rem">${dims}</td>
        <td>${suppliers}</td>
        <td class="num" title="Cena zakupu z Subiekta">${p.subiekt_buy_price != null ? '<span style="color:var(--color-warning);font-weight:600">' + p.subiekt_buy_price.toFixed(2) + ' zł</span>' : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td class="num" title="Cena sprzedaży z Subiekta">${p.subiekt_sell_price != null ? '<span style="color:var(--color-success);font-weight:600">' + p.subiekt_sell_price.toFixed(2) + ' zł</span>' : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td style="font-size:.72rem;color:var(--text-muted);white-space:nowrap">${p.last_updated ? fmtDate(p.last_updated) : '—'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--text-muted)">Brak produktów w katalogu. Odśwież hurtownie, aby automatycznie wypełnić katalog.</td></tr>';

    // Pagination
    const totalPages = data.pages || 1;
    let pagHtml = '';
    if (totalPages > 1) {
      pagHtml = '<div class="catalog-pagination">';
      if (catPage > 1) pagHtml += `<button class="btn btn--ghost btn--sm" onclick="SourcingView._catPageTo(${catPage-1})">← Poprz.</button>`;
      pagHtml += `<span style="font-size:.82rem;color:var(--text-muted);padding:0 8px;display:flex;align-items:center;gap:4px">
        Str. <input type="number" min="1" max="${totalPages}" value="${catPage}" 
               style="width:50px;text-align:center;padding:2px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);border-radius:4px"
               onchange="if(this.value>=1 && this.value<=${totalPages}) SourcingView._catPageTo(parseInt(this.value))"> 
        z ${totalPages}
      </span>`;
      if (catPage < totalPages) pagHtml += `<button class="btn btn--ghost btn--sm" onclick="SourcingView._catPageTo(${catPage+1})">Nast. →</button>`;
      pagHtml += '</div>';
    }

    const fullHtml = `
<div style="display:flex;gap:0;min-height:600px;position:relative">

  <!-- ═══ PANEL BOCZNY: Drzewo kategorii AB ═══ -->
  <div id="cat-tree-panel" style="width:${catTreePanelOpen?'260px':'0'};min-width:${catTreePanelOpen?'260px':'0'};overflow:hidden;flex-shrink:0;transition:width .2s,min-width .2s;background:var(--bg-surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:relative">
    <div style="padding:8px 10px 6px;border-bottom:1px solid var(--border);flex-shrink:0">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:6px">
        <span style="font-weight:700;font-size:.83rem;color:var(--text-primary)">📂 Drzewo Kategorii AB</span>
        <button class="btn btn--ghost btn--sm" id="cat-tree-top-toggle" title="Zwiń panel" style="font-size:.7rem;padding:2px 6px">&#x2715;</button>
      </div>
      
      <!-- ═══ GŁÓWNA LINIA AKCJI: Edycja (wyróżniona) + Zaawansowane (Ustawienia) ═══ -->
      <div style="display:flex;gap:5px;align-items:center;position:relative">
        <button class="btn btn--sm" id="cat-tree-reorder-btn" title="Zmień kolejność, nazwy i hierarchię" 
          style="font-size:.72rem;padding:6px 12px;flex:1;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:4px;font-weight:700;background:linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;color:#ffffff !important;border:none;border-radius:6px;cursor:pointer;box-shadow:0 2px 5px rgba(99,102,241,0.3);transition:transform .2s ease, box-shadow .2s ease"
          onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 10px rgba(99,102,241,0.5)'"
          onmouseleave="this.style.transform='none';this.style.boxShadow='0 2px 5px rgba(99,102,241,0.3)'">
          ⇅ Edytuj kolejność
        </button>
        
        <div style="position:relative;display:inline-block">
          <button class="btn btn--ghost btn--sm" id="cat-tree-actions-toggle-btn" title="Ustawienia i zaawansowane operacje" 
            style="font-size:.8rem;padding:5px 8px;display:inline-flex;align-items:center;gap:3px;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated);cursor:pointer;transition:border-color .2s"
            onmouseenter="const g = this.querySelector('.gear-icon'); if(g) g.style.transform='rotate(90deg)'"
            onmouseleave="const g = this.querySelector('.gear-icon'); if(g) g.style.transform='rotate(0deg)'">
            <span class="gear-icon" style="transition:transform .3s ease-in-out;display:inline-block">⚙️</span> <span style="font-size:.45rem;opacity:.6">▼</span>
          </button>
          
          <!-- Premium Actions Dropdown Menu -->
          <div id="cat-tree-actions-menu" style="display:none;position:absolute;top:100%;right:0;margin-top:6px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.5),0 8px 10px -6px rgba(0,0,0,0.5);z-index:99;width:210px;padding:5px 0">
            <div style="padding:4px 12px 6px;font-size:.65rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);font-weight:700;border-bottom:1px solid var(--border);margin-bottom:4px">Opcje i ustawienia</div>
            
            <button class="dropdown-item" id="cat-tree-add-btn" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='transparent'"
              style="width:calc(100% - 8px);margin:0 4px;border-radius:5px;text-align:left;background:none;border:none;padding:7px 12px;font-size:.75rem;color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .2s">
              <span>➕</span> Dodaj nową kategorię
            </button>
            
            <button class="dropdown-item" id="cat-tree-normalize-btn" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='transparent'"
              style="width:calc(100% - 8px);margin:0 4px;border-radius:5px;text-align:left;background:none;border:none;padding:7px 12px;font-size:.75rem;color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .2s">
              <span>🔄</span> Normalizuj duplikaty
            </button>
            
            <button class="dropdown-item" id="cat-tree-assign-btn" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='transparent'"
              style="width:calc(100% - 8px);margin:0 4px;border-radius:5px;text-align:left;background:none;border:none;padding:7px 12px;font-size:.75rem;color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .2s">
              <span>🤖</span> AI Przypisz produkty
            </button>
            
            <button class="dropdown-item" id="cat-tree-ai-btn" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='transparent'"
              style="width:calc(100% - 8px);margin:0 4px;border-radius:5px;text-align:left;background:none;border:none;padding:7px 12px;font-size:.75rem;color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .2s">
              <span>🔗</span> AI Przepisz kategorie
            </button>
            
            <button class="dropdown-item" id="cat-tree-gen-btn" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='transparent'"
              style="width:calc(100% - 8px);margin:0 4px;border-radius:5px;text-align:left;background:none;border:none;padding:7px 12px;font-size:.75rem;color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .2s">
              <span>📊</span> Generuj z producentów
            </button>

            <button class="dropdown-item" id="cat-tree-setup-btn" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='transparent'"
              style="width:calc(100% - 8px);margin:0 4px;border-radius:5px;text-align:left;background:none;border:none;padding:7px 12px;font-size:.75rem;color:var(--text-primary);cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .2s">
              <span>🌲</span> Ustaw drzewo wzorcowe
            </button>

            <div style="border-top:1px solid var(--border);margin:4px 0"></div>
            
            <button class="dropdown-item" id="cat-tree-repair-btn" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='transparent'"
              style="width:calc(100% - 8px);margin:0 4px;border-radius:5px;text-align:left;background:none;border:none;padding:7px 12px;font-size:.75rem;color:var(--warning,#f59e0b);cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .2s;font-weight:600">
              <span>🔧</span> Napraw wszystko
            </button>
          </div>
        </div>
      </div>
    </div>
    <div id="cat-tree-inner" style="flex:1;overflow-y:auto;padding:4px 0">
      ${_renderCategoryTree(catTreeData, catTreeExpanded, catSelectedCategoryId, catSelectedIsUnmapped)}
    </div>
  </div>

  <!-- Toggle button -->
  <button id="cat-tree-toggle" style="position:absolute;left:${catTreePanelOpen?'252px':'0'};top:50%;transform:translateY(-50%);z-index:10;background:var(--bg-elevated);border:1px solid var(--border);border-radius:0 6px 6px 0;padding:10px 3px;cursor:pointer;color:var(--text-secondary);font-size:.8rem;line-height:1;transition:left .2s" title="${catTreePanelOpen?'Zwi&#x0144; panel':'Rozwi&#x0144; panel'}">${catTreePanelOpen?'&#x25C2;':'&#x25B8;'}</button>

  <!-- ═══ GŁÓWNA ZAWARTOŚĆ: Filtry + Tabela ═══ -->
  <div id="cat-products-area" style="flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden">
    ${filtersHtml}
    <div class="table-wrap" style="margin-top:12px;overflow-x:auto;">
      <table class="catalog-table" id="catalog-table" style="table-layout:fixed;width:auto;min-width:100%;">
        <thead><tr>${catThead}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    ${pagHtml}
  </div>

</div>`;

    // ── Or partial update if shell already exists ──────────────────────
    const existingProductsArea = document.getElementById('cat-products-area-refreshing') || document.getElementById('cat-products-area');
    if (existingProductsArea) {
      // Panel already rendered — only replace the products area
      const newProductsHtml = `<div id="cat-products-area" style="flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden">
    ${filtersHtml}
    <div class="table-wrap" style="margin-top:12px;overflow-x:auto;">
      <table class="catalog-table" id="catalog-table" style="table-layout:fixed;width:auto;min-width:100%;">
        <thead><tr>${catThead}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    ${pagHtml}
  </div>`;
      existingProductsArea.outerHTML = newProductsHtml;

      // Also refresh the category tree content in the sidebar with the latest data
      const treeInner = document.getElementById('cat-tree-inner');
      if (treeInner) {
        treeInner.innerHTML = _renderCategoryTree(catTreeData, catTreeExpanded, catSelectedCategoryId, catSelectedIsUnmapped);
        _bindCategoryTreeEvents();
      }
    } else {
      // Full first render
      el.innerHTML = fullHtml;
    }

    console.timeEnd('[Catalog] html');
    console.time('[Catalog] bind');

    // Init column resize handles
    initColResize('catalog-table');

    // Bind filters
    let searchTimeout;
    const catSearchInput = document.getElementById('cat-search');
    const catSearchClear = document.getElementById('cat-search-clear');
    catSearchInput?.addEventListener('input', e => {
      clearTimeout(searchTimeout);
      const val = e.target.value.trim();
      // Show/hide clear button
      if (catSearchClear) catSearchClear.style.display = val ? 'block' : 'none';
      // Skip auto-search for 1-2 char partial inputs (too slow/broad)
      if (val.length > 0 && val.length < 3) return;
      searchTimeout = setTimeout(() => { catSearch = val; catPage = 1; renderCatalog(); }, 500);
    });
    catSearchInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        catSearch = e.target.value.trim();
        catPage = 1;
        renderCatalog();
      }
      if (e.key === 'Escape') {
        e.target.value = '';
        catSearch = '';
        if (catSearchClear) catSearchClear.style.display = 'none';
        catPage = 1;
        renderCatalog();
      }
    });
    catSearchClear?.addEventListener('click', () => {
      if (catSearchInput) catSearchInput.value = '';
      catSearch = '';
      catSearchClear.style.display = 'none';
      catPage = 1;
      renderCatalog();
    });
    // Multi-checkbox supplier bindings (now in dropdown)
    el.querySelectorAll('.cat-multi-cb-sup').forEach(cb => {
      cb.addEventListener('change', () => {
        const name = cb.value;
        const idx = catSelectedSuppliers.indexOf(name);
        if (cb.checked && idx < 0) catSelectedSuppliers.push(name);
        if (!cb.checked && idx >= 0) catSelectedSuppliers.splice(idx, 1);
        catPage = 1;
        renderCatalog();
      });
    });
    document.getElementById('cat-category')?.addEventListener('change', e => { window.catCategoryId = e.target.value; window._catCatSearchVal = ''; catPage = 1; catAttrFilters = {}; renderCatalog(); });
    document.getElementById('cat-in-subiekt')?.addEventListener('change', e => { catInSubiekt = e.target.value; catPage = 1; renderCatalog(); });
    document.getElementById('cat-condition')?.addEventListener('change', e => { catCondition = e.target.value; catPage = 1; renderCatalog(); });
    document.getElementById('cat-avail')?.addEventListener('change', e => { catAvail = e.target.value; catPage = 1; renderCatalog(); });
    // Dynamic attribute filter bindings (Range)
    let rangeTimeout;
    el.querySelectorAll('.cat-dyn-filter-min, .cat-dyn-filter-max').forEach(inp => {
      inp.addEventListener('input', () => {
        clearTimeout(rangeTimeout);
        rangeTimeout = setTimeout(() => {
          const group = inp.closest('.cat-dyn-filter-group');
          const attrId = group.dataset.attrId;
          const min = group.querySelector('.cat-dyn-filter-min').value;
          const max = group.querySelector('.cat-dyn-filter-max').value;
          if (min || max) {
            catAttrFilters[attrId] = { min, max };
          } else {
            delete catAttrFilters[attrId];
          }
          catPage = 1;
          renderCatalog();
        }, 500);
      });
    });

    // Dynamic attribute filter bindings (Multi-Select)
    el.querySelectorAll('.cat-multi-select').forEach(sel => {
      const btn = sel.querySelector('.cat-multi-select-btn');
      const drop = sel.querySelector('.cat-multi-select-dropdown');
      
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const isVisible = drop.style.display === 'block';
        document.querySelectorAll('.cat-multi-select-dropdown').forEach(d => d.style.display = 'none');
        drop.style.display = isVisible ? 'none' : 'block';
      });

      const group = sel.closest('.cat-dyn-filter-group');
      if (group && group.dataset.attrId) {
        const attrId = group.dataset.attrId;
        drop.querySelectorAll('.cat-multi-cb').forEach(cb => {
          cb.addEventListener('change', () => {
            const selected = Array.from(drop.querySelectorAll('.cat-multi-cb:checked')).map(c => c.value);
            if (selected.length > 0) catAttrFilters[attrId] = selected;
            else delete catAttrFilters[attrId];
            catPage = 1;
            renderCatalog();
          });
        });
      }
    });

    // Close dropdowns on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('.cat-multi-select')) {
        document.querySelectorAll('.cat-multi-select-dropdown').forEach(d => d.style.display = 'none');
      }
    });
    // Row click → product detail modal
    el.querySelectorAll('.catalog-table tbody tr[data-pid]').forEach(tr => {
      tr.addEventListener('click', e => {
        // Don't open modal if clicking on buttons, links, or price
        if (e.target.closest('button,.cat-name-btn,.cat-price-click,.cat-ean-cell')) return;
        const pid = tr.dataset.pid;
        if (pid) SourcingView._showProductDetail(parseInt(pid));
      });
    });

    // Manufacturer text search with autocomplete
    let mfgSearchTimeout;
    const mfgSearchInput = document.getElementById('cat-mfg-search');
    const mfgSuggestBox = document.getElementById('cat-mfg-suggestions');
    if (mfgSearchInput && mfgSuggestBox) {
      mfgSearchInput.addEventListener('input', e => {
        clearTimeout(mfgSearchTimeout);
        const val = e.target.value.trim();
        catMfgSearch = val;
        catMfg = ''; // wyczyść dokładny filtr
        if (!val || val.length < 2) { mfgSuggestBox.style.display = 'none'; if (!val) { catMfgSearch = ''; catPage = 1; renderCatalog(); } return; }
        mfgSearchTimeout = setTimeout(() => {
          // Filtruj z listy producentów
          const filtered = manufacturers.filter(m => m.manufacturer.toLowerCase().includes(val.toLowerCase())).slice(0, 15);
          if (!filtered.length) { mfgSuggestBox.innerHTML = '<div class="cat-suggest-item" style="color:var(--text-muted)">Brak wyników</div>'; mfgSuggestBox.style.display = 'block'; return; }
          mfgSuggestBox.innerHTML = filtered.map(m => `
            <div class="cat-suggest-item" data-mfg="${escHtml(m.manufacturer)}">
              <span>${escHtml(m.manufacturer)}</span>
              <span style="font-size:.72rem;color:var(--text-muted);margin-left:auto">${m.cnt}</span>
            </div>
          `).join('');
          mfgSuggestBox.style.display = 'block';
          mfgSuggestBox.querySelectorAll('.cat-suggest-item[data-mfg]').forEach(item => {
            item.addEventListener('click', () => {
              catMfg = item.dataset.mfg;
              catMfgSearch = item.dataset.mfg;
              mfgSearchInput.value = item.dataset.mfg;
              mfgSuggestBox.style.display = 'none';
              catPage = 1;
              renderCatalog();
            });
          });
        }, 200);
      });
      mfgSearchInput.addEventListener('blur', () => {
        setTimeout(() => { mfgSuggestBox.style.display = 'none'; }, 200);
      });
      mfgSearchInput.addEventListener('focus', () => {
        if (mfgSuggestBox.innerHTML && mfgSearchInput.value.trim().length >= 2) mfgSuggestBox.style.display = 'block';
      });
      // Clear on Escape
      mfgSearchInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') { mfgSearchInput.value = ''; catMfg = ''; catMfgSearch = ''; catPage = 1; renderCatalog(); }
        if (e.key === 'Enter') { catMfgSearch = mfgSearchInput.value.trim(); catMfg = ''; catPage = 1; renderCatalog(); }
      });
    }

    // Category text search with autocomplete
    let catSearchTimeout;
    const catCatSearchInput = document.getElementById('cat-category-search');
    const catSuggestBox = document.getElementById('cat-category-suggestions');
    if (catCatSearchInput && catSuggestBox) {
      catCatSearchInput.addEventListener('input', e => {
        clearTimeout(catSearchTimeout);
        const val = e.target.value.trim();
        window._catCatSearchVal = val;
        if (!val || val.length < 2) { catSuggestBox.style.display = 'none'; return; }
        catSearchTimeout = setTimeout(async () => {
          try {
            const results = await API.get(`/sourcing/catalog/categories?q=${encodeURIComponent(val)}`);
            if (!results || !results.length) { catSuggestBox.innerHTML = '<div class="cat-suggest-item" style="color:var(--text-muted)">Brak wyników</div>'; catSuggestBox.style.display = 'block'; return; }
            catSuggestBox.innerHTML = results.slice(0, 15).map(c => `
              <div class="cat-suggest-item" data-id="${c.id}" data-name="${escHtml(c.name)}">
                <span>${escHtml(c.name)}</span>
                <span style="font-size:.72rem;color:var(--text-muted);margin-left:auto">${c.product_count}</span>
              </div>
            `).join('');
            catSuggestBox.style.display = 'block';
            catSuggestBox.querySelectorAll('.cat-suggest-item[data-id]').forEach(item => {
              item.addEventListener('click', () => {
                const id = item.dataset.id;
                const name = item.dataset.name;
                window.catCategoryId = id;
                window._catCatSearchVal = name;
                catCatSearchInput.value = name;
                catSuggestBox.style.display = 'none';
                catPage = 1;
                renderCatalog();
              });
            });
          } catch(e) { console.error('Cat search error:', e); }
        }, 300);
      });
      catCatSearchInput.addEventListener('blur', () => {
        setTimeout(() => { catSuggestBox.style.display = 'none'; }, 200);
      });
      catCatSearchInput.addEventListener('focus', () => {
        if (catSuggestBox.innerHTML && catCatSearchInput.value.trim().length >= 2) catSuggestBox.style.display = 'block';
      });
    }

    // Double-click EAN — copy to clipboard
    el.querySelectorAll('.cat-ean-cell').forEach(td => {
      td.addEventListener('dblclick', () => {
        const ean = td.dataset.ean;
        navigator.clipboard?.writeText(ean).then(() => Toast.success('Skopiowano EAN: ' + ean));
      });
    });

    // Click on price — show supplier prices modal
    el.querySelectorAll('.cat-price-click').forEach(span => {
      span.addEventListener('click', async () => {
        const ean = span.dataset.ean;
        const name = span.dataset.name;
        try {
          const result = await API.get(`/sourcing/catalog/prices/${encodeURIComponent(ean)}`);
          const prices = result.prices || [];
          const sub = result.subiekt || null;
          const bestPrice = prices.find(p => p.price_pln > 0)?.price_pln || null;

          // ── Subiekt section ──────────────────────────────────────────
          const subAvailC = sub
            ? `<span style="color:#10b981;font-weight:600">✅ W ofercie</span>`
            : `<span style="color:#94a3b8">— Brak w Subiekcie</span>`;
          const subStockC = sub?.stock ?? null;
          const subStockHtmlC = subStockC != null
            ? (subStockC > 10 ? `<span style="color:#10b981">${subStockC} szt</span>`
              : subStockC > 0 ? `<span style="color:#f59e0b">${subStockC} szt (mało)</span>`
              : `<span style="color:#ef4444">0 szt (brak)</span>`)
            : `<span style="color:#94a3b8">—</span>`;
          const subSellC = sub?.sell_price ?? null;
          const subBuyC = sub?.buy_price ?? null;
          const marginC = subSellC != null && bestPrice != null && bestPrice > 0
            ? ((subSellC - bestPrice) / subSellC * 100).toFixed(1)
            : null;
          const subiektSectionC = `
<div style="background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:16px;align-items:center">
  <div style="font-size:.72rem;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0">📦 Nasz Subiekt</div>
  <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:.82rem">
    <div><span style="color:var(--text-muted)">Status: </span>${subAvailC}</div>
    ${subStockC != null ? `<div><span style="color:var(--text-muted)">Stan mag.: </span>${subStockHtmlC}</div>` : ''}
    ${subSellC != null ? `<div><span style="color:var(--text-muted)">Cena sprzedaży: </span><strong style="color:var(--text-primary)">${fmtPLN(subSellC)}</strong></div>` : ''}
    ${subBuyC != null ? `<div><span style="color:var(--text-muted)">Cena zakupu: </span><strong>${fmtPLN(subBuyC)}</strong></div>` : ''}
    ${marginC != null ? `<div><span style="color:var(--text-muted)">Marża: </span><strong style="color:${parseFloat(marginC) > 0 ? '#10b981' : '#ef4444'}">${marginC}%</strong></div>` : ''}
  </div>
</div>`;

          const rows = prices.length ? prices.map((o, i) => {
            const isBest = o.price_pln === bestPrice;
            const qty = o.stock_quantity;
            const av = o.availability;
            // Availability badge
            const avail = av === 'available' || (qty != null && qty > 0)
              ? '<span class="avail-badge avail-ok">✅ Dostępny</span>'
              : av === 'unavailable'
                ? '<span class="avail-badge avail-no">❌ Niedostępny</span>'
                : '<span class="avail-badge avail-unk" style="color:#94a3b8">— Brak danych</span>';
            // Stock number
            let stockCell;
            if (qty != null && qty > 0) {
              const color = qty > 5 ? '#10b981' : '#f59e0b';
              stockCell = `<span style="color:${color};font-weight:600">${qty} szt</span>`;
            } else if (qty === 0 || av === 'unavailable') {
              stockCell = '<span style="color:#f87171;font-weight:600">0</span>';
            } else if (av === 'available') {
              stockCell = '<span style="color:#10b981;font-size:.78rem">dostępny</span>';
            } else {
              stockCell = '<span style="color:#94a3b8">—</span>';
            }
            return `<tr${isBest ? ' class="best-row"' : ''}>
              <td>${isBest ? '<strong>' : ''}${escHtml(o.supplier_name)}${isBest ? '</strong>' : ''}</td>
              <td class="price-cell" style="font-family:monospace;font-weight:600">${o.price_pln ? o.price_pln.toFixed(2) + ' zł' : '—'}</td>
              <td style="text-align:right">${stockCell}</td>
              <td>${avail}</td>
            </tr>`;
          }).join('')
          : '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">Brak ofert</td></tr>';

          Modal.show({
            title: `💰 Ceny hurtowni — ${escHtml(name || ean)}`,
            body: `
<div style="margin-bottom:12px;font-size:.82rem;color:var(--text-secondary)">
  EAN: <strong style="color:var(--text-primary);font-family:monospace">${escHtml(ean)}</strong>
</div>
${subiektSectionC}
<div style="overflow-x:auto">
<table class="compare-table" style="min-width:380px">
  <thead><tr><th>Hurtownia</th><th>Cena PLN</th><th style="text-align:right">Magazyn</th><th>Dostępność</th></tr></thead>
  <tbody>${rows}</tbody>
</table></div>
<div style="font-size:.72rem;color:var(--text-muted);margin-top:10px">
  Sortowanie: cena rosnąco (najtańsza na górze)
</div>`,
            footer: '<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>',
          });
        } catch(e) { Toast.error('Błąd: ' + e.message); }
      });
    });



    bindColResizers(el);

    // Naming schema drag-and-drop reorder
    const paramsContainer = document.getElementById('naming-params-container');
    if (paramsContainer) {
      let dragSrcIdx = null;
      paramsContainer.querySelectorAll('.naming-param-chip').forEach(chip => {
        chip.addEventListener('dragstart', e => { dragSrcIdx = parseInt(chip.dataset.idx); e.dataTransfer.effectAllowed = 'move'; });
        chip.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; chip.style.borderLeft = '3px solid var(--accent)'; });
        chip.addEventListener('dragleave', () => { chip.style.borderLeft = ''; });
        chip.addEventListener('drop', async e => {
          e.preventDefault(); chip.style.borderLeft = '';
          const targetIdx = parseInt(chip.dataset.idx);
          if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;
          try {
            const schema = await API.get(`/sourcing/catalog/naming-schema/${window.catCategoryId}`);
            const params = schema.params || [];
            const [moved] = params.splice(dragSrcIdx, 1);
            params.splice(targetIdx, 0, moved);
            await API.post(`/sourcing/catalog/naming-schema/${window.catCategoryId}`, { params });
            Toast.success('Kolejność parametrów zmieniona');
            renderCatalog();
          } catch(err) { Toast.error(err.message); }
        });
      });
      // Remove param buttons
      paramsContainer.querySelectorAll('.naming-param-remove').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.idx);
          try {
            const schema = await API.get(`/sourcing/catalog/naming-schema/${window.catCategoryId}`);
            const params = schema.params || [];
            params.splice(idx, 1);
            await API.post(`/sourcing/catalog/naming-schema/${window.catCategoryId}`, { params });
            Toast.success('Parametr usunięty');
            renderCatalog();
          } catch(err) { Toast.error(err.message); }
        });
      });
      // Add param on Enter
      document.getElementById('naming-new-param')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') SourcingView._addSchemaParam(window.catCategoryId);
      });
    }

    // --- AB Category Tree Bindings (Header & Tool Buttons) ---
    function _bindCategoryTreeHeaderEvents() {
      function bindWithGuard(id, event, handler) {
        const btn = document.getElementById(id);
        if (btn && !btn.dataset.bound) {
          btn.dataset.bound = 'true';
          btn.addEventListener(event, handler);
        }
      }

      bindWithGuard('cat-tree-toggle', 'click', () => {
        catTreePanelOpen = !catTreePanelOpen;
        document.getElementById('cat-tree-panel').style.width = catTreePanelOpen ? '260px' : '0';
        document.getElementById('cat-tree-panel').style.minWidth = catTreePanelOpen ? '260px' : '0';
        const toggleBtn = document.getElementById('cat-tree-toggle');
        toggleBtn.style.left = catTreePanelOpen ? '252px' : '0';
        toggleBtn.innerHTML = catTreePanelOpen ? '&#x25C2;' : '&#x25B8;';
        toggleBtn.title = catTreePanelOpen ? 'Zwi\u0144 panel' : 'Rozwi\u0144 panel';
      });

      bindWithGuard('cat-tree-top-toggle', 'click', () => {
        document.getElementById('cat-tree-toggle')?.click();
      });

      bindWithGuard('cat-tree-setup-btn', 'click', async () => {
        try {
          const suppliers = await API.get('/sourcing/catalog/suppliers');
          const opts = suppliers.map(s => `<option value="${s.id}">${escHtml(s.name)} (${s.product_count} prod.)</option>`).join('');
          Modal.show({
            title: '🌳 Ustaw Hurtownię Główną (Drzewo AB)',
            body: `
              <div style="font-size:.85rem;color:var(--text-secondary);margin-bottom:12px;line-height:1.5">
                Wybierz hurtownię, której kategorie będą stanowić <strong>wzorcowe drzewo kategorii</strong> dla całego systemu. Zazwyczaj jest to główny dostawca (np. AB).<br>
                <span style="color:var(--red);display:block;margin-top:8px">⚠️ <strong>Uwaga:</strong> Zmiana zresetuje obecne mapowania kategorii z innych hurtowni!</span>
              </div>
              <select id="cat-tree-supplier-select" class="form-select">${opts}</select>
            `,
            footer: `
              <button class="btn btn--secondary" onclick="Modal.hide()">Anuluj</button>
              <button class="btn btn--primary" onclick="SourcingView._setAbSupplier()">Zapisz jako Główne Drzewo</button>
            `
          });
        } catch(e) { Toast.error(e.message); }
      });

      bindWithGuard('cat-tree-ai-btn', 'click', async () => {
        const btn = document.getElementById('cat-tree-ai-btn');
        btn.disabled = true;
        btn.innerHTML = '⏳';
        try {
          const res = await API.post('/sourcing/catalog/ai-remap-categories', {});
          if (res.remapped !== undefined) {
            Toast.success(`AI przypisało ${res.remapped} / ${res.total} kategorii`);
            catTreeData = null; // force reload tree
            renderCatalog();
          }
        } catch(e) {
          Toast.error(e.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = '🤖';
        }
      });

      // Generate categories from manufacturers button
      bindWithGuard('cat-tree-gen-btn', 'click', async () => {
        const btn = document.getElementById('cat-tree-gen-btn');
        if (!btn) return;
        btn.disabled = true;
        btn.innerHTML = '⏳';
        try {
          const res = await API.post('/generate-categories', {});
          if (res.ok) {
            Toast.success(res.message || `Wygenerowano ${res.created} kategorii`);
            catTreeData = null; // force reload
            renderCatalog();
          } else {
            Toast.error(res.message || 'Nie udało się wygenerować kategorii');
          }
        } catch(e) {
          Toast.error(e.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = '📊';
        }
      });

      // Normalize categories button (merge duplicates)
      bindWithGuard('cat-tree-normalize-btn', 'click', async () => {
        const btn = document.getElementById('cat-tree-normalize-btn');
        if (!btn) return;
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '&#x23F3;...';
        try {
          const res = await API.post('/sourcing/catalog/categories/normalize', {});
          if (res.ok) {
            Toast.success(res.message || `Scalono ${res.merged} duplikatów`);
            catTreeData = null;
            renderCatalog();
          } else {
            Toast.error(res.error || 'Błąd normalizacji');
          }
        } catch(e) {
          Toast.error(e.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = origHtml;
        }
      });

      // AI Assign unmapped products button
      bindWithGuard('cat-tree-assign-btn', 'click', async () => {
        const btn = document.getElementById('cat-tree-assign-btn');
        if (!btn) return;
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '&#x23F3; Przypisuję...';
        try {
          Toast.info('Przypisuję produkty do kategorii AB... (może chwilę potrwać)');
          const res = await API.post('/sourcing/catalog/categories/ai-assign-unmapped', { useAi: true, limit: 2000 });
          if (res.ok) {
            Toast.success(res.message || `Przypisano ${res.assigned} produktów`);
            catTreeData = null;
            renderCatalog();
          } else {
            Toast.error(res.error || 'Błąd przypisywania');
          }
        } catch(e) {
          Toast.error(e.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = origHtml;
        }
      });

      // Repair All button — fix encoding + normalize + assign
      bindWithGuard('cat-tree-repair-btn', 'click', async () => {
        const btn = document.getElementById('cat-tree-repair-btn');
        if (!btn) return;
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '&#x23F3; Naprawiam...';
        try {
          Toast.info('Naprawiam polskie znaki + normalizuję + przypisuję... (może potrwać 30-60s)');
          const res = await API.post('/sourcing/catalog/repair-all', {});
          if (res.ok) {
            Toast.success('Naprawa zakończona! ' + (res.message || ''));
            catTreeData = null;
            renderCatalog();
          } else {
            Toast.error(res.error || 'Błąd naprawy');
          }
        } catch(e) {
          Toast.error(e.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = origHtml;
        }
      });

      // Direct category creation from sidebar
      bindWithGuard('cat-tree-add-btn', 'click', () => {
        // ─── Recursive flatten to build searchable parent dropdown ───
        function flattenTree(nodes, parentId = null, depth = 0) {
          let result = [];
          if (!nodes) return result;
          const sorted = [...nodes].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name, 'pl'));
          for (const node of sorted) {
            result.push({ id: node.id, name: node.name, parentId, depth });
            if (node.children && node.children.length) {
              result = result.concat(flattenTree(node.children, node.id, depth + 1));
            }
          }
          return result;
        }
        const flatCats = catTreeData && catTreeData.tree ? flattenTree(catTreeData.tree) : [];

        const parentOpts = [{ id: '', name: '— Główna (brak rodzica) —', depth: 0 }].concat(flatCats);
        const parentOptsHtml = parentOpts.map(o => {
          const indent = '&nbsp;'.repeat((o.depth || 0) * 3);
          return `<div class="cat-modal-parent-opt" data-val="${o.id}" data-name="${escHtml(o.name)}"
            style="padding:6px 10px;cursor:pointer;font-size:.8rem;white-space:nowrap;color:var(--text-primary);border-bottom:1px solid var(--border-light, rgba(0,0,0,0.03))"
            onmouseenter="this.style.background='var(--accent)';this.style.color='#fff'"
            onmouseleave="this.style.background='';this.style.color='var(--text-primary)'">${indent}${escHtml(o.name)}</div>`;
        }).join('');

        Modal.show({
          title: '➕ Dodaj Nową Kategorię AB',
          body: `
            <div style="font-size:.82rem;color:var(--text-secondary);margin-bottom:14px;line-height:1.5">
              Tworzenie nowej kategorii w głównym drzewie AB. Kategoria zostanie dodana na wybranym poziomie hierarchii.
            </div>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div>
                <label style="display:block;font-size:.78rem;font-weight:600;margin-bottom:6px;color:var(--text-primary)">Nazwa Kategorii</label>
                <input type="text" id="cat-modal-new-name" placeholder="np. Komponenty, Kable, Monitory..." autocomplete="off"
                  style="width:100%;height:36px;font-size:.85rem;padding:0 12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);outline:none;box-sizing:border-box;transition:border .2s"
                  onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
              </div>
              
              <div style="position:relative">
                <label style="display:block;font-size:.78rem;font-weight:600;margin-bottom:6px;color:var(--text-primary)">Kategoria Nadrzędna (Rodzic)</label>
                <input type="text" id="cat-modal-parent-search" placeholder="— Główna (brak rodzica) —" autocomplete="off"
                  style="width:100%;height:36px;font-size:.82rem;padding:0 12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);outline:none;box-sizing:border-box;cursor:pointer"
                  onfocus="this.select();document.getElementById('cat-modal-parent-dd').style.display='block'"
                  data-selected="">
                <div id="cat-modal-parent-dd" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-surface);border:1px solid var(--border-med, #ccc);border-radius:6px;z-index:200;max-height:220px;overflow-y:auto;box-shadow:var(--shadow-lg);margin-top:2px">
                  ${parentOptsHtml}
                </div>
              </div>
            </div>
          `,
          footer: `
            <button class="btn btn--secondary" onclick="Modal.hide()">Anuluj</button>
            <button class="btn btn--primary" id="cat-modal-save-btn" style="padding:0 20px;font-weight:600">➕ Stwórz Kategorię</button>
          `
        });

        setTimeout(() => {
          const nameInput = document.getElementById('cat-modal-new-name');
          const parentSearch = document.getElementById('cat-modal-parent-search');
          const parentDd = document.getElementById('cat-modal-parent-dd');
          const saveBtn = document.getElementById('cat-modal-save-btn');

          if (nameInput) nameInput.focus();

          if (parentSearch && parentDd) {
            parentSearch.addEventListener('input', () => {
              const q = parentSearch.value.toLowerCase().trim();
              parentDd.querySelectorAll('.cat-modal-parent-opt').forEach(opt => {
                const name = (opt.dataset.name || '').toLowerCase();
                opt.style.display = name.includes(q) ? '' : 'none';
              });
              parentDd.style.display = 'block';
            });

            parentDd.querySelectorAll('.cat-modal-parent-opt').forEach(opt => {
              opt.addEventListener('mousedown', e => {
                e.preventDefault();
                parentSearch.value = opt.dataset.name;
                parentSearch.dataset.selected = opt.dataset.val;
                parentDd.style.display = 'none';
              });
            });

            parentSearch.addEventListener('blur', () => {
              setTimeout(() => { if (parentDd) parentDd.style.display = 'none'; }, 200);
            });
          }

          async function _doCreate() {
            const name = nameInput?.value.trim();
            if (!name) { Toast.error('Wpisz nazwę kategorii'); nameInput?.focus(); return; }

            const parentId = parentSearch?.dataset.selected || null;
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ Tworzenie...';

            try {
              const res = await API.post('/sourcing/catalog/categories', {
                name,
                parent_id: parentId ? parseInt(parentId) : null
              });

              if (res.ok) {
                Toast.success(`Dodano kategorię "${res.name}"`);
                Modal.hide();
                
                // Invalidate caches
                catTreeData = null;
                clearTabCache('cat:cats');
                clearTabCache('cat:stats');

                // Automatically select the new category ID so user sees it
                catSelectedCategoryId = res.id;
                catSelectedIsUnmapped = false;
                window.catCategoryId = res.id;

                // Rerender catalog to load and show the new category tree
                renderCatalog();
              } else {
                Toast.error(res.error || 'Błąd dodawania kategorii');
              }
            } catch(e) {
              Toast.error(e.message);
            } finally {
              if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '➕ Stwórz Kategorię';
              }
            }
          }

          saveBtn?.addEventListener('click', _doCreate);
          nameInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); _doCreate(); }
          });
        }, 50);
      });

      // Drag & Drop + Rename category editor (hierarchical — all levels)
      async function _showCategoryReorderModal() {
        if (!catTreeData || !catTreeData.tree || !catTreeData.tree.length) {
          Toast.error('Brak kategorii do edycji');
          return;
        }

        // ─── Recursive flatten: [{id, name, parentId, depth, sort_order, count}] ───
        function flattenTree(nodes, parentId = null, depth = 0) {
          let result = [];
          const sorted = [...nodes].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name, 'pl'));
          for (const node of sorted) {
            result.push({ id: node.id, name: node.name, parentId, depth, count: node.total_count || node.product_count || 0 });
            if (node.children && node.children.length) {
              result = result.concat(flattenTree(node.children, node.id, depth + 1));
            }
          }
          return result;
        }
        const flatCats = flattenTree(catTreeData.tree);

        // ─── Collapsible & Searchable Parent Category Tree Selector Modal ─────────
        function isDescendantOf(node, parentId) {
          if (!parentId) return false;
          let curr = nodeMap.get(node.id);
          while (curr && curr.parent_id) {
            if (curr.parent_id === parentId) return true;
            curr = nodeMap.get(curr.parent_id);
          }
          return false;
        }

        function renderSelectorNode(node, catId) {
          if (node.id === catId) return '';
          
          const hasChildren = node.children && node.children.length > 0;
          let childrenHtml = '';
          let validChildren = [];
          if (hasChildren) {
            validChildren = node.children.filter(child => {
              return child.id !== catId && !isDescendantOf(child, catId);
            });
            childrenHtml = validChildren.map(child => renderSelectorNode(child, catId)).join('');
          }

          const hasValidChildren = validChildren.length > 0;
          const toggleHtml = hasValidChildren
            ? `<span class="sel-toggle-btn" style="cursor:pointer;font-size:.75rem;width:16px;text-align:center;user-select:none;color:var(--text-muted);margin-right:6px">▶</span>`
            : `<span style="width:16px;display:inline-block;margin-right:6px"></span>`;

          return `
            <div class="parent-sel-node-container" data-id="${node.id}">
              <div class="parent-sel-row" data-id="${node.id}" data-name="${escHtml(node.name)}"
                style="display:flex;align-items:center;padding:5px 8px;margin-bottom:2px;border-radius:4px;cursor:pointer;font-size:.82rem;transition:background 0.15s"
                onmouseenter="this.style.background='var(--bg-hover)'"
                onmouseleave="this.style.background=''">
                ${toggleHtml}
                <span class="parent-sel-clickable-name" style="flex:1;">${escHtml(node.name)}</span>
              </div>
              ${hasValidChildren ? `<div class="parent-sel-children" style="display:none;padding-left:16px;border-left:1px dashed var(--border);margin-left:6px;margin-bottom:2px">${childrenHtml}</div>` : ''}
            </div>`;
        }

        function _showParentSelectorModal(catId, currentParentId, onSelect) {
          let overlay = document.getElementById('parent-selector-overlay');
          if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'parent-selector-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
            document.body.appendChild(overlay);
          }

          const treeHtml = catTreeData.tree.map(root => renderSelectorNode(root, catId)).join('');

          overlay.innerHTML = `
            <div style="background:var(--bg-surface);border:1px solid var(--border-med);border-radius:12px;width:480px;max-width:90%;box-shadow:var(--shadow-xl);display:flex;flex-direction:column;max-height:80vh;animation:modalEnter 0.2s ease-out;">
              <!-- Header -->
              <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:between;gap:8px;">
                <span style="font-weight:700;font-size:.95rem;color:var(--text-primary)">📂 Wybierz kategorię nadrzędną</span>
                <button id="parent-sel-close" style="background:transparent;border:none;color:var(--text-secondary);cursor:pointer;font-size:1.1rem;margin-left:auto;line-height:1;" title="Zamknij">✕</button>
              </div>

              <!-- Search Bar -->
              <div style="padding:10px 18px;border-bottom:1px solid var(--border-light);background:var(--bg-elevated);">
                <input type="text" id="parent-sel-search" class="form-input" placeholder="🔍 Szukaj kategorii..." autocomplete="off"
                  style="width:100%;font-size:.85rem;padding:6px 12px;height:34px;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;outline:none;">
              </div>

              <!-- Tree List Container -->
              <div style="flex:1;overflow-y:auto;padding:12px 18px;display:flex;flex-direction:column;gap:6px;">
                <!-- Main Category (No Parent) option -->
                <div class="parent-sel-root-opt" data-id=""
                  style="padding:8px 12px;margin-bottom:6px;background:var(--bg-elevated);border:1px dashed var(--accent);border-radius:8px;cursor:pointer;text-align:center;font-weight:600;font-size:.84rem;color:var(--accent);transition:all 0.2s"
                  onmouseenter="this.style.background='var(--accent-glow)';this.style.transform='scale(1.02)'"
                  onmouseleave="this.style.background='var(--bg-elevated)';this.style.transform=''">
                  — Kategoria Główna (brak rodzica) —
                </div>

                <!-- Tree structure -->
                <div id="parent-sel-tree" style="display:flex;flex-direction:column;gap:2px;">
                  ${treeHtml || '<div style="text-align:center;color:var(--text-muted);font-size:.8rem;padding:20px;">Brak dostępnych kategorii</div>'}
                </div>
              </div>
            </div>`;

          overlay.style.display = 'flex';

          // Close button click
          document.getElementById('parent-sel-close').addEventListener('click', () => {
            overlay.style.display = 'none';
          });

          // Close on clicking backdrop overlay
          overlay.addEventListener('click', e => {
            if (e.target === overlay) {
              overlay.style.display = 'none';
            }
          });

          // Root option click
          overlay.querySelector('.parent-sel-root-opt').addEventListener('click', () => {
            onSelect('', '— Główna (brak rodzica) —');
            overlay.style.display = 'none';
          });

          // Toggle expand/collapse clicks in the selector tree
          overlay.querySelectorAll('.sel-toggle-btn').forEach(btn => {
            btn.addEventListener('click', ev => {
              ev.stopPropagation();
              const container = btn.closest('.parent-sel-node-container');
              const children = container.querySelector(':scope > .parent-sel-children');
              if (children) {
                const isVisible = children.style.display !== 'none';
                children.style.display = isVisible ? 'none' : 'block';
                btn.textContent = isVisible ? '▶' : '▼';
              }
            });
          });

          // Category option click
          overlay.querySelectorAll('.parent-sel-clickable-name').forEach(nameSpan => {
            nameSpan.addEventListener('click', ev => {
              ev.stopPropagation();
              const row = nameSpan.closest('.parent-sel-row');
              const id = row.dataset.id;
              const name = row.dataset.name;
              onSelect(id, name);
              overlay.style.display = 'none';
            });
          });

          // Tree filter search input event
          const searchInp = document.getElementById('parent-sel-search');
          searchInp.focus();
          searchInp.addEventListener('input', e => {
            const val = e.target.value.toLowerCase().trim();
            const treeContainer = document.getElementById('parent-sel-tree');
            const rows = treeContainer.querySelectorAll('.parent-sel-row');
            
            if (!val) {
              // Reset tree: collapse all and show everything
              treeContainer.querySelectorAll('.parent-sel-node-container').forEach(c => {
                c.style.display = '';
              });
              treeContainer.querySelectorAll('.parent-sel-children').forEach(ch => {
                ch.style.display = 'none';
              });
              treeContainer.querySelectorAll('.sel-toggle-btn').forEach(btn => {
                btn.textContent = '▶';
              });
              return;
            }
            
            // First, hide everything
            treeContainer.querySelectorAll('.parent-sel-node-container').forEach(c => {
              c.style.display = 'none';
            });
            
            // Show matching nodes and their ancestors, and expand their child containers
            rows.forEach(r => {
              const name = r.dataset.name.toLowerCase();
              if (name.includes(val)) {
                let container = r.closest('.parent-sel-node-container');
                while (container) {
                  container.style.display = '';
                  const childrenDiv = container.querySelector(':scope > .parent-sel-children');
                  if (childrenDiv) {
                    childrenDiv.style.display = 'block';
                    const toggleBtn = container.querySelector(':scope > .parent-sel-row > .sel-toggle-btn');
                    if (toggleBtn) toggleBtn.textContent = '▼';
                  }
                  // Move up to parent container
                  container = container.parentElement.closest('.parent-sel-node-container');
                }
              }
            });
          });
        }

        function buildSearchableParent(catId, currentParentId) {
          const currentOpt = flatCats.find(o => String(o.id) === String(currentParentId || ''));
          const displayName = currentOpt ? currentOpt.name : '— Główna (brak rodzica) —';
          const uid = 'cat-parent-' + catId;
          return `
            <div class="cat-parent-combo" data-id="${catId}" style="position:relative;width:180px;flex-shrink:0">
              <input type="text" class="form-input cat-parent-search" data-id="${catId}" id="${uid}"
                value="${escHtml(displayName)}" data-selected="${currentParentId || ''}"
                placeholder="Szukaj kategorii..." readonly
                style="font-size:.72rem;padding:1px 6px;height:26px;width:100%;cursor:pointer;background:var(--bg-elevated);text-align:left;border:1px solid var(--border)">
            </div>`;
        }

        const nodeMap = new Map();
        function indexTree(nodes) {
          for (const node of nodes) {
            nodeMap.set(node.id, node);
            if (node.children && node.children.length) {
              indexTree(node.children);
            }
          }
        }
        indexTree(catTreeData.tree);

        // ─── Recursive nested tree renderer ──────────────────────────────────────
        function renderReorderNode(node, renderChildren = true) {
          const hasChildren = node.children && node.children.length > 0;
          const count = node.total_count || node.product_count || 0;
          
          const isRoot = !node.parent_id;
          const depthStyle = isRoot
            ? `background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;font-weight:600;`
            : `background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;`;

          const toggleHtml = hasChildren
            ? `<span class="cat-toggle-btn" style="cursor:pointer;font-size:.75rem;width:16px;text-align:center;user-select:none;color:var(--text-muted);margin-right:4px">▶</span>`
            : `<span class="cat-toggle-placeholder" style="width:16px;display:inline-block;margin-right:4px"></span>`;

          let childrenHtml = '';
          if (hasChildren && renderChildren) {
            const sortedChildren = [...node.children].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name, 'pl'));
            childrenHtml = sortedChildren.map(child => renderReorderNode(child, renderChildren)).join('');
          }

          return `
            <div class="cat-reorder-node" data-id="${node.id}" data-parent="${node.parent_id || ''}">
              <div class="cat-reorder-row" data-id="${node.id}" data-parent="${node.parent_id || ''}" draggable="true"
                style="display:flex;align-items:center;gap:6px;padding:6px 10px;margin-bottom:3px;${depthStyle}cursor:grab;user-select:none;">
                ${toggleHtml}
                <input type="checkbox" class="cat-row-cb" data-id="${node.id}" style="flex-shrink:0;width:15px;height:15px;cursor:pointer;accent-color:var(--accent)" onclick="event.stopPropagation()">
                <span style="font-size:.95rem;color:var(--text-muted);cursor:grab;flex-shrink:0">⠿</span>
                <input type="text" class="cat-reorder-name-input form-input" data-id="${node.id}" value="${escHtml(node.name)}"
                  style="flex:1;font-size:.82rem;padding:2px 6px;height:26px;background:transparent;border:1px solid transparent;min-width:80px;transition:all .2s"
                  onfocus="this.style.background='var(--bg-surface)';this.style.borderColor='var(--border)'"
                  onblur="this.style.background='transparent';this.style.borderColor='transparent'">
                <span style="font-size:.68rem;color:var(--text-muted);background:var(--bg-elevated);padding:1px 6px;border-radius:8px;flex-shrink:0">${count}</span>
                ${buildSearchableParent(node.id, node.parent_id)}
                <button class="cat-ai-btn btn btn--ghost btn--sm" data-id="${node.id}" title="🤖 AI — przetłumacz i dopasuj rodzica"
                  style="flex-shrink:0;padding:2px 6px;font-size:.8rem;color:var(--accent-light);opacity:.7;transition:all .2s"
                  onmouseenter="this.style.opacity='1';this.style.transform='scale(1.15)'"
                  onmouseleave="this.style.opacity='.7';this.style.transform=''">🤖</button>
                <button class="cat-reorder-delete btn btn--ghost btn--sm" data-id="${node.id}" data-name="${escHtml(node.name)}" data-count="${count}"
                  title="Usuń kategorię" style="flex-shrink:0;padding:2px 6px;font-size:.8rem;color:var(--danger,#ef4444)">🗑</button>
              </div>
              ${hasChildren ? `<div class="cat-reorder-children" style="display:none;padding-left:20px;border-left:1px dashed var(--border);margin-left:8px;margin-bottom:4px" data-loaded="true">${childrenHtml}</div>` : ''}
            </div>`;
        }

        const sortedRoots = [...catTreeData.tree].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name, 'pl'));
        const listHtml = sortedRoots.map(root => renderReorderNode(root, true)).join('');

        Modal.show({
          title: '✏️ Edytuj kategorie — kolejność, nazwy, hierarchia',
          body: `
            <div style="font-size:.8rem;color:var(--text-secondary);margin-bottom:10px;line-height:1.6;border:1px solid var(--border);border-radius:6px;padding:8px 12px;background:var(--bg-elevated);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span>🖱️ <b>Przeciągaj</b> ⠿ kolejność rodzeństwa</span>
              <span>▶ / ▼ <b>Rozwiń</b> podkategorie</span>
              <span>✏️ <b>Kliknij nazwę</b> edycja</span>
              <span>📂 <b>Dropdown</b> rodzic</span>
              <span>🤖 <b>AI</b> tłumaczy + dopasowuje</span>
              <span>🗑 <b>Kosz</b> usuwa puste</span>
              <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                <button class="btn btn--ghost btn--sm" id="cat-cb-all-btn" style="font-size:.72rem;padding:2px 8px" title="Zaznacz / odznacz wszystkie">☑ Wszystkie</button>
                <button class="btn btn--ghost btn--sm" id="cat-ai-selected-btn" style="font-size:.72rem;padding:2px 8px;color:var(--accent)" title="AI dla zaznaczonych wierszy">🤖 AI Zaznaczone</button>
                <button class="btn btn--accent btn--sm" id="cat-ai-all-btn" style="font-size:.75rem;padding:3px 10px;display:inline-flex;align-items:center;gap:4px">
                  <span style="font-size:1rem">🤖</span> AI Organizuj wszystkie
                </button>
                <button class="btn btn--ghost btn--sm" id="cat-merge-btn" style="font-size:.72rem;padding:2px 8px;color:#f59e0b;border-color:#f59e0b" title="Scal zaznaczone kategorie w jedną">🔗 Scal zaznaczone</button>
              </span>
            </div>

            <!-- ═══ Formularz dodawania nowej kategorii ═══ -->
            <div id="cat-add-form" style="margin-bottom:12px;padding:10px 14px;border:2px dashed var(--accent);border-radius:8px;background:rgba(99,102,241,.04);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:1.1rem;flex-shrink:0">➕</span>
              <input type="text" id="cat-new-name" placeholder="Nazwa nowej kategorii..." autocomplete="off"
                style="flex:1;min-width:160px;height:30px;font-size:.82rem;padding:0 10px;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);outline:none;transition:border .2s"
                onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
              <div style="position:relative;flex-shrink:0" id="cat-new-parent-wrap">
                <input type="text" id="cat-new-parent-search" placeholder="Rodzic (opcjonalnie)" autocomplete="off" readonly
                  style="width:180px;height:30px;font-size:.78rem;padding:0 8px;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);outline:none;cursor:pointer"
                  data-selected="">
              </div>
              <button class="btn btn--primary btn--sm" id="cat-add-btn" style="height:30px;padding:0 16px;font-size:.82rem;font-weight:600;white-space:nowrap">
                ➕ Dodaj
              </button>
            </div>

            <div id="cat-reorder-list" style="max-height:55vh;overflow-y:auto;display:flex;flex-direction:column;gap:0">${listHtml}</div>
          `,
          footer: `
            <button class="btn btn--ghost" onclick="Modal.hide()">Anuluj</button>
            <button class="btn btn--primary" id="cat-reorder-save-btn">💾 Zapisz kolejność i hierarchię</button>
          `
        });

        setTimeout(() => {
          const list = document.getElementById('cat-reorder-list');
          if (!list) return;

          let dragSrc = null;

          // ── Helper to dynamically bind events on a tree node ───────────────────
          function bindRowEvents(nodeEl) {
            const row = nodeEl.querySelector(':scope > .cat-reorder-row');
            if (!row) return;

            const catId = parseInt(row.dataset.id);

            // 1. Expand/Collapse toggle click
            const toggle = row.querySelector('.cat-toggle-btn');
            const childrenContainer = nodeEl.querySelector(':scope > .cat-reorder-children');
            if (toggle && childrenContainer) {
              if (!toggle.dataset.bound) {
                toggle.addEventListener('click', e => {
                  e.stopPropagation();
                  const isVisible = childrenContainer.style.display !== 'none';
                  
                  if (!isVisible && childrenContainer.dataset.loaded !== 'true') {
                    const nodeObj = nodeMap.get(catId);
                    if (nodeObj && nodeObj.children && nodeObj.children.length) {
                      const sortedChildren = [...nodeObj.children].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name, 'pl'));
                      const div = document.createElement('div');
                      div.innerHTML = sortedChildren.map(child => renderReorderNode(child, false)).join('');
                      
                      const fragment = document.createDocumentFragment();
                      Array.from(div.children).forEach(childEl => {
                        const childId = parseInt(childEl.dataset.id);
                        if (!list.querySelector(`.cat-reorder-node[data-id="${childId}"]`)) {
                          fragment.appendChild(childEl);
                        }
                      });
                      
                      childrenContainer.appendChild(fragment);
                      childrenContainer.querySelectorAll(':scope > .cat-reorder-node').forEach(childEl => bindRowEvents(childEl));
                    }
                    childrenContainer.dataset.loaded = 'true';
                  }

                  childrenContainer.style.display = isVisible ? 'none' : 'block';
                  toggle.textContent = isVisible ? '▶' : '▼';
                });
                toggle.dataset.bound = 'true';
              }
            }

            // 2. Parent selector using the new visual tree modal
            const inp = row.querySelector('.cat-parent-search');
            if (inp && !inp.dataset.bound) {
              inp.addEventListener('click', e => {
                e.stopPropagation();
                _showParentSelectorModal(catId, inp.dataset.selected || '', (selectedId, selectedName) => {
                  inp.value = selectedName;
                  inp.dataset.selected = selectedId;
                  
                  // Update row parent data
                  row.dataset.parent = selectedId;
                  
                  // Reactive UI: move node under new parent in the DOM tree
                  if (selectedId) {
                    const newParentNode = list.querySelector(`.cat-reorder-node[data-id="${selectedId}"]`);
                    if (newParentNode) {
                      let newParentChildren = newParentNode.querySelector(':scope > .cat-reorder-children');
                      if (!newParentChildren) {
                        newParentNode.insertAdjacentHTML('beforeend', `<div class="cat-reorder-children" style="display: block; padding-left: 20px; border-left: 1px dashed var(--border); margin-left:8px; margin-bottom:4px" data-loaded="true"></div>`);
                        newParentChildren = newParentNode.querySelector(':scope > .cat-reorder-children');
                        
                        const parentRow = newParentNode.querySelector(':scope > .cat-reorder-row');
                        const placeholder = parentRow?.querySelector('.cat-toggle-placeholder');
                        if (placeholder) {
                          const toggleBtn = document.createElement('span');
                          toggleBtn.className = 'cat-toggle-btn';
                          toggleBtn.style.cssText = 'cursor:pointer;font-size:.75rem;width:16px;text-align:center;user-select:none;color:var(--text-muted);margin-right:4px;';
                          toggleBtn.textContent = '▼';
                          placeholder.replaceWith(toggleBtn);
                          
                          toggleBtn.addEventListener('click', ev => {
                            ev.stopPropagation();
                            const isVisible = newParentChildren.style.display !== 'none';
                            newParentChildren.style.display = isVisible ? 'none' : 'block';
                            toggleBtn.textContent = isVisible ? '▶' : '▼';
                          });
                        }
                      }
                      newParentChildren.appendChild(nodeEl);
                      newParentChildren.style.display = 'block';
                      const parentToggle = newParentNode.querySelector(':scope > .cat-reorder-row .cat-toggle-btn');
                      if (parentToggle) parentToggle.textContent = '▼';
                    }
                  } else {
                    list.appendChild(nodeEl);
                  }
                  
                  // Update styling
                  const isRoot = !selectedId;
                  row.style.background = isRoot ? 'var(--bg-surface)' : 'var(--bg-elevated)';
                  row.style.border = '1px solid var(--border)';
                  row.style.borderRadius = isRoot ? '6px' : '4px';
                  row.style.fontWeight = isRoot ? '600' : '400';
                });
              });
              inp.dataset.bound = 'true';
            }

            // 3. Delete buttons
            const delBtn = row.querySelector('.cat-reorder-delete');
            if (delBtn && !delBtn.dataset.bound) {
              delBtn.addEventListener('click', async () => {
                const catName = delBtn.dataset.name;
                const cnt = parseInt(delBtn.dataset.count);
                if (cnt > 0) {
                  Toast.error(`Nie można usunąć "${catName}" — ma ${cnt} przypisanych produktów.`);
                  return;
                }
                if (!confirm(`Czy na pewno chcesz usunąć kategorię "${catName}"?`)) return;
                delBtn.disabled = true;
                try {
                  await API.del(`/sourcing/catalog/categories/${catId}`);
                  nodeEl.remove();
                  Toast.success(`Usunięto kategorię "${catName}"`);
                  
                  // Invalidate tree cache
                  catTreeData = null;
                  clearTabCache('cat:cats');
                  clearTabCache('cat:stats');
                } catch(e) {
                  Toast.error(e.message);
                  delBtn.disabled = false;
                }
              });
              delBtn.dataset.bound = 'true';
            }

            // 4. DnD sorting
            if (!row.dataset.dndBound) {
              row.addEventListener('dragstart', e => {
                dragSrc = row;
                row.style.opacity = '0.4';
                e.dataTransfer.effectAllowed = 'move';
              });
              row.addEventListener('dragend', () => { row.style.opacity = '1'; });
              row.addEventListener('dragover', e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!dragSrc || dragSrc === row) return;
                const dragNode = dragSrc.closest('.cat-reorder-node');
                const targetNode = row.closest('.cat-reorder-node');
                if (!dragNode || !targetNode) return;
                
                if (dragNode.parentElement !== targetNode.parentElement) return;

                const rect = row.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const container = dragNode.parentElement;
                if (e.clientY < midY) {
                  container.insertBefore(dragNode, targetNode);
                } else {
                  container.insertBefore(dragNode, targetNode.nextSibling);
                }
              });
              row.dataset.dndBound = 'true';
            }
          }

          // Initial binding for all nodes
          list.querySelectorAll('.cat-reorder-node').forEach(nodeEl => bindRowEvents(nodeEl));

          // ── New category form bindings ──────────────────────────────────────
          const newNameInput = document.getElementById('cat-new-name');
          const newParentSearch = document.getElementById('cat-new-parent-search');
          const addBtn = document.getElementById('cat-add-btn');

          if (newParentSearch) {
            newParentSearch.addEventListener('click', e => {
              e.stopPropagation();
              _showParentSelectorModal(null, newParentSearch.dataset.selected || '', (selectedId, selectedName) => {
                newParentSearch.value = selectedName;
                newParentSearch.dataset.selected = selectedId;
              });
            });
          }

          // Add category button
          async function _addNewCategory() {
            const name = newNameInput?.value.trim();
            if (!name) { Toast.error('Wpisz nazwę kategorii'); nameInput?.focus(); return; }

            const parentId = newParentSearch?.dataset.selected || null;
            addBtn.disabled = true;
            addBtn.textContent = '⏳...';

            try {
              const res = await API.post('/sourcing/catalog/categories', {
                name,
                parent_id: parentId ? parseInt(parentId) : null
              });

              if (res.ok) {
                Toast.success(`Dodano kategorię "${res.name}"`);

                const isRoot = !parentId;
                const depthStyle = isRoot
                  ? 'background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;font-weight:600;'
                  : 'background:var(--bg-elevated);border:1px solid var(--border);border-radius:4px;';

                // Build new node HTML
                const newRowHtml = `
                  <div class="cat-reorder-node" data-id="${res.id}" data-parent="${parentId || ''}">
                    <div class="cat-reorder-row" data-id="${res.id}" data-parent="${parentId || ''}" draggable="true"
                      style="display:flex;align-items:center;gap:6px;padding:6px 10px;margin-bottom:3px;${depthStyle}cursor:grab;user-select:none;border-color:var(--accent) !important;animation:cat-new-flash .6s ease">
                      <span class="cat-toggle-placeholder" style="width:16px;display:inline-block;margin-right:4px"></span>
                      <input type="checkbox" class="cat-row-cb" data-id="${res.id}" style="flex-shrink:0;width:15px;height:15px;cursor:pointer;accent-color:var(--accent)" onclick="event.stopPropagation()">
                      <span style="font-size:.95rem;color:var(--text-muted);cursor:grab;flex-shrink:0">⠿</span>
                      <input type="text" class="cat-reorder-name-input form-input" data-id="${res.id}" value="${escHtml(res.name)}"
                        style="flex:1;font-size:.82rem;padding:2px 6px;height:26px;background:transparent;border:1px solid transparent;min-width:80px;transition:all .2s"
                        onfocus="this.style.background='var(--bg-surface)';this.style.borderColor='var(--border)'"
                        onblur="this.style.background='transparent';this.style.borderColor='transparent'">
                      <span style="font-size:.68rem;color:var(--text-muted);background:var(--bg-elevated);padding:1px 6px;border-radius:8px;flex-shrink:0">0</span>
                      <span style="font-size:.7rem;color:var(--accent);font-weight:600;padding:2px 6px;background:rgba(99,102,241,.1);border-radius:4px">✨ nowa</span>
                      ${buildSearchableParent(res.id, parentId)}
                      <button class="cat-reorder-delete btn btn--ghost btn--sm" data-id="${res.id}" data-name="${escHtml(res.name)}" data-count="0"
                        title="Usuń kategorię" style="flex-shrink:0;padding:2px 6px;font-size:.8rem;color:var(--danger,#ef4444)">🗑</button>
                    </div>
                  </div>`;

                if (parentId) {
                  const parentNode = list.querySelector(`.cat-reorder-node[data-id="${parentId}"]`);
                  if (parentNode) {
                    let parentChildren = parentNode.querySelector(':scope > .cat-reorder-children');
                    if (!parentChildren) {
                      parentNode.insertAdjacentHTML('beforeend', `<div class="cat-reorder-children" style="display: block; padding-left: 20px; border-left: 1px dashed var(--border); margin-left:8px; margin-bottom:4px"></div>`);
                      parentChildren = parentNode.querySelector(':scope > .cat-reorder-children');
                      
                      const parentRow = parentNode.querySelector(':scope > .cat-reorder-row');
                      const placeholder = parentRow?.querySelector('.cat-toggle-placeholder');
                      if (placeholder) {
                        const toggle = document.createElement('span');
                        toggle.className = 'cat-toggle-btn';
                        toggle.style.cssText = 'cursor:pointer;font-size:.75rem;width:16px;text-align:center;user-select:none;color:var(--text-muted);margin-right:4px;';
                        toggle.textContent = '▼';
                        placeholder.replaceWith(toggle);
                        toggle.addEventListener('click', e => {
                          e.stopPropagation();
                          const isVisible = parentChildren.style.display !== 'none';
                          parentChildren.style.display = isVisible ? 'none' : 'block';
                          toggle.textContent = isVisible ? '▶' : '▼';
                        });
                      }
                    }
                    parentChildren.insertAdjacentHTML('beforeend', newRowHtml);
                    parentChildren.style.display = 'block';
                    const parentToggle = parentNode.querySelector(':scope > .cat-reorder-row .cat-toggle-btn');
                    if (parentToggle) parentToggle.textContent = '▼';
                  } else {
                    list.insertAdjacentHTML('beforeend', newRowHtml);
                  }
                } else {
                  list.insertAdjacentHTML('beforeend', newRowHtml);
                }

                // Bind events on the newly added node
                const newNode = list.querySelector(`.cat-reorder-node[data-id="${res.id}"]`);
                if (newNode) bindRowEvents(newNode);

                // Update flatCats
                flatCats.push({ id: res.id, name: res.name, parentId: parentId ? parseInt(parentId) : null, depth: isRoot ? 0 : 1, count: 0 });

                newNameInput.value = '';
                newParentSearch.value = '';
                newParentSearch.dataset.selected = '';
                newNameInput.focus();

                catTreeData = null;
                clearTabCache('cat:cats');
                clearTabCache('cat:stats');
              } else {
                Toast.error(res.error || 'Błąd dodawania kategorii');
              }
            } catch(e) {
              Toast.error(e.message);
            } finally {
              addBtn.disabled = false;
              addBtn.textContent = '➕ Dodaj';
            }
          }

          addBtn?.addEventListener('click', _addNewCategory);
          newNameInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); _addNewCategory(); }
          });

        // Save: collect sort_order + parent_id + renamed names from DOM
        document.getElementById('cat-reorder-save-btn')?.addEventListener('click', async () => {
          const btn = document.getElementById('cat-reorder-save-btn');
          btn.disabled = true; btn.textContent = '⏳ Zapisuję...';

          try {
            const renamePromises = [];
            list.querySelectorAll('.cat-reorder-name-input').forEach(inp => {
              const id = parseInt(inp.dataset.id);
              const orig = flatCats.find(c => c.id === id)?.name || '';
              const newName = inp.value.trim();
              if (newName && newName !== orig) {
                renamePromises.push(
                  API.patch(`/sourcing/catalog/categories/${id}`, { name: newName })
                    .then(() => Toast.success(`Zmieniono nazwę: "${orig}" → "${newName}"`))
                    .catch(e => Toast.error(`Błąd rename "${orig}": ${e.message}`))
                );
              }
            });
            if (renamePromises.length) await Promise.all(renamePromises);

            // Collect all rows in depth-first DOM and JS traversal order
            const order = [];
            const processedIds = new Set();
            let globalIndex = 0;

            function walkContainer(containerEl, expectedParentId) {
              const childNodes = Array.from(containerEl.querySelectorAll(':scope > .cat-reorder-node'));
              childNodes.forEach(nodeEl => {
                const row = nodeEl.querySelector(':scope > .cat-reorder-row');
                if (!row) return;
                const id = parseInt(row.dataset.id);
                if (processedIds.has(id)) return;
                processedIds.add(id);

                const inp = row.querySelector('.cat-parent-search');
                const parentVal = inp ? (inp.dataset.selected || '') : '';
                const parentId = parentVal ? parseInt(parentVal) : null;

                order.push({
                  id: id,
                  parent_id: parentId,
                  sort_order: globalIndex++
                });

                const childrenContainer = nodeEl.querySelector(':scope > .cat-reorder-children');
                if (childrenContainer) {
                  walkContainer(childrenContainer, id);
                }
                const jsNode = nodeMap.get(id);
                if (jsNode && jsNode.children && jsNode.children.length) {
                  walkJsChildren(jsNode.children, id);
                }
              });
            }

            function walkJsChildren(jsNodes, parentId) {
              const sorted = [...jsNodes].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name, 'pl'));
              for (const node of sorted) {
                if (processedIds.has(node.id)) continue;
                processedIds.add(node.id);
                order.push({
                  id: node.id,
                  parent_id: parentId,
                  sort_order: globalIndex++
                });
                if (node.children && node.children.length) {
                  walkJsChildren(node.children, node.id);
                }
              }
            }

            walkContainer(list, null);
            await API.patch('/sourcing/catalog/categories/reorder', { order });

            Toast.success('✅ Zapisano kolejność i hierarchię kategorii');
            clearTabCache('cat:cats');
            clearTabCache('cat:stats');
            catTreeData = null;
            renderCatalog();
            btn.textContent = '✅ Zapisano';
            setTimeout(() => { btn.textContent = '💾 Zapisz kolejność i hierarchię'; }, 2000);
          } catch(e) {
            Toast.error(e.message);
          } finally {
            btn.disabled = false; btn.textContent = '💾 Zapisz kolejność i hierarchię';
          }
        });

        // ─── AI Organize handler ──────────────────────────────────────────
        async function _aiOrganize(categoryIds) {
          const isAll = !categoryIds;
          const ids = categoryIds || [];
          const label = isAll ? 'wszystkich kategorii' : (ids.length === 1 ? 'kategorii' : `${ids.length} kategorii`);

          const rows = list.querySelectorAll('.cat-reorder-row');
          const targetRows = [];
          rows.forEach(r => {
            const rid = parseInt(r.dataset.id);
            if (isAll || ids.includes(rid)) {
              targetRows.push(r);
              const aiBtn = r.querySelector('.cat-ai-btn');
              if (aiBtn) { aiBtn.textContent = '⏳'; aiBtn.disabled = true; }
            }
          });

          Toast.info(`🤖 AI analizuje ${label}... proszę czekać`);

          try {
            const payload = isAll ? {} : { categoryIds: ids };
            const result = await API.post('/sourcing/catalog/categories/ai-organize', payload);
            if (!result.suggestions || !result.suggestions.length) {
              Toast.warning('AI nie zwróciło sugestii');
              return;
            }

            let translated = 0, parentSuggested = 0;
            for (const sug of result.suggestions) {
              const row = list.querySelector(`.cat-reorder-row[data-id="${sug.id}"]`);
              if (!row) continue;

              if (sug.translated_name) {
                const nameInp = row.querySelector('.cat-reorder-name-input');
                if (nameInp) {
                  nameInp.value = sug.translated_name;
                  nameInp.style.background = 'rgba(34,197,94,0.12)';
                  nameInp.style.borderColor = 'var(--success, #22c55e)';
                  nameInp.title = `AI: przetłumaczono (${sug.confidence || 'medium'})`;
                  translated++;
                }
              }

              if (sug.hasOwnProperty('suggested_parent_id') && sug.suggested_parent_id !== undefined) {
                const parentInp = row.querySelector('.cat-parent-search');
                if (parentInp) {
                  const val = sug.suggested_parent_id;
                  const matchingOpt = val ? flatCats.find(c => String(c.id) === String(val)) : null;
                  const optName = matchingOpt ? matchingOpt.name : '— Główna (brak rodzica) —';
                  parentInp.dataset.selected = val ? String(val) : '';
                  parentInp.value = optName;
                  parentInp.style.background = 'rgba(59,130,246,0.12)';
                  parentInp.style.borderColor = 'var(--accent-light)';
                  parentInp.title = `AI: sugerowany rodzic (${sug.confidence || 'medium'})`;
                  
                  // Update row parent data
                  row.dataset.parent = val ? String(val) : '';
                  
                  // Physically move the category node to reflect parent suggestion in real time!
                  const nodeEl = row.closest('.cat-reorder-node');
                  if (nodeEl) {
                    if (val) {
                      const newParentNode = list.querySelector(`.cat-reorder-node[data-id="${val}"]`);
                      if (newParentNode) {
                        let newParentChildren = newParentNode.querySelector(':scope > .cat-reorder-children');
                        if (!newParentChildren) {
                          newParentNode.insertAdjacentHTML('beforeend', `<div class="cat-reorder-children" style="display: block; padding-left: 20px; border-left: 1px dashed var(--border); margin-left:8px; margin-bottom:4px" data-loaded="true"></div>`);
                          newParentChildren = newParentNode.querySelector(':scope > .cat-reorder-children');
                          
                          const parentRow = newParentNode.querySelector(':scope > .cat-reorder-row');
                          const placeholder = parentRow?.querySelector('.cat-toggle-placeholder');
                          if (placeholder) {
                            const toggleBtn = document.createElement('span');
                            toggleBtn.className = 'cat-toggle-btn';
                            toggleBtn.style.cssText = 'cursor:pointer;font-size:.75rem;width:16px;text-align:center;user-select:none;color:var(--text-muted);margin-right:4px;';
                            toggleBtn.textContent = '▼';
                            placeholder.replaceWith(toggleBtn);
                            toggleBtn.addEventListener('click', ev => {
                              ev.stopPropagation();
                              const isVisible = newParentChildren.style.display !== 'none';
                              newParentChildren.style.display = isVisible ? 'none' : 'block';
                              toggleBtn.textContent = isVisible ? '▶' : '▼';
                            });
                          }
                        }
                        newParentChildren.appendChild(nodeEl);
                        newParentChildren.style.display = 'block';
                        const parentToggle = newParentNode.querySelector(':scope > .cat-reorder-row .cat-toggle-btn');
                        if (parentToggle) parentToggle.textContent = '▼';
                      }
                    } else {
                      list.appendChild(nodeEl);
                    }
                    
                    const isRoot = !val;
                    row.style.background = isRoot ? 'var(--bg-surface)' : 'var(--bg-elevated)';
                    row.style.border = '1px solid var(--border)';
                    row.style.borderRadius = isRoot ? '6px' : '4px';
                    row.style.fontWeight = isRoot ? '600' : '400';
                  }

                  parentSuggested++;
                }
              }
            }

            Toast.success(`🤖 AI: przetłumaczono ${translated} nazw, zasugerowano ${parentSuggested} rodziców (model: ${result.model || '?'})`);
          } catch(e) {
            Toast.error(`Błąd AI: ${e.message}`);
          } finally {
            targetRows.forEach(r => {
              const aiBtn = r.querySelector('.cat-ai-btn');
              if (aiBtn) { aiBtn.textContent = '🤖'; aiBtn.disabled = false; }
            });
          }
        }

        list.querySelectorAll('.cat-ai-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const checked = [...list.querySelectorAll('.cat-row-cb:checked')].map(cb => parseInt(cb.dataset.id));
            const catId = parseInt(btn.dataset.id);
            if (checked.length > 1) {
              _aiOrganize(checked);
            } else {
              _aiOrganize([catId]);
            }
          });
        });

        // Select all / deselect all
        document.getElementById('cat-cb-all-btn')?.addEventListener('click', () => {
          const cbs = list.querySelectorAll('.cat-row-cb');
          const anyUnchecked = [...cbs].some(cb => !cb.checked);
          cbs.forEach(cb => cb.checked = anyUnchecked);
        });

        // AI for selected rows
        document.getElementById('cat-ai-selected-btn')?.addEventListener('click', () => {
          const checked = [...list.querySelectorAll('.cat-row-cb:checked')].map(cb => parseInt(cb.dataset.id));
          if (!checked.length) { Toast.warning('Zaznacz przynajmniej jedną kategorię checkboxem'); return; }
          _aiOrganize(checked);
        });

        // Global AI button
        document.getElementById('cat-ai-all-btn')?.addEventListener('click', () => {
          _aiOrganize(null);
        });

        // Merge selected categories
        document.getElementById('cat-merge-btn')?.addEventListener('click', async () => {
          const checked = [...list.querySelectorAll('.cat-row-cb:checked')].map(cb => parseInt(cb.dataset.id));
          if (checked.length < 2) { Toast.warning('Zaznacz co najmniej 2 kategorie do scalenia'); return; }
          const names = checked.map(id => flatCats.find(c => c.id === id)?.name || id).join(', ');
          const targetName = prompt(`Scalanie ${checked.length} kategorii:\n${names}\n\nPodaj nazwę wynikowej kategorii:`, flatCats.find(c => c.id === checked[0])?.name || '');
          if (!targetName) return;
          try {
            const res = await API.post('/sourcing/catalog/categories/merge', { categoryIds: checked, targetName: targetName.trim() });
            Toast.success(`Scalono ${res.merged} kategorii → "${res.targetName}" (${res.productsMoved} produktów przeniesionych)`);
            catTreeData = null;
            await renderCatalog();
            _showCategoryReorderModal();
          } catch(e) { Toast.error('Błąd scalania: ' + e.message); }
        });

      }, 50);
      }
      bindWithGuard('cat-tree-reorder-btn', 'click', _showCategoryReorderModal);

      // --- Category Tree Actions Dropdown Menu Event Listeners ---
      bindWithGuard('cat-tree-actions-toggle-btn', 'click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('cat-tree-actions-menu');
        if (menu) {
          const isShown = menu.style.display === 'block';
          menu.style.display = isShown ? 'none' : 'block';
        }
      });

      // Close actions menu when clicking anywhere else
      document.addEventListener('click', (e) => {
        const menu = document.getElementById('cat-tree-actions-menu');
        if (menu && menu.style.display === 'block') {
          const toggleBtn = document.getElementById('cat-tree-actions-toggle-btn');
          if (!menu.contains(e.target) && e.target !== toggleBtn && !toggleBtn?.contains(e.target)) {
            menu.style.display = 'none';
          }
        }
      });

      // Close actions menu when any menu item is clicked
      document.querySelectorAll('#cat-tree-actions-menu .dropdown-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const menu = document.getElementById('cat-tree-actions-menu');
          if (menu) menu.style.display = 'none';
        });
      });
    }

    _bindCategoryTreeHeaderEvents();
    _bindCategoryTreeEvents();

    console.timeEnd('[Catalog] bind');
    console.timeEnd('[Catalog] total');

    // Save rendered HTML for instant tab revisit
    _catLastRender = { html: el.innerHTML, ts: Date.now() };

  }

  function _bindCategoryTreeEvents() {
    const inner = document.getElementById('cat-tree-inner');
    if (!inner) return;
    
    // Inline generate button (shown in empty state)
    const inlineGenBtn = document.getElementById('cat-tree-gen-inline');
    if (inlineGenBtn) {
      inlineGenBtn.addEventListener('click', async () => {
        inlineGenBtn.disabled = true;
        inlineGenBtn.textContent = '⏳ Generowanie...';
        try {
          const res = await API.post('/generate-categories', {});
          if (res.ok) {
            Toast.success(res.message || `Wygenerowano ${res.created} kategorii`);
            catTreeData = null;
            renderCatalog();
          } else {
            Toast.error(res.message || 'Nie udało się wygenerować');
          }
        } catch(e) {
          Toast.error(e.message);
        } finally {
          inlineGenBtn.disabled = false;
          inlineGenBtn.textContent = '📊 Generuj kategorie';
        }
      });
    }
    
    // Tree search filter helper
    function applyTreeSearch(q) {
      q = q.toLowerCase().trim();
      if (!q) {
        inner.querySelectorAll('.cat-tree-node, .cat-tree-children').forEach(el => { el.style.display = ''; });
        return;
      }
      inner.querySelectorAll('.cat-tree-node').forEach(node => {
        const title = (node.querySelector('.cat-tree-node-title')?.textContent || '').toLowerCase();
        if (title.includes(q)) {
          node.style.display = '';
          let parent = node.closest('.cat-tree-children');
          while (parent) {
            parent.style.display = '';
            const parentNode = parent.previousElementSibling;
            if (parentNode) parentNode.style.display = '';
            parent = parent.parentElement?.closest('.cat-tree-children');
          }
        } else {
          node.style.display = 'none';
        }
      });
      inner.querySelectorAll('.cat-tree-children').forEach(container => {
        const hasVisible = [...container.querySelectorAll('.cat-tree-node')].some(n => n.style.display !== 'none');
        container.style.display = hasVisible ? '' : 'none';
      });
    }

    const treeSearchInput = document.getElementById('cat-tree-search');
    if (treeSearchInput) {
      treeSearchInput.value = catTreeSearchVal || '';
      if (catTreeSearchVal) {
        applyTreeSearch(catTreeSearchVal);
      }
      treeSearchInput.addEventListener('input', e => {
        catTreeSearchVal = e.target.value;
        applyTreeSearch(catTreeSearchVal);
      });
    }

    // Expander click
    inner.querySelectorAll('.cat-tree-expander').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const id = parseInt(el.closest('.cat-tree-node').dataset.id);
        if (catTreeExpanded.has(id)) catTreeExpanded.delete(id);
        else catTreeExpanded.add(id);
        inner.innerHTML = _renderCategoryTree(catTreeData, catTreeExpanded, catSelectedCategoryId, catSelectedIsUnmapped);
        _bindCategoryTreeEvents();
      });
    });

    // Node click (select category)
    inner.querySelectorAll('.cat-tree-node-title, .cat-tree-unmapped').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const id = el.dataset.id ? parseInt(el.dataset.id) : null;
        if (el.classList.contains('cat-tree-unmapped')) {
          catSelectedIsUnmapped = true;
          catSelectedCategoryId = 'unmapped'; 
        } else if (id === 0) {
          // "Wszystkie" clicked - reset filters
          catSelectedIsUnmapped = false;
          catSelectedCategoryId = null;
          window.catCategoryId = null;
        } else {
          catSelectedIsUnmapped = false;
          // Toggle off if already selected
          if (catSelectedCategoryId === id) {
            catSelectedCategoryId = null;
            window.catCategoryId = null;
          } else {
            catSelectedCategoryId = id;
            window.catCategoryId = id; // sync with old var
          }
        }
        catPage = 1;
        renderCatalog();
      });
    });
  }

  function _renderCategoryTree(data, expandedSet, selectedId, selectedIsUnmapped) {
    if (!data || !data.tree || data.tree.length === 0) {
      return `
        <div style="padding:16px;text-align:center;background:var(--bg-surface)">
          <div style="font-size:2rem;margin-bottom:8px">📭</div>
          <div style="color:var(--text-muted);font-size:.82rem;margin-bottom:10px">Brak drzewa kategorii.</div>
          <div style="font-size:.73rem;color:var(--text-secondary);margin-bottom:14px;line-height:1.5">
            Użyj przycisku <b>⚙</b> aby wybrać hurtownię AB jako wzorzec,<br>
            lub <b>📊</b> aby wygenerować z producentów.
          </div>
          <button class="btn btn--primary btn--sm" id="cat-tree-gen-inline" style="font-size:.78rem;padding:6px 16px">📊 Generuj kategorie</button>
        </div>
      `;
    }


    // Compute total products in tree roots for stats
    const totalInTree = data.tree.reduce((s, r) => s + (r.total_count || r.product_count || 0), 0);

    // Search input + summary bar
    let html = `
<div style="padding:5px 8px 4px;border-bottom:1px solid var(--border);background:var(--bg-surface)">
  <input type="text" id="cat-tree-search" placeholder="&#x1F50D; Szukaj kategorii..." autocomplete="off"
    style="width:100%;height:26px;font-size:.77rem;background:var(--bg-elevated);border:1px solid var(--border);border-radius:5px;color:var(--text-primary);padding:0 8px;outline:none;box-sizing:border-box">
</div>
<div style="padding:4px 10px 3px;font-size:.68rem;color:var(--text-muted);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;background:var(--bg-elevated)">
  <span>${data.tree.length} kategorii głównych</span>
  <span>${data.totalCount || 0} produktów łącznie</span>
</div>`;

    html += `<div class="cat-tree" style="background:var(--bg-surface)">`;

    // "Wszystkie" row
    const allSelected = !selectedId && !selectedIsUnmapped;
    html += `<div class="cat-tree-node cat-tree-node--all" data-id="0"
      style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;
             background:${allSelected ? 'var(--accent)' : 'transparent'};
             color:${allSelected ? '#fff' : 'var(--text-primary)'};
             border-bottom:2px solid var(--border);font-weight:700;font-size:.82rem">
      <div class="cat-tree-node-title" data-id="0" style="flex:1">Wszystkie</div>
      <span style="font-size:.69rem;padding:1px 6px;border-radius:10px;
                   background:${allSelected ? 'rgba(255,255,255,.25)' : 'rgba(99,102,241,.12)'};
                   color:${allSelected ? '#fff' : 'var(--accent)'}; font-weight:600">
        ${data.totalCount || 0}
      </span>
    </div>`;

    // Recursive node renderer
    const renderNode = (node, depth = 0) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedSet.has(node.id);
      const isSelected = selectedId === node.id;
      const count = node.total_count || node.product_count || 0;
      let r = '';

      if (depth === 0) {
        // ─── Root level: bold, accent highlight when selected
        const isActive = isSelected || (hasChildren && isExpanded);
        const bgColor = isSelected ? 'var(--accent)' : isExpanded ? 'rgba(99,102,241,.06)' : 'transparent';
        const textColor = isSelected ? '#fff' : 'var(--text-primary)';

        r += `<div class="cat-tree-node" data-id="${node.id}"
          style="padding:8px 10px;cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;
                 background:${bgColor};color:${textColor};
                 border-bottom:1px solid var(--border);
                 transition:background .15s">
          ${hasChildren 
            ? `<span class="cat-tree-expander" style="font-size:.7rem;flex-shrink:0;color:${isSelected?'rgba(255,255,255,.7)':'var(--text-muted)'};transition:transform .15s;display:inline-block;transform:${isExpanded?'rotate(90deg)':'rotate(0deg)'}">${isExpanded?'▾':'▸'}</span>`
            : `<span style="width:10px;flex-shrink:0"></span>`}
          <div class="cat-tree-node-title" data-id="${node.id}" 
            style="flex:1;font-weight:700;font-size:.81rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${escHtml(node.name)}
          </div>
          ${count > 0 ? `<span style="font-size:.68rem;padding:1px 5px;border-radius:9px;flex-shrink:0;
            background:${isSelected?'rgba(255,255,255,.25)':'rgba(99,102,241,.1)'};
            color:${isSelected?'#fff':'var(--accent)'}; font-weight:600">${count}</span>` : ''}
        </div>`;

        // Children container (collapsible)
        if (hasChildren && isExpanded) {
          r += `<div class="cat-tree-children" style="background:var(--bg-elevated);border-left:2px solid rgba(99,102,241,.2);margin-left:18px">`;
          const sortedChildren = [...node.children].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name, 'pl'));
          for (const child of sortedChildren) {
            r += renderNode(child, 1);
          }
          r += `</div>`;
        }
      } else {
        // ─── Sub-level: indented list item with accent left-border when selected
        const hasGrandChildren = hasChildren;
        const subBg = isSelected ? 'rgba(99,102,241,.12)' : 'transparent';
        const subColor = isSelected ? 'var(--accent)' : 'var(--text-secondary)';
        const borderLeft = isSelected ? '3px solid var(--accent)' : '3px solid transparent';

        r += `<div class="cat-tree-node" data-id="${node.id}"
          style="padding:5px 10px 5px 10px;cursor:pointer;
                 display:flex;align-items:center;gap:4px;user-select:none;
                 background:${subBg};
                 border-left:${borderLeft};
                 border-bottom:1px solid var(--border);
                 color:${subColor};transition:background .15s">
          ${hasGrandChildren 
            ? `<span class="cat-tree-expander" style="font-size:.6rem;flex-shrink:0;opacity:.6;transform:${isExpanded?'rotate(90deg)':'rotate(0deg)'};display:inline-block">${isExpanded?'▾':'▸'}</span>` 
            : `<span style="font-size:.7rem;flex-shrink:0;opacity:.3;margin-right:2px">–</span>`}
          <div class="cat-tree-node-title" data-id="${node.id}"
            style="flex:1;font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${isSelected?'600':'400'}">
            ${escHtml(node.name)}
          </div>
          ${count > 0 ? `<span style="font-size:.66rem;opacity:.45;flex-shrink:0">${count}</span>` : ''}
        </div>`;

        if (hasGrandChildren && isExpanded) {
          r += `<div class="cat-tree-children" style="border-left:2px solid rgba(99,102,241,.1);margin-left:16px">`;
          const sortedGC = [...node.children].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name, 'pl'));
          for (const gc of sortedGC) {
            r += renderNode(gc, depth + 1);
          }
          r += `</div>`;
        }
      }
      return r;
    };

    // Sort roots by sort_order (user-defined), then alphabetically as fallback
    const sortedRoots = [...data.tree].sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name, 'pl'));
    for (const root of sortedRoots) {
      html += renderNode(root, 0);
    }

    // ─── Unmapped section at the bottom ───────────────────────────────────────────
    const unmappedCount = data.unmappedCount || 0;
    if (unmappedCount > 0) {
      const unmappedActive = selectedIsUnmapped;
      html += `
<div style="border-top:2px solid var(--border);margin-top:2px">
  <div class="cat-tree-unmapped"
    style="padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;
           background:${unmappedActive ? 'rgba(220,38,38,.1)' : 'transparent'};
           border-left:${unmappedActive ? '3px solid #dc2626' : '3px solid transparent'};
           color:${unmappedActive ? '#dc2626' : 'var(--text-muted)'}">
    <span style="font-size:.88rem">⚠️</span>
    <span style="font-size:.79rem;font-weight:600;flex:1">Nieprzypisane</span>
    <span style="font-size:.7rem;font-weight:700;padding:1px 6px;border-radius:9px;
                 background:rgba(220,38,38,.15);color:#dc2626">${unmappedCount}</span>
  </div>
  ${!unmappedActive ? `<div style="padding:4px 12px 6px;font-size:.68rem;color:var(--text-muted);line-height:1.4">
    Kliknij &quot;&#x1F916; AI Przypisz&quot; aby automatycznie<br>przypisać te produkty.
  </div>` : ''}
</div>`;
    }

    html += '</div>';
    return html;
  }



  function bindColResizers(container) {
    if (!container) return;
    const resizers = container.querySelectorAll('.col-resizer');
    let th = null, startX = 0, startWidth = 0;
    
    const mouseMoveHandler = function(e) {
      if (!th) return;
      const dx = e.clientX - startX;
      const newW = Math.max(20, startWidth + dx);
      th.style.width = `${newW}px`;
      th.style.minWidth = '20px';
      th.style.maxWidth = `${newW}px`;
    };
    
    const mouseUpHandler = function() {
      if (th) {
        const r = th.querySelector('.col-resizer');
        if (r) r.classList.remove('resizing');
        
        try {
          const table = th.closest('table');
          const tid = table ? table.id : 'unknown';
          const col = th.dataset.col || th.textContent.replace(/[▲▼↕↑↓]/g, '').trim();
          const w = th.getBoundingClientRect().width;
          if (tid && col) {
            const saved = JSON.parse(localStorage.getItem('sg_colw_' + tid) || '{}');
            saved[col] = Math.round(w);
            localStorage.setItem('sg_colw_' + tid, JSON.stringify(saved));
          }
        } catch(err) {
          console.error('Error saving column width:', err);
        }
        
        th = null;
      }
      document.body.classList.remove('src-resizing');
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };

    resizers.forEach(resizer => {
      resizer.addEventListener('mousedown', function(e) {
        e.stopPropagation(); e.preventDefault();
        th = resizer.closest('th');
        const table = th.closest('table');
        
        if (table && !table.dataset.resized) {
          const ths = Array.from(table.querySelectorAll('thead th'));
          ths.forEach(t => {
            const w = t.getBoundingClientRect().width;
            t.style.width = `${w}px`;
            t.style.minWidth = '20px';
            t.style.maxWidth = `${w}px`;
          });
          table.style.width = 'max-content';
          table.dataset.resized = 'true';
        }
        
        startX = e.clientX;
        startWidth = th.getBoundingClientRect().width;
        resizer.classList.add('resizing');
        document.body.classList.add('src-resizing');
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
      });
      resizer.addEventListener('click', e => e.stopPropagation());
    });
  }

  function _catSortBy(col) {
    if (catSort === col) catOrder = catOrder === 'asc' ? 'desc' : 'asc';
    else { catSort = col; catOrder = 'asc'; }
    renderCatalog();
  }
  function _catPageTo(p) { catPage = p; renderCatalog(); }
  
  async function _generateAttrs(categoryId) {
    try {
      Toast.info('Generuję filtry dla kategorii...');
      const result = await API.post(`/sourcing/catalog/categories/${categoryId}/generate-attributes`);
      if (result.generated > 0) {
        Toast.success(`Wygenerowano ${result.generated} filtrów!`);
      } else {
        Toast.info(result.message || 'Nie udało się wygenerować filtrów dla tej kategorii.');
      }
      renderCatalog();
    } catch(e) { Toast.error('Błąd: ' + e.message); }
  }

  async function _batchGenAttrs() {
    try {
      Toast.info('Generuję filtry dla wszystkich kategorii (keyword + AI)...');
      const result = await API.post('/sourcing/catalog/categories/batch-generate', { useAi: true });
      Toast.success(`Gotowe! Keyword: ${result.keywordGenerated}, AI: ${result.aiGenerated}, Pominięte: ${result.failed}`);
      renderCatalog();
    } catch(e) { Toast.error('Błąd: ' + e.message); }
  }

  async function _syncCatalogAttrs() {
    try {
      Toast.info('Scalam cechy z hurtowni do katalogu Master...');
      const result = await API.post('/sourcing/catalog/sync-attributes', {});
      Toast.success(`Uzupełniono ${result.filled || 0} cech (${result.raw_updated || 0} produktów z raw_attributes).`);
      renderCatalog();
    } catch (e) { Toast.error('Błąd: ' + e.message); }
  }

  async function _showDuplicates(page = 1) {
    try {
      const data = await API.get(`/sourcing/catalog/duplicates?page=${page}&limit=10`);
      const items = data.items || [];
      
      let rows = '';
      if (items.length === 0) {
        rows = '<div style="text-align:center;padding:30px;color:var(--text-muted)">Brak nowych duplikatów do rozpatrzenia.</div>';
      } else {
        rows = items.map(d => `
<div class="duplicate-card" style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">
  <div style="display:flex;gap:16px;margin-bottom:12px">
    <div style="flex:1;border-right:1px solid var(--border);padding-right:16px">
      <div style="font-size:.75rem;color:var(--text-muted)">Produkt A</div>
      <div style="font-weight:600;margin:4px 0">${escHtml(d.a_name)}</div>
      <div style="font-size:.8rem;font-family:monospace">EAN: ${d.a_ean}</div>
      <div style="font-size:.8rem">Kod: ${d.a_code} | Prod: ${d.a_manufacturer}</div>
    </div>
    <div style="flex:1">
      <div style="font-size:.75rem;color:var(--text-muted)">Produkt B</div>
      <div style="font-weight:600;margin:4px 0">${escHtml(d.b_name)}</div>
      <div style="font-size:.8rem;font-family:monospace">EAN: ${d.b_ean}</div>
      <div style="font-size:.8rem">Kod: ${d.b_code} | Prod: ${d.b_manufacturer}</div>
    </div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05)">
    <button class="btn btn--secondary btn--sm" onclick="SourcingView._resolveDuplicate(${d.id}, 'different', ${page})">To różne produkty</button>
    <button class="btn btn--primary btn--sm" onclick="SourcingView._resolveDuplicate(${d.id}, 'merge', ${page})">Scal w jeden</button>
  </div>
</div>
        `).join('');
      }

      let pagHtml = '';
      if (data.pages > 1) {
        pagHtml = '<div style="display:flex;justify-content:center;gap:10px;margin-top:16px;align-items:center;">';
        if (page > 1) pagHtml += `<button class="btn btn--ghost btn--sm" onclick="SourcingView._showDuplicates(${page-1})">← Poprz.</button>`;
        pagHtml += `<span style="font-size:.82rem;align-self:center;display:flex;align-items:center;gap:4px">
          Str. <input type="number" min="1" max="${data.pages}" value="${page}" 
                 style="width:50px;text-align:center;padding:2px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);border-radius:4px"
                 onchange="if(this.value>=1 && this.value<=${data.pages}) SourcingView._showDuplicates(parseInt(this.value))"> 
          z ${data.pages}
        </span>`;
        if (page < data.pages) pagHtml += `<button class="btn btn--ghost btn--sm" onclick="SourcingView._showDuplicates(${page+1})">Nast. →</button>`;
        pagHtml += '</div>';
      }

      Modal.show({
        title: '🔍 Menedżer Duplikatów',
        body: `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
  <p style="font-size:.85rem;color:var(--text-secondary);margin:0">System wykrywa produkty o tym samym kodzie producenta, ale różnych kodach EAN. Zdecyduj, czy to ten sam produkt (scal), czy różne warianty.</p>
  <button class="btn btn--secondary btn--sm" onclick="SourcingView._scanDuplicates()">Skanuj bazę</button>
</div>
<div style="max-height:60vh;overflow-y:auto;padding-right:8px">
  ${rows}
  ${pagHtml}
</div>`,
        footer: '<button class="btn btn--secondary" onclick="Modal.hide();SourcingView.render()">Zamknij</button>',
        width: 800
      });
    } catch(e) { Toast.error(e.message); }
  }

  async function _scanDuplicates() {
    try {
      const r = await API.post('/sourcing/catalog/duplicates/scan');
      Toast.success(`Znaleziono nowych potencjalnych duplikatów: ${r.added}`);
      _showDuplicates();
    } catch(e) { Toast.error(e.message); }
  }

  async function _resolveDuplicate(id, action, page) {
    try {
      await API.patch(`/sourcing/catalog/duplicates/${id}`, { action });
      Toast.success(action === 'merge' ? 'Produkty zostały scalone' : 'Oznaczono jako różne produkty');
      _showDuplicates(page);
    } catch(e) { Toast.error(e.message); }
  }

  async function _suggestSchema(categoryId) {
    try {
      Toast.info('AI generuje schemat nazwy...');
      const result = await API.post(`/sourcing/catalog/naming-schema/${categoryId}/suggest`);
      Toast.success(`Schemat wygenerowany: ${(result.params||[]).join(' - ')}`);
      _showNamingSchemaModal(categoryId);
      renderCatalog();
    } catch(e) { Toast.error('Błąd: ' + e.message); }
  }

  async function _showNamingSchemaModal(categoryId) {
    if (!categoryId) return;
    try {
      const schema = await API.get(`/sourcing/catalog/naming-schema/${categoryId}`);
      const params = schema.params || [];
      const isApproved = schema.approved;
      const paramChips = params.map((p, i) => `<span class="naming-param-chip" draggable="true" data-idx="${i}" title="Przeciągnij aby zmienić kolejność">${escHtml(p)} <button class="naming-param-remove" data-idx="${i}" title="Usuń">×</button></span>`).join('');

      const html = `
<div class="naming-schema-panel" style="padding:12px;border:1px solid ${isApproved ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'};border-radius:10px;background:${isApproved ? 'rgba(16,185,129,0.03)' : 'rgba(245,158,11,0.03)'}">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
    <div style="font-size:.82rem;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:6px">
      📐 Schemat nazwy ${isApproved ? '<span style="color:#10b981;font-size:.72rem">✅ Zatwierdzony</span>' : '<span style="color:#f59e0b;font-size:.72rem">⏳ Niezatwierdzony</span>'}
    </div>
    <div style="display:flex;gap:6px">
      <button class="btn btn--ghost btn--sm" style="font-size:.72rem" onclick="SourcingView._suggestSchema(${categoryId})">🤖 Sugeruj AI</button>
      ${!isApproved && params.length > 0 ? `<button class="btn btn--primary btn--sm" style="font-size:.72rem" onclick="SourcingView._approveSchema(${categoryId})">✅ Zatwierdź</button>` : ''}
      ${isApproved ? `<button class="btn btn--ghost btn--sm" style="font-size:.72rem" onclick="SourcingView._approveSchema(${categoryId}, false)">🔓 Odblokuj</button>` : ''}
    </div>
  </div>
  <div id="naming-params-container" style="display:flex;flex-wrap:wrap;gap:6px;min-height:32px;padding:6px;border:1px dashed var(--border);border-radius:8px;background:var(--bg-surface)">
    ${paramChips || '<span style="font-size:.76rem;color:var(--text-muted)">Brak parametrów — kliknij "Sugeruj AI" lub dodaj ręcznie</span>'}
  </div>
  <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
    <input class="form-input" id="naming-new-param" placeholder="Dodaj parametr (np. Pojemność)" style="max-width:200px;font-size:.78rem">
    <button class="btn btn--ghost btn--sm" style="font-size:.72rem" onclick="SourcingView._addSchemaParam(${categoryId})">+ Dodaj</button>
  </div>
</div>`;
      
      Modal.show({
        title: 'Schemat nazwy dla kategorii',
        content: html,
        width: 600,
        footer: '<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>'
      });

      // Bind drag and drop events
      setTimeout(() => {
        const paramsContainer = document.getElementById('naming-params-container');
        if (paramsContainer) {
          let dragSrcIdx = null;
          paramsContainer.querySelectorAll('.naming-param-chip').forEach(chip => {
            chip.addEventListener('dragstart', e => { dragSrcIdx = parseInt(chip.dataset.idx); e.dataTransfer.effectAllowed = 'move'; });
            chip.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; chip.style.borderLeft = '3px solid var(--accent)'; });
            chip.addEventListener('dragleave', () => { chip.style.borderLeft = ''; });
            chip.addEventListener('drop', async e => {
              e.preventDefault(); chip.style.borderLeft = '';
              const targetIdx = parseInt(chip.dataset.idx);
              if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;
              try {
                const s = await API.get(`/sourcing/catalog/naming-schema/${categoryId}`);
                const p = s.params || [];
                const [moved] = p.splice(dragSrcIdx, 1);
                p.splice(targetIdx, 0, moved);
                await API.post(`/sourcing/catalog/naming-schema/${categoryId}`, { params: p });
                Toast.success('Kolejność parametrów zmieniona');
                _showNamingSchemaModal(categoryId);
                renderCatalog();
              } catch(err) { Toast.error(err.message); }
            });
          });
          paramsContainer.querySelectorAll('.naming-param-remove').forEach(btn => {
            btn.addEventListener('click', async e => {
              e.stopPropagation();
              const idx = parseInt(btn.dataset.idx);
              try {
                const s = await API.get(`/sourcing/catalog/naming-schema/${categoryId}`);
                const p = s.params || [];
                p.splice(idx, 1);
                await API.post(`/sourcing/catalog/naming-schema/${categoryId}`, { params: p });
                Toast.success('Parametr usunięty');
                _showNamingSchemaModal(categoryId);
                renderCatalog();
              } catch(err) { Toast.error(err.message); }
            });
          });
          const paramInput = document.getElementById('naming-new-param');
          if (paramInput) {
            paramInput.addEventListener('keydown', e => {
              if (e.key === 'Enter') SourcingView._addSchemaParam(categoryId);
            });
          }
        }
      }, 50);

    } catch(e) { Toast.error('Failed to load naming schema: ' + e.message); }
  }

  async function _approveSchema(categoryId, approved = true) {
    try {
      await API.post(`/sourcing/catalog/naming-schema/${categoryId}/approve`, { approved });
      Toast.success(approved ? 'Schemat zatwierdzony ✅' : 'Schemat odblokowany');
      _showNamingSchemaModal(categoryId);
      renderCatalog();
    } catch(e) { Toast.error(e.message); }
  }

  async function _addSchemaParam(categoryId) {
    const input = document.getElementById('naming-new-param');
    const val = input?.value?.trim();
    if (!val) return;
    try {
      const schema = await API.get(`/sourcing/catalog/naming-schema/${categoryId}`);
      const params = [...(schema.params || []), val];
      await API.post(`/sourcing/catalog/naming-schema/${categoryId}`, { params });
      input.value = '';
      Toast.success(`Dodano parametr: ${val}`);
      _showNamingSchemaModal(categoryId);
      renderCatalog();
    } catch(e) { Toast.error(e.message); }
  }

  async function _normalizeName(productId) {
    try {
      Toast.info('Normalizuję nazwę...');
      const result = await API.post(`/sourcing/catalog/normalize/${productId}`);
      if (result.success) Toast.success(`Znormalizowano: ${result.normalized_name}`);
      else if (result.skipped) Toast.info('Nazwa jest zablokowana (edytowana ręcznie)');
      else Toast.warn(result.error || 'Nie udało się znormalizować');
      renderCatalog();
    } catch(e) { Toast.error(e.message); }
  }

  function _editName(productId, currentName) {
    Modal.show({
      title: '✏️ Edytuj nazwę produktu',
      body: `
<div style="margin-bottom:12px">
  <label style="font-size:.82rem;color:var(--text-muted)">Znormalizowana nazwa:</label>
  <input class="form-input" id="edit-name-input" value="${escHtml(currentName)}" style="width:100%;margin-top:4px">
</div>
<label style="font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;gap:6px">
  <input type="checkbox" id="edit-name-lock"> 🔒 Zablokuj — AI nie nadpisze tej nazwy
</label>`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Anuluj</button>
               <button class="btn btn--primary" onclick="SourcingView._saveEditedName(${productId})">Zapisz</button>`
    });
  }

  async function _saveEditedName(productId) {
    const name = document.getElementById('edit-name-input')?.value?.trim();
    const lock = document.getElementById('edit-name-lock')?.checked || false;
    if (!name) return Toast.error('Nazwa nie może być pusta');
    try {
      await API.patch(`/sourcing/catalog/product-name/${productId}`, { name, lock });
      Toast.success('Nazwa zapisana');
      Modal.hide();
      renderCatalog();
    } catch(e) { Toast.error(e.message); }
  }

  async function _batchNormalize(categoryId) {
    const body = { limit: 50 };
    if (categoryId) body.categoryId = categoryId;
    try {
      Toast.info(`Normalizuję nazwy (${categoryId ? 'kategoria' : 'wszystkie'})...`);
      const result = await API.post('/sourcing/catalog/normalize-batch', body);
      Toast.success(`Gotowe! Sukces: ${result.success}, Błędy: ${result.failed}, Pominięte: ${result.skipped}`);
      renderCatalog();
    } catch(e) { Toast.error(e.message); }
  }

  // ─── Katalog Master Full: Lookup by EAN then show detail ─────────────
  // Backend endpoint /catalog/product/:idOrEan accepts both numeric IDs and EAN strings
  function _showProductDetailByEan(ean) {
    if (!ean) return;
    _showProductDetail(ean);
  }

  // ─── Katalog Master Full: Product Detail Modal ──────────────────────
  async function _showProductDetail(productId) {

    try {
      const detail = await API.get(`/sourcing/catalog/product/${productId}`);
      if (!detail || !detail.product) { Toast.error('Nie znaleziono produktu'); return; }
      const p = detail.product;
      const attrs = detail.attributes || [];
      const prices = detail.prices || [];
      const sub = detail.subiekt;
      const cat = detail.category;

      // Auto-fill empty fields from supplier data
      const bestSku = prices.find(pr => pr.sku)?.sku || '';
      const bestMfg = prices.find(pr => pr.supplier_manufacturer)?.supplier_manufacturer || '';
      const effectiveMfgCode = p.manufacturer_code || bestSku;
      const effectiveMfg = p.manufacturer || bestMfg;

      // Info rows
      const infoHtml = `
        <div class="prod-info-row"><span class="prod-info-label">EAN:</span> <span class="prod-info-value" style="font-family:monospace;font-weight:600">${escHtml(p.canonical_ean)}</span></div>
        <div class="prod-info-row"><span class="prod-info-label">Producent:</span> <span class="prod-info-value" style="font-weight:600;color:var(--text-primary)">${escHtml(effectiveMfg || '—')}</span></div>
        <div class="prod-info-row"><span class="prod-info-label">Kod prod.:</span> <span class="prod-info-value" style="display:inline-flex;gap:4px"><input type="text" id="prod-mfg-code" class="form-input" style="padding:2px 6px;height:24px;font-size:0.8rem;width:180px" value="${escHtml(effectiveMfgCode)}"> <button class="btn btn--ghost btn--sm" style="padding:2px 6px;height:24px" onclick="SourcingView._saveProdDetails(${p.id})">💾</button></span></div>
        <div class="prod-info-row"><span class="prod-info-label">Kategoria:</span> <span class="prod-info-value">${cat ? escHtml(cat.name) : '—'}</span></div>
        <div class="prod-info-row"><span class="prod-info-label">Waga:</span> <span class="prod-info-value" style="display:inline-flex;gap:4px;align-items:center"><input type="number" id="prod-weight-g" class="form-input" style="padding:2px 6px;height:24px;font-size:0.8rem;width:100px" value="${p.weight_g || ''}"> g <button class="btn btn--ghost btn--sm" style="padding:2px 6px;height:24px" onclick="SourcingView._saveProdDetails(${p.id})">💾</button></span></div>
        ${sub ? `<div class="prod-info-row"><span class="prod-info-label">Subiekt:</span> <span class="prod-info-value" style="color:#10b981">✅ ${escHtml(sub.name||'')} | Stan: ${sub.stock_quantity ?? '?'}</span></div>` : '<div class="prod-info-row"><span class="prod-info-label">Subiekt:</span> <span class="prod-info-value" style="color:#f87171">❌ Brak</span></div>'}
        <div class="prod-info-row"><span class="prod-info-label">Hurtownie:</span> <span class="prod-info-value">${(p.supplier_names||[]).join(', ') || '—'}</span></div>
      `;

      // Attributes table
      let attrsHtml = '';
      if (attrs.length > 0) {
        attrsHtml = `<table class="prod-attrs-table">
          <thead><tr><th>Parametr</th><th>Wartość</th><th>Jednostka</th><th></th></tr></thead>
          <tbody>${attrs.map(a => `<tr>
            <td class="prod-attr-name">${escHtml(a.attr_name)}</td>
            <td class="prod-attr-value">
              <input class="prod-attr-input" value="${escHtml(a.value_text||'')}" data-attr-id="${a.attr_id}" data-catalog-id="${productId}" placeholder="Ustaw wartość...">
            </td>
            <td>${a.attr_unit ? `<span class="prod-attr-unit">${escHtml(a.attr_unit)}</span>` : '—'}</td>
            <td><button class="prod-attr-save" onclick="SourcingView._saveAttrValue(${productId}, ${a.attr_id}, this)">💾</button></td>
          </tr>`).join('')}</tbody>
        </table>`;
      } else {
        attrsHtml = '<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:.82rem">Brak parametrów. Dodaj przez edytor filtrów kategorii.</div>';
      }

      // Enhanced prices table with SKU, category, manufacturer per supplier
      const pricesHtml = prices.length > 0 ? `<div style="overflow-x:auto"><table class="prod-attrs-table" style="min-width:700px">
        <thead><tr>
          <th>Hurtownia</th>
          <th>Cena PLN</th>
          <th>Dost.</th>
          <th>Stan</th>
          <th>SKU / Kod prod.</th>
          <th>Producent</th>
          <th>Kategoria hurtowni</th>
          <th>Nazwa w hurtowni</th>
        </tr></thead>
        <tbody>${prices.map((pr, i) => {
          const isBest = i === 0 && pr.price_pln > 0;
          const qty = pr.stock_quantity;
          const avail = pr.availability;
          // Availability icon: green check if available or has stock, red X if explicitly unavailable, gray dash otherwise
          const availIcon = avail === 'available' || (qty != null && qty > 0)
            ? '<span style="color:#10b981">✅</span>'
            : avail === 'unavailable'
              ? '<span style="color:#f87171">❌</span>'
              : '<span style="color:#94a3b8">—</span>';
          // Stock: always show a concrete number when possible
          let stockHtml;
          if (qty != null && qty > 0) {
            const color = qty > 5 ? '#10b981' : '#f59e0b';
            stockHtml = `<span style="color:${color};font-weight:600">${qty} szt</span>`;
          } else if (qty === 0 || avail === 'unavailable') {
            stockHtml = '<span style="color:#f87171;font-weight:600">0</span>';
          } else if (avail === 'available') {
            stockHtml = '<span style="color:#10b981;font-size:.72rem">dostępny</span>';
          } else {
            stockHtml = '<span style="color:#94a3b8">—</span>';
          }
          return `<tr${isBest ? ' style="background:rgba(16,185,129,.08)"' : ''}>
            <td${isBest ? ' style="font-weight:700"' : ''}>${escHtml(pr.supplier_name)}</td>
            <td style="font-family:monospace;font-weight:700;${isBest ? 'color:#10b981' : ''}">${pr.price_pln > 0 ? pr.price_pln.toFixed(2) + ' zł' : '—'}</td>
            <td style="text-align:center">${availIcon}</td>
            <td style="text-align:right">${stockHtml}</td>
            <td style="font-size:.76rem;font-family:monospace;color:var(--text-secondary)">${escHtml(pr.sku || '—')}</td>
            <td style="font-size:.76rem">${escHtml(pr.supplier_manufacturer || '—')}</td>
            <td style="font-size:.73rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(pr.supplier_category || '')}">${escHtml(pr.supplier_category || '—')}</td>
            <td style="font-size:.73rem;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(pr.supplier_product_name || '')}">${escHtml(pr.supplier_product_name || '—')}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : '<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:.82rem">Brak danych cenowych</div>';

      // Original names
      const origNames = p.original_names || {};
      const origNamesHtml = Object.keys(origNames).length > 0 ? `<div style="max-height:120px;overflow-y:auto">
        ${Object.entries(origNames).map(([sup, name]) => `<div class="prod-info-row"><span class="prod-info-label" style="min-width:80px">${escHtml(sup)}:</span> <span style="font-size:.78rem;color:var(--text-secondary);word-break:break-all">${escHtml(name)}</span></div>`).join('')}
      </div>` : '<div style="color:var(--text-muted);font-size:.82rem">Brak danych</div>';

      // Cechy z hurtowni (supplier-specific raw attributes)
      const supplierAttributes = detail.supplierAttributes || [];
      const supplierTabsHtml = supplierAttributes.length > 0 ? `
        <div class="supplier-tabs-container" style="margin-top:16px;">
          <div style="display:flex;gap:8px;border-bottom:1px solid var(--border);margin-bottom:12px;overflow-x:auto;padding-bottom:4px;">
            ${supplierAttributes.map((sa, idx) => `
              <button class="btn btn--ghost btn--sm sup-tab-btn ${idx === 0 ? 'active' : ''}" data-sup-idx="${idx}" style="border-radius:6px 6px 0 0;border-bottom:none;background:${idx === 0 ? 'var(--bg-elevated)' : 'transparent'};color:${idx === 0 ? 'var(--text-primary)' : 'var(--text-muted)'}">${escHtml(sa.supplier_name)}</button>
            `).join('')}
          </div>
          <div class="sup-tab-content-area" style="max-height:300px;overflow-y:auto;background:var(--bg-inset);padding:12px;border-radius:6px;border:1px dashed var(--border)">
            ${supplierAttributes.map((sa, idx) => `
              <div class="sup-tab-pane" data-sup-idx="${idx}" style="display:${idx === 0 ? 'block' : 'none'}">
                ${Object.keys(sa.raw_attributes).length > 0 ? Object.entries(sa.raw_attributes).map(([k, v]) => `
                  <div style="font-size:.78rem;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.05);display:flex;justify-content:space-between">
                    <strong style="color:var(--text-primary);width:45%;padding-right:8px;word-break:break-word;">${escHtml(k)}:</strong> 
                    <span style="color:var(--text-secondary);flex:1;text-align:right;word-break:break-word;">${escHtml(String(v))}</span>
                  </div>
                `).join('') : '<div style="color:var(--text-muted);font-size:0.8rem">Brak cech z tej hurtowni.</div>'}
              </div>
            `).join('')}
          </div>
        </div>
      ` : '<div style="color:var(--text-muted);font-size:0.8rem;padding:12px;text-align:center;background:var(--bg-inset);border-radius:6px;">Brak surowych cech per hurtownia.</div>';

      const modalBody = `
        <div class="prod-detail-grid" style="width: 96vw; max-width: 1800px; margin: -10px;">
          <div class="prod-detail-section">
            <h4>📋 Informacje</h4>
            ${infoHtml}
          </div>
          <div class="prod-detail-section full-width">
            <h4>💰 Ceny hurtowni <span style="font-size:.72rem;color:var(--text-muted)">(${prices.length} ofert)</span></h4>
            ${pricesHtml}
          </div>
          <div class="prod-detail-section full-width" style="display:flex;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:350px;">
              <h4>🔧 Parametry zunifikowane (Master)${cat ? ` <span style="font-size:.72rem;color:var(--text-muted)">(${escHtml(cat.name)})</span>` : ''}</h4>
              ${attrsHtml}
            </div>
            <div style="flex:1;min-width:350px;">
              <h4>📦 Cechy per hurtownia</h4>
              ${supplierTabsHtml}
            </div>
          </div>
          <div class="prod-detail-section full-width">
            <h4>📝 Oryginalne nazwy z hurtowni</h4>
            ${origNamesHtml}
          </div>
        </div>
      `;

      const displayName = p.normalized_name || p.name || p.canonical_ean;
      Modal.show({ title: `📦 ${escHtml(displayName)}`, body: modalBody, full: true });

      // Bind tabs for supplier attributes
      document.querySelectorAll('.sup-tab-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          const idx = e.currentTarget.dataset.supIdx;
          document.querySelectorAll('.sup-tab-btn').forEach(b => {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = 'var(--text-muted)';
          });
          e.currentTarget.classList.add('active');
          e.currentTarget.style.background = 'var(--bg-elevated)';
          e.currentTarget.style.color = 'var(--text-primary)';
          document.querySelectorAll('.sup-tab-pane').forEach(pane => pane.style.display = 'none');
          const activePane = document.querySelector(`.sup-tab-pane[data-sup-idx="${idx}"]`);
          if (activePane) activePane.style.display = 'block';
        });
      });

      // Bind attr value save on Enter
      document.querySelectorAll('.prod-attr-input').forEach(input => {
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            const attrId = input.dataset.attrId;
            const catalogId = input.dataset.catalogId;
            _saveAttrValue(parseInt(catalogId), parseInt(attrId), input.closest('tr').querySelector('.prod-attr-save'));
          }
        });
      });
    } catch(e) { Toast.error(e.message); }
  }

  async function _saveAttrValue(catalogId, attrId, btn) {
    const input = document.querySelector(`.prod-attr-input[data-attr-id="${attrId}"][data-catalog-id="${catalogId}"]`);
    if (!input) return;
    try {
      await API.post(`/sourcing/catalog/product/${catalogId}/attribute`, { attrId, value: input.value });
      Toast.success('Parametr zapisany');
      if (btn) { btn.textContent = '✅'; setTimeout(() => { btn.textContent = '💾'; }, 1200); }
    } catch(e) { Toast.error(e.message); }
  }

  async function _saveInlineMfgCode(productId, inputEl) {
    const val = inputEl.value.trim();
    const original = inputEl.dataset.orig || '';
    if (val === original) return;
    try {
      inputEl.style.opacity = '0.5';
      await API.put(`/sourcing/catalog/product/${productId}/details`, { manufacturer_code: val });
      inputEl.dataset.orig = val;
      inputEl.style.opacity = '1';
      Toast.success('Zapisano kod producenta');
    } catch(e) {
      inputEl.value = original;
      inputEl.style.opacity = '1';
      Toast.error('Błąd zapisu: ' + e.message);
    }
  }

  async function _saveProdDetails(catalogId) {
    const code = document.getElementById('prod-mfg-code')?.value || '';
    const weight = parseInt(document.getElementById('prod-weight-g')?.value || '0', 10);
    try {
      await API.put(`/sourcing/catalog/product/${catalogId}/details`, { manufacturer_code: code, weight_g: weight });
      Toast.success('Zapisano dane produktu');
      renderCatalog();
    } catch(e) { Toast.error(e.message); }
  }

  async function _unifyAttributes(catalogId, btn) {
    const originalText = btn.innerHTML;
    try {
      btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;margin-right:6px"></span> AI Unifikuje...';
      btn.disabled = true;
      const res = await API.post(`/sourcing/catalog/product/${catalogId}/unify-attributes`);
      Toast.success(res.message || 'Cechy zostały pomyślnie zunifikowane!');
      // Odśwież widok szczegółów produktu
      _showProductDetails(catalogId);
    } catch (e) {
      Toast.error('Błąd unifikacji: ' + e.message);
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }


  // ─── Katalog Master Full: Filter Editor Modal ───────────────────────
  async function _editFilters(categoryId) {
    try {
      const allAttrs = await API.get(`/sourcing/catalog/categories/${categoryId}/all-attributes`);

      let body = `<div class="filter-editor-list">`;
      if (allAttrs.length === 0) {
        body += `<div style="text-align:center;padding:24px;color:var(--text-muted)">Brak parametrów w tej kategorii. Dodaj parametr poniżej.</div>`;
      } else {
        body += allAttrs.map(a => `
          <div class="filter-editor-row" data-attr-id="${a.id}">
            <input type="checkbox" class="filter-editor-cb" ${a.is_filter ? 'checked' : ''}>
            <span class="filter-editor-name">${escHtml(a.attr_name)}</span>
            <input class="filter-editor-unit-input" value="${escHtml(a.attr_unit||'')}" placeholder="Jedn." title="Jednostka (np. GB, ml, cm)">
            <span class="filter-editor-count">${a.usage_count} prod.</span>
            <button class="filter-editor-del" onclick="SourcingView._deleteAttr(${a.id}, this)">🗑️</button>
          </div>
        `).join('');
      }
      body += `</div>
        <div style="border-top:1px solid var(--border);padding:12px 0 0;margin-top:12px;display:flex;gap:8px;align-items:center">
          <input class="form-input" id="fe-new-name" placeholder="Nowy parametr..." style="flex:1;font-size:.82rem">
          <input class="form-input" id="fe-new-unit" placeholder="Jednostka" style="width:80px;font-size:.82rem">
          <button class="btn btn--ghost btn--sm" onclick="SourcingView._addNewAttr(${categoryId})">➕ Dodaj</button>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn--primary btn--sm" onclick="SourcingView._saveFilters(${categoryId})">💾 Zapisz filtry</button>
        </div>
      `;

      Modal.show({ title: `✏️ Edytor filtrów kategorii`, body });
    } catch(e) { Toast.error(e.message); }
  }

  async function _saveFilters(categoryId) {
    const rows = document.querySelectorAll('.filter-editor-row');
    const filterAttrIds = [];
    for (const row of rows) {
      const cb = row.querySelector('.filter-editor-cb');
      const unitInput = row.querySelector('.filter-editor-unit-input');
      const attrId = parseInt(row.dataset.attrId);
      if (cb && cb.checked) filterAttrIds.push(attrId);
      // Save unit changes
      if (unitInput) {
        const origUnit = unitInput.defaultValue || '';
        if (unitInput.value !== origUnit) {
          try { await API.patch(`/sourcing/catalog/categories/attributes/${attrId}`, { attr_unit: unitInput.value || null }); } catch(_) {}
        }
      }
    }
    try {
      await API.put(`/sourcing/catalog/categories/${categoryId}/filters`, { filterAttrIds });
      Toast.success(`Zapisano ${filterAttrIds.length} filtrów`);
      Modal.hide();
      catAttrFilters = {};
      renderCatalog();
    } catch(e) { Toast.error(e.message); }
  }

  async function _addNewAttr(categoryId) {
    const nameInput = document.getElementById('fe-new-name');
    const unitInput = document.getElementById('fe-new-unit');
    if (!nameInput || !nameInput.value.trim()) { Toast.error('Podaj nazwę parametru'); return; }
    try {
      const result = await API.post(`/sourcing/catalog/categories/${categoryId}/attributes`, { name: nameInput.value.trim(), unit: unitInput?.value?.trim() || null });
      if (result.success) {
        Toast.success('Parametr dodany');
        _editFilters(categoryId); // reload modal
      } else {
        Toast.error(result.message || 'Nie udało się dodać');
      }
    } catch(e) { Toast.error(e.message); }
  }

  async function _deleteAttr(attrId, btn) {
    if (!confirm('Na pewno usunąć parametr? Usunie też wartości produktów.')) return;
    try {
      await API.del(`/sourcing/catalog/categories/attributes/${attrId}`);
      Toast.success('Parametr usunięty');
      const row = btn.closest('.filter-editor-row');
      if (row) row.remove();
    } catch(e) { Toast.error(e.message); }
  }

  function _catSelectAllSup(selectAll) {
    if (selectAll) {
      const labels = document.querySelectorAll('#cat-supplier-panel .cat-supplier-cb');
      catSelectedSuppliers = Array.from(labels).map(l => l.dataset.sup).filter(Boolean);
    } else {
      catSelectedSuppliers = [];
    }
    catPage = 1;
    renderCatalog();
  }

  // ─── Modal maximize helper for custom inline modals ─────────────────────────
  function _toggleModalMax(btn) {
    const modal = btn.closest('.modal');
    if (!modal) return;
    const isMax = modal.classList.toggle('modal--maximized');
    btn.textContent = isMax ? '⧉' : '⛶';
    btn.title = isMax ? 'Przywróć rozmiar' : 'Maksymalizuj';
    if (isMax) {
      modal.style.width = '';
      modal.style.height = '';
    }
  }

  // ─── Category reorder: searchable parent dropdown helpers ──────────────────
  function _openParentDropdown(catId) {
    const dd = document.getElementById('cat-parent-' + catId + '-dd');
    if (dd) {
      dd.style.display = 'block';
      // Reset filter
      dd.querySelectorAll('.cat-parent-opt').forEach(o => o.style.display = '');
    }
  }

  function _selectParentOpt(catId, optEl) {
    const val = optEl.dataset.val;
    const name = optEl.dataset.name;
    const inp = document.getElementById('cat-parent-' + catId);
    if (inp) {
      inp.value = name;
      inp.dataset.selected = val;
    }
    const dd = document.getElementById('cat-parent-' + catId + '-dd');
    if (dd) dd.style.display = 'none';
    // Update row parent data
    const row = optEl.closest('.cat-reorder-row');
    if (row) {
      row.dataset.parent = val;
      const newDepth = val ? 1 : 0;
      row.style.paddingLeft = `${10 + newDepth * 20}px`;
    }
  }

  async function _setAbSupplier() {
    const el = document.getElementById('cat-tree-supplier-select');
    const supplierId = el ? el.value : null;
    if (!supplierId) return Toast.error('Brak wybranej hurtowni');
    
    try {
      const res = await API.post('/sourcing/catalog/mark-ab-supplier', { supplierId });
      Modal.hide();
      Toast.success(`Drzewo AB zapisane. Oznaczono ${res.marked} kategorii.`);
      catTreeData = null; // force reload tree
      renderCatalog();
    } catch(e) {
      Toast.error(e.message);
    }
  }

  /* ═══════════════════════════════════════════════════════
     TAB: EMAIL MONITOR
  ═══════════════════════════════════════════════════════ */
  async function renderEmailMonitor() {
    const el = document.getElementById('src-tab-email');
    if (!el) return;
    el.innerHTML = '<div class="sourcing-empty"><span class="empty-icon">⏳</span><p>Ładowanie wiadomości...</p></div>';
    try {
      const [res, settings] = await Promise.all([
        API.get('/email-offers/mails?limit=200'),
        API.get('/settings')
      ]);
      const mails = res.rows || [];
      
      let html = `
      <div style="display:flex; justify-content:space-between; margin-bottom:20px; align-items:center;">
        <div>
          <h2 style="margin:0; font-size:1.2rem; color:var(--text)">📬 Ostatnie wiadomości z ofertami</h2>
          <div style="color:var(--text-muted); font-size:0.85rem; margin-top:4px;">
            Pobierane z folderu IMAP · Łącznie: <b>${res.total || mails.length}</b> wiadomości
          </div>
        </div>
        <div>
          <button class="btn btn--primary" id="em-check-btn">🔄 Sprawdź teraz (Manual Sync)</button>
        </div>
      </div>
      
      <div class="em-schedule-bar" style="background:var(--bg-elevated); border:1px solid var(--border); border-radius:12px; padding:16px 20px; margin-bottom:25px; display:flex; justify-content:space-between; align-items:center; gap:20px; flex-wrap:wrap; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <div style="display:flex; align-items:center; gap:12px; min-width:280px;">
          <span style="font-size:1.5rem;">⏰</span>
          <div>
            <h3 style="margin:0; font-size:0.95rem; font-weight:600; color:var(--text)">Harmonogram pobierania</h3>
            <p style="margin:2px 0 0 0; font-size:0.8rem; color:var(--text-muted)">Automatyczne pobieranie ofert i plików z poczty e-mail</p>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap; justify-content:flex-end; flex:1;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.85rem; font-weight:500; color:var(--text)">Automatyczne pobieranie:</span>
            <label class="em-switch" style="position:relative; display:inline-block; width:44px; height:24px; cursor:pointer; vertical-align:middle; margin:0;">
              <input type="checkbox" id="em-sched-enabled" ${settings.email_monitor_enabled === '1' || settings.email_monitor_enabled === 'true' ? 'checked' : ''} style="display:none;">
              <span style="position:absolute; top:0; left:0; right:0; bottom:0; background-color:${settings.email_monitor_enabled === '1' || settings.email_monitor_enabled === 'true' ? 'var(--green)' : 'rgba(255,255,255,0.15)'}; border:1px solid var(--border); transition:.3s; border-radius:24px; display:flex; align-items:center; padding:2px;">
                <span class="em-switch-dot" style="height:18px; width:18px; border-radius:50%; background-color:#fff; transition:.3s; display:inline-block; transform:${settings.email_monitor_enabled === '1' || settings.email_monitor_enabled === 'true' ? 'translateX(20px)' : 'translateX(0px)'}; box-shadow:0 2px 4px rgba(0,0,0,0.2);"></span>
              </span>
            </label>
            <span id="em-sched-status-txt" style="font-size:0.85rem; font-weight:600; min-width:70px; color:${settings.email_monitor_enabled === '1' || settings.email_monitor_enabled === 'true' ? 'var(--green)' : 'var(--text-muted)'}">
              ${settings.email_monitor_enabled === '1' || settings.email_monitor_enabled === 'true' ? 'Aktywny' : 'Nieaktywny'}
            </span>
          </div>
          
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.85rem; font-weight:500; color:var(--text)">Częstotliwość:</span>
            <select class="form-select" id="em-sched-interval" style="padding:4px 10px; font-size:0.85rem; border-radius:6px; height:32px; width:180px; background:var(--bg-elevated); border:1px solid var(--border); color:var(--text);" ${settings.email_monitor_enabled !== '1' && settings.email_monitor_enabled !== 'true' ? 'disabled' : ''}>
              <option value="*/15 * * * *" ${settings.email_monitor_cron === '*/15 * * * *' ? 'selected' : ''}>Co 15 minut</option>
              <option value="*/30 * * * *" ${settings.email_monitor_cron === '*/30 * * * *' || !settings.email_monitor_cron ? 'selected' : ''}>Co 30 minut</option>
              <option value="0 * * * *" ${settings.email_monitor_cron === '0 * * * *' ? 'selected' : ''}>Co godzinę</option>
              <option value="0 */2 * * *" ${settings.email_monitor_cron === '0 */2 * * *' ? 'selected' : ''}>Co 2 godziny</option>
              <option value="0 */4 * * *" ${settings.email_monitor_cron === '0 */4 * * *' ? 'selected' : ''}>Co 4 godziny</option>
              <option value="0 */12 * * *" ${settings.email_monitor_cron === '0 */12 * * *' ? 'selected' : ''}>Co 12 godzin</option>
              <option value="0 0 * * *" ${settings.email_monitor_cron === '0 0 * * *' ? 'selected' : ''}>Raz dziennie (północ)</option>
            </select>
          </div>
          
          <button class="btn btn--secondary" id="em-save-sched-btn" style="height:32px; padding:0 16px; font-size:0.85rem; font-weight:600; display:inline-flex; align-items:center; gap:6px;">💾 Zapisz</button>
        </div>
      </div>`;

      if (!mails.length) {
        html += '<div class="sourcing-empty"><span class="empty-icon">📬</span><p>Brak ofert z maili w bazie. Kliknij "Sprawdź teraz" aby pobrać wiadomości ze skrzynki.</p></div>';
      } else {
        html += `
        <div class="table-wrap">
          <table class="sourcing-table" style="width:100%; font-size:0.85rem">
            <thead>
              <tr>
                <th style="width:40px">#</th>
                <th>Data odbioru</th>
                <th>Nadawca</th>
                <th>Temat</th>
                <th>Źródło</th>
                <th style="text-align:center">Produkty</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              ${mails.map(m => {
                const prodCount = (m.attachments_count || 0) > 0
                  ? m.attachments_count
                  : (m.body_products_count || 0);
                const prodLabel = prodCount > 0
                  ? `<b style="color:var(--green)">${prodCount}</b>`
                  : `<span style="color:var(--text-muted)">0</span>`;
                return `
                <tr>
                  <td style="color:var(--text-muted);font-size:0.75rem;font-family:monospace">${m.id}</td>
                  <td style="color:var(--text-muted)">${fmtDate(m.received_at)}</td>
                  <td style="font-size:0.78rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(m.from_addr)}">${escHtml(m.from_addr)}</td>
                  <td style="max-width:280px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escHtml(m.subject)}">
                    ${escHtml(m.subject)}
                  </td>
                  <td>
                    ${m.attachments_count > 0 ? `<span class="badge badge--success">📎 ${m.attachments_count} zał.</span>` : ''}
                    ${m.body_products_count > 0 ? `<span class="badge badge--google">🤖 AI</span>` : ''}
                    ${!m.attachments_count && !m.body_products_count ? '<span class="badge badge--draft">Brak</span>' : ''}
                  </td>
                  <td style="text-align:center">${prodLabel}</td>
                  <td>
                    <select class="form-select em-status-sel" data-id="${m.id}" style="padding:2px 6px; font-size:0.75rem; height:auto; width:auto">
                      <option value="pending" ${m.status==='pending'?'selected':''}>Oczekuje</option>
                      <option value="imported" ${m.status==='imported'?'selected':''}>Zaimportowano</option>
                      <option value="skipped" ${m.status==='skipped'?'selected':''}>Zignorowane</option>
                      <option value="error" ${m.status==='error'?'selected':''}>Błąd</option>
                    </select>
                  </td>
                  <td>
                    <button class="btn btn--ghost btn--sm em-preview-btn" data-id="${m.id}" title="Podgląd">👁️</button>
                    <button class="btn btn--primary btn--sm em-import-btn" data-id="${m.id}" title="Importuj do Hurtowni" ${m.status==='imported' || m.status==='empty' ? 'disabled style="opacity:0.5"' : ''}>⬇️ Import</button>
                    <button class="btn btn--ghost btn--sm em-del-btn" data-id="${m.id}" style="color:var(--red)" title="Usuń">🗑️</button>
                  </td>
                </tr>`;}).join('')}
            </tbody>
          </table>
        </div>`;
      }
      el.innerHTML = html;
      bindEmailMonitorEvents();
    } catch (e) {
      el.innerHTML = `<div class="sourcing-empty" style="color:var(--red)">❌ Błąd: ${e.message}</div>`;
    }
  }

  function bindEmailMonitorEvents() {
    // Harmonogram automatycznego pobierania
    const schedEnabledEl = document.getElementById('em-sched-enabled');
    const schedIntervalEl = document.getElementById('em-sched-interval');
    const schedStatusTxtEl = document.getElementById('em-sched-status-txt');

    if (schedEnabledEl && schedIntervalEl && schedStatusTxtEl) {
      schedEnabledEl.addEventListener('change', (e) => {
        const active = e.target.checked;
        schedIntervalEl.disabled = !active;
        const dot = schedEnabledEl.nextElementSibling?.querySelector('.em-switch-dot');
        const bg = schedEnabledEl.nextElementSibling;
        if (active) {
          schedStatusTxtEl.textContent = 'Aktywny';
          schedStatusTxtEl.style.color = 'var(--green)';
          if (dot) dot.style.transform = 'translateX(20px)';
          if (bg) bg.style.backgroundColor = 'var(--green)';
        } else {
          schedStatusTxtEl.textContent = 'Nieaktywny';
          schedStatusTxtEl.style.color = 'var(--text-muted)';
          if (dot) dot.style.transform = 'translateX(0px)';
          if (bg) bg.style.backgroundColor = 'rgba(255,255,255,0.15)';
        }
      });
    }

    document.getElementById('em-save-sched-btn')?.addEventListener('click', async (e) => {
      const btn = e.target;
      const enabled = schedEnabledEl?.checked ? '1' : '0';
      const cron = schedIntervalEl?.value || '*/30 * * * *';
      
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '⏳ Zapisywanie...';
      
      try {
        await API.post('/settings', {
          email_monitor_enabled: enabled,
          email_monitor_cron: cron
        });
        Toast.success('Zapisano harmonogram automatycznego pobierania!');
        btn.textContent = '✅ Zapisano';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = originalText;
        }, 1500);
      } catch (err) {
        Toast.error('Błąd zapisu: ' + err.message);
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    // Check manual
    document.getElementById('em-check-btn')?.addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true; btn.textContent = '🔄 Pobieranie maili... (może potrwać)';
      try {
        const res = await API.post('/email-offers/check', {});
        Toast.success(`Sprawdzanie zakończone. Pobrano: ${res.imported}, Duplikaty: ${res.duplicates}`);
        renderEmailMonitor();
      } catch(err) {
        Toast.error(err.message);
        btn.disabled = false; btn.textContent = '🔄 Sprawdź teraz (Manual Sync)';
      }
    });

    // Delete
    document.querySelectorAll('.em-del-btn').forEach(b => b.addEventListener('click', async (e) => {
      if (!confirm('Na pewno usunąć ten zapis z bazy?')) return;
      try {
        await API.del(`/email-offers/mails/${e.currentTarget.dataset.id}`);
        Toast.success('Usunięto');
        renderEmailMonitor();
      } catch(err) { Toast.error(err.message); }
    }));

    // Status change
    document.querySelectorAll('.em-status-sel').forEach(s => s.addEventListener('change', async (e) => {
      try {
        await API.patch(`/email-offers/mails/${e.target.dataset.id}/status`, { status: e.target.value });
        Toast.success('Status zaktualizowany');
      } catch(err) { Toast.error(err.message); }
    }));

    // Preview
    document.querySelectorAll('.em-preview-btn').forEach(b => b.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      try {
        const mail = await API.get(`/email-offers/mails/${id}`);
        const prods = mail.products || [];
        Modal.show({
          title: `Podgląd Produktów: ${mail.subject}`,
          body: `
            <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">Znaleziono: <b style="color:var(--text)">${prods.length}</b> produktów</div>
            <div class="table-wrap" style="max-height:60vh; overflow:auto">
              <table class="sourcing-table" style="width:100%; font-size:0.8rem">
                <thead><tr><th>#</th><th>Indeks/SKU</th><th>Nazwa</th><th>EAN</th><th>Cena netto</th><th>Ilość</th><th>Źródło</th></tr></thead>
                <tbody>
                  ${prods.map((p, idx) => `
                    <tr>
                      <td style="color:var(--text-muted);font-size:0.72rem">${idx + 1}</td>
                      <td><code style="font-size:0.72rem">${escHtml(p.sku || '—')}</code></td>
                      <td style="max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(p.name)}">${escHtml(p.name || '—')}</td>
                      <td><code style="font-size:0.72rem">${escHtml(p.ean || '—')}</code></td>
                      <td style="color:var(--green);font-weight:600">${typeof p.price === 'number' ? p.price.toFixed(2) + ' zł' : '—'}</td>
                      <td style="font-weight:600">${p.qty ?? '—'}</td>
                      <td style="color:var(--text-muted); font-size:0.7rem">${escHtml(p.source || '')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ${prods.length===0 ? '<div style="padding:20px;text-align:center;color:var(--text-muted)">Brak produktów do wyświetlenia</div>' : ''}
          `
        });
      } catch(err) { Toast.error(err.message); }
    }));

    // Import
    document.querySelectorAll('.em-import-btn').forEach(b => b.addEventListener('click', async (e) => {
      const mailId = e.currentTarget.dataset.id;
      try {
        const suppliersReq = await API.get('/sourcing/suppliers');
        const suppliers = suppliersReq.filter(s => s.status !== 'archive');
        
        let selectHtml = `<select id="em-import-supplier-sel" class="form-select" style="width:100%; margin-bottom:15px">
          <option value="">-- Wybierz hurtownię --</option>
          ${suppliers.map(s => `<option value="${s.id}">${escHtml(s.name)} (ID: ${s.id})</option>`).join('')}
        </select>`;

        Modal.show({
          title: 'Importuj produkty z Maila',
          body: `
            <div style="margin-bottom:10px">Wybierz do której hurtowni zaimportować produkty z tego maila. Jeśli hurtownia nie istnieje, najpierw utwórz ją w zakładce Hurtownie (np. typ Plik lub API).</div>
            ${selectHtml}
          `,
          footer: `
            <button class="btn btn--ghost" onclick="Modal.hide()">Anuluj</button>
            <button class="btn btn--primary" id="em-import-confirm-btn">🚀 Uruchom Import</button>
          `
        });

        document.getElementById('em-import-confirm-btn').addEventListener('click', async () => {
          const sId = document.getElementById('em-import-supplier-sel').value;
          if (!sId) return Toast.error('Wybierz hurtownię');
          
          setBtn('em-import-confirm-btn', true);
          try {
            const res = await API.post(`/email-offers/mails/${mailId}/import`, { supplier_id: sId });
            Toast.success(`Pomyślnie zaimportowano ${res.imported} z ${res.total} produktów.`);
            Modal.hide();
            renderEmailMonitor();
          } catch(err) {
            Toast.error(err.message);
          } finally {
            setBtn('em-import-confirm-btn', false);
          }
        });

      } catch(err) { Toast.error('Błąd pobierania listy hurtowni: ' + err.message); }
    }));
  }

  async function renderManufacturerManagerModal() {
    try {
      const res = await API.get('/sourcing/suppliers/manufacturers');
      const mfgs = Array.isArray(res) ? res : res.manufacturers || [];
      
      const bodyHtml = `
        <div style="display:flex;flex-direction:column;gap:12px;max-height:70vh;">
          <div style="background:var(--bg-elevated);padding:15px;border-radius:8px;border:1px solid var(--border);">
            <h4 style="margin:0 0 10px 0;font-size:0.9rem">Narzędzie scalania producentów</h4>
            <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 12px 0;">Zaznacz z listy poniżej błędne/zduplikowane nazwy (np. "Hewlett-Packard", "wenger"), a następnie wpisz docelową poprawną nazwę i kliknij Scal.</p>
            
            <div style="display:flex;gap:8px;align-items:flex-end">
              <div style="flex:1">
                <label class="form-label">Nazwa docelowa (kanoniczna)</label>
                <input type="text" id="mfg-target-name" class="form-input" placeholder="Wpisz poprawną nazwę..." list="mfg-datalist">
                <datalist id="mfg-datalist">
                  ${mfgs.map(m => `<option value="${escHtml(m)}">`).join('')}
                </datalist>
              </div>
              <button class="btn btn--primary" id="mfg-merge-btn" style="white-space:nowrap">🔗 Scal zaznaczonych</button>
            </div>
          </div>
          
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:5px;">
            <div style="font-weight:600;font-size:0.85rem">Wszyscy producenci w bazie: <span id="mfg-count" style="color:var(--text-muted)">${mfgs.length}</span></div>
            <input type="text" id="mfg-search" class="form-input" placeholder="Szukaj na liście..." style="width:200px;padding:4px 8px;font-size:0.8rem">
          </div>
          
          <div style="overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);flex:1">
            <table class="sourcing-table" style="width:100%;margin:0">
              <thead>
                <tr>
                  <th style="width:40px;text-align:center"><input type="checkbox" id="mfg-check-all"></th>
                  <th>Nazwa Producenta</th>
                </tr>
              </thead>
              <tbody id="mfg-list-body">
                ${mfgs.map(m => `
                  <tr class="mfg-row">
                    <td style="text-align:center"><input type="checkbox" class="mfg-cb" value="${escHtml(m)}"></td>
                    <td class="mfg-name-cell">${escHtml(m)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${mfgs.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text-muted)">Brak producentów w bazie.</div>' : ''}
          </div>
        </div>
      `;

      Modal.show({
        title: 'Zarządzanie Producentami',
        body: `<div style="width: 100%; height: 100%; margin: -10px;">${bodyHtml}</div>`,
        full: true
      });

      // Search filter
      document.getElementById('mfg-search')?.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        let visibleCount = 0;
        document.querySelectorAll('.mfg-row').forEach(row => {
          const name = row.querySelector('.mfg-name-cell').textContent.toLowerCase();
          const match = name.includes(q);
          row.style.display = match ? '' : 'none';
          if (match) visibleCount++;
        });
        document.getElementById('mfg-count').textContent = visibleCount;
      });

      // Check all visible
      document.getElementById('mfg-check-all')?.addEventListener('change', e => {
        const checked = e.target.checked;
        document.querySelectorAll('.mfg-row').forEach(row => {
          if (row.style.display !== 'none') {
            const cb = row.querySelector('.mfg-cb');
            if (cb) cb.checked = checked;
          }
        });
      });

      // Merge action
      document.getElementById('mfg-merge-btn')?.addEventListener('click', async () => {
        const targetName = document.getElementById('mfg-target-name').value.trim();
        if (!targetName) return Toast.error('Wpisz nazwę docelową!');
        
        const checkedCbs = Array.from(document.querySelectorAll('.mfg-cb:checked'));
        if (checkedCbs.length === 0) return Toast.error('Zaznacz co najmniej jednego producenta do scalenia!');
        
        const aliases = checkedCbs.map(cb => cb.value);
        
        if (!confirm(`Czy na pewno chcesz scalić ${aliases.length} zaznaczonych producentów do nazwy "${targetName}"?\nTa operacja zaktualizuje wszystkie powiązane produkty w bazie.`)) return;
        
        setBtn('mfg-merge-btn', true);
        try {
          const res = await API.post('/sourcing/manufacturers/merge', { aliases, canonical_name: targetName });
          Toast.success(`Zaktualizowano ${res.productsUpdated} produktów hurtowni oraz ${res.catalogUpdated} z Katalogu Master.`);
          // Reload modal to reflect changes
          renderManufacturerManagerModal();
        } catch (err) {
          Toast.error(err.message);
          setBtn('mfg-merge-btn', false);
        }
      });
      
    } catch (err) {
      Toast.error('Błąd ładowania producentów: ' + err.message);
    }
  }

  let amCatId = null;
  let amSupId = null;
  let amSearch = '';
  let amShowUnmapped = false;
  let amOnlyAvailable = true; // default to filtering out unavailable products
  let amData = { mapped: [], unmapped: [] };
  let amSortCol = 'canonical_name'; // default sort by name
  let amSortAsc = true;
  let amPage = 0;
  const AM_PAGE_SIZE = 100;
  let amActiveTab = 'all'; // 'all' or 'suggest'
  let amSuggestions = [];

  async function renderAttrManagerModal() {
    Modal.show({ title: '⚙️ Menedżer Cech', body: '<div style="padding:40px;text-align:center;min-width:600px;">Ładowanie danych...</div>', full: true });
    await _reloadAttrManagerData();
  }

  async function _reloadAttrManagerData() {
    try {
      const q = new URLSearchParams();
      if (amCatId) q.append('categoryId', amCatId);
      if (amSupId) q.append('supplierId', amSupId);
      if (amOnlyAvailable) q.append('onlyAvailable', 'true');
      
      const [listData, suggestData] = await Promise.all([
        API.get(`/sourcing/attrs/manager/list?${q.toString()}`),
        API.get('/sourcing/attrs/manager/suggest')
      ]);
      
      amData = listData;
      amSuggestions = suggestData;
      _buildAttrManagerUI();
    } catch(e) { Toast.error(e.message); }
  }

  async function _buildAttrManagerUI() {
    const dbSups = await API.get('/sourcing/catalog/suppliers');
    const supOpts = '<option value="">Wszystkie hurtownie</option>' + dbSups.map(s => `<option value="${s.id}" ${amSupId == s.id ? 'selected' : ''}>${escHtml(s.name)}</option>`).join('');

    const leftPanel = `
      <div style="width:300px;border-right:1px solid var(--border);display:flex;flex-direction:column;gap:14px;padding-right:16px;flex-shrink:0;">
        <h3 style="margin:0;font-size:1.1rem">Filtry</h3>
        <div>
          <label class="form-label" style="font-size:0.8rem">Wyszukaj cechę</label>
          <input type="text" id="am-search-input" class="form-input" placeholder="Wpisz nazwę..." value="${escHtml(amSearch)}" autocomplete="off">
        </div>
        <div style="display:flex;flex-direction:column;">
          <label class="form-label" style="font-size:0.8rem;display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span>Kategoria</span>
            <input type="text" id="am-cat-filter" placeholder="Szukaj..." class="form-input" style="width:110px;font-size:0.75rem;padding:3px 6px;height:auto">
          </label>
          <select id="am-cat-select" class="form-select" size="8" style="height:150px;font-size:0.8rem;padding:4px">
            <option value="">Wszystkie kategorie</option>
            ${window.catTreeData ? _flattenTreeOpts(window.catTreeData.tree, amCatId) : ''}
          </select>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;line-height:1.4">Wybierz kategorię aby edytować jednostki miary.</div>
        </div>
        <div>
          <label class="form-label" style="font-size:0.8rem">Hurtownia</label>
          <select id="am-sup-select" class="form-select">${supOpts}</select>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;margin-top:6px">
          <input type="checkbox" id="am-only-available-cb" ${amOnlyAvailable ? 'checked' : ''}> Pokaż tylko z dostępnych produktów
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;margin-top:6px">
          <input type="checkbox" id="am-unmapped-cb" ${amShowUnmapped ? 'checked' : ''}> Pokaż tylko niescalone (surowe)
        </label>
      </div>
    `;

    const rightPanel = `
      <div style="flex:1;display:flex;flex-direction:column;min-width:0;padding-left:4px;">
        
        <style>
          .am-suggest-item:hover {
            background: var(--bg-card) !important;
            border-color: var(--accent) !important;
            outline: 1px solid var(--accent);
          }
          .suggestion-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(0,0,0,0.06) !important;
            border-color: var(--accent) !important;
          }
          .suggestion-card {
            transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s !important;
          }
        </style>

        <!-- Tab selector -->
        <div class="am-tabs-header" style="display:flex;gap:8px;margin-bottom:12px;background:var(--bg-inset);padding:6px;border-radius:8px;border:1px solid var(--border);align-self:flex-start;">
          <button id="am-tab-all" style="padding:6px 16px;font-size:0.85rem;font-weight:600;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s ease;
            background:${amActiveTab === 'all' ? 'var(--accent)' : 'transparent'};
            color:${amActiveTab === 'all' ? '#fff' : 'var(--text-muted)'};">
            📋 Wszystkie cechy
          </button>
          <button id="am-tab-suggest" style="padding:6px 16px;font-size:0.85rem;font-weight:600;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s ease;
            background:${amActiveTab === 'suggest' ? 'var(--accent)' : 'transparent'};
            color:${amActiveTab === 'suggest' ? '#fff' : 'var(--text-muted)'};">
            💡 Inteligentne Sugestie
          </button>
        </div>

        <!-- Content Area: All Features -->
        <div id="am-tab-content-all" style="display:${amActiveTab === 'all' ? 'flex' : 'none'};flex-direction:column;flex:1;min-height:0;">
          <div id="am-row-count" style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;padding:0 2px"></div>
          <div style="flex:1;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg-card)">
            <table class="sourcing-table attr-mgr-table" style="width:100%;table-layout:fixed">
              <thead style="position:sticky;top:0;background:var(--bg-elevated);z-index:2">
                <tr>
                  <th style="width:40px;text-align:center;position:relative"><input type="checkbox" id="am-cb-all"></th>
                  <th class="am-sort-th" data-col="canonical_name" style="width:22%;cursor:pointer;user-select:none;position:relative">Nazwa <span id="am-sort-ind-name">↕</span><div class="col-resizer"></div></th>
                  <th style="width:24%;position:relative">Surowe nazwy z pliku<div class="col-resizer"></div></th>
                  <th class="am-sort-th" data-col="usage_count" style="width:13%;cursor:pointer;user-select:none;position:relative">Użycie <span id="am-sort-ind-usage">↕</span><div class="col-resizer"></div></th>
                  <th class="am-sort-th" data-col="units" style="width:10%;cursor:pointer;user-select:none;position:relative">Jedn. <span id="am-sort-ind-units">↕</span><div class="col-resizer"></div></th>
                  <th style="width:11%;position:relative">Status<div class="col-resizer"></div></th>
                  <th style="width:10%;position:relative">Akcje</th>
                </tr>
              </thead>
              <tbody id="am-tbody"></tbody>
            </table>
          </div>
          <div id="am-pagination" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap"></div>
          <div id="am-merge-panel" style="display:none;margin-top:14px;padding:14px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:8px;align-items:center;gap:14px">
            <div style="font-weight:600;color:var(--accent)"><span id="am-merge-count">0</span> wybranych</div>
            <div style="flex:1"><input type="text" id="am-merge-target" class="form-input" placeholder="Docelowa nazwa (np. Szerokość)"></div>
            <button class="btn btn--primary" id="am-btn-merge">🔗 Scal</button>
          </div>
        </div>

        <!-- Content Area: Suggestions -->
        <div id="am-tab-content-suggest" style="display:${amActiveTab === 'suggest' ? 'flex' : 'none'};flex-direction:column;flex:1;overflow-y:auto;min-height:0;">
          <div id="am-suggest-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(360px, 1fr));gap:16px;padding:4px 2px;"></div>
        </div>

      </div>
    `;

    const bodyHtml = `<div class="attr-mgr-layout" style="display:flex;height:82vh;min-height:600px;width:100%;gap:16px;margin:-10px;">${leftPanel}${rightPanel}</div>`;
    Modal.show({ title: '⚙️ Menedżer Cech', body: bodyHtml, full: true });

    if (amActiveTab === 'all') {
      _renderAttrRows();
    } else {
      _renderSuggestions();
    }
    bindColResizers(document.querySelector('.attr-mgr-table'));

    // ── Bind events ──────────────────────────────────────────────────────────
    document.getElementById('am-search-input')?.addEventListener('input', e => {
      amSearch = e.target.value;
      amPage = 0;
      _renderAttrRows();
    });
    document.getElementById('am-cat-select')?.addEventListener('change', e => { amCatId = e.target.value; amPage = 0; _reloadAttrManagerData(); });
    document.getElementById('am-sup-select')?.addEventListener('change', e => { amSupId = e.target.value; amPage = 0; _reloadAttrManagerData(); });
    document.getElementById('am-unmapped-cb')?.addEventListener('change', e => { amShowUnmapped = e.target.checked; amPage = 0; _renderAttrRows(); });
    document.getElementById('am-only-available-cb')?.addEventListener('change', e => { amOnlyAvailable = e.target.checked; amPage = 0; _reloadAttrManagerData(); });

    // Tab switching event handlers
    const tabAllBtn = document.getElementById('am-tab-all');
    const tabSuggestBtn = document.getElementById('am-tab-suggest');
    const contentAll = document.getElementById('am-tab-content-all');
    const contentSuggest = document.getElementById('am-tab-content-suggest');

    if (tabAllBtn && tabSuggestBtn) {
      tabAllBtn.addEventListener('click', () => {
        amActiveTab = 'all';
        tabAllBtn.style.background = 'var(--accent)';
        tabAllBtn.style.color = '#fff';
        tabSuggestBtn.style.background = 'transparent';
        tabSuggestBtn.style.color = 'var(--text-muted)';
        contentAll.style.display = 'flex';
        contentSuggest.style.display = 'none';
        _renderAttrRows();
      });

      tabSuggestBtn.addEventListener('click', () => {
        amActiveTab = 'suggest';
        tabSuggestBtn.style.background = 'var(--accent)';
        tabSuggestBtn.style.color = '#fff';
        tabAllBtn.style.background = 'transparent';
        tabAllBtn.style.color = 'var(--text-muted)';
        contentAll.style.display = 'none';
        contentSuggest.style.display = 'flex';
        _renderSuggestions();
      });
    }

    document.querySelectorAll('.am-sort-th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (amSortCol === col) amSortAsc = !amSortAsc;
        else { amSortCol = col; amSortAsc = true; }
        amPage = 0;
        _renderAttrRows();
      });
    });

    document.getElementById('am-cat-filter')?.addEventListener('input', e => {
      const q2 = e.target.value.toLowerCase();
      document.querySelectorAll('#am-cat-select option').forEach(opt => {
        if (!opt.value) return;
        opt.style.display = opt.textContent.toLowerCase().includes(q2) ? '' : 'none';
      });
    });

    document.getElementById('am-btn-merge')?.addEventListener('click', async () => {
      const cbs = document.querySelectorAll('.am-cb:checked');
      const selected = Array.from(cbs).map(c => c.value);
      const target = document.getElementById('am-merge-target').value.trim();
      if (!target) return Toast.error('Podaj nazwę docelową');
      if (selected.length === 0) return;
      if (!confirm(`Na pewno scalić ${selected.length} cech w jedną: "${target}"?`)) return;
      try {
        await API.post('/sourcing/attrs/manager/merge', { aliases: selected, canonical_name: target });
        Toast.success('Cechy zostały scalone');
        _reloadAttrManagerData();
      } catch(e) { Toast.error(e.message); }
    });
  }

  // ── Lekka funkcja — aktualizuje tylko tbody i licznik, NIE niszczy modala ──
  function _renderAttrRows() {
    const tbody = document.getElementById('am-tbody');
    const rowCountEl = document.getElementById('am-row-count');
    if (!tbody) return;

    // Update sort indicators
    const sortMap = { canonical_name: 'am-sort-ind-name', usage_count: 'am-sort-ind-usage', units: 'am-sort-ind-units' };
    for (const [col, id] of Object.entries(sortMap)) {
      const el = document.getElementById(id);
      if (el) el.textContent = amSortCol === col ? (amSortAsc ? '↑' : '↓') : '↕';
    }

    const q = amSearch.toLowerCase();
    let rows = [];
    let totalCount = 0;
    let mappedCount = 0;
    let unmappedCount = 0;

    // Combine mapped + unmapped into one list
    const allItems = [
      ...amData.mapped.map(a => ({ ...a, is_mapped: true })),
      ...amData.unmapped.map(a => ({ ...a, is_mapped: false, canonical_name: a.alias || a.canonical_name, usage_count: 0 }))
    ];

    let filtered = allItems.filter(a => {
      const name = (a.canonical_name || '').toLowerCase();
      const aliases = (a.aliases || '').toLowerCase();
      if (!name.includes(q) && !aliases.includes(q)) return false;
      if (amShowUnmapped && a.is_mapped) return false; // filter mode: only unmapped
      return true;
    });

    filtered.sort((a, b) => {
      let av, bv;
      if (amSortCol === 'usage_count') { av = a.usage_count || 0; bv = b.usage_count || 0; }
      else if (amSortCol === 'units') { av = a.units || ''; bv = b.units || ''; }
      else { av = a.canonical_name || ''; bv = b.canonical_name || ''; }
      // Always put unmapped at bottom unless sorting explicitly
      if (amSortCol === 'canonical_name') {
        if (a.is_mapped !== b.is_mapped) return a.is_mapped ? -1 : 1;
      }
      if (typeof av === 'string') return amSortAsc ? av.localeCompare(bv, 'pl') : bv.localeCompare(av, 'pl');
      return amSortAsc ? av - bv : bv - av;
    });

    totalCount = filtered.length;
    mappedCount = filtered.filter(a => a.is_mapped).length;
    unmappedCount = filtered.filter(a => !a.is_mapped).length;

    // Pagination
    const totalPages = Math.ceil(totalCount / AM_PAGE_SIZE);
    if (amPage >= totalPages && amPage > 0) amPage = Math.max(0, totalPages - 1);
    const pageStart = amPage * AM_PAGE_SIZE;
    const pageEnd = Math.min(pageStart + AM_PAGE_SIZE, totalCount);
    const paginated = filtered.slice(pageStart, pageEnd);

    rows = paginated.map(a => {
      const rawList = a.aliases ? a.aliases.split(',').slice(0,3).join(', ') + (a.aliases.split(',').length > 3 ? '…' : '') : (a.is_mapped ? '—' : a.canonical_name);
      let unitHtml = a.units ? escHtml(a.units) : '—';
      if (amCatId && a.is_mapped) unitHtml = '<input type="text" class="form-input am-unit-input" style="width:55px;padding:2px 4px;font-size:0.8rem;text-align:center" data-attr="' + escHtml(a.canonical_name) + '" value="' + (a.units||'') + '" placeholder="Brak">';

      let usageBadge;
      let rawCountToUse = a.raw_count > 0 ? a.raw_count : (a.count || 0);
      if (!a.is_mapped) {
        usageBadge = '<span style="color:var(--text-muted);font-size:.8rem">' + rawCountToUse + ' wyst.</span>';
      } else if (rawCountToUse > 0) {
        usageBadge = '<span style="font-weight:700;color:#10b981">' + rawCountToUse + '</span> <span style="font-size:.7rem;color:var(--text-muted)">prod.</span>';
      } else if (a.usage_count > 0) {
        usageBadge = '<span style="font-weight:700;color:#10b981">' + a.usage_count + '</span> <span style="font-size:.7rem;color:var(--text-muted)">kat.</span>';
      } else {
        usageBadge = '<span style="color:var(--text-muted);font-size:.8rem" title="Cecha znana w schemacie kategorii, ale żaden produkt nie ma jeszcze tej wartości">0 <span style="font-size:.65rem">(schemat)</span></span>';
      }

      const statusBadge = a.is_mapped
        ? '<span style="font-size:.7rem;background:rgba(16,185,129,.15);color:#10b981;padding:2px 6px;border-radius:4px;white-space:nowrap">✓ zmapowana</span>'
        : '<span style="font-size:.7rem;background:rgba(245,158,11,.15);color:#f59e0b;padding:2px 6px;border-radius:4px;white-space:nowrap" title="Ta cecha nie ma jeszcze przypisanej nazwy kanonicznej">⚠ niescalona</span>';

      const rowStyle = a.is_mapped ? '' : 'background:rgba(245,158,11,.04);';
      return '<tr class="am-row" style="' + rowStyle + '">' +
        '<td style="width:40px;text-align:center"><input type="checkbox" class="am-cb" value="' + escHtml(a.canonical_name) + '"></td>' +
        '<td style="font-weight:600' + (a.is_mapped ? '' : ';color:var(--text-muted);font-style:italic') + '">' + escHtml(a.canonical_name) + '</td>' +
        '<td style="font-family:monospace;font-size:0.8rem;color:var(--text-muted)" title="' + escHtml(a.aliases||'') + '">' + escHtml(rawList) + '</td>' +
        '<td>' + usageBadge + '</td>' +
        '<td>' + unitHtml + '</td>' +
        '<td>' + statusBadge + '</td>' +
        "<td><button class='btn btn--ghost btn--sm' onclick='SourcingView._amShowDetails(" + JSON.stringify(a.canonical_name).replace(/'/g, "&#39;") + ")'>Podgląd</button></td>" +
        '</tr>';
    });

    tbody.innerHTML = rows.join('') || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">' + (amShowUnmapped ? '✅ Brak niescalonych cech!' : '🔍 Brak wyników.') + '</td></tr>';

    if (rowCountEl) rowCountEl.innerHTML = 'Łącznie: <strong style="color:var(--text-primary)">' + totalCount + '</strong> | <span style="color:#10b981">✓ ' + mappedCount + ' zmapowanych</span> | <span style="color:#f59e0b">⚠ ' + unmappedCount + ' niescalonych</span> | Strona ' + (amPage + 1) + '/' + (totalPages || 1) + ' (' + (pageStart + 1) + '–' + pageEnd + ' z ' + totalCount + ')';

    // Render pagination controls
    const paginEl = document.getElementById('am-pagination');
    if (paginEl) {
      if (totalPages <= 1) {
        paginEl.innerHTML = '';
      } else {
        const btnStyle = 'padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg-elevated);cursor:pointer;font-size:0.82rem;color:var(--text-primary)';
        const activeBtnStyle = 'padding:4px 10px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);cursor:pointer;font-size:0.82rem;color:#fff;font-weight:700';
        let html = '<button style="' + btnStyle + '" id="am-pg-prev" ' + (amPage === 0 ? 'disabled' : '') + '>&#8249; Poprz.</button>';
        const windowSize = 5;
        let startPage = Math.max(0, amPage - 2);
        let endPage = Math.min(totalPages, startPage + windowSize);
        if (endPage - startPage < windowSize) startPage = Math.max(0, endPage - windowSize);
        if (startPage > 0) html += '<button style="' + btnStyle + '" class="am-pg-btn" data-p="0">1</button><span style="color:var(--text-muted);padding:0 4px">…</span>';
        for (let p = startPage; p < endPage; p++) {
          html += '<button style="' + (p === amPage ? activeBtnStyle : btnStyle) + '" class="am-pg-btn" data-p="' + p + '">' + (p + 1) + '</button>';
        }
        if (endPage < totalPages) html += '<span style="color:var(--text-muted);padding:0 4px">…</span><button style="' + btnStyle + '" class="am-pg-btn" data-p="' + (totalPages - 1) + '">' + totalPages + '</button>';
        html += '<button style="' + btnStyle + '" id="am-pg-next" ' + (amPage >= totalPages - 1 ? 'disabled' : '') + '>Nast. &#8250;</button>';
        html += '<span style="font-size:0.78rem;color:var(--text-muted);margin-left:8px">Po 100 na stronie</span>';
        paginEl.innerHTML = html;

        document.getElementById('am-pg-prev')?.addEventListener('click', () => { amPage--; _renderAttrRows(); });
        document.getElementById('am-pg-next')?.addEventListener('click', () => { amPage++; _renderAttrRows(); });
        document.querySelectorAll('.am-pg-btn').forEach(btn => {
          btn.addEventListener('click', () => { amPage = parseInt(btn.dataset.p); _renderAttrRows(); });
        });
      }
    }

    // Re-bind unit inputs (new elements after innerHTML update)
    document.querySelectorAll('.am-unit-input').forEach(inp => {
      inp.addEventListener('change', async e => {
        if (!amCatId) return;
        try {
          await API.patch('/sourcing/attrs/manager/unit', { categoryId: amCatId, attrName: e.target.dataset.attr, unit: e.target.value.trim() });
          Toast.success('Zapisano jednostkę miary');
        } catch(err) { Toast.error(err.message); }
      });
    });

    // Re-bind checkboxes
    const mergePanel = document.getElementById('am-merge-panel');
    const mergeCount = document.getElementById('am-merge-count');
    const cbAll = document.getElementById('am-cb-all');
    const cbs = document.querySelectorAll('.am-cb');

    function updateMergePanel() {
      const selected = Array.from(document.querySelectorAll('.am-cb:checked'));
      if (selected.length > 0) {
        mergePanel.style.display = 'flex';
        mergeCount.textContent = selected.length;
        const targetEl = document.getElementById('am-merge-target');
        if (selected.length === 1 && targetEl && !targetEl.value) targetEl.value = selected[0].value;
      } else {
        mergePanel.style.display = 'none';
      }
    }

    if (cbAll) {
      cbAll.onchange = e => { document.querySelectorAll('.am-cb').forEach(c => c.checked = e.target.checked); updateMergePanel(); };
    }
    cbs.forEach(c => c.addEventListener('change', updateMergePanel));
  }

  function _renderSuggestions() {
    const grid = document.getElementById('am-suggest-grid');
    if (!grid) return;

    if (!amSuggestions || amSuggestions.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:64px 24px;background:var(--bg-card);border:1px dashed var(--border);border-radius:12px;margin:10px 0;">
          <span style="font-size:3rem;display:block;margin-bottom:12px;">🎉</span>
          <h3 style="margin:0 0 6px 0;font-size:1.15rem;font-weight:700;color:var(--text-primary)">Wszystkie cechy są idealnie uporządkowane!</h3>
          <p style="color:var(--text-muted);font-size:0.85rem;margin:0;max-width:400px;margin:0 auto;line-height:1.4">Silnik analizy semantycznej nie znalazł żadnych surowych cech kwalifikujących się do automatycznego scalenia.</p>
        </div>
      `;
      return;
    }

    function getIconForCanonical(canonicalName) {
      if (canonicalName.includes('kabla')) return '🔌';
      if (canonicalName.includes('Długość')) return '📏';
      if (canonicalName.includes('Szerokość')) return '📐';
      if (canonicalName.includes('Wysokość')) return '🔼';
      if (canonicalName.includes('Głębokość')) return '🔽';
      if (canonicalName.includes('Waga')) return '⚖️';
      if (canonicalName.includes('Moc')) return '⚡';
      return '💡';
    }

    const cards = amSuggestions.map((group, groupIdx) => {
      const candidatesHtml = group.candidates.map((cand, candIdx) => {
        const uniqueId = `am-sug-cb-${groupIdx}-${candIdx}`;
        return `
          <label style="display:flex;align-items:center;gap:10px;font-size:0.8rem;padding:8px 10px;border-radius:6px;background:var(--bg-inset);cursor:pointer;transition:background 0.15s;margin-bottom:4px;" class="am-suggest-item">
            <input type="checkbox" class="am-suggest-cb" data-canonical="${escHtml(group.canonical_name)}" value="${escHtml(cand.name)}" checked id="${uniqueId}">
            <span style="flex:1;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-primary)" title="${escHtml(cand.name)}">
              ${escHtml(cand.name)}
            </span>
            <button type="button" class="btn-sug-preview" onclick="event.stopPropagation(); event.preventDefault(); SourcingView._amShowDetails(this.dataset.attr);" data-attr="${escHtml(cand.name)}" style="background:none;border:none;padding:2px 6px;cursor:pointer;font-size:0.85rem;color:var(--accent);display:inline-flex;align-items:center;justify-content:center;border-radius:4px;transition:background 0.2s;" onmouseover="this.style.background='rgba(99,102,241,0.15)'" onmouseout="this.style.background='none'" title="Podgląd produktów">
              🔎
            </button>
            <span style="background:var(--border);color:var(--text-muted);font-weight:700;font-size:0.72rem;padding:2px 6px;border-radius:4px;flex-shrink:0;">
              ${cand.usage_count} wyst.
            </span>
          </label>
        `;
      }).join('');

      return `
        <div class="suggestion-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 4px 10px rgba(0,0,0,0.03);position:relative;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:10px;">
            <h4 style="margin:0;font-size:0.92rem;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:6px;">
              ${getIconForCanonical(group.canonical_name)} ${escHtml(group.canonical_name)}
            </h4>
            <span style="font-size:0.72rem;background:rgba(99,102,241,0.1);color:var(--accent);padding:2px 8px;border-radius:12px;font-weight:700;flex-shrink:0;">
              ${group.candidates.length} cech
            </span>
          </div>
          
          <div style="flex:1;max-height:220px;overflow-y:auto;padding-right:2px;margin-bottom:8px;">
            ${candidatesHtml}
          </div>
          
          <button class="btn btn--primary btn--sm am-btn-suggest-merge" data-canonical="${escHtml(group.canonical_name)}" style="width:100%;margin-top:auto;display:flex;justify-content:center;align-items:center;gap:6px;font-weight:600;padding:8px;">
            🔗 Scal wybrane do: ${escHtml(group.canonical_name.split(' ')[0])}
          </button>
        </div>
      `;
    });

    grid.innerHTML = cards.join('');

    // Bind event handlers for suggestions cards merges
    document.querySelectorAll('.am-btn-suggest-merge').forEach(btn => {
      btn.addEventListener('click', async e => {
        const canonical = btn.dataset.canonical;
        const card = btn.closest('.suggestion-card');
        const checkedCbs = card.querySelectorAll('.am-suggest-cb:checked');
        const selected = Array.from(checkedCbs).map(cb => cb.value);

        if (selected.length === 0) {
          return Toast.error('Zaznacz przynajmniej jedną cechę do scalenia');
        }

        if (!confirm(`Na pewno scalić ${selected.length} zaznaczonych cech do "${canonical}"?`)) {
          return;
        }

        try {
          btn.disabled = true;
          const origText = btn.innerHTML;
          btn.innerHTML = '⌛ Scalanie...';
          
          await API.post('/sourcing/attrs/manager/merge', {
            aliases: selected,
            canonical_name: canonical
          });
          
          Toast.success(`Pomyślnie scalono cechy do "${canonical}"!`);
          await _reloadAttrManagerData();
        } catch (err) {
          Toast.error(err.message);
          btn.disabled = false;
          btn.innerHTML = '🔗 Scal wybrane';
        }
      });
    });
  }

  function _flattenTreeOpts(nodes, selectedId, depth = 0) {
    let html = '';
    const sorted = [...nodes].sort((a,b) => a.name.localeCompare(b.name, 'pl'));
    for (const node of sorted) {
      const indent = '&nbsp;'.repeat(depth * 3);
      html += `<option value="${node.id}" ${selectedId == node.id ? 'selected' : ''}>${indent}${escHtml(node.name)}</option>`;
      if (node.children) html += _flattenTreeOpts(node.children, selectedId, depth + 1);
    }
    return html;
  }

  // Fetch details for an attribute and show them in a sub-modal
  async function _amShowDetails(attrName) {
    try {
      const q = new URLSearchParams();
      if (amSupId) q.append('supplierId', amSupId);
      if (amOnlyAvailable) q.append('onlyAvailable', 'true');
      const qs = q.toString() ? '?' + q.toString() : '';
      
      const res = await API.get(`/sourcing/attrs/manager/${encodeURIComponent(attrName)}/details${qs}`);
      // Build values table with product name
      const valuesRows = res.values.length
        ? res.values.map(v => `<tr>
            <td>${escHtml(v.value)}</td>
            <td style="text-align:center;font-weight:600">${v.count}</td>
          </tr>`).join('')
        : '<tr><td colspan="2">Brak</td></tr>';
      
      // Build products table (value + product name + category)
      const prodRows = res.products && res.products.length
        ? res.products.map(p => {
            const unitBadge = p.attr_unit ? `<span class="badge" style="background:rgba(99,102,241,.15);color:var(--accent);font-size:.7rem;margin-left:4px">${escHtml(p.attr_unit)}</span>` : '';
            return `<tr>
              <td style="font-weight:600">${escHtml(p.value_text || '—')}${unitBadge}</td>
              <td style="font-size:.8rem" title="${escHtml(p.canonical_ean)}">${escHtml(p.name || p.canonical_ean || '—')}</td>
              <td style="font-size:.75rem;color:var(--text-muted)">${escHtml(p.category_name || '—')}</td>
            </tr>`;
          }).join('')
        : '<tr><td colspan="3">Brak produktów</td></tr>';
      
      // Build categories table — shows unit per-category clearly
      const catRows = res.categories.length
        ? res.categories.map(c => `<tr>
            <td>${escHtml(c.category_name)}</td>
            <td style="text-align:center">${c.attr_unit ? `<span class="badge" style="background:var(--accent);color:#fff;font-weight:700">${escHtml(c.attr_unit)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
            <td style="text-align:center">${c.count}</td>
          </tr>`).join('')
        : '<tr><td colspan="3">Brak powiązań</td></tr>';
      
      const bodyHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto 1fr;gap:16px;max-height:70vh;">
          
          <!-- Kategorie z jednostkami -->
          <div style="overflow-y:auto;">
            <h4 style="margin:0 0 8px 0;font-size:.9rem">📂 Kategorie & Jednostki miary</h4>
            <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px">⚠️ Ta sama cecha może mieć RÓŻNE jednostki w różnych kategoriach — to normalne!</div>
            <table class="sourcing-table" style="width:100%">
              <thead><tr><th>Kategoria</th><th>Jednostka</th><th>Użyć</th></tr></thead>
              <tbody>${catRows}</tbody>
            </table>
          </div>
          
          <!-- Top Wartości -->
          <div style="overflow-y:auto;">
            <h4 style="margin:0 0 8px 0;font-size:.9rem">📊 Top Wartości</h4>
            <table class="sourcing-table" style="width:100%">
              <thead><tr><th>Wartość</th><th style="text-align:center">Produktów</th></tr></thead>
              <tbody>${valuesRows}</tbody>
            </table>
          </div>
          
          <!-- Produkty z wartością -->
          <div style="overflow-y:auto;grid-column:1/-1;max-height:260px;">
            <h4 style="margin:0 0 8px 0;font-size:.9rem">📦 Przykładowe produkty (wartość + nazwa + kategoria)</h4>
            <table class="sourcing-table" style="width:100%">
              <thead><tr><th style="width:20%">Wartość</th><th style="width:50%">Nazwa produktu</th><th style="width:30%">Kategoria</th></tr></thead>
              <tbody>${prodRows}</tbody>
            </table>
          </div>
        </div>
      `;
      
      Modal.show({ title: `🔎 Podgląd Cechy: ${escHtml(attrName)}`, body: bodyHtml, size: 'lg', footer: '<button class="btn btn--secondary" onclick="SourcingView._buildAttrManagerUI()">Powrót do Menedżera</button>' });
      
      // ESC closes back to manager
      const escHandler = (e) => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', escHandler); SourcingView._buildAttrManagerUI(); }
      };
      document.addEventListener('keydown', escHandler);
      
    } catch(e) { Toast.error(e.message); }
  }





  async function showPreviewFileModal(sid, fid, title) {
    Modal.show({
      title: `👁️ Podgląd - ${escHtml(title)}`,
      body: '<div style="color:var(--text-muted);text-align:center;padding:20px">Trwa pobieranie podglądu pliku...</div>',
      footer: '<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>'
    });

    try {
      let url = '/sourcing/preview-file?';
      if (fid) url += `fid=${fid}`;
      else if (sid) url += `sid=${sid}`;
      
      const res = await API.get(url);
      
      if (!res.columns || !res.preview) {
         throw new Error("Brak danych podglądu (puste kolumny lub wiersze)");
      }
      
      const thead = res.columns.map(c => `<th style="padding:4px 8px;font-size:.75rem;border-bottom:1px solid var(--border);text-align:left">${escHtml(c)}</th>`).join('');
      const tbody = res.preview.map(row => {
        const cells = row.map(val => {
           let v = (val !== null && val !== undefined) ? String(val) : '';
           return `<td style="padding:4px 8px;font-size:.75rem;border-bottom:1px solid var(--border);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(v)}">${escHtml(v)}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      
      const bodyHtml = `
      <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:10px">
        Znaleziono kolumn: ${res.columns.length}. Pokazuję pierwsze ${res.preview.length} wierszy.
      </div>
      <div style="overflow-x:auto;max-height:60vh;border:1px solid var(--border);border-radius:6px">
        <table style="width:100%;border-collapse:collapse">
          <thead style="background:var(--bg-elevated);position:sticky;top:0;z-index:2"><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>`;
      
      document.querySelector('.modal-body').innerHTML = bodyHtml;
      // Allow HTML in preview cells if it's XML raw view
      if (res.columns.length === 1 && res.columns[0] === 'XML Podgląd') {
          const tbodyXml = res.preview.map(row => `<tr><td style="padding:4px 8px;font-size:.75rem;border-bottom:1px solid var(--border)">${row[0]}</td></tr>`).join('');
          document.querySelector('.modal-body table tbody').innerHTML = tbodyXml;
      }
    } catch(err) {
      document.querySelector('.modal-body').innerHTML = `<div style="color:#ef4444;padding:20px">❌ Błąd podglądu: ${escHtml(err.message)}</div>`;
    }
  }

  const api = {
    render,
    _showSupplierData: (id, name, page, search, mfg, avail) => showSupplierDataModal(id, name, page, search, mfg, avail||''),
    _saveSupConfig,
    _setSourceType,
    _setElkoTab,
    _testElkoApi,
    _testImpaktApi,
    _testNTTApi,
    _uploadElkoBrandFiles,
    _catSortBy,
    _catPageTo,
    _generateAttrs,
    _batchGenAttrs,
    _syncCatalogAttrs,
    _showDuplicates,
    _scanDuplicates,
    _resolveDuplicate,
    _suggestSchema,
    _approveSchema,
    _addSchemaParam,
    _unifyAttributes,
    _normalizeName,
    _editName,
    _saveEditedName,
    _batchNormalize,
    // Katalog Master Full
    _showProductDetail,
    _saveAttrValue,
    _saveProdDetails,
    _saveInlineMfgCode,
    _editFilters,
    _saveFilters,
    _deleteAttr,
    _catSelectAllSup,
    _setAbSupplier,
    _renderManufacturerManagerModal: renderManufacturerManagerModal,
    _renderAttrManagerModal: renderAttrManagerModal,
    _amShowDetails,
    _buildAttrManagerUI,
    showPreviewFileModal
  };

  /* ═══════════════════════════════════════════════════════════════════
     TAB: SYNC SHOPGOLD
  ═══════════════════════════════════════════════════════════════════ */

  const SG_CRON_PRESETS = [
    { label: 'Co 15 minut',  value: '*/15 * * * *' },
    { label: 'Co 30 minut',  value: '*/30 * * * *' },
    { label: 'Co 1 godzinę', value: '0 * * * *' },
    { label: 'Co 2 godziny', value: '0 */2 * * *' },
    { label: 'Co 6 godzin',  value: '0 */6 * * *' },
    { label: 'Co 12 godzin', value: '0 */12 * * *' },
    { label: 'Co 24 godziny',value: '0 6 * * *' },
    { label: 'Własny CRON',  value: '__custom__' },
  ];

  async function renderSgSync() {
    const el = document.getElementById('src-tab-sgsync');
    if (!el) return;
    el.innerHTML = `<div class="sg-sync-loading"><span class="sg-sync-spinner">⏳</span><p>Ładowanie konfiguracji sync...</p></div>`;

    let instances = [];
    let suppliers = [];
    try { const r = await API.get('/sourcing/sg-sync/instances'); instances = r.instances || []; } catch (_) {}
    try { const r = await API.get('/sourcing/suppliers'); suppliers = Array.isArray(r) ? r : (r.suppliers || []); } catch (_) {}

    if (instances.length === 0) {
      el.innerHTML = `
<div class="sg-sync-empty">
  <div class="sg-sync-empty-icon">🏪</div>
  <h3>Brak instancji ShopGold</h3>
  <p>Skonfiguruj przynajmniej jedną instancję ShopGold w <strong>Ustawieniach → Połączenie ze sklepem</strong>, aby móc synchronizować ceny i stany.</p>
  <button class="btn btn--primary" onclick="window.SettingsView && SettingsView.switchTab && SettingsView.switchTab('connection')">⚙️ Przejdź do Ustawień</button>
</div>`;
      return;
    }

    // Ensure selected instance exists
    if (!sgSyncInstanceId || !instances.find(i => i.id === sgSyncInstanceId)) {
      sgSyncInstanceId = instances[0].id;
    }

    const inst = instances.find(i => i.id === sgSyncInstanceId);
    let cfg = {};
    let rules = [];
    let logs = [];
    try { cfg = await API.get(`/sourcing/sg-sync/config/${sgSyncInstanceId}`); } catch (_) {}
    try { const r = await API.get(`/sourcing/sg-sync/price-rules/${sgSyncInstanceId}`); rules = r.rules || []; } catch (_) {}
    try { const r = await API.get(`/sourcing/sg-sync/logs/${sgSyncInstanceId}`); logs = r.logs || []; } catch (_) {}

    el.innerHTML = buildSgSyncHTML(instances, inst, suppliers, cfg, rules, logs);
    bindSgSyncEvents(suppliers, rules, logs);
  }

  function buildSgSyncHTML(instances, inst, suppliers, cfg, rules, logs) {
    const instOptions = instances.map(i =>
      `<button class="sg-inst-btn${i.id === inst.id ? ' active' : ''}" data-iid="${i.id}" id="sg-inst-btn-${i.id}">
        <span class="sg-inst-dot ${i.is_active ? 'active' : ''}"></span>
        ${i.name}
      </button>`
    ).join('');

    const supplierOptions = suppliers.map(s =>
      `<option value="${s.id}" ${cfg.supplier_id == s.id ? 'selected' : ''}>${s.name}</option>`
    ).join('');

    const cronPresetOptions = SG_CRON_PRESETS.map(p =>
      `<option value="${p.value}" ${cfg.schedule_cron === p.value ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    const isCustomCron = cfg.schedule_cron && !SG_CRON_PRESETS.find(p => p.value === cfg.schedule_cron && p.value !== '__custom__');

    return `
<div class="sg-sync-wrap">

  <!-- ── Instancja header ── -->
  <div class="sg-sync-header">
    <div class="sg-sync-header-left">
      <span class="sg-sync-header-icon">🏪</span>
      <div>
        <div class="sg-sync-header-title">Synchronizacja ShopGold</div>
        <div class="sg-sync-header-sub">Aktualizacja stanów i cen produktów w sklepie na podstawie danych hurtowni</div>
      </div>
    </div>
    <div class="sg-inst-selector">
      ${instOptions}
    </div>
  </div>

  <!-- ── Główny panel ── -->
  <div class="sg-sync-main">

    <!-- Kolumna lewa: Ustawienia -->
    <div class="sg-sync-col-left">

      <!-- Karta: Źródło danych -->
      <div class="sg-card">
        <div class="sg-card-header">
          <span class="sg-card-icon">📦</span>
          <span class="sg-card-title">Źródło danych</span>
        </div>
        <div class="sg-card-body">
          <label class="sg-label">Hurtownia (plik XML/CSV)</label>
          <select id="sg-supplier-select" class="sg-select">
            <option value="">-- wybierz hurtownię --</option>
            ${supplierOptions}
          </select>
          <div class="sg-toggles">
            <label class="sg-toggle-row">
              <span class="sg-toggle-label">
                <span class="sg-toggle-icon">📊</span>
                <span>
                  <strong>Aktualizuj stany</strong>
                  <small>Nadpisuje dostępność i stan mag.</small>
                </span>
              </span>
              <label class="sg-switch">
                <input type="checkbox" id="sg-opt-stock" ${cfg.update_stock !== 0 ? 'checked' : ''}>
                <span class="sg-slider"></span>
              </label>
            </label>
            <label class="sg-toggle-row">
              <span class="sg-toggle-label">
                <span class="sg-toggle-icon">💰</span>
                <span>
                  <strong>Aktualizuj ceny</strong>
                  <small>Stosuje marżę z reguł poniżej</small>
                </span>
              </span>
              <label class="sg-switch">
                <input type="checkbox" id="sg-opt-price" ${cfg.update_price !== 0 ? 'checked' : ''}>
                <span class="sg-slider"></span>
              </label>
            </label>
            <label class="sg-toggle-row sg-toggle-row--highlight">
              <span class="sg-toggle-label">
                <span class="sg-toggle-icon">⭐</span>
                <span>
                  <strong>Priorytet Subiekta GT</strong>
                  <small>Cena/stan z Subiekta nadpisuje hurtownię</small>
                </span>
              </span>
              <label class="sg-switch">
                <input type="checkbox" id="sg-opt-subiekt" ${cfg.subiekt_priority !== 0 ? 'checked' : ''}>
                <span class="sg-slider sg-slider--gold"></span>
              </label>
            </label>
          </div>
        </div>
      </div>

      <!-- Karta: Akcja -->
      <div class="sg-card sg-card--action">
        <div class="sg-card-header">
          <span class="sg-card-icon">▶</span>
          <span class="sg-card-title">Uruchom synchronizację</span>
        </div>
        <div class="sg-card-body">
          <div class="sg-action-info">
            <p>🔍 <strong>Podgląd (Dry Run)</strong> — sprawdza co zostanie zmienione <em>bez</em> zapisu do sklepu.</p>
            <p>✅ <strong>Zastosuj</strong> — wykonuje faktyczną aktualizację w bazie ShopGold.</p>
          </div>
          <div class="sg-action-btns">
            <button class="btn sg-btn-dryrun" id="sg-btn-dryrun">🔍 Podgląd zmian</button>
            <button class="btn sg-btn-apply" id="sg-btn-apply">✅ Zastosuj synchronizację</button>
          </div>
          <div id="sg-run-status" class="sg-run-status" style="display:none"></div>
        </div>
      </div>

    </div>

    <!-- Kolumna prawa: Sekcje rozwijane -->
    <div class="sg-sync-col-right">

      <!-- Sekcja: Reguły marż -->
      <div class="sg-section" id="sg-section-rules">
        <button class="sg-section-header" id="sg-rules-toggle">
          <span>💰 Reguły marż i progów cenowych</span>
          <span class="sg-section-arrow ${sgSyncRulesExpanded ? 'open' : ''}">▼</span>
        </button>
        <div class="sg-section-body ${sgSyncRulesExpanded ? 'open' : ''}" id="sg-rules-body">
          <div class="sg-rules-info">
            <span>💡 Cena sprzedaży = cena netto hurtowni × (1 + marża%). Stosowana gdy <strong>nie ma produktu w Subiekcie</strong>.</span>
          </div>
          <table class="sg-rules-table" id="sg-rules-table">
            <thead>
              <tr>
                <th>Cena netto (od)</th>
                <th>Cena netto (do)</th>
                <th>Marża %</th>
                <th>Zaokrągl. do</th>
                <th>Przykład</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="sg-rules-tbody">
              ${buildRulesRows(rules)}
            </tbody>
          </table>
          <button class="sg-add-rule-btn" id="sg-add-rule-btn">+ Dodaj próg cenowy</button>
        </div>
      </div>

      <!-- Sekcja: Harmonogram -->
      <div class="sg-section" id="sg-section-schedule">
        <button class="sg-section-header" id="sg-schedule-toggle">
          <span>⏰ Harmonogram synchronizacji</span>
          <span class="sg-section-arrow ${sgSyncScheduleExpanded ? 'open' : ''}">▼</span>
        </button>
        <div class="sg-section-body ${sgSyncScheduleExpanded ? 'open' : ''}" id="sg-schedule-body">
          <div class="sg-schedule-panel">
            <div class="sg-schedule-toggle-row">
              <div>
                <strong>Automatyczna synchronizacja</strong>
                <small>Uruchamia sync wg podanego harmonogramu</small>
              </div>
              <label class="sg-switch">
                <input type="checkbox" id="sg-sched-enabled" ${cfg.schedule_enabled ? 'checked' : ''}>
                <span class="sg-slider"></span>
              </label>
            </div>
            <div class="sg-schedule-config ${cfg.schedule_enabled ? '' : 'sg-schedule-disabled'}" id="sg-schedule-config">
              <label class="sg-label">Interwał synchronizacji</label>
              <select id="sg-cron-preset" class="sg-select">
                ${cronPresetOptions}
              </select>
              <div id="sg-cron-custom-wrap" style="${isCustomCron ? '' : 'display:none;'}">
                <label class="sg-label">Wyrażenie CRON</label>
                <input type="text" id="sg-cron-custom" class="sg-input" value="${cfg.schedule_cron || '0 6 * * *'}" placeholder="np. 0 6 * * *">
                <small class="sg-hint">Format: minuta godzina dzień_mies. miesiąc dzień_tyg.</small>
              </div>
              ${cfg.last_run_at ? `<div class="sg-last-run">🕒 Ostatnie uruchomienie: <strong>${fmtDate(cfg.last_run_at)}</strong></div>` : ''}
              <button class="btn btn--primary sg-save-schedule-btn" id="sg-save-schedule-btn">💾 Zapisz harmonogram</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Sekcja: Log -->
      <div class="sg-section" id="sg-section-logs">
        <button class="sg-section-header" id="sg-logs-toggle">
          <span>📋 Historia synchronizacji</span>
          <span class="sg-section-arrow ${sgSyncLogsExpanded ? 'open' : ''}">▼</span>
        </button>
        <div class="sg-section-body ${sgSyncLogsExpanded ? 'open' : ''}" id="sg-logs-body">
          ${buildLogsHTML(logs)}
        </div>
      </div>

    </div>
  </div>

  <!-- Wyniki dry-run -->
  <div id="sg-dryrun-results" class="sg-dryrun-results" style="display:none"></div>

</div>`;
  }

  function buildRulesRows(rules) {
    if (!rules || rules.length === 0) return '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:16px">Brak reguł — kliknij "Dodaj próg cenowy"</td></tr>';
    return rules.map(r => {
      const example = r.price_from > 0 ? calcExamplePrice(r.price_from + 1, r) : calcExamplePrice(5, r);
      return `
<tr data-rule-id="${r.id}" class="sg-rule-row">
  <td><input type="number" class="sg-input-sm sg-rule-from" value="${r.price_from}" min="0" step="0.01"></td>
  <td><input type="number" class="sg-input-sm sg-rule-to" value="${r.price_to >= 99990 ? '' : r.price_to}" min="0" step="0.01" placeholder="∞"></td>
  <td>
    <div class="sg-margin-cell">
      <input type="number" class="sg-input-sm sg-rule-margin" value="${r.margin_pct}" min="0" max="999" step="0.1">
      <span>%</span>
    </div>
  </td>
  <td>
    <select class="sg-input-sm sg-rule-round">
      <option value="0.01" ${r.round_to <= 0.01 ? 'selected' : ''}>0,01</option>
      <option value="0.1" ${r.round_to == 0.1 ? 'selected' : ''}>0,10</option>
      <option value="1" ${r.round_to == 1 ? 'selected' : ''}>1,00</option>
      <option value="5" ${r.round_to == 5 ? 'selected' : ''}>5,00</option>
      <option value="10" ${r.round_to == 10 ? 'selected' : ''}>10,00</option>
    </select>
  </td>
  <td class="sg-rule-example">${example}</td>
  <td>
    <div style="display:flex;gap:4px">
      <button class="sg-rule-save-btn btn btn--xs btn--primary" title="Zapisz">💾</button>
      <button class="sg-rule-del-btn btn btn--xs btn--danger" title="Usuń">🗑</button>
    </div>
  </td>
</tr>`;
    }).join('');
  }

  function calcExamplePrice(netto, rule) {
    const p = netto * (1 + rule.margin_pct / 100);
    const roundTo = rule.round_to || 0.01;
    const rounded = Math.ceil(p / roundTo) * roundTo;
    return `<span class="sg-example-price">${netto.toFixed(2)} → <strong>${(Math.round(rounded * 100) / 100).toFixed(2)} zł</strong></span>`;
  }

  function buildLogsHTML(logs) {
    if (!logs || logs.length === 0) return `<div class="sg-logs-empty">Brak historii synchronizacji.</div>`;
    return `
<div class="sg-logs-wrap">
  <table class="sg-logs-table">
    <thead>
      <tr>
        <th>Data</th>
        <th>Hurtownia</th>
        <th>Zaktualizowano</th>
        <th>Subiekt</th>
        <th>Pominięto</th>
        <th>Czas</th>
        <th>Status</th>
        <th>Typ</th>
      </tr>
    </thead>
    <tbody>
      ${logs.map(l => {
        const statusCls = l.status === 'ok' ? 'sg-log-ok' : l.status === 'running' ? 'sg-log-running' : 'sg-log-error';
        const statusLabel = l.status === 'ok' ? '✅ OK' : l.status === 'running' ? '⏳ W toku' : '❌ Błąd';
        const dur = l.duration_ms ? `${(l.duration_ms / 1000).toFixed(1)}s` : '—';
        return `<tr class="sg-log-row ${statusCls}">
          <td>${fmtDate(l.started_at)}</td>
          <td>${l.supplier_name || '—'}</td>
          <td><strong>${l.updated_count || 0}</strong> SKU</td>
          <td><span class="sg-subiekt-badge">${l.subiekt_count || 0}</span></td>
          <td>${l.skipped_count || 0}</td>
          <td>${dur}</td>
          <td><span class="sg-log-status ${statusCls}">${statusLabel}</span>${l.error ? `<br><small class="sg-log-error-msg">${l.error}</small>` : ''}</td>
          <td>${l.dry_run ? '<span class="sg-badge-dryrun">Podgląd</span>' : '<span class="sg-badge-live">Live</span>'}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>`;
  }

  function bindSgSyncEvents(suppliers, rules, logs) {
    // Instance selector
    document.querySelectorAll('.sg-inst-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sgSyncInstanceId = parseInt(btn.dataset.iid);
        localStorage.setItem('sg_sync_iid', sgSyncInstanceId);
        renderSgSync();
      });
    });

    // Section toggles
    const toggleSection = (btnId, bodyId, stateRef) => {
      const btn = document.getElementById(btnId);
      const body = document.getElementById(bodyId);
      if (!btn || !body) return;
      btn.addEventListener('click', () => {
        body.classList.toggle('open');
        btn.querySelector('.sg-section-arrow')?.classList.toggle('open');
      });
    };
    toggleSection('sg-rules-toggle', 'sg-rules-body');
    toggleSection('sg-schedule-toggle', 'sg-schedule-body');
    toggleSection('sg-logs-toggle', 'sg-logs-body');

    // Cron preset switcher
    const cronPreset = document.getElementById('sg-cron-preset');
    const cronCustomWrap = document.getElementById('sg-cron-custom-wrap');
    if (cronPreset) {
      cronPreset.addEventListener('change', () => {
        if (cronPreset.value === '__custom__') {
          cronCustomWrap.style.display = '';
        } else {
          cronCustomWrap.style.display = 'none';
        }
      });
    }

    // Schedule toggle
    const schedEnabled = document.getElementById('sg-sched-enabled');
    const schedConfig = document.getElementById('sg-schedule-config');
    if (schedEnabled) {
      schedEnabled.addEventListener('change', () => {
        schedConfig?.classList.toggle('sg-schedule-disabled', !schedEnabled.checked);
      });
    }

    // Save schedule
    const saveScheduleBtn = document.getElementById('sg-save-schedule-btn');
    if (saveScheduleBtn) {
      saveScheduleBtn.addEventListener('click', async () => {
        const enabled = document.getElementById('sg-sched-enabled')?.checked;
        let cronVal = document.getElementById('sg-cron-preset')?.value;
        if (cronVal === '__custom__') cronVal = document.getElementById('sg-cron-custom')?.value || '0 6 * * *';
        const supplId = document.getElementById('sg-supplier-select')?.value;
        saveScheduleBtn.disabled = true;
        saveScheduleBtn.textContent = '⏳ Zapisuję...';
        try {
          await API.post(`/sourcing/sg-sync/config/${sgSyncInstanceId}`, {
            supplier_id: supplId ? parseInt(supplId) : null,
            schedule_enabled: enabled ? 1 : 0,
            schedule_cron: cronVal,
            update_stock: document.getElementById('sg-opt-stock')?.checked ? 1 : 0,
            update_price: document.getElementById('sg-opt-price')?.checked ? 1 : 0,
            subiekt_priority: document.getElementById('sg-opt-subiekt')?.checked ? 1 : 0,
          });
          Toast.success('Harmonogram zapisany');
          saveScheduleBtn.textContent = '✅ Zapisano';
          setTimeout(() => { saveScheduleBtn.textContent = '💾 Zapisz harmonogram'; saveScheduleBtn.disabled = false; }, 2000);
        } catch (e) {
          Toast.error(e.message);
          saveScheduleBtn.textContent = '💾 Zapisz harmonogram';
          saveScheduleBtn.disabled = false;
        }
      });
    }

    // Add rule
    const addRuleBtn = document.getElementById('sg-add-rule-btn');
    if (addRuleBtn) {
      addRuleBtn.addEventListener('click', async () => {
        const tbody = document.getElementById('sg-rules-tbody');
        if (!tbody) return;
        const lastRule = rules[rules.length - 1];
        const newFrom = lastRule ? lastRule.price_to : 0;
        try {
          await API.post(`/sourcing/sg-sync/price-rules/${sgSyncInstanceId}`, {
            price_from: newFrom,
            price_to: 99999,
            margin_pct: 30,
            round_to: 0.01,
            label: '',
            sort_order: rules.length,
          });
          renderSgSync();
        } catch (e) { Toast.error(e.message); }
      });
    }

    // Rule save/delete — event delegation
    const rulesTable = document.getElementById('sg-rules-tbody');
    if (rulesTable) {
      rulesTable.addEventListener('click', async (e) => {
        const row = e.target.closest('[data-rule-id]');
        if (!row) return;
        const ruleId = parseInt(row.dataset.ruleId);

        if (e.target.closest('.sg-rule-save-btn')) {
          const from = parseFloat(row.querySelector('.sg-rule-from')?.value) || 0;
          const toRaw = row.querySelector('.sg-rule-to')?.value;
          const to = toRaw === '' || toRaw === undefined ? 99999 : parseFloat(toRaw);
          const margin = parseFloat(row.querySelector('.sg-rule-margin')?.value) || 0;
          const roundTo = parseFloat(row.querySelector('.sg-rule-round')?.value) || 0.01;
          try {
            await API.post(`/sourcing/sg-sync/price-rules/${sgSyncInstanceId}`, {
              id: ruleId, price_from: from, price_to: to, margin_pct: margin, round_to: roundTo
            });
            Toast.success('Reguła zapisana');
            renderSgSync();
          } catch (err) { Toast.error(err.message); }
        }

        if (e.target.closest('.sg-rule-del-btn')) {
          if (!confirm('Usunąć tę regułę?')) return;
          try {
            await API.del(`/sourcing/sg-sync/price-rules/${ruleId}`);
            Toast.success('Reguła usunięta');
            renderSgSync();
          } catch (err) { Toast.error(err.message); }
        }
      });

      // Live example update on input change
      rulesTable.addEventListener('input', (e) => {
        const row = e.target.closest('[data-rule-id]');
        if (!row) return;
        const from = parseFloat(row.querySelector('.sg-rule-from')?.value) || 0;
        const margin = parseFloat(row.querySelector('.sg-rule-margin')?.value) || 0;
        const roundTo = parseFloat(row.querySelector('.sg-rule-round')?.value) || 0.01;
        const example = from > 0 ? from + 1 : 5;
        const price = example * (1 + margin / 100);
        const rounded = Math.ceil(price / roundTo) * roundTo;
        const exCell = row.querySelector('.sg-rule-example');
        if (exCell) exCell.innerHTML = `<span class="sg-example-price">${example.toFixed(2)} → <strong>${(Math.round(rounded * 100) / 100).toFixed(2)} zł</strong></span>`;
      });
    }

    // Dry-run button
    const dryrunBtn = document.getElementById('sg-btn-dryrun');
    if (dryrunBtn) {
      dryrunBtn.addEventListener('click', () => runSgSync(true));
    }

    // Apply button
    const applyBtn = document.getElementById('sg-btn-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (!confirm('Czy na pewno chcesz zastosować synchronizację? Spowoduje to zapis cen i stanów w sklepie ShopGold.')) return;
        runSgSync(false);
      });
    }
  }

  async function runSgSync(isDryRun) {
    const supplierId = document.getElementById('sg-supplier-select')?.value;
    if (!supplierId) { Toast.error('Wybierz hurtownię źródłową'); return; }

    const statusEl = document.getElementById('sg-run-status');
    const dryrunEl = document.getElementById('sg-dryrun-results');
    const dryBtn = document.getElementById('sg-btn-dryrun');
    const applyBtn = document.getElementById('sg-btn-apply');

    if (statusEl) { statusEl.style.display = ''; statusEl.innerHTML = `<span class="sg-run-spinner">⏳</span> ${isDryRun ? 'Analizuję zmiany...' : 'Synchronizuję...'}` ; }
    if (dryrunEl) dryrunEl.style.display = 'none';
    if (dryBtn) dryBtn.disabled = true;
    if (applyBtn) applyBtn.disabled = true;

    try {
      const result = await API.post(`/sourcing/sg-sync/run/${sgSyncInstanceId}`, {
        supplier_id: parseInt(supplierId),
        dry_run: isDryRun,
        update_stock: document.getElementById('sg-opt-stock')?.checked !== false,
        update_price: document.getElementById('sg-opt-price')?.checked !== false,
        subiekt_priority: document.getElementById('sg-opt-subiekt')?.checked !== false,
      });

      const msg = isDryRun
        ? `🔍 Podgląd: <strong>${result.updatedCount}</strong> SKU do zmiany (Subiekt: ${result.subiektCount}), pominięto: ${result.skippedCount}`
        : `✅ Synchronizacja zakończona: <strong>${result.updatedCount}</strong> SKU zaktualizowanych (Subiekt: ${result.subiektCount}), pominięto: ${result.skippedCount}`;

      if (statusEl) statusEl.innerHTML = msg;

      if (isDryRun && result.details && result.details.length > 0) {
        if (dryrunEl) {
          dryrunEl.style.display = '';
          dryrunEl.innerHTML = buildDryRunTable(result.details);
        }
      }

      Toast.success(isDryRun ? 'Podgląd gotowy' : 'Synchronizacja zakończona!');

      // Refresh logs
      try {
        const r = await API.get(`/sourcing/sg-sync/logs/${sgSyncInstanceId}`);
        const logsBody = document.getElementById('sg-logs-body');
        if (logsBody) logsBody.innerHTML = buildLogsHTML(r.logs || []);
      } catch (_) {}

    } catch (err) {
      if (statusEl) statusEl.innerHTML = `❌ Błąd: ${err.message}`;
      Toast.error(err.message);
    } finally {
      if (dryBtn) dryBtn.disabled = false;
      if (applyBtn) applyBtn.disabled = false;
    }
  }

  function buildDryRunTable(details) {
    return `
<div class="sg-dryrun-header">
  <span>🔍 Podgląd zmian (pierwsze ${details.length} produktów)</span>
  <button class="sg-dryrun-close btn btn--ghost btn--sm" onclick="document.getElementById('sg-dryrun-results').style.display='none'">✕ Zamknij</button>
</div>
<div class="sg-dryrun-table-wrap">
  <table class="sg-dryrun-table">
    <thead>
      <tr>
        <th>EAN / SKU</th>
        <th>Nazwa</th>
        <th>Nowa cena</th>
        <th>Nowy stan</th>
        <th>Źródło</th>
      </tr>
    </thead>
    <tbody>
      ${details.map(d => `
        <tr>
          <td><code>${d.ean || d.sku || '—'}</code></td>
          <td class="sg-dryrun-name">${(d.name || '').substring(0, 60)}</td>
          <td>${d.new_price != null ? `<strong>${parseFloat(d.new_price).toFixed(2)} zł</strong>` : '—'}</td>
          <td>${d.new_stock != null ? (d.new_stock > 0 ? `<span class="sg-stock-ok">${d.new_stock}</span>` : `<span class="sg-stock-zero">0</span>`) : '—'}</td>
          <td>${d.from_subiekt ? '<span class="sg-source-subiekt">⭐ Subiekt</span>' : '<span class="sg-source-wh">📦 Hurtownia</span>'}</td>
        </tr>`).join('')}
    </tbody>
  </table>
</div>`;
  }

  window.SourcingView = api;
  return api;
})();