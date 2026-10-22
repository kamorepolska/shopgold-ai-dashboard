// Build attributes from existing Kosatec structured columns
const path = require('path');
const db = require('better-sqlite3')(path.join(__dirname, '..', 'data', 'idealpc', 'shopgold_cache.db'));

console.log('=== Building attributes for Kosatec from existing columns ===');

const rows = db.prepare(`SELECT id, category, weight_g, weight_net_g, manufacturer_code, warranty, 
  dimensions_raw, width_mm, height_mm, depth_mm, pcn_code, date_added, description, 
  vat, product_type, unit_measure
  FROM supplier_products WHERE supplier_id = 15`).all();

let updated = 0;
const update = db.prepare('UPDATE supplier_products SET attributes = ? WHERE id = ?');

db.transaction(() => {
  for (const row of rows) {
    const attrs = {};
    
    if (row.category) attrs['Kategoria'] = row.category;
    if (row.weight_g > 0) attrs['Waga brutto (g)'] = String(row.weight_g);
    if (row.weight_net_g > 0) attrs['Waga netto (g)'] = String(row.weight_net_g);
    if (row.manufacturer_code) attrs['Kod producenta'] = row.manufacturer_code;
    if (row.warranty) attrs['Gwarancja'] = row.warranty;
    if (row.pcn_code) attrs['Kod CN'] = row.pcn_code;
    if (row.date_added) attrs['Data dodania'] = row.date_added;
    if (row.product_type) attrs['Typ produktu'] = row.product_type;
    if (row.unit_measure) attrs['Jednostka'] = row.unit_measure;
    if (row.dimensions_raw) attrs['Wymiary'] = row.dimensions_raw;
    if (row.width_mm > 0) attrs['Szerokość (mm)'] = String(row.width_mm);
    if (row.height_mm > 0) attrs['Wysokość (mm)'] = String(row.height_mm);
    if (row.depth_mm > 0) attrs['Głębokość (mm)'] = String(row.depth_mm);
    if (row.vat) attrs['VAT'] = String(row.vat);
    if (row.description) attrs['Opis'] = row.description.substring(0, 200);
    
    if (Object.keys(attrs).length > 0) {
      update.run(JSON.stringify(attrs), row.id);
      updated++;
    }
  }
})();

const total = db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = 15').get().c;
const withAttrs = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = 15 AND attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").get().c;
const sample = db.prepare("SELECT attributes FROM supplier_products WHERE supplier_id = 15 AND attributes IS NOT NULL AND attributes != '{}' LIMIT 1").get();
const sampleKeys = sample ? Object.keys(JSON.parse(sample.attributes)) : [];

console.log(`Updated: ${updated}`);
console.log(`Kosatec: ${total} products, ${withAttrs} with attrs`);
console.log(`Sample keys (${sampleKeys.length}): ${sampleKeys.join(', ')}`);

// Also do the same for EdSystem (ID: 9) which only has 4 basic keys
console.log('\n=== Building richer attributes for EdSystem from columns ===');
const edRows = db.prepare(`SELECT id, category, weight_g, weight_net_g, manufacturer_code, warranty, 
  dimensions_raw, width_mm, height_mm, depth_mm, pcn_code, date_added, product_type, attributes
  FROM supplier_products WHERE supplier_id = 9`).all();

let edUpdated = 0;
db.transaction(() => {
  for (const row of edRows) {
    let existing = {};
    try { existing = JSON.parse(row.attributes || '{}'); } catch(_) {}
    
    if (row.category && !existing['Kategoria']) existing['Kategoria'] = row.category;
    if (row.weight_g > 0 && !existing['Waga (g)']) existing['Waga (g)'] = String(row.weight_g);
    if (row.manufacturer_code && !existing['Kod producenta']) existing['Kod producenta'] = row.manufacturer_code;
    if (row.warranty && !existing['Gwarancja']) existing['Gwarancja'] = row.warranty;
    
    update.run(JSON.stringify(existing), row.id);
    edUpdated++;
  }
})();

console.log(`EdSystem updated: ${edUpdated}`);

// Also enrich Incom (ID: 26) which only has 1 key
console.log('\n=== Enriching Incom from columns ===');
const incomRows = db.prepare(`SELECT id, category, weight_g, manufacturer_code, warranty, attributes
  FROM supplier_products WHERE supplier_id = 26`).all();

let incomUpdated = 0;
db.transaction(() => {
  for (const row of incomRows) {
    let existing = {};
    try { existing = JSON.parse(row.attributes || '{}'); } catch(_) {}
    
    if (row.category && !existing['Kategoria']) existing['Kategoria'] = row.category;
    if (row.weight_g > 0 && !existing['Waga (g)']) existing['Waga (g)'] = String(row.weight_g);
    if (row.manufacturer_code && !existing['Kod producenta']) existing['Kod producenta'] = row.manufacturer_code;
    if (row.warranty && !existing['Gwarancja']) existing['Gwarancja'] = row.warranty;
    
    if (Object.keys(existing).length > 0) {
      update.run(JSON.stringify(existing), row.id);
      incomUpdated++;
    }
  }
})();

console.log(`Incom updated: ${incomUpdated}`);

// Final summary
console.log('\n=== FINAL COVERAGE ===');
const sups = db.prepare('SELECT id, name FROM suppliers WHERE is_active = 1').all();
for (const s of sups) {
  const t = db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ?').get(s.id).c;
  const a = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").get(s.id).c;
  const sm = db.prepare("SELECT attributes FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' LIMIT 1").get(s.id);
  let nk = 0;
  if (sm) { try { nk = Object.keys(JSON.parse(sm.attributes)).length; } catch(_) {} }
  const pct = t > 0 ? ((a / t) * 100).toFixed(1) : '0.0';
  const icon = a === 0 ? '❌' : pct === '100.0' ? '✅' : '⚠️';
  console.log(`  ${icon} ${s.name.padEnd(15)} | ${String(t).padStart(6)} | ${String(a).padStart(6)} with attrs (${pct}%) | sample: ${nk} keys`);
}
