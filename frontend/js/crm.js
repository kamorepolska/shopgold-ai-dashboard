/* CRM Module */
window.CrmView={render:async function(){
var el=document.getElementById('view-crm');if(!el)return;
var s={};try{s=await API.get('/crm/dashboard')}catch(e){s={}}
var st=[];try{st=await API.get('/crm/statuses')}catch(e){}
var tm=[];try{tm=await API.get('/crm/team')}catch(e){}
var pr=[];try{pr=await API.get('/crm/projects')}catch(e){}
var cfd=[];try{cfd=await API.get('/crm/custom-fields')}catch(e){}
window._crmStatuses=st;window._crmTeam=tm;window._crmProjects=pr;window._crmFieldDefs=cfd;
el.innerHTML='<div class="crm-tabs">'+
'<div class="crm-tab" data-tab="tasks" onclick="CrmUI.showTab(\'tasks\')">'+
  '<div class="crm-tab-header"><span class="crm-tab-icon">📋</span><span class="crm-tab-title">Zadania</span></div>'+
  '<div class="crm-tab-stats">'+
    '<span class="crm-tab-mini-stat warning" title="Otwarte zadania (Moje / Wszystkie)">Otwarte: <strong>'+(s.my_open_tasks||0)+' / '+(s.open_tasks||0)+'</strong></span>'+
    '<span class="crm-tab-mini-stat danger" title="Zaległe zadania (Moje / Wszystkie)">Zaległe: <strong>'+(s.my_overdue_tasks||0)+' / '+(s.overdue_tasks||0)+'</strong></span>'+
    '<span class="crm-tab-mini-stat success" title="Przepracowany czas">Czas: <strong>'+(s.total_hours||0)+'h</strong></span>'+
  '</div>'+
'</div>'+
'<div class="crm-tab" data-tab="companies" onclick="CrmUI.showTab(\'companies\')">'+
  '<div class="crm-tab-header"><span class="crm-tab-icon">🏢</span><span class="crm-tab-title">Podmioty i Osoby</span></div>'+
  '<div class="crm-tab-stats">'+
    '<span class="crm-tab-mini-stat accent" title="Firmy">Firmy: <strong>'+(s.total_companies||0)+'</strong></span>'+
    '<span class="crm-tab-mini-stat" title="Kontakty">Kontakty: <strong>'+(s.total_contacts||0)+'</strong></span>'+
  '</div>'+
'</div>'+
'<div class="crm-tab" data-tab="team" onclick="CrmUI.showTab(\'team\')">'+
  '<div class="crm-tab-header"><span class="crm-tab-icon">👥</span><span class="crm-tab-title">Ekipa</span></div>'+
  '<div class="crm-tab-stats">'+
    '<span class="crm-tab-mini-stat" title="Liczba pracowników">Pracownicy: <strong>'+(tm.length||0)+'</strong></span>'+
  '</div>'+
'</div>'+
'</div>'+
'<div id="crm-content"></div>';
var savedTab = localStorage.getItem('sg_crm_active_tab') || 'tasks';
CrmUI.showTab(savedTab);
}};

window.CrmUI = {
  _E: function(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')},
  sanitizeHTML: function(html) { return window.sanitizeHTML(html); },
  formatDescription: function(desc) { return window.formatDescription(desc); },

  /* ── Default column visibility ─────────────────────────────────────────── */
  _defaultCols: function() {
    return {
      num:true, title:true, status:true, priority:true, assignee:true,
      company:true, progress:true, deadline:true, time_work:true,
      time_range:false, location:false
    };
  },
  getColVis: function() {
    try {
      var stored = localStorage.getItem('sg_crm_col_vis');
      if (stored) return Object.assign(CrmUI._defaultCols(), JSON.parse(stored));
    } catch(e) {}
    return CrmUI._defaultCols();
  },
  saveColVis: function(obj) {
    localStorage.setItem('sg_crm_col_vis', JSON.stringify(obj));
  },
  /* get extra custom-field columns (those toggled on) */
  getVisibleCFCols: function() {
    try {
      var stored = localStorage.getItem('sg_crm_cf_col_vis');
      return stored ? JSON.parse(stored) : {};
    } catch(e) { return {}; }
  },
  saveCFColVis: function(obj) {
    localStorage.setItem('sg_crm_cf_col_vis', JSON.stringify(obj));
  },

  showTab: function(tab) {
    localStorage.setItem('sg_crm_active_tab', tab);
    document.querySelectorAll('.crm-tab').forEach(function(t){
      t.classList.toggle('active', t.getAttribute('data-tab') === tab);
    });
    if(tab==='companies') CrmUI.renderCompanies();
    else if(tab==='tasks') {
      var view = localStorage.getItem('sg_crm_task_view') || 'list';
      if(view==='kanban') CrmUI.renderKanban();
      else CrmUI.renderTasks();
    }
    else if(tab==='team') CrmUI.renderTeam();
  },

  /* ── Project Helpers ──────────────────────────────────────────────────── */
  getActiveProjectId: function() {
    var stored = localStorage.getItem('sg_crm_active_project');
    var pr = window._crmProjects || [];
    if (!stored && pr.length) return pr[0].id;
    return stored ? parseInt(stored) : null;
  },
  setActiveProject: function(id) { localStorage.setItem('sg_crm_active_project', id); },
  getActiveProject: function() {
    var id = CrmUI.getActiveProjectId();
    var pr = window._crmProjects || [];
    return pr.find(function(p){ return p.id === id; }) || pr[0] || null;
  },

  /* ── Companies ────────────────────────────────────────────────────────── */
  renderCompanies: async function(search,page) {
    search=search||'';page=page||1;
    var el=document.getElementById('crm-content');if(!el)return;
    var E=CrmUI._E;
    try {
      var d=await API.get('/crm/companies?search='+encodeURIComponent(search)+'&page='+page);
      var r=d.companies||[];
      var h='<div class="crm-toolbar"><input class="form-input" id="crm-cs" placeholder="Szukaj firmy..." value="'+E(search)+'" style="flex:1;min-width:200px"><div style="display:flex;gap:6px"><button class="btn btn--ghost btn--sm" id="crm-imp-btn" title="Importuj z Excel/CSV">📥 Import</button><button class="btn btn--ghost btn--sm" id="crm-exp-btn" title="Eksportuj do Excel">📤 Eksport</button><button class="btn btn--primary" id="crm-ac">+ Dodaj firmę</button></div></div>';
      h+='<div class="crm-table-wrap"><table class="crm-table"><thead><tr><th>#</th><th>Nazwa</th><th>NIP</th><th>Miasto</th><th>Telefon</th><th>Email</th><th>Kontakty</th></tr></thead><tbody>';
      if(!r.length) h+='<tr><td colspan="7"><div class="crm-empty"><span class="icon">🏢</span><h3>Brak firm</h3></div></td></tr>';
      else r.forEach(function(c,i){h+='<tr onclick="CrmUI.showCompany('+c.id+')" style="cursor:pointer"><td>'+(i+1)+'</td><td style="font-weight:600">'+E(c.name)+'</td><td style="font-family:monospace">'+E(c.nip||'—')+'</td><td>'+E(c.city||'—')+'</td><td>'+E(c.phone||'—')+'</td><td>'+E(c.email||'—')+'</td><td>'+(c.contact_count||0)+'</td></tr>'});
      h+='</tbody></table></div>';
      var tp=Math.ceil((d.total||0)/(d.limit||50));
      if(tp>1)h+='<div class="crm-pager">'+(page>1?'<button class="btn btn--ghost btn--sm" onclick="CrmUI.renderCompanies(\''+E(search)+'\','+(page-1)+')">←</button>':'')+'<span>'+page+'/'+tp+'</span>'+(page<tp?'<button class="btn btn--ghost btn--sm" onclick="CrmUI.renderCompanies(\''+E(search)+'\','+(page+1)+')">→</button>':'')+'</div>';
      el.innerHTML=h;
      document.getElementById('crm-cs').addEventListener('input',function(e){clearTimeout(t);t=setTimeout(function(){CrmUI.renderCompanies(e.target.value,1)},300)});
      document.getElementById('crm-ac').addEventListener('click',function(){CrmUI.companyForm()});
      document.getElementById('crm-imp-btn')?.addEventListener('click',function(){CrmUI.importModal()});
      document.getElementById('crm-exp-btn')?.addEventListener('click',function(){CrmUI.exportExcel()});
    }catch(e){el.innerHTML='<p style="color:#ef4444">'+E(e.message)+'</p>'}
  },
  companyForm: function(c) {
    var E=CrmUI._E,isE=!!c;
    Modal.show({title:isE?'Edytuj firmę':'Nowa firma',body:'<div class="crm-form"><div class="crm-form-row"><div class="crm-form-group"><label>Nazwa *</label><input id="cf-n" value="'+E(c&&c.name||'')+'"></div><div class="crm-form-group"><label>NIP</label><div style="display:flex;gap:6px"><input id="cf-nip" value="'+E(c&&c.nip||'')+'" style="flex:1"><button class="btn btn--secondary btn--sm" id="cf-gus-btn" type="button" style="padding:0 10px;font-size:0.75rem;min-height:36px;white-space:nowrap" title="Pobierz dane z GUS">GUS 🔍</button></div></div></div><div class="crm-form-row"><div class="crm-form-group"><label>Adres</label><input id="cf-a" value="'+E(c&&c.address||'')+'"></div><div class="crm-form-group"><label>Miasto</label><input id="cf-c" value="'+E(c&&c.city||'')+'"></div></div><div class="crm-form-row"><div class="crm-form-group"><label>Kod</label><input id="cf-p" value="'+E(c&&c.postal_code||'')+'"></div><div class="crm-form-group"><label>Telefon</label><input id="cf-ph" value="'+E(c&&c.phone||'')+'"></div></div><div class="crm-form-row"><div class="crm-form-group"><label>Email</label><input id="cf-e" value="'+E(c&&c.email||'')+'"></div><div class="crm-form-group"><label>WWW</label><input id="cf-w" value="'+E(c&&c.website||'')+'"></div></div><div class="crm-form-group"><label>Notatki</label><div class="rich-editor"><div class="rich-editor-toolbar"><button type="button" class="rich-editor-btn" data-cmd="bold" title="Pogrubienie"><b>B</b></button><button type="button" class="rich-editor-btn" data-cmd="italic" title="Kursywa"><i>I</i></button><button type="button" class="rich-editor-btn" data-cmd="underline" title="Podkreślenie"><u>U</u></button><button type="button" class="rich-editor-btn" data-cmd="insertUnorderedList" title="Lista punktowana">• Lista</button><button type="button" class="rich-editor-btn" data-cmd="insertOrderedList" title="Lista numerowana">1. Lista</button><button type="button" class="rich-editor-btn" data-cmd="formatBlock" data-val="blockquote" title="Cytat">❝ Cytat</button><button type="button" class="rich-editor-btn" data-cmd="removeFormat" title="Wyczyść formatowanie">✕</button></div><div id="cf-no-editor" class="rich-editor-content" contenteditable="true">'+CrmUI.formatDescription(c&&c.notes||'')+'</div></div></div></div>',footer:'<button class="btn btn--primary" id="cf-s">'+(isE?'Zapisz':'Dodaj')+'</button>'});
    var companyEditor = document.getElementById('cf-no-editor');
    if (companyEditor) {
      document.querySelectorAll('.rich-editor-toolbar .rich-editor-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          document.execCommand(btn.getAttribute('data-cmd'), false, btn.getAttribute('data-val') || null);
          companyEditor.focus();
        });
      });
    }
    var gusBtn = document.getElementById('cf-gus-btn');
    if (gusBtn) {
      gusBtn.addEventListener('click', async function() {
        var nipVal = document.getElementById('cf-nip').value.trim().replace(/\D/g, '');
        if (!nipVal || nipVal.length !== 10) { Toast.warn('Wpisz poprawny 10-cyfrowy NIP'); return; }
        gusBtn.disabled = true; gusBtn.textContent = '⏳';
        try {
          var res = await API.get('/crm/gus?nip=' + encodeURIComponent(nipVal));
          if (res.name) document.getElementById('cf-n').value = res.name;
          if (res.address) document.getElementById('cf-a').value = res.address;
          if (res.city) document.getElementById('cf-c').value = res.city;
          if (res.postal_code) document.getElementById('cf-p').value = res.postal_code;
          if (res.phone) document.getElementById('cf-ph').value = res.phone;
          if (res.email) document.getElementById('cf-e').value = res.email;
          if (res.website) document.getElementById('cf-w').value = res.website;
          if (res.notes) {
            var notesEl = document.getElementById('cf-no-editor');
            if (notesEl) notesEl.innerHTML = (notesEl.innerHTML ? notesEl.innerHTML + '<br>' : '') + CrmUI.formatDescription(res.notes);
          }
          Toast.success('Pobrano dane z GUS/MF');
        } catch(e) { Toast.error('Błąd: ' + e.message); }
        finally { gusBtn.disabled = false; gusBtn.textContent = 'GUS 🔍'; }
      });
    }
    document.getElementById('cf-s').addEventListener('click',async function(){
      var d={name:document.getElementById('cf-n').value.trim(),nip:document.getElementById('cf-nip').value.trim(),address:document.getElementById('cf-a').value.trim(),city:document.getElementById('cf-c').value.trim(),postal_code:document.getElementById('cf-p').value.trim(),phone:document.getElementById('cf-ph').value.trim(),email:document.getElementById('cf-e').value.trim(),website:document.getElementById('cf-w').value.trim(),notes:document.getElementById('cf-no-editor').innerHTML.trim()};
      if(!d.name){Toast.warn('Podaj nazwę');return}
      try{if(isE)await API.put('/crm/companies/'+c.id,d);else await API.post('/crm/companies',d);Modal.hide();Toast.success(isE?'Zapisano':'Dodano');CrmView.render()}catch(e){Toast.error(e.message)}
    });
  },
  showCompany: async function(id) {
    var E=CrmUI._E;
    try {
      var c=await API.get('/crm/companies/'+id);
      window._activeCrmCompany = c;
      var ch=(c.contacts||[]).map(function(ct){return '<div class="crm-contact-card"><div class="crm-contact-avatar" style="background:'+['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6'][ct.id%5]+'">'+E((ct.first_name||'?')[0])+'</div><div class="crm-contact-info"><div class="crm-contact-name">'+E(ct.first_name)+' '+E(ct.last_name)+'</div><div class="crm-contact-meta">'+E(ct.position||'')+(ct.phone?' · '+E(ct.phone):'')+(ct.email?' · '+E(ct.email):'')+' </div></div><button class="btn btn--ghost btn--sm" onclick="event.stopPropagation();CrmUI.contactForm('+id+','+ct.id+')">✏️</button><button class="btn btn--ghost btn--sm" onclick="event.stopPropagation();CrmUI.delContact('+ct.id+','+id+')">🗑️</button></div>'}).join('')||'<p style="color:var(--text-muted);font-size:.82rem">Brak kontaktów</p>';
      Modal.show({title:'🏢 '+c.name,wide:true,body:'<div class="crm-profile-grid" style="margin-bottom:20px"><div class="crm-profile-field"><label>NIP</label><span>'+E(c.nip||'—')+'</span></div><div class="crm-profile-field"><label>Adres</label><span>'+E(c.address||'—')+', '+E(c.city||'')+'</span></div><div class="crm-profile-field"><label>Telefon</label><span>'+E(c.phone||'—')+'</span></div><div class="crm-profile-field"><label>Email</label><span>'+E(c.email||'—')+'</span></div>'+(c.notes?'<div class="crm-profile-field" style="grid-column:span 2;margin-top:10px"><label>Notatki wewnętrzne</label><div class="crm-task-description-content" style="padding:12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;font-size:.85rem;line-height:1.5;margin-top:4px">'+CrmUI.formatDescription(c.notes)+'</div></div>':'')+'</div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h4 style="margin:0">👤 Kontakty ('+(c.contacts||[]).length+')</h4><button class="btn btn--primary btn--sm" onclick="CrmUI.contactForm('+id+')">+ Dodaj</button></div><div style="display:flex;flex-direction:column;gap:6px">'+ch+'</div>',footer:'<button class="btn btn--ghost" onclick="Modal.hide();CrmUI.companyForm(window._activeCrmCompany)">✏️ Edytuj</button><button class="btn btn--ghost" style="color:#ef4444" onclick="CrmUI.delCompany('+id+')">🗑️ Usuń</button>'});
    }catch(e){Toast.error(e.message)}
  },
  delCompany: async function(id){if(!confirm('Usunąć?'))return;await API.del('/crm/companies/'+id);Modal.hide();Toast.success('Usunięto');CrmView.render()},
  contactForm: function(compId,ctOrId) {
    var E=CrmUI._E;
    var ct = null;
    if (ctOrId) {
      if (typeof ctOrId === 'object') { ct = ctOrId; }
      else if (window._activeCrmCompany && window._activeCrmCompany.contacts) {
        ct = window._activeCrmCompany.contacts.find(function(x){return x.id === ctOrId});
      }
    }
    var isE = !!ct;
    Modal.show({title:isE?'Edytuj kontakt':'Nowy kontakt',body:'<div class="crm-form"><div class="crm-form-row"><div class="crm-form-group"><label>Imię *</label><input id="cc-fn" value="'+E(ct&&ct.first_name||'')+'"></div><div class="crm-form-group"><label>Nazwisko *</label><input id="cc-ln" value="'+E(ct&&ct.last_name||'')+'"></div></div><div class="crm-form-row"><div class="crm-form-group"><label>Email</label><input id="cc-e" value="'+E(ct&&ct.email||'')+'"></div><div class="crm-form-group"><label>Telefon</label><input id="cc-ph" value="'+E(ct&&ct.phone||'')+'"></div></div><div class="crm-form-group"><label>Stanowisko</label><input id="cc-po" value="'+E(ct&&ct.position||'')+'"></div></div>',footer:'<button class="btn btn--primary" id="cc-s">'+(isE?'Zapisz':'Dodaj')+'</button>'});
    document.getElementById('cc-s').addEventListener('click',async function(){
      var d={company_id:compId,first_name:document.getElementById('cc-fn').value.trim(),last_name:document.getElementById('cc-ln').value.trim(),email:document.getElementById('cc-e').value.trim(),phone:document.getElementById('cc-ph').value.trim(),position:document.getElementById('cc-po').value.trim()};
      if(!d.first_name||!d.last_name){Toast.warn('Podaj imię i nazwisko');return}
      try{if(isE)await API.put('/crm/contacts/'+ct.id,d);else await API.post('/crm/contacts',d);Modal.hide();Toast.success(isE?'Zapisano':'Dodano');CrmUI.showCompany(compId)}catch(e){Toast.error(e.message)}
    });
  },
  delContact: async function(id,compId){if(!confirm('Usunąć?'))return;await API.del('/crm/contacts/'+id);Toast.success('Usunięto');CrmUI.showCompany(compId)},

  filterTasks: function(statusId) {
    localStorage.setItem('sg_crm_task_status_filter', statusId);
    CrmUI.renderTasks();
  },

  /* ── Column visibility picker ─────────────────────────────────────────── */
  showColPicker: function() {
    var vis = CrmUI.getColVis();
    var cfVis = CrmUI.getVisibleCFCols();
    var cfd = window._crmFieldDefs || [];

    var sysCols = [
      {key:'status',    label:'Status'},
      {key:'priority',  label:'Priorytet'},
      {key:'assignee',  label:'Przypisany'},
      {key:'company',   label:'Firma'},
      {key:'progress',  label:'Progres'},
      {key:'deadline',  label:'Deadline'},
      {key:'time_work', label:'Czas pracy'},
      {key:'time_range',label:'Czas od/do'},
      {key:'location',  label:'Lokalizacja'},
    ];
    var sysRows = sysCols.map(function(c){
      return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:.85rem">'+
             '<input type="checkbox" id="colvis-'+c.key+'"'+(vis[c.key]?' checked':'')+' style="width:15px;height:15px;accent-color:var(--accent)"> '+
             c.label+'</label>';
    }).join('');

    var cfRows = cfd.map(function(f){
      return '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:.85rem">'+
             '<input type="checkbox" id="colvis-cf-'+f.id+'"'+(cfVis[f.id]?' checked':'')+' style="width:15px;height:15px;accent-color:var(--accent)"> '+
             '📌 '+CrmUI._E(f.name)+'</label>';
    }).join('');

    Modal.show({
      title: '⚙️ Widoczność kolumn',
      body:
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">'+
        '<div><div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Kolumny systemowe</div>'+sysRows+'</div>'+
        (cfd.length ? '<div><div style="font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">Pola dodatkowe</div>'+cfRows+'</div>' : '')+
        '</div>'+
        '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">'+
        '<button class="btn btn--secondary btn--sm" id="col-manage-fields-btn" style="font-size:.78rem">⚙️ Zarządzaj polami dodatkowymi</button></div>',
      footer: '<button class="btn btn--primary" id="colvis-save">Zapisz</button>'
    });

    document.getElementById('colvis-save').addEventListener('click', function() {
      var newVis = {};
      sysCols.forEach(function(c){ newVis[c.key] = document.getElementById('colvis-'+c.key).checked; });
      newVis.num = true; newVis.title = true;
      CrmUI.saveColVis(newVis);
      var newCfVis = {};
      cfd.forEach(function(f){ newCfVis[f.id] = document.getElementById('colvis-cf-'+f.id).checked; });
      CrmUI.saveCFColVis(newCfVis);
      Modal.hide();
      CrmUI.renderTasks();
    });
    document.getElementById('col-manage-fields-btn').addEventListener('click', function(){
      Modal.hide();
      setTimeout(function(){ CrmUI.customFieldsManager(); }, 150);
    });
  },

  /* ── Task List ────────────────────────────────────────────────────────── */
  renderTasks: async function(search,page) {
    search=search||'';page=page||1;
    var el=document.getElementById('crm-content');if(!el)return;
    var E=CrmUI._E,st=window._crmStatuses||[];
    var activeStatus = localStorage.getItem('sg_crm_task_status_filter') || 'all';
    var projId = CrmUI.getActiveProjectId();
    var vis = CrmUI.getColVis();
    var cfVis = CrmUI.getVisibleCFCols();
    var cfd = window._crmFieldDefs || [];
    var visibleCfDefs = cfd.filter(function(f){ return cfVis[f.id]; });

    try {
      var statusParam = activeStatus !== 'all' ? '&status_id=' + activeStatus : '';
      var projParam = projId ? '&project_id=' + projId : '';
      var myFilter = localStorage.getItem('sg_crm_task_my_filter') === 'true';
      var myParam = myFilter ? '&my=true' : '';
      var d=await API.get('/crm/tasks?search='+encodeURIComponent(search)+'&page='+page+'&limit=50' + statusParam + projParam + myParam);
      var r=d.tasks||[];
      var priL={urgent:'🔴 Pilne',high:'🟠 Ważne',normal:'🔵 Normalne',low:'⚪ Niskie'};
      var priC={urgent:'urgent',high:'high',normal:'normal',low:'low'};
      var pb = CrmUI._buildProjectBar();
      var myBtnHtml = '<button class="btn ' + (myFilter ? 'btn--primary' : 'btn--secondary') + ' btn--sm" id="crm-my-tasks-btn" title="Filtruj moje zadania" style="white-space:nowrap">' + (myFilter ? '👤 Moje' : '👥 Wszyscy') + '</button>';
      var h='<div class="crm-toolbar">'+pb+'<div class="crm-toolbar-sep"></div>' + myBtnHtml + '<input class="form-input" id="crm-ts" placeholder="Szukaj zadań..." value="'+E(search)+'" style="flex:1;min-width:180px"><button class="btn btn--ghost btn--sm" id="crm-col-btn" title="Kolumny">⚙️</button><button class="btn btn--ghost btn--sm" id="crm-tv" title="Widok">📊 Kanban</button><button class="btn btn--primary btn--sm" id="crm-at">+ Nowe</button></div>';
      // Status tabs
      h+='<div class="crm-list-tabs">';
      h+='<div class="crm-list-tab'+(activeStatus==='all'?' active':'')+'\" onclick="CrmUI.filterTasks(\'all\')">🌈 Wszystkie</div>';
      st.forEach(function(s){
        var isAct = String(s.id) === String(activeStatus);
        h+='<div class="crm-list-tab'+(isAct?' active':'')+'\" onclick="CrmUI.filterTasks('+s.id+')">'+
           '<span class="status-dot" style="background:'+E(s.color)+'"></span>'+
           '<span>'+E(s.name)+'</span>'+
           (!s.is_default ? '<span class="del-list-btn" onclick="event.stopPropagation();CrmUI.delStatus('+s.id+',\''+E(s.name)+'\')" title="Usuń listę">✕</span>' : '')+
           '</div>';
      });
      h+='<button class="crm-add-list-btn" onclick="CrmUI.statusForm()">+ Nowa lista</button>';
      h+='</div>';

      // Table header
      h+='<div class="crm-table-wrap"><table class="crm-table"><thead><tr>';
      if(vis.num)     h+='<th>#</th>';
      if(vis.title)   h+='<th>Tytuł</th>';
      if(vis.status)  h+='<th>Status</th>';
      if(vis.priority)h+='<th>Priorytet</th>';
      if(vis.assignee)h+='<th>Przypisany</th>';
      if(vis.company) h+='<th>Firma</th>';
      if(vis.progress)h+='<th>Progres</th>';
      if(vis.deadline)h+='<th>Deadline</th>';
      if(vis.time_work) h+='<th>Czas</th>';
      if(vis.time_range)h+='<th>Godz. od/do</th>';
      if(vis.location)  h+='<th>Lokalizacja</th>';
      visibleCfDefs.forEach(function(f){ h+='<th>'+E(f.name)+'</th>'; });
      h+='</tr></thead><tbody>';

      var colCount = Object.values(vis).filter(Boolean).length + visibleCfDefs.length;
      if(!r.length) h+='<tr><td colspan="'+colCount+'"><div class="crm-empty"><span class="icon">📋</span><h3>Brak zadań</h3></div></td></tr>';
      else r.forEach(function(t,i){
        var pct=t.progress||0;
        var dl=t.deadline?new Date(t.deadline).toLocaleDateString('pl-PL'):'—';
        var isOverdue=t.deadline&&!t.completed_at&&new Date(t.deadline)<new Date();
        var mins=t.total_minutes||0;var th2=Math.floor(mins/60),tm2=mins%60;
        var cfs = [];
        try { cfs = typeof t.custom_fields === 'string' ? JSON.parse(t.custom_fields||'[]') : (t.custom_fields||[]); } catch(e){}
        var locIcon = t.location_type === 'onsite' ? '📍 Na miejscu' : '💻 Zdalnie';
        h+='<tr onclick="CrmUI.showTask('+t.id+')" style="cursor:pointer">';
        if(vis.num)     h+='<td>'+(i+1)+'</td>';
        if(vis.title)   h+='<td style="font-weight:600;max-width:250px;overflow:hidden;text-overflow:ellipsis">'+E(t.title)+'</td>';
        if(vis.status)  h+='<td><span class="crm-status-badge" style="background:'+E(t.status_color||'#6b7280')+'22;color:'+E(t.status_color||'#6b7280')+'">'+E(t.status_name||'—')+'</span></td>';
        if(vis.priority)h+='<td><span class="crm-priority '+priC[t.priority]+'">'+E(priL[t.priority]||t.priority)+'</span></td>';
        if(vis.assignee)h+='<td>'+E(t.assignee_name||'—')+'</td>';
        if(vis.company) h+='<td>'+E(t.company_name||'—')+'</td>';
        if(vis.progress)h+='<td><div class="crm-progress-wrap"><div class="crm-progress-bar"><div class="crm-progress-fill" style="width:'+pct+'%"></div></div><span class="crm-progress-label">'+pct+'%</span></div></td>';
        if(vis.deadline)h+='<td style="'+(isOverdue?'color:#ef4444;font-weight:600':'')+'">'+dl+'</td>';
        if(vis.time_work) h+='<td style="font-family:monospace;font-size:.78rem">'+th2+'h '+tm2+'m</td>';
        if(vis.time_range)h+='<td style="font-size:.78rem;white-space:nowrap">'+(t.time_from||t.time_to ? (t.time_from||'—')+'–'+(t.time_to||'—') : '—')+'</td>';
        if(vis.location)  h+='<td style="font-size:.78rem;white-space:nowrap">'+(t.location_type ? locIcon : '—')+'</td>';
        visibleCfDefs.forEach(function(f){
          var found = cfs.find(function(x){ return x.def_id === f.id || x.name === f.name; });
          h+='<td style="font-size:.8rem">'+E(found ? found.value : '—')+'</td>';
        });
        h+='</tr>';
      });
      h+='</tbody></table></div>';
      el.innerHTML=h;
      CrmUI._bindProjectBar();
      var t2;document.getElementById('crm-ts').addEventListener('input',function(e){clearTimeout(t2);t2=setTimeout(function(){CrmUI.renderTasks(e.target.value,1)},300)});
      document.getElementById('crm-my-tasks-btn').addEventListener('click', function() {
        var newVal = !myFilter;
        localStorage.setItem('sg_crm_task_my_filter', newVal ? 'true' : 'false');
        CrmUI.renderTasks(search, page);
      });
      document.getElementById('crm-at').addEventListener('click',function(){CrmUI.taskForm()});
      document.getElementById('crm-col-btn').addEventListener('click',function(){ CrmUI.showColPicker(); });
      document.getElementById('crm-tv').addEventListener('click',function(){
        localStorage.setItem('sg_crm_task_view', 'kanban');
        CrmUI.renderKanban();
      });
    }catch(e){el.innerHTML='<p style="color:#ef4444">'+E(e.message)+'</p>'}
  },

  /* ── Kanban ───────────────────────────────────────────────────────────── */
  renderKanban: async function() {
    var el=document.getElementById('crm-content');if(!el)return;
    var E=CrmUI._E,st=window._crmStatuses||[];
    var projId = CrmUI.getActiveProjectId();
    try {
      var projParam = projId ? '&project_id=' + projId : '';
      var myFilter = localStorage.getItem('sg_crm_task_my_filter') === 'true';
      var myParam = myFilter ? '&my=true' : '';
      var d=await API.get('/crm/tasks?limit=200' + projParam + myParam);
      var tasks=d.tasks||[];
      var pb = CrmUI._buildProjectBar();
      var myBtnHtml = '<button class="btn ' + (myFilter ? 'btn--primary' : 'btn--secondary') + ' btn--sm" id="crm-my-tasks-btn" title="Filtruj moje zadania" style="white-space:nowrap">' + (myFilter ? '👤 Moje' : '👥 Wszyscy') + '</button>';
      var h='<div class="crm-toolbar">'+pb+'<div class="crm-toolbar-sep"></div>' + myBtnHtml + '<button class="btn btn--ghost btn--sm" id="crm-tl">📋 Lista</button><button class="btn btn--secondary btn--sm" id="crm-add-col-btn">+ Lista</button><button class="btn btn--primary btn--sm" id="crm-at2">+ Nowe</button></div><div class="crm-kanban">';
      st.forEach(function(s){
        var col=tasks.filter(function(t){return t.status_id===s.id});
        h+='<div class="crm-kanban-col"><div class="crm-kanban-header" style="border-top:3px solid '+E(s.color)+'; display:flex; justify-content:space-between; align-items:center; gap:8px">'+
           '<span style="font-weight:700; flex:1; text-overflow:ellipsis; overflow:hidden; white-space:nowrap" title="'+E(s.name)+'">'+E(s.name)+'</span>'+
           '<div style="display:flex; align-items:center; gap:6px">'+
           '<span class="count">'+col.length+'</span>'+
           (st.length > 1 ? '<button class="btn btn--ghost btn--sm" onclick="event.stopPropagation();CrmUI.delStatus('+s.id+',\''+E(s.name)+'\')" style="padding:2px 4px;margin:0;color:#ef4444;font-size:0.75rem;min-height:auto" title="Usuń listę">🗑️</button>' : '')+
           '</div>'+
           '</div><div class="crm-kanban-body" data-status="'+s.id+'" ondragover="event.preventDefault();this.classList.add(&quot;drag-over&quot;)" ondragleave="this.classList.remove(&quot;drag-over&quot;)" ondrop="CrmUI.kanbanDrop(event,'+s.id+')">';
        col.forEach(function(t){
          var priI={urgent:'🔴',high:'🟠',normal:'🔵',low:'⚪'};
          var cfs = [];
          try { cfs = typeof t.custom_fields === 'string' ? JSON.parse(t.custom_fields||'[]') : (t.custom_fields||[]); } catch(e){}
          var cfsHtml = '';
          if (Array.isArray(cfs) && cfs.length > 0) {
            cfsHtml = '<div class="crm-card-custom-fields">';
            cfs.forEach(function(cf) {
              if (cf.name && cf.value) {
                cfsHtml += '<div class="crm-card-custom-field-item">'+
                           '<span class="crm-card-custom-field-label">'+E(cf.name)+':</span>'+
                           '<span class="crm-card-custom-field-value">'+E(cf.value)+'</span>'+
                           '</div>';
              }
            });
            cfsHtml += '</div>';
          }
          var extraBadges = '';
          if (t.time_from || t.time_to) {
            extraBadges += '<span class="crm-card-badge">🕐 '+(t.time_from||'—')+'–'+(t.time_to||'—')+'</span>';
          }
          if (t.location_type === 'onsite') {
            extraBadges += '<span class="crm-card-badge onsite">📍 Na miejscu</span>';
          }
          h+='<div class="crm-kanban-card" draggable="true" ondragstart="CrmUI.kanbanDrag(event,'+t.id+')" onclick="CrmUI.showTask('+t.id+')" style="border-left-color:'+E(s.color)+'"><div class="crm-kanban-card-title">'+E(t.title)+'</div><div class="crm-kanban-card-meta">'+(priI[t.priority]||'')+' '+(t.assignee_name?'<span class="crm-kanban-card-assignee"><span class="avatar-dot" style="background:'+(t.assignee_color||'#6366f1')+'">'+E((t.assignee_name||'?')[0])+'</span>'+E(t.assignee_name)+'</span>':'')+(t.deadline?' · '+new Date(t.deadline).toLocaleDateString('pl-PL'):'')+extraBadges+'</div><div class="crm-progress-wrap" style="margin-top:6px"><div class="crm-progress-bar"><div class="crm-progress-fill" style="width:'+(t.progress||0)+'%"></div></div><span class="crm-progress-label">'+(t.progress||0)+'%</span></div>'+cfsHtml+'</div>';
        });
        h+='</div></div>';
      });
      h+='</div>';
      el.innerHTML=h;
      CrmUI._bindProjectBar();
      document.getElementById('crm-my-tasks-btn').addEventListener('click', function() {
        var newVal = !myFilter;
        localStorage.setItem('sg_crm_task_my_filter', newVal ? 'true' : 'false');
        CrmUI.renderKanban();
      });
      document.getElementById('crm-tl').addEventListener('click',function(){ localStorage.setItem('sg_crm_task_view', 'list'); CrmUI.renderTasks(); });
      document.getElementById('crm-add-col-btn').addEventListener('click',function(){CrmUI.statusForm()});
      document.getElementById('crm-at2').addEventListener('click',function(){CrmUI.taskForm()});
    }catch(e){el.innerHTML='<p style="color:#ef4444">'+E(e.message)+'</p>'}
  },
  _dragTaskId:null,
  kanbanDrag:function(e,id){CrmUI._dragTaskId=id;e.dataTransfer.effectAllowed='move'},
  kanbanDrop:async function(e,statusId){
    e.preventDefault();e.currentTarget.classList.remove('drag-over');
    if(!CrmUI._dragTaskId)return;
    try{await API.put('/crm/tasks/'+CrmUI._dragTaskId,{status_id:statusId});CrmUI.renderKanban()}catch(er){Toast.error(er.message)}
  },

  /* ── Task Form ────────────────────────────────────────────────────────── */
  taskForm: async function(task) {
    var E=CrmUI._E,isE=!!task,st=window._crmStatuses||[],tm=window._crmTeam||[];
    var cfd = window._crmFieldDefs || [];
    var comps=[];try{var cd=await API.get('/crm/companies?limit=500');comps=cd.companies||[]}catch(e){}
    var stOpts=st.map(function(s){return '<option value="'+s.id+'"'+(task&&task.status_id===s.id?' selected':'')+'> '+E(s.name)+'</option>'}).join('');
    var tmOpts='<option value="">— Brak —</option>'+tm.map(function(m){return '<option value="'+m.id+'"'+(task&&task.assignee_id===m.id?' selected':'')+'> '+E(m.display_name)+'</option>'}).join('');
    var coOpts='<option value="">— Brak —</option>'+comps.map(function(c){return '<option value="'+c.id+'"'+(task&&task.company_id===c.id?' selected':'')+'> '+E(c.name)+'</option>'}).join('');
    var priOpts=['low','normal','high','urgent'].map(function(p2){return '<option value="'+p2+'"'+(task&&task.priority===p2?' selected':(!task&&p2==='normal'?' selected':''))+'>{low:\'Niski\',normal:\'Normalny\',high:\'Wysoki\',urgent:\'Pilny\'}["'+p2+'"]</option>'}).join('').replace(/\{[^}]+\}\["(\w+)"\]/g, function(m, k){ return {low:'Niski',normal:'Normalny',high:'Wysoki',urgent:'Pilny'}[k]; });
    var locVal = task ? (task.location_type || 'remote') : 'remote';

    Modal.show({title:isE?'Edytuj zadanie':'Nowe zadanie',wide:true,body:
      '<div class="crm-form">'+
      '<div class="crm-form-group"><label>Tytuł *</label><input id="ct-t" value="'+E(task&&task.title||'')+'"></div>'+
      '<div class="crm-form-row">'+
        '<div class="crm-form-group"><label>Status</label><select id="ct-st">'+stOpts+'</select></div>'+
        '<div class="crm-form-group"><label>Priorytet</label><select id="ct-pr">'+priOpts+'</select></div>'+
      '</div>'+
      '<div class="crm-form-row">'+
        '<div class="crm-form-group"><label>Przypisany do</label><select id="ct-as">'+tmOpts+'</select></div>'+
        '<div class="crm-form-group"><label>Firma (klient)</label><select id="ct-co">'+coOpts+'</select></div>'+
      '</div>'+
      '<div class="crm-form-row">'+
        '<div class="crm-form-group"><label>Deadline</label><input id="ct-dl" type="date" value="'+(task&&task.deadline?task.deadline.slice(0,10):'')+'"></div>'+
        '<div class="crm-form-group"><label>Progres (%)</label><input id="ct-pg" type="range" min="0" max="100" value="'+(task&&task.progress||0)+'" oninput="document.getElementById(\'ct-pgv\').textContent=this.value+\'%\'"><span id="ct-pgv">'+(task&&task.progress||0)+'%</span></div>'+
      '</div>'+
      // NEW: Time from/to + Location
      '<div class="crm-form-row crm-form-section-divider" style="margin-top:4px">'+
        '<div class="crm-form-group">'+
          '<label>⏰ Czas od</label>'+
          '<input id="ct-tf" type="time" value="'+E(task&&task.time_from||'')+'">'+
        '</div>'+
        '<div class="crm-form-group">'+
          '<label>⏰ Czas do</label>'+
          '<input id="ct-tt" type="time" value="'+E(task&&task.time_to||'')+'">'+
        '</div>'+
        '<div class="crm-form-group">'+
          '<label>📍 Realizacja</label>'+
          '<div class="crm-location-toggle" id="ct-loc-wrap">'+
            '<button type="button" class="crm-loc-btn'+(locVal==='remote'?' active':'')+'" id="ct-loc-remote" data-val="remote">💻 Zdalnie</button>'+
            '<button type="button" class="crm-loc-btn'+(locVal==='onsite'?' active':'')+'" id="ct-loc-onsite" data-val="onsite">📍 Na miejscu</button>'+
          '</div>'+
          '<input type="hidden" id="ct-loc" value="'+locVal+'">'+
        '</div>'+
      '</div>'+
      // Description
      '<div class="crm-form-group"><label>Opis (użyj @login dla oznaczeń)</label>'+
      '<div class="rich-editor"><div class="rich-editor-toolbar">'+
      '<button type="button" class="rich-editor-btn" data-cmd="bold" title="Pogrubienie"><b>B</b></button>'+
      '<button type="button" class="rich-editor-btn" data-cmd="italic" title="Kursywa"><i>I</i></button>'+
      '<button type="button" class="rich-editor-btn" data-cmd="underline" title="Podkreślenie"><u>U</u></button>'+
      '<button type="button" class="rich-editor-btn" data-cmd="insertUnorderedList" title="Lista punktowana">• Lista</button>'+
      '<button type="button" class="rich-editor-btn" data-cmd="insertOrderedList" title="Lista numerowana">1. Lista</button>'+
      '<button type="button" class="rich-editor-btn" data-cmd="formatBlock" data-val="blockquote" title="Cytat">❝ Cytat</button>'+
      '<button type="button" class="rich-editor-btn" data-cmd="removeFormat" title="Wyczyść formatowanie">✕</button>'+
      '</div><div id="ct-desc-editor" class="rich-editor-content" contenteditable="true">'+CrmUI.formatDescription(task&&task.description||'')+'</div></div></div>'+
      // Custom fields section
      '<div class="crm-form-group" style="margin-top:10px">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
          '<label style="margin:0">📌 Pola dodatkowe</label>'+
          '<button type="button" class="btn btn--ghost btn--sm" id="ct-manage-fields" style="font-size:.72rem;padding:3px 8px">⚙️ Zarządzaj</button>'+
        '</div>'+
        (cfd.length > 0 ?
          '<div id="ct-defined-fields" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px"></div>' : '')+
        '<div id="ct-custom-fields-container" style="display:flex; flex-direction:column; gap:6px;"></div>'+
        '<button type="button" class="btn btn--secondary btn--sm" onclick="CrmUI.addCustomFieldInput()" style="margin-top:6px; max-width:220px; min-height:30px; font-size:0.75rem;">+ Dodaj pole ad hoc</button>'+
      '</div>'+
      '</div>',
      footer:'<button class="btn btn--primary" id="ct-s">'+(isE?'Zapisz':'Utwórz')+'</button>'
    });

    // Rich editor
    var editor = document.getElementById('ct-desc-editor');
    if (editor) {
      document.querySelectorAll('.rich-editor-toolbar .rich-editor-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          document.execCommand(btn.getAttribute('data-cmd'), false, btn.getAttribute('data-val') || null);
          editor.focus();
        });
      });
    }

    // Location toggle
    document.getElementById('ct-loc-wrap').addEventListener('click', function(e) {
      var btn = e.target.closest('.crm-loc-btn');
      if (!btn) return;
      document.querySelectorAll('.crm-loc-btn').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('ct-loc').value = btn.getAttribute('data-val');
    });

    // Manage fields button
    document.getElementById('ct-manage-fields').addEventListener('click', function(){
      Modal.hide();
      setTimeout(function(){ CrmUI.customFieldsManager(function(){ CrmUI.taskForm(task); }); }, 150);
    });

    // Populate existing custom fields
    var cFields = [];
    if (isE && task.custom_fields) {
      try { cFields = typeof task.custom_fields === 'string' ? JSON.parse(task.custom_fields||'[]') : (task.custom_fields||[]); } catch(e){}
    }
    // Render defined fields (from template)
    if (cfd.length > 0) {
      var defContainer = document.getElementById('ct-defined-fields');
      if (defContainer) {
        cfd.forEach(function(f) {
          var existing = cFields.find(function(x){ return x.def_id === f.id || x.name === f.name; });
          var val = existing ? existing.value : '';
          var opts = [];
          try { opts = typeof f.options === 'string' ? JSON.parse(f.options||'[]') : (f.options||[]); } catch(e){}
          var inputHtml = '';
          if (f.field_type === 'select' && opts.length) {
            inputHtml = '<select class="form-input def-cf-value" data-def-id="'+f.id+'" data-def-name="'+E(f.name)+'" style="flex:1;font-size:.8rem">'+
                        '<option value="">— Nie wybrano —</option>'+
                        opts.map(function(o){ return '<option value="'+E(o)+'"'+(val===o?' selected':'')+'>'+E(o)+'</option>'; }).join('')+
                        '</select>';
          } else if (f.field_type === 'date') {
            inputHtml = '<input class="form-input def-cf-value" type="date" data-def-id="'+f.id+'" data-def-name="'+E(f.name)+'" value="'+E(val)+'" style="flex:1;font-size:.8rem">';
          } else if (f.field_type === 'number') {
            inputHtml = '<input class="form-input def-cf-value" type="number" data-def-id="'+f.id+'" data-def-name="'+E(f.name)+'" value="'+E(val)+'" style="flex:1;font-size:.8rem">';
          } else {
            inputHtml = '<input class="form-input def-cf-value" type="text" data-def-id="'+f.id+'" data-def-name="'+E(f.name)+'" value="'+E(val)+'" style="flex:1;font-size:.8rem">';
          }
          var row = document.createElement('div');
          row.style = 'display:flex;gap:8px;align-items:center';
          row.innerHTML = '<span style="min-width:130px;font-size:.8rem;font-weight:600;color:var(--text-secondary)">'+E(f.name)+'</span>'+inputHtml;
          defContainer.appendChild(row);
        });
      }
    }
    // Populate ad-hoc custom fields (those without def_id)
    if (Array.isArray(cFields)) {
      cFields.filter(function(cf){ return !cf.def_id; }).forEach(function(cf) {
        CrmUI.addCustomFieldInput(cf.name, cf.value);
      });
    }

    document.getElementById('ct-s').addEventListener('click',async function(){
      // Collect defined fields
      var customFieldsList = [];
      document.querySelectorAll('.def-cf-value').forEach(function(inp) {
        var val = inp.value.trim();
        customFieldsList.push({ def_id: parseInt(inp.getAttribute('data-def-id')), name: inp.getAttribute('data-def-name'), value: val });
      });
      // Collect ad hoc fields
      document.querySelectorAll('.ct-custom-field-row').forEach(function(row) {
        var nameVal = row.querySelector('.cf-name').value.trim();
        var valueVal = row.querySelector('.cf-value').value.trim();
        if (nameVal) customFieldsList.push({ name: nameVal, value: valueVal });
      });

      var d={
        title: document.getElementById('ct-t').value.trim(),
        status_id: parseInt(document.getElementById('ct-st').value),
        priority: document.getElementById('ct-pr').value,
        assignee_id: parseInt(document.getElementById('ct-as').value)||null,
        company_id: parseInt(document.getElementById('ct-co').value)||null,
        deadline: document.getElementById('ct-dl').value||null,
        progress: parseInt(document.getElementById('ct-pg').value)||0,
        description: document.getElementById('ct-desc-editor').innerHTML.trim(),
        custom_fields: customFieldsList,
        project_id: CrmUI.getActiveProjectId(),
        time_from: document.getElementById('ct-tf').value||null,
        time_to: document.getElementById('ct-tt').value||null,
        location_type: document.getElementById('ct-loc').value||'remote',
      };
      if(!d.title){Toast.warn('Podaj tytuł');return}
      try{if(isE)await API.put('/crm/tasks/'+task.id,d);else await API.post('/crm/tasks',d);Modal.hide();Toast.success(isE?'Zapisano':'Utworzono');CrmView.render()}catch(e){Toast.error(e.message)}
    });
  },

  /* ── Show Task ────────────────────────────────────────────────────────── */
  showTask: async function(id) {
    var E=CrmUI._E;
    try {
      var t=await API.get('/crm/tasks/'+id);
      window._activeCrmTask = t;
      var priL={urgent:'🔴 Pilne',high:'🟠 Ważne',normal:'🔵 Normalne',low:'⚪ Niskie'};
      var mins=t.total_minutes||0,th2=Math.floor(mins/60),tm2=mins%60;
      var teH=(t.time_entries||[]).map(function(te){var m=te.duration_minutes,h3=Math.floor(m/60),m3=m%60;return '<div class="crm-time-entry"><span class="duration">'+h3+'h '+m3+'m</span><span class="member">'+E(te.member_name||'—')+'</span><span class="desc">'+E(te.description||'')+'</span><span class="date">'+new Date(te.created_at).toLocaleDateString('pl-PL')+'</span><button class="btn btn--ghost btn--sm" onclick="CrmUI.delTime('+te.id+','+id+')" style="color:#ef4444;padding:2px">✕</button></div>'}).join('')||'<p style="color:var(--text-muted);font-size:.82rem">Brak wpisów</p>';

      var cfs = [];
      try { cfs = typeof t.custom_fields === 'string' ? JSON.parse(t.custom_fields||'[]') : (t.custom_fields||[]); } catch(e){}

      // Custom fields HTML
      var cfsHtml = '';
      if (Array.isArray(cfs) && cfs.length > 0) {
        var visibleCfs = cfs.filter(function(cf){ return cf.name && cf.value; });
        if (visibleCfs.length) {
          cfsHtml = '<h4 style="margin:16px 0 8px;font-size:.85rem">📌 Pola dodatkowe</h4>'+
                    '<div class="crm-custom-fields-details">';
          visibleCfs.forEach(function(cf) {
            cfsHtml += '<div class="crm-profile-field"><label>'+E(cf.name)+'</label><span>'+E(cf.value)+'</span></div>';
          });
          cfsHtml += '</div>';
        }
      }

      // Time/location section
      var timeLocHtml = '';
      var hasTimeOrLoc = t.time_from || t.time_to || t.location_type;
      if (hasTimeOrLoc) {
        timeLocHtml = '<div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">';
        if (t.time_from || t.time_to) {
          timeLocHtml += '<div class="crm-task-badge-pill">🕐 '+(t.time_from||'—')+' – '+(t.time_to||'—')+'</div>';
        }
        if (t.location_type) {
          var locLabel = t.location_type === 'onsite' ? '📍 Na miejscu' : '💻 Zdalnie';
          timeLocHtml += '<div class="crm-task-badge-pill'+(t.location_type==='onsite'?' onsite':'')+'">' + locLabel + '</div>';
        }
        timeLocHtml += '</div>';
      }

      Modal.show({title:'📋 '+t.title,wide:true,body:
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">'+
          '<div class="crm-profile-field"><label>Status</label><span class="crm-status-badge" style="background:'+E(t.status_color||'#6b7280')+'22;color:'+E(t.status_color||'#6b7280')+'">'+E(t.status_name)+'</span></div>'+
          '<div class="crm-profile-field"><label>Priorytet</label><span>'+E(priL[t.priority]||t.priority)+'</span></div>'+
          '<div class="crm-profile-field"><label>Przypisany</label><span>'+E(t.assignee_name||'Brak')+'</span></div>'+
          '<div class="crm-profile-field"><label>Firma</label><span>'+E(t.company_name||'Brak')+'</span></div>'+
          '<div class="crm-profile-field"><label>Deadline</label><span>'+(t.deadline?new Date(t.deadline).toLocaleDateString('pl-PL'):'—')+'</span></div>'+
          '<div class="crm-profile-field"><label>Czas łącznie</label><span style="font-weight:700;color:var(--accent)">'+th2+'h '+tm2+'m</span></div>'+
        '</div>'+
        timeLocHtml+
        '<div class="crm-progress-wrap" style="margin-bottom:16px"><div class="crm-progress-bar" style="height:10px"><div class="crm-progress-fill" style="width:'+(t.progress||0)+'%"></div></div><span class="crm-progress-label">'+(t.progress||0)+'%</span></div>'+
        (t.description?'<div class="crm-task-description-content" style="padding:12px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;font-size:.85rem;margin-bottom:16px;line-height:1.5">'+CrmUI.formatDescription(t.description)+'</div>':'')+
        cfsHtml+
        '<h4 style="margin:16px 0 8px;font-size:.85rem">⏱ Stoper</h4>'+
        '<div class="crm-timer" id="crm-timer"><div class="crm-timer-dot stopped" id="crm-timer-dot"></div><div class="crm-timer-display" id="crm-timer-display">00:00:00</div><button class="crm-timer-btn start" id="crm-timer-btn" onclick="CrmUI.toggleTimer('+id+')">▶ Start</button></div>'+
        '<div style="margin-top:12px;display:flex;gap:8px;align-items:center"><input class="form-input" id="crm-manual-mins" type="number" placeholder="Minuty" style="width:80px;font-size:.82rem"><input class="form-input" id="crm-manual-desc" placeholder="Opis (opcjonalny)" style="flex:1;font-size:.82rem"><button class="btn btn--ghost btn--sm" onclick="CrmUI.addManualTime('+id+')">+ Dodaj ręcznie</button></div>'+
        '<h4 style="margin:16px 0 8px;font-size:.85rem">📊 Wpisy czasu ('+th2+'h '+tm2+'m łącznie)</h4>'+
        '<div class="crm-time-list">'+teH+'</div>',
        footer:'<button class="btn btn--ghost" onclick="Modal.hide();CrmUI.taskForm(window._activeCrmTask)">✏️ Edytuj</button><button class="btn btn--ghost" style="color:#ef4444" onclick="CrmUI.delTask('+id+')">🗑️ Usuń</button>'
      });
    }catch(e){Toast.error(e.message)}
  },

  _timerInterval:null,_timerStart:null,_timerTaskId:null,
  toggleTimer: function(taskId) {
    var btn=document.getElementById('crm-timer-btn'),dot=document.getElementById('crm-timer-dot'),disp=document.getElementById('crm-timer-display');
    if(CrmUI._timerInterval){
      clearInterval(CrmUI._timerInterval);
      var elapsed=Math.floor((Date.now()-CrmUI._timerStart)/60000);
      if(elapsed<1)elapsed=1;
      CrmUI._timerInterval=null;
      dot.classList.add('stopped');btn.textContent='▶ Start';btn.className='crm-timer-btn start';
      var tm=window._crmTeam||[];var me=tm.find(function(m){return m.username===(window.Session&&Session.user&&Session.user.username)});
      if(me){
        API.post('/crm/tasks/'+taskId+'/time',{team_member_id:me.id,duration_minutes:elapsed,description:'Stoper',is_manual:false}).then(function(){Toast.success('Zapisano '+elapsed+' min');CrmUI.showTask(taskId)}).catch(function(e){Toast.error(e.message)});
      }else{Toast.warn('Nie znaleziono Twojego profilu w Ekipie. Dodaj się najpierw.')}
    } else {
      CrmUI._timerStart=Date.now();CrmUI._timerTaskId=taskId;
      dot.classList.remove('stopped');btn.textContent='⏹ Stop';btn.className='crm-timer-btn stop';
      CrmUI._timerInterval=setInterval(function(){
        var s=Math.floor((Date.now()-CrmUI._timerStart)/1000);
        var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;
        disp.textContent=(h<10?'0':'')+h+':'+(m<10?'0':'')+m+':'+(ss<10?'0':'')+ss;
      },1000);
    }
  },
  addManualTime: async function(taskId) {
    var mins=parseInt(document.getElementById('crm-manual-mins').value);
    var desc=document.getElementById('crm-manual-desc').value.trim();
    if(!mins||mins<1){Toast.warn('Podaj minuty (min. 1)');return}
    var tm=window._crmTeam||[];var me=tm.find(function(m){return m.username===(window.Session&&Session.user&&Session.user.username)});
    if(!me){Toast.warn('Dodaj się do Ekipy');return}
    try{await API.post('/crm/tasks/'+taskId+'/time',{team_member_id:me.id,duration_minutes:mins,description:desc||'Wpis ręczny',is_manual:true});Toast.success('Dodano '+mins+' min');CrmUI.showTask(taskId)}catch(e){Toast.error(e.message)}
  },
  delTime: async function(id,taskId){if(!confirm('Usunąć wpis?'))return;await API.del('/crm/time/'+id);Toast.success('Usunięto');CrmUI.showTask(taskId)},
  delTask: async function(id){if(!confirm('Usunąć zadanie?'))return;await API.del('/crm/tasks/'+id);Modal.hide();Toast.success('Usunięto');CrmView.render()},

  /* ── Team ─────────────────────────────────────────────────────────────── */
  renderTeam: async function() {
    var el=document.getElementById('crm-content');if(!el)return;
    var E=CrmUI._E;
    try {
      var tm=await API.get('/crm/team');
      window._crmTeam = tm;
      var h='<div class="crm-toolbar"><button class="btn btn--primary" id="crm-atm">+ Dodaj pracownika</button></div>';
      if(!tm.length) h+='<div class="crm-empty"><span class="icon">👥</span><h3>Brak ekipy</h3><p>Dodaj pierwszego pracownika</p></div>';
      else {
        h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
        tm.forEach(function(m){
          var hrs=Math.floor((m.total_minutes||0)/60);
          h+='<div class="crm-contact-card" onclick="CrmUI.teamForm('+m.id+')"><div class="crm-contact-avatar" style="background:'+E(m.avatar_color||'#6366f1')+'">'+E((m.display_name||'?')[0])+'</div><div class="crm-contact-info"><div class="crm-contact-name">'+E(m.display_name)+'</div><div class="crm-contact-meta">@'+E(m.username)+' · '+E(m.role)+' · '+(m.open_tasks||0)+' zadań · '+hrs+'h</div></div></div>';
        });
        h+='</div>';
      }
      el.innerHTML=h;
      document.getElementById('crm-atm').addEventListener('click',function(){CrmUI.teamForm()});
    }catch(e){el.innerHTML='<p style="color:#ef4444">'+E(e.message)+'</p>'}
  },
  teamForm: function(memberOrId) {
    var E=CrmUI._E;
    var member = null;
    if (memberOrId) {
      if (typeof memberOrId === 'object') { member = memberOrId; }
      else if (window._crmTeam) { member = window._crmTeam.find(function(x){return x.id === memberOrId}); }
    }
    var isE = !!member;
    Modal.show({title:isE?'Edytuj pracownika':'Nowy pracownik',body:'<div class="crm-form"><div class="crm-form-row"><div class="crm-form-group"><label>Login (username) *</label><input id="tm-u" value="'+E(member&&member.username||'')+'"'+(isE?' disabled':'')+'></div><div class="crm-form-group"><label>Imię i nazwisko *</label><input id="tm-n" value="'+E(member&&member.display_name||'')+'"></div></div><div class="crm-form-row"><div class="crm-form-group"><label>Email</label><input id="tm-e" value="'+E(member&&member.email||'')+'"></div><div class="crm-form-group"><label>Rola</label><select id="tm-r"><option value="member"'+(member&&member.role==='member'?' selected':'')+'>Pracownik</option><option value="admin"'+(member&&member.role==='admin'?' selected':'')+'>Admin</option></select></div></div></div>',footer:'<button class="btn btn--primary" id="tm-s">'+(isE?'Zapisz':'Dodaj')+'</button>'+(isE?'<button class="btn btn--ghost" style="color:#ef4444" id="tm-d">Dezaktywuj</button>':'')});
    document.getElementById('tm-s').addEventListener('click',async function(){
      var d={username:document.getElementById('tm-u').value.trim(),display_name:document.getElementById('tm-n').value.trim(),email:document.getElementById('tm-e').value.trim(),role:document.getElementById('tm-r').value};
      if(!d.username||!d.display_name){Toast.warn('Podaj login i nazwę');return}
      try{if(isE)await API.put('/crm/team/'+member.id,d);else await API.post('/crm/team',d);Modal.hide();Toast.success(isE?'Zapisano':'Dodano');CrmView.render()}catch(e){Toast.error(e.message)}
    });
    if(isE)document.getElementById('tm-d')?.addEventListener('click',async function(){if(!confirm('Dezaktywować?'))return;await API.del('/crm/team/'+member.id);Modal.hide();Toast.success('Dezaktywowano');CrmView.render()});
  },

  /* ── Status Form ──────────────────────────────────────────────────────── */
  statusForm: function() {
    Modal.show({
      title: 'Dodaj nową listę zadań',
      body: '<div class="crm-form">'+
            '<div class="crm-form-group"><label>Nazwa listy *</label><input id="cs-n" placeholder="np. Do weryfikacji"></div>'+
            '<div class="crm-form-group"><label>Kolor listy (etykiety)</label>'+
            '<div style="display:flex;gap:10px;align-items:center"><input id="cs-c" type="color" value="#6366f1" style="width:50px;height:38px;padding:2px;border:1px solid var(--border);border-radius:6px;cursor:pointer">'+
            '<span style="font-size:0.8rem;color:var(--text-muted)">Wybierz kolor listy</span></div></div>'+
            '</div>',
      footer: '<button class="btn btn--primary" id="cs-s">Utwórz listę</button>'
    });
    document.getElementById('cs-s').addEventListener('click', async function() {
      var name = document.getElementById('cs-n').value.trim();
      var color = document.getElementById('cs-c').value;
      if (!name) { Toast.warn('Podaj nazwę listy'); return; }
      try {
        await API.post('/crm/statuses', { name: name, color: color });
        Modal.hide(); Toast.success('Dodano listę');
        var st = await API.get('/crm/statuses'); window._crmStatuses = st;
        var view = localStorage.getItem('sg_crm_task_view') || 'list';
        if (view === 'kanban') CrmUI.renderKanban(); else CrmUI.renderTasks();
      } catch(e) { Toast.error(e.message); }
    });
  },

  delStatus: async function(id, name) {
    if (!confirm('Czy na pewno chcesz usunąć listę "' + name + '"? Zadania zostaną przeniesione do domyślnej listy.')) return;
    try {
      await API.del('/crm/statuses/' + id);
      Toast.success('Usunięto listę');
      var activeStatus = localStorage.getItem('sg_crm_task_status_filter') || 'all';
      if (String(activeStatus) === String(id)) localStorage.setItem('sg_crm_task_status_filter', 'all');
      var st = await API.get('/crm/statuses'); window._crmStatuses = st;
      var view = localStorage.getItem('sg_crm_task_view') || 'list';
      if (view === 'kanban') CrmUI.renderKanban(); else CrmUI.renderTasks();
    } catch(e) { Toast.error(e.message); }
  },

  addCustomFieldInput: function(name, value) {
    name = name || ''; value = value || '';
    var container = document.getElementById('ct-custom-fields-container');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'ct-custom-field-row';
    div.style = 'display:flex; gap:8px; align-items:center; margin-bottom: 6px;';
    div.innerHTML = '<input class="form-input cf-name" placeholder="Nazwa pola (np. Nr zlecenia)" value="'+String(name||'').replace(/"/g,'&quot;')+'" style="flex:1; font-size:0.8rem; padding:6px 10px;">'+
                    '<input class="form-input cf-value" placeholder="Wartość" value="'+String(value||'').replace(/"/g,'&quot;')+'" style="flex:1; font-size:0.8rem; padding:6px 10px;">'+
                    '<button type="button" class="btn btn--ghost btn--sm" onclick="this.parentElement.remove()" style="color:#ef4444; padding:4px 8px; min-height:auto;">✕</button>';
    container.appendChild(div);
  },

  /* ── Custom Fields Manager ────────────────────────────────────────────── */
  customFieldsManager: function(onCloseCallback) {
    var E = CrmUI._E;
    var cfd = window._crmFieldDefs || [];

    function buildRows() {
      if (!cfd.length) return '<p style="color:var(--text-muted);font-size:.85rem;text-align:center;padding:16px">Brak zdefiniowanych pól dodatkowych</p>';
      return cfd.map(function(f) {
        var typeLabels = {text:'Tekst',number:'Liczba',date:'Data',select:'Lista wyboru'};
        return '<div class="crm-project-manage-row" style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">'+
               '<span style="font-size:1rem">📌</span>'+
               '<div style="flex:1"><div style="font-weight:600;font-size:.88rem">'+E(f.name)+'</div><div style="font-size:.72rem;color:var(--text-muted)">'+E(typeLabels[f.field_type]||f.field_type)+'</div></div>'+
               '<button class="btn btn--ghost btn--sm" onclick="CrmUI._editCFDef('+f.id+')">✏️</button>'+
               '<button class="btn btn--ghost btn--sm" style="color:#ef4444" onclick="CrmUI._deleteCFDef('+f.id+',\''+E(f.name)+'\')">🗑️</button>'+
               '</div>';
      }).join('');
    }

    Modal.show({
      title: '📌 Zarządzanie polami dodatkowymi',
      wide: true,
      body: '<div id="cfd-list">'+buildRows()+'</div>'+
            '<button class="btn btn--primary" style="width:100%;margin-top:10px" id="cfd-add-btn">+ Dodaj nowe pole</button>',
      footer: onCloseCallback ? '<button class="btn btn--ghost" id="cfd-back-btn">← Wróć do zadania</button>' : ''
    });
    document.getElementById('cfd-add-btn').addEventListener('click', function(){
      Modal.hide();
      setTimeout(function(){ CrmUI._addCFDefForm(onCloseCallback); }, 150);
    });
    if (onCloseCallback) {
      document.getElementById('cfd-back-btn')?.addEventListener('click', function(){
        Modal.hide();
        setTimeout(onCloseCallback, 150);
      });
    }
  },

  _addCFDefForm: function(onCloseCallback, existing) {
    var E = CrmUI._E;
    var isEdit = !!existing;
    Modal.show({
      title: isEdit ? '✏️ Edytuj pole' : '+ Nowe pole dodatkowe',
      body: '<div class="crm-form">'+
            '<div class="crm-form-group"><label>Nazwa pola *</label><input id="cfd-name" placeholder="np. Nr zlecenia, Budżet, Data wizyty" value="'+E(existing&&existing.name||'')+'"></div>'+
            '<div class="crm-form-group"><label>Typ pola</label>'+
            '<select id="cfd-type">'+
              '<option value="text"'+(existing&&existing.field_type==='text'?' selected':'')+'>Tekst</option>'+
              '<option value="number"'+(existing&&existing.field_type==='number'?' selected':'')+'>Liczba</option>'+
              '<option value="date"'+(existing&&existing.field_type==='date'?' selected':'')+'>Data</option>'+
              '<option value="select"'+(existing&&existing.field_type==='select'?' selected':'')+'>Lista wyboru (opcje)</option>'+
            '</select></div>'+
            '<div class="crm-form-group" id="cfd-options-wrap" style="display:'+(existing&&existing.field_type==='select'?'block':'none')+'">'+
              '<label>Opcje (po przecinku)</label>'+
              '<input id="cfd-options" placeholder="np. Nowe, W trakcie, Zamknięte" value="'+E(existing?(typeof existing.options==='string'?JSON.parse(existing.options||'[]').join(', '):(existing.options||[]).join(', ')):'')+'" >'+
            '</div>'+
            '</div>',
      footer: '<button class="btn btn--primary" id="cfd-save">'+( isEdit?'Zapisz':'Dodaj pole')+'</button>'+
              '<button class="btn btn--ghost" id="cfd-back">← Wróć</button>'
    });
    document.getElementById('cfd-type').addEventListener('change', function(){
      document.getElementById('cfd-options-wrap').style.display = this.value === 'select' ? 'block' : 'none';
    });
    document.getElementById('cfd-back').addEventListener('click', function(){
      Modal.hide();
      setTimeout(function(){ CrmUI.customFieldsManager(onCloseCallback); }, 150);
    });
    document.getElementById('cfd-save').addEventListener('click', async function() {
      var name = document.getElementById('cfd-name').value.trim();
      var type = document.getElementById('cfd-type').value;
      var optRaw = document.getElementById('cfd-options').value.trim();
      var opts = type === 'select' ? optRaw.split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
      if (!name) { Toast.warn('Podaj nazwę pola'); return; }
      try {
        if (isEdit) {
          await API.put('/crm/custom-fields/'+existing.id, { name: name, field_type: type, options: opts });
          Toast.success('Zapisano pole');
        } else {
          await API.post('/crm/custom-fields', { name: name, field_type: type, options: opts });
          Toast.success('Dodano pole "'+name+'"');
        }
        var cfd = await API.get('/crm/custom-fields');
        window._crmFieldDefs = cfd;
        Modal.hide();
        setTimeout(function(){ CrmUI.customFieldsManager(onCloseCallback); }, 150);
      } catch(e) { Toast.error(e.message); }
    });
  },

  _editCFDef: function(id) {
    var f = (window._crmFieldDefs||[]).find(function(x){ return x.id===id; });
    if (!f) return;
    Modal.hide();
    setTimeout(function(){ CrmUI._addCFDefForm(null, f); }, 150);
  },

  _deleteCFDef: async function(id, name) {
    if (!confirm('Usunąć pole "'+name+'"? Wartości pola zostaną usunięte z zadań przy następnej edycji.')) return;
    try {
      await API.del('/crm/custom-fields/'+id);
      Toast.success('Usunięto pole "'+name+'"');
      var cfd = await API.get('/crm/custom-fields');
      window._crmFieldDefs = cfd;
      // Refresh list
      var listEl = document.getElementById('cfd-list');
      if (listEl) {
        if (!cfd.length) listEl.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;text-align:center;padding:16px">Brak zdefiniowanych pól dodatkowych</p>';
        else {
          var E = CrmUI._E;
          var typeLabels = {text:'Tekst',number:'Liczba',date:'Data',select:'Lista wyboru'};
          listEl.innerHTML = cfd.map(function(f2) {
            return '<div class="crm-project-manage-row" style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">'+
                   '<span style="font-size:1rem">📌</span>'+
                   '<div style="flex:1"><div style="font-weight:600;font-size:.88rem">'+E(f2.name)+'</div><div style="font-size:.72rem;color:var(--text-muted)">'+E(typeLabels[f2.field_type]||f2.field_type)+'</div></div>'+
                   '<button class="btn btn--ghost btn--sm" onclick="CrmUI._editCFDef('+f2.id+')">✏️</button>'+
                   '<button class="btn btn--ghost btn--sm" style="color:#ef4444" onclick="CrmUI._deleteCFDef('+f2.id+',\''+E(f2.name)+'\')">🗑️</button>'+
                   '</div>';
          }).join('');
        }
      }
    } catch(e) { Toast.error(e.message); }
  },

  /* ── Project Bar Builder ──────────────────────────────────────────────── */
  _buildProjectBar: function() {
    var E = CrmUI._E;
    var pr = window._crmProjects || [];
    var activeId = CrmUI.getActiveProjectId();
    var h = '<div class="crm-project-inline" id="crm-project-bar">';
    pr.forEach(function(p) {
      var isAct = p.id === activeId;
      h += '<button class="crm-project-pill'+(isAct?' active':'')+'" data-pid="'+p.id+'" style="--pill-color:'+E(p.color)+'">'+
           '<span class="crm-project-dot" style="background:'+E(p.color)+'"></span>'+
           E(p.name)+
           '<span class="crm-project-count">'+(p.task_count||0)+'</span>'+
           '</button>';
    });
    h += '<button class="crm-project-add-btn" id="crm-proj-add" title="Nowy projekt">+</button>';
    h += '<button class="crm-project-manage-btn" id="crm-proj-manage" title="Zarządzaj projektami">⚙️</button>';
    h += '</div>';
    return h;
  },

  _bindProjectBar: function() {
    document.querySelectorAll('.crm-project-pill').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var pid = parseInt(btn.getAttribute('data-pid'));
        CrmUI.setActiveProject(pid);
        var view = localStorage.getItem('sg_crm_task_view') || 'list';
        if (view === 'kanban') CrmUI.renderKanban(); else CrmUI.renderTasks();
      });
    });
    var addBtn = document.getElementById('crm-proj-add');
    if (addBtn) addBtn.addEventListener('click', function(){ CrmUI.projectForm(); });
    var manBtn = document.getElementById('crm-proj-manage');
    if (manBtn) manBtn.addEventListener('click', function(){ CrmUI.manageProjects(); });
  },

  /* ── Project Form ─────────────────────────────────────────────────────── */
  projectForm: function(proj) {
    var E = CrmUI._E;
    var isE = !!proj;
    Modal.show({
      title: isE ? '✏️ Edytuj projekt' : '📁 Nowy projekt',
      body: '<div class="crm-form">'+
            '<div class="crm-form-group"><label>Nazwa projektu *</label><input id="pf-n" value="'+E(proj&&proj.name||'')+'" placeholder="np. Klient ABC"></div>'+
            '<div class="crm-form-row">'+
              '<div class="crm-form-group"><label>Kolor projektu</label>'+
              '<div style="display:flex;gap:10px;align-items:center">'+
              '<input id="pf-c" type="color" value="'+E(proj&&proj.color||'#6366f1')+'" style="width:50px;height:38px;padding:2px;border:1px solid var(--border);border-radius:6px;cursor:pointer">'+
              '<span style="font-size:0.8rem;color:var(--text-muted)">Wybierz kolor</span></div></div>'+
              '<div class="crm-form-group"><label>Opis (opcjonalnie)</label><input id="pf-d" value="'+E(proj&&proj.description||'')+'" placeholder="Krótki opis projektu"></div>'+
            '</div>'+
            '</div>',
      footer: '<button class="btn btn--primary" id="pf-s">'+(isE?'Zapisz':'Utwórz projekt')+'</button>'
    });
    document.getElementById('pf-s').addEventListener('click', async function() {
      var name = document.getElementById('pf-n').value.trim();
      var color = document.getElementById('pf-c').value;
      var desc = document.getElementById('pf-d').value.trim();
      if (!name) { Toast.warn('Podaj nazwę projektu'); return; }
      try {
        var result;
        if (isE) {
          await API.put('/crm/projects/'+proj.id, { name, color, description: desc });
          Toast.success('Zapisano projekt');
        } else {
          result = await API.post('/crm/projects', { name, color, description: desc });
          Toast.success('Utworzono projekt');
          if (result && result.id) CrmUI.setActiveProject(result.id);
        }
        Modal.hide();
        var pr = await API.get('/crm/projects'); window._crmProjects = pr;
        var view = localStorage.getItem('sg_crm_task_view') || 'list';
        if (view === 'kanban') CrmUI.renderKanban(); else CrmUI.renderTasks();
      } catch(e) { Toast.error(e.message); }
    });
  },

  /* ── Manage Projects ──────────────────────────────────────────────────── */
  manageProjects: function() {
    var E = CrmUI._E;
    var pr = window._crmProjects || [];
    var rows = pr.map(function(p) {
      return '<div class="crm-project-manage-row" style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">'+
             '<span style="width:14px;height:14px;border-radius:50%;background:'+E(p.color)+';flex-shrink:0;display:inline-block"></span>'+
             '<span style="flex:1;font-weight:600;font-size:.88rem">'+E(p.name)+'</span>'+
             '<span style="font-size:.75rem;color:var(--text-muted);margin-right:4px">'+(p.task_count||0)+' zadań</span>'+
             '<button class="btn btn--ghost btn--sm" onclick="CrmUI._editProjectFromManage('+p.id+')">✏️</button>'+
             (pr.length > 1 ? '<button class="btn btn--ghost btn--sm" style="color:#ef4444" onclick="CrmUI._deleteProjectFromManage('+p.id+',\''+E(p.name)+'\')">🗑️</button>' : '')+
             '</div>';
    }).join('');
    Modal.show({
      title: '⚙️ Zarządzanie projektami',
      wide: true,
      body: rows + '<button class="btn btn--primary" style="margin-top:8px;width:100%" onclick="Modal.hide();CrmUI.projectForm()">+ Nowy projekt</button>',
      footer: ''
    });
  },

  _editProjectFromManage: function(id) {
    var pr = window._crmProjects || [];
    var proj = pr.find(function(p){ return p.id === id; });
    if (!proj) return;
    Modal.hide();
    setTimeout(function(){ CrmUI.projectForm(proj); }, 150);
  },

  _deleteProjectFromManage: async function(id, name) {
    if (!confirm('Usunąć projekt "'+name+'"? Zadania zostaną przeniesione do innego projektu.')) return;
    try {
      await API.del('/crm/projects/'+id);
      Toast.success('Usunięto projekt');
      var pr = await API.get('/crm/projects'); window._crmProjects = pr;
      if (pr.length && CrmUI.getActiveProjectId() === id) CrmUI.setActiveProject(pr[0].id);
      Modal.hide();
      var view = localStorage.getItem('sg_crm_task_view') || 'list';
      if (view === 'kanban') CrmUI.renderKanban(); else CrmUI.renderTasks();
    } catch(e) { Toast.error(e.message); }
  },

  /* ═══════════════════════════════════════════════════════════════════════════
     IMPORT / EXPORT
  ═══════════════════════════════════════════════════════════════════════════ */

  /* ── Export ─────────────────────────────────────────────────────────────── */
  exportExcel: function() {
    var token = localStorage.getItem('sg_auth_token') || '';
    var a = document.createElement('a');
    a.href = '/api/crm/export/companies';
    if (token) a.href += (a.href.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
    a.download = 'crm_export_' + new Date().toISOString().slice(0,10) + '.xlsx';
    // Use fetch with auth header for proper token passing
    Toast.info('Pobieranie eksportu…');
    fetch('/api/crm/export/companies', { headers: token ? { 'Authorization': 'Bearer ' + token } : {} })
      .then(function(r) {
        if (!r.ok) throw new Error('Błąd serwera: ' + r.status);
        return r.blob();
      })
      .then(function(blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'crm_export_' + new Date().toISOString().slice(0,10) + '.xlsx';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        Toast.success('Eksport pobrany!');
      })
      .catch(function(e) { Toast.error('Błąd eksportu: ' + e.message); });
  },

  /* ── Import wizard ──────────────────────────────────────────────────────── */
  _importState: { file: null, columns: [], preview: [], total: 0, mapping: {}, mode: 'upsert' },

  importModal: function() {
    CrmUI._importState = { file: null, columns: [], preview: [], total: 0, mapping: {}, mode: 'upsert' };
    CrmUI._importStep1();
  },

  _importStep1: function() {
    Modal.show({
      title: '📥 Import bazy klientów — Krok 1/3: Wybierz plik',
      wide: true,
      body: `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div style="background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:14px 16px;font-size:.82rem;line-height:1.6;color:var(--text-secondary)">
            <strong style="color:var(--accent)">📋 Obsługiwane formaty:</strong> Excel (.xlsx, .xls), CSV (.csv)<br>
            <strong style="color:var(--accent)">🔧 Tryb importu:</strong> Upsert (aktualizuj istniejące po NIP/nazwie) lub tylko nowe.<br>
            <strong style="color:var(--accent)">💡 Wskazówka:</strong> Kolumna "Podsumowanie" zostanie zapisana jako Notatka.
          </div>
          <div style="border:2px dashed var(--border);border-radius:12px;padding:40px;text-align:center;transition:all .2s;cursor:pointer" id="crm-drop-zone">
            <div style="font-size:2.5rem;margin-bottom:8px">📂</div>
            <div style="font-size:.88rem;color:var(--text-secondary);margin-bottom:12px">Przeciągnij plik tutaj lub kliknij aby wybrać</div>
            <input type="file" id="crm-imp-file" accept=".xlsx,.xls,.csv" style="display:none">
            <button class="btn btn--secondary btn--sm" onclick="document.getElementById('crm-imp-file').click()">Wybierz plik</button>
          </div>
          <div id="crm-imp-file-info" style="display:none;background:var(--bg-elevated);border-radius:8px;padding:10px 14px;font-size:.82rem;display:flex;align-items:center;gap:10px">
            <span style="font-size:1.3rem">📄</span>
            <div><div id="crm-imp-file-name" style="font-weight:600"></div><div id="crm-imp-file-size" style="color:var(--text-muted)"></div></div>
          </div>
          <div>
            <label style="font-size:.8rem;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px">Tryb importu</label>
            <select id="crm-imp-mode" class="form-input" style="max-width:300px">
              <option value="upsert">Upsert — Dodaj nowe i aktualizuj istniejące (po NIP / nazwie)</option>
              <option value="skip">Tylko nowe — Pomiń istniejące rekordy</option>
              <option value="update">Tylko aktualizuj — Nie dodawaj nowych</option>
            </select>
          </div>
        </div>`,
      footer: '<button class="btn btn--primary" id="crm-imp-next1" disabled>Dalej →</button>'
    });

    var fileInput = document.getElementById('crm-imp-file');
    var dropZone  = document.getElementById('crm-drop-zone');
    var nextBtn   = document.getElementById('crm-imp-next1');
    var fileInfo  = document.getElementById('crm-imp-file-info');

    function setFile(f) {
      CrmUI._importState.file = f;
      document.getElementById('crm-imp-file-name').textContent = f.name;
      document.getElementById('crm-imp-file-size').textContent = (f.size/1024).toFixed(1) + ' KB';
      fileInfo.style.display = 'flex';
      dropZone.style.borderColor = 'var(--accent)';
      nextBtn.disabled = false;
    }

    fileInput.addEventListener('change', function() { if (this.files[0]) setFile(this.files[0]); });
    dropZone.addEventListener('click', function() { fileInput.click(); });
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.style.background = 'rgba(99,102,241,.08)'; });
    dropZone.addEventListener('dragleave', function() { dropZone.style.background = ''; });
    dropZone.addEventListener('drop', function(e) { e.preventDefault(); dropZone.style.background = ''; if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });

    nextBtn.addEventListener('click', async function() {
      CrmUI._importState.mode = document.getElementById('crm-imp-mode').value;
      nextBtn.disabled = true; nextBtn.textContent = '⏳ Wczytuję...';
      try {
        var fd = new FormData();
        fd.append('file', CrmUI._importState.file);
        var token = localStorage.getItem('sg_auth_token') || '';
        var r = await fetch('/api/crm/import/preview', { method:'POST', body:fd, headers: token ? {'Authorization':'Bearer '+token} : {} });
        if (!r.ok) throw new Error('Błąd parsowania pliku: ' + r.status);
        var data = await r.json();
        if (data.error) throw new Error(data.error);
        CrmUI._importState.columns = data.columns;
        CrmUI._importState.preview = data.preview;
        CrmUI._importState.total   = data.total;
        CrmUI._importStep2();
      } catch(e) { Toast.error(e.message); nextBtn.disabled = false; nextBtn.textContent = 'Dalej →'; }
    });
  },

  _importStep2: function() {
    var s = CrmUI._importState;
    var E = CrmUI._E;

    var DB_FIELDS = [
      { key:'name',        label:'Nazwa firmy *',   required:true },
      { key:'nip',         label:'NIP',              required:false },
      { key:'address',     label:'Adres',            required:false },
      { key:'city',        label:'Miasto',           required:false },
      { key:'postal_code', label:'Kod pocztowy',     required:false },
      { key:'phone',       label:'Telefon',          required:false },
      { key:'email',       label:'Email',            required:false },
      { key:'website',     label:'Strona WWW',       required:false },
      { key:'notes',       label:'Notatki',          required:false },
      { key:'summary',     label:'Podsumowanie → Notatka', required:false },
    ];

    // Auto-detect mapping by column name similarity
    var autoMap = {};
    var lowerCols = s.columns.map(c => c.toLowerCase().trim());
    DB_FIELDS.forEach(function(f) {
      var synonyms = {
        name:        ['nazwa','name','firma','company','podmiot','kontrahent'],
        nip:         ['nip','vat','tax'],
        address:     ['adres','address','ulica','street'],
        city:        ['miasto','city','miejscowość'],
        postal_code: ['kod','postal','zip','kod pocztowy'],
        phone:       ['telefon','phone','tel','komórka','mobile'],
        email:       ['email','e-mail','mail'],
        website:     ['www','website','strona','web','url'],
        notes:       ['notatki','notes','uwagi','opis','comment'],
        summary:     ['podsumowanie','summary','streszczenie'],
      }[f.key] || [];
      var match = lowerCols.findIndex(c => synonyms.some(s => c.includes(s) || s.includes(c)));
      if (match !== -1) autoMap[f.key] = s.columns[match];
    });
    s.mapping = autoMap;

    // Build preview table HTML
    var previewCols = s.columns.slice(0,8);
    var previewHTML = '<table class="crm-table" style="font-size:.72rem;margin-top:10px"><thead><tr>'
      + previewCols.map(c => '<th>'+E(c)+'</th>').join('')
      + '</tr></thead><tbody>'
      + s.preview.map(function(row) {
          return '<tr>'+previewCols.map(c => '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+E(String(row[c]||''))+'</td>').join('')+'</tr>';
        }).join('')
      + '</tbody></table>';

    var colOptions = '<option value="__skip__">— Pomiń —</option>'
      + s.columns.map(c => '<option value="'+E(c)+'">'+E(c)+'</option>').join('');

    var mappingRows = DB_FIELDS.map(function(f) {
      var sel = s.columns.find(c => autoMap[f.key] === c);
      return '<div class="crm-form-row" style="align-items:center;gap:12px">'
        + '<div style="width:200px;font-size:.8rem;font-weight:'+(f.required?700:500)+';color:'+(f.required?'var(--accent)':'var(--text-secondary)')+'">'
        + E(f.label) + '</div>'
        + '<select id="cmap-'+f.key+'" class="form-input" style="flex:1">'
        + s.columns.map(c => '<option value="'+E(c)+'"'+(c===sel?' selected':'')+'>'+E(c)+'</option>').join('')
        + '<option value="__skip__"'+(sel?'':' selected')+'>— Pomiń —</option>'
        + '</select></div>';
    }).join('');

    Modal.show({
      title: '📥 Import — Krok 2/3: Mapowanie kolumn (' + s.total + ' wierszy)',
      wide: true,
      body: `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="background:var(--bg-elevated);border-radius:8px;padding:10px 14px;font-size:.78rem;color:var(--text-muted)">
            Plik: <strong>${E(s.file.name)}</strong> · ${s.total} wierszy · Tryb: <strong>${s.mode}</strong><br>
            Kolumny zostały automatycznie dopasowane — sprawdź i popraw mapowanie.
          </div>
          <div>
            <div style="font-size:.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Podgląd danych (5 pierwszych wierszy)</div>
            <div style="overflow-x:auto;max-height:160px;border:1px solid var(--border);border-radius:8px">${previewHTML}</div>
          </div>
          <div>
            <div style="font-size:.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Mapowanie kolumn</div>
            <div style="display:flex;flex-direction:column;gap:6px">${mappingRows}</div>
          </div>
        </div>`,
      footer: '<button class="btn btn--ghost" id="crm-imp-back2">← Wstecz</button><button class="btn btn--primary" id="crm-imp-next2">Importuj →</button>'
    });

    document.getElementById('crm-imp-back2').addEventListener('click', function() { CrmUI._importStep1(); });
    document.getElementById('crm-imp-next2').addEventListener('click', async function() {
      // Collect mapping from selects
      var mapping = {};
      DB_FIELDS.forEach(function(f) {
        var v = document.getElementById('cmap-'+f.key)?.value;
        if (v && v !== '__skip__') mapping[f.key] = v;
      });
      if (!mapping.name) { Toast.warn('Musisz zmapować kolumnę Nazwa firmy!'); return; }
      s.mapping = mapping;
      CrmUI._importStep3();
    });
  },

  _importStep3: async function() {
    var s = CrmUI._importState;
    var btn = document.getElementById('crm-imp-next2');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Importuję...'; }

    try {
      var fd = new FormData();
      fd.append('file', s.file);
      fd.append('mapping', JSON.stringify(s.mapping));
      fd.append('mode', s.mode);
      var token = localStorage.getItem('sg_auth_token') || '';
      var r = await fetch('/api/crm/import/companies', {
        method: 'POST', body: fd,
        headers: token ? {'Authorization':'Bearer '+token} : {}
      });
      if (!r.ok) throw new Error('Błąd serwera: ' + r.status);
      var result = await r.json();
      if (result.error) throw new Error(result.error);

      Modal.show({
        title: '✅ Import zakończony',
        body: `
          <div style="display:flex;flex-direction:column;gap:16px;padding:8px 0">
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
              <div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.25);border-radius:12px;padding:16px;text-align:center">
                <div style="font-size:2rem;font-weight:800;color:#10b981">${result.inserted||0}</div>
                <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">Dodanych</div>
              </div>
              <div style="background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);border-radius:12px;padding:16px;text-align:center">
                <div style="font-size:2rem;font-weight:800;color:#6366f1">${result.updated||0}</div>
                <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">Zaktualizowanych</div>
              </div>
              <div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);border-radius:12px;padding:16px;text-align:center">
                <div style="font-size:2rem;font-weight:800;color:#f59e0b">${result.skipped||0}</div>
                <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">Pominiętych</div>
              </div>
              <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
                <div style="font-size:2rem;font-weight:800;color:var(--text-primary)">${result.total||0}</div>
                <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">Łącznie w pliku</div>
              </div>
            </div>
            <div style="background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.15);border-radius:8px;padding:12px;font-size:.82rem;color:var(--text-secondary)">
              Import zakończony pomyślnie. Lista firm została zaktualizowana.
            </div>
          </div>`,
        footer: '<button class="btn btn--primary" id="crm-imp-done">Zamknij i odśwież</button>'
      });

      document.getElementById('crm-imp-done').addEventListener('click', function() {
        Modal.hide();
        CrmUI.renderCompanies();
      });

    } catch(e) {
      Toast.error('Błąd importu: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Importuj →'; }
    }
  }
};


// Notification badge refresh
async function refreshNotifBadge(){
  try{var d=await API.get('/notifications/unread-count?module=crm');var b=document.getElementById('crm-notif-badge');if(b){if(d.count>0){b.textContent=d.count;b.style.display='inline-block'}else b.style.display='none'}}catch(e){}
}
setInterval(refreshNotifBadge,30000);
