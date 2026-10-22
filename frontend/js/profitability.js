'use strict';
window.ProfitabilityView = (() => {
  let aTab = 'costs';
  const fmtM = v => v==null?'--':(+v).toFixed(2)+' zl';
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function render() {
    const el = document.getElementById('view-profitability');
    if(!el) return;
    el.innerHTML = '<div class="prof-tabs" id="ptabs">' +
      '<button class="prof-tab'+(aTab==='costs'?' active':'')+'" data-tab="costs">&#128218; Slownik Kosztow</button>' +
      '<button class="prof-tab'+(aTab==='products'?' active':'')+'" data-tab="products">&#128230; Baza Produktow</button>' +
      '<button class="prof-tab'+(aTab==='sim'?' active':'')+'" data-tab="sim">&#128200; Symulator</button>' +
      '</div>' +
      '<div id="pt-costs" class="prof-tab-content'+(aTab==='costs'?' active':'')+'"></div>' +
      '<div id="pt-products" class="prof-tab-content'+(aTab==='products'?' active':'')+'"></div>' +
      '<div id="pt-sim" class="prof-tab-content'+(aTab==='sim'?' active':'')+'"></div>';
    document.querySelectorAll('.prof-tab[data-tab]').forEach(b => {
      b.addEventListener('click', () => {
        aTab = b.dataset.tab;
        document.querySelectorAll('.prof-tab').forEach(x => x.classList.toggle('active', x===b));
        document.querySelectorAll('.prof-tab-content').forEach(x => x.classList.remove('active'));
        document.getElementById('pt-'+aTab)?.classList.add('active');
        renderTab(aTab);
      });
    });
    renderTab(aTab);
  }

  function renderTab(t) {
    if(t==='costs')    renderCosts();
    if(t==='products') renderProducts();
    if(t==='sim')      renderSim();
  }

  async function renderCosts() {
    const el = document.getElementById('pt-costs');
    if(!el) return;
    let platforms=[], settings={};
    try { platforms = await API.get('/profitability/platforms'); } catch{}
    try { settings  = await API.get('/profitability/settings'); } catch{}
    const sz = JSON.parse(settings.shipping_zones||'[]');

    el.innerHTML =
      '<div class="prof-card">' +
        '<h3 class="prof-card-title">&#127760; Platformy i Słownik Kosztów</h3>' +
        '<p class="prof-card-sub" style="margin-bottom:12px">Każda platforma ma własne prowizje, dopłaty wysyłkowe oraz koszty operacyjne. Wartości puste = użyj ustawień globalnych.</p>' +
        '<div class="prof-platform-grid" id="pf-grid">' +
        (await buildPlatCards(platforms)) +
        '</div>' +
        '<button class="btn btn--primary btn--sm" id="pf-add-btn">+ Dodaj platformę</button>' +
      '</div>' +
      '<div class="prof-card">' +
        '<h3 class="prof-card-title">&#9881; Ustawienia Globalne (fallback)</h3>' +
        '<p class="prof-card-sub">Używane gdy platforma nie ma własnych kosztów operacyjnych.</p>' +
        '<div class="prof-settings-grid">' +
        sField('Wysyłka domyślna (zł)','shipping_default',settings.shipping_default,'number') +
        sField('Pakowanie/karton (zł)','packing_cost',settings.packing_cost,'number') +
        sField('Płatność/bramka (%)','payment_fee_pct',settings.payment_fee_pct,'number') +
        sField('Min. marża alert (%)','min_margin_alert_pct',settings.min_margin_alert_pct,'number') +
        '</div><button class="btn btn--primary btn--sm" id="settings-save-btn">Zapisz globalne</button>' +
      '</div>' +
      '<div class="prof-card">' +
        '<h3 class="prof-card-title">&#9992; Strefy Wagowe Wysyłki (globalne)</h3>' +
        '<p class="prof-card-sub">Definiuj progi wagowe dla kosztów wysyłki. Waga w gramach. Nadpisywane przez dopłaty per-platforma.</p>' +
        '<div id="zones-wrap">' + zonesHtml(sz) + '</div>' +
        '<button class="btn btn--ghost btn--sm" id="zone-add-btn">+ Dodaj strefę</button>' +
        '<button class="btn btn--primary btn--sm" style="margin-left:8px" id="zones-save-btn">Zapisz strefy</button>' +
      '</div>';

    bindCosts(platforms, settings, sz);
  }

  function sField(label,id,val,type='text') {
    return '<div class="form-group"><label class="prof-settings-label">'+label+'</label>' +
      '<input class="prof-input" id="set-'+id+'" type="'+type+'" value="'+(val||'')+'" step="0.01" placeholder="globalne"></div>';
  }

  function platOpCostField(label, key, val) {
    return '<div class="form-group" style="margin-bottom:6px">' +
      '<label style="font-size:.72rem;color:var(--text-muted);display:block;margin-bottom:3px">'+label+'</label>' +
      '<input class="prof-input prof-plat-op" data-key="'+key+'" type="number" step="0.01" ' +
        'value="'+(val!=null?val:'')+'" placeholder="globalne" style="width:100%;padding:5px 8px;font-size:.8rem"></div>';
  }

  async function buildPlatCards(platforms) {
    const cards = await Promise.all(platforms.map(async p => {
      let shipping = [];
      try { shipping = await API.get('/profitability/platforms/'+p.id+'/shipping'); } catch{}
      const comms = (p.commissions||[]).length 
        ? '<div style="padding: 8px 12px; background: var(--bg-2); border-radius: 6px; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; border-left: 3px solid var(--accent);"><span style="color:var(--text-primary); font-weight: 600;">Załadowano plik z prowizjami:</span><br>Aktywnych kategorii: ' + (p.commissions||[]).length + '</div>' +
          '<button class="btn btn--danger btn--sm prof-del-comms" data-pid="'+p.id+'" style="font-size:.7rem;padding:2px 8px">Usuń plik prowizji</button>'
        : '<div style="padding: 8px 12px; background: rgba(248,113,113,0.1); border-radius: 6px; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; border-left: 3px solid #f87171;">Brak wgranego pliku z prowizjami</div>';
      const ships = shipping.length 
        ? '<div style="padding: 8px 12px; background: var(--bg-2); border-radius: 6px; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; border-left: 3px solid var(--accent);"><span style="color:var(--text-primary); font-weight: 600;">Załadowano plik dostaw:</span><br>Skonfigurowanych stref wagowych: ' + shipping.length + '</div>' +
          '<button class="btn btn--danger btn--sm prof-del-ships" data-pid="'+p.id+'" style="font-size:.7rem;padding:2px 8px">Usuń plik dostaw</button>'
        : '<div style="padding: 8px 12px; background: rgba(248,113,113,0.1); border-radius: 6px; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; border-left: 3px solid #f87171;">Brak wgranego pliku z dostawami</div>';

      return '<div class="prof-platform-card" data-pid="'+p.id+'">' +
        // Header
        '<div class="prof-platform-header">' +
          '<div class="prof-platform-icon" style="background:'+esc(p.color)+'20">'+esc(p.icon)+'</div>' +
          '<span class="prof-platform-name">'+esc(p.name)+'</span>' +
          '<div class="prof-platform-actions">' +
            '<button class="btn btn--ghost btn--sm" data-pf-del="'+p.id+'" title="Usuń">x</button>' +
          '</div>' +
        '</div>' +
        // Main: Prowizje | Dopłaty wysyłkowe
        '<div style="display:flex;flex-direction:column;gap:16px;margin-bottom:12px">' +
          // Prowizje
          '<div>' +
            '<p style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin:0 0 6px">Prowizje</p>' +
            '<div class="prof-commission-list">'+comms+'</div>' +
            '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
              '<input type="file" accept=".xlsx,.xls,.csv,.pdf" style="display:none" multiple id="ci-comm-'+p.id+'">' +
              '<button class="btn btn--ghost btn--sm" style="font-size:.75rem;flex:1;min-width:140px" onclick="document.getElementById(\'ci-comm-'+p.id+'\').click()">&#8679; Import prowizji (xlsx)</button>' +
            '</div>' +
          '</div>' +
          // Dopłaty wysyłkowe
          '<div>' +
            '<p style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin:0 0 6px">Dopłaty wysyłkowe</p>' +
            '<div class="prof-commission-list">'+ships+'</div>' +
            '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
              '<input type="file" accept=".xlsx,.xls,.csv,.pdf" style="display:none" multiple id="ci-ship-'+p.id+'">' +
              '<button class="btn btn--ghost btn--sm" style="font-size:.75rem;flex:1;min-width:140px" onclick="document.getElementById(\'ci-ship-'+p.id+'\').click()">&#8679; Import dostawy (xlsx)</button>' +
              '<input type="file" accept=".xlsx,.xls,.csv,.pdf" style="display:none" id="ai-inp-ship-'+p.id+'">' +
              '<button class="btn btn--primary btn--sm" style="font-size:.75rem;flex:1;min-width:140px" onclick="document.getElementById(\'ai-inp-ship-'+p.id+'\').click()">&#129302; AI Import (PDF)</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="prof-plat-opcosts" data-pid="'+p.id+'">' +
          '<p style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin:0 0 8px">&#128179; Koszty Operacyjne</p>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(90px, 1fr));gap:8px">' +
            platOpCostField('Wysyłka (zł)', 'shipping_default', p.shipping_default) +
            platOpCostField('Pakowanie (zł)', 'packing_cost', p.packing_cost) +
            platOpCostField('Bramka (%)', 'payment_fee_pct', p.payment_fee_pct) +
          '</div>' +
          '<label class="form-label" style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer">' +
            '<input type="checkbox" class="prof-plat-op-check" data-key="commission_on_shipping" '+(p.commission_on_shipping === 0 ? '' : 'checked')+'>' +
            'Naliczaj prowizję od kosztów dostawy' +
          '</label>' +
          '<button class="btn btn--primary btn--sm prof-opcost-save" data-pid="'+p.id+'" style="margin-top:6px">Zapisz koszty</button>' +
        '</div>' +
        aiImportSection(p) +
      '</div>';
    }));
    return cards.join('');
  }

  function aiImportSection(p) {
    return '<div class="prof-ai-import" id="ai-imp-'+p.id+'">' +
      '<div class="prof-ai-import-title">&#129302; AI Import prowizji</div>' +
      '<div class="prof-ai-import-grid">' +
        '<div class="prof-ai-dropzone" id="ai-drop-comm-'+p.id+'" data-pid="'+p.id+'" data-role="comm">' +
          '<input type="file" accept=".xlsx,.xls,.csv,.pdf" style="display:none" id="ai-inp-comm-'+p.id+'">' +
          '<div class="prof-ai-drop-icon">&#128202;</div>' +
          '<div class="prof-ai-drop-label">Plik prowizji</div>' +
          '<div class="prof-ai-drop-sub">kategoria &#8594; prowizja%</div>' +
          '<div class="prof-ai-drop-fname" id="ai-fname-comm-'+p.id+'"></div>' +
        '</div>' +
      '</div>' +
      '<button class="btn btn--primary btn--sm prof-ai-import-btn" id="ai-run-'+p.id+'" data-pid="'+p.id+'" disabled>' +
        '&#129302; Importuj przez AI' +
      '</button>' +
      '<button class="btn btn--ghost btn--sm prof-sellasist-sync" data-pid="'+p.id+'" style="margin-top:6px;width:100%">' +
        '&#8635; Pobierz kategorie z Sellasist' +
      '</button>' +
      '<div class="prof-ai-status" id="ai-status-'+p.id+'"></div>' +
    '</div>';
  }

  function zonesHtml(zones) {
    if(!zones.length) return '<p style="color:var(--text-muted);font-size:.82rem">Brak stref — uzywana jest cena domyslna.</p>';
    return '<table class="prof-zones-table"><thead><tr><th>Max waga (g)</th><th>Cena (zl)</th><th></th></tr></thead><tbody>' +
      zones.map((z,i)=>'<tr><td><input class="prof-input" style="width:100px" data-zi="'+i+'" data-zf="max_weight_g" value="'+z.max_weight_g+'"></td>' +
        '<td><input class="prof-input" style="width:100px" data-zi="'+i+'" data-zf="price" value="'+z.price+'"></td>' +
        '<td><button class="btn btn--danger btn--sm" data-zdel="'+i+'">x</button></td></tr>').join('') +
      '</tbody></table>';
  }  function bindCosts(platforms, settings, sz) {
    // Global settings save
    document.getElementById('settings-save-btn')?.addEventListener('click', async () => {
      const d = {};
      ['shipping_default','packing_cost','payment_fee_pct','min_margin_alert_pct'].forEach(k => {
        d[k] = parseFloat(document.getElementById('set-'+k)?.value)||0;
      });
      try { await API.patch('/profitability/settings', d); Toast.success('Ustawienia globalne zapisane'); renderCosts(); }
      catch(e) { Toast.error(e.message); }
    });

    // Delete entire commissions file
    document.querySelectorAll('.prof-del-comms').forEach(b => b.addEventListener('click', async e => {
      if(!confirm('Usunąć całkowicie wgrane prowizje dla tej platformy?')) return;
      try {
        await API.delete('/profitability/platforms/'+e.target.dataset.pid+'/commissions');
        renderCosts();
      } catch(err){ window.Toast?.error(err.message); }
    }));

    // Delete entire shipping file
    document.querySelectorAll('.prof-del-ships').forEach(b => b.addEventListener('click', async e => {
      if(!confirm('Usunąć całkowicie wgrane dopłaty wysyłkowe dla tej platformy?')) return;
      try {
        await API.delete('/profitability/platforms/'+e.target.dataset.pid+'/shipping');
        renderCosts();
      } catch(err){ window.Toast?.error(err.message); }
    }));

    // Per-platform operational costs save
    document.querySelectorAll('.prof-opcost-save').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = parseInt(btn.dataset.pid);
        const card = btn.closest('.prof-plat-opcosts');
        const d = {};
        card.querySelectorAll('.prof-plat-op').forEach(inp => {
          const key = inp.dataset.key;
          const val = inp.value.trim();
          d[key] = val === '' ? null : parseFloat(val);
        });
        card.querySelectorAll('.prof-plat-op-check').forEach(inp => {
          const key = inp.dataset.key;
          d[key] = inp.checked ? 1 : 0;
        });
        try {
          await API.patch('/profitability/platforms/'+pid, d);
          Toast.success('Koszty operacyjne zapisane');
        } catch(e) { Toast.error(e.message); }
      });
    });

    // Add platform
    document.getElementById('pf-add-btn')?.addEventListener('click', () => {
      Modal.show({ title:'+ Nowa platforma', body:
        '<div class="form-group"><label class="form-label">Nazwa</label><input class="form-input" id="np-name" placeholder="np. Allegro"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        '<div class="form-group"><label class="form-label">Ikona</label><input class="form-input" id="np-icon" value="&#128722;"></div>' +
        '<div class="form-group"><label class="form-label">Kolor</label><input type="color" class="form-input" id="np-color" value="#6366f1" style="height:42px;padding:4px"></div></div>' +
        '<label class="form-label" style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer"><input type="checkbox" id="np-comm-ship" checked> Naliczaj prowizję od kosztów dostawy</label>',
        footer:'<button class="btn btn--ghost btn--sm" onclick="Modal.hide()">Anuluj</button><button class="btn btn--primary" id="np-save">Dodaj</button>'
      });
      document.getElementById('np-save').addEventListener('click', async () => {
        const name=document.getElementById('np-name').value.trim();
        if(!name){Toast.error('Podaj nazwę');return;}
        try { 
          await API.post('/profitability/platforms', {
            name, 
            icon: document.getElementById('np-icon').value, 
            color: document.getElementById('np-color').value,
            commission_on_shipping: document.getElementById('np-comm-ship').checked ? 1 : 0
          }); 
          Modal.hide(); renderCosts(); 
        }
        catch(e){Toast.error(e.message);}
      });
    });

    document.querySelectorAll('[data-pf-del]').forEach(b => {
      b.addEventListener('click', async () => {
        if(!confirm('Usunąć platformę?')) return;
        try { await API.del('/profitability/platforms/'+b.dataset.pfDel); renderCosts(); }
        catch(e){Toast.error(e.message);}
      });
    });

    document.querySelectorAll('[data-comm-del]').forEach(b => {
      b.addEventListener('click', async () => {
        try { await API.del('/profitability/commissions/'+b.dataset.commDel); renderCosts(); }
        catch(e){Toast.error(e.message);}
      });
    });

    document.querySelectorAll('[data-pf-id]').forEach(b => {
      b.addEventListener('click', () => {
        const pid = b.dataset.pfId;
        Modal.show({ title:'+ Prowizja', body:
          '<div class="form-group"><label class="form-label">Kategoria</label><input class="form-input" id="nc-cat" value="Ogólna"></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' +
          '<div class="form-group"><label class="form-label">Prowizja %</label><input class="form-input" id="nc-rate" type="number" step="0.1" value="8"></div>' +
          '<div class="form-group"><label class="form-label">Min opłata</label><input class="form-input" id="nc-min" type="number" step="0.01" value="0"></div>' +
          '<div class="form-group"><label class="form-label">Max opłata</label><input class="form-input" id="nc-max" type="number" step="0.01" placeholder="brak"></div></div>',
          footer:'<button class="btn btn--ghost btn--sm" onclick="Modal.hide()">Anuluj</button><button class="btn btn--primary" id="nc-save">Dodaj</button>'
        });
        document.getElementById('nc-save').addEventListener('click', async () => {
          const data = { category_name: document.getElementById('nc-cat').value.trim()||'Ogólna',
            rate_pct: parseFloat(document.getElementById('nc-rate').value)||0,
            min_fee: parseFloat(document.getElementById('nc-min').value)||0,
            max_fee: parseFloat(document.getElementById('nc-max').value)||null };
          try { await API.post('/profitability/platforms/'+pid+'/commissions',data); Modal.hide(); renderCosts(); }
          catch(e){Toast.error(e.message);}
        });
      });
    });

    platforms.forEach(p => {
      // ── Import prowizji z pliku (xlsx/csv) ──────────────────────────────
      const inpComm = document.getElementById('ci-comm-'+p.id);
      if(inpComm) inpComm.addEventListener('change', async () => {
        if(!inpComm.files.length) return;
        let total = 0;
        for (let i = 0; i < inpComm.files.length; i++) {
          const fd = new FormData(); fd.append('file', inpComm.files[i]);
          try {
            const r = await API.upload('/profitability/platforms/'+p.id+'/commissions/import', fd);
            total += r.imported || 0;
          } catch(e){ Toast.error(`Plik ${inpComm.files[i].name}: ${e.message}`); }
        }
        if (total > 0) Toast.success(`Zaimportowano łącznie ${total} prowizji`);
        renderCosts();
        inpComm.value = '';
      });

      // ── Import dopłat wysyłkowych z pliku (xlsx/csv) ────────────────────
      const inpShip = document.getElementById('ci-ship-'+p.id);
      if(inpShip) inpShip.addEventListener('change', async () => {
        if(!inpShip.files.length) return;
        let total = 0;
        for (let i = 0; i < inpShip.files.length; i++) {
          const fd = new FormData(); fd.append('file', inpShip.files[i]);
          try {
            const r = await API.upload('/profitability/platforms/'+p.id+'/shipping/import', fd);
            total += r.imported || 0;
          } catch(e){ Toast.error(`Plik ${inpShip.files[i].name}: ${e.message}`); }
        }
        if (total > 0) Toast.success(`Zaimportowano łącznie ${total} dopłat wysyłkowych`);
        renderCosts();
        inpShip.value = '';
      });

      // ── AI Import dopłat wysyłkowych z pliku (PDF) ────────────────────
      const aiInpShip = document.getElementById('ai-inp-ship-'+p.id);
      if(aiInpShip) aiInpShip.addEventListener('change', async () => {
        if(!aiInpShip.files.length) return;
        const fd = new FormData(); fd.append('file', aiInpShip.files[0]);
        Toast.info(`Wysyłanie pliku ${aiInpShip.files[0].name} do analizy AI...`);
        try {
          const r = await API.upload('/profitability/platforms/'+p.id+'/ai-import-shipping', fd);
          if (r.success) Toast.success(`AI zapisało ${r.imported} stref wysyłkowych!`);
          renderCosts();
        } catch(e){ Toast.error(`Błąd AI: ${e.message}`); }
        aiInpShip.value = '';
      });

      // ── AI import (plik prowizji → drop zone) ──────────────────────────
      const fileState = { cat: null, comm: null };

      ['comm'].forEach(role => {
        const dropZone = document.getElementById('ai-drop-'+role+'-'+p.id);
        const fileInp  = document.getElementById('ai-inp-'+role+'-'+p.id);
        const fnLabel  = document.getElementById('ai-fname-'+role+'-'+p.id);
        const runBtn   = document.getElementById('ai-run-'+p.id);
        if(!dropZone || !fileInp) return;

        dropZone.addEventListener('click', () => fileInp.click());
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => {
          e.preventDefault(); dropZone.classList.remove('drag-over');
          const f = e.dataTransfer.files[0]; if(!f) return;
          fileState[role] = f;
          if(fnLabel) fnLabel.textContent = f.name;
          dropZone.classList.add('has-file');
          // AI import only needs comm file now (single-file mode)
          if(fileState.comm) runBtn.removeAttribute('disabled');
        });
        fileInp.addEventListener('change', () => {
          const f = fileInp.files[0]; if(!f) return;
          fileState[role] = f;
          if(fnLabel) fnLabel.textContent = f.name;
          dropZone.classList.add('has-file');
          if(fileState.comm) runBtn.removeAttribute('disabled');
        });
      });

      const runBtn   = document.getElementById('ai-run-'+p.id);
      const statusEl = document.getElementById('ai-status-'+p.id);
      if(!runBtn) return;

      runBtn.addEventListener('click', async () => {
        if(!fileState.comm) { Toast.error('Wybierz plik prowizji'); return; }
        runBtn.disabled = true;
        runBtn.textContent = '⏳ Analizuję...';
        if(statusEl) statusEl.innerHTML = '<span style="color:var(--text-muted);font-size:.8rem">AI analizuje plik, poczekaj...</span>';

        const fd = new FormData();
        // AI import: use comm file as both (single-file mode for commissions only)
        fd.append('categories', fileState.comm);
        fd.append('commissions', fileState.comm);
        try {
          const r = await API.upload('/profitability/platforms/'+p.id+'/ai-import', fd);
          const notFoundHtml = r.notFoundList?.length
            ? '<br><small style="color:var(--text-muted)">Nie dopasowano ('+r.productsNotFound+'): '+r.notFoundList.slice(0,5).map(x=>esc(x.item||'')).join(', ')+(r.productsNotFound>5?'...':'')+'</small>'
            : '';
          if(statusEl) statusEl.innerHTML =
            '<span style="color:#10b981;font-size:.8rem">&#10003; Kategorie: '+r.categoriesImported+' nowych | Produkty dopasowane: '+r.productsMatched+notFoundHtml+'</span>';
          Toast.success('AI Import: '+r.categoriesImported+' kategorii zaimportowano');
          renderCosts();
        } catch(e) {
          if(statusEl) statusEl.innerHTML = '<span style="color:#f87171;font-size:.8rem">&#10005; '+esc(e.message)+'</span>';
          Toast.error(e.message);
          runBtn.disabled = false;
          runBtn.disabled = false;
          runBtn.textContent = '🤖 Importuj przez AI';
        }
      });

      const syncBtn = document.querySelector('.prof-sellasist-sync[data-pid="'+p.id+'"]');
      if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
          syncBtn.disabled = true;
          syncBtn.textContent = '⏳ Pobieranie...';
          try {
            const r = await API.post('/profitability/platforms/'+p.id+'/sync-sellasist');
            Toast.success(`Zsynchronizowano Sellasist: dopasowano ${r.matched} z ${r.totalFetched} produktów`);
            if(statusEl) statusEl.innerHTML = '<span style="color:#10b981;font-size:.8rem">&#10003; Sellasist zsynchronizowany ('+r.matched+')</span>';
            renderCosts();
          } catch(e) {
            Toast.error('Błąd synchronizacji: ' + e.message);
            if(statusEl) statusEl.innerHTML = '<span style="color:#f87171;font-size:.8rem">&#10005; '+esc(e.message)+'</span>';
          }
          syncBtn.disabled = false;
          syncBtn.textContent = '↻ Pobierz kategorie z Sellasist';
        });
      }
    });

    let zones = sz;
    function refreshZones(){document.getElementById('zones-wrap').innerHTML=zonesHtml(zones);}

    document.getElementById('zone-add-btn')?.addEventListener('click', () => {
      zones.push({max_weight_g:1000,price:9.99}); refreshZones();
    });

    document.getElementById('zones-wrap')?.addEventListener('input', e => {
      const el=e.target; if(!el.dataset.zi) return;
      zones[el.dataset.zi][el.dataset.zf] = parseFloat(el.value)||0;
    });
    document.getElementById('zones-wrap')?.addEventListener('click', e => {
      const b=e.target.closest('[data-zdel]'); if(!b) return;
      zones.splice(parseInt(b.dataset.zdel),1); refreshZones();
    });

    document.getElementById('zones-save-btn')?.addEventListener('click', async () => {
      try { await API.patch('/profitability/settings',{shipping_zones: zones}); Toast.success('Strefy zapisane'); }
      catch(e){Toast.error(e.message);}
    });

    // Shipping surcharge handlers
    document.querySelectorAll('[data-ship-del]').forEach(b => {
      b.addEventListener('click', async () => {
        try { await API.del('/profitability/platform-shipping/'+b.dataset.shipDel); renderCosts(); }
        catch(e){Toast.error(e.message);}
      });
    });
    document.querySelectorAll('[data-ship-pid]').forEach(b => {
      b.addEventListener('click', () => {
        const pid = b.dataset.shipPid;
        Modal.show({ title:'+ Dopłata wysyłkowa', body:
          '<div class="form-group"><label class="form-label">Etykieta</label><input class="form-input" id="ns-label" value="Standard"></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' +
          '<div class="form-group"><label class="form-label">Min waga (g)</label><input class="form-input" id="ns-min" type="number" value="0"></div>' +
          '<div class="form-group"><label class="form-label">Max waga (g)</label><input class="form-input" id="ns-max" type="number" value="99999"></div>' +
          '<div class="form-group"><label class="form-label">Dopłata (zł)</label><input class="form-input" id="ns-sur" type="number" step="0.01" value="0"></div></div>',
          footer:'<button class="btn btn--ghost btn--sm" onclick="Modal.hide()">Anuluj</button><button class="btn btn--primary" id="ns-save">Dodaj</button>'
        });
        document.getElementById('ns-save').addEventListener('click', async () => {
          const data = { label: document.getElementById('ns-label').value.trim()||'Standard',
            min_weight_g: parseFloat(document.getElementById('ns-min').value)||0,
            max_weight_g: parseFloat(document.getElementById('ns-max').value)||99999,
            surcharge: parseFloat(document.getElementById('ns-sur').value)||0 };
          try { await API.post('/profitability/platforms/'+pid+'/shipping', data); Modal.hide(); renderCosts(); }
          catch(e){Toast.error(e.message);}
        });
      });
    });
  }

  let prodSearch='', prodPage=0, prodSortCol='name', prodSortDir='asc', prodMfg=''; const PROD_PG=100;
  
  function prodSortArrow(col){ return prodSortCol===col ? (prodSortDir==='asc'?' ▲':' ▼') : ''; }

  async function renderProducts() {
    const el=document.getElementById('pt-products'); if(!el) return;
    const url = '/profitability/products?search='+encodeURIComponent(prodSearch)+
                '&manufacturer='+encodeURIComponent(prodMfg)+
                '&sortCol='+encodeURIComponent(prodSortCol)+
                '&sortDir='+encodeURIComponent(prodSortDir)+
                '&limit='+PROD_PG+'&offset='+(prodPage*PROD_PG);
    const {rows,total} = await API.get(url).catch(()=>({rows:[],total:0}));
    const pages = Math.ceil(total/PROD_PG);
    el.innerHTML =
      '<div class="prof-card" style="margin-bottom:12px">' +
      '<h3 class="prof-card-title">&#10133; Dodaj produkt ręcznie</h3>' +
      '<form id="prof-add-prod" class="prof-form-panel" style="display:flex;gap:10px;flex-wrap:nowrap;align-items:center;overflow-x:auto;">' +
      '<input type="text" id="pp-ean" class="prof-input" placeholder="EAN" required>' +
      '<input type="text" id="pp-name" class="prof-input" placeholder="Nazwa" required style="flex:2">' +
      '<input type="number" id="pp-buy" class="prof-input" placeholder="Cena zakupu" step="0.01">' +
      '<input type="number" id="pp-sell" class="prof-input" placeholder="Cena sprzedaży (Allegro)" step="0.01">' +
      '<input type="number" id="pp-weight" class="prof-input" placeholder="Waga (g)" step="1">' +
      '<button type="submit" class="btn btn--primary">Dodaj</button>' +
      '</form></div>' +
      '<div class="prof-card"><h3 class="prof-card-title">&#127381; Baza Produktów (z Sourcingu)</h3>' +
      '<p class="prof-card-sub">Produkty i ich wagi są pobierane automatycznie z połączonych hurtowni i Subiekta.</p>' +
      '<div class="prof-products-toolbar">' +
      '<input class="compare-search" id="prod-search" placeholder="Szukaj EAN lub nazwy..." value="'+esc(prodSearch)+'">' +
      '<input class="compare-search" id="prod-mfg" placeholder="Producent..." value="'+esc(prodMfg)+'" style="margin-left:10px;max-width:150px">' +
      '<span style="margin-left:auto;color:var(--text-muted);font-size:.8rem">Lacznie: '+total+'</span>' +
      (pages>1?'<button class="btn btn--ghost btn--sm" id="pp-prev" '+(prodPage===0?'disabled':'')+'>&#8249;</button>' +
        '<span style="font-size:.8rem">'+( prodPage+1)+'/'+pages+'</span>' +
        '<button class="btn btn--ghost btn--sm" id="pp-next" '+(prodPage>=pages-1?'disabled':'')+'>&#8250;</button>':'') +
      '</div>' +
      '<div class="prof-table-wrap"><table class="prof-table"><thead><tr>' +
      '<th>#</th>' +
      '<th data-psort="ean" style="cursor:pointer;user-select:none">EAN'+prodSortArrow('ean')+'</th>' +
      '<th data-psort="name" style="cursor:pointer;user-select:none">Nazwa'+prodSortArrow('name')+'</th>' +
      '<th data-psort="manufacturer" style="cursor:pointer;user-select:none">Producent'+prodSortArrow('manufacturer')+'</th>' +
      '<th data-psort="stock" style="text-align:right;cursor:pointer;user-select:none">Stan'+prodSortArrow('stock')+'</th>' +
      '<th data-psort="buy" style="cursor:pointer;user-select:none">C.Zakupu'+prodSortArrow('buy')+'</th>' +
      '<th data-psort="sell" style="cursor:pointer;user-select:none">C.Sprzed.(Allegro)'+prodSortArrow('sell')+'</th>' +
      '<th>Waga(g)</th>' +
      '</tr></thead><tbody>' +
      (rows.length ? rows.map((r,i)=>'<tr>' +
        '<td class="row-num">'+(prodPage*PROD_PG+i+1)+'</td>' +
        '<td style="font-family:monospace;font-size:.78rem">'+(r.ean||'—')+'</td>' +
        '<td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.name)+'">'+esc(r.name)+'</td>' +
        '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.manufacturer)+'">'+esc(r.manufacturer)+'</td>' +
        '<td style="text-align:right">'+(r.stock??'-')+'</td>' +
        '<td class="sim-price-cell">'+fmtM(r.buy_price)+'</td>' +
        '<td class="sim-price-cell">'+fmtM(r.sell_price)+'</td>' +
        '<td>'+(r.weight_g||'—')+'</td>' +
        '</tr>').join('') :
        '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">Brak produktow — zaimportuj z Subiekta w Sourcingu</td></tr>'
      ) +
      '</tbody></table></div></div>';

    bindProducts();
  }

  function bindProducts() {
    document.getElementById('prod-search')?.addEventListener('input', e => {
      clearTimeout(window._pst); window._pst=setTimeout(()=>{prodSearch=e.target.value;prodPage=0;renderProducts();},400);
    });
    document.getElementById('prod-mfg')?.addEventListener('input', e => {
      clearTimeout(window._pmst); window._pmst=setTimeout(()=>{prodMfg=e.target.value;prodPage=0;renderProducts();},400);
    });
    document.getElementById('pp-prev')?.addEventListener('click', ()=>{prodPage--;renderProducts();});
    document.getElementById('pp-next')?.addEventListener('click', ()=>{prodPage++;renderProducts();});
    
    document.querySelectorAll('.prof-table th[data-psort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.psort;
        if(prodSortCol === col) { prodSortDir = prodSortDir === 'asc' ? 'desc' : 'asc'; }
        else { prodSortCol = col; prodSortDir = 'asc'; }
        renderProducts();
      });
    });

    document.getElementById('prof-add-prod')?.addEventListener('submit', async e => {
      e.preventDefault();
      const data = {
        ean: document.getElementById('pp-ean').value.trim(),
        name: document.getElementById('pp-name').value.trim(),
        buy_price: parseFloat(document.getElementById('pp-buy').value)||0,
        sell_price: parseFloat(document.getElementById('pp-sell').value)||0,
        weight_g: parseFloat(document.getElementById('pp-weight').value)||0
      };
      try { await API.post('/profitability/products', data); Toast.success('Produkt dodany'); document.getElementById('prof-add-prod').reset(); renderProducts(); }
      catch(err){Toast.error(err.message);}
    });
  }

  let simSearch='', simMfg='', simCat='', simAlertsOnly=false, simPage=0, simSortCol='name', simSortDir='asc'; const SIM_PG=200;
  function sortArrow(col){ return simSortCol===col ? (simSortDir==='asc'?' ▲':' ▼') : ''; }
  function thSort(label,col,extra=''){
    return '<th data-sort="'+col+'" style="cursor:pointer;user-select:none'+extra+'">'+label+sortArrow(col)+'</th>';
  }
  async function renderSim() {
    const activeId = document.activeElement?.id;
    const selStart = document.activeElement?.selectionStart;
    const selEnd = document.activeElement?.selectionEnd;

    const el=document.getElementById('pt-sim'); if(!el) { console.error('[SIM] pt-sim element not found'); return; }
    
    const tableWrap = document.querySelector('.sim-table-wrap');
    if (tableWrap) {
      tableWrap.style.opacity = '0.5';
      tableWrap.style.pointerEvents = 'none';
    } else {
      el.innerHTML='<div class="prof-empty"><span class="prof-empty-icon">&#9203;</span><p>Ladowanie...</p></div>';
    }

    let data={rows:[],total:0,platforms:[],settings:{}};
    try { 
      console.log('[SIM] Fetching simulator data...');
      const url = '/profitability/simulator?search='+encodeURIComponent(simSearch)+
                  '&manufacturer='+encodeURIComponent(simMfg)+
                  '&category='+encodeURIComponent(simCat)+
                  '&alertsOnly='+(simAlertsOnly?'1':'0')+
                  '&sortCol='+encodeURIComponent(simSortCol)+
                  '&sortDir='+encodeURIComponent(simSortDir)+
                  '&limit='+SIM_PG+'&offset='+(simPage*SIM_PG);
      data=await API.get(url);
      window.simDataRows = data.rows;
      console.log('[SIM] Got data:', data.rows?.length, 'rows,', data.platforms?.length, 'platforms');
    } catch(e){
      console.error('[SIM] API error:', e.message);
      el.innerHTML='<div class="prof-empty"><span class="prof-empty-icon">&#10060;</span><h3>Blad</h3><p>'+esc(e.message)+'</p></div>'; return;
    }
    if(!data.rows.length && !simSearch){
      el.innerHTML='<div class="prof-empty"><span class="prof-empty-icon">&#128200;</span><h3>Brak produktow</h3><p>Dodaj produkty w zakladce <strong>Baza Produktow</strong>.</p></div>'; return;
    }
    const pls=data.platforms; const alerts=data.rows.filter(r=>r.any_alert).length;
    const pages=Math.ceil(data.total/SIM_PG);
    const minMargin=data.settings?.min_margin_alert_pct||5;

    // Compact stats integrated into toolbar
    const statsHtml = '';

    // Toolbar combined with small stats
    const toolbar='<div class="prof-toolbar" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 16px">' +
      // Small inline stats
      '<div style="display:flex;gap:8px;margin-right:4px">' +
        '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:6px 12px;display:flex;flex-direction:column;min-width:80px;justify-content:center">' +
          '<span style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:2px">Produktów</span>' +
          '<strong style="font-size:0.95rem;color:var(--text-primary);line-height:1">'+data.total+'</strong>' +
        '</div>' +
        '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:6px 12px;display:flex;flex-direction:column;min-width:80px;justify-content:center">' +
          '<span style="font-size:0.65rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:2px">Alertów</span>' +
          '<strong style="font-size:0.95rem;line-height:1;color:var(--'+(alerts>0?'red':'green')+')">'+alerts+'</strong>' +
        '</div>' +
      '</div>' +
      // Inputs
      '<input class="compare-search" id="sim-search" placeholder="Szukaj EAN lub nazwy..." value="'+esc(simSearch)+'" style="min-width:240px;flex:1">' +
      '<input class="compare-search" id="sim-mfg" placeholder="Producent..." value="'+esc(simMfg)+'" style="width:140px">' +
      '<input class="compare-search" id="sim-cat" placeholder="Kategoria..." value="'+esc(simCat)+'" style="width:140px">' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;cursor:pointer;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:6px 12px;user-select:none"><input type="checkbox" id="sim-alerts-only" '+(simAlertsOnly?'checked':'')+'> Tylko alerty</label>' +
      // Min margin settings as a mini block
      '<div style="display:flex;flex-direction:column;background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:4px 10px;justify-content:center">' +
        '<label style="font-size:.62rem;color:var(--text-muted);text-transform:uppercase;font-weight:600;margin-bottom:2px">Min marża alert</label>' +
        '<div style="display:flex;align-items:center;gap:4px">' +
          '<input id="sim-min-margin" type="number" class="prof-input" style="width:50px;padding:2px 6px;font-size:.85rem;height:22px;border-color:transparent;background:var(--bg-base)" step="0.5" value="'+minMargin+'">' +
          '<span style="font-size:.85rem;font-weight:600;color:var(--text-primary)">%</span>' +
        '</div>' +
      '</div>' +
      (alerts>0?'<span class="sim-alert-badge" style="margin-left:4px">&#9888; '+alerts+' ALERTÓW</span>':'') +
      '<a class="btn btn--secondary btn--sm" href="/api/profitability/simulator/export.csv?search='+encodeURIComponent(simSearch)+'" download style="margin-left:auto">&#8659; Export CSV</a>' +
      (pages>1?'<div style="display:flex;align-items:center;gap:4px;margin-left:8px"><button class="btn btn--ghost btn--sm" id="sp-prev" '+(simPage===0?'disabled':'')+'>&#8249;</button>' +
        '<input type="number" id="sim-page-input" value="'+(simPage+1)+'" min="1" max="'+pages+'" style="width:40px;text-align:center;padding:2px;font-size:0.8rem;border:1px solid var(--border);border-radius:4px;background:var(--bg-base);color:var(--text-primary)"> <span style="font-size:.8rem;font-weight:500;min-width:20px"> / '+pages+'</span>' +
        '<button class="btn btn--ghost btn--sm" id="sp-next" '+(simPage>=pages-1?'disabled':'')+'>&#8250;</button></div>':'') +
      '</div>';

    // Table header
    const platHeaders = pls.map(p=>
      '<th colspan="3" class="sim-group-header" style="background:'+esc(p.color)+'">'+esc(p.icon)+' '+esc(p.name)+'</th>'
    ).join('');
    const subHeaders = pls.map((p,pi)=>
      '<th data-sort="profit_'+pi+'" style="text-align:right;cursor:pointer;user-select:none"><div style="resize:horizontal;overflow:hidden;min-width:60px;padding-right:4px;display:flex;justify-content:flex-end">Zysk'+sortArrow('profit_'+pi)+'</div></th>' +
      '<th data-sort="margin_'+pi+'" style="text-align:right;cursor:pointer;user-select:none"><div style="resize:horizontal;overflow:hidden;min-width:60px;padding-right:4px;display:flex;justify-content:flex-end">Marza%'+sortArrow('margin_'+pi)+'</div></th>' +
      '<th style="text-align:right"><div style="resize:horizontal;overflow:hidden;min-width:80px;padding-right:4px;display:flex;justify-content:flex-end">Prowizja<br><span style="font-size:.65rem;font-weight:400;opacity:.7">/ Kategoria</span></div></th>'
    ).join('');

    // Table rows
    const trs = data.rows.map((r,i)=>{
      const platCells = r.by_platform.map((p,pi) => {
        const profit = p.profit||0;
        const marginPct = p.margin_pct||0;
        const commPct = p.commission_pct||0;
        const profCls = profit>=0?'sim-profit-pos':'sim-profit-neg';
        const mrgCls  = marginPct>=minMargin?'sim-margin-good':'sim-margin-bad';
        const pColor = p.platform_color||'#6366f1';
        const bg = p.alert ? 'rgba(248,113,113,.1)' : pColor+'18';
        const cellBg = 'background:'+bg+';';
        const catBadge = p.has_cat_override
          ? '<br><span style="font-size:.62rem;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:110px" title="'+esc(p.commission_cat)+'">'+esc(p.commission_cat)+'</span>'
          : '';
        return '<td style="text-align:right;'+cellBg+'"><span class="'+profCls+'">'+fmtM(profit)+'</span></td>' +
          '<td style="text-align:right;'+cellBg+'"><span class="sim-margin-cell '+mrgCls+'">'+marginPct.toFixed(1)+'%</span></td>' +
          '<td style="text-align:right;font-size:.74rem;color:var(--text-muted);'+cellBg+'">-'+fmtM(p.commission||0)+'<br><span style="font-size:.65rem">'+commPct.toFixed(1)+'%</span>'+catBadge+'</td>';
      }).join('');
      const rowCls = r.any_alert?' class="sim-row-alert"':'';
      return '<tr'+rowCls+'>' +
        '<td class="row-num">'+(simPage*SIM_PG+i+1)+'</td>' +
        '<td style="font-family:monospace;font-size:.76rem;white-space:nowrap">'+(r.ean||'—')+'</td>' +
        '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.name)+'">'+esc(r.name)+'</td>' +
        '<td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r.manufacturer)+'">'+esc(r.manufacturer)+'</td>' +
        '<td style="text-align:right">'+(r.stock??'-')+'</td>' +
        '<td style="text-align:right;font-family:monospace">'+fmtM(r.buy_price)+'</td>' +
        '<td style="text-align:right;font-family:monospace">'+fmtM(r.sell_price)+'</td>' +
        (r.shipping_min != null && r.shipping_max != null
          ? '<td style="text-align:right;font-size:.76rem;color:var(--text-primary);border-bottom:1px dotted var(--accent);cursor:pointer;user-select:none;" title="Kliknij dwa razy aby zobaczyć opcje kurierów (min: '+fmtM(r.shipping_min)+', max: '+fmtM(r.shipping_max)+')" ondblclick="showShippingBreakdown('+i+')">'+fmtM((r.shipping||0)+(r.packing||0))+'</td>'
          : '<td style="text-align:right;font-size:.76rem;color:var(--text-muted);cursor:pointer;user-select:none;" ondblclick="showShippingBreakdown('+i+')">'+fmtM((r.shipping||0)+(r.packing||0))+'</td>') +
        platCells +
        '<td>'+(r.any_alert?'<span class="sim-alert-badge">&#9888; ALERT</span>':'<span class="sim-ok-badge">&#10003; OK</span>')+'</td>' +
        '</tr>';
    }).join('');

    el.innerHTML = statsHtml + toolbar +
      '<div class="sim-table-wrap"><table class="sim-table" style="table-layout:fixed;width:auto;"><thead>' +
      '<tr><th rowspan="2" class="row-num-th"><div style="resize:horizontal;overflow:hidden;min-width:20px;padding-right:4px">#</div></th>' +
      '<th rowspan="2" data-sort="ean" style="cursor:pointer;user-select:none"><div style="resize:horizontal;overflow:hidden;min-width:80px;padding-right:4px">EAN'+sortArrow('ean')+'</div></th>' +
      '<th rowspan="2" data-sort="name" style="cursor:pointer;user-select:none"><div style="resize:horizontal;overflow:hidden;min-width:180px;padding-right:4px">Nazwa'+sortArrow('name')+'</div></th>' +
      '<th rowspan="2" data-sort="manufacturer" style="cursor:pointer;user-select:none"><div style="resize:horizontal;overflow:hidden;min-width:100px;padding-right:4px">Producent'+sortArrow('manufacturer')+'</div></th>' +
      '<th rowspan="2" data-sort="stock" style="text-align:right;cursor:pointer;user-select:none"><div style="resize:horizontal;overflow:hidden;min-width:40px;padding-right:4px;display:flex;justify-content:flex-end">Stan'+sortArrow('stock')+'</div></th>' +
      '<th rowspan="2" data-sort="buy" style="text-align:right;cursor:pointer;user-select:none"><div style="resize:horizontal;overflow:hidden;min-width:70px;padding-right:4px;display:flex;justify-content:flex-end">C.zakupu'+sortArrow('buy')+'</div></th>' +
      '<th rowspan="2" data-sort="sell" style="text-align:right;cursor:pointer;user-select:none"><div style="resize:horizontal;overflow:hidden;min-width:80px;padding-right:4px;display:flex;justify-content:flex-end">C.sprzed(Allegro)'+sortArrow('sell')+'</div></th>' +
      '<th rowspan="2" style="text-align:right"><div style="resize:horizontal;overflow:hidden;min-width:80px;padding-right:4px;display:flex;justify-content:flex-end">Wysylka+pak.</div></th>' +
      platHeaders + '<th rowspan="2"><div style="resize:horizontal;overflow:hidden;min-width:60px;padding-right:4px">Status</div></th></tr>' +
      '<tr>' + subHeaders + '</tr></thead>' +
      '<tbody>'+(trs||'<tr><td colspan="99" style="text-align:center;padding:24px;color:var(--text-muted)">Brak wynikow</td></tr>')+'</tbody>' +
      '</table></div>';

    let _st; 
    document.getElementById('sim-search')?.addEventListener('input',e=>{ clearTimeout(_st);_st=setTimeout(()=>{simSearch=e.target.value;simPage=0;renderSim();},400); });
    document.getElementById('sim-mfg')?.addEventListener('input',e=>{ clearTimeout(_st);_st=setTimeout(()=>{simMfg=e.target.value;simPage=0;renderSim();},400); });
    document.getElementById('sim-cat')?.addEventListener('input',e=>{ clearTimeout(_st);_st=setTimeout(()=>{simCat=e.target.value;simPage=0;renderSim();},400); });
    document.getElementById('sim-alerts-only')?.addEventListener('change',e=>{ simAlertsOnly=e.target.checked;simPage=0;renderSim(); });
    
    document.querySelectorAll('.sim-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if(simSortCol === col) { simSortDir = simSortDir === 'asc' ? 'desc' : 'asc'; }
        else { simSortCol = col; simSortDir = 'asc'; }
        renderSim();
      });
    });
    document.getElementById('sp-prev')?.addEventListener('click',()=>{simPage--;renderSim();});
    document.getElementById('sp-next')?.addEventListener('click',()=>{simPage++;renderSim();});
    document.getElementById('sim-min-margin')?.addEventListener('change', async e => {
      try { await API.patch('/profitability/settings',{min_margin_alert_pct:parseFloat(e.target.value)||5}); renderSim(); } catch{}
    });
    document.getElementById('sim-page-input')?.addEventListener('change', e => {
      let pg = parseInt(e.target.value);
      if(isNaN(pg) || pg < 1) pg = 1;
      if(pg > pages) pg = pages;
      simPage = pg - 1;
      renderSim();
    });

    if (activeId) {
      setTimeout(() => {
        const activeEl = document.getElementById(activeId);
        if (activeEl) {
          activeEl.focus();
          try { activeEl.setSelectionRange(selStart, selEnd); } catch(e){}
        }
      }, 10);
    }
  }

  function stat(label,val,cls) {
    return '<div class="prof-stat-card"><div class="prof-stat-label">'+label+'</div>' +
      '<div class="prof-stat-val'+(cls?' '+cls:'')+'">'+(val??'—')+'</div></div>';
  }

  window.showShippingBreakdown = function(rowIndex) {
    const prod = window.simDataRows[rowIndex];
    if (!prod || !prod.shipping_breakdown || prod.shipping_breakdown.length === 0) return;
    const bd = prod.shipping_breakdown;
    const bdHtml = bd.map(b => '<tr><td style="padding:6px;border-bottom:1px solid var(--border)">'+esc(b.label)+'</td><td style="padding:6px;text-align:right;border-bottom:1px solid var(--border);font-family:monospace"><b>'+fmtM(b.surcharge)+'</b></td></tr>').join('');
    const html = '<div style="margin-bottom:14px;font-size:0.85rem">Dostępne opcje dostawy z cennika (waga <b>'+prod.weight_g+' g</b>):</div>' +
      '<div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg-elevated)">' +
      '<table style="width:100%;font-size:0.82rem;border-collapse:collapse">' +
        '<thead style="position:sticky;top:0;background:var(--bg-base);z-index:1"><tr><th style="text-align:left;padding:6px;border-bottom:1px solid var(--border);font-weight:600">Kurier</th><th style="text-align:right;padding:6px;border-bottom:1px solid var(--border);font-weight:600">Koszt (zł)</th></tr></thead>' +
        '<tbody>'+bdHtml+'</tbody>' +
      '</table></div>' +
      '<div style="margin-top:14px;font-size:0.75rem;color:var(--text-muted);padding:8px;background:var(--bg-base);border-radius:6px;border-left:3px solid var(--accent)">' +
      'Symulator używa wartości uśrednionej (<b>'+fmtM(prod.shipping)+'</b>) do szacowania rentowności.<br>Do kosztów doliczane jest zdefiniowane w opcjach platformy pakowanie: <b>'+fmtM(prod.packing)+'</b>.' +
      '</div>';
    
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backdropFilter = 'blur(2px)';
    
    const modal = document.createElement('div');
    modal.style.background = 'var(--bg-card)';
    modal.style.padding = '24px';
    modal.style.borderRadius = '16px';
    modal.style.width = '440px';
    modal.style.maxWidth = '90%';
    modal.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
    modal.style.border = '1px solid var(--border)';
    
    const title = document.createElement('h3');
    title.textContent = 'Szczegóły wysyłki: ' + prod.name;
    title.style.margin = '0 0 16px 0';
    title.style.fontSize = '1rem';
    title.style.color = 'var(--text-primary)';
    
    const content = document.createElement('div');
    content.innerHTML = html;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = 'Zamknij szczegóły';
    closeBtn.className = 'btn btn--secondary';
    closeBtn.style.marginTop = '18px';
    closeBtn.style.width = '100%';
    closeBtn.style.padding = '10px';
    closeBtn.onclick = () => overlay.remove();
    
    modal.appendChild(title);
    modal.appendChild(content);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  };

  const api = { render };
  window.ProfitabilityView = api;
  return api;
})();
