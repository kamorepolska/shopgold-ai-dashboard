const db = require('better-sqlite3')(require('path').join(__dirname, '..', 'data', 'idealpc', 'shopgold_cache.db'));
const r = db.prepare(`SELECT supplier_id, COUNT(*) as total, SUM(CASE WHEN attributes IS NOT NULL AND attributes != '{}' AND attributes != '' THEN 1 ELSE 0 END) as with_attrs FROM supplier_products GROUP BY supplier_id`).all();
r.forEach(x => console.log(`sup ${x.supplier_id}: ${x.total} products, ${x.with_attrs} with attrs`));

// Check total
const t = db.prepare('SELECT COUNT(*) as c FROM supplier_products').get();
console.log(`\nTotal: ${t.c} products`);

// Check if Wortman overwrite ruined something
const w = db.prepare("SELECT id, name, source_type, file_path, ftp_host FROM suppliers WHERE id = 32").get();
console.log(`\nWortman config: source_type=${w.source_type}, file_path=${w.file_path}, ftp_host=${w.ftp_host}`);
