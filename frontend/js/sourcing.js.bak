/* ===== sourcing.js — Smart Sourcing & Pricing View (rozbudowana) ===== */
'use strict';

window.SourcingView = (() => {
  /* â”€â”€ state â”€â”€ */
  let activeTab = 'subiekt';
  let previewData = null;
  let compareData = null;
  let sortCol = null, sortAsc = true;
  let filterAvail = false, filterSavings = '', filterSearch = '', filterMfg = '', filterSupplierId = '';
  let comparePage = 0, comparePageSize = 100;
  let promoThreshold = 10, promoAvail = false, promoSearch = '';
  let promoPage = 0, promoPageSize = 100;
  let promoSortCol = null, promoSortAsc = true;
  let missingSupplier = '', missingSearch = '', missingAvail = '', missingMfg = '';
  let missingSortCol = null, missingSortAsc = true;
  let restockSupplier = '', restockSearch = '', restockDays = 30, restockOnlyNeeded = true;
  let restockAvail = '', restockMfg = '';
  let restockPage = 0, restockPageSize = 100;
  let restockSortCol = null, restockSortAsc = true;
  let logsExpanded = false, logsSupplier = null;

  /* â”€â”€ render entry â”€â”€ */
  function render() {
    const el = document.getElementById('view-sourcing');
    if (!el) return;
    el.innerHTML = html_shell();
    bindTabSwitcher();
    renderTab(activeTab);
  }

  function html_shell() {
    const tabs = ['subiekt','suppliers','compare','promotions','missing','restock','listing'];
    const labels = {
      subiekt:'📥 Import Subiekta', suppliers:'🏭 Hurtownie',
      compare:'📊 Porownanie cen', promotions:'🔥 Promocje',
      missing:'🆕 Brakujace', restock:'📦 Zamowienia', listing:'🛒 Niewystawione'
    };
    return `
<div class="sourcing-tabs">
  ${tabs.map(t=>`<button class="sourcing-tab${activeTab===t?' active':''}" data-tab="${t}">${labels[t]}</button>`).join('')}
</div>
${tabs.map(t=>`<div id="src-tab-${t}" class="sourcing-tab-content${activeTab===t?' active':''}"></div>`).join('')}`;
  }

  function bindTabSwitcher() {
    document.querySelectorAll('.sourcing-tab[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
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
    if (tab === 'compare')    renderCompare();
    if (tab === 'promotions') renderPromotions();
    if (tab === 'missing')    renderMissing();
    if (tab === 'restock')    renderRestock();
    if (tab === 'listing')    renderListing();
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
    {key:'ean',       label:'Kod EAN',          required:true},
    {key:'name',      label:'Nazwa produktu',    required:false},
    {key:'stock',     label:'Stan magazynowy',   required:false},
    {key:'buy_price', label:'Cena zakupu',       required:false},
    {key:'sell_price',label:'Cena sprzedazy',    required:false},
    {key:'sold_12m',  label:'Sprzedaz 12 mies.', required:false},
    {key:'sold_30d',  label:'Sprzedaz 30 dni',   required:false},
    {key:'buy_price_date', label:'Data ost. zakupu', required:false},
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
          '<span>' + s.row_count + ' wystawien | platformy: <strong>' + s.platforms.join(', ') + '</strong> | import: ' + fmtDate(s.last_import) + '</span>' +
          '<button class="btn btn--danger btn--sm" id="lst-del-btn" style="margin-left:auto">&#x1F5D1; Usuń plik wystawień</button>' +
          '</div>';
        document.getElementById('lst-del-btn')?.addEventListener('click', async () => {
          if (!confirm('Usunąć wszystkie dane wystawień z bazy?')) return;
          try {
            await API.del('/sourcing/listing');
            Toast.success('Dane wystawień usunięte');
            loadListingImportStatus();
            listingPage = 0; listingSort = ''; listingAsc = true;
          } catch(e) { Toast.error(e.message); }
        });
      } else {
        bar.innerHTML = '<div class="listing-status-pill inactive"><span>Brak danych — wgraj plik wystawień</span></div>';
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
    try { list = await API.get('/sourcing/suppliers'); } catch {}

    const urlCount = list.filter(s => s.source_type === 'url').length;
    const cards = list.length ? list.map(s => supplierCard(s)).join('') :
      `<div class="sourcing-empty"><span class="empty-icon">🏭</span><h3>Brak hurtowni</h3><p>Dodaj pierwsza hurtownie ponizej</p></div>`;

    el.innerHTML = `
<div class="suppliers-header-row">
  <h3 style="margin:0;font-size:1rem;font-weight:700">Hurtownie (${list.length})</h3>
  <div style="display:flex;gap:8px;align-items:center">
    ${urlCount > 0 ? `<button class="btn btn--secondary btn--sm" id="sup-refresh-all-btn">🔄 Odswież wszystkie (${urlCount} URL)</button>` : ''}
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
    const typeIcon  = s.source_type === 'url' ? '&#x1F517;' : s.source_type === 'ftp' ? '&#x1F512;' : s.source_type === 'impakt_api' ? '&#x1F50C;' : '&#x1F4C1;';
    const typeLabel = s.source_type === 'url' ? 'URL' : s.source_type === 'ftp' && s.ftp_port == 22 ? 'SFTP' : s.source_type === 'ftp' ? 'FTP' : s.source_type === 'impakt_api' ? 'Impakt API' : s.source_type === 'elko_api' ? 'Elko API' : 'Plik';
    const fileSizeHtml = s.file_size_bytes ? `<div class="supplier-meta-row">💾 Rozmiar: <strong>${fmtBytes(s.file_size_bytes)}</strong></div>` : '';
    const ftpInfoHtml  = (s.source_type === 'ftp' && s.ftp_host) ? `<div class="supplier-meta-row url-row">🔒 ${escHtml(s.ftp_host)}:${s.ftp_port||21}${escHtml(s.ftp_path||'')}</div>` : '';
    return `
<div class="supplier-card" data-id="${s.id}">
  <div class="supplier-card-header">
    <div class="supplier-icon">${typeIcon}</div>
    <div class="supplier-info">
      <h4>${escHtml(s.name)}</h4>
      <span class="supplier-type ${s.source_type}">${typeLabel}</span>
      ${currency !== 'PLN' ? `<span class="sup-currency-badge">${currency}${rate}</span>` : ''}
    </div>
  </div>
  <div class="supplier-meta">
    <div class="supplier-meta-row">📦 SKU: <strong>${s.product_count||0}</strong></div>
    ${s.source_type === 'elko_api' && s.extra_files_count > 0 ? '<div class="supplier-brand-files" data-sid="'+s.id+'"></div>' : ''}
    ${fileCreated ? `<div class="supplier-meta-row">📅 Data pliku: <strong>${fileCreated}</strong></div>` : ''}
    ${fileSizeHtml}
    <div class="supplier-meta-row">🔄 Wczytano: <strong>${refreshed}</strong></div>
    ${s.source_url ? `<div class="supplier-meta-row url-row">${escHtml(s.source_url.slice(0,60))}${s.source_url.length>60?'…':''}</div>` : ''}
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
    <button class="btn-schedule-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}" data-cron="${escHtml(s.schedule_cron||'')}" data-enabled="${s.schedule_enabled?'1':'0'}">⏰ Harmonogram</button>
    <button class="btn-files-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}">📎 Pliki</button>
    <button class="btn-config-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}" data-currency="${currency}" data-rate="${s.exchange_rate||1}" data-stype="${s.source_type}" data-urluser="${s.url_user||''}" data-urlpass="${s.url_pass||''}">⚙️ Ust.</button>
    <button class="btn-logs-supplier" data-id="${s.id}" data-name="${escHtml(s.name)}">📋 Logi</button>
    <button class="btn-del-supplier" data-id="${s.id}">🗑</button>
  </div>
</div>`;
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
        btn.innerHTML = '<span class="spin-inline"></span> Laduje...'; btn.disabled = true;
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

    // Config (currency, rate, col_settings)
    document.querySelectorAll('.btn-config-supplier').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        Modal.show({
          title: `⚙️ Ustawienia: ${escHtml(btn.dataset.name)}`,
          body: `<div style="display:flex;flex-direction:column;gap:12px">
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
            ${btn.dataset.stype === 'url' ? `<div style="border-top:1px solid var(--border);padding-top:10px">
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

    // Schedule
    document.querySelectorAll('.btn-schedule-supplier').forEach(btn => {
      btn.addEventListener('click', () => showScheduleModal(btn.dataset.id, btn.dataset.name, btn.dataset.cron, btn.dataset.enabled === '1'));
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
  }

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
      const ftLabel  = t => t==='full' ? '📦 Pełny' : '⚡ Stany/Ceny';
      const srcLabel = s => s==='url'  ? '🔗 URL'   : '📁 Plik';
      const fileRows = files.length ? files.map(f => `
<div class="sf-row">
  <div class="sf-row-info">
    <span class="sf-label">${escHtml(f.label)}</span>
    <span class="sf-badge ft-${f.file_type}">${ftLabel(f.file_type)}</span>
    <span class="sf-badge src-${f.source_type}">${srcLabel(f.source_type)}</span>
    ${f.source_url ? `<span class="sf-url" title="${escHtml(f.source_url)}">${escHtml(f.source_url.slice(0,45))}${f.source_url.length>45?'…':''}</span>` : ''}
    <span class="sf-date">${f.last_refresh ? 'odśw: '+fmtDate(f.last_refresh) : 'nie odświeżono'}</span>
  </div>
  <div class="sf-row-actions">
    <button class="btn btn--ghost btn--sm sf-ref-btn" data-fid="${f.id}" data-src="${f.source_type}">🔄</button>
    <button class="btn btn--danger btn--sm sf-del-btn" data-fid="${f.id}">🗑</button>
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
    el.innerHTML = '<div class="sourcing-empty"><span class="empty-icon">⏳</span><p>Analizuje dane...</p></div>';
    try {
      const params = new URLSearchParams();
      if (filterAvail)   params.set('onlyAvailable','true');
      if (filterSavings) params.set('minSavingsPct', filterSavings);
      if (filterSearch)  params.set('search', filterSearch);
      if (filterMfg)     params.set('manufacturer', filterMfg);
      if (filterSupplierId) params.set('supplier_id', filterSupplierId);
      compareData = await API.get(`/sourcing/compare?${params}`);
      renderCompareTable(el, compareData);
    } catch(e) {
      el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">⚠️</span><h3>Blad</h3><p>${escHtml(e.message)}</p></div>`;
    }
  }

  /* kolumny — widoczność (localStorage) */
  const CMP_ALL_COLS = ['ean','name','stock','sold_30d','buy_price','best_price','best_supplier','savings','savings_pct','signal'];
  const CMP_COL_LABELS = {ean:'EAN',name:'Nazwa',stock:'Stan',sold_30d:'Spr.30d',buy_price:'C.zakupu',best_price:'Najlepsza',best_supplier:'Hurtownia',savings:'Oszcz.zł',savings_pct:'Oszcz.%',signal:'Sygnał'};
  function getCmpHiddenCols() { try { return JSON.parse(localStorage.getItem('cmp_hidden')||'[]'); } catch { return []; } }
  function saveCmpHiddenCols(arr) { localStorage.setItem('cmp_hidden', JSON.stringify(arr)); }

  function renderCompareTable(el, data) {
    const {rows, suppliers} = data;
    if (!rows || !rows.length) {
      el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">🔍</span><h3>Brak wynikow</h3>
        <p>Zaimportuj produkty z Subiekta i dodaj cenniki hurtowni.</p></div>`;
      return;
    }

    const green  = rows.filter(r=>r.signal==='green').length;
    const yellow = rows.filter(r=>r.signal==='yellow').length;
    const red    = rows.filter(r=>r.signal==='red').length;
    const totalSav = rows.reduce((s,r)=>s+(r.savings||0),0);
    const sorted = sortRows([...rows]);
    const hidden = getCmpHiddenCols();
    const isHidden = col => hidden.includes(col);

    let CMP_COL_DEFS = [
      {key:'ean', label:'EAN', frozen:true},
      {key:'name', label:'Nazwa', frozen:true},
      {key:'stock', label:'Stan'},
      {key:'sold_30d', label:'Spr.30d'},
      {key:'buy_price', label:'C.zakupu'},
      {key:'buy_price_date', label:'Data zakupu'},
      {key:'best_price', label:'Najlepsza'},
      {key:'best_supplier', label:'Hurtownia'},
      {key:'savings', label:'Oszcz.zł'},
      {key:'savings_pct', label:'Oszcz.%'},
      {key:'signal', label:'Sygnał'}
    ];
    suppliers.forEach(s => {
      CMP_COL_DEFS.push({key: `sup_${s.id}`, label: s.name + (s.currency && s.currency !== 'PLN' ? ` (${s.currency})` : '')});
    });

    const order = getColOrder('compare', CMP_COL_DEFS).filter(k => !isHidden(k));

    const thead = order.map(k => {
      const d = CMP_COL_DEFS.find(x => x.key === k);
      if (!d) return '';
      const thAlign = (k === 'stock' || k === 'sold_30d') ? 'text-align:center;' : '';
      return `<th data-col="${k}" class="sortable cmp-th${sortCol===k?' sorted':''}" style="${thAlign}overflow:hidden">${escHtml(d.label)} <span class="sort-icon">${sortIcon(k)}</span></th>`;
    }).join('');

    const sigMap = {green:'🟢',yellow:'🟡',red:'🔴',none:'—'};
    const sigTitle = {green:'Opłacalne (Kup taniej)',yellow:'Neutralne (Podobna cena)',red:'Drożej (Nie opłaca się)',none:'Brak analizy'};
    const sigCls = {green:'green',yellow:'yellow',red:'red',none:'none'};

    function cmpCell(key, r) {
      switch(key) {
        case 'ean': return `<td class="ean-cell">${escHtml(r.ean)}</td>`;
        case 'name': return `<td class="name-cell name-dblclick" data-ean="${r.ean}" title="Dwuklik = szczegoly produktu">${escHtml(truncate(r.name||'—',42))}</td>`;
        case 'stock': return `<td style="text-align:center">${r.stock??'—'}</td>`;
        case 'sold_30d': return `<td style="text-align:center">${r.sold_30d??'—'}</td>`;
        case 'buy_price': {
          const staleWarn = r.buy_price_stale ? '<div style="font-size:.62rem;color:#f59e0b;white-space:nowrap" title="Cena zakupu starsza niż 3 miesiące">⚠️ stara cena</div>' : '';
          return `<td class="price-cell">${fmtPLN(r.buy_price)}${staleWarn}</td>`;
        }
        case 'buy_price_date': {
          if (!r.buy_price_date) return '<td style="color:var(--text-muted);font-size:.75rem">—</td>';
          const d = new Date(r.buy_price_date);
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
        default: 
          if (key.startsWith('sup_')) {
            const sid = parseInt(key.split('_')[1], 10);
            const sp = r.supplier_prices?.[sid];
            if (!sp) return `<td class="price-cell-empty">—</td>`;
            const avail = sp.availability==='available'?'✅':sp.availability==='unavailable'?'❌':'âť“';
            const origPrice = sp.orig_price && sp.currency && sp.currency!=='PLN' ? `<div style="font-size:.68rem;color:var(--text-muted)">${parseFloat(sp.orig_price).toFixed(2)} ${sp.currency}</div>` : '';
            return `<td class="price-cell price-clickable${r.best_supplier_id===sid?' best-price':''}" data-ean="${r.ean}" title="${avail} — kliknij aby zobaczyc wszystkie oferty">${fmtPLN(sp.price)}${origPrice}</td>`;
          }
          return '<td></td>';
      }
    }

    // Pagination
    const totalRows = sorted.length;
    const totalPages = Math.ceil(totalRows / comparePageSize) || 1;
    if (comparePage >= totalPages) comparePage = totalPages - 1;
    if (comparePage < 0) comparePage = 0;
    const pageStart = comparePage * comparePageSize;
    const pageEnd = Math.min(pageStart + comparePageSize, totalRows);
    const pageRows = sorted.slice(pageStart, pageEnd);

    const tbody = pageRows.map(r => {
      return `<tr data-ean="${r.ean}">${order.map(k => cmpCell(k, r)).join('')}</tr>`;
    }).join('');

    const exportUrl = `/api/sourcing/compare/export?${new URLSearchParams({onlyAvailable:filterAvail,minSavingsPct:filterSavings||'',search:filterSearch})}`;

    // Build manufacturer list from both API allManufacturers AND current row data
    const mfgSet = new Set();
    // Filter out SKU/EAN-like values from manufacturer list
    const isValidMfg = (m) => {
      if (!m || m.length < 2) return false;
      if (/^\d+$/.test(m)) return false;
      if (/^[A-Z]{1,3}[-]?\d{3,}$/i.test(m)) return false;
      return true;
    };
    (compareData.allManufacturers || []).forEach(m => m && isValidMfg(m) && mfgSet.add(m));
    rows.forEach(r => r.manufacturer && isValidMfg(r.manufacturer) && mfgSet.add(r.manufacturer));
    const mfgOptions = [...mfgSet].sort((a,b) => a.localeCompare(b,'pl'))
      .map(m => `<option value="${escHtml(m)}"${filterMfg===m?' selected':''}>${escHtml(m)}</option>`).join('');

    el.innerHTML = `
<div class="compare-summary">
  <div class="compare-stat"><div class="stat-label">Wszystkich SKU</div><div class="stat-value">${rows.length}</div></div>
  <div class="compare-stat"><div class="stat-label">🟢 Oplacalne</div><div class="stat-value green">${green}</div></div>
  <div class="compare-stat"><div class="stat-label">🟡 Neutralne</div><div class="stat-value yellow">${yellow}</div></div>
  <div class="compare-stat"><div class="stat-label">🔴 Drozej</div><div class="stat-value">${red}</div></div>
  <div class="compare-stat"><div class="stat-label">Laczna oszczednosc</div><div class="stat-value ${totalSav>0?'green':''}">${fmtPLN(totalSav)} zl</div></div>
</div>
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
  <div class="toolbar-group" style="margin-left:auto;gap:6px">
    <button class="btn btn--ghost btn--sm" id="cmp-cols-btn">⚙️ Edytuj układ</button>
    <button class="btn btn--ghost btn--sm" id="cmp-refresh-btn">🔄</button>
    <a class="btn btn--ghost btn--sm" href="${exportUrl}" download>⬇️ CSV</a>
  </div>
</div>
<div class="compare-toolbar" style="margin-top:0;padding-top:0;border-top:none;justify-content:flex-end;gap:10px;align-items:center">
  <span style="font-size:.78rem;color:var(--text-muted)">Wyświetlanych: <strong>${pageStart+1}–${pageEnd}</strong> z <strong>${totalRows}</strong></span>
  <div style="display:flex;align-items:center;gap:4px">
    <label style="font-size:.75rem;color:var(--text-muted)">Na str:</label>
    <input type="number" id="cmp-page-size" class="prof-input" style="width:60px;padding:3px 6px;font-size:.78rem" value="${comparePageSize}" min="10" max="5000" step="10">
  </div>
  <button class="btn btn--ghost btn--sm" id="cmp-pg-prev" ${comparePage<=0?'disabled':''}>← Prev</button>
  <span style="font-size:.78rem;color:var(--text-muted)">${comparePage+1} / ${totalPages}</span>
  <button class="btn btn--ghost btn--sm" id="cmp-pg-next" ${comparePage>=totalPages-1?'disabled':''}>Next →</button>
</div>
<div class="compare-table-wrap src-scroll-x">
<table class="compare-table" id="cmp-table">
  <thead><tr>${thead}</tr></thead>
  <tbody>${tbody}</tbody>
</table>
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
      clearTimeout(searchTimer); searchTimer = setTimeout(() => { filterSearch = e.target.value; renderCompare(); }, 400);
    });
    document.getElementById('cmp-avail').addEventListener('change', e => { filterAvail = e.target.checked; renderCompare(); });
    const mfgSel = document.getElementById('cmp-mfg');
    if (mfgSel) mfgSel.addEventListener('change', e => { filterMfg = e.target.value; renderCompare(); });
    const supSel = document.getElementById('cmp-supplier');
    if (supSel) supSel.addEventListener('change', e => { filterSupplierId = e.target.value; renderCompare(); });
    document.getElementById('cmp-savings').addEventListener('change', e => { filterSavings = e.target.value; renderCompare(); });
    document.getElementById('cmp-refresh-btn').addEventListener('click', () => { comparePage=0; renderCompare(); });
    document.getElementById('cmp-pg-prev')?.addEventListener('click', () => { comparePage--; renderCompareTable(el, compareData); });
    document.getElementById('cmp-pg-next')?.addEventListener('click', () => { comparePage++; renderCompareTable(el, compareData); });
    document.getElementById('cmp-page-size')?.addEventListener('change', e => { const v = parseInt(e.target.value); if (v >= 10) { comparePageSize = v; comparePage = 0; renderCompareTable(el, compareData); } });

    // Kolumny toggle
    document.getElementById('cmp-cols-btn').addEventListener('click', () => {
      let CMP_COL_DEFS = [
        {key:'ean', label:'EAN', frozen:true},
        {key:'name', label:'Nazwa', frozen:true},
        {key:'stock', label:'Stan'},
        {key:'sold_30d', label:'Spr.30d'},
        {key:'buy_price', label:'C.zakupu'},
        {key:'buy_price_date', label:'Data zakupu'},
        {key:'best_price', label:'Najlepsza'},
        {key:'best_supplier', label:'Hurtownia'},
        {key:'savings', label:'Oszcz.zł'},
        {key:'savings_pct', label:'Oszcz.%'},
        {key:'signal', label:'Sygnał'}
      ];
      compareData.suppliers.forEach(s => {
        CMP_COL_DEFS.push({key: `sup_${s.id}`, label: s.name + (s.currency && s.currency !== 'PLN' ? ` (${s.currency})` : '')});
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
        renderCompareTable(el, compareData);
      });
    });

    // KLIKNIĘCIE NA CENĘ → modal ofert hurtowni
    document.querySelectorAll('.price-clickable[data-ean]').forEach(td => {
      td.addEventListener('click', () => showSupplierPricesModal(td.dataset.ean, compareData));
    });

    // DWUKLIK NA NAZWĘ → popup produktu
    document.querySelectorAll('.name-dblclick[data-ean]').forEach(td => {
      td.addEventListener('dblclick', () => showProductModal(td.dataset.ean, compareData));
    });

    // Resize + reorder kolumn
    initColResize('cmp-table');
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
      const w = Math.max(44, _resizeState.w0 + e.clientX - _resizeState.x0);
      _resizeState.th.style.width = w + 'px';
      _resizeState.th.style.minWidth = w + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (_resizeState) {
        // Save column width to localStorage
        try {
          const tid = _resizeState.tableId || 'unknown';
          const col = _resizeState.th.dataset.col || _resizeState.th.textContent.trim();
          const w = _resizeState.th.offsetWidth;
          const saved = JSON.parse(localStorage.getItem('sg_colw_' + tid) || '{}');
          saved[col] = w;
          localStorage.setItem('sg_colw_' + tid, JSON.stringify(saved));
        } catch(_) {}
        _resizeState = null; document.body.classList.remove('src-resizing');
      }
    });
  })();

  function initColResize(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    // Apply saved widths from localStorage
    const savedWidths = (() => { try { return JSON.parse(localStorage.getItem('sg_colw_' + tableId) || '{}'); } catch { return {}; } })();
    table.querySelectorAll(':scope > thead > tr > th').forEach(th => {
      const col = th.dataset.col || th.textContent.trim();
      if (savedWidths[col]) {
        th.style.width = savedWidths[col] + 'px';
        th.style.minWidth = savedWidths[col] + 'px';
      }
      if (th.querySelector('.col-rh')) return;
      th.style.position = 'relative'; th.style.overflow = 'hidden';
      const h = document.createElement('div');
      h.className = 'col-rh';
      h.title = 'Przeciągnij aby zmienić szerokość';
      h.addEventListener('mousedown', e => {
        _resizeState = { th, x0: e.clientX, w0: th.offsetWidth, tableId };
        document.body.classList.add('src-resizing');
        e.stopPropagation(); e.preventDefault();
      });
      th.appendChild(h);
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
    });
  }

  /* ═══════════════════════════════════════════════════════
     UTILITIES: resize kolumn (JS) + zmiana kolejności (drag)
  ═══════════════════════════════════════════════════════ */
  let _resizeState = null;
  (function() {
    document.addEventListener('mousemove', e => {
      if (!_resizeState) return;
      const w = Math.max(44, _resizeState.w0 + e.clientX - _resizeState.x0);
      _resizeState.th.style.width = w + 'px';
      _resizeState.th.style.minWidth = w + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (_resizeState) {
        // Save column width to localStorage
        try {
          const tid = _resizeState.tableId || 'unknown';
          const col = _resizeState.th.dataset.col || _resizeState.th.textContent.trim();
          const w = _resizeState.th.offsetWidth;
          const saved = JSON.parse(localStorage.getItem('sg_colw_' + tid) || '{}');
          saved[col] = w;
          localStorage.setItem('sg_colw_' + tid, JSON.stringify(saved));
        } catch(_) {}
        _resizeState = null; document.body.classList.remove('src-resizing');
      }
    });
  })();

  function initColResize(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    // Apply saved widths from localStorage
    const savedWidths = (() => { try { return JSON.parse(localStorage.getItem('sg_colw_' + tableId) || '{}'); } catch { return {}; } })();
    table.querySelectorAll(':scope > thead > tr > th').forEach(th => {
      const col = th.dataset.col || th.textContent.trim();
      if (savedWidths[col]) {
        th.style.width = savedWidths[col] + 'px';
        th.style.minWidth = savedWidths[col] + 'px';
      }
      if (th.querySelector('.col-rh')) return;
      th.style.position = 'relative'; th.style.overflow = 'hidden';
      const h = document.createElement('div');
      h.className = 'col-rh';
      h.title = 'Przeciągnij aby zmienić szerokość';
      h.addEventListener('mousedown', e => {
        _resizeState = { th, x0: e.clientX, w0: th.offsetWidth, tableId };
        document.body.classList.add('src-resizing');
        e.stopPropagation(); e.preventDefault();
      });
      th.appendChild(h);
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
  function showPromoOffersModal(ean, rows) {
    const r = rows.find(x => x.ean === ean);
    if (!r) return;
    Modal.show({
      title: `🔥 Oferty dla: ${escHtml(r.name||ean)}`,
      body: `
<div style="margin-bottom:10px;font-size:.82rem;color:var(--text-secondary)">
  EAN: <strong style="font-family:monospace">${escHtml(ean)}</strong>
  &nbsp;|&nbsp; Oszczędność: <strong class="savings-pos">-${r.savings_pct?.toFixed(1)}%</strong>
</div>
<table class="compare-table">
  <thead><tr><th>Hurtownia</th><th>Super cena</th><th>Cena referencyjna</th><th>Odniesienie</th></tr></thead>
  <tbody><tr class="best-row">
    <td>&#11088; ${escHtml(r.best_supplier||'—')}</td>
    <td class="price-cell">${fmtPLN(r.best_price)}</td>
    <td class="price-cell">${fmtPLN(r.ref_price)}</td>
    <td style="font-size:.8rem;color:var(--text-muted)">${escHtml(r.ref_label||'—')}</td>
  </tr></tbody>
</table>`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`,
    });
  }

  /* ═══════════════════════════════════════════════════════
     TAB 4 — PROMOTIONS
  ═══════════════════════════════════════════════════════ */
  // Patch: remove duplicate supplier cell after encoding fix
  const _origShowPromo = showPromoOffersModal;
  showPromoOffersModal = function(ean, rows) {
    _origShowPromo(ean, rows);
    setTimeout(() => {
      const tds = document.querySelectorAll('.modal .best-row td');
      if (tds.length > 4) tds[1]?.remove();
    }, 20);
  };
    { key:'best_price',   label:'Super cena'   },
    { key:'best_supplier',label:'Hurtownia'    },
    { key:'ref_price',    label:'Cena ref.'    },
    { key:'ref_label',    label:'Odniesienie'  },
    { key:'savings',      label:'Oszcz.'       },
    { key:'availability', label:'Dostępność'   },
    { key:'in_subiekt',   label:'W ofercie'    },
    { key:'stock',        label:'Stan'         },
    { key:'sell_price',   label:'C. sprzedaży' },
  ];

  const PROMO_COL_DEFS = [
    { key:'#',            label:'#',           frozen:true },
    { key:'ean',          label:'EAN'          },
    { key:'manufacturer', label:'Producent'    },
    { key:'name',         label:'Nazwa'        },
    { key:'badge',        label:''             },
    { key:'best_price',   label:'Super cena'   },
    { key:'best_supplier',label:'Hurtownia'    },
    { key:'ref_price',    label:'Cena ref.'    },
    { key:'ref_label',    label:'Odniesienie'  },
    { key:'savings',      label:'Oszcz.'       },
    { key:'availability', label:'Dostępność'   },
    { key:'in_subiekt',   label:'W ofercie'    },
    { key:'stock',        label:'Stan'         },
    { key:'sell_price',   label:'C. sprzedaży' },
  ];

  function promoCell(key, r, i, offset) {
    switch(key) {
      case '#':            return `<td class="row-num">${(offset||0)+i+1}</td>`;
      case 'ean':          return `<td class="ean-cell ean-copy" data-ean="${r.ean}" title="Dwuklik = kopiuj EAN">${escHtml(r.ean)}</td>`;
      case 'manufacturer': return `<td style="white-space:nowrap;color:var(--text-secondary)">${escHtml(r.manufacturer||'—')}</td>`;
      case 'name':         return `<td class="name-dblclick" data-ean="${r.ean}" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" title="${escHtml(r.name||'')}">${escHtml(truncate(r.name||'—',40))}</td>`;
      case 'badge':        return `<td style="text-align:center"><span class="promo-badge promo-flash" title="Super cena" style="padding:0;background:transparent;font-size:1.2rem;box-shadow:none">🔥</span></td>`;
      case 'best_price':   return `<td class="promo-price price-clickable" data-ean="${r.ean}" title="Kliknij = oferty">${fmtPLN(r.best_price)}</td>`;
      case 'best_supplier':return `<td>${escHtml(r.best_supplier||'—')}</td>`;
      case 'ref_price':    return `<td class="promo-ref">${fmtPLN(r.ref_price)}</td>`;
      case 'ref_label':    return `<td style="font-size:.75rem;color:var(--text-muted)">${escHtml(r.ref_label||'')}</td>`;
      case 'savings':      return `<td class="savings-cell savings-pos">-${r.savings_pct?.toFixed(1)||0}%</td>`;
      case 'availability': return `<td><span class="avail-dot ${r.availability||'unknown'}"></span>${r.availability==='available'?'Dostępny':r.availability==='unavailable'?'Brak':'?'}</td>`;
      case 'in_subiekt':   return `<td>${r.in_subiekt?'<span class="signal-badge green">W ofercie</span>':'<span class="signal-badge none">Brak w Sub.</span>'}</td>`;
      case 'stock':        return `<td>${r.stock??'—'}</td>`;
      case 'sell_price':   return `<td class="price-cell">${fmtPLN(r.sell_price)}</td>`;
      default:             return '<td></td>';
    }
  }

  async function renderPromotions() {
    const el = document.getElementById('src-tab-promotions');
    el.innerHTML = '<div class="sourcing-empty"><span class="empty-icon">⏳</span><p>Szukam promocji...</p></div>';
    try {
      const p = new URLSearchParams({ threshold: promoThreshold, onlyAvailable: promoAvail, search: promoSearch });
      const rows = await API.get(`/sourcing/promotions?${p}`);
      if (!rows.length) {
        el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">🔥</span><h3>Brak promocji</h3>
          <p>Dodaj więcej hurtowni lub obniż próg (aktualnie ${promoThreshold}%).</p></div>`;
        return;
      }
      const exportUrl = `/api/sourcing/promotions/export?${p}`;
      const order = getColOrder('promotions', PROMO_COL_DEFS);
      const thead = order.map(k => {
        const d = PROMO_COL_DEFS.find(c => c.key===k);
        const cls = k==='#' ? ' class="row-num-th"' : '';
        const sortable = !['#','badge'].includes(k);
        const sortIc = promoSortCol===k ? (promoSortAsc ? '↑' : '↓') : (sortable ? '↕' : '');
        const sortCls = sortable ? ` class="promo-sortable" data-sort="${k}" style="cursor:pointer"` : '';
        return `<th${cls}${sortCls}>${escHtml(d?.label||k)} ${sortIc}</th>`;
      }).join('');
      // Sort promotions if needed
      let sortedPromo = rows;
      if (promoSortCol) {
        sortedPromo = [...rows].sort((a, b) => {
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

      const tbody = promoPageRows.map((r,i) => `<tr data-ean="${r.ean}">${order.map(k=>promoCell(k,r,i,promoStart)).join('')}</tr>`).join('');
      el.innerHTML = `
<div class="compare-toolbar" style="margin-bottom:16px">
  <div class="toolbar-group"><label>🔍</label>
    <input class="compare-search" id="promo-search" placeholder="Szukaj EAN/nazwa..." value="${escHtml(promoSearch)}">
  </div>
  <div class="toolbar-group"><label>Próg:</label>
    <select id="promo-thresh">
      ${[5,10,15,20,30].map(v=>`<option value="${v}"${promoThreshold===v?' selected':''}>${v}%</option>`).join('')}
    </select>
  </div>
  <div class="toolbar-group toggle-switch">
    <input type="checkbox" id="promo-avail" ${promoAvail?'checked':''}><label for="promo-avail">Tylko dostępne</label>
  </div>
  <div class="toolbar-group" style="margin-left:auto;gap:8px">
    <span style="font-size:.82rem;color:var(--text-muted)"><strong style="color:var(--text-primary)">${rows.length}</strong> z super ceną (≥${promoThreshold}%)</span>
    <button class="btn btn--ghost btn--sm" id="promo-cols-btn">✏️ Edytuj układ</button>
    <a class="btn btn--ghost btn--sm" href="${exportUrl}" download>⬇️ CSV</a>
  </div>
</div>
<div class="compare-toolbar" style="margin-top:0;padding-top:0;border-top:none;justify-content:flex-end;gap:10px;align-items:center">
  <span style="font-size:.78rem;color:var(--text-muted)">Wyświetlanych: <strong>${promoStart+1}–${promoEnd}</strong> z <strong>${totalPromo}</strong></span>
  <div style="display:flex;align-items:center;gap:4px">
    <label style="font-size:.75rem;color:var(--text-muted)">Na str:</label>
    <input type="number" id="promo-page-size" class="prof-input" style="width:60px;padding:3px 6px;font-size:.78rem" value="${promoPageSize}" min="10" max="5000" step="10">
  </div>
  <button class="btn btn--ghost btn--sm" id="promo-pg-prev" ${promoPage<=0?'disabled':''}>← Prev</button>
  <span style="font-size:.78rem;color:var(--text-muted)">${promoPage+1} / ${totalPromoPages}</span>
  <button class="btn btn--ghost btn--sm" id="promo-pg-next" ${promoPage>=totalPromoPages-1?'disabled':''}>Next →</button>
</div>
<div class="promo-table-wrap src-scroll-x">
<table class="promo-table" id="promo-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>
<div style="font-size:.72rem;color:var(--text-muted);margin-top:6px;padding:0 4px">
  💡 Kliknij na cenę = oferty &nbsp;|&nbsp; Dwuklik na EAN = kopiuj &nbsp;|&nbsp; Dwuklik na nazwę = szczegóły
</div>`;
      let t;
      document.getElementById('promo-search').addEventListener('input', e => { clearTimeout(t); t=setTimeout(()=>{ promoSearch=e.target.value; promoPage=0; renderPromotions(); },400); });
      document.getElementById('promo-thresh').addEventListener('change', e => { promoThreshold=parseInt(e.target.value); promoPage=0; renderPromotions(); });
      document.getElementById('promo-avail').addEventListener('change', e => { promoAvail=e.target.checked; promoPage=0; renderPromotions(); });
      document.getElementById('promo-cols-btn').addEventListener('click', () => showColLayoutModal('promotions', PROMO_COL_DEFS, () => renderPromotions()));
      document.getElementById('promo-pg-prev')?.addEventListener('click', () => { promoPage--; renderPromotions(); });
      document.getElementById('promo-pg-next')?.addEventListener('click', () => { promoPage++; renderPromotions(); });
      document.getElementById('promo-page-size')?.addEventListener('change', e => { const v = parseInt(e.target.value); if (v >= 10) { promoPageSize = v; promoPage = 0; renderPromotions(); } });

      // Sorting for promotions
      document.querySelectorAll('#promo-table .promo-sortable[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.sort;
          if (promoSortCol === col) promoSortAsc = !promoSortAsc;
          else { promoSortCol = col; promoSortAsc = true; }
          renderPromotions();
        });
      });

      document.querySelectorAll('#promo-table .price-clickable[data-ean]').forEach(td => {
        td.addEventListener('click', () => showPromoOffersModal(td.dataset.ean, rows));
      });
      document.querySelectorAll('#promo-table .name-dblclick[data-ean]').forEach(td => {
        td.addEventListener('dblclick', () => showProductModalSimple(td.dataset.ean, rows, 'name','best_price','best_supplier'));
      });
      document.querySelectorAll('#promo-table .ean-copy[data-ean]').forEach(td => {
        td.addEventListener('dblclick', () => copyEan(td.dataset.ean));
      });
      initColResize('promo-table');
    } catch(e) { el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">⚠️</span><h3>Błąd</h3><p>${escHtml(e.message)}</p></div>`; }
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
        { key:'#',            label:'#',                  frozen:true },
        { key:'ean',          label:'EAN'                 },
        { key:'name',         label:'Nazwa'               },
        { key:'manufacturer', label:'Producent'           },
        { key:'best_supplier',label:'Najtansza hurtownia' },
        { key:'best_price',   label:'Cena'                },
        { key:'availability', label:'Dostepnosc'          },
      ];
      const misColOrder = getColOrder('missing', MISSING_COL_DEFS);
      const misHead = misColOrder.map(k => {
        const d = MISSING_COL_DEFS.find(c=>c.key===k);
        const sortable = !['#'].includes(k);
        const sortIc = missingSortCol===k ? (missingSortAsc ? '↑' : '↓') : (sortable ? '↕' : '');
        const sortCls = sortable ? ` class="mis-sortable" data-sort="${k}" style="cursor:pointer"` : '';
        return `<th${k==="#"?` class="row-num-th"`:``}${sortCls}>${escHtml(d?.label||k)} ${sortIc}</th>`;
      }).join('');
      function misCell(key, r, i) {
        switch(key) {
          case '#':            return `<td class="row-num">${i + missingOffset + 1}</td>`;
          case 'ean':          return `<td class="ean-cell ean-copy" data-ean="${r.ean}" title="Dwuklik = kopiuj EAN">${escHtml(r.ean)}</td>`;
          case 'name':         return `<td class="name-dblclick" data-ean="${r.ean}" style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" title="${escHtml(r.name||'')}">${escHtml(truncate(r.name||'(brak nazwy)',42))}</td>`;
          case 'manufacturer': return `<td style="white-space:nowrap;color:var(--text-secondary)">${escHtml(r.manufacturer||'—')}</td>`;
          case 'best_supplier':return `<td style="white-space:nowrap">${escHtml(r.best_supplier||'—')}</td>`;
          case 'best_price':   return `<td class="price-cell best-price price-clickable" data-ean="${r.ean}" title="Kliknij = oferty">${fmtPLN(r.best_price)}</td>`;
          case 'availability': return `<td><span class="avail-dot ${r.availability||'unknown'}"></span>${r.availability==='available'?'Dostepny':r.availability==='unavailable'?'Brak':'?'}</td>`;
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
      const pager = total > limit ? `
<div class="sourcing-pager">
  <button class="btn btn--ghost btn--sm" id="mis-prev" ${offset===0?'disabled':''}>← Poprzednia</button>
  <span style="font-size:.82rem;color:var(--text-muted)">Strona ${curPage} z ${pages} (${total} lacznie)</span>
  <button class="btn btn--ghost btn--sm" id="mis-next" ${offset+limit>=total?'disabled':''}>Nastepna →</button>
</div>` : `<div style="font-size:.82rem;color:var(--text-muted);padding:4px 0">Lacznie: <strong style="color:var(--text-primary)">${total}</strong> produktow nieobecnych w Subiekcie</div>`;

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
  <div class="toolbar-group" style="margin-left:auto;gap:8px">
    <button class="btn btn--ghost btn--sm" id="mis-cols-btn">✏️ Edytuj uklad</button>
  </div>
</div>
${pager}
<div class="missing-table-wrap src-scroll-x">
<table class="missing-table" id="mis-table"><thead><tr>${misHead}</tr></thead><tbody>${tbody}</tbody></table></div>
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
      document.getElementById('mis-cols-btn')?.addEventListener('click', () => showColLayoutModal('missing', MISSING_COL_DEFS, () => renderMissing()));

      // Sorting for missing
      document.querySelectorAll('#mis-table .mis-sortable[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.sort;
          if (missingSortCol === col) missingSortAsc = !missingSortAsc;
          else { missingSortCol = col; missingSortAsc = true; }
          renderMissing();
        });



      });

      document.querySelectorAll('#mis-table .price-clickable[data-ean]').forEach(td => {
        td.addEventListener('click', () => showProductModalSimple(td.dataset.ean, rows, 'name','best_price','best_supplier'));
      });
      document.querySelectorAll('#mis-table .name-dblclick[data-ean]').forEach(td => {
        td.addEventListener('dblclick', () => showProductModalSimple(td.dataset.ean, rows, 'name','best_price','best_supplier'));
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

      const groupsHtml = !pageGroups.length
        ? '<div class="sourcing-empty" style="padding:40px"><span class="empty-icon">📦</span><h3>Brak pozycji</h3><p>Zmien filtry lub zaimportuj dane Subiekta.</p></div>'
        : pageGroups.map(g => {
          const origRows = g.origGroup ? g.origGroup.rows : g.rows;
          const needed_total = origRows.reduce((s,r) => s+(r.suggested_qty||0), 0);
          const cost_total   = origRows.reduce((s,r) => s+(r.best_price||0)*Math.max(0,r.suggested_qty||0), 0);
          
          let trs = g.rows.map((r) => {















            const needClass = r.suggested_qty > 0 ? '' : 'style="opacity:.5"';


            let globalIdx = allRows.indexOf(r) + 1;
            return `<tr ${needClass}>
              <td class="row-num">${globalIdx}</td>
              <td class="ean-cell ean-copy" data-ean="${r.ean}" style="white-space:nowrap" title="Dwuklik = kopiuj EAN">${escHtml(r.ean)}</td>
              <td style="min-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(r.name||'—')}</td>
              <td style="color:var(--text-secondary);white-space:nowrap">${escHtml(r.manufacturer||'—')}</td>
              <td style="text-align:right">${r.stock??0}</td>
              <td style="text-align:right">${r.sold_30d??0}</td>
              <td style="text-align:right">${r.needed_qty??0}</td>
              <td><input class="restock-qty-input" data-ean="${r.ean}" type="number" min="0"
                value="${r.qty_override!==null?r.qty_override:(r.sold_30d??0)}" title="Reczna korekta bazy 30d" style="display:none"></td>
              <td class="restock-suggested" style="text-align:right">${r.suggested_qty>0?`<strong style="color:#10b981">${r.suggested_qty}</strong>`:'✓'}</td>
              <td class="price-cell" style="white-space:nowrap">${fmtPLN(r.buy_price)}</td>
              <td class="price-cell best-price" style="white-space:nowrap">${fmtPLN(r.best_price)}</td>
              <td><span class="avail-dot ${r.availability||'unknown'}"></span>${r.availability==='available'?'Tak':r.availability==='unavailable'?'Nie':'?'}</td>
            </tr>`;
          }).join('');
          return `
<div class="restock-group-header">🏭 ${escHtml(g.supplier)}
  <span class="group-count">${origRows.length} SKU &nbsp;| Do zam.: <strong>${needed_total}</strong> szt. &nbsp;| Est. koszt: ${fmtPLN(cost_total)} zl</span>
</div>
<div class="src-scroll-x">
<table class="restock-table" data-rst-table style="min-width:980px"><thead><tr>
  <th class="row-num-th">#</th><th class="rst-sortable" data-sort="ean" style="cursor:pointer">EAN ${restockSortCol==='ean'?(restockSortAsc?'↑':'↓'):'↕'}</th><th class="rst-sortable" data-sort="name" style="cursor:pointer">Nazwa ${restockSortCol==='name'?(restockSortAsc?'↑':'↓'):'↕'}</th><th class="rst-sortable" data-sort="manufacturer" style="cursor:pointer">Producent ${restockSortCol==='manufacturer'?(restockSortAsc?'↑':'↓'):'↕'}</th>
  <th class="rst-sortable" data-sort="stock" style="text-align:center;cursor:pointer">Stan ${restockSortCol==='stock'?(restockSortAsc?'↑':'↓'):'↕'}</th><th class="rst-sortable" data-sort="sold_30d" style="text-align:center;cursor:pointer">Spr.30d ${restockSortCol==='sold_30d'?(restockSortAsc?'↑':'↓'):'↕'}</th>
  <th style="text-align:right">Potrzeba&nbsp;(${restockDays}d)</th>
  <th style="text-align:right">Do&nbsp;zamowienia</th>
  <th>C.&nbsp;zakupu</th><th class="rst-sortable" data-sort="best_price" style="cursor:pointer">C.&nbsp;hurtowni ${restockSortCol==='best_price'?(restockSortAsc?'↑':'↓'):'↕'}</th><th>Dost.</th>
</tr></thead><tbody>${trs}</tbody></table></div>`;
        }).join('');
      const pagerHtml = totalItems > restockPageSize ? `
<div class="sourcing-pager" style="margin-top:10px;margin-bottom:10px">
  <button class="btn btn--ghost btn--sm rst-prev-btn" ${restockPage===0?'disabled':''}>← Poprzednia</button>
  <span style="font-size:.82rem;color:var(--text-muted)">Strona ${restockPage+1} z ${totalPages} (${totalItems} lacznie)</span>
  <button class="btn btn--ghost btn--sm rst-next-btn" ${restockPage>=totalPages-1?'disabled':''}>Nastepna →</button>
</div>` : '';

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
  <div class="toolbar-group" style="margin-left:auto">
    <span style="font-size:.82rem;color:var(--text-muted)"><strong style="color:var(--text-primary)">${total}</strong> pozycji</span>
    <a class="btn btn--ghost btn--sm" href="${exportUrl}" download>⬇️ CSV</a>
  </div>
</div>
<div class="restock-wrap" id="rst-wrap">${pagerHtml}${groupsHtml}${pagerHtml}</div>`;

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

      // Sorting for restock
      document.querySelectorAll('#rst-wrap .rst-sortable[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.sort;
          if (restockSortCol === col) restockSortAsc = !restockSortAsc;
          else { restockSortCol = col; restockSortAsc = true; }
          renderRestock();
        });
      });

      document.querySelectorAll('.restock-qty-input[data-ean]').forEach(inp => {
        inp.addEventListener('change', async () => {
          const ean = inp.dataset.ean, qty = parseInt(inp.value)||0;
          try { await API.patch('/sourcing/restock/override', {ean, qty}); renderRestock(); }
          catch(e) { Toast.error('Blad zapisu: ' + e.message); }
        });
      });

      // Resize + reorder dla wszystkich tabel restock
      document.querySelectorAll('[data-rst-table]').forEach((t, idx) => {
        if (!t.id) t.id = 'rst-table-' + idx;
        initColResize(t.id);
      });

      // Sorting for restock
      document.querySelectorAll('.rst-sortable[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.sort;
          if (restockSortCol === col) restockSortAsc = !restockSortAsc;
          else { restockSortCol = col; restockSortAsc = true; }
          renderRestock();
        });
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
    const avail = sp.availability==='available'?'✅':'❌';
    return `<div style="display:flex;gap:10px;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.82rem">
      <span style="flex:1">${avail} ${escHtml(s.name)}</span>
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
  let listingPlatform = '', listingSearch = '', listingPage = 0;
  let listingSort = '', listingAsc = true;
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
  <h3>Brak danych wystawien</h3>
  <p>Wgraj plik wystawien marketplace w zakładce <strong>Import Subiekta</strong>.<br>
  Wymagana kolumna: <strong>zrodlo nazwa</strong> (platforma) oraz <strong>EAN</strong>.</p>
</div>`;
      return;
    }

    // Load coverage + gaps in parallel
    let coverage = [], gapData = { rows: [], total: 0, platforms: [] };
    try { coverage = await API.get('/sourcing/listing/coverage'); } catch {}
    try {
      const qs = new URLSearchParams({ platform: listingPlatform, search: listingSearch, limit: LISTING_PAGE_SIZE, offset: listingPage * LISTING_PAGE_SIZE, sort: listingSort, asc: listingAsc ? '1' : '0' });
      gapData = await API.get('/sourcing/listing/gaps?' + qs);
    } catch(e) {
      el.innerHTML = `<div class="sourcing-empty"><span class="empty-icon">&#10060;</span><h3>Blad</h3><p>${escHtml(e.message)}</p></div>`;
      return;
    }

    const platforms = gapData.platforms;
    const platOpts = ['', ...platforms].map(p =>
      `<option value="${escHtml(p)}"${listingPlatform===p?' selected':''}>${p||'— wszystkie platformy —'}</option>`
    ).join('');

    // Coverage bars
    const coverageBars = coverage.map(c => `
<div class="listing-cov-row">
  <span class="listing-cov-name">${escHtml(c.platform)}</span>
  <div class="listing-cov-bar-wrap">
    <div class="listing-cov-bar" style="width:${c.pct}%"></div>
  </div>
  <span class="listing-cov-pct">${c.listed}/${c.total} (${c.pct}%)</span>
  <button class="btn btn--ghost btn--sm listing-filter-btn" data-platform="${escHtml(c.platform)}">Pokaz luki</button>
</div>`).join('');

    // Build table rows
    const totalPages = Math.ceil(gapData.total / LISTING_PAGE_SIZE);
    const rows = gapData.rows.map((r, i) => {
      const presentBadges = r.present_on.map(p => `<span class="listing-badge present">${escHtml(p)}</span>`).join('');
      const missingBadges = r.missing_on.map(p => `<span class="listing-badge missing">${escHtml(p)}</span>`).join('');
      return `<tr>
        <td class="row-num">${listingPage * LISTING_PAGE_SIZE + i + 1}</td>
        <td class="ean-cell ean-copy" data-ean="${escHtml(r.ean)}" title="Kliknij — kopiuj">${escHtml(r.ean)}</td>
        <td style="min-width:220px;max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${escHtml(r.name||'')}">${escHtml(r.name||'(brak nazwy)')}</td>
        <td style="text-align:right">${r.stock??'-'}</td>
        <td style="text-align:right">${r.sold_30d??'-'}</td>
        <td>${fmtPLN(r.buy_price)}</td>
        <td>${presentBadges||'<span style="color:var(--text-muted);font-size:.72rem">brak</span>'}</td>
        <td>${missingBadges||'<span style="color:#10b981;font-size:.72rem">&#10003; wszędzie</span>'}</td>
      </tr>`;
    }).join('');

    const exportUrl = `/api/sourcing/listing/gaps/export.csv?platform=${encodeURIComponent(listingPlatform)}&search=${encodeURIComponent(listingSearch)}`;

    el.innerHTML = `
<div class="listing-header-section">
  <div class="listing-coverage-panel">
    <h4 style="margin:0 0 12px;font-size:.9rem;font-weight:700">&#128202; Pokrycie platform</h4>
    <div class="listing-cov-list">${coverageBars}</div>
  </div>
</div>

<div class="compare-toolbar" style="margin-top:18px">
  <div class="toolbar-group">
    <label>&#127760; Platforma:</label>
    <select id="lst-platform">${platOpts}</select>
  </div>
  <div class="toolbar-group">
    <label>&#128269;</label>
    <input class="compare-search" id="lst-search" placeholder="Szukaj EAN lub nazwy..." value="${escHtml(listingSearch)}">
  </div>
  <div class="toolbar-group" style="margin-left:auto">
    <a class="btn btn--secondary btn--sm" href="${exportUrl}" download>&#8659; Eksport CSV</a>
  </div>
</div>

<div class="listing-pager" style="font-size:.82rem;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:center;gap:12px">
  <span>Znaleziono: <strong>${gapData.total}</strong> produktow${listingPlatform ? ' bez wystawienia na <strong>' + escHtml(listingPlatform) + '</strong>' : ''}</span>
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
      <th class="lst-th" data-col="stock" style="text-align:right;cursor:pointer">Stan ${listingSort==='stock'?(listingAsc?'&#x25B2;':'&#x25BC;'):'&#x2195;'}</th>
      <th class="lst-th" data-col="sold_30d" style="text-align:right;cursor:pointer">Spr.30d ${listingSort==='sold_30d'?(listingAsc?'&#x25B2;':'&#x25BC;'):'&#x2195;'}</th>
      <th class="lst-th" data-col="buy_price" style="cursor:pointer">C.zakupu ${listingSort==='buy_price'?(listingAsc?'&#x25B2;':'&#x25BC;'):'&#x2195;'}</th>
      <th>Wystawione na</th>
      <th>Brakuje na</th>
    </tr></thead>
    <tbody>${rows||'<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Brak wynikow dla wybranych filtrów</td></tr>'}</tbody>
  </table>
</div>`;

    // Bind controls
    let _lstTimer;
    document.getElementById('lst-platform').addEventListener('change', e => {
      listingPlatform = e.target.value; listingPage = 0; renderListing();
    });
    document.getElementById('lst-search').addEventListener('input', e => {
      clearTimeout(_lstTimer); _lstTimer = setTimeout(() => { listingSearch = e.target.value; listingPage = 0; renderListing(); }, 400);
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
      btn.addEventListener('click', () => { listingPlatform = btn.dataset.platform; listingPage = 0; renderListing(); });
    });

    // EAN copy
    el.querySelectorAll('.ean-copy').forEach(td => {
      td.addEventListener('click', () => {
        navigator.clipboard?.writeText(td.dataset.ean).then(() => Toast.success('Skopiowano EAN'));
      });
    });
  }
    /* ═══════════════════════════════════════════════════════
     EXPORT API
  ═══════════════════════════════════════════════════════ */
  async function _saveSupConfig(id) {
      const c   = document.getElementById('cfg-currency').value;
      const r   = document.getElementById('cfg-rate').value;
      const cs  = document.getElementById('cfg-cols').value;
      const u   = document.getElementById('cfg-url-user')?.value || '';
      const p   = document.getElementById('cfg-url-pass')?.value || '';
      try {
        if (cs) JSON.parse(cs); // walidacja
        await API.patch(`/sourcing/suppliers/${id}`, {
          currency: c, exchange_rate: r, col_settings: cs,
          url_user: u, url_pass: p
        });
        Toast.success('Zapisano ustawienia');
        Modal.hide();
        renderSuppliers();
      } catch(e) { Toast.error(e.message); }
  }

  function _setSourceType(type) {
      _sourceType = type;
      // highlight active tab button
      ['url','file','ftp','elko_api','impakt_api'].forEach(t => {
        const b = document.getElementById(`st-${t}`);
        if(b) b.classList.toggle('active', t === type);
      });
      const w1 = document.getElementById('sup-url-wrap');       if(w1) w1.style.display      = type==='url'      ? 'block':'none';
      const w2 = document.getElementById('sup-url-auth-wrap');  if(w2) w2.style.display      = type==='url'      ? 'block':'none';
      const w3 = document.getElementById('sup-file-wrap');      if(w3) w3.style.display      = type==='file'     ? 'block':'none';
      const w4 = document.getElementById('sup-ftp-wrap');       if(w4) w4.style.display      = type==='ftp'      ? 'block':'none';
      const w5 = document.getElementById('sup-elko-fields');    if(w5) w5.style.display      = type==='elko_api' ? 'block':'none';
      const w6 = document.getElementById('sup-impakt-fields');  if(w6) w6.style.display      = type==='impakt_api'? 'block':'none';
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

  const api = {
    render,
    _saveSupConfig,
    _setSourceType,
    _setElkoTab,
    _testElkoApi,
    _testImpaktApi,
    _uploadElkoBrandFiles,
  };

  window.SourcingView = api;
  return api;
})();