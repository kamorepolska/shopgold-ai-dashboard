const db = require('better-sqlite3')('backend/data/profitability.db');
try {
  const row = db.prepare('SELECT * FROM catalog_master WHERE canonical_ean = ? OR all_eans LIKE ?').get('843367140008', '%"843367140008"%');
  require('fs').writeFileSync('catalog_debug.json', JSON.stringify(row || { found: false }, null, 2));
} catch(e) {
  require('fs').writeFileSync('catalog_debug.json', JSON.stringify({ error: e.message }));
}
