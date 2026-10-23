require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const config = require('./config');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// PUBLIC: Build category tree from AB — dedup + keyword matching for non-AB products
app.post('/api/generate-categories', (req, res) => {
  try {
    const svc = require('./services/sourcingService');
    const catalogSvc = require('./services/catalogService');
    const db = svc.getDb();
    const result = catalogSvc.generateAbCategoryTree(db);
    try { require('./routes/sourcing')._clearSourcingCache(); } catch (_) {}
    return res.json(result);
  } catch (e) { res.status(500).json({ error: e.message, stack: e.stack }); }
});

// Public debug endpoint for Sellasist weight investigation
app.get('/api/debug-sellasist/:ean', async (req, res) => {
  try {
    const sellasistService = require('./services/sellasistService');
    const ean = req.params.ean;
    
    // Search by EAN (use dedicated ean parameter per API docs, fallback to search)
    let searchData = await sellasistService.fetchApi(`/products?ean=${ean}`);
    let products = Array.isArray(searchData) ? searchData : (searchData.items || searchData.data || searchData.products || []);
    
    // Fallback to generic search if ean= didn't work
    if (!products.length) {
      searchData = await sellasistService.fetchApi(`/products?search=${ean}`);
      products = Array.isArray(searchData) ? searchData : (searchData.items || searchData.data || searchData.products || []);
    }
    
    // Check catalog_master
    let localRow = null;
    try {
      const db = require('./services/sourcingService').getDb();
      localRow = db.prepare('SELECT canonical_ean, weight_g, weight_source FROM catalog_master WHERE canonical_ean = ? OR all_eans LIKE ?').get(ean, `%"${ean}"%`);
    } catch(_) {}
    
    if (!products.length) {
      return res.json({ error: 'NOT_FOUND_IN_SELLASIST', ean, note: 'Ten EAN nie istnieje w Sellasist. Waga musi pochodzić z feedu hurtowni.', local_catalog_master: localRow || 'NOT_IN_DB' });
    }
    
    // Check if the search returned the RIGHT product
    const basic = products[0];
    const basicEan = (basic.ean || '').toString().trim();
    const exactMatch = basicEan === ean;
    
    // Also check additional_eans from the basic listing
    const basicAdditionalEans = (basic.additional_eans || []).map(e => typeof e === 'string' ? e : (e.ean || e.code || '')).map(e => e.toString().trim());
    const inAdditional = basicAdditionalEans.includes(ean);
    
    let extended = null;
    if (exactMatch || inAdditional) {
      extended = await sellasistService.fetchApi(`/products/${basic.id}`);
    }
    
    const result = {
      ean_searched: ean,
      search_matched_correctly: exactMatch || inAdditional,
      warning: (!exactMatch && !inAdditional) 
        ? `⚠️ Sellasist search dla "${ean}" zwrócił INNY produkt (EAN: ${basicEan}). Ten EAN prawdopodobnie NIE ISTNIEJE w Sellasist. Waga musi pochodzić z feedu hurtowni.`
        : null,
      sellasist_product: {
        id: basic.id,
        ean: basicEan,
        name: basic.name,
        in_additional_eans: inAdditional,
        weight: extended?.weight || 'nie pobrano (złe dopasowanie)',
        additional_eans: basic.additional_eans,
      },
      local_catalog_master: localRow || 'NOT_IN_DB',
    };
    
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message, stack: e.stack?.split('\n').slice(0,3) });
  }
});

// Public force-fix endpoint — directly updates weight for a specific EAN
app.get('/api/debug-sellasist-fix/:ean', async (req, res) => {
  try {
    const sellasistService = require('./services/sellasistService');
    const ean = req.params.ean;
    const steps = [];
    
    // Step 1: Find in Sellasist
    steps.push('Step 1: Searching Sellasist with ean= parameter...');
    let data = await sellasistService.fetchApi(`/products?ean=${ean}`);
    let products = Array.isArray(data) ? data : (data.items || data.data || data.products || []);
    steps.push(`  Found ${products.length} products with ean= parameter`);
    
    if (!products.length) {
      data = await sellasistService.fetchApi(`/products?search=${ean}`);
      products = Array.isArray(data) ? data : (data.items || data.data || data.products || []);
      steps.push(`  Fallback search= found ${products.length} products`);
    }
    
    if (!products.length) {
      return res.json({ error: 'NOT_FOUND', ean, steps });
    }
    
    const basic = products[0];
    steps.push(`  Product ID: ${basic.id}, EAN: ${basic.ean}, Name: ${basic.name}`);
    
    // Step 2: Get extended details with weight
    steps.push('Step 2: Fetching extended product details...');
    const extended = await sellasistService.fetchApi(`/products/${basic.id}`);
    const rawWeight = extended.weight;
    steps.push(`  extended.weight = "${rawWeight}" (type: ${typeof rawWeight})`);
    
    // Parse weight
    function parseWeight(val) {
      if (typeof val === 'number') return val || 0;
      if (!val) return 0;
      return parseFloat(String(val).replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
    }
    
    const weightKg = parseWeight(rawWeight);
    const weightGrams = Math.round(weightKg * 1000);
    steps.push(`  Parsed: ${weightKg} kg = ${weightGrams} grams`);
    
    // Step 3: Check DB state before
    const db = require('./services/sourcingService').getDb();
    const before = db.prepare('SELECT id, canonical_ean, all_eans, weight_g, weight_source FROM catalog_master WHERE canonical_ean = ?').get(ean);
    steps.push('Step 3: DB state BEFORE update:');
    steps.push(`  ${JSON.stringify(before || 'NOT_FOUND')}`);
    
    if (!before) {
      // Try LIKE search
      const beforeLike = db.prepare('SELECT id, canonical_ean, all_eans, weight_g, weight_source FROM catalog_master WHERE all_eans LIKE ?').get(`%${ean}%`);
      steps.push(`  LIKE search: ${JSON.stringify(beforeLike || 'NOT_FOUND')}`);
    }
    
    // Step 4: Force update
    if (weightGrams > 0) {
      steps.push(`Step 4: Running UPDATE canonical_ean = "${ean}" → weight_g = ${weightGrams}...`);
      let res1 = db.prepare(`UPDATE catalog_master SET weight_g = ?, weight_source = 'sellasist' WHERE canonical_ean = ?`).run(weightGrams, ean);
      steps.push(`  UPDATE by canonical_ean: ${res1.changes} rows changed`);
      
      if (res1.changes === 0) {
        let res2 = db.prepare(`UPDATE catalog_master SET weight_g = ?, weight_source = 'sellasist' WHERE all_eans LIKE ?`).run(weightGrams, `%"${ean}"%`);
        steps.push(`  UPDATE by all_eans LIKE '%"${ean}"%': ${res2.changes} rows changed`);
        
        if (res2.changes === 0) {
          let res3 = db.prepare(`UPDATE catalog_master SET weight_g = ?, weight_source = 'sellasist' WHERE all_eans LIKE ?`).run(weightGrams, `%${ean}%`);
          steps.push(`  UPDATE by all_eans LIKE '%${ean}%': ${res3.changes} rows changed`);
        }
      }
    }
    
    // Step 5: Check DB state after
    const after = db.prepare('SELECT id, canonical_ean, all_eans, weight_g, weight_source FROM catalog_master WHERE canonical_ean = ?').get(ean);
    steps.push('Step 5: DB state AFTER update:');
    steps.push(`  ${JSON.stringify(after || 'NOT_FOUND')}`);
    
    res.json({ ean, weightGrams, steps });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PUBLIC: Supplier file preview (column detection debug) — before auth
app.get('/api/sourcing/suppliers/:id/file-preview', (req, res) => {
  try {
    const svcDebug = require('./services/sourcingService');
    const db = svcDebug.getDb();
    const iconv = require('iconv-lite');
    const fsD = require('fs');

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(parseInt(req.params.id));
    if (!supplier) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });
    if (!supplier.file_path || !fsD.existsSync(supplier.file_path)) {
      return res.json({ error: 'Brak pliku na dysku', supplier_name: supplier.name, source_type: supplier.source_type });
    }

    const buf = fsD.readFileSync(supplier.file_path);
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
    const first = lines[0] || '';
    const tabC = (first.match(/\t/g)||[]).length;
    const semC = (first.match(/;/g)||[]).length;
    const comC = (first.match(/,/g)||[]).length;
    const pipC = (first.match(/\|/g)||[]).length;
    let sep = ',', sepName = 'COMMA';
    if (tabC >= 2 && tabC >= semC && tabC >= comC) { sep = '\t'; sepName = 'TAB'; }
    else if (pipC >= 2 && pipC >= semC && pipC >= comC) { sep = '|'; sepName = 'PIPE'; }
    else if (semC >= comC) { sep = ';'; sepName = 'SEMICOLON'; }

    const split = l => sep === '\t' ? l.split('\t').map(c=>c.trim()) : l.split(sep).map(c=>c.trim().replace(/^"|"$/g,''));
    const headers = split(lines[0]);
    const rows = lines.slice(1,4).map(l => split(l));

    res.json({ supplier_name: supplier.name, file_path: supplier.file_path,
      file_size_kb: Math.round(buf.length/1024), encoding, separator: sepName,
      total_columns: headers.length, headers, sample_rows: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUBLIC: ESET XML Export for ShopGold
app.get('/api/eset/export-xml', async (req, res) => {
    try {
        const { Builder } = require('xml2js');
        const dagmaService = require('./services/dagmaService');
        // Pobieramy kilka stron katalogu lub jedną główną (dla uproszczenia pierwszą stronę, ok 30 produktów)
        const catalog = await dagmaService.getProducts(1);
        const products = catalog['hydra:member'].filter(p => !p.isDiscontinued);

        const xmlObj = {
            offers: {
                offer: products.map(p => {
                    const price = p.id.includes('HOME') ? 129.00 : 0.00;
                    return {
                        id: [p.id],
                        name: [p.name],
                        price: [price],
                        categoryId: ['ESET'],
                        description: [`Oprogramowanie antywirusowe ESET. Kategoria: ${p.category?.name || 'Brak'}`],
                        producer: ['ESET'],
                        avail: ['1']
                    };
                })
            }
        };

        const builder = new Builder({ cdata: true });
        const xml = builder.buildObject(xmlObj);

        res.header('Content-Type', 'application/xml; charset=utf-8');
        res.attachment('eset_products.xml');
        res.send(xml);

    } catch (error) {
        console.error('[server] GET /api/eset/export-xml error:', error);
        res.status(500).json({ error: 'Failed to generate XML' });
    }
});

// Company + Auth middleware (applied to all /api routes)
app.use(require('./middleware/company'));
app.use(require('./middleware/auth'));




// Serve frontend (disable cache in dev so changes are immediate)
app.use(express.static(path.join(__dirname, '../frontend'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    // Ensure UTF-8 charset for JS and CSS so emoji render correctly in browsers
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));

// Global API 500 error logger middleware
app.use((req, res, next) => {
  const originalStatus = res.status;
  const originalJson = res.json;
  const originalSend = res.send;
  let statusCode = 200;

  res.status = function(code) {
    statusCode = code;
    return originalStatus.apply(this, arguments);
  };

  res.json = function(obj) {
    if (statusCode === 500 && obj && (obj.error || obj.message)) {
      try {
        const { syncLogOps } = require('./models/localDb');
        syncLogOps.add({
          action: `${req.method} ${req.path}`,
          level: 'error',
          result: `API Error ${statusCode} in ${req.method} ${req.originalUrl}`,
          error: obj.error || obj.message || JSON.stringify(obj),
        });
      } catch(_) {}
    }
    return originalJson.apply(this, arguments);
  };

  res.send = function(body) {
    if (statusCode === 500) {
      let errMsg = body;
      if (typeof body === 'string') {
        try {
          const parsed = JSON.parse(body);
          errMsg = parsed.error || parsed.message || body;
        } catch(_) {}
      }
      try {
        const { syncLogOps } = require('./models/localDb');
        syncLogOps.add({
          action: `${req.method} ${req.path}`,
          level: 'error',
          result: `API Error ${statusCode} in ${req.method} ${req.originalUrl}`,
          error: errMsg,
        });
      } catch(_) {}
    }
    return originalSend.apply(this, arguments);
  };

  next();
});

// Auth routes (public — no auth required for login)
app.use('/api/auth', require('./routes/auth'));

// API Routes
app.use('/api/products', require('./routes/products'));
app.use('/api/cms', require('./routes/cms'));
app.use('/api/approval', require('./routes/approval'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/seo', require('./routes/seo'));
app.use('/api/sourcing', require('./routes/sourcing'));
app.use('/api/profitability', require('./routes/profitability'));
app.use('/api/owui', require('./routes/openwebui'));
app.use('/api/chat', require('./routes/chatFeatures'));
app.use('/api/sellasist', require('./routes/sellasist'));
app.use('/api/bloger', require('./routes/bloger'));
app.use('/api/grafiker', require('./routes/grafiker'));
app.use('/api/mailer', require('./routes/mailer'));
app.use('/api/email-offers', require('./routes/emailMonitor'));
app.use('/api/oferter', require('./routes/oferter'));
app.use('/api/crm', require('./routes/crm'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/eset', require('./routes/dagmaRoutes'));

// TEMP: one-shot repair for corrupted sourcing.js
app.get('/api/repair-sourcing', (req, res) => {
  try {
    const fs = require('fs');
    const filePath = path.join(__dirname, '../frontend/js/sourcing.js');
    let src = fs.readFileSync(filePath, 'utf8');
    const MARKER = '    ${supCols}';
    const first = src.indexOf(MARKER);
    const second = src.indexOf(MARKER, first + MARKER.length);
    if (first < 0 || second < 0) {
      return res.json({ ok: false, msg: 'Marker not found or already fixed', occurrences: (src.match(/\$\{supCols\}/g)||[]).length });
    }
    const before = src.slice(0, first + MARKER.length);
    const after  = src.slice(second);
    const fixed  = before + '\n' + after;
    // Validate
    try { new Function(fixed); } catch(e) {
      return res.json({ ok: false, msg: 'Syntax error after repair: ' + e.message });
    }
    fs.writeFileSync(filePath, fixed, 'utf8');
    const lines = fixed.split('\n').length;
    res.json({ ok: true, msg: 'Naprawiono!', lines, occurrences: 1 });
  } catch(e) { res.status(500).json({ ok: false, msg: e.message }); }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Global error handler — also logs to sync_log for visibility in Logs tab
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  try {
    const { syncLogOps } = require('./models/localDb');
    syncLogOps.add({
      action: `${req.method} ${req.path}`,
      level: 'error',
      result: `Unhandled error in ${req.method} ${req.originalUrl}`,
      error: err.message,
    });
  } catch(_) { /* don't fail if DB is unavailable */ }
  res.status(500).json({ error: err.message || 'Wewnętrzny błąd serwera' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Serwer działa na http://localhost:${PORT}`);
  console.log(`👉 Panel Sourcingu: http://localhost:${PORT}/#sourcing\n`);

  console.log(`   Środowisko: ${config.app.env}`);
  console.log(`   AI Provider: ${config.ai.provider}`);
  console.log(`   Połączenie ShopGold: ${config.shopgold.connectionType}\n`);
  // Start backlink cron job
  const { startBacklinkCron } = require('./services/backlinkChecker');
  startBacklinkCron();
  // Start wholesaler auto-refresh scheduler
  const scheduler = require('./services/schedulerService');
  scheduler.initScheduler();
  scheduler.reloadEmailMonitorSchedule();
});

module.exports = app;
