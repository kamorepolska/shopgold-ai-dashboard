const db = require('better-sqlite3')('data/idealpc/shopgold_cache.db');
const svc = require('./backend/services/sourcingService.js');
svc._setDataDir('data/idealpc');
svc.refreshSupplier(db, 9).then(res => {
  console.log('Supplier 9 refreshed:', res);
  // Also refresh 10 and 11 since they are other wholesalers the user mentioned or might be useful
  return svc.refreshSupplier(db, 10);
}).then(res => {
  console.log('Supplier 10 refreshed:', res);
  return svc.refreshSupplier(db, 11);
}).then(res => {
  console.log('Supplier 11 refreshed:', res);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
