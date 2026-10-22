const fs = require('fs');
const db = require('better-sqlite3')('data/idealpc/shopgold_cache.db');

const csvPath = 'data/sourcing_uploads/1778181416233-593984.CSV';
const lines = fs.readFileSync(csvPath, 'utf8').split('\n');

const header = lines[0].split('\t'); // Looks like it's tab separated from earlier log
const eanIdx = header.findIndex(h => h.includes('EAN'));
const partNoIdx = header.findIndex(h => h.includes('PartNo'));

if (eanIdx < 0 || partNoIdx < 0) {
  console.log('Cannot find EAN or PartNo in headers:', header);
  process.exit(1);
}

let updated = 0;
let masterUpdated = 0;

const updateSp = db.prepare('UPDATE supplier_products SET manufacturer_code = ? WHERE supplier_id = 9 AND ean = ?');
const updateCm = db.prepare("UPDATE catalog_master SET manufacturer_code = ? WHERE canonical_ean = ? AND (manufacturer_code IS NULL OR manufacturer_code = '')");

db.transaction(() => {
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split('\t');
    if (row.length <= eanIdx || row.length <= partNoIdx) continue;
    
    const ean = row[eanIdx].trim();
    const partNo = row[partNoIdx].trim();
    
    if (ean && partNo) {
      const res1 = updateSp.run(partNo, ean);
      if (res1.changes > 0) updated++;
      
      const res2 = updateCm.run(partNo, ean);
      if (res2.changes > 0) masterUpdated++;
    }
  }
})();

console.log(`Updated supplier_products: ${updated}, catalog_master: ${masterUpdated}`);
