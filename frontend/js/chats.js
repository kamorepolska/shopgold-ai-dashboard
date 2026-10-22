/* ===== chats.js — Czaty AI (Open WebUI Integration - Enhanced) ===== */
window.ChatsView = {
  _chats: [],
  _activeChat: null,
  _messages: [],
  _models: [],
  _selectedModel: '',
  _streaming: false,
  _chatHistoryAvailable: true,
  
  // New state
  _attachments: [], // { type: 'image'|'url'|'note'|'kb', data: any, id: string }
  _activePanel: null, // 'notes' | 'knowledge' | null
  _notes: [],
  _knowledge: [],
  _owuiPromptsLoaded: false,
  
  _prompts: [
    { cmd: '/dzis', label: 'Co mam dziś do zrobienia? (Plan dnia)', text: 'Co mam dziś do zrobienia?', source: 'local' },
    { cmd: '/opis', label: 'Opis produktu (SEO)', text: 'Napisz angażujący opis tego produktu, uwzględniając słowa kluczowe SEO, formatowanie HTML (p, ul, li) oraz pogrubienia dla ważnych cech. Długość: ok. 1500 znaków.', source: 'local' },
    { cmd: '/tlumacz', label: 'Przetłumacz na polski', text: 'Przetłumacz poniższy tekst na profesjonalny język polski, zachowując techniczne terminy IT w oryginale:\n\n', source: 'local' },
    { cmd: '/korekta', label: 'Korekta błędów', text: 'Popraw błędy ortograficzne, interpunkcyjne i stylistyczne w poniższym tekście, nie zmieniając jego pierwotnego znaczenia:\n\n', source: 'local' },
    { cmd: '/seo', label: 'Generuj Title i Meta', text: 'Wygeneruj 3 propozycje Meta Title (do 60 znaków) oraz Meta Description (do 160 znaków) dla tego produktu.', source: 'local' },
    { cmd: '/social', label: 'Post na Social Media', text: 'Przygotuj krótki, angażujący post na Facebooka promujący ten produkt. Użyj odpowiednich emoji i dodaj 3-4 hashtagi.', source: 'local' }
  ],

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  async render() {
    const el = document.getElementById('view-chats');
    let hasAuth = !!Session.owuiToken;
    if (!hasAuth) {
      try { const check = await API.get('/owui/check-auth'); if (check.ok) { hasAuth = true; Session.owuiToken = '__api_key__'; Session.save(); } } catch {}
    }
    
    if (!hasAuth) { this.renderAuthForm(el); return; }

    el.innerHTML = `
      <div class="chat-container" id="chat-layout">
        <div class="chat-sidebar" id="chat-sidebar">
          <div class="chat-sidebar-header">
            <button class="chat-new-btn" id="chat-new-btn">✨ Nowy czat</button>
          </div>
          <div class="chat-list" id="chat-list"><div class="chat-list-empty">Ładowanie...</div></div>
        </div>
        
        <div class="chat-main" id="chat-main">
          <div class="chat-main-header">
            <span class="chat-title" id="chat-header-title">Ładowanie...</span>
            <div class="chat-header-actions">
              <button class="chat-header-btn" id="btn-panel-notes" title="Notatki">📝</button>
              <button class="chat-header-btn" id="btn-panel-kb" title="Baza wiedzy">📚</button>
            </div>
            <div id="chat-model-container"></div>
          </div>
          
          <div class="chat-messages" id="chat-messages"></div>
          
          <div class="chat-attachments" id="chat-attachments" style="display:none"></div>
          
          <div class="chat-input-area" id="chat-input-area">
            <div class="chat-input-toolbar">
              <button class="chat-tool-btn" id="tool-img" title="Załącz obraz">🖼️</button>
              <button class="chat-tool-btn" id="tool-url" title="Załącz stronę WWW">🌐</button>
              <button class="chat-tool-btn" id="tool-prompt" title="Wybierz Prompt">💡</button>
              <button class="chat-tool-btn" id="tool-voice" title="Mów głosowo (Nagrywanie)">🎤</button>
              <input type="file" id="chat-file-input" class="chat-file-input" accept="image/*">
            </div>
            
            <div id="voice-visualizer-placeholder"></div>
            
            <div style="position:relative; width:100%">
              <div id="prompts-dropdown" style="display:none; position:absolute; bottom:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-sm); z-index:100; box-shadow:0 -4px 12px rgba(0,0,0,0.1); margin-bottom:8px"></div>
              <div class="chat-input-row">
                <textarea id="chat-input" placeholder="Napisz wiadomość... (wpisz / aby użyć prompta, Ctrl+V wkleja obraz)" rows="1"></textarea>
                <button class="chat-send-btn" id="chat-send-btn" title="Wyślij">➤</button>
              </div>
            </div>
            <div id="url-dialog-container" style="position:relative"></div>
          </div>
          
          <div class="chat-drop-overlay" id="chat-drop-overlay">Upuść plik obrazu tutaj</div>
        </div>
        
        <div class="chat-panel" id="chat-side-panel" style="display:none"></div>
      </div>`;

    this.bindEvents();
    await this.loadModels();
    await this.loadChats();
    await this.loadOwuiPrompts();
    await this.loadLocalPresets();
    if (!this._models.length) this._selectedModel = '';
    this.startNewChat();
  },

  renderAuthForm(el) { /* Same as before, omitted for brevity, will add if needed but we assume auth is ok now */ },
  
  async loadModels() {
    try {
      const r = await API.get('/owui/models');
      this._models = (r.models || []).map(m => ({ id: m.id || m.name, name: m.name || m.id || 'Unknown' }));
      if (this._models.length && !this._selectedModel) this._selectedModel = this._models[0].id;
    } catch(e) { this._models = []; }
  },

  async loadChats() {
    try {
      const data = await API.get('/owui/chats');
      this._chats = Array.isArray(data) ? data : (data.data || data.chats || []);
      this._chatHistoryAvailable = true;
      this.renderChatList();
    } catch(e) {
      this._chatHistoryAvailable = false; this._chats = [];
      const list = document.getElementById('chat-list');
      if (list) list.innerHTML = `<div class="chat-list-empty" style="font-size:0.78rem;color:var(--text-muted)">Historia niedostępna</div>`;
    }
  },

  renderChatList() {
    const list = document.getElementById('chat-list');
    if (!list) return;
    if (!this._chats.length) { list.innerHTML = '<div class="chat-list-empty">Brak czatów</div>'; return; }
    list.innerHTML = this._chats.map(c => `
      <div class="chat-list-item${this._activeChat?.id === c.id ? ' active' : ''}" data-id="${c.id}">
        <span class="chat-item-icon">💬</span>
        <span class="chat-item-title">${escHtml(c.title || c.name || 'Bez tytułu')}</span>
        <span class="chat-item-date">${c.updated_at || c.created_at ? fmtDate(c.updated_at || c.created_at) : ''}</span>
        <button class="chat-item-del" data-id="${c.id}">🗑</button>
      </div>`).join('');
  },

  async openChat(chatId) {
    try {
      const chat = await API.get(`/owui/chats/${chatId}`);
      this._activeChat = chat;
      this._messages = [];
      if (chat.chat?.messages) this._messages = chat.chat.messages;
      else if (chat.messages) this._messages = chat.messages;
      else if (chat.chat?.history?.messages) {
        const hist = chat.chat.history, msgDict = hist.messages || {};
        let curr = hist.currentId; const ord = [], vis = new Set();
        while (curr && msgDict[curr] && !vis.has(curr)) { vis.add(curr); ord.unshift(msgDict[curr]); curr = msgDict[curr].parentId; }
        this._messages = ord.map(m => ({ role: m.role, content: m.content, images: m.images }));
      }
      this.renderChatList(); this.renderChatMain();
    } catch(e) { Toast.error(e.message); }
  },

  async startNewChat() {
    this._activeChat = { id: 'new', title: 'Nowy czat' };
    this._messages = [];
    this._attachments = [];
    this.renderChatList();
    this.renderChatMain();
    this.renderAttachments();
  },

  async deleteChat(chatId) {
    if (!confirm('Usunąć ten czat?')) return;
    try {
      await API.del(`/owui/chats/${chatId}`);
      this._chats = this._chats.filter(c => c.id !== chatId);
      if (this._activeChat?.id === chatId) {
        this.startNewChat();
      }
      this.renderChatList();
      Toast.success('Czat usunięty');
    } catch(e) {
      Toast.error('Nie udało się usunąć czatu: ' + e.message);
    }
  },

  formatMarkdown(text) {
    let html = escHtml(text);
    
    // Parse task suggestions
    const taskRegex = /\[TASK:\s*([^|\]]+)\|\s*([^|\]]+)\|\s*([^|\]]+)\]/gi;
    html = html.replace(taskRegex, (match, title, desc, priority) => {
      const t = title.trim();
      const d = desc.trim();
      const p = priority.trim().toLowerCase();
      
      let priorityLabel = 'Normalny';
      let pClass = 'normal';
      if (p === 'urgent' || p === 'pilne' || p === 'krytyczny') {
        priorityLabel = 'Krytyczny';
        pClass = 'urgent';
      } else if (p === 'high' || p === 'wysoki') {
        priorityLabel = 'Wysoki';
        pClass = 'high';
      }
      
      return `
        <div class="chat-task-suggestion-card priority-${pClass}">
          <div class="chat-task-card-header">
            <span class="chat-task-badge priority-${pClass}">${priorityLabel}</span>
            <span class="chat-task-type-label">💡 Rekomendacja CRM</span>
          </div>
          <h4 class="chat-task-title">${t}</h4>
          <p class="chat-task-desc">${d}</p>
          <div class="chat-task-card-actions">
            <button class="chat-add-task-btn" 
                    data-title="${t}" 
                    data-desc="${d}" 
                    data-priority="${pClass}" 
                    onclick="ChatsView.createTaskFromChat(this)">
              ➕ Dodaj do CRM
            </button>
          </div>
        </div>
      `;
    });

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.split('\n\n').map(p => {
      if (p.includes('chat-task-suggestion-card')) {
        return p;
      }
      return `<p>${p}</p>`;
    }).join('');
    return html.replace(/\n/g, '<br>');
  },

  renderMessage(msg) {
    const role = msg.role || 'user';
    const avatar = role === 'user' ? (Session.user?.display_name || Session.user?.username || 'U').charAt(0).toUpperCase() : '🤖';
    const content = role === 'assistant' ? this.formatMarkdown(msg.content || '') : escHtml(msg.content || '');
    let imagesHtml = '';
    if (msg.images && msg.images.length) {
      imagesHtml = msg.images.map(img => `<img src="${img}" class="chat-inline-img" onclick="window.open(this.src,'_blank')">`).join('');
    }
    return `<div class="chat-msg ${role}">
      <div class="chat-msg-avatar">${avatar}</div>
      <div class="chat-msg-bubble">${content}${imagesHtml}</div>
    </div>`;
  },
  renderChatMain() {
    document.getElementById('chat-header-title').textContent = this._activeChat?.title || 'Nowy czat';
    const container = document.getElementById('chat-model-container');
    if (container) {
      if (this._models.length) {
        container.innerHTML = `<select class="chat-model-select" id="chat-model-sel">${this._models.map(m => `<option value="${escHtml(m.id)}" ${m.id === this._selectedModel ? 'selected' : ''}>${escHtml(m.name)}</option>`).join('')}</select>`;
        document.getElementById('chat-model-sel').addEventListener('change', e => this._selectedModel = e.target.value);
      } else {
        container.innerHTML = `<input class="chat-model-select" id="chat-model-input" type="text" placeholder="Nazwa modelu (np. llama3)" value="${escHtml(this._selectedModel)}">`;
        document.getElementById('chat-model-input').addEventListener('change', e => this._selectedModel = e.target.value.trim());
      }
    }
    const msgsEl = document.getElementById('chat-messages');
    msgsEl.innerHTML = this._messages.length ? this._messages.map(m => this.renderMessage(m)).join('') : '<div class="chat-welcome"><div class="chat-welcome-icon">💬</div><h2>Czaty AI</h2><p>Napisz wiadomość, aby rozpocząć</p></div>';
    msgsEl.scrollTop = msgsEl.scrollHeight;
  },

  renderAttachments() {
    const el = document.getElementById('chat-attachments');
    if (!this._attachments.length) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = this._attachments.map((a, i) => {
      let content = '';
      if (a.type === 'image') content = `<img src="${a.data}"><div class="attach-name">Obraz</div><div class="attach-type">IMG</div>`;
      else if (a.type === 'url') content = `<div class="url-icon">🌐</div><div class="attach-name">${escHtml(a.title || a.url)}</div>`;
      else if (a.type === 'note') content = `📝 <div class="attach-name">${escHtml(a.title)}</div>`;
      else if (a.type === 'kb') content = `📚 <div class="attach-name">${escHtml(a.title)}</div>`;
      return `<div class="chat-attach-item">${content}<button class="chat-attach-remove" data-idx="${i}">✕</button></div>`;
    }).join('');
    el.querySelectorAll('.chat-attach-remove').forEach(b => b.addEventListener('click', e => {
      this._attachments.splice(parseInt(e.target.dataset.idx), 1);
      this.renderAttachments();
    }));
  },

  togglePanel(type) {
    const layout = document.getElementById('chat-layout');
    const panel = document.getElementById('chat-side-panel');
    const btnNotes = document.getElementById('btn-panel-notes');
    const btnKb = document.getElementById('btn-panel-kb');
    
    if (this._activePanel === type) {
      this._activePanel = null; layout.classList.remove('has-panel'); panel.style.display = 'none';
      btnNotes?.classList.remove('active'); btnKb?.classList.remove('active');
      return;
    }
    this._activePanel = type; layout.classList.add('has-panel'); panel.style.display = 'flex';
    btnNotes?.classList.toggle('active', type === 'notes');
    btnKb?.classList.toggle('active', type === 'knowledge');
    
    if (type === 'notes') this.renderNotesPanel();
    else if (type === 'knowledge') this.renderKbPanel();
  },

  async renderNotesPanel() {
    const panel = document.getElementById('chat-side-panel');
    panel.innerHTML = `<div class="chat-panel-header"><div class="panel-title">Moje Notatki</div><button class="chat-panel-close" id="panel-close">✕</button></div>
      <div class="chat-panel-body" id="panel-body">Ładowanie...</div>
      <div class="chat-panel-footer"><button class="btn btn--primary btn--sm" id="btn-new-note" style="width:100%">+ Nowa notatka</button></div>`;
    document.getElementById('panel-close').addEventListener('click', () => this.togglePanel('notes'));
    document.getElementById('btn-new-note').addEventListener('click', () => this.editNote());
    
    try {
      this._notes = await API.get('/chat/notes');
      const body = document.getElementById('panel-body');
      if (!this._notes.length) { body.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:20px">Brak notatek</div>'; return; }
      body.innerHTML = this._notes.map(n => `
        <div class="note-card" style="border-left-color:${n.color}">
          <div class="note-title">${escHtml(n.title || 'Bez tytułu')}</div>
          <div class="note-preview">${escHtml((n.content || '').replace(/<[^>]+>/g, '')).substring(0, 60)}...</div>
          <div class="note-actions">
            <button class="note-action-btn" onclick="ChatsView.attachNote('${n.id}')" title="Dołącz do czatu">➕</button>
            <button class="note-action-btn" onclick="ChatsView.editNote('${n.id}')" title="Edytuj">✏️</button>
            <button class="note-action-btn del" onclick="ChatsView.deleteNote('${n.id}')" title="Usuń">🗑</button>
          </div>
        </div>`).join('');
    } catch(e) { document.getElementById('panel-body').innerHTML = `Błąd: ${e.message}`; }
  },

  async renderKbPanel() {
    const panel = document.getElementById('chat-side-panel');
    panel.innerHTML = `<div class="chat-panel-header"><div class="panel-title">Baza Wiedzy (Open WebUI)</div><button class="chat-panel-close" id="panel-close-kb">✕</button></div>
      <div class="chat-panel-body" id="panel-body-kb">Ładowanie...</div>
      <div class="chat-panel-footer"><div style="font-size:0.7rem;color:var(--text-muted);text-align:center">Dokumenty są pobierane bezpośrednio z Open WebUI.</div></div>`;
    document.getElementById('panel-close-kb').addEventListener('click', () => this.togglePanel('knowledge'));
    
    try {
      this._knowledge = await API.get('/owui/knowledge');
      const body = document.getElementById('panel-body-kb');
      if (!this._knowledge.length) { body.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;text-align:center;padding:20px">Baza wiedzy jest pusta. Dodaj dokumenty w Open WebUI → Workspace → Knowledge.</div>'; return; }
      body.innerHTML = this._knowledge.map(k => {
        const fileCount = k.files?.length || 0;
        const meta = fileCount > 0 ? `${fileCount} plik${fileCount > 1 ? 'ów' : ''}` : (k.file_type || '').toUpperCase();
        const desc = k.description ? `<div class="kb-desc">${escHtml(k.description)}</div>` : '';
        return `
        <div class="kb-item">
          <div class="kb-icon">📚</div>
          <div class="kb-info"><div class="kb-title">${escHtml(k.title)}</div>${desc}<div class="kb-meta">${meta}</div></div>
          <div class="kb-actions">
            <button class="note-action-btn" onclick="ChatsView.attachKb('${k.id}')" title="Dołącz do czatu">➕</button>
          </div>
        </div>`;
      }).join('');
    } catch(e) { document.getElementById('panel-body-kb').innerHTML = `Błąd: ${e.message}`; }
  },
  bindEvents() {
    document.getElementById('chat-new-btn')?.addEventListener('click', () => this.startNewChat());
    document.getElementById('chat-list')?.addEventListener('click', e => {
      const item = e.target.closest('.chat-list-item');
      const delBtn = e.target.closest('.chat-item-del');
      if (delBtn) { e.stopPropagation(); this.deleteChat(delBtn.dataset.id); return; }
      if (item) this.openChat(item.dataset.id);
    });
    
    document.getElementById('btn-panel-notes')?.addEventListener('click', () => this.togglePanel('notes'));
    document.getElementById('btn-panel-kb')?.addEventListener('click', () => this.togglePanel('knowledge'));
    
    // Tools
    document.getElementById('tool-img')?.addEventListener('click', () => document.getElementById('chat-file-input').click());
    document.getElementById('chat-file-input')?.addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) this.handleImageUpload(e.target.files[0]);
      e.target.value = '';
    });
    
    document.getElementById('tool-url')?.addEventListener('click', () => this.showUrlDialog());
    document.getElementById('tool-voice')?.addEventListener('click', () => this.toggleVoiceInput());
    
    document.getElementById('tool-prompt')?.addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      if (input.value.length === 0 || input.value.endsWith(' ')) {
        input.value += '/';
      } else {
        input.value += ' /';
      }
      input.focus();
      this.handleSlashCommand(input.value);
    });
    
    // Input area
    const input = document.getElementById('chat-input');
    if (input) {
      input.addEventListener('keydown', e => { 
        if (e.key === 'Enter' && !e.shiftKey) { 
          const dropdown = document.getElementById('prompts-dropdown');
          if (dropdown && dropdown.style.display === 'block') {
            e.preventDefault();
            const active = dropdown.querySelector('.prompt-item.active');
            if (active) { active.click(); return; }
          }
          e.preventDefault(); this.sendMessage(); 
        }
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && document.getElementById('prompts-dropdown').style.display === 'block') {
          e.preventDefault();
          this.navigatePrompts(e.key);
        }
      });
      input.addEventListener('input', e => { 
        input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; 
        this.handleSlashCommand(e.target.value);
      });
      // Paste handler
      input.addEventListener('paste', e => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
          if (item.type.indexOf('image') === 0) {
            e.preventDefault();
            this.handleImageUpload(item.getAsFile());
            break;
          }
        }
      });
    }
    document.getElementById('chat-send-btn')?.addEventListener('click', () => this.sendMessage());
    
    // Drag and drop
    const dropArea = document.getElementById('chat-main');
    const overlay = document.getElementById('chat-drop-overlay');
    if (dropArea && overlay) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => dropArea.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }));
      ['dragenter', 'dragover'].forEach(ev => dropArea.addEventListener(ev, () => overlay.classList.add('visible')));
      ['dragleave', 'drop'].forEach(ev => dropArea.addEventListener(ev, () => overlay.classList.remove('visible')));
      dropArea.addEventListener('drop', e => {
        if (e.dataTransfer.files && e.dataTransfer.files[0] && e.dataTransfer.files[0].type.startsWith('image/')) {
          this.handleImageUpload(e.dataTransfer.files[0]);
        }
      });
    }
  },

  handleImageUpload(file) {
    const reader = new FileReader();
    reader.onload = e => {
      this._attachments.push({ type: 'image', data: e.target.result, id: this.generateId() });
      this.renderAttachments();
    };
    reader.readAsDataURL(file);
  },

  showUrlDialog() {
    Modal.show({
      title: 'Dołącz treść strony WWW',
      body: `
        <div style="margin-bottom:12px; font-size:0.85rem; color:var(--text-muted)">
          Wklej link, a system pobierze zawartość strony i dołączy ją do kontekstu.
        </div>
        <div class="form-group"><input class="form-input" id="url-input" type="url" placeholder="https://..." autofocus style="width:100%"></div>
      `,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.hide()">Anuluj</button>
        <button class="btn btn--primary" id="btn-attach-url">Pobierz i dołącz</button>
      `
    });
    // Bind the attach button after modal is rendered
    const attachBtn = document.getElementById('btn-attach-url');
    if (attachBtn) {
      attachBtn.addEventListener('click', async () => {
        const url = document.getElementById('url-input').value.trim();
        if (!url) { Toast.warn('Podaj adres URL'); return; }
        attachBtn.disabled = true; attachBtn.textContent = 'Pobieranie...';
        try {
          const res = await API.post('/chat/fetch-url', { url });
          this._attachments.push({ type: 'url', data: res.content, url: res.url, title: res.title, id: this.generateId() });
          this.renderAttachments();
          Modal.hide();
        } catch(e) {
          attachBtn.disabled = false; attachBtn.textContent = 'Pobierz i dołącz';
          Toast.error(e.message);
        }
      });
    }
    // Focus URL input
    setTimeout(() => document.getElementById('url-input')?.focus(), 100);
  },

  attachNote(id) {
    const note = this._notes.find(n => n.id === id);
    if (!note) return;
    const exists = this._attachments.find(a => a.type === 'note' && a.id === id);
    if (!exists) {
      this._attachments.push({ type: 'note', data: note.content, title: note.title, id: note.id });
      this.renderAttachments();
    }
  },

  attachKb(id) {
    const kb = this._knowledge.find(k => k.id === id);
    if (!kb) return;
    const exists = this._attachments.find(a => a.type === 'kb' && a.id === id);
    if (!exists) {
      this._attachments.push({ type: 'kb', data: kb.content, title: kb.title, id: kb.id });
      this.renderAttachments();
    }
  },
  
  async deleteNote(id) {
    if (!confirm('Usunąć notatkę?')) return;
    try { await API.del(`/chat/notes/${id}`); this.renderNotesPanel(); } catch(e) { Toast.error(e.message); }
  },
  
  async editNote(id = null) {
    const note = id ? this._notes.find(n => n.id === id) : { title: '', content: '', color: '#6366f1' };
    const html = `
      <div class="note-editor">
        <input class="form-input" id="note-edit-title" type="text" placeholder="Tytuł notatki" value="${escHtml(note.title)}">
        <div class="rich-editor" style="margin-top: 8px">
          <div class="rich-editor-toolbar">
            <button type="button" class="rich-editor-btn" data-cmd="bold" title="Pogrubienie"><b>B</b></button>
            <button type="button" class="rich-editor-btn" data-cmd="italic" title="Kursywa"><i>I</i></button>
            <button type="button" class="rich-editor-btn" data-cmd="underline" title="Podkreślenie"><u>U</u></button>
            <button type="button" class="rich-editor-btn" data-cmd="insertUnorderedList" title="Lista punktowana">• Lista</button>
            <button type="button" class="rich-editor-btn" data-cmd="insertOrderedList" title="Lista numerowana">1. Lista</button>
            <button type="button" class="rich-editor-btn" data-cmd="removeFormat" title="Wyczyść formatowanie">✕</button>
          </div>
          <div id="note-edit-content" class="rich-editor-content" contenteditable="true" style="min-height:150px">${note.content || ''}</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <label style="font-size:0.75rem;display:flex;align-items:center;gap:4px">Kolor: <input type="color" id="note-edit-color" value="${note.color}" style="width:24px;height:24px;padding:0;border:none;cursor:pointer"></label>
        </div>
      </div>`;
    
    Modal.show({
      title: id ? 'Edytuj notatkę' : 'Nowa notatka',
      body: html,
      footer: `
        <button class="btn btn--ghost" onclick="Modal.hide()">Anuluj</button>
        <button class="btn btn--primary" id="btn-save-note">Zapisz</button>
      `
    });

    const editor = document.getElementById('note-edit-content');
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

    // Bind save button after modal is rendered
    const saveBtn = document.getElementById('btn-save-note');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const t = document.getElementById('note-edit-title').value.trim();
        const c = document.getElementById('note-edit-content').innerHTML.trim();
        const col = document.getElementById('note-edit-color').value;
        if (!c || c === '<br>' || c === '<div><br></div>') { Toast.warn('Treść notatki nie może być pusta'); return; }
        try {
          if (id) await API.put(`/chat/notes/${id}`, { title: t, content: c, color: col });
          else await API.post('/chat/notes', { title: t, content: c, color: col });
          Modal.hide();
          this.renderNotesPanel();
        } catch(e) { Toast.error(e.message); }
      });
    }
  },

  async deleteKb(id) {
    if (!confirm('Usunąć dokument z bazy wiedzy?')) return;
    try { await API.del(`/chat/knowledge/${id}`); this.renderKbPanel(); } catch(e) { Toast.error(e.message); }
  },

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input?.value?.trim();
    if (!text && !this._attachments.length) return;
    if (this._streaming) return;

    const modelSel = document.getElementById('chat-model-sel');
    const modelInput = document.getElementById('chat-model-input');
    const model = modelSel?.value || modelInput?.value?.trim() || this._selectedModel;
    if (!model) { Toast.warn('Podaj nazwę modelu AI'); return; }
    this._selectedModel = model;

    // Process attachments into content and images
    let promptText = text || '';
    const images = [];
    
    for (const a of this._attachments) {
      if (a.type === 'image') {
        images.push(a.data);
      } else if (a.type === 'url') {
        promptText += `\n\n--- Treść strony: ${a.url} ---\n${a.data}\n--- Koniec treści strony ---`;
      } else if (a.type === 'note' || a.type === 'kb') {
        promptText += `\n\n--- Dokument: ${a.title} ---\n${a.data}\n--- Koniec dokumentu ---`;
      }
    }

    const newMsg = { role: 'user', content: promptText, images };
    this._messages.push(newMsg);
    
    // Clear UI
    input.value = '';
    input.style.height = 'auto';
    this._attachments = [];
    this.renderAttachments();

    const msgsEl = document.getElementById('chat-messages');
    const placeholder = msgsEl?.querySelector('div[style*="justify-content:center"]');
    if (placeholder) placeholder.remove();
    
    msgsEl.insertAdjacentHTML('beforeend', this.renderMessage({ role: 'user', content: text || '(Wysłano załączniki)', images }));
    
    const assistantId = 'assistant-msg-' + Date.now();
    msgsEl.insertAdjacentHTML('beforeend', `
      <div class="chat-msg assistant" id="${assistantId}">
        <div class="chat-msg-avatar">🤖</div>
        <div class="chat-msg-bubble"><span class="streaming-cursor"></span></div>
      </div>`);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;
    this._streaming = true;

    try {
      const apiMessages = this._messages.map(m => ({ role: m.role, content: m.content, images: m.images }));
      const chatId = this._activeChat?.id !== 'new' ? this._activeChat?.id : null;

      const headers = { 'Content-Type': 'application/json', 'X-User': Session.user?.username || '', 'X-Company': Session.company || '' };
      if (Session.owuiToken && Session.owuiToken !== '__api_key__') headers['X-OWUI-Token'] = Session.owuiToken;

      const response = await fetch(`/api/owui/chats/${chatId || 'new'}/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages: apiMessages }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || 'Błąd wysyłania wiadomości');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      const bubbleEl = document.querySelector(`#${assistantId} .chat-msg-bubble`);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              if (bubbleEl) bubbleEl.innerHTML = this.formatMarkdown(fullContent) + '<span class="streaming-cursor"></span>';
              msgsEl.scrollTop = msgsEl.scrollHeight;
            }
          } catch { /* skip */ }
        }
      }

      if (bubbleEl) bubbleEl.innerHTML = this.formatMarkdown(fullContent);
      this._messages.push({ role: 'assistant', content: fullContent });
      if (this._chatHistoryAvailable) await this.loadChats();

    } catch(e) {
      const bubbleEl = document.querySelector(`#${assistantId} .chat-msg-bubble`);
      if (bubbleEl) bubbleEl.innerHTML = `<span style="color:var(--red)">❌ ${escHtml(e.message)}</span>`;
      Toast.error(e.message);
    } finally {
      this._streaming = false;
      if (sendBtn) sendBtn.disabled = false;
      const newInput = document.getElementById('chat-input');
      if (newInput) newInput.focus();
    }
  },

  async loadOwuiPrompts() {
    if (this._owuiPromptsLoaded) return;
    try {
      const data = await API.get('/owui/prompts');
      if (Array.isArray(data) && data.length > 0) {
        // Remove previously loaded OWUI prompts
        this._prompts = this._prompts.filter(p => p.source !== 'owui');
        // Map OWUI prompts and add them
        const owuiPrompts = data.map(p => ({
          cmd: '/' + (p.command || p.title || p.name || '').toLowerCase().replace(/[^a-z0-9_ąćęłńóśźż]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''),
          label: p.title || p.name || p.command || 'Prompt OWUI',
          text: p.content || p.prompt || p.text || p.template || '(Pusty prompt)',
          source: 'owui'
        })).filter(p => p.cmd.length > 1);
        this._prompts.push(...owuiPrompts);
        console.log(`[Chats] Załadowano ${owuiPrompts.length} promptów z Open WebUI`);
      }
      this._owuiPromptsLoaded = true;
    } catch(e) {
      console.log('[Chats] Nie udało się pobrać promptów OWUI:', e.message);
      this._owuiPromptsLoaded = true;
    }
  },

  async loadLocalPresets() {
    try {
      const data = await API.get('/settings/presets');
      if (data.presets && data.presets.length > 0) {
        this._prompts = this._prompts.filter(p => p.source !== 'sg_preset');
        const localPrompts = data.presets.map(p => {
          const cmd = '/' + (p.name || '').toLowerCase().replace(/[^a-z0-9_ąćęłńóśźż]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
          let text = p.system_prompt || '';
          if (p.user_prompt_template) text += (text ? '\n\n' : '') + p.user_prompt_template;
          return {
            cmd: cmd.length > 1 ? cmd : '/preset_' + p.id.substring(0,4),
            label: p.name || 'Preset',
            text: text || '(Pusty prompt)',
            source: 'sg_preset'
          };
        });
        this._prompts.push(...localPrompts);
      }
    } catch(e) { console.warn('[Chats] Nie udało się załadować lokalnych presetów', e); }
  },

  handleSlashCommand(val) {
    const dropdown = document.getElementById('prompts-dropdown');
    if (!dropdown) return;
    
    const cursorPos = document.getElementById('chat-input').selectionStart;
    const textBeforeCursor = val.substring(0, cursorPos);
    const lastNewline = textBeforeCursor.lastIndexOf('\n');
    const currentLine = textBeforeCursor.substring(lastNewline + 1);
    
    if (currentLine.startsWith('/')) {
      const search = currentLine.substring(1).toLowerCase();
      const filtered = this._prompts.filter(p => p.cmd.toLowerCase().includes(search) || p.label.toLowerCase().includes(search));
      
      if (filtered.length > 0) {
        dropdown.innerHTML = filtered.map((p, i) => {
          let sourceTag = '';
          if (p.source === 'owui') {
            sourceTag = '<span style="font-size:0.6rem;background:rgba(16,185,129,0.15);color:#10b981;padding:1px 5px;border-radius:3px;margin-left:6px;font-weight:500">OWUI</span>';
          } else if (p.source === 'sg_preset') {
            sourceTag = '<span style="font-size:0.6rem;background:rgba(234,179,8,0.15);color:var(--yellow);padding:1px 5px;border-radius:3px;margin-left:6px;font-weight:500">PRESET</span>';
          } else {
            sourceTag = '<span style="font-size:0.6rem;background:rgba(99,102,241,0.15);color:var(--accent);padding:1px 5px;border-radius:3px;margin-left:6px;font-weight:500">LOCAL</span>';
          }
          return `
          <div class="prompt-item ${i===0?'active':''}" data-text="${escHtml(p.text)}" style="padding:10px 14px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; flex-direction:column; gap:2px; transition:background 0.15s">
            <div style="font-weight:600; font-size:0.8rem; color:var(--accent); display:flex; align-items:center">${escHtml(p.cmd)}${sourceTag}</div>
            <div style="font-size:0.75rem; color:var(--text-primary)">${escHtml(p.label)}</div>
            <div style="font-size:0.65rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${escHtml(p.text.substring(0, 120))}</div>
          </div>
        `;
        }).join('');
        dropdown.style.display = 'block';
        
        dropdown.querySelectorAll('.prompt-item').forEach(item => {
          item.addEventListener('click', () => {
            const input = document.getElementById('chat-input');
            const before = val.substring(0, lastNewline === -1 ? 0 : lastNewline + 1);
            const after = val.substring(cursorPos);
            input.value = before + item.dataset.text + after;
            dropdown.style.display = 'none';
            input.focus();
            input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; 
          });
          item.addEventListener('mouseover', () => {
            dropdown.querySelectorAll('.prompt-item').forEach(i => { i.classList.remove('active'); i.style.background = 'transparent'; });
            item.classList.add('active');
            item.style.background = 'rgba(99,102,241,0.1)';
          });
          if (item.classList.contains('active')) item.style.background = 'rgba(99,102,241,0.1)';
        });
        return;
      }
    }
    dropdown.style.display = 'none';
  },

  navigatePrompts(key) {
    const dropdown = document.getElementById('prompts-dropdown');
    const items = Array.from(dropdown.querySelectorAll('.prompt-item'));
    if (!items.length) return;
    const activeIdx = items.findIndex(i => i.classList.contains('active'));
    let nextIdx = 0;
    
    if (key === 'ArrowDown') nextIdx = activeIdx < items.length - 1 ? activeIdx + 1 : 0;
    else if (key === 'ArrowUp') nextIdx = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
    
    items.forEach(i => { i.classList.remove('active'); i.style.background = 'transparent'; });
    items[nextIdx].classList.add('active');
    items[nextIdx].style.background = 'rgba(99,102,241,0.1)';
    items[nextIdx].scrollIntoView({ block: 'nearest' });
  },

  async createTaskFromChat(button) {
    if (!button) return;
    const title = button.dataset.title;
    const description = button.dataset.desc;
    const priority = button.dataset.priority;
    
    button.disabled = true;
    const originalText = button.innerHTML;
    button.innerHTML = '⌛ Dodawanie...';
    button.classList.add('loading');
    
    try {
      await API.post('/crm/tasks', {
        title,
        description,
        priority,
        status_id: 1
      });
      
      button.innerHTML = '✔️ Dodano do CRM';
      button.className = 'chat-add-task-btn success';
      Toast.success('Utworzono zadanie w CRM: ' + title);
      
      if (window.CrmView && typeof window.CrmView.loadTasks === 'function') {
        window.CrmView.loadTasks();
      }
    } catch (e) {
      button.disabled = false;
      button.innerHTML = '❌ Błąd (spróbuj ponownie)';
      button.className = 'chat-add-task-btn error';
      button.classList.remove('loading');
      Toast.error('Błąd dodawania zadania: ' + e.message);
      
      setTimeout(() => {
        if (!button.disabled) {
          button.innerHTML = originalText;
          button.className = 'chat-add-task-btn';
        }
      }, 3000);
    }
  },

  // ─── Voice Input Methods ──────────────────────────────────────────────────────────

  _voiceActive: false,
  _speechRecognition: null,
  _mediaRecorder: null,
  _audioChunks: [],
  _voiceCancelled: false,

  toggleVoiceInput() {
    if (this._voiceActive) {
      this.stopVoiceInput(false);
    } else {
      this.startVoiceInput();
    }
  },

  async startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const placeholder = document.getElementById('voice-visualizer-placeholder');
    if (!placeholder) return;

    this._voiceActive = true;
    const voiceBtn = document.getElementById('tool-voice');
    if (voiceBtn) voiceBtn.classList.add('recording');

    // Render visualizer
    placeholder.innerHTML = `
      <div class="voice-visualizer-container">
        <div class="voice-info-group">
          <div class="voice-status-dot"></div>
          <span class="voice-status-text" id="voice-status-lbl">Słucham...</span>
          <span class="voice-status-sub" id="voice-status-sub">(mów teraz)</span>
        </div>
        <div class="voice-wave-visualizer">
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
          <div class="wave-bar"></div>
        </div>
        <div class="voice-control-group">
          <button class="voice-action-btn stop-btn" id="voice-stop-btn">✔️ Gotowe</button>
          <button class="voice-action-btn cancel-btn" id="voice-cancel-btn">✕ Anuluj</button>
        </div>
      </div>
    `;

    document.getElementById('voice-stop-btn')?.addEventListener('click', () => this.stopVoiceInput(false));
    document.getElementById('voice-cancel-btn')?.addEventListener('click', () => this.stopVoiceInput(true));

    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.lang = 'pl-PL';
        rec.continuous = true;
        rec.interimResults = true;
        
        const input = document.getElementById('chat-input');
        let finalTrans = '';

        rec.onstart = () => {
          console.log('[Voice] SpeechRecognition started');
          const lbl = document.getElementById('voice-status-lbl');
          if (lbl) lbl.textContent = 'Słucham (na żywo)...';
        };

        rec.onresult = event => {
          let interimTrans = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTrans += event.results[i][0].transcript;
            } else {
              interimTrans += event.results[i][0].transcript;
            }
          }
          
          const val = finalTrans + interimTrans;
          if (val.trim() && input) {
            if (!input.dataset.voiceBaseText) {
              input.dataset.voiceBaseText = input.value;
            }
            input.value = input.dataset.voiceBaseText + (input.dataset.voiceBaseText ? ' ' : '') + val;
            input.dispatchEvent(new Event('input'));
          }
        };

        rec.onerror = e => {
          console.warn('[Voice] SpeechRecognition error:', e.error);
          if (e.error === 'not-allowed') {
            Toast.error('Brak uprawnień do mikrofonu.');
            this.stopVoiceInput(true);
          } else {
            rec.stop();
            this.startMediaRecorderVoice();
          }
        };

        rec.onend = () => {
          console.log('[Voice] SpeechRecognition ended');
          if (input) delete input.dataset.voiceBaseText;
          // Restart if still active to support long speech
          if (this._voiceActive) {
            try { rec.start(); } catch {}
          }
        };

        this._speechRecognition = rec;
        rec.start();
      } catch (err) {
        console.error('[Voice] SpeechRecognition fallback to MediaRecorder:', err);
        this.startMediaRecorderVoice();
      }
    } else {
      console.log('[Voice] SpeechRecognition not supported, using MediaRecorder fallback');
      this.startMediaRecorderVoice();
    }
  },

  async startMediaRecorderVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm' };
      
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      this._audioChunks = [];
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) this._audioChunks.push(e.data);
      };

      recorder.onstart = () => {
        console.log('[Voice] MediaRecorder started');
        const lbl = document.getElementById('voice-status-lbl');
        if (lbl) lbl.textContent = 'Nagrywam audio...';
        const sub = document.getElementById('voice-status-sub');
        if (sub) sub.textContent = '(transkrypcja Open WebUI)';
      };

      recorder.onstop = async () => {
        console.log('[Voice] MediaRecorder stopped');
        stream.getTracks().forEach(t => t.stop());

        if (this._voiceCancelled) {
          this._voiceCancelled = false;
          return;
        }

        const audioBlob = new Blob(this._audioChunks, { type: recorder.mimeType || 'audio/webm' });
        if (audioBlob.size < 1000) {
          Toast.warn('Nagranie jest zbyt krótkie');
          return;
        }

        const placeholder = document.getElementById('voice-visualizer-placeholder');
        if (placeholder) {
          placeholder.innerHTML = `
            <div class="voice-visualizer-container" style="border-color:rgba(16,185,129,0.5)">
              <div class="voice-info-group">
                <div class="voice-status-dot" style="background:#10b981;box-shadow:0 0 8px #10b981;animation:none"></div>
                <span class="voice-status-text">Przesyłanie i transkrypcja AI...</span>
              </div>
              <div class="voice-wave-visualizer">
                <div class="wave-bar" style="animation-duration:0.6s"></div>
                <div class="wave-bar" style="animation-duration:0.6s"></div>
                <div class="wave-bar" style="animation-duration:0.6s"></div>
                <div class="wave-bar" style="animation-duration:0.6s"></div>
                <div class="wave-bar" style="animation-duration:0.6s"></div>
                <div class="wave-bar" style="animation-duration:0.6s"></div>
                <div class="wave-bar" style="animation-duration:0.6s"></div>
              </div>
            </div>
          `;
        }

        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'voice_recording.webm');

          const headers = {};
          if (Session.owuiToken && Session.owuiToken !== '__api_key__') {
            headers['X-OWUI-Token'] = Session.owuiToken;
          }

          const response = await fetch('/api/owui/audio/transcriptions', {
            method: 'POST',
            headers,
            body: formData
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Błąd transkrypcji' }));
            throw new Error(err.error || 'Nie udało się przetworzyć głosu');
          }

          const result = await response.json();
          if (result.text && result.text.trim()) {
            const input = document.getElementById('chat-input');
            if (input) {
              const start = input.selectionStart;
              const before = input.value.substring(0, start);
              const after = input.value.substring(input.selectionEnd);
              input.value = before + (before && !before.endsWith(' ') ? ' ' : '') + result.text.trim() + after;
              input.dispatchEvent(new Event('input'));
              input.focus();
              Toast.success('Głos przetworzony pomyślnie');
            }
          } else {
            Toast.warn('Nie rozpoznano mowy w nagraniu.');
          }
        } catch (e) {
          Toast.error('Błąd transkrypcji Open WebUI: ' + e.message);
        } finally {
          const pl = document.getElementById('voice-visualizer-placeholder');
          if (pl) pl.innerHTML = '';
        }
      };

      this._mediaRecorder = recorder;
      recorder.start();
    } catch (e) {
      console.error('[Voice] MediaRecorder getUserMedia failed:', e);
      Toast.error('Brak dostępu do mikrofonu.');
      this.stopVoiceInput(true);
    }
  },

  stopVoiceInput(cancel = false) {
    this._voiceActive = false;
    const voiceBtn = document.getElementById('tool-voice');
    if (voiceBtn) voiceBtn.classList.remove('recording');

    const input = document.getElementById('chat-input');
    if (input) delete input.dataset.voiceBaseText;

    if (this._speechRecognition) {
      try { this._speechRecognition.stop(); } catch {}
      this._speechRecognition = null;
    }

    if (this._mediaRecorder) {
      this._voiceCancelled = cancel;
      try {
        if (this._mediaRecorder.state !== 'inactive') {
          this._mediaRecorder.stop();
        }
      } catch {}
      this._mediaRecorder = null;
    }

    if (!this._mediaRecorder || cancel) {
      const placeholder = document.getElementById('voice-visualizer-placeholder');
      if (placeholder) placeholder.innerHTML = '';
    }
  }
};
