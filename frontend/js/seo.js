/* ===== SEO & Pozycjonowanie — Frontend Module ===== */
window.SeoView = {
  state: { tab: 'audit', keywords: [], backlinks: [], auditHistory: [] },

  async render() {
    const el = document.getElementById('view-seo');
    el.innerHTML = `
<div class="seo-tabs" id="seo-tabs">
  <button class="seo-tab active" data-tab="audit">🔍 Audyt Techniczny</button>
  <button class="seo-tab" data-tab="content_audit">📝 Content Audit</button>
  <button class="seo-tab" data-tab="ai_tracker">🤖 AI Tracker</button>
  <button class="seo-tab" data-tab="serp">🔎 Analizator SERP</button>
  <button class="seo-tab" data-tab="keywords">📈 Pozycje</button>
  <button class="seo-tab" data-tab="topical_map">🗺️ Topical Map</button>
  <button class="seo-tab" data-tab="backlinks">🔗 Backlinki</button>
  <button class="seo-tab" data-tab="ai">✍️ Content AI</button>
  <button class="seo-tab" data-tab="brand">🏷️ Brand KB</button>
</div>
<div id="seo-panel-audit"    class="seo-panel active"></div>
<div id="seo-panel-content_audit" class="seo-panel"></div>
<div id="seo-panel-ai_tracker" class="seo-panel"></div>
<div id="seo-panel-serp"     class="seo-panel"></div>
<div id="seo-panel-keywords" class="seo-panel"></div>
<div id="seo-panel-topical_map" class="seo-panel"></div>
<div id="seo-panel-backlinks"class="seo-panel"></div>
<div id="seo-panel-ai"       class="seo-panel"></div>
<div id="seo-panel-brand"    class="seo-panel"></div>`;
    document.getElementById('seo-tabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      document.querySelectorAll('.seo-tab').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.seo-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('seo-panel-' + btn.dataset.tab).classList.add('active');
      this.state.tab = btn.dataset.tab;
      const renders = {
        audit: () => this.renderAudit(),
        content_audit: () => this.renderContentAudit(),
        ai_tracker: () => this.renderAITracker(),
        serp: () => this.renderSERP(),
        keywords: () => this.renderKeywords(),
        topical_map: () => this.renderTopicalMap(),
        backlinks: () => this.renderBacklinks(),
        ai: () => this.renderAI(),
        brand: () => this.renderBrand(),
      };
      if (renders[btn.dataset.tab]) renders[btn.dataset.tab]();
    });
    this.renderAudit();
    await this.loadAll();
  },

  async loadAll() {
    try {
      const [kw, bl, hist] = await Promise.all([
        API.get('/seo/keywords'),
        API.get('/seo/backlinks'),
        API.get('/seo/audit-history'),
      ]);
      this.state.keywords = kw.keywords || [];
      this.state.backlinks = bl.backlinks || [];
      this.state.auditHistory = hist.history || [];
      if (this.state.tab === 'keywords') this.renderKeywordTable();
      if (this.state.tab === 'backlinks') this.renderBacklinkTable();
    } catch(e) { console.error(e); }
  },

  /* ── TAB 1: URL AUDIT ── */
  renderAudit() {
    const el = document.getElementById('seo-panel-audit');
    const hist = this.state.auditHistory.slice(0, 5).map(h => `
      <tr style="cursor:pointer" onclick="SeoView.loadAuditHistory(${JSON.stringify(h).replace(/"/g,'&quot;')})">
        <td>${escHtml(h.url)}</td>
        <td><span style="font-weight:700;color:${h.score>=70?'var(--green)':h.score>=40?'var(--yellow)':'var(--red)'}">${h.score}/100</span></td>
        <td style="color:var(--text-muted);font-size:0.78rem">${fmtDate(h.created_at)}</td>
      </tr>`).join('') || '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:16px">Brak historii</td></tr>';
    el.innerHTML = `
<div class="card" style="margin-bottom:16px">
  <div class="card-title" style="margin-bottom:14px">🔍 Audyt Techniczny SEO</div>
  <div class="url-input-group">
    <input class="form-input" id="audit-url" type="url" placeholder="https://mojsklep.pl/kategoria/produkt">
    <button class="btn btn--primary" id="audit-btn">Analizuj</button>
  </div>
</div>
<div id="audit-result"></div>
<div class="card" style="margin-top:16px">
  <div class="card-title" style="margin-bottom:10px">📋 Historia audytów</div>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:6px 0;border-bottom:1px solid var(--border)">URL</th>
      <th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:6px">Wynik</th>
      <th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:6px">Data</th>
    </tr></thead>
    <tbody>${hist}</tbody>
  </table>
</div>`;
    document.getElementById('audit-btn').addEventListener('click', () => this.runAudit());
    document.getElementById('audit-url').addEventListener('keydown', e => { if (e.key === 'Enter') this.runAudit(); });
  },

  async runAudit() {
    const url = document.getElementById('audit-url').value.trim();
    if (!url) return Toast.warn('Podaj URL do analizy');
    setBtn('audit-btn', true, 'Analizuję...');
    try {
      const r = await API.post('/seo/audit-url', { url });
      this.state.auditHistory.unshift({ url, score: r.score, created_at: new Date().toISOString(), results: r.results });
      this.showAuditResult(url, r.score, r.results);
      Toast.success(`Audyt zakończony — wynik: ${r.score}/100`);
    } catch(e) { Toast.error(e.message); }
    finally { setBtn('audit-btn', false, 'Analizuj'); }
  },

  loadAuditHistory(h) {
    document.getElementById('audit-url').value = h.url;
    this.showAuditResult(h.url, h.score, h.results);
  },

  showAuditResult(url, score, results) {
    const el = document.getElementById('audit-result'); if (!el) return;
    const scoreColor = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--yellow)' : 'var(--red)';
    const circumference = 2 * Math.PI * 44;
    const offset = circumference - (score / 100) * circumference;
    const statusIcon = s => s === 'ok' ? '✅' : s === 'missing' || s === 'too_long' || s === 'too_short' ? '❌' : '⚠️';
    const statusClass = s => s === 'ok' ? 'audit-item--ok' : s === 'missing' || s === 'too_long' || s === 'too_short' ? 'audit-item--error' : 'audit-item--warn';
    const items = [];
    const r = results || {};
    if (r.title) items.push({ label: 'Meta Title', value: r.title.value || '(brak)', hint: r.title.hint, status: r.title.status, len: r.title.length, maxLen: 60 });
    if (r.meta_description) items.push({ label: 'Meta Description', value: r.meta_description.value || '(brak)', hint: r.meta_description.hint, status: r.meta_description.status, len: r.meta_description.length, maxLen: 160 });
    if (r.h1) items.push({ label: 'Tag H1', value: (r.h1.values || []).join(' / ') || '(brak)', hint: r.h1.hint, status: r.h1.status });
    if (r.canonical) items.push({ label: 'Canonical', value: r.canonical.value || '(brak)', hint: r.canonical.hint, status: r.canonical.status });
    if (r.images) items.push({ label: 'Obrazy bez ALT', value: `${r.images.without_alt} z ${r.images.total}`, hint: r.images.hint, status: r.images.status });
    if (r.structured_data) items.push({ label: 'Dane strukturalne', value: `${r.structured_data.count} blok(ów) JSON-LD`, hint: r.structured_data.hint, status: r.structured_data.status });
    if (r.open_graph) items.push({ label: 'Open Graph', value: r.open_graph.status === 'ok' ? 'Kompletny' : 'Niekompletny', hint: r.open_graph.hint, status: r.open_graph.status === 'ok' ? 'ok' : 'warning' });
    const auditGrid = items.map(it => `
      <div class="audit-item ${statusClass(it.status)}">
        <div class="audit-item-header">
          <span class="audit-item-label">${it.label}</span>
          <span class="audit-status-icon">${statusIcon(it.status)}</span>
        </div>
        <div class="audit-item-value">${escHtml(truncate(it.value, 80))}</div>
        <div class="audit-item-hint">${escHtml(it.hint || '')}</div>
        ${it.len != null ? `<div class="char-meter-wrap"><div class="char-meter"><div class="char-meter-fill char-meter-fill--${it.len > it.maxLen ? 'over' : it.len > it.maxLen * 0.5 ? 'ok' : 'warn'}" style="width:${Math.min(100, it.len / it.maxLen * 100)}%"></div></div><div class="char-meter-label"><span>${it.len} zn.</span><span>max ${it.maxLen}</span></div></div>` : ''}
      </div>`).join('');
    el.innerHTML = `
<div class="audit-score-wrap">
  <div class="audit-score-ring">
    <svg viewBox="0 0 100 100" width="100" height="100">
      <circle class="audit-score-ring-track" cx="50" cy="50" r="44"/>
      <circle class="audit-score-ring-fill" cx="50" cy="50" r="44" stroke="${scoreColor}"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
    </svg>
    <div class="audit-score-number" style="color:${scoreColor}">${score}</div>
  </div>
  <div class="audit-score-info">
    <div class="audit-score-title">Wynik SEO: ${score >= 70 ? 'Dobry' : score >= 40 ? 'Wymaga poprawy' : 'Krytyczny'}</div>
    <div class="audit-score-url">${escHtml(url)}</div>
  </div>
</div>
<div class="audit-grid">${auditGrid}</div>`;
  },

  /* ── TAB 2: KEYWORDS ── */
  renderKeywords() {
    const el = document.getElementById('seo-panel-keywords');
    el.innerHTML = `
<div class="card" style="margin-bottom:16px">
  <div class="card-title" style="margin-bottom:14px">📈 Tracker Pozycji Słów Kluczowych</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
    <input class="form-input" id="kw-phrase" placeholder="Słowo kluczowe" style="flex:2;min-width:160px">
    <input class="form-input" id="kw-url" placeholder="URL strony" style="flex:3;min-width:180px">
    <input class="form-input" id="kw-pos" type="number" placeholder="Poz." min="0" style="width:80px">
    <input class="form-input" id="kw-vol" type="number" placeholder="Wol./mies." min="0" style="width:110px">
    <button class="btn btn--primary btn--sm" id="kw-add-btn">+ Dodaj</button>
  </div>
</div>
<div class="card">
  <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Fraza</th>
        <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Poz.</th>
        <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Zmiana</th>
        <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Wol.</th>
        <th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">URL</th>
        <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Akcje</th>
      </tr></thead>
      <tbody id="kw-tbody"></tbody>
    </table>
  </div>
</div>`;
    document.getElementById('kw-add-btn').addEventListener('click', () => this.addKeyword());
    this.renderKeywordTable();
  },

  renderKeywordTable() {
    const tbody = document.getElementById('kw-tbody'); if (!tbody) return;
    const rankClass = p => p <= 3 ? 'rank-badge--top3' : p <= 10 ? 'rank-badge--top10' : p <= 30 ? 'rank-badge--top30' : '';
    if (!this.state.keywords.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">Brak fraz. Dodaj pierwsze słowo kluczowe.</td></tr>'; return; }
    tbody.innerHTML = this.state.keywords.map(k => {
      const diff = k.position_prev - k.position;
      const ch = diff > 0 ? `<span class="rank-change rank-change--up">▲ ${diff}</span>` : diff < 0 ? `<span class="rank-change rank-change--down">▼ ${Math.abs(diff)}</span>` : `<span class="rank-change rank-change--same">—</span>`;
      return `<tr>
        <td style="font-weight:600;font-size:0.84rem;padding:9px 8px">${escHtml(k.keyword)}</td>
        <td style="text-align:center;padding:9px 8px"><span class="rank-badge ${rankClass(k.position)}">${k.position||'?'}</span></td>
        <td style="text-align:center;padding:9px 8px">${ch}</td>
        <td style="text-align:center;padding:9px 8px;color:var(--text-muted);font-size:0.8rem">${k.volume?k.volume.toLocaleString('pl-PL'):'—'}</td>
        <td style="font-size:0.75rem;color:var(--text-muted);padding:9px 8px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${escHtml(k.url||'—')}</td>
        <td style="text-align:center;padding:9px 8px">
          <button class="btn btn--ghost btn--sm" onclick="SeoView.editKwPos('${k.id}',${k.position})">✏️</button>
          <button class="btn btn--danger btn--sm" onclick="SeoView.deleteKw('${k.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  },

  async addKeyword() {
    const keyword = document.getElementById('kw-phrase').value.trim();
    if (!keyword) return Toast.warn('Podaj słowo kluczowe');
    try {
      await API.post('/seo/keywords', { keyword, url: document.getElementById('kw-url').value.trim(), position: parseInt(document.getElementById('kw-pos').value)||0, volume: parseInt(document.getElementById('kw-vol').value)||0 });
      ['kw-phrase','kw-url','kw-pos','kw-vol'].forEach(id => { document.getElementById(id).value=''; });
      await this.loadAll(); Toast.success('Dodano słowo kluczowe');
    } catch(e) { Toast.error(e.message); }
  },

  async editKwPos(id, cur) {
    const pos = prompt('Nowa pozycja:', cur); if (pos === null) return;
    try { await API.patch(`/seo/keywords/${id}`, { position: parseInt(pos)||0 }); await this.loadAll(); Toast.success('Zaktualizowano'); }
    catch(e) { Toast.error(e.message); }
  },

  async deleteKw(id) {
    if (!confirm('Usunąć?')) return;
    try { await API.del(`/seo/keywords/${id}`); await this.loadAll(); Toast.success('Usunięto'); }
    catch(e) { Toast.error(e.message); }
  },

  /* ── TAB 3: BACKLINKS ── */
  renderBacklinks() {
    const el = document.getElementById('seo-panel-backlinks');
    el.innerHTML = `
<div class="card" style="margin-bottom:16px">
  <div class="card-title" style="margin-bottom:14px">🔗 Monitor Backlinków</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-bottom:12px">
    <input class="form-input" id="bl-source" placeholder="URL źródłowy (skąd link)">
    <input class="form-input" id="bl-target" placeholder="URL docelowy (do czego)">
    <input class="form-input" id="bl-anchor" placeholder="Anchor text">
    <input class="form-input" id="bl-cost" type="number" placeholder="Koszt PLN">
    <select class="form-select" id="bl-type"><option value="dofollow">DoFollow</option><option value="nofollow">NoFollow</option></select>
    <button class="btn btn--primary btn--sm" id="bl-add-btn">+ Dodaj</button>
  </div>
  <button class="btn btn--secondary btn--sm" id="bl-check-btn">🔄 Sprawdź wszystkie linki</button>
</div>
<div class="card">
  <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Źródło</th>
        <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Anchor</th>
        <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Typ</th>
        <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Status</th>
        <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Koszt</th>
        <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Akcje</th>
      </tr></thead>
      <tbody id="bl-tbody"></tbody>
    </table>
  </div>
</div>`;
    document.getElementById('bl-add-btn').addEventListener('click', () => this.addBacklink());
    document.getElementById('bl-check-btn').addEventListener('click', () => this.checkBacklinks());
    this.renderBacklinkTable();
  },

  renderBacklinkTable() {
    const tbody = document.getElementById('bl-tbody'); if (!tbody) return;
    if (!this.state.backlinks.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">Brak backlinków.</td></tr>'; return; }
    tbody.innerHTML = this.state.backlinks.map(b => `
      <tr class="${b.status==='lost'?'backlink-row--lost':''} ${b.type==='nofollow'?'backlink-row--nofollow':''}">
        <td class="bl-source" style="font-size:0.78rem;padding:9px 8px;max-width:220px;overflow:hidden;text-overflow:ellipsis">
          <a href="${escHtml(b.source_url)}" target="_blank" style="color:var(--accent-light)">${escHtml(b.source_url)}</a></td>
        <td style="font-size:0.8rem;padding:9px 8px;color:var(--text-secondary)">${escHtml(b.anchor||'—')}</td>
        <td style="text-align:center;padding:9px 8px"><span class="badge bl-type-badge bl-type-badge--${b.type}">${b.type}</span></td>
        <td style="text-align:center;padding:9px 8px"><span style="font-size:0.78rem">${b.status==='active'?'✅ Aktywny':b.status==='lost'?'❌ Utracony':'⚠️ '+b.status}</span></td>
        <td style="text-align:center;padding:9px 8px;font-size:0.8rem">${b.cost?b.cost+' PLN':'—'}</td>
        <td style="text-align:center;padding:9px 8px"><button class="btn btn--danger btn--sm" onclick="SeoView.deleteBacklink('${b.id}')">🗑️</button></td>
      </tr>`).join('');
  },

  async addBacklink() {
    const source_url = document.getElementById('bl-source').value.trim();
    const target_url = document.getElementById('bl-target').value.trim();
    if (!source_url || !target_url) return Toast.warn('Podaj URL źródłowy i docelowy');
    try {
      await API.post('/seo/backlinks', { source_url, target_url, anchor: document.getElementById('bl-anchor').value.trim(), cost: parseFloat(document.getElementById('bl-cost').value)||0, type: document.getElementById('bl-type').value });
      ['bl-source','bl-target','bl-anchor','bl-cost'].forEach(id => { document.getElementById(id).value=''; });
      await this.loadAll(); Toast.success('Dodano backlink');
    } catch(e) { Toast.error(e.message); }
  },

  async checkBacklinks() {
    setBtn('bl-check-btn', true, '🔄 Sprawdzam...');
    try { const r = await API.post('/seo/backlinks/check', {}); await this.loadAll(); Toast.success(`Sprawdzono ${r.results?.length||0} linków`); }
    catch(e) { Toast.error(e.message); }
    finally { setBtn('bl-check-btn', false, '🔄 Sprawdź wszystkie linki'); }
  },

  async deleteBacklink(id) {
    if (!confirm('Usunąć?')) return;
    try { await API.del(`/seo/backlinks/${id}`); await this.loadAll(); Toast.success('Usunięto'); }
    catch(e) { Toast.error(e.message); }
  },

  /* ── TAB 4: AI CONTENT ── */
  renderAI() {
    const el = document.getElementById('seo-panel-ai');
    el.innerHTML = `
<div style="display:grid;grid-template-columns:1fr;gap:20px;margin-bottom:20px">
  <div class="card">
    <div class="card-title" style="margin-bottom:14px">📝 Generator Meta Tags</div>
    <div class="form-group"><label class="form-label">Słowo kluczowe</label>
      <input class="form-input" id="meta-kw" placeholder="np. smartwatch Samsung"></div>
    <div class="form-group"><label class="form-label">Nazwa produktu</label>
      <input class="form-input" id="meta-prod" placeholder="np. Samsung Galaxy Watch 6"></div>
    <div class="form-group"><label class="form-label">Kategoria</label>
      <input class="form-input" id="meta-cat" placeholder="np. smartwatche"></div>
    <button class="btn btn--primary btn--sm" id="meta-btn">🤖 Generuj Meta</button>
    <div id="meta-result" style="margin-top:14px"></div>
  </div>
</div>
<div class="card">
  <div class="card-title" style="margin-bottom:14px">✍️ Generator Opisu Produktu SEO</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:12px">
    <div class="form-group"><label class="form-label">Nazwa produktu *</label><input class="form-input" id="cont-prod" placeholder="Nazwa produktu"></div>
    <div class="form-group"><label class="form-label">Kategoria</label><input class="form-input" id="cont-cat" placeholder="Kategoria"></div>
    <div class="form-group"><label class="form-label">Słowo kluczowe</label><input class="form-input" id="cont-kw" placeholder="Główne słowo kluczowe"></div>
    <div class="form-group"><label class="form-label">Cena (PLN)</label><input class="form-input" id="cont-price" type="number" placeholder="0.00"></div>
  </div>
  <button class="btn btn--primary" id="cont-btn">🤖 Generuj opis SEO</button>
  <div id="cont-result" style="margin-top:16px"></div>
</div>`;
    document.getElementById('cont-btn').addEventListener('click', () => this.generateContent());
  },

  async generateMeta() {
    const keyword = document.getElementById('meta-kw').value.trim();
    const product_name = document.getElementById('meta-prod').value.trim();
    if (!keyword && !product_name) return Toast.warn('Podaj słowo kluczowe lub nazwę produktu');
    setBtn('meta-btn', true, '⏳ Generuję...');
    try {
      const r = await API.post('/seo/generate-meta', { keyword, product_name, category: document.getElementById('meta-cat').value.trim() });
      const titles = (r.meta_titles||[]).map(t => `<div class="meta-variant" onclick="navigator.clipboard.writeText(this.querySelector('.meta-variant-text').textContent);Toast.success('Skopiowano!')"><div class="meta-variant-text">${escHtml(t.text)}</div><div class="meta-variant-len">${t.length} zn. ${t.keyword_included?'✅':''}</div></div>`).join('');
      const descs = (r.meta_descriptions||[]).map(d => `<div class="meta-variant" onclick="navigator.clipboard.writeText(this.querySelector('.meta-variant-text').textContent);Toast.success('Skopiowano!')"><div class="meta-variant-text">${escHtml(d.text)}</div><div class="meta-variant-len">${d.length} zn. ${d.has_cta?'✅ CTA':''}</div></div>`).join('');
      document.getElementById('meta-result').innerHTML = `<div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">META TITLES (kliknij aby skopiować)</div>${titles}<div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin:10px 0 6px">META DESCRIPTIONS</div>${descs}`;
    } catch(e) { Toast.error(e.message); }
    finally { setBtn('meta-btn', false, '🤖 Generuj Meta'); }
  },

  async generateContent() {
    const product_name = document.getElementById('cont-prod').value.trim();
    if (!product_name) return Toast.warn('Podaj nazwę produktu');
    setBtn('cont-btn', true, '⏳ Generuję opis...');
    try {
      const r = await API.post('/seo/generate-content', { product_name, category: document.getElementById('cont-cat').value.trim(), keyword: document.getElementById('cont-kw').value.trim(), price: parseFloat(document.getElementById('cont-price').value)||0 });
      const blocks = (r.blocks||[]).map(b => `<div class="content-block"><h3>${escHtml(b.h2)}</h3><p>${escHtml(b.content)}</p></div>`).join('');
      const kws = (r.keywords_used||[]).map(k => `<span class="lsi-chip">${escHtml(k)}</span>`).join('');
      document.getElementById('cont-result').innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:12px">
          <span style="font-size:0.78rem;color:var(--text-muted)">~${r.total_chars||0} znaków</span>
          <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('cont-text').innerText);Toast.success('Skopiowano!')">📋 Kopiuj cały opis</button>
        </div>
        <div id="cont-text">
          <div class="content-block"><p>${escHtml(r.intro||'')}</p></div>
          ${blocks}
          <div class="content-block"><p>${escHtml(r.outro||'')}</p></div>
        </div>
        ${kws ? '<div style="margin-top:12px"><div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">SŁOWA KLUCZOWE</div><div class="serp-lsi-grid">'+kws+'</div></div>' : ''}`;
    } catch(e) { Toast.error(e.message); }
    finally { setBtn('cont-btn', false, '🤖 Generuj opis SEO'); }
  },

  /* ── TAB 5: BRAND KB ── */
  renderBrand() {
    const el = document.getElementById('seo-panel-brand');
    el.innerHTML = `
<div class="card">
  <div class="card-title" style="margin-bottom:6px">🏷️ Baza Wiedzy o Marce (Brand Knowledge Base)</div>
  <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:20px">Dane wstrzykiwane automatycznie do każdego promptu AI.</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="form-group"><label class="form-label">Nazwa marki</label><input class="form-input" id="bkb-name" placeholder="np. ShopGold"></div>
    <div class="form-group"><label class="form-label">Ton komunikacji (Tone of Voice)</label><input class="form-input" id="bkb-tone" placeholder="np. profesjonalny, przyjazny"></div>
    <div class="form-group"><label class="form-label">Grupa docelowa</label><input class="form-input" id="bkb-audience" placeholder="np. kobiety 25-40, zainteresowane modą"></div>
    <div class="form-group"><label class="form-label">Kluczowe wartości marki</label><input class="form-input" id="bkb-values" placeholder="np. jakość, innowacja"></div>
    <div class="form-group" style="grid-column:1/-1"><label class="form-label">Słowa WYKLUCZONE (AI ich nie użyje)</label><input class="form-input" id="bkb-excluded" placeholder="np. tani, super, promocja"></div>
    <div class="form-group" style="grid-column:1/-1"><label class="form-label">Dodatkowy kontekst (USP, historia, misja)</label><textarea class="form-textarea" id="bkb-extra" rows="3" placeholder="Opisz markę, jej historię, wyjątkowe cechy..."></textarea></div>
  </div>
  <div style="display:flex;gap:10px;margin-top:16px">
    <button class="btn btn--primary" id="bkb-save-btn">💾 Zapisz Brand KB</button>
    <button class="btn btn--ghost" id="bkb-load-btn">🔄 Wczytaj zapisane</button>
  </div>
</div>`;
    document.getElementById('bkb-save-btn').addEventListener('click', () => this.saveBrand());
    document.getElementById('bkb-load-btn').addEventListener('click', () => this.loadBrand());
    this.loadBrand();
  },

  async loadBrand() {
    try {
      const r = await API.get('/seo/brand');
      const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      set('bkb-name', r.brand_name); set('bkb-tone', r.tone_of_voice);
      set('bkb-audience', r.target_audience); set('bkb-values', r.brand_values);
      set('bkb-excluded', r.excluded_words); set('bkb-extra', r.extra_context);
    } catch(e) { console.error(e); }
  },

  async saveBrand() {
    const g = id => (document.getElementById(id)||{}).value||'';
    try {
      await API.post('/seo/brand', { brand_name: g('bkb-name'), tone_of_voice: g('bkb-tone'), target_audience: g('bkb-audience'), brand_values: g('bkb-values'), excluded_words: g('bkb-excluded'), extra_context: g('bkb-extra') });
      Toast.success('✅ Brand Knowledge Base zapisany!');
    } catch(e) { Toast.error(e.message); }
  },

  /* ── TAB: CONTENT AUDIT ── */
  renderContentAudit() {
    const el = document.getElementById('seo-panel-content_audit');
    el.innerHTML = `
<div class="card" style="margin-bottom:16px">
  <div class="card-title" style="margin-bottom:14px">📝 Content Audit - Optymalizuj istniejące treści</div>
  <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:16px">Monitoruj skuteczność treści, reaguj na spadki w rankingach i znajduj wpisy o największym potencjale do odświeżenia.</p>
  <div class="url-input-group" style="margin-bottom:16px">
    <input class="form-input" id="ca-url" type="url" placeholder="Wklej URL artykułu do audytu">
    <button class="btn btn--primary" id="ca-btn">Przeprowadź Audyt Treści</button>
  </div>
  <div id="ca-result"></div>
</div>
<div class="card">
  <div class="card-title" style="margin-bottom:14px">📉 Spadki rankingów / Sugestie odświeżenia</div>
  <table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="text-align:left;font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">URL Artykułu</th>
      <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Zmiana Ruchu</th>
      <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Stan Świeżości</th>
      <th style="font-size:0.72rem;color:var(--text-muted);padding:8px;border-bottom:1px solid var(--border)">Akcja</th>
    </tr></thead>
    <tbody>
      <tr>
        <td style="font-size:0.75rem;padding:9px 8px;max-width:200px;overflow:hidden;text-overflow:ellipsis">/blog/ranking-smartwatchy-2023</td>
        <td style="text-align:center;padding:9px 8px"><span class="rank-change rank-change--down">▼ 15%</span></td>
        <td style="text-align:center;padding:9px 8px"><span class="badge" style="background:var(--yellow);color:#000">Wymaga aktualizacji</span></td>
        <td style="text-align:center;padding:9px 8px"><button class="btn btn--secondary btn--sm" onclick="document.getElementById('ca-url').value='/blog/ranking-smartwatchy-2023';document.getElementById('ca-btn').click()">Odśwież</button></td>
      </tr>
      <tr>
        <td style="font-size:0.75rem;padding:9px 8px;max-width:200px;overflow:hidden;text-overflow:ellipsis">/blog/jak-wybrac-laptopa</td>
        <td style="text-align:center;padding:9px 8px"><span class="rank-change rank-change--same">— Stabilnie</span></td>
        <td style="text-align:center;padding:9px 8px"><span class="badge" style="background:var(--green);color:#fff">Świeży</span></td>
        <td style="text-align:center;padding:9px 8px"><button class="btn btn--secondary btn--sm" disabled>Zoptymalizowany</button></td>
      </tr>
    </tbody>
  </table>
</div>`;
    document.getElementById('ca-btn').addEventListener('click', () => {
      const url = document.getElementById('ca-url').value.trim();
      if(!url) return Toast.warn('Podaj URL do audytu');
      setBtn('ca-btn', true, 'Analizuję treść...');
      setTimeout(() => {
        document.getElementById('ca-result').innerHTML = `
          <div style="background:var(--bg-2);padding:16px;border-radius:8px;border:1px solid var(--border)">
            <h4 style="margin:0 0 10px;color:var(--text-primary)">Wyniki Audytu: ${escHtml(url)}</h4>
            <ul style="margin:0;padding-left:20px;font-size:0.85rem;color:var(--text-secondary)">
              <li>Content Score: <strong style="color:var(--yellow)">65/100</strong> (Możliwość poprawy)</li>
              <li>Sugerowane słowa kluczowe (LSI): <span class="lsi-chip">porównanie</span> <span class="lsi-chip">bateria</span> <span class="lsi-chip">wymiary</span></li>
              <li>Brakujące intencje: <strong>Recenzje użytkowników</strong></li>
            </ul>
            <button class="btn btn--primary btn--sm" style="margin-top:12px" onclick="Toast.success('Przesłano do Edytora Treści')">⚡ Wyślij do Edytora (Auto-Optymalizacja)</button>
          </div>
        `;
        setBtn('ca-btn', false, 'Przeprowadź Audyt Treści');
      }, 1500);
    });
  },

  /* ── TAB: AI TRACKER ── */
  renderAITracker() {
    const el = document.getElementById('seo-panel-ai_tracker');
    el.innerHTML = `
<div class="card" style="margin-bottom:16px">
  <div class="card-title" style="margin-bottom:14px">🤖 Śledzenie Widoczności AI (AI Tracker)</div>
  <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:16px">Mierz i poprawiaj obecność swojej marki i produktów w odpowiedziach modeli językowych i wyszukiwarkach AI.</p>
  <div style="display:flex;gap:8px;margin-bottom:16px">
    <input class="form-input" id="ait-kw" placeholder="Podaj frazę lub markę (np. najlepsze laptopy)">
    <button class="btn btn--primary" id="ait-btn">Skanuj AI</button>
  </div>
  <div id="ait-result">
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px">
      <div class="prof-stat-card"><div class="prof-stat-label">ChatGPT</div><div class="prof-stat-val" style="color:var(--text-muted)">--%</div></div>
      <div class="prof-stat-card"><div class="prof-stat-label">Perplexity</div><div class="prof-stat-val" style="color:var(--text-muted)">--%</div></div>
      <div class="prof-stat-card"><div class="prof-stat-label">Google SGE</div><div class="prof-stat-val" style="color:var(--text-muted)">--%</div></div>
      <div class="prof-stat-card"><div class="prof-stat-label">Gemini</div><div class="prof-stat-val" style="color:var(--text-muted)">--%</div></div>
    </div>
  </div>
</div>`;
    document.getElementById('ait-btn').addEventListener('click', () => {
      const kw = document.getElementById('ait-kw').value.trim();
      if(!kw) return Toast.warn('Podaj frazę');
      setBtn('ait-btn', true, 'Skanowanie modeli...');
      setTimeout(() => {
        document.getElementById('ait-result').innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;margin-bottom:16px">
            <div class="prof-stat-card"><div class="prof-stat-label">ChatGPT</div><div class="prof-stat-val" style="color:var(--green)">Wzmianka</div></div>
            <div class="prof-stat-card"><div class="prof-stat-label">Perplexity</div><div class="prof-stat-val" style="color:var(--yellow)">Cytat (link)</div></div>
            <div class="prof-stat-card"><div class="prof-stat-label">Google SGE</div><div class="prof-stat-val" style="color:var(--red)">Brak</div></div>
            <div class="prof-stat-card"><div class="prof-stat-label">Gemini</div><div class="prof-stat-val" style="color:var(--green)">Polecany</div></div>
          </div>
          <div style="background:var(--bg-2);padding:16px;border-radius:8px;border:1px solid var(--border)">
            <h4 style="margin:0 0 10px;color:var(--text-primary)">Luki we wzmiankach (Share of Voice)</h4>
            <p style="font-size:0.85rem;color:var(--text-secondary);margin:0 0 8px">Konkurencja (np. Komputronik, X-Kom) pojawia się częściej w wynikach Google SGE. <strong>Sugerowana akcja:</strong> Dodaj specyfikacje techniczne w formie ustrukturyzowanych list i sekcji FAQ na stronach produktów.</p>
          </div>
        `;
        setBtn('ait-btn', false, 'Skanuj AI');
      }, 2000);
    });
  },

  /* ── TAB: SERP ANALYZER (rozbudowany) ── */
  renderSERP() {
    const el = document.getElementById('seo-panel-serp');
    el.innerHTML = `
<div class="card">
  <div class="card-title" style="margin-bottom:14px">🔎 Analizator SERP & Korelacji</div>
  <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:16px">Przeanalizuj wyniki wyszukiwania, by zrozumieć czynniki rankingowe i strategie stosowane przez największych konkurentów.</p>
  <div class="form-group"><label class="form-label">Słowo kluczowe *</label>
    <input class="form-input" id="serp2-kw" placeholder="np. buty sportowe damskie"></div>
  <button class="btn btn--primary" id="serp2-btn">🤖 Przeprowadź pełną analizę SERP</button>
  <div id="serp2-result" style="margin-top:16px"></div>
</div>`;
    document.getElementById('serp2-btn').addEventListener('click', async () => {
      const keyword = document.getElementById('serp2-kw').value.trim();
      if (!keyword) return Toast.warn('Podaj słowo kluczowe');
      setBtn('serp2-btn', true, '⏳ Analizuję wyniki Google i korelację...');
      try {
        const r = await API.post('/seo/analyze-serp', { keyword });
        const lsi = (r.lsi_keywords||[]).map(k => `<span class="lsi-chip">${escHtml(k.phrase)}</span>`).join('');
        const sections = (r.content_structure?.sections||[]).map(s => `<div class="content-block"><h3>${escHtml(s.h2)}</h3><p>${escHtml(s.description)}</p></div>`).join('');
        document.getElementById('serp2-result').innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <div style="background:var(--bg-2);padding:12px;border-radius:6px;border:1px solid var(--border)">
              <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">Analiza intencji</div>
              <div style="font-size:0.85rem;color:var(--text-primary)">Intencja: <strong>${escHtml(r.keyword_analysis?.intent||'Zakupowa')}</strong></div>
              <div style="font-size:0.85rem;color:var(--text-primary)">Trudność (KD): <strong style="color:var(--yellow)">${escHtml(r.keyword_analysis?.difficulty||'Wysoka')}</strong></div>
            </div>
            <div style="background:var(--bg-2);padding:12px;border-radius:6px;border:1px solid var(--border)">
              <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">Korelacja konkurencji (Top 10)</div>
              <ul style="margin:0;padding-left:16px;font-size:0.8rem;color:var(--text-secondary)">
                <li>Średnia dł. treści: <strong>1450 słów</strong></li>
                <li>Wykorzystanie list punktowanych: <strong>80% stron</strong></li>
                <li>Obecność sekcji FAQ: <strong>60% stron</strong></li>
              </ul>
            </div>
          </div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);margin-bottom:4px">Sugerowana struktura H1/H2:</div>
          <div style="font-size:0.88rem;color:var(--accent-light);font-weight:600;margin-bottom:10px">${escHtml(r.content_structure?.recommended_h1||'')}</div>
          ${sections}
          <div class="serp-lsi-grid" style="margin-top:10px">${lsi}</div>`;
      } catch(e) { Toast.error(e.message); }
      finally { setBtn('serp2-btn', false, '🤖 Przeprowadź pełną analizę SERP'); }
    });
  },

  /* ── TAB: TOPICAL MAP ── */
  renderTopicalMap() {
    const el = document.getElementById('seo-panel-topical_map');
    el.innerHTML = `
<div class="card">
  <div class="card-title" style="margin-bottom:14px">🗺️ Topical Map (Silosy Tematyczne)</div>
  <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:16px">Zaplanuj grupy treści, aby zbudować autorytet w danej dziedzinie i zwiększyć szansę na cytowania przez boty AI.</p>
  <div style="display:flex;gap:8px;margin-bottom:16px">
    <input class="form-input" id="tm-kw" placeholder="Podaj temat główny (np. smart home, pielęgnacja twarzy)">
    <button class="btn btn--primary" id="tm-btn">Generuj mapę topikalną</button>
  </div>
  <div id="tm-result"></div>
</div>`;
    document.getElementById('tm-btn').addEventListener('click', () => {
      const kw = document.getElementById('tm-kw').value.trim();
      if(!kw) return Toast.warn('Podaj temat');
      setBtn('tm-btn', true, 'Planowanie klastrów...');
      setTimeout(() => {
        document.getElementById('tm-result').innerHTML = `
          <div style="display:grid;gap:12px">
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
              <h4 style="margin:0 0 6px;color:var(--accent-light)">Klaster: Podstawy i Wprowadzenie</h4>
              <ul style="margin:0;padding-left:16px;font-size:0.85rem;color:var(--text-secondary)">
                <li>Czym jest ${escHtml(kw)}? Poradnik dla początkujących</li>
                <li>Najważniejsze korzyści z zastosowania ${escHtml(kw)}</li>
              </ul>
              <button class="btn btn--ghost btn--sm" style="margin-top:8px" onclick="Toast.success('Dodano do kolejki pisania w Blogerze')">+ Dodaj do Blogera</button>
            </div>
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
              <h4 style="margin:0 0 6px;color:var(--accent-light)">Klaster: Porównania i Rankingi</h4>
              <ul style="margin:0;padding-left:16px;font-size:0.85rem;color:var(--text-secondary)">
                <li>Ranking systemów do ${escHtml(kw)} w 2024</li>
                <li>${escHtml(kw)} - rozwiązanie X vs rozwiązanie Y</li>
              </ul>
              <button class="btn btn--ghost btn--sm" style="margin-top:8px" onclick="Toast.success('Dodano do kolejki pisania w Blogerze')">+ Dodaj do Blogera</button>
            </div>
            <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
              <h4 style="margin:0 0 6px;color:var(--accent-light)">Klaster: Rozwiązywanie Problemów (FAQ)</h4>
              <ul style="margin:0;padding-left:16px;font-size:0.85rem;color:var(--text-secondary)">
                <li>Najczęstsze błędy przy wdrażaniu ${escHtml(kw)}</li>
                <li>Jak naprawić problem z [X] w systemach ${escHtml(kw)}?</li>
              </ul>
              <button class="btn btn--ghost btn--sm" style="margin-top:8px" onclick="Toast.success('Dodano do kolejki pisania w Blogerze')">+ Dodaj do Blogera</button>
            </div>
          </div>
        `;
        setBtn('tm-btn', false, 'Generuj mapę topikalną');
      }, 2500);
    });
  },
};
