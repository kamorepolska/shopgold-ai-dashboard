/* =====================================================================
 * routes/sourcing.js — Smart Sourcing & Pricing REST API
 * ===================================================================== */
'use strict';

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const svc = require('../services/sourcingService');
function withDataDir(req) { if(svc._setDataDir) svc._setDataDir(req.dataDir); }

const UPLOAD_DIR = path.join(__dirname, '../../data/sourcing_uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|xml|csv|txt)$/i.test(file.originalname);
    if (!ok) return cb(new Error(`Niedozwolony format. Dozwolone: xlsx, xls, xml, csv, txt. Otrzymano: ${file.originalname}`));
    cb(null, true);
  },
});

// Multer error handler — zamienia błędy multera (LIMIT_FILE_SIZE itp.) na JSON
function handleMulterError(err, req, res, next) {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `Plik jest za duzy (maks. 100 MB). Twoj plik: ${err.field || 'nieznany'}` });
  }
  if (err) return res.status(400).json({ error: err.message || 'Blad przeslania pliku' });
  next();
}

// ─── Subiekt ──────────────────────────────────────────────────────────────────

router.get('/subiekt/status', (req, res) => {
  try { res.json(svc.getSubiektStatus()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/subiekt/preview', (req, res, next) => upload.single('file')(req, res, err => err ? handleMulterError(err, req, res, next) : next()), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
    const buf = fs.readFileSync(req.file.path);
    const isCSV = req.file.originalname.toLowerCase().endsWith('.csv');
    const result = isCSV ? svc.previewCsv(buf) : svc.previewExcel(buf);
    result.tempPath = req.file.path;
    result.fileType = isCSV ? 'csv' : 'excel';
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/subiekt/import', (req, res, next) => upload.single('file')(req, res, err => err ? handleMulterError(err, req, res, next) : next()), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
    let columnMap = {};
    try { columnMap = JSON.parse(req.body.columnMap || '{}'); } catch { columnMap = {}; }
    svc.saveColumnMap(columnMap);
    const buf = fs.readFileSync(req.file.path);
    const isCSV = req.file.originalname.toLowerCase().endsWith('.csv');
    const result = isCSV ? svc.importSubiektCsv(buf, columnMap) : svc.importSubiektExcel(buf, columnMap);
    fs.unlink(req.file.path, () => {});
    res.json({ success: true, ...result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/subiekt/column-map', (req, res) => {
  try { res.json(svc.getColumnMap()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/subiekt', (req, res) => {
  try {
    withDataDir(req);
    const result = svc.clearSubiektData();
    res.json({ ok: true, message: 'Dane Subiekta usuniete' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Elko helpers (no supplier id needed) ────────────────────────────────────

// POST /api/sourcing/elko/test  — test Elko API key connectivity
router.post('/elko/test', async (req, res) => {
  try {
    const apiKey = req.body && req.body.api_key;
    if (!apiKey) return res.status(400).json({ ok: false, message: 'Brak klucza API' });
    const result = await svc.testElkoApi(apiKey);
    res.json(result);
  } catch(e) { res.status(400).json({ ok: false, message: e.message }); }
});

// ─── Suppliers ────────────────────────────────────────────────────────────────

// GET /api/sourcing/preview-file — podgląd pierwszych 10 wierszy dowolnego pliku (Oczko)
router.get('/preview-file', async (req, res) => {
  try {
    withDataDir(req);
    const db = svc.getDb();
    const sid = req.query.sid ? parseInt(req.query.sid) : null;
    const fid = req.query.fid ? parseInt(req.query.fid) : null;
    
    let filePath = null;
    let url = null;
    let urlUser = null;
    let urlPass = null;
    if (fid) {
      const f = db.prepare('SELECT * FROM supplier_files WHERE id = ?').get(fid);
      if (!f) return res.status(404).json({error:'Nie znaleziono pliku dodatkowego'});
      filePath = f.file_path;
      url = f.source_url;
      const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(f.supplier_id);
      if (s) {
        urlUser = s.url_user;
        urlPass = s.url_pass;
      }
    } else if (sid) {
      const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(sid);
      if (!s) return res.status(404).json({error:'Nie znaleziono hurtowni'});
      filePath = s.file_path;
      url = s.source_url;
      urlUser = s.url_user;
      urlPass = s.url_pass;
    } else {
      return res.status(400).json({error:'Wymagane sid lub fid'});
    }
    
    const uploadsDir = path.join(svc._getEffectiveDataDir(), 'sourcing_uploads');
    if (!filePath || !fs.existsSync(filePath)) {
       let basename = url ? encodeURIComponent(url).slice(-40) : (sid ? `sup_${sid}` : null);
       const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
       const matched = files.find(fn => fn.includes(basename) || (fid && fn.includes(`file_${fid}`)));
       if (matched) filePath = path.join(uploadsDir, matched);
    }
    
    let buf;
    let ext;

    if (!filePath || !fs.existsSync(filePath)) {
       if (url) {
         try {
           const axios = require('axios');
           const config = { responseType: 'arraybuffer', timeout: 30000 };
           if (urlUser && urlPass) {
             config.auth = { username: urlUser, password: urlPass };
           }
           const resp = await axios.get(url, config);
           buf = Buffer.from(resp.data);
           ext = path.extname(url.split('?')[0]).toLowerCase() || '.xml';
         } catch(e) {
           return res.status(404).json({error: 'Nie można pobrać pliku z URL: ' + e.message});
         }
       } else {
         return res.status(404).json({error: 'Plik nie istnieje na dysku i brak URL. Pobierz go lub odśwież.'});
       }
    } else {
       buf = fs.readFileSync(filePath);
       ext = path.extname(filePath).toLowerCase() || (url ? path.extname(url.split('?')[0]).toLowerCase() : '.csv');
    }
    
    let previewData;
    if (ext === '.xlsx' || ext === '.xls') {
       previewData = svc.previewExcel(buf);
    } else if (ext === '.xml') {
       const snippet = buf.slice(0, 3000).toString('utf-8').replace(/</g, '&lt;').replace(/>/g, '&gt;');
       previewData = { columns: ['XML Podgląd'], preview: [[`<pre style="white-space:pre-wrap;font-size:0.75rem">${snippet}...</pre>`]] };
    } else {
       previewData = svc.previewCsv(buf);
    }
    
    res.json(previewData);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

// GET /api/sourcing/suppliers/:id/file-preview — podgląd nagłówków pliku hurtowni (debug)
router.get('/suppliers/:id/file-preview', (req, res) => {
  try {
    withDataDir(req);
    const db = svc.getDb();
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(parseInt(req.params.id));
    if (!supplier) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });
    if (!supplier.file_path || !fs.existsSync(supplier.file_path)) {
      return res.json({ error: 'Brak pliku na dysku. Wgraj plik lub użyj FTP/URL.', supplier_name: supplier.name });
    }

    const buf = fs.readFileSync(supplier.file_path);
    const iconv = require('iconv-lite');

    // Detect encoding
    let str, encoding = 'utf-8';
    if (buf[0] === 0xFF && buf[1] === 0xFE) { str = buf.slice(2).toString('utf16le'); encoding = 'utf-16le'; }
    else if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) { str = buf.slice(3).toString('utf-8'); encoding = 'utf-8 bom'; }
    else {
      const utf8 = buf.toString('utf-8');
      const badRatio = (utf8.match(/\uFFFD/g) || []).length / Math.max(utf8.length, 1);
      if (badRatio > 0.005) { str = iconv.decode(buf, 'win1250'); encoding = 'windows-1250'; }
      else { str = utf8; }
    }

    const lines = str.split(/\r?\n/).filter(l => l.trim()).slice(0, 6);
    const firstLine = lines[0] || '';

    // Detect separator
    const tabCount   = (firstLine.match(/\t/g) || []).length;
    const pipeCount  = (firstLine.match(/\|/g) || []).length;
    const semiCount  = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    let sep, sepName;
    if (tabCount >= 2 && tabCount >= semiCount && tabCount >= commaCount) { sep = '\t'; sepName = 'TAB'; }
    else if (pipeCount >= 2 && pipeCount >= semiCount && pipeCount >= commaCount) { sep = '|'; sepName = 'PIPE'; }
    else if (semiCount >= commaCount) { sep = ';'; sepName = 'SEMICOLON'; }
    else { sep = ','; sepName = 'COMMA'; }

    const splitLine = l => sep === '\t'
      ? l.split('\t').map(c => c.trim())
      : l.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));

    const headers  = splitLine(lines[0]);
    const rows     = lines.slice(1, 4).map(l => splitLine(l));

    res.json({
      supplier_name: supplier.name,
      file_path: supplier.file_path,
      file_size_kb: Math.round(buf.length / 1024),
      encoding, separator: sepName,
      total_columns: headers.length,
      headers,
      sample_rows: rows,
      tip: 'Sprawdź czy kolumny EAN, Cena i Nazwa są widoczne w headers[]'
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/suppliers', (req, res) => {
  try { res.json(svc.listSuppliers()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/suppliers', (req, res, next) => upload.single('file')(req, res, err => err ? handleMulterError(err, req, res, next) : next()), async (req, res) => {
  try {
    const { name, source_type, source_url, currency, exchange_rate,
            ftp_host, ftp_user, ftp_pass, ftp_path, ftp_port, ftp_secure,
            url_user, url_pass, elko_api_key, elko_vendor_codes,
            ntt_client_id, ntt_client_secret, ntt_user_id,
            action_customer_id, action_user_name, action_api_key } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa hurtowni jest wymagana' });
    if (!['url', 'file', 'ftp', 'elko_api', 'impakt_api', 'ntt_api', 'action_api'].includes(source_type)) return res.status(400).json({ error: 'Nieprawidłowy typ źródła' });

    let fileCreatedAt = null;
    let fileSizeBytes = 0;
    if (req.file) {
      try {
        const stat = fs.statSync(req.file.path);
        fileCreatedAt = (stat.birthtime || stat.mtime).toISOString();
        fileSizeBytes = req.file.size || stat.size || 0;
      } catch(_) {}
    }

    const id = svc.addSupplier({
      name, source_type,
      source_url:      source_type === 'url'  ? source_url  : null,
      file_path:       source_type === 'file' && req.file ? req.file.path : null,
      file_created_at: fileCreatedAt,
      file_size_bytes: fileSizeBytes,
      currency:        currency || 'PLN',
      exchange_rate:   parseFloat(exchange_rate) || 1,
      ftp_host:  ftp_host  ? ftp_host.replace(/^(s?ftps?|sftp):\/\//i, '').replace(/\/+$/, '') : null,
      ftp_user:  ftp_user  || null,
      ftp_pass:  ftp_pass  || null,
      ftp_path:  ftp_path  || null,
      ftp_port:  parseInt(ftp_port) || 21,
      ftp_secure: ftp_secure === 'true' || ftp_secure === '1' ? 1 : 0,
      url_user:  source_type === 'url' ? (url_user || null) : null,
      url_pass:  source_type === 'url' ? (url_pass || null) : null,
      elko_api_key:      elko_api_key || null,
      elko_vendor_codes: elko_vendor_codes || null,
      impakt_user:       req.body.impakt_user || null,
      impakt_pass:       req.body.impakt_pass || null,
      impakt_api_url:    req.body.impakt_api_url || null,
      ntt_client_id:     ntt_client_id || null,
      ntt_client_secret: ntt_client_secret || null,
      ntt_user_id:       ntt_user_id || null,
      action_customer_id: action_customer_id || null,
      action_user_name:   action_user_name || null,
      action_api_key:     action_api_key || null,
    });

    if (source_type === 'url' && source_url) {
      try { await svc.refreshSupplier(id); } catch (re) { console.warn('[sourcing] refresh warning:', re.message); }
    }
    if (source_type === 'ftp') {
      try { await svc.refreshSupplier(id); } catch (re) { console.warn('[sourcing] FTP refresh warning:', re.message); }
    }
    if (source_type === 'elko_api' && elko_api_key) {
      try { await svc.refreshSupplier(id); } catch (re) { console.warn('[sourcing] Elko API refresh warning:', re.message); }
    }
    if (source_type === 'impakt_api') {
      try { await svc.refreshSupplier(id); } catch (re) { console.warn('[sourcing] Impakt API refresh warning:', re.message); }
    }
    if (source_type === 'ntt_api') {
      try { await svc.refreshSupplier(id); } catch (re) { console.warn('[sourcing] NTT API refresh warning:', re.message); }
    }
    if (source_type === 'action_api' && action_api_key) {
      try { await svc.refreshSupplier(id); } catch (re) { console.warn('[sourcing] Action API refresh warning:', re.message); }
    }
    if (source_type === 'file' && req.file) {
      try {
        const buf = fs.readFileSync(req.file.path);
        await svc.refreshSupplier(id, buf);
      } catch (re) { console.warn('[sourcing] refresh warning:', re.message); }
    }

    // Invalidate route cache so compare/promotions/deals reflect fresh data
    clearCache();

    res.json({ success: true, id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/sourcing/suppliers/:id
router.patch('/suppliers/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, currency, exchange_rate, col_settings,
            ftp_host, ftp_user, ftp_pass, ftp_path, ftp_port, ftp_secure,
            url_user, url_pass, is_active, source_url,
            ntt_client_id, ntt_client_secret, ntt_user_id,
            action_customer_id, action_user_name, action_api_key } = req.body;
            
    console.log(`PATCH /suppliers/${id} received:`, req.body);
    
    const fields = {};
    if (name           !== undefined) fields.name           = name;
    if (currency       !== undefined) fields.currency       = currency;
    if (exchange_rate  !== undefined) fields.exchange_rate  = parseFloat(exchange_rate) || 1;
    if (col_settings   !== undefined) fields.col_settings   = typeof col_settings === 'string' ? col_settings : JSON.stringify(col_settings);
    if (source_url     !== undefined) fields.source_url     = source_url;
    if (ftp_host       !== undefined) fields.ftp_host       = ftp_host.replace(/^(s?ftps?|sftp):\/\//i, '').replace(/\/+$/, '');
    if (ftp_user       !== undefined) fields.ftp_user       = ftp_user;
    if (ftp_pass       !== undefined) fields.ftp_pass       = ftp_pass;
    if (ftp_path       !== undefined) fields.ftp_path       = ftp_path;
    if (ftp_port       !== undefined) fields.ftp_port       = parseInt(ftp_port) || 21;
    if (ftp_secure     !== undefined) fields.ftp_secure     = ftp_secure ? 1 : 0;
    if (url_user       !== undefined) fields.url_user       = url_user;
    if (url_pass       !== undefined) fields.url_pass       = url_pass;
    if (ntt_client_id     !== undefined) fields.ntt_client_id     = ntt_client_id;
    if (ntt_client_secret !== undefined) fields.ntt_client_secret = ntt_client_secret;
    if (ntt_user_id       !== undefined) fields.ntt_user_id       = ntt_user_id;
    if (action_customer_id!== undefined) fields.action_customer_id= action_customer_id;
    if (action_user_name  !== undefined) fields.action_user_name  = action_user_name;
    if (action_api_key    !== undefined) fields.action_api_key    = action_api_key;
    if (is_active      !== undefined) fields.is_active      = is_active ? 1 : 0;
    svc.updateSupplier(id, fields);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/suppliers/:id/test-ftp
router.post('/suppliers/:id/test-ftp', async (req, res) => {
  try {
    const list = svc.listSuppliers();
    const sup = list.find(s => s.id === parseInt(req.params.id));
    if (!sup) return res.status(404).json({ error: 'Nie znaleziono hurtowni' });
    const buf = await svc._fetchFtpFile(sup);
    res.json({ success: true, bytes: buf.length });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// POST /api/sourcing/suppliers/:id/test-elko — diagnose Elko API connectivity
router.post('/suppliers/:id/test-elko', async (req, res) => {
  try {
    const list = svc.listSuppliers();
    const sup = list.find(s => s.id === parseInt(req.params.id));
    const apiKey = (req.body && req.body.api_key) || (sup && sup.elko_api_key);
    if (!apiKey) return res.status(400).json({ error: 'Brak klucza API' });
    const result = await svc.testElkoApi(apiKey);
    res.json(result);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// POST /api/sourcing/suppliers/:id/test-impakt — test Impakt API connectivity
router.post('/suppliers/:id/test-impakt', async (req, res) => {
  try {
    const list = svc.listSuppliers();
    const sup = list.find(s => s.id === parseInt(req.params.id));
    const user = (req.body && req.body.user) || (sup && sup.impakt_user);
    const pass = (req.body && req.body.pass) || (sup && sup.impakt_pass);
    const apiUrl = (req.body && req.body.api_url) || (sup && sup.impakt_api_url);
    const result = await svc.testImpaktApi(apiUrl, user, pass);
    res.json(result);
  } catch(e) { res.status(400).json({ ok: false, message: e.message }); }
});

// POST /api/sourcing/suppliers/:id/test-ntt — test NTT API connectivity
router.post('/suppliers/:id/test-ntt', async (req, res) => {
  try {
    const list = svc.listSuppliers();
    const sup = list.find(s => s.id === parseInt(req.params.id));
    const clientId = (req.body && req.body.client_id) || (sup && sup.ntt_client_id);
    const clientSecret = (req.body && req.body.client_secret) || (sup && sup.ntt_client_secret);
    const userId = (req.body && req.body.user_id) || (sup && sup.ntt_user_id);
    const result = await svc.testNTTApi(clientId, clientSecret, userId);
    res.json(result);
  } catch(e) { res.status(400).json({ ok: false, message: e.message }); }
});

// POST /api/sourcing/suppliers/:id/elko-brand-file — upload Excel for a specific brand
router.post('/suppliers/:id/elko-brand-file', (req, res, next) => upload.single('file')(req, res, err => err ? handleMulterError(err, req, res, next) : next()), async (req, res) => {
  try {
    const supplier_id = parseInt(req.params.id);
    const { brand_key, brand_name } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
    if (!brand_key) return res.status(400).json({ error: 'Brak nazwy marki (brand_key)' });

    // Check if file for this brand already exists — replace if yes
    const existing = svc.listSupplierFiles(supplier_id).find(f => f.label === `Elko: ${brand_name || brand_key}`);
    if (existing) {
      // Delete old file from disk
      if (existing.file_path && existing.file_path !== req.file.path) {
        try { fs.unlinkSync(existing.file_path); } catch(_) {}
      }
      svc.updateSupplierFile(existing.id, {
        file_path: req.file.path,
        source_type: 'file',
        file_type: 'full',
      });
      // Refresh this brand's data
      const { products } = await svc.refreshOneSupplierFile(existing.id);
      // Re-run full supplier refresh to merge all brands
      let warning = null;
      try { await svc.refreshSupplier(supplier_id); } catch (e) { warning = e.message; console.warn('[sourcing] Elko merge after brand file:', e.message); }
      return res.json({ success: true, id: existing.id, replaced: true, imported: products.length, warning });
    }

    // New brand file
    const sfId = svc.addSupplierFile({
      supplier_id,
      label: `Elko: ${brand_name || brand_key}`,
      file_type: 'full',
      source_type: 'file',
      file_path: req.file.path,
    });
    // Parse and merge
    const { products } = await svc.refreshOneSupplierFile(sfId);
    let warning = null;
    try { await svc.refreshSupplier(supplier_id); } catch (e) { warning = e.message; console.warn('[sourcing] Elko merge after brand file:', e.message); }
    res.json({ success: true, id: sfId, replaced: false, imported: products.length, warning });
  } catch(e) { res.status(400).json({ error: e.message }); }
});


// POST /api/sourcing/suppliers/:id/replace-file
router.post('/suppliers/:id/replace-file', upload.single('file'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
    svc.replaceSupplierFile(id, req.file.path);
    // Save file size
    const fileSize = req.file.size || fs.statSync(req.file.path).size;
    svc.updateSupplier(id, { file_size_bytes: fileSize, file_created_at: new Date().toISOString() });
    const buf = fs.readFileSync(req.file.path);
    const result = await svc.refreshSupplier(id, buf);
    res.json({ success: true, ...result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/sourcing/suppliers/:id
router.delete('/suppliers/:id', (req, res) => {
  try { svc.deleteSupplier(parseInt(req.params.id)); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/suppliers/:id/refresh
router.post('/suppliers/:id/refresh', upload.single('file'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let buf = null;
    if (req.file) buf = fs.readFileSync(req.file.path);

    // Check if this is an Action API supplier (needs long-running SSE)
    const supplier = svc.getDb().prepare('SELECT source_type FROM suppliers WHERE id = ?').get(id);
    const isActionApi = supplier && supplier.source_type === 'action_api';

    if (isActionApi) {
      // SSE stream for Action API — prevents HTTP timeout on large catalogs
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const send = (data) => {
        try { res.write('data: ' + JSON.stringify(data) + '\n\n'); } catch(_) {}
      };

      send({ status: 'start', message: 'Rozpoczynam synchronizację Action API...' });

      try {
        const result = await svc.refreshSupplier(id, buf, (progress) => {
          send({ status: 'progress', ...progress });
        });
        if (req.file) fs.unlink(req.file.path, () => {});
        send({ status: 'done', success: true, ...result });
      } catch (e) {
        send({ status: 'error', error: e.message, code: e.code });
      }
      res.end();
    } else {
      // Normal synchronous JSON response for fast suppliers
      const result = await svc.refreshSupplier(id, buf);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.json({ success: true, ...result });
    }
  } catch (e) {
    const status = e.code === 'REFRESH_IN_PROGRESS' ? 409 : 400;
    res.status(status).json({ error: e.message, code: e.code || null });
  }
});


// POST /api/sourcing/suppliers/refresh-all
router.post('/suppliers/refresh-all', async (req, res) => {
  try {
    const results = await svc.refreshAllSuppliers();
    res.json({ success: true, results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/suppliers/manufacturers
router.get('/suppliers/manufacturers', (req, res) => {
  try {
    const supplier_id = req.query.supplier_id ? parseInt(req.query.supplier_id) : null;
    res.json(svc.listManufacturers(supplier_id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Manufacturer Aliases (normalization) ─────────────────────────────────────

// GET /api/sourcing/manufacturer-aliases
router.get('/manufacturer-aliases', (req, res) => {
  try { res.json(svc.listMfgAliases()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/manufacturer-aliases
router.post('/manufacturer-aliases', (req, res) => {
  try {
    const { alias, canonical_name } = req.body;
    res.json(svc.addMfgAlias(alias, canonical_name));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/sourcing/manufacturer-aliases/:id
router.delete('/manufacturer-aliases/:id', (req, res) => {
  try { res.json(svc.deleteMfgAlias(parseInt(req.params.id))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/manufacturer-aliases/suggest — auto-detect duplicates
router.get('/manufacturer-aliases/suggest', (req, res) => {
  try { res.json(svc.suggestMfgAliases()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/manufacturers/merge — deep merge manufacturers
router.post('/manufacturers/merge', (req, res) => {
  try {
    const { aliases, canonical_name } = req.body;
    res.json(svc.mergeManufacturers(aliases, canonical_name));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Attribute Aliases (normalization) ─────────────────────────────────────

// GET /api/sourcing/attr-aliases
router.get('/attr-aliases', (req, res) => {
  try { res.json(svc.listAttrAliases()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/attr-aliases
router.post('/attr-aliases', (req, res) => {
  try {
    const { alias, canonical_name } = req.body;
    res.json(svc.addAttrAlias(alias, canonical_name));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/sourcing/attr-aliases/:id
router.delete('/attr-aliases/:id', (req, res) => {
  try { res.json(svc.deleteAttrAlias(parseInt(req.params.id))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/attr-aliases/merge
router.post('/attr-aliases/merge', (req, res) => {
  try {
    const { aliases, canonical_name } = req.body;
    res.json(svc.mergeAttrAliases(aliases, canonical_name));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Attribute Manager (Advanced) ──────────────────────────────────────────

// GET /api/sourcing/attrs/manager/list
router.get('/attrs/manager/list', (req, res) => {
  try {
    const { categoryId, supplierId, onlyAvailable } = req.query;
    res.json(svc.getAttrManagerList(
      categoryId ? parseInt(categoryId) : null,
      supplierId ? parseInt(supplierId) : null,
      onlyAvailable === 'true'
    ));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/attrs/manager/:name/details
router.get('/attrs/manager/:name/details', (req, res) => {
  try {
    const { supplierId, onlyAvailable } = req.query;
    res.json(svc.getAttrManagerDetails(
      req.params.name,
      supplierId ? parseInt(supplierId) : null,
      onlyAvailable === 'true'
    ));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/attrs/manager/suggest
router.get('/attrs/manager/suggest', (req, res) => {
  try {
    res.json(svc.getAttrManagerSuggestions());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/attrs/manager/merge
router.post('/attrs/manager/merge', (req, res) => {
  try {
    const { aliases, canonical_name } = req.body;
    res.json(svc.mergeManagerAttributes(aliases, canonical_name));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/sourcing/attrs/manager/unit
router.patch('/attrs/manager/unit', (req, res) => {
  try {
    const { categoryId, attrName, unit } = req.body;
    if (!categoryId || !attrName) return res.status(400).json({ error: 'Brak categoryId lub attrName' });
    res.json(svc.updateCategoryAttrUnit(parseInt(categoryId), attrName, unit));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Supplier Files (multi-file per wholesaler) ───────────────────────────────

// GET /api/sourcing/suppliers/:id/files
router.get('/suppliers/:id/files', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    res.json(svc.listSupplierFiles(id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/suppliers/:id/files — add file (upload or url)
router.post('/suppliers/:id/files', (req, res, next) => upload.single('file')(req, res, err => err ? handleMulterError(err, req, res, next) : next()), async (req, res) => {
  try {
    const supplier_id = parseInt(req.params.id);
    const { label, file_type, source_type, source_url } = req.body;

    if (!['full', 'stock_price'].includes(file_type)) {
      return res.status(400).json({ error: 'file_type musi byc "full" lub "stock_price"' });
    }
    if (!['url', 'file'].includes(source_type)) {
      return res.status(400).json({ error: 'source_type musi byc "url" lub "file"' });
    }
    if (source_type === 'url' && !source_url) {
      return res.status(400).json({ error: 'Podaj URL dla pliku dodatkowego' });
    }
    if (source_type === 'file' && !req.file) {
      return res.status(400).json({ error: 'Brak pliku do wgrania' });
    }

    const sfId = svc.addSupplierFile({
      supplier_id,
      label:       label || 'Plik dodatkowy',
      file_type:   file_type || 'stock_price',
      source_type: source_type || 'file',
      source_url:  source_type === 'url' ? source_url : null,
      file_path:   source_type === 'file' && req.file ? req.file.path : null,
    });

    res.json({ success: true, id: sfId });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/sourcing/suppliers/:id/files/:fid
router.patch('/suppliers/:id/files/:fid', (req, res) => {
  try {
    const fid = parseInt(req.params.fid);
    const { label, file_type, source_url } = req.body;
    const fields = {};
    if (label !== undefined)     fields.label = label;
    if (file_type !== undefined) fields.file_type = file_type;
    if (source_url !== undefined) fields.source_url = source_url;
    svc.updateSupplierFile(fid, fields);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/sourcing/suppliers/:id/files/:fid
router.delete('/suppliers/:id/files/:fid', (req, res) => {
  try {
    svc.deleteSupplierFile(parseInt(req.params.fid));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/suppliers/:id/files/:fid/refresh
router.post('/suppliers/:id/files/:fid/refresh', (req, res, next) => upload.single('file')(req, res, err => err ? handleMulterError(err, req, res, next) : next()), async (req, res) => {
  try {
    const fid = parseInt(req.params.fid);
    // If new file uploaded, replace the stored path first
    if (req.file) {
      svc.updateSupplierFile(fid, { file_path: req.file.path, source_type: 'file' });
    }
    const { products } = await svc.refreshOneSupplierFile(fid);
    let imported = products.length;
    let warning = null;
    try {
      const merged = await svc.refreshSupplier(parseInt(req.params.id));
      imported = merged.imported;
    } catch (e) {
      warning = e.message;
      console.warn('[sourcing] catalog rebuild after extra file:', e.message);
    }
    res.json({ success: true, imported, warning });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─── Schedule Management ──────────────────────────────────────────────────────

// GET /api/sourcing/suppliers/:id/files/:fid/schedule
router.get('/suppliers/:id/files/:fid/schedule', (req, res) => {
  try {
    const fid = parseInt(req.params.fid);
    const f = svc.getDb().prepare("SELECT schedule_enabled, schedule_cron, last_scheduled_run FROM supplier_files WHERE id = ?").get(fid);
    if (!f) return res.status(404).json({ error: 'Plik nie znaleziony' });
    res.json(f);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/sourcing/suppliers/:id/files/:fid/schedule
router.patch('/suppliers/:id/files/:fid/schedule', (req, res) => {
  try {
    const fid = parseInt(req.params.fid);
    const { enabled, cron } = req.body;
    svc.getDb().prepare("UPDATE supplier_files SET schedule_enabled = ?, schedule_cron = ? WHERE id = ?").run(enabled ? 1 : 0, cron || null, fid);
    try {
      require('../services/schedulerService').reloadFileSchedule(fid);
    } catch(err) { console.error(err); }
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/sourcing/suppliers/:id/schedule
router.get('/suppliers/:id/schedule', (req, res) => {
  try {
    const id   = parseInt(req.params.id);
    const list = svc.listSuppliers();
    const sup  = list.find(s => s.id === id);
    if (!sup) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });
    const { getActiveJobs } = require('../services/schedulerService');
    res.json({
      schedule_cron:       sup.schedule_cron || '',
      schedule_enabled:    !!sup.schedule_enabled,
      last_scheduled_run:  sup.last_scheduled_run || null,
      is_active:           getActiveJobs().includes(id),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/sourcing/suppliers/:id/schedule
router.patch('/suppliers/:id/schedule', (req, res) => {
  try {
    const id   = parseInt(req.params.id);
    const { cron_expr, enabled } = req.body;

    // Validate cron expression if provided and not empty
    if (cron_expr !== undefined && cron_expr !== '') {
      const { isValidCron } = require('../services/schedulerService');
      if (!isValidCron(cron_expr)) {
        return res.status(400).json({ error: `Nieprawidłowe wyrażenie CRON: "${cron_expr}"` });
      }
    }

    svc.setSupplierSchedule(id, { cron_expr, enabled });

    // Reload the cron job for this supplier
    const { reloadSchedule } = require('../services/schedulerService');
    reloadSchedule(id);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Data & Mapping ─────────────────────────────────────────────────────────────

// GET /api/sourcing/suppliers/:id/products
router.get('/suppliers/:id/products', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || '';
    
    const manufacturer = req.query.manufacturer || '';
    const availability = req.query.availability || '';
    
    const db = svc.getDb();
    let where = 'supplier_id = ?';
    let params = [id];
    
    if (search) {
      where += ' AND (ean LIKE ? OR manufacturer_code LIKE ? OR name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (manufacturer) {
      where += ' AND manufacturer = ?';
      params.push(manufacturer);
    }
    if (availability) {
      where += ' AND availability = ?';
      params.push(availability);
    }
    
    const totalRow = db.prepare(`SELECT COUNT(*) as c FROM supplier_products WHERE ${where}`).get(...params);
    const total = totalRow ? totalRow.c : 0;
    
    const offset = (page - 1) * limit;
    const rows = db.prepare(`SELECT ean, manufacturer_code, price, stock_quantity as stock, name, manufacturer, availability FROM supplier_products WHERE ${where} ORDER BY name ASC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    
    const mfgs = db.prepare("SELECT DISTINCT manufacturer FROM supplier_products WHERE supplier_id=? AND manufacturer IS NOT NULL AND manufacturer != '' ORDER BY manufacturer").all(id).map(r => r.manufacturer);
    
    res.json({ products: rows, total, page, limit, manufacturers: mfgs });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sourcing/suppliers/:id/mapping
router.get('/suppliers/:id/mapping', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const db = svc.getDb();
    const sup = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!sup) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });
    
    const rows = db.prepare('SELECT attributes FROM supplier_products WHERE supplier_id = ? LIMIT 200').all(id);
    const fields = new Set();
    const sampleRows = {};
    
    // Zgodnie z nową architekturą (MDM), surowe atrybuty z XML/API nie są już mapowane w panelu hurtowni.
    // Mapujemy tylko podstawowe kolumny dla plików CSV/Excel.

    // 2. If no attributes found, try reading headers from the actual file (CSV/Excel)
    if (fields.size === 0) {
      const fp = sup.file_path;
      // Also check FTP cached files
      let filePath = fp;
      if (!filePath || !fs.existsSync(filePath)) {
        // Look for url/ftp cache file
        const uploadsDir = path.join(__dirname, '../../data/sourcing_uploads');
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir)
            .filter(f => f.startsWith(`url_${id}_`) || f.startsWith(`ftp_${id}_`))
            .sort().reverse();
          if (files.length > 0) {
            filePath = path.join(uploadsDir, files[0]);
          }
        }
      }
      
      if (filePath && fs.existsSync(filePath)) {
        try {
          const ext = path.extname(filePath).toLowerCase();
          if (ext === '.xlsx' || ext === '.xls') {
            const XLSX = require('xlsx');
            const wb = XLSX.readFile(filePath, { sheetRows: 15 });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows2 = require('xlsx').utils.sheet_to_json(ws, { header: 1, range: 0 });
            if (rows2.length > 0) {
              const headers = rows2[0] || [];
              headers.forEach((h, i) => {
                if (h) {
                  const cleaned = String(h);
                  fields.add(cleaned);
                  if (!sampleRows[cleaned]) sampleRows[cleaned] = new Set();
                  for(let r=1; r<Math.min(rows2.length, 12); r++) {
                    const val = rows2[r][i];
                    if (val !== undefined && val !== null && String(val).trim() !== '') {
                      if (sampleRows[cleaned].size < 10) sampleRows[cleaned].add(String(val).trim());
                    }
                  }
                }
              });
            }
          } else if (ext === '.csv' || ext === '.txt') {
            // Read first line as headers
            const buf = fs.readFileSync(filePath);
            const iconv = require('iconv-lite');
            const raw = iconv.decode(buf.slice(0, 8192), 'win1250');
            const lines = raw.split('\n');
            const firstLine = lines[0];
            // Detect delimiter
            const delim = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';
            const headers = firstLine.split(delim).map(h => h.trim().replace(/^"|"$/g, ''));
            
            headers.forEach((h, i) => {
              const cleaned = h || `Kolumna_${i+1}`;
              fields.add(cleaned);
              if (!sampleRows[cleaned]) sampleRows[cleaned] = new Set();
              for(let r=1; r<Math.min(lines.length, 12); r++) {
                if(!lines[r]) continue;
                const vals = lines[r].split(delim).map(v => v.trim().replace(/^"|"$/g, ''));
                const val = vals[i];
                if (val !== undefined && val !== null && String(val).trim() !== '') {
                  if (sampleRows[cleaned].size < 10) sampleRows[cleaned].add(String(val).trim());
                }
              }
            });
          }
        } catch(ex) { console.error('Mapping file read error:', ex.message); }
      }
    }
    
    const colSettings = (() => { try { return JSON.parse(sup.col_settings || '{}'); } catch { return {}; } })();
    
    // Convert Set back to Array for JSON response
    const sampleRowObj = {};
    for (const [k, vSet] of Object.entries(sampleRows)) {
      sampleRowObj[k] = Array.from(vSet);
    }
    
    res.json({
      fields: Array.from(fields).sort(),
      sampleRow: sampleRowObj,
      fallbackProduct: db.prepare('SELECT * FROM supplier_products WHERE supplier_id=? LIMIT 1').get(id) || {},
      colSettings: colSettings,
      source_type: sup.source_type,
      total_products: db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id=?').get(id)?.c || 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/sourcing/suppliers/:id/mapping
router.post('/suppliers/:id/mapping', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const db = svc.getDb();
    const sup = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    if (!sup) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });
    
    const newSettings = req.body.colSettings || {};
    db.prepare('UPDATE suppliers SET col_settings = ? WHERE id = ?').run(JSON.stringify(newSettings), id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── In-memory response cache (2 min TTL) ─────────────────────────────────────
const _routeCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
function getCached(key) {
  const entry = _routeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _routeCache.delete(key); return null; }
  return entry.data;
}
function setCached(key, data) { _routeCache.set(key, { data, ts: Date.now() }); }
function clearCache() { _routeCache.clear(); }

// Expose cache clear so other routes (e.g. after supplier refresh) can call it
router._clearSourcingCache = clearCache;

router.post('/cache/clear', (req, res) => {
  clearCache();
  res.json({ ok: true, cleared: true });
});

// ─── Comparison ───────────────────────────────────────────────────────────────

router.get('/compare', (req, res) => {
  try {
    const onlyAvailable = req.query.onlyAvailable === 'true';
    const minSavingsPct = req.query.minSavingsPct ? parseFloat(req.query.minSavingsPct) : null;
    const search        = req.query.search || '';
    const manufacturer  = req.query.manufacturer || '';
    const supplier_id   = req.query.supplier_id || null;
    const limit         = req.query.limit != null && req.query.limit !== '' ? parseInt(req.query.limit, 10) : null;
    const offset        = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const sortCol       = req.query.sortCol || null;
    const sortAsc       = req.query.sortAsc !== 'false' && req.query.sortAsc !== '0';
    const cacheKey = `compare:${onlyAvailable}:${minSavingsPct}:${search}:${manufacturer}:${supplier_id}:${limit}:${offset}:${sortCol}:${sortAsc}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, _cached: true });
    const result = svc.buildComparison({ onlyAvailable, minSavingsPct, search, manufacturer, supplier_id, limit, offset, sortCol, sortAsc });
    setCached(cacheKey, result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/compare/export', (req, res) => {
  try {
    const onlyAvailable = req.query.onlyAvailable === 'true';
    const minSavingsPct = req.query.minSavingsPct ? parseFloat(req.query.minSavingsPct) : null;
    const search        = req.query.search || '';
    const csv = svc.exportComparisonCsv({ onlyAvailable, minSavingsPct, search });
    const fn  = `sourcing_${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
    res.send('\uFEFF' + csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Promotions ───────────────────────────────────────────────────────────────

router.get('/promotions', (req, res) => {
  try {
    const threshold     = req.query.threshold ? parseFloat(req.query.threshold) : 10;
    const onlyAvailable = req.query.onlyAvailable === 'true';
    const search        = req.query.search || '';
    const cacheKey = `promotions:${threshold}:${onlyAvailable}:${search}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, _cached: true });
    const result = svc.buildPromotions({ threshold, onlyAvailable, search });
    setCached(cacheKey, result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/promotions/export', (req, res) => {
  try {
    const threshold     = req.query.threshold ? parseFloat(req.query.threshold) : 10;
    const onlyAvailable = req.query.onlyAvailable === 'true';
    const search        = req.query.search || '';
    const data = svc.buildPromotions({ threshold, onlyAvailable, search });
    const rows = Array.isArray(data) ? data : (data.rows || []);
    const header = 'EAN;Nazwa;Super cena;Hurtownia;Cena ref.;Odnosnik;Oszcz. %;Dostepnosc;W Subiekcie;Stan;Cena sprzedazy';
    const lines = [header, ...rows.map(r => [
      r.ean, `"${(r.name||'').replace(/"/g,'""')}"`,
      r.best_price?.toFixed(2).replace('.',',') ?? '',
      `"${r.best_supplier||''}"`,
      r.ref_price?.toFixed(2).replace('.',',') ?? '',
      `"${r.ref_label||''}"`,
      r.savings_pct?.toFixed(1).replace('.',',') ?? '',
      r.availability, r.in_subiekt?'Tak':'Nie',
      r.stock ?? '', r.sell_price?.toFixed(2).replace('.',',') ?? '',
    ].join(';'))];
    const fn = `promocje_${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="${fn}"`);
    res.send('\uFEFF' + lines.join('\r\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Super Ceny (Deals) ───────────────────────────────────────────────────────

router.get('/deals', (req, res) => {
  try {
    const threshold     = req.query.threshold ? parseFloat(req.query.threshold) : 50;
    const onlyAvailable = req.query.onlyAvailable === 'true';
    const search        = req.query.search || '';
    const inSubiekt     = req.query.inSubiekt || 'all';
    const cacheKey = `deals:${threshold}:${onlyAvailable}:${search}`;
    const cached = getCached(cacheKey);
    let result;
    if (cached) {
      result = { ...cached, _cached: true };
    } else {
      result = svc.buildSuperDeals({ threshold, onlyAvailable, search });
      setCached(cacheKey, result);
    }
    if (inSubiekt !== 'all') {
      const wantInSubiekt = inSubiekt === 'yes';
      result = { ...result, rows: result.rows.filter(r => r.in_subiekt === wantInSubiekt) };
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/deals/export', (req, res) => {
  try {
    const threshold     = req.query.threshold ? parseFloat(req.query.threshold) : 50;
    const onlyAvailable = req.query.onlyAvailable === 'true';
    const search        = req.query.search || '';
    const onlyNew       = req.query.onlyNew === 'true';
    const inSubiekt     = req.query.inSubiekt || 'all';
    
    const data = svc.buildSuperDeals({ threshold, onlyAvailable, search });
    let rows = data.rows;
    if (onlyNew) {
      rows = rows.filter(r => r.is_new);
    }
    if (inSubiekt !== 'all') {
      const wantInSubiekt = inSubiekt === 'yes';
      rows = rows.filter(r => r.in_subiekt === wantInSubiekt);
    }

    const header = 'EAN;Nazwa;Hurtownia;Najlepsza cena;Cena ref.;Źródło odniesienia;Typ okazji;Zysk/Marża %;Dostępność;W Subiekcie;Stan;Cena sprzedaży;Nowość;Data dodania';
    const lines = [header, ...rows.map(r => [
      r.ean,
      `"${(r.name||'').replace(/"/g,'""')}"`,
      `"${r.best_supplier||''}"`,
      r.best_price?.toFixed(2).replace('.',',') ?? '',
      r.ref_price?.toFixed(2).replace('.',',') ?? '',
      `"${r.ref_label||''}"`,
      r.deal_type === 'Subiekt' ? 'Marża Subiekt' : 'Arbitraż hurtowni',
      r.savings_pct?.toFixed(1).replace('.',',') ?? '',
      r.availability === 'available' ? 'Dostępny' : (r.availability || ''),
      r.in_subiekt ? 'Tak' : 'Nie',
      r.stock ?? '',
      r.sell_price?.toFixed(2).replace('.',',') ?? '',
      r.is_new ? 'Tak' : 'Nie',
      r.first_seen_at || '',
    ].join(';'))];
    
    const fn = `super_ceny_${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="${fn}"`);
    res.send('\uFEFF' + lines.join('\r\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Missing Products ─────────────────────────────────────────────────────────

router.get('/missing', (req, res) => {
  try {
    const supplier_id  = req.query.supplier_id ? parseInt(req.query.supplier_id) : null;
    const search       = req.query.search || '';
    const availability = req.query.availability || '';
    const manufacturer = req.query.manufacturer || '';
    const limit        = req.query.limit  ? parseInt(req.query.limit)  : 500;
    const offset       = req.query.offset ? parseInt(req.query.offset) : 0;
    const result   = svc.getMissingProducts({ supplier_id, search, availability, manufacturer, limit, offset });
    const suppliers = svc.listSuppliers();
    const mfgs      = svc.listManufacturers(supplier_id);
    res.json({ ...result, suppliers, manufacturers: mfgs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Restock ──────────────────────────────────────────────────────────────────

router.get('/restock', (req, res) => {
  try {
    const supplierId   = req.query.supplier_id || null;
    const search       = req.query.search || '';
    const days         = req.query.days ? parseInt(req.query.days) : 30;
    const onlyNeeded   = req.query.onlyNeeded === 'true';
    const availability = req.query.availability || '';
    const manufacturer = req.query.manufacturer || '';
    const data    = svc.buildRestockList({ supplierId, search, days, onlyNeeded, availability, manufacturer });
    const suppliers   = svc.listSuppliers();
    const mfgs    = svc.listManufacturers();
    res.json({ ...data, suppliers, manufacturers: mfgs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/restock/override', (req, res) => {
  try {
    const { ean, qty } = req.body;
    if (!ean) return res.status(400).json({ error: 'Brak EAN' });
    svc.saveRestockOverride(ean, parseInt(qty) || 0);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/restock/export', (req, res) => {
  try {
    const supplierId = req.query.supplier_id || null;
    const days       = req.query.days ? parseInt(req.query.days) : 30;
    const onlyNeeded = req.query.onlyNeeded === 'true';
    const { groups } = svc.buildRestockList({ supplierId, days, onlyNeeded });
    const header = `Hurtownia;EAN;Nazwa;Producent;Stan;Sprzedaz 30d;Potrzeba (${days}d);Do zamowienia;Cena zakupu;Cena hurtowni;Dostepnosc`;
    const lines  = [header];
    for (const g of groups) {
      for (const r of g.rows) {
        lines.push([
          `"${g.supplier}"`, r.ean, `"${(r.name||'').replace(/"/g,'""')}"`,
          `"${(r.manufacturer||'')}"`,
          r.stock??0, r.sold_30d??0, r.needed_qty??0, r.suggested_qty??0,
          r.buy_price?.toFixed(2).replace('.',',')??'',
          r.best_price?.toFixed(2).replace('.',',')??'',
          r.availability,
        ].join(';'));
      }
    }
    const fn = `zamowienia_${days}d_${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="${fn}"`);
    res.send('\uFEFF' + lines.join('\r\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Listing Gap Analysis ──────────────────────────────────────────────────────

// POST /api/sourcing/listing/import
router.post('/listing/import', (req, res, next) => upload.single('file')(req, res, err => err ? handleMulterError(err, req, res, next) : next()), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
    const buf = fs.readFileSync(req.file.path);
    const result = svc.importListings(buf, req.file.originalname);
    fs.unlink(req.file.path, () => {});
    res.json({ success: true, ...result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/sourcing/listing — clear all listing data
router.delete('/listing', (req, res) => {
  try { res.json(svc.clearListings()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/listing/status
router.get('/listing/status', (req, res) => {
  try { res.json(svc.getListingStatus()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/listing/platforms
router.get('/listing/platforms', (req, res) => {
  try { res.json(svc.getListingPlatforms()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/listing/coverage
router.get('/listing/coverage', (req, res) => {
  try { res.json(svc.getListingCoverage()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/listing/gaps?missing_on=Allegro&present_on=&search=&limit=500&offset=0&sort=ean&asc=1&in_stock=true
router.get('/listing/gaps', (req, res) => {
  try {
    const result = svc.getListingGaps({
      missing_on: req.query.missing_on || '',
      present_on: req.query.present_on || '',
      search:     req.query.search   || '',
      limit:      parseInt(req.query.limit)  || 500,
      offset:     parseInt(req.query.offset) || 0,
      sort:       req.query.sort || '',
      asc:        req.query.asc !== '0',
      in_stock:   req.query.in_stock === 'true',
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/listing/gaps/export.csv
router.get('/listing/gaps/export.csv', (req, res) => {
  try {
    const { rows, platforms } = svc.getListingGaps({
      missing_on: req.query.missing_on || '',
      present_on: req.query.present_on || '',
      search:     req.query.search   || '',
      in_stock:   req.query.in_stock === 'true',
      limit:      9999, offset: 0,
    });
    const head = ['EAN','Nazwa','Stan','Spr.30d','C.zakupu','Wystawione na','Brakuje na'].join(';');
    const lines = [head, ...rows.map(r => [
      r.ean,
      `"${(r.name||'').replace(/"/g,'""')}"`,
      r.stock ?? '',
      r.sold_30d ?? '',
      r.buy_price ?? '',
      r.present_on.join(', '),
      r.missing_on.join(', '),
    ].join(';'))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="luki_wystawien.csv"');
    res.send('\uFEFF' + lines.join('\r\n'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Logs ─────────────────────────────────────────────────────────────────────

router.get('/logs', (req, res) => {
  try {
    const supplier_id = req.query.supplier_id ? parseInt(req.query.supplier_id) : null;
    const limit       = req.query.limit ? parseInt(req.query.limit) : 100;
    res.json(svc.getLogs({ supplier_id, limit }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Price History ──────────────────────────────────────────────────────────────

router.get('/price-history', (req, res) => {
  try {
    const ean = req.query.ean;
    const days = parseInt(req.query.days) || 30;
    if (!ean) return res.status(400).json({ error: 'Brak parametru ean' });
    res.json(svc.getPriceHistory(ean, days));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Catalog Master ───────────────────────────────────────────────────────────

const catalogSvc = require('../services/catalogService');

// GET /api/sourcing/catalog — przeglądanie zunifikowanego katalogu
router.get('/catalog', (req, res) => {
  try {
    const db = svc.getDb();
    // Parse multi-supplier filter
    let supplierIds = [];
    if (req.query.supplierIds) {
      try { supplierIds = JSON.parse(req.query.supplierIds); } catch { supplierIds = [req.query.supplierIds]; }
    }
    // Parse attribute filters: attrFilter[123]=value
    const attrFilters = {};
    for (const [key, val] of Object.entries(req.query)) {
      const m = key.match(/^attrFilter\[(\d+)\]$/);
      if (m && val) attrFilters[m[1]] = val;
    }
    const result = catalogSvc.searchCatalog(db, {
      search:       req.query.search || '',
      manufacturer: req.query.manufacturer || '',
      manufacturerSearch: req.query.manufacturerSearch || '',
      supplierName: req.query.supplier || '',
      supplierIds,
      page:         parseInt(req.query.page) || 1,
      limit:        parseInt(req.query.limit) || 50,
      sort:         req.query.sort || 'name',
      order:        req.query.order || 'asc',
      categoryId:   req.query.categoryId === 'unmapped' ? 'unmapped' : (req.query.categoryId ? parseInt(req.query.categoryId) : null),
      inSubiekt:    req.query.inSubiekt || null,
      availability: req.query.availability || null,
      condition:    req.query.condition || null,
      attrFilters,
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/catalog/stats — statystyki katalogu
router.get('/catalog/stats', (req, res) => {
  try {
    const ck = 'cat:stats';
    const cached = getCached(ck);
    if (cached) return res.json(cached);
    const db = svc.getDb();
    const result = catalogSvc.getCatalogStats(db);
    // Stats: shorter TTL (2 min) — product counts change more often
    _routeCache.set(ck, { data: result, ts: Date.now() });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/catalog/manufacturers — lista producentów
router.get('/catalog/manufacturers', (req, res) => {
  try {
    const ck = 'cat:manufacturers';
    const cached = getCached(ck);
    if (cached) return res.json(cached);
    const db = svc.getDb();
    const result = catalogSvc.getCatalogManufacturers(db);
    setCached(ck, result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/catalog/prices/:ean — ceny ze wszystkich hurtowni dla produktu
router.get('/catalog/prices/:ean', (req, res) => {
  try {
    const db = svc.getDb();
    const ean = req.params.ean;
    const result = catalogSvc.getCatalogEanPrices(db, ean);
    res.json({ ean, prices: result.prices, subiekt: result.subiekt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ─── Categories & Duplicates API ────────────────────────────────────────────────────────

// GET /api/sourcing/catalog/categories
router.get('/catalog/categories', (req, res) => {
  try {
    const q = req.query.q || '';
    if (q) {
      // Search is not cached - it's too varied
      res.json(catalogSvc.searchCategories(svc.getDb(), q));
    } else {
      const ck = 'cat:categories';
      const cached = getCached(ck);
      if (cached) return res.json(cached);
      const result = catalogSvc.getCategories(svc.getDb());
      setCached(ck, result);
      res.json(result);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/catalog/category-tree — hierarchiczne drzewo AB
router.get('/catalog/category-tree', (req, res) => {
  try {
    const ck = 'cat:tree';
    const cached = getCached(ck);
    if (cached) return res.json(cached);
    const result = catalogSvc.getCategoryTree(svc.getDb());
    setCached(ck, result);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/sourcing/catalog/categories/reorder — zapisz kolejność + hierarchię kategorii
router.patch('/catalog/categories/reorder', (req, res) => {
  try {
    const { order } = req.body; // array of { id, sort_order, parent_id? }
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
    const db = svc.getDb();
    
    const stmtUpdate = db.prepare(`
      UPDATE product_categories 
      SET sort_order = ?, 
          parent_id = ?, 
          is_ab_category = CASE WHEN ? = 1 THEN 1 ELSE is_ab_category END,
          ab_category_id = CASE WHEN (? = 1 OR is_ab_category = 1) THEN NULL ELSE ab_category_id END
      WHERE id = ?
    `);

    const parentIds = new Set();
    for (const item of order) {
      if (item.parent_id) {
        parentIds.add(item.parent_id);
      }
    }

    const runAll = db.transaction((items) => {
      for (const item of items) {
        const pId = 'parent_id' in item ? item.parent_id : null;
        const isParent = parentIds.has(item.id);
        const isRoot = !pId;
        const shouldBeAb = (isParent || isRoot) ? 1 : 0;

        stmtUpdate.run(
          item.sort_order,
          pId,
          shouldBeAb,
          shouldBeAb,
          item.id
        );
      }
    });

    runAll(order);
    clearCache(); // Invalidate category cache after reorder
    res.json({ ok: true, updated: order.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/sourcing/catalog/categories/:id — rename a category
router.patch('/catalog/categories/:id', (req, res) => {
  try {
    const db = svc.getDb();
    const id = parseInt(req.params.id);
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nazwa jest wymagana' });
    const trimmed = name.trim();
    db.prepare('UPDATE product_categories SET name = ? WHERE id = ?').run(trimmed, id);
    // Sync catalog_master category_name where this category is used
    db.prepare("UPDATE catalog_master SET category_name = ? WHERE category_id = ?").run(trimmed, id);
    // Invalidate category cache
    clearCache();
    res.json({ ok: true, id, name: trimmed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/sourcing/catalog/categories/:id — delete a category (only if no products)
router.delete('/catalog/categories/:id', (req, res) => {
  try {
    const db = svc.getDb();
    const id = parseInt(req.params.id);
    const products = db.prepare('SELECT COUNT(*) as cnt FROM catalog_master WHERE category_id = ?').get(id)?.cnt || 0;
    if (products > 0) return res.status(409).json({ error: `Nie można usunąć: ${products} produktów przypisanych do tej kategorii` });
    db.prepare('DELETE FROM category_aliases WHERE category_id = ?').run(id);
    db.prepare('DELETE FROM category_attributes WHERE category_id = ?').run(id);
    db.prepare('DELETE FROM product_categories WHERE id = ?').run(id);
    clearCache(); // Invalidate category cache
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/categories — create a new category
router.post('/catalog/categories', (req, res) => {
  try {
    const db = svc.getDb();
    const { name, parent_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nazwa kategorii jest wymagana' });
    const trimmed = name.trim();

    // Check uniqueness
    const existing = db.prepare('SELECT id FROM product_categories WHERE name = ? COLLATE NOCASE').get(trimmed);
    if (existing) return res.status(409).json({ error: `Kategoria "${trimmed}" już istnieje (ID: ${existing.id})` });

    // Generate slug
    const slug = trimmed.toLowerCase()
      .replace(/[ąàáâãäå]/g, 'a').replace(/[ćčç]/g, 'c').replace(/[ęèéêë]/g, 'e')
      .replace(/[ìíîïł]/g, 'i').replace(/[ńñ]/g, 'n').replace(/[óòôõö]/g, 'o')
      .replace(/[śšş]/g, 's').replace(/[ùúûü]/g, 'u').replace(/[żźž]/g, 'z')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    // Get max sort_order for the parent level
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM product_categories WHERE parent_id IS ?'
    ).get(parent_id || null)?.next || 0;

    const info = db.prepare(`
      INSERT INTO product_categories (name, parent_id, slug, product_count, is_ab_category, sort_order)
      VALUES (?, ?, ?, 0, 1, ?)
    `).run(trimmed, parent_id || null, slug, maxOrder);

    clearCache();
    res.json({ ok: true, id: info.lastInsertRowid, name: trimmed, parent_id: parent_id || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/categories/merge — scal wiele kategorii w jedną
router.post('/catalog/categories/merge', (req, res) => {
  try {
    const db = svc.getDb();
    const { categoryIds, targetName } = req.body;
    if (!Array.isArray(categoryIds) || categoryIds.length < 2) {
      return res.status(400).json({ error: 'Wymagane co najmniej 2 kategorie do scalenia (categoryIds)' });
    }
    if (!targetName || !targetName.trim()) {
      return res.status(400).json({ error: 'Brak nazwy wynikowej kategorii (targetName)' });
    }

    const ids = categoryIds.map(Number).filter(Boolean);
    const trimmedName = targetName.trim();

    // Use first category as target (keep its ID, rename it)
    const [targetId, ...sourceIds] = ids;

    const mergeAll = db.transaction(() => {
      // Rename target category
      db.prepare('UPDATE product_categories SET name = ? WHERE id = ?').run(trimmedName, targetId);

      let productsMoved = 0;
      for (const srcId of sourceIds) {
        // Move all products from source to target
        const moved = db.prepare(
          'UPDATE catalog_master SET category_id = ?, category_name = ? WHERE category_id = ?'
        ).run(targetId, trimmedName, srcId).changes;
        productsMoved += moved;

        // Move category aliases
        db.prepare(
          'UPDATE OR IGNORE category_aliases SET category_id = ? WHERE category_id = ?'
        ).run(targetId, srcId);
        db.prepare('DELETE FROM category_aliases WHERE category_id = ?').run(srcId);

        // Move category attributes (insert missing ones)
        db.prepare(
          'INSERT OR IGNORE INTO category_attributes (category_id, attr_name, is_filter) SELECT ?, attr_name, is_filter FROM category_attributes WHERE category_id = ?'
        ).run(targetId, srcId);
        db.prepare('DELETE FROM category_attributes WHERE category_id = ?').run(srcId);

        // Re-parent children of source → target
        db.prepare('UPDATE product_categories SET parent_id = ? WHERE parent_id = ?').run(targetId, srcId);

        // Delete source category
        db.prepare('DELETE FROM product_categories WHERE id = ?').run(srcId);
      }

      // Refresh product count on target
      const cnt = db.prepare('SELECT COUNT(*) as c FROM catalog_master WHERE category_id = ?').get(targetId)?.c || 0;
      db.prepare('UPDATE product_categories SET product_count = ? WHERE id = ?').run(cnt, targetId);

      return productsMoved;
    });

    const productsMoved = mergeAll();
    clearCache();
    res.json({ ok: true, targetId, targetName: trimmedName, merged: ids.length, productsMoved });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/categories/ai-organize — AI tłumaczenie + dopasowanie hierarchii
router.post('/catalog/categories/ai-organize', async (req, res) => {
  try {
    const db = svc.getDb();
    const aiService = require('../services/aiService');
    const { categoryIds } = req.body; // optional: specific IDs to process

    // Get all categories for context
    const allCats = db.prepare('SELECT id, name, parent_id, product_count FROM product_categories ORDER BY name').all();
    if (!allCats.length) return res.status(400).json({ error: 'Brak kategorii w bazie' });

    // Filter to requested IDs or all
    let toProcess = allCats;
    if (categoryIds && Array.isArray(categoryIds) && categoryIds.length) {
      toProcess = allCats.filter(c => categoryIds.includes(c.id));
    }
    if (!toProcess.length) return res.status(400).json({ error: 'Nie znaleziono wskazanych kategorii' });

    const globalProvider = aiService.getEffectiveProvider();
    const mappedModel = aiService.getEffectiveModel(globalProvider, 'sourcing_category');
    const isLocal = !mappedModel || mappedModel.includes(':') || mappedModel.toLowerCase().startsWith('gemma') || mappedModel.toLowerCase().startsWith('llama') || mappedModel.toLowerCase().startsWith('qwen') || mappedModel.toLowerCase().startsWith('phi');

    // Build context: full list of categories for parent suggestions.
    // If using a local model, we limit context size to avoid context overflow.
    let contextCats = allCats;
    if (isLocal) {
      contextCats = [...allCats]
        .sort((a, b) => {
          if (a.parent_id === null && b.parent_id !== null) return -1;
          if (a.parent_id !== null && b.parent_id === null) return 1;
          return (b.product_count || 0) - (a.product_count || 0);
        })
        .slice(0, 250);
    }

    const catContext = contextCats.map(c => `id:${c.id} "${c.name}" (parent_id:${c.parent_id || 'null'}, ${c.product_count || 0} prod.)`).join('\n');

    // Batching to avoid token/context cutoff issues
    const batchSize = 40;
    const allSuggestions = [];
    let lastProvider = '';
    let lastModel = '';

    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);
      const toProcessList = batch.map(c => `id:${c.id} "${c.name}"`).join('\n');

      const systemPrompt = `Jesteś ekspertem od kategoryzacji produktów IT/elektroniki w polskim e-commerce.
Otrzymasz listę kategorii produktów. Twoim zadaniem jest:

1. **TŁUMACZENIE**: Jeśli nazwa kategorii jest w języku obcym (niemiecki, angielski, itp.) i ma typowy polski odpowiednik używany w branży IT — przetłumacz ją na polski. Przykłady:
   - "Externe SSD" → "Dyski SSD Zewnętrzne"
   - "Grafikkarten" → "Karty Graficzne"  
   - "Netzteile" → "Zasilacze"
   - "Gehäuse" → "Obudowy"
   - "Notebooks" → "Laptopy"
   - "Tastaturen" → "Klawiatury"
   - "Monitore" → "Monitory"
   - "Drucker" → "Drukarki"
   Jeśli nazwa jest już po polsku lub nie ma jednoznacznego tłumaczenia — zostaw bez zmian (translated_name = null).

2. **HIERARCHIA**: Zasugeruj najlepszą kategorię nadrzędną (parent_id) z istniejących kategorii. Np.:
   - "Dyski SSD Zewnętrzne" → parent: "Dyski i pamięci masowe" (jeśli istnieje)
   - "Myszy bezprzewodowe" → parent: "Peryferia" lub "Myszy" (jeśli istnieje)
   Jeśli nie ma dobrego rodzica — wpisz null.

Odpowiedz WYŁĄCZNIE poprawnym JSON array. Dla każdej kategorii zwróć obiekt:
{"id": <int>, "translated_name": "<string|null>", "suggested_parent_id": <int|null>, "confidence": "<high|medium|low>"}`;

      const userPrompt = `WSZYSTKIE ISTNIEJĄCE KATEGORIE (kontekst do dopasowania hierarchii):
${catContext}

KATEGORIE DO PRZETWORZENIA (Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toProcess.length / batchSize)}):
${toProcessList}

Zwróć JSON array z wynikami dla KAŻDEJ kategorii do przetworzenia.`;

      try {
        const result = await aiService.complete(systemPrompt, userPrompt, {
          temperature: 0.1, // lower temperature for strict format compliance
          maxTokens: 8192,  // double the max token budget to allow full reasoning + response
          featureId: 'sourcing_category',
          skipBrandKb: true
        });

        lastProvider = result.provider;
        lastModel = result.model;

        const suggestions = aiService.parseJsonResponse(result.text);
        if (Array.isArray(suggestions)) {
          allSuggestions.push(...suggestions);
        } else {
          console.warn('[AI Organize] Batch suggestions did not parse to array:', suggestions);
        }
      } catch (batchErr) {
        console.error(`[AI Organize] Failed processing batch starting at index ${i}:`, batchErr);
      }
    }

    res.json({
      ok: true,
      suggestions: allSuggestions,
      processed: toProcess.length,
      provider: lastProvider,
      model: lastModel
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/suppliers/:id/raw-categories — raw category strings from a supplier's products
router.get('/suppliers/:id/raw-categories', (req, res) => {
  try {
    const db = svc.getDb();
    const supplierId = parseInt(req.params.id);
    const rows = db.prepare(
      "SELECT category as raw_cat, COUNT(*) as cnt FROM supplier_products WHERE supplier_id=? AND category IS NOT NULL AND category != '' GROUP BY category ORDER BY cnt DESC"
    ).all(supplierId);

    // For each raw category, find the most common mapped category in catalog_master
    // by joining supplier_products → catalog_master via EAN
    const findMapping = db.prepare(`
      SELECT pc.id as cat_id, pc.name as cat_name, pc.parent_id,
             pc2.name as parent_name, COUNT(*) as match_cnt
      FROM supplier_products sp
      JOIN catalog_master cm ON normalize_ean(cm.canonical_ean) = COALESCE(NULLIF(sp.normalized_ean, ''), normalize_ean(sp.ean))
      JOIN product_categories pc ON pc.id = cm.category_id
      LEFT JOIN product_categories pc2 ON pc2.id = pc.parent_id
      WHERE sp.supplier_id = ? AND sp.category = ?
      GROUP BY pc.id
      ORDER BY match_cnt DESC
      LIMIT 1
    `);

    const result = rows.map(r => {
      const leaf = r.raw_cat.includes('>') ? r.raw_cat.split('>').pop().trim() : r.raw_cat;
      let mapping = null;
      try {
        const m = findMapping.get(supplierId, r.raw_cat);
        if (m) {
          mapping = {
            cat_id: m.cat_id,
            cat_name: m.cat_name,
            parent_name: m.parent_name,
            full_path: m.parent_name ? m.parent_name + ' > ' + m.cat_name : m.cat_name,
            match_cnt: m.match_cnt
          };
        }
      } catch(_) {}
      return { raw_cat: r.raw_cat, cnt: r.cnt, leaf, mapping };
    });

    res.json({ categories: result, total: result.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});



// POST /api/sourcing/catalog/generate-categories — to samo drzewo AB co /api/generate-categories
router.post('/catalog/generate-categories', (req, res) => {
  try {
    const result = catalogSvc.generateAbCategoryTree(svc.getDb());
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/catalog/suppliers — lista hurtowni (do selecta AB)
router.get('/catalog/suppliers', (req, res) => {
  try {
    res.json(catalogSvc.getSupplierList(svc.getDb()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/catalog/unmapped-categories
router.get('/catalog/unmapped-categories', (req, res) => {
  try {
    res.json(catalogSvc.getUnmappedCategories(svc.getDb()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/mark-ab-supplier — oznacz hurtownię jako AB
router.post('/catalog/mark-ab-supplier', (req, res) => {
  try {
    const { supplierId } = req.body;
    if (!supplierId) return res.status(400).json({ error: 'Brak supplierId' });
    const result = catalogSvc.markSupplierAsAb(svc.getDb(), parseInt(supplierId));
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/remap-category — przypisz kategorię do AB
router.post('/catalog/remap-category', (req, res) => {
  try {
    const { categoryId, abCategoryId } = req.body;
    if (!categoryId || !abCategoryId) return res.status(400).json({ error: 'Brak categoryId lub abCategoryId' });
    res.json(catalogSvc.remapCategoryToAb(svc.getDb(), parseInt(categoryId), parseInt(abCategoryId)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/ai-remap-categories — AI masowe przypisanie nieprzypisanych kategorii
router.post('/catalog/ai-remap-categories', async (req, res) => {
  try {
    const db = svc.getDb();
    const unmapped = catalogSvc.getUnmappedCategories(db);
    const abCats = db.prepare('SELECT id, name FROM product_categories WHERE is_ab_category = 1 ORDER BY name ASC').all();
    
    if (!abCats.length) return res.status(400).json({ error: 'Brak kategorii AB. Najpierw wybierz hurtownię AB.' });
    if (!unmapped.length) return res.json({ remapped: 0, message: 'Wszystkie kategorie są już przypisane' });

    let mappings = [];
    let usedOllamaDirect = false;

    // Try direct local Ollama first to bypass Open WebUI RAG issues
    try {
      const prompt = `Jesteś precyzyjnym systemem kategoryzacji baz danych produktów IT i elektroniki. Twoim zadaniem jest przypisanie kategorii z LISTY DO PRZYPISANIA do odpowiadających im kategorii z LISTY KATEGORII GŁÓWNYCH AB (wzorcowych).

ZASADY:
1. Pracuj wyłącznie na kategoriach z podanej LISTY DO PRZYPISANIA. Nie dodawaj żadnych innych kategorii ani marek.
2. Dopasuj kategorię na podstawie jej nazwy do najbardziej pasującej kategorii AB (np. "Drucker" -> "Drukarki", "Tinte" -> "Tonery i tusze", "Arbeitsspeicher" -> "Pamięci RAM"). Jeśli nic nie pasuje dobrze — wpisz null w ab_id.
3. W odpowiedzi zwróć wyłącznie JSON array obiektów, gdzie każdy obiekt ma DOKŁADNIE klucze: "id" oraz "ab_id". Użyj dokładnie wartości id z nawiasów kwadratowych.

LISTA KATEGORII GŁÓWNYCH AB:
${abCats.map(c => `- [id:${c.id}] ${c.name}`).join('\n')}

LISTA KATEGORII DO PRZYPISANIA:
${unmapped.slice(0, 30).map(c => `- [id:${c.id}] "${c.name}" (${c.product_count} prod.)`).join('\n')}

Odpowiedz jako JSON array:`;

      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemma4:e4b',
          messages: [{ role: 'user', content: prompt }],
          format: 'json',
          stream: false,
          options: { temperature: 0.05 }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const raw = data?.message?.content || '';
        const parsed = JSON.parse(raw);
        
        if (Array.isArray(parsed)) {
          mappings = parsed;
        } else if (parsed && typeof parsed === 'object') {
          for (const key of Object.keys(parsed)) {
            if (Array.isArray(parsed[key])) {
              mappings = parsed[key];
              break;
            }
          }
        }
        usedOllamaDirect = true;
        console.log(`[AI Remap] Direct Ollama successfully matched ${mappings.length} mappings.`);
      }
    } catch (ollamaErr) {
      console.warn(`[AI Remap] Direct Ollama failed: ${ollamaErr.message}. Falling back to Open WebUI...`);
    }

    if (!usedOllamaDirect) {
      const owui = require('../services/openwebuiService');
      const { settingsOps } = require('../models/localDb');
      const token = owui.getApiKey();
      if (!token) return res.status(400).json({ error: 'Brak klucza OWUI. Skonfiguruj w Ustawienia.' });

      const abList = abCats.map((c, i) => `${i + 1}. ${c.name} (id:${c.id})`).join('\n');
      const unmappedList = unmapped.slice(0, 30).map(c => `- [id:${c.id}] "${c.name}" (${c.product_count} prod.)`).join('\n');

      const prompt = `Masz dwie listy kategorii produktów IT/elektroniki.

KATEGORIE GŁÓWNE (AB - wzorcowe):
${abList}

KATEGORIE DO PRZYPISANIA (z innych hurtowni):
${unmappedList}

Dla każdej kategorii do przypisania określ do której kategorii AB pasuje NAJLEPIEJ, bazując na rodzaju produktu (np. "Laptopy biznesowe" → "Laptopy", "Switche zarządzalne" → "Switche").
Jeśli żadna kategoria AB nie pasuje dobrze — wpisz null.

Odpowiedz TYLKO JSON array:
[{"id": 123, "ab_id": 5}, {"id": 124, "ab_id": 12}, ...]`;

      try {
        const baseUrl = owui.getBaseUrl();
        const modelId = settingsOps.get('ai_map_catalog') || settingsOps.get('owui_default_model') || '';
        const models = modelId ? null : await owui.listModels(token).catch(() => []);
        const useModel = modelId || models?.[0]?.id || models?.[0]?.name;
        if (!useModel) return res.status(400).json({ error: 'Brak modelu AI. Wybierz w Ustawienia → Mapowanie AI.' });

        const paths = ['/api/chat/completions', '/v1/chat/completions'];
        let raw = null;
        for (const path of paths) {
          try {
            const r = await fetch(`${baseUrl}${path}`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: useModel, messages: [{ role: 'user', content: prompt }], temperature: 0.1 }),
            });
            const j = await r.json();
            raw = j?.choices?.[0]?.message?.content || j?.message?.content || j?.response || '';
            if (raw) break;
          } catch(_) {}
        }
        const match = raw?.match(/\[[\s\S]*?\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed)) {
            mappings = parsed;
          } else if (parsed && typeof parsed === 'object') {
            for (const key of Object.keys(parsed)) {
              if (Array.isArray(parsed[key])) {
                mappings = parsed[key];
                break;
              }
            }
          }
        }
      } catch(e) { return res.status(500).json({ error: 'AI błąd: ' + e.message }); }
    }

    function extractIdNumber(val) {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
        const m = val.match(/\d+/);
        return m ? parseInt(m[0]) : null;
      }
      return null;
    }

    // Apply mappings
    let remapped = 0;
    db.transaction(() => {
      for (const m of mappings) {
        const rawId = m.id;
        const rawAbId = m.ab_id;
        
        if (rawId === undefined || rawAbId === undefined) continue;
        
        const parsedId = extractIdNumber(rawId);
        const parsedAbId = extractIdNumber(rawAbId);
        
        if (!parsedId || !parsedAbId) continue;

        const abCatExists = abCats.some(c => c.id === parsedAbId);
        if (!abCatExists) {
          console.warn(`[AI Remap] Skipping invalid ab_category_id: ${parsedAbId}`);
          continue;
        }

        const result = db.prepare('UPDATE product_categories SET ab_category_id = ? WHERE id = ? AND is_ab_category = 0').run(parsedAbId, parsedId);
        if (result.changes > 0) remapped++;
      }
    })();

    res.json({ ok: true, remapped, total: unmapped.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// GET /api/sourcing/catalog/categories/:id/attributes
router.get('/catalog/categories/:id/attributes', (req, res) => {
  try {
    res.json(catalogSvc.getCategoryAttributes(svc.getDb(), parseInt(req.params.id)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/sourcing/catalog/categories/attributes/:id — toggle visibility
router.patch('/catalog/categories/attributes/:id', (req, res) => {
  try {
    const visible = req.body.visible !== undefined ? req.body.visible : true;
    res.json(catalogSvc.toggleCategoryAttribute(svc.getDb(), parseInt(req.params.id), visible));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/categories/batch-generate — generate for ALL categories
router.post('/catalog/categories/batch-generate', async (req, res) => {
  try {
    const useAi = req.body.useAi === true;
    const result = await catalogSvc.batchGenerateAttributes(svc.getDb(), useAi);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/categories/:id/generate-attributes — auto-generate filters
router.post('/catalog/categories/:id/generate-attributes', async (req, res) => {
  try {
    const useAi = req.body.useAi !== false;
    const result = await catalogSvc.generateAttributesForCategory(svc.getDb(), parseInt(req.params.id), useAi);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/catalog/sync-attributes', (req, res) => {
  try {
    const result = catalogSvc.syncCatalogAttributes(svc.getDb(), { seedSchemas: true });
    res.json({ ok: true, ...result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/catalog/duplicates
router.get('/catalog/duplicates', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    res.json(catalogSvc.getDuplicatesList(svc.getDb(), { page, limit }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/duplicates/scan
router.post('/catalog/duplicates/scan', (req, res) => {
  try {
    res.json(catalogSvc.scanForDuplicates(svc.getDb()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/sourcing/catalog/duplicates/:id
router.patch('/catalog/duplicates/:id', (req, res) => {
  try {
    const action = req.body.action; // 'merge' lub 'different'
    res.json(catalogSvc.resolveDuplicate(svc.getDb(), parseInt(req.params.id), action));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ─── Naming Schema & Name Normalization ─────────────────────────────────────────

// GET /api/sourcing/catalog/naming-schema/:categoryId
router.get('/catalog/naming-schema/:categoryId', (req, res) => {
  try {
    res.json(catalogSvc.getNamingSchema(svc.getDb(), parseInt(req.params.categoryId)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/naming-schema/:categoryId — save schema
router.post('/catalog/naming-schema/:categoryId', (req, res) => {
  try {
    const params = req.body.params;
    if (!Array.isArray(params)) return res.status(400).json({ error: 'params musi być tablicą' });
    res.json(catalogSvc.saveNamingSchema(svc.getDb(), parseInt(req.params.categoryId), params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/naming-schema/:categoryId/approve
router.post('/catalog/naming-schema/:categoryId/approve', (req, res) => {
  try {
    const approved = req.body.approved !== false;
    res.json(catalogSvc.approveNamingSchema(svc.getDb(), parseInt(req.params.categoryId), approved));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/naming-schema/:categoryId/suggest — AI suggests schema
router.post('/catalog/naming-schema/:categoryId/suggest', async (req, res) => {
  try {
    const result = await catalogSvc.suggestNamingSchema(svc.getDb(), parseInt(req.params.categoryId));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/normalize/:id — normalize single product name
router.post('/catalog/normalize/:id', async (req, res) => {
  try {
    const force = req.body.force === true;
    const result = await catalogSvc.normalizeProductName(svc.getDb(), parseInt(req.params.id), { force });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/normalize-batch — batch normalize
router.post('/catalog/normalize-batch', async (req, res) => {
  try {
    const result = await catalogSvc.batchNormalizeNames(svc.getDb(), {
      limit: parseInt(req.body.limit) || 50,
      categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : null,
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/sourcing/catalog/product-name/:id — manual edit name
router.patch('/catalog/product-name/:id', (req, res) => {
  try {
    const { name, lock } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa jest wymagana' });
    res.json(catalogSvc.updateProductName(svc.getDb(), parseInt(req.params.id), name, !!lock));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Katalog Master Full — Product Details & Attributes ──────────────────────

// GET /api/sourcing/catalog/product/:idOrEan — pełne szczegóły produktu
router.get('/catalog/product/:idOrEan', (req, res) => {
  try {
    const idOrEan = req.params.idOrEan;
    const db = svc.getDb();
    
    let row = db.prepare('SELECT id FROM catalog_master WHERE canonical_ean = ?').get(idOrEan);
    let productId = row ? row.id : null;

    if (!productId) {
      try {
        const n = catalogSvc.normalizeEan(idOrEan);
        if (n) {
          row = db.prepare('SELECT id FROM catalog_master WHERE canonical_ean = ? OR normalize_ean(canonical_ean) = ? LIMIT 1').get(n, n);
          if (row) productId = row.id;
        }
      } catch (_) {}
    }

    if (!productId && /^\d+$/.test(idOrEan)) {
        const byId = db.prepare('SELECT id FROM catalog_master WHERE id = ?').get(parseInt(idOrEan, 10));
        if (byId) productId = byId.id;
    }

    if (!productId && !/^\d{1,7}$/.test(idOrEan)) {
       let name = '';
       let mfg = '';
       const n = catalogSvc.normalizeEan(idOrEan) || idOrEan;
       let supProd = db.prepare(
         `SELECT name, manufacturer FROM supplier_products WHERE ean = ? AND name IS NOT NULL AND name != '' LIMIT 1`
       ).get(idOrEan);
       if (!supProd) {
         try {
           supProd = db.prepare(
             `SELECT name, manufacturer FROM supplier_products
              WHERE (normalized_ean = ? OR normalize_ean(ean) = ?) AND name IS NOT NULL AND name != ''
              LIMIT 1`
           ).get(n, n);
         } catch (_) {}
       }
       if (supProd) {
          name = supProd.name;
          mfg = supProd.manufacturer || '';
       } else {
          let subProd = db.prepare('SELECT name, manufacturer FROM subiekt_products WHERE ean = ? LIMIT 1').get(idOrEan);
          if (!subProd) {
            try {
              subProd = db.prepare('SELECT name, manufacturer FROM subiekt_products WHERE normalize_ean(ean) = ? LIMIT 1').get(n);
            } catch (_) {}
          }
          if (subProd) {
             name = subProd.name;
             mfg = subProd.manufacturer || '';
          }
       }

       if (name) {
         try {
            const ins = db.prepare('INSERT INTO catalog_master (canonical_ean, name, normalized_name, manufacturer) VALUES (?, ?, ?, ?)').run(n, name, name, mfg);
            productId = ins.lastInsertRowid;
         } catch(e) {
            console.error('Auto-insert do catalog_master nie powiódł się', e);
            const again = db.prepare('SELECT id FROM catalog_master WHERE canonical_ean = ? OR normalize_ean(canonical_ean) = ? LIMIT 1').get(n, n);
            if (again) productId = again.id;
         }
       }
    }
    
    if (!productId) return res.status(404).json({ error: 'Produkt nie znaleziony i brak poprawnego EAN' });
    
    const result = catalogSvc.getProductDetails(db, productId);
    if (!result) return res.status(404).json({ error: 'Produkt nie znaleziony po pobraniu' });
    
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/sourcing/catalog/product/:id/details — aktualizacja szczegółów produktu
router.put('/catalog/product/:id/details', (req, res) => {
  try {
    const { manufacturer_code, weight_g } = req.body;
    res.json(catalogSvc.updateProductDetails(svc.getDb(), parseInt(req.params.id), { manufacturer_code, weight_g }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/product/:id/attribute — ustaw wartość parametru
router.post('/catalog/product/:id/attribute', (req, res) => {
  try {
    const { attrId, value } = req.body;
    if (!attrId) return res.status(400).json({ error: 'Brak attrId' });
    res.json(catalogSvc.setProductAttribute(svc.getDb(), parseInt(req.params.id), parseInt(attrId), value || ''));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/sourcing/catalog/product/:id/attribute/:attrId — usuń wartość parametru
router.delete('/catalog/product/:id/attribute/:attrId', (req, res) => {
  try {
    res.json(catalogSvc.removeProductAttribute(svc.getDb(), parseInt(req.params.id), parseInt(req.params.attrId)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Katalog Master Full — Category Filters ────────────────────────────────────

// GET /api/sourcing/catalog/categories/:id/all-attributes — WSZYSTKIE atrybuty (do edytora)
router.get('/catalog/categories/:id/all-attributes', (req, res) => {
  try {
    res.json(catalogSvc.getAllCategoryAttributes(svc.getDb(), parseInt(req.params.id)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/catalog/categories/:id/filters — filtry + unikalne wartości
router.get('/catalog/categories/:id/filters', (req, res) => {
  try {
    res.json(catalogSvc.getCategoryFilters(svc.getDb(), parseInt(req.params.id)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/sourcing/catalog/categories/:id/filters — zapisz konfigurację filtrów
router.put('/catalog/categories/:id/filters', (req, res) => {
  try {
    const { filterAttrIds } = req.body;
    res.json(catalogSvc.updateCategoryAttributeFilters(svc.getDb(), parseInt(req.params.id), filterAttrIds || []));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/categories/:id/attributes — dodaj nowy parametr
router.post('/catalog/categories/:id/attributes', (req, res) => {
  try {
    const { name, unit } = req.body;
    res.json(catalogSvc.addCategoryAttribute(svc.getDb(), parseInt(req.params.id), name, unit));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/sourcing/catalog/categories/attributes/:id — usuń parametr
router.delete('/catalog/categories/attributes/:id', (req, res) => {
  try {
    res.json(catalogSvc.removeCategoryAttribute(svc.getDb(), parseInt(req.params.id)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/sourcing/catalog/categories/attributes/:id — edytuj parametr
router.patch('/catalog/categories/attributes/:id', (req, res) => {
  try {
    const { attr_name, attr_unit, sort_order, visible } = req.body;
    res.json(catalogSvc.updateCategoryAttribute(svc.getDb(), parseInt(req.params.id), { attr_name, attr_unit, sort_order, visible }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/categories/normalize — scal zduplikowane kategorie
router.post('/catalog/categories/normalize', (req, res) => {
  try {
    const db = svc.getDb();
    const result = catalogSvc.mergeAndNormalizeCategories(db);
    res.json({ ok: true, ...result, message: `Scalono ${result.merged} duplikatów → ${result.kept} kategorii.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/categories/ai-assign-unmapped — przypisz produkty bez kategorii AB
router.post('/catalog/categories/ai-assign-unmapped', async (req, res) => {
  try {
    const db = svc.getDb();
    const useAi = req.body.useAi !== false; // default true
    const limit = parseInt(req.body.limit) || 10000;
    
    // Step 1: normalize duplicates first
    const normResult = catalogSvc.mergeAndNormalizeCategories(db);
    
    // Step 2: assign unmapped
    const result = await catalogSvc.aiAssignUnmappedProducts(db, { useAi, limit });
    
    res.json({
      ok: true,
      normalized: normResult,
      ...result,
      message: [
        `Scalono ${normResult.merged} duplikatów kategorii.`,
        `Przypisano ${result.categoriesAssigned || 0} kategorii i ${result.productsAssigned || 0} produktów.`,
        result.stillUnmappedCategories > 0 ? `Pozostało ${result.stillUnmappedCategories} kategorii nieprzypisanych.` : 'Wszystkie kategorie przypisane! ✓'
      ].join(' ')
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/categories/fix-encoding — napraw polskie znaki w kategoriach
router.post('/catalog/categories/fix-encoding', (req, res) => {
  try {
    const db = svc.getDb();
    const iconv = require('iconv-lite');
    
    // Get all category names and product names
    const cats = db.prepare('SELECT id, name FROM product_categories').all();
    let fixed = 0;
    
    const updateCat = db.prepare('UPDATE product_categories SET name = ? WHERE id = ?');
    
    for (const cat of cats) {
      if (!cat.name) continue;
      // Check if name has replacement chars (broken UTF-8 sequence pattern)
      // Broken chars appear as sequences like Ä, Ä™, Ĺ, etc.
      const hasBroken = /[ÄÅĹĂ]|[\u0080-\u009f]/.test(cat.name);
      if (!hasBroken) continue;
      
      try {
        // The data was encoded as UTF-8 but read as latin1, so re-encode to binary then decode as UTF-8
        const buf = Buffer.from(cat.name, 'binary');
        const decoded = buf.toString('utf8');
        // Verify it looks better (contains valid Polish chars)
        const hasPolish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(decoded);
        if (hasPolish || decoded.length > 0) {
          const cleaned = decoded.replace(/\uFFFD/g, '').trim();
          if (cleaned && cleaned !== cat.name && cleaned.length > 1) {
            updateCat.run(cleaned, cat.id);
            fixed++;
          }
        }
      } catch(e) {}
      
      // Also try iconv latin2 decode
      if (fixed === 0 || hasBroken) {
        try {
          const buf = Buffer.from(cat.name, 'latin1');
          const decoded = iconv.decode(buf, 'utf-8');
          const hasPolish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(decoded);
          if (hasPolish) {
            updateCat.run(decoded.trim(), cat.id);
            fixed++;
          }
        } catch(e) {}
      }
    }
    
    // Also fix supplier_products category field (source data)
    let spFixed = 0;
    try {
      const spRows = db.prepare('SELECT id, category FROM supplier_products WHERE category IS NOT NULL LIMIT 10000').all();
      const updateSp = db.prepare('UPDATE supplier_products SET category = ? WHERE id = ?');
      for (const sp of spRows) {
        if (!sp.category) continue;
        const hasBroken = /[ÄÅĹĂ]|[\u0080-\u009f]/.test(sp.category);
        if (!hasBroken) continue;
        try {
          const buf = Buffer.from(sp.category, 'binary');
          const decoded = buf.toString('utf8');
          const cleaned = decoded.replace(/\uFFFD/g, '').trim();
          if (cleaned && cleaned !== sp.category && cleaned.length > 0) {
            updateSp.run(cleaned, sp.id);
            spFixed++;
          }
        } catch(e) {}
      }
    } catch(_) {}
    
    // Also fix catalog_master.name and category_name
    let cmFixed = 0;
    try {
      const cmRows = db.prepare('SELECT id, name, category_name FROM catalog_master WHERE name LIKE ? OR category_name LIKE ? LIMIT 5000').all('%Ä%', '%Ä%');
      const updateCm = db.prepare('UPDATE catalog_master SET name = ?, category_name = ? WHERE id = ?');
      for (const cm of cmRows) {
        let newName = cm.name;
        let newCatName = cm.category_name;
        try {
          if (cm.name && /[ÄÅĹĂ]/.test(cm.name)) {
            const decoded = Buffer.from(cm.name, 'binary').toString('utf8');
            newName = decoded.replace(/\uFFFD/g, '').trim() || cm.name;
          }
          if (cm.category_name && /[ÄÅĹĂ]/.test(cm.category_name)) {
            const decoded = Buffer.from(cm.category_name, 'binary').toString('utf8');
            newCatName = decoded.replace(/\uFFFD/g, '').trim() || cm.category_name;
          }
          if (newName !== cm.name || newCatName !== cm.category_name) {
            updateCm.run(newName, newCatName, cm.id);
            cmFixed++;
          }
        } catch(e) {}
      }
    } catch(_) {}
    
    res.json({ ok: true, categoriesFixed: fixed, supplierProductsFixed: spFixed, catalogMasterFixed: cmFixed,
      message: `Naprawiono ${fixed} nazw kategorii, ${spFixed} kategorii hurtowni, ${cmFixed} produktów katalogowych.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/catalog/repair-all — kompleksowa naprawa: regeneruj + napraw encoding + normalizuj + przypisz
router.post('/catalog/repair-all', async (req, res) => {
  try {
    const db = svc.getDb();
    const steps = [];
    
    // Step 1: Fix encoding first
    try {
      const iconv = require('iconv-lite');
      const cats = db.prepare('SELECT id, name FROM product_categories').all();
      let fixed = 0;
      const updateCat = db.prepare('UPDATE product_categories SET name = ? WHERE id = ?');
      for (const cat of cats) {
        if (!cat.name || !/[ÄÅĹĂ]/.test(cat.name)) continue;
        try {
          const decoded = Buffer.from(cat.name, 'binary').toString('utf8');
          const cleaned = decoded.replace(/\uFFFD/g, '').trim();
          if (cleaned && cleaned !== cat.name) { updateCat.run(cleaned, cat.id); fixed++; }
        } catch(_) {}
      }
      steps.push(`encoding_fix: ${fixed} kategorii naprawionych`);
    } catch(e) { steps.push(`encoding_fix: błąd - ${e.message}`); }
    
    // Step 2: Normalize (merge duplicates)
    try {
      const normResult = catalogSvc.mergeAndNormalizeCategories(db);
      steps.push(`normalize: scalono ${normResult.merged} duplikatów, zostało ${normResult.kept} kategorii`);
    } catch(e) { steps.push(`normalize: błąd - ${e.message}`); }
    
    // Step 3: Assign unmapped (keyword only, fast)
    try {
      const assignResult = await catalogSvc.aiAssignUnmappedProducts(db, { useAi: false, limit: 20000 });
      steps.push(`assign: ${assignResult.categoriesAssigned || 0} kategorii, ${assignResult.productsAssigned || 0} produktów, zostało ${assignResult.stillUnmappedCategories || '?'} nieprzypisanych`);
    } catch(e) { steps.push(`assign: błąd - ${e.message}`); }
    
    res.json({ ok: true, steps, message: steps.join(' | ') });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


/* ─── SG-SYNC: Synchronizacja stanów i cen ShopGold ──────────────────── */
const sgSync = require('../services/sgSyncService');

// GET /api/sourcing/sg-sync/instances — lista instancji ShopGold
router.get('/sg-sync/instances', (req, res) => {
  try {
    const instances = sgSync.getInstances();
    res.json({ instances });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/sg-sync/config/:iid — konfiguracja sync dla instancji
router.get('/sg-sync/config/:iid', (req, res) => {
  try {
    const cfg = sgSync.getSyncConfig(parseInt(req.params.iid));
    res.json(cfg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/sg-sync/config/:iid — zapisz konfigurację sync
router.post('/sg-sync/config/:iid', (req, res) => {
  try {
    const cfg = sgSync.saveSyncConfig(parseInt(req.params.iid), req.body);
    // Przeładuj harmonogram
    try {
      const scheduler = require('../services/schedulerService');
      if (typeof scheduler.reloadSgSyncSchedules === 'function') scheduler.reloadSgSyncSchedules();
    } catch (_) {}
    res.json({ ok: true, config: cfg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/sg-sync/price-rules/:iid — pobierz reguły marż
router.get('/sg-sync/price-rules/:iid', (req, res) => {
  try {
    const rules = sgSync.getPriceRules(parseInt(req.params.iid));
    res.json({ rules });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/sg-sync/price-rules/:iid — dodaj/edytuj regułę marży
router.post('/sg-sync/price-rules/:iid', (req, res) => {
  try {
    const rule = { ...req.body, instance_id: parseInt(req.params.iid) };
    sgSync.upsertPriceRule(rule);
    const rules = sgSync.getPriceRules(parseInt(req.params.iid));
    res.json({ ok: true, rules });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/sourcing/sg-sync/price-rules/:id — usuń regułę marży
router.delete('/sg-sync/price-rules/:id', (req, res) => {
  try {
    sgSync.deletePriceRule(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/sg-sync/calc-price — oblicz przykładową cenę
router.post('/sg-sync/calc-price', (req, res) => {
  try {
    const { netto_price, instance_id } = req.body;
    const rules = sgSync.getPriceRules(parseInt(instance_id));
    const brutto = sgSync.calcPrice(parseFloat(netto_price), rules);
    res.json({ netto: parseFloat(netto_price), brutto, rules: rules.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/sourcing/sg-sync/run/:iid — uruchom synchronizację
router.post('/sg-sync/run/:iid', async (req, res) => {
  try {
    const instanceId = parseInt(req.params.iid);
    const { supplier_id, dry_run = true, update_stock = true, update_price = true, subiekt_priority = true } = req.body;
    if (!supplier_id) return res.status(400).json({ error: 'Wymagane supplier_id' });

    const result = await sgSync.runSync(instanceId, parseInt(supplier_id), {
      dry_run: dry_run !== false && dry_run !== 'false',
      update_stock: update_stock !== false,
      update_price: update_price !== false,
      subiekt_priority: subiekt_priority !== false,
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/sourcing/sg-sync/logs/:iid — pobierz logi synchronizacji
router.get('/sg-sync/logs/:iid', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const logs = sgSync.getSyncLogs(parseInt(req.params.iid), limit);
    res.json({ logs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/sourcing/sg-sync/schedule/:iid — włącz/wyłącz harmonogram
router.patch('/sg-sync/schedule/:iid', (req, res) => {
  try {
    const instanceId = parseInt(req.params.iid);
    const { schedule_enabled, schedule_cron } = req.body;
    const cfg = sgSync.getSyncConfig(instanceId);
    sgSync.saveSyncConfig(instanceId, {
      ...cfg,
      schedule_enabled: schedule_enabled !== undefined ? schedule_enabled : cfg.schedule_enabled,
      schedule_cron: schedule_cron || cfg.schedule_cron,
    });
    try {
      const scheduler = require('../services/schedulerService');
      if (typeof scheduler.reloadSgSyncSchedules === 'function') scheduler.reloadSgSyncSchedules();
    } catch (_) {}
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

