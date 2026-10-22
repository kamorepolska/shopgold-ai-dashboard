const path = require('path');
const sourcingSvc = require('./backend/services/sourcingService');
const catalogSvc = require('./backend/services/catalogService');
const db = require('better-sqlite3')(path.join(__dirname, 'data', 'idealpc', 'shopgold_cache.db'));

sourcingSvc._setDataDir(path.join(__dirname, 'data', 'idealpc'));

async function run() {
  try {
    console.log('1. Clearing old category attributes and product attributes...');
    db.prepare('DELETE FROM product_attributes').run();
    db.prepare('DELETE FROM category_attributes').run();
    console.log('Cleared.');

    console.log('2. Regenerating Attributes from scratch...');
    // We already fixed batchGenerateAttributes to call populateProductAttributesFromRaw!
    const result = await catalogSvc.batchGenerateAttributes(db, false);
    console.log('Attributes generated:', result);

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
