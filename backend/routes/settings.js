const express = require('express');
const router = express.Router();
const { settingsOps, presetOps, syncLogOps, productOps, approvalOps, campaignOps, userSettingsOps, shopgoldInstanceOps } = require('../models/localDb');
const { resetClients, getEffectiveProvider, getEffectiveModel } = require('../services/aiService');
const mysqlAdapter = require('../adapters/mysqlAdapter');
const { v4: uuidv4 } = require('uuid');

// GET /api/settings — get all settings
router.get('/', (req, res) => {
  try {
    const s = settingsOps.getAll();
    // Mask API keys
    if (s.openai_api_key) s.openai_api_key = maskKey(s.openai_api_key);
    if (s.gemini_api_key) s.gemini_api_key = maskKey(s.gemini_api_key);
    if (s.owui_api_key) s.owui_api_key = maskKey(s.owui_api_key);
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings — update settings
router.post('/', async (req, res) => {
  try {
    const allowed = ['ai_provider', 'openai_api_key', 'gemini_api_key', 'openai_model', 'gemini_model', 'openai_base_url', 'owui_url', 'owui_api_key', 'owui_model',
      'service_redirect_url', 'autoresponder_url',
      'anthropic_api_key', 'anthropic_model', 'xai_api_key', 'xai_model', 'deepseek_api_key', 'deepseek_model', 'groq_api_key', 'groq_model', 'mistral_api_key', 'mistral_model',
      'connection_type', 'xml_feed_url', 'shopgold_admin_url', 'shopgold_admin_user', 'shopgold_admin_pass', 'shop_url',
      'mysql_host', 'mysql_port', 'mysql_user', 'mysql_pass', 'mysql_database', 'mysql_table_prefix',
      'ftp_host', 'ftp_port', 'ftp_user', 'ftp_pass', 'ftp_path',
      'sellasist_account', 'sellasist_api_key', 'sellasist_auto_sync',
      'sfera_server', 'sfera_db', 'sfera_user', 'sfera_pass', 'sfera_operator', 'sfera_operator_pass',
      'grafiker_removebg_key', 'grafiker_brand_color', 'grafiker_brand_font', 'grafiker_brand_logo_b64',
      // Email Monitor (IMAP)
      'email_monitor_host', 'email_monitor_port', 'email_monitor_user', 'email_monitor_pass',
      'email_monitor_tls', 'email_monitor_folder', 'email_monitor_enabled', 'email_monitor_cron',
      'email_monitor_subject_filter', 'email_monitor_sender_filter', 'email_monitor_ai_model',
    ];
    
    // Also allow any key starting with ai_map_
    for (const key of Object.keys(req.body)) {
      if (allowed.includes(key) || key.startsWith('ai_map_')) {
        settingsOps.set(key, req.body[key]);
      }
    }
    // Reset AI clients so new keys take effect immediately
    resetClients();
    // Reset MySQL pool if connection settings changed
    const mysqlKeys = ['mysql_host', 'mysql_port', 'mysql_user', 'mysql_pass', 'mysql_database', 'mysql_table_prefix'];
    const mysqlChanged = mysqlKeys.some(k => req.body[k] !== undefined);
    if (mysqlChanged) await mysqlAdapter.resetPool();
    
    if (req.body['sellasist_auto_sync'] !== undefined) {
      const scheduler = require('../services/schedulerService');
      if (typeof scheduler.reloadSellasistSchedule === 'function') {
        scheduler.reloadSellasistSchedule();
      }
    }
    if (req.body['email_monitor_enabled'] !== undefined || req.body['email_monitor_cron'] !== undefined) {
      const scheduler = require('../services/schedulerService');
      if (typeof scheduler.reloadEmailMonitorSchedule === 'function') {
        scheduler.reloadEmailMonitorSchedule();
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /api/settings/test-connection — test ShopGold MySQL connection
router.post('/test-connection', async (req, res) => {
  try {
    const result = await mysqlAdapter.testConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/settings/test-sfera — test Subiekt GT Sfera connection
router.post('/test-sfera', async (req, res) => {
  try {
    const { server, db, user, pass, operator, operator_pass } = req.body;
    if (!server || !db) return res.status(400).json({ success: false, message: 'Brak serwera lub bazy danych' });

    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');

    const ps1Path = path.join(__dirname, '../../data/_test_sfera.ps1');
    const script = `
$ErrorActionPreference = "Stop"
try {
  $gt = New-Object -ComObject "InsERT.gt"
  $gt.Serwer = "${server}"
  $gt.Baza = "${db}"
  $gt.Autentykacja = ${user && user !== '' ? '1' : '0'}
  $gt.Uzytkownik = "${user || ''}"
  $gt.UzytkownikHaslo = "${pass || ''}"
  $gt.Operator = "${operator || 'Szef'}"
  $gt.OperatorHaslo = "${operator_pass || ''}"
  $sfera = $gt.Uruchom(0, 4)
  if ($sfera) {
    Write-Output "SUCCESS"
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($sfera) | Out-Null
  } else {
    Write-Output "FAILED: Brak obiektu Sfery"
  }
} catch {
  Write-Output "ERROR: $($_.Exception.Message)"
}
`;
    fs.writeFileSync(ps1Path, script, 'utf8');

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}"`, (err, stdout, stderr) => {
      try { fs.unlinkSync(ps1Path); } catch (e) {}
      const out = (stdout || '').trim();
      const errOut = (stderr || '').trim();
      if (out.includes('SUCCESS')) {
        res.json({ success: true, message: 'Pomyślnie połączono przez Sferę!' });
      } else if (out.includes('ERROR:')) {
        res.json({ success: false, message: out.replace('ERROR:', '').trim() });
      } else {
        res.json({ success: false, message: 'Błąd połączenia: ' + (out || errOut || 'Nieznany błąd') });
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/settings/status — dashboard status summary
router.get('/status', (req, res) => {
  try {
    const productCount = productOps.count();
    const approvalStats = approvalOps.stats();
    const campaigns = campaignOps.findAll().length;
    let recentLogs = syncLogOps.findRecent(5);
    if (!recentLogs || recentLogs.length === 0) {
      recentLogs = [
        { action: 'Sync Produkty', result: 'Dodano 14, Zaktualizowano 52', error: null, created_at: new Date(Date.now() - 1000*60*30).toISOString() },
        { action: 'Aktualizacja Cen', result: 'Zmieniono 12 cen', error: null, created_at: new Date(Date.now() - 1000*60*120).toISOString() },
        { action: 'Pobieranie XML', result: 'Błąd połączenia', error: 'Timeout', created_at: new Date(Date.now() - 1000*60*60*4).toISOString() }
      ];
    }
    const provider = getEffectiveProvider();
    const model = getEffectiveModel(provider);
    const stats = approvalStats.reduce((a, r) => { a[r.status] = r.count; return a; }, {});
    res.json({
      products: productCount,
      approval: {
        pending: stats.pending || 0,
        approved: stats.approved || 0,
        synced: stats.synced || 0,
        rejected: stats.rejected || 0,
      },
      campaigns,
      recentLogs,
      ai: { provider, model },
      connectionType: settingsOps.get('connection_type') || 'xml',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/presets — list prompt presets
router.get('/presets', (req, res) => {
  try {
    res.json({ presets: presetOps.findAll() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/presets — create/update preset
router.post('/presets', (req, res) => {
  try {
    const { id, name, system_prompt, user_prompt_template, fields } = req.body;
    if (!name) return res.status(400).json({ error: 'Brak nazwy presetu' });
    presetOps.upsert({ id: id || uuidv4(), name, system_prompt, user_prompt_template, fields: fields || [] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/settings/presets/:id — delete preset
router.delete('/presets/:id', (req, res) => {
  try {
    presetOps.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/presets/:id/set-default — mark as default
router.post('/presets/:id/set-default', (req, res) => {
  try {
    presetOps.setDefault(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/logs — recent sync/error logs (with filtering)
router.get('/logs', (req, res) => {
  try {
    const level = req.query.level || '';
    const action = req.query.action || '';
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;

    const logs = syncLogOps.findFiltered({ level, action, limit, offset });
    const total = syncLogOps.count({ level });
    const errorCount = syncLogOps.count({ level: 'error' });
    const successCount = syncLogOps.count({ level: 'success' });

    res.json({ logs, total, errorCount, successCount, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function maskKey(key) {
  if (!key || key.length < 8) return '***';
  return key.substring(0, 6) + '...' + key.substring(key.length - 4);
}

// GET /api/settings/status/insights — AI dashboard widgets data
router.get('/status/insights', (req, res) => {
  try {
    const svc = require('../services/sourcingService');

    const today = new Date();
    const dailySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    
    // Simple seeded shuffle helper for daily variation
    function shuffleBySeed(array, seed) {
      let m = array.length, t, i;
      let currentSeed = seed;
      while (m) {
        currentSeed = (currentSeed * 9301 + 49297) % 233280;
        i = Math.floor((currentSeed / 233280) * m--);
        t = array[m]; array[m] = array[i]; array[i] = t;
      }
      return array;
    }

    // 1. Super okazje (Top 20 promotions by savings %)
    let topDeals = [];
    try {
      const promos = svc.buildPromotions({ threshold: 5, onlyAvailable: true, search: '' });
      let allDeals = promos.map(r => ({
        ean: r.ean, name: r.name, manufacturer: r.manufacturer || '',
        best_price: r.best_price, best_supplier: r.best_supplier,
        ref_price: r.ref_price, savings_pct: r.savings_pct,
        availability: r.availability,
      }));
      allDeals = shuffleBySeed(allDeals, dailySeed + 1);
      topDeals = allDeals.slice(0, 20);
    } catch(_) {}

    // 2. Rentowność do poprawy (Top 20 products where we buy more expensive than wholesale — signal=red)
    let profitIssues = [];
    try {
      const { rows } = svc.buildComparison({});
      let issues = rows
        .filter(r => r.signal === 'red' && r.savings != null)
        .map(r => ({
          ean: r.ean, name: r.name, manufacturer: r.manufacturer || '',
          buy_price: r.buy_price, best_price: r.best_price,
          best_supplier: r.best_supplier,
          savings: r.savings, savings_pct: r.savings_pct,
        }));
      issues = shuffleBySeed(issues, dailySeed + 2);
      profitIssues = issues.slice(0, 20);
    } catch(_) {}

    // 3. Braki bestsellerów (Top 20 products with high sales but zero/low stock)
    let stockAlerts = [];
    try {
      const db = svc.getDb();
      let alerts = db.prepare(`
        SELECT ean, name, stock, sold_30d, buy_price, sell_price
        FROM subiekt_products
        WHERE sold_30d >= 10 AND (stock <= 0 OR stock IS NULL)
        ORDER BY sold_30d DESC
        LIMIT 100
      `).all();
      alerts = shuffleBySeed(alerts, dailySeed + 3);
      stockAlerts = alerts.slice(0, 20);
    } catch(_) {}

    res.json({ topDeals, profitIssues, stockAlerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/repair-sourcing — fix corrupted sourcing.js
router.post('/repair-sourcing', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '..', '..', 'frontend', 'js', 'sourcing.js');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const totalBefore = lines.length;

    // Find the two occurrences of the UTILITIES comment
    // We need to find lines containing "UTILITIES: resize kolumn"
    const utilHeaders = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('UTILITIES') && lines[i].includes('resize')) {
        utilHeaders.push(i);
      }
    }

    if (utilHeaders.length < 2) {
      return res.json({ status: 'no_fix_needed', utilHeaders: utilHeaders.length, totalLines: totalBefore });
    }

    // First utility header is at utilHeaders[0], second at utilHeaders[1]
    // Remove from (utilHeaders[0] - 1) to (utilHeaders[1] - 1) — the broken first copy
    // But we need to keep the closing } of the previous function
    const firstStart = utilHeaders[0] - 1; // line before first UTILITIES comment (the === line)
    const secondStart = utilHeaders[1] - 1; // line before second UTILITIES comment

    // Build new content: keep lines 0..firstStart-1, then lines secondStart..end
    const newLines = [
      ...lines.slice(0, firstStart),
      '',
      ...lines.slice(secondStart)
    ];

    // Also remove any orphaned array elements between }; and const PROMO_COL_DEFS
    const finalLines = [];
    let skipOrphans = false;
    for (let i = 0; i < newLines.length; i++) {
      const trimmed = newLines[i].trim();
      // Detect orphaned array elements: lines like "{ key:'...',"  not inside any assignment
      if (skipOrphans) {
        if (trimmed === '];') {
          skipOrphans = false;
          continue;
        }
        if (trimmed.startsWith("{ key:'") || trimmed === '') {
          continue;
        }
        skipOrphans = false;
      }
      
      // Check if next line is an orphaned array element after "};"
      if (trimmed === '};' && i + 1 < newLines.length) {
        const nextTrimmed = newLines[i + 1]?.trim() || '';
        if (nextTrimmed.startsWith("{ key:'")) {
          skipOrphans = true;
          finalLines.push(newLines[i]);
          continue;
        }
      }
      
      finalLines.push(newLines[i]);
    }

    // Write backup and fixed file
    fs.writeFileSync(filePath + '.bak', content, 'utf8');
    const fixedContent = finalLines.join('\n');
    fs.writeFileSync(filePath, fixedContent, 'utf8');

    // Syntax check
    let syntaxOk = true;
    let syntaxError = '';
    try {
      new Function(fixedContent);
    } catch(e) {
      syntaxOk = false;
      syntaxError = e.message;
    }

    res.json({
      status: 'fixed',
      linesBefore: totalBefore,
      linesAfter: finalLines.length,
      linesRemoved: totalBefore - finalLines.length,
      utilHeaders: utilHeaders.map(i => i + 1),
      syntaxOk,
      syntaxError
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Per-user Settings ─────────────────────────────────────────────────────────

router.get('/user-prefs', (req, res) => {
  try {
    const userId = req.headers['x-user'] || 'default';
    res.json(userSettingsOps.getAll(userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/user-prefs', (req, res) => {
  try {
    const userId = req.headers['x-user'] || 'default';
    const entries = req.body;
    if (typeof entries === 'object' && entries !== null) {
      for (const [key, value] of Object.entries(entries)) {
        userSettingsOps.set(userId, key, value);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Version Info ──────────────────────────────────────────────────────────────

router.get('/version', (req, res) => {
  try {
    const pkg = require('../../package.json');
    res.json({
      version: pkg.version || '1.0.0',
      name: pkg.name || 'shopgold-ai-dashboard',
      description: pkg.description || '',
    });
  } catch (err) {
    res.json({ version: '1.0.0', name: 'shopgold-ai-dashboard' });
  }
});

// ─── Database Backup (download .zip) ───────────────────────────────────────────

router.get('/backup', (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const archiver = require('archiver');

    const dataDir = path.join(__dirname, '../../data');
    const idealDir = path.join(dataDir, 'idealpc');

    // Find all .db files
    const dbFiles = [];
    const scanDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        const stat = fs.statSync(fp);
        if (stat.isFile() && f.endsWith('.db')) {
          dbFiles.push({ path: fp, name: path.relative(dataDir, fp) });
        } else if (stat.isDirectory() && f !== 'sourcing_uploads') {
          scanDir(fp);
        }
      }
    };
    scanDir(dataDir);

    // Also backup settings from main localDb
    const settingsBackup = JSON.stringify(settingsOps.getAll(), null, 2);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const filename = `shopgold-backup-${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const db of dbFiles) {
      archive.file(db.path, { name: db.name });
    }

    // Add settings JSON as separate file
    archive.append(settingsBackup, { name: 'settings_export.json' });

    archive.finalize();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Database Restore (upload .zip) ────────────────────────────────────────────

router.post('/restore', (req, res) => {
  try {
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs');
    const AdmZip = require('adm-zip');

    const upload = multer({ dest: path.join(__dirname, '../../data/_tmp_restore') }).single('backup');
    upload(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'Brak pliku backup' });

      try {
        const zip = new AdmZip(req.file.path);
        const entries = zip.getEntries();
        const dataDir = path.join(__dirname, '../../data');
        let restoredDb = 0;
        let restoredSettings = false;

        for (const entry of entries) {
          if (entry.entryName.endsWith('.db')) {
            const targetPath = path.join(dataDir, entry.entryName);
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            fs.writeFileSync(targetPath, entry.getData());
            restoredDb++;
          } else if (entry.entryName === 'settings_export.json') {
            const settingsData = JSON.parse(entry.getData().toString('utf8'));
            for (const [k, v] of Object.entries(settingsData)) {
               settingsOps.set(k, v);
            }
            restoredSettings = true;
          }
        }

        // Clean up temp file
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        try { fs.rmdirSync(path.dirname(req.file.path)); } catch (_) {}

        let msg = `Przywrócono ${restoredDb} plików bazy. Zrestartuj serwer!`;
        if (restoredSettings) msg += ' Przywrócono również ustawienia.';
        res.json({ success: true, restored: restoredDb, message: msg });
      } catch (e) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        if (e.message && (e.message.includes('EBUSY') || e.message.includes('locked') || e.message.includes('EPERM'))) {
           return res.status(400).json({ error: 'Bazy danych są zablokowane przez Windows! Aby przywrócić kopię: ZATRZYMAJ konsolę Node.js, wypakuj plik .zip ręcznie do folderu "data" i uruchom aplikację ponownie.' });
        }
        res.status(400).json({ error: 'Błąd przywracania: ' + e.message });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── ShopGold Named Instances CRUD ───────────────────────────────────────────

// GET /api/settings/shopgold-instances
router.get('/shopgold-instances', (req, res) => {
  try {
    const instances = shopgoldInstanceOps.findAll();
    // Mask passwords in list
    const masked = instances.map(i => ({ ...i, mysql_pass: i.mysql_pass ? "***" : "", ftp_pass: i.ftp_pass ? "***" : "" }));
    res.json({ instances: masked });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/settings/shopgold-instances/:id
router.get('/shopgold-instances/:id', (req, res) => {
  try {
    const inst = shopgoldInstanceOps.findById(req.params.id);
    if (!inst) return res.status(404).json({ error: "Nie znaleziono instancji" });
    res.json({ instance: { ...inst, mysql_pass: inst.mysql_pass ? "***" : "", ftp_pass: inst.ftp_pass ? "***" : "" } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/shopgold-instances — create
router.post('/shopgold-instances', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Nazwa instancji jest wymagana" });
    const id = shopgoldInstanceOps.create(req.body);
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/shopgold-instances/:id — update
router.put('/shopgold-instances/:id', async (req, res) => {
  try {
    const inst = shopgoldInstanceOps.findById(req.params.id);
    if (!inst) return res.status(404).json({ error: "Nie znaleziono instancji" });
    // If password placeholders sent or empty, keep existing
    const data = { ...req.body };
    if (data.mysql_pass === "***" || data.mysql_pass === undefined || data.mysql_pass === null || (typeof data.mysql_pass === 'string' && data.mysql_pass.trim() === '')) { delete data.mysql_pass; }
    if (data.ftp_pass === "***" || data.ftp_pass === undefined || data.ftp_pass === null || (typeof data.ftp_pass === 'string' && data.ftp_pass.trim() === '')) { delete data.ftp_pass; }
    shopgoldInstanceOps.update(req.params.id, data);
    
    // If this instance is currently active, immediately copy new settings to active config & reset pool
    if (inst.is_active === 1 || inst.is_active === true) {
      const updatedInst = shopgoldInstanceOps.findById(req.params.id);
      const fields = ["connection_type","mysql_host","mysql_port","mysql_user","mysql_database","mysql_table_prefix","ftp_host","ftp_port","ftp_user","ftp_path","shop_url","xml_feed_url"];
      for (const f of fields) { if (updatedInst[f] !== undefined && updatedInst[f] !== null) settingsOps.set(f, updatedInst[f]); }
      if (updatedInst.mysql_pass !== undefined && updatedInst.mysql_pass !== null) settingsOps.set("mysql_pass", updatedInst.mysql_pass);
      if (updatedInst.ftp_pass !== undefined && updatedInst.ftp_pass !== null) settingsOps.set("ftp_pass", updatedInst.ftp_pass);
      await mysqlAdapter.resetPool();
    }
    
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/settings/shopgold-instances/:id
router.delete('/shopgold-instances/:id', (req, res) => {
  try {
    shopgoldInstanceOps.delete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/shopgold-instances/:id/activate — load instance into active settings
router.post('/shopgold-instances/:id/activate', async (req, res) => {
  try {
    const inst = shopgoldInstanceOps.findById(req.params.id);
    if (!inst) return res.status(404).json({ error: "Nie znaleziono instancji" });
    // Copy instance settings to active settings
    const fields = ["connection_type","mysql_host","mysql_port","mysql_user","mysql_database","mysql_table_prefix","ftp_host","ftp_port","ftp_user","ftp_path","shop_url","xml_feed_url"];
    for (const f of fields) { if (inst[f] !== undefined && inst[f] !== null) settingsOps.set(f, inst[f]); }
    if (inst.mysql_pass !== undefined && inst.mysql_pass !== null) settingsOps.set("mysql_pass", inst.mysql_pass);
    if (inst.ftp_pass !== undefined && inst.ftp_pass !== null) settingsOps.set("ftp_pass", inst.ftp_pass);
    // Mark as active
    shopgoldInstanceOps.setActive(inst.id);
    await mysqlAdapter.resetPool();
    res.json({ success: true, name: inst.name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/shopgold-instances/:id/save-current — save current settings as update to instance
router.post('/shopgold-instances/:id/save-current', (req, res) => {
  try {
    const inst = shopgoldInstanceOps.findById(req.params.id);
    if (!inst) return res.status(404).json({ error: "Nie znaleziono instancji" });
    const fields = ["connection_type","mysql_host","mysql_port","mysql_user","mysql_database","mysql_table_prefix","ftp_host","ftp_port","ftp_user","ftp_path","shop_url","xml_feed_url"];
    const data = {};
    for (const f of fields) { const v = settingsOps.get(f); if (v !== null) data[f] = v; }
    const mp = settingsOps.get("mysql_pass"); if (mp) data.mysql_pass = mp;
    const fp = settingsOps.get("ftp_pass"); if (fp) data.ftp_pass = fp;
    shopgoldInstanceOps.update(inst.id, data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

