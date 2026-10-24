'use strict';

const assert = require('assert');
const Database = require('better-sqlite3');
const {
  normalizeEan,
  eanVariants,
  eanMatch,
  registerNormalizeEan,
  buildCatalogEanGroups,
  groupKeyForEan,
  sqlInVariants,
} = require('../services/eanUtil');

function testNormalize() {
  assert.strictEqual(normalizeEan('5901234123457'), '5901234123457');
  assert.strictEqual(normalizeEan('05901234123457'), '5901234123457');
  assert.strictEqual(normalizeEan(' 590 1234 123457 '), '5901234123457');
  assert.strictEqual(normalizeEan('590-1234-123457'), '5901234123457');
  assert.strictEqual(normalizeEan('123456789012'), '123456789012');
  assert.strictEqual(normalizeEan(''), '');
  assert.strictEqual(normalizeEan(null), '');
}

function testVariants() {
  const v13 = eanVariants('5901234123457');
  assert.ok(v13.includes('5901234123457'));
  assert.ok(v13.includes('05901234123457'));
  const v14 = eanVariants('05901234123457');
  assert.ok(v14.includes('5901234123457'));
  const v12 = eanVariants('123456789012');
  assert.ok(v12.includes('0123456789012'));
}

function testMatch() {
  assert.ok(eanMatch('5901234123457', '05901234123457'));
  assert.ok(eanMatch('123456789012', '0123456789012'));
  assert.ok(!eanMatch('5901234123457', '5901234123458'));
}

function testCatalogGroups() {
  const groups = buildCatalogEanGroups([
    { canonical_ean: '5901234123457', all_eans: JSON.stringify(['05901234123457', '123']) },
  ]);
  const g = groups.get('5901234123457');
  assert.ok(g, 'normalized EAN-13 should be a group key');
  assert.ok(g.has('5901234123457'));
  assert.ok(g.has('123'));
  assert.strictEqual(groupKeyForEan('05901234123457', groups), groupKeyForEan('5901234123457', groups));
}

function testSqlInVariants() {
  const { sql, params } = sqlInVariants('ean', '5901234123457');
  assert.ok(sql.includes('ean IN ('));
  assert.ok(params.includes('5901234123457'));
  assert.ok(params.includes('05901234123457'));
  const empty = sqlInVariants('ean', '');
  assert.strictEqual(empty.sql, '0');
}

function testSqliteFn() {
  const db = new Database(':memory:');
  registerNormalizeEan(db);
  const row = db.prepare("SELECT normalize_ean(?) AS n").get('05901234123457');
  assert.strictEqual(row.n, '5901234123457');
  db.close();
}

function testComparisonMatching() {
  const db = new Database(':memory:');
  registerNormalizeEan(db);
  db.exec(`
    CREATE TABLE subiekt_products (ean TEXT, name TEXT, stock REAL, buy_price REAL, sell_price REAL, sold_12m INTEGER, sold_30d INTEGER, buy_price_date TEXT);
    CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT, is_active INTEGER DEFAULT 1, currency TEXT DEFAULT 'PLN');
    CREATE TABLE supplier_products (
      id INTEGER PRIMARY KEY, supplier_id INTEGER, ean TEXT, normalized_ean TEXT,
      name TEXT, manufacturer TEXT, price REAL, price_pln REAL, availability TEXT,
      stock_quantity INTEGER, condition TEXT, warranty TEXT
    );
    CREATE TABLE catalog_master (canonical_ean TEXT, all_eans TEXT);
    INSERT INTO suppliers (id, name) VALUES (1, 'Action'), (2, 'Elko');
    INSERT INTO subiekt_products (ean, name, stock, buy_price, sell_price, sold_12m, sold_30d)
      VALUES ('5901234123457', 'Ryzen 5 9600X', 2, 500, 700, 10, 1);
    INSERT INTO supplier_products (supplier_id, ean, normalized_ean, name, manufacturer, price, price_pln, availability, stock_quantity)
      VALUES (1, '05901234123457', '5901234123457', 'AMD Ryzen 5 9600X', 'AMD', 420, 420, 'available', 8);
    INSERT INTO supplier_products (supplier_id, ean, normalized_ean, name, manufacturer, price, price_pln, availability, stock_quantity)
      VALUES (2, '5901234123457', '5901234123457', 'Ryzen 5 9600X BOX', 'AMD', 410, 410, 'available', 3);
    INSERT INTO catalog_master (canonical_ean, all_eans)
      VALUES ('5901234123457', '["5901234123457","05901234123457"]');
  `);

  const offerMap = {};
  const offers = db.prepare('SELECT sp.*, s.name as supplier_name, s.id as supplier_id, s.currency FROM supplier_products sp JOIN suppliers s ON s.id = sp.supplier_id').all();
  for (const o of offers) {
    const key = normalizeEan(o.ean);
    if (!offerMap[key]) offerMap[key] = [];
    offerMap[key].push(o);
  }
  const groups = buildCatalogEanGroups(db.prepare('SELECT canonical_ean, all_eans FROM catalog_master').all());
  const grouped = groups.get('5901234123457');
  const keys = grouped && grouped.size ? grouped : new Set(['5901234123457']);
  let collected = [];
  for (const k of keys) collected = collected.concat(offerMap[k] || []);
  assert.strictEqual(collected.length, 2, 'both wholesaler offers should match the Subiekt EAN');
  const best = collected.reduce((a, b) => a.price_pln < b.price_pln ? a : b);
  assert.strictEqual(best.price_pln, 410);
  db.close();
}

function testPaginationSlice() {
  const rows = Array.from({ length: 25 }, (_, i) => ({ ean: String(i), savings_pct: 25 - i }));
  const limit = 10;
  const offset = 10;
  const page = rows.slice(offset, offset + limit);
  assert.strictEqual(page.length, 10);
  assert.strictEqual(page[0].ean, '10');
  const stats = { total: rows.length, green: rows.length };
  assert.strictEqual(stats.total, 25);
}

testNormalize();
testVariants();
testMatch();
testCatalogGroups();
testSqlInVariants();
testSqliteFn();
testComparisonMatching();
testPaginationSlice();
console.log('eanUtil tests: ok');
