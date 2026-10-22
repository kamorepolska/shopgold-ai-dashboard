/* =====================================================================
 * profitabilityService.js — Kalkulator Rentownosci Engine
 * ===================================================================== */
'use strict';

const path = require('path');
const XLSX = require('xlsx');
const aiService = require('./aiService');



let _overrideDataDir = null;
function _setDataDir(dir) { _overrideDataDir = dir; }
function _getEffectiveDataDir() {
  const d = _overrideDataDir;
  _overrideDataDir = null;
  return d || require('path').join(__dirname, '../../data/idealpc');
}
const _dbCache = new Map();
function getDb(dataDir) {
  if (!dataDir) dataDir = _getEffectiveDataDir();
  if (_dbCache.has(dataDir)) return _dbCache.get(dataDir);
  const Database = require('better-sqlite3');
  require('fs').mkdirSync(dataDir, { recursive: true });
  const db = new Database(require('path').join(dataDir, 'profitability.db'));
  db.pragma('journal_mode = WAL');
  
  try {
    const sourcingDbPath = require('path').join(dataDir, 'shopgold_cache.db');
    db.prepare(`ATTACH DATABASE '${sourcingDbPath}' AS sourcing`).run();
  } catch (e) {
    console.error('Failed to attach sourcing db:', e);
  }

  initSchema(db);
  _dbCache.set(dataDir, db);
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prof_platforms (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      name                 TEXT NOT NULL UNIQUE,
      color                TEXT DEFAULT '#6366f1',
      icon                 TEXT DEFAULT '🛒',
      active               INTEGER DEFAULT 1,
      shipping_default     REAL DEFAULT NULL,
      packing_cost         REAL DEFAULT NULL,
      payment_fee_pct      REAL DEFAULT NULL,
      commission_on_shipping INTEGER DEFAULT 1,
      created_at           TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prof_commissions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id   INTEGER NOT NULL REFERENCES prof_platforms(id) ON DELETE CASCADE,
      category_name TEXT NOT NULL DEFAULT 'Ogolna',
      rate_pct      REAL NOT NULL DEFAULT 8.0,
      min_fee       REAL DEFAULT 0,
      max_fee       REAL DEFAULT NULL,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prof_settings (
      id                   INTEGER PRIMARY KEY CHECK(id=1),
      shipping_default     REAL DEFAULT 9.99,
      packing_cost         REAL DEFAULT 2.50,
      payment_fee_pct      REAL DEFAULT 1.5,
      min_margin_alert_pct REAL DEFAULT 5.0,
      shipping_zones       TEXT DEFAULT '[]',
      updated_at           TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prof_products (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ean        TEXT,
      name       TEXT NOT NULL,
      buy_price  REAL DEFAULT 0,
      sell_price REAL DEFAULT 0,
      weight_g   REAL DEFAULT 0,
      size_l     REAL DEFAULT 0,
      size_w     REAL DEFAULT 0,
      size_h     REAL DEFAULT 0,
      source     TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pp_ean ON prof_products(ean);

    CREATE TABLE IF NOT EXISTS prof_product_platforms (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id          INTEGER NOT NULL REFERENCES prof_products(id) ON DELETE CASCADE,
      platform_id         INTEGER NOT NULL REFERENCES prof_platforms(id) ON DELETE CASCADE,
      sell_price_override REAL DEFAULT NULL,
      commission_id       INTEGER REFERENCES prof_commissions(id),
      UNIQUE(product_id, platform_id)
    );

    CREATE TABLE IF NOT EXISTS prof_platform_shipping (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL REFERENCES prof_platforms(id) ON DELETE CASCADE,
      label       TEXT NOT NULL DEFAULT 'Standard',
      min_weight_g REAL DEFAULT 0,
      max_weight_g REAL DEFAULT 99999,
      surcharge   REAL DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  try {
    db.exec(`ALTER TABLE prof_product_platforms ADD COLUMN ean TEXT`);
    db.exec(`UPDATE prof_product_platforms SET ean = (SELECT ean FROM prof_products WHERE id = prof_product_platforms.product_id)`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ppp_ean_plat ON prof_product_platforms(ean, platform_id)`);
  } catch {}

  // Ensure default settings row
  db.prepare(`
    INSERT OR IGNORE INTO prof_settings (id, shipping_default, packing_cost, payment_fee_pct, min_margin_alert_pct)
    VALUES (1, 9.99, 2.50, 1.5, 5.0)
  `).run();

  // Seed common platforms if empty
  const count = db.prepare('SELECT COUNT(*) as n FROM prof_platforms').get().n;
  if (count === 0) {
    const platforms = [
      { name: 'Allegro',  color: '#f97316', icon: '🛍️' },
      { name: 'Erli',     color: '#10b981', icon: '🟢' },
      { name: 'Empik',    color: '#8b5cf6', icon: '📚' },
      { name: 'Ceneo',    color: '#3b82f6', icon: '💙' },
      { name: 'Sklep WWW',color: '#6366f1', icon: '🌐' },
    ];
    const ins = db.prepare('INSERT INTO prof_platforms (name, color, icon) VALUES (?,?,?)');
    const insC = db.prepare("INSERT INTO prof_commissions (platform_id, category_name, rate_pct) VALUES (?,?,?)");
    const defRates = { Allegro: 8.0, Erli: 8.5, Empik: 15.0, Ceneo: 5.0, 'Sklep WWW': 2.0 };
    db.transaction(() => {
      platforms.forEach(p => {
        const res = ins.run(p.name, p.color, p.icon);
        insC.run(res.lastInsertRowid, 'Ogolna', defRates[p.name] || 8.0);
      });
    })();
  }
}

// ─── PLATFORMS ──────────────────────────────────────────────────────────────

function listPlatforms() {
  const db = getDb();
  // Ensure new columns exist (migration for existing DBs)
  try {
    db.exec(`ALTER TABLE prof_platforms ADD COLUMN shipping_default REAL DEFAULT NULL`);
  } catch {}
  try {
    db.exec(`ALTER TABLE prof_platforms ADD COLUMN packing_cost REAL DEFAULT NULL`);
  } catch {}
  try {
    db.exec(`ALTER TABLE prof_platforms ADD COLUMN payment_fee_pct REAL DEFAULT NULL`);
  } catch {}
  try {
    db.exec(`ALTER TABLE prof_platforms ADD COLUMN commission_on_shipping INTEGER DEFAULT 1`);
  } catch {}
  const platforms = db.prepare('SELECT * FROM prof_platforms ORDER BY name').all();
  return platforms.map(p => ({
    ...p,
    commission_on_shipping: p.commission_on_shipping == null ? 1 : p.commission_on_shipping,
    commissions: db.prepare('SELECT * FROM prof_commissions WHERE platform_id = ? ORDER BY category_name').all(p.id),
  }));
}

function addPlatform({ name, color = '#6366f1', icon = '🛒', shipping_default = null, packing_cost = null, payment_fee_pct = null, commission_on_shipping = 1 }) {
  const db = getDb();
  const res = db.prepare('INSERT INTO prof_platforms (name, color, icon, shipping_default, packing_cost, payment_fee_pct, commission_on_shipping) VALUES (?,?,?,?,?,?,?)').run(name, color, icon, shipping_default, packing_cost, payment_fee_pct, commission_on_shipping ? 1 : 0);
  db.prepare("INSERT INTO prof_commissions (platform_id, category_name, rate_pct) VALUES (?,?,?)").run(res.lastInsertRowid, 'Ogolna', 8.0);
  return { id: res.lastInsertRowid };
}

function updatePlatform(id, { name, color, icon, active, shipping_default, packing_cost, payment_fee_pct, commission_on_shipping }) {
  const db = getDb();
  const fields = [], vals = [];
  if (name             !== undefined) { fields.push('name=?');             vals.push(name); }
  if (color            !== undefined) { fields.push('color=?');            vals.push(color); }
  if (icon             !== undefined) { fields.push('icon=?');             vals.push(icon); }
  if (active           !== undefined) { fields.push('active=?');           vals.push(active ? 1 : 0); }
  if (shipping_default !== undefined) { fields.push('shipping_default=?'); vals.push(shipping_default === '' ? null : shipping_default); }
  if (packing_cost     !== undefined) { fields.push('packing_cost=?');     vals.push(packing_cost === '' ? null : packing_cost); }
  if (payment_fee_pct  !== undefined) { fields.push('payment_fee_pct=?');  vals.push(payment_fee_pct === '' ? null : payment_fee_pct); }
  if (commission_on_shipping !== undefined) { fields.push('commission_on_shipping=?'); vals.push(commission_on_shipping ? 1 : 0); }
  if (!fields.length) return;
  db.prepare(`UPDATE prof_platforms SET ${fields.join(',')} WHERE id=?`).run(...vals, id);
}

function deletePlatform(id) {
  getDb().prepare('DELETE FROM prof_platforms WHERE id=?').run(id);
}

// ─── COMMISSIONS ────────────────────────────────────────────────────────────

function addCommission(platform_id, { category_name, rate_pct, min_fee = 0, max_fee = null }) {
  const db = getDb();
  const res = db.prepare('INSERT INTO prof_commissions (platform_id, category_name, rate_pct, min_fee, max_fee) VALUES (?,?,?,?,?)')
    .run(platform_id, category_name, rate_pct, min_fee, max_fee);
  return { id: res.lastInsertRowid };
}

function updateCommission(id, { category_name, rate_pct, min_fee, max_fee }) {
  const db = getDb();
  const fields = [], vals = [];
  if (category_name !== undefined) { fields.push('category_name=?'); vals.push(category_name); }
  if (rate_pct      !== undefined) { fields.push('rate_pct=?');      vals.push(rate_pct); }
  if (min_fee       !== undefined) { fields.push('min_fee=?');       vals.push(min_fee); }
  if (max_fee       !== undefined) { fields.push('max_fee=?');       vals.push(max_fee); }
  if (!fields.length) return;
  db.prepare(`UPDATE prof_commissions SET ${fields.join(',')} WHERE id=?`).run(...vals, id);
}

function deleteCommission(id) {
  getDb().prepare('DELETE FROM prof_commissions WHERE id=?').run(id);
}

function deleteAllPlatformCommissions(platform_id) {
  getDb().prepare('DELETE FROM prof_commissions WHERE platform_id=?').run(platform_id);
}

// ─── PLATFORM SHIPPING SURCHARGES ───────────────────────────────────────────

function listPlatformShipping(platform_id) {
  return getDb().prepare('SELECT * FROM prof_platform_shipping WHERE platform_id=? ORDER BY min_weight_g').all(platform_id);
}

function addPlatformShipping(platform_id, { label = 'Standard', min_weight_g = 0, max_weight_g = 99999, surcharge = 0 }) {
  const db = getDb();
  const res = db.prepare('INSERT INTO prof_platform_shipping (platform_id,label,min_weight_g,max_weight_g,surcharge) VALUES (?,?,?,?,?)').run(platform_id, label, min_weight_g, max_weight_g, surcharge);
  return { id: res.lastInsertRowid };
}

function updatePlatformShipping(id, data) {
  const db = getDb();
  const allowed = ['label','min_weight_g','max_weight_g','surcharge'];
  const fields = [], vals = [];
  for (const [k,v] of Object.entries(data)) {
    if (!allowed.includes(k)) continue;
    fields.push(`${k}=?`); vals.push(v);
  }
  if (!fields.length) return;
  db.prepare(`UPDATE prof_platform_shipping SET ${fields.join(',')} WHERE id=?`).run(...vals, id);
}

function deletePlatformShipping(id) {
  getDb().prepare('DELETE FROM prof_platform_shipping WHERE id=?').run(id);
}

function deleteAllPlatformShipping(platform_id) {
  getDb().prepare('DELETE FROM prof_platform_shipping WHERE platform_id=?').run(platform_id);
}

/**
 * Import shipping surcharges from xlsx/csv buffer.
 * Detects columns: etykieta/label, min_waga, max_waga, doplata/surcharge.
 */
async function importShippingFile(buffer, fileName, platform_id) {
  const isExcel = /\.(xlsx|xls)$/i.test(fileName);
  const isPdf = /\.pdf$/i.test(fileName);
  let rows = [];
  if (isExcel) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  } else if (isPdf) {
    const pdf = require('pdf-parse');
    const data = await pdf(buffer);
    const lines = data.text.split(/\r?\n/).filter(l => l.trim());
    const headers = ['Kolumna1', 'Kolumna2', 'Kolumna3', 'Kolumna4'];
    rows = lines.map(line => {
      const parts = line.split(/\s{2,}|\t/).map(p => p.trim());
      const obj = {};
      for (let i = 0; i < headers.length; i++) obj[headers[i]] = parts[i] || '';
      return obj;
    });
  } else {
    const str = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = str.split(/\r?\n/).filter(l => l.trim());
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(sep);
      const obj = {};
      headers.forEach((h, hi) => { obj[h] = (vals[hi] || '').trim(); });
      rows.push(obj);
    }
  }

  function nk(h) { return String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_\-\.]+/g,'_'); }
  function findCol(keys, aliases) {
    for (const a of aliases) {
      const k = keys.find(k => nk(k) === a || nk(k).includes(a));
      if (k) return k;
    }
    return null;
  }

  const rawKeys  = Object.keys(rows[0] || {});
  const labelCol = findCol(rawKeys, ['etykieta','label','nazwa','name','opis','description']);
  const minCol   = findCol(rawKeys, ['min_waga','min_weight','min_wag','waga_od','od','min']);
  const maxCol   = findCol(rawKeys, ['max_waga','max_weight','max_wag','waga_do','do','max']);
  const surCol   = findCol(rawKeys, ['doplata','surcharge','cena','price','koszt','cost','kwota']);

  if (!surCol) throw new Error(`Nie znaleziono kolumny dopłaty. Dostępne: ${rawKeys.join(', ')}`);

  const db = getDb();
  const cleanNum = v => parseFloat(String(v || '0').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;

  const ins = db.prepare('INSERT INTO prof_platform_shipping (platform_id, label, min_weight_g, max_weight_g, surcharge) VALUES (?,?,?,?,?)');
  let imported = 0;

  db.transaction(() => {
    db.prepare('DELETE FROM prof_platform_shipping WHERE platform_id=?').run(platform_id);
    for (const row of rows) {
      const surcharge = cleanNum(row[surCol]);
      if (surcharge <= 0 && !surCol) continue;
      const label    = labelCol ? String(row[labelCol] || 'Standard').trim() : 'Standard';
      const minW     = minCol ? cleanNum(row[minCol]) : 0;
      const maxW     = maxCol ? cleanNum(row[maxCol]) : 99999;
      if (maxW <= 0) continue;
      ins.run(platform_id, label, minW, maxW || 99999, surcharge);
      imported++;
    }
  })();

  return { imported };
}

/**
 * Import commission rates from xlsx/csv buffer.
 * Tries to detect columns: platforma, kategoria, prowizja_pct, min_oplata, max_oplata
 */
async function importCommissionsFile(buffer, fileName, platform_id = null) {
  const isExcel = /\.(xlsx|xls)$/i.test(fileName);
  const isPdf = /\.pdf$/i.test(fileName);
  let rows = [];
  if (isExcel) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  } else if (isPdf) {
    const pdf = require('pdf-parse');
    const data = await pdf(buffer);
    const lines = data.text.split(/\r?\n/).filter(l => l.trim());
    const headers = ['Kolumna1', 'Kolumna2', 'Kolumna3', 'Kolumna4'];
    rows = lines.map(line => {
      const parts = line.split(/\s{2,}|\t/).map(p => p.trim());
      const obj = {};
      for (let i = 0; i < headers.length; i++) obj[headers[i]] = parts[i] || '';
      return obj;
    });
  } else {
    const str = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = str.split(/\r?\n/).filter(l => l.trim());
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(sep);
      const obj = {};
      headers.forEach((h, hi) => { obj[h] = (vals[hi] || '').trim(); });
      rows.push(obj);
    }
  }

  function normalizeKey(h) {
    return String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_\-\.]+/g, '_');
  }
  function findCol(keys, aliases) {
    for (const a of aliases) {
      const k = keys.find(k => normalizeKey(k) === a || normalizeKey(k).includes(a));
      if (k) return k;
    }
    return null;
  }

  const rawKeys = Object.keys(rows[0] || {});
  const catCol  = findCol(rawKeys, ['kategoria','category','cat','name','nazwa']);
  const rateCol = findCol(rawKeys, ['prowizja_pct','prowizja','rate','commission','stawka','procent','pct','%']);
  const minCol  = findCol(rawKeys, ['min_oplata','min_fee','minimum','min']);
  const maxCol  = findCol(rawKeys, ['max_oplata','max_fee','maximum','max']);
  const platCol = findCol(rawKeys, ['platforma','platform','marketplace']);

  if (!rateCol) throw new Error(`Nie znaleziono kolumny prowizji. Dostepne: ${rawKeys.join(', ')}`);

  const db = getDb();
  let imported = 0;
  const platforms = db.prepare('SELECT * FROM prof_platforms').all();
  const findPlatform = name => platforms.find(p => p.name.toLowerCase().includes(name?.toLowerCase()));

  const check = db.prepare('SELECT id FROM prof_commissions WHERE platform_id=? AND category_name=?');
  const upd = db.prepare('UPDATE prof_commissions SET rate_pct=?, min_fee=?, max_fee=? WHERE id=?');
  const ins = db.prepare('INSERT INTO prof_commissions (platform_id, category_name, rate_pct, min_fee, max_fee) VALUES (?,?,?,?,?)');

  db.transaction(() => {
    for (const row of rows) {
      const rate = parseFloat(String(row[rateCol] || '0').replace(',', '.'));
      if (isNaN(rate) || rate <= 0) continue;

      let pid = platform_id;
      if (!pid && platCol) {
        const p = findPlatform(row[platCol]);
        if (p) pid = p.id;
      }
      if (!pid) continue;

      const cat   = catCol ? String(row[catCol] || 'Ogolna').trim() : 'Ogolna';
      const minF  = minCol  ? parseFloat(String(row[minCol]  || '0').replace(',', '.')) || 0 : 0;
      const maxF  = maxCol  ? parseFloat(String(row[maxCol]  || '0').replace(',', '.')) || null : null;

      const existing = check.get(pid, cat);
      if (existing) {
        upd.run(rate, minF, maxF || null, existing.id);
      } else {
        ins.run(pid, cat, rate, minF, maxF || null);
      }
      imported++;
    }
  })();

  return { imported };
}

// ─── SETTINGS ───────────────────────────────────────────────────────────────

function getSettings() {
  return getDb().prepare('SELECT * FROM prof_settings WHERE id=1').get();
}

function updateSettings(data) {
  const db = getDb();
  const fields = [], vals = [];
  const allowed = ['shipping_default','packing_cost','payment_fee_pct','min_margin_alert_pct','shipping_zones'];
  for (const [k, v] of Object.entries(data)) {
    if (!allowed.includes(k)) continue;
    fields.push(`${k}=?`);
    vals.push(typeof v === 'object' ? JSON.stringify(v) : v);
  }
  fields.push("updated_at=datetime('now')");
  if (fields.length <= 1) return;
  db.prepare(`UPDATE prof_settings SET ${fields.join(',')} WHERE id=1`).run(...vals);
}

// ─── PRODUCTS ───────────────────────────────────────────────────────────────

function listProducts({ search = '', manufacturer = '', sortCol = 'name', sortDir = 'asc', limit = 300, offset = 0 } = {}) {
  const db = getDb();
  const filters = [];
  const params = [];

  if (search) {
    filters.push("(p.ean LIKE ? OR p.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (manufacturer) {
    filters.push("p.manufacturer = ?");
    params.push(manufacturer);
  }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  let orderClause = 'ORDER BY p.name ASC';
  if (sortCol === 'ean') orderClause = `ORDER BY p.ean ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
  if (sortCol === 'name') orderClause = `ORDER BY p.name ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
  if (sortCol === 'buy') orderClause = `ORDER BY p.buy_price ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
  if (sortCol === 'sell') orderClause = `ORDER BY p.sell_price ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;
  if (sortCol === 'manufacturer') orderClause = `ORDER BY p.manufacturer ${sortDir === 'desc' ? 'DESC' : 'ASC'}`;

  const missingPricesEnd = `CASE WHEN p.buy_price <= 0 OR p.sell_price <= 0 OR p.buy_price IS NULL OR p.sell_price IS NULL THEN 1 ELSE 0 END, `;
  orderClause = orderClause.replace('ORDER BY ', 'ORDER BY ' + missingPricesEnd);

  const cte = `
    WITH all_products AS (
      SELECT id, ean, name, buy_price, sell_price, weight_g, '' as manufacturer, 1 as is_manual, 0 as stock FROM prof_products
      UNION ALL
      SELECT p.id, p.ean, p.name, p.buy_price, p.sell_price, p.weight_g, sp.manufacturer, 0 as is_manual, p.stock
      FROM sourcing.subiekt_products p
      LEFT JOIN (SELECT ean, MAX(manufacturer) as manufacturer FROM sourcing.supplier_products WHERE manufacturer IS NOT NULL AND manufacturer != '' GROUP BY ean) sp ON sp.ean = p.ean
      WHERE p.ean NOT IN (SELECT ean FROM prof_products WHERE ean IS NOT NULL AND ean != '')
    )
  `;

  const totalSql = `${cte} SELECT COUNT(*) as n FROM all_products p ${where}`;
  const rowsSql = `${cte} SELECT p.* FROM all_products p ${where} ${orderClause} LIMIT ? OFFSET ?`;
  
  const total = db.prepare(totalSql).get(...params).n;
  const rows  = db.prepare(rowsSql).all(...params, limit, offset);
  return { rows, total };
}

function addProduct(data) {
  const db = getDb();
  db.prepare('INSERT INTO prof_products (ean, name, buy_price, sell_price, weight_g, source) VALUES (?,?,?,?,?,"manual")')
    .run(data.ean||null, data.name, data.buy_price||0, data.sell_price||0, data.weight_g||0);
  return { ok: true };
}

function updateProduct(id, data) {
  const db = getDb();
  db.prepare("UPDATE prof_products SET ean=?, name=?, buy_price=?, sell_price=?, weight_g=?, updated_at=datetime('now') WHERE id=?")
    .run(data.ean||null, data.name, data.buy_price||0, data.sell_price||0, data.weight_g||0, id);
  return { ok: true };
}

function deleteProduct(id) {
  const db = getDb();
  db.prepare('DELETE FROM prof_products WHERE id=?').run(id);
  db.prepare('DELETE FROM prof_product_platforms WHERE product_id=?').run(id);
  return { ok: true };
}

/**
 * Import products from Subiekt export (xlsx/csv).
 * Detects: ean, name, buy_price columns. Upserts by EAN.
 */
function importSubiektProducts(buffer, fileName) {
  const isExcel = /\.(xlsx|xls)$/i.test(fileName);
  let rows = [];
  if (isExcel) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  } else {
    const str = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = str.split(/\r?\n/).filter(l => l.trim());
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(sep);
      const obj = {}; headers.forEach((h, hi) => { obj[h] = (vals[hi] || '').trim(); });
      rows.push(obj);
    }
  }

  function nk(h) { return String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_\-]+/g,'_'); }
  function findCol(keys, aliases) { for (const a of aliases) { const k = keys.find(k => nk(k)===a || nk(k).includes(a)); if (k) return k; } return null; }

  const rawKeys  = Object.keys(rows[0] || {});
  const eanCol   = findCol(rawKeys, ['ean','barcode','gtin','kod_ean','kod']);
  const nameCol  = findCol(rawKeys, ['nazwa','name','produkt','product']);
  const buyCol   = findCol(rawKeys, ['cena_zakupu','buy_price','cena_netto','netto','cena_kup','purchase']);
  const sellCol  = findCol(rawKeys, ['cena_sprzedazy','sell_price','cena_brutto','brutto','cena_sp','price']);
  const weightCol= findCol(rawKeys, ['waga','weight','masa']);

  if (!nameCol) throw new Error(`Nie znaleziono kolumny Nazwy. Dostepne: ${rawKeys.join(', ')}`);

  const db = getDb();
  const cleanNum = v => parseFloat(String(v || '0').replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
  const cleanEan = v => String(v || '').replace(/[^0-9]/g, '').padStart(13, '0').slice(-13);

  const findByEan  = db.prepare("SELECT id FROM prof_products WHERE ean=? LIMIT 1");
  const updByEan   = db.prepare("UPDATE prof_products SET name=?,buy_price=?,sell_price=?,weight_g=?,updated_at=datetime('now') WHERE id=?");
  const insertNew  = db.prepare("INSERT INTO prof_products (ean,name,buy_price,sell_price,weight_g,source) VALUES (?,?,?,?,?,'subiekt')");
  const insertAnon = db.prepare("INSERT INTO prof_products (ean,name,buy_price,sell_price,weight_g,source) VALUES (NULL,?,?,?,?,'subiekt')");

  let imported = 0;
  db.transaction(() => {
    for (const row of rows) {
      const name = String(row[nameCol] || '').trim();
      if (!name) continue;
      const ean    = eanCol  ? cleanEan(row[eanCol])   : null;
      const buy    = buyCol  ? cleanNum(row[buyCol])   : 0;
      const sell   = sellCol ? cleanNum(row[sellCol])  : 0;
      const weight = weightCol ? cleanNum(row[weightCol]) * 1000 : 0; // kg->g
      if (ean && ean !== '0000000000000') {
        const ex = findByEan.get(ean);
        if (ex) updByEan.run(name, buy, sell, weight, ex.id);
        else    insertNew.run(ean, name, buy, sell, weight);
      } else {
        insertAnon.run(name, buy, sell, weight);
      }
      imported++;
    }
  })();
  return { imported };
}

/**
 * Import supplier price list — map by EAN and update buy_price only.
 */
function importSupplierProducts(buffer, fileName) {
  const isExcel = /\.(xlsx|xls)$/i.test(fileName);
  let rows = [];
  if (isExcel) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  } else {
    const str = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = str.split(/\r?\n/).filter(l => l.trim());
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(sep);
      const obj = {}; headers.forEach((h, hi) => { obj[h] = (vals[hi] || '').trim(); });
      rows.push(obj);
    }
  }

  function nk(h) { return String(h).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_\-]+/g,'_'); }
  function findCol(keys, aliases) { for (const a of aliases) { const k = keys.find(k => nk(k)===a || nk(k).includes(a)); if (k) return k; } return null; }

  const rawKeys = Object.keys(rows[0] || {});
  const eanCol  = findCol(rawKeys, ['ean','barcode','gtin','kod_ean','kod']);
  const buyCol  = findCol(rawKeys, ['cena','price','cena_netto','netto','buy_price','cena_zakupu']);

  if (!eanCol) throw new Error(`Nie znaleziono kolumny EAN. Dostepne: ${rawKeys.join(', ')}`);
  if (!buyCol) throw new Error(`Nie znaleziono kolumny ceny. Dostepne: ${rawKeys.join(', ')}`);

  const db = getDb();
  const cleanNum = v => parseFloat(String(v || '0').replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
  const cleanEan = v => String(v || '').replace(/[^0-9]/g, '').padStart(13, '0').slice(-13);

  const upd = db.prepare("UPDATE prof_products SET buy_price=?, updated_at=datetime('now') WHERE ean=? AND buy_price > ?");
  // Also update if buy_price is 0
  const upd0 = db.prepare("UPDATE prof_products SET buy_price=?, updated_at=datetime('now') WHERE ean=? AND buy_price=0");

  let updated = 0;
  db.transaction(() => {
    for (const row of rows) {
      const ean = cleanEan(row[eanCol]);
      if (!ean || ean === '0000000000000') continue;
      const buy = cleanNum(row[buyCol]);
      if (buy <= 0) continue;
      // Update with cheapest price (overwrite if current buy_price > new buy)
      const r1 = upd.run(buy, ean, buy);
      const r2 = upd0.run(buy, ean);
      if (r1.changes + r2.changes > 0) updated++;
    }
  })();
  return { updated };
}

// ─── SIMULATOR ──────────────────────────────────────────────────────────────

/**
 * Calculate profitability for all products across all active platforms.
 * Uses per-product commission override (commission_id) when set via AI import.
 * Falls back to platform default "Ogolna" commission.
 */
function getSimulatorData({ search = '', manufacturer = '', category = '', alertsOnly = false, sortCol = 'name', sortDir = 'asc', limit = 300, offset = 0, min_margin = null } = {}) {
  const db = getDb();
  const settings = getSettings();
  const minMarginAlert = min_margin !== null ? min_margin : (settings.min_margin_alert_pct || 5);

  // Load platforms with their default (Ogolna) commission — use MIN(c.id) to prevent cartesian explosion
  const platforms = db.prepare(`
    SELECT p.*,
           c.id   as comm_id,
           c.rate_pct,
           c.min_fee,
           c.max_fee,
           c.category_name
    FROM prof_platforms p
    LEFT JOIN prof_commissions c
          ON c.platform_id = p.id
         AND c.category_name = 'Ogolna'
         AND c.id = (SELECT MIN(c2.id) FROM prof_commissions c2 WHERE c2.platform_id = p.id AND c2.category_name = 'Ogolna')
    WHERE p.active = 1
    ORDER BY p.name
  `).all();

  // Load platform shipping options
  const platShippingRows = db.prepare('SELECT * FROM prof_platform_shipping ORDER BY min_weight_g ASC').all();
  const platShipping = {};
  for (const r of platShippingRows) {
    if (!platShipping[r.platform_id]) platShipping[r.platform_id] = [];
    platShipping[r.platform_id].push(r);
  }

  // Prepared statement reused per-product per-platform
  const stmtOverride = db.prepare(`
    SELECT ppp.*,
           c.rate_pct    as override_rate,
           c.min_fee     as override_min,
           c.max_fee     as override_max,
           c.category_name as override_cat
    FROM prof_product_platforms ppp
    LEFT JOIN prof_commissions c ON c.id = ppp.commission_id
    WHERE ppp.ean = ? AND ppp.platform_id = ?
  `);

  const filters = [];
  const params = [];
  if (search) {
    filters.push("(p.ean LIKE ? OR p.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  
  if (manufacturer) {
    filters.push("p.manufacturer = ?");
    params.push(manufacturer);
  }
  
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  
  let orderClause = 'ORDER BY p.name ASC';
  const sqlDir = sortDir === 'desc' ? 'DESC' : 'ASC';
  if (sortCol === 'ean') orderClause = `ORDER BY p.ean ${sqlDir}`;
  if (sortCol === 'name') orderClause = `ORDER BY p.name ${sqlDir}`;
  if (sortCol === 'buy') orderClause = `ORDER BY p.buy_price ${sqlDir}`;
  if (sortCol === 'sell') orderClause = `ORDER BY p.sell_price ${sqlDir}`;
  if (sortCol === 'manufacturer') orderClause = `ORDER BY p.manufacturer ${sqlDir}`;
  if (sortCol === 'stock') orderClause = `ORDER BY p.stock ${sqlDir}`;

  const missingPricesEnd = `CASE WHEN p.buy_price <= 0 OR p.sell_price <= 0 OR p.buy_price IS NULL OR p.sell_price IS NULL THEN 1 ELSE 0 END, `;
  orderClause = orderClause.replace('ORDER BY ', 'ORDER BY ' + missingPricesEnd);

  const cte = `
    WITH all_products AS (
      SELECT id, ean, name, buy_price, sell_price, weight_g, '' as manufacturer, 1 as is_manual, 0 as stock FROM prof_products
      UNION ALL
      SELECT p.id, p.ean, p.name, p.buy_price, p.sell_price, p.weight_g, sp.manufacturer, 0 as is_manual, p.stock
      FROM sourcing.subiekt_products p
      LEFT JOIN (SELECT ean, MAX(manufacturer) as manufacturer FROM sourcing.supplier_products WHERE manufacturer IS NOT NULL AND manufacturer != '' GROUP BY ean) sp ON sp.ean = p.ean
      WHERE p.ean NOT IN (SELECT ean FROM prof_products WHERE ean IS NOT NULL AND ean != '')
    )
  `;
  
  const totalSql = `${cte} SELECT COUNT(*) as n FROM all_products p ${where}`;
  const rowsSql = `${cte} SELECT p.* FROM all_products p ${where} ${orderClause}`; // Removed LIMIT OFFSET from SQL because we filter in JS

  const total = db.prepare(totalSql).get(...params).n;
  const products = db.prepare(rowsSql).all(...params);

  function calcShipping(product, pl, settings, platShippingDict) {
    const pShipping = platShippingDict[pl.id] || [];
    if (pShipping.length > 0) {
      // Find all options that match weight
      const weight = product.weight_g || 0;
      const validOpts = pShipping.filter(s => weight >= s.min_weight_g && weight <= s.max_weight_g);
      if (validOpts.length > 0) {
        const basePrice = parseFloat(settings.shipping_default) || 0;
        const prices = validOpts.map(s => s.surcharge + basePrice);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const breakdown = validOpts.map(s => ({ ...s, surcharge: s.surcharge + basePrice }));
        return { cost: avg, min, max, label: validOpts.length > 1 ? 'Wiele opcji' : validOpts[0].label, breakdown };
      }
    }
    
    // Fallback to global zones
    let zones = [];
    try { zones = JSON.parse(settings.shipping_zones || '[]'); } catch {}
    if (zones.length && product.weight_g > 0) {
      const zone = zones.find(z => product.weight_g <= z.max_weight_g);
      if (zone) return { cost: parseFloat(zone.price) || settings.shipping_default, min: null, max: null, label: 'Strefa wagowa' };
    }
    const def = parseFloat(settings.shipping_default) || 9.99;
    return { cost: def, min: null, max: null, label: 'Domyślna' };
  }

  const rows = products.map(prod => {
    const byPlatform = platforms.map(pl => {
      // Per-platform costs override global settings
      const platShippingDef = pl.shipping_default != null ? parseFloat(pl.shipping_default) : null;
      const platPacking     = pl.packing_cost     != null ? parseFloat(pl.packing_cost)     : null;
      const platPayPct      = pl.payment_fee_pct  != null ? parseFloat(pl.payment_fee_pct)  : null;

      const shipInfo = calcShipping(prod, pl, {
        ...settings,
        shipping_default: platShippingDef ?? parseFloat(settings.shipping_default) ?? 9.99,
      }, platShipping);
      const shipping = shipInfo.cost;
      const packing  = platPacking ?? parseFloat(settings.packing_cost) ?? 2.50;
      const payPct   = platPayPct  ?? parseFloat(settings.payment_fee_pct) ?? 1.5;

      // Fetch per-product override (includes commission lookup via JOIN)
      const override = stmtOverride.get(prod.ean, pl.id);
      const sellPrice = override?.sell_price_override ?? prod.sell_price;

      // Use per-product commission if available, else platform default
      const activeRate  = override?.commission_id ? (override.override_rate ?? pl.rate_pct) : pl.rate_pct;
      const activeMin   = override?.commission_id ? (override.override_min  ?? pl.min_fee ?? 0) : (pl.min_fee ?? 0);
      const activeMax   = override?.commission_id ? override.override_max : pl.max_fee;
      const activeCat   = override?.commission_id ? override.override_cat : (pl.category_name || 'Ogolna');

      const commRate   = (activeRate || 0) / 100;
      let commissionBase = sellPrice;
      if (pl.commission_on_shipping == null || pl.commission_on_shipping === 1) {
        commissionBase += shipping;
      }
      let commission   = commissionBase * commRate;
      if (activeMin) commission = Math.max(commission, activeMin);
      if (activeMax) commission = Math.min(commission, activeMax);

      const payFee     = sellPrice * (payPct / 100);
      const totalCosts = prod.buy_price + shipping + packing + commission + payFee;
      const profit     = sellPrice - totalCosts;
      const margin     = sellPrice > 0 ? (profit / sellPrice) * 100 : -999;
      const alert      = profit <= 0 || margin < minMarginAlert;

      return {
        platform_id:    pl.id,
        platform_name:  pl.name,
        platform_color: pl.color,
        platform_icon:  pl.icon,
        sell_price:     sellPrice,
        commission:     commission,
        commission_pct: activeRate || 0,
        commission_cat: activeCat,
        has_cat_override: !!override?.commission_id,
        shipping,
        shipping_min: shipInfo.min,
        shipping_max: shipInfo.max,
        shipping_label: shipInfo.label,
        shipping_breakdown: shipInfo.breakdown || [],
        packing,
        pay_fee:        payFee,
        total_costs:    totalCosts,
        profit,
        margin_pct:     margin,
        alert,
      };
    });

    // For display in simulator rows, use first platform or global defaults
    const firstPl = byPlatform[0];
    const worstAlert = byPlatform.some(p => p.alert);
    return {
      id:         prod.id,
      ean:        prod.ean,
      name:       prod.name,
      manufacturer: prod.manufacturer || '',
      stock:      prod.stock || 0,
      buy_price:  prod.buy_price,
      sell_price: prod.sell_price,
      weight_g:   prod.weight_g || 0,
      shipping:   firstPl?.shipping ?? (parseFloat(settings.shipping_default) || 9.99),
      shipping_min: firstPl?.shipping_min,
      shipping_max: firstPl?.shipping_max,
      shipping_breakdown: firstPl?.shipping_breakdown || [],
      packing:    firstPl?.packing  ?? (parseFloat(settings.packing_cost)     || 2.50),
      by_platform: byPlatform,
      any_alert:   worstAlert,
    };
  });

  // Apply filters that require calculated data
  let filteredRows = rows;
  if (category || (alertsOnly && alertsOnly !== '0' && alertsOnly !== 'false')) {
    filteredRows = filteredRows.filter(r => {
      let pass = true;
      if (category) {
        pass = pass && r.by_platform.some(p => p.commission_cat?.toLowerCase().includes(category.toLowerCase()));
      }
      if (alertsOnly && alertsOnly !== '0' && alertsOnly !== 'false') {
        pass = pass && r.any_alert;
      }
      return pass;
    });
  }
  
  const finalTotal = (category || (alertsOnly && alertsOnly !== '0' && alertsOnly !== 'false')) ? filteredRows.length : total;
  const paginatedRows = filteredRows.slice(offset, offset + limit);

  // Deduplicate platforms (the JOIN with commissions creates duplicates)
  const seenPlatIds = new Set();
  const uniquePlats = [];
  for (const p of platforms) {
    if (!seenPlatIds.has(p.id)) {
      seenPlatIds.add(p.id);
      uniquePlats.push({ id: p.id, name: p.name, color: p.color, icon: p.icon });
    }
  }
  return { rows: paginatedRows, total: finalTotal, platforms: uniquePlats, settings, limit, offset };
}

function exportSimulatorCsv({ search = '' } = {}) {
  const { rows, platforms } = getSimulatorData({ search, limit: 9999 });
  const headers = ['EAN', 'Nazwa', 'C.Zakupu (PLN)', 'C.Sprzedazy Allegro (PLN)',
    ...platforms.flatMap(p => [`[${p.name}] C.sprzed.`, `[${p.name}] Prowizja`, `[${p.name}] Zysk`, `[${p.name}] Marza%`]),
    'Alert'
  ];
  const csvRows = rows.map(r => [
    r.ean || '',
    `"${(r.name || '').replace(/"/g, '""')}"`,
    r.buy_price?.toFixed(2) || '0.00',
    r.sell_price?.toFixed(2) || '0.00',
    ...r.by_platform.flatMap(p => [
      p.sell_price?.toFixed(2),
      p.commission?.toFixed(2),
      p.profit?.toFixed(2),
      p.margin_pct?.toFixed(1) + '%',
    ]),
    r.any_alert ? 'ALERT' : 'OK',
  ].join(';'));
  return '\uFEFF' + [headers.join(';'), ...csvRows].join('\r\n');
}

// ─── PRODUCT-PLATFORM OVERRIDES ─────────────────────────────────────────────

function setProductPlatformOverride(ean, platform_id, { sell_price_override, commission_id } = {}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO prof_product_platforms (ean, platform_id, sell_price_override, commission_id, product_id)
    VALUES (?,?,?,?, 0)
    ON CONFLICT(ean, platform_id) DO UPDATE SET
      sell_price_override=excluded.sell_price_override,
      commission_id=excluded.commission_id
  `).run(ean, platform_id, sell_price_override ?? null, commission_id ?? null);
}

// ─── AI IMPORT — DWA PLIKI ──────────────────────────────────────────────────

/**
 * Parsuje bufor Excel/CSV do tablicy wierszy obiektowych (maks. 60 wierszy + nagłówek).
 * Zwraca też sformatowany tekst próbki do wysłania do AI.
 */
function parseBufferToSample(buffer, fileName, maxRows = 60) {
  let rows = [];
  const isExcel = /\.(xlsx|xls)$/i.test(fileName);
  if (isExcel) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  } else {
    const str = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = str.split(/\r?\n/).filter(l => l.trim());
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(sep);
      const obj = {};
      headers.forEach((h, hi) => { obj[h] = (vals[hi] || '').trim(); });
      rows.push(obj);
    }
  }
  const sample = rows.slice(0, maxRows);
  // Build readable text sample for AI
  const keys = Object.keys(sample[0] || {});
  const lines = [keys.join(' | ')];
  sample.forEach(r => lines.push(keys.map(k => String(r[k] || '')).join(' | ')));
  return { rows: sample, sampleText: lines.join('\n') };
}

/**
 * AI import dwóch plików:
 *  catBuffer  / catFileName  — Plik 1: produkt → kategoria (EAN | Nazwa | Kategoria)
 *  commBuffer / commFileName — Plik 2: kategoria → prowizja (Kategoria | % | Min | Max)
 *
 * Automatycznie zapisuje prowizje + powiązania produkt→prowizja.
 * Zwraca statystyki: { categoriesImported, productsMatched, productsNotFound, notFoundList }
 */
async function aiImportPlatformFiles(platform_id, catBuffer, catFileName, commBuffer, commFileName) {
  const db = getDb();

  // ── Step 1: Parse File 2 (commissions) with AI ──────────────────────────
  const { sampleText: commSample } = parseBufferToSample(commBuffer, commFileName);
  const commAiResult = await aiService.complete(
    `Jestes ekspertem od analizy danych marketplace. Zwracaj TYLKO poprawny JSON bez markdown.`,
    `Masz tabele prowizji z pliku "${commFileName}". Wyekstrahuj wszystkie wiersze jako JSON.

Zwroc dokladnie ten format:
{
  "commissions": [
    {"category_name": "Nazwa kategorii", "rate_pct": 8.5, "min_fee": 2.00, "max_fee": null}
  ]
}

Zasady:
- rate_pct to liczba procentowa (np. 8.5 dla 8,5%)
- min_fee i max_fee to wartosci PLN (null jesli brak)
- category_name to pelna nazwa kategorii

Dane z pliku:
${commSample}`,
    { temperature: 0.1, maxTokens: 4096, skipBrandKb: true, featureId: 'sourcing_commission' }
  );
  const commParsed = aiService.parseJsonResponse(commAiResult.text);
  const commissions = commParsed.commissions || [];

  if (!commissions.length) throw new Error('AI nie znalazlo prowizji w Pliku 2. Sprawdz format pliku.');

  // Save commissions — upsert by category_name + platform_id
  const findComm = db.prepare('SELECT id FROM prof_commissions WHERE platform_id=? AND category_name=?');
  const insComm  = db.prepare('INSERT INTO prof_commissions (platform_id, category_name, rate_pct, min_fee, max_fee) VALUES (?,?,?,?,?)');
  const updComm  = db.prepare('UPDATE prof_commissions SET rate_pct=?, min_fee=?, max_fee=? WHERE id=?');

  const commIdMap = {}; // category_name (lowercase) → commission id
  let categoriesImported = 0;

  db.transaction(() => {
    for (const c of commissions) {
      const catName = String(c.category_name || '').trim();
      if (!catName) continue;
      const rate = parseFloat(c.rate_pct) || 0;
      const minF = parseFloat(c.min_fee) || 0;
      const maxF = c.max_fee != null ? parseFloat(c.max_fee) : null;

      const existing = findComm.get(platform_id, catName);
      let cid;
      if (existing) {
        updComm.run(rate, minF, maxF, existing.id);
        cid = existing.id;
      } else {
        const r = insComm.run(platform_id, catName, rate, minF, maxF);
        cid = r.lastInsertRowid;
      }
      commIdMap[catName.toLowerCase()] = cid;
      categoriesImported++;
    }
  })();

  // ── Step 2: Parse File 1 (product → category) with AI ───────────────────
  const { sampleText: catSample } = parseBufferToSample(catBuffer, catFileName);
  const catAiResult = await aiService.complete(
    `Jestes ekspertem od analizy danych marketplace. Zwracaj TYLKO poprawny JSON bez markdown.`,
    `Masz plik "${catFileName}" z przypisaniem produktow do kategorii.
Wyekstrahuj wszystkie produkty jako JSON.

Zwroc dokladnie ten format:
{
  "products": [
    {"ean": "5902140008432", "product_name": "Nazwa produktu", "category": "Nazwa kategorii"}
  ]
}

Zasady:
- ean to 13-cyfrowy kod EAN/GTIN (moze byc pusty jesli nie ma)
- product_name to pelna nazwa produktu
- category to dokladna nazwa kategorii tak jak jest w pliku
- Jesli kolumna EAN nie istnieje, zostaw ean jako pusty string

Dane z pliku:
${catSample}`,
    { temperature: 0.1, maxTokens: 8192, skipBrandKb: true, featureId: 'sourcing_category' }
  );
  const catParsed = aiService.parseJsonResponse(catAiResult.text);
  const productMappings = catParsed.products || [];

  if (!productMappings.length) {
    // Single-file mode: no products to map, just return the imported categories
    return { categoriesImported, productsMatched: 0, productsNotFound: 0, notFoundList: [] };
  }

  // ── Step 3: Match products to commissions ────────────────────────────────
  const cleanEan = v => {
    const s = String(v || '').replace(/[^0-9]/g, '');
    return s.length >= 8 ? s.padStart(13, '0').slice(-13) : null;
  };

  const findByEan  = db.prepare('SELECT ean FROM sourcing.subiekt_products WHERE ean=? LIMIT 1');
  const findByName = db.prepare("SELECT ean FROM sourcing.subiekt_products WHERE name LIKE ? LIMIT 1");
  const upsertPP   = db.prepare(`
    INSERT INTO prof_product_platforms (ean, platform_id, commission_id, product_id)
    VALUES (?,?,?, 0)
    ON CONFLICT(ean, platform_id) DO UPDATE SET
      commission_id = excluded.commission_id
  `);

  let productsMatched = 0;
  const notFoundList = [];

  db.transaction(() => {
    for (const pm of productMappings) {
      const ean = cleanEan(pm.ean);
      const catKey = String(pm.category || '').trim().toLowerCase();
      const commId = commIdMap[catKey];

      if (!commId) {
        // Try partial match on category name
        const partialKey = Object.keys(commIdMap).find(k => k.includes(catKey) || catKey.includes(k));
        if (!partialKey) {
          notFoundList.push({ reason: 'brak kategorii', item: pm.category });
          continue;
        }
      }
      const resolvedCommId = commId || commIdMap[Object.keys(commIdMap).find(k => k.includes(catKey) || catKey.includes(k))];

      // Find product
      let productRow = null;
      if (ean) productRow = findByEan.get(ean);
      if (!productRow && pm.product_name) {
        const nameLike = '%' + String(pm.product_name).slice(0, 40).trim() + '%';
        productRow = findByName.get(nameLike);
      }
      if (!productRow || !productRow.ean) {
        notFoundList.push({ reason: 'nie znaleziono produktu', item: pm.product_name || pm.ean });
        continue;
      }

      upsertPP.run(productRow.ean, platform_id, resolvedCommId);
      productsMatched++;
    }
  })();

  return { categoriesImported, productsMatched, productsNotFound: notFoundList.length, notFoundList: notFoundList.slice(0, 20) };
}

async function aiImportShippingFile(buffer, fileName, platform_id) {
  const db = getDb();
  
  let textSample = '';
  const isExcel = /\.(xlsx|xls)$/i.test(fileName);
  const isPdf = /\.pdf$/i.test(fileName);
  if (isExcel) {
    const XLSX = require('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    textSample = rows.map(r => r.join(' | ')).join('\n');
  } else if (isPdf) {
    const pdf = require('pdf-parse');
    const data = await pdf(buffer);
    textSample = data.text;
  } else {
    textSample = buffer.toString('utf-8').replace(/^\uFEFF/, '');
  }
  
  if (textSample.length > 30000) textSample = textSample.substring(0, 30000);

  const aiResult = await aiService.complete(
    `Jesteś ekspertem od logistyki e-commerce. Zwracaj TYLKO poprawny JSON.`,
    `Masz cennik dostaw (kurierów) z pliku "${fileName}". Wyekstrahuj progi wagowe i ceny dopłat.

Zwróć dokładnie ten format:
{
  "shipping_zones": [
    {"label": "Paczkomat", "min_weight_g": 0, "max_weight_g": 1000, "surcharge": 12.50},
    {"label": "Kurier DPD", "min_weight_g": 1001, "max_weight_g": 5000, "surcharge": 15.00}
  ]
}

Zasady:
- Wagi muszą być w gramach (g). Jeśli w cenniku jest "do 1 kg", to max_weight_g = 1000.
- Jeśli przedział to "1-5 kg", to min = 1001, max = 5000.
- Surcharge to koszt dostawy (w PLN).
- Zwróć dane TYLKO z pliku.
- BARDZO WAŻNE: Zgrupuj przedziały wagowe, które mają taką samą cenę dla danego kuriera, aby zminimalizować liczbę wierszy (unikaj tworzenia setek pojedynczych kilogramów, jeśli cena jest stała w dużym przedziale).

Dane:
${textSample}`,
    { temperature: 0.1, maxTokens: 8192, skipBrandKb: true, featureId: 'sourcing_shipping' }
  );

  const parsed = aiService.parseJsonResponse(aiResult.text);
  const zones = parsed.shipping_zones || [];

  if (!zones.length) throw new Error('AI nie znalazło cenników dostawy w pliku.');

  let imported = 0;
  const ins = db.prepare('INSERT INTO prof_platform_shipping (platform_id, label, min_weight_g, max_weight_g, surcharge) VALUES (?,?,?,?,?)');
  
  db.transaction(() => {
    db.prepare('DELETE FROM prof_platform_shipping WHERE platform_id=?').run(platform_id);
    for (const z of zones) {
      if (z.max_weight_g <= 0) continue;
      ins.run(platform_id, String(z.label || 'Standard').trim(), parseFloat(z.min_weight_g)||0, parseFloat(z.max_weight_g)||99999, parseFloat(z.surcharge)||0);
      imported++;
    }
  })();

  return { imported };
}

async function syncSellasistCategories(platform_id) {
  const db = getDb();
  const sellasistService = require('./sellasistService');
  
  const saProducts = await sellasistService.fetchAllProductsForSync();
  const products = db.prepare('SELECT id, ean FROM prof_products').all();
  const commissions = db.prepare('SELECT id, category_name FROM prof_commissions WHERE platform_id = ?').all(platform_id);
  
  const commMap = {};
  for (const c of commissions) commMap[c.category_name.toLowerCase()] = c.id;
  
  let matched = 0;
  
  db.transaction(() => {
    const upsert = db.prepare(`
      INSERT INTO prof_product_platforms (product_id, platform_id, commission_id, override_cat) 
      VALUES (?, ?, ?, ?)
      ON CONFLICT(product_id, platform_id) DO UPDATE SET commission_id=excluded.commission_id, override_cat=excluded.override_cat
    `);
    
    for (const p of products) {
      if (!p.ean) continue;
      const saMatch = saProducts.find(s => s.ean === p.ean);
      if (saMatch && saMatch.categories && saMatch.categories.length > 0) {
        let foundCommId = null;
        let foundCatName = null;
        for (let i = saMatch.categories.length - 1; i >= 0; i--) {
          const catName = saMatch.categories[i].title;
          if (!catName) continue;
          if (commMap[catName.toLowerCase()]) {
            foundCommId = commMap[catName.toLowerCase()];
            foundCatName = catName;
            break;
          }
        }
        if (!foundCommId) {
          foundCatName = saMatch.categories[saMatch.categories.length - 1].title;
        }
        if (foundCatName) {
          upsert.run(p.id, platform_id, foundCommId, foundCatName);
          matched++;
        }
      }
    }
  })();
  
  return { matched, totalFetched: saProducts.length };
}

// ─── EXPORTS ────────────────────────────────────────────────────────────────

module.exports = {
  // company context
  _setDataDir,
  // platforms
  listPlatforms, addPlatform, updatePlatform, deletePlatform,
  // commissions
  addCommission, updateCommission, deleteCommission, deleteAllPlatformCommissions, importCommissionsFile,
  // platform shipping
  listPlatformShipping, addPlatformShipping, updatePlatformShipping, deletePlatformShipping, deleteAllPlatformShipping, importShippingFile, aiImportShippingFile,
  // settings
  getSettings, updateSettings,
  // products
  listProducts, addProduct, updateProduct, deleteProduct,
  importSubiektProducts, importSupplierProducts,
  // simulator
  getSimulatorData, exportSimulatorCsv,
  // overrides
  setProductPlatformOverride,
  // AI import
  aiImportPlatformFiles,
  // Sellasist
  syncSellasistCategories,
};
