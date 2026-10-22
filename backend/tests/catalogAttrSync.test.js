'use strict';

const assert = require('assert');
const Database = require('better-sqlite3');
const attrSync = require('../services/catalogAttrSync');
const { registerNormalizeEan } = require('../services/eanUtil');

function makeDb() {
  const db = new Database(':memory:');
  registerNormalizeEan(db);
  db.exec(`
    CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE supplier_products (
      id INTEGER PRIMARY KEY, supplier_id INTEGER, ean TEXT, normalized_ean TEXT,
      name TEXT, attributes TEXT, price_pln REAL, stock_quantity INTEGER
    );
    CREATE TABLE supplier_product_attrs (
      supplier_id INTEGER, ean TEXT, normalized_ean TEXT, attr_name TEXT, attr_value TEXT
    );
    CREATE TABLE product_categories (
      id INTEGER PRIMARY KEY, name TEXT, parent_id INTEGER, ab_category_id INTEGER
    );
    CREATE TABLE category_attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      attr_name TEXT NOT NULL,
      attr_type TEXT DEFAULT 'text',
      attr_unit TEXT,
      visible INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      is_filter INTEGER DEFAULT 1,
      UNIQUE(category_id, attr_name)
    );
    CREATE TABLE catalog_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_ean TEXT,
      all_eans TEXT DEFAULT '[]',
      name TEXT,
      manufacturer TEXT,
      category_id INTEGER,
      category_name TEXT,
      raw_attributes TEXT DEFAULT '{}'
    );
    CREATE TABLE product_attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_id INTEGER NOT NULL,
      attribute_id INTEGER NOT NULL,
      value_text TEXT,
      value_numeric REAL,
      UNIQUE(catalog_id, attribute_id)
    );
    CREATE TABLE attr_aliases (alias TEXT, canonical_name TEXT);
  `);
  return db;
}

function testSocketFromGermanFeed() {
  const db = makeDb();
  db.prepare('INSERT INTO suppliers (id, name) VALUES (1, ?)').run('Kosatec');
  db.prepare('INSERT INTO product_categories (id, name) VALUES (1, ?)').run('Procesory');
  db.prepare(`INSERT INTO category_attributes (category_id, attr_name, attr_type) VALUES (1, 'Socket', 'text'), (1, 'TDP', 'numeric')`).run();
  db.prepare(`
    INSERT INTO catalog_master (canonical_ean, all_eans, name, category_id, category_name, raw_attributes)
    VALUES ('5901234123457', '["05901234123457"]', 'Ryzen 5', 1, 'Procesory', '{}')
  `).run();
  db.prepare(`
    INSERT INTO supplier_products (supplier_id, ean, normalized_ean, name, attributes, price_pln, stock_quantity)
    VALUES (1, '05901234123457', '5901234123457', 'AMD Ryzen', '{"Sockel":"AM5","TDP":"65 W","artnr":"X1"}', 410, 3)
  `).run();

  const result = attrSync.syncCatalogAttributes(db, { seedSchemas: false });
  assert.ok(result.filled >= 2, 'Socket and TDP should be filled');

  const raw = JSON.parse(db.prepare('SELECT raw_attributes FROM catalog_master WHERE id = 1').get().raw_attributes);
  assert.ok(raw.Socket === 'AM5' || raw.Sockel === 'AM5' || Object.values(raw).includes('AM5'));
  assert.ok(!raw.artnr, 'junk keys must not land in catalog raw_attributes');

  const pa = db.prepare(`
    SELECT ca.attr_name, pa.value_text, pa.value_numeric
    FROM product_attributes pa JOIN category_attributes ca ON ca.id = pa.attribute_id
    WHERE pa.catalog_id = 1
  `).all();
  const byName = Object.fromEntries(pa.map(r => [r.attr_name, r]));
  assert.strictEqual(byName.Socket.value_text, 'AM5');
  assert.strictEqual(byName.TDP.value_numeric, 65);

  const list = attrSync.buildAttributeList(raw, Object.fromEntries(pa.map(r => [r.attr_name, r])), [
    { attr_name: 'Socket', attr_type: 'text' },
    { attr_name: 'TDP', attr_type: 'numeric' },
  ], attrSync.loadAliasMaps(db));
  assert.ok(list.some(a => a.attr_name === 'Socket' && a.value_text === 'AM5'));
  db.close();
}

function testNamesMatchSynonyms() {
  assert.ok(attrSync.namesMatch('Socket', 'Sockel'));
  assert.ok(attrSync.namesMatch('Liczba rdzeni', 'Rdzenie'));
  assert.ok(attrSync.namesMatch('TDP', 'thermal design power'));
  assert.ok(attrSync.namesMatch('TDP', 'Max TDP'));
  assert.ok(attrSync.namesMatch('Socket', 'Kompatybilne sockety'));
  assert.ok(!attrSync.namesMatch('Socket', 'TDP'));
}

function testJunkFilter() {
  assert.ok(attrSync.isJunkAttrName('cena netto'));
  assert.ok(attrSync.isJunkAttrName('SKU'));
  assert.ok(!attrSync.isJunkAttrName('Socket'));
}

function testManualNotOverwritten() {
  const db = makeDb();
  db.prepare('INSERT INTO product_categories (id, name) VALUES (1, ?)').run('Procesory');
  db.prepare(`INSERT INTO category_attributes (category_id, attr_name) VALUES (1, 'Socket')`).run();
  db.prepare(`INSERT INTO catalog_master (canonical_ean, name, category_id, raw_attributes) VALUES ('111', 'CPU', 1, '{"Socket":"AM4"}')`).run();
  db.prepare(`INSERT INTO product_attributes (catalog_id, attribute_id, value_text) VALUES (1, 1, 'AM5-manual')`).run();
  db.prepare(`INSERT INTO supplier_products (supplier_id, ean, normalized_ean, attributes) VALUES (1, '111', '111', '{"Socket":"AM4"}')`).run();
  attrSync.syncCatalogAttributes(db, { seedSchemas: false });
  const row = db.prepare('SELECT value_text FROM product_attributes WHERE catalog_id = 1').get();
  assert.strictEqual(row.value_text, 'AM5-manual');
  db.close();
}

function testActionSectionKeysResolveToCanonical() {
  const db = makeDb();
  const aliasMap = attrSync.loadAliasMaps(db);
  assert.strictEqual(attrSync.resolveKey('Chłodzenie / Socket', aliasMap), 'Socket');
  assert.strictEqual(attrSync.resolveKey('Sockel', aliasMap), 'Socket');
  assert.strictEqual(attrSync.resolveKey('Specyfikacja / Max TDP', aliasMap), 'TDP');
  assert.strictEqual(attrSync.resolveKey('Höhe', aliasMap), 'Wysokość');
  assert.strictEqual(attrSync.resolveKey('CPU / Kompatybilne podstawki', aliasMap), 'Socket');
  db.close();
}

function testFlattenNestedParameters() {
  const flat = attrSync.flattenAttrObject({
    parameters: [
      { parameterName: 'Socket', parameterValue: 'AM5' },
      { name: 'TDP', value: '180 W' },
    ],
  });
  assert.strictEqual(flat.Socket, 'AM5');
  assert.strictEqual(flat.TDP, '180 W');
}

function testSeedPrefersCpuCoolerSchema() {
  const db = makeDb();
  const map = {
    aio: ['Procesor', 'RAM', 'Dysk'],
    chłodzeni: ['Typ chłodzenia', 'Socket', 'TDP', 'Wysokość'],
    'wentylatory do procesor': ['Typ chłodzenia', 'Socket', 'TDP', 'Wysokość'],
    wentylator: ['Rozmiar', 'Obroty'],
  };
  attrSync.seedCategoryAttrSchema(db, 1, 'Wentylatory Do Procesorów', map);
  const names = db.prepare('SELECT attr_name FROM category_attributes WHERE category_id = 1').all().map(r => r.attr_name);
  assert.ok(names.includes('Socket'), 'CPU cooler category must get Socket');
  assert.ok(names.includes('TDP'));
  assert.ok(!names.includes('Rozmiar'), 'generic fan schema must not win over CPU cooler schema');
  assert.ok(!names.includes('Procesor'), 'AIO PC schema must not win over cooling');

  attrSync.seedCategoryAttrSchema(db, 2, 'Chłodzenie AIO', map);
  const aio = db.prepare('SELECT attr_name FROM category_attributes WHERE category_id = 2').all().map(r => r.attr_name);
  assert.ok(aio.includes('Socket'));
  assert.ok(!aio.includes('Procesor'));
  db.close();
}

function testHydrateActionKeysIntoCatalog() {
  const db = makeDb();
  db.prepare('INSERT INTO product_categories (id, name) VALUES (1, ?)').run('Wentylatory Do Procesorów');
  db.prepare(`
    INSERT INTO catalog_master (canonical_ean, all_eans, name, category_id, category_name, raw_attributes)
    VALUES ('5901234123457', '[]', 'Arctic Freezer', 1, 'Wentylatory Do Procesorów', '{}')
  `).run();
  db.prepare(`
    INSERT INTO supplier_products (supplier_id, ean, normalized_ean, name, attributes, price_pln, stock_quantity)
    VALUES (1, '5901234123457', '5901234123457', 'Arctic',
      '{"Chłodzenie / Socket":"AM5","Specyfikacja / Max TDP":"180 W","artnr":"X9"}', 120, 4)
  `).run();

  const products = db.prepare('SELECT * FROM catalog_master').all();
  attrSync.hydrateProductsRaw(db, products, attrSync.loadAliasMaps(db));
  const raw = JSON.parse(products[0].raw_attributes);
  assert.strictEqual(raw.Socket, 'AM5');
  assert.strictEqual(raw.TDP, '180 W');
  assert.ok(!raw.artnr);

  const list = attrSync.buildAttributeList(raw, {}, [
    { attr_name: 'Socket', attr_type: 'text' },
    { attr_name: 'TDP', attr_type: 'numeric' },
  ], attrSync.loadAliasMaps(db));
  assert.ok(list.some(a => a.attr_name === 'Socket' && a.value_text === 'AM5'));
  assert.ok(list.some(a => a.attr_name === 'TDP'));
  db.close();
}

testSocketFromGermanFeed();
testNamesMatchSynonyms();
testJunkFilter();
testManualNotOverwritten();
testActionSectionKeysResolveToCanonical();
testFlattenNestedParameters();
testSeedPrefersCpuCoolerSchema();
testHydrateActionKeysIntoCatalog();
console.log('catalogAttrSync tests: ok');
