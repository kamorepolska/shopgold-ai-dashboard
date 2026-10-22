/* ===== pim.js — Modul PIM (3 zakladki) ===== */
window.PimView = {
  state: {
    products:[], total:0, categories:[], groups:[], selected:new Set(),
    page:0, limit:100, search:'', category:'', group_tag:'',
    presets:[], currentPreset:null, exportFormat:'csv',
    sortCol:'updated_at', sortDir:'desc'
  },

  async render() {
    const el = document.getElementById('view-pim');
    el.innerHTML = this.shell();
    this.bindTabs();
    this.bindProducts();
    this.bindPrompts();
    this.bindIO();
    this.bindBaseXml();
    await Promise.all([this.loadProducts(), this.loadPresets()]);
  },

  shell() {
    return `
<div class="pim-tabs">
  <button class="pim-tab-btn active" data-tab="products">📋 Produkty</button>
  <button class="pim-tab-btn" data-tab="relations">🔗 Relacje &amp; Zestawy</button>
  <button class="pim-tab-btn" data-tab="parameters">📏 Parametry</button>
  <button class="pim-tab-btn" data-tab="qa">💬 Q&amp;A / FAQ</button>
  <button class="pim-tab-btn" data-tab="multicats">🏷️ Multi-Kategorie</button>
  <button class="pim-tab-btn" data-tab="prompts">✍️ Prompt &amp; Schemat</button>
  <button class="pim-tab-btn" data-tab="cms">📂 Kategorie i Strony (CMS)</button>
  <button class="pim-tab-btn" data-tab="io">📊 Import &amp; Eksport</button>
</div>

<div id="pim-tab-products" class="pim-tab-panel active">
  <div class="pim-action-bar" style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:16px; flex-wrap:nowrap;">
    <div class="pim-filter-row" style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
      <div class="search-bar" style="flex:1; max-width:300px;">
        <svg class="search-bar-icon" width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
        <input type="text" id="pim-search" placeholder="Szukaj produktow..." style="width:100%;">
      </div>
      <div style="display:flex;align-items:center;gap:4px;">
        <select class="form-select" id="pim-cat-filter" style="width:180px"><option value="">Wszystkie kategorie</option></select>
        <button class="btn btn--secondary" style="padding:6px 10px;font-size:1rem;" onclick="PimView.openCategoryManager()" title="Zarządzaj kategoriami">⚙️</button>
<button class="btn btn--primary" style="padding:6px 10px;font-size:1rem;" onclick="PimView.openShopgoldCategoryManager()" title="Zarządzaj kategoriami Shopgold">🛒</button>
      </div>
      <select class="form-select" id="pim-grp-filter" style="width:180px"><option value="">Wszyscy producenci</option></select>
    </div>
    <div style="display:flex; gap:8px; white-space:nowrap; flex-shrink:0;">
      <button class="btn btn--ghost btn--sm" id="pim-sel-all-btn">Zaznacz wszystkie</button>
      <button class="btn btn--secondary btn--sm" id="pim-new-btn">+ Nowy produkt</button>
    </div>
  </div>

  <div id="pim-bulk-bar" style="display:none" class="pim-bulk-panel">
    <span class="pim-bulk-info" id="pim-sel-count"></span>
    <select class="form-select" id="pim-preset-sel" style="width:auto;min-width:160px"><option value="">Domyslny preset</option></select>
    <button class="btn btn--primary btn--sm" id="pim-generate-btn">Generuj AI</button>
    <button class="btn btn--ghost btn--sm" id="pim-export-sel-btn">Eksportuj zaznaczone</button>
  </div>

  <div id="pim-progress" style="display:none" class="pim-progress-card">
    <div class="progress-wrap">
      <div class="progress-label"><span id="pim-prog-txt">Generowanie...</span><span id="pim-prog-pct">0%</span></div>
      <div class="progress-bar"><div class="progress-fill" id="pim-prog-fill" style="width:0%"></div></div>
    </div>
  </div>

  <div class="card" style="padding:0">
    <div class="pim-table-wrap">
      <table>
        <thead><tr>
          <th style="width:36px"><input type="checkbox" id="pim-check-all"></th>
          <th class="pim-th-sort" data-sort="name" style="cursor:pointer">Produkt <span class="sort-icon" id="sort-name">↕</span></th>
          <th class="pim-th-sort" data-sort="ean" style="cursor:pointer">EAN <span class="sort-icon" id="sort-ean">↕</span></th>
          <th class="pim-th-sort" data-sort="category" style="cursor:pointer">Kategoria <span class="sort-icon" id="sort-category">↕</span></th>
          <th class="pim-th-sort" data-sort="group_tag" style="cursor:pointer">Producent <span class="sort-icon" id="sort-group_tag">↕</span></th>
          <th class="pim-th-sort" data-sort="price" style="cursor:pointer">Cena <span class="sort-icon" id="sort-price">↕</span></th>
          <th>SEO</th>
          <th>Opis</th><th>AI</th><th style="text-align:right">Akcje</th>
        </tr></thead>
        <tbody id="pim-tbody"><tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted)">Ladowanie...</td></tr></tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--border);flex-wrap:wrap;gap:8px">
      <span id="pim-info" style="font-size:0.82rem;color:var(--text-secondary)"></span>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px;font-size:0.82rem;color:var(--text-secondary)">
          <label for="pim-per-page" style="white-space:nowrap">Produktów na stronę:</label>
          <select id="pim-per-page" class="form-select" style="width:auto;padding:4px 8px;font-size:0.82rem">
            <option value="100">100</option>
            <option value="500">500</option>
            <option value="1000">1000</option>
            <option value="2000">2000</option>
            <option value="custom">Własna...</option>
          </select>
          <input type="number" id="pim-per-page-custom" min="1" max="9999" placeholder="np. 250" class="form-input" style="width:90px;padding:4px 8px;font-size:0.82rem;display:none">
          <button class="btn btn--ghost btn--sm" id="pim-per-page-apply" style="display:none">Zastosuj</button>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn--ghost btn--sm" id="pim-prev-btn">← Poprzednia</button>
          <button class="btn btn--ghost btn--sm" id="pim-next-btn">Następna →</button>
        </div>
      </div>
    </div>
  </div>
</div>

<div id="pim-tab-qa" class="pim-tab-panel">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div>
        <h3 style="font-size:1.05rem;font-weight:700;margin:0">💬 Pytania &amp; Odpowiedzi (FAQ)</h3>
        <p style="font-size:0.82rem;color:var(--text-secondary);margin:4px 0 0">Generuj FAQ produktów z AI i zatwierdzaj do ShopGold</p>
      </div>
      
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
        <div style="display:flex;flex-direction:column;gap:4px;width:320px">
          <input type="text" id="qa-search" class="form-input" placeholder="🔍 Szukaj produktu...">
          <div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:0 4px">
            <a href="#" id="qa-sel-all">Zaznacz wszystkie</a>
            <a href="#" id="qa-sel-none">Odznacz</a>
          </div>
          <div id="qa-product-list-sel" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:4px;background:var(--bg-base);font-size:0.85rem">
            <div style="color:var(--text-muted);padding:8px;text-align:center">Ładowanie...</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:0.85rem;font-weight:600">Ilość pytań:</span>
            <span style="font-size:0.85rem">od</span>
            <input type="number" class="form-input" id="qa-min" value="3" min="1" max="15" style="width:60px">
            <span style="font-size:0.85rem">do</span>
            <input type="number" class="form-input" id="qa-max" value="7" min="1" max="15" style="width:60px">
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn--primary" id="qa-generate-btn" style="width:100%">✨ Generuj Q&amp;A masowo</button>
          </div>
          <span style="font-size:0.78rem;color:var(--text-muted);text-align:right" title="Model konfigurowany w Ustawieniach">🧠 Model: <em id="qa-model-info">z ustawień</em></span>
        </div>
      </div>
    </div>
    <div id="qa-status" style="margin-bottom:12px"></div>
    <div id="qa-list" style="display:flex;flex-direction:column;gap:12px">
      <div style="text-align:center;color:var(--text-muted);padding:40px">Zaznacz produkty i kliknij "Generuj Q&amp;A masowo"</div>
    </div>
  </div>
</div>


<div id="pim-tab-multicats" class="pim-tab-panel">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
    <div>
      <h3 style="font-size:1.05rem;font-weight:700;margin:0">🏷️ Multi-Kategorie</h3>
      <p style="font-size:0.82rem;color:var(--text-secondary);margin:4px 0 0">Przypisz produkt do wielu kategorii ShopGold</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select class="form-select" id="mc-producer-filter" style="width:180px">
        <option value="">Wszyscy producenci</option>
      </select>
      <select class="form-select" id="mc-product-sel" style="max-width:320px"><option value="">— Wybierz produkt —</option></select>
      <button class="btn btn--ghost" id="mc-ai-suggest-btn" title="AI automatycznie dobierze kategorie">🤖 AI Sugestia</button>
      <button class="btn btn--primary" id="mc-load-btn">Załaduj kategorie</button>
      <button class="btn btn--secondary" id="mc-save-btn" style="display:none">💾 Zapisz przypisania</button>
      <button class="btn btn--primary" onclick="PimView.openShopgoldCategoryManager()" title="Zarządzaj strukturą kategorii w Shopgold">🛒 Zarządzaj kategoriami sklepu</button>
    </div>
  </div>
  <div id="mc-status" style="margin-bottom:12px"></div>
  <div id="mc-categories" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
    <div style="text-align:center;color:var(--text-muted);padding:40px;grid-column:1/-1">Wybierz produkt i kliknij "Załaduj kategorie"</div>
  </div>
</div>

<div id="pim-tab-prompts" class="pim-tab-panel">
  <div style="display:grid;grid-template-columns:260px 1fr;gap:20px">
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-weight:600;font-size:0.9rem">Presety</span>
        <button class="btn btn--primary btn--sm" id="pim-new-preset-btn">+ Nowy</button>
      </div>
      <div class="preset-list" id="pim-preset-list"></div>
    </div>
    <div class="preset-editor" id="pim-preset-editor">
      <div class="preset-editor-title">Edytor presetu</div>
      <div class="form-group">
        <label class="form-label">Nazwa presetu</label>
        <input class="form-input" id="pe-name" placeholder="np. Elektronika SEO">
      </div>
      <div class="form-group">
        <label class="form-label">System Prompt</label>
        <textarea class="form-input system-textarea" id="pe-system" placeholder="Jestes ekspertem ds. copywritingu..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Szablon uzytkownika</label>
        <div class="var-chips">
          <span class="var-chip" data-var="{{name}}">{{name}}</span>
          <span class="var-chip" data-var="{{category}}">{{category}}</span>
          <span class="var-chip" data-var="{{description}}">{{description}}</span>
          <span class="var-chip" data-var="{{attributes}}">{{attributes}}</span>
          <span class="var-chip" data-var="{{price}}">{{price}}</span>
        </div>
        <textarea class="form-input prompt-textarea" id="pe-template" placeholder="Nazwa: {{name}}, Kategoria: {{category}}..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Generowane pola</label>
        <div class="fields-check-row">
          <label class="field-check-label"><input type="checkbox" class="pe-field" value="description" checked> Opis</label>
          <label class="field-check-label"><input type="checkbox" class="pe-field" value="meta_title" checked> Meta Title</label>
          <label class="field-check-label"><input type="checkbox" class="pe-field" value="meta_description" checked> Meta Desc</label>
          <label class="field-check-label"><input type="checkbox" class="pe-field" value="attributes_suggestions"> Parametry</label>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn--ghost btn--sm" id="pe-set-default-btn">Ustaw domyslny</button>
        <button class="btn btn--ghost btn--sm" id="pe-delete-btn" style="color:var(--red)">Usun</button>
        <button class="btn btn--primary" id="pe-save-btn">Zapisz preset</button>
      </div>
      <input type="hidden" id="pe-id">
    </div>
  </div>
</div>

<div id="pim-tab-io" class="pim-tab-panel">
  <div class="pim-io-grid">
    <div class="pim-io-card">
      <div class="pim-io-card-title">📥 Import produktów</div>
      <div class="form-group">
        <label class="form-label">Tryb importu</label>
        <select class="form-select" id="pim-conn-type">
          <option value="xml">XML Feed (URL)</option>
          <option value="xml-file">XML — Plik</option>
          <option value="csv">CSV — Plik</option>
          <option value="mysql">MySQL</option>
        </select>
      </div>
      <div class="form-group" id="pim-xml-url-wrap">
        <label class="form-label">🌐 URL XML Feed</label>
        <input class="form-input" id="pim-xml-url" type="url" placeholder="https://sklep.pl/xml/feed.xml">
      </div>
      <div class="form-group" id="pim-file-wrap" style="display:none">
        <label class="form-label">📎 Plik XML lub CSV</label>
        <input class="form-input" id="pim-file-input" type="file" accept=".xml,.csv" style="padding:6px">
      </div>
      <button class="btn btn--primary" id="pim-do-import-btn">📥 Importuj teraz</button>
      <div id="pim-import-result" style="margin-top:10px"></div>
    </div>

    <div class="pim-io-card">
      <div class="pim-io-card-title">📤 Eksport produktów</div>
      <div class="export-scope-info" id="pim-export-info">Zaznacz produkty w zakładce Produkty, aby eksportować wybrane. Bez zaznaczenia — eksportowane są wszystkie z aktywnym filtrem.</div>
      <div class="form-group">
        <label class="form-label">Format</label>
        <div class="export-format-row">
          <button class="export-format-btn active" id="pim-exp-csv">CSV</button>
          <button class="export-format-btn" id="pim-exp-xml">XML</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Filtr kategorii (opcjonalnie)</label>
        <select class="form-select" id="pim-exp-cat"><option value="">Wszystkie kategorie</option></select>
      </div>
      <div class="form-group">
        <label class="form-label">Filtr producenta (opcjonalnie)</label>
        <select class="form-select" id="pim-exp-grp"><option value="">Wszyscy producenci</option></select>
      </div>
      <button class="btn btn--secondary" id="pim-do-export-btn">⬇️ Pobierz plik</button>
    </div>
  </div>

  <!-- ═══ BASE XML → Generator opisów ══════════════════════════════════════ -->
  <div class="card" style="margin-top:24px;padding:24px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
      <span style="font-size:1.4rem">🗂️</span>
      <div>
        <div style="font-weight:700;font-size:1rem">Generator opisów z XML BASE / BaseLinker</div>
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px">
          Wgraj plik XML pobrany z BaseLinker → system ujednolici parametry i wygeneruje profesjonalne opisy HTML gotowe do wklejenia do sklepu
        </div>
      </div>
    </div>

    <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:12px 16px;margin:14px 0;font-size:0.82rem;color:var(--text-secondary);border-left:3px solid var(--accent)">
      ℹ️ Format pliku: eksport z BaseLinker → <b>Produkty → Eksportuj → domyślny XML</b> (np. <code>Base__Produkty__domylny_XML_2026-05-16.xml</code>)
    </div>

    <!-- Step 1: Upload -->
    <div style="margin-bottom:12px;font-weight:700;color:var(--accent-light);font-size:0.95rem">1️⃣ Krok 1: Wczytanie danych z XML</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <div class="form-group">
          <label class="form-label">📎 Plik XML z BASE</label>
          <input class="form-input" id="bx-file" type="file" accept=".xml" style="padding:6px">
        </div>
        <div class="form-group">
          <label class="form-label">🖼️ URL zdjęcia sesji produktowej</label>
          <input class="form-input" id="bx-session-photo" type="url"
            placeholder="https://kamore.pl/images/produkty/mini/images.png"
            value="https://kamore.pl/images/produkty/mini/images.png">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Pojawi się jako sekcja sesji produktowej przed „Dlaczego [marka]"</div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.88rem">
            <input type="checkbox" id="bx-use-ai" checked style="width:15px;height:15px;accent-color:var(--accent)">
            <span>Używaj AI do pisania copy (wymaga skonfigurowanego modelu)</span>
          </label>
        </div>
        <button class="btn btn--secondary" id="bx-parse-btn">▶️ Wczytaj plik</button>
      </div>
      <div id="bx-parse-info" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.85rem;text-align:center;border:1px dashed var(--border);border-radius:var(--radius);padding:20px">
        Wgraj plik XML, aby zobaczyć produkty
      </div>
    </div>

    <!-- Product list preview -->
    <div id="bx-product-list" style="display:none;margin-bottom:16px">
      <div style="margin-bottom:12px;font-weight:700;color:var(--accent-light);font-size:0.95rem;border-top:1px solid var(--border);padding-top:16px">2️⃣ Krok 2: Wybór produktów ❓</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-weight:600;font-size:0.9rem" id="bx-prod-count"></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn--ghost btn--sm" id="bx-sel-all-btn">Zaznacz wszystkie</button>
          <button class="btn btn--ghost btn--sm" id="bx-sel-none-btn">Odznacz</button>
        </div>
      </div>
      <div style="border:1px solid var(--border);border-radius:var(--radius);max-height:280px;overflow-y:auto">
        <table style="margin:0;font-size:0.82rem">
          <thead><tr>
            <th style="width:36px"><input type="checkbox" id="bx-check-all" style="width:14px;height:14px;accent-color:var(--accent)"></th>
            <th>Nazwa produktu</th>
            <th>Producent</th>
            <th>Kategoria</th>
            <th style="text-align:right">Cena</th>
            <th>Zdjęcia</th>
            <th>Parametry</th>
          </tr></thead>
          <tbody id="bx-prod-tbody"></tbody>
        </table>
      </div>
    </div>

    <!-- Generate button + progress -->
    <div id="bx-gen-row" style="display:none;flex-direction:column;gap:12px">
      <div style="margin-bottom:4px;font-weight:700;color:var(--accent-light);font-size:0.95rem;border-top:1px solid var(--border);padding-top:16px">3️⃣ Krok 3: Generowanie opisów AI ♨️</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn btn--primary" id="bx-gen-btn" style="width:fit-content">✨ Generuj opisy dla zaznaczonych</button>
        <button class="btn btn--secondary" id="bx-gen-all-btn" style="width:fit-content" title="Generuje opisy dla WSZYSTKICH produktów z pliku, niezależnie od zaznaczenia">⚡ Generuj wszystkie</button>
      </div>
      <div id="bx-progress" style="display:none">
        <div class="progress-wrap">
          <div class="progress-label">
            <span id="bx-prog-txt">Generowanie...</span>
            <span id="bx-prog-pct">0%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" id="bx-prog-fill" style="width:0%"></div></div>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div id="bx-results" style="display:none;margin-top:20px">
      <div style="margin-bottom:12px;font-weight:700;color:var(--green);font-size:0.95rem;border-top:1px solid var(--border);padding-top:16px">4️⃣ Krok 4: Gotowe opisy ✅</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <span style="font-weight:700" id="bx-results-title">⭐️ Wygenerowane opisy</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn--primary btn--sm" id="bx-download-xml-btn" title="Pobierz plik XML w formacie BaseLinker gotowy do importu">⬇️ Pobierz XML (BaseLinker)</button>
          <button class="btn btn--secondary btn--sm" id="bx-download-btn">⬇️ Pobierz HTML</button>
          <button class="btn btn--ghost btn--sm" id="bx-copy-first-btn">📋 Kopiuj pierwszy opis</button>
        </div>
      </div>
      <div id="bx-results-list" style="display:flex;flex-direction:column;gap:16px;max-height:600px;overflow-y:auto"></div>
    </div>
  </div>





  <!-- ═══ ShopGold XML → Generator opisów SEO ══════════════════════════════════════ -->
  <div class="card" style="margin-top:24px;padding:24px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
      <span style="font-size:1.4rem">🌟</span>
      <div>
        <div style="font-weight:700;font-size:1rem">Generator opisu XML dla ShopGold (SEO)</div>
        <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px">
          Wgraj plik XML z BaseLinkera → wczytaj produkty → zaznacz które opisy wygenerować → pobierz zaktualizowany XML gotowy do importu
        </div>
      </div>
    </div>

    <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:12px 16px;margin:14px 0;font-size:0.82rem;color:var(--text-secondary);border-left:3px solid var(--accent)">
      ℹ️ Format: plik XML z BaseLinkera (eksport produktów). Wygenerowane opisy zawierają <b>ld+json</b> (schema.org) i czysty HTML bez ikon — zgodne z ShopGold.
    </div>

    <!-- Step 1: Upload + Parse -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div>
        <div class="form-group">
          <label class="form-label">📎 Plik XML z BaseLinkera</label>
          <input class="form-input" id="sg-xml-file" type="file" accept=".xml" style="padding:6px">
        </div>
        <div class="form-group">
          <label class="form-label">🌐 Adres strony WWW (analiza i linkowanie w opisie)</label>
          <input class="form-input" id="sg-website-url" type="url" placeholder="https://np-twojsklep.pl">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Kluczowe słowa w generowanym opisie będą linkować do produktów/kategorii z tej domeny.</div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.88rem">
            <input type="checkbox" id="sg-use-ai" checked style="width:15px;height:15px;accent-color:var(--accent)">
            <span>Używaj AI do pisania copy (wymaga skonfigurowanego modelu)</span>
          </label>
        </div>
        <button class="btn btn--secondary" id="sg-parse-btn">📂 Wczytaj plik</button>
      </div>
      <div id="sg-parse-info" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.85rem;text-align:center;border:1px dashed var(--border);border-radius:var(--radius);padding:20px">
        Wgraj plik XML, aby zobaczyć produkty
      </div>
    </div>

    <!-- Product list -->
    <div id="sg-product-list" style="display:none;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-weight:600;font-size:0.9rem" id="sg-prod-count"></span>
        <div style="display:flex;gap:8px">
          <button class="btn btn--ghost btn--sm" id="sg-sel-all-btn">Zaznacz wszystkie</button>
          <button class="btn btn--ghost btn--sm" id="sg-sel-none-btn">Odznacz</button>
        </div>
      </div>
      <div style="border:1px solid var(--border);border-radius:var(--radius);max-height:280px;overflow-y:auto">
        <table style="margin:0;font-size:0.82rem">
          <thead><tr>
            <th style="width:36px"><input type="checkbox" id="sg-check-all" style="width:14px;height:14px;accent-color:var(--accent)"></th>
            <th>Nazwa produktu</th>
            <th>Producent</th>
            <th>Kategoria</th>
            <th style="text-align:right">Cena</th>
            <th>Parametry</th>
          </tr></thead>
          <tbody id="sg-prod-tbody"></tbody>
        </table>
      </div>
    </div>

    <!-- Generate buttons + progress -->
    <div id="sg-gen-row" style="display:none;flex-direction:column;gap:12px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn btn--primary" id="sg-gen-btn" style="width:fit-content">✨ Generuj opisy dla zaznaczonych</button>
        <button class="btn btn--secondary" id="sg-gen-all-btn" style="width:fit-content" title="Generuje opisy dla WSZYSTKICH produktów z pliku">⚡ Generuj wszystkie</button>
      </div>
      <div id="sg-progress" style="display:none">
        <div class="progress-wrap">
          <div class="progress-label">
            <span id="sg-prog-txt">Generowanie...</span>
            <span id="sg-prog-pct">0%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" id="sg-prog-fill" style="width:0%"></div></div>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div id="sg-results" style="display:none;margin-top:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <span style="font-weight:700" id="sg-results-title">Wygenerowane opisy</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn--primary btn--sm" id="sg-download-xml-btn" title="Pobierz plik XML gotowy do importu do ShopGold/BaseLinkera">⬇️ Pobierz XML</button>
          <button class="btn btn--ghost btn--sm" id="sg-copy-first-btn">📋 Kopiuj pierwszy opis</button>
        </div>
      </div>
      <div id="sg-results-list" style="display:flex;flex-direction:column;gap:16px;max-height:600px;overflow-y:auto"></div>
    </div>
  </div>

</div>



<div id="pim-tab-relations" class="pim-tab-panel">
  <div style="display:flex;gap:24px;align-items:flex-start">
    <div class="card" style="flex:1">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0">🔗 Zestawy i Relacje (Propozycje AI)</h3>
        <button class="btn btn--secondary" onclick="const el=document.getElementById('pim-rel-info'); el.style.display = el.style.display === 'none' ? 'flex' : 'none';" style="padding:4px 10px;font-size:1.1rem" title="Informacje">ℹ️</button>
      </div>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;margin-top:0">
        Wybierz produkty, dla których chcesz znaleźć Akcesoria, Produkty Podobne, utworzyć Zestawy lub powiązać Warianty. AI przeszuka cały pobrany asortyment i stworzy propozycje.
      </p>
      
      <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
        <input type="text" id="pim-rel-search" class="input" placeholder="Szukaj produktu po nazwie lub ID..." style="flex:2;min-width:200px" onkeyup="if(event.key==='Enter') PimView.loadRelationsProducts()">
        <select class="form-select" id="pim-rel-cat-filter" style="flex:1;min-width:150px" onchange="PimView.loadRelationsProducts()">
          <option value="">Wszystkie kategorie</option>
        </select>
        <select class="form-select" id="pim-rel-grp-filter" style="flex:1;min-width:150px" onchange="PimView.loadRelationsProducts()">
          <option value="">Wszyscy producenci</option>
        </select>
        <button class="btn btn--secondary" onclick="PimView.loadRelationsProducts()">Szukaj</button>
      </div>

      <div style="border:1px solid var(--border);border-radius:var(--radius);max-height:500px;overflow-y:auto;margin-bottom:16px;">
        <table style="margin:0">
          <thead>
            <tr>
              <th style="width:36px"><input type="checkbox" id="pim-rel-check-all" style="width:16px;height:16px;accent-color:var(--accent)" onchange="PimView.toggleAllRelations(this.checked)"></th>
              <th>Produkt</th>
              <th>Kategoria</th>
            </tr>
          </thead>
          <tbody id="pim-rel-tbody">
            <tr><td colspan="3" style="text-align:center;padding:16px;color:var(--text-muted)">Kliknij 'Szukaj', aby wczytać produkty</td></tr>
          </tbody>
        </table>
      </div>

      <div style="margin-bottom:12px;font-size:0.85rem">
        <strong style="display:block;margin-bottom:8px">Wybierz typy do wygenerowania:</strong>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg-elevated);border-radius:8px;cursor:pointer;border:1px solid var(--border)">
            <input type="checkbox" class="pim-rel-type-ck" value="podobne" checked style="accent-color:var(--accent);width:15px;height:15px">
            <span><span style="font-size:1rem">🔁</span> Produkty podobne</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg-elevated);border-radius:8px;cursor:pointer;border:1px solid var(--border)">
            <input type="checkbox" class="pim-rel-type-ck" value="powiazane" checked style="accent-color:var(--accent);width:15px;height:15px">
            <span><span style="font-size:1rem">🔗</span> Produkty powiązane</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg-elevated);border-radius:8px;cursor:pointer;border:1px solid var(--border)">
            <input type="checkbox" class="pim-rel-type-ck" value="akcesoria" checked style="accent-color:var(--accent);width:15px;height:15px">
            <span><span style="font-size:1rem">🧩</span> Akcesoria dodatkowe</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg-elevated);border-radius:8px;cursor:pointer;border:1px solid var(--border)">
            <input type="checkbox" class="pim-rel-type-ck" value="linki" style="accent-color:var(--accent);width:15px;height:15px">
            <span><span style="font-size:1rem">🌐</span> Powiązane linki</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg-elevated);border-radius:8px;cursor:pointer;border:1px solid var(--border)">
            <input type="checkbox" class="pim-rel-type-ck" value="warianty" checked style="accent-color:var(--accent);width:15px;height:15px">
            <span><span style="font-size:1rem">🎨</span> Inne warianty produktu</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--bg-elevated);border-radius:8px;cursor:pointer;border:1px solid var(--border)" title="Filtrowanie akceptacji wg typów relacji w Module Akceptacji">
            <input type="checkbox" class="pim-rel-type-ck" value="akceptacja" style="accent-color:var(--accent);width:15px;height:15px">
            <span><span style="font-size:1rem">✅</span> Filtr akceptacji</span>
          </label>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface);padding:12px 16px;border-radius:var(--radius);border:1px solid var(--border)">
        <div style="font-size:0.85rem">Wybrano: <strong id="pim-rel-count" style="color:var(--accent)">0</strong></div>
        <button class="btn btn--primary" id="pim-rel-generate-btn" onclick="PimView.generateRelations()">✨ Zaproponuj relacje AI</button>
      </div>
    </div>
    
    <div id="pim-rel-info" style="width:350px;display:none;flex-direction:column;gap:16px">
      <div class="card">
        <h4 style="margin-top:0;margin-bottom:12px">Typy relacji ShopGold</h4>
        <ul style="font-size:0.85rem;color:var(--text-secondary);padding-left:0;margin:0;line-height:1.7;list-style:none;display:flex;flex-direction:column;gap:8px">
          <li><span style="font-size:1rem">🔁</span> <strong>Produkty podobne</strong> — alternatywy tej samej kategorii, gdy główny produkt nie pasuje klientowi.</li>
          <li><span style="font-size:1rem">🔗</span> <strong>Produkty powiązane</strong> — uzupełnienia i cross-sell ("Kup razem"), np. torba + kłódka.</li>
          <li><span style="font-size:1rem">🧩</span> <strong>Akcesoria dodatkowe</strong> — dedykowane akcesoria przypisane do produktu (etui, ładowarka, pokrowiec).</li>
          <li><span style="font-size:1rem">🌐</span> <strong>Powiązane linki</strong> — linki zewnętrzne lub wewnętrzne (np. instrukcja, strona producenta).</li>
          <li><span style="font-size:1rem">🎨</span> <strong>Inne warianty produktu</strong> — ten sam produkt w innym kolorze, rozmiarze lub wersji.</li>
          <li><span style="font-size:1rem">✅</span> <strong>Filtr akceptacji i relacje</strong> — wyświetla propozycje relacji w Module Akceptacji do zatwierdzenia przed wysyłką do ShopGold.</li>
        </ul>
        <div style="margin-top:16px;padding:12px;background:var(--bg-base);border-radius:var(--radius);font-size:0.8rem;border-left:3px solid var(--blue)">
          Po zatwierdzeniu w Module Akceptacji relacje są wysyłane bezpośrednio do ShopGold i widoczne na stronie produktu.
        </div>
      </div>
    </div>
  </div>
</div>

<div id="pim-tab-parameters" class="pim-tab-panel">
  <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap">

    <!-- LEFT: Parameter list -->
    <div class="card" style="width:280px;flex-shrink:0;max-height:680px;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h3 style="margin:0">📏 Parametry (Cechy)</h3>
        <span id="pim-param-count" style="font-size:0.75rem;color:var(--text-muted)"></span>
      </div>
      <select class="form-select" id="pim-param-cat-filter" style="margin-bottom:8px;font-size:0.82rem">
        <option value="">Wszystkie kategorie</option>
      </select>
      <input class="form-input" id="pim-param-search" placeholder="Szukaj parametru..." style="margin-bottom:10px;font-size:0.82rem">
      <div style="flex:1;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);">
        <ul id="pim-param-list" style="list-style:none;margin:0;padding:0;">
          <li style="padding:12px;text-align:center;color:var(--text-muted);font-size:0.85rem;">Ładowanie z ShopGold...</li>
        </ul>
      </div>
      <!-- Merge Names section -->
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
        <div style="font-weight:600;font-size:0.85rem;margin-bottom:8px">🔀 Scal nazwy parametrów</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:10px">Zaznacz parametry na liście i wskaż docelową nazwę.</div>
        <input class="form-input" id="pim-param-merge-target" placeholder="Docelowa nazwa (np. EAN)" style="font-size:0.82rem;margin-bottom:8px">
        <div style="display:flex;gap:6px">
          <button class="btn btn--secondary btn--sm" id="pim-param-merge-btn" style="flex:1" onclick="PimView.mergeParameterNames()">🔀 Scal zaznaczone</button>
        </div>
        <div id="pim-param-merge-selected" style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">Zaznaczono: 0</div>
      </div>
    </div>

    <!-- RIGHT: Values panel -->
    <div class="card" style="flex:1;min-width:300px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;gap:12px;flex-wrap:wrap">
        <div>
          <h3 style="margin-bottom:4px">Wartości: <span id="pim-param-title" style="color:var(--accent)">Wybierz parametr</span></h3>
          <p style="color:var(--text-muted);font-size:0.82rem;margin:0">Zaznacz wartości które chcesz ujednolicić, wpisz docelową wartość.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn--ghost btn--sm" id="pim-param-select-all-btn" onclick="PimView.selectAllValues()" disabled>☑ Wszystkie</button>
          <button class="btn btn--secondary btn--sm" id="pim-param-manual-btn" onclick="PimView.manualMergeValues()" disabled>🔀 Scal ręcznie</button>
          <button class="btn btn--primary btn--sm" id="pim-param-standardize-btn" onclick="PimView.standardizeParameter()" disabled>✨ AI</button>
        </div>
      </div>

      <!-- Target value input -->
      <div id="pim-param-merge-row" style="display:none;background:var(--bg-elevated);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;border:1px solid var(--border)">
        <label style="font-size:0.8rem;font-weight:600;display:block;margin-bottom:6px">Docelowa wartość (po scaleniu):</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="form-input" id="pim-param-target-val" placeholder="Wpisz lub wybierz z listy..." style="flex:1;font-size:0.85rem">
          <span id="pim-param-sel-count" style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">0 zaznaczonych</span>
        </div>
        <div id="pim-param-target-suggestions" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px"></div>
      </div>

      <div id="pim-param-values" style="display:flex;flex-wrap:wrap;gap:8px;padding:12px;background:var(--bg-base);border:1px solid var(--border);border-radius:var(--radius);min-height:180px;align-content:flex-start;">
        <div style="color:var(--text-muted);font-size:0.85rem;width:100%;text-align:center;margin-top:40px;">Wybierz parametr z listy</div>
      </div>
    </div>
  </div>
</div>

<div id="pim-tab-cms" class="pim-tab-panel">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px">
    <div>
      <h3 style="font-size:1.05rem;font-weight:700;margin:0">📂 Kategorie i Strony (CMS)</h3>
      <p style="font-size:0.82rem;color:var(--text-secondary);margin:4px 0 0">Zarządzanie treścią nienależącą do asortymentu (SEO, JSON-LD, FAQ)</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <select class="form-select" id="cms-type-filter" style="width:200px">
        <option value="all">Wszystkie typy</option>
        <option value="homepage">Strona Główna</option>
        <option value="category">Kategorie</option>
        <option value="page">Strony Informacyjne</option>
        <option value="manufacturer">Producenci / Marki</option>
      </select>
      <button class="btn btn--ghost btn--sm" id="cms-refresh-btn">🔄 Odśwież</button>
    </div>
  </div>
  
  <div class="card" style="padding:0">
    <div class="pim-table-wrap">
      <table style="margin:0">
        <thead><tr>
          <th style="width:120px">Typ</th>
          <th style="width:60px">ID</th>
          <th>Nazwa / Tytuł</th>
          <th style="width:100px">Wynik SEO</th>
          <th>Braki (Zalecenia)</th>
          <th style="text-align:right;width:160px">Akcje</th>
        </tr></thead>
        <tbody id="cms-tbody"><tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">Kliknij "Odśwież" aby załadować</td></tr></tbody>
      </table>
    </div>
  </div>
</div>`;
  },

  bindTabs() {
    const savedTab = localStorage.getItem('pim-active-tab') || 'products';
    let clicked = false;
    document.querySelectorAll('.pim-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pim-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.pim-tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('pim-tab-' + btn.dataset.tab).classList.add('active');
        localStorage.setItem('pim-active-tab', btn.dataset.tab);
        if (btn.dataset.tab === 'prompts') this.renderPresetList();
        if (btn.dataset.tab === 'parameters') this.loadParameters();
        if (btn.dataset.tab === 'relations') this.loadRelationsProducts();
        if (btn.dataset.tab === 'qa') { this.bindQA(); }
        if (btn.dataset.tab === 'multicats') { this.bindMulticats(); this.populateProductSelects(); }
        if (btn.dataset.tab === 'cms') { this.bindCms(); this.loadCmsEntities(); }
      });
      if (btn.dataset.tab === savedTab) {
        btn.click();
        clicked = true;
      }
    });
    // Fallback if saved tab is missing
    if (!clicked && document.querySelector('.pim-tab-btn')) {
       document.querySelector('.pim-tab-btn').click();
    }
  },

  calculateSeoScore(p) {
    let score = 0;
    const missing = [];
    if (p.name && p.name.trim()) score += 10; else missing.push('Brak nazwy');
    if (p.category && p.category.trim()) score += 10; else missing.push('Brak kategorii');
    if (p.description && p.description.trim().length > 50) score += 20; else missing.push('Brak lub za krótki opis HTML');
    if (p.meta_title && p.meta_title.trim()) score += 15; else missing.push('Brak meta_title');
    if (p.meta_description && p.meta_description.trim()) score += 15; else missing.push('Brak meta_description');
    
    let attrs = {};
    try { attrs = typeof p.attributes === 'string' ? JSON.parse(p.attributes) : (p.attributes || {}); } catch(e){}
    if (Object.keys(attrs).length > 0) score += 15; else missing.push('Brak parametrów/cech');

    let imgs = [];
    try { imgs = typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []); } catch(e){}
    if (imgs.length > 0) score += 15; else missing.push('Brak zdjęć');

    return { score, missing };
  },

  async populateProductSelects() {
    // Build product search for mc-product-sel (with producer filter support)
    ['mc-product-sel'].forEach(selId => {
      const sel = document.getElementById(selId);
      if (!sel || sel._searchBound) return;
      sel._searchBound = true;

      // Wrap select in a search container
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;display:inline-flex;flex-direction:column;gap:4px;max-width:340px;width:100%';
      sel.parentNode.insertBefore(wrapper, sel);

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = '🔍 Szukaj produktu...';
      searchInput.className = 'form-input';
      searchInput.style.cssText = 'font-size:0.82rem;padding:6px 10px';
      wrapper.appendChild(searchInput);
      wrapper.appendChild(sel);

      let searchTimer;
      const loadOptions = async (query = '', groupTag = '') => {
        sel.innerHTML = '<option value="">Ładowanie...</option>';
        try {
          let url = `/products?limit=150&offset=0`;
          if (query) url += `&search=${encodeURIComponent(query)}`;
          if (groupTag) url += `&group_tag=${encodeURIComponent(groupTag)}`;
          const d = await API.get(url);
          const products = d.products || [];
          sel.innerHTML = '<option value="">— Wybierz produkt —</option>' +
            products.map(p => `<option value="${p.id}">${escHtml((p.name || '').slice(0,65))} [#${p.shop_id}]</option>`).join('');
        } catch(e) {
          sel.innerHTML = '<option value="">Błąd ładowania produktów</option>';
        }
      };

      // Expose _loadOptions so producer filter can trigger it
      sel._loadOptions = loadOptions;

      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const groupTag = selId === 'mc-product-sel' ? (document.getElementById('mc-producer-filter')?.value || '') : '';
        searchTimer = setTimeout(() => loadOptions(searchInput.value, groupTag), 350);
      });

      // Initial load
      loadOptions();
    });

    // Fill producer filter from API groups
    const producerFilter = document.getElementById('mc-producer-filter');
    if (producerFilter && producerFilter.options.length <= 1) {
      try {
        const d = await API.get('/products?limit=1');
        const groups = d.groups || [];
        if (groups.length) {
          producerFilter.innerHTML = '<option value="">Wszyscy producenci</option>' +
            groups.map(g => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('');
        }
      } catch(e) {}
    }
  },

  bindQA() {
    const genBtn = document.getElementById('qa-generate-btn');
    if (!genBtn || genBtn._bound) return;
    genBtn._bound = true;

    // Show current configured model
    API.get('/settings').then(s => {
      const modelInfo = document.getElementById('qa-model-info');
      if (modelInfo) {
        const m = s.ai_map_pim_qa || s.owui_default_model || 'auto';
        modelInfo.textContent = m;
        modelInfo.title = 'Zmień model w Ustawienia → AI → Mapowanie Funkcji AI (pozycja: Katalog: Generowanie Q&A)';
      }
    }).catch(() => {});

    // Load products list for QA
    const loadQaProducts = async (query = '') => {
      const listEl = document.getElementById('qa-product-list-sel');
      if (!listEl) return;
      listEl.innerHTML = '<div style="padding:8px;text-align:center">Ładowanie...</div>';
      try {
        let url = `/products?limit=150&offset=0`;
        if (query) url += `&search=${encodeURIComponent(query)}`;
        const d = await API.get(url);
        const products = d.products || [];
        if (!products.length) {
          listEl.innerHTML = '<div style="padding:8px;color:var(--text-muted)">Brak wyników</div>';
          return;
        }
        listEl.innerHTML = products.map(p => `
          <label style="display:flex;align-items:center;gap:6px;padding:4px;cursor:pointer;border-bottom:1px solid var(--border-light)">
            <input type="checkbox" class="qa-prod-ck" value="${p.id}" data-name="${escHtml(p.name)}">
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(p.name)} [#${p.shop_id}]</span>
          </label>
        `).join('');
      } catch(e) {
        listEl.innerHTML = '<div style="color:var(--red);padding:8px">Błąd ładowania</div>';
      }
    };

    let searchTimer;
    const searchInput = document.getElementById('qa-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => loadQaProducts(searchInput.value), 350);
      });
    }

    document.getElementById('qa-sel-all')?.addEventListener('click', e => { e.preventDefault(); document.querySelectorAll('.qa-prod-ck').forEach(ck => ck.checked = true); });
    document.getElementById('qa-sel-none')?.addEventListener('click', e => { e.preventDefault(); document.querySelectorAll('.qa-prod-ck').forEach(ck => ck.checked = false); });

    loadQaProducts();

    genBtn.addEventListener('click', async () => {
      const selectedIds = [...document.querySelectorAll('.qa-prod-ck:checked')].map(ck => ck.value);
      if (!selectedIds.length) return Toast.warn('Wybierz co najmniej jeden produkt z listy');
      
      const minCount = parseInt(document.getElementById('qa-min').value) || 3;
      const maxCount = parseInt(document.getElementById('qa-max').value) || 7;
      if (minCount > maxCount) return Toast.warn('Minimalna ilość nie może być większa niż maksymalna');
      
      const status = document.getElementById('qa-status');
      const qaList = document.getElementById('qa-list');
      qaList.innerHTML = '';
      
      genBtn.disabled = true;
      let processed = 0;
      let errors = 0;
      
      for (const productId of selectedIds) {
        processed++;
        status.innerHTML = `<div style="color:var(--accent-light);padding:8px;font-weight:600">⏳ Generowanie pytań przez AI (${processed}/${selectedIds.length})...</div>`;
        const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
        
        try {
          const d = await API.post(`/products/${productId}/qa`, { count });
          
          const prodName = document.querySelector(`.qa-prod-ck[value="${productId}"]`)?.dataset.name || productId;
          const container = document.createElement('div');
          container.style.border = '1px solid var(--border)';
          container.style.padding = '16px';
          container.style.marginBottom = '12px';
          container.style.borderRadius = 'var(--radius)';
          container.innerHTML = `<h4 style="margin:0 0 12px 0;font-size:0.95rem;color:var(--green)">✅ Wygenerowano ${d.count} pytań dla: ${escHtml(prodName)}</h4>
                                 <div id="qa-results-${productId}"></div>`;
          qaList.appendChild(container);
          
          const subList = container.querySelector(`#qa-results-${productId}`);
          if (d.qa && d.qa.length) {
            d.qa.forEach(item => {
              const el = document.createElement('div');
              el.style.cssText = 'background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px';
              el.innerHTML = `
                <div style="font-weight:600;margin-bottom:6px;color:var(--text-primary)">Q: ${escHtml(item.question)}</div>
                <div style="font-size:0.85rem;color:var(--text-secondary)">A: ${escHtml(item.answer)}</div>
              `;
              subList.appendChild(el);
            });
          }
        } catch(e) {
          errors++;
          const errEl = document.createElement('div');
          errEl.style.color = 'var(--red)';
          errEl.style.padding = '12px';
          errEl.textContent = `❌ Błąd dla produktu ${productId}: ${e.message}`;
          qaList.appendChild(errEl);
        }
      }
      
      status.innerHTML = `<div style="color:${errors===0?'var(--green)':'var(--accent)'};padding:8px;font-weight:600">✅ Zakończono generowanie masowe (Błędy: ${errors}). Pytań można zarządzać w oknie edycji danego produktu (przycisk Q&A).</div>`;
      genBtn.disabled = false;
    });
  },

  // renderQAList function is no longer used for the bulk FAQ generation, keeping it just in case if other components invoke it
  renderQAList(qa, productId) {
    const el = document.getElementById('qa-list');
    if (!qa.length) {
      el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px">Brak zapisanych pytań. Wygeneruj nowe.</div>';
      return;
    }
    el.innerHTML = qa.map(item => {
      const statusColor = item.status === 'approved' ? '#10b981' : item.status === 'rejected' ? '#ef4444' : '#8b90a8';
      const statusLabel = item.status === 'approved' ? '✅ Zatwierdzone' : item.status === 'rejected' ? '❌ Odrzucone' : '⏳ Oczekuje';
      return `<div class="card" style="padding:16px;border-left:3px solid ${statusColor}" data-qa-id="${item.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div style="font-weight:700;margin-bottom:6px;color:var(--text-primary)">❓ ${escHtml(item.question)}</div>
            <div style="color:var(--text-secondary);font-size:0.88rem;line-height:1.5">${escHtml(item.answer)}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
            <span style="font-size:0.75rem;color:${statusColor};font-weight:600">${statusLabel}</span>
            ${item.status !== 'approved' ? `<button class="btn btn--primary btn--sm qa-approve-btn" data-id="${item.id}" data-product="${productId}">✓ Zatwierdź</button>` : ''}
            ${item.status === 'approved' ? `<button class="btn btn--ghost btn--sm qa-shopgold-btn" data-id="${item.id}" style="color:var(--green)">→ ShopGold</button>` : ''}
            <button class="btn btn--ghost btn--sm qa-delete-btn" data-id="${item.id}" data-product="${productId}" style="color:var(--red)">🗑</button>
          </div>
        </div>
      </div>`;
    }).join('');

    // Bind buttons
    el.querySelectorAll('.qa-approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.patch(`/products/qa/${btn.dataset.id}`, { status: 'approved' });
          const d = await API.get(`/products/${btn.dataset.product}/qa`);
          this.renderQAList(d.qa, btn.dataset.product);
        } catch(e) { alert(e.message); }
      });
    });
    el.querySelectorAll('.qa-shopgold-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const r = await API.post(`/products/qa/${btn.dataset.id}/approve`, {});
          alert(r.note || 'Wysłano do ShopGold');
        } catch(e) { alert(e.message); }
      });
    });
    el.querySelectorAll('.qa-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Usunąć to pytanie?')) return;
        try {
          await API.delete(`/products/qa/${btn.dataset.id}`);
          const d = await API.get(`/products/${btn.dataset.product}/qa`);
          this.renderQAList(d.qa, btn.dataset.product);
        } catch(e) { alert(e.message); }
      });
    });
  },

  bindMulticats() {
    const loadBtn = document.getElementById('mc-load-btn');
    const saveBtn = document.getElementById('mc-save-btn');
    const aiBtn   = document.getElementById('mc-ai-suggest-btn');
    const producerFilter = document.getElementById('mc-producer-filter');
    if (!loadBtn || loadBtn._bound) return;
    loadBtn._bound = true;

    // Fill producer filter from state groups
    if (producerFilter && this.state.groups?.length) {
      producerFilter.innerHTML = '<option value="">Wszyscy producenci</option>' +
        this.state.groups.map(g => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('');
    }
    // When producer filter changes — reload product select filtered by group_tag
    if (producerFilter) {
      producerFilter.addEventListener('change', () => {
        const sel = document.getElementById('mc-product-sel');
        if (!sel || !sel._loadOptions) return;
        sel._loadOptions('', producerFilter.value);
      });
    }

    const doLoad = async () => {
      const productId = document.getElementById('mc-product-sel').value;
      if (!productId) return alert('Wybierz produkt');
      const catsEl = document.getElementById('mc-categories');
      catsEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)">Ładowanie...</div>';
      try {
        const [allCats, assigned] = await Promise.all([
          API.get('/products/store-categories').then(d => d.categories || []),
          API.get(`/products/${productId}/categories`).then(d => d.assigned || [])
        ]);
        const assignedIds = new Set(assigned.map(a => a.category_id));
        if (!allCats.length) {
          catsEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)">Brak kategorii w bazie</div>';
          return;
        }
        this._renderCategoryCheckboxes(catsEl, allCats, assignedIds);
        saveBtn.style.display = '';
        saveBtn.dataset.product = productId;
      } catch(e) {
        catsEl.innerHTML = `<div style="grid-column:1/-1;color:var(--red);padding:12px">${escHtml(e.message)}</div>`;
      }
    };

    loadBtn.addEventListener('click', doLoad);

    // AI Suggest categories
    if (aiBtn) {
      aiBtn.addEventListener('click', async () => {
        const productId = document.getElementById('mc-product-sel').value;
        if (!productId) return alert('Wybierz produkt');
        const statusEl = document.getElementById('mc-status');
        aiBtn.disabled = true;
        statusEl.innerHTML = '<div style="color:var(--accent-light);padding:8px">🤖 AI analizuje produkt i dobiera kategorie...</div>';
        try {
          // First load categories if not already loaded
          const catsEl = document.getElementById('mc-categories');
          const checkboxes = catsEl.querySelectorAll('.mc-cat-ck');
          const allCats = checkboxes.length
            ? [...checkboxes].map(c => c.value)
            : await API.get('/products/store-categories').then(d => d.categories || []);

          if (!allCats.length) { statusEl.innerHTML = '<div style="color:var(--red);padding:8px">Brak kategorii w bazie</div>'; return; }

          const product = await API.get(`/products/${productId}`);
          const prompt = `Masz produkt e-commerce:\nNazwa: ${product.name}\nOpis: ${product.description ? product.description.replace(/<[^>]+>/g,'').slice(0,400) : 'brak'}\nKategoria główna: ${product.category || 'brak'}\n\nDostępne kategorie w sklepie:\n${allCats.join('\n')}\n\nKtóre kategorie pasują do tego produktu? Wybierz WSZYSTKIE pasujące. Zwróć TYLKO JSON: {"categories": ["Kategoria1", "Kategoria2"]}`;

          const r = await API.post('/products/' + productId + '/qa', { count: 1, _aiPrompt: prompt });
          // This won't work - we need a different AI call. Use openwebui directly via a simple endpoint
          throw new Error('Użyj przycisku "Załaduj kategorie" i zaznacz ręcznie, lub skonfiguruj AI w Ustawienia');
        } catch(e) {
          statusEl.innerHTML = `<div style="color:var(--red);padding:8px">⚠️ ${escHtml(e.message)}</div>`;
          setTimeout(() => statusEl.innerHTML = '', 5000);
        } finally { aiBtn.disabled = false; }
      });
    }

    saveBtn.addEventListener('click', async () => {
      const productId = saveBtn.dataset.product;
      if (!productId) return;
      const categories = [...document.querySelectorAll('.mc-cat-ck:checked')].map(ck => ({
        category_id: ck.value, category_name: ck.value
      }));
      try {
        await API.post(`/products/${productId}/categories`, { categories });
        document.getElementById('mc-status').innerHTML = `<div style="color:var(--green);padding:8px">✅ Zapisano ${categories.length} kategorii</div>`;
        setTimeout(() => { document.getElementById('mc-status').innerHTML = ''; }, 3000);
      } catch(e) {
        document.getElementById('mc-status').innerHTML = `<div style="color:var(--red);padding:8px">❌ ${escHtml(e.message)}</div>`;
      }
    });
  },

  _renderCategoryCheckboxes(catsEl, allCats, assignedIds) {
    catsEl.innerHTML = allCats.map(cat => `
      <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--bg-elevated);border-radius:8px;cursor:pointer;border:1px solid ${assignedIds.has(cat) ? 'var(--accent)' : 'var(--border)'};transition:border-color .2s">
        <input type="checkbox" class="mc-cat-ck" value="${escHtml(cat)}" ${assignedIds.has(cat) ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent)">
        <span style="font-size:0.88rem">${escHtml(cat)}</span>
      </label>`).join('');
    catsEl.querySelectorAll('.mc-cat-ck').forEach(ck => {
      ck.addEventListener('change', () => {
        ck.closest('label').style.borderColor = ck.checked ? 'var(--accent)' : 'var(--border)';
      });
    });
  },




  // --- PARAMETERS TAB ---
  async loadParameters() {
    try {
      const catEl = document.getElementById('pim-param-cat-filter');
      const cat = catEl ? catEl.value : '';
      const url = cat ? `/products/parameters/all?category=${encodeURIComponent(cat)}` : '/products/parameters/all';
      
      const listEl = document.getElementById('pim-param-list');
      if (listEl) listEl.innerHTML = '<li style="padding:12px;text-align:center;color:var(--text-muted);font-size:0.85rem;">Ładowanie...</li>';

      const d = await API.get(url);
      if (d.success) {
        this.state.parameters = d.items;
        this.state.paramSelectedForMerge = new Set(); // for name-merge checkboxes
        this.renderParametersList();
      }
    } catch (e) {
      Toast.error('Błąd ładowania parametrów: ' + e.message);
    }
  },

  renderParametersList(filter = '') {
    const list = document.getElementById('pim-param-list');
    if (!this.state.parameters || !this.state.parameters.length) {
      list.innerHTML = '<li style="padding:12px;text-align:center;color:var(--text-muted);font-size:0.85rem;">Brak cech w bazie</li>';
      return;
    }
    // Group by feature_id
    const map = new Map();
    for (const p of this.state.parameters) {
      if (!map.has(p.feature_id)) map.set(p.feature_id, { id: p.feature_id, name: p.feature_name, values: [] });
      map.get(p.feature_id).values.push(p);
    }
    this.state.parametersGrouped = Array.from(map.values());

    const fl = filter.toLowerCase();
    const visible = fl ? this.state.parametersGrouped.filter(g => g.name.toLowerCase().includes(fl)) : this.state.parametersGrouped;

    document.getElementById('pim-param-count').textContent = `${visible.length} / ${this.state.parametersGrouped.length}`;

    // Virtualization: render only first N items for performance
    const RENDER_LIMIT = 100;
    const toRender = visible.slice(0, RENDER_LIMIT);
    const hasMore = visible.length > RENDER_LIMIT;

    list.innerHTML = toRender.map(g => {
      const mergeChecked = this.state.paramSelectedForMerge?.has(g.id);
      return `
      <li class="pim-param-item" data-id="${g.id}" style="padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" class="pim-merge-ck" data-param-id="${g.id}" ${mergeChecked ? 'checked' : ''}
          onclick="event.stopPropagation(); PimView.toggleMergeParam(${g.id}, this.checked)"
          style="width:14px;height:14px;accent-color:var(--accent);flex-shrink:0">
        <div style="flex:1;min-width:0" onclick="PimView.selectParameter(${g.id})">
          <div style="font-weight:500;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(g.name)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${g.values.length} wartości</div>
        </div>
      </li>`;
    }).join('');

    if (hasMore) {
      list.innerHTML += `<li style="padding:12px;text-align:center;border-bottom:1px solid var(--border);">
        <button class="btn btn--ghost btn--sm" onclick="PimView._renderMoreParams('${escHtml(filter)}')">
          Pokaż pozostałe ${visible.length - RENDER_LIMIT} parametrów…
        </button>
      </li>`;
    }
  },

  _renderMoreParams(filter) {
    const fl = filter.toLowerCase();
    const visible = fl ? this.state.parametersGrouped.filter(g => g.name.toLowerCase().includes(fl)) : this.state.parametersGrouped;
    const list = document.getElementById('pim-param-list');
    
    list.innerHTML = visible.map(g => {
      const mergeChecked = this.state.paramSelectedForMerge?.has(g.id);
      return `
      <li class="pim-param-item" data-id="${g.id}" style="padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;cursor:pointer;">
        <input type="checkbox" class="pim-merge-ck" data-param-id="${g.id}" ${mergeChecked ? 'checked' : ''}
          onclick="event.stopPropagation(); PimView.toggleMergeParam(${g.id}, this.checked)"
          style="width:14px;height:14px;accent-color:var(--accent);flex-shrink:0">
        <div style="flex:1;min-width:0" onclick="PimView.selectParameter(${g.id})">
          <div style="font-weight:500;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(g.name)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted)">${g.values.length} wartości</div>
        </div>
      </li>`;
    }).join('');
  },

  toggleMergeParam(id, checked) {
    if (!this.state.paramSelectedForMerge) this.state.paramSelectedForMerge = new Set();
    checked ? this.state.paramSelectedForMerge.add(id) : this.state.paramSelectedForMerge.delete(id);
    const cnt = this.state.paramSelectedForMerge.size;
    const el = document.getElementById('pim-param-merge-selected');
    if (el) el.textContent = `Zaznaczono: ${cnt}`;
  },

  async mergeParameterNames() {
    const selected = this.state.paramSelectedForMerge;
    if (!selected || selected.size < 2) return Toast.warn('Zaznacz co najmniej 2 nazwy parametrów do scalenia.');
    const targetName = document.getElementById('pim-param-merge-target').value.trim();
    if (!targetName) return Toast.warn('Podaj docelową nazwę parametru.');

    const selectedParams = this.state.parametersGrouped.filter(g => selected.has(g.id));
    const names = selectedParams.map(g => `"${g.name}"`).join(', ');
    if (!confirm(`Scal parametry: ${names} → "${targetName}"?\n\nZostanie utworzona propozycja w Module Akceptacji.`)) return;

    try {
      setBtn('pim-param-merge-btn', true);
      const featureIds = Array.from(selected);
      const r = await API.post('/products/parameters/merge-names', { featureIds, targetName });
      if (r.success) {
        Toast.success(`✅ ${r.proposals} propozycji dodano do Akceptacji!`);
        selected.clear();
        document.getElementById('pim-param-merge-selected').textContent = 'Zaznaczono: 0';
        document.getElementById('pim-param-merge-target').value = '';
        this.renderParametersList(document.getElementById('pim-param-search')?.value || '');
        if (typeof refreshApprovalBadge === 'function') refreshApprovalBadge();
      }
    } catch(e) {
      Toast.error('Błąd: ' + e.message);
    } finally {
      setBtn('pim-param-merge-btn', false);
    }
  },

  selectParameter(id) {
    document.querySelectorAll('.pim-param-item').forEach(el => {
      el.style.background = el.dataset.id == id ? 'var(--bg-elevated)' : '';
    });
    const param = this.state.parametersGrouped.find(g => g.id == id);
    if (!param) return;
    this.state.selectedParameter = param;
    this.state.selectedValues = new Set(); // reset value selection

    document.getElementById('pim-param-title').textContent = param.name;
    ['pim-param-standardize-btn','pim-param-manual-btn','pim-param-select-all-btn'].forEach(id => {
      const b = document.getElementById(id); if(b) b.disabled = param.values.length < 2;
    });

    // Render value chips with checkboxes
    document.getElementById('pim-param-values').innerHTML = param.values.map(v => `
      <label style="background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;padding:5px 12px;font-size:0.83rem;display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;transition:border-color .15s" class="pim-val-chip">
        <input type="checkbox" class="pim-val-ck" value="${escHtml(v.feature_value)}"
          onchange="PimView.onValueCheck(this)"
          style="width:13px;height:13px;accent-color:var(--accent)">
        <span>${escHtml(v.feature_value)}</span>
        <span style="color:var(--text-muted);font-size:0.72rem">(${v.product_count})</span>
      </label>
    `).join('');

    document.getElementById('pim-param-merge-row').style.display = 'none';
    this.updateMergeRowSuggestions(param);
  },

  onValueCheck(cb) {
    if (!this.state.selectedValues) this.state.selectedValues = new Set();
    cb.checked ? this.state.selectedValues.add(cb.value) : this.state.selectedValues.delete(cb.value);
    const cnt = this.state.selectedValues.size;
    const row = document.getElementById('pim-param-merge-row');
    row.style.display = cnt >= 1 ? 'block' : 'none';
    const cntEl = document.getElementById('pim-param-sel-count');
    if (cntEl) cntEl.textContent = `${cnt} zaznaczone`;
    // Highlight checked chips
    document.querySelectorAll('.pim-val-chip').forEach(chip => {
      const ck = chip.querySelector('.pim-val-ck');
      chip.style.borderColor = ck.checked ? 'var(--accent)' : 'var(--border)';
      chip.style.background  = ck.checked ? 'rgba(99,102,241,0.12)' : 'var(--bg-surface)';
    });
  },

  selectAllValues() {
    if (!this.state.selectedParameter) return;
    const allChecked = document.querySelectorAll('.pim-val-ck:checked').length === this.state.selectedParameter.values.length;
    document.querySelectorAll('.pim-val-ck').forEach(ck => {
      ck.checked = !allChecked;
      this.onValueCheck(ck);
    });
  },

  updateMergeRowSuggestions(param) {
    const el = document.getElementById('pim-param-target-suggestions');
    if (!el || !param) return;
    el.innerHTML = param.values.slice(0, 8).map(v =>
      `<button type="button" style="border:1px solid var(--border);border-radius:12px;padding:2px 10px;font-size:0.75rem;background:var(--bg-elevated);cursor:pointer;color:var(--text-secondary)"
        onclick="document.getElementById('pim-param-target-val').value='${escHtml(v.feature_value).replace(/'/g,"\\'")}'">${escHtml(v.feature_value)}</button>`
    ).join('');
  },

  async manualMergeValues() {
    const param = this.state.selectedParameter;
    if (!param) return;
    const selected = this.state.selectedValues;
    if (!selected || selected.size < 2) return Toast.warn('Zaznacz co najmniej 2 wartości do scalenia.');
    const targetVal = document.getElementById('pim-param-target-val').value.trim();
    if (!targetVal) return Toast.warn('Wpisz docelową wartość scalenia.');

    const vals = Array.from(selected);
    if (!confirm(`Scal wartości: ${vals.map(v=>`"${v}"`).join(', ')} → "${targetVal}"?\n\nZostanie utworzona propozycja w Module Akceptacji.`)) return;

    try {
      setBtn('pim-param-manual-btn', true);
      const r = await API.post('/products/parameters/manual-merge', {
        featureId: param.id,
        featureName: param.name,
        sourceValues: vals,
        targetValue: targetVal,
      });
      if (r.success) {
        Toast.success(`✅ ${r.proposals} propozycji dodano do Akceptacji!`);
        this.state.selectedValues.clear();
        if (typeof refreshApprovalBadge === 'function') refreshApprovalBadge();
      }
    } catch(e) {
      Toast.error('Błąd: ' + e.message);
    } finally {
      setBtn('pim-param-manual-btn', false);
    }
  },

  async standardizeParameter() {
    const param = this.state.selectedParameter;
    if (!param) return;
    // Use only selected values if any, otherwise all
    const selected = this.state.selectedValues;
    const values = (selected && selected.size > 0)
      ? Array.from(selected)
      : param.values.map(v => v.feature_value);

    if (values.length < 2) return Toast.warn('Potrzebne co najmniej 2 wartości do analizy AI.');

    try {
      setBtn('pim-param-standardize-btn', true);
      Toast.info(`✨ AI ujednolica${selected?.size > 0 ? ' zaznaczone' : ''} wartości parametru "${param.name}"...`);
      const r = await API.post('/products/parameters/standardize-bulk', {
        featureId: param.id,
        featureName: param.name,
        values,
      });
      if (r.success) {
        if (r.proposals > 0) {
          Toast.success(`✅ Wygenerowano propozycji: ${r.proposals}. Sprawdź Moduł Akceptacji!`);
          if (typeof refreshApprovalBadge === 'function') refreshApprovalBadge();
        } else {
          Toast.info('💡 AI nie znalazło rozbieżności, które warto poprawiać.');
        }
      }
    } catch (e) {
      Toast.error(`Błąd: ${e.message}`);
    } finally {
      setBtn('pim-param-standardize-btn', false);
    }
  },

  // --- RELATIONS TAB ---
  async loadRelationsProducts() {
    const s = document.getElementById('pim-rel-search')?.value || '';
    const cat = document.getElementById('pim-rel-cat-filter')?.value || '';
    const grp = document.getElementById('pim-rel-grp-filter')?.value || '';
    
    try {
      let url = `/products?search=${encodeURIComponent(s)}&limit=50`;
      if (cat) url += `&category=${encodeURIComponent(cat)}`;
      if (grp) url += `&group_tag=${encodeURIComponent(grp)}`;
      
      const d = await API.get(url);
      const tbody = document.getElementById('pim-rel-tbody');
      if (!d.products?.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:16px">Brak wyników. Zmień zapytanie.</td></tr>';
        return;
      }
      tbody.innerHTML = d.products.map(p => `
        <tr>
          <td><input type="checkbox" class="pim-rel-ck" value="${p.id}" ${this.state.relationsSelected?.has(p.id)?'checked':''} onchange="PimView.toggleRelationCk('${p.id}', this.checked)" style="width:16px;height:16px;accent-color:var(--accent)"></td>
          <td>
            <div style="font-weight:500;font-size:0.85rem">${escHtml(p.name)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">ID: ${escHtml(p.shop_id)}</div>
          </td>
          <td style="font-size:0.85rem;color:var(--text-secondary)">${escHtml(p.category||'—')}</td>
        </tr>
      `).join('');
    } catch(e) { Toast.error(e.message); }
  },

  toggleRelationCk(id, isChecked) {
    if (!this.state.relationsSelected) this.state.relationsSelected = new Set();
    isChecked ? this.state.relationsSelected.add(id) : this.state.relationsSelected.delete(id);
    this.updateRelationsCount();
  },

  toggleAllRelations(isChecked) {
    if (!this.state.relationsSelected) this.state.relationsSelected = new Set();
    document.querySelectorAll('.pim-rel-ck').forEach(ck => {
      ck.checked = isChecked;
      isChecked ? this.state.relationsSelected.add(ck.value) : this.state.relationsSelected.delete(ck.value);
    });
    this.updateRelationsCount();
  },

  updateRelationsCount() {
    const c = document.getElementById('pim-rel-count');
    if (c) c.textContent = this.state.relationsSelected ? this.state.relationsSelected.size : 0;
  },

  async generateRelations() {
    if (!this.state.relationsSelected || this.state.relationsSelected.size === 0) return Toast.warn('Zaznacz przynajmniej jeden produkt docelowy.');
    if (this.state.relationsSelected.size > 20) return Toast.warn('Możesz wygenerować relacje dla max 20 produktów naraz.');
    
    const selectedTypes = [...document.querySelectorAll('.pim-rel-type-ck:checked')].map(ck => ck.value);
    if (selectedTypes.length === 0) return Toast.warn('Wybierz przynajmniej jeden typ powiązania.');

    try {
      setBtn('pim-rel-generate-btn', true);
      Toast.info('✨ AI analizuje katalog i szuka powiązań... (to może potrwać dłuższą chwilę)');
      const ids = Array.from(this.state.relationsSelected);
      const r = await API.post('/products/relations/generate', { productIds: ids, relationTypes: selectedTypes });
      if (r.success) {
        Toast.success(`✅ Wygenerowano propozycji: ${r.proposals}. Sprawdź Moduł Akceptacji!`);
        this.state.relationsSelected.clear();
        this.updateRelationsCount();
        document.querySelectorAll('.pim-rel-ck').forEach(c=>c.checked=false);
      }
    } catch (e) {
      Toast.error(`Błąd: ${e.message}`);
    } finally {
      setBtn('pim-rel-generate-btn', false);
    }
  },

  bindCms() {
    if (this._cmsBound) return;
    document.getElementById('cms-refresh-btn').addEventListener('click', () => this.loadCmsEntities());
    document.getElementById('cms-type-filter').addEventListener('change', () => this.loadCmsEntities());
    this._cmsBound = true;
  },

  async loadCmsEntities() {
    const tbody = document.getElementById('cms-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Ładowanie...</td></tr>';
    try {
      const type = document.getElementById('cms-type-filter').value;
      const data = await API.get(`/cms?type=${type}`);
      if (!data.success) throw new Error(data.error || 'Błąd ładowania CMS');
      
      if (!data.entities.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Brak wyników</td></tr>';
        return;
      }

      this._cmsData = data.entities;
      this.renderCmsTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--red)">Błąd: ${err.message}</td></tr>`;
    }
  },

  renderCmsTable() {
    const tbody = document.getElementById('cms-tbody');
    tbody.innerHTML = '';
    
    const typeNames = { category: 'Kategoria', page: 'Strona Info', manufacturer: 'Producent', homepage: 'Strona Główna' };
    const typeIcons = { category: '📂', page: '📄', manufacturer: '🏢', homepage: '🏠' };

    this._cmsData.forEach(ent => {
      const tr = document.createElement('tr');
      const issuesHtml = ent.seo_issues.length > 0 
        ? ent.seo_issues.map(i => `<span style="display:inline-block;background:var(--red-light);color:var(--red);padding:2px 6px;border-radius:4px;font-size:0.75rem;margin:2px">${i}</span>`).join('')
        : '<span style="color:var(--green);font-size:0.8rem">Wszystko idealnie ✨</span>';
        
      let scoreColor = 'var(--text-primary)';
      if (ent.seo_score < 40) scoreColor = 'var(--red)';
      else if (ent.seo_score < 80) scoreColor = 'var(--accent)';
      else scoreColor = 'var(--green)';

      tr.innerHTML = `
        <td>${typeIcons[ent.type]} ${typeNames[ent.type]}</td>
        <td style="font-family:monospace;font-size:0.8rem;color:var(--text-muted)">${ent.id}</td>
        <td style="font-weight:500">${ent.title}</td>
        <td><strong style="color:${scoreColor}">${ent.seo_score} / 100</strong></td>
        <td>${issuesHtml}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn--ghost btn--sm cms-preview-btn" data-type="${ent.type}" data-id="${ent.id}" title="Podgląd wizualny" style="font-size:0.85rem;padding:4px 6px">👁</button>
          <button class="btn btn--ghost btn--sm cms-shop-link" data-type="${ent.type}" data-id="${ent.id}" title="Otwórz w sklepie" style="font-size:0.85rem;padding:4px 6px">🔗</button>
          <button class="btn btn--secondary btn--sm" onclick="PimView.openCmsEditor('${ent.type}', '${ent.id}')">Optymalizuj</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Bind shop links — open in new tab using shop_url setting
    document.querySelectorAll('.cms-shop-link').forEach(a => {
      a.addEventListener('click', async () => {
        const type = a.dataset.type;
        const id = a.dataset.id;
        let shopUrl = localStorage.getItem('shop_url');
        if (!shopUrl) {
          try {
            const settings = await API.get('/settings');
            shopUrl = settings.shop_url || '';
          } catch(_) {}
        }
        if (!shopUrl) {
          shopUrl = prompt('Podaj bazowy URL sklepu (np. https://sklep.pl):', 'https://');
          if (!shopUrl) return;
          // Save for future use
          localStorage.setItem('shop_url', shopUrl);
          try { await API.post('/settings', { shop_url: shopUrl }); } catch(_) {}
        }
        shopUrl = shopUrl.replace(/\/+$/, '');
        // ShopGold friendly URLs 
        const paths = {
          category: `index.php?cPath=${id}`,
          page: `info.php?pages_id=${id}`,
          manufacturer: `index.php?manufacturers_id=${id}`,
        };
        window.open(`${shopUrl}/${paths[type] || ''}`, '_blank');
      });
    });

    // Bind preview buttons — show HTML rendered in iframe
    document.querySelectorAll('.cms-preview-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const id = btn.dataset.id;
        const ent = this._cmsData.find(e => e.type === type && String(e.id) === String(id));
        if (!ent) return;
        this.showCmsPreview(ent);
      });
    });
  },

  showCmsPreview(ent) {
    const typeNames = { category: 'Kategoria', page: 'Strona Info', manufacturer: 'Producent' };
    Modal.show({
      title: `👁 Podgląd: ${ent.title}`,
      body: `
      <div style="display:flex;flex-direction:column;gap:12px;height:70vh">
        <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:0.82rem;color:var(--text-secondary);padding-bottom:8px;border-bottom:1px solid var(--border)">
          <span><strong>Typ:</strong> ${typeNames[ent.type] || ent.type}</span>
          <span><strong>ID:</strong> ${ent.id}</span>
          ${ent.meta_title ? `<span><strong>Meta Title:</strong> ${ent.meta_title}</span>` : ''}
          ${ent.meta_desc ? `<span><strong>Meta Desc:</strong> <span style="color:var(--text-muted)">${ent.meta_desc.substring(0,80)}${ent.meta_desc.length>80?'...':''}</span></span>` : ''}
        </div>
        <iframe id="cms-preview-iframe" style="flex:1;border:1px solid var(--border);border-radius:8px;background:#fff" sandbox="allow-same-origin"></iframe>
      </div>`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Zamknij</button>`,
      wide: true
    });
    // Write HTML into iframe after modal renders
    setTimeout(() => {
      const iframe = document.getElementById('cms-preview-iframe');
      if (iframe) {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #222; line-height: 1.6; max-width: 900px; margin: 0 auto; }
          img { max-width: 100%; height: auto; border-radius: 4px; }
          h1,h2,h3 { color: #111; }
          table { border-collapse: collapse; width: 100%; } th,td { border:1px solid #ddd; padding:8px; }
          ul,ol { padding-left: 20px; }
          a { color: #0066cc; }
        </style></head><body>${ent.description || '<p style="color:#999;text-align:center">Brak treści</p>'}</body></html>`);
        doc.close();
      }
    }, 150);
  },

  async openCmsEditor(type, id) {
    const ent = this._cmsData.find(e => e.type === type && String(e.id) === String(id));
    if (!ent) return;

    Modal.show({
      title: `Optymalizacja SEO: ${ent.title}`,
      body: `
      <div style="display:grid;gap:16px">
        <div class="form-group">
          <label class="form-label">Meta Title (Sugerowane ok. 60 znaków)</label>
          <input class="form-input" id="cms-meta-title" value="${ent.meta_title || ''}" placeholder="Tytuł strony w Google...">
        </div>
        <div class="form-group">
          <label class="form-label">Meta Description (Sugerowane ok. 155 znaków)</label>
          <textarea class="form-input" id="cms-meta-desc" rows="2" placeholder="Krótki, zachęcający opis do wyników wyszukiwania...">${ent.meta_desc || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Rozbudowany Opis SEO & HTML (Zalecane JSON-LD + FAQ)</label>
          <textarea class="form-input" id="cms-desc" rows="12" placeholder="Tutaj możesz wkleić opis HTML... Wskazówka: AI wygeneruje tu JSON-LD oraz kod HTML opisu.">${ent.description || ''}</textarea>
        </div>
      </div>
    `,
      footer: `
      <button class="btn btn--secondary" onclick="PimView.generateCmsAi('${type}', '${id}')">✨ Generuj z AI (Opis, Meta, FAQ, JSON-LD)</button>
      <button class="btn btn--primary" onclick="PimView.saveCmsEntity('${type}', '${id}')">💾 Zapisz zmiany w ShopGold</button>
    `,
      wide: true
    });
  },

  bindProducts() {
    let t;
    const s = this.state;
    document.getElementById('pim-search').addEventListener('input', e => {
      clearTimeout(t); t = setTimeout(() => { s.search = e.target.value; s.page = 0; this.loadProducts(); }, 400);
    });
    document.getElementById('pim-cat-filter').addEventListener('change', e => { s.category = e.target.value; s.page = 0; this.loadProducts(); });
    document.getElementById('pim-grp-filter').addEventListener('change', e => { s.group_tag = e.target.value; s.page = 0; this.loadProducts(); });
    document.getElementById('pim-param-cat-filter')?.addEventListener('change', () => this.loadParameters());
    const paramSearchEl = document.getElementById('pim-param-search');
    if (paramSearchEl && !paramSearchEl._bound) {
      paramSearchEl._bound = true;
      let _paramSearchTimer;
      paramSearchEl.addEventListener('input', () => {
        clearTimeout(_paramSearchTimer);
        _paramSearchTimer = setTimeout(() => {
          this.renderParametersList(paramSearchEl.value);
        }, 250);
      });
    }
    document.getElementById('pim-prev-btn').addEventListener('click', () => { s.page--; this.loadProducts(); });
    document.getElementById('pim-next-btn').addEventListener('click', () => { s.page++; this.loadProducts(); });

    const perPageSel = document.getElementById('pim-per-page');
    const perPageCustom = document.getElementById('pim-per-page-custom');
    const perPageApply = document.getElementById('pim-per-page-apply');
    const _syncPerPageSel = () => {
      const standardVals = ['100','500','1000','2000'];
      if (standardVals.includes(String(s.limit))) {
        perPageSel.value = String(s.limit);
        perPageCustom.style.display = 'none';
        perPageApply.style.display = 'none';
      } else {
        perPageSel.value = 'custom';
        perPageCustom.style.display = '';
        perPageCustom.value = s.limit;
        perPageApply.style.display = '';
      }
    };
    _syncPerPageSel();
    perPageSel.addEventListener('change', () => {
      if (perPageSel.value === 'custom') {
        perPageCustom.style.display = '';
        perPageApply.style.display = '';
        perPageCustom.focus();
      } else {
        perPageCustom.style.display = 'none';
        perPageApply.style.display = 'none';
        s.limit = parseInt(perPageSel.value);
        s.page = 0;
        this.loadProducts();
      }
    });
    perPageApply.addEventListener('click', () => {
      const v = parseInt(perPageCustom.value);
      if (v > 0) { s.limit = v; s.page = 0; this.loadProducts(); }
    });
    perPageCustom.addEventListener('keydown', e => {
      if (e.key === 'Enter') perPageApply.click();
    });

    document.getElementById('pim-check-all').addEventListener('change', e => {
      if (e.target.checked) s.products.forEach(p => s.selected.add(p.id));
      else s.selected.clear();
      document.querySelectorAll('.pim-ck').forEach(c => c.checked = e.target.checked);
      this.updateBulkBar();
    });
    document.getElementById('pim-sel-all-btn').addEventListener('click', () => {
      s.products.forEach(p => s.selected.add(p.id));
      document.querySelectorAll('.pim-ck').forEach(c => c.checked = true);
      this.updateBulkBar();
    });
    document.getElementById('pim-tbody').addEventListener('change', e => {
      if (!e.target.classList.contains('pim-ck')) return;
      e.target.checked ? s.selected.add(e.target.dataset.id) : s.selected.delete(e.target.dataset.id);
      this.updateBulkBar();
    });
    document.getElementById('pim-tbody').addEventListener('click', e => {
      const g = e.target.closest('.pim-gen'), v = e.target.closest('.pim-view'),
            ed = e.target.closest('.pim-edit'), del = e.target.closest('.pim-del'),
            dup = e.target.closest('.pim-dup'), sim = e.target.closest('.pim-sim');
      if (g) this.genSingle(g.dataset.id);
      if (v) this.viewProduct(v.dataset.id);
      if (ed) this.editProduct(ed.dataset.id);
      if (del) this.deleteProduct(del.dataset.id);
      if (dup) this.duplicateProduct(dup.dataset.id);
      if (sim) this.showSimilarModal(sim.dataset.id);
    });
    document.getElementById('pim-generate-btn').addEventListener('click', () => this.startBatch());
    document.getElementById('pim-export-sel-btn').addEventListener('click', () => this.doExport(true));
    document.getElementById('pim-new-btn').addEventListener('click', () => this.showNewProductModal());
    document.getElementById('pim-preset-sel').addEventListener('change', () => {});
    document.querySelectorAll('.pim-th-sort').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (this.state.sortCol === col) {
          this.state.sortDir = this.state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.state.sortCol = col;
          this.state.sortDir = 'asc';
        }
        this.state.page = 0;
        this.loadProducts();
      });
    });
  },

  bindPrompts() {
    document.getElementById('pim-new-preset-btn').addEventListener('click', () => this.newPreset());
    document.getElementById('pe-save-btn').addEventListener('click', () => this.savePreset());
    document.getElementById('pe-delete-btn').addEventListener('click', () => this.deletePreset());
    document.getElementById('pe-set-default-btn').addEventListener('click', () => this.setDefaultPreset());
    document.querySelectorAll('.var-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const ta = document.getElementById('pe-template');
        const pos = ta.selectionStart;
        const val = ta.value;
        ta.value = val.slice(0, pos) + chip.dataset.var + val.slice(pos);
        ta.focus();
        ta.setSelectionRange(pos + chip.dataset.var.length, pos + chip.dataset.var.length);
      });
    });
  },

  bindIO() {
    const connType = document.getElementById('pim-conn-type');
    const xmlWrap  = document.getElementById('pim-xml-url-wrap');
    const fileWrap = document.getElementById('pim-file-wrap');
    const toggle   = () => {
      const v = connType.value;
      xmlWrap.style.display  = v === 'xml'  ? '' : 'none';
      fileWrap.style.display = ['xml-file','csv'].includes(v) ? '' : 'none';
    };
    connType.addEventListener('change', toggle); toggle();
    document.getElementById('pim-do-import-btn').addEventListener('click', () => this.doImport());
    document.getElementById('pim-do-export-btn').addEventListener('click', () => this.doExport(false));
    document.getElementById('pim-exp-csv').addEventListener('click', () => {
      this.state.exportFormat = 'csv';
      document.getElementById('pim-exp-csv').classList.add('active');
      document.getElementById('pim-exp-xml').classList.remove('active');
    });
    document.getElementById('pim-exp-xml').addEventListener('click', () => {
      this.state.exportFormat = 'xml';
      document.getElementById('pim-exp-xml').classList.add('active');
      document.getElementById('pim-exp-csv').classList.remove('active');
    });
  },

  async loadProducts() {
    const { page, limit, search, category, group_tag, sortCol, sortDir } = this.state;
    try {
      const d = await API.get(`/products?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&group_tag=${encodeURIComponent(group_tag)}&limit=${limit}&offset=${page*limit}&sort=${sortCol}&order=${sortDir}`);
      this.state.products = d.products||[]; this.state.total = d.total||0;
      this.state.categories = d.categories||[]; this.state.groups = d.groups||[];
      this.renderTable(); this.renderPagination(); this.updateFilters();
    } catch(e) {
      document.getElementById('pim-tbody').innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--red);padding:24px">${escHtml(e.message)}</td></tr>`;
    }
  },

  renderTable() {
    const tbody = document.getElementById('pim-tbody');
    if (!this.state.products.length) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">Brak produktow</div><div class="empty-desc">Kliknij "Importuj" lub "Nowy produkt".</div></div></td></tr>`;
      return;
    }
    document.querySelectorAll('.sort-icon').forEach(el => el.textContent = '↕');
    const activeIcon = document.getElementById(`sort-${this.state.sortCol}`);
    if (activeIcon) activeIcon.textContent = this.state.sortDir === 'asc' ? '↑' : '↓';
    
    tbody.innerHTML = this.state.products.map(p => {
      const { score, missing } = this.calculateSeoScore(p);
      const missingHtml = missing.length ? 'Do poprawy:\n- ' + missing.join('\n- ') : 'Wszystko super!';
      const scoreColor = score < 50 ? 'var(--red)' : score < 80 ? 'var(--accent)' : 'var(--green)';

      return `
      <tr>
        <td><input type="checkbox" class="pim-ck" data-id="${p.id}" ${this.state.selected.has(p.id)?'checked':''}></td>
        <td>
          <div class="product-name">
            ${escHtml(truncate(p.name,50))}
          </div>
          <div class="product-category">#${escHtml(p.shop_id)}</div>
        </td>
        <td style="font-family:monospace;font-size:0.75rem;color:var(--text-secondary)">${escHtml(p.ean||'—')}</td>
        <td style="font-size:0.8rem;color:var(--text-secondary)">${escHtml(p.category||'—')}</td>
        <td style="font-size:0.8rem;color:var(--text-secondary)">${escHtml(p.group_tag||'—')}</td>
        <td style="font-weight:600;color:var(--accent-light)">${p.price?p.price.toFixed(2)+' zl':'—'}</td>
        <td style="text-align:center">
          <div title="${escHtml(missingHtml)}" style="font-weight:bold;color:${scoreColor};cursor:help">${score}%</div>
        </td>
        <td class="td-truncate" style="max-width:200px;color:var(--text-secondary);font-size:0.78rem" title="${escHtml(p.description||'')}">
          ${p.description ? escHtml(truncate(stripHtml(p.description),70)) : '<span style="color:var(--text-muted);font-style:italic">brak opisu</span>'}
        </td>
        <td>
          ${p.ai_generated
            ? '<span class="pim-status-badge pim-status-badge--ai">AI</span>'
            : '<span class="pim-status-badge pim-status-badge--none">—</span>'}
        </td>
        <td>
          <div style="display:flex;gap:3px;justify-content:flex-end">
            <a href="https://sklep.startwnecie.pl/produkt-p-${p.shop_id}.html" target="_blank" class="btn btn--ghost btn--sm" title="Otwórz w sklepie">🔗 Sklep</a>
            <button class="btn btn--primary btn--sm pim-gen" data-id="${p.id}" title="Generuj AI">AI</button>
            <button class="btn btn--ghost btn--sm pim-edit" data-id="${p.id}" title="Edytuj">✏️</button>
            <button class="btn btn--ghost btn--sm pim-dup" data-id="${p.id}" title="Dubluj">📋</button>
            <button class="btn btn--ghost btn--sm pim-sim" data-id="${p.id}" title="Stwórz podobne AI">🧠</button>
            <button class="btn btn--ghost btn--sm pim-view" data-id="${p.id}" title="Podglad">👁</button>
            <button class="btn btn--ghost btn--sm pim-del" data-id="${p.id}" title="Usun" style="color:var(--red)">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  renderPagination() {
    const {page,limit,total} = this.state;
    const from = page*limit+1, to = Math.min((page+1)*limit,total);
    document.getElementById('pim-info').textContent = total ? `${from}–${to} z ${total} produktów` : 'Brak produktów';
    document.getElementById('pim-prev-btn').disabled = page===0;
    document.getElementById('pim-next-btn').disabled = to>=total;
  },

  updateFilters() {
    const fillSelect = (id, items, cur) => {
      const sel = document.getElementById(id); if (!sel) return;
      const first = sel.options[0].text;
      sel.innerHTML = `<option value="">${first}</option>`;
      items.forEach(v => { 
        if (!v) return;
        const o = document.createElement('option'); o.value=v; o.textContent=v; if(v===cur) o.selected=true; sel.appendChild(o); 
      });
    };
    fillSelect('pim-cat-filter', this.state.categories, this.state.category);
    fillSelect('pim-grp-filter', this.state.groups, this.state.group_tag);
    fillSelect('pim-exp-cat', this.state.categories, '');
    fillSelect('pim-exp-grp', this.state.groups, '');
    fillSelect('pim-rel-cat-filter', this.state.categories, '');
    fillSelect('pim-rel-grp-filter', this.state.groups, '');
    const pCatEl = document.getElementById('pim-param-cat-filter');
    const pCatVal = pCatEl ? pCatEl.value : '';
    fillSelect('pim-param-cat-filter', this.state.categories, pCatVal);
  },

  updateBulkBar() {
    const n = this.state.selected.size;
    const bar = document.getElementById('pim-bulk-bar');
    bar.style.display = n > 0 ? 'flex' : 'none';
    document.getElementById('pim-sel-count').textContent = `${n} zaznaczonych`;
    if (n > 0) this.syncPresetsToBar();
  },

  syncPresetsToBar() {
    const sel = document.getElementById('pim-preset-sel');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">— Domyslny preset —</option>';
    this.state.presets.forEach(p => {
      const o = document.createElement('option');
      o.value=p.id; o.textContent=p.name+(p.is_default?' (domyslny)':'');
      if (p.id === currentVal) o.selected = true;
      sel.appendChild(o);
    });
  },

  async deleteProduct(id) {
    const prod = this.state.products.find(p => String(p.id) === String(id));
    const name = prod ? prod.name : `#${id}`;
    const shopId = prod ? prod.shop_id : null;
    const hasShopConnection = shopId && shopId !== '0' && shopId !== 0;
    let choice;
    if (hasShopConnection) {
      if (!confirm(`Usunąć produkt "${name}" z lokalnej bazy PIM?\n\nNaciśnij OK a następnie potwierdź kolejne okno, jeśli chcesz usunąć go też ze sklepu ShopGold.`)) return;
      choice = confirm(
        `⚠️ PEŁNE USUNIĘCIE ZE SKLEPU\n\nProdukt "${name}" (shop_id=${shopId}) zostanie TRWALE usunięty:\n• z bazy MySQL ShopGold\n• zdjęcia z serwera FTP\n• opisy, cechy, powiązania\n\nTej operacji NIE można cofnąć!\n\nOK = Usuń całkowicie ze sklepu\nAnuluj = Usuń tylko z lokalnej bazy`
      ) ? 'shopgold' : 'local';
    } else {
      if (!confirm(`Usunąć produkt "${name}" z lokalnej bazy PIM?`)) return;
      choice = 'local';
    }

    try {
      if (choice === 'shopgold') {
        Toast.info('Usuwanie produktu ze sklepu...');
        await API.del(`/products/${id}?deleteFromShop=1`);
        Toast.success('Produkt usunięty całkowicie ze sklepu i lokalnej bazy');
      } else {
        await API.del(`/products/${id}`);
        Toast.success('Produkt usunięty z lokalnej bazy PIM');
      }
      this.state.selected.delete(id);
      await this.loadProducts();
      this.updateBulkBar();
    } catch(e) { Toast.error(e.message); }
  },

  async generateCmsAi(type, id) {
    const ent = this._cmsData.find(e => e.type === type && String(e.id) === String(id));
    if (!ent) return;
    
    const targetKeyword = prompt('Podaj slowo kluczowe dla tej strony (anuluj, aby uzyc domyslnego tytulu):', ent.title);
    if (targetKeyword === null) return;

    try {
      const data = await API.post('/cms/generate-async', { type, id, title: ent.title, currentDescription: ent.description, targetKeyword });
      if (!data.success) throw new Error(data.error);

      Modal.hide();
      Toast.success('Optymalizacja SEO uruchomiona w tle! Otrzymasz powiadomienie po zakonczeniu.');
      
    } catch (err) {
      Toast.error('Blad generowania AI: ' + err.message);
    }
  },


  async duplicateProduct(id) {
    if (!confirm('Czy na pewno chcesz zdublować ten produkt?')) return;
    try {
      Toast.info('Dublowanie produktu...');
      await API.post(`/products/${id}/duplicate`);
      Toast.success('Produkt został sklonowany pomyślnie');
      await this.loadProducts();
    } catch(e) { Toast.error(e.message); }
  },

  showSimilarModal(id) {
    Modal.show({
      title: 'Generuj produkty na wzór AI 🧠',
      body: `<div style="display:flex;flex-direction:column;gap:16px;padding:4px">
        <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.4">
          Stwórz nowe produkty zainspirowane tym produktem przy pomocy sztucznej inteligencji. 
          AI zachowa strukturę kategorii, parametry oraz poziom cenowy, ale wygeneruje unikalne nazwy, opisy i cechy dostosowane do podanej tematyki.
        </p>
        <div class="form-group">
          <label class="form-label" style="font-weight:600">Tematyka / Sugestie dla AI *</label>
          <textarea class="form-input" id="sim-prompt" rows="3" placeholder="np. stwórz produkty o tematyce kosmicznej / ekologiczne wersje tego produktu / akcesoria z motywem retro" style="resize:vertical;min-height:70px"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight:600">Liczba produktów do wygenerowania</label>
          <input class="form-input" id="sim-count" type="number" min="1" max="20" value="10" placeholder="10">
          <span style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;display:block">
            Zalecamy generowanie do 15 produktów naraz w celu uniknięcia limitów czasu (timeout) API.
          </span>
        </div>
      </div>`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Anuluj</button>
               <button class="btn btn--primary" id="sim-generate-btn" onclick="PimView.generateSimilar('${id}')">🤖 Wygeneruj produkty</button>`
    });
  },

  async generateSimilar(id) {
    const promptTheme = document.getElementById('sim-prompt').value.trim();
    const count = parseInt(document.getElementById('sim-count').value) || 10;
    if (!promptTheme) return Toast.warn('Podaj tematykę / sugestie dla AI');
    if (count < 1 || count > 50) return Toast.warn('Liczba produktów musi być z zakresu od 1 do 50');

    try {
      setBtn('sim-generate-btn', true);
      Toast.info(`AI generuje ${count} produktów na wzór. Proszę czekać, to może potrwać dłuższą chwilę...`);
      const res = await API.post(`/products/${id}/generate-similar`, { count, promptTheme });
      Toast.success(`Pomyślnie wygenerowano ${res.count} produktów na wzór.`);
      Modal.hide();
      await this.loadProducts();
    } catch(e) { 
      Toast.error(e.message); 
      setBtn('sim-generate-btn', false); 
    }
  },

  showNewProductModal() {
    Modal.show({
      title: 'Nowy produkt',
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="form-group"><label class="form-label">Nazwa produktu *</label>
          <input class="form-input" id="np-name" placeholder="np. Smartwatch Pro X200"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group"><label class="form-label">Kategoria</label>
            <input class="form-input" id="np-cat" placeholder="np. Elektronika" list="np-cat-list">
            <datalist id="np-cat-list">${this.state.categories.map(c=>`<option value="${escHtml(c)}">`).join('')}</datalist></div>
          <div class="form-group"><label class="form-label">Producent</label>
            <input class="form-input" id="np-grp" placeholder="np. Sony" list="np-grp-list">
            <datalist id="np-grp-list">${this.state.groups.map(g=>`<option value="${escHtml(g)}">`).join('')}</datalist></div>
        </div>
        <div class="form-group"><label class="form-label">Cena (zl)</label>
          <input class="form-input" id="np-price" type="number" step="0.01" placeholder="199.99"></div>
        <div class="form-group"><label class="form-label">Opis (opcjonalnie)</label>
          <div class="rich-editor">
            <div class="rich-editor-toolbar">
              <button type="button" class="rich-editor-btn" data-cmd="bold" title="Pogrubienie"><b>B</b></button>
              <button type="button" class="rich-editor-btn" data-cmd="italic" title="Kursywa"><i>I</i></button>
              <button type="button" class="rich-editor-btn" data-cmd="underline" title="Podkreślenie"><u>U</u></button>
              <button type="button" class="rich-editor-btn" data-cmd="insertUnorderedList" title="Lista punktowana">• Lista</button>
              <button type="button" class="rich-editor-btn" data-cmd="insertOrderedList" title="Lista numerowana">1. Lista</button>
              <button type="button" class="rich-editor-btn" data-cmd="formatBlock" data-val="blockquote" title="Cytat">❝ Cytat</button>
              <button type="button" class="rich-editor-btn" data-cmd="removeFormat" title="Wyczyść formatowanie">✕</button>
            </div>
            <div id="np-desc-editor" class="rich-editor-content" contenteditable="true" style="min-height:150px">${window.formatDescription('')}</div>
          </div>
        </div>
      </div>`,
      footer: `<button class="btn btn--secondary" onclick="Modal.hide()">Anuluj</button>
               <button class="btn btn--primary" id="np-save-btn" onclick="PimView.createProduct()">Utworz produkt</button>`
    });

    const editor = document.getElementById('np-desc-editor');
    if (editor) {
      document.querySelectorAll('.rich-editor-toolbar .rich-editor-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.preventDefault();
          const cmd = btn.getAttribute('data-cmd');
          const val = btn.getAttribute('data-val') || null;
          document.execCommand(cmd, false, val);
          editor.focus();
        });
      });
    }
  },

  async createProduct() {
    const name = document.getElementById('np-name').value.trim();
    if (!name) return Toast.warn('Podaj nazwe produktu');
    try {
      setBtn('np-save-btn', true);
      await API.post('/products', {
        name,
        category: document.getElementById('np-cat').value.trim(),
        group_tag: document.getElementById('np-grp').value.trim(),
        price: parseFloat(document.getElementById('np-price').value)||null,
        description: document.getElementById('np-desc-editor').innerHTML.trim(),
      });
      Toast.success('Produkt utworzony');
      Modal.hide();
      await this.loadProducts();
    } catch(e) { Toast.error(e.message); setBtn('np-save-btn', false); }
  },

  genSingle(id) {
    this.showGenerateModal([id]);
  },

  startBatch() {
    const ids = [...this.state.selected];
    if (!ids.length) return Toast.warn('Zaznacz produkty');
    this.showGenerateModal(ids);
  },

  showGenerateModal(ids) {
    Modal.show({
      title: 'Opcje generowania AI',
      body: `
        <div style="margin-bottom:12px;font-size:0.9rem">Wybierz, co chcesz wygenerować dla ${ids.length === 1 ? 'tego produktu' : ids.length + ' produktów'}:</div>
        <div style="display:flex;flex-direction:column;gap:10px;padding:8px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" class="gen-field-ck" value="description" checked style="width:16px;height:16px;accent-color:var(--accent)"> <span>Opis produktu</span></label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" class="gen-field-ck" value="meta_title" checked style="width:16px;height:16px;accent-color:var(--accent)"> <span>Meta Title</span></label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" class="gen-field-ck" value="meta_description" checked style="width:16px;height:16px;accent-color:var(--accent)"> <span>Meta Description</span></label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" class="gen-field-ck" value="attributes_suggestions" style="width:16px;height:16px;accent-color:var(--accent)"> <span>Parametry (sugestie)</span></label>
        </div>
      `,
      footer: `
        <button class="btn btn--secondary" onclick="Modal.hide()">Anuluj</button>
        <button class="btn btn--primary" id="pim-modal-gen-btn">Generuj</button>
      `
    });

    document.getElementById('pim-modal-gen-btn').addEventListener('click', () => {
      const selectedFields = [...document.querySelectorAll('.gen-field-ck:checked')].map(c => c.value);
      if (!selectedFields.length) return Toast.warn('Wybierz przynajmniej jedno pole');
      Modal.hide();
      this.executeGenerate(ids, selectedFields);
    });
  },

  async executeGenerate(ids, selectedFields) {
    const presetId = document.getElementById('pim-preset-sel')?.value || undefined;
    
    if (ids.length === 1) {
      try {
        Toast.info('Generowanie AI...');
        const r = await API.post(`/products/${ids[0]}/generate`, { presetId, selectedFields });
        Toast.success(`Dodano ${r.approvalItems} zmian do kolejki akceptacji`);
        await this.loadProducts();
        if (typeof refreshApprovalBadge === 'function') refreshApprovalBadge();
      } catch(e) { Toast.error(e.message); }
      return;
    }

    const prog = document.getElementById('pim-progress');
    const fill = document.getElementById('pim-prog-fill');
    const txt = document.getElementById('pim-prog-txt');
    const pct = document.getElementById('pim-prog-pct');
    prog.style.display = 'block';
    txt.textContent = 'Generowanie...'; fill.style.width = '0%'; pct.textContent = '0%';
    try {
      const body = { productIds: ids, delayMs: 300, selectedFields };
      if (presetId) body.presetId = presetId;
      const resp = await fetch('/api/products/batch/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const d = JSON.parse(line.replace('data:', '').trim());
            if (d.done) {
              txt.textContent = `Gotowe! ${d.processed} produktow (${d.errors} bledow)`;
              fill.style.width = '100%'; pct.textContent = '100%';
              Toast.success(`Wygenerowano dla ${d.processed - d.errors} produktow`);
              if (typeof refreshApprovalBadge === 'function') refreshApprovalBadge();
            } else if (d.error) {
              Toast.error(d.error);
            } else {
              const p = Math.round((d.processed / d.total) * 100);
              fill.style.width = p + '%'; pct.textContent = p + '%';
              txt.textContent = `Generowanie ${d.processed}/${d.total}...`;
            }
          } catch {}
        }
      }
    } catch(e) { Toast.error(e.message); }
    finally {
      setTimeout(() => {
        prog.style.display = 'none';
        this.state.selected.clear();
        this.updateBulkBar();
        this.loadProducts();
      }, 3000);
    }
  },

  async doImport() {
    const type = document.getElementById('pim-conn-type').value;
    const res = document.getElementById('pim-import-result');
    res.innerHTML = '<span style="color:var(--text-muted)">Importowanie...</span>';
    setBtn('pim-do-import-btn', true);
    try {
      let r;
      if (type === 'xml') {
        const xmlUrl = document.getElementById('pim-xml-url').value;
        if (!xmlUrl) throw new Error('Wpisz URL XML Feed');
        r = await API.post('/products/sync', { connectionType:'xml', xmlUrl });
      } else if (['xml-file','csv'].includes(type)) {
        const file = document.getElementById('pim-file-input').files[0];
        if (!file) throw new Error('Wybierz plik');
        const fd = new FormData(); fd.append('file', file); fd.append('connectionType', type==='csv'?'csv':'xml');
        r = await API.upload('/products/sync', fd);
      } else {
        r = await API.post('/products/sync', { connectionType:'mysql' });
      }
      res.innerHTML = `<span style="color:var(--green)">Zaimportowano ${r.imported} produktow${r.skipped?` (pominieto ${r.skipped})`:''}</span>`;
      Toast.success(`Zaimportowano ${r.imported} produktow`);
      await this.loadProducts();
    } catch(e) {
      res.innerHTML = `<span style="color:var(--red)">${escHtml(e.message)}</span>`;
      Toast.error(e.message);
    } finally { setBtn('pim-do-import-btn', false); }
  },


  // ─── BASE XML → Generator opisów ─────────────────────────────────────────────
  bindBaseXml() {
    const parseBtn  = document.getElementById('bx-parse-btn');
    const genBtn    = document.getElementById('bx-gen-btn');
    const dlBtn     = document.getElementById('bx-download-btn');
    const copyBtn   = document.getElementById('bx-copy-first-btn');
    const checkAll  = document.getElementById('bx-check-all');
    const selAllBtn = document.getElementById('bx-sel-all-btn');
    const selNoneBtn= document.getElementById('bx-sel-none-btn');

    if (!parseBtn || parseBtn._bxBound) return;
    parseBtn._bxBound = true;

    this.state.bxProducts  = [];
    this.state.bxResults   = [];
    this.state.bxRawXml    = null;  // oryginalny tekst XML z BaseLinker

    // ShopGold XML generator state
    this.state.sgProducts   = [];
    this.state.sgResults    = [];
    this.state.sgFile       = null;
    this.state.sgXmlResult  = null;

    // ── Parse XML ──────────────────────────────────────────────────────────
    parseBtn.addEventListener('click', async () => {
      const file = document.getElementById('bx-file').files[0];
      if (!file) return Toast.warn('Wybierz plik XML z BASE');

      const info = document.getElementById('bx-parse-info');
      info.innerHTML = '<span style="color:var(--text-muted)">⏳ Wczytywanie...</span>';
      parseBtn.disabled = true;

      try {
        // Zachowaj oryginalny XML — użyjemy go do eksportu (bez utraty pól)
        const rawXmlText = await file.text();
        this.state.bxRawXml = rawXmlText;

        const fd = new FormData();
        fd.append('file', file);

        // Use API.upload so X-User / X-Company auth headers are sent
        const d = await API.upload('/products/base-xml/parse', fd);
        if (!d.success && d.error) throw new Error(d.error);

        this.state.bxProducts = d.products || [];
        info.innerHTML = `<div style="color:var(--green);font-weight:600">✅ Wczytano ${d.count} produktów</div>`;

        this._renderBaseXmlList(this.state.bxProducts);
      } catch (e) {
        info.innerHTML = `<span style="color:var(--red)">❌ ${escHtml(e.message)}</span>`;
      } finally {
        parseBtn.disabled = false;
      }
    });

    // ── Generate ALL (niezależnie od zaznaczenia) ────────────────────────
    const genAllBtn = document.getElementById('bx-gen-all-btn');
    if (genAllBtn) genAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.bx-prod-ck').forEach(ck => ck.checked = true);
      const checkAllEl = document.getElementById('bx-check-all');
      if (checkAllEl) checkAllEl.checked = true;
      this._runBaseXmlGen();
    });

    // ── Generate descriptions (zaznaczone) ──────────────────────────────
    if (genBtn) genBtn.addEventListener('click', () => this._runBaseXmlGen());

    // ── Download XML (BaseLinker format) ─────────────────────────────
    const dlXmlBtn = document.getElementById('bx-download-xml-btn');
    if (dlXmlBtn) dlXmlBtn.addEventListener('click', () => this._downloadBaseXmlUpdated());

    // ── Download HTML ──────────────────────────────────────────────
    if (dlBtn) dlBtn.addEventListener('click', () => this._downloadBaseXmlZip());


    // ── ShopGold SEO XML Generator — BaseLinker-style flow ────────────────────
    const sgParseBtn    = document.getElementById('sg-parse-btn');
    const sgGenBtn      = document.getElementById('sg-gen-btn');
    const sgGenAllBtn   = document.getElementById('sg-gen-all-btn');
    const sgCheckAll    = document.getElementById('sg-check-all');
    const sgSelAllBtn   = document.getElementById('sg-sel-all-btn');
    const sgSelNoneBtn  = document.getElementById('sg-sel-none-btn');
    const sgCopyBtn     = document.getElementById('sg-copy-first-btn');
    const sgDlXmlBtn    = document.getElementById('sg-download-xml-btn');

    // -- Step 1: Parse XML and show product list
    if (sgParseBtn) {
      sgParseBtn.addEventListener('click', async () => {
        const fileInput = document.getElementById('sg-xml-file');
        const file = fileInput?.files[0];
        if (!file) return Toast.warn('Wybierz plik XML');

        const parseInfo = document.getElementById('sg-parse-info');
        sgParseBtn.disabled = true;
        if (parseInfo) parseInfo.innerHTML = '<span style="color:var(--accent)">⏳ Wczytywanie...</span>';

        try {
          const fd = new FormData();
          fd.append('file', file);
          const h = API._headers(); delete h['Content-Type'];
          const r = await fetch('/api/products/shopgold-xml/parse', { method: 'POST', body: fd, headers: h });
          if (!r.ok) {
            const e = await r.json().catch(() => ({ error: r.statusText }));
            throw new Error(e.error || r.statusText);
          }
          const data = await r.json();
          this.state.sgProducts = data.products;
          this.state.sgFile = file;
          this.state.sgXmlResult = null;
          this._renderSgXmlList(data.products);

          if (parseInfo) parseInfo.innerHTML =
            '<div style="text-align:center"><div style="font-size:1.5rem;font-weight:700;color:var(--accent)">' + data.count + '</div>' +
            '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">produktów wczytanych</div></div>';
        } catch (err) {
          if (parseInfo) parseInfo.innerHTML = '<span style="color:var(--red)">❌ ' + escHtml(err.message) + '</span>';
          Toast.error(err.message);
        } finally {
          sgParseBtn.disabled = false;
        }
      });
    }

    // -- Step 2a: Generate selected
    if (sgGenBtn) {
      sgGenBtn.addEventListener('click', () => {
        const checked = [...document.querySelectorAll('.sg-prod-ck:checked')];
        const indices = checked.map(ck => Number(ck.dataset.idx));
        if (!indices.length) return Toast.warn('Zaznacz co najmniej jeden produkt');
        this._runSgGenerate(indices);
      });
    }

    // -- Step 2b: Generate all
    if (sgGenAllBtn) {
      sgGenAllBtn.addEventListener('click', () => {
        const prods = this.state.sgProducts || [];
        if (!prods.length) return Toast.warn('Najpierw wczytaj plik XML');
        const indices = prods.map(p => p._rawIndex);
        this._runSgGenerate(indices);
      });
    }

    // -- Checkboxes
    if (sgCheckAll) sgCheckAll.addEventListener('change', e => {
      document.querySelectorAll('.sg-prod-ck').forEach(ck => ck.checked = e.target.checked);
    });
    if (sgSelAllBtn) sgSelAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.sg-prod-ck').forEach(ck => ck.checked = true);
      if (sgCheckAll) sgCheckAll.checked = true;
    });
    if (sgSelNoneBtn) sgSelNoneBtn.addEventListener('click', () => {
      document.querySelectorAll('.sg-prod-ck').forEach(ck => ck.checked = false);
      if (sgCheckAll) sgCheckAll.checked = false;
    });

    // -- Download XML
    if (sgDlXmlBtn) {
      sgDlXmlBtn.addEventListener('click', () => {
        const xml = this.state.sgXmlResult;
        if (!xml) return Toast.warn('Najpierw wygeneruj opisy');
        const file = this.state.sgFile;
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'shopgold_seo_' + (file?.name || 'export.xml');
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      });
    }

    // -- Copy first result
    if (sgCopyBtn) {
      sgCopyBtn.addEventListener('click', () => {
        const results = this.state.sgResults || [];
        if (!results.length) return Toast.warn('Brak wyników');
        const first = results.find(r => r.htmlDescription);
        if (!first) return Toast.warn('Brak opisów do skopiowania');
        navigator.clipboard.writeText(first.htmlDescription).then(() => Toast.success('Skopiowano HTML!'));
      });
    }



    // ── Checkboxes ─────────────────────────────────────────────────────────
    if (checkAll) checkAll.addEventListener('change', e => {
      document.querySelectorAll('.bx-prod-ck').forEach(ck => ck.checked = e.target.checked);
    });
    if (selAllBtn) selAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.bx-prod-ck').forEach(ck => ck.checked = true);
      if (checkAll) checkAll.checked = true;
    });
    if (selNoneBtn) selNoneBtn.addEventListener('click', () => {
      document.querySelectorAll('.bx-prod-ck').forEach(ck => ck.checked = false);
      if (checkAll) checkAll.checked = false;
    });

    // ── Copy first ──────────────────────────────────────────────────────────
    if (copyBtn) copyBtn.addEventListener('click', () => {
      const first = this.state.bxResults[0];
      if (!first) return Toast.warn('Brak wyników');
      navigator.clipboard.writeText(first.description_html).then(() => Toast.success('Skopiowano HTML!'));
    });
  },

  _renderBaseXmlList(products) {
    const listEl  = document.getElementById('bx-product-list');
    const tbody   = document.getElementById('bx-prod-tbody');
    const countEl = document.getElementById('bx-prod-count');
    const genRow  = document.getElementById('bx-gen-row');

    if (!tbody) return;

    // Statystyki
    const withProducer = products.filter(p => p.producer).length;
    const withImages   = products.filter(p => (p.images || []).length > 0).length;
    const withAttrs    = products.filter(p => Object.keys(p.attributes || {}).length > 0).length;
    const withPrice    = products.filter(p => p.price > 0).length;

    countEl.innerHTML = `${products.length} produktów z XML &nbsp;·&nbsp; 
      <span style="color:${withImages>0?'var(--green)':'var(--red)'}">${withImages} ze zdjęciami</span> &nbsp;·&nbsp;
      <span style="color:${withAttrs>0?'var(--accent)':'var(--red)'}">${withAttrs} z parametrami</span> &nbsp;·&nbsp;
      <span style="color:${withPrice>0?'var(--green)':'var(--red)'}">${withPrice} z ceną</span>`;

    // Debug: pokaż klucze surowego XML (jeśli dostępne)
    if (products[0] && products[0]._rawKeys) {
      console.log('[BaseXML UI] Raw XML keys:', products[0]._rawKeys.join(', '));
    }

    // Pasek przypisania producenta
    let producerBar = document.getElementById('bx-producer-bar');
    if (!producerBar) {
      producerBar = document.createElement('div');
      producerBar.id = 'bx-producer-bar';
      producerBar.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px 14px;background:var(--bg-elevated);border-radius:var(--radius);border:1px solid var(--border);flex-wrap:wrap';
      producerBar.innerHTML = `
        <span style="font-size:0.85rem;font-weight:600;white-space:nowrap">🏭 Przypisz producenta:</span>
        <input class="form-input" id="bx-producer-input" placeholder="np. Wenger" style="flex:1;min-width:150px;max-width:250px;font-size:0.85rem">
        <button class="btn btn--secondary btn--sm" id="bx-producer-all-btn">Przypisz do wszystkich</button>
        <button class="btn btn--ghost btn--sm" id="bx-producer-empty-btn">Tylko puste</button>
        <span id="bx-producer-info" style="font-size:0.78rem;color:var(--text-muted)">Obecny: ${withProducer}/${products.length} ma producenta</span>
      `;
      listEl.parentElement.insertBefore(producerBar, listEl);

      // Bind buttons
      document.getElementById('bx-producer-all-btn').addEventListener('click', () => {
        const val = document.getElementById('bx-producer-input').value.trim();
        if (!val) return Toast.warn('Wpisz nazwę producenta');
        for (const p of this.state.bxProducts) p.producer = val;
        this._renderBaseXmlList(this.state.bxProducts);
        Toast.success(`Ustawiono "${val}" dla ${this.state.bxProducts.length} produktów`);
      });
      document.getElementById('bx-producer-empty-btn').addEventListener('click', () => {
        const val = document.getElementById('bx-producer-input').value.trim();
        if (!val) return Toast.warn('Wpisz nazwę producenta');
        let count = 0;
        for (const p of this.state.bxProducts) { if (!p.producer) { p.producer = val; count++; } }
        this._renderBaseXmlList(this.state.bxProducts);
        Toast.success(`Ustawiono "${val}" dla ${count} produktów bez producenta`);
      });
    } else {
      // Update info
      const info = producerBar.querySelector('#bx-producer-info');
      if (info) info.textContent = `Obecny: ${withProducer}/${products.length} ma producenta`;
    }

    tbody.innerHTML = products.map((p, i) => {
      const imgCount   = (p.images || []).length;
      const attrCount  = Object.keys(p.attributes || {}).length;
      return `<tr>
        <td><input type="checkbox" class="bx-prod-ck" data-idx="${i}" checked style="width:14px;height:14px;accent-color:var(--accent)"></td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(p.name)}">${escHtml(p.name)}</td>
        <td>${escHtml(p.producer || '—')}</td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.category || '—')}</td>
        <td style="text-align:right;white-space:nowrap">${p.price ? p.price.toFixed(2) + ' zł' : '—'}</td>
        <td><span style="color:${imgCount>0?'var(--green)':'var(--text-muted)'}">${imgCount} 🖼️</span></td>
        <td><span style="color:${attrCount>0?'var(--accent)':'var(--text-muted)'}">${attrCount} cech</span></td>
      </tr>`;
    }).join('');

    listEl.style.display = 'block';
    genRow.style.display = 'flex';
  },

  async _runBaseXmlGen() {
    const selected = this.state.bxProducts.filter((_, i) => {
      const ck = document.querySelector(`.bx-prod-ck[data-idx="${i}"]`);
      return ck && ck.checked;
    });
    if (!selected.length) return Toast.warn('Zaznacz co najmniej jeden produkt');

    const sessionPhoto = document.getElementById('bx-session-photo').value.trim();
    const useAi        = document.getElementById('bx-use-ai').checked;

    const genBtn   = document.getElementById('bx-gen-btn');
    const progEl   = document.getElementById('bx-progress');
    const fill     = document.getElementById('bx-prog-fill');
    const txt      = document.getElementById('bx-prog-txt');
    const pct      = document.getElementById('bx-prog-pct');

    genBtn.disabled  = true;
    progEl.style.display = 'block';
    fill.style.width = '0%'; pct.textContent = '0%';
    txt.textContent  = `Generowanie opisów (${selected.length} produktów)${useAi ? ' z AI' : ' z szablonu'}...`;

    this.state.bxResults = [];

    try {
      // Build auth headers from session (same as API._headers() but including Content-Type)
      const authHeaders = typeof API !== 'undefined' ? API._headers() : { 'Content-Type': 'application/json' };
      const resp = await fetch('/api/products/base-xml/generate-descriptions', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ products: selected, sessionPhotoUrl: sessionPhoto || undefined, useAi }),
      });

      const reader = resp.body.getReader();
      const dec    = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const d = JSON.parse(line.replace(/^data:\s*/, ''));
            if (d.done) {
              this.state.bxResults = d.results || [];
              this._renderBaseXmlResults(d.results, d.errors);
              fill.style.width = '100%'; pct.textContent = '100%';
              txt.textContent  = `Gotowe! ${d.results.length} opisów (błędy: ${d.errors})`;
              Toast.success(`Wygenerowano ${d.results.length} opisów`);
            } else if (d.error && !d.name) {
              Toast.error(d.error);
            } else {
              const p = Math.round((d.processed / d.total) * 100);
              fill.style.width = p + '%'; pct.textContent = p + '%';
              txt.textContent  = `${d.processed}/${d.total}: ${d.name || ''}${d.error ? ' ⚠️' : ''}`;
            }
          } catch {}
        }
      }
    } catch (e) {
      Toast.error('Błąd generowania: ' + e.message);
      txt.textContent = '❌ ' + e.message;
    } finally {
      genBtn.disabled = false;
    }
  },

  _renderBaseXmlResults(results, errors) {
    const resEl    = document.getElementById('bx-results');
    const listEl   = document.getElementById('bx-results-list');
    const titleEl  = document.getElementById('bx-results-title');

    titleEl.textContent = `Wygenerowane opisy: ${results.length}${errors ? ' (błędy: ' + errors + ')' : ''}`;
    resEl.style.display = 'block';

    listEl.innerHTML = results.map((r, i) => `
      <div class="card" style="padding:0;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-elevated);border-bottom:1px solid var(--border);gap:12px">
          <div>
            <div style="font-weight:700;font-size:0.9rem">${escHtml(r.name)}</div>
            ${r.ean ? `<div style="font-size:0.75rem;color:var(--text-muted)">EAN: ${escHtml(r.ean)}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn--ghost btn--sm bx-copy-html" data-idx="${i}" title="Kopiuj HTML">📋 Kopiuj HTML</button>
            <button class="btn btn--ghost btn--sm bx-toggle-preview" data-idx="${i}">👁 Podgląd</button>
          </div>
        </div>
        <!-- Normalised params -->
        ${Object.keys(r.attributes_normalised || {}).length ? `
        <div style="padding:8px 16px;font-size:0.78rem;color:var(--text-secondary);border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px">
          ${Object.entries(r.attributes_normalised).slice(0,8).map(([k,v]) =>
            `<span style="background:var(--bg-base);border:1px solid var(--border);border-radius:4px;padding:2px 8px">${escHtml(k)}: ${escHtml(v)}</span>`
          ).join('')}
        </div>` : ''}
        <!-- HTML code view -->
        <div style="padding:12px 16px">
          <textarea readonly style="width:100%;min-height:120px;font-size:0.73rem;font-family:monospace;background:var(--bg-base);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;resize:vertical;color:var(--text-secondary)">${escHtml(r.description_html)}</textarea>
        </div>
        <!-- Live preview (hidden by default) -->
        <div id="bx-preview-${i}" style="display:none;padding:16px;border-top:1px solid var(--border);background:#fff">
          ${r.description_html}
        </div>
      </div>`).join('');

    // Bind copy buttons
    listEl.querySelectorAll('.bx-copy-html').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const html = this.state.bxResults[idx]?.description_html || '';
        navigator.clipboard.writeText(html).then(() => Toast.success('Skopiowano HTML!'));
      });
    });
    // Bind preview toggles
    listEl.querySelectorAll('.bx-toggle-preview').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx     = parseInt(btn.dataset.idx);
        const preview = document.getElementById(`bx-preview-${idx}`);
        if (!preview) return;
        const isHidden = preview.style.display === 'none';
        preview.style.display = isHidden ? 'block' : 'none';
        btn.textContent = isHidden ? '🙈 Ukryj' : '👁 Podgląd';
      });
    });
  },

  _downloadBaseXmlUpdated() {
    const results = this.state.bxResults || [];
    if (!results.length) return Toast.warn('Brak wyników do pobrania');

    const rawXml = this.state.bxRawXml;
    if (!rawXml) {
      Toast.error('Brak oryginalnego pliku XML — wczytaj plik ponownie przed pobraniem');
      return;
    }

    // Mapa: różne klucze → nowy opis HTML + znormalizowane atrybuty
    const dataMap = new Map();
    for (const r of results) {
      // Łączymy atrybuty wyciągnięte (znormalizowane) + te dodane przez AI
      const mergedAttrs = { ...(r.attributes_normalised || {}), ...(r.new_attributes || {}) };
      const val = { html: r.description_html, attrs: mergedAttrs };
      if (r.id)   dataMap.set('id:' + String(r.id).trim(), val);
      if (r.ean)  dataMap.set('ean:' + String(r.ean).trim(), val);
      if (r.name) dataMap.set('name:' + String(r.name).trim().toLowerCase(), val);
    }

    // Wyodrębnij bloki <product>...</product> z surowego XML (text-based — zachowuje CDATA!)
    const productBlockRe = /<product\b[^>]*>([\s\S]*?)<\/product>/gi;
    const getTag = (block, ...tags) => {
      for (const tag of tags) {
        const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
        if (m) return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
      }
      return '';
    };

    const keptBlocks = [];
    let replaced = 0;
    let match;
    while ((match = productBlockRe.exec(rawXml)) !== null) {
      const fullBlock = match[0];
      const inner = match[1];

      // Identyfikacja produktu
      const prodId   = getTag(inner, 'product_id', 'id', 'ID', 'sku');
      const prodEan  = getTag(inner, 'ean', 'EAN', 'barcode');
      const prodName = getTag(inner, 'name', 'nazwa', 'Name');

      const data = dataMap.get('id:' + prodId)
                   || dataMap.get('ean:' + prodEan)
                   || dataMap.get('name:' + prodName.toLowerCase());

      if (data) {
        // Podmień <description>...</description> na CDATA z nowym opisem
        let updatedBlock = fullBlock.replace(
          /<description\b[^>]*>[\s\S]*?<\/description>/i,
          `<description><![CDATA[${data.html}]]></description>`
        );

        // Ujednolicenie atrybutów w samym pliku XML
        if (Object.keys(data.attrs).length > 0) {
          const attrXml = '<attributes>\n' + Object.entries(data.attrs).map(([k,v]) => 
            `  <attribute>\n    <attribute_name><![CDATA[${k}]]></attribute_name>\n    <attribute_value><![CDATA[${v}]]></attribute_value>\n  </attribute>`
          ).join('\n') + '\n</attributes>';

          if (updatedBlock.match(/<attributes\b[^>]*>[\s\S]*?<\/attributes>/i)) {
             updatedBlock = updatedBlock.replace(/<attributes\b[^>]*>[\s\S]*?<\/attributes>/i, attrXml);
          } else {
             // Dodaj na końcu przed </product>
             updatedBlock = updatedBlock.replace(/<\/product>/i, `\n${attrXml}\n</product>`);
          }
          // Usunięcie starych tags <features> żeby uniknąć niespójności
          updatedBlock = updatedBlock.replace(/<features\b[^>]*>[\s\S]*?<\/features>/i, '');
        }

        keptBlocks.push(updatedBlock);
        replaced++;
      }
      // Produkty bez dopasowania — nie dodajemy (filtr zaznaczonych)
    }

    if (!replaced) {
      Toast.error('Nie udało się dopasować żadnego produktu. Sprawdź czy plik XML jest ten sam co wczytany.');
      return;
    }

    // Odbuduj XML z nagłówkiem i tylko zaznaczonymi produktami
    const header = rawXml.match(/^[\s\S]*?<products[^>]*>/i);
    const xmlContent = (header ? header[0] : '<?xml version="1.0" encoding="UTF-8"?>\n<products>') +
      '\n' + keptBlocks.join('\n') + '\n</products>';

    // Nazwa pliku w stylu BaseLinker
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '_');
    const fileName = `Base__Produkty__domylny_XML_${dateStr}.xml`;

    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Toast.success(`Pobrano XML (${replaced} opisów zaktualizowanych) — plik zachowuje oryginalne zdjęcia i parametry`);
  },

  // ─── ShopGold XML ──────────────────────────────────────────────────────────

  _renderSgXmlList(products) {
    const listEl  = document.getElementById('sg-product-list');
    const tbody   = document.getElementById('sg-prod-tbody');
    const countEl = document.getElementById('sg-prod-count');
    const genRow  = document.getElementById('sg-gen-row');
    if (!tbody) return;

    countEl.textContent = `${products.length} produktów w pliku`;
    tbody.innerHTML = products.map((p) => {
      const attrCount = p.attrCount || Object.keys(p.attrs || {}).length;
      return `<tr>
        <td><input type="checkbox" class="sg-prod-ck" data-idx="${p._rawIndex}" checked style="width:14px;height:14px;accent-color:var(--accent)"></td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(p.name)}">${escHtml(p.name)}</td>
        <td>${escHtml(p.producer || '—')}</td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.category || '—')}</td>
        <td style="text-align:right;white-space:nowrap">${p.price ? p.price.toFixed(2) + ' zł' : '—'}</td>
        <td><span style="color:${attrCount > 0 ? 'var(--accent)' : 'var(--text-muted)'}">${attrCount} cech</span></td>
      </tr>`;
    }).join('');

    listEl.style.display = 'block';
    genRow.style.display = 'flex';

    // Sync check-all
    const sgCheckAll = document.getElementById('sg-check-all');
    if (sgCheckAll) sgCheckAll.checked = true;

    // Reset results area
    const resEl = document.getElementById('sg-results');
    if (resEl) resEl.style.display = 'none';
  },

  async _runSgGenerate(selectedIndices) {
    const file = this.state.sgFile;
    if (!file) return Toast.warn('Brak pliku — wczytaj plik XML ponownie');

    const genBtn  = document.getElementById('sg-gen-btn');
    const genAll  = document.getElementById('sg-gen-all-btn');
    const progEl  = document.getElementById('sg-progress');
    const fill    = document.getElementById('sg-prog-fill');
    const txt     = document.getElementById('sg-prog-txt');
    const pct     = document.getElementById('sg-prog-pct');

    if (genBtn)  genBtn.disabled = true;
    if (genAll)  genAll.disabled = true;
    if (progEl)  progEl.style.display = 'block';
    if (fill)    fill.style.width = '0%';
    if (pct)     pct.textContent = '0%';
    if (txt)     txt.textContent = `Generowanie opisów SEO (${selectedIndices.length} produktów)...`;

    this.state.sgResults    = [];
    this.state.sgXmlResult  = null;

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('selectedIndices', JSON.stringify(selectedIndices));
      const websiteUrlInput = document.getElementById('sg-website-url');
      if (websiteUrlInput && websiteUrlInput.value.trim()) {
        fd.append('websiteUrl', websiteUrlInput.value.trim());
      }
      const h = API._headers(); delete h['Content-Type'];

      const resp = await fetch('/api/products/shopgold-xml/generate-selected', {
        method: 'POST', body: fd, headers: h,
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(e.error || resp.statusText);
      }

      const reader = resp.body.getReader();
      const dec    = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const d = JSON.parse(line.replace(/^data:\s*/, ''));
            if (d.done) {
              this.state.sgResults   = d.results || [];
              this.state.sgXmlResult = d.xml || null;
              this._renderSgResults(d.results, d.errors || 0);
              if (fill) fill.style.width = '100%';
              if (pct)  pct.textContent = '100%';
              if (txt)  txt.textContent = `Gotowe! ${d.results?.length || 0} opisów wygenerowanych`;
              Toast.success(`Wygenerowano ${d.results?.length || 0} opisów SEO dla ShopGold`);
            } else if (d.error && !d.name) {
              Toast.error(d.error);
            } else {
              const p = d.total ? Math.round(((d.processed || 0) / d.total) * 100) : 0;
              if (fill) fill.style.width = p + '%';
              if (pct)  pct.textContent = p + '%';
              if (txt)  txt.textContent = `${d.processed || 0}/${d.total || '?'}: ${d.name || d.currentName || ''}${d.error ? ' ⚠️' : ''}`;
            }
          } catch {}
        }
      }
    } catch (e) {
      Toast.error('Błąd generowania: ' + e.message);
      if (txt) txt.textContent = '❌ ' + e.message;
    } finally {
      if (genBtn) genBtn.disabled = false;
      if (genAll) genAll.disabled = false;
    }
  },

  _renderSgResults(results, errors) {
    const resEl   = document.getElementById('sg-results');
    const listEl  = document.getElementById('sg-results-list');
    const titleEl = document.getElementById('sg-results-title');
    if (!resEl || !listEl) return;

    titleEl.textContent = `Wygenerowane opisy: ${results.length}${errors ? ' (błędy: ' + errors + ')' : ''}`;
    resEl.style.display = 'block';

    listEl.innerHTML = results.map((r, i) => `
      <div class="card" style="padding:0;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--bg-elevated);border-bottom:1px solid var(--border);gap:12px">
          <div>
            <div style="font-weight:700;font-size:0.9rem">${escHtml(r.name)}</div>
            ${r.ean ? `<div style="font-size:0.75rem;color:var(--text-muted)">EAN: ${escHtml(r.ean)}</div>` : ''}
            ${r.error ? `<div style="font-size:0.75rem;color:var(--red)">⚠️ ${escHtml(r.error)}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${r.htmlDescription ? `<button class="btn btn--ghost btn--sm sg-copy-html" data-idx="${i}" title="Kopiuj HTML">📋 Kopiuj HTML</button>` : ''}
            ${r.htmlDescription ? `<button class="btn btn--ghost btn--sm sg-toggle-preview" data-idx="${i}">👁 Podgląd</button>` : ''}
          </div>
        </div>
        ${r.htmlDescription ? `
        <div style="padding:12px 16px">
          <textarea readonly style="width:100%;min-height:120px;font-size:0.73rem;font-family:monospace;background:var(--bg-base);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;resize:vertical;color:var(--text-secondary)">${escHtml(r.htmlDescription)}</textarea>
        </div>
        <div id="sg-preview-${i}" style="display:none;padding:16px;border-top:1px solid var(--border);background:#fff">
          ${r.htmlDescription}
        </div>` : ''}
      </div>`).join('');

    // Bind copy buttons
    listEl.querySelectorAll('.sg-copy-html').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const html = this.state.sgResults[idx]?.htmlDescription || '';
        navigator.clipboard.writeText(html).then(() => Toast.success('Skopiowano HTML!'));
      });
    });
    // Bind preview toggles
    listEl.querySelectorAll('.sg-toggle-preview').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx     = parseInt(btn.dataset.idx);
        const preview = document.getElementById(`sg-preview-${idx}`);
        if (!preview) return;
        const isHidden = preview.style.display === 'none';
        preview.style.display = isHidden ? 'block' : 'none';
        btn.textContent = isHidden ? '🙈 Ukryj' : '👁 Podgląd';
      });
    });
  },

  _downloadBaseXmlZip() {

    const results = this.state.bxResults || [];
    if (!results.length) return Toast.warn('Brak wyników do pobrania');

    // Simple download without JSZip dependency: pack as single HTML file with all descriptions
    const combined = results.map(r => `<!-- ===== ${r.name} ===== -->\n${r.description_html}`).join('\n\n');
    const blob = new Blob([combined], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `opisy_base_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Toast.success('Pobrano plik HTML ze wszystkimi opisami');
  },

  // ─── ZARZĄDZANIE KATEGORIAMI PIM ───────────────────────────────────────

  
  openShopgoldCategoryManager() {
    const modalId = 'shopgold-cat-mgr-modal';
    let el = document.getElementById(modalId);
    if (!el) {
      el = document.createElement('div');
      el.id = modalId;
      el.className = 'modal-overlay';
      el.innerHTML = `
      <div class="modal" style="width:700px;max-width:90%">
        <div class="modal-header">
          <h3>🛒 Kategorie Shopgold</h3>
          <div style="display:flex;align-items:center;gap:4px">
            <button class="modal-maximize" onclick="toggleModalMax(this)" title="Maksymalizuj / Przywróć">⛶</button>
            <button class="modal-close" onclick="document.getElementById('${modalId}').style.display='none'">✕</button>
          </div>
        </div>
        <div class="modal-body" style="padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:bold;">Istniejące kategorie w Shopgold:</span>
            <div style="display:flex; gap:8px;">
              <button class="btn btn--ghost btn--sm" onclick="document.querySelectorAll('.sg-cat-mgr-ck').forEach(c => c.checked = true)">Zaznacz wszystkie</button>
              <button class="btn btn--ghost btn--sm" onclick="document.querySelectorAll('.sg-cat-mgr-ck').forEach(c => c.checked = false)">Odznacz</button>
            </div>
          </div>
          
          <div id="shopgold-cat-mgr-list" style="max-height:400px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius); padding:8px; display:grid; grid-template-columns:1fr; gap:4px;">
            Ładowanie ze sklepu...
          </div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding:16px;">
          <span id="shopgold-cat-mgr-status" style="color:var(--text-muted); font-size:0.85rem;">Może to zająć chwilę.</span>
          <div style="display:flex; gap:8px;">
            <button class="btn btn--ghost" onclick="document.getElementById('${modalId}').style.display='none'">Zamknij</button>
            <button class="btn btn--secondary" style="color:var(--red); border-color:var(--red);" onclick="PimView.promptDeleteShopgoldCategories()">🗑 Usuń zaznaczone</button>
          </div>
        </div>
      </div>
      `;
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
    this.loadShopgoldCategoriesForMgr();
  },

  async loadShopgoldCategoriesForMgr() {
    const listEl = document.getElementById('shopgold-cat-mgr-list');
    try {
      listEl.innerHTML = 'Ładowanie ze sklepu Shopgold... (wymagane połączenie MySQL)';
      const d = await API.get('/products/shopgold/categories');
      if (!d.categories || d.categories.length === 0) {
        listEl.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted)">Brak kategorii lub błąd połączenia z bazą Shopgold.</div>';
        return;
      }
      
      const renderTree = (nodes, depth = 0) => {
        let html = '';
        for (const c of nodes) {
          const indent = depth * 20;
          html += `
            <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; padding:4px; cursor:pointer; margin-left:${indent}px" title="${escHtml(c.name)}">
              <input type="checkbox" class="sg-cat-mgr-ck" value="${c.id}" data-name="${escHtml(c.name)}">
              <span style="color:var(--text-muted);font-size:0.75rem;width:30px">#${c.id}</span>
              <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;font-weight:${depth===0?'600':'400'}">${escHtml(c.name)}</span>
            </label>
          `;
          if (c.children && c.children.length > 0) {
            html += renderTree(c.children, depth + 1);
          }
        }
        return html;
      };
      
      listEl.innerHTML = renderTree(d.categories);
      document.getElementById('shopgold-cat-mgr-status').innerText = 'Załadowano ' + d.categories.length + ' gł. kategorii.';
    } catch (e) {
      document.getElementById('shopgold-cat-mgr-status').innerHTML = `<span style="color:var(--red)">Błąd: ${escHtml(e.message)}</span>`;
      listEl.innerHTML = '<div style="color:var(--red);padding:10px">Wystąpił problem z połączeniem MySQL z bazą Shopgold. Sprawdź Ustawienia.</div>';
    }
  },

  promptDeleteShopgoldCategories() {
    const selectedCks = [...document.querySelectorAll('.sg-cat-mgr-ck:checked')];
    if (!selectedCks.length) {
      alert('Nie zaznaczono żadnych kategorii do usunięcia.');
      return;
    }
    const selectedIds = selectedCks.map(ck => parseInt(ck.value));
    
    // Create decision dialog
    const modalId = 'sg-cat-del-prompt-modal';
    let el = document.getElementById(modalId);
    if (el) el.remove();

    // Target categories for move (flat list)
    const allCks = [...document.querySelectorAll('.sg-cat-mgr-ck')];
    const targetCats = allCks.filter(ck => !selectedIds.includes(parseInt(ck.value)));

    const categoriesJsonStr = JSON.stringify(selectedIds);

    el = document.createElement('div');
    el.id = modalId;
    el.className = 'modal-overlay';
    el.style.zIndex = '11000';
    el.innerHTML = `
      <div class="modal" style="width:500px;max-width:90%">
        <div class="modal-header">
          <h3 style="color:var(--red)">⚠️ Usuwanie z Bazy Shopgold</h3>
        </div>
        <div class="modal-body" style="padding:16px;">
          <p style="margin-top:0;">Próbujesz usunąć <strong>${selectedIds.length}</strong> kategorii ze sklepu Shopgold. Co zrobić z produktami?</p>
          <p style="font-size:0.8rem;color:var(--text-muted)">Uwaga: usunięcie jest nieodwracalne i wykonuje się na docelowej bazie MySQL!</p>

          <div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">
            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
              <input type="radio" name="sg-cat-del-action" value="move" checked style="margin-top:4px;">
              <div style="flex:1">
                <strong>Przenieś produkty</strong>
                <div style="font-size:0.85rem; color:var(--text-muted);">Przenieś osierocone produkty do wybranej kategorii:</div>
                <select id="sg-cat-del-target" class="form-select" style="margin-top:6px; width:100%;">
                  ${targetCats.map(ck => `<option value="${ck.value}">${ck.dataset.name}</option>`).join('')}
                  ${targetCats.length === 0 ? '<option value="">(Brak innych kategorii)</option>' : ''}
                </select>
              </div>
            </label>

            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; margin-top:8px;">
              <input type="radio" name="sg-cat-del-action" value="delete_products" style="margin-top:4px;">
              <div>
                <strong style="color:var(--red)">Usuń produkty z bazy i serwera FTP</strong>
                <div style="font-size:0.85rem; color:var(--text-muted);">Usuwa z bazy produkty przypisane TYLKO do kasowanej kategorii. Pliki (zdjęcia) na serwerze zostaną również skasowane, jeśli podano dane FTP w Ustawieniach.</div>
              </div>
            </label>
          </div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding:16px;">
          <button class="btn btn--ghost" onclick="document.getElementById('${modalId}').remove()">Anuluj</button>
          <button class="btn btn--primary" id="sg-cat-confirm-btn" style="background:var(--red);" onclick='PimView.executeDeleteShopgoldCategories(${categoriesJsonStr})'>Potwierdź i usuń</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.style.display = 'flex';
  },

  async executeDeleteShopgoldCategories(categories) {
    const action = document.querySelector('input[name="sg-cat-del-action"]:checked').value;
    const targetSel = document.getElementById('sg-cat-del-target');
    const targetCategoryId = action === 'move' ? (targetSel ? parseInt(targetSel.value) : null) : null;

    if (action === 'move' && !targetCategoryId) {
      alert('Wybierz kategorię docelową.');
      return;
    }

    setBtn('sg-cat-confirm-btn', true);
    let successCount = 0;
    try {
      for (const catId of categories) {
        await API.delete('/products/shopgold/categories/' + catId, { action, targetCategoryId });
        successCount++;
      }
      document.getElementById('sg-cat-del-prompt-modal').remove();
      Toast.success('Usunięto pomyślnie ' + successCount + ' kategorii z bazy Shopgold.');
      this.loadShopgoldCategoriesForMgr();
    } catch (e) {
      Toast.error('Błąd usuwania: ' + e.message);
    } finally {
      const btn = document.getElementById('sg-cat-confirm-btn');
      if (btn) setBtn('sg-cat-confirm-btn', false);
    }
  },

  openCategoryManager() {
    const modalId = 'cat-mgr-modal';
    let el = document.getElementById(modalId);
    if (!el) {
      el = document.createElement('div');
      el.id = modalId;
      el.className = 'modal-overlay';
      el.innerHTML = `
        <div class="modal" style="width:600px;max-width:90%">
          <div class="modal-header">
            <h3>⚙️ Zarządzaj Kategoriami (Słownik)</h3>
            <div style="display:flex;align-items:center;gap:4px">
              <button class="modal-maximize" onclick="toggleModalMax(this)" title="Maksymalizuj / Przywróć">⛶</button>
              <button class="modal-close" onclick="document.getElementById('${modalId}').style.display='none'">✕</button>
            </div>
          </div>
          <div class="modal-body" style="padding:16px;">
            <div style="display:flex; gap:8px; margin-bottom:16px;">
              <input type="text" id="cat-mgr-new-name" class="form-input" style="flex:1" placeholder="Nazwa nowej kategorii..." onkeyup="if(event.key==='Enter') PimView.addCategoryFromMgr()">
              <button class="btn btn--primary" onclick="PimView.addCategoryFromMgr()">Dodaj</button>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:bold;">Istniejące kategorie:</span>
              <div style="display:flex; gap:8px;">
                <button class="btn btn--ghost btn--sm" onclick="document.querySelectorAll('.cat-mgr-ck').forEach(c => c.checked = true)">Zaznacz wszystkie</button>
                <button class="btn btn--ghost btn--sm" onclick="document.querySelectorAll('.cat-mgr-ck').forEach(c => c.checked = false)">Odznacz</button>
              </div>
            </div>
            
            <div id="cat-mgr-list" style="max-height:300px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius); padding:8px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              Ładowanie...
            </div>
          </div>
          <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding:16px;">
            <span id="cat-mgr-status" style="color:var(--text-muted); font-size:0.85rem;"></span>
            <div style="display:flex; gap:8px;">
              <button class="btn btn--ghost" onclick="document.getElementById('${modalId}').style.display='none'">Zamknij</button>
              <button class="btn btn--secondary" style="color:var(--red); border-color:var(--red);" onclick="PimView.promptDeleteCategories()">🗑 Usuń zaznaczone</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
    this.loadCategoriesForMgr();
  },

  async loadCategoriesForMgr() {
    try {
      const d = await API.get('/products/meta/categories');
      const listEl = document.getElementById('cat-mgr-list');
      if (!d.items || d.items.length === 0) {
        listEl.innerHTML = '<div style="grid-column:1/-1; padding:16px; text-align:center; color:var(--text-muted)">Brak kategorii w bazie. Dodaj nową.</div>';
        return;
      }
      listEl.innerHTML = d.items.map(c => `
        <label style="display:flex; align-items:center; gap:6px; font-size:0.85rem; padding:4px; cursor:pointer;" title="${escHtml(c.name)}">
          <input type="checkbox" class="cat-mgr-ck" value="${escHtml(c.name)}">
          <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(c.name)}</span>
        </label>
      `).join('');
    } catch (e) {
      document.getElementById('cat-mgr-status').innerHTML = `<span style="color:var(--red)">Błąd: ${escHtml(e.message)}</span>`;
    }
  },

  async addCategoryFromMgr() {
    const input = document.getElementById('cat-mgr-new-name');
    const name = input.value.trim();
    if (!name) return;
    try {
      await API.post('/products/meta/categories', { name });
      input.value = '';
      this.loadCategoriesForMgr();
      this.reloadGlobalCategories();
      document.getElementById('cat-mgr-status').innerHTML = `<span style="color:var(--green)">Dodano: ${escHtml(name)}</span>`;
      setTimeout(() => { const el = document.getElementById('cat-mgr-status'); if(el) el.innerHTML = ''; }, 3000);
    } catch (e) {
      document.getElementById('cat-mgr-status').innerHTML = `<span style="color:var(--red)">Błąd: ${escHtml(e.message)}</span>`;
    }
  },

  promptDeleteCategories() {
    const selected = [...document.querySelectorAll('.cat-mgr-ck:checked')].map(ck => ck.value);
    if (!selected.length) {
      alert('Nie zaznaczono żadnych kategorii do usunięcia.');
      return;
    }
    
    // Create decision dialog
    const modalId = 'cat-del-prompt-modal';
    let el = document.getElementById(modalId);
    if (el) el.remove();
    
    // Get all categories to populate target select
    const allCats = [...document.querySelectorAll('.cat-mgr-ck')].map(ck => ck.value);
    const targetCats = allCats.filter(c => !selected.includes(c));
    
    const categoriesJsonStr = JSON.stringify(selected).replace(/'/g, "&#39;");
    
    el = document.createElement('div');
    el.id = modalId;
    el.className = 'modal-overlay';
    el.style.zIndex = '11000'; // Above cat-mgr-modal
    el.innerHTML = `
      <div class="modal" style="width:450px;max-width:90%">
        <div class="modal-header">
          <h3 style="color:var(--red)">⚠️ Usuwanie Kategorii</h3>
          <div style="display:flex;align-items:center;gap:4px">
            <button class="modal-maximize" onclick="toggleModalMax(this)" title="Maksymalizuj / Przywróć">⛶</button>
          </div>
        </div>
        <div class="modal-body" style="padding:16px;">
          <p style="margin-top:0;">Próbujesz usunąć <strong>${selected.length}</strong> kategorii. Co zrobić z produktami, które do nich należą?</p>
          
          <div style="margin-top:16px; display:flex; flex-direction:column; gap:12px;">
            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer;">
              <input type="radio" name="cat-del-action" value="move" checked style="margin-top:4px;">
              <div>
                <strong>Przenieś produkty</strong>
                <div style="font-size:0.85rem; color:var(--text-muted);">Przenieś osierocone produkty do wybranej kategorii:</div>
                <select id="cat-del-target" class="form-select" style="margin-top:6px; width:100%;">
                  ${targetCats.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
                  ${targetCats.length === 0 ? '<option value="">(Brak innych kategorii)</option>' : ''}
                </select>
              </div>
            </label>
            
            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; margin-top:8px;">
              <input type="radio" name="cat-del-action" value="delete_products" style="margin-top:4px;">
              <div>
                <strong style="color:var(--red)">Usuń produkty z bazy</strong>
                <div style="font-size:0.85rem; color:var(--text-muted);">Całkowicie usuń z systemu wszystkie produkty przypisane do tych kategorii. Ta akcja jest nieodwracalna.</div>
              </div>
            </label>
          </div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding:16px;">
          <button class="btn btn--ghost" onclick="document.getElementById('${modalId}').remove()">Anuluj</button>
          <button class="btn btn--primary" style="background:var(--red);" onclick='PimView.executeDeleteCategories(${categoriesJsonStr})'>Potwierdź i usuń</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.style.display = 'flex';
  },
  
  async executeDeleteCategories(categories) {
    const action = document.querySelector('input[name="cat-del-action"]:checked').value;
    let targetCategory = null;
    
    if (action === 'move') {
      targetCategory = document.getElementById('cat-del-target').value;
      if (!targetCategory) return alert('Musisz wybrać docelową kategorię do przeniesienia. Jeśli brak, dodaj nową kategorię przed usunięciem tej.');
    }
    
    const btn = document.querySelector(`#cat-del-prompt-modal .btn--primary`);
    if(btn) {
      btn.disabled = true;
      btn.innerText = 'Przetwarzanie...';
    }
    
    try {
      await API.delete('/products/meta/categories', { categories, product_action: action, target_category: targetCategory });
      const delModal = document.getElementById('cat-del-prompt-modal');
      if (delModal) delModal.remove();
      this.loadCategoriesForMgr();
      this.reloadGlobalCategories();
      this.loadProducts(); // refresh products view
      Toast.success(`Usunięto pomyślnie ${categories.length} kategorii.`);
    } catch (e) {
      alert('Błąd podczas usuwania: ' + e.message);
      if(btn) {
        btn.disabled = false;
        btn.innerText = 'Potwierdź i usuń';
      }
    }
  },

  async reloadGlobalCategories() {
    try {
      const d = await API.get('/products/store-categories');
      this.state.categories = d.categories || [];
      fillSelect('pim-cat-filter', this.state.categories, this.state.category);
      fillSelect('pim-exp-cat', this.state.categories, '');
      fillSelect('pim-rel-cat-filter', this.state.categories, '');
      const paramCatSel = document.getElementById('pim-param-cat-filter');
      if (paramCatSel) fillSelect('pim-param-cat-filter', this.state.categories, paramCatSel.value);
    } catch (e) { console.error('Error reloading categories', e); }
  }
};





