const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'idealpc', 'shopgold_cache.db');
const db = new Database(dbPath);

// Check what warranty/condition values exist for all suppliers
console.log('=== WARRANTY VALUES IN DB ===');
const warrValues = db.prepare(`
  SELECT s.name as sup, sp.warranty, COUNT(*) as cnt 
  FROM supplier_products sp 
  JOIN suppliers s ON s.id = sp.supplier_id 
  WHERE sp.warranty IS NOT NULL AND sp.warranty != '' 
  GROUP BY sp.supplier_id, sp.warranty 
  ORDER BY s.name, cnt DESC
`).all();
warrValues.forEach(r => console.log(`  ${r.sup}: warranty="${r.warranty}" (${r.cnt})`));

console.log('\n=== CONDITION VALUES IN DB ===');
const condValues = db.prepare(`
  SELECT s.name as sup, sp.condition, COUNT(*) as cnt 
  FROM supplier_products sp 
  JOIN suppliers s ON s.id = sp.supplier_id 
  GROUP BY sp.supplier_id, sp.condition 
  ORDER BY s.name, cnt DESC
`).all();
condValues.forEach(r => console.log(`  ${r.sup}: condition="${r.condition}" (${r.cnt})`));

// Check what restock returns for a couple of products from ab
console.log('\n=== RESTOCK DATA SAMPLE (ab products) ===');
const abSample = db.prepare(`
  SELECT sp.ean, sp.name, sp.manufacturer, sp.condition, sp.warranty,
         sp.price, sp.price_pln, sp.availability
  FROM supplier_products sp 
  WHERE sp.supplier_id = 10 
  AND sp.ean IN (SELECT ean FROM subiekt_products) 
  LIMIT 5
`).all();
abSample.forEach(r => console.log(JSON.stringify(r)));

// Same for ed
console.log('\n=== RESTOCK DATA SAMPLE (ed products) ===');
const edSample = db.prepare(`
  SELECT sp.ean, sp.name, sp.manufacturer, sp.condition, sp.warranty,
         sp.price, sp.price_pln, sp.availability
  FROM supplier_products sp 
  WHERE sp.supplier_id = 9 
  AND sp.ean IN (SELECT ean FROM subiekt_products) 
  LIMIT 5
`).all();
edSample.forEach(r => console.log(JSON.stringify(r)));

db.close();
