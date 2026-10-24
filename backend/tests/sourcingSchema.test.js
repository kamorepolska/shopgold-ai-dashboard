'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sourcing = require('../services/sourcingService');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-schema-'));
sourcing._setDataDir(dir);
const db = sourcing.getDb(dir);

const cols = db.prepare('PRAGMA table_info(supplier_products)').all().map(c => c.name);
assert.ok(cols.includes('condition'), 'supplier_products.condition must exist on fresh schema');

const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sp_ean_cond'").get();
assert.ok(idx, 'idx_sp_ean_cond must be created after condition column');

db.prepare('SELECT ean, condition FROM supplier_products WHERE condition = ? LIMIT 1').all('new');

const paCols = db.prepare('PRAGMA table_info(product_attributes)').all().map(c => c.name);
assert.ok(paCols.includes('source'), 'product_attributes.source must exist');

const catSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='product_categories'").get().sql;
assert.ok(!/name\s+TEXT\s+NOT NULL\s+UNIQUE/i.test(catSql), 'product_categories.name must not be globally UNIQUE');
const parentNameIdx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_pc_parent_name'").get();
assert.ok(parentNameIdx, 'idx_pc_parent_name must exist');

db.prepare("INSERT INTO product_categories (name, parent_id) VALUES ('Procesory', NULL)").run();
db.prepare("INSERT INTO product_categories (name, parent_id) VALUES ('Komponenty', NULL)").run();
const parent = db.prepare("SELECT id FROM product_categories WHERE name='Komponenty'").get();
db.prepare("INSERT INTO product_categories (name, parent_id) VALUES ('Procesory', ?)").run(parent.id);
const sameNameCount = db.prepare("SELECT COUNT(*) AS c FROM product_categories WHERE name='Procesory'").get().c;
assert.strictEqual(sameNameCount, 2, 'same category name must be allowed under different parents');

let threw = false;
try {
  db.prepare("INSERT INTO product_categories (name, parent_id) VALUES ('Procesory', NULL)").run();
} catch (e) {
  threw = true;
}
assert.ok(threw, 'duplicate name under the same parent must fail');

console.log('sourcingSchema tests: ok');
