/* ===== grafiker.js — Moduł Grafiker (Generowanie AI) ===== */

window.GrafikerView = {
  state: {
    mode: 'miniaturki',
    tab: 'generate', // 'generate' or 'history'
    prompt: '',
    width: 1024,
    height: 1024,
    quantity: 1,
    format: 'png',
    model: '',
    referenceImages: [], // array of base64
    results: [],
    history: [],
    availableModels: []
  },

  modes: {
    'miniaturki': { width: 1280, height: 720, prompt: 'Profesjonalna miniatura produktu na białym tle do sklepu e-commerce, oświetlenie studyjne, wysoka jakość, 4k.' },
    'banery': { width: 1920, height: 1080, prompt: 'Szeroki baner promocyjny na stronę główną e-commerce, nowoczesny design, przestrzeń na tekst po lewej stronie, wysoka jakość.' },
    'ikony': { width: 512, height: 512, prompt: 'Minimalistyczna płaska ikona wektorowa na przezroczystym tle (flat design), grube kontury, do interfejsu aplikacji.' }
  },

  async render() {
    const el = document.getElementById('view-grafiker');
    el.innerHTML = this.shell();
    this.bindEvents();
    
    // Pobierz modele
    this.loadModels();
    
    this.selectMode('miniaturki');
  },

  async loadModels() {
    try {
      const res = await API.get('/grafiker/models');
      if (res.success && res.models) {
        this.state.availableModels = res.models;
        const select = document.getElementById('grafiker-model');
        select.innerHTML = '<option value="">(Wybierz automatycznie)</option>' + 
          res.models.map(m => `<option value="${m}">${m}</option>`).join('');
      }
    } catch(e) {
      console.error('Failed to load models for grafiker:', e);
    }
  },

  async loadHistory() {
    try {
      const res = await API.get('/grafiker/saved');
      if (res.success) {
        this.state.history = res.items || [];
        this.renderHistory();
      }
    } catch (e) {
      Toast.error('Błąd wczytywania historii: ' + e.message);
    }
  },

  shell() {
    return `
    <div class="section-header">
      <div class="section-title">🖼️ Grafiker AI</div>
      <div class="tabs" style="margin:0;border:none;">
        <button class="tab-btn active" data-tab="generate">✨ Generowanie</button>
        <button class="tab-btn" data-tab="marketplace">🛒 Miniaturka Marketplace</button>
        <button class="tab-btn" data-tab="separator">➖ Separatory</button>
        <button class="tab-btn" data-tab="history">💾 Zapisane (Historia)</button>
      </div>
    </div>

    <!-- MARKETPLACE THUMBNAIL VIEW -->
    <div id="grafiker-marketplace-view" style="display:none;padding:0 4px">
      <div style="display:grid;grid-template-columns:380px 1fr;gap:24px;height:calc(100vh - 150px)">
        <!-- LEFT PANEL -->
        <div class="card" style="display:flex;flex-direction:column;gap:16px;padding:20px;overflow-y:auto">
          <div style="font-weight:700;font-size:1rem">🛒 Kreator Miniaturki Allegro/Marketplace</div>
          <p style="font-size:0.82rem;color:var(--text-secondary);margin:0">Wygeneruj przykuwającą uwagę miniaturkę produktową — z dynamicznym tłem, efektami i stylizacją typową dla topowych ofert Allegro.</p>

          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.85rem">1. Zdjęcie produktu</label>
            <div id="mp-dropzone" style="border:2px dashed var(--border);border-radius:var(--radius);padding:24px;text-align:center;cursor:pointer;transition:border-color .2s">
              <div style="font-size:2rem;margin-bottom:8px">📷</div>
              <span style="color:var(--text-muted);font-size:0.85rem">Przeciągnij zdjęcie produktu lub kliknij, aby wybrać</span>
              <input type="file" id="mp-file-input" accept="image/*" multiple style="display:none">
            </div>
            <div id="mp-preview-wrap" style="display:none;margin-top:10px">
              <img id="mp-preview" style="max-width:100%;border-radius:8px;border:1px solid var(--border)">
              <button class="btn btn--ghost btn--sm" id="mp-clear-btn" style="margin-top:6px;color:var(--red)">✕ Usuń zdjęcie</button>
            </div>
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.85rem">2. Styl miniaturki</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px" id="mp-style-grid">
              ${[
                {id:'allegroHit', label:'🔥 Allegro Hit', desc:'Mocny kontrast, emoji, cena'},
                {id:'luxury',     label:'💎 Luksusowy',   desc:'Elegancki, białe tło, złote akcenty'},
                {id:'dynamic',    label:'⚡ Dynamiczny',  desc:'Ruch, kąty, mocne kolory'},
                {id:'flat',       label:'🎨 Flat/Pastel', desc:'Minimalistyczny, pastelowe tło'},
              ].map(s => `<label style="display:flex;flex-direction:column;gap:4px;padding:10px;background:var(--bg-elevated);border-radius:8px;cursor:pointer;border:2px solid var(--border);transition:border-color .2s" data-style-id="${s.id}">
                <input type="radio" name="mp-style" value="${s.id}" style="display:none" ${s.id==='allegroHit'?'checked':''}>
                <span style="font-weight:600;font-size:0.85rem">${s.label}</span>
                <span style="font-size:0.75rem;color:var(--text-muted)">${s.desc}</span>
              </label>`).join('')}
            </div>
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.85rem">3. Tekst na miniaturce (opcjonalnie)</label>
            <input type="text" class="form-input" id="mp-headline" placeholder="np. SUPER CENA! Darmowa dostawa" style="margin-bottom:6px">
            <input type="text" class="form-input" id="mp-subline" placeholder="np. Certyfikowany produkt • Gwarancja 2 lata">
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.85rem">4. Model AI (Open WebUI)</label>
            <select class="form-select" id="mp-model-sel"><option value="">Ładowanie modeli...</option></select>
          </div>

          <button class="btn btn--primary" id="mp-generate-btn" style="margin-top:auto">
            ⚡ Wygeneruj Miniaturkę
          </button>
        </div>

        <!-- RIGHT PANEL -->
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card" style="flex:1;display:flex;align-items:center;justify-content:center;min-height:400px;position:relative;overflow:hidden">
            <div id="mp-result-placeholder" style="text-align:center;color:var(--text-muted)">
              <div style="font-size:4rem;margin-bottom:12px">🖼️</div>
              <div style="font-size:0.95rem;font-weight:600">Miniaturka pojawi się tutaj</div>
              <div style="font-size:0.82rem;margin-top:6px">Wybierz zdjęcie produktu i kliknij "Wygeneruj Miniaturkę"</div>
            </div>
            <div id="mp-loading" style="display:none;text-align:center">
              <div style="font-size:2rem;animation:spin 1s linear infinite">⚙️</div>
              <div style="margin-top:12px;color:var(--text-secondary)">AI generuje miniaturkę...</div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">Może to zająć 15-60 sekund</div>
            </div>
            <img id="mp-result-img" style="display:none;max-width:100%;max-height:100%;border-radius:8px;object-fit:contain">
          </div>
          <div id="mp-result-actions" style="display:none;display:flex;gap:8px">
            <button class="btn btn--primary" id="mp-download-btn">⬇️ Pobierz PNG</button>
            <button class="btn btn--ghost" id="mp-regenerate-btn">🔄 Generuj Ponownie</button>
            <button class="btn btn--ghost" id="mp-save-history-btn">💾 Zapisz w historii</button>
          </div>
          <div id="mp-status"></div>
        </div>
      </div>
    </div>

    <!-- WIDOK SEPARATORÓW -->
    <div id="grafiker-separator-view" style="display:none;padding:0 4px">
      <div style="display:grid;grid-template-columns:350px 1fr;gap:24px;height:calc(100vh - 150px)">
        <!-- LEFT PANEL -->
        <div class="card" style="display:flex;flex-direction:column;gap:16px;padding:20px;overflow-y:auto">
          <div style="font-weight:700;font-size:1rem">➖ Generator Separatorów</div>
          <p style="font-size:0.82rem;color:var(--text-secondary);margin:0">Twórz estetyczne linie podziału na stronę sklepu lub do opisów PIM.</p>
          
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.85rem">Szerokość separatora (px)</label>
            <input type="number" id="sep-width" value="1200" class="form-input" style="width:100%">
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.85rem">Grubość linii (px)</label>
            <input type="range" id="sep-thickness" min="1" max="20" value="2" style="width:100%">
            <div style="text-align:right;font-size:0.8rem" id="sep-thickness-val">2px</div>
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.85rem">Styl linii</label>
            <select id="sep-style" class="form-select">
              <option value="solid">Ciągła (Solid)</option>
              <option value="dashed">Przerywana (Dashed)</option>
              <option value="dotted">Kropkowana (Dotted)</option>
            </select>
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.85rem">Kolor linii</label>
            <input type="color" id="sep-color" value="#e0e0e0" style="width:100%;height:40px;cursor:pointer;border:none">
          </div>

          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.85rem">Wgraj zdjęcie/ikonę na środek (opcjonalnie)</label>
            <input type="file" id="sep-image" accept="image/*" class="form-input">
            <div style="margin-top:8px">
              <label style="font-size:0.8rem">Wielkość ikony (px):</label>
              <input type="number" id="sep-icon-size" value="40" class="form-input" style="width:100%">
            </div>
          </div>
          
          <button class="btn btn--primary" id="sep-generate-btn" style="margin-top:auto">🎨 Aktualizuj Podgląd</button>
        </div>

        <!-- RIGHT PANEL -->
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card" style="flex:1;display:flex;align-items:center;justify-content:center;background:var(--bg-elevated);overflow:auto;position:relative">
            <canvas id="sep-canvas" style="max-width:100%;background:transparent"></canvas>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn--primary" id="sep-download-png">⬇️ Pobierz PNG (Przezroczyste)</button>
          </div>
        </div>
      </div>
    </div>

    <!-- WIDOK GENEROWANIA -->
    <div id="grafiker-generate-view" style="display:flex;gap:24px;align-items:flex-start;height:calc(100vh - 140px)">
      
      <!-- SIDEBAR -->
      <div class="card" style="width:350px;flex-shrink:0;display:flex;flex-direction:column;gap:16px;height:100%;overflow-y:auto">
        
        <!-- TRYBY -->
        <div class="tabs" style="margin:0;border:none;gap:4px">
          <button class="tab-btn active mode-btn" data-mode="miniaturki">📦 Miniaturki</button>
          <button class="tab-btn mode-btn" data-mode="banery">🎟️ Banery</button>
          <button class="tab-btn mode-btn" data-mode="ikony">🔣 Ikony</button>
        </div>

        <!-- MODEL -->
        <div>
          <label style="display:block;margin-bottom:4px;font-weight:600;font-size:0.85rem">Model AI (Open WebUI)</label>
          <select id="grafiker-model" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-base);color:var(--text-primary)">
             <option value="">Ładowanie modeli...</option>
          </select>
        </div>

        <!-- PROMPT -->
        <div>
          <label style="display:block;margin-bottom:4px;font-weight:600;font-size:0.85rem">Prompt (Co wygenerować?)</label>
          <textarea id="grafiker-prompt" style="width:100%;height:100px;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-base);color:var(--text-primary);resize:vertical"></textarea>
        </div>

        <!-- IMAGE TO IMAGE -->
        <div>
          <label style="display:block;margin-bottom:4px;font-weight:600;font-size:0.85rem">Zdjęcia referencyjne</label>
          <div id="grafiker-dropzone" style="border:2px dashed var(--border);border-radius:var(--radius);padding:24px;text-align:center;cursor:pointer;transition:border .2s;margin-bottom:8px">
            <span id="grafiker-dropzone-text" style="color:var(--text-muted);font-size:0.85rem">Przeciągnij zdjęcia lub kliknij</span>
            <input type="file" id="grafiker-file" accept="image/*" multiple style="display:none">
          </div>
          
          <div id="grafiker-ref-gallery" style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px"></div>
          
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:4px">Pierwsze zdjęcie zostanie użyte do wariacji w API OpenAI, a wszystkie jako tablica mogą posłużyć do ComfyUI/OpenWebUI (zależnie od Twojego workflow).</p>
        </div>

        <!-- DIMENSIONS -->
        <div style="display:flex;gap:12px">
          <div style="flex:1">
            <label style="display:block;margin-bottom:4px;font-weight:600;font-size:0.85rem">Szerokość (px)</label>
            <input type="number" id="grafiker-width" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-base);color:var(--text-primary)">
          </div>
          <div style="flex:1">
            <label style="display:block;margin-bottom:4px;font-weight:600;font-size:0.85rem">Wysokość (px)</label>
            <input type="number" id="grafiker-height" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-base);color:var(--text-primary)">
          </div>
        </div>
        
        <!-- QUANTITY AND FORMAT -->
        <div style="display:flex;gap:12px">
          <div style="flex:1">
            <label style="display:block;margin-bottom:4px;font-weight:600;font-size:0.85rem">Ilość grafik</label>
            <input type="number" id="grafiker-qty" min="1" max="10" value="1" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-base);color:var(--text-primary)">
          </div>
          <div style="flex:1">
            <label style="display:block;margin-bottom:4px;font-weight:600;font-size:0.85rem">Format zapisu</label>
            <select id="grafiker-format" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-base);color:var(--text-primary)">
              <option value="png">PNG</option>
              <option value="jpeg">JPG (Skompresowany)</option>
              <option value="webp">WebP (Nowoczesny, lekki)</option>
              <option value="svg">SVG (wektor - osadzony)</option>
            </select>
          </div>
        </div>

        <!-- ACTION -->
        <button id="grafiker-btn-generate" class="btn btn--primary" style="margin-top:auto;padding:12px;font-size:1rem">✨ Wygeneruj Grafiki</button>

      </div>

      <!-- GALLERY -->
      <div class="card" style="flex:1;height:100%;display:flex;flex-direction:column;overflow:hidden">
        <h3 id="grafiker-gallery-title" style="margin-top:0;border-bottom:1px solid var(--border);padding-bottom:12px">Wyniki (MINIATURKI)</h3>
        
        <div id="grafiker-gallery" style="flex:1;overflow-y:auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fill, minmax(250px, 1fr));gap:16px;align-content:flex-start">
          <div style="grid-column:1/-1;text-align:center;color:var(--text-muted);margin-top:40px">Brak wyników. Uzupełnij opcje po lewej stronie i kliknij Generuj.</div>
        </div>
      </div>
    </div>

    <!-- WIDOK HISTORII -->
    <div id="grafiker-history-view" style="display:none;height:calc(100vh - 140px)">
      <div class="card" style="height:100%;display:flex;flex-direction:column;overflow:hidden">
        <h3 style="margin-top:0;border-bottom:1px solid var(--border);padding-bottom:12px">Zapisane Grafiki</h3>
        <div id="grafiker-history-gallery" style="flex:1;overflow-y:auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fill, minmax(250px, 1fr));gap:16px;align-content:flex-start">
          <div style="grid-column:1/-1;text-align:center;color:var(--text-muted);margin-top:40px">Ładowanie...</div>
        </div>
      </div>
    </div>

    <!-- LIGHTBOX -->
    <div id="grafiker-lightbox" style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);z-index:9999;justify-content:center;align-items:center;padding:40px">
      <img id="grafiker-lb-img" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px">
      <button class="btn btn--secondary" style="position:absolute;top:20px;right:20px" onclick="document.getElementById('grafiker-lightbox').style.display='none'">✖ Zamknij</button>
      <div style="position:absolute;bottom:20px;display:flex;gap:12px" id="grafiker-lb-actions">
        <!-- Actions injected dynamically -->
      </div>
    </div>
    `;
  },

  bindEvents() {
    // Main Tabs (Generate / Marketplace / History)
    document.querySelectorAll('#view-grafiker .tabs button[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#view-grafiker .tabs button[data-tab]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const tab = e.target.dataset.tab;
        this.state.tab = tab;
        document.getElementById('grafiker-generate-view').style.display = tab === 'generate' ? 'flex' : 'none';
        document.getElementById('grafiker-history-view').style.display = tab === 'history' ? 'block' : 'none';
        document.getElementById('grafiker-marketplace-view').style.display = tab === 'marketplace' ? 'block' : 'none';
        document.getElementById('grafiker-separator-view').style.display = tab === 'separator' ? 'block' : 'none';
        if (tab === 'history') this.loadHistory();
        if (tab === 'marketplace') this.bindMarketplace();
        if (tab === 'separator') this.bindSeparator();
      });
    });

    // Mode Tabs (Miniaturki / Banery / Ikony)
    document.querySelectorAll('#view-grafiker .mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#view-grafiker .mode-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.selectMode(e.target.dataset.mode);
      });
    });

    const dropzone = document.getElementById('grafiker-dropzone');
    const fileInput = document.getElementById('grafiker-file');

    dropzone.addEventListener('click', () => { fileInput.click(); });
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--accent)'; });
    dropzone.addEventListener('dragleave', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--border)'; });
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border)';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) this.handleMultipleImageUpload(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', e => {
      if (e.target.files && e.target.files.length > 0) this.handleMultipleImageUpload(e.target.files);
    });

    document.getElementById('grafiker-btn-generate').addEventListener('click', () => this.generate());
    
    // Lightbox close on bg click
    document.getElementById('grafiker-lightbox').addEventListener('click', (e) => {
      if (e.target.id === 'grafiker-lightbox') e.target.style.display = 'none';
    });
  },

  selectMode(mode) {
    this.state.mode = mode;
    const config = this.modes[mode];
    
    document.getElementById('grafiker-prompt').value = config.prompt;
    document.getElementById('grafiker-width').value = config.width;
    document.getElementById('grafiker-height').value = config.height;
    
    document.getElementById('grafiker-gallery-title').textContent = `Wyniki (${mode.toUpperCase()})`;
  },

  handleMultipleImageUpload(fileList) {
    Array.from(fileList).forEach(file => {
      if (!file.type.startsWith('image/')) return Toast.error(`Plik ${file.name} nie jest obrazem.`);
      const reader = new FileReader();
      reader.onload = (e) => {
        const b64 = e.target.result;
        this.state.referenceImages.push(b64.split(',')[1]);
        this.renderReferenceGallery();
      };
      reader.readAsDataURL(file);
    });
  },

  removeReferenceImage(index) {
    this.state.referenceImages.splice(index, 1);
    this.renderReferenceGallery();
  },

  renderReferenceGallery() {
    const gal = document.getElementById('grafiker-ref-gallery');
    gal.innerHTML = this.state.referenceImages.map((b64raw, i) => `
      <div style="position:relative;width:100%;aspect-ratio:1/1">
        <img src="data:image/png;base64,${b64raw}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;border:1px solid var(--border)">
        <button class="btn btn--danger btn--sm" style="position:absolute;top:2px;right:2px;padding:0 4px;font-size:0.7rem" onclick="GrafikerView.removeReferenceImage(${i}); event.stopPropagation();">✖</button>
      </div>
    `).join('');
  },

  async generate(customRefImagesArray = null) {
    const prompt = document.getElementById('grafiker-prompt').value.trim();
    if (!prompt) return Toast.error('Wpisz prompt przed wygenerowaniem grafiki.');

    const w = document.getElementById('grafiker-width').value || 1024;
    const h = document.getElementById('grafiker-height').value || 1024;
    const n = document.getElementById('grafiker-qty').value || 1;
    const format = document.getElementById('grafiker-format').value || 'png';
    const model = document.getElementById('grafiker-model').value;
    const refs = customRefImagesArray || this.state.referenceImages;

    setBtn('grafiker-btn-generate', true);
    Toast.info('⏳ AI generuje grafiki. To może potrwać kilkadziesiąt sekund...');
    
    const size = `${w}x${h}`;

    try {
      let endpoint = '/grafiker/generate';
      let payload = { prompt, n, size, provider: 'openwebui' };
      if (model) payload.model = model;

      if (refs && refs.length > 0) {
        endpoint = '/grafiker/variations';
        // OpenAI standard only accepts one image, we pass the first one. 
        // If backend allows arrays in the future, we could pass refs.
        payload.imageBase64 = refs[0];
      }

      const res = await API.post(endpoint, payload);
      if (res.success && res.images && res.images.length > 0) {
        Toast.success('✅ Wygenerowano grafiki!');
        
        for (const b64 of res.images) {
           const finalDataUrl = await this.formatImage(b64, format, w, h);
           this.state.results.unshift({ b64: finalDataUrl, format });
        }
        this.renderGallery();
      } else {
        throw new Error(res.error || 'Brak zwróconych obrazów z AI.');
      }
    } catch (e) {
      Toast.error('Błąd generowania: ' + e.message);
    } finally {
      setBtn('grafiker-btn-generate', false);
    }
  },

  async formatImage(b64_json, format, width, height) {
    const src = `data:image/png;base64,${b64_json}`;
    if (format === 'png') return src; 
    
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        if (format === 'svg') {
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
            <image href="${src}" width="${width}" height="${height}" />
          </svg>`;
          resolve(`data:image/svg+xml;base64,${btoa(svg)}`);
        } else {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          if (format === 'webp') {
            resolve(canvas.toDataURL('image/webp', 0.9));
          } else {
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          }
        }
      };
      img.src = src;
    });
  },

  renderGallery() {
    const gal = document.getElementById('grafiker-gallery');
    if (!this.state.results.length) {
      gal.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);margin-top:40px">Brak wyników. Uzupełnij opcje po lewej stronie i kliknij Generuj.</div>';
      return;
    }

    gal.innerHTML = this.state.results.map((res, i) => `
      <div class="card" style="padding:8px;display:flex;flex-direction:column;gap:8px">
        <img src="${res.b64}" style="width:100%;height:150px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--border)" onclick="GrafikerView.openLightbox(${i}, false)">
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn--secondary btn--sm" style="flex:1;font-size:0.75rem" onclick="GrafikerView.downloadImage(${i}, false)">⬇️</button>
          <button class="btn btn--success btn--sm" style="flex:1;font-size:0.75rem" onclick="GrafikerView.saveToDatabase(${i})">💾</button>
          <button class="btn btn--primary btn--sm" style="flex:1;font-size:0.75rem" onclick="GrafikerView.generateSimilar(${i})">✨</button>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn--ghost btn--sm" style="flex:1;font-size:0.75rem" onclick="GrafikerView.removeBackground(${i}, false)">🪄 Usuń tło</button>
          <button class="btn btn--ghost btn--sm" style="flex:1;font-size:0.75rem" onclick="GrafikerView.applyBrandKit(${i}, false)">🎨 Brand Kit</button>
        </div>
      </div>
    `).join('');
  },

  renderHistory() {
    const gal = document.getElementById('grafiker-history-gallery');
    if (!this.state.history.length) {
      gal.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);margin-top:40px">Brak zapisanych grafik.</div>';
      return;
    }

    gal.innerHTML = this.state.history.map((res, i) => `
      <div class="card" style="padding:8px;display:flex;flex-direction:column;gap:8px;position:relative">
        <img src="/grafiker-uploads/${res.filename}" style="width:100%;height:150px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--border)" onclick="GrafikerView.openLightbox(${i}, true)">
        <div style="font-size:0.7rem;color:var(--text-muted)">${escHtml(truncate(res.prompt, 50))}</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn--secondary btn--sm" style="flex:1;font-size:0.75rem" onclick="GrafikerView.downloadImage(${i}, true)">⬇️</button>
          <button class="btn btn--danger btn--sm" style="flex:1;font-size:0.75rem" onclick="GrafikerView.deleteFromDatabase('${res.id}')">🗑️</button>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn--ghost btn--sm" style="flex:1;font-size:0.75rem" onclick="GrafikerView.removeBackground(${i}, true)">🪄 Usuń tło</button>
          <button class="btn btn--ghost btn--sm" style="flex:1;font-size:0.75rem" onclick="GrafikerView.applyBrandKit(${i}, true)">🎨 Brand Kit</button>
        </div>
      </div>
    `).join('');
  },

  openLightbox(index, isHistory = false) {
    let src = '';
    let actions = '';
    
    if (isHistory) {
      const res = this.state.history[index];
      if (!res) return;
      src = `/grafiker-uploads/${res.filename}`;
      actions = `
        <button class="btn btn--success" onclick="GrafikerView.downloadImage(${index}, true)">⬇️ Pobierz Plik</button>
      `;
    } else {
      const res = this.state.results[index];
      if (!res) return;
      src = res.b64;
      actions = `
        <button class="btn btn--success" onclick="GrafikerView.downloadImage(${index}, false)">⬇️ Pobierz Plik</button>
        <button class="btn btn--secondary" onclick="GrafikerView.saveToDatabase(${index})">💾 Zapisz w historii</button>
        <button class="btn btn--primary" onclick="GrafikerView.generateSimilar(${index}, true)">✨ Wygeneruj podobne</button>
      `;
    }

    const lb = document.getElementById('grafiker-lightbox');
    const img = document.getElementById('grafiker-lb-img');
    const actionsDiv = document.getElementById('grafiker-lb-actions');

    img.src = src;
    actionsDiv.innerHTML = actions;
    lb.style.display = 'flex';
  },

  async saveToDatabase(index) {
    const res = this.state.results[index];
    if (!res) return;
    
    try {
       const prompt = document.getElementById('grafiker-prompt').value.trim();
       const model = document.getElementById('grafiker-model').value || 'auto';
       
       const dbRes = await API.post('/grafiker/save', {
         base64: res.b64,
         prompt: prompt,
         model: model,
         format: res.format
       });
       
       if (dbRes.success) {
         Toast.success('💾 Zapisano grafikę do historii.');
         if (this.state.tab === 'history') this.loadHistory();
       }
    } catch(e) {
       Toast.error('Błąd zapisu: ' + e.message);
    }
  },

  async deleteFromDatabase(id) {
    if (!confirm('Czy na pewno chcesz usunąć tę grafikę?')) return;
    try {
      const res = await API.delete(`/grafiker/saved/${id}`);
      if (res.success) {
        Toast.success('Usunięto grafikę.');
        this.loadHistory();
      }
    } catch(e) {
      Toast.error('Błąd usuwania: ' + e.message);
    }
  },

  downloadImage(index, isHistory = false) {
    let src = '';
    let ext = 'png';
    
    if (isHistory) {
      const res = this.state.history[index];
      src = `/grafiker-uploads/${res.filename}`;
      ext = res.format;
    } else {
      const res = this.state.results[index];
      src = res.b64;
      ext = res.format === 'jpeg' ? 'jpg' : res.format;
    }
    
    const a = document.createElement('a');
    a.href = src;
    a.download = `grafika_ai_${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  generateSimilar(index, closeLightbox = false) {
    if (closeLightbox) document.getElementById('grafiker-lightbox').style.display = 'none';
    const res = this.state.results[index];
    if (!res) return;

    const rawB64 = res.b64.split(',')[1];
    
    // Add to references list
    this.state.referenceImages.push(rawB64);
    this.renderReferenceGallery();

    // Trigger generation
    this.generate();
  },

  async removeBackground(index, isHistory = false) {
    let src = '';
    
    if (isHistory) {
      const res = this.state.history[index];
      src = `/grafiker-uploads/${res.filename}`;
    } else {
      const res = this.state.results[index];
      src = res.b64;
    }

    try {
      Toast.info('⏳ Wycina tło... (to może potrwać kilka sekund)');
      
      let base64Data = src;
      if (isHistory) {
        // Fetch the file and convert to base64
        const resp = await fetch(src);
        const blob = await resp.blob();
        base64Data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }

      const response = await API.post('/grafiker/remove-bg', { base64: base64Data });
      
      if (response.success && response.base64) {
        Toast.success('✅ Tło zostało usunięte!');
        const finalB64 = `data:image/png;base64,${response.base64}`;
        
        // Add as a new generated result
        this.state.results.unshift({ b64: finalB64, format: 'png' });
        
        // Switch to generate tab if we were in history
        if (isHistory) {
          document.querySelector('#view-grafiker .tabs button[data-tab="generate"]').click();
        } else {
          this.renderGallery();
        }
      } else {
        throw new Error(response.error || 'Błąd usuwania tła');
      }
    } catch (e) {
      Toast.error('Błąd: ' + e.message);
    }
  },

  async applyBrandKit(index, isHistory = false) {
    let src = '';
    
    if (isHistory) {
      const res = this.state.history[index];
      src = `/grafiker-uploads/${res.filename}`;
    } else {
      const res = this.state.results[index];
      src = res.b64;
    }

    const s = window.currentSettings || {};
    const logoB64 = s.grafiker_brand_logo_b64;
    const color = s.grafiker_brand_color || '#FFD700';

    if (!logoB64) {
      return Toast.warn('Zanim nałożysz Brand Kit, wgraj logo firmy w Ustawieniach (zakładka Grafiker).');
    }

    try {
      Toast.info('⏳ Nakładanie Brand Kitu...');
      
      const mainImg = new Image();
      mainImg.crossOrigin = "Anonymous";
      
      await new Promise((resolve, reject) => {
        mainImg.onload = resolve;
        mainImg.onerror = reject;
        mainImg.src = src;
      });

      const logoImg = new Image();
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        logoImg.src = logoB64;
      });

      const canvas = document.createElement('canvas');
      canvas.width = mainImg.width;
      canvas.height = mainImg.height;
      const ctx = canvas.getContext('2d');

      // Draw main image
      ctx.drawImage(mainImg, 0, 0);

      // Draw brand border (optional)
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(4, canvas.width * 0.01);
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Calculate logo size (max 20% of width)
      const maxLogoW = canvas.width * 0.20;
      const scale = maxLogoW / logoImg.width;
      const logoW = logoImg.width * scale;
      const logoH = logoImg.height * scale;

      // Position bottom right with padding
      const padding = canvas.width * 0.03;
      const x = canvas.width - logoW - padding;
      const y = canvas.height - logoH - padding;

      // Draw Logo
      ctx.drawImage(logoImg, x, y, logoW, logoH);

      const finalB64 = canvas.toDataURL('image/png');
      
      Toast.success('✅ Brand Kit nałożony!');
      
      // Add as a new generated result
      this.state.results.unshift({ b64: finalB64, format: 'png' });
      
      if (isHistory) {
        document.querySelector('#view-grafiker .tabs button[data-tab="generate"]').click();
      } else {
        this.renderGallery();
      }

    } catch (e) {
      Toast.error('Błąd nakładania: ' + e.message);
    }
  },

  bindMarketplace() {
    if (document.getElementById('mp-dropzone')._bound) return;
    document.getElementById('mp-dropzone')._bound = true;

    // Load models
    const modelSel = document.getElementById('mp-model-sel');
    API.get('/openwebui/models').then(d => {
      const models = Array.isArray(d) ? d : (d.models || d.data || []);
      modelSel.innerHTML = '<option value="">Auto (pierwszy dostępny)</option>' +
        models.map(m => `<option value="${m.id || m.name}">${m.name || m.id}</option>`).join('');
    }).catch(() => { modelSel.innerHTML = '<option value="">Domyślny model</option>'; });

    // File upload
    const fileInput = document.getElementById('mp-file-input');
    const dropzone = document.getElementById('mp-dropzone');
    const previewWrap = document.getElementById('mp-preview-wrap');
    const preview = document.getElementById('mp-preview');
    let currentImagesB64 = [];

    const loadFiles = (files) => {
      if (!files || files.length === 0) return;
      Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => {
          currentImagesB64.push(e.target.result);
          renderPreview();
        };
        reader.readAsDataURL(file);
      });
    };

    const renderPreview = () => {
      if(currentImagesB64.length === 0) {
        previewWrap.style.display = 'none';
        dropzone.style.display = 'block';
      } else {
        preview.src = currentImagesB64[0];
        let extra = document.getElementById('mp-extra-gallery');
        if(!extra) {
           extra = document.createElement('div');
           extra.id = 'mp-extra-gallery';
           extra.style = 'display:flex;gap:4px;margin-top:8px;flex-wrap:wrap;';
           previewWrap.appendChild(extra);
        }
        extra.innerHTML = currentImagesB64.map((b64,i) => `<img src="${b64}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:${i===0?'2px solid var(--accent)':'1px solid var(--border)'}">`).join('');
        previewWrap.style.display = 'block';
        dropzone.style.display = 'none';
      }
    };

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--accent)'; });
    dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--border)');
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--border)';
      loadFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => loadFiles(fileInput.files));

    document.getElementById('mp-clear-btn').addEventListener('click', () => {
      currentImagesB64 = [];
      preview.src = '';
      let extra = document.getElementById('mp-extra-gallery');
      if(extra) extra.innerHTML = '';
      previewWrap.style.display = 'none';
      dropzone.style.display = 'block';
      fileInput.value = '';
    });

    // Style selection visual feedback
    document.querySelectorAll('#mp-style-grid label').forEach(lbl => {
      lbl.addEventListener('click', () => {
        document.querySelectorAll('#mp-style-grid label').forEach(l => l.style.borderColor = 'var(--border)');
        lbl.style.borderColor = 'var(--accent)';
      });
    });
    // Highlight default
    const firstLabel = document.querySelector('#mp-style-grid label[data-style-id="allegroHit"]');
    if (firstLabel) firstLabel.style.borderColor = 'var(--accent)';

    // Generate
    const STYLE_PROMPTS = {
      allegroHit: 'Allegro marketplace hero thumbnail, product centered, vivid red and orange gradient background, bold white text "SUPER OFERTA", product shown from multiple angles in corners, high contrast, attention-grabbing, professional e-commerce photography style, 1200x800px',
      luxury:     'Luxury product thumbnail, pure white background, gold accents and elegant typography, product in center with soft shadow, minimalist premium look, high-end brand aesthetic, clean and sophisticated, 1200x800px',
      dynamic:    'Dynamic action product thumbnail, diagonal composition, electric blue and purple gradient, motion blur elements, bold geometric shapes, energetic and modern, product featured prominently, 1200x800px',
      flat:       'Flat design product thumbnail, soft pastel background, minimal clean layout, product centered with subtle shadow, friendly and approachable design, modern illustration style accents, 1200x800px',
    };

    const genBtn = document.getElementById('mp-generate-btn');
    const resultPlaceholder = document.getElementById('mp-result-placeholder');
    const loading = document.getElementById('mp-loading');
    const resultImg = document.getElementById('mp-result-img');
    const resultActions = document.getElementById('mp-result-actions');
    const statusEl = document.getElementById('mp-status');
    let lastGeneratedUrl = null;

    const doGenerate = async () => {
      const style = document.querySelector('input[name="mp-style"]:checked')?.value || 'allegroHit';
      const headline = document.getElementById('mp-headline').value.trim();
      const subline  = document.getElementById('mp-subline').value.trim();
      const model    = document.getElementById('mp-model-sel').value;

      const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.allegroHit;
      let fullPrompt = stylePrompt;
      if (headline) fullPrompt += `, text overlay "${headline}"`;
      if (subline)  fullPrompt += `, subtitle "${subline}"`;
      if (currentImagesB64.length > 0) fullPrompt = 'Based on the provided product photo(s), create a ' + fullPrompt;

      genBtn.disabled = true;
      resultPlaceholder.style.display = 'none';
      resultImg.style.display = 'none';
      resultActions.style.display = 'none';
      loading.style.display = 'block';
      statusEl.innerHTML = '';

      try {
        const body = { prompt: fullPrompt, model: model || undefined, n: 1, size: '1024x1024' };
        if (currentImagesB64.length > 0) {
           body.image = currentImagesB64[0];
           body.imageArray = currentImagesB64;
        }

        const resp = await fetch('/api/openwebui/image-generation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(Session.owuiToken ? {'X-OWUI-Token': Session.owuiToken} : {}) },
          body: JSON.stringify(body)
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        const imgUrl = data.url || data.data?.[0]?.url || data.images?.[0];
        const imgB64 = data.b64_json || data.data?.[0]?.b64_json;

        loading.style.display = 'none';
        resultImg.style.display = 'block';
        resultActions.style.display = 'flex';

        if (imgUrl) {
          resultImg.src = imgUrl;
          lastGeneratedUrl = imgUrl;
        } else if (imgB64) {
          resultImg.src = `data:image/png;base64,${imgB64}`;
          lastGeneratedUrl = resultImg.src;
        }

        statusEl.innerHTML = '<div style="color:var(--green);padding:8px">✅ Miniaturka gotowa!</div>';

      } catch(e) {
        loading.style.display = 'none';
        resultPlaceholder.style.display = 'block';
        statusEl.innerHTML = `<div style="color:var(--red);padding:8px">❌ ${e.message}</div>`;
      } finally { genBtn.disabled = false; }
    };

    genBtn.addEventListener('click', doGenerate);

    document.getElementById('mp-regenerate-btn').addEventListener('click', doGenerate);

    document.getElementById('mp-download-btn').addEventListener('click', () => {
      if (!lastGeneratedUrl) return;
      const a = document.createElement('a');
      a.href = lastGeneratedUrl;
      a.download = `miniaturka-marketplace-${Date.now()}.png`;
      a.click();
    });

    document.getElementById('mp-save-history-btn').addEventListener('click', async () => {
      if (!lastGeneratedUrl) return;
      try {
        await API.post('/grafiker/save', { url: lastGeneratedUrl, type: 'marketplace' });
        Toast.success('Zapisano w historii!');
      } catch(e) { Toast.error(e.message); }
    });
  },

  bindSeparator() {
    if (document.getElementById('sep-generate-btn')._bound) return;
    document.getElementById('sep-generate-btn')._bound = true;

    const widthInput = document.getElementById('sep-width');
    const thicknessInput = document.getElementById('sep-thickness');
    const thicknessVal = document.getElementById('sep-thickness-val');
    const styleInput = document.getElementById('sep-style');
    const colorInput = document.getElementById('sep-color');
    const imageInput = document.getElementById('sep-image');
    const iconSizeInput = document.getElementById('sep-icon-size');
    const canvas = document.getElementById('sep-canvas');
    const ctx = canvas.getContext('2d');
    
    let loadedImage = null;

    thicknessInput.addEventListener('input', () => {
      thicknessVal.textContent = thicknessInput.value + 'px';
      drawSeparator();
    });

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) {
        loadedImage = null;
        drawSeparator();
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          loadedImage = img;
          drawSeparator();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    const drawSeparator = () => {
      const width = parseInt(widthInput.value) || 1200;
      const thickness = parseInt(thicknessInput.value) || 2;
      const style = styleInput.value;
      const color = colorInput.value;
      const iconSize = parseInt(iconSizeInput.value) || 40;

      // Canvas height needs to accommodate line thickness or image height
      const height = loadedImage ? Math.max(thickness, iconSize) + 20 : Math.max(thickness, 40);
      
      canvas.width = width;
      canvas.height = height;

      // Clear canvas (transparent background)
      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';

      if (style === 'dashed') {
        ctx.setLineDash([thickness * 4, thickness * 4]);
      } else if (style === 'dotted') {
        ctx.setLineDash([thickness, thickness * 2]);
      } else {
        ctx.setLineDash([]);
      }

      if (loadedImage) {
        // Draw line left
        const space = 20; // space between line and image
        const leftEndX = (width / 2) - (iconSize / 2) - space;
        ctx.moveTo(0, centerY);
        ctx.lineTo(Math.max(0, leftEndX), centerY);
        ctx.stroke();

        // Draw image
        const imgX = (width / 2) - (iconSize / 2);
        const imgY = centerY - (iconSize / 2);
        ctx.drawImage(loadedImage, imgX, imgY, iconSize, iconSize);

        // Draw line right
        ctx.beginPath();
        const rightStartX = (width / 2) + (iconSize / 2) + space;
        ctx.moveTo(Math.min(width, rightStartX), centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
      } else {
        // Draw continuous line
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
      }
    };

    // Events that trigger redraw
    [widthInput, styleInput, colorInput, iconSizeInput].forEach(el => {
      el.addEventListener('change', drawSeparator);
    });
    document.getElementById('sep-generate-btn').addEventListener('click', drawSeparator);

    // Initial draw
    drawSeparator();

    // Download PNG
    document.getElementById('sep-download-png').addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = 'separator.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }
};
