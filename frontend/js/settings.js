/* ===== settings.js — Panel Ustawień ===== */
window.SettingsView = {
  _editingPresetId: null,

  async render() {
    const el = document.getElementById('view-settings');
    el.innerHTML = this.shell() + this.systemTabHtml();
    this.bindEvents();
    this.bindSystemEvents();
    await this.load();
  },

  shell() {
    return `
    <div class="section-title" style="margin-bottom:20px">⚙️ Ustawienia</div>
    <div class="tabs" id="settings-tabs">
      <button class="tab-btn active" data-tab="ai">🤖 AI</button>
      <button class="tab-btn" data-tab="connection">🔌 Integracje</button>
      <button class="tab-btn" data-tab="presets">📝 Presety</button>
      <button class="tab-btn" data-tab="users">👤 Użytkownicy</button>
      <button class="tab-btn" data-tab="logs">📋 Logi</button>
      <button class="tab-btn" data-tab="system">🔧 System</button>
      <button class="tab-btn" data-tab="grafiker">🖼️ Grafiker</button>
    </div>

    <!-- ===== AI Settings ===== -->
    <div class="tab-panel active" id="settings-tab-ai">
      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="margin-bottom:16px">🤖 Dostawca AI</div>
        <div class="form-group">
          <label class="form-label">Aktywny dostawca</label>
          <select class="form-select" id="s-ai-provider">
            <option value="owui">💬 Open WebUI (Lokalny)</option>
            <option value="openai">🔵 OpenAI</option>
            <option value="gemini">🟢 Google Gemini</option>
            <option value="anthropic">🟣 Anthropic (Claude)</option>
            <option value="xai">⬛ xAI (Grok)</option>
            <option value="deepseek">🐳 DeepSeek</option>
            <option value="groq">⚡ Groq</option>
            <option value="mistral">🌪️ Mistral</option>
          </select>
          <div class="form-hint">Wybrany dostawca jest używany do generowania treści we wszystkich modułach.</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px">
          <!-- OpenAI -->
          <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
              <div style="width:10px;height:10px;border-radius:50%;background:var(--blue);box-shadow:0 0 8px var(--blue)"></div>
              <span style="font-weight:700;color:var(--accent-light)">OpenAI</span>
              <span id="s-openai-status" style="font-size:0.72rem;margin-left:auto"></span>
            </div>
            <div class="form-group">
              <label class="form-label">API Key</label>
              <div style="position:relative">
                <input class="form-input" id="s-openai-key" type="password" placeholder="Wpisz nowy klucz (sk-...)">
                <button type="button" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Model</label>
              <select class="form-select" id="s-openai-model">
                <option value="gpt-4o-mini">gpt-4o-mini — tani, szybki</option>
                <option value="gpt-4o">gpt-4o — najlepszy</option>
                <option value="gpt-4-turbo">gpt-4-turbo</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo — najtańszy</option>
              </select>
            </div>
            <div class="form-group" style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
              <label class="form-label" style="display:flex;justify-content:space-between">
                <span>Base URL <span style="font-size:0.7rem;color:var(--text-muted);font-weight:400">(Opcjonalne lustro / Proxy)</span></span>
              </label>
              <input class="form-input" id="s-openai-baseurl" type="url" placeholder="np. http://localhost:8080/v1">
              <div class="form-hint" style="margin-top:4px">Jeśli używasz Open WebUI, Ollama, LM Studio itp. - podaj tu lokalny adres API.</div>
            </div>
          </div>

          <!-- Gemini -->
          <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
              <div style="width:10px;height:10px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green)"></div>
              <span style="font-weight:700;color:var(--green)">Google Gemini</span>
              <span id="s-gemini-status" style="font-size:0.72rem;margin-left:auto"></span>
            </div>
            <div class="form-group">
              <label class="form-label">API Key</label>
              <div style="position:relative">
                <input class="form-input" id="s-gemini-key" type="password" placeholder="Wpisz nowy klucz (AIza...)">
                <button type="button" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Model</label>
              <select class="form-select" id="s-gemini-model">
                <option value="gemini-2.5-flash">gemini-2.5-flash — szybki, tani</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro — najlepszy</option>
                <option value="gemini-2.0-flash">gemini-2.0-flash — starszy (do 06.2026)</option>
              </select>
            </div>
          </div>

          <!-- Anthropic -->
          <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
              <div style="width:10px;height:10px;border-radius:50%;background:#d97757;box-shadow:0 0 8px #d97757"></div>
              <span style="font-weight:700;color:#d97757">Anthropic</span>
              <span id="s-anthropic-status" style="font-size:0.72rem;margin-left:auto"></span>
            </div>
            <div class="form-group">
              <label class="form-label">API Key</label>
              <div style="position:relative">
                <input class="form-input" id="s-anthropic-key" type="password" placeholder="sk-ant-...">
                <button type="button" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Model</label>
              <select class="form-select" id="s-anthropic-model">
                <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet</option>
                <option value="claude-3-5-haiku-20241022">claude-3-5-haiku</option>
                <option value="claude-3-opus-20240229">claude-3-opus</option>
              </select>
            </div>
          </div>

          <!-- xAI -->
          <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
              <div style="width:10px;height:10px;border-radius:50%;background:#ffffff;box-shadow:0 0 8px #ffffff"></div>
              <span style="font-weight:700;color:#ffffff">xAI (Grok)</span>
              <span id="s-xai-status" style="font-size:0.72rem;margin-left:auto"></span>
            </div>
            <div class="form-group">
              <label class="form-label">API Key</label>
              <div style="position:relative">
                <input class="form-input" id="s-xai-key" type="password" placeholder="xai-...">
                <button type="button" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Model</label>
              <select class="form-select" id="s-xai-model">
                <option value="grok-2-latest">grok-2-latest</option>
                <option value="grok-beta">grok-beta</option>
              </select>
            </div>
          </div>

          <!-- DeepSeek -->
          <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
              <div style="width:10px;height:10px;border-radius:50%;background:#4d70f0;box-shadow:0 0 8px #4d70f0"></div>
              <span style="font-weight:700;color:#4d70f0">DeepSeek</span>
              <span id="s-deepseek-status" style="font-size:0.72rem;margin-left:auto"></span>
            </div>
            <div class="form-group">
              <label class="form-label">API Key</label>
              <div style="position:relative">
                <input class="form-input" id="s-deepseek-key" type="password" placeholder="sk-...">
                <button type="button" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Model</label>
              <select class="form-select" id="s-deepseek-model">
                <option value="deepseek-chat">deepseek-chat (V3)</option>
                <option value="deepseek-reasoner">deepseek-reasoner (R1)</option>
              </select>
            </div>
          </div>

          <!-- Groq -->
          <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
              <div style="width:10px;height:10px;border-radius:50%;background:#f55036;box-shadow:0 0 8px #f55036"></div>
              <span style="font-weight:700;color:#f55036">Groq</span>
              <span id="s-groq-status" style="font-size:0.72rem;margin-left:auto"></span>
            </div>
            <div class="form-group">
              <label class="form-label">API Key</label>
              <div style="position:relative">
                <input class="form-input" id="s-groq-key" type="password" placeholder="gsk_...">
                <button type="button" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Model</label>
              <select class="form-select" id="s-groq-model">
                <option value="llama3-70b-8192">llama3-70b</option>
                <option value="llama3-8b-8192">llama3-8b</option>
                <option value="mixtral-8x7b-32768">mixtral-8x7b</option>
              </select>
            </div>
          </div>

          <!-- Mistral -->
          <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
              <div style="width:10px;height:10px;border-radius:50%;background:#fca311;box-shadow:0 0 8px #fca311"></div>
              <span style="font-weight:700;color:#fca311">Mistral</span>
              <span id="s-mistral-status" style="font-size:0.72rem;margin-left:auto"></span>
            </div>
            <div class="form-group">
              <label class="form-label">API Key</label>
              <div style="position:relative">
                <input class="form-input" id="s-mistral-key" type="password" placeholder="...">
                <button type="button" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Model</label>
              <select class="form-select" id="s-mistral-model">
                <option value="mistral-large-latest">mistral-large-latest</option>
                <option value="mistral-small-latest">mistral-small-latest</option>
              </select>
            </div>
          </div>

        </div>

        <div style="margin-top:16px;padding:12px 16px;background:var(--yellow-bg);border:1px solid rgba(234,179,8,0.2);border-radius:var(--radius-sm);font-size:0.8rem;color:var(--yellow)">
          💡 Klucze API są przechowywane lokalnie w bazie SQLite na Twoim komputerze. Nie są wysyłane nigdzie poza wywołaniami do API OpenAI/Gemini.
        </div>
        <button class="btn btn--primary" id="s-save-ai-btn" style="margin-top:16px">💾 Zapisz ustawienia AI</button>
      </div>

      <!-- Open WebUI Integration -->
      <div class="card" style="margin-top:16px">
        <div class="card-title" style="margin-bottom:16px">💬 Open WebUI — Czaty AI</div>
        <div class="form-group">
          <label class="form-label">URL instancji Open WebUI</label>
          <input class="form-input" id="s-owui-url" type="url" placeholder="np. http://localhost:8080 lub http://192.168.1.100:3000">
          <div class="form-hint">Podaj adres swojej instancji Open WebUI.</div>
        </div>
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">API Key <span style="font-size:0.7rem;color:var(--text-muted);font-weight:400">(zalecane)</span></label>
          <div style="position:relative">
            <input class="form-input" id="s-owui-api-key" type="password" placeholder="Wklej API Key z Open WebUI → Settings → Account">
            <button type="button" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁</button>
          </div>
          <div class="form-hint">Wygeneruj klucz w Open WebUI: <strong>Settings → Account → API Keys → Create</strong>. Dzięki temu nie musisz podawać loginu/hasła.</div>
        </div>
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">Domyślny Model Open WebUI</label>
          <select class="form-select" id="s-owui-model">
            <option value="">-- Ładowanie modeli... --</option>
          </select>
          <div class="form-hint">Wybierz domyślny model lokalny z Twojego Open WebUI.</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
          <button class="btn btn--secondary btn--sm" id="s-test-owui-btn">🔌 Testuj połączenie</button>
          <span id="s-owui-test-result" style="font-size:0.82rem"></span>
        </div>
        <button class="btn btn--primary" id="s-save-owui-btn" style="margin-top:12px">💾 Zapisz ustawienia Open WebUI</button>
      </div>
      <!-- AI Feature Mapping -->
      <div class="card" style="margin-top:16px">
        <div class="card-title" style="margin-bottom:12px">🤖 Mapowanie Funkcji AI</div>
        <div class="form-hint" style="margin-bottom:16px">Przypisz dedykowane modele AI do każdej funkcji panelu. Pozostaw <strong>Model Domyślny</strong> jeśli chcesz użyć globalnego modelu OWUI. Możesz wybrać różne modele do różnych zadań — np. szybki model do SEO, mocniejszy do generowania opisów.</div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;" id="s-ai-mapping-container">
          <!-- Dynamically populated from settings.js -->
        </div>

        <div style="display:flex;align-items:center;gap:10px;margin-top:16px">
          <button class="btn btn--secondary btn--sm" id="s-refresh-models-btn">🔄 Odśwież listę modeli</button>
        </div>
        <button class="btn btn--primary" id="s-save-mapping-btn" style="margin-top:16px">💾 Zapisz Mapowania AI</button>
      </div>
    </div>

    <!-- ===== Connection Settings ===== -->
    <div class="tab-panel" id="settings-tab-connection">
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">🔌 Połączenie z ShopGold</div>

        <!-- ShopGold Instances Management Panel -->
        <div style="background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="font-weight:600; font-size:0.95rem; color:var(--text-primary);">🏬 Zapisane instancje sklepów (ShopGold)</div>
              <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">Zapisz konfiguracje różnych sklepów (np. "Sklep Ideał") i przełączaj się między nimi.</div>
            </div>
            <button class="btn btn--secondary btn--sm" id="s-new-instance-btn" style="white-space:nowrap;">+ Zapisz jako nową instancję</button>
          </div>
          <div id="s-instances-list" style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:0.82rem; color:var(--text-muted);">Ładowanie instancji...</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Tryb połączenia</label>
          <select class="form-select" id="s-conn-type">
            <option value="xml">🌐 XML Feed (zalecany — bez dostępu do serwera)</option>
            <option value="csv">📊 CSV Import/Eksport</option>
            <option value="mysql">🗄️ MySQL Bezpośredni (wymaga dostępu do DB)</option>
          </select>
        </div>

        <!-- XML Section -->
        <div id="s-xml-section">
          <hr class="divider">
          <div style="font-weight:600;margin-bottom:12px">🌐 Ustawienia XML Feed</div>
          <div class="form-group">
            <label class="form-label">URL XML Feed (np. Ceneo, Google Shopping)</label>
            <input class="form-input" id="s-xml-url" type="url" placeholder="https://twojsklep.pl/xml/ceneo.xml">
            <div class="form-hint">Wygeneruj URL w: Panel ShopGold → Integracje → Porównywarki → Ceneo. Możesz też zaimportować plik lokalnie.</div>
          </div>
          <div style="background:var(--bg-elevated);border-radius:var(--radius-sm);padding:12px;font-size:0.82rem;color:var(--text-secondary)">
            📁 Plik testowy: <code style="color:var(--accent-light)">data/sample_products.xml</code> — 8 przykładowych produktów do testów.
          </div>
        </div>

        <!-- MySQL Section -->
        <div id="s-mysql-section" style="display:none">
          <hr class="divider">
          <div style="font-weight:600;margin-bottom:12px">🗄️ Ustawienia MySQL</div>
          <div style="background:var(--yellow-bg);border:1px solid rgba(234,179,8,0.3);border-radius:var(--radius);padding:12px;margin-bottom:12px;font-size:0.82rem;color:var(--yellow)">
            ⚠️ Wymaga zdalnego dostępu MySQL (port 3306) na serwerze hostingowym. Dane przechowywane tylko lokalnie.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label class="form-label">Host</label><input class="form-input" id="s-mysql-host" type="text" placeholder="twojsklep.pl"></div>
            <div class="form-group"><label class="form-label">Port</label><input class="form-input" id="s-mysql-port" type="number" value="3306"></div>
            <div class="form-group"><label class="form-label">Użytkownik</label><input class="form-input" id="s-mysql-user" type="text"></div>
            <div class="form-group"><label class="form-label">Hasło</label><input class="form-input" id="s-mysql-pass" type="password"></div>
            <div class="form-group"><label class="form-label">Baza danych</label><input class="form-input" id="s-mysql-db" type="text"></div>
            <div class="form-group"><label class="form-label">Prefiks tabel</label><input class="form-input" id="s-mysql-prefix" type="text" placeholder="sg_"></div>
          </div>

          <div style="font-weight:600;margin-top:16px;margin-bottom:12px">📁 Ustawienia FTP (do usuwania zdjęć)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group"><label class="form-label">FTP Host</label><input class="form-input" id="s-ftp-host" type="text" placeholder="ftp.twojsklep.pl"></div>
            <div class="form-group"><label class="form-label">FTP Port</label><input class="form-input" id="s-ftp-port" type="number" value="21"></div>
            <div class="form-group"><label class="form-label">FTP Użytkownik</label><input class="form-input" id="s-ftp-user" type="text"></div>
            <div class="form-group"><label class="form-label">FTP Hasło</label><input class="form-input" id="s-ftp-pass" type="password"></div>
            <div class="form-group" style="grid-column:1/3"><label class="form-label">Ścieżka do katalogu public_html (opcjonalnie)</label><input class="form-input" id="s-ftp-path" type="text" placeholder="/public_html"></div>
          </div>

          <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
            <button class="btn btn--secondary btn--sm" id="s-test-mysql-btn">🔌 Testuj połączenie</button>
            <span id="s-test-result" style="font-size:0.82rem"></span>
          </div>
        </div>

        <!-- Subiekt GT Sfera Section -->
        <div class="card" style="margin-top:16px; margin-bottom:16px; border:1px solid var(--border); box-shadow:none">
          <div class="card-title" style="margin-bottom:12px; font-size:1rem">🧰 Integracja Subiekt GT (Sfera)</div>
          <div class="form-hint" style="margin-bottom:12px">Połączenie z bazą i systemem InsERT GT poprzez interfejs Sfery (np. do generowania dokumentów). Wymaga aktywnej licencji Sfery.</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label class="form-label">Serwer SQL</label><input class="form-input" id="s-sfera-server" type="text" placeholder="(local)\\INSERTGT"></div>
            <div class="form-group"><label class="form-label">Baza danych</label><input class="form-input" id="s-sfera-db" type="text" placeholder="NaszSklep"></div>
            <div class="form-group"><label class="form-label">Użytkownik SQL</label><input class="form-input" id="s-sfera-user" type="text" placeholder="sa"></div>
            <div class="form-group"><label class="form-label">Hasło SQL</label><input class="form-input" id="s-sfera-pass" type="password"></div>
            <div class="form-group"><label class="form-label">Użytkownik (Operator) GT</label><input class="form-input" id="s-sfera-operator" type="text" placeholder="Szef"></div>
            <div class="form-group"><label class="form-label">Hasło Operatora GT</label><input class="form-input" id="s-sfera-operator-pass" type="password"></div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
            <button class="btn btn--secondary btn--sm" id="s-test-sfera-btn">🔌 Testuj połączenie ze Sferą</button>
            <span id="s-sfera-test-result" style="font-size:0.82rem"></span>
          </div>
        </div>

        <hr class="divider">
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button class="btn btn--primary" id="s-save-conn-btn">💾 Zapisz ustawienia połączenia</button>
          <button class="btn btn--secondary" id="s-update-active-inst-btn" style="display:none;">🔄 Zapisz zmiany do aktywnej instancji: <strong id="s-active-inst-label"></strong></button>
        </div>
      </div>

      <!-- Email Monitor Integration -->
      <div class="card" style="margin-top:16px">
        <div class="card-title" style="margin-bottom:16px">📬 Monitorowanie Maili Ofertowych (IMAP)</div>
        <div class="form-hint" style="margin-bottom:12px">System automatycznie pobiera maile z załącznikami od hurtowni i wyciąga z nich oferty do modułu Sourcingu.</div>
        <div style="display:grid;grid-template-columns:2fr 1fr 2fr 2fr;gap:12px">
          <div class="form-group"><label class="form-label">Serwer IMAP</label><input class="form-input" id="s-em-host" placeholder="imap.gmail.com"></div>
          <div class="form-group"><label class="form-label">Port</label><input class="form-input" id="s-em-port" placeholder="993"></div>
          <div class="form-group"><label class="form-label">Użytkownik (Email)</label><input class="form-input" id="s-em-user" placeholder="oferty@twoj-sklep.pl"></div>
          <div class="form-group"><label class="form-label">Hasło (App Password)</label><input class="form-input" id="s-em-pass" type="password"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-top:12px">
          <div class="form-group"><label class="form-label">Folder</label><input class="form-input" id="s-em-folder" placeholder="INBOX"></div>
          <div class="form-group"><label class="form-label">Szyfrowanie</label><select class="form-select" id="s-em-tls"><option value="1">Wymagaj TLS</option><option value="0">Brak</option></select></div>
          <div class="form-group"><label class="form-label">Filtr Tematu (opcjonalny)</label><input class="form-input" id="s-em-subj" placeholder="np. oferta, cennik"></div>
          <div class="form-group"><label class="form-label">Harmonogram</label><select class="form-select" id="s-em-cron"><option value="*/30 * * * *">Co 30 minut</option><option value="0 * * * *">Co godzinę</option><option value="0 0 * * *">Raz dziennie</option></select></div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
          <button class="btn btn--secondary btn--sm" id="s-test-em-btn">🔌 Testuj połączenie IMAP</button>
          <span id="s-em-test-result" style="font-size:0.82rem"></span>
        </div>
        <div style="margin-top:16px; border-top:1px solid var(--border); padding-top:12px">
          <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;cursor:pointer">
            <input type="checkbox" id="s-em-enabled" class="form-checkbox">
            <span>Włącz automatyczne monitorowanie skrzynki e-mail</span>
          </label>
        </div>
        <button class="btn btn--primary" id="s-save-em-btn" style="margin-top:12px">💾 Zapisz ustawienia Email Monitora</button>
      </div>

      <!-- Sellasist Integration -->
      <div class="card" style="margin-top:16px">
        <div class="card-title" style="margin-bottom:16px">📦 Integracja Sellasist</div>
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px">
          <div class="form-group">
            <label class="form-label">Nazwa konta (Subdomena)</label>
            <input class="form-input" id="s-sellasist-account" type="text" placeholder="np. twoj-sklep">
            <div class="form-hint">Początek z adresu: <strong>https://[TWOJE-KONTO].sellasist.pl</strong></div>
          </div>
          <div class="form-group">
            <label class="form-label">API Key <span style="font-size:0.7rem;color:var(--text-muted);font-weight:400">(odczyt danych)</span></label>
            <div style="position:relative">
              <input class="form-input" id="s-sellasist-api-key" type="password" placeholder="Wklej API Key z panelu Sellasist">
              <button type="button" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.8rem" onclick="this.previousElementSibling.type=this.previousElementSibling.type==='password'?'text':'password'">👁</button>
            </div>
            <div class="form-hint">Wygeneruj klucz w Sellasist: <strong>Integracje → Klucze API</strong>.</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
          <button class="btn btn--secondary btn--sm" id="s-test-sellasist-btn">🔌 Testuj API Key</button>
          <button class="btn btn--secondary btn--sm" id="s-sync-sellasist-btn">🔄 Synchronizuj z bazą (Wagi i Niewystawione)</button>
          <span id="s-sellasist-test-result" style="font-size:0.82rem"></span>
        </div>
        <div style="margin-top:16px; border-top:1px solid var(--border); padding-top:12px">
          <label style="display:flex;align-items:center;gap:8px;font-size:0.9rem;cursor:pointer">
            <input type="checkbox" id="s-sellasist-auto-sync" class="form-checkbox">
            <span>Włącz automatyczną synchronizację w tle (co 1 godzinę)</span>
          </label>
        </div>
        <button class="btn btn--primary" id="s-save-sellasist-btn" style="margin-top:12px">💾 Zapisz ustawienia Sellasist</button>
      </div>

      <!-- ESET Schedule & Dagma Integration -->
      <div class="card" style="margin-top:16px">
        <div class="card-title" style="margin-bottom:12px">🛡️ Harmonogram i Integracja ESET (Dagma)</div>
        <div class="form-hint" style="margin-bottom:14px">Zarządzaj automatycznym sprawdzaniem i synchronizacją nowych opłaconych zamówień ESET w systemie Sellasist.</div>
        
        <div style="background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); padding:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span id="s-eset-sched-ind" style="font-size:1.2rem;">⏳</span>
            <div>
              <div style="font-weight:600; color:var(--text-primary); font-size:0.92rem;" id="s-eset-sched-status">Sprawdzanie...</div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">Weryfikuje nowe zamówienia ESET co 15 minut.</div>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn--secondary btn--sm" id="s-eset-sched-toggle-btn" type="button">Zatrzymaj harmonogram</button>
            <button class="btn btn--primary btn--sm" id="s-eset-sync-now-btn" type="button" style="background:var(--blue);">⚡ Sprawdź teraz</button>
          </div>
        </div>
      </div>

      <!-- External Apps IP/Link Integration -->
      <div class="card" style="margin-top:16px">
        <div class="card-title" style="margin-bottom:12px">🔗 Adresy IP i linki do aplikacji zewnętrznych</div>
        <div class="form-hint" style="margin-bottom:14px">Konfiguracja adresów IP lub URL otwieranych po kliknięciu zakładek <strong>Serwis</strong> oraz <strong>Autoresponder</strong> w lewym menu bocznym.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label class="form-label">🛠️ Adres IP / URL Serwisu</label>
            <input class="form-input" id="s-conn-service-url" type="text" placeholder="np. http://192.168.1.50:8080 lub https://serwis.idealpc.pl">
            <div class="form-hint">Docelowy adres lub IP serwisu w Twojej sieci / domenie.</div>
          </div>
          <div class="form-group">
            <label class="form-label">🤖 Adres IP / URL Autorespondera</label>
            <input class="form-input" id="s-conn-autoresponder-url" type="text" placeholder="np. http://192.168.1.50:4000 lub http://localhost:4000">
            <div class="form-hint">Domyślnie: http://localhost:4000/</div>
          </div>
        </div>
        <button class="btn btn--primary" id="s-save-extapps-btn" style="margin-top:8px">💾 Zapisz adresy aplikacji</button>
      </div>
    </div>

    <!-- ===== Presets ===== -->
    <div class="tab-panel" id="settings-tab-presets">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📝 Presety Promptów AI</div>
            <div class="card-subtitle">Szablony instrukcji dla modelu AI — kontrolują styl i strukturę generowanych treści</div>
          </div>
          <button class="btn btn--primary btn--sm" id="s-new-preset-btn">➕ Nowy preset</button>
        </div>
        <div id="s-presets-list"></div>

        <!-- Preset editor (hidden by default) -->
        <div id="s-preset-editor" style="display:none;margin-top:16px;border-top:1px solid var(--border);padding-top:16px">
          <div style="font-weight:600;margin-bottom:14px" id="s-preset-editor-title">✏️ Edytuj preset</div>
          <div class="form-group"><label class="form-label">Nazwa presetu</label><input class="form-input" id="s-preset-name" type="text" placeholder="np. Elektronika Premium"></div>
          <div class="form-group">
            <label class="form-label">System Prompt <span style="color:var(--text-muted);font-weight:400">(instrukcje roli i zasad)</span></label>
            <textarea class="form-textarea" id="s-preset-sys" style="min-height:100px" placeholder="Jesteś ekspertem ds. copywritingu e-commerce..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Szablon User Prompt <span style="color:var(--text-muted);font-weight:400">— zmienne: {{name}}, {{description}}, {{category}}, {{attributes}}, {{price}}</span></label>
            <textarea class="form-textarea" id="s-preset-user" style="min-height:200px"></textarea>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn--primary btn--sm" id="s-save-preset-btn">💾 Zapisz preset</button>
            <button class="btn btn--ghost btn--sm" id="s-cancel-preset-btn">Anuluj</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Grafiker & Brand Kit ===== -->
    <div class="tab-panel" id="settings-tab-grafiker">
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">🖼️ Grafiker AI / Brand Kit</div>
        
        <div class="form-group">
          <label class="form-label">Klucz API remove.bg (Usuwanie tła)</label>
          <input class="form-input" id="s-grafiker-removebg" type="password" placeholder="Wpisz klucz API z remove.bg">
          <div class="form-hint">Zarejestruj się na remove.bg aby uzyskać darmowy klucz API (50 darmowych wywołań / miesiąc).</div>
        </div>

        <hr class="divider" style="margin:24px 0">
        
        <div style="font-weight:600;margin-bottom:12px">🎨 Brand Kit (Styl firmowy)</div>
        <div class="form-hint" style="margin-bottom:16px">Ustawienia te zostaną użyte do nakładania logo i stylizacji na wygenerowane grafiki.</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label class="form-label">Główny kolor firmy (HEX)</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="color" id="s-grafiker-color-picker" style="width:40px;height:40px;padding:0;border:none;border-radius:4px;cursor:pointer">
              <input class="form-input" id="s-grafiker-color" type="text" placeholder="#FFD700" style="flex:1">
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Czcionka firmowa</label>
            <select class="form-select" id="s-grafiker-font">
              <option value="Inter">Inter (Nowoczesna, czytelna)</option>
              <option value="Roboto">Roboto</option>
              <option value="Montserrat">Montserrat (Elegancka)</option>
              <option value="Open Sans">Open Sans</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Logo firmy (PNG z przezroczystym tłem)</label>
          <div style="display:flex;align-items:center;gap:16px">
            <div id="s-grafiker-logo-preview" style="width:100px;height:100px;background:var(--bg-inset) url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23ccc%22 stroke-width=%222%22><rect x=%223%22 y=%223%22 width=%2218%22 height=%2218%22 rx=%222%22 ry=%222%22></rect><circle cx=%228.5%22 cy=%228.5%22 r=%221.5%22></circle><polyline points=%2221 15 16 10 5 21%22></polyline></svg>') center/50% no-repeat;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;background-size:contain;background-position:center;background-repeat:no-repeat"></div>
            <div style="flex:1">
              <input type="file" id="s-grafiker-logo-file" accept="image/png, image/jpeg, image/webp" style="display:none">
              <button class="btn btn--secondary btn--sm" onclick="document.getElementById('s-grafiker-logo-file').click()">Wgraj Logo</button>
              <button class="btn btn--ghost btn--sm" id="s-grafiker-logo-remove" style="color:var(--red);display:none">Usuń</button>
              <div class="form-hint" style="margin-top:8px">Zalecany format: <strong>PNG</strong>, ok. 500x500px, bez tła. Zostanie skonwertowane i zapisane w bazie danych.</div>
            </div>
          </div>
        </div>

        <button class="btn btn--primary" id="s-save-grafiker-btn" style="margin-top:24px">💾 Zapisz ustawienia Grafikera</button>
      </div>
    </div>

    <!-- ===== Logs ===== -->
    <div class="tab-panel" id="settings-tab-logs">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">📋 Logi systemowe</div>
            <div class="card-subtitle">Synchronizacje, błędy API, operacje AI i inne zdarzenia systemowe</div>
          </div>
          <button class="btn btn--ghost btn--sm" onclick="SettingsView.loadLogs()">🔄 Odśwież</button>
        </div>

        <!-- Stats bar -->
        <div id="s-logs-stats" style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap"></div>

        <!-- Filter bar -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
          <button class="btn btn--sm s-log-filter-btn active" data-level="" style="font-size:.78rem">📋 Wszystkie</button>
          <button class="btn btn--sm btn--ghost s-log-filter-btn" data-level="error" style="font-size:.78rem;color:var(--red)">🔴 Błędy</button>
          <button class="btn btn--sm btn--ghost s-log-filter-btn" data-level="success" style="font-size:.78rem;color:var(--green)">🟢 Sukces</button>
          <div style="flex:1"></div>
          <input class="form-input" id="s-logs-search" placeholder="Szukaj po akcji..." style="max-width:220px;font-size:.82rem">
        </div>

        <div class="table-wrap">
          <table><thead><tr>
            <th style="width:36px">Status</th>
            <th>Akcja</th>
            <th>Wynik / Szczegóły</th>
            <th>Błąd</th>
            <th style="white-space:nowrap">Data</th>
          </tr></thead>
          <tbody id="s-logs-tbody"><tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Ładowanie...</td></tr></tbody></table>
        </div>
        <div id="s-logs-pagination" style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:.8rem;color:var(--text-muted)"></div>
      </div>
    </div>

    <!-- ===== Users ===== -->
    <div class="tab-panel" id="settings-tab-users">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">👤 Użytkownicy i uprawnienia</div>
            <div class="card-subtitle">Zarządzaj kontami i dostępem do sekcji</div>
          </div>
          <button class="btn btn--primary btn--sm" id="s-add-user-btn">➕ Nowy użytkownik</button>
        </div>
        <div class="table-wrap" style="margin-bottom:20px">
          <table><thead><tr><th>#</th><th>Login</th><th>Nazwa</th><th>Rola</th><th>Firmy</th><th>Sekcje</th><th>Status</th><th></th></tr></thead>
          <tbody id="s-users-tbody"><tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">Ładowanie...</td></tr></tbody></table>
        </div>
        <hr class="divider">
        <div class="card-header" style="margin-top:16px">
          <div class="card-title" style="font-size:.9rem">📋 Logi aktywności użytkowników</div>
          <button class="btn btn--ghost btn--sm" id="s-refresh-ulogs-btn">🔄 Odśwież</button>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap">
          <input class="form-input" id="s-ulogs-user" placeholder="Filtruj po loginie..." style="max-width:200px">
          <select class="form-select" id="s-ulogs-module" style="max-width:160px">
            <option value="">Wszystkie moduły</option>
            <option value="auth">auth</option><option value="pim">pim</option>
            <option value="sourcing">sourcing</option><option value="profitability">profitability</option>
            <option value="users">users</option>
          </select>
          <select class="form-select" id="s-ulogs-co" style="max-width:160px">
            <option value="">Wszystkie firmy</option>
            <option value="idealpc">IdealPC</option><option value="prymus">Prymus.store</option><option value="kamore">Kamore</option>
          </select>
        </div>
        <div class="table-wrap">
          <table><thead><tr><th>Czas</th><th>Użytkownik</th><th>Firma</th><th>Akcja</th><th>Moduł</th><th>Szczegóły</th></tr></thead>
          <tbody id="s-ulogs-tbody"><tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Ładowanie...</td></tr></tbody></table>
        </div>
      </div>
    </div>`;
  },

  async load() {
    try {
      const s = await API.get('/settings');
      window.currentSettings = s;
      if (s.ai_provider) document.getElementById('s-ai-provider').value = s.ai_provider;
      if (s.openai_model) document.getElementById('s-openai-model').value = s.openai_model;
      if (s.gemini_model) document.getElementById('s-gemini-model').value = s.gemini_model;
      if (s.openai_base_url) document.getElementById('s-openai-baseurl').value = s.openai_base_url;
      if (s.owui_url) document.getElementById('s-owui-url').value = s.owui_url;
      if (s.owui_api_key) document.getElementById('s-owui-api-key').value = ''; // Don't show masked key in input
      if (s.owui_model) {
        const owuiModelSelect = document.getElementById('s-owui-model');
        if (owuiModelSelect) owuiModelSelect.value = s.owui_model;
      }
      if (s.sellasist_account) document.getElementById('s-sellasist-account').value = s.sellasist_account;
      if (s.sellasist_auto_sync !== undefined) document.getElementById('s-sellasist-auto-sync').checked = (s.sellasist_auto_sync === '1' || s.sellasist_auto_sync === 'true');
      if (s.sellasist_api_key) {
        document.getElementById('s-sellasist-api-key').value = ''; // Don't show masked key
        document.getElementById('s-sellasist-test-result').innerHTML = `<span style="color:var(--green)">✅ Skonfigurowano w bazie</span>`;
      }
      
      // Email Monitor settings
      if (s.email_monitor_host) document.getElementById('s-em-host').value = s.email_monitor_host;
      if (s.email_monitor_port) document.getElementById('s-em-port').value = s.email_monitor_port;
      if (s.email_monitor_user) document.getElementById('s-em-user').value = s.email_monitor_user;
      if (s.email_monitor_folder) document.getElementById('s-em-folder').value = s.email_monitor_folder;
      if (s.email_monitor_tls !== undefined) document.getElementById('s-em-tls').value = s.email_monitor_tls;
      if (s.email_monitor_subject_filter) document.getElementById('s-em-subj').value = s.email_monitor_subject_filter;
      if (s.email_monitor_cron) document.getElementById('s-em-cron').value = s.email_monitor_cron;
      if (s.email_monitor_enabled !== undefined) document.getElementById('s-em-enabled').checked = (s.email_monitor_enabled === '1' || s.email_monitor_enabled === 'true');
      if (s.email_monitor_pass) document.getElementById('s-em-pass').placeholder = '(ustawiono w bazie - wpisz by zmienić)';
      if (s.sfera_server) document.getElementById('s-sfera-server').value = s.sfera_server;
      if (s.sfera_db) document.getElementById('s-sfera-db').value = s.sfera_db;
      if (s.sfera_user) document.getElementById('s-sfera-user').value = s.sfera_user;
      if (s.sfera_operator) document.getElementById('s-sfera-operator').value = s.sfera_operator;
      if (s.sfera_pass) document.getElementById('s-sfera-pass').value = ''; // Nie pokazujemy zamaskowanego hasła
      if (s.sfera_operator_pass) document.getElementById('s-sfera-operator-pass').value = '';

      if (s.anthropic_model) document.getElementById('s-anthropic-model').value = s.anthropic_model;
      if (s.xai_model) document.getElementById('s-xai-model').value = s.xai_model;
      if (s.deepseek_model) document.getElementById('s-deepseek-model').value = s.deepseek_model;
      if (s.groq_model) document.getElementById('s-groq-model').value = s.groq_model;
      if (s.mistral_model) document.getElementById('s-mistral-model').value = s.mistral_model;

      ['openai','gemini','anthropic','xai','deepseek','groq','mistral'].forEach(p => {
        const el = document.getElementById(`s-${p}-status`);
        if(el) {
          if (s[`${p}_api_key`]) el.innerHTML = `<span style="color:var(--green)">✅ Ustawiony</span>`;
          else el.innerHTML = `<span style="color:var(--red)">❌ Brak klucza</span>`;
        }
      });
      if (s.connection_type) { document.getElementById('s-conn-type').value = s.connection_type; this.toggleConnectionSections(s.connection_type); }
      if (s.xml_feed_url) document.getElementById('s-xml-url').value = s.xml_feed_url;
      if (s.mysql_host) document.getElementById('s-mysql-host').value = s.mysql_host;
      if (s.mysql_port) document.getElementById('s-mysql-port').value = s.mysql_port;
      if (s.mysql_user) document.getElementById('s-mysql-user').value = s.mysql_user;
      if (s.mysql_database) document.getElementById('s-mysql-db').value = s.mysql_database;
      if (s.mysql_table_prefix) document.getElementById('s-mysql-prefix').value = s.mysql_table_prefix;

      if (s.ftp_host) document.getElementById('s-ftp-host').value = s.ftp_host;
      if (s.ftp_port) document.getElementById('s-ftp-port').value = s.ftp_port;
      if (s.ftp_user) document.getElementById('s-ftp-user').value = s.ftp_user;
      if (s.ftp_path) document.getElementById('s-ftp-path').value = s.ftp_path;

      await this.loadPresets();
      await this.loadShopgoldInstances();
      await this.loadEsetSchedule();
      await this.loadLogs();
      await this.loadUsers();
      await this.loadUserLogs();

      // Grafiker load
      if (s.grafiker_removebg_key) document.getElementById('s-grafiker-removebg').value = s.grafiker_removebg_key; // backend masks it or not? actually we mask only certain keys, we didn't add masking for removebg in backend. Wait, backend didn't mask it. Let's not show it or just show it.
      if (s.grafiker_removebg_key) {
        document.getElementById('s-grafiker-removebg').value = ''; 
        document.getElementById('s-grafiker-removebg').placeholder = '(Klucz zapisany)';
      }
      if (s.grafiker_brand_color) {
        document.getElementById('s-grafiker-color').value = s.grafiker_brand_color;
        document.getElementById('s-grafiker-color-picker').value = s.grafiker_brand_color;
      }
      if (s.grafiker_brand_font) document.getElementById('s-grafiker-font').value = s.grafiker_brand_font;
      if (s.grafiker_brand_logo_b64) {
        document.getElementById('s-grafiker-logo-preview').style.backgroundImage = `url('${s.grafiker_brand_logo_b64}')`;
        document.getElementById('s-grafiker-logo-remove').style.display = 'inline-block';
        SettingsView._grafikerLogoB64 = s.grafiker_brand_logo_b64;
      }
      if (s.service_redirect_url) {
        const su = document.getElementById('s-service-url'); if (su) su.value = s.service_redirect_url;
        const csu = document.getElementById('s-conn-service-url'); if (csu) csu.value = s.service_redirect_url;
      }
      if (s.autoresponder_url) {
        const au = document.getElementById('s-autoresponder-url'); if (au) au.value = s.autoresponder_url;
        const cau = document.getElementById('s-conn-autoresponder-url'); if (cau) cau.value = s.autoresponder_url;
      }

      document.getElementById('s-refresh-models-btn')?.click();
    } catch(e) { Toast.error('Błąd ładowania ustawień: ' + e.message); }
  },

  async loadUsers() {
    try {
      const users = await API.get('/auth/users');
      const tbody = document.getElementById('s-users-tbody');
      if (!tbody) return;
      const SECTIONS = ['dashboard','pim','approval','campaigns','settings','seo','sourcing','profitability'];
      if (!users.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">Brak użytkowników</td></tr>'; return; }
      tbody.innerHTML = users.map((u,i) => `<tr>
        <td style="color:var(--text-muted);font-size:.78rem">${i+1}</td>
        <td><code style="font-size:.82rem">${escHtml(u.username)}</code></td>
        <td>${escHtml(u.display_name)}</td>
        <td><span class="badge badge--${u.role==='admin'?'google':'draft'}">${escHtml(u.role)}</span></td>
        <td style="font-size:.75rem">${(u.company_access||[]).join(', ')}</td>
        <td style="font-size:.75rem">${u.role==='admin'?'<span style="color:var(--green)">Wszystkie</span>':(u.permissions||[]).join(', ')||'—'}</td>
        <td><span class="badge badge--${u.active?'approved':'rejected'}">${u.active?'Aktywny':'Nieaktywny'}</span></td>
        <td>
          <button class="btn btn--ghost btn--sm" data-edit-user='${JSON.stringify(u)}'>✏️</button>
          ${u.id!==Session.user?.id?`<button class="btn btn--ghost btn--sm" style="color:var(--red)" data-del-user="${u.id}">🗑</button>`:''}
        </td>
      </tr>`).join('');
      this._usersData = users;
    } catch(e) { console.warn(e); }
  },

  async loadUserLogs() {
    try {
      const u = document.getElementById('s-ulogs-user')?.value||'';
      const m = document.getElementById('s-ulogs-module')?.value||'';
      const co= document.getElementById('s-ulogs-co')?.value||'';
      const {rows} = await API.get(`/auth/logs?username=${encodeURIComponent(u)}&module=${encodeURIComponent(m)}&company=${encodeURIComponent(co)}&limit=100`);
      const tbody = document.getElementById('s-ulogs-tbody');
      if (!tbody) return;
      if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Brak logów</td></tr>'; return; }
      tbody.innerHTML = rows.map(l=>`<tr>
        <td style="font-size:.74rem;white-space:nowrap;color:var(--text-muted)">${l.created_at?.slice(0,16)||'—'}</td>
        <td><code style="font-size:.78rem">${escHtml(l.username)}</code></td>
        <td style="font-size:.76rem">${escHtml(l.company||'—')}</td>
        <td><span class="badge badge--draft" style="font-size:.7rem">${escHtml(l.action)}</span></td>
        <td style="font-size:.76rem;color:var(--accent-light)">${escHtml(l.module)}</td>
        <td style="font-size:.76rem;color:var(--text-secondary)">${escHtml(l.detail||'')}</td>
      </tr>`).join('');
    } catch(e){ console.warn(e); }
  },

  openUserModal(u = null) {
    const SECTIONS = ['dashboard','pim','approval','campaigns','settings','seo','sourcing','profitability'];
    const COS = [{id:'idealpc',name:'IdealPC'},{id:'prymus',name:'Prymus.store'},{id:'kamore',name:'Kamore'}];
    const perms = u?.permissions || [];
    const cos   = u?.company_access || ['idealpc','prymus','kamore'];
    Modal.show({
      title: u ? `✏️ Edytuj: ${u.display_name}` : '➕ Nowy użytkownik',
      body: `
        <div class="form-group"><label class="form-label">Login *</label><input class="form-input" id="um-login" value="${escHtml(u?.username||'')}" ${u?'readonly':''}></div>
        <div class="form-group"><label class="form-label">Nazwa wyświetlana</label><input class="form-input" id="um-name" value="${escHtml(u?.display_name||'')}"></div>
        <div class="form-group"><label class="form-label">${u?'Nowe hasło (zostaw puste aby nie zmieniać)':'Hasło *'}</label><input class="form-input" id="um-pass" type="password"></div>
        <div class="form-group"><label class="form-label">Rola</label><select class="form-select" id="um-role"><option value="user" ${u?.role!=='admin'?'selected':''}>Użytkownik</option><option value="admin" ${u?.role==='admin'?'selected':''}>Administrator</option></select></div>
        <div class="form-group"><label class="form-label">Dostęp do firm</label><div style="display:flex;gap:12px;flex-wrap:wrap">${COS.map(c=>`<label class="checkbox-wrap"><input type="checkbox" value="${c.id}" class="um-co" ${cos.includes(c.id)?'checked':''}> ${c.name}</label>`).join('')}</div></div>
        <div class="form-group" id="um-perms-wrap"><label class="form-label">Uprawnienia do sekcji</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${SECTIONS.map(s=>`<label class="checkbox-wrap"><input type="checkbox" value="${s}" class="um-perm" ${perms.includes(s)?'checked':''}> ${s}</label>`).join('')}</div></div>
        <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="um-active"><option value="1" ${u?.active!==0?'selected':''}>Aktywny</option><option value="0" ${u?.active===0?'selected':''}>Nieaktywny</option></select></div>
      `,
      footer: `<button class="btn btn--ghost btn--sm" onclick="Modal.hide()">Anuluj</button><button class="btn btn--primary" id="um-save">Zapisz</button>`
    });
    // Hide perms for admin
    document.getElementById('um-role').addEventListener('change', e => {
      document.getElementById('um-perms-wrap').style.display = e.target.value==='admin' ? 'none' : '';
    });
    if (u?.role==='admin') document.getElementById('um-perms-wrap').style.display='none';

    document.getElementById('um-save').addEventListener('click', async () => {
      const login    = document.getElementById('um-login').value.trim();
      const name     = document.getElementById('um-name').value.trim();
      const pass     = document.getElementById('um-pass').value;
      const role     = document.getElementById('um-role').value;
      const active   = parseInt(document.getElementById('um-active').value);
      const permissions  = [...document.querySelectorAll('.um-perm:checked')].map(c=>c.value);
      const company_access=[...document.querySelectorAll('.um-co:checked')].map(c=>c.value);
      if (!u && !pass) { Toast.warn('Podaj hasło'); return; }
      try {
        if (u) { await API.patch('/auth/users/'+u.id, {display_name:name||login, role, active, permissions, company_access, ...(pass?{password:pass}:{})}); }
        else   { await API.post('/auth/users', {username:login, display_name:name||login, password:pass, role, permissions, company_access}); }
        Modal.hide(); Toast.success('Zapisano'); await this.loadUsers();
      } catch(e) { Toast.error(e.message); }
    });
  },

  async loadShopgoldInstances() {
    try {
      const d = await API.get('/settings/shopgold-instances');
      const list = document.getElementById('s-instances-list');
      if (!list) return;
      if (!d.instances || d.instances.length === 0) {
        list.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:8px 0">Brak zapisanych instancji. Wpisz dane w formularzu poniżej i kliknij "+ Zapisz jako nową instancję".</div>';
        const upBtn = document.getElementById('s-update-active-inst-btn');
        if (upBtn) upBtn.style.display = 'none';
        this._activeShopgoldInstId = null;
        return;
      }
      this._shopgoldInstances = d.instances;
      const activeInst = d.instances.find(x => x.is_active === 1);
      if (activeInst) {
        this._activeShopgoldInstId = activeInst.id;
        this._activeShopgoldInstName = activeInst.name;
        const upBtn = document.getElementById('s-update-active-inst-btn');
        const lbl = document.getElementById('s-active-inst-label');
        if (upBtn && lbl) {
          lbl.textContent = activeInst.name;
          upBtn.style.display = 'inline-flex';
        }
      } else {
        this._activeShopgoldInstId = null;
        const upBtn = document.getElementById('s-update-active-inst-btn');
        if (upBtn) upBtn.style.display = 'none';
      }

      list.innerHTML = d.instances.map(inst => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; background:var(--bg-base); border:1px solid ${inst.is_active ? 'var(--blue)' : 'var(--border)'}; border-radius:var(--radius-sm); transition:all 0.2s;">
          <div style="display:flex; flex-direction:column; gap:2px; flex:1;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:600; color:var(--text-primary); font-size:0.92rem;">${escHtml(inst.name)}</span>
              ${inst.is_active ? '<span class="badge badge--blue" style="font-size:0.7rem; padding:2px 6px;">🟢 Aktywna instancja</span>' : ''}
              <span style="font-size:0.75rem; color:var(--text-muted); background:var(--bg-elevated); padding:2px 6px; border-radius:4px;">${inst.connection_type ? inst.connection_type.toUpperCase() : 'MYSQL'}</span>
            </div>
            <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">
              Host: <strong style="color:var(--text-primary)">${escHtml(inst.mysql_host || '—')}</strong> | Baza: <strong style="color:var(--text-primary)">${escHtml(inst.mysql_database || '—')}</strong> | FTP: <strong>${escHtml(inst.ftp_host || '—')}</strong>
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            ${!inst.is_active ? `<button class="btn btn--primary btn--sm" onclick="SettingsView.activateShopgoldInstance(${inst.id})" title="Wczytaj i używaj tego połączenia">🔄 Wczytaj i aktywuj</button>` : ''}
            <button class="btn btn--secondary btn--sm" onclick="SettingsView.openEditShopgoldInstanceModal(${inst.id})" title="Edytuj wszystkie dane konfiguracji tego sklepu">⚙️ Edytuj dane</button>
            <button class="btn btn--ghost btn--sm" style="color:var(--red);" onclick="SettingsView.deleteShopgoldInstance(${inst.id})" title="Usuń tę instancję">🗑️</button>
          </div>
        </div>
      `).join('');
    } catch(e) {
      console.error('Błąd ładowania instancji ShopGold:', e);
    }
  },

  async activateShopgoldInstance(id) {
    try {
      const res = await API.post(`/settings/shopgold-instances/${id}/activate`, {});
      Toast.success(`✅ Wczytano i aktywowano instancję: ${res.name}`);
      await this.load();
    } catch(e) {
      Toast.error('Błąd aktywacji instancji: ' + e.message);
    }
  },

  editShopgoldInstanceName(id) {
    this.openEditShopgoldInstanceModal(id);
  },

  openEditShopgoldInstanceModal(id) {
    const inst = this._shopgoldInstances?.find(x => x.id === id);
    if (!inst) {
      Toast.error('Nie znaleziono instancji o ID: ' + id);
      return;
    }

    Modal.show({
      title: `⚙️ Edytuj dane sklepu: ${inst.name}`,
      body: `
        <div style="max-height:68vh; overflow-y:auto; padding-right:6px;">
          <div style="background:var(--bg-elevated); padding:12px; border-radius:6px; margin-bottom:16px; border:1px solid var(--border);">
            <div style="font-weight:600; font-size:0.85rem; color:var(--text-primary); margin-bottom:10px;">📌 Podstawowe & Typ połączenia</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              <div class="form-group" style="margin:0;"><label class="form-label">Nazwa instancji (sklepu) *</label><input class="form-input" id="sgi-name" value="${escHtml(inst.name || '')}"></div>
              <div class="form-group" style="margin:0;"><label class="form-label">Typ połączenia</label><select class="form-select" id="sgi-type"><option value="mysql" ${inst.connection_type!=='xml'?'selected':''}>MySQL (Zalecane)</option><option value="xml" ${inst.connection_type==='xml'?'selected':''}>Plik XML Feed</option></select></div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:10px;">
              <div class="form-group" style="margin:0;"><label class="form-label">URL Sklepu (opcjonalny)</label><input class="form-input" id="sgi-url" placeholder="https://sklep.pl" value="${escHtml(inst.shop_url || '')}"></div>
              <div class="form-group" style="margin:0;"><label class="form-label">URL Feedu XML</label><input class="form-input" id="sgi-feed" placeholder="https://sklep.pl/feed.xml" value="${escHtml(inst.xml_feed_url || '')}"></div>
            </div>
          </div>

          <div style="background:var(--bg-elevated); padding:12px; border-radius:6px; margin-bottom:16px; border:1px solid var(--border);">
            <div style="font-weight:600; font-size:0.85rem; color:var(--text-primary); margin-bottom:10px;">🗄️ Baza danych MySQL (ShopGold)</div>
            <div style="display:grid; grid-template-columns:3fr 1fr; gap:12px; margin-bottom:10px;">
              <div class="form-group" style="margin:0;"><label class="form-label">Host MySQL</label><input class="form-input" id="sgi-mhost" placeholder="localhost" value="${escHtml(inst.mysql_host || '')}"></div>
              <div class="form-group" style="margin:0;"><label class="form-label">Port</label><input class="form-input" id="sgi-mport" placeholder="3306" value="${escHtml(inst.mysql_port || '3306')}"></div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:10px;">
              <div class="form-group" style="margin:0;"><label class="form-label">Użytkownik MySQL</label><input class="form-input" id="sgi-muser" value="${escHtml(inst.mysql_user || '')}"></div>
              <div class="form-group" style="margin:0;"><label class="form-label">Hasło MySQL</label><input class="form-input" id="sgi-mpass" type="password" placeholder="Zostaw puste aby nie zmieniać"></div>
            </div>
            <div style="display:grid; grid-template-columns:2fr 1fr; gap:12px;">
              <div class="form-group" style="margin:0;"><label class="form-label">Nazwa bazy danych (MySQL Database) *</label><input class="form-input" id="sgi-mdata" value="${escHtml(inst.mysql_database || '')}"></div>
              <div class="form-group" style="margin:0;"><label class="form-label">Prefix tabel</label><input class="form-input" id="sgi-mpref" placeholder="sg_" value="${escHtml(inst.mysql_table_prefix || 'sg_')}"></div>
            </div>
          </div>

          <div style="background:var(--bg-elevated); padding:12px; border-radius:6px; border:1px solid var(--border);">
            <div style="font-weight:600; font-size:0.85rem; color:var(--text-primary); margin-bottom:10px;">📁 Serwer FTP (do przesyłania i pobierania zdjęć)</div>
            <div style="display:grid; grid-template-columns:3fr 1fr; gap:12px; margin-bottom:10px;">
              <div class="form-group" style="margin:0;"><label class="form-label">Host FTP</label><input class="form-input" id="sgi-fhost" value="${escHtml(inst.ftp_host || '')}"></div>
              <div class="form-group" style="margin:0;"><label class="form-label">Port FTP</label><input class="form-input" id="sgi-fport" placeholder="21" value="${escHtml(inst.ftp_port || '21')}"></div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:10px;">
              <div class="form-group" style="margin:0;"><label class="form-label">Użytkownik FTP</label><input class="form-input" id="sgi-fuser" value="${escHtml(inst.ftp_user || '')}"></div>
              <div class="form-group" style="margin:0;"><label class="form-label">Hasło FTP</label><input class="form-input" id="sgi-fpass" type="password" placeholder="Zostaw puste aby nie zmieniać"></div>
            </div>
            <div class="form-group" style="margin:0;"><label class="form-label">Ścieżka na serwerze FTP (np. /public_html)</label><input class="form-input" id="sgi-fpath" placeholder="/public_html" value="${escHtml(inst.ftp_path || '/public_html')}"></div>
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn--ghost btn--sm" onclick="Modal.hide()">Anuluj</button>
        <button class="btn btn--primary btn--sm" id="sgi-save-btn">💾 Zapisz zmiany</button>
      `
    });

    document.getElementById('sgi-save-btn').addEventListener('click', async () => {
      const name = document.getElementById('sgi-name').value.trim();
      const connection_type = document.getElementById('sgi-type').value;
      const shop_url = document.getElementById('sgi-url').value.trim();
      const xml_feed_url = document.getElementById('sgi-feed').value.trim();

      const mysql_host = document.getElementById('sgi-mhost').value.trim();
      const mysql_port = document.getElementById('sgi-mport').value.trim();
      const mysql_user = document.getElementById('sgi-muser').value.trim();
      const mysql_pass = document.getElementById('sgi-mpass').value;
      const mysql_database = document.getElementById('sgi-mdata').value.trim();
      const mysql_table_prefix = document.getElementById('sgi-mpref').value.trim();

      const ftp_host = document.getElementById('sgi-fhost').value.trim();
      const ftp_port = document.getElementById('sgi-fport').value.trim();
      const ftp_user = document.getElementById('sgi-fuser').value.trim();
      const ftp_pass = document.getElementById('sgi-fpass').value;
      const ftp_path = document.getElementById('sgi-fpath').value.trim();

      if (!name) {
        Toast.warn('Podaj nazwę instancji');
        return;
      }
      if (connection_type === 'mysql' && !mysql_database) {
        Toast.warn('Nazwa bazy danych MySQL jest wymagana przy połączeniu MySQL');
        return;
      }

      const body = {
        name, connection_type, shop_url, xml_feed_url,
        mysql_host, mysql_port, mysql_user, mysql_database, mysql_table_prefix,
        ftp_host, ftp_port, ftp_user, ftp_path
      };
      if (mysql_pass && mysql_pass.trim() !== '') body.mysql_pass = mysql_pass;
      if (ftp_pass && ftp_pass.trim() !== '') body.ftp_pass = ftp_pass;

      try {
        await API.put(`/settings/shopgold-instances/${id}`, body);
        Modal.hide();
        Toast.success('✅ Zapisano pomyślnie dane instancji: ' + name);
        await this.load();
      } catch(e) {
        Toast.error('Błąd zapisu danych instancji: ' + e.message);
      }
    });
  },

  async deleteShopgoldInstance(id) {
    const inst = this._shopgoldInstances?.find(x => x.id === id);
    if (!inst) return;
    if (!confirm(`Czy na pewno usunąć instancję "${inst.name}"?`)) return;
    try {
      await API.del(`/settings/shopgold-instances/${id}`);
      Toast.success('Usunięto instancję');
      await this.loadShopgoldInstances();
    } catch(e) {
      Toast.error('Błąd usuwania instancji: ' + e.message);
    }
  },

  async loadEsetSchedule() {
    const ind = document.getElementById('s-eset-sched-ind');
    const txt = document.getElementById('s-eset-sched-status');
    const btn = document.getElementById('s-eset-sched-toggle-btn');
    if (!ind || !txt || !btn) return;
    try {
      const status = await API.get('/eset/schedule/status');
      this._esetScheduleActive = status.enabled && status.running;
      if (this._esetScheduleActive) {
        ind.textContent = '🟢';
        txt.textContent = `Harmonogram ESET aktywny (${status.cron || 'co 15 min'})`;
        btn.textContent = 'Zatrzymaj harmonogram';
        btn.style.borderColor = 'var(--red)';
        btn.style.color = 'var(--red)';
      } else {
        ind.textContent = '🔴';
        txt.textContent = 'Harmonogram ESET zatrzymany';
        btn.textContent = '▶ Włącz harmonogram';
        btn.style.borderColor = 'var(--green)';
        btn.style.color = 'var(--green)';
      }
    } catch(e) {
      console.error('Błąd pobierania harmonogramu ESET w settings:', e);
    }
  },

  async toggleEsetScheduleInSettings() {
    const btn = document.getElementById('s-eset-sched-toggle-btn');
    const newState = !this._esetScheduleActive;
    if (btn) btn.disabled = true;
    try {
      await API.post('/eset/schedule/toggle', { enabled: newState });
      Toast.success(newState ? '✅ Włączono harmonogram ESET' : '🛑 Zatrzymano harmonogram ESET');
      await this.loadEsetSchedule();
      if (typeof window.loadEsetScheduleStatus === 'function') window.loadEsetScheduleStatus();
    } catch(e) {
      Toast.error('Błąd zmiany stanu harmonogramu: ' + e.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async triggerEsetSyncInSettings() {
    try {
      Toast.info('⏳ Sprawdzam zamówienia ESET w Sellasist...');
      const res = await API.post('/eset/schedule/trigger', {});
      Toast.success('✅ ' + (res.message || 'Synchronizacja zakończona'));
    } catch(e) {
      Toast.error('Błąd synchronizacji ESET: ' + e.message);
    }
  },

  async loadPresets() {
    try {
      const d = await API.get('/settings/presets');
      const list = document.getElementById('s-presets-list');
      if (!d.presets?.length) {
        list.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:12px 0">Brak presetów — zostanie utworzony domyślny po pierwszym uruchomieniu.</div>';
        return;
      }
      list.innerHTML = d.presets.map(p=>`
        <div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-sm);margin-bottom:8px;border:1px solid var(--border)"
             data-preset-id="${escHtml(p.id)}">
          <div style="flex:1">
            <span style="font-weight:500">${escHtml(p.name)}</span>
            ${p.is_default?'<span class="badge badge--blue" style="margin-left:8px">domyślny</span>':''}
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${fmtDate(p.created_at)}</div>
          </div>
          <button class="btn btn--ghost btn--sm s-edit-preset-btn" data-id="${escHtml(p.id)}">✏️ Edytuj</button>
        </div>`).join('');

      // Store presets for editing (avoid inline JSON in onclick)
      this._presets = d.presets;
    } catch(e) { console.error('Błąd ładowania presetów:', e); }
  },

  openEditPreset(id) {
    const p = this._presets?.find(x => x.id === id);
    if (!p) return;
    this._editingPresetId = p.id;
    document.getElementById('s-preset-editor-title').textContent = `✏️ Edytuj: ${p.name}`;
    document.getElementById('s-preset-editor').style.display = 'block';
    document.getElementById('s-preset-name').value = p.name || '';
    document.getElementById('s-preset-sys').value = p.system_prompt || '';
    document.getElementById('s-preset-user').value = p.user_prompt_template || '';
    document.getElementById('s-preset-editor').scrollIntoView({ behavior:'smooth', block:'start' });
  },

  _logsLevel: '',
  _logsPage: 0,

  async loadLogs(level, resetPage) {
    if (level !== undefined) this._logsLevel = level;
    if (resetPage) this._logsPage = 0;
    try {
      const search = document.getElementById('s-logs-search')?.value || '';
      const limit = 50;
      const offset = this._logsPage * limit;
      const params = new URLSearchParams({ limit, offset });
      if (this._logsLevel) params.set('level', this._logsLevel);
      if (search) params.set('action', search);

      const d = await API.get(`/settings/logs?${params}`);
      const tbody = document.getElementById('s-logs-tbody');
      const statsEl = document.getElementById('s-logs-stats');
      const pagEl = document.getElementById('s-logs-pagination');

      // Render stats
      if (statsEl) {
        statsEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--bg-elevated);border-radius:var(--radius-sm);border:1px solid var(--border)">
            <span style="font-size:1rem">📋</span>
            <span style="font-weight:700;font-size:1.1rem">${d.total||0}</span>
            <span style="font-size:.78rem;color:var(--text-muted)">logów</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(239,68,68,0.08);border-radius:var(--radius-sm);border:1px solid rgba(239,68,68,0.2)">
            <span style="font-size:1rem">🔴</span>
            <span style="font-weight:700;font-size:1.1rem;color:var(--red)">${d.errorCount||0}</span>
            <span style="font-size:.78rem;color:var(--text-muted)">błędów</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(34,197,94,0.08);border-radius:var(--radius-sm);border:1px solid rgba(34,197,94,0.2)">
            <span style="font-size:1rem">🟢</span>
            <span style="font-weight:700;font-size:1.1rem;color:var(--green)">${d.successCount||0}</span>
            <span style="font-size:.78rem;color:var(--text-muted)">sukces</span>
          </div>`;
      }

      if (!d.logs?.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">
          <div style="font-size:2rem;margin-bottom:8px">📭</div>
          <div style="font-size:.9rem;font-weight:600">Brak logów${this._logsLevel ? ' z poziomem: ' + this._logsLevel : ''}</div>
          <div style="font-size:.78rem;margin-top:4px">Logi pojawią się po operacjach synchronizacji, generowania AI i innych akcjach systemowych.</div>
        </td></tr>`;
        if (pagEl) pagEl.innerHTML = '';
        return;
      }

      tbody.innerHTML = d.logs.map(l => {
        // Level icon
        const lvl = l.level || (l.error ? 'error' : 'success');
        const levelIcon = lvl === 'error' ? '🔴' : lvl === 'success' ? '🟢' : lvl === 'warning' ? '🟡' : '🔵';
        const levelColor = lvl === 'error' ? 'var(--red)' : lvl === 'success' ? 'var(--green)' : 'var(--text-secondary)';

        // Action badge
        const actionLabel = l.action || '—';
        const actionClass = actionLabel === 'sync_approved' ? 'badge--approved' :
                           actionLabel === 'pim' ? 'badge--blue' :
                           actionLabel.includes('error') ? 'badge--rejected' : 'badge--draft';

        // Result parsing
        let resultStr = '';
        if (l.result) {
          try {
            const r = JSON.parse(l.result);
            if (typeof r === 'object' && r !== null) {
              resultStr = Object.entries(r).map(([k,v]) => `${k}: ${v}`).join(', ');
            } else {
              resultStr = String(l.result);
            }
          } catch {
            resultStr = String(l.result);
          }
        }

        // Error display (truncated with expand)
        let errorHtml = '';
        if (l.error) {
          const errStr = String(l.error);
          const truncated = errStr.length > 100 ? errStr.substring(0, 100) + '…' : errStr;
          errorHtml = `<span class="s-log-error-text" style="color:var(--red);cursor:${errStr.length > 100 ? 'pointer' : 'default'}" 
            ${errStr.length > 100 ? `title="Kliknij aby rozwinąć" onclick="this.textContent=this.dataset.full?this.dataset.short:this.dataset.fullText;this.dataset.full=this.dataset.full?'':'1'" data-short="${escHtml(truncated)}" data-full-text="${escHtml(errStr)}"` : ''}>⚠️ ${escHtml(truncated)}</span>`;
        } else {
          errorHtml = '<span style="color:var(--text-muted);font-size:.76rem">—</span>';
        }

        return `<tr style="border-left:3px solid ${levelColor}">
          <td style="text-align:center;font-size:1rem">${levelIcon}</td>
          <td><span class="badge ${actionClass}" style="font-size:.72rem">${escHtml(actionLabel)}</span></td>
          <td style="font-size:0.78rem;color:var(--text-secondary);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(resultStr)}">${escHtml(resultStr) || '<span style="color:var(--text-muted)">—</span>'}</td>
          <td style="font-size:0.78rem;max-width:250px">${errorHtml}</td>
          <td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${fmtDate(l.created_at)}</td>
        </tr>`;
      }).join('');

      // Pagination
      if (pagEl) {
        const showing = Math.min(offset + d.logs.length, d.total);
        pagEl.innerHTML = `
          <span>Wyświetlono ${offset + 1}–${showing} z ${d.total}</span>
          <div style="display:flex;gap:6px">
            ${this._logsPage > 0 ? `<button class="btn btn--ghost btn--sm" onclick="SettingsView._logsPage--;SettingsView.loadLogs()">← Poprzednia</button>` : ''}
            ${showing < d.total ? `<button class="btn btn--ghost btn--sm" onclick="SettingsView._logsPage++;SettingsView.loadLogs()">Następna →</button>` : ''}
          </div>`;
      }
    } catch(e) { console.warn(e); }
  },

  toggleConnectionSections(type) {
    document.getElementById('s-mysql-section').style.display = type==='mysql' ? 'block' : 'none';
    document.getElementById('s-xml-section').style.display   = type==='xml'   ? 'block' : 'none';
  },

  bindEvents() {
    // Tabs
    document.querySelectorAll('#settings-tabs .tab-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#settings-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`settings-tab-${btn.dataset.tab}`).classList.add('active');
        if(btn.dataset.tab==='logs')   this.loadLogs();
        if(btn.dataset.tab==='users')  { this.loadUsers(); this.loadUserLogs(); }
      });
    });

    // Users tab events (delegated)
    document.getElementById('s-add-user-btn')?.addEventListener('click', () => this.openUserModal());
    document.getElementById('s-users-tbody')?.addEventListener('click', e => {
      const editBtn = e.target.closest('[data-edit-user]');
      const delBtn  = e.target.closest('[data-del-user]');
      if (editBtn) { const u = JSON.parse(editBtn.dataset.editUser); this.openUserModal(u); }
      if (delBtn && confirm('Usunąć użytkownika?')) {
        API.del('/auth/users/'+delBtn.dataset.delUser).then(()=>{ Toast.success('Usunięto'); this.loadUsers(); }).catch(e=>Toast.error(e.message));
      }
    });
    document.getElementById('s-refresh-ulogs-btn')?.addEventListener('click', () => this.loadUserLogs());
    ['s-ulogs-user','s-ulogs-module','s-ulogs-co'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => this.loadUserLogs());
    });

    // Log filter buttons
    document.querySelectorAll('.s-log-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.s-log-filter-btn').forEach(b => {
          b.classList.remove('active');
          b.classList.add('btn--ghost');
        });
        btn.classList.add('active');
        btn.classList.remove('btn--ghost');
        this.loadLogs(btn.dataset.level, true);
      });
    });

    // Log search input (debounced)
    let logSearchTimer;
    document.getElementById('s-logs-search')?.addEventListener('input', () => {
      clearTimeout(logSearchTimer);
      logSearchTimer = setTimeout(() => this.loadLogs(undefined, true), 400);
    });

    // Save AI settings
    document.getElementById('s-save-ai-btn').addEventListener('click', async ()=>{
      setBtn('s-save-ai-btn', true);
      const body = {
        ai_provider: document.getElementById('s-ai-provider').value,
        openai_model: document.getElementById('s-openai-model').value,
        gemini_model: document.getElementById('s-gemini-model').value,
        anthropic_model: document.getElementById('s-anthropic-model').value,
        xai_model: document.getElementById('s-xai-model').value,
        deepseek_model: document.getElementById('s-deepseek-model').value,
        groq_model: document.getElementById('s-groq-model').value,
        mistral_model: document.getElementById('s-mistral-model').value,
      };
      
      const owuiModelSelect = document.getElementById('s-owui-model');
      if (owuiModelSelect) {
        body.owui_model = owuiModelSelect.value;
      }
      
      ['openai','gemini','anthropic','xai','deepseek','groq','mistral'].forEach(p => {
        const val = document.getElementById(`s-${p}-key`).value.trim();
        if (val) body[`${p}_api_key`] = val;
      });
      
      body.openai_base_url = document.getElementById('s-openai-baseurl').value.trim();
      try {
        await API.post('/settings', body);
        Toast.success('✅ Ustawienia AI zapisane!');
        // Clear key inputs and reload
        ['openai','gemini','anthropic','xai','deepseek','groq','mistral'].forEach(p => {
          document.getElementById(`s-${p}-key`).value = '';
        });
        await this.load();
        refreshStatus();
      } catch(e) { Toast.error(e.message); }
      finally { setBtn('s-save-ai-btn', false); }
    });

    // Connection type toggle
    document.getElementById('s-conn-type').addEventListener('change', e=>this.toggleConnectionSections(e.target.value));

    // Save new ShopGold instance
    document.getElementById('s-new-instance-btn')?.addEventListener('click', async () => {
      const name = prompt('Podaj nazwę dla tej konfiguracji (np. Sklep Ideał, Sklep Testowy):');
      if (!name || !name.trim()) return;
      const body = {
        name: name.trim(),
        connection_type: document.getElementById('s-conn-type').value,
        xml_feed_url: document.getElementById('s-xml-url').value,
        mysql_host: document.getElementById('s-mysql-host').value,
        mysql_port: document.getElementById('s-mysql-port').value,
        mysql_user: document.getElementById('s-mysql-user').value,
        mysql_pass: document.getElementById('s-mysql-pass').value,
        mysql_database: document.getElementById('s-mysql-db').value,
        mysql_table_prefix: document.getElementById('s-mysql-prefix').value,
        ftp_host: document.getElementById('s-ftp-host').value,
        ftp_port: document.getElementById('s-ftp-port').value,
        ftp_user: document.getElementById('s-ftp-user').value,
        ftp_pass: document.getElementById('s-ftp-pass').value,
        ftp_path: document.getElementById('s-ftp-path').value,
      };
      try {
        setBtn('s-new-instance-btn', true);
        await API.post('/settings/shopgold-instances', body);
        Toast.success(`✅ Zapisano nową instancję: ${name.trim()}`);
        await this.loadShopgoldInstances();
      } catch(e) { Toast.error(e.message); }
      finally { setBtn('s-new-instance-btn', false); }
    });

    // Update active ShopGold instance
    document.getElementById('s-update-active-inst-btn')?.addEventListener('click', async () => {
      if (!this._activeShopgoldInstId) return;
      try {
        setBtn('s-update-active-inst-btn', true);
        // First trigger regular save to apply to current runtime settings
        document.getElementById('s-save-conn-btn').click();
        await API.post(`/settings/shopgold-instances/${this._activeShopgoldInstId}/save-current`, {});
        Toast.success(`✅ Zaktualizowano instancję: ${this._activeShopgoldInstName}`);
        await this.loadShopgoldInstances();
      } catch(e) { Toast.error(e.message); }
      finally { setBtn('s-update-active-inst-btn', false); }
    });

    // ESET schedule toggle in settings
    document.getElementById('s-eset-sched-toggle-btn')?.addEventListener('click', () => this.toggleEsetScheduleInSettings());
    document.getElementById('s-eset-sync-now-btn')?.addEventListener('click', () => this.triggerEsetSyncInSettings());

    // Save connection
    document.getElementById('s-save-conn-btn').addEventListener('click', async ()=>{
      setBtn('s-save-conn-btn', true);
      const body = {
        connection_type: document.getElementById('s-conn-type').value,
        xml_feed_url: document.getElementById('s-xml-url').value,
        mysql_host: document.getElementById('s-mysql-host').value,
        mysql_port: document.getElementById('s-mysql-port').value,
        mysql_user: document.getElementById('s-mysql-user').value,
        mysql_database: document.getElementById('s-mysql-db').value,
        mysql_table_prefix: document.getElementById('s-mysql-prefix').value,
        ftp_host: document.getElementById('s-ftp-host').value,
        ftp_port: document.getElementById('s-ftp-port').value,
        ftp_user: document.getElementById('s-ftp-user').value,
        ftp_path: document.getElementById('s-ftp-path').value,
        sfera_server: document.getElementById('s-sfera-server').value,
        sfera_db: document.getElementById('s-sfera-db').value,
        sfera_user: document.getElementById('s-sfera-user').value,
        sfera_operator: document.getElementById('s-sfera-operator').value,
      };
      const mp = document.getElementById('s-mysql-pass').value;
      if(mp) body.mysql_pass = mp;
      const fp = document.getElementById('s-ftp-pass').value;
      if(fp) body.ftp_pass = fp;
      const sp = document.getElementById('s-sfera-pass').value;
      if(sp) body.sfera_pass = sp;
      const sop = document.getElementById('s-sfera-operator-pass').value;
      if(sop) body.sfera_operator_pass = sop;
      try {
        await API.post('/settings', body);
        Toast.success('✅ Ustawienia połączenia zapisane!');
        refreshStatus();
      } catch(e) { Toast.error(e.message); }
      finally { setBtn('s-save-conn-btn', false); }
    });

    // Test MySQL
    document.getElementById('s-test-mysql-btn').addEventListener('click', async ()=>{
      const r = document.getElementById('s-test-result');
      setBtn('s-test-mysql-btn', true);
      r.textContent = 'Testowanie...'; r.style.color = 'var(--text-muted)';
      try {
        const res = await API.post('/settings/test-connection', {});
        r.innerHTML = res.success
          ? `<span style="color:var(--green)">✅ ${escHtml(res.message)}</span>`
          : `<span style="color:var(--red)">❌ ${escHtml(res.message)}</span>`;
      } catch(e) {
        r.innerHTML = `<span style="color:var(--red)">❌ ${escHtml(e.message)}</span>`;
      }
      finally { setBtn('s-test-mysql-btn', false); }
    });

    // Test Sfera
    document.getElementById('s-test-sfera-btn').addEventListener('click', async ()=>{
      const r = document.getElementById('s-sfera-test-result');
      setBtn('s-test-sfera-btn', true);
      r.textContent = 'Trwa sprawdzanie połączenia ze Sferą (to może zająć kilka sekund)...'; r.style.color = 'var(--text-muted)';
      try {
        const payload = {
          server: document.getElementById('s-sfera-server').value,
          db: document.getElementById('s-sfera-db').value,
          user: document.getElementById('s-sfera-user').value,
          pass: document.getElementById('s-sfera-pass').value || window.currentSettings?.sfera_pass || '',
          operator: document.getElementById('s-sfera-operator').value,
          operator_pass: document.getElementById('s-sfera-operator-pass').value || window.currentSettings?.sfera_operator_pass || ''
        };
        const res = await API.post('/settings/test-sfera', payload);
        r.innerHTML = res.success
          ? `<span style="color:var(--green)">✅ ${escHtml(res.message)}</span>`
          : `<span style="color:var(--red)">❌ ${escHtml(res.message)}</span>`;
      } catch(e) {
        r.innerHTML = `<span style="color:var(--red)">❌ ${escHtml(e.message)}</span>`;
      }
      finally { setBtn('s-test-sfera-btn', false); }
    });

    // Save Open WebUI URL
    document.getElementById('s-save-owui-btn')?.addEventListener('click', async () => {
      setBtn('s-save-owui-btn', true);
      try {
        const owuiUrl = document.getElementById('s-owui-url').value.trim().replace(/\/+$/, '');
        const owuiApiKey = document.getElementById('s-owui-api-key').value.trim();
        const owuiModel = document.getElementById('s-owui-model')?.value || '';
        const body = { owui_url: owuiUrl, owui_model: owuiModel };
        if (owuiApiKey) body.owui_api_key = owuiApiKey;
        await API.post('/settings', body);
        Toast.success('✅ Ustawienia Open WebUI zapisane!');
        // If API key was set, we can use chats without re-login
        if (owuiApiKey) {
          Session.owuiToken = '__api_key__'; // marker that server-side key is configured
          Session.save();
        }
      } catch(e) { Toast.error(e.message); }
      finally { setBtn('s-save-owui-btn', false); }
    });

    // Test Open WebUI connection
    document.getElementById('s-test-owui-btn')?.addEventListener('click', async () => {
      const r = document.getElementById('s-owui-test-result');
      setBtn('s-test-owui-btn', true);
      r.textContent = 'Testowanie...'; r.style.color = 'var(--text-muted)';
      // Save URL first so the backend has it
      const owuiUrl = document.getElementById('s-owui-url').value.trim().replace(/\/+$/, '');
      const owuiApiKey = document.getElementById('s-owui-api-key').value.trim();
      try {
        const body = { owui_url: owuiUrl };
        if (owuiApiKey) body.owui_api_key = owuiApiKey;
        await API.post('/settings', body);
        const res = await API.post('/owui/test', {});
        r.innerHTML = res.ok
          ? `<span style="color:var(--green)">✅ ${escHtml(res.message)}</span>`
          : `<span style="color:var(--red)">❌ ${escHtml(res.message)}</span>`;
      } catch(e) {
        r.innerHTML = `<span style="color:var(--red)">❌ ${escHtml(e.message)}</span>`;
      }
      finally { setBtn('s-test-owui-btn', false); }
    });

    // Grafiker color picker sync
    document.getElementById('s-grafiker-color-picker')?.addEventListener('input', e => {
      document.getElementById('s-grafiker-color').value = e.target.value.toUpperCase();
    });
    document.getElementById('s-grafiker-color')?.addEventListener('input', e => {
      document.getElementById('s-grafiker-color-picker').value = e.target.value;
    });

    // Grafiker logo upload
    document.getElementById('s-grafiker-logo-file')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { Toast.error('Wybrany plik nie jest obrazem.'); return; }
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        const b64 = ev.target.result;
        document.getElementById('s-grafiker-logo-preview').style.backgroundImage = `url('${b64}')`;
        document.getElementById('s-grafiker-logo-remove').style.display = 'inline-block';
        SettingsView._grafikerLogoB64 = b64;
      };
      reader.readAsDataURL(file);
    });

    // Grafiker logo remove
    document.getElementById('s-grafiker-logo-remove')?.addEventListener('click', () => {
      document.getElementById('s-grafiker-logo-preview').style.backgroundImage = '';
      document.getElementById('s-grafiker-logo-remove').style.display = 'none';
      document.getElementById('s-grafiker-logo-file').value = '';
      SettingsView._grafikerLogoB64 = '';
    });

    // Save Grafiker
    document.getElementById('s-save-grafiker-btn')?.addEventListener('click', async () => {
      setBtn('s-save-grafiker-btn', true);
      try {
        const body = {
          grafiker_brand_color: document.getElementById('s-grafiker-color').value,
          grafiker_brand_font: document.getElementById('s-grafiker-font').value,
          grafiker_brand_logo_b64: SettingsView._grafikerLogoB64 || ''
        };
        const rbg = document.getElementById('s-grafiker-removebg').value.trim();
        if (rbg) body.grafiker_removebg_key = rbg;
        // if user cleared the key, we should allow deleting it, but the current backend logic only sets it if req.body[key] !== undefined.
        // Wait, if it's empty string, backend sets it to empty string. That's fine.

        await API.post('/settings', body);
        Toast.success('✅ Ustawienia Grafiker AI zapisane!');
        
        // Refresh local cache
        window.currentSettings = { ...window.currentSettings, ...body };
        
      } catch (e) {
        Toast.error(e.message);
      } finally {
        setBtn('s-save-grafiker-btn', false);
      }
    });

    const AI_FEATURES = [
      // ─── Katalog PIM ────────────────────────────────────
      { id: 'pim_generate',      label: '📋 Katalog: Generowanie opisów AI (PIM)' },
      { id: 'pim_standardize',   label: '📋 Katalog: Ujednolicanie atrybutów' },
      { id: 'pim_qa',            label: '💬 Katalog: Generowanie Q&A / FAQ produktów' },
      { id: 'pim_multicats',     label: '🏷️ Katalog: Sugestia kategorii (Multi-Kategorie)' },
      { id: 'pim_translate',     label: '🌍 Katalog: Tłumaczenie opisów produktów' },

      // ─── Grafiker ───────────────────────────────────────
      { id: 'grafiker_image',       label: '🖼️ Grafiker: Generowanie grafik AI' },
      { id: 'grafiker_marketplace', label: '🛒 Grafiker: Miniaturka Marketplace (Allegro)' },
      { id: 'grafiker_brandkit',    label: '🎨 Grafiker: Brand Kit & Watermark' },

      // ─── SEO ────────────────────────────────────────────
      { id: 'seo_analyzer',      label: '🔍 SEO: Analiza SERP' },
      { id: 'seo_meta',          label: '🔍 SEO: Generowanie Title i Meta' },
      { id: 'seo_content',       label: '🔍 SEO: Generowanie opisów SEO' },

      // ─── Bloger ─────────────────────────────────────────
      { id: 'blog_draft',        label: '✍️ Bloger: Pisanie artykułu' },
      { id: 'blog_outline',      label: '✍️ Bloger: Szkic / struktura artykułu' },
      { id: 'blog_social',       label: '✍️ Bloger: Posty Social Media' },

      // ─── Kampanie ───────────────────────────────────────
      { id: 'campaign_strategy', label: '📣 Kampanie: Strategia kampanii' },
      { id: 'campaign_ads',      label: '📣 Kampanie: Treści reklam (Ads/Social)' },
      { id: 'campaign_optimizer',label: '📣 Kampanie: Optymalizacja kampanii' },
      { id: 'campaign_email',    label: '📧 Mailer: Generowanie treści e-mail' },
      { id: 'campaign_subject',  label: '📧 Mailer: Tematy / Subject line' },

      // ─── Smart Sourcing ──────────────────────────────────
      { id: 'sourcing_commission',label: '⚡ Złoty Strzał: Kalkulacja prowizji' },
      { id: 'sourcing_category', label: '📦 Smart Sourcing: Mapowanie kategorii' },
      { id: 'sourcing_demand',   label: '📦 Smart Sourcing: Analiza popytu' },

      // ─── Profitability & Analiza ─────────────────────────
      { id: 'profit_forecast',   label: '📊 Rentowność: Prognoza sprzedaży AI' },
      { id: 'profit_pricing',    label: '📊 Rentowność: Sugestia ceny optymalnej' },

      // ─── Chat AI ────────────────────────────────────────
      { id: 'chat_default',      label: '🤖 Chat AI: Model domyślny (ogólny)' },
      { id: 'chat_assistant',    label: '🤖 Chat AI: Asystent sklepu' },
    ];

    let availableModels = [];

    async function loadModels() {
      try {
        const btn = document.getElementById('s-refresh-models-btn');
        if(btn) { btn.disabled = true; btn.textContent = '🔄 Ładowanie...'; }
        
        let modelsSet = new Set();
        
        // Native models from settings
        const s = window.currentSettings;
        if (s) {
          ['openai', 'gemini', 'anthropic', 'xai', 'deepseek', 'groq', 'mistral'].forEach(p => {
            const m = s[`${p}_model`];
            if (m) modelsSet.add(m);
          });
        }

        // Fetch from Open WebUI wrapper in our backend
        const res = await API.get('/owui/models');
        if (res.models && Array.isArray(res.models)) {
          res.models.forEach(m => modelsSet.add(m.id));
        } else {
          // Fallback to OpenAI models if Open WebUI not configured
          const openaiRes = await API.get('/chat/models').catch(() => ({}));
          if (openaiRes.models && Array.isArray(openaiRes.models)) {
            openaiRes.models.forEach(m => modelsSet.add(typeof m === 'string' ? m : m.id));
          }
        }
        
        availableModels = Array.from(modelsSet).sort();

        // Filter out embedding/vector models — they don't support chat completions
        const EMBED_KEYWORDS = ['bge','nomic-embed','embed','sentence-transformers','all-minilm','e5-','jina-embed','mxbai-embed','text-embedding','clip','whisper','rerank'];
        availableModels = availableModels.filter(m => {
          const ml = m.toLowerCase();
          return !EMBED_KEYWORDS.some(k => ml.includes(k));
        });
        
        const owuiModelSelect = document.getElementById('s-owui-model');
        if (owuiModelSelect) {
          const currentOwuiModel = window.currentSettings?.owui_model || '';
          owuiModelSelect.innerHTML = `
            <option value="" ${currentOwuiModel === '' ? 'selected' : ''}>-- Wybierz model --</option>
            ${availableModels.map(m => `<option value="${escHtml(m)}" ${currentOwuiModel === m ? 'selected' : ''}>${escHtml(m)}</option>`).join('')}
          `;
        }

        renderMappingContainer();
        if(btn) { btn.disabled = false; btn.textContent = '🔄 Odśwież listę modeli'; }
      } catch (err) {
        console.warn('Nie udało się pobrać modeli do mapowania:', err);
        const btn = document.getElementById('s-refresh-models-btn');
        if(btn) { btn.disabled = false; btn.textContent = '🔄 Błąd ładowania modeli'; }
      }
    }

    function renderMappingContainer() {
      const container = document.getElementById('s-ai-mapping-container');
      if (!container) return;
      container.innerHTML = '';
      
      for (const feat of AI_FEATURES) {
        const val = window.currentSettings ? window.currentSettings[`ai_map_${feat.id}`] || '' : '';
        
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
          <label class="form-label" style="font-size:0.8rem">${escHtml(feat.label)}</label>
          <select class="form-select s-ai-map-select" data-feature="${feat.id}">
            <option value="">-- Model Domyślny --</option>
            ${availableModels.map(m => `<option value="${escHtml(m)}" ${val === m ? 'selected' : ''}>${escHtml(m)}</option>`).join('')}
          </select>
        `;
        container.appendChild(div);
      }
    }

    document.getElementById('s-refresh-models-btn')?.addEventListener('click', loadModels);

    document.getElementById('s-save-mapping-btn')?.addEventListener('click', async () => {
      setBtn('s-save-mapping-btn', true);
      try {
        const body = {};
        document.querySelectorAll('.s-ai-map-select').forEach(select => {
          const feat = select.getAttribute('data-feature');
          const val = select.value;
          body[`ai_map_${feat}`] = val; // Always send, so empty clears it
        });
        await API.post('/settings', body);
        Toast.success('✅ Mapowania modeli zapisane!');
      } catch(e) { Toast.error(e.message); }
      finally { setBtn('s-save-mapping-btn', false); }
    });

    // Email Monitor settings
    document.getElementById('s-save-em-btn')?.addEventListener('click', async () => {
      setBtn('s-save-em-btn', true);
      try {
        const payload = {
          email_monitor_host: document.getElementById('s-em-host').value.trim(),
          email_monitor_port: document.getElementById('s-em-port').value.trim(),
          email_monitor_user: document.getElementById('s-em-user').value.trim(),
          email_monitor_folder: document.getElementById('s-em-folder').value.trim(),
          email_monitor_tls: document.getElementById('s-em-tls').value,
          email_monitor_subject_filter: document.getElementById('s-em-subj').value.trim(),
          email_monitor_cron: document.getElementById('s-em-cron').value,
          email_monitor_enabled: document.getElementById('s-em-enabled').checked ? '1' : '0',
        };
        const pass = document.getElementById('s-em-pass').value.trim();
        if (pass) payload.email_monitor_pass = pass;
        
        await API.post('/settings', payload);
        Toast.success('✅ Ustawienia Email Monitora zapisane!');
      } catch(e) { Toast.error(e.message); }
      finally { setBtn('s-save-em-btn', false); }
    });

    document.getElementById('s-test-em-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('s-test-em-btn');
      const resEl = document.getElementById('s-em-test-result');
      btn.disabled = true;
      resEl.innerHTML = 'Łączenie z serwerem IMAP... ⏳';
      try {
        const payload = {
          host: document.getElementById('s-em-host').value.trim(),
          port: document.getElementById('s-em-port').value.trim(),
          user: document.getElementById('s-em-user').value.trim(),
          folder: document.getElementById('s-em-folder').value.trim(),
          tls: document.getElementById('s-em-tls').value,
        };
        const pass = document.getElementById('s-em-pass').value.trim();
        if (pass) payload.pass = pass;
        
        const data = await API.post('/email-offers/test', payload);
        resEl.innerHTML = `<span style="color:var(--green)">✅ Połączenie OK! Wiadomości: ${data.messages} w folderze ${data.folder}</span>`;
      } catch(e) {
        resEl.innerHTML = `<span style="color:var(--red)">❌ ${e.message}</span>`;
      }
      btn.disabled = false;
    });

    // Save Sellasist API Key
    document.getElementById('s-save-sellasist-btn')?.addEventListener('click', async () => {
      setBtn('s-save-sellasist-btn', true);
      try {
        const key = document.getElementById('s-sellasist-api-key').value.trim();
        const acc = document.getElementById('s-sellasist-account').value.trim();
        const autoSync = document.getElementById('s-sellasist-auto-sync').checked ? '1' : '0';
        const body = { sellasist_account: acc, sellasist_auto_sync: autoSync };
        if (key) body.sellasist_api_key = key;
        await API.post('/settings', body);
        Toast.success('✅ Ustawienia Sellasist zapisane!');
      } catch(e) { Toast.error(e.message); }
      finally { setBtn('s-save-sellasist-btn', false); }
    });

    // Save External Apps (Integracje Tab)
    document.getElementById('s-save-extapps-btn')?.addEventListener('click', async () => {
      setBtn('s-save-extapps-btn', true);
      try {
        const su = document.getElementById('s-conn-service-url')?.value.trim() || '';
        const au = document.getElementById('s-conn-autoresponder-url')?.value.trim() || '';
        await API.post('/settings', { service_redirect_url: su, autoresponder_url: au });
        const sSys = document.getElementById('s-service-url'); if(sSys) sSys.value = su;
        const aSys = document.getElementById('s-autoresponder-url'); if(aSys) aSys.value = au;
        Toast.success('✅ Adresy IP i linki aplikacji zewnętrznych zapisane!');
      } catch(e) { Toast.error(e.message); }
      finally { setBtn('s-save-extapps-btn', false); }
    });

    // Test Sellasist Connection
    document.getElementById('s-test-sellasist-btn')?.addEventListener('click', async () => {
      const r = document.getElementById('s-sellasist-test-result');
      setBtn('s-test-sellasist-btn', true);
      r.textContent = 'Testowanie...'; r.style.color = 'var(--text-muted)';
      try {
        const key = document.getElementById('s-sellasist-api-key').value.trim();
        const acc = document.getElementById('s-sellasist-account').value.trim();
        if (!acc) { r.innerHTML = `<span style="color:var(--red)">❌ Podaj nazwę konta (subdomeny)</span>`; return; }
        // Save settings first so backend has them
        const saveBody = { sellasist_account: acc };
        if (key) saveBody.sellasist_api_key = key;
        await API.post('/settings', saveBody);
        // Test with POST (sends credentials explicitly)
        const testBody = { sellasist_account: acc };
        if (key) testBody.sellasist_api_key = key;
        const res = await API.post('/sellasist/test', testBody);
        r.innerHTML = res.ok
          ? `<span style="color:var(--green)">✅ ${escHtml(res.account)}${res.productsCount ? ` (${res.productsCount} produktów)` : ''}</span>`
          : `<span style="color:var(--red)">❌ ${escHtml(res.error || 'Błąd połączenia z API')}</span>`;
      } catch(e) {
        r.innerHTML = `<span style="color:var(--red)">❌ ${escHtml(e.message)}</span>`;
      }
      finally { setBtn('s-test-sellasist-btn', false); }
    });

    // Sync Sellasist Data
    document.getElementById('s-sync-sellasist-btn')?.addEventListener('click', async () => {
      const r = document.getElementById('s-sellasist-test-result');
      if (!confirm('Czy na pewno chcesz rozpocząć synchronizację danych z Sellasist? Może to potrwać kilka minut w zależności od liczby produktów.')) return;
      
      setBtn('s-sync-sellasist-btn', true);
      r.textContent = 'Uruchamianie synchronizacji...'; r.style.color = 'var(--text-muted)';
      try {
        const res = await API.post('/sellasist/sync', {});
        
        if (res.ok) {
          // Polling the status
          const checkStatus = async () => {
            try {
              const status = await API.get('/sellasist/sync-status');
              if (status.isRunning) {
                const pct = status.total ? Math.round((status.progress / status.total) * 100) : 0;
                r.innerHTML = `<span style="color:var(--text-muted)">⏳ Pobieranie z Sellasist... ${status.progress} / ${status.total} (${pct}%) — ${escHtml(status.message)}</span>`;
                setTimeout(checkStatus, 1500);
              } else {
                r.innerHTML = `<span style="color:var(--green)">✅ ${escHtml(status.message)}</span>`;
                setBtn('s-sync-sellasist-btn', false);
                
                Modal.show({
                  title: '✅ Synchronizacja z Sellasist zakończona',
                  body: `<div style="text-align:center;padding:20px;font-size:1.1rem;line-height:1.5;">${escHtml(status.message)}</div>`,
                  footer: `<button class="btn btn--primary" onclick="Modal.hide()">Zamknij</button>`
                });
              }
            } catch(e) {
              r.innerHTML = `<span style="color:var(--red)">❌ Utracono połączenie: ${escHtml(e.message)}</span>`;
              setBtn('s-sync-sellasist-btn', false);
            }
          };
          
          checkStatus();
        } else {
          r.innerHTML = `<span style="color:var(--red)">❌ ${escHtml(res.message || res.error || 'Błąd synchronizacji')}</span>`;
          setBtn('s-sync-sellasist-btn', false);
        }
      } catch(e) {
        r.innerHTML = `<span style="color:var(--red)">❌ ${escHtml(e.message)}</span>`;
        setBtn('s-sync-sellasist-btn', false);
      }
    });

    // New preset
    document.getElementById('s-new-preset-btn').addEventListener('click', ()=>{
      this._editingPresetId = null;
      document.getElementById('s-preset-editor-title').textContent = '➕ Nowy preset';
      document.getElementById('s-preset-editor').style.display = 'block';
      document.getElementById('s-preset-name').value = '';
      document.getElementById('s-preset-sys').value = '';
      document.getElementById('s-preset-user').value = '';
      document.getElementById('s-preset-editor').scrollIntoView({ behavior:'smooth' });
    });

    // Edit preset — event delegation (avoids inline JSON in onclick)
    document.getElementById('s-presets-list').addEventListener('click', e=>{
      const btn = e.target.closest('.s-edit-preset-btn');
      if(btn) this.openEditPreset(btn.dataset.id);
    });

    // Cancel preset
    document.getElementById('s-cancel-preset-btn').addEventListener('click', ()=>{
      document.getElementById('s-preset-editor').style.display = 'none';
      this._editingPresetId = null;
    });

    // Save preset
    document.getElementById('s-save-preset-btn').addEventListener('click', async ()=>{
      const name = document.getElementById('s-preset-name').value.trim();
      if (!name) return Toast.warn('Podaj nazwę presetu');
      const body = {
        name,
        system_prompt: document.getElementById('s-preset-sys').value,
        user_prompt_template: document.getElementById('s-preset-user').value,
      };
      if (this._editingPresetId) body.id = this._editingPresetId;
      setBtn('s-save-preset-btn', true);
      try {
        await API.post('/settings/presets', body);
        Toast.success(`✅ Preset "${name}" zapisany`);
        document.getElementById('s-preset-editor').style.display = 'none';
        this._editingPresetId = null;
        await this.loadPresets();
      } catch(e) { Toast.error(e.message); }
      finally { setBtn('s-save-preset-btn', false); }
    });
  },

  systemTabHtml() {
    return `
    <div class="tab-panel" id="settings-tab-system">
      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="margin-bottom:16px">📦 Informacje o programie</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
          <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:16px;text-align:center">
            <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:4px">Wersja</div>
            <div style="font-size:1.4rem;font-weight:700;color:var(--accent-light)" id="sys-version">${window.APP_VERSION || '?'}</div>
          </div>
          <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:16px;text-align:center">
            <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:4px">Nazwa</div>
            <div style="font-size:.9rem;font-weight:600;color:var(--text-primary)">IdealPC AI Dashboard</div>
          </div>
          <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:16px;text-align:center">
            <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:4px">Firma aktywna</div>
            <div style="font-size:.9rem;font-weight:600;color:var(--text-primary)">${escHtml(Session.companyNames[Session.company] || Session.company)}</div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="margin-bottom:16px">🔗 Adresy IP i linki do aplikacji zewnętrznych</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label class="form-label">🛠️ Adres IP / URL Serwisu</label>
            <input class="form-input" id="s-service-url" type="text" placeholder="np. http://192.168.1.50:8080 lub https://serwis.idealpc.pl">
            <div class="form-hint">Po kliknięciu zakładki "Serwis" w menu, zostaniesz przekierowany pod ten adres.</div>
          </div>
          <div class="form-group">
            <label class="form-label">🤖 Adres IP / URL Autorespondera</label>
            <input class="form-input" id="s-autoresponder-url" type="text" placeholder="np. http://192.168.1.50:4000 lub http://localhost:4000">
            <div class="form-hint">Domyślnie: http://localhost:4000/</div>
          </div>
        </div>
        <button class="btn btn--primary" id="s-save-system-btn" style="margin-top:8px">💾 Zapisz linki i adresy IP</button>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="margin-bottom:16px">💾 Archiwizacja bazy danych</div>
        <p style="font-size:.82rem;color:var(--text-secondary);margin-bottom:16px">
          Utwórz kopię zapasową wszystkich baz danych (produkty, ustawienia, hurtownie, logi) w pliku ZIP.
          Możesz później przywrócić bazę z tego pliku.
        </p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn btn--primary" id="sys-backup-btn">
            📦 Pobierz kopię zapasową
          </button>
          <button class="btn btn--ghost" id="sys-restore-btn">
            📂 Przywróć z kopii zapasowej
          </button>
          <input type="file" id="sys-restore-file" accept=".zip" style="display:none">
        </div>
        <div id="sys-restore-result" style="margin-top:10px;font-size:.82rem"></div>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:16px">🔄 Aktualizacje</div>
        <p style="font-size:.82rem;color:var(--text-secondary);margin-bottom:16px">
          Aby zaktualizować program, pobierz najnowszą wersję z repozytorium lub skontaktuj się z administratorem.
        </p>
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:.82rem;color:var(--text-muted)">Aktualna wersja: <strong style="color:var(--accent-light)">v${window.APP_VERSION || '?'}</strong></span>
        </div>
      </div>
    </div>
    `;
  },

  bindSystemEvents() {
    const backupBtn = document.getElementById('sys-backup-btn');
    const restoreBtn = document.getElementById('sys-restore-btn');
    const restoreFile = document.getElementById('sys-restore-file');
    const resultEl = document.getElementById('sys-restore-result');

    if (backupBtn) {
      backupBtn.addEventListener('click', async () => {
        setBtn('sys-backup-btn', true);
        try {
          await API.download('/settings/backup', 'shopgold-backup.zip');
          Toast.success('Pobieranie rozpoczęte');
        } catch(e) {
          Toast.error('Błąd pobierania: ' + e.message);
        }
        setBtn('sys-backup-btn', false);
      });
    }

    if (restoreBtn && restoreFile) {
      restoreBtn.addEventListener('click', () => restoreFile.click());
      restoreFile.addEventListener('change', async () => {
        if (!restoreFile.files[0]) return;
        if (!confirm('Czy na pewno chcesz przywrócić bazę danych z kopii zapasowej?\nAktualne dane zostaną nadpisane!')) {
          restoreFile.value = '';
          return;
        }
        const fd = new FormData();
        fd.append('backup', restoreFile.files[0]);
        if (resultEl) resultEl.innerHTML = '<span style="color:var(--text-muted)">⏳ Przywracanie...</span>';
        try {
          const r = await API.upload('/settings/restore', fd);
          if (resultEl) resultEl.innerHTML = `<span style="color:#4ade80">✅ ${escHtml(r.message)}</span>`;
          Toast.success(r.message);
        } catch (e) {
          if (resultEl) resultEl.innerHTML = `<span style="color:#f87171">❌ ${escHtml(e.message)}</span>`;
          Toast.error(e.message);
        }
        restoreFile.value = '';
      });
    }

    const saveSysBtn = document.getElementById('s-save-system-btn');
    if (saveSysBtn) {
      saveSysBtn.addEventListener('click', async () => {
        setBtn('s-save-system-btn', true);
        try {
          const su = document.getElementById('s-service-url')?.value.trim() || '';
          const au = document.getElementById('s-autoresponder-url')?.value.trim() || '';
          await API.post('/settings', { service_redirect_url: su, autoresponder_url: au });
          const csu = document.getElementById('s-conn-service-url'); if(csu) csu.value = su;
          const cau = document.getElementById('s-conn-autoresponder-url'); if(cau) cau.value = au;
          Toast.success('✅ Adresy IP i linki aplikacji zapisane!');
        } catch(e) { Toast.error(e.message); }
        finally { setBtn('s-save-system-btn', false); }
      });
    }
  },
};
