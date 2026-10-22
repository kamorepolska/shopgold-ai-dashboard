/* ═══════════════════════════════════════════════════════════════════════════
   PLANER — TickTick-style redesign
   3-column: sidebar | task list | detail panel
   Storage: localStorage (sg_planer_*)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Storage ─────────────────────────────────────────────────────────────── */
const PlanerDB = {
  _k: 'sg_planer_',
  get(k) { try { return JSON.parse(localStorage.getItem(this._k+k)||'null'); } catch(e) { return null; } },
  set(k,v) { try { localStorage.setItem(this._k+k, JSON.stringify(v)); } catch(e) {} },
  uid() { return Date.now()+'_'+Math.random().toString(36).slice(2,6); },
  getLists()        { return this.get('lists') || []; },
  saveLists(a)      { this.set('lists', a); },
  getTasks()        { return this.get('tasks') || []; },
  saveTasks(a)      { this.set('tasks', a); },
  getTaskById(id)   { return this.getTasks().find(t=>t.id===id)||null; },
  getTags()         { return this.get('tags') || []; },
  saveTags(a)       { this.set('tags', a); },
  getEvents()       { return this.get('events') || []; },
  saveEvents(a)     { this.set('events', a); },

  init() {
    if (this.get('v2init')) return;
    this.saveLists([
      { id:'l_inbox', name:'Inbox',     icon:'📥', color:'#6366f1' },
      { id:'l_work',  name:'Praca',     icon:'💼', color:'#3b82f6' },
      { id:'l_study', name:'Nauka',     icon:'📚', color:'#10b981' },
      { id:'l_shop',  name:'Zakupy',    icon:'🛒', color:'#f59e0b' },
      { id:'l_memo',  name:'Memo',      icon:'📌', color:'#8b5cf6' },
      { id:'l_wish',  name:'Życzenia',  icon:'⭐', color:'#ec4899' },
    ]);
    this.saveTags([
      { id:'tg1', name:'Ważne',       color:'#ef4444' },
      { id:'tg2', name:'Pomysł',      color:'#8b5cf6' },
      { id:'tg3', name:'Do zrobienia',color:'#f59e0b' },
      { id:'tg4', name:'CRM',         color:'#6366f1' },
      { id:'tg5', name:'Marketing',   color:'#10b981' },
    ]);
    const now = new Date().toISOString();
    const today = new Date(); today.setHours(0,0,0,0);
    const tom = new Date(today.getTime()+86400000).toISOString().slice(0,10);
    this.saveTasks([
      { id:'t1', listId:'l_inbox', title:'Kliknij w zadanie aby zobaczyć szczegóły',
        done:false, priority:'medium', tags:['tg4'], deadline:tom,
        notes:'<p>Możesz edytować notatki z formatowaniem tekstu.</p><ul><li>Twórz listy</li><li>Dodawaj <strong>pogrubienie</strong></li><li>Wstawiaj linki</li></ul>',
        subnotes:[{id:'s1',text:'Kliknij checkbox aby oznaczyć',done:false},{id:'s2',text:'Dodaj podzadania przyciskiem poniżej',done:true}],
        starred:false, createdAt:now, updatedAt:now },
      { id:'t2', listId:'l_inbox', title:'Użyj list po lewej aby organizować zadania',
        done:false, priority:'low', tags:['tg3'], deadline:null,
        notes:'', subnotes:[], starred:true, createdAt:now, updatedAt:now },
      { id:'t3', listId:'l_work',  title:'Sprawdzić kampanie email w zakładce Mailer',
        done:false, priority:'high', tags:['tg1','tg4'], deadline:today.toISOString().slice(0,10),
        notes:'<p>Sprawdź wskaźniki otwarć i klikalności.</p>',
        subnotes:[], starred:false, createdAt:now, updatedAt:now },
      { id:'t4', listId:'l_work',  title:'Aktualizacja cennika produktów PIM',
        done:true, priority:'low', tags:[], deadline:null,
        notes:'', subnotes:[], starred:false, createdAt:now, updatedAt:now },
      { id:'t5', listId:'l_memo',  title:'Pomysł: automatyczne tagowanie kontaktów CRM',
        done:false, priority:'medium', tags:['tg2','tg4'], deadline:null,
        notes:'<p>Zintegrować Planer z modułem CRM — synchronizacja zadań z kontaktami.</p>',
        subnotes:[], starred:true, createdAt:now, updatedAt:now },
    ]);
    this.set('v2init', true);
  }
};

const PLANER_COLORS = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#64748b'];

/* ─── View Entry ──────────────────────────────────────────────────────────── */
window.PlanerView = {
  render() {
    const el = document.getElementById('view-planer');
    if (!el) return;
    PlanerDB.init();
    // Migrate old data if needed
    if (!PlanerDB.getLists().length) { PlanerDB.set('v2init',null); PlanerDB.init(); }
    PlanerUI.mount(el);
  }
};

/* ─── Main UI ─────────────────────────────────────────────────────────────── */
const PlanerUI = {
  _view: 'list',       // 'list' | 'calendar'
  _activeList: null,   // listId or 'today'|'week'|'starred'|'trash'|'calendar'
  _activeTask: null,   // taskId
  _saveTimer: null,
  _crmTasks: [],
  _calView: 'month',
  _calDate: new Date(),
  _filterTag: null,
  _showDone: false,

  mount(el) {
    this._activeList = localStorage.getItem('sg_planer_list') || 'today';
    this._activeTask = null;
    el.innerHTML = this._shell();
    this._bindSidebar();
    this._renderList();
  },

  _shell() {
    return `<div class="planer-root">
      <div class="planer-sidebar" id="planer-sidebar">${this._buildSidebar()}</div>
      <div class="planer-list-panel" id="planer-list-panel"></div>
      <div class="planer-detail-panel hidden" id="planer-detail-panel"></div>
    </div>`;
  },

  /* ══════════════════════════════════════════════════════════════════════════
     SIDEBAR
  ══════════════════════════════════════════════════════════════════════════ */
  _buildSidebar() {
    const tasks = PlanerDB.getTasks();
    const lists = PlanerDB.getLists();
    const tags = PlanerDB.getTags();
    const today = new Date(); today.setHours(0,0,0,0);
    const weekEnd = new Date(today.getTime() + 7*86400000);

    const countToday = tasks.filter(t => !t.done && t.deadline && new Date(t.deadline+'T00:00:00') <= today).length;
    const countWeek  = tasks.filter(t => !t.done && t.deadline && new Date(t.deadline+'T00:00:00') <= weekEnd).length;
    const countStarred = tasks.filter(t => !t.done && t.starred).length;

    const smart = [
      { id:'today',    icon:'📅', label:'Dziś',           count: countToday },
      { id:'week',     icon:'📆', label:'Następne 7 dni', count: countWeek },
      { id:'starred',  icon:'⭐', label:'Oznaczone',      count: countStarred },
      { id:'calendar', icon:'🗓', label:'Kalendarz',      count: null },
    ];

    const smartHTML = smart.map(s => {
      const active = this._activeList === s.id ? 'active' : '';
      return `<div class="planer-sb-item ${active}" data-list="${s.id}" id="psb-${s.id}">
        <span class="planer-sb-icon">${s.icon}</span>
        <span class="planer-sb-label">${s.label}</span>
        ${s.count !== null ? `<span class="planer-sb-badge">${s.count||''}</span>` : ''}
      </div>`;
    }).join('');

    const listsHTML = lists.map(l => {
      const cnt = tasks.filter(t => t.listId===l.id && !t.done).length;
      const active = this._activeList === l.id ? 'active' : '';
      return `<div class="planer-sb-list-item ${active}" data-list="${l.id}" id="psb-${l.id}">
        <span class="planer-sb-list-dot" style="background:${l.color}"></span>
        <span class="planer-sb-list-name">${this._E(l.name)}</span>
        <span class="planer-sb-list-count">${cnt||''}</span>
        <span class="planer-sb-list-actions">
          <button class="planer-sb-list-act-btn" data-act="edit-list" data-lid="${l.id}" title="Edytuj">✏️</button>
          <button class="planer-sb-list-act-btn" data-act="del-list" data-lid="${l.id}" title="Usuń">🗑</button>
        </span>
      </div>`;
    }).join('');

    const tagsHTML = tags.map(t => {
      const on = this._filterTag === t.id;
      return `<span class="planer-sb-tag ${on?'active':''}" data-tid="${t.id}"
        style="color:${t.color};border-color:${t.color};${on?'background:'+t.color:''}">${this._E(t.name)}</span>`;
    }).join('');

    const trashCount = tasks.filter(t=>t.done).length;

    return `
    <div class="planer-sb-section">Widoki</div>
    ${smartHTML}
    <div class="planer-sb-section" style="margin-top:8px">Listy</div>
    <div id="planer-sb-lists">${listsHTML}</div>
    <div class="planer-sb-add-list" id="planer-sb-add-list">
      <span style="font-size:1rem">＋</span> Dodaj listę
    </div>
    <div id="planer-sb-list-form"></div>
    <div class="planer-sb-section" style="margin-top:8px">Filtry tagów</div>
    <div class="planer-sb-tags-wrap" id="planer-sb-tags">${tagsHTML}</div>
    <div class="planer-sb-add-list" id="planer-sb-add-tag">
      <span>🏷</span> Zarządzaj tagami
    </div>
    <div class="planer-sb-footer">
      <div class="planer-sb-item ${this._activeList==='trash'?'active':''}" data-list="trash" id="psb-trash">
        <span class="planer-sb-icon">🗑</span>
        <span class="planer-sb-label">Ukończone</span>
        <span class="planer-sb-badge">${trashCount||''}</span>
      </div>
    </div>`;
  },

  _bindSidebar() {
    const sb = document.getElementById('planer-sidebar');
    if (!sb) return;

    // Smart + list + trash nav
    sb.querySelectorAll('[data-list]').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-act]')) return;
        const id = el.dataset.list;
        if (this._saveTimer) { clearTimeout(this._saveTimer); this._doSave(); }
        this._activeList = id;
        this._activeTask = null;
        this._filterTag = null;
        localStorage.setItem('sg_planer_list', id);
        this._refreshSidebar();
        this._renderList();
        this._hideDetail();
      });
    });

    // List actions
    sb.querySelectorAll('[data-act="edit-list"]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this._editList(btn.dataset.lid); });
    });
    sb.querySelectorAll('[data-act="del-list"]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); this._deleteList(btn.dataset.lid); });
    });

    // Add list
    document.getElementById('planer-sb-add-list')?.addEventListener('click', () => this._showAddListForm());

    // Tag filter
    sb.querySelectorAll('[data-tid]').forEach(chip => {
      chip.addEventListener('click', () => {
        this._filterTag = this._filterTag === chip.dataset.tid ? null : chip.dataset.tid;
        this._refreshSidebar();
        this._renderList();
      });
    });

    // Manage tags
    document.getElementById('planer-sb-add-tag')?.addEventListener('click', () => this._showTagManager());
  },

  _refreshSidebar() {
    const sb = document.getElementById('planer-sidebar');
    if (sb) { sb.innerHTML = this._buildSidebar(); this._bindSidebar(); }
  },

  /* ══════════════════════════════════════════════════════════════════════════
     TASK LIST
  ══════════════════════════════════════════════════════════════════════════ */
  _renderList() {
    const panel = document.getElementById('planer-list-panel');
    if (!panel) return;

    if (this._activeList === 'calendar') {
      panel.innerHTML = this._buildCalWrap();
      this._loadCrmTasks().then(() => this._drawCal());
      return;
    }

    const { title, icon, tasks, isTrash } = this._getListData();
    const tags = PlanerDB.getTags();

    // Group tasks
    const active = tasks.filter(t => !t.done);
    const done   = tasks.filter(t => t.done);

    let tasksHTML = '';
    if (!active.length && !done.length) {
      tasksHTML = `<div class="planer-task-empty">
        <div class="ei">✅</div>
        <p>Brak zadań<br><small style="color:var(--text-muted)">Dodaj pierwsze zadanie powyżej</small></p>
      </div>`;
    } else {
      tasksHTML = active.map(t => this._buildTaskRow(t, tags)).join('');
      if (done.length) {
        tasksHTML += `<div class="planer-completed-toggle" id="planer-done-toggle">
          <span>${this._showDone ? '▾' : '▸'}</span>
          <span>Ukończone (${done.length})</span>
        </div>`;
        if (this._showDone) tasksHTML += done.map(t => this._buildTaskRow(t, tags)).join('');
      }
    }

    panel.innerHTML = `
    <div class="planer-list-header">
      <div class="planer-list-title">
        <span>${icon}</span> ${this._E(title)}
      </div>
      <div class="planer-list-toolbar">
        <button class="planer-toolbar-icon-btn" id="planer-toggle-detail" title="Panel szczegółów">⊡</button>
        <button class="planer-toolbar-icon-btn" id="planer-sort-btn" title="Sortuj">↕</button>
      </div>
    </div>
    ${!isTrash ? `<div class="planer-add-task-bar" id="planer-add-bar">
      <div class="planer-add-task-check"></div>
      <input class="planer-add-task-input" id="planer-add-input" placeholder="+ Dodaj zadanie..." autocomplete="off">
      <div class="planer-add-task-meta">
        <button class="planer-add-task-meta-btn" id="planer-add-priority-btn" title="Priorytet">🏳</button>
        <button class="planer-add-task-meta-btn" id="planer-add-date-btn" title="Termin">📅</button>
        <button class="planer-add-task-meta-btn" id="planer-add-tag-btn" title="Tag">🏷</button>
      </div>
    </div>` : ''}
    <div class="planer-tasks-scroll" id="planer-tasks-scroll">${tasksHTML}</div>`;

    this._bindListEvents();
  },

  _getListData() {
    const tasks = PlanerDB.getTasks();
    const lists = PlanerDB.getLists();
    const tags = PlanerDB.getTags();
    const today = new Date(); today.setHours(0,0,0,0);
    const weekEnd = new Date(today.getTime() + 7*86400000);

    let filtered = tasks;
    if (this._filterTag) filtered = filtered.filter(t => (t.tags||[]).includes(this._filterTag));

    switch(this._activeList) {
      case 'today':
        return { title:'Dziś', icon:'📅', isTrash:false,
          tasks: filtered.filter(t => t.deadline && new Date(t.deadline+'T00:00:00') <= today) };
      case 'week':
        return { title:'Następne 7 dni', icon:'📆', isTrash:false,
          tasks: filtered.filter(t => t.deadline && new Date(t.deadline+'T00:00:00') <= weekEnd) };
      case 'starred':
        return { title:'Oznaczone', icon:'⭐', isTrash:false,
          tasks: filtered.filter(t => t.starred) };
      case 'trash':
        return { title:'Ukończone', icon:'🗑', isTrash:true,
          tasks: filtered.filter(t => t.done) };
      default: {
        const l = lists.find(x=>x.id===this._activeList);
        return { title: l?.name||'Lista', icon: l?.icon||'📋', isTrash:false,
          tasks: filtered.filter(t => t.listId === this._activeList) };
      }
    }
  },

  _buildTaskRow(t, tags) {
    const today = new Date(); today.setHours(0,0,0,0);
    const deadlineDate = t.deadline ? new Date(t.deadline+'T00:00:00') : null;
    let dateClass = '', dateLabel = '';
    if (deadlineDate) {
      if (deadlineDate < today) { dateClass='overdue'; dateLabel='⚠ '+t.deadline; }
      else if (deadlineDate.getTime()===today.getTime()) { dateClass='today'; dateLabel='📅 Dziś'; }
      else dateLabel = '📅 '+t.deadline;
    }
    const noteTags = (t.tags||[]).map(tid => {
      const tg = tags.find(x=>x.id===tid);
      return tg ? `<span class="planer-task-tag" style="color:${tg.color};border-color:${tg.color};background:${tg.color}18">${this._E(tg.name)}</span>` : '';
    }).join('');
    const priMap = { high:['🔴','high','Wysoki'], medium:['🟡','medium','Średni'], low:['🔵','low','Niski'] };
    const [priIcon,priCls] = priMap[t.priority||'medium'] || priMap.medium;
    const subDone = (t.subnotes||[]).filter(s=>s.done).length;
    const subTotal = (t.subnotes||[]).length;
    const active = this._activeTask === t.id ? 'active' : '';
    const done = t.done ? 'done' : '';

    return `<div class="planer-task-row ${active} ${done}" data-tid="${t.id}">
      <div class="planer-task-checkbox ${t.done?'checked':''}" data-check="${t.id}" title="Oznacz jako ${t.done?'nieukończone':'ukończone'}"></div>
      <div class="planer-task-body">
        <div class="planer-task-title">${this._E(t.title)}</div>
        <div class="planer-task-meta">
          ${t.priority && t.priority!=='low' ? `<span class="planer-task-priority ${priCls}">${priIcon} ${priCls==='high'?'Wysoki':'Średni'}</span>` : ''}
          ${dateLabel ? `<span class="planer-task-date ${dateClass}">${dateLabel}</span>` : ''}
          ${noteTags}
          ${subTotal ? `<span class="planer-subtask-progress">☑ ${subDone}/${subTotal}</span>` : ''}
        </div>
      </div>
      <div class="planer-task-right">
        <button class="planer-task-star ${t.starred?'starred':''}" data-star="${t.id}" title="Oznacz gwiazdką">${t.starred?'⭐':'☆'}</button>
      </div>
    </div>`;
  },

  _bindListEvents() {
    // Task row click → open detail
    document.querySelectorAll('.planer-task-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('[data-check]') || e.target.closest('[data-star]')) return;
        if (this._saveTimer) { clearTimeout(this._saveTimer); this._doSave(); }
        this._activeTask = row.dataset.tid;
        document.querySelectorAll('.planer-task-row').forEach(r => r.classList.toggle('active', r.dataset.tid === this._activeTask));
        this._openDetail(this._activeTask);
      });
    });

    // Checkbox
    document.querySelectorAll('[data-check]').forEach(cb => {
      cb.addEventListener('click', e => {
        e.stopPropagation();
        const tasks = PlanerDB.getTasks();
        const t = tasks.find(x=>x.id===cb.dataset.check);
        if (t) { t.done = !t.done; t.updatedAt = new Date().toISOString(); }
        PlanerDB.saveTasks(tasks);
        this._refreshSidebar();
        this._renderList();
        if (this._activeTask === cb.dataset.check) this._hideDetail();
      });
    });

    // Star
    document.querySelectorAll('[data-star]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const tasks = PlanerDB.getTasks();
        const t = tasks.find(x=>x.id===btn.dataset.star);
        if (t) { t.starred = !t.starred; }
        PlanerDB.saveTasks(tasks);
        this._refreshSidebar();
        this._renderList();
      });
    });

    // Done toggle
    document.getElementById('planer-done-toggle')?.addEventListener('click', () => {
      this._showDone = !this._showDone;
      this._renderList();
    });

    // Toggle detail panel button
    document.getElementById('planer-toggle-detail')?.addEventListener('click', () => {
      const dp = document.getElementById('planer-detail-panel');
      if (dp) dp.classList.toggle('hidden');
    });

    // Add task
    const input = document.getElementById('planer-add-input');
    if (input) {
      let addPriority = 'medium', addDeadline = null, addTag = null;

      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && input.value.trim()) {
          this._addTask(input.value.trim(), addPriority, addDeadline, addTag);
          input.value = '';
          addPriority = 'medium'; addDeadline = null; addTag = null;
          this._updateAddBtnLabels(addPriority, addDeadline, addTag);
        }
      });

      document.getElementById('planer-add-priority-btn')?.addEventListener('click', e => {
        this._showPriorityDrop(e, p => { addPriority = p; this._updateAddBtnLabels(addPriority, addDeadline, addTag); });
      });

      document.getElementById('planer-add-date-btn')?.addEventListener('click', () => {
        const d = prompt('Termin (RRRR-MM-DD):', new Date().toISOString().slice(0,10));
        if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { addDeadline = d; this._updateAddBtnLabels(addPriority, addDeadline, addTag); }
      });

      document.getElementById('planer-add-tag-btn')?.addEventListener('click', e => {
        const tags = PlanerDB.getTags();
        this._showTagDrop(e, tags, tid => { addTag = tid; this._updateAddBtnLabels(addPriority, addDeadline, addTag); });
      });
    }
  },

  _updateAddBtnLabels(pri, date, tag) {
    const priMap = { high:'🔴', medium:'🏳', low:'🔵' };
    const pb = document.getElementById('planer-add-priority-btn');
    if (pb) pb.textContent = priMap[pri]||'🏳';
    const db = document.getElementById('planer-add-date-btn');
    if (db) db.textContent = date ? `📅 ${date}` : '📅';
    const tb = document.getElementById('planer-add-tag-btn');
    const tags = PlanerDB.getTags();
    if (tb && tag) { const tg = tags.find(x=>x.id===tag); tb.textContent = tg ? `🏷 ${tg.name}` : '🏷'; }
    else if (tb) tb.textContent = '🏷';
  },

  _addTask(title, priority, deadline, tagId) {
    const listId = ['today','week','starred','trash','calendar'].includes(this._activeList)
      ? (PlanerDB.getLists()[0]?.id || 'l_inbox')
      : this._activeList;
    const now = new Date().toISOString();
    const task = {
      id: 't_'+PlanerDB.uid(), listId, title,
      done:false, priority:priority||'medium',
      tags: tagId ? [tagId] : [],
      deadline: deadline||null, notes:'', subnotes:[],
      starred:false, createdAt:now, updatedAt:now
    };
    const tasks = PlanerDB.getTasks();
    tasks.unshift(task);
    PlanerDB.saveTasks(tasks);
    this._refreshSidebar();
    this._renderList();
    Toast.success('Zadanie dodane');
  },

  /* ══════════════════════════════════════════════════════════════════════════
     DETAIL PANEL
  ══════════════════════════════════════════════════════════════════════════ */
  _openDetail(tid) {
    const t = PlanerDB.getTaskById(tid);
    if (!t) return;
    const dp = document.getElementById('planer-detail-panel');
    if (!dp) return;
    dp.classList.remove('hidden');
    // Restore saved width
    const savedW = parseInt(localStorage.getItem('sg_planer_detail_w') || '0');
    if (savedW >= 260 && savedW <= 700) dp.style.width = savedW + 'px';
    dp.innerHTML = `<div class="planer-detail-resizer" id="planer-resizer" title="Przeciągnij aby zmienić szerokość"></div>` + this._buildDetail(t);
    this._bindDetailEvents(tid);
    this._bindResizer(dp);
  },

  _bindResizer(dp) {
    const handle = document.getElementById('planer-resizer');
    if (!handle) return;
    let startX, startW;
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      startX = e.clientX;
      startW = dp.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const onMove = e => {
        const newW = Math.min(700, Math.max(260, startW + (startX - e.clientX)));
        dp.style.width = newW + 'px';
      };
      const onUp = () => {
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        localStorage.setItem('sg_planer_detail_w', dp.offsetWidth);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  },

  _hideDetail() {
    this._activeTask = null;
    const dp = document.getElementById('planer-detail-panel');
    if (dp) { dp.classList.add('hidden'); dp.innerHTML = ''; }
    document.querySelectorAll('.planer-task-row').forEach(r => r.classList.remove('active'));
  },

  _buildDetail(t) {
    const tags = PlanerDB.getTags();
    const lists = PlanerDB.getLists();
    const tagChips = (t.tags||[]).map(tid => {
      const tg = tags.find(x=>x.id===tid);
      return tg ? `<span class="planer-task-tag" style="color:${tg.color};border-color:${tg.color};background:${tg.color}18;cursor:pointer" data-rem-tag="${tg.id}" title="Usuń tag">${this._E(tg.name)} ×</span>` : '';
    }).join('');
    const subHTML = (t.subnotes||[]).map(s => `
    <div class="planer-detail-sub-row ${s.done?'planer-detail-sub-done':''}" data-sid="${s.id}">
      <input type="checkbox" class="planer-detail-sub-check" ${s.done?'checked':''} title="Oznacz">
      <div class="planer-detail-sub-text" contenteditable="true" data-ph="Podzadanie...">${this._E(s.text)}</div>
      <button class="planer-detail-sub-del" title="Usuń">✕</button>
    </div>`).join('');

    const listName = lists.find(l=>l.id===t.listId)?.name || 'Inbox';
    const priMap = { high:'🔴 Wysoki', medium:'🟡 Średni', low:'🔵 Niski' };
    const priLabel = priMap[t.priority||'medium'];

    return `
    <div class="planer-detail-header">
      <div class="planer-detail-check ${t.done?'checked':''}" id="detail-check"></div>
      <input class="planer-detail-title-input ${t.done?'done':''}" id="detail-title" value="${this._E(t.title)}" placeholder="Tytuł zadania...">
      <button class="planer-detail-close" id="detail-close" title="Zamknij">✕</button>
    </div>
    <div class="planer-detail-body">
      <div class="planer-detail-row" id="detail-list-row" title="Zmień listę">
        <span class="planer-detail-row-icon">📋</span>
        <span class="planer-detail-row-label">Lista</span>
        <span class="planer-detail-row-val" id="detail-list-val">${this._E(listName)}</span>
      </div>
      <div class="planer-detail-row" id="detail-priority-row" title="Zmień priorytet">
        <span class="planer-detail-row-icon">🏳</span>
        <span class="planer-detail-row-label">Priorytet</span>
        <span class="planer-detail-row-val" id="detail-priority-val">${priLabel}</span>
      </div>
      <div class="planer-detail-row">
        <span class="planer-detail-row-icon">📅</span>
        <span class="planer-detail-row-label">Termin</span>
        <input type="date" id="detail-deadline" value="${t.deadline||''}" title="Wybierz termin">
      </div>
      <div class="planer-detail-row" id="detail-tag-row" title="Dodaj tag">
        <span class="planer-detail-row-icon">🏷</span>
        <span class="planer-detail-row-label">Tagi</span>
        <div style="flex:1;display:flex;gap:4px;flex-wrap:wrap;align-items:center">
          ${tagChips}
          <button class="planer-add-task-meta-btn" id="detail-add-tag-btn">＋ Tag</button>
        </div>
      </div>
      <div class="planer-detail-row" id="detail-star-row" title="Oznacz gwiazdką">
        <span class="planer-detail-row-icon">${t.starred?'⭐':'☆'}</span>
        <span class="planer-detail-row-label">Gwiazdka</span>
        <span class="planer-detail-row-val">${t.starred?'Oznaczone':'Nieoznaczone'}</span>
      </div>
      <div class="planer-detail-divider"></div>
      <div class="planer-detail-subtasks">
        <div class="planer-detail-subtask-head">Podzadania</div>
        <div id="detail-subtasks">${subHTML}</div>
        <button class="planer-detail-add-sub" id="detail-add-sub">＋ Dodaj podzadanie</button>
      </div>
      <div class="planer-detail-divider"></div>
      <div class="planer-detail-notes-wrap">
        <div class="planer-detail-notes-label">Notatki</div>
        <div class="planer-rt-toolbar">
          <button class="planer-rt-btn" data-cmd="bold" title="Pogrubienie"><strong>B</strong></button>
          <button class="planer-rt-btn" data-cmd="italic" title="Kursywa"><em>I</em></button>
          <button class="planer-rt-btn" data-cmd="underline" title="Podkreślenie"><u>U</u></button>
          <button class="planer-rt-btn" data-cmd="insertUnorderedList" title="Lista">≡</button>
          <button class="planer-rt-btn" data-cmd="formatBlock" data-val="blockquote" title="Cytat">❝</button>
          <button class="planer-rt-btn" id="detail-link-btn" title="Link">🔗</button>
        </div>
        <div class="planer-detail-notes" id="detail-notes" contenteditable="true"
          data-placeholder="Dodaj notatki, linki, opisy...">${t.notes||''}</div>
      </div>
      <div class="planer-detail-divider"></div>
      <div style="padding:4px 16px 8px;font-size:.68rem;color:var(--text-muted)">
        Utworzono: ${new Date(t.createdAt).toLocaleString('pl')}<br>
        Edytowano: ${new Date(t.updatedAt).toLocaleString('pl')}
      </div>
    </div>
    <div class="planer-detail-footer">
      <button class="planer-detail-save-btn" id="detail-save">💾 Zapisz</button>
      <div class="planer-detail-saved-ind" id="detail-saved-ind">✅ Zapisano</div>
      <div style="flex:1"></div>
      <button class="planer-detail-del-btn" id="detail-del" title="Usuń zadanie">🗑</button>
    </div>`;
  },

  _bindDetailEvents(tid) {
    const _autoSave = () => {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this._doSave(), 1500);
    };

    document.getElementById('detail-close')?.addEventListener('click', () => this._hideDetail());

    // Check toggle
    document.getElementById('detail-check')?.addEventListener('click', () => {
      const tasks = PlanerDB.getTasks();
      const t = tasks.find(x=>x.id===tid);
      if (t) { t.done = !t.done; t.updatedAt = new Date().toISOString(); }
      PlanerDB.saveTasks(tasks);
      this._refreshSidebar();
      this._renderList();
      this._openDetail(tid);
    });

    // Title autosave
    document.getElementById('detail-title')?.addEventListener('input', _autoSave);

    // Deadline
    document.getElementById('detail-deadline')?.addEventListener('change', () => {
      clearTimeout(this._saveTimer); this._doSave();
    });

    // Priority
    document.getElementById('detail-priority-row')?.addEventListener('click', e => {
      this._showPriorityDrop(e, p => {
        const tasks = PlanerDB.getTasks();
        const t = tasks.find(x=>x.id===tid);
        if (t) { t.priority = p; t.updatedAt = new Date().toISOString(); }
        PlanerDB.saveTasks(tasks);
        this._renderList();
        this._openDetail(tid);
      });
    });

    // Star
    document.getElementById('detail-star-row')?.addEventListener('click', () => {
      const tasks = PlanerDB.getTasks();
      const t = tasks.find(x=>x.id===tid);
      if (t) { t.starred = !t.starred; }
      PlanerDB.saveTasks(tasks);
      this._refreshSidebar();
      this._renderList();
      this._openDetail(tid);
    });

    // List change
    document.getElementById('detail-list-row')?.addEventListener('click', () => {
      const lists = PlanerDB.getLists();
      const opts = lists.map((l,i)=>`${i+1}) ${l.name}`).join('\n');
      const ans = prompt(`Wybierz listę:\n${opts}\n\nWpisz numer:`, '');
      const idx = parseInt(ans)-1;
      if (idx >= 0 && idx < lists.length) {
        const tasks = PlanerDB.getTasks();
        const t = tasks.find(x=>x.id===tid);
        if (t) { t.listId = lists[idx].id; t.updatedAt = new Date().toISOString(); }
        PlanerDB.saveTasks(tasks);
        this._refreshSidebar(); this._renderList(); this._openDetail(tid);
      }
    });

    // Tags — add
    document.getElementById('detail-add-tag-btn')?.addEventListener('click', e => {
      const tags = PlanerDB.getTags();
      const t = PlanerDB.getTaskById(tid);
      const filtered = tags.filter(tg => !(t?.tags||[]).includes(tg.id));
      this._showTagDrop(e, filtered, tagId => {
        const tasks = PlanerDB.getTasks();
        const tk = tasks.find(x=>x.id===tid);
        if (tk) { tk.tags = [...(tk.tags||[]), tagId]; tk.updatedAt = new Date().toISOString(); }
        PlanerDB.saveTasks(tasks);
        this._renderList(); this._openDetail(tid);
      });
    });

    // Tags — remove
    document.querySelectorAll('[data-rem-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tasks = PlanerDB.getTasks();
        const t = tasks.find(x=>x.id===tid);
        if (t) { t.tags = (t.tags||[]).filter(x=>x!==btn.dataset.remTag); }
        PlanerDB.saveTasks(tasks);
        this._renderList(); this._openDetail(tid);
      });
    });

    // Rich text toolbar
    const notes = document.getElementById('detail-notes');
    document.querySelectorAll('.planer-rt-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('mousedown', e => {
        e.preventDefault();
        document.execCommand(btn.dataset.cmd, false, btn.dataset.val||null);
        notes?.focus();
      });
    });
    document.getElementById('detail-link-btn')?.addEventListener('click', () => {
      const url = prompt('URL:', 'https://');
      if (url) { document.execCommand('createLink', false, url); notes?.focus(); }
    });
    notes?.addEventListener('input', _autoSave);

    // Subtasks
    document.getElementById('detail-add-sub')?.addEventListener('click', () => this._addSubtask(tid));
    this._bindSubtaskEvents(tid);

    // Save / Delete
    document.getElementById('detail-save')?.addEventListener('click', () => this._doSave());
    document.getElementById('detail-del')?.addEventListener('click', () => {
      if (!confirm('Usunąć to zadanie?')) return;
      PlanerDB.saveTasks(PlanerDB.getTasks().filter(t=>t.id!==tid));
      this._activeTask = null;
      this._refreshSidebar(); this._renderList(); this._hideDetail();
      Toast.success('Zadanie usunięte');
    });

    // Keyboard shortcut
    document.getElementById('detail-notes')?.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key==='s') { e.preventDefault(); this._doSave(); }
    });
  },

  _doSave() {
    const tid = this._activeTask;
    if (!tid) return;
    const tasks = PlanerDB.getTasks();
    const t = tasks.find(x=>x.id===tid);
    if (!t) return;
    const title = document.getElementById('detail-title')?.value;
    const notes = document.getElementById('detail-notes')?.innerHTML;
    const deadline = document.getElementById('detail-deadline')?.value;
    if (title !== undefined) t.title = title;
    if (notes !== undefined) t.notes = notes;
    if (deadline !== undefined) t.deadline = deadline || null;
    t.updatedAt = new Date().toISOString();
    PlanerDB.saveTasks(tasks);
    this._renderList();
    // Re-mark active row
    document.querySelectorAll('.planer-task-row').forEach(r => r.classList.toggle('active', r.dataset.tid === tid));
    const ind = document.getElementById('detail-saved-ind');
    if (ind) { ind.classList.add('show'); setTimeout(()=>ind.classList.remove('show'), 2000); }
    // Update date in detail
    const dateEl = document.querySelector('#planer-detail-panel [style*="Edytowano"]');
    if (dateEl) dateEl.innerHTML = `Utworzono: ${new Date(t.createdAt).toLocaleString('pl')}<br>Edytowano: ${new Date(t.updatedAt).toLocaleString('pl')}`;
  },

  /* ── Subtasks ─────────────────────────────────────────────────────────── */
  _addSubtask(tid) {
    const tasks = PlanerDB.getTasks();
    const t = tasks.find(x=>x.id===tid);
    if (!t) return;
    const s = { id:'sub_'+PlanerDB.uid(), text:'', done:false };
    t.subnotes = t.subnotes || [];
    t.subnotes.push(s);
    PlanerDB.saveTasks(tasks);
    const list = document.getElementById('detail-subtasks');
    if (list) {
      const div = document.createElement('div');
      div.innerHTML = `<div class="planer-detail-sub-row" data-sid="${s.id}">
        <input type="checkbox" class="planer-detail-sub-check">
        <div class="planer-detail-sub-text" contenteditable="true" data-ph="Podzadanie..."></div>
        <button class="planer-detail-sub-del">✕</button>
      </div>`;
      list.appendChild(div.firstElementChild);
      this._bindSubtaskEvents(tid);
      list.lastElementChild?.querySelector('.planer-detail-sub-text')?.focus();
    }
  },

  _bindSubtaskEvents(tid) {
    document.querySelectorAll('#detail-subtasks .planer-detail-sub-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const row = cb.closest('[data-sid]');
        const sid = row?.dataset.sid;
        row?.classList.toggle('planer-detail-sub-done', cb.checked);
        const tasks = PlanerDB.getTasks();
        const t = tasks.find(x=>x.id===tid);
        const s = t?.subnotes?.find(x=>x.id===sid);
        if (s) { s.done = cb.checked; }
        PlanerDB.saveTasks(tasks);
        this._renderList();
      });
    });
    document.querySelectorAll('#detail-subtasks .planer-detail-sub-text').forEach(el => {
      el.addEventListener('input', () => {
        const sid = el.closest('[data-sid]')?.dataset.sid;
        const tasks = PlanerDB.getTasks();
        const t = tasks.find(x=>x.id===tid);
        const s = t?.subnotes?.find(x=>x.id===sid);
        if (s) s.text = el.textContent;
        PlanerDB.saveTasks(tasks);
      });
      el.addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();this._addSubtask(tid);} });
    });
    document.querySelectorAll('#detail-subtasks .planer-detail-sub-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('[data-sid]');
        const sid = row?.dataset.sid;
        const tasks = PlanerDB.getTasks();
        const t = tasks.find(x=>x.id===tid);
        if (t) t.subnotes = t.subnotes.filter(s=>s.id!==sid);
        PlanerDB.saveTasks(tasks);
        row?.remove();
        this._renderList();
      });
    });
  },

  /* ── Priority Dropdown ────────────────────────────────────────────────── */
  _showPriorityDrop(e, cb) {
    document.querySelectorAll('.planer-priority-drop').forEach(d=>d.remove());
    const drop = document.createElement('div');
    drop.className = 'planer-priority-drop';
    const opts = [['high','🔴','Wysoki','#ef4444'],['medium','🟡','Średni','#f59e0b'],['low','🔵','Niski','#10b981']];
    drop.innerHTML = opts.map(([v,ic,lb,cl])=>`<div class="planer-priority-opt" data-val="${v}">
      <span>${ic}</span><span style="color:${cl}">${lb}</span></div>`).join('');
    const rect = e.target.getBoundingClientRect();
    drop.style.cssText = `top:${rect.bottom+4}px;left:${rect.left}px;`;
    document.body.appendChild(drop);
    drop.querySelectorAll('[data-val]').forEach(opt => {
      opt.addEventListener('click', () => { cb(opt.dataset.val); drop.remove(); });
    });
    setTimeout(() => document.addEventListener('click', () => drop.remove(), { once:true }), 50);
  },

  /* ── Tag Dropdown ─────────────────────────────────────────────────────── */
  _showTagDrop(e, tags, cb) {
    document.querySelectorAll('.planer-tag-drop').forEach(d=>d.remove());
    if (!tags.length) { Toast.info('Brak tagów. Dodaj tagi w Ustawieniach Planera.'); return; }
    const drop = document.createElement('div');
    drop.className = 'planer-tag-drop';
    drop.innerHTML = tags.map(t=>`<div class="planer-tag-drop-item" data-tid="${t.id}">
      <div style="width:10px;height:10px;border-radius:50%;background:${t.color}"></div>
      <span>${this._E(t.name)}</span></div>`).join('');
    const rect = e.target.getBoundingClientRect();
    drop.style.cssText = `top:${rect.bottom+4}px;left:${rect.left}px;`;
    document.body.appendChild(drop);
    drop.querySelectorAll('[data-tid]').forEach(item => {
      item.addEventListener('click', () => { cb(item.dataset.tid); drop.remove(); });
    });
    setTimeout(() => document.addEventListener('click', () => drop.remove(), { once:true }), 50);
  },

  /* ══════════════════════════════════════════════════════════════════════════
     LIST / TAG MANAGEMENT
  ══════════════════════════════════════════════════════════════════════════ */
  _showAddListForm(existing) {
    const area = document.getElementById('planer-sb-list-form');
    if (!area) return;
    const icons = ['📋','💼','📚','🛒','📌','⭐','🏠','🚀','💡','🎯'];
    let selIcon = existing?.icon || '📋';
    let selColor = existing?.color || PLANER_COLORS[0];
    area.innerHTML = `<div class="planer-inline-row">
      <input id="plist-name" placeholder="Nazwa listy..." value="${existing?this._E(existing.name):''}">
      <button class="planer-inline-ok" id="plist-ok">OK</button>
      <button class="planer-inline-cancel" id="plist-cancel">✕</button>
    </div>
    <div class="planer-color-row">
      ${icons.map(ic=>`<span style="font-size:.95rem;cursor:pointer" data-icon="${ic}" title="${ic}">${ic}</span>`).join('')}
    </div>
    <div class="planer-color-row">
      ${PLANER_COLORS.map(c=>`<div class="planer-swatch ${c===selColor?'sel':''}" data-color="${c}" style="background:${c}"></div>`).join('')}
    </div>`;
    area.querySelectorAll('[data-icon]').forEach(sp => sp.addEventListener('click', ()=>{ selIcon=sp.dataset.icon; }));
    area.querySelectorAll('.planer-swatch').forEach(sw => {
      sw.addEventListener('click', ()=>{
        area.querySelectorAll('.planer-swatch').forEach(s=>s.classList.remove('sel'));
        sw.classList.add('sel'); selColor=sw.dataset.color;
      });
    });
    document.getElementById('plist-cancel')?.addEventListener('click', ()=>{ area.innerHTML=''; });
    document.getElementById('plist-ok')?.addEventListener('click', ()=>{
      const name = document.getElementById('plist-name')?.value.trim();
      if (!name) return;
      const lists = PlanerDB.getLists();
      if (existing) { const l=lists.find(x=>x.id===existing.id); if(l){l.name=name;l.icon=selIcon;l.color=selColor;} }
      else lists.push({ id:'l_'+PlanerDB.uid(), name, icon:selIcon, color:selColor });
      PlanerDB.saveLists(lists);
      area.innerHTML='';
      this._refreshSidebar();
    });
    document.getElementById('plist-name')?.focus();
  },

  _editList(lid) {
    const l = PlanerDB.getLists().find(x=>x.id===lid);
    if (l) this._showAddListForm(l);
  },

  _deleteList(lid) {
    if (!confirm('Usunąć listę i wszystkie jej zadania?')) return;
    PlanerDB.saveLists(PlanerDB.getLists().filter(l=>l.id!==lid));
    PlanerDB.saveTasks(PlanerDB.getTasks().filter(t=>t.listId!==lid));
    if (this._activeList===lid) { this._activeList='today'; localStorage.setItem('sg_planer_list','today'); }
    this._refreshSidebar(); this._renderList(); this._hideDetail();
  },

  _showTagManager() {
    const tags = PlanerDB.getTags();
    const lines = tags.map(t=>`• ${t.name} (${t.color})`).join('\n');
    const ans = prompt(`Tagi (${tags.length}):\n${lines}\n\nWpisz nową nazwę tagu (puste = anuluj):`);
    if (!ans?.trim()) return;
    const newTag = { id:'tg_'+PlanerDB.uid(), name:ans.trim(), color:PLANER_COLORS[tags.length%PLANER_COLORS.length] };
    PlanerDB.saveTags([...tags, newTag]);
    this._refreshSidebar();
    Toast.success('Tag dodany: '+newTag.name);
  },

  /* ══════════════════════════════════════════════════════════════════════════
     CALENDAR
  ══════════════════════════════════════════════════════════════════════════ */
  async _loadCrmTasks() {
    try {
      const d = await API.get('/crm/tasks?limit=500');
      this._crmTasks = Array.isArray(d) ? d : (d.tasks||[]);
    } catch(e) { this._crmTasks = []; }
  },

  _buildCalWrap() {
    return `<div class="planer-cal-wrap">
      <div class="planer-cal-topbar">
        <button class="planer-cal-nav-btn" id="cal-prev">‹</button>
        <button class="planer-cal-nav-btn" id="cal-next">›</button>
        <button class="planer-cal-nav-btn" id="cal-today" style="font-size:.72rem">Dziś</button>
        <span class="planer-cal-heading" id="cal-heading"></span>
        <div class="planer-cal-view-toggle">
          <button data-cv="month" class="${this._calView==='month'?'active':''}">Miesiąc</button>
          <button data-cv="week" class="${this._calView==='week'?'active':''}">Tydzień</button>
        </div>
        <button class="btn btn--primary btn--sm" id="cal-add-ev" style="font-size:.74rem;padding:5px 12px">＋ Dodaj</button>
      </div>
      <div class="planer-cal-grid-area" id="cal-grid"></div>
    </div>`;
  },

  _allCalEvents() {
    const planerEvts = PlanerDB.getEvents();
    const taskEvts = PlanerDB.getTasks().filter(t=>t.deadline&&!t.done).map(t=>({
      id:'tsk_'+t.id, title:t.title, date:t.deadline,
      color:t.priority==='high'?'#ef4444':t.priority==='medium'?'#6366f1':'#10b981',
      source:'task'
    }));
    const crmEvts = this._crmTasks.filter(t=>t.deadline).map(t=>({
      id:'crm_'+t.id, title:'[CRM] '+(t.title||'Zadanie'), date:t.deadline.slice(0,10),
      color:'#f59e0b', source:'crm'
    }));
    return [...planerEvts,...taskEvts,...crmEvts];
  },

  _drawCal() {
    const heading = document.getElementById('cal-heading');
    const grid = document.getElementById('cal-grid');
    if (!heading || !grid) return;
    const d = this._calDate;
    const months = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    if (this._calView==='month') {
      heading.textContent = `${months[d.getMonth()]} ${d.getFullYear()}`;
      grid.innerHTML = this._buildMonth(d.getFullYear(), d.getMonth());
    } else {
      const mon = this._getMonday(d);
      heading.textContent = `${mon.toLocaleDateString('pl',{day:'numeric',month:'short'})} – ${new Date(mon.getTime()+6*86400000).toLocaleDateString('pl',{day:'numeric',month:'short',year:'numeric'})}`;
      grid.innerHTML = this._buildWeek(mon);
    }
    this._bindCalEvents2();
  },

  _buildMonth(y,m) {
    const today = new Date(); today.setHours(0,0,0,0);
    const evts = this._allCalEvents();
    const evtMap = {};
    evts.forEach(e => { evtMap[e.date] = evtMap[e.date]||[]; evtMap[e.date].push(e); });
    const first = new Date(y,m,1).getDay()||7;
    const total = new Date(y,m+1,0).getDate();
    const days = ['Pon','Wto','Śro','Czw','Pią','Sob','Ndz'];
    let cells = '';
    for (let i=1;i<first;i++) {
      const pd = new Date(y,m,1-i);
      cells = `<div class="planer-cal-cell other-m"><div class="planer-cal-cell-num">${pd.getDate()}</div></div>`+cells;
    }
    cells='';
    for (let i=first-1;i>0;i--) { const pd=new Date(y,m,-i+1); cells+=`<div class="planer-cal-cell other-m"><div class="planer-cal-cell-num">${pd.getDate()}</div></div>`; }
    for (let day=1;day<=total;day++) {
      const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const isToday=day===today.getDate()&&m===today.getMonth()&&y===today.getFullYear();
      const dayEvts=(evtMap[ds]||[]).slice(0,3);
      const more=(evtMap[ds]||[]).length-dayEvts.length;
      cells+=`<div class="planer-cal-cell ${isToday?'today':''} planer-cal-cell-dbl" data-date="${ds}">
        <div class="planer-cal-cell-num">${day}</div>
        ${dayEvts.map(e=>`<div class="planer-cal-ev" style="background:${e.color}22;color:${e.color}" title="${this._E(e.title)}">${this._E(e.title)}</div>`).join('')}
        ${more?`<div class="planer-cal-ev" style="color:var(--text-muted)">+${more} więcej</div>`:''}
      </div>`;
    }
    const trailing=(7-(first-1+total)%7)%7;
    for(let i=1;i<=trailing;i++) cells+=`<div class="planer-cal-cell other-m"><div class="planer-cal-cell-num">${i}</div></div>`;
    return `<div class="planer-cal-month">
      ${days.map(d=>`<div class="planer-cal-dayname">${d}</div>`).join('')}
      ${cells}
    </div>`;
  },

  _buildWeek(monday) {
    const today = new Date(); today.setHours(0,0,0,0);
    const evts = this._allCalEvents();
    const days = ['Pon','Wto','Śro','Czw','Pią','Sob','Ndz'];
    const hours = Array.from({length:18},(_,i)=>i+6);
    let head = '<div></div>';
    const cols = [];
    for (let i=0;i<7;i++) {
      const d=new Date(monday.getTime()+i*86400000); d.setHours(0,0,0,0);
      const ds=d.toISOString().slice(0,10);
      const isToday=d.getTime()===today.getTime();
      head+=`<div class="planer-cal-week-col-head ${isToday?'today-col':''}">
        ${days[i]}<span class="planer-cal-week-daynum">${d.getDate()}</span></div>`;
      cols.push({ ds, isToday, evts: evts.filter(e=>e.date===ds) });
    }
    let rows='';
    hours.forEach(h=>{
      rows+=`<div class="planer-cal-hour-label">${String(h).padStart(2,'0')}:00</div>`;
      cols.forEach(({ds,isToday,evts:de})=>{
        rows+=`<div class="planer-cal-week-day-cell ${isToday?'today-col':''}" data-date="${ds}">
          ${de.map(e=>`<div class="planer-cal-week-ev" style="background:${e.color}22;color:${e.color}" title="${this._E(e.title)}">${this._E(e.title)}</div>`).join('')}
        </div>`;
      });
    });
    return `<div class="planer-cal-week">
      ${head}
      ${rows}
    </div>`;
  },

  _getMonday(d) {
    const x=new Date(d); const day=x.getDay()||7;
    x.setDate(x.getDate()-day+1); x.setHours(0,0,0,0); return x;
  },

  _bindCalEvents2() {
    document.getElementById('cal-prev')?.addEventListener('click',()=>{
      if(this._calView==='month') this._calDate=new Date(this._calDate.getFullYear(),this._calDate.getMonth()-1,1);
      else this._calDate=new Date(this._calDate.getTime()-7*86400000);
      this._drawCal();
    });
    document.getElementById('cal-next')?.addEventListener('click',()=>{
      if(this._calView==='month') this._calDate=new Date(this._calDate.getFullYear(),this._calDate.getMonth()+1,1);
      else this._calDate=new Date(this._calDate.getTime()+7*86400000);
      this._drawCal();
    });
    document.getElementById('cal-today')?.addEventListener('click',()=>{this._calDate=new Date();this._drawCal();});
    document.querySelectorAll('.planer-cal-view-toggle [data-cv]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        this._calView=btn.dataset.cv;
        document.querySelectorAll('.planer-cal-view-toggle [data-cv]').forEach(b=>b.classList.toggle('active',b.dataset.cv===this._calView));
        this._drawCal();
      });
    });
    document.getElementById('cal-add-ev')?.addEventListener('click',()=>{
      const ds=this._calDate.toISOString().slice(0,10);
      const title=prompt(`Dodaj wydarzenie (${ds}):`);
      if(!title) return;
      const evts=PlanerDB.getEvents();
      evts.push({id:'ev_'+PlanerDB.uid(),title,date:ds,color:'#6366f1',source:'planer'});
      PlanerDB.saveEvents(evts); this._drawCal(); Toast.success('Dodano wydarzenie');
    });
    document.querySelectorAll('.planer-cal-cell-dbl').forEach(cell=>{
      cell.addEventListener('dblclick',()=>{
        const title=prompt(`Dodaj wydarzenie (${cell.dataset.date}):`);
        if(!title) return;
        const evts=PlanerDB.getEvents();
        evts.push({id:'ev_'+PlanerDB.uid(),title,date:cell.dataset.date,color:'#6366f1',source:'planer'});
        PlanerDB.saveEvents(evts); this._drawCal(); Toast.success('Dodano wydarzenie');
      });
    });
  },

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  _E(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },
};

/* ─── Register with Router ────────────────────────────────────────────────── */
if (window.Router) {
  Router.titles['planer'] = 'Planer — Zadania & Kalendarz';
  Router._viewMap['planer'] = 'PlanerView';
}
