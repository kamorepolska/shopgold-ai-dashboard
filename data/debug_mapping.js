const db = require('better-sqlite3')('data/idealpc/shopgold_cache.db');
const ids = [17, 23, 25, 26];
for (const id of ids) {
  const s = db.prepare('SELECT name FROM suppliers WHERE id=?').get(id);
  const sample = db.prepare("SELECT ean, manufacturer_code, attributes FROM supplier_products WHERE supplier_id=? AND attributes IS NOT NULL AND attributes!='{}' LIMIT 2").all(id);
  console.log(`\n--- Supplier ${id} (${s?.name}) ---`);
  sample.forEach(r => {
    console.log('  EAN:', r.ean, '| MFG:', r.manufacturer_code || '(empty)');
    const attrs = JSON.parse(r.attributes || '{}');
    console.log('  Attrs keys:', Object.keys(attrs).slice(0, 10).join(', '));
  });
}
