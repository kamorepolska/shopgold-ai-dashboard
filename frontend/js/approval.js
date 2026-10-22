/* ===== approval.js — Moduł Akceptacji (Before/After) ===== */
window.ApprovalView = {
  state: { items:[], stats:{}, filter:'pending', fieldFilter:'', selected:new Set() },

  async render() {
    const el = document.getElementById('view-approval');
    el.innerHTML = this.shell();
    this.bindEvents();
    await this.load();
  },

  shell() {
    return `
    <div class="section-header">
      <div class="section-title">✅ Kolejka Akceptacji</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn--success btn--sm" id="ap-approve-all-btn">✅ Zatwierdź oczekujące</button>
        <button class="btn btn--primary btn--sm" id="ap-sync-btn">🚀 Synchronizuj zatwierdzone</button>
        <button class="btn btn--secondary btn--sm" id="ap-export-xml-btn">⬇️ Eksport XML</button>
        <button class="btn btn--secondary btn--sm" id="ap-export-csv-btn">⬇️ Eksport CSV</button>
      </div>
    </div>

    <div id="ap-stats-bar" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap"></div>

    <div class="filter-row" style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">
      <div class="tabs" style="margin:0;border:none;gap:4px">
        ${['pending','approved','synced','rejected',''].map(s=>`
          <button class="tab-btn ap-filter-btn ${this.state.filter===s?'active':''}" data-status="${s}">
            ${s==='pending'?'⏳ Oczekujące':s==='approved'?'✅ Zatwierdzone':s==='synced'?'🚀 Wysłane':s==='rejected'?'❌ Odrzucone':'📋 Wszystkie'}
          </button>`).join('')}
      </div>
      <div>
        <select id="ap-field-filter" style="padding:6px 12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-surface);color:var(--text-primary);font-size:0.85rem;min-width:200px">
          <option value="" ${this.state.fieldFilter === '' ? 'selected' : ''}>Wszystkie pola</option>
          <option value="name" ${this.state.fieldFilter === 'name' ? 'selected' : ''}>Tytuł (name)</option>
          <option value="description" ${this.state.fieldFilter === 'description' ? 'selected' : ''}>Opis produktu</option>
          <option value="meta_title" ${this.state.fieldFilter === 'meta_title' ? 'selected' : ''}>Meta Tytuł</option>
          <option value="meta_desc" ${this.state.fieldFilter === 'meta_desc' ? 'selected' : ''}>Meta Opis</option>
          <option value="attributes_suggestions" ${this.state.fieldFilter === 'attributes_suggestions' ? 'selected' : ''}>Atrybuty</option>
          <option value="parameter_standardize" ${this.state.fieldFilter === 'parameter_standardize' ? 'selected' : ''}>Parametry</option>
          <option value="relations" ${this.state.fieldFilter === 'relations' ? 'selected' : ''}>Relacje (Zbiorczo - stary format)</option>
          <option value="relation_zestawy" ${this.state.fieldFilter === 'relation_zestawy' ? 'selected' : ''}>Relacje: Zestawy</option>
          <option value="relation_warianty" ${this.state.fieldFilter === 'relation_warianty' ? 'selected' : ''}>Relacje: Warianty</option>
          <option value="relation_akcesoria" ${this.state.fieldFilter === 'relation_akcesoria' ? 'selected' : ''}>Relacje: Akcesoria</option>
          <option value="relation_podobne" ${this.state.fieldFilter === 'relation_podobne' ? 'selected' : ''}>Relacje: Podobne</option>
        </select>
      </div>
    </div>

    <div class="card" style="padding:0" id="ap-table-wrap">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);gap:8px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="ap-check-all" style="width:16px;height:16px;accent-color:var(--accent)">
          <span style="font-size:0.82rem;color:var(--text-secondary)" id="ap-selected-info">Zaznacz do akcji zbiorczej</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn--success btn--sm" id="ap-bulk-approve">✅ Zatwierdź zaznaczone</button>
          <button class="btn btn--danger btn--sm" id="ap-bulk-reject">❌ Odrzuć zaznaczone</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th style="width:36px"></th>
            <th>Produkt</th>
            <th>Pole</th>
            <th style="width:290px">⬅ Przed (oryginał)</th>
            <th style="width:290px">➡ Po (AI)</th>
            <th>Status</th>
            <th style="text-align:right">Akcje</th>
          </tr></thead>
          <tbody id="ap-tbody"><tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Ładowanie...</td></tr></tbody>
        </table>
      </div>
    </div>`;
  },

  async load() {
    try {
      let statusParam = this.state.filter;
      if (statusParam === 'parameters') statusParam = '';
      
      const d = await API.get(`/approval?status=${statusParam}&limit=200`);
      
      this.state.items = d.items||[];
      if (this.state.filter === 'parameters') {
        this.state.items = this.state.items.filter(i => i.field_name === 'parameter_standardize');
      }
      
      if (this.state.fieldFilter) {
        this.state.items = this.state.items.filter(i => i.field_name === this.state.fieldFilter);
      }
      
      this.state.stats = (d.stats||[]).reduce((a,r)=>{ a[r.status]=r.count; return a; },{});
      
      // Calculate pending parameters count
      const allPending = d.items ? d.items.filter(i => i.status === 'pending' && i.field_name === 'parameter_standardize').length : 0;
      this.state.stats.parameters = allPending;

      this.renderStats();
      this.renderTable();
    } catch(e) {
      document.getElementById('ap-tbody').innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red);padding:24px">❌ ${escHtml(e.message)}</td></tr>`;
    }
  },

  renderStats() {
    const s = this.state.stats;
    const statsBar = document.getElementById('ap-stats-bar');
    const items = [
      {key:'pending', label:'Oczekuje',       color:'yellow', icon:'⏳'},
      {key:'approved',label:'Zatwierdzone',    color:'green',  icon:'✅'},
      {key:'synced',  label:'Wysłane',         color:'blue',   icon:'🚀'},
      {key:'rejected',label:'Odrzucone',       color:'red',    icon:'❌'},
      {key:'parameters',label:'Parametry',     color:'purple', icon:'📏'},
    ];
    statsBar.innerHTML = items.map(i=>`
      <div style="background:var(--bg-surface);border:1px solid ${this.state.filter===i.key?`var(--${i.color})`:' var(--border)'};border-radius:var(--radius);padding:12px 20px;display:flex;flex-direction:column;gap:2px;cursor:pointer;transition:all .2s;flex:1;min-width:100px" onclick="ApprovalView.setFilter('${i.key}')">
        <span style="font-size:1.5rem;font-weight:800;color:var(--${i.color})">${s[i.key]||0}</span>
        <span style="font-size:0.75rem;color:var(--text-secondary)">${i.icon} ${i.label}</span>
      </div>`).join('');
  },

  renderTable() {
    const tbody = document.getElementById('ap-tbody');
    if (!this.state.items.length) {
      const msgs = { pending:'Brak oczekujących zmian. Wygeneruj treści AI w module PIM & SEO.', approved:'Brak zatwierdzonych zmian.', synced:'Brak zsynchronizowanych zmian.', rejected:'Brak odrzuconych zmian.', '':'Brak elementów w kolejce.' };
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">Pusto!</div><div class="empty-desc">${msgs[this.state.filter]||''}</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = this.state.items.map(item=>`
      <tr id="ap-row-${item.id}">
        <td><input type="checkbox" class="ap-ck" data-id="${item.id}" style="width:16px;height:16px;accent-color:var(--accent)"></td>
        <td style="max-width:150px">
          <div style="font-weight:500;font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(item.product_name)}">${escHtml(truncate(item.product_name,40))}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">Shop ID: <strong>#${escHtml(item.shop_id)}</strong> <br><span style="font-size:0.65rem">(Wewn. ID: ${item.product_id})</span></div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px">${escHtml(item.ai_provider||'')} • ${fmtDate(item.created_at)}</div>
        </td>
        <td><span class="field-tag">${escHtml(fmtField(item.field_name))}</span></td>
        <td>
          <div class="diff-cell--before">
            <div class="diff-text">${item.field_name==='attributes_suggestions'
              ? '<em style="color:var(--text-muted);font-size:0.75rem">(obecne atrybuty)</em>'
              : item.field_name.startsWith('relation')
              ? '<em style="color:var(--text-muted);font-size:0.75rem">(brak wcześniejszych powiązań)</em>'
              : item.field_name==='description'
              ? truncate((item.value_before || '').replace(/<[^>]+>/g, ''), 200)
              : escHtml(truncate(item.value_before||'—',200))}</div>
          </div>
        </td>
        <td>
          <div class="diff-cell--after">
            <div class="diff-text" id="ap-after-${item.id}">${item.field_name==='attributes_suggestions'
              ? this.fmtAttrSuggestions(item.value_after)
              : item.field_name.startsWith('relation')
              ? this.fmtRelations(item.field_name, item.value_after)
              : item.field_name==='description'
              ? truncate((item.value_after || '').replace(/<[^>]+>/g, ''), 200)
              : escHtml(truncate(item.value_after,200))}</div>
          </div>
          <div class="inline-editor" id="ap-editor-${item.id}">
            ${item.field_name==='description' ? `
              <div class="rich-editor" style="margin-bottom:8px">
                <div class="rich-editor-toolbar">
                  <button type="button" class="rich-editor-btn" data-cmd="bold" title="Pogrubienie"><b>B</b></button>
                  <button type="button" class="rich-editor-btn" data-cmd="italic" title="Kursywa"><i>I</i></button>
                  <button type="button" class="rich-editor-btn" data-cmd="underline" title="Podkreślenie"><u>U</u></button>
                  <button type="button" class="rich-editor-btn" data-cmd="insertUnorderedList" title="Lista punktowana">• Lista</button>
                  <button type="button" class="rich-editor-btn" data-cmd="insertOrderedList" title="Lista numerowana">1. Lista</button>
                  <button type="button" class="rich-editor-btn" data-cmd="removeFormat" title="Wyczyść formatowanie">✕</button>
                </div>
                <div id="ap-edit-ta-${item.id}" class="rich-editor-content" contenteditable="true" style="min-height:150px">${item.value_after || ''}</div>
              </div>
            ` : `
              <textarea id="ap-edit-ta-${item.id}" rows="4">${escHtml(item.value_after)}</textarea>
            `}
            <div style="display:flex;gap:6px;margin-top:6px">
              <button class="btn btn--success btn--sm" onclick="ApprovalView.saveEdit('${item.id}')">💾 Zapisz i zatwierdź</button>
              <button class="btn btn--ghost btn--sm" onclick="ApprovalView.toggleEdit('${item.id}')">Anuluj</button>
            </div>
          </div>
        </td>
        <td><span class="badge badge--${item.status}" id="ap-badge-${item.id}">${this.statusLabel(item.status)}</span></td>
        <td>
          <div class="approval-actions" style="justify-content:flex-end">
            ${item.status!=='approved'&&item.status!=='synced'?`<button class="btn btn--success btn--sm" onclick="ApprovalView.update('${item.id}','approved')" title="Zatwierdź">✅</button>`:''}
            ${item.status!=='synced'?`<button class="btn btn--ghost btn--sm" onclick="ApprovalView.toggleEdit('${item.id}')" title="Edytuj">✏️</button>`:''}
            ${item.status!=='rejected'&&item.status!=='synced'?`<button class="btn btn--danger btn--sm" onclick="ApprovalView.update('${item.id}','rejected')" title="Odrzuć">❌</button>`:''}
          </div>
        </td>
      </tr>`).join('');
    this.updateBulkInfo();
  },

  statusLabel(s) {
    const map={pending:'⏳ oczekuje',approved:'✅ zatwierdzone',synced:'🚀 wysłane',rejected:'❌ odrzucone',error:'💥 błąd'};
    return map[s]||s;
  },

  fmtAttrSuggestions(json) {
    try {
      const arr = JSON.parse(json);
      return arr.map(a=>a.action==='add'
        ? `<span style="color:var(--green)">+ ${escHtml(a.name)}: ${escHtml(a.value)}</span>`
        : `<span style="color:var(--yellow)">~ ${escHtml(a.current)} → ${escHtml(a.suggested)}</span>`
      ).join('<br>');
    } catch { return escHtml(json); }
  },

  fmtRelations(fieldName, json) {
    try {
      const parsed = JSON.parse(json);
      let out = '';
      
      if (fieldName === 'relations') {
        const rels = parsed;
        if (rels.zestawy && rels.zestawy.length) out += `<div><strong>🎁 Zestawy:</strong><ul style="margin:4px 0;padding-left:20px">${rels.zestawy.map(z=>`<li>${z.shop_ids?.join(' + ')} <span style="font-size:0.75rem;color:var(--text-muted)">(${escHtml(z.reason)})</span></li>`).join('')}</ul></div>`;
        if (rels.warianty && rels.warianty.length) out += `<div><strong>🎨 Warianty:</strong><ul style="margin:4px 0;padding-left:20px">${rels.warianty.map(w=>`<li>ID: ${escHtml(w.shop_id)} <span style="font-size:0.75rem;color:var(--text-muted)">(${escHtml(w.reason)})</span></li>`).join('')}</ul></div>`;
        if (rels.akcesoria && rels.akcesoria.length) out += `<div><strong>➕ Akcesoria:</strong><ul style="margin:4px 0;padding-left:20px">${rels.akcesoria.map(a=>`<li>ID: ${escHtml(a.shop_id)} - ${escHtml(a.name)}</li>`).join('')}</ul></div>`;
        if (rels.podobne && rels.podobne.length) out += `<div><strong>🔄 Podobne:</strong><ul style="margin:4px 0;padding-left:20px">${rels.podobne.map(p=>`<li>ID: ${escHtml(p.shop_id)} - ${escHtml(p.name)}</li>`).join('')}</ul></div>`;
        return out || '<span style="color:var(--text-muted)">Brak propozycji powiązań</span>';
      }
      
      if (!Array.isArray(parsed)) return escHtml(json);

      if (fieldName === 'relation_zestawy') {
        out += `<div><strong>🎁 Zestawy:</strong><ul style="margin:4px 0;padding-left:20px">${parsed.map(z=>`<li>${z.shop_ids?.join(' + ')} <span style="font-size:0.75rem;color:var(--text-muted)">(${escHtml(z.reason)})</span></li>`).join('')}</ul></div>`;
      } else if (fieldName === 'relation_warianty') {
        out += `<div><strong>🎨 Warianty:</strong><ul style="margin:4px 0;padding-left:20px">${parsed.map(w=>`<li>ID: ${escHtml(w.shop_id)} <span style="font-size:0.75rem;color:var(--text-muted)">(${escHtml(w.reason)})</span></li>`).join('')}</ul></div>`;
      } else if (fieldName === 'relation_akcesoria') {
        out += `<div><strong>➕ Akcesoria:</strong><ul style="margin:4px 0;padding-left:20px">${parsed.map(a=>`<li>ID: ${escHtml(a.shop_id)} - ${escHtml(a.name)}</li>`).join('')}</ul></div>`;
      } else if (fieldName === 'relation_podobne') {
        out += `<div><strong>🔄 Podobne:</strong><ul style="margin:4px 0;padding-left:20px">${parsed.map(p=>`<li>ID: ${escHtml(p.shop_id)} - ${escHtml(p.name)}</li>`).join('')}</ul></div>`;
      }

      return out || '<span style="color:var(--text-muted)">Brak</span>';
    } catch { return escHtml(json); }
  },

  setFilter(status) {
    this.state.filter = status;
    document.querySelectorAll('.ap-filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.status===status));
    this.renderStats();
    this.load();
  },

  toggleEdit(id) {
    const ed = document.getElementById(`ap-editor-${id}`);
    const ta = document.getElementById(`ap-edit-ta-${id}`);
    const item = this.state.items.find(i=>i.id===id);
    if (ed.classList.contains('active')) { 
      ed.classList.remove('active'); 
    } else { 
      if (item) {
        if (item.field_name === 'description') {
          ta.innerHTML = item.value_after || '';
        } else {
          ta.value = item.value_after || '';
        }
      }
      ed.classList.add('active'); 
      ta.focus(); 
      
      // Wire up rich editor buttons if it is description
      if (item && item.field_name === 'description') {
        const toolbarButtons = ed.querySelectorAll('.rich-editor-toolbar .rich-editor-btn');
        toolbarButtons.forEach(btn => {
          btn.onclick = (e) => {
            e.preventDefault();
            const cmd = btn.getAttribute('data-cmd');
            const val = btn.getAttribute('data-val') || null;
            document.execCommand(cmd, false, val);
            ta.focus();
          };
        });
      }
    }
  },

  async saveEdit(id) {
    const item = this.state.items.find(i=>i.id===id);
    const ta = document.getElementById(`ap-edit-ta-${id}`);
    let edited = '';
    if (item && item.field_name === 'description') {
      edited = ta.innerHTML;
    } else {
      edited = ta?.value || '';
    }
    await this.update(id, 'approved', null, edited);
    document.getElementById(`ap-editor-${id}`).classList.remove('active');
  },

  async update(id, status, note=null, editedValue=null) {
    try {
      await API.patch(`/approval/${id}`, { status, userNote:note, editedValue });
      const item = this.state.items.find(i=>i.id===id);
      if (item) { item.status=status; if(editedValue!==null) item.value_after=editedValue; }
      const badge = document.getElementById(`ap-badge-${item.id}`);
      if(badge) { badge.className=`badge badge--${status}`; badge.textContent=this.statusLabel(status); }
      if(editedValue!==null) {
        const afterEl = document.getElementById(`ap-after-${id}`);
        if(afterEl) afterEl.textContent = escHtml(truncate(editedValue,200));
      }
      Toast.success(status==='approved'?'✅ Zatwierdzone':'❌ Odrzucone');
      refreshApprovalBadge();
    } catch(e) { Toast.error(e.message); }
  },

  updateBulkInfo() {
    const n = this.state.selected.size;
    const info = document.getElementById('ap-selected-info');
    if(info) info.textContent = n>0 ? `${n} zaznaczonych` : 'Zaznacz do akcji zbiorczej';
  },

  async bulkAction(status) {
    const ids = [...document.querySelectorAll('.ap-ck:checked')].map(c=>c.dataset.id);
    if(!ids.length) return Toast.warn('Zaznacz elementy');
    try {
      await API.post('/approval/bulk', { ids, status });
      Toast.success(`${status==='approved'?'✅ Zatwierdzone':'❌ Odrzucone'} ${ids.length} zmian`);
      this.state.selected.clear();
      refreshApprovalBadge();
      await this.load();
    } catch(e) { Toast.error(e.message); }
  },

  async approveAll() {
    const pending = this.state.items.filter(i=>i.status==='pending').map(i=>i.id);
    if(!pending.length) return Toast.info('Brak oczekujących zmian');
    try {
      await API.post('/approval/bulk', { ids:pending, status:'approved' });
      Toast.success(`✅ Zatwierdzono ${pending.length} zmian`);
      refreshApprovalBadge();
      await this.load();
    } catch(e) { Toast.error(e.message); }
  },

  async syncApproved() {
    try {
      setBtn('appr-sync-btn', true);
      const r = await API.post('/approval/sync', {});
      if (r.errors && r.errors.length) {
        const firstError = r.errors[0].error || 'Nieznany błąd';
        Toast.error(`Błąd synchronizacji (${r.errors.length}): ${firstError}`);
        console.warn('Sync errors:', r.errors);
      } else {
        Toast.success(`Pomyślnie zsynchronizowano ${r.synced} elementów`);
      }
      await this.load();
    } catch(e) { Toast.error(e.message); }
    finally { setBtn('appr-sync-btn', false); }
  },

  bindEvents() {
    document.getElementById('ap-approve-all-btn').addEventListener('click', ()=>this.approveAll());
    document.getElementById('ap-sync-btn').addEventListener('click', ()=>this.syncApproved());
    document.getElementById('ap-export-xml-btn').addEventListener('click', ()=>{ window.location.href=API.downloadUrl('/approval/export/xml'); });
    document.getElementById('ap-export-csv-btn').addEventListener('click', ()=>{ window.location.href=API.downloadUrl('/approval/export/csv'); });
    document.getElementById('ap-bulk-approve').addEventListener('click', ()=>this.bulkAction('approved'));
    document.getElementById('ap-bulk-reject').addEventListener('click', ()=>this.bulkAction('rejected'));
    document.getElementById('ap-check-all').addEventListener('change', e=>{
      document.querySelectorAll('.ap-ck').forEach(c=>{
        c.checked=e.target.checked;
        e.target.checked ? this.state.selected.add(c.dataset.id) : this.state.selected.delete(c.dataset.id);
      });
      this.updateBulkInfo();
    });
    document.getElementById('ap-table-wrap').addEventListener('change', e=>{
      if(!e.target.classList.contains('ap-ck')) return;
      e.target.checked ? this.state.selected.add(e.target.dataset.id) : this.state.selected.delete(e.target.dataset.id);
      this.updateBulkInfo();
    });
    document.querySelectorAll('.ap-filter-btn').forEach(b=>b.addEventListener('click',()=>this.setFilter(b.dataset.status)));
    const fieldFilter = document.getElementById('ap-field-filter');
    if (fieldFilter) {
      fieldFilter.addEventListener('change', e => {
        this.state.fieldFilter = e.target.value;
        this.load();
      });
    }
  },
};
