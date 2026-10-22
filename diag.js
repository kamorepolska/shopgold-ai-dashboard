const svc = require('./backend/services/sourcingService');
const db = svc.getDb();
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
console.log('Tables:', tables.join(', '));
console.log('Suppliers:', JSON.stringify(db.prepare('SELECT id,name,source_type FROM suppliers').all()));
const spCols = db.prepare('PRAGMA table_info(supplier_products)').all().map(r=>r.name);
console.log('supplier_products cols:', spCols.join(', '));
const supCount = db.prepare('SELECT COUNT(*) as c FROM supplier_products').get();
console.log('supplier_products rows:', supCount.c);
const subCount = db.prepare('SELECT COUNT(*) as c FROM subiekt_products').get();
console.log('subiekt_products rows:', subCount.c);
const restockExists = db.prepare("SELECT name FROM sqlite_master WHERE name='restock_overrides'").get();
console.log('restock_overrides:', restockExists ? 'YES' : 'NO');

// Test getMissingProducts
try {
  const r = svc.getMissingProducts({});
  console.log('getMissingProducts OK, rows:', r.rows ? r.rows.length : r.length);
} catch(e) { console.error('getMissingProducts ERR:', e.message); }

// Test buildRestockList
try {
  const r = svc.buildRestockList({});
  console.log('buildRestockList OK, total:', r.total);
} catch(e) { console.error('buildRestockList ERR:', e.message); }
