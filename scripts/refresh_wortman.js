// Re-parse Wortman from cached FTP file with new extraction logic
const sourcingService = require('../backend/services/sourcingService.js');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, '..', 'data', 'idealpc', 'shopgold_cache.db'));

// Check cached FTP files
const uploadDir = path.join(__dirname, '..', 'data', 'sourcing_uploads');
const cached = fs.readdirSync(uploadDir).filter(f => f.startsWith('ftp_32_')).sort();
const lastFile = cached[cached.length - 1];

if (!lastFile) {
  console.log('No cached Wortman FTP file found');
  process.exit(1);
}

const filePath = path.join(uploadDir, lastFile);
console.log(`Using cached FTP file: ${filePath}`);
console.log(`Size: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB`);

// Update the supplier's file_path to point to the cached file
db.prepare('UPDATE suppliers SET file_path = ? WHERE id = 32').run(filePath);
db.prepare("UPDATE suppliers SET source_type = 'file' WHERE id = 32").run();

async function main() {
  try {
    const result = await sourcingService.refreshSupplier(32);
    console.log('\nRefresh OK');
  } catch(e) {
    console.error('Error:', e.message);
  }
  
  const total = db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = 32').get().c;
  const withAttrs = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = 32 AND attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").get().c;
  const sample = db.prepare("SELECT attributes FROM supplier_products WHERE supplier_id = 32 AND attributes IS NOT NULL AND attributes != '{}' AND attributes != '' LIMIT 1").get();
  
  console.log(`\nWortman: ${total} products, ${withAttrs} with attrs`);
  if (sample) {
    const parsed = JSON.parse(sample.attributes);
    console.log(`Sample keys (${Object.keys(parsed).length}): ${Object.keys(parsed).join(', ')}`);
  }
  
  // Restore original FTP settings
  db.prepare("UPDATE suppliers SET source_type = 'ftp' WHERE id = 32").run();
}

main();
