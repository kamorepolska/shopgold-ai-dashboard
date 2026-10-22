'use strict';
const express = require('express');
const router = express.Router();
const sellasistService = require('../services/sellasistService');

// ─── GET /api/sellasist/test ────────────────────────────────────────────────────
// Test connection using saved credentials
router.get('/test', async (req, res) => {
  try {
    const result = await sellasistService.testConnection();
    res.json(result);
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// ─── POST /api/sellasist/test ───────────────────────────────────────────────────
// Test connection with provided credentials (before save)
router.post('/test', async (req, res) => {
  try {
    const { sellasist_api_key, sellasist_account } = req.body;
    const result = await sellasistService.testConnection(
      sellasist_api_key || null,
      sellasist_account || null
    );
    res.json(result);
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// ─── GET /api/sellasist/products ────────────────────────────────────────────────
router.get('/products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const data = await sellasistService.fetchApi(`/products?limit=${limit}&page=${page}`);
    res.json(data);
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

// ─── GET /api/sellasist/orders ──────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const data = await sellasistService.fetchApi(`/orders?limit=${limit}`);
    res.json(data);
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});
// ─── POST /api/sellasist/sync ──────────────────────────────────────────────────
const sourcingService = require('../services/sourcingService');

// Global state for sync progress
let currentSyncState = {
  isRunning: false,
  progress: 0,
  total: 0,
  message: '',
  updatedWeight: 0,
  updatedListings: 0
};

router.post('/sync', (req, res) => {
  if (currentSyncState.isRunning) {
    return res.json({ ok: true, message: 'Synchronizacja jest już w trakcie działania. Zamknij ten komunikat i sprawdź postęp.' });
  }

  currentSyncState = {
    isRunning: true,
    progress: 0,
    total: 0,
    message: 'Rozpoczynanie pobierania...',
    updatedWeight: 0,
    updatedListings: 0
  };

  // Run asynchronously in background so the UI doesn't hang for 2 minutes
  res.json({
    ok: true,
    message: `Synchronizacja z Sellasist została uruchomiona w tle. Możesz zamknąć to okno i śledzić postęp obok przycisku.`
  });

  // Background process
  (async () => {
    try {
      console.log('[Sellasist] Background sync started...');
      const products = await sellasistService.fetchAllProductsForSync((progress, total, msg) => {
        currentSyncState.progress = progress;
        currentSyncState.total = total;
        if (msg) currentSyncState.message = msg;
      });
      
      if (!products || products.length === 0) {
        currentSyncState.isRunning = false;
        currentSyncState.message = 'Zakończono: brak produktów.';
        return;
      }
      
      currentSyncState.message = 'Aktualizowanie bazy danych...';
      const result = sourcingService.updateSellasistData(products);
      
      currentSyncState.updatedWeight = result.updatedWeight;
      currentSyncState.updatedListings = result.updatedListings;
      currentSyncState.message = `Zakończono pomyślnie. Zaktualizowano ${result.updatedWeight} wag i ${result.updatedListings} wystawień.`;
      currentSyncState.isRunning = false;
    } catch(e) {
      console.error('[Sellasist] Background sync failed:', e.message);
      currentSyncState.isRunning = false;
      currentSyncState.message = 'Błąd synchronizacji: ' + e.message;
    }
  })();
});

router.get('/sync-status', (req, res) => {
  res.json(currentSyncState);
});

// Public test route to force sync (runs synchronously and returns result to browser)
router.get('/sync-force', async (req, res) => {
  try {
    console.log('[Sellasist] FORCE Background sync started...');
    const products = await sellasistService.fetchAllProductsForSync();
    if (!products || products.length === 0) {
      console.log('[Sellasist] Background sync finished: no products/variants fetched.');
      return res.json({ error: 'No products fetched' });
    }
    
    const withWeight = products.filter(p => p.weight > 0).length;
    const withIntegrations = products.filter(p => p.integrations && p.integrations.length > 0).length;
    console.log(`[Sellasist] Fetched ${products.length} EAN entries (${withWeight} with weight, ${withIntegrations} with marketplace info)`);
    
    const result = sourcingService.updateSellasistData(products);
    console.log(`[Sellasist] Background sync finished: ${result.updatedWeight} weights updated, ${result.insertedWeight || 0} new products, ${result.updatedListings} listings.`);
    
    res.json({
      success: true,
      fetchedProducts: products.length,
      withWeight,
      withIntegrations,
      dbUpdates: result
    });
  } catch(e) {
    console.error('[Sellasist] Background sync failed:', e.message);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// ─── GET /api/sellasist/debug/:ean ──────────────────────────────────────────────
router.get('/debug/:ean', async (req, res) => {
  try {
    const ean = req.params.ean;
    // Use dedicated ean parameter for exact match (per API docs), fallback to search
    let data = await sellasistService.fetchApi(`/products?ean=${ean}`);
    let products = Array.isArray(data) ? data : (data.items || data.data || data.products || []);
    if (!products.length) {
      data = await sellasistService.fetchApi(`/products?search=${ean}`);
      products = Array.isArray(data) ? data : (data.items || data.data || data.products || []);
    }
    
    if (products.length === 0) {
       return res.json({ error: 'Nie znaleziono produktu o takim EAN w Sellasist' });
    }
    
    const basic = products[0];
    const extended = await sellasistService.fetchApi(`/products/${basic.id}`);
    
    const db = sourcingService.getDb();
    const localBefore = db.prepare('SELECT canonical_ean, all_eans, weight_g FROM catalog_master WHERE canonical_ean = ? OR all_eans LIKE ?').get(ean, `%"${ean}"%`);
    
    // Parse weight safely (handles comma format like "0,070")
    function parseWeight(val) {
      if (typeof val === 'number') return val || 0;
      if (!val) return 0;
      return parseFloat(String(val).replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
    }
    
    // Force update local DB
    let forcedWeightGrams = 0;
    let rawWeightValues = {};
    if (extended) {
      rawWeightValues = {
        'extended.weight': extended.weight,
        'extended.weight_kg': extended.weight_kg,
        'basic.weight': basic.weight,
        'basic.weight_kg': basic.weight_kg,
        'typeof extended.weight': typeof extended.weight,
      };
      
      let weight = extended.weight || extended.weight_kg || basic.weight || basic.weight_kg || 0;
      if (extended.variants && Array.isArray(extended.variants) && extended.variants.length > 0) {
        const variant = extended.variants.find(v => (v.ean || v.barcode) === ean) || extended.variants[0];
        rawWeightValues['variant.weight'] = variant.weight;
        rawWeightValues['variant.weight_kg'] = variant.weight_kg;
        if (!parseWeight(weight)) {
          weight = variant.weight || variant.weight_kg || weight;
        }
      }
      rawWeightValues['selectedWeight'] = weight;
      rawWeightValues['parsedKg'] = parseWeight(weight);
      
      forcedWeightGrams = Math.round(parseWeight(weight) * 1000);
      rawWeightValues['forcedWeightGrams'] = forcedWeightGrams;
      
      if (forcedWeightGrams > 0) {
        db.prepare('UPDATE catalog_master SET weight_g = ? WHERE canonical_ean = ? OR all_eans LIKE ?').run(forcedWeightGrams, ean, `%"${ean}"%`);
      }
    }

    const localAfter = db.prepare('SELECT canonical_ean, all_eans, weight_g FROM catalog_master WHERE canonical_ean = ? OR all_eans LIKE ?').get(ean, `%"${ean}"%`);
    
    const result = {
      ean_searched: ean,
      raw_weight_debug: rawWeightValues,
      sellasist_basic: basic,
      sellasist_extended: extended,
      local_db_before: localBefore || 'NOT_FOUND',
      local_db_after: localAfter || 'NOT_FOUND'
    };
    
    require('fs').writeFileSync('sellasist_debug_' + ean + '.json', JSON.stringify(result, null, 2));
    
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
