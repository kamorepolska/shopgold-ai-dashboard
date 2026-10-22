/* =====================================================================
 * sgSyncService.js — Synchronizacja stanów i cen ShopGold
 * z plików XML/CSV hurtowni, z priorytetem danych z Subiekta GT
 * ===================================================================== */
'use strict';

const mysql = require('mysql2/promise');
const path  = require('path');
const fs    = require('fs');

/* ─── Lokalna DB (SQLite) ───────────────────────────────────────────── */
const { getDb } = require('../models/localDb');

/* ─── Domyślne progi marż ──────────────────────────────────────────── */
const DEFAULT_PRICE_RULES = [
  { price_from: 0,    price_to: 15,   margin_pct: 60, round_to: 0.01, label: '0–15 zł' },
  { price_from: 15,   price_to: 40,   margin_pct: 50, round_to: 0.01, label: '15–40 zł' },
  { price_from: 40,   price_to: 70,   margin_pct: 45, round_to: 0.01, label: '40–70 zł' },
  { price_from: 70,   price_to: 100,  margin_pct: 40, round_to: 0.01, label: '70–100 zł' },
  { price_from: 100,  price_to: 500,  margin_pct: 30, round_to: 0.01, label: '100–500 zł' },
  { price_from: 500,  price_to: 99999,margin_pct: 25, round_to: 0.01, label: '500+ zł' },
];

/* ─── Inicjalizacja tabel w localDb ────────────────────────────────── */
function initSgSyncTables() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS sg_sync_price_rules (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id INTEGER NOT NULL DEFAULT 0,
      price_from  REAL NOT NULL DEFAULT 0,
      price_to    REAL NOT NULL DEFAULT 99999,
      margin_pct  REAL NOT NULL DEFAULT 30,
      round_to    REAL NOT NULL DEFAULT 0.01,
      label       TEXT,
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sg_sync_config (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id   INTEGER NOT NULL UNIQUE,
      supplier_id   INTEGER,
      schedule_enabled INTEGER DEFAULT 0,
      schedule_cron    TEXT DEFAULT '0 6 * * *',
      update_stock     INTEGER DEFAULT 1,
      update_price     INTEGER DEFAULT 1,
      subiekt_priority INTEGER DEFAULT 1,
      dry_run          INTEGER DEFAULT 1,
      last_run_at      TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sg_sync_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id   INTEGER NOT NULL,
      supplier_id   INTEGER,
      supplier_name TEXT,
      started_at    TEXT DEFAULT (datetime('now')),
      finished_at   TEXT,
      status        TEXT DEFAULT 'running',
      updated_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      subiekt_count INTEGER DEFAULT 0,
      dry_run       INTEGER DEFAULT 0,
      error         TEXT,
      details_json  TEXT DEFAULT '[]',
      duration_ms   INTEGER DEFAULT 0
    );
  `);
}

/* ─── Instancje ShopGold ────────────────────────────────────────────── */
function getInstances() {
  initSgSyncTables();
  const db = getDb();
  return db.prepare('SELECT * FROM shopgold_instances ORDER BY name ASC').all();
}

/* ─── Konfiguracja sync ─────────────────────────────────────────────── */
function getSyncConfig(instanceId) {
  initSgSyncTables();
  const db = getDb();
  let cfg = db.prepare('SELECT * FROM sg_sync_config WHERE instance_id = ?').get(instanceId);
  if (!cfg) {
    // Auto-create default config
    db.prepare(`
      INSERT INTO sg_sync_config (instance_id, schedule_enabled, schedule_cron, update_stock, update_price, subiekt_priority, dry_run)
      VALUES (?, 0, '0 6 * * *', 1, 1, 1, 1)
    `).run(instanceId);
    cfg = db.prepare('SELECT * FROM sg_sync_config WHERE instance_id = ?').get(instanceId);
  }
  return cfg;
}

function saveSyncConfig(instanceId, data) {
  initSgSyncTables();
  const db = getDb();
  const existing = db.prepare('SELECT id FROM sg_sync_config WHERE instance_id = ?').get(instanceId);
  if (existing) {
    db.prepare(`
      UPDATE sg_sync_config SET
        supplier_id = ?,
        schedule_enabled = ?,
        schedule_cron = ?,
        update_stock = ?,
        update_price = ?,
        subiekt_priority = ?,
        dry_run = ?,
        updated_at = datetime('now')
      WHERE instance_id = ?
    `).run(
      data.supplier_id || null,
      data.schedule_enabled ? 1 : 0,
      data.schedule_cron || '0 6 * * *',
      data.update_stock !== false ? 1 : 0,
      data.update_price !== false ? 1 : 0,
      data.subiekt_priority !== false ? 1 : 0,
      data.dry_run ? 1 : 0,
      instanceId
    );
  } else {
    db.prepare(`
      INSERT INTO sg_sync_config (instance_id, supplier_id, schedule_enabled, schedule_cron, update_stock, update_price, subiekt_priority, dry_run)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      instanceId,
      data.supplier_id || null,
      data.schedule_enabled ? 1 : 0,
      data.schedule_cron || '0 6 * * *',
      data.update_stock !== false ? 1 : 0,
      data.update_price !== false ? 1 : 0,
      data.subiekt_priority !== false ? 1 : 0,
      data.dry_run ? 1 : 0
    );
  }
  return getSyncConfig(instanceId);
}

/* ─── Reguły marż ───────────────────────────────────────────────────── */
function getPriceRules(instanceId) {
  initSgSyncTables();
  const db = getDb();
  const rules = db.prepare('SELECT * FROM sg_sync_price_rules WHERE instance_id = ? ORDER BY price_from ASC').all(instanceId);
  if (rules.length === 0) {
    // Seed default rules for this instance
    const insert = db.prepare(`
      INSERT INTO sg_sync_price_rules (instance_id, price_from, price_to, margin_pct, round_to, label, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    DEFAULT_PRICE_RULES.forEach((r, i) => {
      insert.run(instanceId, r.price_from, r.price_to, r.margin_pct, r.round_to, r.label, i);
    });
    return db.prepare('SELECT * FROM sg_sync_price_rules WHERE instance_id = ? ORDER BY price_from ASC').all(instanceId);
  }
  return rules;
}

function upsertPriceRule(rule) {
  initSgSyncTables();
  const db = getDb();
  if (rule.id) {
    db.prepare(`
      UPDATE sg_sync_price_rules SET price_from=?, price_to=?, margin_pct=?, round_to=?, label=?, sort_order=?
      WHERE id = ?
    `).run(rule.price_from, rule.price_to, rule.margin_pct, rule.round_to || 0.01, rule.label || '', rule.sort_order || 0, rule.id);
  } else {
    db.prepare(`
      INSERT INTO sg_sync_price_rules (instance_id, price_from, price_to, margin_pct, round_to, label, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(rule.instance_id, rule.price_from, rule.price_to, rule.margin_pct, rule.round_to || 0.01, rule.label || '', rule.sort_order || 0);
  }
}

function deletePriceRule(id) {
  initSgSyncTables();
  const db = getDb();
  db.prepare('DELETE FROM sg_sync_price_rules WHERE id = ?').run(id);
}

/* ─── Obliczanie ceny z marżą ───────────────────────────────────────── */
function calcPrice(nettoPrice, rules) {
  if (!nettoPrice || isNaN(nettoPrice) || nettoPrice <= 0) return null;
  const sorted = [...rules].sort((a, b) => a.price_from - b.price_from);
  let rule = sorted[sorted.length - 1]; // fallback: ostatnia reguła
  for (const r of sorted) {
    if (nettoPrice >= r.price_from && nettoPrice < r.price_to) {
      rule = r;
      break;
    }
  }
  if (!rule) return null;
  const priceWithMargin = nettoPrice * (1 + rule.margin_pct / 100);
  // Zaokrąglenie
  const roundTo = rule.round_to || 0.01;
  const rounded = Math.ceil(priceWithMargin / roundTo) * roundTo;
  return Math.round(rounded * 100) / 100;
}

/* ─── Połączenie MySQL dla instancji ────────────────────────────────── */
async function getConnectionForInstance(instanceId) {
  const db = getDb();
  const inst = db.prepare('SELECT * FROM shopgold_instances WHERE id = ?').get(instanceId);
  if (!inst) throw new Error(`Nie znaleziono instancji ShopGold o ID ${instanceId}`);

  const host     = inst.mysql_host || '';
  const port     = parseInt(inst.mysql_port) || 3306;
  const user     = inst.mysql_user || '';
  const password = inst.mysql_pass || '';
  const database = inst.mysql_database || '';

  if (!host || !user || !database) {
    throw new Error(`Niekompletna konfiguracja MySQL dla instancji "${inst.name}". Sprawdź ustawienia.`);
  }

  return mysql.createConnection({ host, port, user, password, database });
}

/* ─── Pobieranie danych hurtowni z localDb ──────────────────────────── */
function getSupplierProducts(supplierId) {
  const db = getDb();
  // Próbuj pobrać z catalog_products (główna tabela produktów hurtowni)
  try {
    const rows = db.prepare(`
      SELECT cp.sku, cp.ean, cp.name, cp.price_netto, cp.price_brutto, cp.stock, cp.availability
      FROM catalog_products cp
      WHERE cp.supplier_id = ?
      LIMIT 50000
    `).all(supplierId);
    if (rows && rows.length > 0) return rows;
  } catch (_) {}

  // Fallback: supplier_products
  try {
    const rows = db.prepare(`
      SELECT sp.sku, sp.ean, sp.name,
             sp.price as price_netto,
             sp.price_brutto,
             sp.availability as stock,
             sp.availability
      FROM supplier_products sp
      WHERE sp.supplier_id = ?
      LIMIT 50000
    `).all(supplierId);
    if (rows && rows.length > 0) return rows;
  } catch (_) {}

  return [];
}

/* ─── Dane Subiekta ─────────────────────────────────────────────────── */
function getSubiektMap() {
  const db = getDb();
  const map = new Map(); // klucz: ean lub sku → { price, stock }
  try {
    const rows = db.prepare(`
      SELECT sku, ean, price, price_brutto, stock, availability
      FROM subiekt_data
    `).all();
    for (const r of rows) {
      if (r.ean)  map.set(String(r.ean).trim(), r);
      if (r.sku)  map.set(String(r.sku).trim(), r);
    }
  } catch (_) {
    // Tabela może nie istnieć — to ok
  }
  return map;
}

/* ─── Logs ──────────────────────────────────────────────────────────── */
function getSyncLogs(instanceId, limit = 30) {
  initSgSyncTables();
  const db = getDb();
  return db.prepare(`
    SELECT * FROM sg_sync_log WHERE instance_id = ?
    ORDER BY started_at DESC LIMIT ?
  `).all(instanceId, limit);
}

/* ─── Główna synchronizacja ─────────────────────────────────────────── */
async function runSync(instanceId, supplierId, opts = {}) {
  initSgSyncTables();
  const db = getDb();
  const { dry_run = true, update_stock = true, update_price = true, subiekt_priority = true } = opts;

  const startTs = Date.now();
  const instance = db.prepare('SELECT * FROM shopgold_instances WHERE id = ?').get(instanceId);
  if (!instance) throw new Error(`Nieznana instancja ID ${instanceId}`);

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
  const supplierName = supplier ? supplier.name : `Hurtownia #${supplierId}`;

  // Wstaw log "running"
  const logRes = db.prepare(`
    INSERT INTO sg_sync_log (instance_id, supplier_id, supplier_name, status, dry_run)
    VALUES (?, ?, ?, 'running', ?)
  `).run(instanceId, supplierId, supplierName, dry_run ? 1 : 0);
  const logId = logRes.lastInsertRowid;

  const details = [];
  let updatedCount = 0;
  let skippedCount = 0;
  let subiektCount = 0;

  try {
    // 1. Pobierz reguły marż
    const priceRules = getPriceRules(instanceId);

    // 2. Dane hurtowni
    const supplierProducts = getSupplierProducts(supplierId);
    if (supplierProducts.length === 0) {
      throw new Error(`Brak danych produktów hurtowni #${supplierId}. Pobierz plik najpierw.`);
    }

    // 3. Dane Subiekta (mapa EAN/SKU → produkt)
    const subiektMap = subiekt_priority ? getSubiektMap() : new Map();

    // 4. Połącz z ShopGold
    const prefix = (instance.mysql_table_prefix || 'sg_').replace(/[^a-zA-Z0-9_]/g, '');
    let conn = null;

    if (!dry_run) {
      conn = await getConnectionForInstance(instanceId);
    }

    try {
      // 5. Iteruj po produktach hurtowni
      for (const prod of supplierProducts) {
        const ean = prod.ean ? String(prod.ean).trim() : null;
        const sku = prod.sku ? String(prod.sku).trim() : null;

        // Sprawdź Subiekt
        let fromSubiekt = false;
        let targetPrice = null;
        let targetStock = null;

        if (subiekt_priority && (ean || sku)) {
          const subRow = (ean && subiektMap.get(ean)) || (sku && subiektMap.get(sku));
          if (subRow) {
            fromSubiekt = true;
            if (update_price) targetPrice = parseFloat(subRow.price_brutto || subRow.price) || null;
            if (update_stock) targetStock = parseInt(subRow.stock || subRow.availability) || 0;
          }
        }

        // Fallback: cena z hurtowni + marża
        if (!fromSubiekt) {
          const nettoPrice = parseFloat(prod.price_netto || prod.price) || 0;
          if (update_price && nettoPrice > 0) {
            targetPrice = calcPrice(nettoPrice, priceRules);
          }
          if (update_stock) {
            targetStock = parseInt(prod.stock || prod.availability) || 0;
          }
        }

        if (targetPrice === null && targetStock === null) {
          skippedCount++;
          continue;
        }

        // Znajdź produkt w ShopGold po EAN lub SKU
        if (!dry_run && conn) {
          let shopId = null;
          if (ean) {
            const [rows] = await conn.execute(
              `SELECT id_produktu FROM \`${prefix}produkty\` WHERE ean = ? LIMIT 1`,
              [ean]
            );
            if (rows && rows.length > 0) shopId = rows[0].id_produktu;
          }
          if (!shopId && sku) {
            const [rows] = await conn.execute(
              `SELECT id_produktu FROM \`${prefix}produkty\` WHERE kod = ? LIMIT 1`,
              [sku]
            );
            if (rows && rows.length > 0) shopId = rows[0].id_produktu;
          }

          if (!shopId) { skippedCount++; continue; }

          // Aktualizuj
          const setParts = [];
          const vals = [];
          if (update_price && targetPrice !== null) {
            setParts.push('cena = ?');
            vals.push(targetPrice);
          }
          if (update_stock) {
            setParts.push('dostepnosc = ?');
            vals.push(targetStock > 0 ? 1 : 0);
            setParts.push('stan_magazynowy = ?');
            vals.push(targetStock);
          }
          if (setParts.length > 0) {
            vals.push(shopId);
            await conn.execute(
              `UPDATE \`${prefix}produkty\` SET ${setParts.join(', ')} WHERE id_produktu = ?`,
              vals
            );
          }
          updatedCount++;
          if (fromSubiekt) subiektCount++;
        } else {
          // Dry-run: tylko zlicz i zapisz do details
          updatedCount++;
          if (fromSubiekt) subiektCount++;
          if (details.length < 200) {
            details.push({
              ean, sku,
              name: prod.name,
              old_price: null,
              new_price: targetPrice,
              old_stock: null,
              new_stock: targetStock,
              from_subiekt: fromSubiekt,
            });
          }
        }
      }
    } finally {
      if (conn) await conn.end();
    }

    // 6. Aktualizuj last_run_at w config
    db.prepare("UPDATE sg_sync_config SET last_run_at = datetime('now') WHERE instance_id = ?").run(instanceId);

    // 7. Finalizuj log
    const duration = Date.now() - startTs;
    db.prepare(`
      UPDATE sg_sync_log SET
        status = 'ok',
        finished_at = datetime('now'),
        updated_count = ?,
        skipped_count = ?,
        subiekt_count = ?,
        duration_ms = ?,
        details_json = ?
      WHERE id = ?
    `).run(updatedCount, skippedCount, subiektCount, duration, JSON.stringify(details), logId);

    return { ok: true, updatedCount, skippedCount, subiektCount, dry_run, duration, details };

  } catch (err) {
    const duration = Date.now() - startTs;
    db.prepare(`
      UPDATE sg_sync_log SET
        status = 'error',
        finished_at = datetime('now'),
        error = ?,
        duration_ms = ?
      WHERE id = ?
    `).run(err.message, duration, logId);
    throw err;
  }
}

/* ─── Harmonogramy: pobierz aktywne ────────────────────────────────── */
function getScheduledSyncConfigs() {
  initSgSyncTables();
  const db = getDb();
  return db.prepare(`
    SELECT c.*, i.name as instance_name
    FROM sg_sync_config c
    LEFT JOIN shopgold_instances i ON i.id = c.instance_id
    WHERE c.schedule_enabled = 1 AND c.schedule_cron IS NOT NULL AND c.schedule_cron != ''
  `).all();
}

module.exports = {
  initSgSyncTables,
  getInstances,
  getSyncConfig,
  saveSyncConfig,
  getPriceRules,
  upsertPriceRule,
  deletePriceRule,
  calcPrice,
  runSync,
  getSyncLogs,
  getScheduledSyncConfigs,
  DEFAULT_PRICE_RULES,
};
