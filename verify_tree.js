const svc = require('./backend/services/sourcingService');
const db = svc.getDb();
const roots = db.prepare('SELECT id, name FROM product_categories WHERE is_ab_category = 1 AND parent_id IS NULL ORDER BY name ASC').all();
for (const root of roots) {
  const children = db.prepare('SELECT name FROM product_categories WHERE is_ab_category = 1 AND parent_id = ? ORDER BY name ASC').all(root.id);
  console.log('\\n-- ' + root.name + ' --');
  console.log(children.map(c => '  ' + c.name).join('\\n'));
}
