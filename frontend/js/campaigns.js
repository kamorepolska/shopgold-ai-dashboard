/* ===== Campaigns Module v2 — AI Media Planner ===== */
window.CampaignsView = {
  state: {
    tab: 'strategy',
    products: [], selected: new Set(),
    strategy: null, ads: null,
    monStats: [], analysis: null,
    savedCampaigns: [],
  },

  async render() {
    const el = document.getElementById('view-campaigns');
    el.innerHTML = this.shellHtml();
    this.bindTabEvents();
    await this.load();
    this.showTab('strategy');
  },

  shellHtml() {
    return `
<div class="camp-tabs" id="camp-tabs">
  <button class="camp-tab active" data-tab="strategy">🎯 <span>Strategia AI</span></button>
  <button class="camp-tab" data-tab="products">📦 <span>Asortyment</span></button>
  <button class="camp-tab" data-tab="assets">✍️ <span>Fabryka Kreacji</span></button>
  <button class="camp-tab" data-tab="monitor">📊 <span>Monitoring</span></button>
</div>
<div id="camp-panel-strategy" class="camp-panel active"></div>
<div id="camp-panel-products" class="camp-panel"></div>
<div id="camp-panel-assets"   class="camp-panel"></div>
<div id="camp-panel-monitor"  class="camp-panel"></div>`;
  },

  bindTabEvents() {
    document.getElementById('camp-tabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-tab]');
      if (btn) this.showTab(btn.dataset.tab);
    });
  },

  showTab(tab) {
    this.state.tab = tab;
    document.querySelectorAll('.camp-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.camp-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`camp-panel-${tab}`).classList.add('active');
    const renders = { strategy: () => this.renderStrategy(), products: () => this.renderProducts(), assets: () => this.renderAssets(), monitor: () => this.renderMonitor() };
    if (renders[tab]) renders[tab]();
  },

  async load() {
    try {
      const [prods, camps] = await Promise.all([API.get('/products?limit=200'), API.get('/campaigns')]);
      this.state.products = prods.products || [];
      this.state.savedCampaigns = camps.campaigns || [];
    } catch(e) { Toast.error(e.message); }
  },

  /* ── TAB 1: AI STRATEGY ── */
  renderStrategy() {
    const el = document.getElementById('camp-panel-strategy');
    el.innerHTML = `
<div class="card" style="margin-bottom:20px">
  <div class="camp-step-header">
    <div class="camp-step-num">1</div>
    <div><div class="camp-step-title">🎯 Kreator Strategii i Celów (AI Media Planner)</div>
    <div class="camp-step-sub">AI wyznaczy Grupę Docelową i optymalny podział budżetu na platformy</div></div>
  </div>
  <div class="camp-grid-2">
    <div class="form-group">
      <label class="form-label">Cel kampanii *</label>
      <select class="form-select" id="s-goal">
        <option value="sprzedaż - maksymalizacja konwersji i przychodów">🛒 Sprzedaż (maksymalizacja przychodów)</option>
        <option value="budowanie świadomości marki wśród nowych klientów">📣 Świadomość marki</option>
        <option value="wyprzedaż magazynu - szybka sprzedaż nadwyżek">🏷️ Wyprzedaż magazynu</option>
        <option value="pozyskanie nowych klientów i leadów">🎣 Pozyskanie klientów (leady)</option>
        <option value="retargeting - odzyskanie porzuconych koszyków">🔄 Retargeting</option>
        <option value="promocja nowego produktu lub kolekcji">🆕 Nowy produkt/kolekcja</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Całkowity budżet kampanii (PLN) *</label>
      <input class="form-input" id="s-budget" type="number" placeholder="np. 5000" min="100">
    </div>
    <div class="form-group">
      <label class="form-label">Branża / kategoria produktów</label>
      <input class="form-input" id="s-industry" type="text" placeholder="np. elektronika, moda, biżuteria">
    </div>
    <div class="form-group">
      <label class="form-label">Preferowane platformy</label>
      <select class="form-select" id="s-platforms">
        <option value="wszystkie dostępne">🌐 Wszystkie dostępne</option>
        <option value="Google Ads i Meta Ads">Google Ads + Meta Ads</option>
        <option value="tylko Google Ads">🔵 Tylko Google Ads</option>
        <option value="tylko Meta Ads Facebook i Instagram">🟣 Tylko Meta Ads</option>
        <option value="Google Ads, Meta Ads i TikTok Ads">+ TikTok Ads</option>
      </select>
    </div>
    <div class="form-group" style="grid-column:1/-1">
      <label class="form-label">Dodatkowe info o grupie docelowej (opcjonalne)</label>
      <input class="form-input" id="s-target" type="text" placeholder="np. kobiety 30-45 lat, zainteresowane modą premium, mieszkanki miast">
    </div>
  </div>
  <div style="display:flex;gap:10px;align-items:center">
    <button class="btn btn--primary btn--lg" id="s-generate-btn">🤖 Generuj Strategię AI</button>
    <span id="s-status" style="font-size:0.82rem;color:var(--text-muted)"></span>
  </div>
</div>
<div id="s-result"></div>`;
    document.getElementById('s-generate-btn').addEventListener('click', () => this.generateStrategy());
    if (this.state.strategy) this.showStrategyResult(this.state.strategy);
  },

  async generateStrategy() {
    const goal = document.getElementById('s-goal').value;
    const budget = parseFloat(document.getElementById('s-budget').value);
    const industry = document.getElementById('s-industry').value;
    const targetInfo = document.getElementById('s-target').value;
    const platforms = document.getElementById('s-platforms').value;
    if (!budget || budget < 100) return Toast.warn('Podaj budżet min. 100 PLN');
    setBtn('s-generate-btn', true);
    const status = document.getElementById('s-status');
    status.textContent = '⏳ AI opracowuje strategię... (10-30 sek.)';
    try {
      const r = await API.post('/campaigns/strategy', { goal, budget, industry, targetInfo, platforms });
      this.state.strategy = r.strategy;
      this.showStrategyResult(r.strategy);
      Toast.success('✅ Strategia wygenerowana!');
    } catch(e) { Toast.error(e.message); }
    finally { setBtn('s-generate-btn', false); status.textContent = ''; }
  },

  /* ── TAB 2: PRODUCTS ── */
  renderProducts() {
    const el = document.getElementById('camp-panel-products');
    const cats = [...new Set(this.state.products.map(p => p.category).filter(Boolean))];
    el.innerHTML = `
<div class="card">
  <div class="camp-step-header">
    <div class="camp-step-num">2</div>
    <div><div class="camp-step-title">📦 Wybór Asortymentu do Kampanii</div>
    <div class="camp-step-sub">Wybierz produkty — AI użyje ich opisów i atrybutów jako kontekstu reklam</div></div>
  </div>
  <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
    <input class="form-input" id="prod-search" placeholder="Szukaj produktu..." style="flex:1;min-width:180px">
    <select class="form-select" id="prod-cat" style="width:180px">
      <option value="">Wszystkie kategorie</option>
      ${cats.map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
    </select>
    <button class="btn btn--ghost btn--sm" id="prod-sel-all">Zaznacz wszystkie</button>
    <button class="btn btn--ghost btn--sm" id="prod-sel-none">Wyczyść</button>
  </div>
  <div class="product-picker-scroll">
    <table class="product-picker-table">
      <thead><tr>
        <th style="width:36px"><input type="checkbox" id="prod-chk-all"></th>
        <th>Nazwa produktu</th><th>Kategoria</th><th style="text-align:right">Cena</th>
      </tr></thead>
      <tbody id="prod-tbody"></tbody>
    </table>
  </div>
  <div class="selected-bar">
    <span>Zaznaczono:</span>
    <span class="selected-bar-count" id="prod-sel-count">0</span>
    <span>produktów</span>
    <button class="btn btn--primary btn--sm" style="margin-left:auto" onclick="CampaignsView.showTab('assets')">Przejdź do kreacji →</button>
  </div>
</div>`;
    this.renderProductRows();
    document.getElementById('prod-search').addEventListener('input', e => this.renderProductRows(e.target.value, document.getElementById('prod-cat').value));
    document.getElementById('prod-cat').addEventListener('change', e => this.renderProductRows(document.getElementById('prod-search').value, e.target.value));
    document.getElementById('prod-sel-all').addEventListener('click', () => { this.state.products.forEach(p => this.state.selected.add(p.id)); this.renderProductRows(); });
    document.getElementById('prod-sel-none').addEventListener('click', () => { this.state.selected.clear(); this.renderProductRows(); });
    document.getElementById('prod-chk-all').addEventListener('change', e => { this.state.products.forEach(p => e.target.checked ? this.state.selected.add(p.id) : this.state.selected.delete(p.id)); this.renderProductRows(); });
    document.getElementById('prod-tbody').addEventListener('change', e => {
      if (!e.target.type === 'checkbox') return;
      e.target.checked ? this.state.selected.add(e.target.dataset.id) : this.state.selected.delete(e.target.dataset.id);
      this.updateSelCount();
    });
  },

  renderProductRows(search='', cat='') {
    const filtered = this.state.products.filter(p =>
      (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
      (!cat || p.category === cat)
    );
    const tbody = document.getElementById('prod-tbody');
    if (!tbody) return;
    if (!filtered.length) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">Brak produktów. Zaimportuj w PIM.</td></tr>`; return; }
    tbody.innerHTML = filtered.map(p => `
      <tr class="${this.state.selected.has(p.id)?'selected':''}" onclick="document.getElementById('ck-${p.id}').click()">
        <td><input type="checkbox" id="ck-${p.id}" data-id="${p.id}" ${this.state.selected.has(p.id)?'checked':''}></td>
        <td>${escHtml(truncate(p.name,60))}</td>
        <td><span style="font-size:0.75rem;color:var(--text-muted)">${escHtml(p.category||'—')}</span></td>
        <td style="text-align:right;font-weight:600">${p.price?p.price.toFixed(2)+' zł':'—'}</td>
      </tr>`).join('');
    this.updateSelCount();
  },

  updateSelCount() {
    const el = document.getElementById('prod-sel-count');
    if (el) el.textContent = this.state.selected.size;
  },

  /* ── TAB 3: AD ASSETS ── */
  renderAssets() {
    const el = document.getElementById('camp-panel-assets');
    el.innerHTML = `
<div class="card" style="margin-bottom:16px">
  <div class="camp-step-header">
    <div class="camp-step-num">3</div>
    <div><div class="camp-step-title">✍️ Fabryka Kreacji i Testy A/B</div>
    <div class="camp-step-sub">AI generuje min. 2 warianty tekstów (A = cena/promocja, B = emocje/korzyści)</div></div>
  </div>
  <div class="camp-grid-2" style="margin-bottom:14px">
    <div class="form-group">
      <label class="form-label">Nazwa kampanii</label>
      <input class="form-input" id="a-name" value="Kampania AI ${new Date().toLocaleDateString('pl-PL')}">
    </div>
    <div class="form-group">
      <label class="form-label">Platforma reklamowa</label>
      <select class="form-select" id="a-platform">
        <option value="google_ads">🔵 Google Ads (RSA)</option>
        <option value="facebook_ads">🟣 Facebook / Instagram Ads</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Cel reklam</label>
      <input class="form-input" id="a-goal" placeholder="np. sprzedaż, pozyskanie leadów" value="${this.state.strategy?.campaign_objective||'sprzedaż'}">
    </div>
    <div class="form-group">
      <label class="form-label">Grupa docelowa (z AI Planner lub własna)</label>
      <input class="form-input" id="a-audience" placeholder="np. kobiety 30-45, zainteresowane modą" value="${this.state.strategy?.target_audience?.persona_description||''}">
    </div>
  </div>
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
    <button class="btn btn--primary btn--lg" id="a-gen-btn">🤖 Generuj Reklamy A/B</button>
    <span style="font-size:0.8rem;color:var(--text-muted)">${this.state.selected.size} produktów zaznaczonych</span>
    ${!this.state.selected.size ? '<span style="color:var(--red);font-size:0.8rem">⚠️ Wybierz produkty w zakładce Asortyment</span>' : ''}
    <span id="a-status" style="font-size:0.82rem;color:var(--text-muted)"></span>
  </div>
</div>
<div style="margin-bottom:20px">
  <div class="strategy-card-title" style="margin-bottom:12px">🖼️ Wizualizacja Kreacji</div>
  <div class="camp-grid-3">
    <div class="image-placeholder" onclick="this.querySelector('input').click()">
      <div class="image-placeholder-icon">🖼️</div>
      <div class="image-placeholder-text">Wariant A — Grafika</div>
      <div class="image-placeholder-sub">Kliknij aby wgrać lub przeciągnij plik</div>
      <input type="file" accept="image/*" style="display:none" onchange="CampaignsView.handleImageUpload(this,'img-a')">
    </div>
    <div class="image-placeholder" onclick="this.querySelector('input').click()">
      <div class="image-placeholder-icon">🖼️</div>
      <div class="image-placeholder-text">Wariant B — Grafika</div>
      <div class="image-placeholder-sub">Kliknij aby wgrać lub przeciągnij plik</div>
      <input type="file" accept="image/*" style="display:none" onchange="CampaignsView.handleImageUpload(this,'img-b')">
    </div>
    <div class="image-placeholder" style="opacity:0.6;cursor:default">
      <div class="image-placeholder-icon">🤖</div>
      <div class="image-placeholder-text">Generowanie AI</div>
      <div class="image-placeholder-sub">DALL-E / Midjourney (wkrótce)</div>
    </div>
  </div>
</div>
<div id="a-result"></div>`;
    document.getElementById('a-gen-btn').addEventListener('click', () => this.generateAds());
    if (this.state.ads) this.showAdsResult(this.state.ads);
  },

  handleImageUpload(input, slot) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const ph = input.closest('.image-placeholder');
      ph.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:180px;border-radius:8px;object-fit:contain">
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px">${escHtml(file.name)}</div>`;
    };
    reader.readAsDataURL(file);
  },

  async generateAds() {
    const productIds = [...this.state.selected];
    if (!productIds.length) return Toast.warn('Zaznacz produkty w zakładce Asortyment');
    const platform = document.getElementById('a-platform').value;
    const campaignName = document.getElementById('a-name').value;
    const goal = document.getElementById('a-goal').value;
    const targetAudience = document.getElementById('a-audience').value;
    const status = document.getElementById('a-status');
    setBtn('a-gen-btn', true);
    status.textContent = '⏳ AI tworzy warianty A/B... (10-30 sek.)';
    try {
      const r = await API.post('/campaigns/generate-ads', { productIds, campaignName, platform, goal, targetAudience });
      this.state.ads = r.ads;
      this.state.savedCampaigns = (await API.get('/campaigns')).campaigns || [];
      this.showAdsResult(r.ads);
      Toast.success(`✅ Kampania "${campaignName}" zapisana!`);
    } catch(e) { Toast.error(e.message); }
    finally { setBtn('a-gen-btn', false); status.textContent = ''; }
  },

  showAdsResult(data) {
    const el = document.getElementById('a-result'); if (!el || !data) return;
    const isGoogle = data.platform === 'google_ads';
    const adsHtml = (data.ads || []).map(ad => {
      const variantsHtml = (ad.variants || []).map(v => {
        const isA = v.variant === 'A';
        if (isGoogle) return `
          <div class="ab-card ab-card--${isA?'a':'b'}">
            <div class="ab-card-header">🔵 Wariant ${v.variant} <span style="font-size:0.72rem;opacity:0.8">${escHtml(v.focus||'')}</span></div>
            <div class="ab-card-body">
              <div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);margin-bottom:6px">NAGŁÓWKI</div>
              <div class="headline-chips">${(v.headlines||[]).map(h=>`<span class="headline-chip" title="Kliknij aby skopiować" onclick="navigator.clipboard.writeText('${h.replace(/'/g,"\\'")}');Toast.success('Skopiowano!')">${escHtml(h)}</span>`).join('')}</div>
              <div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);margin-bottom:4px">OPISY</div>
              <div>${(v.descriptions||[]).map(d=>`<div class="desc-line">${escHtml(d)}</div>`).join('')}</div>
              <div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);margin:8px 0 4px">SŁOWA KLUCZOWE</div>
              <div class="kw-list">${(v.keywords||[]).map(k=>`<span class="kw-chip">${escHtml(k)}</span>`).join('')}</div>
            </div>
          </div>`;
        return `
          <div class="ab-card ab-card--${isA?'a':'b'}">
            <div class="ab-card-header">${isA?'🔵':'🟣'} Wariant ${v.variant} <span style="font-size:0.72rem;opacity:0.8">${escHtml(v.focus||'')}</span></div>
            <div class="ab-card-body">
              <div class="fb-post-preview">
                <div class="fb-post-header"><div class="fb-avatar"></div><div><div class="fb-name">Twoja Marka</div><div style="font-size:0.7rem;color:#65676b">Sponsorowane</div></div></div>
                <div class="fb-post-text">${escHtml(v.primary_text_full||v.primary_text_short||'')}</div>
                <div class="fb-post-hashtags">${(v.hashtags||[]).join(' ')}</div>
                <div class="fb-headline">${escHtml(v.headline||'')}</div>
                <div style="font-size:0.75rem;color:#65676b;margin-top:2px">${escHtml(v.link_description||'')}</div>
                <div class="fb-cta-badge">${(v.cta||'SHOP_NOW').replace('_',' ')}</div>
              </div>
              <button class="copy-btn" onclick="navigator.clipboard.writeText(${JSON.stringify((v.primary_text_full||'')+'\n'+(v.hashtags||[]).join(' '))});Toast.success('Skopiowano!')">📋 Kopiuj tekst</button>
            </div>
          </div>`;
      }).join('');
      return `<div class="card" style="margin-bottom:16px">
        <div style="font-weight:600;font-size:0.9rem;margin-bottom:12px">📦 ${escHtml(ad.productName||ad.adGroup||'Produkt')}</div>
        <div class="ab-wrapper">${variantsHtml}</div>
      </div>`;
    }).join('');
    el.innerHTML = adsHtml || `<div class="empty-state"><div class="empty-icon">✍️</div><div class="empty-title">Brak kreacji</div></div>`;
  },

  /* ── TAB 4: MONITORING ── */
  renderMonitor() {
    const el = document.getElementById('camp-panel-monitor');
    el.innerHTML = `
<div class="camp-step-header" style="margin-bottom:20px">
  <div class="camp-step-num">4</div>
  <div><div class="camp-step-title">📊 Dashboard Monitoringu i Optymalizacji</div>
  <div class="camp-step-sub">Dane testowe (mock) — gotowe pod integrację z Google/Meta API</div></div>
</div>
<div class="monitoring-kpis" id="mon-kpis"></div>
<div class="card" style="margin-bottom:20px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:10px">
    <div style="font-weight:600">📋 Trwające kampanie</div>
    <span class="badge badge--google" style="font-size:0.72rem">Mock Data — integracja API wkrótce</span>
  </div>
  <div style="overflow-x:auto">
    <table class="mon-table" id="mon-table">
      <thead><tr>
        <th>Kampania</th><th>Platforma</th><th>Status</th>
        <th>Budżet</th><th>Wydano</th><th>Wyświetlenia</th>
        <th>Kliknięcia</th><th>CTR</th><th>CPC</th>
        <th>Konwersje</th><th>CPA</th><th>Przychód</th><th>ROAS</th>
      </tr></thead>
      <tbody id="mon-tbody"></tbody>
    </table>
  </div>
</div>
<div class="optimizer-panel">
  <div class="camp-step-header" style="margin-bottom:14px;border:none;padding-bottom:0">
    <div class="camp-step-num" style="background:var(--purple)">🤖</div>
    <div><div class="camp-step-title">Optymalizator AI</div>
    <div class="camp-step-sub">Wklej surowe wyniki z Facebooka lub Google, AI poda co zrobić</div></div>
  </div>
  <div class="camp-grid-2" style="margin-bottom:12px">
    <div class="form-group">
      <label class="form-label">Nazwa kampanii / kontekst</label>
      <input class="form-input" id="opt-name" placeholder="np. Kampania Wiosna 2025">
    </div>
    <div class="form-group">
      <label class="form-label">Platforma</label>
      <select class="form-select" id="opt-platform">
        <option value="mieszana">Mieszana (Google + Meta)</option>
        <option value="Google Ads">Google Ads</option>
        <option value="Meta Ads (Facebook/Instagram)">Meta Ads</option>
      </select>
    </div>
  </div>
  <div class="form-group" style="margin-bottom:12px">
    <label class="form-label">Surowe dane kampanii (wklej z platformy)</label>
    <textarea class="form-textarea" id="opt-data" rows="6" style="font-family:'JetBrains Mono',monospace;font-size:0.8rem" placeholder="Np:
Wariant A: Wyświetlenia: 45000, Kliknięcia: 1350, CTR: 3%, CPC: 0.74 PLN, Konwersje: 45, CPA: 22 PLN
Wariant B: Wyświetlenia: 43000, Kliknięcia: 860, CTR: 2%, CPC: 1.12 PLN, Konwersje: 21, CPA: 46 PLN
Budżet dzienny: 200 PLN, ROAS: 412%"></textarea>
  </div>
  <button class="btn btn--primary" id="opt-btn">🔍 Analizuj i optymalizuj</button>
  <span id="opt-status" style="font-size:0.82rem;color:var(--text-muted);margin-left:10px"></span>
  <div id="opt-result" style="margin-top:20px"></div>
</div>`;
    this.loadMonStats();
    document.getElementById('opt-btn').addEventListener('click', () => this.runOptimizer());
  },

  async loadMonStats() {
    try {
      const r = await API.get('/campaigns/mock-stats');
      this.state.monStats = r.campaigns || [];
      this.renderMonKpis();
      this.renderMonTable();
    } catch(e) { console.error(e); }
  },

  renderMonKpis() {
    const stats = this.state.monStats;
    const totalSpent = stats.reduce((s,c)=>s+c.spent,0);
    const totalRev = stats.reduce((s,c)=>s+c.revenue,0);
    const totalConv = stats.reduce((s,c)=>s+c.conversions,0);
    const avgRoas = totalSpent ? (totalRev/totalSpent*100).toFixed(0) : 0;
    const el = document.getElementById('mon-kpis'); if (!el) return;
    el.innerHTML = [
      { icon:'💰', label:'Łączny wydatek', value: totalSpent.toLocaleString('pl-PL')+' PLN', delta:'+12% vs poprzedni mies.', up:true },
      { icon:'🏆', label:'Łączny przychód', value: totalRev.toLocaleString('pl-PL')+' PLN', delta:'+18% vs poprzedni mies.', up:true },
      { icon:'📈', label:'Śr. ROAS', value: avgRoas+'%', delta: avgRoas>400 ? '✅ Powyżej celu (400%)' : '⚠️ Poniżej celu', up: avgRoas>400 },
      { icon:'🎯', label:'Konwersje łącznie', value: totalConv, delta:'+8% vs poprzedni mies.', up:true },
    ].map(k=>`<div class="m-kpi"><div class="m-kpi-icon">${k.icon}</div><div class="m-kpi-value">${k.value}</div><div class="m-kpi-label">${k.label}</div><div class="m-kpi-delta m-kpi-delta--${k.up?'up':'down'}">${k.delta}</div></div>`).join('');
  },

  renderMonTable() {
    const tbody = document.getElementById('mon-tbody'); if (!tbody) return;
    const roasClass = r => r >= 400 ? 'roas-good' : r >= 200 ? 'roas-ok' : 'roas-bad';
    tbody.innerHTML = this.state.monStats.map(c=>`
      <tr>
        <td style="font-weight:600">${escHtml(c.name)}</td>
        <td><span class="platform-badge platform-badge--${c.platform.includes('Google')?'google':'meta'}">${c.platform.includes('Google')?'🔵':'🟣'} ${escHtml(c.platform)}</span></td>
        <td><span class="status-badge status-badge--${c.status}">● ${c.status==='active'?'Aktywna':c.status==='paused'?'Wstrzymana':'Zakończona'}</span></td>
        <td>${c.budget.toLocaleString('pl-PL')} PLN</td>
        <td>${c.spent.toLocaleString('pl-PL')} PLN</td>
        <td>${c.impressions.toLocaleString('pl-PL')}</td>
        <td>${c.clicks.toLocaleString('pl-PL')}</td>
        <td>${c.ctr.toFixed(2)}%</td>
        <td>${c.cpc.toFixed(2)} PLN</td>
        <td>${c.conversions}</td>
        <td>${c.cpa.toFixed(2)} PLN</td>
        <td>${c.revenue.toLocaleString('pl-PL')} PLN</td>
        <td class="${roasClass(c.roas)}">${c.roas.toFixed(0)}%</td>
      </tr>`).join('');
  },

  async runOptimizer() {
    const rawData = document.getElementById('opt-data').value;
    const campaignName = document.getElementById('opt-name').value;
    const platform = document.getElementById('opt-platform').value;
    if (!rawData.trim()) return Toast.warn('Wklej dane kampanii do analizy');
    setBtn('opt-btn', true);
    document.getElementById('opt-status').textContent = '⏳ AI analizuje... (10-20 sek.)';
    try {
      const r = await API.post('/campaigns/optimize', { rawData, campaignName, platform });
      this.state.analysis = r.analysis;
      this.showOptimizerResult(r.analysis);
      Toast.success('✅ Analiza gotowa!');
    } catch(e) { Toast.error(e.message); }
    finally { setBtn('opt-btn', false); document.getElementById('opt-status').textContent = ''; }
  },

  showOptimizerResult(a) {
    const el = document.getElementById('opt-result'); if (!el || !a) return;
    const score = a.performance_score || 0;
    const scoreClass = score >= 70 ? 'score--good' : score >= 40 ? 'score--ok' : 'score--bad';
    const findings = (a.key_findings||[]).map(f=>`<div class="finding-tag finding-tag--${f.type}">${f.type==='positive'?'✅':f.type==='negative'?'❌':'ℹ️'} ${escHtml(f.finding)}</div>`).join('');
    const recs = (a.recommendations||[]).map(r=>`
      <div class="rec-card rec-card--${r.priority}">
        <span class="rec-priority rec-priority--${r.priority}">${r.priority==='high'?'🔴 WYSOKI':r.priority==='medium'?'🟡 ŚREDNI':'🟢 NISKI'}</span>
        <div class="rec-action">${escHtml(r.action)}</div>
        <div class="rec-reason">💡 ${escHtml(r.reason)}</div>
        <div class="rec-impact">📈 ${escHtml(r.expected_impact)}</div>
      </div>`).join('');
    const ab = a.ab_test_winner;
    const abHtml = ab?.winner && ab.winner !== 'brak danych' ? `
      <div class="ab-winner-box">
        <div class="ab-winner-title">🏆 Zwycięzca A/B: Wariant ${escHtml(ab.winner)} (pewność: ${escHtml(ab.confidence||'')})</div>
        <div class="ab-winner-text">${escHtml(ab.recommendation||'')}</div>
      </div>` : '';
    el.innerHTML = `
      <div class="optimizer-result">
        <div class="optimizer-score-wrap">
          <div class="optimizer-score-circle ${scoreClass}">${score}</div>
          <div>
            <div style="font-size:1rem;font-weight:700;margin-bottom:4px">${escHtml(a.overall_assessment||'')}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(a.budget_suggestion||'')}</div>
          </div>
        </div>
        <div class="camp-grid-2">
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Kluczowe obserwacje</div>
            ${findings}
            ${abHtml}
          </div>
          <div>
            <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Rekomendacje optymalizacyjne</div>
            ${recs}
          </div>
        </div>
        ${(a.next_steps||[]).length ? `<div style="margin-top:16px"><div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Następne kroki</div><ul class="recs-list">${(a.next_steps||[]).map(s=>`<li>${escHtml(s)}</li>`).join('')}</ul></div>` : ''}
      </div>`;
  },

  showStrategyResult(s) {
    const el = document.getElementById('s-result');
    if (!el || !s) return;
    const getPlatformClass = name => {
      const n = (name || '').toLowerCase();
      if (n.includes('google')) return 'fill-google';
      if (n.includes('meta') || n.includes('facebook')) return 'fill-meta';
      if (n.includes('tiktok')) return 'fill-tiktok';
      if (n.includes('remark')) return 'fill-remark';
      return 'fill-default';
    };
    const allocs = (s.budget_allocation || []).map(a => `
      <div class="platform-alloc">
        <div class="platform-alloc-header">
          <span class="platform-alloc-name">${escHtml(a.platform)}</span>
          <span class="platform-alloc-amount">${a.percentage}% — ${(a.amount||0).toLocaleString('pl-PL')} PLN</span>
        </div>
        <div class="platform-alloc-bar"><div class="platform-alloc-fill ${getPlatformClass(a.platform)}" style="width:${a.percentage}%"></div></div>
        <div class="platform-alloc-sub">${escHtml((a.campaign_types||[]).join(', '))} · ${escHtml(a.rationale||'')}</div>
      </div>`).join('');
    const audience = s.target_audience || {};
    const kpis = (s.kpis || []).map(k => `<div class="kpi-target-item"><div class="kpi-target-metric">${escHtml(k.metric)}</div><div class="kpi-target-value">${escHtml(k.target)}</div></div>`).join('');
    const phases = [s.timeline?.phase1, s.timeline?.phase2, s.timeline?.phase3].filter(Boolean).map((p, i) => `
      <div class="timeline-phase"><div class="phase-dot">${i+1}</div>
      <div class="phase-content"><div class="phase-name">${escHtml(p.name||'')}</div>
      <div class="phase-duration">${escHtml(p.duration||'')}</div>
      <div class="phase-desc">${escHtml(p.description||'')}</div></div></div>`).join('');
    const recs = (s.recommendations || []).map(r => `<li>${escHtml(r)}</li>`).join('');
    const interests = (audience.interests || []).map(i => `<span class="audience-tag">💡 ${escHtml(i)}</span>`).join('');
    const behaviors = (audience.behaviors || []).map(b => `<span class="audience-tag">📌 ${escHtml(b)}</span>`).join('');

    el.innerHTML = `
<div class="strategy-summary-box">💡 <strong>Strategia:</strong> ${escHtml(s.strategy_summary||'')}</div>
<div class="camp-grid-2" style="margin-bottom:20px">
  <div class="strategy-card">
    <div class="strategy-card-title">💰 Podział budżetu na platformy</div>
    ${allocs}
  </div>
  <div class="strategy-card">
    <div class="strategy-card-title">👤 Grupa docelowa</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:0.82rem">
      <div><span style="color:var(--text-muted)">Wiek:</span> <strong>${escHtml(audience.age_range||'—')}</strong></div>
      <div><span style="color:var(--text-muted)">Płeć:</span> <strong>${escHtml(audience.gender||'—')}</strong></div>
      <div><span style="color:var(--text-muted)">Lokalizacja:</span> <strong>${escHtml(audience.location||'—')}</strong></div>
      <div><span style="color:var(--text-muted)">Dochód:</span> <strong>${escHtml(audience.income_level||'—')}</strong></div>
    </div>
    <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:10px;line-height:1.6">${escHtml(audience.persona_description||'')}</div>
    <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Zainteresowania i zachowania</div>
    <div class="audience-tags">${interests}${behaviors}</div>
  </div>
</div>
<div class="camp-grid-2">
  <div class="strategy-card">
    <div class="strategy-card-title">📈 Cele KPI</div>
    <div class="kpi-targets-grid">${kpis}</div>
    ${recs ? `<div style="margin-top:14px"><div class="strategy-card-title" style="margin-bottom:8px">💬 Rekomendacje</div><ul class="recs-list">${recs}</ul></div>` : ''}
  </div>
  <div class="strategy-card">
    <div class="strategy-card-title">📅 Plan działania</div>
    <div class="timeline-phases">${phases}</div>
  </div>
</div>
<div style="margin-top:16px;text-align:right">
  <button class="btn btn--secondary" onclick="CampaignsView.showTab('products')">Dalej: Wybierz asortyment →</button>
</div>`;
  },
};
