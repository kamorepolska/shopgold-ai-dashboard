const db = require('better-sqlite3')(require('path').join(__dirname, '..', 'data', 'idealpc', 'shopgold_cache.db'));

// Check tables involved in Menedzer Cech
const tables = ['category_attributes', 'product_attributes', 'attr_aliases', 'catalog_master', 'product_categories'];
tables.forEach(t => {
  try {
    const r = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get();
    console.log(`${t}: ${r.c} rows`);
  } catch(e) {
    console.log(`${t}: TABLE MISSING (${e.message.substring(0, 50)})`);
  }
});

// Check raw attr keys from supplier_products (what getAttrManagerList does)
console.log('\n=== Raw attribute key diversity (sample of 10000) ===');
const rows = db.prepare("SELECT attributes FROM supplier_products WHERE attributes IS NOT NULL AND attributes != '{}' AND attributes != '' LIMIT 10000").all();
const keyMap = new Map();
for (const r of rows) {
  try {
    const obj = JSON.parse(r.attributes);
    for (const k of Object.keys(obj)) {
      if (k.trim().length < 2) continue;
      keyMap.set(k.trim(), (keyMap.get(k.trim()) || 0) + 1);
    }
  } catch(_) {}
}
console.log(`Found ${keyMap.size} unique keys from 10000 rows`);
const topKeys = [...keyMap.entries()].sort((a,b) => b[1]-a[1]).slice(0, 30);
topKeys.forEach(([k, c]) => console.log(`  ${k}: ${c}`));

// Check what mapped vs unmapped we get
console.log('\n=== Checking attr_aliases ===');
const aliases = db.prepare('SELECT * FROM attr_aliases').all();
console.log(`Total aliases: ${aliases.length}`);
aliases.slice(0, 10).forEach(a => console.log(`  "${a.alias}" → "${a.canonical_name}"`));

// Check category_attributes
console.log('\n=== category_attributes ===');
try {
  const ca = db.prepare('SELECT * FROM category_attributes LIMIT 10').all();
  console.log(`Sample: ${JSON.stringify(ca.slice(0, 3))}`);
} catch(e) { console.log(`Error: ${e.message}`); }
