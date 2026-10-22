/* =====================================================================
 * routes/profitability.js — Kalkulator Rentownosci REST API
 * ===================================================================== */
'use strict';

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const svc = require('../services/profitabilityService');

function withDataDir(req) { svc._setDataDir(req.dataDir); }

const UPLOAD_DIR = path.join(__dirname, '../../data/prof_uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random()*1e6) + path.extname(file.originalname)),
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv|pdf)$/i.test(file.originalname);
    cb(ok ? null : new Error('Niedozwolony format. Wymagane: xlsx, xls, csv'), ok);
  },
});
function me(err, req, res, next) {
  if (err) return res.status(400).json({ error: err.message });
  next();
}

// ─── Platforms ──────────────────────────────────────────────────────────────

router.get('/platforms', (req, res) => {
  try { withDataDir(req); res.json(svc.listPlatforms()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/platforms', (req, res) => {
  try { withDataDir(req);
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Podaj nazwe platformy' });
    res.json(svc.addPlatform({ name, color, icon }));
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.patch('/platforms/:id', (req, res) => {
  try { withDataDir(req); svc.updatePlatform(parseInt(req.params.id), req.body); res.json({ ok: true }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

router.delete('/platforms/:id', (req, res) => {
  try { withDataDir(req); svc.deletePlatform(parseInt(req.params.id)); res.json({ ok: true }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// ─── Commissions ────────────────────────────────────────────────────────────

router.post('/platforms/:id/commissions', (req, res) => {
  try { withDataDir(req);
    const { category_name, rate_pct, min_fee, max_fee } = req.body;
    res.json(svc.addCommission(parseInt(req.params.id), { category_name, rate_pct, min_fee, max_fee }));
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.patch('/commissions/:id', (req, res) => {
  try { withDataDir(req); svc.updateCommission(parseInt(req.params.id), req.body); res.json({ ok: true }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

router.delete('/commissions/:id', (req, res) => {
  try { withDataDir(req); svc.deleteCommission(parseInt(req.params.id)); res.json({ ok: true }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// Import commission file (legacy — column heuristics)
router.post('/platforms/:id/commissions/import',
  (req, res, next) => upload.single('file')(req, res, err => me(err, req, res, next)),
  async (req, res) => {
    try { withDataDir(req);
      if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
      const buf = fs.readFileSync(req.file.path);
      const r = await svc.importCommissionsFile(buf, req.file.originalname, parseInt(req.params.id));
      fs.unlink(req.file.path, () => {});
      res.json({ success: true, ...r });
    } catch(e) { res.status(400).json({ error: e.message }); }
  }
);

// AI Import — dwa pliki: Plik1 (produkt→kategoria) + Plik2 (kategoria→prowizja)
const uploadFields = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv|pdf)$/i.test(file.originalname);
    cb(ok ? null : new Error('Niedozwolony format. Wymagane: xlsx, xls, csv, pdf'), ok);
  },
}).fields([
  { name: 'categories', maxCount: 1 },
  { name: 'commissions', maxCount: 1 },
]);

router.post('/platforms/:id/ai-import',
  (req, res, next) => uploadFields(req, res, err => me(err, req, res, next)),
  async (req, res) => {
    try {
      withDataDir(req);
      const catFile  = req.files?.['categories']?.[0];
      const commFile = req.files?.['commissions']?.[0];
      if (!catFile)  return res.status(400).json({ error: 'Brak Pliku 1 (produkt→kategoria)' });
      if (!commFile) return res.status(400).json({ error: 'Brak Pliku 2 (kategoria→prowizja)' });

      const catBuf  = fs.readFileSync(catFile.path);
      const commBuf = fs.readFileSync(commFile.path);
      const platform_id = parseInt(req.params.id);

      const result = await svc.aiImportPlatformFiles(
        platform_id,
        catBuf,  catFile.originalname,
        commBuf, commFile.originalname
      );

      fs.unlink(catFile.path,  () => {});
      fs.unlink(commFile.path, () => {});
      res.json({ success: true, ...result });
    } catch(e) {
      res.status(400).json({ error: e.message });
    }
  }
);

router.delete('/platforms/:id/commissions', (req, res) => {
  try { withDataDir(req); svc.deleteAllPlatformCommissions(parseInt(req.params.id)); res.json({ ok: true }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// ─── Platform Shipping Surcharges ───────────────────────────────────────────

router.get('/platforms/:id/shipping', (req, res) => {
  try { withDataDir(req); res.json(svc.listPlatformShipping(parseInt(req.params.id))); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/platforms/:id/shipping', (req, res) => {
  try { withDataDir(req); res.json(svc.addPlatformShipping(parseInt(req.params.id), req.body)); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

router.patch('/platform-shipping/:id', (req, res) => {
  try { withDataDir(req); svc.updatePlatformShipping(parseInt(req.params.id), req.body); res.json({ ok: true }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

router.delete('/platform-shipping/:id', (req, res) => {
  try { withDataDir(req); svc.deletePlatformShipping(parseInt(req.params.id)); res.json({ ok: true }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

router.delete('/platforms/:id/shipping', (req, res) => {
  try { withDataDir(req); svc.deleteAllPlatformShipping(parseInt(req.params.id)); res.json({ ok: true }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// Import shipping surcharges from file
router.post('/platforms/:id/shipping/import',
  (req, res, next) => upload.single('file')(req, res, err => me(err, req, res, next)),
  async (req, res) => {
    try { withDataDir(req);
      if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
      const buf = fs.readFileSync(req.file.path);
      const r = await svc.importShippingFile(buf, req.file.originalname, parseInt(req.params.id));
      fs.unlink(req.file.path, () => {});
      res.json({ success: true, ...r });
    } catch(e) { res.status(400).json({ error: e.message }); }
  }
);

router.post('/platforms/:id/ai-import-shipping',
  (req, res, next) => upload.single('file')(req, res, err => me(err, req, res, next)),
  async (req, res) => {
    try { withDataDir(req);
      if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
      const buf = fs.readFileSync(req.file.path);
      const r = await svc.aiImportShippingFile(buf, req.file.originalname, parseInt(req.params.id));
      fs.unlink(req.file.path, () => {});
      res.json({ success: true, ...r });
    } catch(e) { res.status(400).json({ error: e.message }); }
  }
);

// ─── Settings ───────────────────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  try { withDataDir(req); res.json(svc.getSettings()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/settings', (req, res) => {
  try { withDataDir(req); svc.updateSettings(req.body); res.json(svc.getSettings()); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// ─── Products ───────────────────────────────────────────────────────────────

router.get('/products', (req, res) => {
  try { withDataDir(req);
    res.json(svc.listProducts({
      search:       req.query.search || '',
      manufacturer: req.query.manufacturer || '',
      sortCol:      req.query.sortCol || 'name',
      sortDir:      req.query.sortDir || 'asc',
      limit:        parseInt(req.query.limit)  || 300,
      offset:       parseInt(req.query.offset) || 0,
    }));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/products', (req, res) => {
  try { withDataDir(req);
    const r = svc.addProduct(req.body);
    res.json({ success: true, ...r });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.patch('/products/:id', (req, res) => {
  try { withDataDir(req); svc.updateProduct(parseInt(req.params.id), req.body); res.json({ ok: true }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

router.delete('/products/:id', (req, res) => {
  try { withDataDir(req); svc.deleteProduct(parseInt(req.params.id)); res.json({ ok: true }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

// Import from Subiekt
router.post('/products/import-subiekt',
  (req, res, next) => upload.single('file')(req, res, err => me(err, req, res, next)),
  async (req, res) => {
    try { withDataDir(req);
      if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
      const buf = fs.readFileSync(req.file.path);
      const r = svc.importSubiektProducts(buf, req.file.originalname);
      fs.unlink(req.file.path, () => {});
      res.json({ success: true, ...r });
    } catch(e) { res.status(400).json({ error: e.message }); }
  }
);

// Import supplier price update
router.post('/products/import-supplier',
  (req, res, next) => upload.single('file')(req, res, err => me(err, req, res, next)),
  async (req, res) => {
    try { withDataDir(req);
      if (!req.file) return res.status(400).json({ error: 'Brak pliku' });
      const buf = fs.readFileSync(req.file.path);
      const r = svc.importSupplierProducts(buf, req.file.originalname);
      fs.unlink(req.file.path, () => {});
      res.json({ success: true, ...r });
    } catch(e) { res.status(400).json({ error: e.message }); }
  }
);

// Product-platform price override (uses EAN)
router.post('/platforms/:id/sync-sellasist', async (req, res) => {
  try {
    withDataDir(req);
    const r = await svc.syncSellasistCategories(parseInt(req.params.id));
    res.json({ success: true, ...r });
  } catch(e) { 
    res.status(400).json({ error: e.message }); 
  }
});

router.post('/products/:ean/platform/:pid', (req, res) => {
  try { withDataDir(req);
    svc.setProductPlatformOverride(req.params.ean, parseInt(req.params.pid), req.body);
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// ─── Simulator ──────────────────────────────────────────────────────────────

router.get('/simulator', (req, res) => {
  try { withDataDir(req);
    console.time('[Simulator] getSimulatorData');
    console.log('[Simulator] Request received, limit:', req.query.limit, 'offset:', req.query.offset);
    const data = svc.getSimulatorData({
      search:       req.query.search  || '',
      manufacturer: req.query.manufacturer || '',
      category:     req.query.category || '',
      alertsOnly:   req.query.alertsOnly || false,
      sortCol:      req.query.sortCol || 'name',
      sortDir:      req.query.sortDir || 'asc',
      limit:        parseInt(req.query.limit)  || 300,
      offset:       parseInt(req.query.offset) || 0,
      min_margin:   req.query.min_margin ? parseFloat(req.query.min_margin) : null,
    });
    console.timeEnd('[Simulator] getSimulatorData');
    console.log('[Simulator] Returning', data.rows.length, 'rows of', data.total);
    res.json(data);
  } catch(e) { console.error('[Simulator] Error:', e.message); res.status(500).json({ error: e.message }); }
});

router.get('/simulator/export.csv', (req, res) => {
  try { withDataDir(req);
    const csv = svc.exportSimulatorCsv({ search: req.query.search || '' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rentownosc.csv"');
    res.send(csv);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
