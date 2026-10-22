/* ===== dashboard.js — Główny widok Dashboard (wzbogacony) ===== */

window.DashboardView = {
  async render() {
    const el = document.getElementById('view-dashboard');
    el.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted)">
      <div class="dash-loader"></div>
      <div style="margin-top:16px;font-size:.9rem">Ładowanie dashboardu...</div>
    </div>`;

    try {
      const [s, insights, crmStats, crmNotifs, crmTasks] = await Promise.all([
        API.get('/settings/status'),
        API.get('/settings/status/insights').catch(() => ({ topDeals: [], profitIssues: [], stockAlerts: [] })),
        API.get('/crm/dashboard').catch(() => ({ total_companies: 0, total_contacts: 0, total_tasks: 0, open_tasks: 0, tasks_due_today: 0, overdue_tasks: 0, total_hours: 0, team_count: 0 })),
        API.get('/crm/notifications').catch(() => ({ notifications: [], unread: 0 })),
        API.get('/crm/tasks?limit=5&page=1').catch(() => ({ rows: [], total: 0 })),
      ]);
      el.innerHTML = this.buildHtml(s, insights, crmStats, crmNotifs, crmTasks);
      this.bindEvents();
      // Animate stat numbers
      requestAnimationFrame(() => this.animateCounters());
    } catch(e) {
      el.innerHTML = this.buildError(e.message);
    }
  },

  buildHtml(s, insights, crm, notifs, crmTasks) {
    const ap = s.approval;
    const totalAp = (ap.pending||0)+(ap.approved||0)+(ap.synced||0)+(ap.rejected||0);
    const fmtPLN = v => v != null ? parseFloat(v).toFixed(2).replace('.',',') + ' zł' : '—';
    const now = new Date();
    const greeting = now.getHours() < 12 ? '☀️ Dzień dobry' : now.getHours() < 18 ? '👋 Cześć' : '🌙 Dobry wieczór';
    const dateStr = now.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return `
      <!-- Hero greeting -->
      <div class="dash-hero">
        <div class="dash-hero-text">
          <div class="dash-greeting">${greeting}!</div>
          <div class="dash-date">${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</div>
        </div>
        <div class="dash-hero-actions">
          ${notifs.unread > 0 ? `<button class="btn btn--ghost btn--sm dash-notif-btn" onclick="Router.go('crm')">
            🔔 <span class="dash-notif-badge">${notifs.unread}</span>
          </button>` : ''}
          <button class="btn btn--primary btn--sm" onclick="Router.go('pim')">🤖 Generuj AI</button>
          ${ap.pending > 0 ? `<button class="btn btn--success btn--sm" onclick="Router.go('approval')">✅ Zatwierdź (${ap.pending})</button>` : ''}
        </div>
      </div>

      <!-- Stats row 1: Main business metrics -->
      <div class="dash-stats-row">
        <div class="dash-stat dash-stat--products" onclick="Router.go('pim')">
          <div class="dash-stat-icon">📦</div>
          <div class="dash-stat-content">
            <div class="dash-stat-val" data-target="${s.products}">0</div>
            <div class="dash-stat-lbl">Produktów</div>
          </div>
        </div>
        <div class="dash-stat dash-stat--deals" onclick="Router.go('sourcing')">
          <div class="dash-stat-icon">🔥</div>
          <div class="dash-stat-content">
            <div class="dash-stat-val" data-target="${insights.topDeals.length}" style="color:#f59e0b">0</div>
            <div class="dash-stat-lbl">Super okazji</div>
          </div>
        </div>
        <div class="dash-stat dash-stat--pending" onclick="Router.go('approval')">
          <div class="dash-stat-icon">⏳</div>
          <div class="dash-stat-content">
            <div class="dash-stat-val" data-target="${ap.pending||0}" style="color:var(--yellow)">0</div>
            <div class="dash-stat-lbl">Oczekuje</div>
          </div>
        </div>
        <div class="dash-stat dash-stat--synced">
          <div class="dash-stat-icon">✅</div>
          <div class="dash-stat-content">
            <div class="dash-stat-val" data-target="${ap.synced||0}" style="color:var(--green)">0</div>
            <div class="dash-stat-lbl">Zsync.</div>
          </div>
        </div>
        <div class="dash-stat dash-stat--campaigns" onclick="Router.go('campaigns')">
          <div class="dash-stat-icon">📣</div>
          <div class="dash-stat-content">
            <div class="dash-stat-val" data-target="${s.campaigns}" style="color:var(--blue)">0</div>
            <div class="dash-stat-lbl">Kampanii</div>
          </div>
        </div>
        <div class="dash-stat dash-stat--crm" onclick="Router.go('crm')">
          <div class="dash-stat-icon">👥</div>
          <div class="dash-stat-content">
            <div class="dash-stat-val" data-target="${crm.total_companies}" style="color:#a855f7">0</div>
            <div class="dash-stat-lbl">Firm w CRM</div>
          </div>
        </div>
      </div>

      <!-- Row 2: CRM urgents + Super deals -->
      <div class="dash-grid-2col" style="margin-bottom:20px">

        <!-- CRM Overview widget -->
        <div class="card dash-card-crm">
          <div class="card-header">
            <div>
              <div class="card-title">📋 CRM — Zadania</div>
              <div class="card-subtitle">${crm.overdue_tasks > 0 ? `<span style="color:var(--red);font-weight:700">⚠️ ${crm.overdue_tasks} po terminie!</span>` : 'Wszystko na czas 👍'}</div>
            </div>
            <button class="btn btn--ghost btn--sm" onclick="Router.go('crm')">Otwórz CRM →</button>
          </div>
          <div class="dash-crm-metrics">
            <div class="dash-crm-metric">
              <span class="dash-crm-num" style="color:var(--accent-light)">${crm.open_tasks}</span>
              <span class="dash-crm-label">Otwartych</span>
            </div>
            <div class="dash-crm-metric">
              <span class="dash-crm-num" style="color:#f59e0b">${crm.tasks_due_today}</span>
              <span class="dash-crm-label">Na dziś</span>
            </div>
            <div class="dash-crm-metric">
              <span class="dash-crm-num" style="color:var(--red)">${crm.overdue_tasks}</span>
              <span class="dash-crm-label">Po terminie</span>
            </div>
            <div class="dash-crm-metric">
              <span class="dash-crm-num" style="color:var(--green)">${crm.total_contacts}</span>
              <span class="dash-crm-label">Kontaktów</span>
            </div>
            <div class="dash-crm-metric">
              <span class="dash-crm-num" style="color:#a855f7">${crm.total_hours}h</span>
              <span class="dash-crm-label">Zlogowane</span>
            </div>
          </div>
          ${(crmTasks.rows || []).length > 0 ? `
          <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
            <div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;margin-bottom:6px;letter-spacing:.04em">Ostatnie zadania</div>
            ${(crmTasks.rows || []).slice(0, 4).map(t => {
              const pColor = t.priority === 'urgent' ? 'var(--red)' : t.priority === 'high' ? '#f59e0b' : 'var(--text-muted)';
              const pIcon = t.priority === 'urgent' ? '🔴' : t.priority === 'high' ? '🟠' : t.priority === 'medium' ? '🟡' : '⚪';
              return `<div class="dash-crm-task">
                <span style="font-size:.75rem">${pIcon}</span>
                <span class="dash-crm-task-title">${escHtml(truncate(t.title || '—', 40))}</span>
                ${t.deadline ? `<span style="font-size:.68rem;color:var(--text-muted)">${t.deadline.slice(5,10)}</span>` : ''}
              </div>`;
            }).join('')}
          </div>` : ''}
        </div>

        <!-- Super okazje -->
        <div class="card" style="border-left:3px solid #f59e0b">
          <div class="card-header">
            <div>
              <div class="card-title">🔥 Super okazje na dziś</div>
              <div class="card-subtitle">Top ${insights.topDeals.length} najlepszych cen</div>
            </div>
            <button class="btn btn--ghost btn--sm" onclick="Router.go('sourcing')">Więcej →</button>
          </div>
          ${insights.topDeals.length ? `
          <div style="max-height:320px;overflow-y:auto">
          <table class="dash-insight-table">
            <thead><tr><th>#</th><th>Nazwa</th><th>Super cena</th><th>Hurtownia</th><th>Oszcz.</th></tr></thead>
            <tbody>
              ${insights.topDeals.slice(0, 12).map((r, i) => `<tr>
                <td style="color:var(--text-muted);font-size:.72rem">${i+1}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.name||'')}">${escHtml(truncate(r.name||'—',35))}</td>
                <td style="font-weight:700;color:#f59e0b;font-family:monospace;white-space:nowrap">${fmtPLN(r.best_price)}</td>
                <td style="font-size:.78rem;white-space:nowrap">${escHtml(truncate(r.best_supplier||'—',18))}</td>
                <td><span class="dash-savings-badge">-${r.savings_pct?.toFixed(1)||0}%</span></td>
              </tr>`).join('')}
            </tbody>
          </table></div>` : `<div class="dash-empty-widget">📭 Brak danych — dodaj hurtownie w module Sourcing</div>`}
        </div>
      </div>

      <!-- Row 3: Profitability + Stock alerts -->
      <div class="dash-grid-2col" style="margin-bottom:20px">

        <!-- Rentowność -->
        <div class="card" style="border-left:3px solid #f87171">
          <div class="card-header">
            <div>
              <div class="card-title">📉 Rentowność do poprawy</div>
              <div class="card-subtitle">Produkty kupowane drożej niż w hurtowni</div>
            </div>
            <button class="btn btn--ghost btn--sm" onclick="Router.go('sourcing')">Sprawdź →</button>
          </div>
          ${insights.profitIssues.length ? `
          <div style="max-height:280px;overflow-y:auto">
          <table class="dash-insight-table">
            <thead><tr><th>#</th><th>Nazwa</th><th>C. zakupu</th><th>C. hurt.</th><th>Strata</th></tr></thead>
            <tbody>
              ${insights.profitIssues.slice(0, 10).map((r, i) => `<tr>
                <td style="color:var(--text-muted);font-size:.72rem">${i+1}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.name||'')}">${escHtml(truncate(r.name||'—',35))}</td>
                <td style="font-family:monospace;white-space:nowrap">${fmtPLN(r.buy_price)}</td>
                <td style="font-family:monospace;color:#10b981;white-space:nowrap">${fmtPLN(r.best_price)}</td>
                <td style="font-weight:700;color:#f87171;font-size:.82rem;white-space:nowrap">${r.savings != null ? (r.savings > 0 ? '+' : '') + fmtPLN(r.savings) : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>` : `<div class="dash-empty-widget">✅ Brak produktów z sygnałem 🔴 — świetna robota!</div>`}
        </div>

        <!-- Braki bestsellerów -->
        <div class="card" style="border-left:3px solid #a855f7">
          <div class="card-header">
            <div>
              <div class="card-title">🚨 Braki bestsellerów</div>
              <div class="card-subtitle">Produkty ze sprzedażą ale brak na stanie</div>
            </div>
            <button class="btn btn--ghost btn--sm" onclick="Router.go('sourcing')">Zamów →</button>
          </div>
          ${insights.stockAlerts.length ? `
          <div style="max-height:280px;overflow-y:auto">
          <table class="dash-insight-table">
            <thead><tr><th>#</th><th>EAN</th><th>Nazwa</th><th>Spr.30d</th><th>Stan</th></tr></thead>
            <tbody>
              ${insights.stockAlerts.slice(0, 10).map((r, i) => `<tr>
                <td style="color:var(--text-muted);font-size:.72rem">${i+1}</td>
                <td style="font-family:monospace;font-size:.75rem;color:var(--text-muted)">${escHtml(r.ean)}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.name||'')}">${escHtml(truncate(r.name||'—',30))}</td>
                <td style="font-weight:700;text-align:center;color:var(--accent-light)">${r.sold_30d??0}</td>
                <td style="text-align:center;font-weight:700;color:#f87171">${r.stock??0}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>` : `<div class="dash-empty-widget">🎉 Wszystko na stanie!</div>`}
        </div>
      </div>

      <!-- Row 4: AI Status + Approval -->
      <div class="dash-grid-2col" style="margin-bottom:20px">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">🤖 Status AI</div>
              <div class="card-subtitle">Aktywny dostawca i model</div>
            </div>
            <button class="btn btn--ghost btn--sm" onclick="Router.go('settings')">Zmień →</button>
          </div>
          <div class="dash-ai-grid">
            <div class="dash-ai-row">
              <span class="dash-ai-label">Dostawca</span>
              <span class="badge ${s.ai.provider==='openai'?'badge--blue':'badge--google'}">${s.ai.provider==='openai'?'🔵 OpenAI':s.ai.provider==='gemini'?'🟢 Gemini':s.ai.provider==='anthropic'?'🟣 Anthropic':'🔘 '+s.ai.provider}</span>
            </div>
            <div class="dash-ai-row">
              <span class="dash-ai-label">Model</span>
              <code class="dash-ai-model">${escHtml(s.ai.model)}</code>
            </div>
            <div class="dash-ai-row">
              <span class="dash-ai-label">Połączenie</span>
              <span class="badge badge--blue">${(s.connectionType||'xml').toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">📊 Kolejka akceptacji</div>
              <div class="card-subtitle">Łącznie: ${totalAp} zmian AI</div>
            </div>
            <button class="btn btn--primary btn--sm" onclick="Router.go('approval')">Przeglądaj →</button>
          </div>
          <div class="dash-approval-grid">
            ${this.apRow('⏳ Oczekuje', ap.pending||0, 'yellow', totalAp)}
            ${this.apRow('✅ Zatwierdzone', ap.approved||0, 'green', totalAp)}
            ${this.apRow('🚀 Zsynchronizowane', ap.synced||0, 'blue', totalAp)}
            ${this.apRow('❌ Odrzucone', ap.rejected||0, 'red', totalAp)}
          </div>
        </div>
      </div>

      <!-- Recent logs -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-header">
          <div class="card-title">📋 Ostatnia aktywność</div>
          <button class="btn btn--ghost btn--sm" onclick="Router.go('settings'); setTimeout(()=>document.querySelector('.tab-btn[data-tab=\\'logs\\']')?.click(), 50)">Pełna historia →</button>
        </div>
        ${s.recentLogs.length === 0
          ? `<div class="dash-empty-widget">📭 Brak historii — po pierwszej synchronizacji pojawią się tutaj logi.</div>`
          : `<div class="table-wrap"><table><thead><tr><th>Akcja</th><th>Wynik</th><th>Błąd</th><th>Data</th></tr></thead><tbody>
              ${s.recentLogs.slice(0, 8).map(l => {
                let result = '';
                try { const r = JSON.parse(l.result||'{}'); result = Object.entries(r).map(([k,v])=>`${k}: ${v}`).join(', '); } catch { result = l.result||''; }
                return `<tr>
                  <td><span class="field-tag">${escHtml(l.action)}</span></td>
                  <td style="font-size:0.78rem;color:var(--text-secondary);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(result)}</td>
                  <td style="font-size:0.78rem;color:var(--red)">${l.error?'⚠️ '+escHtml(String(l.error).substring(0,60)):'—'}</td>
                  <td style="font-size:0.78rem;color:var(--text-muted);white-space:nowrap">${fmtDate(l.created_at)}</td>
                </tr>`;
              }).join('')}
            </tbody></table></div>`
        }
      </div>

      <!-- Quick actions -->
      <div class="dash-quick-actions">
        <button class="btn btn--primary" onclick="Router.go('pim')">🤖 Generuj treści AI</button>
        ${ap.pending>0?`<button class="btn btn--success" onclick="Router.go('approval')">✅ Zatwierdź oczekujące (${ap.pending})</button>`:''}
        <button class="btn btn--secondary" onclick="Router.go('campaigns')">📣 Utwórz kampanię</button>
        <button class="btn btn--secondary" onclick="Router.go('sourcing')">📊 Hurtownie & Ceny</button>
        <button class="btn btn--secondary" onclick="Router.go('crm')">👥 CRM</button>
        <button class="btn btn--ghost" onclick="Router.go('settings')">⚙️ Ustawienia</button>
      </div>
    `;
  },

  apRow(label, count, color, total) {
    const pct = total > 0 ? Math.round((count/total)*100) : 0;
    return `<div class="dash-ap-row">
      <span class="dash-ap-label">${label}</span>
      <div class="progress-bar" style="flex:1;height:6px"><div class="progress-fill" style="width:${pct}%;background:var(--${color})"></div></div>
      <span class="dash-ap-count" style="color:var(--${color})">${count}</span>
    </div>`;
  },

  buildError(msg) {
    return `<div class="card" style="border-color:var(--red)">
      <div style="color:var(--red);font-weight:600;margin-bottom:8px">❌ Błąd ładowania dashboard</div>
      <div style="color:var(--text-secondary);font-size:0.85rem">${escHtml(msg)}</div>
      <div style="margin-top:16px"><button class="btn btn--secondary" onclick="Router.go('settings')">⚙️ Sprawdź ustawienia</button></div>
    </div>`;
  },

  animateCounters() {
    document.querySelectorAll('.dash-stat-val[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target) || 0;
      if (target === 0) { el.textContent = '0'; return; }
      const duration = 700;
      const startTime = performance.now();
      function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = Math.round(target * eased).toLocaleString();
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  },

  bindEvents() {},
};
