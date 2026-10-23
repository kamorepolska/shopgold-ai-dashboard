'use strict';

const assert = require('assert');
const Database = require('better-sqlite3');
const { registerNormalizeEan } = require('../services/eanUtil');
const catalogSvc = require('../services/catalogService');

function makeDb() {
  const db = new Database(':memory:');
  registerNormalizeEan(db);
  db.exec(`
    CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT, is_active INTEGER DEFAULT 1);
    CREATE TABLE supplier_products (
      id INTEGER PRIMARY KEY, supplier_id INTEGER, ean TEXT, normalized_ean TEXT,
      name TEXT, manufacturer TEXT, category TEXT, attributes TEXT,
      price_pln REAL, stock_quantity INTEGER, condition TEXT DEFAULT 'new'
    );
    CREATE TABLE product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT, parent_id INTEGER,
      is_ab_category INTEGER DEFAULT 0, product_count INTEGER DEFAULT 0, ab_category_id INTEGER
    );
    CREATE TABLE category_aliases (raw_name TEXT UNIQUE, category_id INTEGER);
    CREATE TABLE category_attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER, attr_name TEXT,
      attr_type TEXT DEFAULT 'text', attr_unit TEXT, visible INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0, is_filter INTEGER DEFAULT 1,
      UNIQUE(category_id, attr_name)
    );
    CREATE TABLE catalog_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT, canonical_ean TEXT UNIQUE, all_eans TEXT DEFAULT '[]',
      name TEXT, manufacturer TEXT, category_id INTEGER, category_name TEXT,
      raw_attributes TEXT DEFAULT '{}'
    );
    CREATE TABLE product_attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, catalog_id INTEGER, attribute_id INTEGER,
      value_text TEXT, value_numeric REAL, source TEXT DEFAULT 'supplier',
      UNIQUE(catalog_id, attribute_id)
    );
  `);
  return db;
}

function testGenerateDoesNotWipeExistingCategory() {
  const db = makeDb();
  db.prepare('INSERT INTO suppliers (id, name) VALUES (1, ?)').run('Action');
  db.prepare(`INSERT INTO product_categories (id, name, slug, is_ab_category) VALUES (10, 'Procesory', 'procesory', 1)`).run();
  db.prepare(`
    INSERT INTO catalog_master (canonical_ean, name, category_id, category_name)
    VALUES ('5901234123457', 'Ryzen', 10, 'Procesory')
  `).run();
  db.prepare(`
    INSERT INTO supplier_products (supplier_id, ean, normalized_ean, name, category)
    VALUES (1, '05901234123457', '5901234123457', 'AMD Ryzen', 'Komponenty > Procesory')
  `).run();

  const result = catalogSvc.generateAbCategoryTree(db);
  assert.ok(result.ok);
  const row = db.prepare('SELECT category_id, category_name FROM catalog_master WHERE canonical_ean = ?').get('5901234123457');
  assert.ok(row.category_id, 'category_id must remain assigned');
  assert.ok(row.category_name, 'category_name must remain assigned');
  db.close();
}

function testGenerateAssignsByNormalizedEan() {
  const db = makeDb();
  db.prepare('INSERT INTO suppliers (id, name) VALUES (1, ?)').run('Action');
  db.prepare(`
    INSERT INTO catalog_master (canonical_ean, name, category_id, category_name)
    VALUES ('5901234123457', 'Ryzen', NULL, NULL)
  `).run();
  db.prepare(`
    INSERT INTO supplier_products (supplier_id, ean, normalized_ean, name, category)
    VALUES (1, '05901234123457', '5901234123457', 'AMD Ryzen', 'Komponenty > Procesory')
  `).run();

  const result = catalogSvc.generateAbCategoryTree(db);
  assert.ok(result.ok);
  const row = db.prepare('SELECT category_id, category_name FROM catalog_master WHERE canonical_ean = ?').get('5901234123457');
  assert.ok(row.category_id, 'GTIN-14 supplier EAN must map onto EAN-13 catalog row');
  assert.match(String(row.category_name || ''), /procesor/i);
  db.close();
}

testGenerateDoesNotWipeExistingCategory();
testGenerateAssignsByNormalizedEan();
console.log('catalogService tests: ok');
