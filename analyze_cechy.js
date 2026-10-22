/**
 * analyze_cechy.js
 * Reads cechy.xlsx, extracts unique attribute names,
 * compares with supplier raw_attributes in the DB,
 * and reports matches / gaps.
 */
const path = require('path');
const fs   = require('fs');

// Try to load xlsx
let XLSX;
try { XLSX = require('xlsx'); } catch(e) {
  console.error('Missing xlsx package. Run: npm install xlsx');
  process.exit(1);
}

const Database = require('better-sqlite3');
const DB_PATH  = path.join(__dirname, 'data', 'shopgold_cache.db');
const XLSX_PATH = path.join(__dirname, 'documentation', 'cechy.xlsx');

console.log('Reading', XLSX_PATH, '...');
const wb   = XLSX.readFile(XLSX_PATH, { sheetRows: 0 });
const sheets = wb.SheetNames;
console.log('Sheets:', sheets);

// Collect all unique attribute names from all sheets
const xlsxAttrs = new Set();
const xlsxRows  = [];  // { sheet, col_headers... }

for (const sheetName of sheets) {
  const ws   = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`  Sheet "${sheetName}": ${data.length} rows, cols:`, data.length ? Object.keys(data[0]).slice(0, 10) : []);

  // Detect column names — the attribute name column is likely "Cecha", "Nazwa", "Atrybut", "name", etc.
  if (data.length === 0) continue;
  const cols = Object.keys(data[0]);

  // Try to find the attribute name column
  const nameCols = cols.filter(c => /cecha|nazwa|atrybut|name|param|key|attribute/i.test(c));
  console.log('    Likely name cols:', nameCols);

  for (const row of data) {
    for (const col of (nameCols.length ? nameCols : cols.slice(0, 3))) {
      const val = String(row[col] || '').trim();
      if (val && val.length > 1 && val.length < 100) {
        xlsxAttrs.add(val);
        xlsxRows.push({ sheet: sheetName, name: val, raw: row });
      }
    }
  }
}

console.log(`\nTotal unique attribute names from xlsx: ${xlsxAttrs.size}`);
const xlsxList = [...xlsxAttrs].sort();

// Now read raw_attributes from DB
console.log('\nReading supplier_products from DB...');
const db = new Database(DB_PATH, { readonly: true });

let supplierInfo = {};
try {
  db.prepare('SELECT id, name FROM suppliers').all().forEach(s => supplierInfo[s.id] = s.name);
} catch(e) { console.log('  (no suppliers table)'); }

const rows = db.prepare(
  `SELECT sp.raw_attributes, sp.supplier_id
   FROM supplier_products sp
   WHERE sp.raw_attributes IS NOT NULL AND sp.raw_attributes != '{}' AND sp.raw_attributes != ''
   LIMIT 50000`
).all();

// Collect unique keys from DB
const dbKeyMap = new Map(); // key → Set of supplier names
for (const row of rows) {
  try {
    const obj = JSON.parse(row.raw_attributes);
    for (const k of Object.keys(obj)) {
      const key = k.trim();
      if (!key || key.length < 2) continue;
      if (!dbKeyMap.has(key)) dbKeyMap.set(key, new Set());
      dbKeyMap.get(key).add(supplierInfo[row.supplier_id] || `sup_${row.supplier_id}`);
    }
  } catch(_) {}
}

console.log(`Total unique raw attr keys in DB: ${dbKeyMap.size}`);

// Also load category_attributes
let catAttrs = new Set();
try {
  const cas = db.prepare('SELECT attr_name FROM category_attributes').all();
  cas.forEach(r => catAttrs.add(r.attr_name));
  console.log(`Category attributes in DB: ${catAttrs.size}`);
} catch(e) {}

// Also load attr_aliases
let aliasMap = new Map(); // alias_lower → canonical
try {
  db.prepare('SELECT alias, canonical_name FROM attr_aliases').all()
    .forEach(r => aliasMap.set(r.alias.toLowerCase(), r.canonical_name));
  console.log(`Alias entries in DB: ${aliasMap.size}`);
} catch(e) {}

db.close();

// ── Compare ────────────────────────────────────────────────────────────────────
console.log('\n═══ COMPARISON ═══\n');

const dbKeys = new Set([...dbKeyMap.keys()]);

const matched        = [];  // xlsx attr found in DB raw_attributes (exact or case-insensitive)
const matchedViaAlias= [];  // xlsx attr found via alias → canonical
const matchedInCat   = [];  // xlsx attr found directly in category_attributes
const notFound       = [];  // xlsx attr NOT in DB at all

for (const xAttr of xlsxList) {
  const xLower = xAttr.toLowerCase();

  // Exact match in raw attrs
  if (dbKeys.has(xAttr)) {
    matched.push({ xlsx: xAttr, dbKey: xAttr, suppliers: [...dbKeyMap.get(xAttr)].join(', '), inCat: catAttrs.has(xAttr) });
    continue;
  }

  // Case-insensitive match in raw attrs
  const ciMatch = [...dbKeys].find(k => k.toLowerCase() === xLower);
  if (ciMatch) {
    matched.push({ xlsx: xAttr, dbKey: ciMatch, suppliers: [...dbKeyMap.get(ciMatch)].join(', '), inCat: catAttrs.has(ciMatch) });
    continue;
  }

  // In attr_aliases?
  const canon = aliasMap.get(xLower);
  if (canon) {
    matchedViaAlias.push({ xlsx: xAttr, canonical: canon, inCat: catAttrs.has(canon) });
    continue;
  }

  // In category_attributes directly?
  const inCat = [...catAttrs].find(c => c.toLowerCase() === xLower);
  if (inCat) {
    matchedInCat.push({ xlsx: xAttr, catAttr: inCat });
    continue;
  }

  notFound.push(xAttr);
}

console.log(`✅ Found in DB raw_attributes:    ${matched.length}`);
console.log(`🔗 Found via alias mapping:       ${matchedViaAlias.length}`);
console.log(`📂 Found in category_attributes:  ${matchedInCat.length}`);
console.log(`❌ NOT found in DB at all:         ${notFound.length}`);

// Write detailed report
const report = {
  summary: {
    xlsxTotal: xlsxList.length,
    foundInRaw: matched.length,
    foundViaAlias: matchedViaAlias.length,
    foundInCat: matchedInCat.length,
    notFound: notFound.length,
  },
  matched,
  matchedViaAlias,
  matchedInCat,
  notFound,
  xlsxSheets: sheets,
};

const outPath = path.join(__dirname, 'cechy_analysis.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
console.log('\nFull report written to:', outPath);

// Print not found
if (notFound.length > 0) {
  console.log('\n── Attributes from xlsx NOT in DB (first 50): ──');
  notFound.slice(0, 50).forEach((a, i) => console.log(`  ${i+1}. ${a}`));
}

// Print matched without catAttr
const matchedNotInCat = matched.filter(m => !m.inCat);
if (matchedNotInCat.length > 0) {
  console.log(`\n── Found in raw but NOT in category_attributes (${matchedNotInCat.length}): ──`);
  matchedNotInCat.slice(0, 30).forEach(m => console.log(`  "${m.xlsx}" → raw key "${m.dbKey}" (${m.suppliers})`));
}
