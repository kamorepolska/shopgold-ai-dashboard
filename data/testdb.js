const db=require('better-sqlite3')('data/idealpc/shopgold_cache.db');
console.log('Filled supplier mfr codes:', db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE manufacturer_code IS NOT NULL AND manufacturer_code !=""').get().c);
console.log('Filled catalog mfr codes:', db.prepare('SELECT COUNT(*) as c FROM catalog_master WHERE manufacturer_code IS NOT NULL AND manufacturer_code !=""').get().c);
