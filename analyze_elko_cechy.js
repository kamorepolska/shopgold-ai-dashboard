/**
 * analyze_elko_cechy.js - FIXED VERSION
 * 
 * XLSX structure (no header row, data from row 0):
 *   col[0] = internal id
 *   col[1] = product_id
 *   col[2] = EAN / product code
 *   col[3] = attribute name (cecha)
 *   col[4] = attribute value
 *   col[5] = supplier name
 */
const path = require('path');
const fs   = require('fs');

const XLSX     = require('xlsx');
const Database = require('better-sqlite3');

const XLSX_PATH = path.join(__dirname, 'documentation', 'elko cechy.xlsx');

// ── Find the correct DB ───────────────────────────────────────────────────────
// Try multiple candidate paths
const DB_CANDIDATES = [
  path.join(__dirname, 'data', 'shopgold_cache.db'),
  path.join(__dirname, 'data', 'sourcing.db'),
  path.join(__dirname, 'data', 'app.db'),
  path.join(__dirname, 'data', 'shopgold_ai.db'),
];

function openDb(dbPath) {
  try {
    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    return { db, tables, path: dbPath };
  } catch(e) { return null; }
}

let dbInfo = null;
for (const p of DB_CANDIDATES) {
  if (!fs.existsSync(p)) continue;
  const info = openDb(p);
  if (info) { dbInfo = info; break; }
}

if (!dbInfo) {
  console.error('Could not open any DB. Checked:', DB_CANDIDATES);
  process.exit(1);
}

console.log('Using DB:', dbInfo.path);
console.log('Tables:', dbInfo.tables.join(', '));
const db = dbInfo.db;

// ── Inspect supplier_products schema ──────────────────────────────────────────
let rawAttrCol = null;
if (dbInfo.tables.includes('supplier_products')) {
  const cols = db.prepare("PRAGMA table_info(supplier_products)").all();
  console.log('\nsupplier_products columns:', cols.map(c => c.name).join(', '));
  rawAttrCol = cols.find(c => /raw.attr|attributes/i.test(c.name))?.name || null;
  console.log('Raw attributes column:', rawAttrCol);
}

// ── Read XLSX ─────────────────────────────────────────────────────────────────
console.log('\nReading:', XLSX_PATH);
const wb   = XLSX.readFile(XLSX_PATH);
const ws   = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });

console.log(`Total rows in xlsx: ${data.length}`);
console.log('Sample rows:');
data.slice(0, 5).forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r).slice(0, 150)));

// Col indices based on observed structure: [id, prod_id, ean, attr_name, attr_value, supplier]
// Determine by looking at data — column 3 has attribute names
const IDX_EAN   = 2;
const IDX_NAME  = 3;
const IDX_VALUE = 4;

// Extract unique attribute names + their values
const xlsxAttrMap = new Map(); // attr_name → { values: Set, eans: Set }
let skipped = 0;
for (const row of data) {
  const name  = String(row[IDX_NAME]  || '').trim();
  const value = String(row[IDX_VALUE] || '').trim();
  const ean   = String(row[IDX_EAN]   || '').trim();
  if (!name || name.length < 2) { skipped++; continue; }
  if (!xlsxAttrMap.has(name)) xlsxAttrMap.set(name, { values: new Set(), eans: new Set() });
  const e = xlsxAttrMap.get(name);
  if (value) e.values.add(value);
  if (ean)   e.eans.add(ean);
}

console.log(`\nSkipped empty rows: ${skipped}`);
console.log(`Unique attribute names in xlsx: ${xlsxAttrMap.size}`);

const xlsxList = [...xlsxAttrMap.entries()].sort((a,b) => a[0].localeCompare(b[0], 'pl'));
xlsxList.forEach(([name, e]) => {
  const vals = [...e.values].slice(0,3).join(', ');
  console.log(`  - "${name}" | ${e.eans.size} products | e.g.: ${vals}`);
});

// ── Compare with DB ───────────────────────────────────────────────────────────
console.log('\n── DB comparison ──');

// Load existing category_attributes
const catAttrSet = new Set();
if (dbInfo.tables.includes('category_attributes')) {
  db.prepare('SELECT attr_name FROM category_attributes').all().forEach(r => catAttrSet.add(r.attr_name));
  console.log(`category_attributes in DB: ${catAttrSet.size}`);
}

// Load attr_aliases
const aliasMap = new Map(); // alias_lower → canonical_name
if (dbInfo.tables.includes('attr_aliases')) {
  db.prepare('SELECT alias, canonical_name FROM attr_aliases').all()
    .forEach(r => aliasMap.set(r.alias.toLowerCase(), r.canonical_name));
  console.log(`attr_aliases in DB: ${aliasMap.size}`);
}

// Load raw keys from supplier_products if possible
const dbRawKeys = new Map();
if (rawAttrCol && dbInfo.tables.includes('supplier_products')) {
  const rows = db.prepare(`SELECT ${rawAttrCol} FROM supplier_products WHERE ${rawAttrCol} IS NOT NULL AND ${rawAttrCol} != '{}' AND ${rawAttrCol} != '' LIMIT 200000`).all();
  console.log(`Loaded ${rows.length} supplier_products rows`);
  for (const row of rows) {
    try {
      const obj = JSON.parse(row[rawAttrCol]);
      for (const k of Object.keys(obj)) {
        const key = k.trim();
        if (key.length < 2) continue;
        dbRawKeys.set(key, (dbRawKeys.get(key) || 0) + 1);
      }
    } catch(_) {}
  }
  console.log(`Unique raw attr keys in DB: ${dbRawKeys.size}`);
}

db.close();

// ── Classify each xlsx attr ───────────────────────────────────────────────────
console.log('\n═══ RESULTS ═══\n');

const inRaw       = []; // found in raw_attributes
const inCatAttr   = []; // found in category_attributes
const viaAlias    = []; // found via alias
const missing     = []; // not found anywhere

for (const [name, info] of xlsxList) {
  const nameLower = name.toLowerCase();

  // 1. In category_attributes (exact)
  if (catAttrSet.has(name)) {
    inCatAttr.push({ name, productCount: info.eans.size });
    continue;
  }
  // 1b. Case-insensitive cat attr
  const ciCat = [...catAttrSet].find(c => c.toLowerCase() === nameLower);
  if (ciCat) {
    inCatAttr.push({ name, catName: ciCat, productCount: info.eans.size });
    continue;
  }

  // 2. Via alias
  if (aliasMap.has(nameLower)) {
    viaAlias.push({ name, canonical: aliasMap.get(nameLower), productCount: info.eans.size });
    continue;
  }

  // 3. In raw_attributes
  if (dbRawKeys.has(name)) {
    inRaw.push({ name, dbCount: dbRawKeys.get(name), productCount: info.eans.size });
    continue;
  }
  const ciRaw = [...dbRawKeys.keys()].find(k => k.toLowerCase() === nameLower);
  if (ciRaw) {
    inRaw.push({ name, dbKey: ciRaw, dbCount: dbRawKeys.get(ciRaw), productCount: info.eans.size });
    continue;
  }

  // 4. Missing everywhere
  missing.push({ name, productCount: info.eans.size, exampleValues: [...info.values].slice(0,5) });
}

console.log(`📂 In category_attributes already: ${inCatAttr.length}`);
console.log(`🔗 Via attr_alias:                 ${viaAlias.length}`);
console.log(`📦 In raw_attributes (not cat):    ${inRaw.length}`);
console.log(`❌ Missing completely:              ${missing.length}`);
console.log(`\nTotal xlsx attrs: ${xlsxAttrMap.size}`);

if (inRaw.length > 0) {
  console.log('\n── In raw_attributes but NOT in category_attributes ──');
  inRaw.forEach(a => console.log(`  "${a.name}" → ${a.dbCount} DB rows, ${a.productCount} xlsx products`));
}
if (missing.length > 0) {
  console.log('\n── MISSING (not in DB at all) ──');
  missing.forEach(a => console.log(`  "${a.name}" | ${a.productCount} products | values: ${a.exampleValues.join(', ')}`));
}

// ── Save report ───────────────────────────────────────────────────────────────
const report = { inCatAttr, viaAlias, inRaw, missing };
fs.writeFileSync(path.join(__dirname, 'elko_cechy_analysis.json'), JSON.stringify(report, null, 2));
console.log('\nSaved: elko_cechy_analysis.json');

// ── Also print DB schema info ─────────────────────────────────────────────────
console.log('\nNOTE: To properly import ELKO attributes into category_attributes,');
console.log('the attrs from "inRaw" and "missing" need to be added via the');
console.log('Attr Manager UI or via an import script once categories are assigned.');
