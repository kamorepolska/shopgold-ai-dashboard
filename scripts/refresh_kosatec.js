const path = require('path');
const db = require('better-sqlite3')(path.join(__dirname, '..', 'data', 'idealpc', 'shopgold_cache.db'));
const sourcingService = require('../backend/services/sourcingService.js');

async function main() {
  console.log('=== Refreshing Kosatec from URL ===');
  try {
    const result = await sourcingService.refreshSupplier(15);
    console.log('Refresh result:', JSON.stringify(result).substring(0, 200));
  } catch(e) {
    console.error('Refresh error:', e.message);
  }

  const total = db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = 15').get().c;
  const withAttrs = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = 15 AND attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").get().c;
  console.log(`\nKosatec: ${total} products, ${withAttrs} with attrs`);

  // Check what headers the file has now
  const sup = db.prepare('SELECT file_path FROM suppliers WHERE id = 15').get();
  if (sup.file_path) {
    const fs = require('fs');
    const iconv = require('iconv-lite');
    if (fs.existsSync(sup.file_path)) {
      const buf = fs.readFileSync(sup.file_path);
      const text = iconv.decode(buf.slice(0, 3000), 'utf8');
      const lines = text.split('\n');
      console.log('\nFirst 3 lines:');
      lines.slice(0, 3).forEach((l, i) => console.log(`[${i}] ${l.substring(0, 200)}`));
    }
  }

  const sample = db.prepare("SELECT attributes FROM supplier_products WHERE supplier_id = 15 AND attributes IS NOT NULL AND attributes != '{}' LIMIT 1").get();
  if (sample) {
    const parsed = JSON.parse(sample.attributes);
    console.log(`\nSample keys (${Object.keys(parsed).length}): ${Object.keys(parsed).join(', ')}`);
  }
}
main();
