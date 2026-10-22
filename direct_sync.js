// Direct sync script — bypasses HTTP, runs pimService.syncProducts directly
// Use: node direct_sync.js

const { syncProducts } = require('./backend/services/pimService');

(async () => {
  console.log('=== Uruchamiam synchronizację produktów ze sklepu Ideał ===');
  console.log('Host: idealpc.pl | Baza: ideal_sklepideal | User: ideal_sklep');
  try {
    const result = await syncProducts({ connectionType: 'mysql' });
    console.log('\n✅ SYNCHRONIZACJA ZAKOŃCZONA:');
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('\n❌ BŁĄD SYNCHRONIZACJI:', e.message);
    console.error(e);
  }
})();
