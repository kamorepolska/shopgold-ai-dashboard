const { getDb, initDb } = require('./backend/services/dbService.js');
const sourcing = require('./backend/services/sourcingService.js');

initDb();

// Test buildRestockList for supplier 'ab' (ID: 10)
const resAb = sourcing.buildRestockList({ supplierId: 10, limit: 5 });
let mfgFound = 0;
let total = 0;

if (resAb.groups && resAb.groups.length > 0) {
  const rows = resAb.groups[0].rows;
  total = rows.length;
  console.log('Sample rows from ab:');
  rows.slice(0, 5).forEach(r => {
    console.log(`EAN: ${r.ean}, Name: ${r.name?.substring(0,30)}, Mfg: ${r.manufacturer}`);
    if (r.manufacturer) mfgFound++;
  });
}

console.log(`\nFound manufacturer for ${mfgFound} out of ${Math.min(total, 5)} sampled products for ab.`);
