const db = require('better-sqlite3')('data/idealpc/shopgold_cache.db');
const svc = require('./backend/services/sourcingService.js');
svc._setDataDir('data/idealpc');

async function refreshAll() {
  const ids = [17, 23, 25, 26]; // NTT, MX, NTC, Incom
  for (const id of ids) {
    try {
      console.log(`Refreshing supplier ${id}...`);
      const res = await svc.refreshSupplier(id);
      console.log(`Success ${id}:`, res);
    } catch(e) {
      console.error(`Failed ${id}:`, e.message);
    }
  }
}

refreshAll().then(() => process.exit(0));
