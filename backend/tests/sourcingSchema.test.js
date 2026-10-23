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

console.log('sourcingSchema tests: ok');
