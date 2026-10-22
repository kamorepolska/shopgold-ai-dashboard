const db = require('./services/sourcingService').getDb();

console.log('=== SUPPLIERS ===');
const sups = db.prepare('SELECT id, name FROM suppliers').all();
for (const s of sups) {
  console.log(`  id=${s.id}: ${s.name}`);
}

console.log('\n=== COLUMN CHECK ===');
const cols = db.prepare("PRAGMA table_info(supplier_products)").all().map(c => c.name);
console.log('supplier_products columns:', cols.join(', '));

const cmCols = db.prepare("PRAGMA table_info(catalog_master)").all().map(c => c.name);
console.log('catalog_master columns:', cmCols.join(', '));

console.log('\n=== PER SUPPLIER ATTR COUNTS ===');
for (const s of sups) {
  const total = db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ?').get(s.id).c;
  
  // Check 'attributes' column
  let withAttrs = 0;
  try {
    withAttrs = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != '' AND length(attributes) > 5").get(s.id).c;
  } catch(e) { }
  
  // Check 'raw_attributes' column
  let withRawAttrs = 0;
  try {
    withRawAttrs = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ? AND raw_attributes IS NOT NULL AND raw_attributes != '{}' AND raw_attributes != '' AND length(raw_attributes) > 5").get(s.id).c;
  } catch(e) { }
  
  console.log(`  ${s.name} (id=${s.id}): ${total} total, ${withAttrs} with attrs, ${withRawAttrs} with raw_attrs`);
}

console.log('\n=== SAMPLE ATTR KEYS PER SUPPLIER ===');
for (const s of sups) {
  let rows = [];
  try {
    rows = db.prepare("SELECT attributes FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != '' LIMIT 3").all(s.id);
  } catch(e) {}
  
  const allKeys = new Set();
  for (const r of rows) {
    try {
      const obj = JSON.parse(r.attributes);
      Object.keys(obj).forEach(k => allKeys.add(k));
    } catch(_) {}
  }
  
  const keysList = [...allKeys].slice(0, 10).join(', ');
  console.log(`  ${s.name}: ${allKeys.size} unique keys in sample -> ${keysList}${allKeys.size > 10 ? '...' : ''}`);
}

console.log('\n=== CATALOG_MASTER RAW ATTRIBUTES SAMPLE ===');
try {
  const cmRows = db.prepare("SELECT raw_attributes FROM catalog_master WHERE raw_attributes IS NOT NULL AND raw_attributes != '{}' AND raw_attributes != '' LIMIT 5").all();
  console.log(`  catalog_master has ${cmRows.length} rows with raw_attributes (sample)`);
  if (cmRows.length > 0) {
    const obj = JSON.parse(cmRows[0].raw_attributes);
    console.log('  First row keys:', Object.keys(obj).join(', '));
  }
} catch(e) {
  console.log('  Error:', e.message);
}

console.log('\n=== ATTR ALIASES TABLE ===');
const aliasCount = db.prepare('SELECT COUNT(*) as c FROM attr_aliases').get().c;
console.log(`  ${aliasCount} aliases defined`);

console.log('\n=== CATEGORY_ATTRIBUTES TABLE ===');
try {
  const catAttrCount = db.prepare('SELECT COUNT(*) as c FROM category_attributes').get().c;
  console.log(`  ${catAttrCount} category attribute records`);
  const distinctNames = db.prepare('SELECT COUNT(DISTINCT attr_name) as c FROM category_attributes').get().c;
  console.log(`  ${distinctNames} distinct attr names`);
} catch(e) {
  console.log('  Error:', e.message);
}

console.log('\n=== TOTAL UNIQUE RAW KEYS (ALL SUPPLIERS, full scan) ===');
const allKeys = new Set();
try {
  const allRows = db.prepare("SELECT attributes FROM supplier_products WHERE attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").all();
  for (const r of allRows) {
    try {
      const obj = JSON.parse(r.attributes);
      Object.keys(obj).forEach(k => { if (k.trim().length >= 2) allKeys.add(k.trim()); });
    } catch(_) {}
  }
  console.log(`  ${allKeys.size} unique attribute keys across ${allRows.length} products`);
} catch(e) {
  console.log('  Error:', e.message);
}

process.exit(0);
