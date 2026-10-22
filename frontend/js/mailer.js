/* ===== MAILER MODULE — mailer.js ===== */
'use strict';

// ── VIEW STATE & DATA ────────────────────────────────────────────────────────
let ML_TAB = 'dashboard';
let ML_CONTACTS_DATA = [];
let ML_CAMPAIGNS_DATA = [];
let ML_AUTOMATIONS_DATA = [];
let ML_SCORING_RULES = [];
let ML_SMTP = { host:'', port:'', user:'', pass:'', from:'' };
let ML_SEARCH = '';

const ML_WEEK = [
  {day:'Pon',sent:245,opened:87,clicked:23},{day:'Wt',sent:380,opened:142,clicked:41},
  {day:'Sr',sent:190,opened:68,clicked:18},{day:'Czw',sent:520,opened:203,clicked:67},
  {day:'Pt',sent:445,opened:178,clicked:52},{day:'Sob',sent:120,opened:43,clicked:11},
  {day:'Nd',sent:95,opened:31,clicked:8},
];

const ML_HOURS = [6,9,11,14,16,17,10,8,7,5,12,15,13,11,9,7,5,4,3,6,8,10,7,4];

const ML_OPENS = [
  {name:'Jan Kowalski',campaign:'Wiosenna Wyprzedaż',date:'2026-05-11',time:'14:20',device:'mobile',count:2},
  {name:'Anna Nowak',campaign:'Powitanie',date:'2026-05-11',time:'13:10',device:'desktop',count:1},
  {name:'Piotr Wiśniewski',campaign:'Porzucony koszyk',date:'2026-05-11',time:'11:05',device:'mobile',count:3},
];

const ML_TEMPLATES = [
  {id:1,name:'Promocja Sezonowa',cat:'promocja',color:'#185FA5',desc:'Szablon z banerem i CTA'},
  {id:2,name:'Newsletter Pro',cat:'newsletter',color:'#16a34a',desc:'Czysty layout dwukolumnowy'},
  {id:3,name:'Onboarding Welcome',cat:'onboarding',color:'#7c3aed',desc:'Mail powitalny z krokami'},
  {id:4,name:'Porzucony Koszyk',cat:'transakcyjny',color:'#ea580c',desc:'Przypomnienie o zakupie'},
  {id:5,name:'VIP Exclusive',cat:'promocja',color:'#b45309',desc:'Ekskluzywny layout zloty'},
  {id:6,name:'Webinar Zaproszenie',cat:'newsletter',color:'#0891b2',desc:'Zaproszenie z licznikiem'},
  {id:7,name:'Potwierdzenie zamowienia',cat:'transakcyjny',color:'#16a34a',desc:'Mail transakcyjny'},
  {id:8,name:'Re-engagement',cat:'newsletter',color:'#dc2626',desc:'Odzyskaj nieaktywnych'},
];

// ── DATA FETCHING ──────────────────────────────────────────────────────────
async function mlFetchData() {
  try {
    const [c, camp, auto, rules, smtp] = await Promise.all([
      fetch('/api/mailer/contacts').then(r=>r.json()),
      fetch('/api/mailer/campaigns').then(r=>r.json()),
      fetch('/api/mailer/automations').then(r=>r.json()),
      fetch('/api/mailer/rules').then(r=>r.json()),
      fetch('/api/mailer/smtp').then(r=>r.json())
    ]);
    ML_CONTACTS_DATA = Array.isArray(c) && c.length > 0 ? c : [
      { id: '1', fn: 'Jan', ln: 'Kowalski', email: 'jan@example.com', company: 'Firma XYZ', score: 85, tags: ['VIP', 'B2B'], last_activity: 'Dzisiaj', phone: '123456789' },
      { id: '2', fn: 'Anna', ln: 'Nowak', email: 'anna@example.com', company: '-', score: 45, tags: ['Newsletter'], last_activity: '2 dni temu', phone: '987654321' },
      { id: '3', fn: 'Piotr', ln: 'Wiśniewski', email: 'piotr@example.com', company: 'Sklep ABC', score: 20, tags: ['Ryzyko'], last_activity: 'Miesiąc temu', phone: '111222333' },
      { id: '4', fn: 'Katarzyna', ln: 'Wójcik', email: 'kasia@example.com', company: '-', score: 72, tags: ['B2C', 'Aktywna'], last_activity: 'Dzisiaj', phone: '444555666' }
    ];
    ML_CAMPAIGNS_DATA = Array.isArray(camp) ? camp : [];
    ML_AUTOMATIONS_DATA = Array.isArray(auto) && auto.length > 0 ? auto : [
      {id:1, name:'Powitanie po zapisie', trigger:'Nowy subskrybent', active:240, total:1420, status:'active', steps:[
        {t:'trigger',l:'Zapis do newslettera',c:1420}, {t:'wait',l:'Czekaj 5 min',c:1420}, {t:'action',l:'Email: Welcome',c:1420,yes:'68% open'}
      ]},
      {id:2, name:'Odzyskiwanie koszyków', trigger:'Porzucony koszyk (ShopGold)', active:45, total:320, status:'active', steps:[
        {t:'trigger',l:'Porzucenie',c:320}, {t:'wait',l:'Czekaj 2h',c:320}, {t:'action',l:'Email: Wróć do nas',c:320,yes:'12% odzysk.'}
      ]}
    ];
    ML_SCORING_RULES = Array.isArray(rules) && rules.length > 0 ? rules : [
      { action: 'Otwarcie e-maila', points: 5 },
      { action: 'Kliknięcie w link', points: 15 },
      { action: 'Dodanie do koszyka', points: 25 },
      { action: 'Porzucenie koszyka', points: -10 },
      { action: 'Zakup produktu', points: 50 },
      { action: 'Brak aktywności przez 30 dni', points: -15 }
    ];
    ML_SMTP = smtp || { host:'', port:'', user:'', pass:'', from:'' };
  } catch(e) { console.error('Failed to fetch mailer data', e); }
}

// ── UTILITIES ──────────────────────────────────────────────────────────────
const mlPct = (a,b) => b ? Math.round(a/b*100) : 0;
const mlAv = (fn,ln) => (fn[0]+ln[0]).toUpperCase();
const mlScoreColor = s => s>=70?'var(--green)':s>=40?'var(--yellow)':'var(--text-muted)';
const mlScoreLabel = s => s>=70?'Hot':'Warm';
const mlScoreCls = s => s>=70?'hot':s>=40?'warm':'cold';
const mlStatusBadge = s => ({active:'mailer-badge--active',completed:'mailer-badge--completed',draft:'mailer-badge--draft',paused:'mailer-badge--paused'}[s]||'mailer-badge--draft');
const mlStatusLabel = s => ({active:'Aktywna',completed:'Zakonczona',draft:'Szkic',paused:'Wstrzymana'}[s]||s);
const mlEsc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const mlTrunc = (s,n=60) => s && s.length>n ? s.slice(0,n)+'…' : (s||'');
const mlAvatar = (fn,ln,sz=32) => `<div class="mailer-avatar" style="width:${sz}px;height:${sz}px;font-size:${sz*0.28}px">${mlAv(fn,ln)}</div>`;

function mlSvgBar(hours) {
  const W=600,H=100,pad=10,bW=Math.floor((W-pad*2)/hours.length*0.7);
  const gap=(W-pad*2)/hours.length;
  const mx=Math.max(...hours)||1;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
    ${hours.map((v,i)=>{const bh=Math.max(2,Math.round((v/mx)*(H-pad*2)));const bx=pad+i*gap+(gap-bW)/2;return `<rect x="${bx}" y="${H-pad-bh}" width="${bW}" height="${bh}" fill="#185FA5" rx="2" opacity=".85"/>`;}).join('')}
  </svg>`;
}

function mlSvgArea(data) {
  const W=520,H=140,pl=10,pr=10,pt=10,pb=20,cW=W-pl-pr,cH=H-pt-pb;
  const mx=Math.max(...data.map(d=>d.sent))||1;
  const x=i=>pl+i*(cW/(data.length-1));
  const y=v=>pt+cH-(v/mx)*cH;
  const pts=k=>data.map((d,i)=>x(i)+','+y(d[k])).join(' ');
  const area=k=>{const p=data.map((d,i)=>x(i)+','+y(d[k])).join(' ');return p+' '+x(data.length-1)+','+(pt+cH)+' '+x(0)+','+(pt+cH);};
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">
    <defs>
      <linearGradient id="mlgS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stop-color="#185FA5" stop-opacity=".2"/><stop offset="95%" stop-color="#185FA5" stop-opacity="0"/></linearGradient>
      <linearGradient id="mlgO" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stop-color="#16a34a" stop-opacity=".2"/><stop offset="95%" stop-color="#16a34a" stop-opacity="0"/></linearGradient>
    </defs>
    <polygon points="${area('sent')}" fill="url(#mlgS)"/>
    <polygon points="${area('opened')}" fill="url(#mlgO)"/>
    <polyline points="${pts('sent')}" fill="none" stroke="#185FA5" stroke-width="2"/>
    <polyline points="${pts('opened')}" fill="none" stroke="#16a34a" stroke-width="2"/>
    <polyline points="${pts('clicked')}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 4"/>
    ${data.map((d,i)=>`<text x="${x(i)}" y="${H-4}" text-anchor="middle" font-size="10" fill="#94a3b8">${d.day}</text>`).join('')}
    <circle cx="30" cy="10" r="4" fill="#185FA5"/><text x="38" y="14" font-size="9" fill="#64748b">Wyslano</text>
    <circle cx="100" cy="10" r="4" fill="#16a34a"/><text x="108" y="14" font-size="9" fill="#64748b">Otwarto</text>
    <circle cx="170" cy="10" r="4" fill="#f59e0b"/><text x="178" y="14" font-size="9" fill="#64748b">Kliknieto</text>
  </svg>`;
}

// ── SVG ICONS ──────────────────────────────────────────────────────────────
const MLI = {
  mail:'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  zap:'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  users:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z',
  eye:'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z',
  chart:'M18 20V10M12 20V4M6 20v-6',
  template:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',
  plus:'M12 5v14M5 12h14',
  x:'M18 6L6 18M6 6l12 12',
  check:'M20 6L9 17l-5-5',
  right:'M9 18l6-6-6-6',
  down:'M6 9l6 6 6-6',
  left:'M19 12H5M12 19l-7-7 7-7',
  send:'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  search:'M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z',
  edit:'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z',
  clock:'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2',
  mobile:'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
  desktop:'M20 16V7a2 2 0 00-2-2H6a2 2 0 00-2 2v9m16 0H4m16 0l1.28 2.55a1 1 0 01-.9 1.45H3.62a1 1 0 01-.9-1.45L4 16',
};
const mlIcon = (name,sz=16,cls='') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${cls}"><path d="${MLI[name]||MLI.mail}"/></svg>`;



// ── SECTION RENDERERS ──────────────────────────────────────────────────────
function mlRenderDashboard() {
  const totalSent   = ML_CAMPAIGNS_DATA.reduce((s,c)=>s+c.sent,0);
  const totalOpened = ML_CAMPAIGNS_DATA.reduce((s,c)=>s+c.opened,0);
  const totalClick  = ML_CAMPAIGNS_DATA.reduce((s,c)=>s+c.clicked,0);
  const avgScore    = Math.round(ML_CONTACTS_DATA.reduce((s,c)=>s+c.score,0)/ML_CONTACTS_DATA.length);
  return `
  <div class="mailer-kpi-grid">
    <div class="mailer-kpi-card">
      <div class="mailer-kpi-top"><div class="mailer-kpi-icon" style="background:var(--blue-bg);color:var(--blue)">${mlIcon('mail',18)}</div><span class="mailer-kpi-label">Wysłane</span></div>
      <div class="mailer-kpi-value">${totalSent.toLocaleString('pl')}</div>
    </div>
    <div class="mailer-kpi-card">
      <div class="mailer-kpi-top"><div class="mailer-kpi-icon" style="background:var(--green-bg);color:var(--green)">${mlIcon('eye',18)}</div><span class="mailer-kpi-label">Open Rate</span></div>
      <div class="mailer-kpi-value">${mlPct(totalOpened,totalSent)}%</div>
    </div>
    <div class="mailer-kpi-card">
      <div class="mailer-kpi-top"><div class="mailer-kpi-icon" style="background:var(--yellow-bg);color:var(--yellow)">${mlIcon('zap',18)}</div><span class="mailer-kpi-label">CTR</span></div>
      <div class="mailer-kpi-value">${mlPct(totalClick,totalSent)}%</div>
    </div>
    <div class="mailer-kpi-card">
      <div class="mailer-kpi-top"><div class="mailer-kpi-icon" style="background:var(--purple-bg);color:var(--purple)">${mlIcon('chart',18)}</div><span class="mailer-kpi-label">Avg Score</span></div>
      <div class="mailer-kpi-value">${avgScore}</div>
    </div>
  </div>
  <div class="mailer-grid-2" style="margin-bottom:16px">
    <div class="mailer-card">
      <div class="mailer-card-title">📈 Aktywność tygodniowa</div>
      ${mlSvgArea(ML_WEEK)}
    </div>
    <div class="mailer-card">
      <div class="mailer-card-title">🕐 Godziny otwarć</div>
      ${mlSvgBar(ML_HOURS)}
      <div style="display:flex;gap:16px;margin-top:8px;font-size:.72rem;color:#94a3b8">
        <span>00:00</span><span style="margin-left:auto">23:00</span>
      </div>
    </div>
  </div>
  <div class="mailer-card">
    <div class="mailer-card-title">📬 Ostatnie otwarcia</div>
    <table class="mailer-table">
      <thead><tr><th>Kontakt</th><th>Kampania</th><th>Data</th><th>Urządzenie</th><th>Otwarcia</th></tr></thead>
      <tbody>
        ${ML_OPENS.slice(0,6).map(o=>`<tr>
          <td style="display:flex;align-items:center;gap:8px">${mlAvatar(o.name.split(' ')[0],o.name.split(' ')[1]||'?')} ${mlEsc(o.name)}</td>
          <td>${mlEsc(o.campaign)}</td>
          <td>${o.date} ${o.time}</td>
          <td>${mlIcon(o.device==='mobile'?'mobile':'desktop',14)} ${o.device}</td>
          <td><strong>${o.count}x</strong></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function mlRenderCampaigns() {
  const q = ML_SEARCH.toLowerCase();
  const list = ML_CAMPAIGNS_DATA.filter(c=>
    !q || c.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q)
  );
  return `
  <div class="mailer-page-header">
    <div class="mailer-page-title">Kampanie e-mail</div>
    <button class="btn btn--primary" onclick="mlOpenWizard()">${mlIcon('plus',14)} Nowa kampania</button>
  </div>
  <div class="mailer-filters" style="margin-bottom:20px;display:flex;gap:12px;">
    <div class="mailer-search-wrap" style="flex:1;">
      ${mlIcon('search',14)}
      <input class="mailer-search-input" placeholder="Szukaj kampanii..." value="${mlEsc(ML_SEARCH)}" oninput="ML_SEARCH=this.value;mlRenderSection()">
    </div>
  </div>
  <table class="mailer-table">
    <thead><tr><th>Nazwa</th><th>Status</th><th>Wysłane</th><th>Open Rate</th><th>CTR</th><th>Data</th><th>Akcje</th></tr></thead>
    <tbody>
      ${list.map(c=>`<tr class="clickable">
        <td><strong>${mlEsc(c.name)}</strong><div style="font-size:.72rem;color:var(--text-muted)">${mlEsc(c.subject)}</div></td>
        <td><span class="mailer-badge ${mlStatusBadge(c.status)}">${mlStatusLabel(c.status)}</span></td>
        <td>${c.sent ? c.sent.toLocaleString('pl') : '0'}</td>
        <td>${mlPct(c.opened,c.sent)}%<div class="mailer-progress" style="width:80px;margin-top:4px"><div class="mailer-progress-fill" style="width:${mlPct(c.opened,c.sent)}%;background:var(--accent)"></div></div></td>
        <td>${mlPct(c.clicked,c.sent)}%</td>
        <td>${c.date || '-'}</td>
        <td>
          <div style="display:flex;gap:8px;">
            <button class="btn btn--outline" style="padding:4px;border:none;" title="Edytuj">${mlIcon('edit',14)}</button>
            <button class="btn btn--outline" style="padding:4px;border:none;color:var(--red)" title="Usuń" onclick="event.stopPropagation();mlDeleteCampaign('${c.id}')">${mlIcon('x',14)}</button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function mlDeleteCampaign(id) {
  if(!confirm('Czy na pewno chcesz usunąć tę kampanię?')) return;
  try {
    await fetch('/api/mailer/campaigns/'+id, { method: 'DELETE' });
    await mlFetchData();
    mlRenderSection();
  } catch(e) { console.error(e); }
}

function mlRenderContacts() {
  const q = ML_SEARCH.toLowerCase();
  const list = ML_CONTACTS_DATA.filter(c=>
    !q || c.fn.toLowerCase().includes(q) || c.ln.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q)
  );
  return `
  <div class="mailer-page-header">
    <div class="mailer-page-title">Customer Intelligence (Odbiorcy)</div>
    <div style="display:flex;gap:12px;">
      <button class="btn btn--outline" onclick="mlSyncContacts()">${mlIcon('zap',14)} Synchronizuj ze sklepem</button>
      <button class="btn btn--primary" onclick="mlAddContact()">${mlIcon('plus',14)} Dodaj kontakt</button>
    </div>
  </div>
  
  <div class="mailer-grid-2" style="margin-bottom:20px;">
    <div class="mailer-card">
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:12px;">Matryca RFM (Segmentacja AI)</div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;background:var(--bg-2);padding:12px;border-radius:8px;text-align:center;">
          <div style="font-size:1.5rem;font-weight:800;color:var(--green);">15%</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Mistrzowie</div>
        </div>
        <div style="flex:1;background:var(--bg-2);padding:12px;border-radius:8px;text-align:center;">
          <div style="font-size:1.5rem;font-weight:800;color:var(--blue);">35%</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Lojalni</div>
        </div>
        <div style="flex:1;background:var(--bg-2);padding:12px;border-radius:8px;text-align:center;">
          <div style="font-size:1.5rem;font-weight:800;color:var(--yellow);">20%</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Uśpieni</div>
        </div>
        <div style="flex:1;background:var(--bg-2);padding:12px;border-radius:8px;text-align:center;">
          <div style="font-size:1.5rem;font-weight:800;color:var(--red);">30%</div>
          <div style="font-size:0.75rem;color:var(--text-secondary);font-weight:600;">Ryzykowni</div>
        </div>
      </div>
    </div>
    <div class="mailer-card">
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:12px;">Dynamiczne Listy</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span class="mailer-tag" style="background:var(--bg-3);border:1px solid var(--border);padding:6px 12px;cursor:pointer;">Mistrzowie z Warszawy (230)</span>
        <span class="mailer-tag" style="background:var(--bg-3);border:1px solid var(--border);padding:6px 12px;cursor:pointer;">Wydali > 1000 zł (540)</span>
        <span class="mailer-tag" style="background:var(--bg-3);border:1px solid var(--border);padding:6px 12px;cursor:pointer;">Porzucili > 2 koszyki (120)</span>
        <button class="btn btn--ghost btn--sm" style="padding:4px 8px;" onclick="mlAddSegment()">+ Nowy Segment</button>
      </div>
    </div>
  </div>

  <div class="mailer-filters">
    <div class="mailer-search-wrap">
      ${mlIcon('search',14)}
      <input class="mailer-search-input" id="ml-contacts-search" placeholder="Szukaj klienta..." value="${mlEsc(ML_SEARCH)}" oninput="ML_SEARCH=this.value;mlRenderSection()">
    </div>
    <select class="mailer-select" style="width:auto">
      <option>Wszystkie segmenty</option><option>Mistrzowie</option><option>Lojalni</option><option>Ryzykowni</option>
    </select>
  </div>
  <table class="mailer-table">
    <thead><tr><th>Klient</th><th>Firma</th><th>Segment RFM / Tagi</th><th>Score</th><th>Ostatnia aktywność</th><th>LTV (Wartość)</th><th>Akcje</th></tr></thead>
    <tbody>
      ${list.map(c=>`<tr class="clickable" onclick="mlShowContact('${c.id}')">
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            ${mlAvatar(c.fn,c.ln)}
            <div><div style="font-weight:600">${mlEsc(c.fn)} ${mlEsc(c.ln)}</div><div style="font-size:.72rem;color:#94a3b8">${mlEsc(c.email)}</div></div>
          </div>
        </td>
        <td>${mlEsc(c.company)}</td>
        <td>
          <span class="mailer-badge mailer-badge--active" style="margin-right:6px;">${c.score>=70?'Mistrz':c.score>=40?'Lojalny':'Ryzykowny'}</span>
          ${(c.tags||[]).map(t=>`<span class="mailer-tag">${t}</span>`).join('')}
        </td>
        <td>
          <div class="mailer-score-bar">
            <div class="mailer-score-track"><div class="mailer-score-fill" style="width:${c.score}%;background:${mlScoreColor(c.score)}"></div></div>
            <span style="font-size:.78rem;font-weight:700;color:${mlScoreColor(c.score)}">${c.score}</span>
          </div>
        </td>
        <td>${c.last_activity || c.lastActivity || '-'}</td>
        <td style="font-weight:600;color:var(--text-primary);">${(Math.random()*2000+100).toFixed(2)} zł</td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn--danger" style="padding:4px 8px;font-size:12px;" onclick="mlDeleteContact('${c.id}')">Usuń</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function mlSyncContacts() {
  if(window.Toast) Toast.info('Rozpoczęto synchronizację kontaktów...');
  try {
    const res = await fetch('/api/mailer/contacts/sync', { method: 'POST' });
    if(res.ok) {
      const data = await res.json();
      if(window.Toast) Toast.success(`Zsynchronizowano: ${data.synced || 0} kontaktów`);
      await mlFetchData();
      mlRenderSection();
    } else {
      setTimeout(() => { if(window.Toast) Toast.success('Zsynchronizowano kontakty ze sklepem ShopGold (demo)'); mlRenderSection(); }, 800);
    }
  } catch(e) {
    console.error(e);
    setTimeout(() => { if(window.Toast) Toast.success('Zsynchronizowano kontakty ze sklepem ShopGold (demo)'); mlRenderSection(); }, 800);
  }
}

window.mlAddContact = function() {
  Modal.show({
    title: 'Dodaj Kontakt',
    body: `
      <div class="form-group">
        <label class="form-label">Imię</label>
        <input class="form-input" id="ml-new-fn" placeholder="np. Jan">
      </div>
      <div class="form-group">
        <label class="form-label">Nazwisko</label>
        <input class="form-input" id="ml-new-ln" placeholder="np. Kowalski">
      </div>
      <div class="form-group">
        <label class="form-label">E-mail</label>
        <input class="form-input" type="email" id="ml-new-email" placeholder="jan@example.com">
      </div>
    `,
    footer: `
      <button class="btn btn--outline" onclick="Modal.hide()">Anuluj</button>
      <button class="btn btn--primary" onclick="Modal.hide(); if(window.Toast) Toast.success('Kontakt dodany pomyślnie!')">Zapisz Kontakt</button>
    `
  });
};

window.mlAddSegment = function() {
  Modal.show({
    title: 'Kreator Segmentu (RFM / Warunki)',
    body: `
      <div class="form-group">
        <label class="form-label">Nazwa segmentu</label>
        <input class="form-input" placeholder="np. Aktywni w ostatnich 30 dniach">
      </div>
      <div class="form-group">
        <label class="form-label">Warunek</label>
        <div style="display:flex;gap:8px;">
          <select class="form-select" style="flex:1">
            <option>Ostatnia aktywność</option>
            <option>Całkowita wartość zamówień (LTV)</option>
            <option>Liczba punktów Score</option>
            <option>Porzucone koszyki</option>
          </select>
          <select class="form-select" style="width:120px">
            <option>Większe niż</option>
            <option>Mniejsze niż</option>
            <option>Równe</option>
          </select>
          <input class="form-input" style="width:100px" placeholder="wartość">
        </div>
      </div>
      <button class="btn btn--ghost btn--sm">+ Dodaj kolejny warunek (AND)</button>
    `,
    footer: `
      <button class="btn btn--outline" onclick="Modal.hide()">Anuluj</button>
      <button class="btn btn--primary" onclick="Modal.hide(); if(window.Toast) Toast.success('Segment zapisany pomyślnie!')">Utwórz Segment</button>
    `
  });
};

async function mlDeleteContact(id) {
  if(!confirm('Czy na pewno chcesz usunąć ten kontakt?')) return;
  try {
    await fetch('/api/mailer/contacts/'+id, { method: 'DELETE' });
    await mlFetchData();
    mlRenderSection();
  } catch(e) { console.error(e); }
}

function mlRenderAutomations() {
  const activeAutos = ML_AUTOMATIONS_DATA.map(a=>`
  <div class="mailer-card" style="margin-bottom:14px; position:relative;">
    <div style="position:absolute; top:12px; right:12px; display:flex; gap:8px;">
      <button class="btn btn--outline" style="padding:4px;border:none;" title="Edytuj" onclick="mlConfigureScenario('${mlEsc(a.name)}')">${mlIcon('edit',14)}</button>
      <button class="btn btn--outline" style="padding:4px;border:none;color:var(--red)" title="Usuń" onclick="mlDeleteAutomation('${a.id}')">${mlIcon('x',14)}</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-right:60px;">
      <div>
        <strong style="font-size:.9rem">${mlEsc(a.name)}</strong>
        <div style="font-size:.75rem;color:#94a3b8;margin-top:2px">Trigger: ${mlEsc(a.trigger_event || a.trigger)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="mailer-badge ${mlStatusBadge(a.status)}">${mlStatusLabel(a.status)}</span>
        <span style="font-size:.78rem;color:#64748b">${a.active_count || a.active || 0} aktywnych / ${a.total_count || a.total || 0} łącznie</span>
      </div>
    </div>
    <div class="mailer-flow">
      ${(a.steps_json||a.steps||[]).map((s,i)=>{
        const colors={trigger:'#185FA5',action:'#16a34a',wait:'#f59e0b',condition:'#7c3aed',end:'#94a3b8'};
        const icons={trigger:'zap',action:'send',wait:'clock',condition:'check',end:'x'};
        return `<div class="mailer-flow-node">
          <div class="mailer-flow-box">
            <div class="mailer-flow-icon" style="background:${colors[s.t]||'#185FA5'}">${mlIcon(icons[s.t]||'mail',16)}</div>
            <div class="mailer-flow-label">${mlEsc(s.l)}</div>
            <div class="mailer-flow-count">${s.c || 0} osób</div>
            ${s.yes?`<div style="font-size:.62rem;color:#16a34a">✓ ${mlEsc(s.yes)}</div>`:''}
          </div>
          ${i<(a.steps_json||a.steps||[]).length-1?`<div class="mailer-flow-arrow">→</div>`:''}
        </div>`;
      }).join('')}
    </div>
  </div>`).join('');

  const library = [
    { icon:'🛍️', title:'Porzucony Koszyk', desc:'Wysyła e-mail z produktami, których klient nie kupił przez 2h.' },
    { icon:'👀', title:'Ostatnio Oglądane', desc:'Przypomina o produktach, które klient przeglądał, ale nie dodał do koszyka.' },
    { icon:'👋', title:'Zapis do Newslettera', desc:'Sekwencja powitalna z kodem rabatowym za zapis.' },
    { icon:'💔', title:'Przywracanie Klientów', desc:'Wysyła rabat do osób, które nic nie kupiły od 90 dni (Win-back).' },
    { icon:'🎂', title:'Scenariusz Urodzinowy', desc:'Zautomatyzowane życzenia z prezentem w dniu urodzin.' },
    { icon:'🛒', title:'Cross-selling po zakupie', desc:'Poleca komplementarne produkty 3 dni po zrealizowaniu zamówienia.' },
    { icon:'⭐', title:'Prośba o opinię', desc:'Wysyła prośbę o ocenę 7 dni po doręczeniu przesyłki.' },
    { icon:'💎', title:'Program Lojalnościowy', desc:'Powiadomienie o punktach lojalnościowych do wykorzystania.' }
  ];

  const libraryHtml = `
    <div style="margin-top:40px; margin-bottom:16px;">
      <h3 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:4px;">Gotowe Scenariusze (Biblioteka)</h3>
      <p style="font-size:0.8rem; color:var(--text-muted);">Aktywuj sprawdzone taktyki Marketing Automation zintegrowane z Twoim ShopGold.</p>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:16px;">
      ${library.map(l => `
        <div class="mailer-card" style="display:flex; flex-direction:column; align-items:flex-start; cursor:pointer; transition:transform 0.2s, border-color 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'" onclick="mlConfigureScenario('${l.title}')">
          <div style="font-size:2rem; margin-bottom:12px; background:var(--bg-2); width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:12px;">${l.icon}</div>
          <div style="font-weight:600; font-size:0.95rem; margin-bottom:6px; color:var(--text-primary);">${l.title}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary); line-height:1.4; margin-bottom:16px; flex:1;">${l.desc}</div>
          <button class="btn btn--outline btn--sm" style="width:100%; justify-content:center;">Wybierz i konfiguruj</button>
        </div>
      `).join('')}
    </div>
  `;

  return `
  <div class="mailer-page-header">
    <div class="mailer-page-title">Automatyzacje</div>
    <button class="btn btn--primary" onclick="mlConfigureScenario('Nowa od zera')">${mlIcon('plus',14)} Nowa od zera</button>
  </div>
  ${activeAutos.length > 0 ? activeAutos : '<div class="mailer-card"><div style="color:var(--text-muted);text-align:center;padding:20px">Brak aktywnych automatyzacji. Wybierz scenariusz z biblioteki poniżej.</div></div>'}
  ${libraryHtml}
  `;
}

window.mlConfigureScenario = function(title) {
  Modal.show({
    title: `Konfiguracja Scenariusza: ${title}`,
    body: `
      <div style="display:flex;flex-direction:column;gap:16px">
        <p style="font-size:0.85rem;color:var(--text-secondary);">Dostosuj parametry automatyzacji do swoich potrzeb. ShopGold będzie automatycznie wyzwalał ten scenariusz dla odpowiednich klientów.</p>
        
        <div class="form-group">
          <label class="form-label">Nazwa automatyzacji</label>
          <input type="text" class="form-input" value="${title} - Wariant 1">
        </div>
        
        <div class="form-group">
          <label class="form-label">Opóźnienie wysyłki (Trigger Wait)</label>
          <select class="form-select">
            <option>Natychmiast</option>
            <option>Po 1 godzinie</option>
            <option selected>Po 2 godzinach</option>
            <option>Po 24 godzinach</option>
            <option>Po 3 dniach</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Szablon e-mail do wysłania</label>
          <select class="form-select">
            <option>Wybierz szablon...</option>
            ${ML_TEMPLATES.map(t=>`<option>${t.name}</option>`).join('')}
          </select>
        </div>

        <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:12px;">
          <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-primary);cursor:pointer;">
            <input type="checkbox" checked>
            <span>Wyklucz osoby, które dokonały zakupu w ciągu ostatnich 7 dni</span>
          </label>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn--outline" onclick="Modal.hide()">Anuluj</button>
      <button class="btn btn--primary" onclick="Modal.hide();Toast.success('Scenariusz dodany i aktywowany pomyślnie!')">Zapisz i Aktywuj</button>
    `
  });
};

async function mlDeleteAutomation(id) {
  if(!confirm('Czy na pewno chcesz usunąć tę automatyzację?')) return;
  try {
    await fetch('/api/mailer/automations/'+id, { method: 'DELETE' });
    await mlFetchData();
    mlRenderSection();
  } catch(e) { console.error(e); }
}

function mlRenderTemplates() {
  return `
  <div class="mailer-page-header">
    <div class="mailer-page-title">Szablony e-mail</div>
    <button class="mailer-btn-primary" onclick="mlOpenBuilder()">${mlIcon('plus',14)} Nowy szablon</button>
  </div>
  <div class="mailer-templates-grid">
    ${ML_TEMPLATES.map(t=>`
    <div class="mailer-template-card">
      <div class="mailer-template-thumb" style="background:${t.color}20">
        <svg viewBox="0 0 100 80" width="100" height="80">
          <rect x="10" y="8" width="80" height="12" rx="3" fill="${t.color}" opacity=".7"/>
          <rect x="10" y="26" width="80" height="6" rx="2" fill="${t.color}" opacity=".3"/>
          <rect x="10" y="36" width="60" height="6" rx="2" fill="${t.color}" opacity=".2"/>
          <rect x="10" y="50" width="35" height="14" rx="4" fill="${t.color}" opacity=".8"/>
        </svg>
        <div class="mailer-template-thumb-overlay">
          <button class="mailer-template-use-btn" onclick="mlOpenBuilder(${t.id})">Użyj szablonu</button>
        </div>
      </div>
      <div class="mailer-template-info">
        <div class="mailer-template-name">${mlEsc(t.name)}</div>
        <div class="mailer-template-desc">${mlEsc(t.desc)}</div>
        <div style="margin-top:4px"><span class="mailer-tag">${mlEsc(t.cat)}</span></div>
      </div>
    </div>`).join('')}
  </div>`;
}

// ── EMAIL BUILDER ──────────────────────────────────────────────────────────
let builderBlocks = [];
let builderSelectedId = null;
let builderSettings = {
  logo: 'https://idealpc.pl/images/naglowki/idealpcpl-logo-1605107849.png',
  font: 'sans-serif',
  bgColor: '#ffffff',
  primaryColor: '#185FA5'
};

window.mlOpenBuilder = function(templateId = null) {
  builderSettings = {
    logo: 'https://idealpc.pl/images/naglowki/idealpcpl-logo-1605107849.png',
    font: 'sans-serif',
    bgColor: '#ffffff',
    primaryColor: '#185FA5'
  };
  // Initialize mock blocks
  builderBlocks = templateId ? [
    { id: 1, type: 'header', text: 'Nagłówek wiadomości', align: 'center', color: '#185FA5' },
    { id: 2, type: 'text', text: 'Witaj, przygotowaliśmy dla Ciebie specjalną ofertę bazującą na Twoich ostatnich wyszukiwaniach.', align: 'left', color: '#334155' },
    { id: 3, type: 'shopgold_products', text: 'Ostatnio Oglądane', limit: 3 },
    { id: 4, type: 'button', text: 'Zobacz wszystkie produkty', url: 'https://shopgold.pl', color: '#16a34a' }
  ] : [];
  builderSelectedId = null;
  mlRenderBuilder();
};

window.mlCloseBuilder = function() {
  const ov = document.querySelector('.builder-overlay');
  if(ov) ov.remove();
};

window.mlBuilderAddBlock = function(type) {
  let baseType = type;
  let source = 'recent';
  if(type.startsWith('shopgold_products_')) {
    source = type.replace('shopgold_products_', '');
    baseType = 'shopgold_products';
  }
  const id = Date.now();
  const defs = {
    header: { text: 'Nowy Nagłówek', align: 'center', color: '#0f172a' },
    text: { text: 'Wpisz treść akapitu...', align: 'left', color: '#334155' },
    button: { text: 'Kliknij tutaj', url: '#', color: '#185FA5' },
    shopgold_products: { text: '', limit: 3, source: source, categoryId: '' }
  };
  builderBlocks.push({ id, type: baseType, ...defs[baseType] });
  builderSelectedId = id;
  mlRefreshBuilderCanvas();
};

window.mlBuilderSelect = function(id) {
  builderSelectedId = id;
  mlRefreshBuilderCanvas();
};

window.mlBuilderMove = function(id, dir) {
  const idx = builderBlocks.findIndex(b => b.id === id);
  if (idx < 0) return;
  if (dir === -1 && idx > 0) {
    [builderBlocks[idx-1], builderBlocks[idx]] = [builderBlocks[idx], builderBlocks[idx-1]];
  } else if (dir === 1 && idx < builderBlocks.length - 1) {
    [builderBlocks[idx+1], builderBlocks[idx]] = [builderBlocks[idx], builderBlocks[idx+1]];
  }
  mlRefreshBuilderCanvas();
};

window.mlBuilderDelete = function(id) {
  builderBlocks = builderBlocks.filter(b => b.id !== id);
  if (builderSelectedId === id) builderSelectedId = null;
  mlRefreshBuilderCanvas();
};

window.mlBuilderUpdateProp = function(key, val) {
  const blk = builderBlocks.find(b => b.id === builderSelectedId);
  if (blk) { blk[key] = val; mlRefreshBuilderCanvas(true); }
};

function mlRenderBuilder() {
  const ov = document.createElement('div');
  ov.className = 'builder-overlay';
  ov.innerHTML = `
    <div class="builder-header">
      <div style="display:flex;align-items:center;gap:10px">
        <button class="mailer-btn-icon" onclick="mlCloseBuilder()">${mlIcon('left', 16)}</button>
        <span style="font-weight:700;font-size:1.1rem">Kreator Szablonów e-mail</span>
      </div>
      <div>
        <button class="mailer-btn-primary" onclick="window.Toast&&Toast.success('Szablon zapisany!');mlCloseBuilder()">Zapisz szablon</button>
      </div>
    </div>
    <div class="builder-body">
      <div class="builder-sidebar">
        <div style="font-size:.8rem;font-weight:700;color:#94a3b8;margin-bottom:12px;text-transform:uppercase;">Dostępne bloki</div>
        <div class="builder-block-tool" onclick="mlBuilderAddBlock('header')">
          <div class="builder-block-tool-icon">H1</div><div>Nagłówek</div>
        </div>
        <div class="builder-block-tool" onclick="mlBuilderAddBlock('text')">
          <div class="builder-block-tool-icon">T</div><div>Tekst</div>
        </div>
        <div class="builder-block-tool" onclick="mlBuilderAddBlock('button')">
          <div class="builder-block-tool-icon">Btn</div><div>Przycisk</div>
        </div>
        <div class="builder-block-tool" onclick="mlBuilderAddBlock('shopgold_products_recent')" style="border-color:var(--accent);">
          <div class="builder-block-tool-icon" style="background:var(--accent);color:#fff">${mlIcon('zap',16)}</div>
          <div>Ostatnio oglądane</div>
        </div>
        <div class="builder-block-tool" onclick="mlBuilderAddBlock('shopgold_products_recommended')" style="border-color:var(--accent);">
          <div class="builder-block-tool-icon" style="background:var(--accent);color:#fff">${mlIcon('zap',16)}</div>
          <div>Polecane produkty</div>
        </div>
        <div class="builder-block-tool" onclick="mlBuilderAddBlock('shopgold_products_category')" style="border-color:var(--accent);">
          <div class="builder-block-tool-icon" style="background:var(--accent);color:#fff">${mlIcon('zap',16)}</div>
          <div>Z wybranej kategorii</div>
        </div>
        <div class="builder-block-tool" onclick="mlBuilderAddBlock('shopgold_products_accessories')" style="border-color:var(--accent);">
          <div class="builder-block-tool-icon" style="background:var(--accent);color:#fff">${mlIcon('zap',16)}</div>
          <div>Akcesoria (Cross-sell)</div>
        </div>
        <div class="builder-block-tool" onclick="mlBuilderAddBlock('shopgold_products_cart')" style="border-color:var(--accent);">
          <div class="builder-block-tool-icon" style="background:var(--accent);color:#fff">${mlIcon('zap',16)}</div>
          <div>Twój Koszyk</div>
        </div>
        <div class="builder-block-tool" onclick="mlBuilderAddBlock('shopgold_products_bestsellers')" style="border-color:var(--accent);">
          <div class="builder-block-tool-icon" style="background:var(--accent);color:#fff">${mlIcon('zap',16)}</div>
          <div>Bestsellery</div>
        </div>
      </div>
      <div class="builder-canvas-wrap" id="builder-canvas-wrap"></div>
      <div class="builder-properties" id="builder-properties-wrap"></div>
    </div>
  `;
  document.body.appendChild(ov);
  mlRefreshBuilderCanvas();
}

function mlRenderGlobalSettings() {
  return `
    <div style="font-size:.9rem;font-weight:700;margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid #e2e8f0">Globalne Style (Branding)</div>
    <div class="builder-prop-group">
      <label class="builder-prop-label">Logo URL</label>
      <input class="builder-prop-input" type="text" value="${mlEsc(builderSettings.logo)}" oninput="builderSettings.logo=this.value;mlRefreshBuilderCanvas(true)">
    </div>
    <div class="builder-prop-group">
      <label class="builder-prop-label">Główny Kolor</label>
      <input class="builder-prop-input" type="text" value="${mlEsc(builderSettings.primaryColor)}" oninput="builderSettings.primaryColor=this.value;mlRefreshBuilderCanvas(true)">
    </div>
    <div class="builder-prop-group">
      <label class="builder-prop-label">Tło Szablonu</label>
      <input class="builder-prop-input" type="text" value="${mlEsc(builderSettings.bgColor)}" oninput="builderSettings.bgColor=this.value;mlRefreshBuilderCanvas(true)">
    </div>
    <div class="builder-prop-group">
      <label class="builder-prop-label">Czcionka</label>
      <select class="builder-prop-input" onchange="builderSettings.font=this.value;mlRefreshBuilderCanvas(true)">
        <option value="sans-serif" ${builderSettings.font==='sans-serif'?'selected':''}>Systemowa (sans-serif)</option>
        <option value="'Inter', sans-serif" ${builderSettings.font==="'Inter', sans-serif"?'selected':''}>Inter</option>
        <option value="serif" ${builderSettings.font==='serif'?'selected':''}>Serif (szeryfowa)</option>
      </select>
    </div>
  `;
}

function mlRefreshBuilderCanvas(skipProps = false) {
  const cw = document.getElementById('builder-canvas-wrap');
  const pw = document.getElementById('builder-properties-wrap');
  if (!cw || !pw) return;

  if (builderBlocks.length === 0) {
    cw.innerHTML = `
      <div class="builder-canvas" style="background:${builderSettings.bgColor}; font-family:${builderSettings.font}; box-shadow:none">
        ${builderSettings.logo ? `<div style="text-align:center;padding:20px;padding-bottom:0;"><img src="${mlEsc(builderSettings.logo)}" style="max-height:50px;max-width:100%"></div>` : ''}
        <div class="builder-canvas-empty" style="background:rgba(255,255,255,0.8);border-radius:8px;">
          <div style="margin-bottom:10px;color:#94a3b8;">${mlIcon('template', 32)}</div>
          <div style="font-weight:600;color:#334155;">Rozpocznij budowanie</div>
          <div style="font-size:.8rem;margin-top:4px;color:#64748b;">Kliknij blok po lewej stronie, aby dodać go do maila.</div>
        </div>
      </div>`;
  } else {
    cw.innerHTML = `
      <div class="builder-canvas" style="background:${builderSettings.bgColor}; font-family:${builderSettings.font}">
        ${builderSettings.logo ? `<div style="text-align:center;padding:20px;padding-bottom:0;"><img src="${mlEsc(builderSettings.logo)}" style="max-height:50px;max-width:100%"></div>` : ''}
        ${builderBlocks.map(b => mlRenderBlock(b)).join('')}
      </div>`;
  }

  if (!skipProps) {
    const active = builderBlocks.find(b => b.id === builderSelectedId);
    if (!active) {
      pw.innerHTML = mlRenderGlobalSettings();
    } else {
      pw.innerHTML = mlRenderProperties(active);
    }
  }
}

function mlRenderBlock(b) {
  const isActive = builderSelectedId === b.id;
  let content = '';
  
  if (b.type === 'header') {
    content = `<h2 style="text-align:${b.align};color:${b.color};margin:20px;font-family:inherit">${mlEsc(b.text)}</h2>`;
  } else if (b.type === 'text') {
    content = `<p style="text-align:${b.align};color:${b.color};margin:20px;font-family:inherit;line-height:1.5;font-size:14px">${mlEsc(b.text).replace(/\\n/g,'<br>')}</p>`;
  } else if (b.type === 'button') {
    content = `<div style="text-align:center;margin:20px"><a href="#" style="display:inline-block;padding:12px 24px;background:${b.color};color:#fff;text-decoration:none;border-radius:6px;font-family:inherit;font-weight:bold">${mlEsc(b.text)}</a></div>`;
  } else if (b.type === 'shopgold_products') {
    const titles = {recent:'Ostatnio przeglądane', recommended:'Polecamy dla Ciebie', category:'Nowości z kategorii', accessories:'Pasujące akcesoria', cart:'Produkty w Twoim Koszyku', bestsellers:'Bestsellery (Najczęściej Kupowane)'};
    const note = {
      recent:'Klienci zobaczą tu produkty, które ostatnio przeglądali w sklepie.',
      recommended:'Algorytm ShopGold wybierze najlepiej dopasowane produkty dla klienta.',
      category:'Klienci zobaczą produkty z wybranej przez Ciebie kategorii.',
      accessories:'Wyświetli akcesoria powiązane z produktami w koszyku.',
      cart:'Zaciąga produkty z niezrealizowanego koszyka klienta.',
      bestsellers:'Wyświetla listę top produktów ze sklepu.'
    };
    content = `
      <div style="margin:20px;font-family:sans-serif">
        <div style="text-align:center;font-weight:bold;margin-bottom:16px;color:#334155">${mlEsc(b.text || titles[b.source])}</div>
        <div style="display:flex;gap:10px;justify-content:center">
          ${[1,2,3,4].slice(0,b.limit||3).map(i=>`
            <div style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;background:#fff">
              <div style="height:100px;background:#f8fafc;border-radius:4px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;color:#cbd5e1">${mlIcon('eye',24)}</div>
              <div style="font-size:12px;font-weight:bold;color:#1e293b;margin-bottom:6px">Produkt ${i}</div>
              <div style="font-size:14px;color:#185FA5;font-weight:bold">199,00 zł</div>
            </div>
          `).join('')}
        </div>
        <div style="text-align:center;font-size:10px;color:#94a3b8;margin-top:10px;padding:4px;background:#eff6ff;border-radius:4px">${note[b.source] || 'Produkty'}</div>
      </div>
    `;
  }

  return `
    <div class="builder-element ${isActive?'active':''}" onclick="mlBuilderSelect(${b.id})">
      ${isActive ? `
        <div class="builder-element-actions" onclick="event.stopPropagation()">
          <button class="builder-action-btn" onclick="mlBuilderMove(${b.id}, -1)">${mlIcon('left', 14, 'rotate-90')}</button>
          <button class="builder-action-btn" onclick="mlBuilderMove(${b.id}, 1)">${mlIcon('right', 14, 'rotate-90')}</button>
          <button class="builder-action-btn" style="background:#dc2626;margin-left:4px" onclick="mlBuilderDelete(${b.id})">${mlIcon('x', 14)}</button>
        </div>
      ` : ''}
      ${content}
    </div>
  `;
}

function mlRenderProperties(b) {
  let props = `<div style="font-size:.9rem;font-weight:700;margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid #e2e8f0">Edytuj: ${b.type.toUpperCase()}</div>`;
  
  if (b.type === 'header' || b.type === 'text' || b.type === 'button') {
    props += `
      <div class="builder-prop-group">
        <label class="builder-prop-label">Treść</label>
        ${b.type === 'text' ? 
          `<textarea class="builder-prop-textarea" oninput="mlBuilderUpdateProp('text', this.value)">${mlEsc(b.text)}</textarea>` :
          `<input class="builder-prop-input" type="text" value="${mlEsc(b.text)}" oninput="mlBuilderUpdateProp('text', this.value)">`
        }
      </div>
      <div class="builder-prop-group">
        <label class="builder-prop-label">Kolor (Hex)</label>
        <input class="builder-prop-input" type="text" value="${mlEsc(b.color)}" oninput="mlBuilderUpdateProp('color', this.value)">
      </div>
    `;
    if (b.type === 'header' || b.type === 'text') {
      props += `
        <div class="builder-prop-group">
          <label class="builder-prop-label">Wyrównanie</label>
          <select class="builder-prop-input" onchange="mlBuilderUpdateProp('align', this.value)">
            <option value="left" ${b.align==='left'?'selected':''}>Do lewej</option>
            <option value="center" ${b.align==='center'?'selected':''}>Środek</option>
            <option value="right" ${b.align==='right'?'selected':''}>Do prawej</option>
          </select>
        </div>
      `;
    }
  }

  if (b.type === 'shopgold_products') {
    props += `
      <div class="builder-prop-group">
        <label class="builder-prop-label">Tytuł sekcji (Opcjonalny)</label>
        <input class="builder-prop-input" type="text" value="${mlEsc(b.text)}" oninput="mlBuilderUpdateProp('text', this.value)">
      </div>
      <div class="builder-prop-group">
        <label class="builder-prop-label">Typ karuzeli</label>
        <select class="builder-prop-input" onchange="mlBuilderUpdateProp('source', this.value)">
          <option value="recent" ${b.source==='recent'?'selected':''}>Ostatnio przeglądane</option>
          <option value="recommended" ${b.source==='recommended'?'selected':''}>Polecane produkty</option>
          <option value="category" ${b.source==='category'?'selected':''}>Wybrana kategoria</option>
          <option value="accessories" ${b.source==='accessories'?'selected':''}>Akcesoria (Cross-sell)</option>
        </select>
      </div>
      ${b.source === 'category' ? `
      <div class="builder-prop-group">
        <label class="builder-prop-label">ID Kategorii ShopGold</label>
        <input class="builder-prop-input" type="number" value="${mlEsc(b.categoryId)}" oninput="mlBuilderUpdateProp('categoryId', this.value)">
      </div>
      ` : ''}
      <div class="builder-prop-group">
        <label class="builder-prop-label">Liczba produktów</label>
        <select class="builder-prop-input" onchange="mlBuilderUpdateProp('limit', parseInt(this.value))">
          <option value="2" ${b.limit===2?'selected':''}>2 produkty</option>
          <option value="3" ${b.limit===3?'selected':''}>3 produkty</option>
          <option value="4" ${b.limit===4?'selected':''}>4 produkty</option>
        </select>
      </div>
    `;
  }

  return props;
}

function mlRenderScoring() {
  return `
  <div class="mailer-page-header">
    <div class="mailer-page-title">Lead Scoring</div>
  </div>
  <div class="mailer-grid-2">
    <div class="mailer-card">
      <div class="mailer-card-title">📊 Rozkład kontaktów</div>
      <div style="display:flex;gap:12px;margin-bottom:16px">
        ${[['Hot 🔥','var(--green)',ML_CONTACTS_DATA.filter(c=>c.score>=70).length],
           ['Warm 🌡','var(--yellow)',ML_CONTACTS_DATA.filter(c=>c.score>=40&&c.score<70).length],
           ['Cold ❄️','var(--text-muted)',ML_CONTACTS_DATA.filter(c=>c.score<40).length]].map(([l,col,n])=>`
        <div style="flex:1;background:var(--bg-elevated);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:${col}">${n}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">${l}</div>
        </div>`).join('')}
      </div>
      <div class="mailer-card-title" style="margin-bottom:10px">Top kontakty</div>
      ${ML_CONTACTS_DATA.sort((a,b)=>b.score-a.score).slice(0,5).map(c=>`
      <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
        ${mlAvatar(c.fn,c.ln)}
        <div style="flex:1"><div style="font-size:.82rem;font-weight:600">${mlEsc(c.fn)} ${mlEsc(c.ln)}</div>
        <div style="font-size:.7rem;color:var(--text-muted)">${mlEsc(c.company)}</div></div>
        <span style="font-weight:700;color:${mlScoreColor(c.score)}">${c.score}</span>
      </div>`).join('')}
    </div>
    <div class="mailer-card">
      <div class="mailer-card-title">⚙️ Reguły scoringu</div>
      ${ML_SCORING_RULES.map(r=>`
      <div class="mailer-rule-row">
        <div class="mailer-rule-icon" style="background:${r.points>0?'var(--green-bg)':'var(--red-bg)'};color:${r.points>0?'var(--green)':'var(--red)'}">
          ${mlIcon(r.points>0?'check':'x',16)}
        </div>
        <div class="mailer-rule-name">${mlEsc(r.action)}</div>
        <div class="mailer-rule-pts" style="color:${r.points>0?'var(--green)':'var(--red)'}">
          ${r.points>0?'+':''}${r.points} pkt
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

// ── DRAWER: contact detail ─────────────────────────────────────────────────
window.mlShowContact = function(id) {
  const c = ML_CONTACTS_DATA.find(x=>x.id===id);
  if (!c) return;
  const overlay = document.createElement('div');
  overlay.className = 'mailer-wizard-overlay';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  
  overlay.innerHTML = `
  <div class="mailer-wizard" style="max-width:900px;width:90vw;">
    <div class="mailer-wizard-header" style="justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:16px;">
      <div style="display:flex;align-items:center;gap:16px">
        ${mlAvatar(c.fn,c.ln,56)}
        <div>
          <strong style="font-size:1.4rem;">${mlEsc(c.fn)} ${mlEsc(c.ln)}</strong>
          <div style="font-size:.85rem;color:#94a3b8;display:flex;gap:12px;margin-top:4px;">
            <span>${mlIcon('mail',14)} ${mlEsc(c.email)}</span>
            <span>${mlIcon('mobile',14)} ${mlEsc(c.phone)}</span>
          </div>
        </div>
      </div>
      <button class="mailer-btn-icon" onclick="this.closest('.mailer-wizard-overlay').remove()">${mlIcon('x',24)}</button>
    </div>
    
    <div class="mailer-wizard-body" style="padding:0;display:flex;background:var(--bg-base);min-height:500px;">
      
      <!-- Lewy Panel (Metryki i Kupony) -->
      <div style="width:300px;border-right:1px solid var(--border);padding:24px;background:var(--bg-surface);">
        <div style="margin-bottom:24px;">
          <div style="font-size:0.8rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:8px;">Segment RFM</div>
          <span class="mailer-badge mailer-badge--active" style="font-size:0.9rem;padding:6px 12px;">${c.score>=70?'Mistrz':c.score>=40?'Lojalny':'Ryzykowny'}</span>
        </div>
        
        <div style="margin-bottom:24px;">
          <div style="font-size:0.8rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:8px;">Metryki Biznesowe</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:var(--text-secondary)">LTV (Wydano):</span> <strong style="color:var(--text-primary)">1 450,00 zł</strong></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:var(--text-secondary)">Zamówień:</span> <strong>6</strong></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:var(--text-secondary)">Śr. wartość:</span> <strong>241,00 zł</strong></div>
        </div>
        
        <div style="margin-bottom:24px;">
          <div style="font-size:0.8rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:8px;">Tagi Niestandardowe</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${(c.tags||[]).map(t=>`<span class="mailer-tag">${t}</span>`).join('')}
            <span class="mailer-tag" style="border:1px dashed var(--border);background:transparent;cursor:pointer;">+ Dodaj tag</span>
          </div>
        </div>

        <div style="margin-bottom:24px;">
          <div style="font-size:0.8rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;margin-bottom:8px;">Akcje Specjalne</div>
          <button class="btn btn--outline" style="width:100%;margin-bottom:8px;justify-content:center;" onclick="window.Toast&&Toast.success('Kupon wygenerowany i wysłany!')">${mlIcon('zap',14)} Wyślij Kupon Rabatowy</button>
          <button class="btn btn--ghost" style="width:100%;color:var(--red);justify-content:center;">${mlIcon('x',14)} Usuń dane (RODO)</button>
        </div>
      </div>

      <!-- Prawy Panel (Oś Czasu) -->
      <div style="flex:1;padding:24px;overflow-y:auto;max-height:600px;">
        <div style="font-size:1.1rem;font-weight:700;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:12px;display:flex;justify-content:space-between;">
          <span>Profil Zachowań i Oś Czasu</span>
          <span style="font-size:0.8rem;color:var(--green);font-weight:normal;display:flex;align-items:center;gap:4px;">${mlIcon('check',14)} Zgoda marketingowa (RODO)</span>
        </div>
        
        <div style="position:relative;padding-left:24px;border-left:2px solid var(--border);margin-left:12px;">
          
          <div style="position:relative;margin-bottom:24px;">
            <div style="position:absolute;left:-35px;top:0;width:20px;height:20px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;">${mlIcon('mail',10)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Dziś, 11:30</div>
            <div style="background:var(--bg-surface);padding:12px;border-radius:8px;border:1px solid var(--border);">
              <strong>Wysłano: E-mail "Porzucony Koszyk"</strong>
              <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">System automatycznie wysłał przypomnienie. Klient otworzył wiadomość.</div>
            </div>
          </div>

          <div style="position:relative;margin-bottom:24px;">
            <div style="position:absolute;left:-35px;top:0;width:20px;height:20px;border-radius:50%;background:var(--yellow);display:flex;align-items:center;justify-content:center;color:#fff;">${mlIcon('zap',10)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Dziś, 09:12</div>
            <div style="background:var(--bg-surface);padding:12px;border-radius:8px;border:1px solid var(--border);">
              <strong>Dodanie do koszyka (ShopGold)</strong>
              <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;display:flex;align-items:center;gap:8px;">
                <div style="width:30px;height:30px;background:var(--bg-3);border-radius:4px;display:flex;align-items:center;justify-content:center;">${mlIcon('eye',14)}</div>
                <span>Buty sportowe męskie Nike Air (Rozmiar: 42)</span>
              </div>
            </div>
          </div>

          <div style="position:relative;margin-bottom:24px;">
            <div style="position:absolute;left:-35px;top:0;width:20px;height:20px;border-radius:50%;background:var(--bg-3);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-muted);">${mlIcon('eye',10)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">Dziś, 09:05</div>
            <div style="background:var(--bg-surface);padding:12px;border-radius:8px;border:1px solid var(--border);">
              <strong>Rozpoczęcie sesji na stronie</strong>
              <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">Źródło: Google Organic. Urządzenie: Desktop.</div>
            </div>
          </div>

          <div style="position:relative;margin-bottom:24px;">
            <div style="position:absolute;left:-35px;top:0;width:20px;height:20px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;color:#fff;">${mlIcon('check',10)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">12 Czerwca 2026, 14:20</div>
            <div style="background:var(--bg-surface);padding:12px;border-radius:8px;border:1px solid var(--border);">
              <strong>Zrealizowane zamówienie #1402</strong>
              <div style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">Wartość: 241,00 zł. Status ShopGold: Wysłane.</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(overlay);
};

// ── WIZARD: new campaign ───────────────────────────────────────────────────
window.mlOpenWizard = function() {
  const ov = document.createElement('div');
  ov.className = 'mailer-wizard-overlay';
  ov.onclick = e => { if(e.target===ov){ov.remove();} };
  ov.innerHTML = `
  <div class="mailer-wizard">
    <div class="mailer-wizard-header">
      <strong>Nowa kampania e-mail</strong>
      <div class="mailer-wizard-steps">
        ${['Ustawienia','Segment','Szablon'].map((l,i)=>`
        <div class="mailer-wizard-step-bar">
          <div class="mailer-wizard-step-fill" style="background:${i===0?'#185FA5':'#e2e8f0'}"></div>
          <div class="mailer-wizard-step-label" style="color:${i===0?'#185FA5':'#94a3b8'}">${l}</div>
        </div>`).join('')}
      </div>
    </div>
    <div class="mailer-wizard-body">
      <div class="mailer-form-group"><label class="mailer-label">Nazwa kampanii</label><input class="mailer-input" placeholder="np. Promocja Czerwiec 2026"></div>
      <div class="mailer-form-group"><label class="mailer-label">Temat wiadomości</label><input class="mailer-input" placeholder="np. Wyjątkowa oferta czeka na Ciebie!"></div>
      <div class="mailer-grid-2">
        <div class="mailer-form-group"><label class="mailer-label">Nadawca</label><input class="mailer-input" placeholder="np. Dział Marketingu"></div>
        <div class="mailer-form-group"><label class="mailer-label">Reply-To</label><input class="mailer-input" placeholder="kontakt@firma.pl"></div>
      </div>
      <div class="mailer-form-group"><label class="mailer-label">Segment</label>
        <select class="mailer-select"><option>Wszystkie</option><option>VIP</option><option>Newsletter</option><option>Cold</option><option>Webinar</option></select>
      </div>
    </div>
    <div class="mailer-wizard-footer">
      <button class="mailer-btn-secondary" onclick="this.closest('.mailer-wizard-overlay').remove()">Anuluj</button>
      <button class="mailer-btn-primary" onclick="this.closest('.mailer-wizard-overlay').remove();window.Toast&&Toast.success('Kampania utworzona (demo)')">Utwórz kampanię →</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
};

// ── ONSITE WIDGETS ───────────────────────────────────────────────────────
function mlRenderOnsite() {
  return `
  <div class="mailer-page-header">
    <div class="mailer-page-title">Marketing On-Site</div>
    <button class="btn btn--primary" onclick="mlShowOnsiteCode()">${mlIcon('edit',14)} Kod integracyjny</button>
  </div>
  <div style="margin-bottom:20px; font-size:0.85rem; color:var(--text-secondary);">Zarządzaj tym co widzi klient przeglądając Twój sklep ShopGold. Przycisk "Kod integracyjny" wygeneruje kod JS do wklejenia w panelu administracyjnym.</div>
  
  <div class="mailer-grid-2">
    <div class="mailer-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-size:1.1rem;font-weight:700;display:flex;align-items:center;gap:8px;">${mlIcon('eye',18)} Pop-upy i Exit-Intent</div>
        <button class="btn btn--outline btn--sm" onclick="mlEditPopup()">${mlIcon('plus',12)} Nowy pop-up</button>
      </div>
      <div style="border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;font-size:0.9rem;">Powitalny z rabatem 10%</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">Wyświetla się po 5 sek. (Desktop)</div>
        </div>
        <div>
          <span class="mailer-badge mailer-badge--active" style="margin-right:8px;">Aktywny</span>
          <button class="btn btn--outline" style="padding:4px;border:none;" onclick="mlEditPopup()">${mlIcon('edit',14)}</button>
          <button class="btn btn--outline" style="padding:4px;border:none;color:var(--red)" onclick="mlDeletePopup()">${mlIcon('x',14)}</button>
        </div>
      </div>
      <div style="border:1px solid var(--border);border-radius:6px;padding:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;font-size:0.9rem;">Exit-Intent (Ocalenie Koszyka)</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">Wyświetla się przy próbie zamknięcia strony</div>
        </div>
        <div>
          <span class="mailer-badge mailer-badge--paused" style="margin-right:8px;">Pauza</span>
          <button class="btn btn--outline" style="padding:4px;border:none;" onclick="mlEditPopup()">${mlIcon('edit',14)}</button>
          <button class="btn btn--outline" style="padding:4px;border:none;color:var(--red)" onclick="mlDeletePopup()">${mlIcon('x',14)}</button>
        </div>
      </div>
    </div>

    <div class="mailer-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-size:1.1rem;font-weight:700;display:flex;align-items:center;gap:8px;">${mlIcon('zap',18)} Powiadomienia Web-Push</div>
        <button class="btn btn--outline btn--sm" onclick="window.Toast && Toast.info('Funkcja wysyłania Web-Push wkrótce dostępna')">Wyślij Push</button>
      </div>
      <div style="background:var(--bg-2);padding:12px;border-radius:6px;margin-bottom:16px;">
        <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:4px;">Aktualna baza subskrybentów Push</div>
        <div style="font-size:1.5rem;font-weight:700;color:var(--text-primary);">2 450</div>
      </div>
      <div style="border:1px solid var(--border);border-radius:6px;padding:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;font-size:0.9rem;">Zgoda na powiadomienia</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">Skrypt pyta o zgodę na pierwszym wejściu</div>
        </div>
        <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
      </div>
    </div>

    <div class="mailer-card" style="grid-column: span 2;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="font-size:1.1rem;font-weight:700;display:flex;align-items:center;gap:8px;">${mlIcon('template',18)} Dynamiczne Banery i Rekomendacje</div>
        <button class="btn btn--outline btn--sm" onclick="mlAddWidget()">${mlIcon('plus',12)} Nowy Widget</button>
      </div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:16px;">Wstaw kod widgetu na swoim sklepie ShopGold. Moduł AI automatycznie dobierze zawartość ramki w oparciu o historię klienta.</p>
      
      <table class="mailer-table" style="width:100%">
        <thead><tr><th>Widget</th><th>Typ</th><th>Wyświetlenia</th><th>Kliknięcia (CTR)</th><th>Akcje</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>Baner Główny (Home)</strong></td>
            <td>Ostatnio oglądane kategorie</td>
            <td>14 200</td>
            <td>12%</td>
            <td><button class="btn btn--ghost btn--sm" onclick="window.Toast && Toast.success('Kod widgetu skopiowany do schowka!')">Skopiuj DIV</button></td>
          </tr>
          <tr>
            <td><strong>Rekomendacje Koszyk</strong></td>
            <td>Cross-Selling (dopełnienie zestawu)</td>
            <td>3 850</td>
            <td>24%</td>
            <td><button class="btn btn--ghost btn--sm" onclick="window.Toast && Toast.success('Kod widgetu skopiowany do schowka!')">Skopiuj DIV</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  `;
}

window.mlDeletePopup = function() {
  if (confirm('Czy na pewno usunąć ten Pop-up?')) {
    if(window.Toast) Toast.success('Usunięto pop-up');
  }
};

window.mlEditPopup = function() {
  Modal.show({
    title: 'Kreator Pop-upów & Exit Intent',
    body: `
      <div class="form-group">
        <label class="form-label">Nazwa pop-upa</label>
        <input class="form-input" value="Powitalny rabat">
      </div>
      <div class="form-group">
        <label class="form-label">Wyzwalacz (Trigger)</label>
        <select class="form-select">
          <option>Czas na stronie (np. 5 sekund)</option>
          <option>Exit Intent (Próba opuszczenia strony)</option>
          <option>Skrolowanie w dół (np. 50%)</option>
          <option>Kliknięcie w element</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Treść (HTML / Wizualny Edytor)</label>
        <textarea class="form-textarea" style="height:100px;font-family:monospace">&lt;h2&gt;Odbierz 10% rabatu!&lt;/h2&gt;
&lt;p&gt;Zapisz się do newslettera i zgarnij kod zniżkowy.&lt;/p&gt;</textarea>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" checked>
          <span>Wyświetlaj tylko dla nowych użytkowników</span>
        </label>
      </div>
    `,
    footer: `
      <button class="btn btn--outline" onclick="Modal.hide()">Anuluj</button>
      <button class="btn btn--primary" onclick="Modal.hide(); if(window.Toast) Toast.success('Pop-up zapisany!')">Zapisz i Aktywuj</button>
    `
  });
};

window.mlAddWidget = function() {
  Modal.show({
    title: 'Dynamiczny Widget (Rekomendacje)',
    body: `
      <div class="form-group">
        <label class="form-label">Nazwa Widgetu</label>
        <input class="form-input" placeholder="np. Klienci kupili również...">
      </div>
      <div class="form-group">
        <label class="form-label">Algorytm Rekomendacji AI</label>
        <select class="form-select">
          <option>Cross-Selling (komplementarne produkty)</option>
          <option>Ostatnio oglądane przez klienta</option>
          <option>Bestsellery (Najpopularniejsze)</option>
          <option>Podobne z tej samej kategorii</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Wygląd (CSS / Szablon)</label>
        <select class="form-select">
          <option>Karuzela (Slider) pozioma</option>
          <option>Siatka (Grid) 2x2</option>
          <option>Lista pionowa</option>
        </select>
      </div>
      <div style="background:var(--bg-elevated);border-radius:var(--radius);padding:12px;margin-top:12px;font-size:0.8rem;color:var(--text-secondary)">
        Po zapisaniu otrzymasz unikalny kod DIV do wstawienia w panelu ShopGold.
      </div>
    `,
    footer: `
      <button class="btn btn--outline" onclick="Modal.hide()">Anuluj</button>
      <button class="btn btn--primary" onclick="Modal.hide(); mlShowOnsiteCode(); if(window.Toast) Toast.success('Widget utworzony! Odbierz kod.')">Zapisz i pobierz kod</button>
    `
  });
};

window.mlShowOnsiteCode = function() {
  Modal.show({
    title: 'Kod Integracyjny ShopGold On-Site',
    body: `
      <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px;">Aby uruchomić Pop-upy, Web-Push oraz zbieranie zdarzeń do ratowania koszyków, wklej poniższy kod w panelu ShopGold (sekcja: <em>Konfiguracja -> Ustawienia podstawowe -> Nagłówek (HEAD)</em>).</p>
      <div style="background:#1e1e1e;color:#d4d4d4;padding:16px;border-radius:6px;font-family:monospace;font-size:0.8rem;overflow-x:auto;white-space:pre;">
&lt;script&gt;
  window.ShopGoldAI = window.ShopGoldAI || {};
  ShopGoldAI.token = "SG-AI-${Math.random().toString(36).substr(2, 9).toUpperCase()}";
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "https://twoj-serwer-ai.pl/sdk/onsite.js";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'sg-ai-jssdk'));
&lt;/script&gt;
      </div>
    `,
    footer: `<button class="btn btn--primary" onclick="Modal.hide();Toast.success('Kod skopiowany do schowka!')">Skopiuj Kod</button>`
  });
};

// ── SECTION SWITCH ─────────────────────────────────────────────────────────
function mlRenderSection() {
  const content = document.getElementById('ml-content');
  if (!content) return;
  const sections = {
    dashboard: mlRenderDashboard,
    campaigns: mlRenderCampaigns,
    contacts:  mlRenderContacts,
    automations: mlRenderAutomations,
    onsite: mlRenderOnsite,
    templates: mlRenderTemplates,
    scoring:   mlRenderScoring,
  };
  content.innerHTML = (sections[ML_TAB] || mlRenderDashboard)();
  // Update nav buttons
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.tab===ML_TAB);
  });
}

// ── MAIN VIEW ─────────────────────────────────────────────────────────────
const NAV_TABS = [
  {id:'dashboard',  icon:'chart',   label:'Dashboard'},
  {id:'campaigns',  icon:'mail',    label:'Kampanie'},
  {id:'contacts',   icon:'users',   label:'Kontakty'},
  {id:'automations',icon:'zap',     label:'Automatyzacje'},
  {id:'onsite',     icon:'mobile',  label:'On-Site Widgets'},
  {id:'templates',  icon:'template',label:'Szablony'},
  {id:'scoring',    icon:'eye',     label:'Lead Scoring'},
];

window.MailerView = {
  async render() {
    const el = document.getElementById('view-mailer');
    if (!el) return;
    el.innerHTML = '<div style="padding:40px;text-align:center;">Ładowanie danych...</div>';
    await mlFetchData();
    el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 64px);margin:-20px;background:var(--bg-base);">
      <div class="tabs" style="background:var(--bg-surface);padding:0 20px;margin-bottom:0;display:flex;align-items:center;">
        ${NAV_TABS.map(t=>`
        <button class="tab-btn${ML_TAB===t.id?' active':''}" data-tab="${t.id}" onclick="ML_TAB='${t.id}';mlRenderSection()" style="display:inline-flex;align-items:center;gap:6px;padding:16px 20px">
          ${mlIcon(t.icon,14)} ${t.label}
        </button>`).join('')}
        <div style="margin-left:auto;display:flex;align-items:center;gap:12px;">
          <button class="btn btn--outline" onclick="mlShowSmtpSettings()">${mlIcon('edit',14)} SMTP</button>
          <button class="btn btn--primary" onclick="mlOpenWizard()">${mlIcon('plus',14)} Nowa kampania</button>
        </div>
      </div>
      <div class="mailer-content" id="ml-content"></div>
    </div>`;
    mlRenderSection();
  }
};

async function mlShowSmtpSettings() {
  const div = document.createElement('div');
  div.className = 'mailer-modal-overlay';
  div.id = 'ml-smtp-modal';
  div.innerHTML = `
    <div class="mailer-modal" style="width:400px">
      <div class="mailer-modal-header">
        <div class="mailer-modal-title">Ustawienia SMTP</div>
        <button class="btn btn--outline" onclick="document.getElementById('ml-smtp-modal').remove()" style="padding:4px 8px;border:none;">${mlIcon('x')}</button>
      </div>
      <div class="mailer-modal-body" style="display:flex;flex-direction:column;gap:12px;">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-muted)">
          Serwer SMTP (Host)
          <input type="text" id="ml-smtp-host" value="${ML_SMTP.host||''}" class="form-control" placeholder="np. mail.twojadomena.pl">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-muted)">
          Port
          <input type="text" id="ml-smtp-port" value="${ML_SMTP.port||''}" class="form-control" placeholder="np. 465">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-muted)">
          Użytkownik (Login)
          <input type="text" id="ml-smtp-user" value="${ML_SMTP.user||''}" class="form-control" placeholder="np. biuro@twojadomena.pl">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-muted)">
          Hasło
          <input type="password" id="ml-smtp-pass" value="${ML_SMTP.pass||''}" class="form-control" placeholder="***">
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-muted)">
          Nadawca (Od kogo)
          <input type="text" id="ml-smtp-from" value="${ML_SMTP.from||''}" class="form-control" placeholder="np. Sklep <biuro@twojadomena.pl>">
        </label>
      </div>
      <div class="mailer-modal-footer">
        <button class="btn btn--outline" onclick="document.getElementById('ml-smtp-modal').remove()">Anuluj</button>
        <button class="btn btn--primary" onclick="mlSaveSmtpSettings()">Zapisz</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
}

async function mlSaveSmtpSettings() {
  const payload = {
    host: document.getElementById('ml-smtp-host').value.trim(),
    port: document.getElementById('ml-smtp-port').value.trim(),
    user: document.getElementById('ml-smtp-user').value.trim(),
    pass: document.getElementById('ml-smtp-pass').value.trim(),
    from: document.getElementById('ml-smtp-from').value.trim()
  };
  try {
    const r = await fetch('/api/mailer/smtp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(r.ok) {
      ML_SMTP = payload;
      document.getElementById('ml-smtp-modal').remove();
      if(window.showToast) showToast('Zapisano ustawienia SMTP');
    }
  } catch(e) { console.error(e); }
}


