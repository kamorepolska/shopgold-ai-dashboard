/* ═══════════════════════════════════════════════════════════════════════════
   CRM API Routes
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const router = require('express').Router();
const crm = require('../services/crmService');
const axios = require('axios');

function getUsername(req) {
  const username = req.user?.username || req.headers['x-user'] || '';
  if (username) {
    try {
      crm.ensureUserInTeam(username);
    } catch(e) {
      console.error('[CRM Route Sync] Failed to ensure user:', e.message);
    }
  }
  return username;
}

router.use((req, res, next) => {
  getUsername(req);
  next();
});

function parsePolishAddress(fullAddress) {
  if (!fullAddress) return { address: '', city: '', postal_code: '' };
  const postalCodeMatch = fullAddress.match(/(\d{2}-\d{3})/);
  if (postalCodeMatch) {
    const postalCode = postalCodeMatch[1];
    const parts = fullAddress.split(postalCode);
    const streetPart = (parts[0] || '').trim().replace(/,$/, '').trim();
    const cityPart = (parts[1] || '').trim().replace(/^,/, '').trim();
    return {
      address: streetPart,
      city: cityPart,
      postal_code: postalCode
    };
  }
  return { address: fullAddress, city: '', postal_code: '' };
}

/* ── Companies ───────────────────────────────────────────────────────────── */
router.get('/companies', (req, res) => {
  try {
    const { search, page, limit } = req.query;
    res.json(crm.listCompanies({ search, page: parseInt(page)||1, limit: parseInt(limit)||50 }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/companies', (req, res) => {
  try { res.json(crm.createCompany(req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/companies/:id', (req, res) => {
  try {
    const c = crm.getCompany(parseInt(req.params.id));
    if (!c) return res.status(404).json({ error: 'Nie znaleziono' });
    res.json(c);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/companies/:id', (req, res) => {
  try { res.json(crm.updateCompany(parseInt(req.params.id), req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/companies/:id', (req, res) => {
  try { res.json(crm.deleteCompany(parseInt(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── Contacts ────────────────────────────────────────────────────────────── */
router.get('/contacts', (req, res) => {
  try {
    const { search, company_id, page, limit } = req.query;
    res.json(crm.listContacts({ search, company_id: company_id ? parseInt(company_id) : undefined, page: parseInt(page)||1, limit: parseInt(limit)||50 }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/contacts', (req, res) => {
  try { res.json(crm.createContact(req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/contacts/:id', (req, res) => {
  try { res.json(crm.updateContact(parseInt(req.params.id), req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/contacts/:id', (req, res) => {
  try { res.json(crm.deleteContact(parseInt(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── Team ────────────────────────────────────────────────────────────────── */
router.get('/team', (req, res) => {
  try { res.json(crm.listTeam()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/team', (req, res) => {
  try { res.json(crm.createTeamMember(req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/team/:id', (req, res) => {
  try { res.json(crm.updateTeamMember(parseInt(req.params.id), req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/team/:id', (req, res) => {
  try { res.json(crm.deleteTeamMember(parseInt(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── Task Statuses ───────────────────────────────────────────────────────── */
router.get('/statuses', (req, res) => {
  try { res.json(crm.listStatuses()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/statuses', (req, res) => {
  try { res.json(crm.createStatus(req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/statuses/:id', (req, res) => {
  try { res.json(crm.updateStatus(parseInt(req.params.id), req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/statuses/:id', (req, res) => {
  try { res.json(crm.deleteStatus(parseInt(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── Tasks ───────────────────────────────────────────────────────────────── */
router.get('/tasks', (req, res) => {
  try {
    const { search, status_id, priority, assignee_id, project_id, my, page, limit } = req.query;
    res.json(crm.listTasks({
      search, status_id: status_id ? parseInt(status_id) : undefined,
      priority, assignee_id: assignee_id ? parseInt(assignee_id) : undefined,
      project_id: project_id ? parseInt(project_id) : undefined,
      assignee_username: my === 'true' ? getUsername(req) : undefined,
      page: parseInt(page)||1, limit: parseInt(limit)||50
    }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/tasks', (req, res) => {
  try {
    req.body.created_by = getUsername(req) || 'system';
    res.json(crm.createTask(req.body));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/tasks/:id', (req, res) => {
  try {
    const t = crm.getTask(parseInt(req.params.id));
    if (!t) return res.status(404).json({ error: 'Nie znaleziono' });
    res.json(t);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/tasks/:id', (req, res) => {
  try {
    req.body.updated_by = getUsername(req) || 'system';
    res.json(crm.updateTask(parseInt(req.params.id), req.body));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/tasks/:id/progress', (req, res) => {
  try { res.json(crm.updateTaskProgress(parseInt(req.params.id), parseInt(req.body.progress)||0)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/tasks/:id', (req, res) => {
  try { res.json(crm.deleteTask(parseInt(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── Time Entries ────────────────────────────────────────────────────────── */
router.get('/tasks/:id/time', (req, res) => {
  try { res.json(crm.listTimeEntries(parseInt(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/tasks/:id/time', (req, res) => {
  try {
    req.body.task_id = parseInt(req.params.id);
    res.json(crm.createTimeEntry(req.body));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/time/:id', (req, res) => {
  try { res.json(crm.deleteTimeEntry(parseInt(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── Notifications ───────────────────────────────────────────────────────── */
router.get('/notifications', (req, res) => {
  try {
    const username = getUsername(req);
    res.json({ notifications: crm.listNotifications(username), unread: crm.getUnreadCount(username) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/notifications/:id/read', (req, res) => {
  try { res.json(crm.markNotificationRead(parseInt(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/notifications/read-all', (req, res) => {
  try {
    const username = getUsername(req);
    res.json(crm.markAllNotificationsRead(username));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── Projects ──────────────────────────────────────────────────────────── */
router.get('/projects', (req, res) => {
  try { res.json(crm.listProjects()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/projects', (req, res) => {
  try { res.json(crm.createProject(req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/projects/:id', (req, res) => {
  try { res.json(crm.updateProject(parseInt(req.params.id), req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/projects/:id', (req, res) => {
  try { res.json(crm.deleteProject(parseInt(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── Dashboard / Search ──────────────────────────────────────────────── */
router.get('/dashboard', (req, res) => {
  try { res.json(crm.getDashboardStats(getUsername(req))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/search', (req, res) => {
  try { res.json(crm.globalSearch(req.query.q || '')); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── GUS/MF Company Lookup ────────────────────────────────────────────────── */
router.get('/gus', async (req, res) => {
  try {
    const nip = (req.query.nip || '').replace(/\D/g, '');
    if (!nip || nip.length !== 10) {
      return res.status(400).json({ error: 'NIP musi składać się z 10 cyfr' });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const url = `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${dateStr}`;

    try {
      const response = await axios.get(url, { timeout: 5000 });
      const subject = response.data?.result?.subject;
      if (subject) {
        const fullAddress = subject.workingAddress || subject.residenceAddress || '';
        const parsed = parsePolishAddress(fullAddress);
        return res.json({
          name: subject.name,
          nip: subject.nip,
          address: parsed.address,
          city: parsed.city,
          postal_code: parsed.postal_code,
          phone: subject.phone || '',
          email: subject.email || '',
          website: '',
          notes: 'Pobrano z wykazu podmiotów MF (Biała Lista)'
        });
      }
    } catch (apiError) {
      console.error('Błąd pobierania z wl-api.mf.gov.pl:', apiError.message);
    }

    // Fallback deweloperski
    if (nip === '1234567890' || nip.startsWith('525') || nip.startsWith('111') || nip.startsWith('526') || nip.startsWith('779')) {
      return res.json({
        name: 'Przykładowa Firma Sp. z o.o. (GUS Fallback)',
        nip: nip,
        address: 'ul. Marszałkowska 100/102',
        city: 'Warszawa',
        postal_code: '00-010',
        phone: '+48 22 123 45 67',
        email: 'kontakt@przykladowafirma.pl',
        website: 'www.przykladowafirma.pl',
        notes: 'Dane wygenerowane automatycznie (fallback deweloperski/offline)'
      });
    }

    return res.status(404).json({ error: 'Nie znaleziono firmy o podanym NIP w bazie MF' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Custom Field Definitions ──────────────────────────────────────── */
router.get('/custom-fields', (req, res) => {
  try { res.json(crm.listCustomFieldDefs()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/custom-fields', (req, res) => {
  try { res.json(crm.createCustomFieldDef(req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/custom-fields/:id', (req, res) => {
  try { res.json(crm.updateCustomFieldDef(parseInt(req.params.id), req.body)); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/custom-fields/:id', (req, res) => {
  try { res.json(crm.deleteCustomFieldDef(parseInt(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── Import / Export ─────────────────────────────────────────────────────── */
const multer = require('multer');
const XLSX   = require('xlsx');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── EXPORT companies (Excel)
router.get('/export/companies', (req, res) => {
  try {
    const rows = crm.exportCompanies();
    const wb = XLSX.utils.book_new();
    const wsData = [
      ['ID','Nazwa','NIP','Adres','Miasto','Kod pocztowy','Telefon','Email','Strona WWW','Notatki','Utworzono','Zaktualizowano','Kontakty','Zadania']
    ];
    rows.forEach(r => wsData.push([
      r.id, r.name, r.nip||'', r.address||'', r.city||'', r.postal_code||'',
      r.phone||'', r.email||'', r.website||'', r.notes||'',
      r.created_at, r.updated_at, r.contact_count, r.task_count
    ]));
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // Column widths
    ws['!cols'] = [8,30,15,30,20,14,16,28,28,40,20,20,10,10].map(w=>({wch:w}));
    XLSX.utils.book_append_sheet(wb, ws, 'Firmy');
    // Add contacts sheet
    const contacts = crm.exportContacts();
    const wsC = XLSX.utils.json_to_sheet(contacts);
    XLSX.utils.book_append_sheet(wb, wsC, 'Kontakty');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="crm_export_${new Date().toISOString().slice(0,10)}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── EXPORT contacts (Excel)
router.get('/export/contacts', (req, res) => {
  try {
    const rows = crm.exportContacts();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Kontakty');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="crm_kontakty_${new Date().toISOString().slice(0,10)}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── IMPORT — step 1: parse file and return columns + preview rows
router.post('/import/preview', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const preview = rows.slice(0, 5);
    res.json({ columns, preview, total: rows.length, sheets: wb.SheetNames });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── IMPORT — step 2: apply import with column mapping
router.post('/import/companies', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
    const mapping = JSON.parse(req.body.mapping || '{}'); // { dbField: excelColumn }
    const mode = req.body.mode || 'upsert'; // upsert | skip | update
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = req.body.sheet || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    const DB_FIELDS = ['name','nip','address','city','postal_code','phone','email','website','notes','summary'];
    const mapped = rawRows.map(row => {
      const out = {};
      for (const dbField of DB_FIELDS) {
        const col = mapping[dbField];
        if (col && col !== '__skip__') out[dbField] = String(row[col] || '').trim();
      }
      return out;
    }).filter(r => r.name);

    const result = crm.importCompanies(mapped, mode);
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
