// Refresh all URL-based and FTP suppliers that have 0 attributes to pick up the new extraction logic
const sourcingService = require('../backend/services/sourcingService.js');
const path = require('path');
const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, '..', 'data', 'idealpc', 'shopgold_cache.db'));

async function main() {
  // Suppliers that need re-processing due to improved extraction
  const suppliersToRefresh = [
    { id: 32, name: 'Wortman', reason: '47-column CSV with untapped attrs' },
    { id: 11, name: 'Action', reason: '21-column CSV with category tree' },
    { id: 26, name: 'Incom', reason: 'XML with only 1 attr (grupa_towarowaH)' },
  ];
  
  for (const s of suppliersToRefresh) {
    console.log(`\n=== Refreshing ${s.name} (${s.reason}) ===`);
    const beforeAttrs = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").get(s.id).c;
    const beforeTotal = db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ?').get(s.id).c;
    
    try {
      const result = await sourcingService.refreshSupplier(s.id);
      
      const afterAttrs = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").get(s.id).c;
      const afterTotal = db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ?').get(s.id).c;
      
      // Sample attrs
      const sample = db.prepare("SELECT attributes FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != '' LIMIT 1").get(s.id);
      let sampleKeys = 0;
      let sampleKeyNames = '';
      if (sample) {
        const parsed = JSON.parse(sample.attributes);
        sampleKeys = Object.keys(parsed).length;
        sampleKeyNames = Object.keys(parsed).slice(0, 6).join(', ');
      }
      
      console.log(`  Before: ${beforeTotal} products, ${beforeAttrs} with attrs`);
      console.log(`  After:  ${afterTotal} products, ${afterAttrs} with attrs`);
      console.log(`  Sample: ${sampleKeys} keys [${sampleKeyNames}]`);
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
    }
  }
  
  console.log('\n=== Final coverage ===');
  const sups = db.prepare('SELECT id, name FROM suppliers WHERE is_active = 1').all();
  for (const s of sups) {
    const total = db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ?').get(s.id).c;
    const withAttrs = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").get(s.id).c;
    const sample = db.prepare("SELECT attributes FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != '' LIMIT 1").get(s.id);
    let numKeys = 0;
    if (sample) { try { numKeys = Object.keys(JSON.parse(sample.attributes)).length; } catch(_) {} }
    const pct = total > 0 ? ((withAttrs / total) * 100).toFixed(1) : '0.0';
    console.log(`  ${s.name.padEnd(15)} | ${String(total).padStart(6)} | ${String(withAttrs).padStart(6)} with attrs (${pct}%) | sample: ${numKeys} keys`);
  }
}

main().catch(e => console.error('Fatal:', e));
