const mysqlAdapter = require('./backend/adapters/mysqlAdapter');
async function run() {
  const cols = await mysqlAdapter.getTableColumns('products');
  console.log('Products cols:', cols.map(c => c.Field).join(', '));
  const descCols = await mysqlAdapter.getTableColumns('products_description');
  console.log('products_description cols:', descCols.map(c => c.Field).join(', '));
  mysqlAdapter.closePool();
}
run().catch(console.error);
