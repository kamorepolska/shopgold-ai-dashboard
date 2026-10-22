/* ===== app.js — SPA Router, API client, shared utilities ===== */

// ===== Session State =====
const Session = {
  user: null,
  company: 'idealpc',
  companyNames: { idealpc:'IdealPC', prymus:'Prymus.store', kamore:'Kamore' },
  companyColors: { idealpc:'#6366f1', prymus:'#10b981', kamore:'#f59e0b' },
  owuiToken: null,
  load() {
    try { this.user = JSON.parse(localStorage.getItem('sg_user')||'null'); } catch{}
    this.company = localStorage.getItem('sg_company')||'idealpc';
    this.owuiToken = localStorage.getItem('sg_owui_token') || null;
  },
  save() {
    localStorage.setItem('sg_user', JSON.stringify(this.user));
    localStorage.setItem('sg_company', this.company);
    if (this.owuiToken) localStorage.setItem('sg_owui_token', this.owuiToken);
    else localStorage.removeItem('sg_owui_token');
  },
  clear() { this.user=null; this.owuiToken=null; localStorage.removeItem('sg_user'); localStorage.removeItem('sg_owui_token'); },
};
Session.load();

const API = {
  _headers() {
    const h = { 'Content-Type':'application/json' };
    if (Session.user?.username) h['X-User'] = Session.user.username;
    if (Session.company)        h['X-Company'] = Session.company;
    if (Session.owuiToken)      h['X-OWUI-Token'] = Session.owuiToken;
    return h;
  },
  async get(path) {
    const r = await fetch(`/api${path}`, { headers: this._headers() });
    if (r.status===401) { Auth.logout(); throw new Error('Sesja wygasła'); }
    if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error||r.statusText); }
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(`/api${path}`, { method:'POST', headers:this._headers(), body:JSON.stringify(body) });
    if (r.status===401) { Auth.logout(); throw new Error('Sesja wygasła'); }
    if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error||r.statusText); }
    return r.json();
  },
  async patch(path, body) {
    const r = await fetch(`/api${path}`, { method:'PATCH', headers:this._headers(), body:JSON.stringify(body) });
    if (r.status===401) { Auth.logout(); throw new Error('Sesja wygasła'); }
    if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error||r.statusText); }
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(`/api${path}`, { method:'PUT', headers:this._headers(), body:JSON.stringify(body) });
    if (r.status===401) { Auth.logout(); throw new Error('Sesja wygasła'); }
    if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error||r.statusText); }
    return r.json();
  },
  async del(path) {
    const h = this._headers(); delete h['Content-Type'];
    const r = await fetch(`/api${path}`, { method:'DELETE', headers:h });
    if (r.status===401) { Auth.logout(); throw new Error('Sesja wygasła'); }
    if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error||r.statusText); }
    return r.json();
  },
  async upload(path, formData) {
    const h = {};
    if (Session.user?.username) h['X-User'] = Session.user.username;
    if (Session.company)        h['X-Company'] = Session.company;
    if (Session.owuiToken)      h['X-OWUI-Token'] = Session.owuiToken;
    const r = await fetch(`/api${path}`, { method:'POST', body:formData, headers:h });
    if (r.status===401) { Auth.logout(); throw new Error('Sesja wygasła'); }
    if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error||r.statusText); }
    return r.json();
  },
  async download(path, defaultFilename) {
    const r = await fetch(`/api${path}`, { headers: this._headers() });
    if (r.status===401) { Auth.logout(); throw new Error('Sesja wygasła'); }
    if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error||r.statusText); }
    const blob = await r.blob();
    const disposition = r.headers.get('content-disposition');
    let filename = defaultFilename || 'download';
    if (disposition && disposition.indexOf('attachment') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    window.URL.revokeObjectURL(url); document.body.removeChild(a);
  },
  downloadUrl(path) { return `/api${path}`; },
};

// ===== Toast System =====
const Toast = {
  show(msg, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span>${icons[type]||'📢'}</span><span>${escHtml(msg)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('hiding');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error', 6000); },
  info(msg)    { this.show(msg, 'info'); },
  warn(msg)    { this.show(msg, 'warning'); },
};

// ===== Modal =====
const Modal = {
  _maximized: false,
  show({ title, body, footer = '', wide = false, full = false }) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footer;
    const modalEl = document.getElementById('modal-overlay').querySelector('.modal');
    if (modalEl) { 
      modalEl.classList.toggle('modal--wide', !!wide);
      modalEl.classList.toggle('modal--full', !!full);
      modalEl.classList.remove('modal--maximized');
      // Reset any manual resize
      modalEl.style.width = '';
      modalEl.style.height = '';
    }
    this._maximized = false;
    const maxBtn = document.getElementById('modal-maximize');
    if (maxBtn) maxBtn.textContent = '⛶';
    document.getElementById('modal-overlay').style.display = 'flex';
  },
  hide() {
    const modalEl = document.getElementById('modal-overlay').querySelector('.modal');
    if (modalEl) {
      modalEl.classList.remove('modal--maximized');
      modalEl.style.width = '';
      modalEl.style.height = '';
    }
    this._maximized = false;
    document.getElementById('modal-overlay').style.display = 'none';
  },
  toggleMaximize() {
    const modalEl = document.getElementById('modal-overlay').querySelector('.modal');
    if (!modalEl) return;
    this._maximized = !this._maximized;
    modalEl.classList.toggle('modal--maximized', this._maximized);
    const maxBtn = document.getElementById('modal-maximize');
    if (maxBtn) {
      maxBtn.textContent = this._maximized ? '⧉' : '⛶';
      maxBtn.title = this._maximized ? 'Przywróć rozmiar' : 'Maksymalizuj';
    }
    if (this._maximized) {
      // Clear manual resize when maximizing
      modalEl.style.width = '';
      modalEl.style.height = '';
    }
  }
};
document.getElementById('modal-maximize').addEventListener('click', () => Modal.toggleMaximize());
document.getElementById('modal-close').addEventListener('click', () => Modal.hide());
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') Modal.hide();
});
// Double-click on header to toggle maximize
document.querySelector('#modal .modal-header')?.addEventListener('dblclick', (e) => {
  // Don't toggle if clicking on buttons or inputs
  if (e.target.closest('button') || e.target.closest('input')) return;
  Modal.toggleMaximize();
});
// Global helper for custom inline modals to toggle maximize
window.toggleModalMax = function(btn) {
  const modal = btn.closest('.modal');
  if (!modal) return;
  const isMax = modal.classList.toggle('modal--maximized');
  btn.textContent = isMax ? '⧉' : '⛶';
  btn.title = isMax ? 'Przywróć rozmiar' : 'Maksymalizuj';
  if (isMax) { modal.style.width = ''; modal.style.height = ''; }
};
// Global ESC key handler — closes ANY visible popup/overlay
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;

  // 1. Main Modal (modal-overlay)
  const mainOverlay = document.getElementById('modal-overlay');
  if (mainOverlay && mainOverlay.style.display === 'flex') {
    Modal.hide(); return;
  }

  // 2. Sourcing / any custom modal-overlay with display:flex or display:block
  const allOverlays = document.querySelectorAll('.modal-overlay');
  for (const el of [...allOverlays].reverse()) {
    const d = el.style.display;
    if (d === 'flex' || d === 'block') {
      el.style.display = 'none'; return;
    }
  }

  // 3. Mailer wizard overlay
  const wizards = document.querySelectorAll('.mailer-wizard-overlay');
  if (wizards.length) { wizards[wizards.length - 1].remove(); return; }

  // 4. Any other element with data-closable-on-esc
  const closable = document.querySelectorAll('[data-closable-on-esc]');
  for (const el of [...closable].reverse()) {
    if (el.style.display !== 'none' && el.offsetParent !== null) {
      el.style.display = 'none'; return;
    }
  }
});

// ===== SPA Router =====
const Router = {
  current: 'dashboard',
  titles: { dashboard:'Dashboard', pim:'PIM — Zarządzanie Produktami', approval:'Moduł Akceptacji', campaigns:'Kampanie Marketingowe', settings:'Ustawienia', seo:'SEO & Pozycjonowanie', sourcing:'Hurtownie & Smart Pricing', profitability:'Kalkulator Rentowności', chats:'Czaty AI', bloger:'Bloger — Redakcja SEO', grafiker:'Grafiker AI', mailer:'MAILER — Email Marketing', oferter:'OFERTER — Konfigurator PC', planer:'Planer — Notatki & Kalendarz', crm:'CRM — Zarządzanie Klientami', notifications:'Powiadomienia — Centrum Powiadomień' },
  // Lazy lookup — widoki są pobierane z window dopiero przy wywołaniu go(),
  // gdy wszystkie skrypty są już załadowane
  _viewMap: { dashboard:'DashboardView', pim:'PimView', approval:'ApprovalView', campaigns:'CampaignsView', settings:'SettingsView', seo:'SeoView', sourcing:'SourcingView', profitability:'ProfitabilityView', chats:'ChatsView', bloger:'BlogerView', grafiker:'GrafikerView', mailer:'MailerView', oferter:'OferterView', planer:'PlanerView', crm:'CrmView', notifications:'NotificationsView' },

  go(view, retryCount = 0) {
    if (!document.getElementById(`view-${view}`)) return;
    // Deactivate old
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    // Activate new
    document.getElementById(`view-${view}`).classList.add('active');
    document.getElementById(`nav-${view}`)?.classList.add('active');
    document.getElementById('page-title').textContent = this.titles[view] || view;
    this.current = view;
    // Persist current view in URL hash for page refresh
    if (location.hash !== '#' + view) location.hash = view;
    // Render view — lazy resolve from window
    const handlerName = this._viewMap[view];
    const handler = handlerName ? window[handlerName] : null;
    if (handler && typeof handler.render === 'function') {
      handler.render();
    } else {
      if (retryCount < 5) {
        console.warn(`[Router] Brak handlera dla widoku: ${view}, próbuję ponownie za 200ms (próba ${retryCount + 1}/5)...`);
        setTimeout(() => this.go(view, retryCount + 1), 200);
      } else {
        console.error(`[Router] Nie udało się załadować handlera dla widoku: ${view} po 5 próbach.`);
      }
    }
  },

  register(view, handler) { this._viewMap[view] = handler; },
};

// Handle browser back/forward buttons
window.addEventListener('hashchange', () => {
  const hash = location.hash?.slice(1);
  if (hash && Router._viewMap[hash] && Router.current !== hash) {
    Router.go(hash);
  }
});

// Nav clicks
document.querySelectorAll('.nav-item[data-view]').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); Router.go(el.dataset.view); });
});

// External link clicks
document.getElementById('nav-service')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const s = await API.get('/settings');
    const url = s.service_redirect_url;
    if (url) window.open(url, '_blank');
    else Toast.warn('Skonfiguruj adres IP / link do Serwisu w Ustawieniach (System)');
  } catch(err) { Toast.error('Nie udało się pobrać ustawień'); }
});

document.getElementById('nav-autoresponder')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const s = await API.get('/settings');
    const url = s.autoresponder_url || 'http://localhost:4000/';
    window.open(url, '_blank');
  } catch(err) { Toast.error('Nie udało się pobrać ustawień'); }
});

// Refresh button
document.getElementById('refresh-btn').addEventListener('click', () => {
  const handlerName = Router._viewMap[Router.current];
  const handler = handlerName ? window[handlerName] : null;
  if (handler && typeof handler.render === 'function') handler.render();
  Toast.info('Odświeżono');
});

// Topbar: Refresh all suppliers globally
document.getElementById('topbar-refresh-suppliers-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('topbar-refresh-suppliers-btn');
  if (!confirm('Odświeżyć wszystkie hurtownie (API, FTP, URL)?')) return;
  btn.disabled = true; btn.style.opacity = '0.5';
  Toast.info('Rozpoczęto odświeżanie wszystkich hurtowni...');
  try {
    const r = await API.post('/sourcing/suppliers/refresh-all', {});
    const ok = r.results.filter(x => x.status === 'ok').length;
    const err = r.results.filter(x => x.status === 'error').length;
    Toast.success(`Zakończono odświeżanie hurtowni: ${ok} OK, ${err} błędów`);
    // Refresh sourcing view if active
    if (Router.current === 'sourcing' && window.SourcingView) {
      window.SourcingView.render();
    }
  } catch(e) {
    Toast.error('Błąd odświeżania hurtowni: ' + e.message);
  } finally {
    btn.disabled = false; btn.style.opacity = '1';
  }
});

// ===== Utilities =====
function escHtml(str) {
  // Guard against objects being passed — stringify them gracefully
  if (str && typeof str === 'object') {
    str = str.name || str.value || str._text || str.text || '';
  }
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function sanitizeHTML(html) {
  if (!html) return '';
  try {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var allowedTags = ['strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'br', 'p', 'div', 'blockquote', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a'];
    function clean(node) {
      var children = Array.from(node.childNodes);
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType === 1) { // ELEMENT_NODE
          var tagName = child.tagName.toLowerCase();
          if (allowedTags.indexOf(tagName) === -1) {
            var textNode = document.createTextNode(child.textContent);
            child.parentNode.replaceChild(textNode, child);
          } else {
            var attrs = Array.from(child.attributes);
            for (var j = 0; j < attrs.length; j++) {
              var attrName = attrs[j].name.toLowerCase();
              if (tagName === 'a' && (attrName === 'href' || attrName === 'target' || attrName === 'rel')) {
                // Keep allowed anchor attributes
              } else {
                child.removeAttribute(attrs[j].name);
              }
            }
            clean(child);
          }
        } else if (child.nodeType !== 3) { // Not TEXT_NODE
          child.parentNode.removeChild(child);
        }
      }
    }
    clean(doc.body);
    return doc.body.innerHTML;
  } catch(e) {
    return escHtml(html);
  }
}
function formatDescription(desc) {
  if (!desc) return '';
  var descVal = String(desc);
  if (descVal.indexOf('<') === -1) {
    return escHtml(descVal).replace(/\n/g, '<br>');
  }
  return sanitizeHTML(descVal);
}
function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtField(f) {
  const map = { 
    description:'Opis', 
    meta_title:'Meta Title', 
    meta_description:'Meta Description', 
    attributes_suggestions:'Atrybuty',
    relations:'Relacje (stare)',
    relation_zestawy:'Zestawy',
    relation_warianty:'Warianty',
    relation_akcesoria:'Akcesoria',
    relation_podobne:'Podobne'
  };
  return map[f] || f;
}
function truncate(str, len=80) {
  if (!str) return '—';
  // Guard against objects
  if (typeof str === 'object') {
    str = str.name || str.value || str._text || str.text || '—';
  }
  str = String(str);
  return str.length > len ? str.substring(0,len) + '…' : str;
}
function stripHtml(str) {
  if (!str) return '';
  // Use a temporary element to strip HTML tags
  const tmp = document.createElement('div');
  tmp.innerHTML = String(str);
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}
function charCountHtml(current, max) {
  const cls = current > max ? 'over' : current > max*0.9 ? 'warn' : '';
  return `<span class="char-count ${cls}">${current}/${max}</span>`;
}
function setBtn(id, loading) {
  const b = document.getElementById(id);
  if (!b) return;
  if (loading) b.classList.add('btn--loading'), b.disabled = true;
  else b.classList.remove('btn--loading'), b.disabled = false;
}

// ===== Update approval badge =====
async function refreshApprovalBadge() {
  try {
    const data = await API.get('/approval');
    const pending = data.stats.find(s => s.status === 'pending');
    const count = pending ? pending.count : 0;
    const badge = document.getElementById('approval-badge');
    if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
    else badge.style.display = 'none';
  } catch {}
}

// ===== Update notifications badge =====
async function refreshNotificationsBadge() {
  try {
    const data = await API.get('/notifications/unread-count');
    const count = data.count || 0;
    const badge = document.getElementById('notifications-badge');
    if (badge) {
      if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
      else badge.style.display = 'none';
    }
  } catch (err) {
    console.error('[NotificationsBadge] failed to refresh unread count:', err);
  }
}

// ===== Auth =====
const Auth = {
  async login(username, password) {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'X-Company': Session.company },
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Błąd logowania');
    Session.user = data.user;
    Session.owuiToken = data.owui_token || null;
    Session.save();
    return data.user;
  },
  logout() {
    Session.clear();
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-pass').value = '';
    document.getElementById('login-error').style.display = 'none';
  },
  isLoggedIn() { return !!Session.user; },
  hasPermission(section) {
    if (!Session.user) return false;
    if (Session.user.role === 'admin') return true;
    return (Session.user.permissions || []).includes(section);
  },
};

// ===== Company Switcher =====
function initCompanySwitcher() {
  const btn = document.getElementById('company-btn');
  const drop = document.getElementById('company-dropdown');
  const label = document.getElementById('company-label');
  const dot   = document.getElementById('company-dot');

  const companyLogos = {
    idealpc: 'https://idealpc.pl/images/naglowki/idealpcpl-logo-1605107849.png',
    prymus: 'https://www.prymus.store/images/logo_prymus.png',
    kamore: 'https://kamore.pl/images/szablon/logo%20kamore.png'
  };

  function updateUI() {
    label.textContent = Session.companyNames[Session.company] || Session.company;
    dot.style.background = Session.companyColors[Session.company] || '#6366f1';
    document.querySelectorAll('.company-opt').forEach(o => o.classList.toggle('active', o.dataset.co === Session.company));
    
    const logoUrl = companyLogos[Session.company] || companyLogos.idealpc;
    const sidebarLogo = document.getElementById('sidebar-logo-img');
    const loginLogo = document.getElementById('login-logo-img');
    if (sidebarLogo) sidebarLogo.src = logoUrl;
    if (loginLogo) loginLogo.src = logoUrl;
  }
  updateUI();

  btn.addEventListener('click', e => { e.stopPropagation(); drop.style.display = drop.style.display === 'none' ? 'block' : 'none'; });
  document.addEventListener('click', () => { drop.style.display = 'none'; });
  document.querySelectorAll('.company-opt').forEach(o => {
    o.addEventListener('click', () => {
      Session.company = o.dataset.co;
      Session.save();
      drop.style.display = 'none';
      updateUI();
      // Reload current view with new company context
      window.location.reload();
    });
  });
}

// ===== Sidebar Toggle =====
function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main-content');
  const btn     = document.getElementById('sidebar-toggle');
  const collapsed = localStorage.getItem('sg_sidebar') === '1';

  function apply(c) {
    document.body.classList.toggle('sidebar-collapsed', c);
    sidebar.classList.toggle('sidebar--collapsed', c);
    if (c) {
      main.style.marginLeft = '64px';
      sidebar.style.width = '64px';
      const logoDiv = sidebar.querySelector('.sidebar-logo > div');
      if (logoDiv) logoDiv.style.display = 'none';
    } else {
      main.style.marginLeft = 'var(--sidebar-w)';
      sidebar.style.width = 'var(--sidebar-w)';
      const logoDiv = sidebar.querySelector('.sidebar-logo > div');
      if (logoDiv) logoDiv.style.display = 'flex';
    }
    localStorage.setItem('sg_sidebar', c ? '1' : '0');
  }
  apply(collapsed);
  btn.addEventListener('click', () => apply(!document.body.classList.contains('sidebar-collapsed')));
}

// ===== Permission-based nav =====
function applyPermissions() {
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    const section = item.dataset.section;
    const allowed = Auth.hasPermission(section);
    item.style.display = allowed ? '' : 'none';
  });
}

// ===== User display =====
function updateUserUI() {
  const u = Session.user;
  if (!u) return;
  const name = u.display_name || u.username;
  document.getElementById('user-display-name').textContent = name;
  document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
}

// ===== Login screen =====
function initLoginScreen() {
  const screen = document.getElementById('login-screen');
  const btn    = document.getElementById('login-btn');
  const errEl  = document.getElementById('login-error');

  async function doLogin() {
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    if (!username || !password) { errEl.textContent = 'Podaj login i hasło'; errEl.style.display='block'; return; }
    btn.classList.add('btn--loading');
    try {
      await Auth.login(username, password);
      screen.classList.add('hidden');
      updateUserUI();
      applyPermissions();
      Router.go('dashboard');
    } catch(e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
    btn.classList.remove('btn--loading');
  }

  btn.addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

  // Show app or login
  if (Auth.isLoggedIn()) {
    screen.classList.add('hidden');
    updateUserUI();
    applyPermissions();
  } else {
    screen.classList.remove('hidden');
  }
}

// ===== Update status bar =====
async function refreshStatus() {
  try {
    const s = await API.get('/settings/status');
    document.getElementById('ai-badge-text').textContent =
      `${s.ai.provider === 'openai' ? 'OpenAI' : 'Gemini'} • ${s.ai.model}`;
    const connLabel = document.getElementById('conn-label');
    connLabel.textContent = (s.connectionType || 'xml').toUpperCase();
  } catch {}
}

// ===== Init =====
(async function init() {
  initLoginScreen();
  initSidebarToggle();
  initCompanySwitcher();
  // Fetch and display version
  try {
    const ver = await API.get('/settings/version');
    window.APP_VERSION = ver.version || '?';
    const vb = document.getElementById('version-badge');
    if (vb) vb.textContent = 'v' + window.APP_VERSION;
  } catch(_) { window.APP_VERSION = '?'; }
  if (Auth.isLoggedIn()) {
    await refreshStatus();
    await refreshApprovalBadge();
    await refreshNotificationsBadge();
    // Defer Router.go() so all module scripts (oferter.js etc.) finish loading first
    const loadSavedView = () => {
      const savedView = location.hash?.slice(1);
      const validViews = Object.keys(Router._viewMap);
      Router.go(savedView && validViews.includes(savedView) ? savedView : 'dashboard');
    };
    
    if (document.readyState === 'complete') {
      setTimeout(loadSavedView, 50);
    } else {
      window.addEventListener('load', () => {
        setTimeout(loadSavedView, 50);
      });
    }
    setInterval(refreshApprovalBadge, 30000);
    setInterval(refreshNotificationsBadge, 30000);
  }
})();


// Export globals
window.API    = API;
window.Auth   = Auth;
window.Session = Session;
window.Toast  = Toast;
window.Modal  = Modal;
window.Router = Router;
window.escHtml  = escHtml;
window.sanitizeHTML = sanitizeHTML;
window.formatDescription = formatDescription;
window.fmtDate  = fmtDate;
window.fmtField = fmtField;
window.truncate = truncate;
window.stripHtml = stripHtml;
window.charCountHtml = charCountHtml;
window.setBtn   = setBtn;
window.refreshApprovalBadge = refreshApprovalBadge;
window.refreshNotificationsBadge = refreshNotificationsBadge;
window.refreshStatus        = refreshStatus;


// ===== THEME TOGGLE =====
(function initTheme() {
  const saved = localStorage.getItem('sg_theme') || 'dark';
  if (saved === 'light') document.body.classList.add('light-mode');
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle-btn');
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    function applyTheme(mode) {
      if (mode === 'light') {
        document.body.classList.add('light-mode');
        if (icon) icon.textContent = '🌙';
        if (label) label.textContent = 'Ciemny motyw';
      } else {
        document.body.classList.remove('light-mode');
        if (icon) icon.textContent = '☀️';
        if (label) label.textContent = 'Jasny motyw';
      }
    }
    applyTheme(saved);
    if (btn) btn.addEventListener('click', () => {
      const cur = localStorage.getItem('sg_theme') || 'dark';
      const next = cur === 'dark' ? 'light' : 'dark';
      localStorage.setItem('sg_theme', next);
      applyTheme(next);
    });
  });
})();
