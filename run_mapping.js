const svc = require('./backend/services/sourcingService');
const catalogSvc = require('./backend/services/catalogService');
const db = svc.getDb();
console.log('Mapping categories...');
const resCat = catalogSvc.mergeAndNormalizeCategories(db);
console.log('Normalized cats:', resCat);

console.log('Starting keyword mapping for all products...');
const resProd = catalogSvc.aiAssignUnmappedProducts(db, { useAi: false, limit: 100000 });
console.log('Products mapped:', resProd);

// Uruchom drugi raz, bo może coś zostało
const resProd2 = catalogSvc.aiAssignUnmappedProducts(db, { useAi: false, limit: 100000 });
console.log('Products mapped (run 2):', resProd2);

const unmapped = db.prepare(`
  SELECT COUNT(*) as c FROM catalog_master cm
  WHERE (cm.category_id IS NULL OR cm.category_id = 0)
`).get().c;
console.log('Remaining unmapped completely:', unmapped);

// Dodatkowo, sprawdź co w ogóle zostało (top nierozpoznane nazwy)
const remaining = db.prepare(`
  SELECT name, manufacturer, original_names, COUNT(*) as c 
  FROM catalog_master 
  WHERE (category_id IS NULL OR category_id = 0)
  GROUP BY manufacturer, name
  ORDER BY c DESC LIMIT 10
`).all();
console.log('Przykłady nieprzypisanych po skrypcie:', remaining);
