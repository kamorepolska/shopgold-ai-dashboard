const db = require('better-sqlite3')('c:/Users/USER/.gemini/antigravity/scratch/shopgold-ai-dashboard/data/shopgold_cache.db');
db.prepare("INSERT INTO supplier_files (supplier_id, label, file_type, source_type, source_url) VALUES (19, 'Pełna specyfikacja (SRP)', 'full', 'url', 'https://b2b.fen.pl/offers/b2b_price_list.xml')").run();
console.log('OK');
