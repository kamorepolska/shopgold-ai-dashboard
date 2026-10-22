const syncService = require('./backend/services/esetSyncService');

(async () => {
    try {
        console.log('Testing ESET Sync Service...');
        await syncService.processNewOrders();
        console.log('Test completed.');
    } catch(e) {
        console.error('Test failed:', e);
    }
})();
