/* =====================================================================
 * sourcingService.js Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ Smart Sourcing & Pricing (rozbudowana wersja)
 * Parsery: Subiekt (xlsx / csv), hurtownie (XML / xlsx / CSV)
 * Nowe: przeliczanie walut, logi, kilka plikow, zastepowanie plikow
 * ===================================================================== */
'use strict';

const path     = require('path');
const fs       = require('fs');
const https    = require('https');
const XLSX     = require('xlsx');
const xml2js   = require('xml2js');
const axios    = require('axios');
const iconv    = require('iconv-lite');
const Database = require('better-sqlite3');
const ftp      = require('basic-ftp');
const SftpClient = require('ssh2-sftp-client');
const AdmZip   = require('adm-zip');
const {
  normalizeEan, eanVariants, registerNormalizeEan,
  buildCatalogEanGroups, groupKeyForEan,
} = require('./eanUtil');



// Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬ DB Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬


let _overrideDataDir = null;
function _setDataDir(dir) { _overrideDataDir = dir; }
function _getEffectiveDataDir() {
  const d = _overrideDataDir; _overrideDataDir = null;
  return d || require('path').join(__dirname, '../../data/idealpc');
}
const _dbCache = new Map();
function getDb(dataDir) {
  if (!dataDir) dataDir = _getEffectiveDataDir();
  if (_dbCache.has(dataDir)) return _dbCache.get(dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(require('path').join(dataDir, 'shopgold_cache.db'));
  initSourcingSchema(db);
  registerNormalizeEan(db);
  _dbCache.set(dataDir, db);
  return db;
}

function backfillNormalizedEans(db) {
  try {
    const spMissing = db.prepare(
      "SELECT COUNT(*) AS c FROM supplier_products WHERE ean IS NOT NULL AND ean != '' AND (normalized_ean IS NULL OR normalized_ean = '')"
    ).get().c;
    if (spMissing > 0) {
      db.exec("UPDATE supplier_products SET normalized_ean = normalize_ean(ean) WHERE ean IS NOT NULL AND ean != '' AND (normalized_ean IS NULL OR normalized_ean = '')");
    }
  } catch (e) {
    console.warn('[sourcing] backfill supplier normalized_ean:', e.message);
  }
  try {
    const subMissing = db.prepare(
      "SELECT COUNT(*) AS c FROM subiekt_products WHERE ean IS NOT NULL AND ean != '' AND (normalized_ean IS NULL OR normalized_ean = '')"
    ).get().c;
    if (subMissing > 0) {
      db.exec("UPDATE subiekt_products SET normalized_ean = normalize_ean(ean) WHERE ean IS NOT NULL AND ean != '' AND (normalized_ean IS NULL OR normalized_ean = '')");
    }
  } catch (e) {
    console.warn('[sourcing] backfill subiekt normalized_ean:', e.message);
  }
  try {
    db.exec("UPDATE supplier_product_attrs SET normalized_ean = normalize_ean(ean) WHERE ean IS NOT NULL AND ean != '' AND (normalized_ean IS NULL OR normalized_ean = '')");
  } catch (_) {}
}

function migrateProductCategoriesParentNameUnique(db) {
  try {
    const row = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='product_categories'"
    ).get();
    if (!row || !row.sql) return;
    const hasGlobalNameUnique = /\bname\s+TEXT\s+NOT NULL\s+UNIQUE\b/i.test(row.sql)
      || /UNIQUE\s*\(\s*name\s*\)/i.test(row.sql);
    if (hasGlobalNameUnique) {
      const cols = db.prepare('PRAGMA table_info(product_categories)').all().map(c => c.name);
      const dest = [
        'id', 'name', 'parent_id', 'slug', 'product_count', 'created_at',
        'source_supplier_id', 'ab_category_id', 'is_ab_category', 'sort_order',
      ].filter(c => cols.includes(c));
      db.exec('PRAGMA foreign_keys = OFF');
      db.exec(`
        CREATE TABLE product_categories__new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          parent_id INTEGER,
          slug TEXT,
          product_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          source_supplier_id INTEGER,
          ab_category_id INTEGER,
          is_ab_category INTEGER DEFAULT 0,
          sort_order INTEGER DEFAULT 0
        )
      `);
      db.exec(`INSERT INTO product_categories__new (${dest.join(',')}) SELECT ${dest.join(',')} FROM product_categories`);
      db.exec('DROP TABLE product_categories');
      db.exec('ALTER TABLE product_categories__new RENAME TO product_categories');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_pc_parent ON product_categories(parent_id)');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_pc_parent_name ON product_categories(IFNULL(parent_id, 0), name)');
  } catch (e) {
    console.warn('[sourcing] product_categories unique migration:', e.message);
  }
}

function initSourcingSchema(db) {
  registerNormalizeEan(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS subiekt_products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ean         TEXT NOT NULL,
      name        TEXT,
      stock       REAL    DEFAULT 0,
      buy_price   REAL,
      sell_price  REAL,
      weight_g    REAL DEFAULT 0,
      sold_12m    INTEGER DEFAULT 0,
      sold_30d    INTEGER DEFAULT 0,
      imported_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sourcing_column_map (
      id         TEXT PRIMARY KEY,
      map_json   TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT NOT NULL,
      source_type        TEXT NOT NULL,
      source_url         TEXT,
      file_path          TEXT,
      currency           TEXT DEFAULT 'PLN',
      exchange_rate      REAL DEFAULT 1.0,
      col_settings       TEXT DEFAULT '{}',
      last_refresh       TEXT,
      product_count      INTEGER DEFAULT 0,
      schedule_cron      TEXT,
      schedule_enabled   INTEGER DEFAULT 0,
      last_scheduled_run TEXT,
      url_user           TEXT,
      url_pass           TEXT,
      elko_api_key       TEXT,
      elko_vendor_codes  TEXT,
      impakt_user        TEXT,
      impakt_pass        TEXT,
      impakt_api_url     TEXT,
      ntt_client_id      TEXT,
      ntt_client_secret  TEXT,
      ntt_user_id        TEXT,
      action_customer_id TEXT,
      action_user_name   TEXT,
      action_api_key     TEXT,
      file_created_at    TEXT,
      file_size_bytes    INTEGER DEFAULT 0,
      is_active          INTEGER DEFAULT 1,
      created_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS supplier_products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id   INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      ean           TEXT NOT NULL,
      name          TEXT,
      manufacturer  TEXT,
      price         REAL,
      price_pln     REAL,
      weight_g      REAL DEFAULT 0,
      availability  TEXT DEFAULT 'unknown',
      condition     TEXT DEFAULT 'new',
      stock_quantity INTEGER,
      refreshed_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sp_ean      ON supplier_products(ean);
    CREATE INDEX IF NOT EXISTS idx_sp_supplier ON supplier_products(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_sp_ean_avail ON supplier_products(ean, availability);

    CREATE TABLE IF NOT EXISTS supplier_files (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id  INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      label        TEXT NOT NULL DEFAULT 'Plik dodatkowy',
      file_type    TEXT NOT NULL DEFAULT 'stock_price',
      source_type  TEXT NOT NULL DEFAULT 'file',
      source_url   TEXT,
      file_path    TEXT,
      col_settings TEXT DEFAULT '{}',
      schedule_enabled INTEGER DEFAULT 0,
      schedule_cron TEXT,
      last_scheduled_run TEXT,
      last_refresh TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sf_supplier ON supplier_files(supplier_id);
  `);
    
  // Zapewnienie kompatybilności wstecznej dla supplier_files
  try { db.exec("ALTER TABLE supplier_files ADD COLUMN schedule_enabled INTEGER DEFAULT 0"); } catch(e){}
  try { db.exec("ALTER TABLE supplier_files ADD COLUMN schedule_cron TEXT"); } catch(e){}
  try { db.exec("ALTER TABLE supplier_files ADD COLUMN last_scheduled_run TEXT"); } catch(e){}

  db.exec(`
    CREATE TABLE IF NOT EXISTS restock_overrides (
      ean        TEXT PRIMARY KEY,
      qty        INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sourcing_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      action      TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'ok',
      details     TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listing_platforms (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      platform    TEXT NOT NULL,
      ean         TEXT NOT NULL,
      title       TEXT,
      imported_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_lp_ean      ON listing_platforms(ean);
    CREATE INDEX IF NOT EXISTS idx_lp_platform ON listing_platforms(platform);

    CREATE TABLE IF NOT EXISTS listing_meta (
      id           INTEGER PRIMARY KEY CHECK(id=1),
      last_import  TEXT,
      row_count    INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ean         TEXT NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      price_pln   REAL NOT NULL,
      recorded_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ph_ean ON price_history(ean);
    CREATE INDEX IF NOT EXISTS idx_ph_date ON price_history(recorded_at);
  `);

  // Migrations for existing DBs (safe -- ignore if column already exists)
  const migrations = [
    "ALTER TABLE suppliers ADD COLUMN currency TEXT DEFAULT 'PLN'",
    "ALTER TABLE suppliers ADD COLUMN exchange_rate REAL DEFAULT 1.0",
    "ALTER TABLE suppliers ADD COLUMN col_settings TEXT DEFAULT '{}'",
    "ALTER TABLE suppliers ADD COLUMN file_created_at TEXT",
    "ALTER TABLE suppliers ADD COLUMN schedule_cron TEXT",
    "ALTER TABLE suppliers ADD COLUMN schedule_enabled INTEGER DEFAULT 0",
    "ALTER TABLE suppliers ADD COLUMN last_scheduled_run TEXT",
    "ALTER TABLE supplier_products ADD COLUMN manufacturer TEXT",
    "ALTER TABLE supplier_products ADD COLUMN price_pln REAL",
    "ALTER TABLE suppliers ADD COLUMN file_size_bytes INTEGER DEFAULT 0",
    // FTP support
    "ALTER TABLE suppliers ADD COLUMN ftp_host TEXT",
    "ALTER TABLE suppliers ADD COLUMN ftp_user TEXT",
    "ALTER TABLE suppliers ADD COLUMN ftp_pass TEXT",
    "ALTER TABLE suppliers ADD COLUMN ftp_path TEXT",
    "ALTER TABLE suppliers ADD COLUMN ftp_port INTEGER DEFAULT 21",
    "ALTER TABLE suppliers ADD COLUMN ftp_secure INTEGER DEFAULT 0",
    // HTTP Basic Auth for URL suppliers (e.g. Akyga)
    "ALTER TABLE suppliers ADD COLUMN url_user TEXT",
    "ALTER TABLE suppliers ADD COLUMN url_pass TEXT",
    // Elko API
    "ALTER TABLE suppliers ADD COLUMN elko_api_key TEXT",
    "ALTER TABLE suppliers ADD COLUMN elko_vendor_codes TEXT",
    // Buy price date tracking from Subiekt file
    "ALTER TABLE subiekt_products ADD COLUMN buy_price_date TEXT",
    // Elko per-brand file SKU count
    "ALTER TABLE supplier_files ADD COLUMN product_count INTEGER DEFAULT 0",
    // Impakt API (etrade.pl)
    "ALTER TABLE suppliers ADD COLUMN impakt_user TEXT",
    "ALTER TABLE suppliers ADD COLUMN impakt_pass TEXT",
    "ALTER TABLE suppliers ADD COLUMN impakt_api_url TEXT",
    // NTT API
    "ALTER TABLE suppliers ADD COLUMN ntt_client_id TEXT",
    "ALTER TABLE suppliers ADD COLUMN ntt_client_secret TEXT",
    "ALTER TABLE suppliers ADD COLUMN ntt_user_id TEXT",
    // Product condition (new/used) and warranty
    "ALTER TABLE supplier_products ADD COLUMN condition TEXT DEFAULT 'new'",
    "ALTER TABLE supplier_products ADD COLUMN warranty TEXT",
    "ALTER TABLE supplier_products ADD COLUMN stock_quantity INTEGER",
    "ALTER TABLE subiekt_products ADD COLUMN weight_g REAL DEFAULT 0",
    "ALTER TABLE supplier_products ADD COLUMN weight_g REAL DEFAULT 0",
    // v1.3.0 — Catalog Master
    "ALTER TABLE supplier_products ADD COLUMN manufacturer_code TEXT",
    "ALTER TABLE supplier_products ADD COLUMN dimensions_raw TEXT",
    "ALTER TABLE supplier_products ADD COLUMN width_mm REAL DEFAULT 0",
    "ALTER TABLE supplier_products ADD COLUMN height_mm REAL DEFAULT 0",
    "ALTER TABLE supplier_products ADD COLUMN depth_mm REAL DEFAULT 0",
    // v1.4.0 — Kategorie produktów
    "ALTER TABLE supplier_products ADD COLUMN category TEXT",
    "ALTER TABLE catalog_master ADD COLUMN category_id INTEGER REFERENCES product_categories(id)",
    "ALTER TABLE catalog_master ADD COLUMN category_name TEXT",
    // v1.5.0 — Dodatkowe ceny Subiekt
    "ALTER TABLE subiekt_products ADD COLUMN sell_price_allegro REAL",
    "ALTER TABLE subiekt_products ADD COLUMN sell_price_idealpc REAL",
    "ALTER TABLE subiekt_products ADD COLUMN buy_price_gross REAL",
    // v1.6.0 — Catalog Master name normalization + original_names
    "ALTER TABLE catalog_master ADD COLUMN original_names TEXT DEFAULT '{}'",
    "ALTER TABLE catalog_master ADD COLUMN normalized_name TEXT",
    "ALTER TABLE catalog_master ADD COLUMN name_locked INTEGER DEFAULT 0",
    // v1.7.0 — Weight source tracking (Sellasist has priority over supplier feeds)
    "ALTER TABLE catalog_master ADD COLUMN weight_source TEXT DEFAULT 'supplier'",
    // v1.8.0 — Supplier active/inactive toggle
    "ALTER TABLE suppliers ADD COLUMN is_active INTEGER DEFAULT 1",
    // v1.9.0 — Category attributes: is_filter flag + unit for context-dependent params
    "ALTER TABLE category_attributes ADD COLUMN is_filter INTEGER DEFAULT 0",
    "ALTER TABLE category_attributes ADD COLUMN attr_unit TEXT",
    // v1.10.0 — XML raw attributes
    "ALTER TABLE supplier_products ADD COLUMN attributes TEXT DEFAULT '{}'",
    "ALTER TABLE catalog_master ADD COLUMN raw_attributes TEXT DEFAULT '{}'",
    // v1.11.0 — AB category tree: track which supplier a category came from + AB remapping
    "ALTER TABLE product_categories ADD COLUMN source_supplier_id INTEGER REFERENCES suppliers(id)",
    "ALTER TABLE product_categories ADD COLUMN ab_category_id INTEGER REFERENCES product_categories(id)",
    "ALTER TABLE product_categories ADD COLUMN is_ab_category INTEGER DEFAULT 0",
    "ALTER TABLE product_categories ADD COLUMN sort_order INTEGER DEFAULT 0",
        "ALTER TABLE supplier_products ADD COLUMN incoming_stock INTEGER",
    "ALTER TABLE supplier_products ADD COLUMN shipping_time_hours INTEGER",
    "ALTER TABLE supplier_products ADD COLUMN is_special_offer INTEGER DEFAULT 0",
    "ALTER TABLE supplier_products ADD COLUMN is_eol INTEGER DEFAULT 0",
    "ALTER TABLE supplier_products ADD COLUMN is_non_returnable INTEGER DEFAULT 0",
    "ALTER TABLE supplier_products ADD COLUMN is_large_product INTEGER DEFAULT 0",
    "ALTER TABLE supplier_products ADD COLUMN weight_net_g REAL DEFAULT 0",
    "ALTER TABLE supplier_products ADD COLUMN unit_measure TEXT",
    "ALTER TABLE supplier_products ADD COLUMN stock_reserved INTEGER",
    "ALTER TABLE supplier_products ADD COLUMN price_eur REAL",
    "ALTER TABLE supplier_products ADD COLUMN price_regular REAL",
    "ALTER TABLE supplier_products ADD COLUMN discount_percent REAL",
    "ALTER TABLE supplier_products ADD COLUMN pcn_code TEXT",
    "ALTER TABLE supplier_products ADD COLUMN volume REAL",
    "ALTER TABLE supplier_products ADD COLUMN product_url TEXT",
    "ALTER TABLE supplier_products ADD COLUMN product_type TEXT",
    "ALTER TABLE supplier_products ADD COLUMN availability_info TEXT",
    "ALTER TABLE supplier_products ADD COLUMN related_products TEXT",
    "ALTER TABLE supplier_products ADD COLUMN date_added TEXT",
// v1.12.0 — Impakt API extended fields
    "ALTER TABLE supplier_products ADD COLUMN price_gross REAL",
    "ALTER TABLE supplier_products ADD COLUMN price_srp REAL",
    "ALTER TABLE supplier_products ADD COLUMN vat REAL",
    "ALTER TABLE supplier_products ADD COLUMN warranty_months INTEGER",
    "ALTER TABLE supplier_products ADD COLUMN is_being_ordered INTEGER DEFAULT 0",
    "ALTER TABLE supplier_products ADD COLUMN delivery_date TEXT",
    "ALTER TABLE supplier_products ADD COLUMN package_size INTEGER",
    "ALTER TABLE supplier_products ADD COLUMN description TEXT",
    "ALTER TABLE supplier_products ADD COLUMN photos TEXT DEFAULT '[]'",
    "ALTER TABLE supplier_products ADD COLUMN supplier_product_id TEXT",
    // Action API
    "ALTER TABLE suppliers ADD COLUMN action_customer_id TEXT",
    "ALTER TABLE suppliers ADD COLUMN action_user_name TEXT",
    "ALTER TABLE suppliers ADD COLUMN action_api_key TEXT",
    "ALTER TABLE supplier_products ADD COLUMN normalized_ean TEXT",
    "ALTER TABLE subiekt_products ADD COLUMN normalized_ean TEXT",
    "ALTER TABLE product_attributes ADD COLUMN source TEXT DEFAULT 'supplier'",
  ];

  for (const m of migrations) {
    try { db.exec(m); } catch(_) {}
  }

  try { db.exec("CREATE INDEX IF NOT EXISTS idx_sp_ean_cond ON supplier_products(ean, condition)"); } catch (_) {}

  // Catalog Master table
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_master (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_ean   TEXT NOT NULL UNIQUE,
      all_eans        TEXT DEFAULT '[]',
      manufacturer_code TEXT,
      manufacturer    TEXT,
      name            TEXT,
      weight_g        REAL DEFAULT 0,
      width_mm        REAL DEFAULT 0,
      height_mm       REAL DEFAULT 0,
      depth_mm        REAL DEFAULT 0,
      dimensions_raw  TEXT,
      supplier_ids    TEXT DEFAULT '[]',
      supplier_names  TEXT DEFAULT '[]',
      best_price_pln  REAL,
      avg_price_pln   REAL,
      total_stock     INTEGER DEFAULT 0,
      category_id     INTEGER REFERENCES product_categories(id),
      category_name   TEXT,
      first_seen      TEXT DEFAULT (datetime('now')),
      last_updated    TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cm_ean ON catalog_master(canonical_ean);
    CREATE INDEX IF NOT EXISTS idx_cm_manufacturer ON catalog_master(manufacturer);
    CREATE INDEX IF NOT EXISTS idx_cm_mfr_code ON catalog_master(manufacturer_code);
    CREATE INDEX IF NOT EXISTS idx_cm_category ON catalog_master(category_id);
  `);

  // v1.4.0 — Kategorie, atrybuty (filtry), duplikaty
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      parent_id       INTEGER REFERENCES product_categories(id),
      slug            TEXT,
      product_count   INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS category_attributes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id     INTEGER NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
      attr_name       TEXT NOT NULL,
      attr_type       TEXT DEFAULT 'text',
      attr_unit       TEXT,
      visible         INTEGER DEFAULT 1,
      sort_order      INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(category_id, attr_name)
    );

    CREATE TABLE IF NOT EXISTS product_attributes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_id      INTEGER NOT NULL REFERENCES catalog_master(id) ON DELETE CASCADE,
      attribute_id    INTEGER NOT NULL REFERENCES category_attributes(id) ON DELETE CASCADE,
      value_text      TEXT,
      value_numeric   REAL,
      source          TEXT DEFAULT 'supplier',
      UNIQUE(catalog_id, attribute_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pa_catalog ON product_attributes(catalog_id);
    CREATE INDEX IF NOT EXISTS idx_pa_attr ON product_attributes(attribute_id);
    CREATE INDEX IF NOT EXISTS idx_pa_value ON product_attributes(value_text);

    CREATE TABLE IF NOT EXISTS catalog_duplicates (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      product_a_id    INTEGER NOT NULL REFERENCES catalog_master(id) ON DELETE CASCADE,
      product_b_id    INTEGER NOT NULL REFERENCES catalog_master(id) ON DELETE CASCADE,
      match_type      TEXT DEFAULT 'manufacturer_code',
      status          TEXT DEFAULT 'pending',
      resolved_at     TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(product_a_id, product_b_id)
    );

    CREATE TABLE IF NOT EXISTS category_aliases (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_name        TEXT NOT NULL UNIQUE,
      category_id     INTEGER NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_ca_raw ON category_aliases(raw_name);

    CREATE TABLE IF NOT EXISTS manufacturer_aliases (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      alias           TEXT NOT NULL UNIQUE COLLATE NOCASE,
      canonical_name  TEXT NOT NULL,
      created_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ma_alias ON manufacturer_aliases(alias COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS attr_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alias TEXT UNIQUE NOT NULL,
      canonical_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_aa_alias ON attr_aliases(alias COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS oferter_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      client_name TEXT, client_email TEXT, client_phone TEXT, client_company TEXT,
      notes_client TEXT,
      notes_internal TEXT,
      preferences TEXT,
      components TEXT,
      services TEXT,
      skipped_components TEXT,
      discount_pct REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      parent_id INTEGER,
      variant_label TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS oferter_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      required_slots TEXT,
      default_services TEXT
    );

    CREATE TABLE IF NOT EXISTS oferter_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS supplier_product_attrs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      ean TEXT NOT NULL,
      normalized_ean TEXT,
      attr_name TEXT NOT NULL,
      attr_value TEXT,
      UNIQUE(supplier_id, ean, attr_name)
    );
    CREATE INDEX IF NOT EXISTS idx_spa_ean ON supplier_product_attrs(ean);
    CREATE INDEX IF NOT EXISTS idx_spa_norm_ean ON supplier_product_attrs(normalized_ean);
    CREATE INDEX IF NOT EXISTS idx_spa_supplier ON supplier_product_attrs(supplier_id);
  `);

  migrateProductCategoriesParentNameUnique(db);

  try { db.exec('CREATE INDEX IF NOT EXISTS idx_sp_normalized_ean ON supplier_products(normalized_ean)'); } catch (_) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_sub_normalized_ean ON subiekt_products(normalized_ean)'); } catch (_) {}
  try { db.exec("ALTER TABLE supplier_product_attrs ADD COLUMN normalized_ean TEXT"); } catch (_) {}

  backfillNormalizedEans(db);

  // Data cleanup: fix any product names/manufacturers stored as '[object Object]' from XML parsing bugs
  try {
    db.prepare("UPDATE supplier_products SET name = '' WHERE name = '[object Object]' OR name LIKE '%[object Object]%'").run();
    db.prepare("UPDATE supplier_products SET manufacturer = '' WHERE manufacturer = '[object Object]' OR manufacturer LIKE '%[object Object]%'").run();
    db.prepare("UPDATE subiekt_products SET name = '' WHERE name = '[object Object]' OR name LIKE '%[object Object]%'").run();
  } catch(_) {}

  // Seed attr_aliases if empty
  try {
    const attrCount = db.prepare('SELECT count(*) as c FROM attr_aliases').get().c;
    if (attrCount === 0) {
      const insert = db.prepare('INSERT OR IGNORE INTO attr_aliases (alias, canonical_name) VALUES (?, ?)');
      for (const [k, v] of Object.entries(ATTR_KEY_TRANSLATIONS || {})) {
         insert.run(k, v);
      }
    }
  } catch(e) { console.error('Error seeding attr_aliases', e); }
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ LOGGING Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function addLog({ supplier_id = null, action, status = 'ok', details = '' }) {
  try {
    getDb().prepare(
      'INSERT INTO sourcing_logs (supplier_id, action, status, details) VALUES (?, ?, ?, ?)'
    ).run(supplier_id, action, status, details);
  } catch(_) {}
}

function getLogs({ supplier_id = null, limit = 50 } = {}) {
  const db = getDb();
  if (supplier_id) {
    return db.prepare('SELECT * FROM sourcing_logs WHERE supplier_id = ? ORDER BY created_at DESC LIMIT ?').all(supplier_id, limit);
  }
  return db.prepare('SELECT * FROM sourcing_logs ORDER BY created_at DESC LIMIT ?').all(limit);
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ COLUMN MAPPING Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

const DEFAULT_MAP = { ean:'', name:'', stock:'', buy_price:'', sell_price:'', sold_12m:'', sold_30d:'', buy_price_date:'', weight_g:'' };

function getColumnMap() {
  const row = getDb().prepare('SELECT map_json FROM sourcing_column_map WHERE id = ?').get('default');
  if (!row) return DEFAULT_MAP;
  try { return { ...DEFAULT_MAP, ...JSON.parse(row.map_json) }; } catch { return DEFAULT_MAP; }
}

function saveColumnMap(mapObj) {
  getDb().prepare(`
    INSERT INTO sourcing_column_map (id, map_json, updated_at) VALUES ('default', ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET map_json=excluded.map_json, updated_at=excluded.updated_at
  `).run(JSON.stringify(mapObj));
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ EXCEL PREVIEW (for mapping UI) Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function previewExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (!rows.length) return { columns: [], preview: [] };

  const headers = rows[0].map(String);
  const preview = rows.slice(1, 6).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
  return { columns: headers, preview, sheetName };
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ CSV PREVIEW & PARSER Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function parseCsvBuffer(buffer) {
  let str;
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    str = buffer.slice(3).toString('utf-8');
  } else if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    str = buffer.slice(2).toString('utf16le');
  } else {
    const utf8Try = buffer.toString('utf-8');
    const hasReplacementChar = utf8Try.includes('\uFFFD');
    str = hasReplacementChar
      ? iconv.decode(buffer, 'win1250')
      : utf8Try;
  }

  const lines = str.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) {
    return { columns: [], preview: [], separator: ';' };
  }

  const firstLine = lines[0];
  let sepChar = ';';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  if (tabCount > semiCount && tabCount > commaCount) sepChar = '\t';
  else if (commaCount > semiCount) sepChar = ',';

  const parseLine = (line) => {
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === sepChar && !inQ) {
        cols.push(cur.trim()); cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = parseLine(lines[0]).map(h => String(h).replace(/^["']+|["']+$/g, '').trim());
  const rows = lines.slice(1, 6).map(line => {
    const cols = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return { columns: headers, preview: rows, separator: sepChar };
}

function previewCsv(buffer) {
  return parseCsvBuffer(buffer);
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ SUBIEKT IMPORT Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function importSubiektExcel(buffer, columnMap) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (rows.length < 2) throw new Error('Plik jest pusty lub zawiera tylko naglowek');

  const headers = rows[0].map(String);
  const idx = {};
  for (const [field, col] of Object.entries(columnMap)) {
    idx[field] = col ? headers.indexOf(col) : -1;
  }
  if (idx.ean < 0) throw new Error('Kolumna EAN nie zostala zmapowana lub nie istnieje w pliku');

  return _doImportSubiekt(rows.slice(1), headers, idx);
}

function importSubiektCsv(buffer, columnMap) {
  const parsed = parseCsvBuffer(buffer);
  if (!parsed || !parsed.columns || !parsed.columns.length) {
    throw new Error('Nie mozna sparsowac CSV lub plik jest pusty');
  }
  const { columns: headers, separator } = parsed;

  let str;
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    str = buffer.slice(3).toString('utf-8');
  } else if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    str = buffer.slice(2).toString('utf16le');
  } else {
    const utf8Try = buffer.toString('utf-8');
    str = utf8Try.includes('\uFFFD') ? iconv.decode(buffer, 'win1250') : utf8Try;
  }
  const lines = str.split(/\r?\n/).filter(l => l.trim());

  const parseLine = (line) => {
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === separator && !inQ) {
        cols.push(cur.trim()); cur = '';
      } else { cur += c; }
    }
    cols.push(cur.trim());
    return cols;
  };

  const idx = {};
  for (const [field, col] of Object.entries(columnMap)) {
    idx[field] = col ? headers.indexOf(col) : -1;
  }
  if (idx.ean < 0) throw new Error('Kolumna EAN nie zostala zmapowana');

  const dataRows = lines.slice(1).map(l => parseLine(l));
  return _doImportSubiekt(dataRows, headers, idx);
}

function parseSubiektNumber(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return val;
  let str = String(val).trim();
  str = str.replace(/\s+/g, '').replace(/\u00A0/g, '');
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else {
    str = str.replace(',', '.');
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}

function _doImportSubiekt(dataRows, headers, idx) {
  const db = getDb();
  const products = [];


  for (const row of dataRows) {
    const rawEan = String(row[idx.ean] ?? '').trim();
    const ean = rawEan.replace(/[^0-9]/g, '');
    if (!ean) continue;
    // Parse buy_price_date: accept various date formats (dd.mm.yyyy, yyyy-mm-dd, dd/mm/yyyy, etc.)
    let buy_price_date = null;
    if (idx.buy_price_date >= 0) {
      const raw = String(row[idx.buy_price_date] ?? '').trim();
      if (raw) {
        // Try ISO format first (yyyy-mm-dd)
        const isoMatch = raw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        // Try European format (dd.mm.yyyy or dd/mm/yyyy)
        const euMatch = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
        if (isoMatch) {
          buy_price_date = `${isoMatch[1]}-${isoMatch[2].padStart(2,'0')}-${isoMatch[3].padStart(2,'0')}`;
        } else if (euMatch) {
          buy_price_date = `${euMatch[3]}-${euMatch[2].padStart(2,'0')}-${euMatch[1].padStart(2,'0')}`;
        } else {
          // Try JS Date parse as fallback
          const d = new Date(raw);
          if (!isNaN(d.getTime())) buy_price_date = d.toISOString().slice(0,10);
        }
      }
    }
    products.push({
      ean,
      name:       idx.name >= 0      ? String(row[idx.name] ?? '')          : '',
      stock:      idx.stock >= 0     ? parseFloat(row[idx.stock]) || 0      : 0,
      buy_price:  idx.buy_price >= 0 ? parseSubiektNumber(row[idx.buy_price]) : null,
      sell_price: idx.sell_price >= 0? parseSubiektNumber(row[idx.sell_price]) : null,
      sold_12m:   idx.sold_12m >= 0  ? parseInt(row[idx.sold_12m]) || 0     : 0,
      sold_30d:   idx.sold_30d >= 0  ? parseInt(row[idx.sold_30d]) || 0     : 0,
      weight_g:   idx.weight_g >= 0  ? ((parseSubiektNumber(row[idx.weight_g]) || 0) * 1000) : 0, // Assume kg if from Subiekt
      buy_price_date,
      sell_price_allegro: idx.sell_price_allegro >= 0 ? parseSubiektNumber(row[idx.sell_price_allegro]) : null,
      sell_price_idealpc: idx.sell_price_idealpc >= 0 ? parseSubiektNumber(row[idx.sell_price_idealpc]) : null,
      buy_price_gross:    idx.buy_price_gross >= 0    ? parseSubiektNumber(row[idx.buy_price_gross]) : null,
    });
  }
  if (!products.length) throw new Error('Nie znaleziono zadnych produktow z kodem EAN');

  db.transaction(() => {
    db.prepare('DELETE FROM subiekt_products').run();
    const ins = db.prepare(
      'INSERT INTO subiekt_products (ean, normalized_ean, name, stock, buy_price, sell_price, sold_12m, sold_30d, buy_price_date, weight_g, sell_price_allegro, sell_price_idealpc, buy_price_gross) VALUES (@ean, @normalized_ean, @name, @stock, @buy_price, @sell_price, @sold_12m, @sold_30d, @buy_price_date, @weight_g, @sell_price_allegro, @sell_price_idealpc, @buy_price_gross)'
    );
    for (const p of products) ins.run({ ...p, normalized_ean: normalizeEan(p.ean) });
  })();

  addLog({ action: 'subiekt_import', status: 'ok', details: `Zaimportowano ${products.length} produktow` });
  return { imported: products.length };
}

function getSubiektStatus() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as cnt FROM subiekt_products').get().cnt;
  const last  = db.prepare('SELECT MAX(imported_at) as ts FROM subiekt_products').get().ts;
  const map   = getColumnMap();
  return { count, last_import: last, column_map: map };
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ SUPPLIER XML PARSER Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function processAttrValue(key, val, outObj) {
  const vStr = String(val).trim();
  if (!vStr || vStr === '0' || vStr === '-' || vStr === 'null') return;
  if (vStr.includes(' | ')) {
    const parts = vStr.split(' | ').filter(x => x.trim());
    parts.forEach(p => {
      let cleanP = p.trim();
      if (cleanP.includes(':')) {
         const idx = cleanP.indexOf(':');
         const subK = cleanP.substring(0, idx).trim();
         const subV = cleanP.substring(idx + 1).trim();
         if (subK && subV) { outObj[subK] = subV; return; }
      } else if (cleanP.includes(' - ')) {
         const idx = cleanP.indexOf(' - ');
         const subK = cleanP.substring(0, idx).trim();
         const subV = cleanP.substring(idx + 3).trim();
         if (subK && subV) { outObj[subK] = subV; return; }
      }
      outObj[cleanP] = 'Tak';
    });
  } else {
    outObj[key] = vStr;
  }
}

async function parseSupplierXml(buffer, colSettings = {}) {
  // Try UTF-8 first, fallback to windows-1250 for Polish chars
  let xmlStr;
  try {
    xmlStr = buffer.toString('utf-8');
    // Check for garbled UTF-8 by looking at first 200 chars
    if (xmlStr.slice(0, 500).includes('\uFFFD')) {
      xmlStr = iconv.decode(buffer, 'win1250');
    }
  } catch(_) {
    xmlStr = iconv.decode(buffer, 'win1250');
  }
  // Strip BOM
  if (xmlStr.charCodeAt(0) === 0xFEFF) xmlStr = xmlStr.slice(1);

  const parsed = await xml2js.parseStringPromise(xmlStr, {
    explicitArray: false, mergeAttrs: true, attrkey: '$attrs', charkey: '_text'
  });
  const products = [];
  
  // Native BMECAT parser
  if (parsed?.BMECAT?.T_NEW_CATALOG?.ARTICLE) {
    // 1. Build classification dictionary
    const featureDict = {};
    if (parsed.BMECAT.T_NEW_CATALOG.CLASSIFICATION_SYSTEM?.CLASSIFICATION_SYSTEM_FEATURE_TEMPLATES?.CLASSIFICATION_SYSTEM_FEATURE_TEMPLATE) {
      const templates = parsed.BMECAT.T_NEW_CATALOG.CLASSIFICATION_SYSTEM.CLASSIFICATION_SYSTEM_FEATURE_TEMPLATES.CLASSIFICATION_SYSTEM_FEATURE_TEMPLATE;
      const tArr = Array.isArray(templates) ? templates : [templates];
      tArr.forEach(t => {
        const id = typeof t.FT_ID === 'object' ? t.FT_ID._text : t.FT_ID;
        const name = typeof t.FT_NAME === 'object' ? t.FT_NAME._text : t.FT_NAME;
        if (id && name) featureDict[id] = name;
      });
    }

    // 2. Build Category Group Dictionary
    const categoryGroupDict = {};
    if (parsed.BMECAT.T_NEW_CATALOG.CATALOG_GROUP_SYSTEM?.CATALOG_STRUCTURE) {
      const structures = parsed.BMECAT.T_NEW_CATALOG.CATALOG_GROUP_SYSTEM.CATALOG_STRUCTURE;
      const sArr = Array.isArray(structures) ? structures : [structures];
      sArr.forEach(s => {
        const id = typeof s.GROUP_ID === 'object' ? s.GROUP_ID._text : s.GROUP_ID;
        const name = typeof s.GROUP_NAME === 'object' ? s.GROUP_NAME._text : s.GROUP_NAME;
        if (id && name) categoryGroupDict[id] = name;
      });
    }

    // 3. Build Article to Category mapping
    const articleCatMap = {};
    if (parsed.BMECAT.T_NEW_CATALOG.ARTICLE_TO_CATALOGGROUP_MAP) {
      const maps = parsed.BMECAT.T_NEW_CATALOG.ARTICLE_TO_CATALOGGROUP_MAP;
      const mArr = Array.isArray(maps) ? maps : [maps];
      mArr.forEach(m => {
        const artId = typeof m.ART_ID === 'object' ? m.ART_ID._text : m.ART_ID;
        const catId = typeof m.CATALOG_GROUP_ID === 'object' ? m.CATALOG_GROUP_ID._text : m.CATALOG_GROUP_ID;
        if (artId && catId) articleCatMap[artId] = categoryGroupDict[catId] || catId;
      });
    }

    const articles = Array.isArray(parsed.BMECAT.T_NEW_CATALOG.ARTICLE) ? parsed.BMECAT.T_NEW_CATALOG.ARTICLE : [parsed.BMECAT.T_NEW_CATALOG.ARTICLE];
    for (const a of articles) {
      const details = a.ARTICLE_DETAILS || {};
      
      const getName = (obj) => typeof obj === 'object' ? (obj._text || '') : String(obj || '');
      const name = getName(details.DESCRIPTION_SHORT);
      const description = getName(details.DESCRIPTION_LONG);
      const manufacturer = getName(details.MANUFACTURER_NAME);
      const manufacturer_code = getName(a.SUPPLIER_AID);
      
      const eanObj = details.EAN;
      let ean = '';
      if (eanObj) ean = typeof eanObj === 'object' ? (eanObj._text || '') : String(eanObj);
      ean = ean.replace(/[^a-zA-Z0-9-_]/g, '');
      
      if (!ean || ean.length < 4) {
         let fallback = manufacturer_code.replace(/[^a-zA-Z0-9-_]/g, '');
         if (fallback.length >= 4) ean = 'WORTMAN-' + fallback;
      }
      
      if (!ean || ean.length < 4) continue;
      
      let price = 0;
      let price_regular = 0;
      if (a.ARTICLE_PRICE_DETAILS?.ARTICLE_PRICE) {
        const prices = Array.isArray(a.ARTICLE_PRICE_DETAILS.ARTICLE_PRICE) ? a.ARTICLE_PRICE_DETAILS.ARTICLE_PRICE : [a.ARTICLE_PRICE_DETAILS.ARTICLE_PRICE];
        const netCustomer = prices.find(p => p.price_type === 'net_customer' || p.$attrs?.price_type === 'net_customer');
        const netList = prices.find(p => p.price_type === 'net_list' || p.$attrs?.price_type === 'net_list');
        
        if (netCustomer) {
           const pa = netCustomer.PRICE_AMOUNT;
           price = parseFloat(typeof pa === 'object' ? pa._text : pa) || 0;
        }
        if (netList) {
           const pr = netList.PRICE_AMOUNT;
           price_regular = parseFloat(typeof pr === 'object' ? pr._text : pr) || 0;
        }
        if (!price && prices.length > 0) {
           const p0 = prices[0].PRICE_AMOUNT;
           price = parseFloat(typeof p0 === 'object' ? p0._text : p0) || 0;
        }
      }
      
      if (price <= 0) continue;
      
      let stock = 0;
      if (a.USER_DEFINED_EXTENSIONS?.['UDX.WORTMANN_AG.AVAILABILITY']) {
        const st = a.USER_DEFINED_EXTENSIONS['UDX.WORTMANN_AG.AVAILABILITY']['UDX.WORTMANN_AG.STOCK'];
        stock = parseFloat(typeof st === 'object' ? st._text : st) || 0;
      }
      
      const category = articleCatMap[manufacturer_code] || '';
      
      const attrs = {};
      if (a.ARTICLE_FEATURES) {
         const featGroups = Array.isArray(a.ARTICLE_FEATURES) ? a.ARTICLE_FEATURES : [a.ARTICLE_FEATURES];
         featGroups.forEach(fg => {
            if (fg.FEATURE) {
              const feats = Array.isArray(fg.FEATURE) ? fg.FEATURE : [fg.FEATURE];
              feats.forEach(f => {
                let fn = typeof f.FNAME === 'object' ? f.FNAME._text : f.FNAME;
                const fv = typeof f.FVALUE === 'object' ? f.FVALUE._text : f.FVALUE;
                if (fn && featureDict[fn]) fn = featureDict[fn];
                if (fn && fv) attrs[fn] = fv;
              });
            }
         });
      }

      products.push({
        ean,
        name: name.trim(),
        description: description.trim(),
        manufacturer: manufacturer.trim(),
        manufacturer_code: manufacturer_code.trim(),
        category,
        price,
        price_pln: price,
        price_regular,
        stock_quantity: stock,
        availability: stock > 0 ? 'available' : 'unavailable',
        attributes: Object.keys(attrs).length > 0 ? attrs : null
      });
    }
    return products;
  }

  // Map category IDs if a <categories> dictionary is provided (e.g. Qoltec/NTC)
  const xmlCategoryMap = {};
  try {
    let catsArray = null;
    if (parsed?.products?.categories?.cat) catsArray = parsed.products.categories.cat;
    else if (parsed?.export?.categories?.cat) catsArray = parsed.export.categories.cat;
    else if (parsed?.offer?.categories?.category) catsArray = parsed.offer.categories.category;
    
    if (catsArray) {
      const cats = Array.isArray(catsArray) ? catsArray : [catsArray];
      cats.forEach(c => {
        const id = c.id || c.Id || c.ID || (c.$attrs && (c.$attrs.id || c.$attrs.Id || c.$attrs.ID));
        const name = c._text || c.name || c.Name || (c.$attrs && (c.$attrs.name || c.$attrs.Name));
        if (id && name) xmlCategoryMap[String(id)] = String(name).trim();
      });
    }
  } catch(e) { console.warn("Error parsing XML categories map:", e.message); }

  const eanField   = colSettings.ean_field   || null;
  const priceField = colSettings.price_field  || null;
  const availField = colSettings.avail_field  || null;
  const stockQtyField = colSettings.stock_qty_field || null;
  const nameField  = colSettings.name_field   || null;
  const mfgField   = colSettings.mfg_field    || null;
  const mfgCodeField = colSettings.manufacturer_code || colSettings.mfg_code_field || null;
  const weightField= colSettings.weight_field || null;
  const catField   = colSettings.cat_field    || null;
  const EAN_KEYS   = eanField ? [eanField] : [
    'ean', 'EAN', 'Ean', 'ean_kod', 'barcode', 'BARCODE',
    'Kod_ean', 'Kod_EAN', 'kod_ean', 'kodean', 'KodEan',     // MCM
    'kod_produktu', 'Kod_produktu',                          // NTT
    'TwrEan', 'TwrCode',                                     // Platinet
    // NOTE: Akyga <sku> is internal wholesaler code (NOT EAN!) — EAN is <ean>
    // NOTE: Action uses EAN attribute directly
    'gtin', 'GTIN', 'isbn', 'upc', 'ean13', 'kod_kreskowy',
    'EANCode', 'eancode', 'ean_kodu', 'kod_ean_produktu', 'kody_ean', 'ean_code',
    'ean_number', 'EAN_number', 'product_ean',
  ];

  const PRICE_KEYS = priceField ? [priceField] : [
    // Action: priceNet = cena netto
    'priceNet', 'PriceNet', 'price_net',
    // Akyga: price = cena netto PLN, priceGross = z VAT, priceRetail = RRP
    'price', 'Price', 'cena', 'Cena', 'netto', 'Netto',
    'cena_zak', 'Cena_zak', 'cena_zakupu', 'cenaNetto',      // NTT
    'PricePLN', 'PriceExpEUR', 'PriceSugPLN',                // Platinet
    'price_netto', 'price_net', 'gross_price', 'brutto', 'Brutto',
    'price_wholesale', 'wholesale_price', 'cena_netto', 'cena_brutto',
    'price1', 'price2', 'PriceNetto', 'PriceBrutto',
    'net_price.price', 'netto_price.price', 'price_netto.price',
    'srp_net_price.price', 'cena_netto.price', 'cena_brutto.price',
    'price_gross.price', 'price_net.price', 'gross_price.price',
    'wholesale.price', 'hurtowa.cena', 'cennik.cena',
    'price_netto_zl', 'cena_dealera', 'price_dealer',
    'Cena_netto', 'Cena_brutto', 'Cena_zakupu',
  ];

  const AVAIL_KEYS = availField ? [availField] : [
    // Action: available = liczba lub "ponad 30"
    'available', 'Available',
    // Akyga: qty = dostepna ilosc, delivery = ilosc w najblizszej dostawie
    'qty', 'Qty',
    'availability', 'dostepnosc', 'stock', 'quantity',
    'ilosc', 'ilosc_dostepna', 'instock', 'IsAvailable', 'Availability',
    'stan_magazynowy', 'quantity_available', 'dostepnosc_produktu', 'stan_produktu',
    'stan', 'Stan', 'ilosc',                                 // NTT
    'Q_A', 'Q_R', 'Q_N', 'InBox',                            // Platinet
    'dostepny', 'ilosc_w_magazynie', 'na_stanie', 'magazyn',
    'Ilosc', 'Ilosc_produktow',                              // MCM
  ];

  const QTY_KEYS = stockQtyField ? [stockQtyField] : [
    'qty', 'Qty', 'stock', 'Stock', 'quantity', 'Quantity', 'ilosc', 'Ilosc',
    'stan', 'Stan', 'stan_magazynowy', 'quantity_available', 'ilosc_dostepna',
    'Q_A', 'Q_N', 'ilosc_w_magazynie', 'na_stanie', 'magazyn', 'Ilosc_produktow',
    'inStock', 'in_stock', 'InStock'
  ];

  const NAME_KEYS  = nameField ? [nameField] : [
    'name', 'Name', 'nazwa', 'Nazwa', 'title', 'Title',
    'opikar', 'Opikar', 'Opis', 'opis', 'produktNazwa',     // NTT
    'NamePL', 'NameEN', 'NameDE',                           // Platinet
    'Nazwa_produktu', 'Nazwa_towaru',                       // MCM
    'product_name', 'ProductName', 'description',
    'nazwa_produktu', 'nazwa_towaru', 'nazwa_artykulu', 'pelna_nazwa',
    'product_title', 'item_name', 'towar', 'artykul', 'opis_produktu',
    'long_name', 'full_name', 'display_name', 'label',
  ];

  const MFG_KEYS   = mfgField ? [mfgField] : [
    'manufacturer', 'producent', 'Producent', 'producer', 'Producer',
    'brand', 'Brand', 'marka', 'Marka', 'vendor', 'Vendor',
    'producent_nazwa', 'nazwa_producenta', 'marka_produktu',
    'manufacturer_name', 'brand_name', 'dostawca',
  ];

  // Manufacturer Code (SKU / Part Number)
  const MFG_CODE_KEYS = mfgCodeField ? [mfgCodeField] : [
    // Action: manufacturerPartNumber = kod producenta
    'manufacturerPartNumber', 'ManufacturerPartNumber',
    // Akyga: manufacturerCode = wlasciwy kod produktu do prezentacji klientom
    'manufacturerCode', 'ManufacturerCode',
    'manufacturer_code', 'manufacturer_code_field',
    'part_number', 'PartNumber', 'partNumber', 'part_no', 'PartNo', 'partno', 'Partno',
    'mpn', 'MPN', 'Mpn',
    // NOTE: Akyga <sku> = wewnetrzny kod Akyga (nie dla klientow), ale przechowujemy jako mfg_code fallback
    'sku', 'SKU', 'Sku',
    'kod_producenta', 'Kod_producenta', 'KodProducenta', 'kodProducenta', 'kod_prod',
    'symbol', 'Symbol', 'indeks', 'Indeks',
    'reference', 'Reference', 'ref', 'Ref',
    'nr_katalogowy', 'numer_katalogowy', 'catalog_number', 'CatalogNumber',
    'TwrCode', 'twrcode', 'ItemCode', 'itemCode', 'item_code',
    'vendor_code', 'VendorCode', 'vendorCode',
    'product_code', 'ProductCode', 'productCode',
    'model', 'Model',
    'pn', 'PN', 'Pn',
    'code', 'Code',
    'kod_produktu', 'Kod_produktu', 'KodProduktu',
    'symbol_producenta', 'Symbol_producenta', 'SymbolProducenta'
  ];

  const CONDITION_KEYS = [
    'condition', 'stan', 'Stan', 'stan_produktu', 'state', 'used',
    'product_condition', 'stan_towaru', 'nowy_uzywany', 'kondycja',
  ];

  const WARRANTY_KEYS = [
    // Action: warranty codes like G024M, F024M etc.
    'warranty', 'gwarancja', 'Gwarancja', 'guarantee', 'warranty_months',
    'gwarancja_miesiace', 'warranty_period', 'okres_gwarancji',
  ];

  const WEIGHT_KEYS = weightField ? [weightField] : [
    // Action: weight in g (weightMeasurementUnit tells if mm/g)
    'weight', 'Weight',
    'waga_brutto', 'waga_z_opakowaniem', 'waga_z_kartonem', 'masa_brutto',
    'weight_gross', 'gross_weight', 'weight_brutto',
    'waga', 'Waga', 'waga_netto', 'masa', 'masa_netto',
    'weight_net', 'net_weight', 'waga_kg',
  ];

  const CATEGORY_KEYS = [
    ...(catField ? [catField] : []),
    // Action: hierarchy tree fields
    'subCategoryTree', 'categoryTree', 'mainCategoryTree',
    'SubCategoryTree', 'CategoryTree', 'MainCategoryTree',
    'category', 'Category', 'kategoria', 'Kategoria', 'cat', 'Cat', 'categories', 'Categories',
    'group', 'Group', 'grupa', 'Grupa', 'grupa_produktu', 'grupa_towarowa',
    'product_group', 'product_category', 'productGroup', 'ProductGroup',
    'CategoryName', 'category_name', 'categoryName', 'typ', 'Typ', 'type', 'Type',
    'klasa', 'Klasa', 'class', 'Class', 'dział', 'dzial', 'Dzial',
    'rodzaj', 'Rodzaj', 'podkategoria', 'Podkategoria', 'subcategory',
    'GroupName', 'group_name', 'nazwa_grupy', 'nazwa_kategorii',
    'categoryId', 'category_id', 'CategoryId', 'groupId',
    'sciezkaKategorii', 'idKategorii', 'id_kategorii'
  ];

  // Safely resolve a value that may be a nested XML object to a string
  function _resolveToString(val) {
    if (val === null || val === undefined) return null;
    if (typeof val !== 'object') {
      const s = String(val).trim();
      return s !== '' ? s : null;
    }
    // xml2js object with _text (charkey)
    if (val._text !== undefined) {
      const s = String(val._text).trim();
      return s !== '' ? s : null;
    }
    // Array — take first non-empty element
    if (Array.isArray(val)) {
      for (const item of val) {
        const resolved = _resolveToString(item);
        if (resolved) return resolved;
      }
      return null;
    }
    // Plain object — try to extract text content from known sub-keys
    const textKeys = ['_text', '_', 'value', 'Value', '#text', 'text', 'name', 'Name'];
    for (const tk of textKeys) {
      if (val[tk] !== undefined && val[tk] !== null && typeof val[tk] !== 'object') {
        const s = String(val[tk]).trim();
        if (s !== '') return s;
      }
    }
    // Last resort: if there's only one non-$attrs key, use its value
    const nonAttrKeys = Object.keys(val).filter(k => k !== '$attrs');
    if (nonAttrKeys.length === 1) {
      const inner = val[nonAttrKeys[0]];
      if (inner !== null && inner !== undefined && typeof inner !== 'object') {
        const s = String(inner).trim();
        if (s !== '') return s;
      }
    }
    // Cannot resolve — return null instead of [object Object]
    return null;
  }

    function tryExtract(obj, keys) {
    for (const k of keys) {
      if (k.includes('.')) {
        const parts = k.split('.');
        let cur = obj;
        let ok = true;
        for (const p of parts) {
          if (cur && typeof cur === 'object') {
            if (cur[p] !== undefined && cur[p] !== null) {
              cur = cur[p];
            } else if (cur.$attrs && cur.$attrs[p] !== undefined && cur.$attrs[p] !== null) {
              cur = cur.$attrs[p];
            } else { ok = false; break; }
          } else { ok = false; break; }
        }
        if (ok && cur !== undefined && cur !== null) {
          const resolved = _resolveToString(cur);
          if (resolved) return resolved;
        }
      } else {
        if (obj[k] !== undefined && obj[k] !== null) {
          const resolved = _resolveToString(obj[k]);
          if (resolved) return resolved;
        } else if (obj.$attrs && obj.$attrs[k] !== undefined && obj.$attrs[k] !== null) {
          const resolved = _resolveToString(obj.$attrs[k]);
          if (resolved) return resolved;
        }
      }
    }
    return null;
  }

  // EAN extractor with MCM multi-field fallback
  // Accepts EAN-8 (8 digits) through EAN-14 (14 digits)
  function tryExtractEan(obj) {
    const raw = tryExtract(obj, EAN_KEYS);
    if (raw) {
      const digits = String(raw).replace(/[^a-zA-Z0-9-_]/g, '');
      if (digits.length >= 4) return digits;
    }
    for (const key of Object.keys(obj)) {
      if (/^Kod_ean_/i.test(key) || /^ean_[a-z]/i.test(key)) {
        const v = obj[key]; const s = (typeof v === 'object') ? (v._text || '') : String(v || '');
        const digits = s.replace(/[^0-9]/g, ''); if (digits.length >= 8) return digits;
      }
    }
    return null;
  }

  function extractAttributesFromNode(node) {
    const attrs = {};
    const containers = ['parameters', 'attributes', 'properties', 'features', 'parametry', 'cechy', 'atrybuty', 'shortdata',
      'specification', 'spec', 'specs', 'specyfikacja', 'dane_techniczne', 'techdata', 'technical_data', 'product_features',
      'attrs', 'params', 'technicalParameters', 'technicalData', 'productAttributes', 'productParameters'];
    const items = ['parameter', 'attribute', 'property', 'feature', 'parametr', 'cecha', 'atrybut', 'data', 'spec', 'item',
      'param', 'attr', 'technicalParameter'];
    
    // Helper to extract name/value from a single item element
    function extractNameValue(item) {
      if (typeof item !== 'object' || item === null) return null;
      // Try $attrs first (xml2js mergeAttrs): <parameter name="X">Y</parameter> or <parameter name="X" value="Y"/>
      let name = null, val = null;
      
      // Attribute-based: name from $attrs or merged attrs
      const nameKeys = ['name', 'Name', 'NAME', 'id', 'Id', 'ID', 'label', 'Label', 'key', 'Key', 'title', 'Title'];
      const valKeys = ['value', 'Value', 'VALUE', 'val', 'Val', '_text', '_cdata', 'content', 'Content'];
      
      // Check $attrs (xml2js)
      if (item.$attrs) {
        for (const nk of nameKeys) { if (item.$attrs[nk]) { name = String(item.$attrs[nk]).trim(); break; } }
        for (const vk of valKeys) { if (item.$attrs[vk]) { val = String(item.$attrs[vk]).trim(); break; } }
      }
      
      // Check direct properties (after mergeAttrs these are at top level too)
      if (!name) {
        for (const nk of nameKeys) {
          if (item[nk] !== undefined && item[nk] !== null) {
            const resolved = (typeof item[nk] === 'object' && item[nk]._text) ? String(item[nk]._text).trim() : String(item[nk]).trim();
            if (resolved) { name = resolved; break; }
          }
        }
      }
      
      // Value: try _text (charkey), then value fields, then nested value objects
      if (!val) {
        if (item._text !== undefined && item._text !== null) {
          val = String(item._text).trim();
        } else {
          for (const vk of valKeys) {
            if (item[vk] !== undefined && item[vk] !== null && vk !== '_text') {
              const resolved = (typeof item[vk] === 'object' && item[vk]._text) ? String(item[vk]._text).trim() : String(item[vk]).trim();
              if (resolved) { val = resolved; break; }
            }
          }
        }
      }
      
      // Polish-specific field names
      if (!name && item.nazwaCechy) name = (typeof item.nazwaCechy === 'object') ? String(item.nazwaCechy._text || '').trim() : String(item.nazwaCechy).trim();
      if (!val && item.wartoscCechy) val = (typeof item.wartoscCechy === 'object') ? String(item.wartoscCechy._text || '').trim() : String(item.wartoscCechy).trim();
      
      if (name && val && name.length >= 1 && val.length >= 1) return { name, val };
      return null;
    }
    
    // 1. Extract from nested containers
    for (const c of containers) {
      if (node[c] && typeof node[c] === 'object') {
        const containerObj = node[c];
        
        // Try known item tag names
        for (const i of items) {
          if (containerObj[i]) {
            const list = Array.isArray(containerObj[i]) ? containerObj[i] : [containerObj[i]];
            list.forEach(item => {
              const nv = extractNameValue(item);
              if (nv) processAttrValue(nv.name, nv.val, attrs);
            });
          }
        }
        
        // Also try direct key-value pairs inside container (e.g. <attributes><color>Black</color></attributes>)
        for (const [ck, cv] of Object.entries(containerObj)) {
          if (items.includes(ck) || ck === '$attrs' || ck === '_text') continue;
          if (typeof cv === 'string' && cv.trim()) {
            processAttrValue(ck.trim(), cv.trim(), attrs);
          } else if (typeof cv === 'object' && cv !== null && cv._text) {
            processAttrValue(ck.trim(), String(cv._text).trim(), attrs);
          }
        }
      }
    }

    // 2. Extract from flat keys (ignore standard ones)
    const excludeKeys = ['_attributes', '_text', '_cdata', '$attrs', 'id', 'name', 'price', 'ean', 'category', 'manufacturer', 'weight', 'availability', 'description', 'images', 'pictures', 'zdjecia', 'photos', 'kod_producenta', 'part_number', 'sku', 'stock', 'stan', 'warranty', 'gwarancja', 'opis',
    'nazwa_produktu', 'symbol_produktu', 'nazwa_producenta', 'symbol_producenta', 'marka', 'nazwa_grupy_towarowej', 'grupa_towarowa', 'link_do_zdjecia_produktu', 'stan_magazynowy', 'cena', 'stawka_vat', 'gpsr_producent', 'gpsr_podmiot_odpowiedzialny',
    'url', 'symbol', 'cn_code', 'producer', 'producent', 'tax', 'vat', 'deliveries', 'delivery', 'srp_net_price', 'image', 'categories', 'barcode', 'quantity', 'available', 'pricenet',
    'pricegross', 'priceretail', 'manufacturercode', 'nameen', 'qty'];
    
    for (const [k, v] of Object.entries(node)) {
      const kLow = k.toLowerCase();
      if (excludeKeys.includes(kLow) || containers.includes(kLow)) continue;
      
      if (v !== null && typeof v === 'object') {
        let valStr = v._text || v._cdata || v.value?._text;
        if (typeof valStr === 'string' && valStr.trim() !== '') {
          processAttrValue(k.trim(), valStr.trim(), attrs);
        }
      } else if (typeof v === 'string' || typeof v === 'number') {
        if (String(v).trim() !== '') {
          processAttrValue(k.trim(), String(v).trim(), attrs);
        }
      }
    }

    // 3. Deep recursive scan for feature/parameter containers buried deep in the XML tree
    //    (e.g. Akyga: product > akyga > translations > translation > features > feature[])
    function deepScanForFeatures(obj, depth) {
      if (depth > 8 || !obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(item => deepScanForFeatures(item, depth)); return; }
      
      // Skip non-Polish translations (e.g. Akyga has translation[code=pl/en/de/fr])
      if (obj.code && typeof obj.code === 'string' && obj.code !== 'pl') return;
      
      for (const c of containers) {
        if (obj[c] && typeof obj[c] === 'object') {
          const containerObj = obj[c];
          for (const i of items) {
            if (containerObj[i]) {
              const list = Array.isArray(containerObj[i]) ? containerObj[i] : [containerObj[i]];
              list.forEach(item => {
                const nv = extractNameValue(item);
                if (nv) processAttrValue(nv.name, nv.val, attrs);
              });
            }
          }
          // Direct key-value pairs in container
          for (const [ck, cv] of Object.entries(containerObj)) {
            if (items.includes(ck) || ck === '$attrs' || ck === '_text') continue;
            if (typeof cv === 'string' && cv.trim()) processAttrValue(ck.trim(), cv.trim(), attrs);
            else if (typeof cv === 'object' && cv !== null && cv._text) processAttrValue(ck.trim(), String(cv._text).trim(), attrs);
          }
        }
      }
      
      for (const [k, v] of Object.entries(obj)) {
        if (k === '$attrs' || k === '_text') continue;
        if (typeof v === 'object') deepScanForFeatures(v, depth + 1);
      }
    }
    
    // Always run deep scan to find feature containers buried deep in the tree
    // (e.g. Akyga: akyga > translations > translation > features > feature[])
    deepScanForFeatures(node, 0);

    return Object.keys(attrs).length > 0 ? attrs : null;
  }



  const seen = new Set();

  function walkAndCollect(node, depth = 0) {
    if (depth > 8 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => walkAndCollect(n, depth)); return; }

    const eanRaw = tryExtractEan(node);
    const rawPrice = tryExtract(node, PRICE_KEYS);
    const availability = tryExtract(node, AVAIL_KEYS);
    const rawQty = tryExtract(node, QTY_KEYS);
    const name = tryExtract(node, NAME_KEYS);
    const manufacturer = tryExtract(node, MFG_KEYS);
    const manufacturerCode = tryExtract(node, MFG_CODE_KEYS);
    const condition = tryExtract(node, CONDITION_KEYS);
    const warranty = tryExtract(node, WARRANTY_KEYS);
    const rawWeight = tryExtract(node, WEIGHT_KEYS);
    let category = tryExtract(node, CATEGORY_KEYS);
    if (category && /^[0-9]+$/.test(String(category).trim()) && xmlCategoryMap[String(category).trim()]) {
        category = xmlCategoryMap[String(category).trim()];
    } else {
        const catId = tryExtract(node, ['categoryId', 'category_id', 'groupId']);
        if (catId && xmlCategoryMap[String(catId).trim()]) {
            category = xmlCategoryMap[String(catId).trim()];
        }
    }
    // FEN: categories.category is an array of {_text: "Kategorie>...", id: "..."}
    // Pick the entry starting with "Kategorie>" and take the last segment
    if (!category && node.categories && node.categories.category) {
      const catArr = Array.isArray(node.categories.category) ? node.categories.category : [node.categories.category];
      // Prefer "Kategorie>" path, fallback to first
      const preferred = catArr.find(c => c._text && c._text.includes('Kategorie>')) || catArr[0];
      if (preferred && preferred._text) {
        const parts = preferred._text.split('>');
        category = parts[parts.length - 1].trim();
      }
    }

    if (eanRaw !== null && rawPrice !== null) {
      const ean = String(eanRaw).trim().replace(/[^a-zA-Z0-9-_]/g, '');
      const price = parseFloat(String(rawPrice || '').replace(',', '.'));
      
      let weight_g = 0;
      if (rawWeight !== null) {
        let w = parseFloat(String(rawWeight).replace(',', '.').replace(/[^0-9.]/g, ''));
        if (!isNaN(w) && w > 0) {
          if (w < 100) w = w * 1000; 
          weight_g = Math.round(w);
        }
      }

      if (ean && ean.length >= 4 && !isNaN(price) && price > 0) {
        if (!seen.has(ean)) {
          seen.add(ean);
                    // --- Extended XML fields ---
          const _g = (k) => { const v = tryExtract(node, [k]); return v ? String(v).trim() : null; };
          const _n = (k) => { const v = _g(k); return v ? parseFloat(v.replace(',','.')) || null : null; };
          const _b = (k) => { const v = _g(k); return v && ['1','true','y','tak','yes'].includes(v.toLowerCase()) ? 1 : 0; };
          // Photos from <Images> or <Photo> or deeply nested image containers
          let xmlPhotos = [];
          const imgNode = node.Images || node.images || node.Zdjecia || node.zdjecia;
          if (imgNode) {
            const imgArr = Array.isArray(imgNode.Image || imgNode.image) ? (imgNode.Image || imgNode.image) : [imgNode.Image || imgNode.image].filter(Boolean);
            imgArr.forEach(img => { const u = img && (img.url || img.URL || img.$attrs?.url || img._text); if (u) xmlPhotos.push(String(u)); });
          }
          const singlePhoto = _g('Photo') || _g('photo');
          if (singlePhoto && !xmlPhotos.length) xmlPhotos.push(singlePhoto);
          
          // Deep search for images in nested objects (e.g. Akyga: akyga.images.image[])
          if (!xmlPhotos.length) {
            function findImages(obj, depth) {
              if (depth > 6 || !obj || typeof obj !== 'object') return;
              if (Array.isArray(obj)) { obj.forEach(item => findImages(item, depth)); return; }
              const imgContainer = obj.images || obj.Images || obj.zdjecia || obj.Zdjecia;
              if (imgContainer && typeof imgContainer === 'object') {
                const imgs = imgContainer.image || imgContainer.Image || imgContainer.img || imgContainer.Img;
                if (imgs) {
                  const imgList = Array.isArray(imgs) ? imgs : [imgs];
                  imgList.forEach(img => {
                    const url = (typeof img === 'string') ? img : (img?._text || img?.url || img?.URL || img?.$attrs?.url);
                    if (url && String(url).startsWith('http')) xmlPhotos.push(String(url));
                  });
                }
              }
              for (const [k, v] of Object.entries(obj)) {
                if (k === '$attrs' || k === '_text') continue;
                if (typeof v === 'object') findImages(v, depth + 1);
              }
            }
            findImages(node, 0);
          }
          
          // Extract description from nested translations (e.g. Akyga: akyga.translations.translation.description)
          let deepDescription = null;
          if (!_g('DescPL') && !_g('description') && !_g('opis')) {
            function findDescription(obj, depth) {
              if (depth > 6 || !obj || typeof obj !== 'object' || deepDescription) return;
              if (Array.isArray(obj)) { obj.forEach(item => findDescription(item, depth)); return; }
              // Look for Polish translation first
              if (obj.code === 'pl' && obj.description) {
                const desc = typeof obj.description === 'object' ? (obj.description._text || obj.description._cdata) : obj.description;
                if (desc && String(desc).trim().length > 10) { deepDescription = String(desc).trim(); return; }
              }
              if (obj.description && typeof obj.description === 'string' && obj.description.length > 10 && !deepDescription) {
                deepDescription = obj.description;
              }
              for (const [k, v] of Object.entries(obj)) {
                if (k === '$attrs' || k === '_text') continue;
                if (typeof v === 'object') findDescription(v, depth + 1);
              }
            }
            findDescription(node, 0);
          }

          const xmlStockQty = resolveQuantity(rawQty !== null ? rawQty : availability);
          let xmlAvailability = resolveAvailability(availability !== null ? availability : rawQty);
          if (xmlStockQty !== null) {
            if (xmlStockQty > 0) xmlAvailability = 'available';
            else if (xmlStockQty === 0 && (xmlAvailability === 'unknown' || xmlAvailability === 'available')) {
              xmlAvailability = 'unavailable';
            }
          }

          products.push({
            ean,
            name: (name && typeof name === 'string') ? name.trim() : (name ? String(name) : ''),
            manufacturer: (manufacturer && typeof manufacturer === 'string') ? manufacturer.trim() : (manufacturer ? String(manufacturer) : ''),
            manufacturer_code: (manufacturerCode && typeof manufacturerCode === 'string') ? manufacturerCode.trim() : (manufacturerCode ? String(manufacturerCode) : ''),
            price,
            price_pln: price,
            price_gross: _n('priceGross') || _n('grossPrice') || _n('PriceGross') || _n('cenaBrutto') || _n('CenaBrutto'),
            price_srp: _n('srp') || _n('priceRetail') || _n('PriceSugPLN') || _n('nrpPrice'),
            price_eur: _n('PriceExpEUR') || _n('priceExpEur'),
            price_regular: _n('Price_B2B_Regular') || _n('priceRegular'),
            discount_percent: _n('Price_B2B_DiscountPercent') || _n('discountPercent'),
            vat: _n('vat') || _n('Vat') || _n('VAT'),
            availability: xmlAvailability,
            stock_quantity: xmlStockQty,
            stock_reserved: _n('Q_R') || _n('stock_reserved') || _n('stockReserved'),
            incoming_stock: _n('incomingStock') || _n('delivery') || _n('StockNextDeliveryAccessVolume'),
            condition: resolveCondition(condition),
            warranty: (warranty && typeof warranty === 'string') ? warranty.trim() : null,
            weight_g,
            weight_net_g: (() => { const v = _n('WeightN') || _n('NetWeight') || _n('weight_net'); if (!v) return 0; return v < 100 ? Math.round(v * 1000) : Math.round(v); })(),
            unit_measure: _g('TwrUnit') || _g('unitMeasure') || _g('unit'),
            category: (category && typeof category === 'string') ? category.trim() : (category ? String(category) : ''),
            package_size: _n('InBox') || _n('packageSize') || _n('package_size'),
            delivery_date: _g('ETA') || _g('deliveryDate') || _g('delivery_date'),
            shipping_time_hours: _n('shippingTimeInHour') || _n('shipping_time'),
            is_special_offer: _b('specialOffer') || _b('Promotion') || _b('is_special'),
            is_eol: _b('EOL') || _b('eol'),
            is_non_returnable: _b('NonReturnable') || _b('non_returnable'),
            is_large_product: _b('productIsLarge') || _b('is_large'),
            pcn_code: _g('PCN') || _g('pcn') || _g('pcn_code'),
            volume: _n('Vol') || _n('Volume') || _n('volume'),
            product_url: _g('ProductLink') || _g('product_url') || _g('productUrl'),
            product_type: _g('ProductDisplayType') || _g('product_type'),
            availability_info: _g('additionalAvailabilityInfo') || _g('availabilityInfo'),
            related_products: _g('RelatedProducts') || _g('related_products'),
            date_added: _g('date') || _g('dateAdded') || _g('date_added'),
            description: _g('DescPL') || _g('DescEN') || _g('description') || _g('opis') || deepDescription,
            photos: xmlPhotos,
            supplier_product_id: _g('TwrGid') || _g('sku') || node.$attrs?.id || null,
            attributes: extractAttributesFromNode(node),
          });
          return;
        }
      }
    }

    for (const [k, val] of Object.entries(node)) {
      if (k === '$attrs') continue;
      if (typeof val === 'object') walkAndCollect(val, depth + 1);
    }
  }

  walkAndCollect(parsed);

  if (!products.length) {
    seen.clear();
    function walkRelaxed(node, depth = 0) {
      if (depth > 8 || !node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(n => walkRelaxed(n, depth)); return; }
      const eanRaw = tryExtractEan(node);
      const rawPrice = tryExtract(node, PRICE_KEYS);
      const name = tryExtract(node, NAME_KEYS);
      const manufacturer = tryExtract(node, MFG_KEYS);
      const manufacturerCode = tryExtract(node, MFG_CODE_KEYS);
      const availability = tryExtract(node, AVAIL_KEYS);
      const rawQty = tryExtract(node, QTY_KEYS);
      const condition = tryExtract(node, CONDITION_KEYS);
      const warranty = tryExtract(node, WARRANTY_KEYS);
      if (eanRaw !== null && rawPrice !== null) {
        const ean = String(eanRaw).trim().replace(/[^0-9]/g, '');
        const price = parseFloat(String(rawPrice).replace(',', '.'));
        if (ean && ean.length >= 8 && !isNaN(price) && price > 0 && !seen.has(ean)) {
          seen.add(ean);
          const xmlStockQty = resolveQuantity(rawQty !== null ? rawQty : availability);
          let xmlAvailability = resolveAvailability(availability !== null ? availability : rawQty);
          if (xmlStockQty !== null) {
            if (xmlStockQty > 0) xmlAvailability = 'available';
            else if (xmlStockQty === 0 && (xmlAvailability === 'unknown' || xmlAvailability === 'available')) {
              xmlAvailability = 'unavailable';
            }
          }
          products.push({ ean, name: (name && typeof name === 'string') ? name.trim() : (name ? String(name) : ''), manufacturer: (manufacturer && typeof manufacturer === 'string') ? manufacturer.trim() : (manufacturer ? String(manufacturer) : ''), manufacturer_code: (manufacturerCode && typeof manufacturerCode === 'string') ? manufacturerCode.trim() : '', price, availability: xmlAvailability, stock_quantity: xmlStockQty, condition: resolveCondition(condition), warranty: (warranty && typeof warranty === 'string') ? warranty.trim() : null, attributes: extractAttributesFromNode(node) });
          return;
        }
      }
      for (const [k, val] of Object.entries(node)) {
        if (k === '$attrs') continue;
        if (typeof val === 'object') walkRelaxed(val, depth + 1);
      }
    }
    walkRelaxed(parsed);
  }

  return products;
}

function resolveAvailability(raw) {
  if (raw === null || raw === undefined) return 'unknown';
  const s = String(raw).toLowerCase().trim();
  // Available: Polish/English + German (Kosatec: A=available, V=pre-order, B=on-order)
  const availTerms = ['1','true','yes','tak','available','dostepny','y','w magazynie',
    'a','v','b','verfuegbar','lieferbar','auf lager','in stock','vorbestellt','bestellt'];
  if (availTerms.includes(s)) return 'available';
  // Unavailable: Polish/English + German (Kosatec 'N', 'ausverkauft')
  const unavailTerms = ['0','false','no','nie','unavailable','niedostepny',
    'n','nicht verfuegbar','nicht lieferbar','out of stock','ausverkauft'];
  if (unavailTerms.includes(s)) return 'unavailable';

  // Check if string contains any specific availability keywords
  if (s.includes('dostępny') || s.includes('dostepny') || s.includes('w magazynie') || s.includes('jest') || s.includes('tak') || s.includes('in stock') || s.includes('auf lager') || s.includes('verfügbar')) {
    return 'available';
  }
  if (s.includes('brak') || s.includes('niedostępny') || s.includes('niedostepny') || s.includes('out of stock') || s.includes('ausverkauft') || s.includes('nie')) {
    return 'unavailable';
  }

  // Try to parse quantity using resolveQuantity helper
  const parsedQty = resolveQuantity(raw);
  if (parsedQty !== null) {
    return parsedQty > 0 ? 'available' : 'unavailable';
  }

  const qty = parseFloat(s);
  if (!isNaN(qty)) return qty > 0 ? 'available' : 'unavailable';
  return 'unknown';
}
function resolveCondition(raw) {
  if (raw === null || raw === undefined) return 'new';
  const s = String(raw).toLowerCase().trim();
  if (['used','uzywany','używany','uzywan','refurbished','odnowiony','poleasingowy','b/u','second hand','gebraucht'].includes(s)) return 'used';
  if (['bazar','uszkodzony','niepelnowartosciowy','damaged','outlet'].includes(s)) return 'bazar';
  if (['new','nowy','nowe','neu','nuevo','neuf'].includes(s)) return 'new';
  return 'new';
}

function resolveQuantity(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw).toLowerCase().trim();
  // Action: "ponad 30" = wiecej niz 30
  if (s === 'ponad 30' || s.startsWith('ponad ')) {
    const m = s.match(/\d+/);
    return m ? parseInt(m[0]) + 1 : 31; // return 31 as minimum
  }
  const match = s.match(/\d+/);
  if (match) {
    const qty = parseInt(match[0], 10);
    return isNaN(qty) ? null : qty;
  }
  return null;
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ SUPPLIER EXCEL / CSV PARSER Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function parseSupplierExcel(buffer, colSettings = {}) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  return _parseTabular(headers, rows.slice(1), colSettings);
}

function parseSupplierCsv(buffer, colSettings = {}) {
  // ── Encoding detection ──────────────────────────────────────────────────
  let str;
  // Check for BOM markers first
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    // UTF-16 LE BOM
    str = buffer.slice(2).toString('utf16le');
  } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    // UTF-16 BE BOM
    str = buffer.swap16().slice(2).toString('utf16le');
  } else if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    // UTF-8 BOM
    str = buffer.slice(3).toString('utf-8');
  } else {
    // Try UTF-8 first; if it has replacement chars, fall back to Windows-1250 via iconv
    const utf8Attempt = buffer.toString('utf-8');
    const replacementRatio = (utf8Attempt.match(/\uFFFD/g) || []).length / Math.max(utf8Attempt.length, 1);
    if (replacementRatio > 0.005) {
      // Likely Windows-1250 (Polish) or Latin-2
      str = iconv.decode(buffer, 'win1250');
    } else {
      str = utf8Attempt;
    }
  }

  const lines = str.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const firstLine = lines[0];

  // ── Separator detection: TAB > pipe > semicolon > comma ─────────────────
  const tabCount   = (firstLine.match(/\t/g) || []).length;
  const pipeCount  = (firstLine.match(/\|/g) || []).length;
  const semiCount  = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  let sep;
  if (tabCount >= 2 && tabCount >= semiCount && tabCount >= commaCount) {
    sep = '\t';
  } else if (pipeCount >= 2 && pipeCount >= semiCount && pipeCount >= commaCount) {
    sep = '|';
  } else if (semiCount >= commaCount) {
    sep = ';';
  } else {
    sep = ',';
  }

  const parseLine = (line) => {
    if (sep === '\t') {
      // TAB-separated: no quoting complexity needed usually
      return line.split('\t').map(c => c.trim());
    }
    const cols = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (c === sep && !inQ) { cols.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    cols.push(cur.trim()); return cols;
  };

  const firstCols = parseLine(lines[0]).map(c => c.replace(/^"|"$/g, '').trim());
  const looksLikeHeader = firstCols.some(c => /ean|gtin|barcode|price|cena|name|nazwa|sku|manufacturer|producent|stock|ilo[sś]c|quantity/i.test(c));
  const looksLikeEan = firstCols.some(c => /^\d{12,14}$/.test(String(c).replace(/\s/g, '')));
  const looksLikePrice = firstCols.some(c => /^\d+([.,]\d+)?$/.test(String(c).trim()));
  const headerless = !looksLikeHeader && looksLikeEan && looksLikePrice;

  if (headerless) {
    const headers = firstCols.map((_, i) => `col_${i}`);
    const dataRows = lines.map(l => parseLine(l));
    return _parseTabular(headers, dataRows, colSettings);
  }

  const headers = firstCols.map(h => h.toLowerCase().trim());
  const dataRows = lines.slice(1).map(l => parseLine(l));
  return _parseTabular(headers, dataRows, colSettings);
}


function _parseTabular(headers, dataRows, colSettings = {}) {
  const EAN_PATS      = ['ean', 'ean_code', 'ean code', 'barcode', 'bar code', 'bar_code', 'kod ean', 'kod kreskowy', 'ean_kod', 'gtin', 'isbn',
                          'article no', 'article_no', 'article no.', 'article number', 'item no.', 'item no', 'item_no', 'item number',
                          'twrean', 'twrcode', 'sku', 'part number', 'part_no', 'part_number', 'kod producenta', 'vendor code', 'vendor_code', 'product id', 'productid'];
  const PRICE_PATS    = ['netto', 'cena netto', 'cena', 'price netto', 'price', 'net price', 'netto price', 'price net', 'cena hurtowa',
                          'wholesale', 'cena_netto', 'price1', 'cena1', 'hek', 'cena_zak', 'pricepln', 'priceexpeur', 'price eur', 'cena eur', 'cena_eur',
                          'your price', 'dealer price', 'distributor price', 'reseller price', 'recommended', 'price (eur)', 'price(eur)', 'eur price'];
  const NAME_PATS = ['product name', 'product description', 'product_name', 'product_description', 'item description', 'item_description',
                          'description', 'desc', 'nazwa', 'name', 'produkt', 'product', 'opis', 'namepl', 'nameen', 'short description', 'short_description', 'artname'];
  const AVAIL_PATS = ['stock qty', 'stock_qty', 'stock quantity', 'qty', 'quantity', 'available', 'availability', 'in stock',
                          'dostepnosc', 'dostepność', 'stan', 'stock', 'ilosc', 'ilość', 'q_a', 'inbox', 'stock_quantity', 'qty available', 'verfuegbar'];
  const STOCK_QTY_PATS = ['menge', 'qty available', 'stock qty', 'stock_qty', 'in stock qty', 'available qty', 'ilosc dostepna', 'ilosc', 'ilość', 'stan', 'stock', 'quantity', 'qty', 'stan_magazynowy', 'ilosc_dostepna', 'ilosc w magazynie', 'stan magazynowy'];
  const MFG_PATS = ['manufacturer', 'brand', 'vendor', 'producent', 'marka', 'make', 'supplier brand', 'hersteller'];
  const CUR_PATS      = ['currency', 'waluta', 'cur', 'curr'];
  const COND_PATS     = ['condition', 'stan_produktu', 'state', 'nowy_uzywany', 'kondycja', 'zustand'];
  const WARR_PATS     = ['warranty', 'gwarancja', 'guarantee', 'warranty_months', 'gwarancja_miesiace', 'okres_gwarancji', 'garantie'];
  const WEIGHT_PATS   = ['weight kg', 'weight_kg', 'weight (kg)', 'gross weight', 'gross_weight', 'net weight', 'net_weight',
                          'waga_brutto', 'waga_z_opakowaniem', 'masa_brutto', 'weight_gross', 'weight_brutto',
                          'waga', 'waga_netto', 'masa', 'masa_netto', 'weight', 'weight_net', 'gewicht'];
  const CAT_PATS = [
    ...(colSettings.cat_field != null && colSettings.cat_field !== '' && !/^(#)?\d+$/.test(String(colSettings.cat_field).trim())
      ? [String(colSettings.cat_field).toLowerCase()] : []),
    'product group', 'product_group', 'product category', 'product_category', 'category', 'categories',
                          'kategoria', 'group', 'grupa', 'typ', 'type', 'klasa', 'class', 'rodzaj', 'dzial',
                          'podkategoria', 'subcategory', 'grupa_towarowa', 'nazwa_grupy', 'nazwa_kategorii', 'nazwa kategorii', 'komodita', 'kat1', 'kat2', 'kat3', 'kat4', 'kat5', 'kat6', 'catalogname', 'catalog name'];
  const CAT2_PATS = ['kat2', 'subcategory', 'podkategoria'];
  const CAT3_PATS = ['kat3'];
  const CAT4_PATS = ['kat4'];
  const CAT5_PATS = ['kat5'];
  const CAT6_PATS = ['kat6'];
  const SRP_PATS = ['srp', 'rsp', 'sugerowana', 'nrp', 'nrpprice', 'msrp', 'rrp', 'cena sugerowana', 'cena_sugerowana', 'pricesuggested', 'pricesugpln', 'price_b2c_inclvat', 'vkbrutto'];
  const PRICE_GROSS_PATS = ['cena brutto', 'cena_brutto', 'grossPrice', 'gross_price', 'price_gross', 'pricegross', 'brutto'];
  const PRICE_EUR_PATS = ['priceexpeur', 'price_eur', 'price eur', 'cena eur', 'price_b2b_discounted', 'price_b2b_regular'];
  const PRICE_REG_PATS = ['price_b2b_regular', 'regular_price', 'price regular'];
  const DISC_PCT_PATS  = ['discount', 'rabat', 'price_b2b_discountpercent', 'discount_percent'];
  const VAT_PATS       = ['vat', 'tax', 'podatek', 'stawka vat', 'vat rate', 'price_b2c_vatrate'];
  const INCOMING_PATS  = ['incoming', 'incomingstock', 'delivery qty', 'delivery_qty', 'stocknextdeliveryaccessvolume', 'w dostawie'];
  const DELIVERY_DATE_PATS = ['eta', 'deliverydate', 'delivery date', 'data dostawy', 'stocknextdelivery'];
  const SHIP_TIME_PATS = ['shipping time', 'shippingtime', 'shipping_time', 'czas dostawy'];
  const SPECIAL_PATS   = ['special offer', 'specialoffer', 'promotion', 'promocja', 'is_promo'];
  const EOL_PATS       = ['eol', 'end of life', 'wycofany'];
  const NON_RET_PATS   = ['non returnable', 'nonreturnable', 'bez zwrotu'];
  const LARGE_PATS     = ['large product', 'largeprod', 'wielkogabarytowy', 'productislarge'];
  const WEIGHT_NET_PATS = ['net weight', 'netweight', 'weight net', 'waga netto', 'masa netto', 'gewicht'];
  const STOCK_RES_PATS = ['reserved', 'zarezerwowane', 'q_r', 'stock_reserved'];
  const UNIT_PATS      = ['unit', 'jednostka', 'unit measure', 'twrunit'];
  const PCN_PATS       = ['pcn', 'pcn code', 'pcn_code'];
  const VOL_PATS       = ['volume', 'objetosc', 'vol'];
  const URL_PATS       = ['product url', 'productlink', 'product_url', 'link', 'hersturl'];
  const PROD_TYPE_PATS = ['product type', 'producttype', 'typ produktu', 'productdisplaytype'];
  const AVAIL_INFO_PATS= ['availability info', 'availabilityinfo', 'dodatkowa dostepnosc'];
  const RELATED_PATS   = ['related products', 'relatedproducts', 'powiazane'];
  const DATE_ADD_PATS = ['date added', 'dateadded', 'data dodania', 'indate'];
  const DESC_PATS      = ['description pl', 'descpl', 'opis pl', 'product description'];
  const PHOTOS_PATS    = ['photo', 'image', 'zdjecie', 'imageprimary', 'photos'];
  const SUP_ID_PATS = ['product id', 'productid', 'twrgid', 'supplier id', 'artnr'];
  const MFG_CODE_PATS = ['manufacturer part no', 'manufacturer part no.', 'manufacturer_part_no', 'mfr part no', 'mfr_part_no',
                          'mpn', 'part number', 'part_number', 'model number', 'model_number', 'model no', 'model',
                          'kod producenta', 'kod_producenta', 'manufacturer_code', 'manufacturer code',
                          'symbol', 'indeks', 'nr katalogowy', 'numer_katalogowy', 'catalog_number',
                          'item_code', 'item code', 'vendor_code', 'vendor code', 'product_code', 'product code',
                          'reference', 'ref', 'partno', 'part no', 'part_no', 'sku', 'herstnr'];
  // Known currency codes to detect in column header names
  const CURRENCY_CODES = ['EUR', 'USD', 'CZK', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'HUF', 'RON', 'HRK'];


  const findCol = (pats, override) => {
    if (override !== undefined && override !== null && override !== '') {
      const raw = String(override).trim();
      if (/^(#)?\d+$/.test(raw)) {
        const i = parseInt(raw.replace('#', ''), 10);
        if (i >= 0 && i < headers.length) return i;
      }
      const i = headers.indexOf(raw.toLowerCase());
      if (i >= 0) return i;
    }
    for (const pat of pats) {
      const i = headers.findIndex(h => h === pat || h.includes(pat));
      if (i >= 0) return i;
    }
    return -1;
  };

  let eanIdx   = findCol(EAN_PATS,   colSettings.ean_field);
  let priceIdx = findCol(PRICE_PATS, colSettings.price_field);
  if ((eanIdx < 0 || priceIdx < 0) && dataRows[0]) {
    const row0 = dataRows[0];
    if (eanIdx < 0) {
      eanIdx = row0.findIndex(c => /^\d{12,14}$/.test(String(c).replace(/\s/g, '')));
    }
    if (priceIdx < 0) {
      priceIdx = row0.findIndex((c, i) => i !== eanIdx && /^\d+[.,]\d{1,4}$/.test(String(c).trim()));
    }
  }
  if (eanIdx < 0 || priceIdx < 0) return [];

  const nameIdx  = findCol(NAME_PATS,  colSettings.name_field);
  const availIdx = findCol(AVAIL_PATS, colSettings.avail_field);
  const mfgIdx   = findCol(MFG_PATS,   colSettings.mfg_field);
  const curIdx   = findCol(CUR_PATS,   colSettings.cur_field);
  const condIdx  = findCol(COND_PATS,  colSettings.cond_field);
  const warrIdx  = findCol(WARR_PATS,  colSettings.warr_field);
  const weightIdx= findCol(WEIGHT_PATS,colSettings.weight_field);
  const catIdx   = findCol(CAT_PATS,   colSettings.cat_field);
  const mfgCodeIdx  = findCol(MFG_CODE_PATS,  colSettings.mfg_code_field || colSettings.manufacturer_code);
  const srpIdx      = findCol(SRP_PATS,       colSettings.srp_field);
  const priceGrossIdx = findCol(PRICE_GROSS_PATS, colSettings.price_gross_field);
  const priceEurIdx = findCol(PRICE_EUR_PATS,  colSettings.price_eur_field);
  const priceRegIdx = findCol(PRICE_REG_PATS,  colSettings.price_reg_field);
  const discPctIdx  = findCol(DISC_PCT_PATS,   colSettings.discount_field);
  const vatIdx      = findCol(VAT_PATS,        colSettings.vat_field);
  const incomingIdx = findCol(INCOMING_PATS,   colSettings.incoming_field);
  const delivDateIdx= findCol(DELIVERY_DATE_PATS, colSettings.deliv_date_field);
  const shipTimeIdx = findCol(SHIP_TIME_PATS,  colSettings.ship_time_field);
  const specialIdx  = findCol(SPECIAL_PATS,    colSettings.special_field);
  const eolIdx      = findCol(EOL_PATS,        colSettings.eol_field);
  const nonRetIdx   = findCol(NON_RET_PATS,    colSettings.non_ret_field);
  const largeIdx    = findCol(LARGE_PATS,      colSettings.large_field);
  const weightNetIdx= findCol(WEIGHT_NET_PATS, colSettings.weight_net_field);
  const stockResIdx = findCol(STOCK_RES_PATS,  colSettings.stock_res_field);
  const unitIdx     = findCol(UNIT_PATS,       colSettings.unit_field);
  const pcnIdx      = findCol(PCN_PATS,        colSettings.pcn_field);
  const volIdx      = findCol(VOL_PATS,        colSettings.vol_field);
  const urlIdx      = findCol(URL_PATS,        colSettings.url_field);
  const prodTypeIdx = findCol(PROD_TYPE_PATS,  colSettings.prod_type_field);
  const availInfoIdx= findCol(AVAIL_INFO_PATS, colSettings.avail_info_field);
  const relatedIdx  = findCol(RELATED_PATS,    colSettings.related_field);
  const dateAddIdx  = findCol(DATE_ADD_PATS,   colSettings.date_add_field);
  const descIdx     = findCol(DESC_PATS,       colSettings.desc_field);
  const photosIdx   = findCol(PHOTOS_PATS,     colSettings.photos_field);
  const supIdIdx    = findCol(SUP_ID_PATS,     colSettings.sup_id_field);
  const stockQtyIdx = findCol(STOCK_QTY_PATS,  colSettings.stock_qty_field);
  const cat2Idx     = findCol(CAT2_PATS,       null);
  const cat3Idx     = findCol(CAT3_PATS,       null);
  const cat4Idx     = findCol(CAT4_PATS,       null);
  const cat5Idx     = findCol(CAT5_PATS,       null);
  const cat6Idx     = findCol(CAT6_PATS,       null);

  // Track which column indices are mapped to specific fields
  const mappedIndices = new Set([
    eanIdx, priceIdx, nameIdx, availIdx, mfgIdx, curIdx, condIdx, warrIdx,
    weightIdx, catIdx, mfgCodeIdx, srpIdx, priceGrossIdx, priceEurIdx, priceRegIdx,
    discPctIdx, vatIdx, incomingIdx, delivDateIdx, shipTimeIdx, specialIdx, eolIdx,
    nonRetIdx, largeIdx, weightNetIdx, stockResIdx, unitIdx, pcnIdx, volIdx, urlIdx,
    prodTypeIdx, availInfoIdx, relatedIdx, dateAddIdx, descIdx, photosIdx, supIdIdx,
    stockQtyIdx, cat2Idx, cat3Idx, cat4Idx, cat5Idx, cat6Idx,
  ].filter(i => i >= 0));

  // Detect currency from price column header (e.g. "price_EUR", "priceExpEur", "cena_CZK")
  let headerCurrency = null;
  const priceHeader = priceIdx >= 0 ? headers[priceIdx].toUpperCase() : '';
  for (const code of CURRENCY_CODES) {
    if (priceHeader.includes(code)) { headerCurrency = code; break; }
  }
  // Override with colSettings if set
  if (colSettings.currency && colSettings.currency !== 'PLN') headerCurrency = colSettings.currency;

  const products = [];
  for (const row of dataRows) {
    const ean = String(row[eanIdx] ?? '').trim().replace(/[^a-zA-Z0-9-_]/g, '');
    const price = parseFloat(String(row[priceIdx] ?? '').replace(',', '.'));
    if (!ean || isNaN(price) || price <= 0) continue;

    // Per-row currency (from dedicated column) or detected from header
    const rowCurrency = curIdx >= 0 ? (String(row[curIdx] ?? '').trim().toUpperCase() || headerCurrency) : headerCurrency;
    
    let weight_g = 0;
    if (weightIdx >= 0) {
      let w = parseFloat(String(row[weightIdx] ?? '').replace(',', '.').replace(/[^0-9.]/g, ''));
      if (!isNaN(w) && w > 0) {
        if (w < 100) w = w * 1000;
        weight_g = Math.round(w);
      }
    }

        const _s = (i) => i >= 0 ? String(row[i] ?? '').trim() : null;
    const _f = (i) => { const v = _s(i); return v ? parseFloat(v.replace(',','.')) || null : null; };
    const _flag = (i) => { const v = _s(i); return v && ['1','true','y','tak','yes'].includes(v.toLowerCase()) ? 1 : 0; };
    let wnetG = 0;
    if (weightNetIdx >= 0) {
      let w = parseFloat((_s(weightNetIdx) || '').replace(',','.').replace(/[^0-9.]/g,''));
      if (!isNaN(w) && w > 0) wnetG = w < 100 ? Math.round(w*1000) : Math.round(w);
    }
    const csvPhotos = photosIdx >= 0 && _s(photosIdx) ? [_s(photosIdx)] : [];

    // Build full category path from kat1..kat6 columns
    let catPath = _s(catIdx) || '';
    if (cat2Idx >= 0 && _s(cat2Idx)) catPath = catPath ? catPath + ' > ' + _s(cat2Idx) : _s(cat2Idx);
    if (cat3Idx >= 0 && _s(cat3Idx)) catPath = catPath ? catPath + ' > ' + _s(cat3Idx) : _s(cat3Idx);
    if (cat4Idx >= 0 && _s(cat4Idx)) catPath = catPath ? catPath + ' > ' + _s(cat4Idx) : _s(cat4Idx);
    if (cat5Idx >= 0 && _s(cat5Idx)) catPath = catPath ? catPath + ' > ' + _s(cat5Idx) : _s(cat5Idx);
    if (cat6Idx >= 0 && _s(cat6Idx)) catPath = catPath ? catPath + ' > ' + _s(cat6Idx) : _s(cat6Idx);

    // Collect unmapped columns as attributes (visible in Catalog Master params)
    const rowAttrs = {};
    for (let ci = 0; ci < headers.length; ci++) {
      if (mappedIndices.has(ci)) continue;
      const hdr = headers[ci];
      if (!hdr || hdr.length < 2) continue;
      const val = _s(ci);
      if (!val || val === '0' || val === '-' || val === 'null') continue;
      
      // Process and split piped attributes
      const vStr = String(val).trim();
      if (vStr.includes(' | ')) {
        const parts = vStr.split(' | ').filter(x => x.trim());
        parts.forEach(p => {
          let cleanP = p.trim();
          if (cleanP.includes(':')) {
             const idx = cleanP.indexOf(':');
             const subK = cleanP.substring(0, idx).trim();
             const subV = cleanP.substring(idx + 1).trim();
             if (subK && subV) { rowAttrs[subK] = subV; return; }
          } else if (cleanP.includes(' - ')) {
             const idx = cleanP.indexOf(' - ');
             const subK = cleanP.substring(0, idx).trim();
             const subV = cleanP.substring(idx + 3).trim();
             if (subK && subV) { rowAttrs[subK] = subV; return; }
          }
          rowAttrs[cleanP] = 'Tak';
        });
      } else {
        rowAttrs[hdr] = val;
      }
    }

    // Stock quantity: prefer menge/STOCK_QTY_PATS column, else parse from availability text
    let stockQty = null;
    if (stockQtyIdx >= 0) {
      const sqv = parseFloat(String(row[stockQtyIdx] ?? '').replace(',', '.'));
      if (!isNaN(sqv)) stockQty = Math.round(sqv);
    } else if (availIdx >= 0) {
      stockQty = resolveQuantity(row[availIdx]);
    }

    let availability = availIdx >= 0 ? resolveAvailability(row[availIdx]) : 'unknown';
    if (stockQty !== null) {
      if (stockQty > 0) availability = 'available';
      else if (stockQty === 0 && (availability === 'unknown' || availability === 'available')) {
        availability = 'unavailable';
      }
    }

    products.push({
      ean,
      name:               _s(nameIdx) || '',
      manufacturer:       _s(mfgIdx) || '',
      manufacturer_code:  _s(mfgCodeIdx) || '',
      price,
      price_pln:          price,
      price_gross:        _f(priceGrossIdx),
      price_srp:          _f(srpIdx),
      price_eur:          _f(priceEurIdx),
      price_regular:      _f(priceRegIdx),
      discount_percent:   _f(discPctIdx),
      vat:                _f(vatIdx),
      currency:           rowCurrency || null,
      availability:       availability,
      stock_quantity:     stockQty,
      stock_reserved:     _f(stockResIdx),
      incoming_stock:     _f(incomingIdx),
      condition:          condIdx >= 0 ? resolveCondition(row[condIdx]) : 'new',
      warranty:           _s(warrIdx),
      weight_g,
      weight_net_g:       wnetG,
      unit_measure:       _s(unitIdx),
      category:           catPath || '',
      delivery_date:      _s(delivDateIdx),
      shipping_time_hours:_f(shipTimeIdx),
      is_special_offer:   _flag(specialIdx),
      is_eol:             _flag(eolIdx),
      is_non_returnable:  _flag(nonRetIdx),
      is_large_product:   _flag(largeIdx),
      pcn_code:           _s(pcnIdx),
      volume:             _f(volIdx),
      product_url:        _s(urlIdx),
      product_type:       _s(prodTypeIdx),
      availability_info:  _s(availInfoIdx),
      related_products:   _s(relatedIdx),
      date_added:         _s(dateAddIdx),
      description:        _s(descIdx),
      photos:             csvPhotos,
      supplier_product_id:_s(supIdIdx),
      attributes:         Object.keys(rowAttrs).length > 0 ? rowAttrs : null,
    });
  }
  return products;
}


// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ CURRENCY CONVERSION Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

let _ratesCache = {};
let _ratesFetched = 0;

async function getExchangeRates() {
  const now = Date.now();
  if (_ratesFetched && now - _ratesFetched < 3600000) return _ratesCache;
  try {
    const resp = await axios.get('https://api.nbp.pl/api/exchangerates/tables/A/?format=json', { timeout: 5000 });
    const rates = {};
    for (const r of resp.data[0].rates) {
      rates[r.code] = r.mid;
    }
    rates['PLN'] = 1;
    _ratesCache = rates;
    _ratesFetched = now;
    return rates;
  } catch {
    return { PLN: 1, EUR: 4.25, USD: 3.85, CZK: 0.17, GBP: 5.05 };
  }
}

async function convertToPln(price, currency, manualRate = null) {
  if (!currency || currency === 'PLN') return price;
  if (manualRate && manualRate > 0) return price * manualRate;
  const rates = await getExchangeRates();
  const rate = rates[currency.toUpperCase()] || 1;
  return price * rate;
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ FETCH FROM URL Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

const _httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function fetchSupplierUrl(url, colSettings = {}, attempt = 1, auth = null) {
  try {
    const axiosOpts = {
      responseType: 'arraybuffer',
      timeout: 90000,
      maxRedirects: 15,
      decompress: true,
      httpsAgent: _httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/xml,text/xml,application/vnd.ms-excel,application/octet-stream,*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
        'Connection': 'keep-alive',
      },
      maxContentLength: 200 * 1024 * 1024,
      maxBodyLength:    200 * 1024 * 1024,
    };
    // HTTP Basic Auth (for Akyga and similar suppliers)
    if (auth && auth.username) {
      axiosOpts.auth = { username: auth.username, password: auth.password || '' };
    }
    const resp = await axios.get(url, axiosOpts);
    const buffer = Buffer.from(resp.data);
    const contentType = (resp.headers['content-type'] || '').toLowerCase();
    const lowerUrl = url.toLowerCase().split('?')[0];

    let type = 'unknown';
    if (contentType.includes('xml') || lowerUrl.endsWith('.xml')) type = 'xml';
    else if (contentType.includes('csv') || lowerUrl.endsWith('.csv') || (contentType.includes('text/plain') && !lowerUrl.endsWith('.xlsx'))) type = 'csv';
    else if (contentType.includes('spreadsheet') || contentType.includes('excel') ||
             lowerUrl.endsWith('.xlsx') || lowerUrl.endsWith('.xls')) type = 'excel';
    else {
      // Detect by content
      const head = buffer.slice(0, 200).toString('utf-8').replace(/^\uFEFF/, '').trimStart();
      if (head.startsWith('<') || head.startsWith('<?xml') || head.toLowerCase().includes('<product') || head.toLowerCase().includes('<oferta')) type = 'xml';
      else if (head.includes(';') || head.includes(',')) type = 'csv';
      else type = 'excel';
    }

    const sizeBytes = buffer.length;
    let products;
    if (type === 'xml')        products = await parseSupplierXml(buffer, colSettings);
    else if (type === 'csv')   products = parseSupplierCsv(buffer, colSettings);
    else                       products = parseSupplierExcel(buffer, colSettings);
    products._sizeBytes = sizeBytes;
    return products;
  } catch(err) {
    if (attempt < 3 && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED')) {
      await new Promise(r => setTimeout(r, 2000 * attempt));
      return fetchSupplierUrl(url, colSettings, attempt + 1, auth);
    }
    throw err;
  }
}
// --- IMPAKT API (etrade.pl) --------------------------------------------------------

const IMPAKT_DEFAULT_URL = 'https://api.etrade.pl';

async function testImpaktApi(apiUrl, user, pass) {
  if (!user || !pass) return { ok: false, message: 'Brak loginu lub hasla' };
  const baseUrl = (apiUrl || IMPAKT_DEFAULT_URL).replace(/\/+$/, '');
  try {
    const resp = await axios.get(`${baseUrl}/v1/products`, {
      params: { perPage: 1, page: 1 },
      auth: { username: user, password: pass },
      timeout: 10000,
      headers: { 'Accept': 'application/json', 'User-Agent': 'ShopGold/1.0' },
    });
    const data = resp.data;
    const pages = data.pages || 0;
    const count = (data.results || []).length;
    return { ok: true, pages, sampleCount: count, status: resp.status };
  } catch(e) {
    const status = e.response?.status;
    const msg = status === 401 ? 'Bledny login lub haslo (HTTP 401)'
              : status === 403 ? 'Brak uprawnien (HTTP 403)'
              : `Blad polaczenia: ${e.message}`;
    return { ok: false, message: msg, status };
  }
}

// ============================================================================
// NTT API Support
// ============================================================================
// Action REST API - Pełna implementacja
// Używa: Product/GetAll, ProductTechnicalSpecification/GetListForAllProduct,
//        ProductMarketingDescription/GetForAllProducts, ProductsEan, ProductPictures
// ============================================================================

async function fetchActionProducts(customerId, userName, apiKey, onProgress = null) {
  const progress = (msg) => { if (onProgress) onProgress({ message: msg }); else console.log(msg); };
  if (!customerId || !userName || !apiKey) return [];

  const headers = {
    'CustomerId': String(customerId).trim(),
    'UserName': String(userName).trim(),
    'ActionApiKey': String(apiKey).trim(),
    'Accept': 'application/json'
  };

  const BASE = 'https://api.action.pl/api/ade/v2';
  progress('[Action API] Rozpoczynam pelna synchronizacje...');

  // 1. Glowna lista produktow
  let mainProducts = [];
  try {
    progress('[Action API] 1/5 - Product/GetAll...');
    const resp = await axios.get(BASE + '/Product/GetAll', {
      headers,
      params: { Language: 'Polish', Currency: 'PLN' },
      timeout: 120000
    });
    if (!resp.data || !resp.data.success) throw new Error(resp.data && resp.data.errorMessage ? resp.data.errorMessage : 'GetAll failed');
    mainProducts = Array.isArray(resp.data.data) ? resp.data.data : [];
    progress('[Action API]   => Pobrano ' + mainProducts.length + ' produktow z GetAll');
  } catch (err) {
    const msg = (err.response && err.response.data && err.response.data.errorMessage) || err.message;
    progress('[Action API] WARN: GetAll niedostepny, fallback:', msg);
    progress('[Action API] 1/5 - Fallback: Product/GetExtraItems...');
    const resp2 = await axios.get(BASE + '/Product/GetExtraItems', { headers, timeout: 90000 });
    if (!resp2.data || !resp2.data.success) {
      const status = err.response && err.response.status;
      throw new Error('Action API blad (HTTP ' + status + '): ' + ((resp2.data && resp2.data.errorMessage) || err.message));
    }
    mainProducts = Array.isArray(resp2.data.data) ? resp2.data.data : [];
    progress('[Action API]   => Fallback: Pobrano ' + mainProducts.length + ' produktow z GetExtraItems');
  }

  if (mainProducts.length === 0) return [];

  // 2. Kody EAN
  const eanMap = new Map();
  try {
    progress('[Action API] 2/5 - ProductsEan...');
    const resp = await axios.get(BASE + '/ProductsEan', { headers, timeout: 60000 });
    if (resp.data && resp.data.success) {
      const eans = Array.isArray(resp.data.data) ? resp.data.data : [];
      for (const e of eans) {
        const pid = String(e.productId || '');
        const ean = String(e.eanCode || e.ean || '').trim();
        if (pid && ean) eanMap.set(pid, ean);
      }
      progress('[Action API]   => Pobrano ' + eans.length + ' kodow EAN');
    }
  } catch (err) {
    progress('[Action API] WARN: ProductsEan pominiety:', err.message);
  }

  // 3. Parametry techniczne
  const techSpecMap = new Map();
  try {
    progress('[Action API] 3/5 - ProductTechnicalSpecification/GetListForAllProduct...');
    const resp = await axios.get(BASE + '/ProductTechnicalSpecification/GetListForAllProduct', {
      headers,
      params: { Language: 'Polish' },
      timeout: 360000  // 6 minut - GetListForAllProduct moze byc wolny
    });
    if (resp.data && resp.data.success) {
      const specs = Array.isArray(resp.data.data) ? resp.data.data : [];
      for (const s of specs) {
        const pid = String(s.productId || '');
        if (pid && Array.isArray(s.parameters)) {
          const attrs = {};
          for (const p of s.parameters) {
            const key = p.sectionName ? (p.sectionName + ' / ' + p.parameterName) : p.parameterName;
            if (key && p.parameterValue != null) attrs[key] = String(p.parameterValue);
          }
          if (Object.keys(attrs).length > 0) techSpecMap.set(pid, attrs);
        }
      }
      progress('[Action API]   => Pobrano specyfikacje dla ' + techSpecMap.size + ' produktow');
    }
  } catch (err) {
    progress('[Action API] WARN: TechnicalSpecification pominieta:', err.message);
  }

  // 4. Opisy marketingowe
  const descMap = new Map();
  try {
    progress('[Action API] 4/5 - ProductMarketingDescription/GetForAllProducts...');
    const resp = await axios.get(BASE + '/ProductMarketingDescription/GetForAllProducts', {
      headers,
      params: { Language: 'Polish' },
      timeout: 240000
    });
    if (resp.data && resp.data.success) {
      const descs = Array.isArray(resp.data.data) ? resp.data.data : [];
      for (const d of descs) {
        const pid = String(d.productId || '');
        if (pid) {
          descMap.set(pid, {
            htmlDescription: d.htmlDescription || '',
            summaryShort: d.summaryDescriptionShort || '',
            summaryFull: d.summaryDescriptionFull || ''
          });
        }
      }
      progress('[Action API]   => Pobrano opisy dla ' + descMap.size + ' produktow');
    }
  } catch (err) {
    progress('[Action API] WARN: MarketingDescription pominieta:', err.message);
  }

  // 5. Zdjecia
  const photoMap = new Map();
  try {
    progress('[Action API] 5/5 - ProductPictures/GetForAllProducts...');
    const resp = await axios.get(BASE + '/ProductPictures/GetForAllProducts', {
      headers,
      timeout: 120000
    });
    if (resp.data && resp.data.success) {
      const pics = Array.isArray(resp.data.data) ? resp.data.data : [];
      for (const pic of pics) {
        const pid = String(pic.productId || '');
        if (pid) {
          const urls = [];
          if (Array.isArray(pic.images)) {
            // Action returns { productId, images: [{ path, isMain }, ...] }
            const BASE_IMG = 'https://images.action.com.pl';
            const mainImg = pic.images.find(i => i.isMain);
            const rest = pic.images.filter(i => !i.isMain);
            if (mainImg) urls.push(BASE_IMG + mainImg.path);
            for (const img of rest) if (img.path) urls.push(BASE_IMG + img.path);
          } else {
            if (pic.mainPicture) urls.push(pic.mainPicture);
            if (Array.isArray(pic.pictures)) urls.push(...pic.pictures);
            if (Array.isArray(pic.urls)) urls.push(...pic.urls);
            if (pic.url) urls.push(pic.url);
          }
          photoMap.set(pid, urls.filter(Boolean));
        }
      }
      progress('[Action API]   => Pobrano zdjecia dla ' + photoMap.size + ' produktow');
    }
  } catch (err) {
    progress('[Action API] WARN: ProductPictures pominiete:', err.message);
  }

  // 6. Zlacz dane
  progress('[Action API] Lacze dane...');
  const results = [];

  for (const item of mainProducts) {
    const pid = String(item.productId || item.id || '').trim();

    // EAN
    const ean = eanMap.get(pid) || String(item.eanCode || item.ean || '').trim();

    // Podstawowe pola
    const name = String(item.productName || item.name || '').trim();
    const price = parseFloat(item.price || item.priceNet || 0) || 0;
    const detalPrice = parseFloat(item.detalPrice || 0) || 0;

    // Stan magazynowy - Action: "ponad 30" = wiecej niz 30
    let stock = 0;
    const qtyRaw = item.quantity;
    if (typeof qtyRaw === 'string' && /ponad/i.test(qtyRaw)) {
      stock = 31;
    } else {
      stock = parseInt(qtyRaw != null ? qtyRaw : 0) || 0;
    }
    const incomingStock = parseInt(item.incomingStock || 0) || 0;

    const producer = String(item.producerName || item.producer || item.manufacturer || '').trim();
    const producerCode = String(item.producerCode || item.manufacturerCode || item.sku || '').trim();

    // Gwarancja - Action API: { warrantyType: "G"|"F"|"B"|"R"|"E"|"W", warrantyLength: 24 }
    // Kody: B=Brak, E=Europejska, F=Fabryczna, G=Gwarancja, R=Rękojmia, W=Wieczysta
    let warranty = '';
    if (item.warranty) {
      const wType = String(item.warranty.warrantyType || '').trim().toUpperCase();
      const wLen = parseInt(item.warranty.warrantyLength || 0) || 0;
      if (wType === 'W') {
        warranty = 'W000M'; // Gwarancja Wieczysta
      } else if (wType === 'B' || (wType && wLen === 0 && wType !== 'F')) {
        warranty = 'B000M'; // Brak gwarancji
      } else if (wType) {
        warranty = wType + String(wLen).padStart(3, '0') + 'M';
      }
    }

    // Action: weight in g (weightMeasurementUnit tells if mm/g)
    const weight = item.weight || 0;
    const sizeX = item.sizeX || 0;
    const sizeY = item.sizeY || 0;
    const sizeZ = item.sizeZ || 0;

    // Parametry techniczne
    const attrs = techSpecMap.get(pid) || {};

    // Opisy
    const desc = descMap.get(pid) || {};

    // Zdjecia
    const photos = photoMap.get(pid) || [];

    results.push({
      ean,
      name,
      manufacturer: producer,
      manufacturer_code: producerCode,
      price: price,                                              // PLN netto (jak inne hurtownie - bez *100)
      price_pln: price,
      price_regular: detalPrice > 0 ? detalPrice : null,
      currency: String(item.currency || 'PLN'),
      vat: item.vatPercent != null ? item.vatPercent : 23,
      availability: stock > 0 ? 'available' : (incomingStock > 0 ? 'incoming' : 'unavailable'),
      stock_quantity: stock,
      incoming_stock: incomingStock,
      warranty,
      shipping_time_hours: item.shippingTimeInHour || null,
      delivery_date: item.deliveryDate || null,
      is_special_offer: (item.specialOffer || item.sale) ? 1 : 0,
      is_eol: 0,
      is_non_returnable: 0,
      is_large_product: item.isLarge ? 1 : 0,
      is_being_ordered: item.onOrder ? 1 : 0,
      weight_g: weight,
      width_mm: sizeX,
      height_mm: sizeY,
      depth_mm: sizeZ,
      attributes: Object.keys(attrs).length > 0 ? attrs : null,   // surowy obiekt - NIE stringify (upsert sam to robi)
      description: desc.summaryFull || desc.summaryShort || null,
      photos: photos.length > 0 ? JSON.stringify(photos) : '[]',
      supplier_product_id: pid,
    });
  }

  progress('[Action API] Synchronizacja zakonczona. Lacznie: ' + results.length + ' produktow.');
  return results;
}


async function testNTTApi(clientId, clientSecret, userId) {
  try {
    const params = new URLSearchParams({ clientId: clientId || '', clientSecret: clientSecret || '', userId: userId || '' });
    const resp = await axios.post('https://online.ntt.pl/api/v1/login', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000
    });
    if (resp.data && resp.data.result && resp.data.result.token) {
      return { ok: true, message: 'Polaczono poprawnie z API NTT. Token uzyskany.' };
    }
    return { ok: false, message: 'Nieudane logowanie, brak tokena w odpowiedzi.' };
  } catch(e) {
    return { ok: false, message: `Blad API NTT: ${e.message}`, status: e.response?.status };
  }
}

async function fetchNTTProducts(clientId, clientSecret, userId, colSettings = {}) {
  if (!clientId || !clientSecret || !userId) return [];
  const baseUrl = 'https://online.ntt.pl/api/v1';

  // 1. Logowanie
  const params = new URLSearchParams({ clientId, clientSecret, userId });
  const loginResp = await axios.post(`${baseUrl}/login`, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 30000
  });
  
  const token = loginResp.data?.result?.token;
  if (!token) throw new Error('Brak tokena od NTT API (sprawdz dane logowania)');

  // 2. Pobieranie produktow
  const prodResp = await axios.get(`${baseUrl}/products`, {
    headers: { 'Authorization': token },
    timeout: 120000 // 2 minuty na pobranie pelnej bazy
  });

  const items = prodResp.data?.result;
  if (!Array.isArray(items)) {
    throw new Error('API NTT zwrocilo nieprawidlowy format (oczekiwano tablicy result)');
  }

  // Helper: read a field from item using colSettings override or a list of fallback keys
  const _get = (item, overrideKey, fallbackKeys) => {
    // 1. Use colSettings override if set
    if (overrideKey && item[overrideKey] !== undefined) return item[overrideKey];
    // 2. Try fallback keys in order
    for (const k of fallbackKeys) {
      if (item[k] !== undefined && item[k] !== null && item[k] !== '') return item[k];
    }
    return undefined;
  };
  
  const products = [];
  for (const item of items) {
    // EAN — override via colSettings.ean_field, fallback to NTT defaults
    const rawEan = _get(item, colSettings.ean_field, ['ean', 'EAN', 'barcode', 'gtin']);
    const ean = String(rawEan || '').trim();
    if (!ean || ean.length < 4) continue;

    // Price — override via colSettings.price_field
    const rawPrice = _get(item, colSettings.price_field, ['price', 'cena', 'price_netto', 'priceNetto']);
    const price = parseFloat(String(rawPrice || '').replace(',', '.')) || 0;
    if (price <= 0) continue;

    // Stock / availability — override via colSettings.avail_field
    const rawStock = _get(item, colSettings.avail_field || colSettings.stock_qty_field, ['stock', 'stan', 'quantity', 'qty', 'ilosc']);
    let stockVal = parseInt(rawStock) || 0;
    let availability = stockVal > 0 ? 'available' : 'out_of_stock';

    // Name — override via colSettings.name_field
    const rawName = _get(item, colSettings.name_field, ['name', 'nazwa', 'produktNazwa', 'product_name']);

    // Manufacturer — override via colSettings.mfg_field
    const rawMfg = _get(item, colSettings.mfg_field, ['manufacturer_name', 'manufacturer', 'producent', 'brand']);

    // Manufacturer code — override via colSettings.mfg_code_field
    const rawMfgCode = _get(item, colSettings.mfg_code_field, ['code', 'reference', 'kod_produktu', 'sku', 'mpn']);

    // Category — override via colSettings.cat_field
    const rawCat = _get(item, colSettings.cat_field, ['category_name', 'category', 'kategoria']);

    // Build clean attributes — strip system/price/stock fields that already have dedicated columns
    const NTT_SYSTEM_FIELDS = new Set(['id','name','reference','code','virtual','ean','EAN','category_name',
      'category_id','tax_rate','on_request','sellout','new_product','manufacturer_name','stock','price',
      'sale_price','currency','qty','quantity','barcode','gtin']);
    const nttAttrs = {};
    for (const [k, v] of Object.entries(item)) {
      if (NTT_SYSTEM_FIELDS.has(k)) continue;
      if (v === null || v === undefined || v === '' || v === 0 || v === false) continue;
      nttAttrs[k] = v;
    }

    products.push({
      ean,
      price,
      stock_quantity: stockVal,
      name: rawName != null ? String(rawName) : undefined,
      manufacturer: rawMfg != null ? String(rawMfg) : undefined,
      category: rawCat != null ? String(rawCat) : undefined,
      manufacturer_code: rawMfgCode != null ? String(rawMfgCode) : undefined,
      availability,
      attributes: Object.keys(nttAttrs).length > 0 ? nttAttrs : null
    });
  }
  
  return products;
}


async function fetchImpaktProducts(apiUrl, user, pass) {
  if (!user || !pass) return [];
  const baseUrl = (apiUrl || IMPAKT_DEFAULT_URL).replace(/\/+$/, '');
  const authOpts = { username: user, password: pass };
  const headers = { 'Accept': 'application/json', 'User-Agent': 'ShopGold/1.0' };
  const products = [];

  // Pobieranie wszystkich produktów z paginacją — /v1/products zwraca pełne dane
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 500) {
    try {
      const resp = await axios.get(`${baseUrl}/v1/products`, {
        params: { page, perPage: 100, inStock: 0, locale: 'pl' },
        auth: authOpts,
        timeout: 60000,
        headers,
      });
      const data = resp.data;
      totalPages = data.pages || 1;
      const items = data.results || [];
      if (!items.length) break;

      for (const item of items) {
        // --- EAN (wymagany) ---
        const ean = String(item.ean || '').trim();
        if (!ean || ean.length < 4) continue;

        // --- Cena netto (wymagana) ---
        const price = parseFloat(item.price) || 0;
        if (price <= 0) continue;

        // --- Stan magazynowy: liczba lub string ">10", ">30" ---
        let stockVal = item.inStock;
        let availability = 'unknown';
        let stock_quantity = null;
        if (typeof stockVal === 'string') {
          const numStr = stockVal.replace(/[^0-9]/g, '');
          stock_quantity = numStr ? parseInt(numStr, 10) : null;
          availability = stock_quantity > 0 ? 'available' : 'unavailable';
        } else if (typeof stockVal === 'number') {
          stock_quantity = stockVal;
          availability = stockVal > 0 ? 'available' : 'unavailable';
        }

        // --- Producent: obiekt { id, name } lub string ---
        const mfg = (item.manufacturer && typeof item.manufacturer === 'object')
          ? (item.manufacturer.name || item.manufacturer.id || '')
          : String(item.manufacturer || '');

        let categoryStr = '';
        if (Array.isArray(item.categories) && item.categories.length > 0) {
          const firstCat = item.categories[0];
          const mainName = String(firstCat.name || firstCat.Name || '').trim();
          const sub = (Array.isArray(firstCat.subcategories) && firstCat.subcategories.length > 0)
            ? firstCat.subcategories[0]
            : null;
          const subName = sub ? String(sub.name || sub.Name || '').trim() : '';
          categoryStr = [mainName, subName].filter(Boolean).join(' > ');
          // Do not fall back to bare Impakt numeric IDs — they pollute the AB tree.
        }

        // --- Atrybuty techniczne: { name: value } ---
        const impaktAttrs = {};
        if (Array.isArray(item.attributes)) {
          for (const attr of item.attributes) {
            if (attr.name && attr.value !== undefined && attr.value !== null) {
              const valStr = attr.unitMeasure
                ? `${attr.value} ${attr.unitMeasure}`.trim()
                : String(attr.value);
              impaktAttrs[attr.name] = valStr.replace(/<[^>]+>/g, ' ').trim();
            }
          }
        }

        // --- Zdjęcia: tablica URL ---
        const photosArr = Array.isArray(item.photos) ? item.photos : [];

        // --- Gwarancja: warranty (miesiące Impakt) + manufacturerAdditionalWarranty ---
        const warrantyMonths = typeof item.warranty === 'number' ? item.warranty : null;
        const mfgWarranty = typeof item.manufacturerAdditionalWarranty === 'number' ? item.manufacturerAdditionalWarranty : 0;
        // Łączny opis gwarancji
        let warrantyStr = null;
        if (warrantyMonths !== null) {
          const total = warrantyMonths + mfgWarranty;
          warrantyStr = total > 0 ? `${total}m` : null;
        }

        products.push({
          // === Pola podstawowe (wszystkie hurtownie) ===
          ean,
          name:                String(item.name || '').trim(),
          manufacturer:        mfg.trim(),
          manufacturer_code:   String(item.manufacturerCode || '').trim(),
          price,                                              // cena netto PLN
          price_pln:           price,                        // waluta Impakt = PLN
          price_gross:         parseFloat(item.grossPrice) || null,   // cena brutto PLN
          price_srp:           parseFloat(item.nrpPrice) || null,     // niezobowiązująca cena detaliczna
          vat:                 typeof item.vat === 'number' ? item.vat : null,
          availability,
          stock_quantity,
          warranty:            warrantyStr,                  // np. "24m"
          warranty_months:     warrantyMonths,               // liczba miesięcy (Impakt)
          is_being_ordered:    item.isBeingOrdered ? 1 : 0,  // zamówiony u producenta
          delivery_date:       item.deliveryDate || null,    // spodziewana data dostawy
          package_size:        typeof item.packageSize === 'number' ? item.packageSize : null,
          category:            categoryStr,
          description:         String(item.description || '').trim() || null,
          photos:              photosArr,                    // tablica URL
          supplier_product_id: String(item.id || '').trim(), // wewnętrzne ID Impakt (np. "Z15147")
          attributes:          Object.keys(impaktAttrs).length > 0 ? impaktAttrs : null,
          condition:           'new',                        // Impakt nie dostarcza pola condition
          weight_g:            0,                            // Impakt API nie podaje wagi
        });
      }
      console.log(`[Impakt] Page ${page}/${totalPages}: ${items.length} items (total so far: ${products.length})`);
      page++;
    } catch(e) {
      console.error(`[Impakt] Error on page ${page}: ${e.message}`);
      if (page === 1) throw new Error(`Impakt API: ${e.response?.status === 401 ? 'Bledny login/haslo' : e.message}`);
      break; // dane częściowe lepsze niż żadne
    }
  }

  if (!products.length) {
    throw new Error('Impakt API: nie pobrano zadnych produktow. Sprawdz dane logowania i uprawnienia konta.');
  }

  console.log(`[Impakt] Total products fetched: ${products.length} (${totalPages} pages)`);
  return products;
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ FETCH FROM FTP Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

async function testElkoApi(apiKey) {
  if (!apiKey) return { ok: false, message: 'Brak klucza API' };
  const cleanKey = apiKey.trim();

  // Test only the most likely endpoint first, try all auth methods in parallel
  const testEndpoints = [
    { url: ELKO_BASE + '/v3.0/api/Catalog/Products', params: { pageSize: 1, page: 1 } },
    { url: ELKO_BASE + '/v3.0/api/Catalog/csv/stockinfo', params: {} },
  ];
  const authMethods = [
    { name: 'Bearer',      headers: { 'Authorization': `Bearer ${cleanKey}` } },
    { name: 'Token',       headers: { 'Authorization': `Token ${cleanKey}` } },
    { name: 'X-API-Key',   headers: { 'X-API-Key': cleanKey } },
    { name: 'query?token', headers: {},  extraParams: { token: cleanKey } },
  ];

  const allAttempts = [];

  for (const ep of testEndpoints) {
    // Run all auth methods for this endpoint in parallel
    const results = await Promise.allSettled(authMethods.map(async (auth) => {
      const r = await axios.get(ep.url, {
        headers: { 'User-Agent': 'ShopGold/1.0', 'Accept': 'application/json, text/csv, */*', ...(auth.headers || {}) },
        params: { ...ep.params, ...(auth.extraParams || {}) },
        timeout: 6000,
        responseType: 'arraybuffer',
        validateStatus: s => s < 500,
      });
      const status = r.status;
      const snippet = Buffer.from(r.data).slice(0, 300).toString('utf-8').replace(/\s+/g, ' ');
      return { url: ep.url, auth: auth.name, status, snippet };
    }));

    for (const res of results) {
      if (res.status === 'fulfilled') {
        allAttempts.push(res.value);
        if (res.value.status === 200) {
          return { ok: true, endpoint: res.value.url, method: res.value.auth, status: 200, snippet: res.value.snippet, attempts: allAttempts };
        }
      } else {
        const authName = authMethods[results.indexOf(res)]?.name || '?';
        allAttempts.push({ url: ep.url, auth: authName, status: 'ERR', snippet: res.reason?.message || 'Timeout' });
      }
    }

    // If any returned 200 we already returned above; check if any got non-404 (might be auth issue, not wrong endpoint)
    const anyNon404 = allAttempts.filter(a => a.url === ep.url && typeof a.status === 'number' && a.status !== 404);
    if (anyNon404.length > 0) break; // Endpoint exists, auth is wrong — no point testing others
  }

  // Build readable summary
  const summary = allAttempts.map(a => a.auth + ': HTTP ' + a.status).join(' | ');
  return { ok: false, message: 'Brak dostępu do Elko API. ' + summary, attempts: allAttempts };
}

async function fetchFtpFile(supplier) {
  const cleanHost = (supplier.ftp_host || '').replace(/^(s?ftps?|sftp):\/\//i, '').replace(/\/+$/, '');
  const port      = parseInt(supplier.ftp_port) || 21;
  const user      = supplier.ftp_user || 'anonymous';
  const pass      = supplier.ftp_pass || '';
  const ftpPath   = (supplier.ftp_path || '/').trim();
  const useSecure = !!supplier.ftp_secure;

  // Try both passive (default) and active mode on failure
  const attempts = [
    { label: 'PASV (passive)', forcePassive: true },
    { label: 'PORT (active)',  forcePassive: false },
  ];

  let lastErr = null;
  for (const attempt of attempts) {
    const client = new ftp.Client(60000); // 60s timeout
    client.ftp.verbose = false;
    try {
      await client.access({
        host:     cleanHost,
        port,
        user,
        password: pass,
        secure:   useSecure,
        secureOptions: { rejectUnauthorized: false },
      });

      // Force passive or active based on attempt
      if (!attempt.forcePassive) {
        client.ftp.socket.setKeepAlive(true, 10000);
      }

      const chunks = [];
      const stream = require('stream');
      const writeable = new stream.Writable({
        write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
      });
      await client.downloadTo(writeable, ftpPath);
      const buf = Buffer.concat(chunks);
      if (buf.length === 0) throw new Error('Pobrano pusty plik (0 bajtów)');
      console.log(`[FTP] OK (${attempt.label}): ${cleanHost}:${port}${ftpPath} → ${buf.length} bajtów`);
      return buf;
    } catch (e) {
      lastErr = e;
      console.warn(`[FTP] Błąd (${attempt.label} ${cleanHost}:${port}): ${e.message}`);
    } finally {
      try { client.close(); } catch(_) {}
    }
  }

  try {
    const viaCurl = await fetchFtpFileCurl({ host: cleanHost, port, user, pass, ftpPath });
    if (viaCurl && viaCurl.length) {
      console.log(`[FTP] OK (curl PASV skip-ip): ${cleanHost}:${port}${ftpPath} → ${viaCurl.length} bajtów`);
      return viaCurl;
    }
  } catch (curlErr) {
    console.warn(`[FTP] curl fallback: ${curlErr.message}`);
    lastErr = lastErr || curlErr;
  }

  // Build a helpful error message
  const hint = lastErr?.message?.includes('ECONNREFUSED') ? `Serwer ${cleanHost}:${port} odmawia połączenia — sprawdź host i port.`
             : lastErr?.message?.includes('ETIMEDOUT')    ? `Timeout — serwer ${cleanHost}:${port} nie odpowiada. Sprawdź firewall lub użyj SFTP (port 22).`
             : lastErr?.message?.includes('530')          ? `Błąd logowania (530) — sprawdź login i hasło.`
             : lastErr?.message?.includes('550')          ? `Plik nie znaleziony (550) — sprawdź ścieżkę: "${ftpPath}".`
             : lastErr?.message || 'Nieznany błąd FTP';
  throw new Error(`FTP: ${hint}`);
}

async function fetchFtpFileCurl({ host, port, user, pass, ftpPath }) {
  const os = require('os');
  const { spawn } = require('child_process');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-ftp-'));
  const netrc = path.join(tmpDir, 'netrc');
  const out = path.join(tmpDir, 'download.bin');
  const remote = ftpPath.startsWith('/') ? ftpPath : `/${ftpPath}`;
  fs.writeFileSync(netrc, `machine ${host} login ${user} password ${pass}\n`, { mode: 0o600 });
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('curl', [
        '-sS', '-n', `--netrc-file=${netrc}`,
        '--ftp-skip-pasv-ip', '--disable-epsv',
        '--connect-timeout', '20', '--max-time', '600',
        '-o', out,
        `ftp://${host}:${port}${remote}`,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      child.stderr.on('data', d => { err += d.toString(); });
      child.on('error', reject);
      child.on('close', code => {
        if (code === 0 && fs.existsSync(out) && fs.statSync(out).size > 0) resolve();
        else reject(new Error((err || `curl exit ${code}`).split('\n')[0]));
      });
    });
    return fs.readFileSync(out);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}



// --- ELKO API ----------------------------------------------------------------

const ELKO_BASE = 'https://api.elko.cloud';

const ELKO_BRANDS = {
  adata:      { name: 'Adata',      code: 'ADA' },
  fellowes:   { name: 'Fellowes',   code: 'FEL' },
  intenso:    { name: 'Intenso',    code: 'INT' },
  kingston:   { name: 'Kingston',   code: 'KIN' },
  mediarange: { name: 'MediaRange', code: 'MRA' },
  samsung:    { name: 'Samsung',    code: 'SAM' },
  sandisk:    { name: 'SanDisk',    code: 'SND' },
  transcend:  { name: 'Transcend',  code: 'TRA' },
  trust:      { name: 'Trust',      code: 'TRU' },
};

async function fetchElkoProducts(apiKey, vendorCodes, colSettings = {}) {
  if (!apiKey) return []; // If no API key is provided, just return empty array (rely on files)
  vendorCodes = vendorCodes || [];
  const cleanKey = apiKey.trim();

  // Try multiple auth approaches â€” Elko may use Bearer, X-API-Key, or query token
  const authVariants = [
    { headers: { 'Authorization': `Bearer ${cleanKey}`, 'Accept': 'application/json, text/csv, */*' } },
    { headers: { 'Authorization': `Token ${cleanKey}`, 'Accept': 'application/json, text/csv, */*' } },
    { headers: { 'X-API-Key': cleanKey, 'Accept': 'application/json, text/csv, */*' } },
    { params: { token: cleanKey } },
    { params: { api_key: cleanKey } },
  ];

  // --- Attempt 1: CSV stockinfo endpoint (bulk, fast, most reliable) ---
  // NOTE: JSON endpoint has more attributes but is very slow (100+ pages, often timeout)
  // CSV is used as primary, JSON as fallback for smaller datasets
  const csvEndpoints = [
    '/v3.0/api/Catalog/csv/stockinfo',
    '/v2.0/api/Catalog/csv/stockinfo',
    '/api/Catalog/csv/stockinfo',
  ];
  for (const endpoint of csvEndpoints) {
    for (const auth of authVariants) {
      try {
        const opts = {
          responseType: 'arraybuffer',
          timeout: 120000,
          headers: { 'User-Agent': 'ShopGold/1.0', ...(auth.headers || {}) },
        };
        if (auth.params) opts.params = auth.params;
        const csvResp = await axios.get(ELKO_BASE + endpoint, opts);
        if (csvResp.status === 200 && csvResp.data && csvResp.data.byteLength > 100) {
          console.log(`[Elko] CSV OK via ${endpoint} with ${JSON.stringify(auth.headers || auth.params)}`);
          const buf = Buffer.from(csvResp.data);
          const products = parseSupplierCsv(buf, colSettings);
          if (products.length > 0) {
            const filtered = vendorCodes.length > 0
              ? products.filter(p => vendorCodes.some(vc => (p.manufacturer || '').toLowerCase().includes(vc.toLowerCase())))
              : products;
            return filtered;
          }
        }
      } catch (e) {
        console.warn(`[Elko] CSV ${endpoint} failed (${JSON.stringify(auth.headers || auth.params)}): ${e.response?.status || e.message}`);
      }
    }
  }

  // --- Attempt 2: JSON Products endpoint (paginated, slower but has attributes) ---
  const jsonEndpoints = [
    '/v3.0/api/Catalog/Products',
    '/v2.0/api/Catalog/Products',
    '/api/Catalog/Products',
  ];
  for (const endpoint of jsonEndpoints) {
    for (const auth of authVariants) {
      try {
        const baseOpts = {
          timeout: 60000,
          headers: { 'User-Agent': 'ShopGold/1.0', 'Accept': 'application/json', ...(auth.headers || {}) },
          params: { pageSize: 100, page: 1, ...(auth.params || {}) },
        };
        if (vendorCodes.length === 1) baseOpts.params.vendorCode = vendorCodes[0];
        const testResp = await axios.get(ELKO_BASE + endpoint, baseOpts);
        if (testResp.status === 200) {
          console.log(`[Elko] JSON OK via ${endpoint}`);
          const results = [];
          let page = 1, hasMore = true;
          while (hasMore && page <= 200) {
            const resp = page === 1 ? testResp : await axios.get(ELKO_BASE + endpoint, {
              ...baseOpts, params: { ...baseOpts.params, page },
            });
            const data = resp.data;
            const items = Array.isArray(data) ? data
              : (data.items || data.products || data.data || data.result || []);
            for (const item of items) {
              const ean = String(item.ean || item.EAN || item.barcode || item.gtin || item.eanCode || '').trim();
              const price = parseFloat(item.priceExpEur || item.priceEur || item.priceNetto || item.price || item.netPrice || 0);
              if (!ean || !price) continue;
              const mfg = item.vendorName || item.vendor || item.brand || item.manufacturer || item.producerName || '';
              if (vendorCodes.length > 0 && !vendorCodes.some(vc => mfg.toLowerCase().includes(vc.toLowerCase()))) continue;
              // Build structured attributes from Elko item
              const ELKO_SYSTEM_FIELDS = new Set(['ean','EAN','barcode','gtin','eanCode','name','productName',
                'description','nameEn','namePl','vendorName','vendor','brand','manufacturer','producerName',
                'priceExpEur','priceEur','priceNetto','price','netPrice','currency','priceCurrency',
                'qty','quantity','inStock','availability','stockStatus']);
              const elkoAttrs = {};
              const ELKO_META = { elkocode: 'Kod Elko', vendorname: 'Producent', cncode: 'Kod CN', stockid1: 'ID Magazynu', fulldsc: 'Opis pełny' };
              for (const [rawK, label] of Object.entries(ELKO_META)) {
                if (item[rawK] !== undefined && item[rawK] !== null && item[rawK] !== '') elkoAttrs[label] = String(item[rawK]);
              }
              const ELKO_PREFIXES = ['Kolor','Color','Waga','Weight','Wymiary','Dimensions','Moc','Power',
                'Prędkość','Speed','Napięcie','Voltage','Pojemność','Capacity','Temperatura','Temperature',
                'Rozdzielczość','Resolution','Czas','Time','Zasięg','Range','Częstotliwość','Frequency',
                'Interfejs','Interface','Materiał','Material','Sprawność','Efficiency','Latarka'];
              for (const [k, v] of Object.entries(item)) {
                if (ELKO_SYSTEM_FIELDS.has(k) || ELKO_META[k] !== undefined) continue;
                if (v === null || v === undefined || v === '') continue;
                const valStr = String(v).trim();
                if (valStr === 'Tak' || valStr === 'true' || valStr === '1') {
                  let elkoSplit = false;
                  for (const prefix of ELKO_PREFIXES) {
                    if (k.startsWith(prefix + ' ') && k.length > prefix.length + 1) {
                      elkoAttrs[prefix] = k.slice(prefix.length + 1).trim(); elkoSplit = true; break;
                    }
                  }
                  if (!elkoSplit) {
                    const fsi = k.indexOf(' ');
                    if (fsi > 0 && fsi <= 20 && /^[0-9<>~±]/.test(k.slice(fsi + 1).trim())) {
                      elkoAttrs[k.slice(0, fsi)] = k.slice(fsi + 1).trim(); elkoSplit = true;
                    }
                  }
                  if (!elkoSplit) elkoAttrs[k] = 'Tak';
                } else {
                  elkoAttrs[k] = valStr;
                }
              }
              results.push({
                ean,
                name: item.name || item.productName || item.description || item.nameEn || item.namePl || '',
                manufacturer: mfg,
                price, currency: item.currency || item.priceCurrency || 'EUR',
                availability: (item.qty > 0 || item.quantity > 0 || item.inStock || item.availability === 'available') ? 'available' : 'unavailable',
                stock_quantity: item.qty != null ? parseInt(item.qty, 10) : (item.quantity != null ? parseInt(item.quantity, 10) : null),
                attributes: Object.keys(elkoAttrs).length > 0 ? elkoAttrs : null
              });
            }
            hasMore = items.length >= 100;
            page++;
          }
          if (results.length > 0) return results;
        }
      } catch (e) {
        const status = e.response?.status;
        const errBody = e.response?.data ? (Buffer.isBuffer(e.response.data) ? e.response.data.slice(0,200).toString() : JSON.stringify(e.response.data).slice(0,200)) : e.message;
        console.warn(`[Elko] JSON ${endpoint} (${JSON.stringify(auth.headers || auth.params)}): HTTP ${status} — ${errBody}`);
      }
    }
  }

  // --- Attempt 2: JSON Products endpoint (paginated, slower but has attributes) ---
  for (const endpoint of jsonEndpoints) {
    for (const auth of authVariants) {
      try {
        const baseOpts = {
          timeout: 60000,
          headers: { 'User-Agent': 'ShopGold/1.0', 'Accept': 'application/json', ...(auth.headers || {}) },
          params: { pageSize: 100, page: 1, ...(auth.params || {}) },
        };
        if (vendorCodes.length === 1) baseOpts.params.vendorCode = vendorCodes[0];

        const testResp = await axios.get(ELKO_BASE + endpoint, baseOpts);
        if (testResp.status === 200) {
          console.log(`[Elko] JSON OK via ${endpoint}`);
          const results = [];
          let page = 1, hasMore = true;
          while (hasMore && page <= 200) {
            const resp = page === 1 ? testResp : await axios.get(ELKO_BASE + endpoint, {
              ...baseOpts,
              params: { ...baseOpts.params, page },
            });
            const data = resp.data;
            const items = Array.isArray(data) ? data
              : (data.items || data.products || data.data || data.result || []);
            for (const item of items) {
              const ean = String(item.ean || item.EAN || item.barcode || item.gtin || item.eanCode || '').trim();
              const price = parseFloat(item.priceExpEur || item.priceEur || item.priceNetto || item.price || item.netPrice || 0);
              if (!ean || !price) continue;
              const mfg = item.vendorName || item.vendor || item.brand || item.manufacturer || item.producerName || '';
              if (vendorCodes.length > 0 && !vendorCodes.some(vc => mfg.toLowerCase().includes(vc.toLowerCase()))) continue;
              // Build structured attributes from Elko item
              // Elko API returns technical specs as flat string tags (e.g. "Kolor Biały", "Wymiary 120x120x25mm")
              // plus some key:value fields (elkocode, vendorname, cncode, stockid1, fulldsc)
              const ELKO_SYSTEM_FIELDS = new Set(['ean','EAN','barcode','gtin','eanCode','name','productName',
                'description','nameEn','namePl','vendorName','vendor','brand','manufacturer','producerName',
                'priceExpEur','priceEur','priceNetto','price','netPrice','currency','priceCurrency',
                'qty','quantity','inStock','availability','stockStatus']);
              const elkoAttrs = {};
              // 1. Copy known meta-fields as clean key:value
              const ELKO_META = { elkocode: 'Kod Elko', vendorname: 'Producent', cncode: 'Kod CN', stockid1: 'ID Magazynu', fulldsc: 'Opis pełny' };
              for (const [rawK, label] of Object.entries(ELKO_META)) {
                if (item[rawK] !== undefined && item[rawK] !== null && item[rawK] !== '') {
                  elkoAttrs[label] = String(item[rawK]);
                }
              }
              // 2. Remaining fields that are NOT system and NOT meta — these are tag-style specs
              //    Try to split "FeatureName Value" into { FeatureName: Value }
              for (const [k, v] of Object.entries(item)) {
                if (ELKO_SYSTEM_FIELDS.has(k) || ELKO_META[k] !== undefined) continue;
                if (v === null || v === undefined || v === '') continue;
                const valStr = String(v).trim();
                if (valStr === 'Tak' || valStr === 'true' || valStr === '1') {
                  // Elko tags look like: "Kolor Biały", "Wymiary 120 x 120 x 25 mm"
                  // Strategy: known prefix list, then digit-start heuristic
                  const ELKO_PREFIXES = [
                    'Kolor','Color','Farbe','Waga','Weight','Gewicht','Wymiary','Dimensions',
                    'Moc','Power','Leistung','Prędkość','Speed','Napięcie','Voltage',
                    'Pojemność','Capacity','Temperatura','Temperature','Rozdzielczość','Resolution',
                    'Czas','Time','Zasięg','Range','Sprawność','Efficiency','Częstotliwość',
                    'Frequency','Interfejs','Interface','Latarka','Materiał','Material'
                  ];
                  let elkoSplit = false;
                  for (const prefix of ELKO_PREFIXES) {
                    if (k.startsWith(prefix + ' ') && k.length > prefix.length + 1) {
                      elkoAttrs[prefix] = k.slice(prefix.length + 1).trim();
                      elkoSplit = true;
                      break;
                    }
                  }
                  if (!elkoSplit) {
                    const fsi = k.indexOf(' ');
                    if (fsi > 0 && fsi <= 20) {
                      const rest = k.slice(fsi + 1).trim();
                      if (/^[0-9<>~±]/.test(rest)) {
                        elkoAttrs[k.slice(0, fsi)] = rest;
                        elkoSplit = true;
                      }
                    }
                  }
                  if (!elkoSplit) elkoAttrs[k] = 'Tak';
                } else {
                  elkoAttrs[k] = valStr;
                }
              }

              results.push({
                ean,
                name: item.name || item.productName || item.description || item.nameEn || item.namePl || '',
                manufacturer: mfg,
                price,
                currency: item.currency || item.priceCurrency || 'EUR',
                availability: (item.qty > 0 || item.quantity > 0 || item.inStock || item.availability === 'available' || item.stockStatus === 'available') ? 'available' : 'unavailable',
                stock_quantity: item.qty != null ? parseInt(item.qty, 10) : (item.quantity != null ? parseInt(item.quantity, 10) : null),
                attributes: Object.keys(elkoAttrs).length > 0 ? elkoAttrs : null
              });
            }
            hasMore = items.length >= 100;
            page++;
          }
          if (results.length > 0) return results;
        }
      } catch (e) {
        const status = e.response?.status;
        const errBody = e.response?.data ? (Buffer.isBuffer(e.response.data) ? e.response.data.slice(0,200).toString() : JSON.stringify(e.response.data).slice(0,200)) : e.message;
        console.warn(`[Elko] JSON ${endpoint} (${JSON.stringify(auth.headers || auth.params)}): HTTP ${status} â€” ${errBody}`);
      }
    }
  }
  throw new Error('Elko API: nie udało się pobrać danych. Sprawdź klucz API i uprawnienia konta Elko. Szczegóły w logach serwera.');
}




// â”€â”€â”€ UNZIP HELPER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Unzip a buffer and return the largest matching file (txt/csv/xml/xlsx).
 * Returns a { buffer, filename } object.
 */
function unzipBuffer(buf, preferExt) {
  const zip = new AdmZip(buf);
  const entries = zip.getEntries()
    .filter(e => !e.isDirectory && !/^__MACOSX/.test(e.entryName))
    .sort((a, b) => b.header.size - a.header.size);
  if (!entries.length) throw new Error('ZIP is empty or has no usable files');
  // Prefer files matching requested extension
  const pref = preferExt ? entries.find(e => e.entryName.toLowerCase().endsWith(preferExt)) : null;
  const entry = pref || entries[0];
  return { buffer: entry.getData(), filename: entry.entryName };
}


// â”€â”€â”€ FETCH FROM SFTP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchSftpFile(supplier) {
  const sftp = new SftpClient('also-sftp');
  // Strip protocol prefix from host
  const cleanHost = (supplier.ftp_host || '').replace(/^(s?ftps?|sftp):\/\//i, '').replace(/\/+$/, '');
  try {
    await sftp.connect({
      host:     cleanHost,
      port:     supplier.ftp_port || 22,
      username: supplier.ftp_user || 'anonymous',
      password: supplier.ftp_pass || '',
      readyTimeout: 30000,
      retries: 1,
    });
    const remotePath = supplier.ftp_path;
    const chunks = [];
    const readable = await sftp.createReadStream(remotePath);
    await new Promise((resolve, reject) => {
      readable.on('data', d => chunks.push(d));
      readable.on('end', resolve);
      readable.on('error', reject);
    });
    return Buffer.concat(chunks);
  } finally {
    try { await sftp.end(); } catch(_) {}
  }
}


// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ SUPPLIER CRUD Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function listSuppliers() {
  const db = getDb();
  const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all();
  const counts = db.prepare('SELECT supplier_id, COUNT(*) as cnt FROM supplier_files GROUP BY supplier_id').all();
  const cntMap = Object.fromEntries(counts.map(r => [r.supplier_id, r.cnt]));
  return suppliers.map(s => {
    let file_size_bytes = null;
    if (s.file_path) {
      try { file_size_bytes = fs.statSync(s.file_path).size; } catch(_) {}
    }
    if (!file_size_bytes) {
      try { const cs = JSON.parse(s.col_settings||'{}'); if (cs.cached_bytes) file_size_bytes = cs.cached_bytes; } catch(_) {}
    }
    return { ...s, extra_files_count: cntMap[s.id] || 0, file_size_bytes };
  });
}


function addSupplier({ name, source_type, source_url, file_path, file_created_at = null, file_size_bytes = 0, currency = 'PLN', exchange_rate = 1,
                       ftp_host, ftp_user, ftp_pass, ftp_path, ftp_port = 21, ftp_secure = 0,
                       url_user = null, url_pass = null,
                       elko_api_key = null, elko_vendor_codes = null,
                       impakt_user = null, impakt_pass = null, impakt_api_url = null,
                       ntt_client_id = null, ntt_client_secret = null, ntt_user_id = null,
                       action_customer_id = null, action_user_name = null, action_api_key = null }) {
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO suppliers (name, source_type, source_url, file_path, file_created_at, file_size_bytes, currency, exchange_rate, ftp_host, ftp_user, ftp_pass, ftp_path, ftp_port, ftp_secure, url_user, url_pass, elko_api_key, elko_vendor_codes, impakt_user, impakt_pass, impakt_api_url, ntt_client_id, ntt_client_secret, ntt_user_id, action_customer_id, action_user_name, action_api_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, source_type, source_url || null, file_path || null, file_created_at, file_size_bytes || 0, currency, exchange_rate,
        ftp_host || null, ftp_user || null, ftp_pass || null, ftp_path || null, ftp_port, ftp_secure ? 1 : 0,
        url_user || null, url_pass || null, elko_api_key || null, elko_vendor_codes || null,
        impakt_user || null, impakt_pass || null, impakt_api_url || null,
        ntt_client_id || null, ntt_client_secret || null, ntt_user_id || null,
        action_customer_id || null, action_user_name || null, action_api_key || null);
  return result.lastInsertRowid;
}


function deleteSupplier(id) {
  const db = getDb();
  // Remove uploaded extra files from disk
  const extraFiles = db.prepare('SELECT file_path FROM supplier_files WHERE supplier_id = ?').all(id);
  for (const f of extraFiles) { if (f.file_path) try { fs.unlinkSync(f.file_path); } catch(_) {} }
  // Remove main supplier file from disk
  const main = db.prepare('SELECT file_path FROM suppliers WHERE id = ?').get(id);
  if (main && main.file_path) {
    try { fs.unlinkSync(main.file_path); } catch(_) {}
  }
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
}

function updateSupplier(id, fields) {
  const db = getDb();
  const allowed = ['name','source_url','currency','exchange_rate','col_settings','file_path','file_created_at','file_size_bytes',
                   'schedule_cron','schedule_enabled','last_scheduled_run',
                   'ftp_host','ftp_user','ftp_pass','ftp_path','ftp_port','ftp_secure',
                   'url_user','url_pass','elko_api_key','elko_vendor_codes',
                   'impakt_user','impakt_pass','impakt_api_url',
                   'ntt_client_id','ntt_client_secret','ntt_user_id',
                   'action_customer_id','action_user_name','action_api_key',
                   'is_active'];
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return;
  db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
}


function replaceSupplierFile(id, filePath) {
  const old = getDb().prepare('SELECT file_path FROM suppliers WHERE id = ?').get(id);
  if (old && old.file_path && old.file_path !== filePath) {
    try { fs.unlinkSync(old.file_path); } catch(_) {}
  }
  getDb().prepare("UPDATE suppliers SET file_path = ?, source_type = 'file' WHERE id = ?").run(filePath, id);
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ SUPPLIER FILES CRUD Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function listSupplierFiles(supplier_id) {
  return getDb().prepare('SELECT *, COALESCE(product_count, 0) as product_count FROM supplier_files WHERE supplier_id = ? ORDER BY created_at ASC').all(supplier_id);
}

function addSupplierFile({ supplier_id, label, file_type = 'stock_price', source_type = 'file', source_url = null, file_path = null, col_settings = '{}' }) {
  const result = getDb().prepare(
    'INSERT INTO supplier_files (supplier_id, label, file_type, source_type, source_url, file_path, col_settings) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(supplier_id, label || 'Plik dodatkowy', file_type, source_type, source_url || null, file_path || null, col_settings || '{}');
  return result.lastInsertRowid;
}

function updateSupplierFile(id, fields) {
  const db = getDb();
  const allowed = ['label','file_type','source_type','source_url','file_path','col_settings','last_refresh'];
  const sets = [], vals = [];
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (!sets.length) return;
  db.prepare(`UPDATE supplier_files SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
}

function deleteSupplierFile(id) {
  const db = getDb();
  const row = db.prepare('SELECT file_path FROM supplier_files WHERE id = ?').get(id);
  if (row && row.file_path) try { fs.unlinkSync(row.file_path); } catch(_) {}
  db.prepare('DELETE FROM supplier_files WHERE id = ?').run(id);
}

async function refreshOneSupplierFile(sfId) {
  const db = getDb();
  const sf = db.prepare('SELECT * FROM supplier_files WHERE id = ?').get(sfId);
  if (!sf) throw new Error(`Plik dodatkowy ID ${sfId} nie istnieje`);
  const colSettings = (() => { try { return JSON.parse(sf.col_settings || '{}'); } catch { return {}; } })();
  // Inherit auth credentials from parent supplier
  const parentSupplier = db.prepare('SELECT url_user, url_pass FROM suppliers WHERE id = ?').get(sf.supplier_id);
  const urlAuth = (parentSupplier && parentSupplier.url_user) ? { username: parentSupplier.url_user, password: parentSupplier.url_pass || '' } : null;
  let products = [];
  if (sf.source_type === 'url' && sf.source_url) {
    products = await fetchSupplierUrl(sf.source_url, colSettings, 1, urlAuth);
  } else if (sf.source_type === 'file' && sf.file_path) {
    const buf = fs.readFileSync(sf.file_path);
    const fp = sf.file_path.toLowerCase();
    if (fp.endsWith('.xml'))       products = await parseSupplierXml(buf, colSettings);
    else if (fp.endsWith('.csv'))  products = parseSupplierCsv(buf, colSettings);
    else                           products = parseSupplierExcel(buf, colSettings);
  } else {
    throw new Error('Brak pliku lub URL dla tego pliku dodatkowego');
  }
  db.prepare("UPDATE supplier_files SET last_refresh = datetime('now'), product_count = ? WHERE id = ?").run(products.length, sfId);
  return { products };
}


// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ SCHEDULE MANAGEMENT Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function setSupplierSchedule(id, { cron_expr, enabled }) {
  const db = getDb();
  const sets = [], vals = [];
  if (cron_expr !== undefined) { sets.push('schedule_cron = ?'); vals.push(cron_expr || null); }
  if (enabled !== undefined)   { sets.push('schedule_enabled = ?'); vals.push(enabled ? 1 : 0); }
  if (!sets.length) return;
  db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
}

function getScheduledSuppliers() {
  return getDb().prepare("SELECT * FROM suppliers WHERE schedule_enabled = 1 AND schedule_cron IS NOT NULL AND schedule_cron != ''").all();
}

function markScheduledRun(id) {
  getDb().prepare("UPDATE suppliers SET last_scheduled_run = datetime('now') WHERE id = ?").run(id);
}

function getScheduledFiles() {
  return getDb().prepare("SELECT * FROM supplier_files WHERE schedule_enabled = 1 AND schedule_cron IS NOT NULL AND schedule_cron != ''").all();
}

function markFileScheduledRun(id) {
  getDb().prepare("UPDATE supplier_files SET last_scheduled_run = datetime('now') WHERE id = ?").run(id);
}

// ─── Attribute Key Translation Map ─────────────────────────────────────────────
// Translates foreign-language attribute keys to Polish for display in Catalog Master
// Used for Kosatec (German CSV) and other non-Polish wholesalers
const ATTR_KEY_TRANSLATIONS = {
  // Kosatec / German CSV headers
  'artnr': 'Nr artykułu',
  'herstnr': 'Kod producenta',
  'hersteller': 'Producent',
  'artname': 'Nazwa',
  'beschreibung': 'Opis',
  'menge': 'Ilość',
  'verfuegbar': 'Dostępność',
  'vkbrutto': 'Cena detaliczna brutto',
  'vknetto': 'Cena detaliczna netto',
  'einkauf': 'Cena zakupu',
  'kat1': 'Kategoria 1',
  'kat2': 'Kategoria 2',
  'kat3': 'Kategoria 3',
  'indate': 'Data dodania',
  'gewicht': 'Waga',
  'laenge': 'Długość',
  'breite': 'Szerokość',
  'hoehe': 'Wysokość',
  'zustand': 'Stan',
  'garantie': 'Gwarancja',
  'bild': 'Zdjęcie',
  'lieferzeit': 'Czas dostawy',
  'mindestbestand': 'Min. stan',
  'lagerort': 'Lokalizacja',
  'gtin': 'EAN/GTIN',
  'typ': 'Typ',
  'farbe': 'Kolor',
  'material': 'Materiał',
  'groesse': 'Rozmiar',
  'hersteller_nr': 'Nr producenta',
  'produktgruppe': 'Grupa produktu',
  'sonstige': 'Inne',
  'used it': 'Używane IT',
  'used it notebooks': 'Używane laptopy',
  'used it pcs': 'Używane komputery',
  // Generic English headers
  'brand': 'Marka',
  'manufacturer': 'Producent',
  'model': 'Model',
  'color': 'Kolor',
  'colour': 'Kolor',
  'size': 'Rozmiar',
  'weight': 'Waga',
  'warranty': 'Gwarancja',
  'condition': 'Stan',
  'category': 'Kategoria',
  'subcategory': 'Podkategoria',
  'product type': 'Typ produktu',
  'item type': 'Typ towaru',
  'part number': 'Numer części',
  'description': 'Opis',
  'interface': 'Interfejs',
  'capacity': 'Pojemność',
  'voltage': 'Napięcie',
  'power': 'Moc',
  'frequency': 'Częstotliwość',
  'resolution': 'Rozdzielczość',
  'connectivity': 'Połączenie',
  'os': 'System operacyjny',
  'processor': 'Procesor',
  'memory': 'Pamięć',
  'storage': 'Dysk',
  'screen': 'Ekran',
  'battery': 'Bateria',
};

/**
 * Translates attribute keys from foreign languages to Polish.
 * @param {object} attrs - Raw attributes object {key: value}
 * @returns {object} - Translated attributes
 */
function translateAttrKeys(attrs) {
  if (!attrs || typeof attrs !== 'object') return attrs;
  const result = {};
  const aliasMap = getAttrAliasMap();
  for (const [k, v] of Object.entries(attrs)) {
    const lk = k.toLowerCase().trim();
    const translated = aliasMap.get(lk);
    // Use translation if found, otherwise keep original key (Title Case if all lowercase)
    const newKey = translated || (k === lk ? k.charAt(0).toUpperCase() + k.slice(1) : k);
    // Skip keys that are just internal CSV column names we don't want to show
    const skipKeys = ['artnr', 'artname', 'herstnr', 'hersteller', 'menge', 'verfuegbar', 'vkbrutto', 'indate', 'gewicht', 'kat1', 'kat2', 'kat3'];
    if (skipKeys.includes(lk)) continue; // These are already mapped to proper DB fields
    if (v && String(v).trim() && String(v).trim() !== '0' && String(v).trim() !== '-') {
      result[newKey] = v;
    }
  }
  return result;
}

const _refreshLocks = new Map();

function isSupplierRefreshing(id) {
  return _refreshLocks.has(Number(id));
}

async function refreshSupplier(id, fileBuffer = null, onProgress = null, silent = false) {
  const sid = Number(id);
  if (_refreshLocks.has(sid)) {
    const err = new Error('Odświeżanie tej hurtowni już trwa — poczekaj na zakończenie bieżącego cyklu');
    err.code = 'REFRESH_IN_PROGRESS';
    throw err;
  }
  _refreshLocks.set(sid, Date.now());
  try {
    return await _refreshSupplierUnlocked(sid, fileBuffer, onProgress, silent);
  } finally {
    _refreshLocks.delete(sid);
  }
}

async function _refreshSupplierUnlocked(id, fileBuffer = null, onProgress = null, silent = false) {
  const db = getDb();
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  if (!supplier) throw new Error('Hurtownia nie znaleziona');

  const colSettings = (() => { try { return JSON.parse(supplier.col_settings || '{}'); } catch { return {}; } })();
  const currency = supplier.currency || 'PLN';
  const manualRate = supplier.exchange_rate > 0 && currency !== 'PLN' ? supplier.exchange_rate : null;
  const rates = currency !== 'PLN' ? await getExchangeRates() : null;
  const rateToUse = manualRate || (rates ? (rates[currency.toUpperCase()] || 1) : 1);

  const mergedMap = {};

  function mergeBatch(products, fileType) {
    for (const p of products) {
      // Use per-product currency (from CSV header detection) or supplier-level currency
      const prodCurrency = (p.currency && p.currency !== 'PLN') ? p.currency : currency;
      const prodRate = (p.currency && p.currency !== 'PLN' && rates) ? (rates[p.currency.toUpperCase()] || rateToUse) : rateToUse;
      const pricePln = (prodCurrency !== 'PLN') ? p.price * prodRate : p.price;
      const isNum = (str) => {
        if (!str) return false;
        const s = str.trim();
        if (s === '3M') return false;
        const d = (s.match(/[0-9]/g) || []).length;
        const l = (s.match(/[a-zA-Z]/g) || []).length;
        return d >= l && d > 1;
      };
      const eanKey = normalizeEan(p.ean) || String(p.ean || '').trim();
      if (!eanKey) continue;
      if (!mergedMap[eanKey]) {
        mergedMap[eanKey] = {
          ...p,
          ean: eanKey,
          manufacturer: isNum(p.manufacturer) ? '' : (p.manufacturer || ''),
          price_pln: pricePln,
          availability: p.availability || 'unknown',
          condition: p.condition || 'new',
        };
      } else {
        if (fileType === 'stock_price') {
          if (Number(p.price) > 0) {
            mergedMap[eanKey].price = p.price;
            mergedMap[eanKey].price_pln = pricePln;
          }
          mergedMap[eanKey].availability = p.availability || mergedMap[eanKey].availability;
          mergedMap[eanKey].stock_quantity = p.stock_quantity ?? mergedMap[eanKey].stock_quantity;
        } else {
          if (p.price > 0 && (!mergedMap[eanKey].price || mergedMap[eanKey].price === 0)) {
            mergedMap[eanKey].price = p.price;
            mergedMap[eanKey].price_pln = pricePln;
          }
          if (mergedMap[eanKey].stock_quantity === null || mergedMap[eanKey].stock_quantity === undefined) {
            mergedMap[eanKey].stock_quantity = p.stock_quantity;
          }
          mergedMap[eanKey].availability = mergedMap[eanKey].availability === 'unknown' ? p.availability : mergedMap[eanKey].availability;
        }
        mergedMap[eanKey].weight_g = p.weight_g || mergedMap[eanKey].weight_g;
        if (fileType === 'full' || !mergedMap[eanKey].name) {
          if (p.name) mergedMap[eanKey].name = p.name;
          if (p.manufacturer && !isNum(p.manufacturer)) mergedMap[eanKey].manufacturer = p.manufacturer;
        }
        if (p.manufacturer_code && !mergedMap[eanKey].manufacturer_code) mergedMap[eanKey].manufacturer_code = p.manufacturer_code;
        if (p.category && !mergedMap[eanKey].category) mergedMap[eanKey].category = p.category;
        if (p.attributes && Object.keys(p.attributes).length > 0) {
          const existing = mergedMap[eanKey].attributes || {};
          mergedMap[eanKey].attributes = { ...existing, ...p.attributes };
        }
      }
    }
  }

  try {
    let mainProducts = [];
    if (supplier.source_type === 'url' && supplier.source_url) {
      const urlAuth = (supplier.url_user) ? { username: supplier.url_user, password: supplier.url_pass || '' } : null;
      mainProducts = await fetchSupplierUrl(supplier.source_url, colSettings, 1, urlAuth);
      // Save to disk for file size tracking
      try {
        const uploadDir = path.join(__dirname, '..', '..', 'data', 'sourcing_uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const ext = (supplier.source_url.split('?')[0].match(/\.\w{2,4}$/) || ['.xml'])[0];
        const savePath = path.join(uploadDir, `url_${id}_cache${ext}`);
        // We'll re-fetch small enough to get the buffer â€” use cached if already wrote
        // Just write the byte count as a placeholder file if products parsed > 0
        if (mainProducts.length > 0 && !fs.existsSync(savePath)) {
          fs.writeFileSync(savePath, `cached:${mainProducts.length} products`);
        }
        db.prepare("UPDATE suppliers SET file_path=? WHERE id=?").run(savePath, id);
      } catch(_) {}

    } else if (supplier.source_type === 'ftp') {
      let buf;
      if (supplier.ftp_port === 22 || supplier.ftp_port === '22') {
        // SFTP (SSH File Transfer Protocol)
        buf = await fetchSftpFile(supplier);
      } else {
        buf = await fetchFtpFile(supplier);
      }
      let fp = (supplier.ftp_path || '').toLowerCase();
      // If the downloaded file is a ZIP, extract the largest text file from it
      if (fp.endsWith('.zip') || buf.slice(0,2).toString('hex') === '504b') {
        const { buffer: inner, filename } = unzipBuffer(buf);
        buf = inner;
        fp = filename.toLowerCase();
        addLog({ supplier_id: id, action: 'refresh', status: 'info', details: `ZIP extracted: ${filename}` });
      }
      if (fp.endsWith('.xml'))      mainProducts = await parseSupplierXml(buf, colSettings);
      else if (fp.endsWith('.csv') || fp.endsWith('.txt')) mainProducts = parseSupplierCsv(buf, colSettings);
      else                          mainProducts = parseSupplierExcel(buf, colSettings);
      // Also save to disk for audit
      const savePath = path.join(path.dirname(path.dirname(__dirname)), 'data', 'sourcing_uploads', `ftp_${id}_${Date.now()}${path.extname(fp||'.csv')}`);
      try { fs.writeFileSync(savePath, buf); db.prepare("UPDATE suppliers SET file_path=? WHERE id=?").run(savePath, id); } catch(_) {}
    } else if (supplier.source_type === 'elko_api') {
      const apiKey = supplier.elko_api_key;
      const vendorCodes = supplier.elko_vendor_codes ? JSON.parse(supplier.elko_vendor_codes) : [];
      mainProducts = await fetchElkoProducts(apiKey, vendorCodes, colSettings);
      const eurCount = mainProducts.filter(p => p.currency === 'EUR').length;
      if (eurCount > 0) addLog({ supplier_id: id, action: 'refresh', status: 'info', details: `Elko: ${eurCount} produktow w EUR (kurs NBP)` });
    } else if (supplier.source_type === 'impakt_api') {
      mainProducts = await fetchImpaktProducts(supplier.impakt_api_url, supplier.impakt_user, supplier.impakt_pass);
      addLog({ supplier_id: id, action: 'refresh', status: 'info', details: `Impakt API: pobrano ${mainProducts.length} produktow` });
    } else if (supplier.source_type === 'ntt_api') {
      mainProducts = await fetchNTTProducts(supplier.ntt_client_id, supplier.ntt_client_secret, supplier.ntt_user_id, colSettings);
      addLog({ supplier_id: id, action: 'refresh', status: 'info', details: `NTT API: pobrano ${mainProducts.length} produktow (colSettings: ${JSON.stringify(colSettings)})` });
    } else if (supplier.source_type === 'action_api') {
      mainProducts = await fetchActionProducts(supplier.action_customer_id, supplier.action_user_name, supplier.action_api_key, onProgress);
      addLog({ supplier_id: id, action: 'refresh', status: 'info', details: `Action API: pobrano ${mainProducts.length} produktow` });
    } else if (supplier.source_type === 'file') {
      let buf = fileBuffer;
      if (!buf && supplier.file_path) buf = fs.readFileSync(supplier.file_path);
      if (buf) {
        const fp = (supplier.file_path || '').toLowerCase();
        if (fp.endsWith('.xml')) mainProducts = await parseSupplierXml(buf, colSettings);
        else if (fp.endsWith('.csv')) mainProducts = parseSupplierCsv(buf, colSettings);
        else mainProducts = parseSupplierExcel(buf, colSettings);
      }
    }
    mergeBatch(mainProducts, 'full');

  } catch(err) {
    addLog({ supplier_id: id, action: 'refresh', status: 'error', details: `Glowny plik: ${err.message}` });
    throw new Error(`BĹ‚Ä…d pobierania pliku gĹ‚Ăłwnego: ${err.message}`);
  }

  const supplierFiles = listSupplierFiles(id);
  for (const sf of supplierFiles) {
    try {
      const { products: sfProducts } = await refreshOneSupplierFile(sf.id);
      mergeBatch(sfProducts, sf.file_type);
      addLog({ supplier_id: id, action: `plik:${sf.label}`, status: 'ok', details: `Scalono ${sfProducts.length} rekordÄ‚Ĺ‚w (${sf.file_type})` });
    } catch(e) {
      addLog({ supplier_id: id, action: `plik:${sf.label}`, status: 'error', details: e.message });
    }
  }

  const merged = Object.values(mergedMap);

  // Akyga: API has no per-product category → derive from manufacturer code prefix
  if (supplier.name === 'Akyga' || (supplier.source_url || '').includes('akyga.com')) {
    const AK_PREFIX_CATS = {
      'AK-AV': 'Kable audio/video',
      'AK-AD': 'Adaptery i przejściówki',
      'AK-CA': 'Kable zasilające',
      'AK-CB': 'Kable',
      'AK-CO': 'Kable RS/COM',
      'AK-CR': 'Przedłużacze bębnowe',
      'AK-SP': 'Listwy zasilające',
      'AK-PA': 'Zasilacze do laptopów',
      'AK-PE': 'Zasilacze do urządzeń',
      'AK-BA': 'Baterie i akumulatory',
      'AK-CH': 'Ładowarki',
      'AK-HU': 'Huby USB',
      'AK-IT': 'Akcesoria IT',
      'AK-ND': 'Karty sieciowe',
      'AK-SF': 'Akcesoria do zasilaczy',
    };
    for (const p of merged) {
      if (!p.category && p.manufacturer_code) {
        const prefix = p.manufacturer_code.substring(0, 5).toUpperCase();
        if (AK_PREFIX_CATS[prefix]) p.category = AK_PREFIX_CATS[prefix];
        else p.category = 'Akcesoria elektryczne';
      }
    }
  }

  if (!merged.length) {
    if (supplier.source_type === 'elko_api') {
      addLog({ supplier_id: id, action: 'refresh', status: 'warn', details: 'Brak produktow z EAN (Elko)' });
      throw new Error('Elko: API zwrocilo 0 produktow lub odmowilo dostepu (sprawdz IP/klucz). Upewnij sie, ze wgrales poprawne pliki Excel dla poszczegolnych marek i zawieraja one kolumny EAN/Cena.');
    } else {
      addLog({ supplier_id: id, action: 'refresh', status: 'warn', details: 'Nie znaleziono produktow z EAN' });
      throw new Error('Nie znaleziono produktow z EAN w plikach hurtowni (sprawdz nazwy kolumn)');
    }
  }

  db.transaction(() => {
    db.prepare('DELETE FROM supplier_products WHERE supplier_id = ?').run(id);
    const ins = db.prepare(
      'INSERT INTO supplier_products (supplier_id, ean, normalized_ean, name, manufacturer, manufacturer_code, price, price_pln, price_gross, price_srp, price_eur, price_regular, discount_percent, vat, availability, condition, warranty, warranty_months, is_being_ordered, delivery_date, package_size, stock_quantity, stock_reserved, incoming_stock, shipping_time_hours, is_special_offer, is_eol, is_non_returnable, is_large_product, weight_g, weight_net_g, unit_measure, category, pcn_code, volume, product_url, product_type, availability_info, related_products, date_added, description, photos, supplier_product_id, attributes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const getHistory = db.prepare('SELECT price_pln, recorded_at FROM price_history WHERE supplier_id=? AND ean=? ORDER BY recorded_at DESC LIMIT 1');
    const insHistory = db.prepare('INSERT INTO price_history (supplier_id, ean, price_pln) VALUES (?, ?, ?)');

    let loggedAttr = false;
    for (const p of merged) {
      // Zapisujemy surowe cechy w formacie 1:1 z hurtowni
      const rawAttrs = p.attributes || null;
      const attrsStr = rawAttrs && Object.keys(rawAttrs).length > 0 ? JSON.stringify(rawAttrs) : '{}';
      if (!loggedAttr && p.attributes && Object.keys(p.attributes).length > 0) {
        console.log('[sourcing] Raw attrs sample:', JSON.stringify(rawAttrs).substring(0, 200));
        loggedAttr = true;
      }
      const photosStr = Array.isArray(p.photos) ? JSON.stringify(p.photos) : (p.photos || '[]');
      ins.run(
        id,                              // supplier_id
        p.ean,                           // ean
        normalizeEan(p.ean),             // normalized_ean
        p.name,                          // name
        p.manufacturer,                  // manufacturer
        p.manufacturer_code || '',       // manufacturer_code
        p.price,                         // price
        p.price_pln,                     // price_pln
        p.price_gross ?? null,           // price_gross
        p.price_srp ?? null,             // price_srp
        p.price_eur ?? null,             // price_eur
        p.price_regular ?? null,         // price_regular
        p.discount_percent ?? null,      // discount_percent
        p.vat ?? null,                   // vat
        p.availability,                  // availability
        p.condition || 'new',            // condition
        p.warranty || null,              // warranty
        p.warranty_months ?? null,       // warranty_months
        p.is_being_ordered ?? 0,         // is_being_ordered
        p.delivery_date || null,         // delivery_date
        p.package_size ?? null,          // package_size
        p.stock_quantity ?? null,        // stock_quantity
        p.stock_reserved ?? null,        // stock_reserved
        p.incoming_stock ?? null,        // incoming_stock
        p.shipping_time_hours ?? null,   // shipping_time_hours
        p.is_special_offer ?? 0,         // is_special_offer
        p.is_eol ?? 0,                   // is_eol
        p.is_non_returnable ?? 0,        // is_non_returnable
        p.is_large_product ?? 0,         // is_large_product
        p.weight_g || 0,                 // weight_g
        p.weight_net_g ?? 0,             // weight_net_g
        p.unit_measure || null,          // unit_measure
        p.category || '',                // category
        p.pcn_code || null,              // pcn_code
        p.volume ?? null,                // volume
        p.product_url || null,           // product_url
        p.product_type || null,          // product_type
        p.availability_info || null,     // availability_info
        p.related_products || null,      // related_products
        p.date_added || null,            // date_added
        p.description || null,           // description
        photosStr,                       // photos
        p.supplier_product_id || null,   // supplier_product_id
        attrsStr                         // attributes
      );
      
      // Price history tracking
      if (p.price_pln > 0) {
        const lastRec = getHistory.get(id, p.ean);
        let shouldRecord = false;
        if (!lastRec) {
          shouldRecord = true;
        } else {
          const diffHours = (Date.now() - new Date(`${lastRec.recorded_at}Z`).getTime()) / (1000 * 60 * 60);
          // Record if price changed by more than 0.01 PLN, OR if it's been more than 24 hours (keep alive)
          if (Math.abs(lastRec.price_pln - p.price_pln) > 0.01 || diffHours >= 24) {
            shouldRecord = true;
          }
        }
        if (shouldRecord) {
          insHistory.run(id, p.ean, p.price_pln);
        }
      }
    }
    
    // Cleanup old history (keep 90 days max)
    db.prepare("DELETE FROM price_history WHERE recorded_at < datetime('now', '-90 days')").run();

    db.prepare("UPDATE suppliers SET product_count=?, last_refresh=datetime('now') WHERE id=?").run(merged.length, id);

    replaceSupplierProductAttrs(db, id, merged);
  })();

  addLog({ supplier_id: id, action: 'refresh', status: 'ok', details: `Scalono ${merged.length} SKU (${supplierFiles.length} dodatkowych plikow, kurs: ${rateToUse.toFixed(4)})` });

  // Unified Notifications trigger
  if (!silent) {
    try {
      const notificationService = require('./notificationService');
      notificationService.addNotification(
        'Odświeżenie hurtowni',
        `Zakończono odświeżanie hurtowni: ${supplier.name} (zaimportowano ${merged.length} SKU)`,
        'success',
        'sourcing'
      );
    } catch (err) {
      console.error('[sourcing] Failed to trigger success notification:', err.message);
    }
  }

  // v1.3.0 — Auto-update catalog master after refresh
  try {
    const catalogService = require('./catalogService');
    const catResult = catalogService.rebuildCatalogForSupplier(db, id);
    const attrNote = catResult.attrs ? `, cech: ${catResult.attrs.filled}` : '';
    addLog({ supplier_id: id, action: 'catalog_update', status: 'ok', details: `Katalog: +${catResult.created} nowych, ${catResult.updated} zaktualizowanych, ${catResult.pruned || 0} usuniętych ofert${attrNote}` });
  } catch(catErr) {
    console.error('[catalog_update] ERROR:', catErr.message, catErr.stack);
    addLog({ supplier_id: id, action: 'catalog_update', status: 'error', details: catErr.message });
  }

  try {
    const sourcingRoutes = require('../routes/sourcing');
    if (typeof sourcingRoutes._clearSourcingCache === 'function') sourcingRoutes._clearSourcingCache();
  } catch (_) {}

  return { supplier_id: id, imported: merged.length };
}

function replaceSupplierProductAttrs(db, supplierId, products) {
  try {
    db.prepare('DELETE FROM supplier_product_attrs WHERE supplier_id = ?').run(supplierId);
  } catch (_) {
    return;
  }
  let ins;
  try {
    ins = db.prepare(
      'INSERT OR REPLACE INTO supplier_product_attrs (supplier_id, ean, normalized_ean, attr_name, attr_value) VALUES (?, ?, ?, ?, ?)'
    );
  } catch (_) {
    return;
  }
  for (const p of products) {
    const attrs = p.attributes;
    if (!attrs || typeof attrs !== 'object') continue;
    const norm = normalizeEan(p.ean);
    for (const [k, v] of Object.entries(attrs)) {
      if (!k || v == null) continue;
      const val = String(v).trim();
      if (!val || val === '-' || val === '0') continue;
      ins.run(supplierId, p.ean, norm, String(k).slice(0, 200), val.slice(0, 2000));
    }
  }
}

async function refreshAllSuppliers() {
  const suppliers = listSuppliers().filter(s => s.source_type !== 'file');
  const results = [];
  const successList = [];
  const errorList = [];

  for (const s of suppliers) {
    try {
      if (isSupplierRefreshing(s.id)) {
        results.push({ id: s.id, name: s.name, status: 'skipped', error: 'Odświeżanie już trwa' });
        continue;
      }
      const r = await refreshSupplier(s.id, null, null, true);
      results.push({ id: s.id, name: s.name, status: 'ok', imported: r.imported });
      successList.push(`${s.name} (${r.imported} SKU)`);
    } catch(e) {
      results.push({ id: s.id, name: s.name, status: 'error', error: e.message });
      errorList.push(`${s.name} - błąd: ${e.message}`);
    }
  }

  // Unified summary notification
  try {
    const notificationService = require('./notificationService');
    let msg = '';
    if (successList.length > 0) {
      msg += `Poprawnie:\n- ${successList.join('\n- ')}\n`;
    }
    if (errorList.length > 0) {
      msg += `\nBłędy:\n- ${errorList.join('\n- ')}`;
    }
    if (msg.trim()) {
      const type = errorList.length === 0 ? 'success' : (successList.length === 0 ? 'error' : 'warning');
      notificationService.addNotification(
        'Zbiorcze odświeżenie hurtowni',
        msg.trim(),
        type,
        'sourcing'
      );
    }
  } catch (err) {
    console.error('[sourcing] Failed to trigger summary notification:', err.message);
  }

  return results;
}

// ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function loadCatalogEanGroups(db) {
  try {
    const rows = db.prepare('SELECT canonical_ean, all_eans FROM catalog_master').all();
    return buildCatalogEanGroups(rows);
  } catch (_) {
    return new Map();
  }
}

function indexOffersByNormalizedEan(allOffers) {
  const offerMap = {};
  for (const o of allOffers) {
    if (!o.price_pln || o.price_pln <= 0) continue;
    const key = normalizeEan(o.normalized_ean || o.ean);
    if (!key) continue;
    if (!offerMap[key]) offerMap[key] = [];
    offerMap[key].push(o);
  }
  return offerMap;
}

function collectOffersForEan(ean, offerMap, catalogGroups) {
  const key = normalizeEan(ean);
  if (!key) return [];
  const group = catalogGroups && catalogGroups.get(key);
  const keys = group && group.size ? group : new Set([key]);
  const out = [];
  const seen = new Set();
  for (const k of keys) {
    const list = offerMap[k] || [];
    for (const o of list) {
      const id = `${o.supplier_id}:${o.ean}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(o);
    }
  }
  return out;
}

function sortComparisonRows(rows, sortCol, sortAsc) {
  const dir = sortAsc ? 1 : -1;
  const list = [...rows];
  if (!sortCol) {
    list.sort((a, b) => (b.savings_pct || 0) - (a.savings_pct || 0));
    return list;
  }
  list.sort((a, b) => {
    let av;
    let bv;
    if (String(sortCol).startsWith('sup_')) {
      const sid = parseInt(String(sortCol).replace('sup_', ''), 10);
      av = a.supplier_prices?.[sid]?.price;
      bv = b.supplier_prices?.[sid]?.price;
    } else {
      av = a[sortCol];
      bv = b[sortCol];
    }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), 'pl', { numeric: true }) * dir;
  });
  return list;
}

function buildComparison({
  onlyAvailable = false,
  minSavingsPct = null,
  search = '',
  manufacturer = '',
  supplier_id = null,
  limit = null,
  offset = 0,
  sortCol = null,
  sortAsc = true,
} = {}) {
  const db = getDb();

  let subQuery = 'SELECT *, buy_price_date FROM subiekt_products WHERE 1=1';
  const params = [];
  if (search) {
    subQuery += ' AND (name LIKE ? OR ean LIKE ? OR IFNULL(normalized_ean, \'\') LIKE ?';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    const digits = String(search).replace(/[^0-9]/g, '');
    const vars = digits.length >= 8 ? eanVariants(digits) : [];
    if (vars.length) {
      subQuery += ` OR ean IN (${vars.map(() => '?').join(',')}) OR normalized_ean IN (${vars.map(() => '?').join(',')})`;
      params.push(...vars, ...vars);
    }
    subQuery += ')';
  }

  const subProducts = db.prepare(subQuery).all(...params);

  // Calculate 3-month cutoff date for buy_price staleness check
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsCutoff = threeMonthsAgo.toISOString().slice(0, 10);
  if (!subProducts.length) {
    return { rows: [], suppliers: [], allManufacturers: [], total: 0, limit: null, offset: 0, stats: { green: 0, yellow: 0, red: 0, totalSav: 0 } };
  }

  const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name').all();

  let offerQuery = `
    SELECT sp.ean, sp.price, COALESCE(sp.price_pln, sp.price) as price_pln,
           sp.availability, sp.stock_quantity, sp.name as sp_name, sp.manufacturer as sp_manufacturer,
           sp.condition as sp_condition, sp.warranty as sp_warranty,
           s.id as supplier_id, s.name as supplier_name, s.currency
    FROM supplier_products sp
    JOIN suppliers s ON s.id = sp.supplier_id
    WHERE COALESCE(s.is_active, 1) = 1
  `;
  const offerParams = [];
  if (supplier_id) {
    offerQuery += ' AND sp.supplier_id = ?';
    offerParams.push(parseInt(supplier_id));
  }
  offerQuery += ' ORDER BY COALESCE(sp.price_pln, sp.price) ASC';

  const allOffers = db.prepare(offerQuery).all(...offerParams);
  const offerMap = indexOffersByNormalizedEan(allOffers);
  const catalogGroups = loadCatalogEanGroups(db);
  const catalogMeta = {};
  try {
    for (const row of db.prepare('SELECT canonical_ean, name, manufacturer FROM catalog_master').all()) {
      const key = groupKeyForEan(row.canonical_ean, catalogGroups) || normalizeEan(row.canonical_ean);
      if (key && !catalogMeta[key]) catalogMeta[key] = { name: row.name || '', manufacturer: row.manufacturer || '' };
    }
  } catch (_) {}

  // Get all unique manufacturers from supplier products for filter dropdown
  const allManufacturersRaw = db.prepare(
    `SELECT DISTINCT manufacturer COLLATE NOCASE as manufacturer FROM supplier_products WHERE manufacturer IS NOT NULL AND manufacturer != '' ORDER BY manufacturer COLLATE NOCASE`
  ).all().map(r => r.manufacturer).filter(isValidManufacturer);
  const allManufacturers = [...new Set(allManufacturersRaw.map(normalizeManufacturer))].sort((a, b) => a.localeCompare(b));

  const rows = [];
  for (const sub of subProducts) {
    const offers = collectOffersForEan(sub.ean, offerMap, catalogGroups);
    if (supplier_id && !offers.length) continue; // Skip if filtered by supplier and no offers
    const filtered = onlyAvailable ? offers.filter(o => o.availability === 'available') : offers;
    const best = filtered.length ? filtered.reduce((a, b) => a.price_pln < b.price_pln ? a : b) : null;

    const savings = (best && sub.buy_price != null) ? sub.buy_price - best.price_pln : null;
    const savingsPct = (savings != null && sub.buy_price > 0) ? (savings / sub.buy_price) * 100 : null;

    if (minSavingsPct !== null && savingsPct !== null && savingsPct < minSavingsPct) continue;
    if (minSavingsPct !== null && savingsPct === null) continue;

    let name = sub ? sub.name : '';
    let rowMfg = '';
    if (offers.length > 0) {
      if (!name) name = offers.map(o => o.sp_name || '').reduce((a, b) => a.length > b.length ? a : b, '');
      rowMfg = offers.map(o => normalizeManufacturer(o.sp_manufacturer || '')).find(m => m.length > 0) || '';
    }
    const catMeta = catalogMeta[groupKeyForEan(sub.ean, catalogGroups)];
    if (catMeta) {
      if (catMeta.name) name = catMeta.name;
      if (catMeta.manufacturer) rowMfg = catMeta.manufacturer;
    }
    rowMfg = normalizeManufacturer(rowMfg);
    if (manufacturer && !rowMfg.toLowerCase().includes(manufacturer.toLowerCase())) continue;

    let signal = 'none';
    let buy_price_stale = false;
    if (savingsPct !== null) {
      if (savingsPct >= 10)     signal = 'green';
      else if (savingsPct >= 0) signal = 'yellow';
      else                      signal = 'red';
    }
    // If supplier price is lower than buy_price (signal green/yellow = savings),
    // check if buy_price_date is older than 3 months — if so, downgrade signal
    if (signal === 'green' && sub.buy_price_date) {
      if (sub.buy_price_date < threeMonthsCutoff) {
        signal = 'yellow';
        buy_price_stale = true;
      }
    }

    const supplierPrices = {};
    for (const o of offers) {
      if (!supplierPrices[o.supplier_id] || o.price_pln < supplierPrices[o.supplier_id].price) {
        supplierPrices[o.supplier_id] = { price: o.price_pln, orig_price: o.price, currency: o.currency, availability: o.availability, stock_quantity: o.stock_quantity ?? null, condition: o.sp_condition || 'new', warranty: o.sp_warranty || null };
      }
    }

    rows.push({
      ean: sub.ean, name: name || sub.name, stock: sub.stock,
      sold_12m: sub.sold_12m, sold_30d: sub.sold_30d,
      buy_price: sub.buy_price, sell_price: sub.sell_price,
      buy_price_date: sub.buy_price_date || null,
      buy_price_stale,
      best_price: best ? best.price_pln : null,
      best_supplier: best ? best.supplier_name : null,
      best_supplier_id: best ? best.supplier_id : null,
      manufacturer: rowMfg,
      condition: best ? (best.sp_condition || 'new') : 'new',
      warranty: best ? (best.sp_warranty || null) : null,
      savings, savings_pct: savingsPct, signal,
      offers_count: offers.length,
      supplier_prices: supplierPrices,
    });
  }

  const sorted = sortComparisonRows(rows, sortCol, sortAsc);
  const stats = {
    green: sorted.filter(r => r.signal === 'green').length,
    yellow: sorted.filter(r => r.signal === 'yellow').length,
    red: sorted.filter(r => r.signal === 'red').length,
    totalSav: sorted.reduce((s, r) => s + (r.savings || 0), 0),
  };
  const total = sorted.length;
  const pageOffset = Math.max(0, parseInt(offset, 10) || 0);
  const pageLimit = limit == null || limit === '' ? null : Math.max(1, parseInt(limit, 10) || 100);
  const pageRows = pageLimit == null ? sorted : sorted.slice(pageOffset, pageOffset + pageLimit);

  return {
    rows: pageRows,
    suppliers,
    allManufacturers,
    total,
    limit: pageLimit,
    offset: pageOffset,
    stats,
  };
}

function exportComparisonCsv(options = {}) {
  const { rows, suppliers } = buildComparison({ ...options, limit: null, offset: 0 });
  const supplierNames = suppliers.map(s => s.name);
  const header = ['EAN','Nazwa','Stan','Sprzedaz 30d','Sprzedaz 12m','Cena zakupu','Cena sprzedazy',
    'Najlepsza cena','Najtansza hurtownia','Oszczednosc (zl)','Oszczednosc (%)','Sygnal',
    ...supplierNames].join(';');

  const sig_pl = { green:'Oplacalne', yellow:'Neutralne', red:'Drozej', none:'Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ' };
  const lines = [header];
  for (const r of rows) {
    const base = [
      r.ean, `"${(r.name||'').replace(/"/g,'""')}"`,
      r.stock??'', r.sold_30d??'', r.sold_12m??'',
      fmtNum(r.buy_price), fmtNum(r.sell_price),
      fmtNum(r.best_price),
      r.best_supplier?`"${r.best_supplier}"`:'',
      fmtNum(r.savings),
      r.savings_pct!=null?r.savings_pct.toFixed(1).replace('.',','):'',
      sig_pl[r.signal]||'Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ',
    ];
    const perSup = suppliers.map(s => { const sp = r.supplier_prices[s.id]; return sp ? fmtNum(sp.price) : ''; });
    lines.push([...base, ...perSup].join(';'));
  }
  return lines.join('\r\n');
}

function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '';
  return String(parseFloat(v).toFixed(2)).replace('.', ',');
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ PROMOTIONS Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function buildPromotions({ threshold = 10, onlyAvailable = false, search = '' } = {}) {
  const db = getDb();

  const subMap = {};
  db.prepare('SELECT ean, name, buy_price, sell_price, stock, sold_30d FROM subiekt_products').all()
    .forEach(r => { subMap[normalizeEan(r.ean) || r.ean] = r; });

  const allOffers = db.prepare(`
    SELECT sp.ean, COALESCE(sp.price_pln, sp.price) as price_pln, sp.price,
           sp.availability, sp.stock_quantity, sp.name as sp_name, sp.manufacturer as sp_manufacturer,
           sp.condition as sp_condition, sp.warranty as sp_warranty,
           s.id as supplier_id, s.name as supplier_name, s.currency
    FROM supplier_products sp
    JOIN suppliers s ON s.id = sp.supplier_id
    WHERE COALESCE(s.is_active, 1) = 1
    ORDER BY price_pln ASC
  `).all();

  const offerMap = indexOffersByNormalizedEan(allOffers);
  const catalogGroups = loadCatalogEanGroups(db);

  const rows = [];
  const eans = new Set([...Object.keys(subMap), ...Object.keys(offerMap)]);
  const suppliers = db.prepare('SELECT id, name, currency FROM suppliers WHERE COALESCE(is_active, 1) = 1').all();
  const seenGroups = new Set();

  for (const ean of eans) {
    const group = catalogGroups.get(normalizeEan(ean));
    const groupKey = group && group.size ? [...group].sort()[0] : (normalizeEan(ean) || ean);
    if (seenGroups.has(groupKey)) continue;
    seenGroups.add(groupKey);
    const sub = subMap[ean] || subMap[normalizeEan(ean)] || (group ? [...group].map(k => subMap[k]).find(Boolean) : null);
    let offers = collectOffersForEan(ean, offerMap, catalogGroups);
    if (onlyAvailable) offers = offers.filter(o => o.availability === 'available');
    if (!offers.length) continue;

    const sorted = [...offers].sort((a,b) => a.price_pln - b.price_pln);
    const best = sorted[0];
    const second = sorted[1];

    let isPromo = false, refPrice = null, refLabel = '';
    if (second) {
      const diff = ((second.price_pln - best.price_pln) / second.price_pln) * 100;
      if (diff >= threshold) { isPromo = true; refPrice = second.price_pln; refLabel = sorted[1].supplier_name; }
    } else if (sub && sub.buy_price != null) {
      const diff = ((sub.buy_price - best.price_pln) / sub.buy_price) * 100;
      if (diff >= threshold) { isPromo = true; refPrice = sub.buy_price; refLabel = 'Cena zakupu'; }
    }
    if (!isPromo) continue;

    const name = sub?.name || (offers.length > 0 ? offers.map(o => o.sp_name || '').reduce((a, b) => a.length > b.length ? a : b, '') : '');
    const manufacturer = offers.length > 0 ? normalizeManufacturer(offers.map(o => o.sp_manufacturer || '').find(m => m.length > 0) || '') : '';
    if (search) {
      const q = search.toLowerCase();
      if (!ean.includes(q) && !name.toLowerCase().includes(q)) continue;
    }

    const supplierPrices = {};
    for (const o of offers) {
      if (!supplierPrices[o.supplier_id] || o.price_pln < supplierPrices[o.supplier_id].price) {
        supplierPrices[o.supplier_id] = { price: o.price_pln, orig_price: o.price, currency: o.currency, availability: o.availability, stock_quantity: o.stock_quantity ?? null, condition: o.sp_condition || 'new', warranty: o.sp_warranty || null, supplier_name: o.supplier_name };
      }
    }

    rows.push({
      ean: sub?.ean || best.ean || ean, name,
      manufacturer: manufacturer,
      best_price: best.price_pln, best_supplier: best.supplier_name, best_supplier_id: best.supplier_id,
      ref_price: refPrice, ref_label: refLabel,
      savings_pct: refPrice ? ((refPrice - best.price_pln) / refPrice) * 100 : 0,
      availability: best.availability, in_subiekt: !!sub,
      condition: best.sp_condition || 'new', warranty: best.sp_warranty || null,
      stock: sub?.stock ?? null, sell_price: sub?.sell_price ?? null, sold_30d: sub?.sold_30d ?? null,
      stock_quantity: best.stock_quantity ?? null,
      buy_price: sub?.buy_price ?? null,
      supplier_prices: supplierPrices
    });
  }

  rows.sort((a,b) => b.savings_pct - a.savings_pct);
  return { rows, suppliers };
}

// ═════════════════════════════════════════════════════════════════════════════
// SUPER DEALS (SUPER CENY)
// ═════════════════════════════════════════════════════════════════════════════

function buildSuperDeals({ threshold = 50, onlyAvailable = false, search = '' } = {}) {
  const db = getDb();

  const subMap = {};
  db.prepare('SELECT ean, name, buy_price, sell_price, stock, sold_30d FROM subiekt_products').all()
    .forEach(r => { subMap[normalizeEan(r.ean) || r.ean] = r; });

  const allOffers = db.prepare(`
    SELECT sp.ean, COALESCE(sp.price_pln, sp.price) as price_pln, sp.price,
           sp.availability, sp.stock_quantity, sp.name as sp_name, sp.manufacturer as sp_manufacturer,
           sp.condition as sp_condition, sp.warranty as sp_warranty,
           s.id as supplier_id, s.name as supplier_name, s.currency
    FROM supplier_products sp
    JOIN suppliers s ON s.id = sp.supplier_id
    WHERE COALESCE(s.is_active, 1) = 1
    ORDER BY price_pln ASC
  `).all();

  const offerMap = indexOffersByNormalizedEan(allOffers);
  const catalogGroups = loadCatalogEanGroups(db);

  const qualifyingRows = [];
  const eans = new Set([...Object.keys(subMap), ...Object.keys(offerMap)]);
  const seenGroups = new Set();

  for (const ean of eans) {
    const group = catalogGroups.get(normalizeEan(ean));
    const groupKey = group && group.size ? [...group].sort()[0] : (normalizeEan(ean) || ean);
    if (seenGroups.has(groupKey)) continue;
    seenGroups.add(groupKey);
    const sub = subMap[ean] || subMap[normalizeEan(ean)] || (group ? [...group].map(k => subMap[k]).find(Boolean) : null);
    let offers = collectOffersForEan(ean, offerMap, catalogGroups);
    if (onlyAvailable) offers = offers.filter(o => o.availability === 'available');
    if (!offers.length) continue;

    const sorted = [...offers].sort((a,b) => a.price_pln - b.price_pln);
    const best = sorted[0];
    const second = sorted[1];

    let qualifies = false;
    let refPrice = null;
    let refLabel = '';
    let dealType = '';
    let savingsPct = 0;

    if (sub && sub.buy_price > 0) {
      // Savings vs current buy price (how much cheaper is this supplier vs what we already pay)
      const savings = ((sub.buy_price - best.price_pln) / sub.buy_price) * 100;
      if (savings >= threshold) {
        qualifies = true;
        refPrice = sub.buy_price;
        refLabel = 'Cena zakupu';
        dealType = 'Subiekt';
        savingsPct = savings;
      }
    } else if (sub && sub.sell_price > 0) {
      // Fallback: compare vs sell_price if no buy_price
      const margin = ((sub.sell_price - best.price_pln) / sub.sell_price) * 100;
      if (margin >= threshold) {
        qualifies = true;
        refPrice = sub.sell_price;
        refLabel = 'Cena sprzeda\u017cy';
        dealType = 'Subiekt';
        savingsPct = margin;
      }
    } else if (second) {

      const ratio = second.price_pln / best.price_pln;
      if (ratio >= 1.5 && ratio <= 5.0) {
        qualifies = true;
        refPrice = second.price_pln;
        refLabel = second.supplier_name;
        dealType = 'Arbitraż';
        savingsPct = ((second.price_pln - best.price_pln) / second.price_pln) * 100;
      }
    }

    if (!qualifies) continue;

    const name = sub?.name || (offers.length > 0 ? offers.map(o => o.sp_name || '').reduce((a, b) => a.length > b.length ? a : b, '') : '');
    const manufacturer = offers.length > 0 ? normalizeManufacturer(offers.map(o => o.sp_manufacturer || '').find(m => m.length > 0) || '') : '';
    if (search) {
      const q = search.toLowerCase();
      if (!ean.includes(q) && !name.toLowerCase().includes(q)) continue;
    }

    const supplierPrices = {};
    for (const o of offers) {
      if (!supplierPrices[o.supplier_id] || o.price_pln < supplierPrices[o.supplier_id].price) {
        supplierPrices[o.supplier_id] = { price: o.price_pln, orig_price: o.price, currency: o.currency, availability: o.availability, stock_quantity: o.stock_quantity ?? null, condition: o.sp_condition || 'new', warranty: o.sp_warranty || null, supplier_name: o.supplier_name };
      }
    }

    qualifyingRows.push({
      ean: sub?.ean || best.ean || ean, name, manufacturer,
      best_price: best.price_pln, best_supplier: best.supplier_name, best_supplier_id: best.supplier_id,
      ref_price: refPrice, ref_label: refLabel,
      deal_type: dealType, savings_pct: savingsPct,
      availability: best.availability, in_subiekt: !!sub,
      condition: best.sp_condition || 'new', warranty: best.sp_warranty || null,
      stock: sub?.stock ?? null, sell_price: sub?.sell_price ?? null, buy_price: sub?.buy_price ?? null,
      stock_quantity: best.stock_quantity ?? null,
      supplier_prices: supplierPrices,
      is_new: false,
      first_seen_at: null
    });
  }

  if (qualifyingRows.length > 0) {
    const chunkSize = 900;
    const historyMap = {};

    for (let i = 0; i < qualifyingRows.length; i += chunkSize) {
      const chunk = qualifyingRows.slice(i, i + chunkSize);
      const chunkEans = chunk.map(r => r.ean);
      const placeholders = chunkEans.map(() => '?').join(',');

      const histRows = db.prepare(`
        SELECT ean, MIN(recorded_at) as min_rec, MAX(recorded_at) as max_rec, COUNT(*) as cnt
        FROM price_history
        WHERE ean IN (${placeholders})
        GROUP BY ean
      `).all(...chunkEans);

      for (const hr of histRows) {
        historyMap[hr.ean] = hr;
      }
    }

    for (const r of qualifyingRows) {
      const hist = historyMap[r.ean];
      if (hist) {
        r.first_seen_at = hist.min_rec;
        const firstSeenDate = new Date(`${hist.min_rec}Z`).getTime();
        const diffHours = (Date.now() - firstSeenDate) / (1000 * 60 * 60);
        
        if (diffHours <= 30) {
          r.is_new = true;
        } else {
          const lastTwo = db.prepare('SELECT recorded_at FROM price_history WHERE ean = ? ORDER BY recorded_at DESC LIMIT 2').all(r.ean);
          if (lastTwo.length >= 2) {
            const lastTime = new Date(`${lastTwo[0].recorded_at}Z`).getTime();
            const prevTime = new Date(`${lastTwo[1].recorded_at}Z`).getTime();
            const gapDays = (lastTime - prevTime) / (1000 * 60 * 60 * 24);
            if (gapDays >= 7) {
              r.is_new = true;
            }
          }
        }
      } else {
        r.is_new = true;
        r.first_seen_at = new Date().toISOString().replace('T', ' ').slice(0, 19);
      }
    }
  }

  qualifyingRows.sort((a,b) => b.savings_pct - a.savings_pct);
  const suppliers = db.prepare('SELECT id, name, currency FROM suppliers WHERE COALESCE(is_active, 1) = 1').all();

  return { rows: qualifyingRows, suppliers };
}

// Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬ MISSING PRODUCTS Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬Ă˘â€ťâ‚¬

function getMissingProducts({ supplier_id = null, search = '', availability = '', manufacturer = '', limit = 500, offset = 0 } = {}) {
  const db = getDb();

  const subEans = new Set(
    db.prepare('SELECT DISTINCT ean FROM subiekt_products').all()
      .flatMap(r => eanVariants(r.ean).map(normalizeEan).filter(Boolean))
  );
  const catalogGroups = loadCatalogEanGroups(db);
  for (const ean of [...subEans]) {
    const group = catalogGroups.get(ean);
    if (group) group.forEach(k => subEans.add(k));
  }

  // Build a global name/manufacturer/manufacturer_code lookup from ALL suppliers (for cross-referencing)
  // This ensures products from suppliers without names (e.g. Incom) can get names
  // from other suppliers that carry the same EAN.
  const globalNameMap = {};
  const nameRows = db.prepare(
    "SELECT ean, name, manufacturer, manufacturer_code FROM supplier_products WHERE name IS NOT NULL AND name != '' ORDER BY CASE WHEN name LIKE '%\n%' OR name LIKE '%\r%' OR LENGTH(name) > 150 THEN 1 ELSE 0 END ASC, LENGTH(name) DESC"
  ).all();
  for (const nr of nameRows) {
    const cleanName = (nr.name || '').trim();
    if (!cleanName || /^[.\-/?!_]+$/.test(cleanName)) continue;
    const nameKey = normalizeEan(nr.ean) || nr.ean;
    if (!globalNameMap[nameKey]) {
      globalNameMap[nameKey] = { name: nr.name, manufacturer: nr.manufacturer || '', manufacturer_code: nr.manufacturer_code || '' };
    } else {
      // Fill in missing manufacturer_code from other suppliers
      if (!globalNameMap[nameKey].manufacturer_code && nr.manufacturer_code) {
        globalNameMap[nameKey].manufacturer_code = nr.manufacturer_code;
      }
      if (!globalNameMap[nameKey].manufacturer && nr.manufacturer) {
        globalNameMap[nameKey].manufacturer = nr.manufacturer;
      }
    }
  }

  // Also build a catalog_master lookup for name and manufacturer_code fallback
  const catalogCodeMap = {};
  try {
    const catRows = db.prepare(
      "SELECT canonical_ean, all_eans, name, manufacturer_code, manufacturer FROM catalog_master"
    ).all();
    for (const cr of catRows) {
      const info = {
        name: cr.name || '',
        manufacturer_code: cr.manufacturer_code || '',
        manufacturer: cr.manufacturer || ''
      };
      catalogCodeMap[normalizeEan(cr.canonical_ean) || cr.canonical_ean] = info;
      catalogCodeMap[cr.canonical_ean] = info;
      if (cr.all_eans) {
        try {
          const variants = JSON.parse(cr.all_eans);
          if (Array.isArray(variants)) {
            for (const v of variants) {
              if (v) {
                catalogCodeMap[v] = info;
                const nv = normalizeEan(v);
                if (nv) catalogCodeMap[nv] = info;
              }
            }
          }
        } catch(_) {}
      }
    }
  } catch(_) {}

  let spQuery = `
    SELECT sp.ean, sp.name as sp_name, COALESCE(sp.price_pln, sp.price) as price_pln,
           sp.price, sp.availability, sp.stock_quantity, sp.manufacturer, sp.manufacturer_code,
           sp.condition as sp_condition, sp.warranty as sp_warranty,
           s.id as supplier_id, s.name as supplier_name
    FROM supplier_products sp
    JOIN suppliers s ON s.id = sp.supplier_id
    WHERE COALESCE(s.is_active, 1) = 1
  `;
  const params = [];
  if (supplier_id) { spQuery += ' AND sp.supplier_id = ?'; params.push(supplier_id); }
  spQuery += ' ORDER BY price_pln ASC';

  const allOffers = db.prepare(spQuery).all(...params);

  const eanAllOffers = {};
  for (const o of allOffers) {
    const key = normalizeEan(o.ean);
    if (!key) continue;
    if (subEans.has(key)) continue;
    if (!o.price_pln || o.price_pln <= 0) continue;
    // NOTE: manufacturer filter is applied AFTER cross-referencing (see below),
    // so we collect all EANs here regardless of per-supplier manufacturer field.
    if (!eanAllOffers[key]) eanAllOffers[key] = [];
    eanAllOffers[key].push(o);
  }

  const eanMap = {};
  for (const [ean, offers] of Object.entries(eanAllOffers)) {
    let filtered = availability ? offers.filter(o => o.availability === availability) : offers;
    if (!filtered.length) continue;
    const best = filtered.reduce((a,b) => a.price_pln < b.price_pln ? a : b);
    // Pick the cleanest longest name, including the fallback from globalNameMap
    let validNames = offers.map(o => {
      let n = o.sp_name || '';
      return n.replace(/&nbsp;/gi, ' ')
              .replace(/&amp;deg;/gi, '°')
              .replace(/&deg;/gi, '°')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();
    }).filter(n => n.length > 0 && !/^[.\-/?!_]+$/.test(n));
    
    if (globalNameMap[ean] && globalNameMap[ean].name) {
       let gn = globalNameMap[ean].name;
       gn = gn.replace(/&nbsp;/gi, ' ')
              .replace(/&amp;deg;/gi, '°')
              .replace(/&deg;/gi, '°')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();
       if (!/^[.\-/?!_]+$/.test(gn)) {
         validNames.push(gn);
       }
    }
    if (catalogCodeMap[ean] && catalogCodeMap[ean].name) {
       let cn = catalogCodeMap[ean].name;
       cn = cn.replace(/&nbsp;/gi, ' ')
              .replace(/&amp;deg;/gi, '°')
              .replace(/&deg;/gi, '°')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();
       if (cn && !/^[.\-/?!_]+$/.test(cn)) {
         validNames.push(cn);
       }
    }
    // De-duplicate names just in case
    validNames = [...new Set(validNames)];
    
    let name = '';
    if (validNames.length > 0) {
      let cleanNames = validNames.filter(n => !n.includes('\n') && !n.includes('\r') && n.length <= 150);
      if (cleanNames.length > 0) name = cleanNames.reduce((a, b) => a.length > b.length ? a : b);
      else {
        let noNewline = validNames.filter(n => !n.includes('\n') && !n.includes('\r'));
        if (noNewline.length > 0) name = noNewline.reduce((a, b) => a.length > b.length ? a : b);
        else {
          let longest = validNames.reduce((a, b) => a.length > b.length ? a : b);
          name = longest.split(/[\r\n]+/)[0].trim();
        }
      }
    }
    
    let mfg = normalizeManufacturer(offers.map(o => o.manufacturer || '').find(m => m.length > 0) || '');
    let mfgCode = offers.map(o => o.manufacturer_code || '').find(m => m.length > 0) || '';
    // Cross-reference from global lookup if manufacturer/code is still empty
    if (!mfg && globalNameMap[ean]) {
      mfg = globalNameMap[ean].manufacturer;
    }
    if (!mfgCode && globalNameMap[ean] && globalNameMap[ean].manufacturer_code) {
      mfgCode = globalNameMap[ean].manufacturer_code;
    }
    // Fallback to catalog_master for manufacturer_code
    if (!mfgCode && catalogCodeMap[ean]) {
      mfgCode = catalogCodeMap[ean].manufacturer_code;
    }
    if (!mfg && catalogCodeMap[ean] && catalogCodeMap[ean].manufacturer) {
      mfg = catalogCodeMap[ean].manufacturer;
    }

    // Auto-swap name and manufacturer if Elko (or others) inverted them
    if (name && mfg && !isValidManufacturer(mfg) && isValidManufacturer(name)) {
      if (name.length <= 25 && mfg.length > name.length) {
        let temp = name;
        name = mfg;
        mfg = temp;
        // If the new name is literally a part number, also copy it to manufacturer_code
        if (!mfgCode && /^[A-Z0-9-]{6,}$/i.test(name) && !/\s/.test(name)) {
           mfgCode = name;
        }
      }
    }

    // Validate manufacturer — filter out model names / product codes
    if (mfg && !isValidManufacturer(mfg)) {
      mfg = '';
    }

    // Normalize manufacturer casing (prevent all-caps for regular words like UNITEK to unify filters)
    if (mfg && mfg === mfg.toUpperCase() && mfg.length > 3) {
      const ALWAYS_UPPER = new Set(['AMD', 'MSI', 'ASUS', 'ACER', 'DELL', 'AOC', 'JBL', 'NZXT', 'EVGA', 'ZOTAC', 'A4TECH', 'PNY', 'XFX', 'APC', 'HTC', 'TCL', 'BOSCH', 'SONY', 'LG']);
      if (!ALWAYS_UPPER.has(mfg)) {
        mfg = mfg.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }

    eanMap[ean] = {
      ean, name,
      manufacturer: mfg,
      manufacturer_code: mfgCode,
      best_price: best.price_pln,
      best_supplier: best.supplier_name, best_supplier_id: best.supplier_id,
      availability: best.availability, stock_quantity: best.stock_quantity ?? null,
      condition: best.sp_condition || 'new', warranty: best.sp_warranty || null,
    };
  }

  let rows = Object.values(eanMap);
  
  // Apply manufacturer filter AFTER cross-referencing so products from suppliers
  // without manufacturer field get matched via globalNameMap / catalogCodeMap.
  if (manufacturer) {
    const mfgQ = manufacturer.toLowerCase();
    rows = rows.filter(r => (r.manufacturer || '').toLowerCase().includes(mfgQ));
  }
  
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(r => r.ean.includes(q) || r.name.toLowerCase().includes(q));
  }

  rows.sort((a,b) => (a.name||'').localeCompare(b.name||''));
  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  return { rows: page, total, limit, offset };
}

// ════════ LISTING / MARKETPLACE IMPORT ══════════════════════════════════════

/**
 * Normalize a column header to a consistent lowercase key.
 * Handles Polish characters, spaces, underscores, dashes.
 */
function normalizeHeader(h) {
  if (!h) return '';
  return String(h)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[\s_\-\.]+/g, '_')
    .trim();
}

/**
 * Import marketplace listings from buffer.
 * Detects columns:
 *   ean          — 'ean', 'barcode', 'kod_ean', 'gtin', etc.
 *   platform     — 'zrodlo_nazwa', 'source_name', 'platforma', 'marketplace', etc.
 *   title        — 'tytul', 'nazwa', 'title', 'name', etc.
 * Replaces all existing data in listing_platforms.
 */
function importListings(buffer, fileName = '') {
  const db = getDb();
  let rows = [];

  const isExcel = /\.(xlsx|xls)$/i.test(fileName);
  const isCsv   = /\.csv$/i.test(fileName);

  if (isExcel) {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  } else {
    // CSV
    const parsed = parseCsvBuffer(buffer);
    if (!parsed || !parsed.columns.length) throw new Error('Nie mozna sparsowac pliku CSV');
    const { columns, separator } = parsed;
    let str;
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) str = buffer.slice(3).toString('utf-8');
    else str = buffer.toString('utf-8');
    const lines = str.split(/\r?\n/).filter(l => l.trim());
    const sep   = separator === 'tab' ? '\t' : separator;
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(sep);
      const obj  = {};
      columns.forEach((c, ci) => { obj[c] = (vals[ci] || '').trim(); });
      rows.push(obj);
    }
  }

  if (!rows.length) throw new Error('Plik jest pusty lub nie mozna go odczytac');

  // Detect column mapping
  const sampleKeys = Object.keys(rows[0]).map(normalizeHeader);
  const rawKeys    = Object.keys(rows[0]);

  function findCol(aliases) {
    for (const alias of aliases) {
      const ni = sampleKeys.findIndex(k => k === alias || k.includes(alias));
      if (ni >= 0) return rawKeys[ni];
    }
    return null;
  }

  const eanCol      = findCol(['ean','barcode','kod_ean','gtin','upc','isbn','ean13','kodkreskowy','kod_kreskowy']);
  const platformCol = findCol(['zrodlo_nazwa','source_name','zrodlo','platforma','marketplace','platform','kanal','channel','sklep','store']);
  const titleCol    = findCol(['tytul','nazwa','title','name','product_name','nazwa_produktu']);

  if (!eanCol)      throw new Error(`Nie znaleziono kolumny EAN. Dostepne: ${rawKeys.join(', ')}`);
  if (!platformCol) throw new Error(`Nie znaleziono kolumny platformy (np. "zrodlo nazwa"). Dostepne: ${rawKeys.join(', ')}`);

  // Import
  const insertStmt = db.prepare('INSERT INTO listing_platforms (platform, ean, title) VALUES (?, ?, ?)');
  const cleanEan = v => String(v || '').replace(/[^0-9]/g, '').padStart(13, '0').slice(-13);

  let count = 0;
  db.transaction(() => {
    db.exec('DELETE FROM listing_platforms');
    for (const row of rows) {
      const ean      = cleanEan(row[eanCol]);
      const platform = String(row[platformCol] || '').trim();
      const title    = titleCol ? String(row[titleCol] || '').trim() : '';
      if (!ean || ean === '0000000000000') continue;
      if (!platform) continue;
      insertStmt.run(platform, ean, title);
      count++;
    }
    db.prepare('INSERT OR REPLACE INTO listing_meta (id, last_import, row_count) VALUES (1, datetime(\'now\'), ?)').run(count);
  })();

  const platforms = db.prepare("SELECT DISTINCT platform FROM listing_platforms ORDER BY platform").all().map(r => r.platform);
  return { imported: count, platforms };
}

function getListingStatus() {
  const db = getDb();
  const meta = db.prepare('SELECT * FROM listing_meta WHERE id=1').get() || {};
  const platforms = db.prepare('SELECT DISTINCT platform FROM listing_platforms ORDER BY platform').all().map(r => r.platform);
  return { last_import: meta.last_import || null, row_count: meta.row_count || 0, platforms };
}

function getListingPlatforms() {
  return getDb().prepare('SELECT DISTINCT platform FROM listing_platforms ORDER BY platform').all().map(r => r.platform);
}

/**
 * Coverage per platform: how many EANs from subiekt_products are listed.
 * Coverage is calculated ONLY for products that are currently in stock (stock > 0).
 */
function getListingCoverage() {
  const db = getDb();
  const total = db.prepare("SELECT COUNT(*) as n FROM subiekt_products WHERE ean IS NOT NULL AND ean != '' AND stock > 0").get()?.n || 0;
  const platforms = getListingPlatforms();
  return platforms.map(p => {
    const listed = db.prepare(
      'SELECT COUNT(DISTINCT lp.ean) as n FROM listing_platforms lp INNER JOIN subiekt_products sp ON sp.ean = lp.ean WHERE lp.platform = ? AND sp.stock > 0'
    ).get(p)?.n || 0;
    return { platform: p, listed, total, pct: total > 0 ? Math.round(listed / total * 100) : 0 };
  });
}

/**
 * Products from subiekt that are NOT listed on the given platform.
 * Also includes a column "missing_on" listing all platforms where not listed.
 */
function getListingGaps({ missing_on = '', present_on = '', search = '', limit = 500, offset = 0, sort = '', asc = true, in_stock = false } = {}) {
  const db = getDb();
  const platforms = getListingPlatforms();

  let where = [];
  let params = [];

  // Filter only products with positive stock if in_stock is true (default is false from API perspective, but frontend will default to true)
  if (in_stock && String(in_stock) === 'true') {
    where.push("sp.stock > 0");
  }

  if (missing_on) {
    const missingArr = missing_on.split(',').map(s => s.trim()).filter(Boolean);
    for (const p of missingArr) {
      where.push("sp.ean NOT IN (SELECT ean FROM listing_platforms WHERE platform = ?)" );
      params.push(p);
    }
  }
  if (present_on) {
    const presentArr = present_on.split(',').map(s => s.trim()).filter(Boolean);
    for (const p of presentArr) {
      where.push("sp.ean IN (SELECT ean FROM listing_platforms WHERE platform = ?)" );
      params.push(p);
    }
  }

  if (search) {
    where.push("(sp.ean LIKE ? OR sp.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const SAFE_COLS = { ean:'sp.ean', name:'sp.name', stock:'sp.stock', sold_30d:'sp.sold_30d', buy_price:'sp.buy_price', buy_price_gross:'COALESCE(sp.buy_price_gross, sp.buy_price*1.23)', sell_price:'sp.sell_price', manufacturer:'manufacturer' };
  const orderBy = SAFE_COLS[sort] ? `${SAFE_COLS[sort]} ${asc ? 'ASC' : 'DESC'}` : 'sp.sold_30d DESC, sp.stock DESC';

  const countRow = db.prepare(`SELECT COUNT(*) as n FROM subiekt_products sp ${whereClause}`).get(...params);
  const total = countRow?.n || 0;

  const rows = db.prepare(`
    SELECT sp.ean, sp.name, sp.stock, sp.buy_price,
           COALESCE(sp.buy_price_gross, ROUND(sp.buy_price * 1.23, 2)) as buy_price_gross,
           sp.sell_price,
           ROUND(sp.sell_price * 1.23, 2) as sell_price_gross,
           sp.sold_12m, sp.sold_30d,
           (SELECT manufacturer FROM supplier_products WHERE ean = sp.ean AND manufacturer IS NOT NULL AND manufacturer != '' LIMIT 1) as manufacturer
    FROM subiekt_products sp
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // For each row, compute which platforms it's missing on
  const result = rows.map(r => {
    const presentOn = db.prepare('SELECT DISTINCT platform FROM listing_platforms WHERE ean = ?').all(r.ean).map(x => x.platform);
    const missingOn = platforms.filter(p => !presentOn.includes(p));
    return { ...r, present_on: presentOn, missing_on: missingOn };
  });

  return { rows: result, total, limit, offset, platforms };
}

function clearListings() {
  const db = getDb();
  db.exec('DELETE FROM listing_platforms');
  try { db.prepare("UPDATE listing_meta SET row_count=0 WHERE id=1").run(); } catch {}
  return { ok: true };
}


// ═══ RESTOCK ══════════════════════════════════════════════════════════════════

function saveRestockOverride(ean, qty) {
  getDb().prepare(`
    INSERT INTO restock_overrides (ean, qty, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(ean) DO UPDATE SET qty=excluded.qty, updated_at=excluded.updated_at
  `).run(ean, qty);
}

function buildRestockList({ supplierId = null, search = '', days = 30, onlyNeeded = false, availability = '', manufacturer = '' } = {}) {
  const db = getDb();

  const overrides = {};
  db.prepare('SELECT ean, qty FROM restock_overrides').all().forEach(r => { overrides[r.ean] = r.qty; });

  // Global manufacturer lookup — cross-reference from ALL suppliers
  const globalMfgMap = {};
  db.prepare(
    "SELECT ean, manufacturer FROM supplier_products WHERE manufacturer IS NOT NULL AND manufacturer != '' GROUP BY ean ORDER BY LENGTH(manufacturer) DESC"
  ).all().forEach(r => { if (!globalMfgMap[r.ean]) globalMfgMap[r.ean] = r.manufacturer; });

  let subQuery = 'SELECT * FROM subiekt_products WHERE 1=1';
  const params = [];
  if (search) { subQuery += ' AND (name LIKE ? OR ean LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  const subs = db.prepare(subQuery).all(...params);

  const allOffers = db.prepare(`
    SELECT sp.ean, COALESCE(sp.price_pln, sp.price) as price_pln, sp.price,
           sp.availability, sp.manufacturer,
           sp.condition as sp_condition, sp.warranty as sp_warranty,
           s.id as supplier_id, s.name as supplier_name
    FROM supplier_products sp
    JOIN suppliers s ON s.id = sp.supplier_id
    WHERE COALESCE(s.is_active, 1) = 1
    ORDER BY price_pln ASC
    LIMIT 50000
  `).all();

  const offerMap = {};
  for (const o of allOffers) {
    if (!offerMap[o.ean]) offerMap[o.ean] = [];
    offerMap[o.ean].push(o);
  }

  const rows = [];
  for (const sub of subs) {
    const base30d = overrides[sub.ean] !== undefined ? overrides[sub.ean] : (sub.sold_30d || 0);
    if (base30d <= 0 && overrides[sub.ean] === undefined) continue;

    const needed_qty = Math.ceil((base30d / 30) * days);
    const suggested_qty = Math.max(0, needed_qty - (sub.stock || 0));

    if (onlyNeeded && suggested_qty <= 0) continue;


    let offers = offerMap[sub.ean] || [];

    // Availability filter — filter offers by availability
    if (availability) offers = offers.filter(o => o.availability === availability);

    const avail  = offers.filter(o => o.availability === 'available');
    const best   = avail.length
      ? avail.reduce((a,b) => a.price_pln < b.price_pln ? a : b)
      : (offers.length ? offers.reduce((a,b) => a.price_pln < b.price_pln ? a : b) : null);

    if (supplierId && (!best || best.supplier_id !== parseInt(supplierId))) continue;

    const effectiveMfg = best ? (best.manufacturer || globalMfgMap[sub.ean] || '') : (globalMfgMap[sub.ean] || '');
    if (manufacturer && !effectiveMfg.toLowerCase().includes(manufacturer.toLowerCase())) continue;

    rows.push({
      ean: sub.ean, name: sub.name,
      stock: sub.stock, sold_30d: sub.sold_30d,
      qty_override: overrides[sub.ean] !== undefined ? overrides[sub.ean] : null,
      base30d, needed_qty, suggested_qty,
      buy_price: sub.buy_price,
      best_price: best ? best.price_pln : null,
      best_supplier: best ? best.supplier_name : null,
      best_supplier_id: best ? best.supplier_id : null,
      availability: best ? best.availability : 'none',
      manufacturer: effectiveMfg,
      condition: best ? (best.sp_condition || 'new') : 'new',
      warranty: best ? (best.sp_warranty || null) : null,
    });
  }

  rows.sort((a,b) => {
    const sa = a.best_supplier || 'zzz', sb = b.best_supplier || 'zzz';
    const cmp = sa.localeCompare(sb);
    if (cmp !== 0) return cmp;
    if (b.suggested_qty !== a.suggested_qty) return b.suggested_qty - a.suggested_qty;
    return (a.name||'').localeCompare(b.name||'');
  });

  const groups = [];
  let cur = null;
  for (const r of rows) {
    const key = r.best_supplier || '— Brak oferty';
    if (!cur || cur.supplier !== key) { cur = { supplier: key, supplier_id: r.best_supplier_id, rows: [] }; groups.push(cur); }
    cur.rows.push(r);
  }

  return { groups, total: rows.length };
}

// ═══ MANUFACTURER NORMALIZATION & ALIASES ═══════════════════════════════════

/**
 * Built-in manufacturer alias map.
 * Key: lowercase alias → Value: canonical name.
 */
const BUILT_IN_MFG_ALIASES = {
  'ubiquiti': 'Ubiquiti Networks', 'ubiquiti inc': 'Ubiquiti Networks', 'ubiquiti inc.': 'Ubiquiti Networks', 'ui.com': 'Ubiquiti Networks',
  'hewlett-packard': 'HP', 'hewlett packard': 'HP', 'hp inc': 'HP', 'hp inc.': 'HP',
  'hp enterprise': 'HPE', 'hewlett packard enterprise': 'HPE',
  'lenovo group': 'Lenovo', 'lenovo (singapore)': 'Lenovo',
  'lg electronics': 'LG', 'lg display': 'LG',
  'samsung electronics': 'Samsung', 'samsung elec': 'Samsung',
  'seagate technology': 'Seagate', 'seagate tech': 'Seagate',
  'sony interactive': 'Sony', 'sony computer': 'Sony',
  'western digital': 'WD', 'western digital corporation': 'WD', 'wd': 'WD',
  'dell technologies': 'Dell', 'dell inc': 'Dell', 'dell inc.': 'Dell',
  'd-link': 'D-Link', 'dlink': 'D-Link',
  'micro-star international': 'MSI', 'micro star': 'MSI',
  'microsoft corporation': 'Microsoft', 'microsoft corp': 'Microsoft', 'microsoft corp.': 'Microsoft',
  'asustek': 'ASUS', 'asustek computer': 'ASUS', 'asus computer': 'ASUS', 'asustek computer inc': 'ASUS',
  'acer inc': 'Acer', 'acer inc.': 'Acer',
  'apple inc': 'Apple', 'apple inc.': 'Apple',
  'a4 tech': 'A4Tech', 'a4-tech': 'A4Tech',
  'tp-link technologies': 'TP-Link', 'tp link': 'TP-Link', 'tplink': 'TP-Link',
  'kingston technology': 'Kingston', 'kingston tech': 'Kingston',
  'corsair components': 'Corsair', 'corsair memory': 'Corsair',
  'creative labs': 'Creative', 'creative technology': 'Creative',
  'intel corporation': 'Intel', 'intel corp': 'Intel', 'intel corp.': 'Intel',
  'nvidia corporation': 'NVIDIA', 'nvidia corp': 'NVIDIA', 'nvidia': 'NVIDIA',
  'g.skill international': 'G.Skill', 'g.skill': 'G.Skill', 'gskill': 'G.Skill',
  'gigabyte technology': 'Gigabyte', 'giga-byte': 'Gigabyte',
  'logitech international': 'Logitech', 'logitech inc': 'Logitech', 'logitech inc.': 'Logitech',
  'razer inc': 'Razer', 'razer inc.': 'Razer', 'razer usa': 'Razer',
  'brother industries': 'Brother', 'brother international': 'Brother',
  'epson europe': 'Epson', 'seiko epson': 'Epson',
  'panasonic corporation': 'Panasonic', 'panasonic corp': 'Panasonic',
  'xerox corporation': 'Xerox', 'xerox corp': 'Xerox',
  'zotac international': 'Zotac', 'zotac technology': 'Zotac',
  'verbatim corporation': 'Verbatim', 'verbatim corp': 'Verbatim',
  'be quiet': 'be quiet!', 'bequiet': 'be quiet!',
  'coolermaster': 'Cooler Master',
  'crucial technology': 'Crucial', 'crucial/micron': 'Crucial',
  'amd inc': 'AMD', 'advanced micro devices': 'AMD',
  'thermaltake technology': 'Thermaltake', 'thermaltake inc': 'Thermaltake',
  'silverstone technology': 'SilverStone', 'silverstone tech': 'SilverStone',
  'noctua cooling': 'Noctua',
  'sapphire technology': 'Sapphire', 'sapphire tech': 'Sapphire',
  'patriot memory': 'Patriot',
  'silicon power computer': 'Silicon Power',
  'transcend information': 'Transcend', 'transcend info': 'Transcend',
  'netgear inc': 'Netgear', 'netgear inc.': 'Netgear',
  'zyxel communications': 'Zyxel', 'zyxel networks': 'Zyxel',
  'mikrotikls': 'MikroTik',
  'qnap systems': 'QNAP', 'qnap inc': 'QNAP',
  'synology inc': 'Synology', 'synology inc.': 'Synology',
};

let _mfgAliasCache = null;

function _buildMfgAliasMap() {
  const map = new Map();
  for (const [alias, canonical] of Object.entries(BUILT_IN_MFG_ALIASES)) {
    map.set(alias.toLowerCase(), canonical);
  }
  try {
    const db = getDb();
    const dbAliases = db.prepare('SELECT alias, canonical_name FROM manufacturer_aliases').all();
    for (const row of dbAliases) {
      map.set(row.alias.toLowerCase(), row.canonical_name);
    }
  } catch(_) {}
  return map;
}

function getMfgAliasMap() {
  if (!_mfgAliasCache) _mfgAliasCache = _buildMfgAliasMap();
  return _mfgAliasCache;
}

function invalidateMfgAliasCache() { _mfgAliasCache = null; }

let _attrAliasCache = null;

function _buildAttrAliasMap() {
  const map = new Map();
  try {
    const db = getDb();
    const dbAliases = db.prepare('SELECT alias, canonical_name FROM attr_aliases').all();
    for (const row of dbAliases) {
      map.set(row.alias.toLowerCase(), row.canonical_name);
    }
  } catch(_) {}
  return map;
}

function getAttrAliasMap() {
  if (!_attrAliasCache) _attrAliasCache = _buildAttrAliasMap();
  return _attrAliasCache;
}

function invalidateAttrAliasCache() { _attrAliasCache = null; }

function normalizeManufacturer(name) {
  if (!name || typeof name !== 'string') return name || '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  const map = getMfgAliasMap();
  return map.get(trimmed.toLowerCase()) || trimmed;
}

// ═══ MANUFACTURER ALIAS CRUD ════════════════════════════════════════════════

function listMfgAliases() {
  try { return getDb().prepare('SELECT * FROM manufacturer_aliases ORDER BY canonical_name, alias').all(); }
  catch(_) { return []; }
}

function addMfgAlias(alias, canonical_name) {
  if (!alias || !canonical_name) throw new Error('Alias i nazwa kanoniczna są wymagane');
  getDb().prepare('INSERT OR REPLACE INTO manufacturer_aliases (alias, canonical_name) VALUES (?, ?)').run(alias.trim(), canonical_name.trim());
  invalidateMfgAliasCache();
  return { ok: true };
}

function deleteMfgAlias(id) {
  getDb().prepare('DELETE FROM manufacturer_aliases WHERE id = ?').run(id);
  invalidateMfgAliasCache();
  return { ok: true };
}

function mergeManufacturers(aliases, canonical_name) {
  if (!aliases || !Array.isArray(aliases) || aliases.length === 0 || !canonical_name) {
    throw new Error('Tablica aliasów i nazwa kanoniczna są wymagane');
  }
  
  const db = getDb();
  
  const insertAlias = db.prepare('INSERT OR REPLACE INTO manufacturer_aliases (alias, canonical_name) VALUES (?, ?)');
  const updateSp = db.prepare('UPDATE supplier_products SET manufacturer = ? WHERE manufacturer COLLATE NOCASE = ?');
  const updateCm = db.prepare('UPDATE catalog_master SET manufacturer = ? WHERE manufacturer COLLATE NOCASE = ?');
  
  let productsUpdated = 0;
  let catalogUpdated = 0;
  
  db.transaction(() => {
    for (const alias of aliases) {
      const trimmedAlias = String(alias).trim();
      const trimmedCanon = String(canonical_name).trim();
      if (!trimmedAlias) continue;
      
      // Save to aliases table so future imports are auto-corrected
      if (trimmedAlias.toLowerCase() !== trimmedCanon.toLowerCase()) {
        insertAlias.run(trimmedAlias, trimmedCanon);
      }
      
      // Retroactively update existing data
      const spRes = updateSp.run(trimmedCanon, trimmedAlias);
      productsUpdated += spRes.changes;
      
      const cmRes = updateCm.run(trimmedCanon, trimmedAlias);
      catalogUpdated += cmRes.changes;
    }
  })();
  
  invalidateMfgAliasCache();
  invalidateAttrAliasCache();
  return { ok: true, productsUpdated, catalogUpdated };
}

function getAttrManagerDetails(attrName, supplierId = null, onlyAvailable = false) {
  const db = getDb();
  
  // Helper to run supplier products query
  function querySupplierProducts(targetSupplierId, forceAllAvailability = false) {
    const aliasRows = db.prepare('SELECT alias FROM attr_aliases WHERE canonical_name = ?').all(attrName);
    const keysToCheck = [attrName, ...aliasRows.map(r => r.alias)];
    const useAvailability = onlyAvailable && !forceAllAvailability;

    let list = [];
    let valuesMapLocal = new Map();
    const seenProductKeys = new Set();

    // 1. Try querying supplier_product_attrs table first (extremely fast and complete)
    const spaTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_product_attrs'").get();
    if (spaTableExists) {
      const placeHolders = keysToCheck.map(() => '?').join(', ');
      let spaWhere = `spa.attr_name IN (${placeHolders})`;
      let spaParams = [...keysToCheck];

      if (targetSupplierId) {
        spaWhere = `spa.supplier_id = ? AND ` + spaWhere;
        spaParams.unshift(targetSupplierId);
      }
      if (useAvailability) {
        spaWhere += " AND sp.availability = 'available'";
      }

      const spaRows = db.prepare(`
        SELECT sp.id, sp.ean as canonical_ean, sp.name, sp.category as category_name, spa.attr_value as value_text, s.name as supplier_name
        FROM supplier_product_attrs spa
        JOIN supplier_products sp ON sp.ean = spa.ean AND sp.supplier_id = spa.supplier_id
        LEFT JOIN suppliers s ON s.id = sp.supplier_id
        WHERE ${spaWhere}
        LIMIT 1000
      `).all(...spaParams);

      for (const r of spaRows) {
        const matchedVal = r.value_text ? r.value_text.trim() : null;
        if (matchedVal) {
          valuesMapLocal.set(matchedVal, (valuesMapLocal.get(matchedVal) || 0) + 1);
          const pKey = `${r.id}_${r.canonical_ean}`;
          if (!seenProductKeys.has(pKey) && list.length < 50) {
            seenProductKeys.add(pKey);
            const displaySupplier = r.supplier_name ? r.supplier_name.toLowerCase() : 'dostawca';
            list.push({
              id: r.id,
              canonical_ean: r.canonical_ean,
              name: `${r.name} [${displaySupplier}]`,
              category_name: r.category_name,
              value_text: matchedVal,
              attr_unit: ''
            });
          }
        }
      }
    }

    // 2. Fallback to sp.attributes JSON string check if list is still empty (e.g., table missing or didn't match)
    if (list.length === 0) {
      const likeClauses = keysToCheck.map(k => `sp.attributes LIKE ?`).join(' OR ');
      const likeParams = keysToCheck.map(k => `%"${k}"%`);

      let where = `sp.attributes IS NOT NULL AND sp.attributes != '{}' AND (${likeClauses})`;
      let params = [...likeParams];

      if (targetSupplierId) {
        where = `sp.supplier_id = ? AND ` + where;
        params.unshift(targetSupplierId);
      }
      if (useAvailability) {
        where += " AND sp.availability = 'available'";
      }

      const rows = db.prepare(`
        SELECT sp.id, sp.ean as canonical_ean, sp.name, sp.category as category_name, sp.attributes, s.name as supplier_name
        FROM supplier_products sp
        LEFT JOIN suppliers s ON s.id = sp.supplier_id
        WHERE ${where}
        LIMIT 1000
      `).all(...params);

      for (const r of rows) {
        try {
          const obj = (typeof r.attributes === 'string') ? JSON.parse(r.attributes) : r.attributes;
          let matchedVal = null;
          for (const k of keysToCheck) {
            const actualKey = Object.keys(obj).find(ok => ok.trim().toLowerCase() === k.toLowerCase());
            if (actualKey && obj[actualKey]) {
              matchedVal = String(obj[actualKey]).trim();
              break;
            }
          }
          if (matchedVal) {
            valuesMapLocal.set(matchedVal, (valuesMapLocal.get(matchedVal) || 0) + 1);
            const pKey = `${r.id}_${r.canonical_ean}`;
            if (!seenProductKeys.has(pKey) && list.length < 50) {
              seenProductKeys.add(pKey);
              const displaySupplier = r.supplier_name ? r.supplier_name.toLowerCase() : 'dostawca';
              list.push({
                id: r.id,
                canonical_ean: r.canonical_ean,
                name: `${r.name} [${displaySupplier}]`,
                category_name: r.category_name,
                value_text: matchedVal,
                attr_unit: ''
              });
            }
          }
        } catch (e) {}
      }
    }

    return { list, valuesMap: valuesMapLocal };
  }

  // 1. Fetch global context from catalog_master
  let valuesMap = new Map();
  const globalValues = db.prepare(`
    SELECT pa.value_text as value, COUNT(pa.catalog_id) as count
    FROM product_attributes pa
    JOIN category_attributes ca ON pa.attribute_id = ca.id
    WHERE ca.attr_name = ? AND pa.value_text IS NOT NULL AND pa.value_text != ''
    GROUP BY pa.value_text
    ORDER BY count DESC
    LIMIT 100
  `).all(attrName);
  
  for (const v of globalValues) {
    valuesMap.set(v.value, v.count);
  }

  const globalProducts = db.prepare(`
    SELECT cm.id, cm.canonical_ean, cm.name, pc.name as category_name, pa.value_text, ca.attr_unit
    FROM catalog_master cm
    JOIN product_attributes pa ON pa.catalog_id = cm.id
    JOIN category_attributes ca ON pa.attribute_id = ca.id
    LEFT JOIN product_categories pc ON pc.id = cm.category_id
    WHERE ca.attr_name = ?
    LIMIT 100
  `).all(attrName);

  let categories = db.prepare(`
    SELECT pc.name as category_name, pc.id as category_id, ca.attr_unit, COUNT(pa.catalog_id) as count
    FROM category_attributes ca
    JOIN product_categories pc ON pc.id = ca.category_id
    LEFT JOIN product_attributes pa ON pa.attribute_id = ca.id
    WHERE ca.attr_name = ?
    GROUP BY pc.name, pc.id, ca.attr_unit
  `).all(attrName);

  let products = [...globalProducts];
  let supProducts = [];

  // 2. Fetch supplier context (specific supplier if selected, or globally across all suppliers if no supplier is specified)
  const targetSupplierId = supplierId || null;
  const res = querySupplierProducts(targetSupplierId, false);
  supProducts = res.list;
  for (const [val, count] of res.valuesMap.entries()) {
    valuesMap.set(val, (valuesMap.get(val) || 0) + count);
  }

  // Fallback if query returned 0 due to availability filter
  if (supProducts.length === 0 && onlyAvailable) {
    const retryRes = querySupplierProducts(targetSupplierId, true);
    if (retryRes.list.length > 0) {
      supProducts = retryRes.list;
      for (const [val, count] of retryRes.valuesMap.entries()) {
        valuesMap.set(val, (valuesMap.get(val) || 0) + count);
      }
    }
  }

  // Deduplicate products by EAN to avoid showing the same product twice if it exists in both catalog_master and supplier_products
  const seenEans = new Set();
  const mergedProducts = [];

  // Add catalog master products first (they are mapped and preferred)
  for (const p of products) {
    if (p.canonical_ean) {
      seenEans.add(p.canonical_ean.trim().toLowerCase());
    }
    mergedProducts.push(p);
  }

  // Add supplier products if we haven't seen their EAN yet
  for (const p of supProducts) {
    const ean = p.canonical_ean ? p.canonical_ean.trim().toLowerCase() : null;
    if (ean && seenEans.has(ean)) {
      continue;
    }
    mergedProducts.push(p);
  }

  products = mergedProducts.slice(0, 100);

  // 3. Fallback for categories: If categories is empty, group products by supplier category!
  if (categories.length === 0 && products.length > 0) {
    const catMap = new Map();
    for (const p of products) {
      if (p.category_name) {
        catMap.set(p.category_name, (catMap.get(p.category_name) || 0) + 1);
      }
    }
    categories = Array.from(catMap.entries()).map(([catName, count]) => ({
      category_name: `${catName} [Dostawca]`,
      category_id: null,
      attr_unit: '',
      count
    })).sort((a, b) => b.count - a.count);
  }

  const values = Array.from(valuesMap.entries())
    .map(([val, count]) => ({ value: val, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);

  return { values, products, categories };
}

function getAttrManagerList(categoryId = null, supplierId = null, onlyAvailable = false) {
  const db = getDb();
  
  const availFilterSql = onlyAvailable ? ' AND sp.availability = "available"' : '';

  // supplier_products uses 'attributes' (JSON), catalog_master uses 'raw_attributes'
  const spCols = db.prepare("PRAGMA table_info(supplier_products)").all().map(c => c.name);
  const attrCol = spCols.includes('raw_attributes') ? 'raw_attributes'
                : spCols.includes('attributes')     ? 'attributes'
                : null;

  // ─── Step 2: Collect unique raw attribute keys from supplier_products ─────────
  const rawKeyMap = new Map(); // key → { count }

  // Comprehensive blacklist: internal supplier metadata, NOT real product parameters
  const _GAM_BL = new Set([
    // Basic product fields already stored in dedicated DB columns
    'id', 'name', 'nazwa', 'ean', 'ean_code', 'barcode', 'gtin', 'sku',
    'price', 'cena', 'cena_netto', 'cena_brutto', 'netto', 'brutto',
    'category', 'kategoria', 'grupa', 'group', 'komodita',
    'manufacturer', 'producent', 'brand', 'vendor', 'marka', 'hersteller',
    'stock', 'stan', 'qty', 'quantity', 'ilosc', 'dostepnosc', 'availability',
    'weight', 'waga', 'waga_brutto', 'waga_netto', 'masa',
    'description', 'opis', 'desc',
    'photo', 'image', 'zdjecie', 'photos', 'images',
    'url', 'link', 'product_url', 'currency', 'waluta', 'cur',
    'vat', 'tax', 'podatek', 'warranty', 'gwarancja', 'guarantee',
    'condition', 'stan_produktu', 'zustand',
    // Generic parser metadata
    'twrgid', 'twrcode', 'twrean', 'twrunit', 'weightg', 'categoryid',
    'eocode', 'idmax', 'pn', 'sizefee', 'cn', 'uom', 'shortdescription',
    'elkocode', 'vendorname', 'cncode', 'stockid1', 'kod_ean', 'podatek_vat',
    'promocja', 'cena_netto', 'reference', 'code', 'virtual',
    'grupa_towarowah', 'oferta_specjalna', 'deliverydate', 'artnr', 'herstnr', 'hersturl',
    // Wortmann internal columns
    'kod', 'enduser', 'dealer', 'status', 'vmagazynetext', 'warehouse',
    'index', 'indeks p.', 'cena brutto + marza', 'id produktu', 'kod produktu',
    'jest wiecej', 'jm', 'kod towaru', 'free transit',
    // Action internal shipping/ordering metadata
    'produkt gabarytowy', 'produkt z magazynu zewnętrznego', 'pod zamówienie',
    'nadgrupa drzewo', 'podgrupa drzewo',
    'czas wysyłki', 'czas wysyłki [h]', 'data spodziewanej dostawy',
    'ilość w spodziewanej dostawy', 'ilość w spodziewanej dostawie',
    // NTT internal columns
    'weightn', 'namepl', 'q_r', 'q_n', 'q_a', 'pricepln', 'priceexpeur',
    'pricesugpln', 'photo_1', 'photo_2', 'pcn', 'vol', 'descpl', 'descen',
    'descfr', 'desccz', 'descde', 'namefr', 'namecz', 'namede', 'inbox',
    'codecn', 'pdheight', 'pdwidth', 'pddepth', 'priceretaileuro', 'quan',
    // Elko internal
    'fulldsc',
    // Generic English internal
    'length', 'width', 'height', 'item', 'table',
    // Regulatory/compliance metadata (not useful as product attributes)
    'dane osoby odpowiedzialnej w ue', 'podmiot odpowiedzialny',
    'rozporządzenie data act',
    // Wortmann underscore-style export columns
    'zdjecie_glowne', 'jednostka_miary', 'ilosc_produktow', 'kod_ean_c',
    'kod_ean_mcm', 'kod_ean_b', 'kod_ean_d', 'kod_ean_e', 'cat_pl', 'cat_en',
    // Variant keys (colour/capacity variants stored as attrs)
    'wariant_kolor_ladowarki', 'wariant_kolor_etui', 'wariant_kolor_powerbanki',
    'wariant_pojemnosc_dysk', 'wariant_kolor_gaming', 'wariant_dlugosc_kolor',
    'wariant_ilosc_w_opakowaniu_sieci_bezprzewodowe', 'wariant_porty_poe',
    // Misc commercial
    'sgr code', 'reservedid1',
  ]);

  // Dynamic filter — also catches patterns not covered by exact list
  let attrSync = null;
  try { attrSync = require('./catalogAttrSync'); } catch (_) {}
  const _gamBL = (k) => {
    if (attrSync && attrSync.isJunkAttrName(k)) return true;
    if (_GAM_BL.has(k.toLowerCase())) return true;
    if (attrSync) {
      const resolved = attrSync.resolveKey(k, null);
      if (resolved && !attrSync.isJunkAttrName(resolved)) {
        const known = attrSync.PC_ATTR_ALIASES.some(([, canon]) => attrSync.fold(canon) === attrSync.fold(resolved));
        if (known) return false;
      }
    }
    if (/^\d+$/.test(k)) return true;              // purely numeric IDs like "13427"
    if (k.includes('?')) return true;              // corrupted encoding
    if (/^[BDEFGRW]\d{3}M$/.test(k)) return true; // warranty codes: F024M, G012M
    if (/^[A-Z][a-z]+[A-Z]{2,}$/.test(k)) return true; // camelCase: NamePL, WeightN
    if (/^[A-Za-z][A-Za-z0-9]+_[A-Za-z0-9_]+$/.test(k)) return true; // underscore_keys
    if (/^[a-z][a-z0-9_.()-]+$/.test(k) && k.length < 30 && !k.includes(' ')) return true;
    return false;
  };

  if (attrCol) {
    // Sample from EACH supplier — 5000 rows for comprehensive key discovery
    const supplierIds = supplierId
      ? [{ supplier_id: supplierId }]
      : db.prepare('SELECT DISTINCT supplier_id FROM supplier_products').all();

    const spaTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_product_attrs'").get();

    try {
      for (const { supplier_id: sid } of supplierIds) {
        // Skip sampling if we already have pre-extracted attributes for this supplier in supplier_product_attrs to avoid double counting
        if (spaTableExists) {
          const hasSpa = db.prepare('SELECT 1 FROM supplier_product_attrs WHERE supplier_id = ? LIMIT 1').get(sid);
          if (hasSpa) {
            continue;
          }
        }

        const spQuery = `SELECT sp.${attrCol}
          FROM supplier_products sp
          WHERE sp.${attrCol} IS NOT NULL AND sp.${attrCol} != '{}' AND sp.${attrCol} != ''
            AND sp.supplier_id = ?
          LIMIT 5000`;
        const spRows = db.prepare(spQuery).all(sid);
        for (const row of spRows) {
          try {
            const raw = row[attrCol];
            const obj = (typeof raw === 'string') ? JSON.parse(raw) : raw;
            for (const key of Object.keys(obj)) {
              const k = key.trim();
              if (!k || k === '-' || k.length < 2) continue;
                            if (_gamBL(k)) continue;
              if (!rawKeyMap.has(k)) rawKeyMap.set(k, { count: 0 });
              rawKeyMap.get(k).count++;
            }
          } catch(_) {}
        }
      }
    } catch(e) {
      // column access failed — skip raw data
    }
  }

  // Enrich from supplier_product_attrs (pre-extracted normalized attrs from extract_attrs.js)
  try {
    const spaExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_product_attrs'").get();
    if (spaExists) {
      const spaRows = supplierId
        ? db.prepare('SELECT attr_name, COUNT(*) as cnt FROM supplier_product_attrs WHERE supplier_id=? GROUP BY attr_name').all(supplierId)
        : db.prepare('SELECT attr_name, COUNT(*) as cnt FROM supplier_product_attrs GROUP BY attr_name').all();
      for (const row of spaRows) {
        if (_gamBL(row.attr_name)) continue;
        if (!rawKeyMap.has(row.attr_name)) rawKeyMap.set(row.attr_name, { count: 0 });
        rawKeyMap.get(row.attr_name).count += row.cnt;
      }
    }
  } catch(_) {}

  const hasRawData = rawKeyMap.size > 0;

  // ─── Step 3: Load alias table ────────────────────────────────────────────────
  const aliasRows = db.prepare('SELECT alias, canonical_name FROM attr_aliases').all();
  const aliasMap = new Map(); // alias_lower → canonical_name
  for (const r of aliasRows) aliasMap.set(r.alias.toLowerCase(), r.canonical_name);
  const canonicalAliases = new Map();
  for (const r of aliasRows) {
    if (!canonicalAliases.has(r.canonical_name)) canonicalAliases.set(r.canonical_name, []);
    canonicalAliases.get(r.canonical_name).push(r.alias);
  }

  // ─── Step 4: Load category_attributes ────────────────────────────────────────
  // When supplier is selected: only show category attrs that have actual product
  // data for that supplier (via catalog_master → supplier_ids check)
  let catAttrQuery = `
    SELECT ca.attr_name, ca.attr_unit, pc.name as category_name,
           COUNT(DISTINCT pa.catalog_id) as usage_count
    FROM category_attributes ca
    LEFT JOIN product_categories pc ON pc.id = ca.category_id
    LEFT JOIN product_attributes pa ON pa.attribute_id = ca.id
  `;
  const catParams = [];
  if (categoryId) {
    catAttrQuery += ' WHERE ca.category_id = ?';
    catParams.push(categoryId);
  }
  catAttrQuery += ' GROUP BY ca.attr_name, ca.attr_unit';

  const catAttrs = db.prepare(catAttrQuery).all(...catParams);
  const catAttrMap = new Map(); // canonical_name → { units, usage_count }
  for (const ca of catAttrs) {
    const existing = catAttrMap.get(ca.attr_name);
    if (!existing || ca.usage_count > (existing.usage_count || 0)) {
      catAttrMap.set(ca.attr_name, { units: ca.attr_unit, usage_count: ca.usage_count || 0 });
    }
  }

  // ─── Step 5: Build unified list ──────────────────────────────────────────────
  const resultMap = new Map(); // canonical_name → row

  if (hasRawData) {
    // Primary: raw attribute keys from this supplier's products
    for (const [rawKey, info] of rawKeyMap) {
      const keyLower = rawKey.toLowerCase();
      const canonical = aliasMap.get(keyLower) || rawKey;
      const isMapped = aliasMap.has(keyLower) || catAttrMap.has(rawKey);
      const catInfo = catAttrMap.get(canonical) || catAttrMap.get(rawKey) || {};
      const aliases = canonicalAliases.get(canonical) || [];

      if (!resultMap.has(canonical)) {
        resultMap.set(canonical, {
          canonical_name: canonical,
          aliases: aliases.join(',') || (rawKey !== canonical ? rawKey : null),
          usage_count: catInfo.usage_count || 0,
          raw_count: info.count,
          units: catInfo.units || null,
          is_mapped: isMapped,
        });
      } else {
        resultMap.get(canonical).raw_count += info.count;
      }
    }
  } else {
    // No raw data (supplier has no products yet OR no filter applied):
    // show category_attributes as the baseline — BUT only if no supplier filter
    // If supplier filter is active and no raw data → show empty (supplier unknown)
    if (!supplierId) {
      for (const [name, info] of catAttrMap) {
        const aliases = canonicalAliases.get(name) || [];
        resultMap.set(name, {
          canonical_name: name,
          aliases: aliases.join(',') || null,
          usage_count: info.usage_count || 0,
          raw_count: 0,
          units: info.units || null,
          is_mapped: true,
        });
      }
    }
    // If supplier is selected but has no products in DB → return empty lists
    // (the UI will show "Brak wyników" which is correct)
  }

  const all = [...resultMap.values()];
  const mapped   = all.filter(a =>  a.is_mapped);
  const unmapped = all.filter(a => !a.is_mapped).sort((a, b) => b.raw_count - a.raw_count);

  return { mapped, unmapped, total: all.length };
}




function updateCategoryAttrUnit(categoryId, attrName, unit) {
  const db = getDb();
  db.prepare('UPDATE category_attributes SET attr_unit = ? WHERE category_id = ? AND attr_name = ?').run(unit || null, categoryId, attrName);
  return { ok: true };
}

function mergeManagerAttributes(namesToMerge, targetCanonical) {
  if (!namesToMerge || !namesToMerge.length || !targetCanonical) throw new Error('Missing names to merge or target');
  const db = getDb();
  
  db.transaction(() => {
    const insertAlias = db.prepare('INSERT OR REPLACE INTO attr_aliases (alias, canonical_name) VALUES (?, ?)');
    for (const name of namesToMerge) {
      if (name.toLowerCase() !== targetCanonical.toLowerCase()) {
        insertAlias.run(name, targetCanonical);
      }
    }
    
    const updateCatAttr = db.prepare('UPDATE category_attributes SET attr_name = ? WHERE attr_name = ?');
    for (const name of namesToMerge) {
      if (name.toLowerCase() !== targetCanonical.toLowerCase()) {
        try {
          updateCatAttr.run(targetCanonical, name);
        } catch(e) {
          const oldAttrs = db.prepare('SELECT id, category_id FROM category_attributes WHERE attr_name = ?').all(name);
          for (const oa of oldAttrs) {
            const targetAttr = db.prepare('SELECT id FROM category_attributes WHERE attr_name = ? AND category_id = ?').get(targetCanonical, oa.category_id);
            if (targetAttr) {
              db.prepare('UPDATE OR IGNORE product_attributes SET attribute_id = ? WHERE attribute_id = ?').run(targetAttr.id, oa.id);
              db.prepare('DELETE FROM category_attributes WHERE id = ?').run(oa.id);
            } else {
              db.prepare('UPDATE category_attributes SET attr_name = ? WHERE id = ?').run(targetCanonical, oa.id);
            }
          }
        }
      }
    }
  })();
  invalidateAttrAliasCache();
  return { ok: true };
}


function getAttrManagerSuggestions() {
  const db = getDb();

  // 1. Fetch unique raw attributes from supplier_products
  const allKeysMap = new Map();
  const allRows = db.prepare("SELECT attributes FROM supplier_products WHERE attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").all();

  for (const r of allRows) {
    try {
      const obj = JSON.parse(r.attributes);
      Object.keys(obj).forEach(k => {
        const trimmed = k.trim();
        if (trimmed.length >= 2) {
          allKeysMap.set(trimmed, (allKeysMap.get(trimmed) || 0) + 1);
        }
      });
    } catch(_) {}
  }

  // 2. Fetch unique attributes from supplier_product_attrs if that table exists
  try {
    const spaExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_product_attrs'").get();
    if (spaExists) {
      const spaRows = db.prepare('SELECT attr_name, COUNT(*) as cnt FROM supplier_product_attrs GROUP BY attr_name').all();
      for (const row of spaRows) {
        const trimmed = row.attr_name.trim();
        if (trimmed.length >= 2) {
          allKeysMap.set(trimmed, (allKeysMap.get(trimmed) || 0) + (row.cnt || 1));
        }
      }
    }
  } catch(_) {}

  // 3. Fetch mapped attributes (aliases + category schemas) to filter out already mapped ones
  const catAttrs = db.prepare("SELECT DISTINCT attr_name FROM category_attributes").all().map(r => r.attr_name);
  const existingAliases = db.prepare("SELECT alias, canonical_name FROM attr_aliases").all();
  
  const aliasMap = new Map();
  for (const r of existingAliases) aliasMap.set(r.alias.toLowerCase(), r.canonical_name);

  const catAttrMap = new Map();
  for (const ca of catAttrs) catAttrMap.set(ca.toLowerCase(), ca);

  // 4. Find all unmapped keys
  const unmappedList = [];
  for (const [key, count] of allKeysMap) {
    const keyLower = key.toLowerCase();
    const isMapped = aliasMap.has(keyLower) || catAttrMap.has(keyLower);
    if (!isMapped) {
      unmappedList.push({ name: key, count });
    }
  }

  // 5. Define grouping logic
  const groupsDef = [
    {
      key: 'długość kabla',
      canonical: 'Długość kabla [m]',
      test: (nameLower) => {
        const isDlugosc = nameLower.includes('długość') || nameLower.includes('dlugosc') || nameLower.includes('dł.');
        const isKabel = nameLower.includes('kabel') || nameLower.includes('kabla') || nameLower.includes('przewód') || 
                        nameLower.includes('przewodu') || nameLower.includes('cable') || nameLower.includes('cord') ||
                        nameLower.includes('przewod');
        return isDlugosc && isKabel;
      }
    },
    {
      key: 'długość',
      canonical: 'Długość [mm]',
      test: (nameLower) => {
        const isDlugosc = nameLower.includes('długość') || nameLower.includes('dlugosc') || nameLower.includes('dł.');
        const isKabel = nameLower.includes('kabel') || nameLower.includes('kabla') || nameLower.includes('przewód') || 
                        nameLower.includes('przewodu') || nameLower.includes('cable') || nameLower.includes('cord') ||
                        nameLower.includes('przewod');
        return isDlugosc && !isKabel && (
          nameLower.includes('produkt') || nameLower.includes('gabaryt') || nameLower.includes('wymiar') ||
          nameLower.includes('skrzyn') || nameLower.includes('karton') || nameLower.includes('palet') ||
          nameLower.includes('opakowan') || nameLower.includes('obudow') || nameLower.includes('kart graf') ||
          nameLower === 'długość' || nameLower === 'dlugosc'
        );
      }
    },
    {
      key: 'szerokość',
      canonical: 'Szerokość [mm]',
      test: (nameLower) => {
        return nameLower.includes('szerokość') || nameLower.includes('szerokosc') || nameLower.includes('szer.');
      }
    },
    {
      key: 'wysokość',
      canonical: 'Wysokość [mm]',
      test: (nameLower) => {
        return nameLower.includes('wysokość') || nameLower.includes('wysokosc') || nameLower.includes('wys.');
      }
    },
    {
      key: 'głębokość',
      canonical: 'Głębokość [mm]',
      test: (nameLower) => {
        return nameLower.includes('głębokość') || nameLower.includes('glebokosc') || nameLower.includes('głęb.');
      }
    },
    {
      key: 'waga',
      canonical: 'Waga [g]',
      test: (nameLower) => {
        return (nameLower.includes('waga') || nameLower.includes('ciężar') || nameLower.includes('ciezar') || 
                nameLower.includes('weight') || /\bmasa\b/i.test(nameLower) || /\bmasy\b/i.test(nameLower)) && !nameLower.includes('długopis');
      }
    },
    {
      key: 'moc',
      canonical: 'Moc [W]',
      test: (nameLower) => {
        const isMoc = /\bmoc\b/i.test(nameLower) || /\bmocy\b/i.test(nameLower) || nameLower.includes('power') || nameLower.includes('watts');
        const notSpecial = !nameLower.includes('zródło') && !nameLower.includes('źródło') && 
                           !nameLower.includes('zasilania') && !nameLower.includes('ładowania') && 
                           !nameLower.includes('baterii') && !nameLower.includes('efektywności') &&
                           !nameLower.includes('częstotliwość') && !nameLower.includes('napięcie');
        return isMoc && notSpecial;
      }
    }
  ];

  const suggestions = groupsDef.map(g => ({
    key: g.key,
    canonical_name: g.canonical,
    candidates: []
  }));

  unmappedList.forEach(item => {
    const nameLower = item.name.toLowerCase();
    for (const group of suggestions) {
      const def = groupsDef.find(gd => gd.key === group.key);
      if (def.test(nameLower)) {
        group.candidates.push({
          name: item.name,
          usage_count: item.count
        });
        break;
      }
    }
  });

  return suggestions
    .map(g => {
      g.candidates.sort((a, b) => b.usage_count - a.usage_count);
      return g;
    })
    .filter(g => g.candidates.length > 0);
}


function suggestMfgAliases() {
  const db = getDb();
  const allMfgs = db.prepare(
    "SELECT DISTINCT manufacturer COLLATE NOCASE as manufacturer FROM supplier_products WHERE manufacturer IS NOT NULL AND manufacturer != '' ORDER BY manufacturer COLLATE NOCASE"
  ).all().map(r => r.manufacturer).filter(isValidManufacturer);

  const groups = {};
  for (const m of allMfgs) {
    const key = m.toLowerCase().replace(/[\s,\.]+/g, ' ').trim();
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }

  const keys = Object.keys(groups);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i], b = keys[j];
      if (a.startsWith(b) || b.startsWith(a)) {
        const target = a.length >= b.length ? a : b;
        const source = a.length >= b.length ? b : a;
        if (target !== source && groups[source]) {
          if (!groups[target]) groups[target] = [];
          groups[target].push(...groups[source]);
          delete groups[source];
        }
      }
    }
  }

  const suggestions = [];
  for (const [, names] of Object.entries(groups)) {
    const unique = [...new Set(names)];
    if (unique.length >= 2) {
      const canonical = unique.reduce((a, b) => a.length >= b.length ? a : b);
      suggestions.push({ canonical, aliases: unique.filter(n => n !== canonical) });
    }
  }
  return suggestions;
}

// Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬ MANUFACTURERS LIST Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬

/**
 * Shared manufacturer name validator — rejects SKU/EAN/product codes.
 * Used across all tabs to filter manufacturer dropdown options.
 */
function isValidManufacturer(m) {
  if (!m || m.length < 2) return false;
  const trimmed = m.trim();
  if (trimmed.length < 2) return false;
  // Pure numeric strings (EAN/SKU)
  if (/^\d+$/.test(trimmed)) return false;
  // Strings of only digits + dashes/dots/spaces (e.g. "12-345", "12.345", "1 07 1S 008")
  if (/^[\d\-\.\s]+$/.test(trimmed)) return false;
  // Product codes: 1-4 letters followed by 3+ digits (e.g. Z15147, AB-12345, ABCD1234)
  if (/^[A-Z]{1,4}[-_]?\d{3,}$/i.test(trimmed)) return false;
  // Codes starting with digits followed by letters/digits mix (e.g. 0288C002, 1102P23NL0, 100-100000065BOX)
  if (/^\d+[A-Z][-\w]*\d/i.test(trimmed)) return false;
  // Digit-starting alphanumeric codes (e.g. 10BAR, 2N2222) — but NOT short real names like "3M"
  if (/^\d+[A-Z]{1,4}$/i.test(trimmed) && trimmed.length >= 4) return false;
  // Codes starting with digits then having mixed content with dashes (100-100000065BOX)
  if (/^\d+[-]/.test(trimmed) && /\d/.test(trimmed.slice(trimmed.indexOf('-')))) return false;
  // Mixed alphanumeric where digits dominate — more than 40% of chars are digits → likely a code
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  const lettersOnly = trimmed.replace(/[^A-Za-z\u00C0-\u024F]/g, '');
  if (digitsOnly.length > 0 && lettersOnly.length > 0 && digitsOnly.length / trimmed.length > 0.4) return false;
  // EAN-like: strip non-digits, if 8-14 digits remain, it's a barcode
  if (digitsOnly.length >= 8 && digitsOnly.length <= 14 && digitsOnly.length / trimmed.length > 0.5) return false;
  // Strings with slashes, hashes, or backslashes (file paths, codes)
  if (/[\\/#]/.test(trimmed)) return false;
  // Strings that look like part numbers: uppercase letters + digits with no spaces (e.g. BX80684I59400F, LMSSIPL512G-BNANG)
  if (/^[A-Z0-9-]{6,}$/i.test(trimmed) && /\d/.test(trimmed) && /[A-Z]/i.test(trimmed) && !/\s/.test(trimmed)) return false;
  // Codes with pattern like "XXXX-NNNN" or "NNNN-XXXX" (where X=letter, N=digit)
  if (/^[A-Z]{1,5}\d{2,}/i.test(trimmed) && !/ /.test(trimmed)) return false;

  // === NEW RULES ===

  // Multi-hyphen product codes: 3+ hyphen-separated segments (e.g. A-HDMI-DVI-1, A-CM-DPF-02, A-DPM-HDMIFVGAF-01)
  const hyphenParts = trimmed.split('-');
  if (hyphenParts.length >= 3) return false;
  // Two-segment hyphen codes where any segment has digits mixed with uppercase (e.g. CM-H92FB-01, CM-M01R)
  if (hyphenParts.length === 2 && /[A-Z]/i.test(trimmed) && /\d/.test(trimmed) && trimmed.length <= 25) return false;

  // Multi-dot product codes: 3+ dot-separated segments with digits (e.g. G9P.EG0850.WE00.EU)
  const dotParts = trimmed.split('.');
  if (dotParts.length >= 3 && /\d/.test(trimmed)) return false;

  // Short all-uppercase codes without spaces: 4-6 uppercase letters only (e.g. COJBG, COKBC, CONBD)
  // Real manufacturers usually have longer names or mixed case or are well-known short names
  const KNOWN_SHORT_MFGS = new Set(['ASUS','ACER','DELL','DEXP','EPSON','SONY','BEKO','BOSCH','NZXT','EVGA','ZOTAC','ATEN','AXLE','BENQ','EKWB','FLIR','GEIL','HAMA','HORI','IBOX','KOSS','MOZA','NIBE','OMEN','ONYX','OPPO','POCO','RODE','ROLI','SVEN','VIVO','VOGEL','WACOM','WERA','WIKO','XBOX','XGIMI','VESA']);
  if (/^[A-Z]{4,6}$/.test(trimmed) && !KNOWN_SHORT_MFGS.has(trimmed)) return false;

  // Model/variant names starting with digits + space + color/description (e.g. "13 BLACK", "22 BLACK 256GB", "16S BLACK")
  if (/^\d+\w?\s+[A-Z]/i.test(trimmed) && /\b(BLACK|WHITE|BLUE|RED|GREEN|GOLD|SILVER|GREY|GRAY|ORANGE|PINK|PURPLE|BROWN|YELLOW|BEIGE|CREAM|FROST|UMBRA|ELITE|ULTRA|PRO)\b/i.test(trimmed)) return false;

  // Model names like "17PRO BLACK", "23ULTRA ELITEBLACK", "25T FROSTBLACK" — digits+letters then color
  if (/^\d+[A-Z]+\s/i.test(trimmed) && trimmed.length <= 30) return false;

  // Product variant descriptions: "COLOR N COLORNAME" pattern (e.g. "COLOR 6 BLACK", "COLOR 6 BLUE")
  if (/^COLOR\s+\d/i.test(trimmed)) return false;

  // Strings starting with digits + space (e.g. "13 BLACK 256GB") — likely model names, not manufacturers
  if (/^\d+\s/.test(trimmed) && trimmed.length <= 25) return false;

  // Single letter + hyphen + code pattern (A-HDMI, A-DVI, etc.) — even if only 2 segments
  if (/^[A-Z]-[A-Z]{2,}/i.test(trimmed) && trimmed.length <= 20 && !/\s/.test(trimmed)) return false;

  // Strings with parentheses — product codes (e.g. "9101(PU)BLACK", "MX(C3530i)")
  if (/[()]/.test(trimmed)) return false;

  // Blocklist of known garbage manufacturer names or models that slip through
  const BAD_MFGS = new Set(['usn', 'brak', 'inne', 'other', 'nieznany', 'oem', 'brak nazwy', 'no name']);
  if (BAD_MFGS.has(trimmed.toLowerCase())) return false;

  // Very long single word (e.g. Instaxliplaymatchagreen)
  if (/^[A-Za-z]{15,}$/.test(trimmed)) return false;

  // Short alphanumeric ending in a digit with no spaces (e.g. Fflb0, Xyz1)
  if (/^[A-Za-z]{3,6}\d{1,2}$/.test(trimmed)) return false;

  // Two meaningless words separated by hyphen (e.g. Rgosp-ukwibl)
  if (/^[A-Za-z]{4,8}-[A-Za-z]{4,8}$/.test(trimmed) && !/^(Hewlett-Packard|Micro-Star)$/i.test(trimmed)) return false;

  // Very long manufacturer names are usually product descriptions
  if (trimmed.length > 30) return false;
  // Manufacturer names with many words are usually descriptions
  if (trimmed.split(/\s+/).length > 3) return false;
  
  // Explicitly reject names containing device types (e.g. "TABLET-S200SILVER", "STRIKE PRO W SILENT US")
  if (/\b(TABLET|SMARTPHONE|LAPTOP|CABLE|KABEL|MOUSE|MYSZ|KEYBOARD|KLAWIATURA|MONITOR|SCREEN|PRZEW[ÓO]D|ETUI|CASE|ADAPTER|ZASILACZ|POWERBANK|GAMING|SILENT)\b/i.test(trimmed)) return false;

  // Hardware model names containing tech keywords — motherboards, GPUs, cases, RAM etc.
  // e.g. "A520M DS3H AC 1.4", "A620AM PRO-A WIFI", "A310 LP 4G", "A21 PLUS TG ARGB BLACK"
  const TECH_KEYWORDS = /\b(ARGB|RGB|TG|DDR[3-6]|WIFI|ATX|MATX|ITX|NVME|SATA|PCIE|SSD|HDD|LP|PLUS|USB|HDMI|VGA|DVI|DP|LGA|AM[4-5]|SO-?DIMM|ECC|GDDR\d)\b/i;
  if (TECH_KEYWORDS.test(trimmed) && /\d/.test(trimmed)) return false;

  // Alphanumeric model + color combos: letter(s) + digits + space + more words including color
  // e.g. "A21 PLUS TG ARGB BLACK", "A31 PLUS TG ARGB WHITE"
  if (/^[A-Z]\d+\s/i.test(trimmed) && /\b(BLACK|WHITE|BLUE|RED|GREEN|GOLD|SILVER|GREY|GRAY)\b/i.test(trimmed)) return false;

  // Short alphanumeric codes starting with letter(s) + digits + space (e.g. "A310 LP 4G", "X570 AORUS")
  if (/^[A-Z]{1,3}\d{2,}\s/i.test(trimmed)) return false;

  return true;
}

function listManufacturers(supplier_id = null) {
  const db = getDb();
  let names = [];

  if (supplier_id) {
    // Per-supplier: pull from supplier_products for that specific supplier, filter through isValidManufacturer
    const raw = db.prepare(
      "SELECT DISTINCT manufacturer COLLATE NOCASE as manufacturer FROM supplier_products WHERE supplier_id = ? AND manufacturer IS NOT NULL AND manufacturer != '' ORDER BY manufacturer COLLATE NOCASE"
    ).all(supplier_id).map(r => r.manufacturer).filter(isValidManufacturer);
    names = raw.map(normalizeManufacturer);
  } else {
    // Global list: prefer catalog_master (already clean & deduplicated) as primary source
    try {
      const catalogRows = db.prepare(
        "SELECT DISTINCT manufacturer FROM catalog_master WHERE manufacturer IS NOT NULL AND manufacturer != '' ORDER BY manufacturer COLLATE NOCASE"
      ).all().map(r => r.manufacturer).filter(isValidManufacturer).map(normalizeManufacturer);
      if (catalogRows.length > 0) {
        names = catalogRows;
      }
    } catch(_) {}

    // Fallback to supplier_products if catalog_master is empty (e.g. catalog not yet built)
    if (!names.length) {
      const raw = db.prepare(
        "SELECT DISTINCT manufacturer COLLATE NOCASE as manufacturer FROM supplier_products WHERE manufacturer IS NOT NULL AND manufacturer != '' ORDER BY manufacturer COLLATE NOCASE"
      ).all().map(r => r.manufacturer).filter(isValidManufacturer).map(normalizeManufacturer);
      names = raw;
    }
  }

  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}


// Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬ EXPORTS Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬

function clearSubiektData() {
  const db = getDb();
  db.prepare('DELETE FROM subiekt_products').run();
  try { db.prepare("DELETE FROM subiekt_meta WHERE key='last_import'").run(); } catch {}
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════════════════════
// PRICE HISTORY
// ═════════════════════════════════════════════════════════════════════════════

function getPriceHistory(ean, days = 30) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT ph.supplier_id, s.name as supplier_name, ph.price_pln, ph.recorded_at
    FROM price_history ph
    JOIN suppliers s ON ph.supplier_id = s.id
    WHERE ph.ean = ? AND ph.recorded_at >= datetime('now', ?)
    ORDER BY ph.recorded_at ASC
  `).all(ean, `-${days} days`);

  const summary = {
    min: null, max: null, avg: null, trend: 'stable'
  };

  if (rows.length > 0) {
    let sum = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    rows.forEach(r => {
      if (r.price_pln < minPrice) minPrice = r.price_pln;
      if (r.price_pln > maxPrice) maxPrice = r.price_pln;
      sum += r.price_pln;
    });
    
    // Grupujemy min cenę per dzień do obliczenia trendu
    const dailyMins = {};
    for (const r of rows) {
      const date = r.recorded_at.split(' ')[0]; // YYYY-MM-DD
      if (!dailyMins[date] || r.price_pln < dailyMins[date]) {
        dailyMins[date] = r.price_pln;
      }
    }
    const daysArr = Object.keys(dailyMins).sort();
    
    if (daysArr.length >= 2) {
      const firstPrice = dailyMins[daysArr[0]];
      const lastPrice = dailyMins[daysArr[daysArr.length-1]];
      if (lastPrice < firstPrice * 0.99) summary.trend = 'down';
      else if (lastPrice > firstPrice * 1.01) summary.trend = 'up';
    }

    summary.min = minPrice;
    summary.max = maxPrice;
    summary.avg = sum / rows.length;
    summary.dailyMins = dailyMins; // potrzebne do wykresu
  }

  return { ean, history: rows, summary };
}
// ─── Sellasist Data Sync ────────────────────────────────────────────────────────

function updateSellasistData(sellasistProducts) {
  const db = getDb();
  let updatedWeight = 0;
  let insertedWeight = 0;
  let updatedListings = 0;
  let skippedNoWeight = 0;
  
  // Step 1: Deduplicate by EAN — keep highest weight per EAN
  const eanMap = new Map();
  for (const p of sellasistProducts) {
    if (!p.ean) continue;
    const existing = eanMap.get(p.ean);
    if (!existing || (p.weight || 0) > (existing.weight || 0)) {
      eanMap.set(p.ean, p);
    } else if (existing) {
      // Merge integrations from duplicate
      if (p.integrations && p.integrations.length > 0) {
        existing.integrations = [...new Set([...(existing.integrations || []), ...p.integrations])];
      }
    }
  }
  
  console.log(`[Sellasist] Deduped: ${sellasistProducts.length} entries → ${eanMap.size} unique EANs`);
  
  const updateByCanonical = db.prepare(`UPDATE catalog_master SET weight_g = ?, weight_source = 'sellasist' WHERE canonical_ean = ?`);
  const updateByAllEans = db.prepare(`UPDATE catalog_master SET weight_g = ?, weight_source = 'sellasist' WHERE all_eans LIKE ?`);
  const findByEan = db.prepare(`SELECT id FROM catalog_master WHERE canonical_ean = ? OR all_eans LIKE ?`);
  const insertMasterStmt = db.prepare(`
    INSERT INTO catalog_master (canonical_ean, all_eans, name, weight_g, weight_source, supplier_ids, supplier_names)
    VALUES (?, ?, ?, ?, 'sellasist', '[]', '[]')
  `);
  const insertListingStmt = db.prepare(`INSERT INTO listing_platforms (platform, ean, title) VALUES (?, ?, ?)`);

  db.transaction(() => {
    // Wipe all listings to ensure exact match with Sellasist
    db.prepare('DELETE FROM listing_platforms').run();
    
    for (const [ean, p] of eanMap) {
      if (p.weight > 0) {
        // Sellasist weight is in kg, catalog_master stores weight in grams
        const weightGrams = Math.round(p.weight * 1000);
        
        // Try exact match on canonical_ean first (most reliable)
        let res = updateByCanonical.run(weightGrams, ean);
        
        // If no match, try all_eans LIKE pattern
        if (res.changes === 0) {
          res = updateByAllEans.run(weightGrams, `%"${ean}"%`);
        }
        // Also try without quotes in case JSON format is different
        if (res.changes === 0) {
          res = updateByAllEans.run(weightGrams, `%${ean}%`);
        }
        
        if (res.changes > 0) {
          updatedWeight++;
        } else {
          // Product not in catalog_master yet — insert it
          const existing = findByEan.get(ean, `%${ean}%`);
          if (!existing) {
            try {
              insertMasterStmt.run(ean, JSON.stringify([ean]), p.name || '', weightGrams);
              insertedWeight++;
            } catch(_) {} // ignore duplicate key errors
          }
        }
      } else {
        skippedNoWeight++;
      }
      
      if (p.integrations && p.integrations.length > 0) {
        for (const platform of p.integrations) {
          insertListingStmt.run(platform, ean, '');
          updatedListings++;
        }
      }
    }
    
    db.prepare(`INSERT OR REPLACE INTO listing_meta (id, last_import, row_count) VALUES (1, datetime('now', 'localtime'), ?)`).run(updatedListings);
  })();
  
  console.log(`[Sellasist] Weight sync: ${updatedWeight} updated, ${insertedWeight} new, ${skippedNoWeight} skipped (no weight). Listings: ${updatedListings}.`);
  return { updatedWeight, insertedWeight, updatedListings };
}

// ═══ ATTRIBUTE ALIAS CRUD ═══════════════════════════════════════════════════

function listAttrAliases() {
  try { return getDb().prepare('SELECT * FROM attr_aliases ORDER BY canonical_name, alias').all(); }
  catch(_) { return []; }
}

function addAttrAlias(alias, canonical_name) {
  if (!alias || !canonical_name) throw new Error('Alias i nazwa kanoniczna są wymagane');
  getDb().prepare('INSERT OR REPLACE INTO attr_aliases (alias, canonical_name) VALUES (?, ?)').run(alias.trim(), canonical_name.trim());
  invalidateAttrAliasCache();
  return { ok: true };
}

function deleteAttrAlias(id) {
  getDb().prepare('DELETE FROM attr_aliases WHERE id = ?').run(id);
  invalidateAttrAliasCache();
  return { ok: true };
}

function mergeAttrAliases(aliases, canonical_name) {
  if (!aliases || !Array.isArray(aliases) || aliases.length === 0 || !canonical_name) {
    throw new Error('Tablica aliasów i nazwa kanoniczna są wymagane');
  }
  
  const db = getDb();
  const insertAlias = db.prepare('INSERT OR REPLACE INTO attr_aliases (alias, canonical_name) VALUES (?, ?)');
  
  db.transaction(() => {
    for (const alias of aliases) {
      const trimmedAlias = String(alias).trim();
      const trimmedCanon = String(canonical_name).trim();
      if (!trimmedAlias) continue;
      
      if (trimmedAlias.toLowerCase() !== trimmedCanon.toLowerCase()) {
        insertAlias.run(trimmedAlias, trimmedCanon);
      }
    }
  })();
  
  invalidateAttrAliasCache();
  return { ok: true };
}

module.exports = {
  _setDataDir, _getEffectiveDataDir, clearSubiektData,
  getDb, getColumnMap, saveColumnMap,
  previewExcel, previewCsv,
  importSubiektExcel, importSubiektCsv, getSubiektStatus,
  // suppliers
  listSuppliers, addSupplier, deleteSupplier, updateSupplier,
  replaceSupplierFile, refreshSupplier, refreshAllSuppliers, isSupplierRefreshing,
  // supplier_files
  listSupplierFiles, addSupplierFile, updateSupplierFile, deleteSupplierFile, refreshOneSupplierFile,
  // schedule
  setSupplierSchedule, getScheduledSuppliers, markScheduledRun, getScheduledFiles, markFileScheduledRun,
  // analytics
  buildComparison, exportComparisonCsv,
  buildPromotions, buildSuperDeals, getMissingProducts,
  buildRestockList, saveRestockOverride,
  listManufacturers, isValidManufacturer, normalizeManufacturer, getLogs, addLog,
  listMfgAliases, addMfgAlias, deleteMfgAlias, suggestMfgAliases, invalidateMfgAliasCache, mergeManufacturers,
  listAttrAliases, addAttrAlias, deleteAttrAlias, mergeAttrAliases, getAttrAliasMap,
  getAttrManagerList, updateCategoryAttrUnit, getAttrManagerDetails, mergeManagerAttributes, getAttrManagerSuggestions,
  parseSupplierXml, parseSupplierExcel, parseSupplierCsv, fetchSupplierUrl,
  _fetchFtpFile: fetchFtpFile,
  // listing gap analysis
  importListings, getListingStatus, getListingPlatforms, getListingCoverage, getListingGaps, clearListings,
  // elko
  testElkoApi, ELKO_BRANDS,
  // impakt
  // impakt
  testImpaktApi, fetchImpaktProducts,
  // price history
  getPriceHistory,
  // sellasist sync
  updateSellasistData,
};
