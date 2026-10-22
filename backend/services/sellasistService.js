'use strict';
const { settingsOps } = require('../models/localDb');

/**
 * Parse weight from various formats — handles Polish comma (0,070) and string inputs.
 * Returns weight as a float in kg (original unit from Sellasist).
 */
function parseWeight(val) {
  if (typeof val === 'number') return val || 0;
  if (!val) return 0;
  const s = String(val).replace(',', '.').replace(/[^0-9.]/g, '');
  return parseFloat(s) || 0;
}
function getApiKey() {
  return settingsOps.get('sellasist_api_key') || '';
}

function getAccountName() {
  return settingsOps.get('sellasist_account') || '';
}

/**
 * Zwraca bazowy URL do Sellasist API.
 * Format: https://{account}.sellasist.pl/api/v1
 */
function getBaseUrl(account) {
  const acc = (account || getAccountName() || '').trim();
  if (!acc) throw new Error('Brak podanej nazwy konta (subdomeny) Sellasist w Ustawieniach.');
  // Remove any accidental protocol or .sellasist.pl suffix user might have entered
  const cleanAcc = acc
    .replace(/^https?:\/\//i, '')
    .replace(/\.sellasist\.pl.*$/i, '')
    .replace(/\//g, '')
    .trim();
  if (!cleanAcc) throw new Error('Nieprawidłowa nazwa konta Sellasist.');
  return `https://${cleanAcc}.sellasist.pl/api/v1`;
}

/**
 * Podstawowa funkcja wysyłająca zapytania do Sellasist API.
 * 
 * @param {string} endpoint - ścieżka np. '/products'
 * @param {object} options - opcje fetch
 * @param {string} [token] - opcjonalnie przekazany klucz (jeśli nie, używa z DB)
 * @param {string} [account] - opcjonalnie przekazane konto (jeśli nie, używa z DB)
 */
async function fetchApi(endpoint, options = {}, token = null, account = null) {
  const apiKey = token || getApiKey();
  if (!apiKey) throw new Error('Brak skonfigurowanego klucza API Sellasist. Dodaj go w Ustawieniach → Integracje.');

  const customBase = getBaseUrl(account);
  
  // Sellasist API might be hosted on the custom sub-domain, OR the central panel, OR api.sellasist.pl
  const basesToTry = [
    customBase,
    'https://panel.sellasist.pl/api/v1',
    'https://api.sellasist.pl/v1',
    'https://api.sellasist.pl/api/v1'
  ];
  
  let lastError = null;

  for (const base of basesToTry) {
    const url = `${base}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      'X-Api-Key': apiKey,
      ...(options.headers || {})
    };

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(15000),
      });

      if (res.status === 404) {
        lastError = new Error(`Endpoint nie znaleziony (404). URL: ${url}. Sprawdź nazwę konta Sellasist.`);
        continue; // Try next base URL
      }
      
      if (!res.ok) {
        let errMsg = `HTTP ${res.status} ${res.statusText}`;
        try {
          const text = await res.text();
          console.log(`[Sellasist] Error body: ${text.substring(0, 500)}`);
          try {
            const e = JSON.parse(text);
            errMsg = e.error || e.message || e.detail || errMsg;
          } catch {
            if (text.length < 200) errMsg = text || errMsg;
          }
        } catch {}
        
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Błąd autoryzacji Sellasist (${res.status}). Sprawdź czy API Key jest poprawny.`);
        }
        throw new Error(`Sellasist API: ${errMsg}`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('json')) {
        return await res.json();
      }
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { raw: text }; }
      
    } catch (e) {
      if (e.name === 'TimeoutError' || e.message?.includes('timeout')) {
        lastError = new Error(`Sellasist API: Przekroczono limit czasu (15s). Serwer ${base} nie odpowiada.`);
        continue;
      }
      if (e.cause?.code === 'ENOTFOUND' || e.message?.includes('ENOTFOUND')) {
        lastError = new Error(`Nie można połączyć z ${base} — domena nie istnieje. Sprawdź nazwę konta.`);
        continue;
      }
      if (e.cause?.code === 'ECONNREFUSED' || e.message?.includes('ECONNREFUSED')) {
        lastError = new Error(`Nie można połączyć z ${base} — połączenie odrzucone.`);
        continue;
      }
      // If it's an authorization error, stop trying other URLs, the URL is probably correct but key is wrong
      if (e.message.includes('autoryzacji')) throw e;
      
      lastError = e;
    }
  }
  
  throw lastError || new Error('Nie udało się połączyć z Sellasist API (wszystkie próby zakończone niepowodzeniem).');
}

/**
 * Testuje połączenie pobierając pierwszą stronę produktów.
 * Opcjonalnie przyjmuje token i konto do testowania przed zapisem.
 */
async function testConnection(token = null, account = null) {
  try {
    const base = getBaseUrl(account);
    const effectiveKey = token || getApiKey();
    
    if (!effectiveKey) {
      return { ok: false, error: 'Brak klucza API Sellasist.' };
    }
    
    console.log(`[Sellasist] Test connection: ${base}`);
    try {
      const data = await fetchApi('/products', {}, effectiveKey, account);
      const products = Array.isArray(data) ? data : (data.items || data.data || data.products || []);
      const count = Array.isArray(data) ? data.length : (data.total || data.count || products.length || 0);

      if (products.length > 0) {
        try {
          require('fs').writeFileSync('sellasist_sample.json', JSON.stringify(products[0], null, 2));
          const extended = await fetchApi(`/products/${products[0].id}`, {}, effectiveKey, account);
          require('fs').writeFileSync('sellasist_extended_sample.json', JSON.stringify(extended, null, 2));
        } catch (e) {
          console.error('Failed to write sample:', e);
        }
      }

      return {
        ok: true,
        account: `Połączono pomyślnie z ${base}`,
        productsCount: count,
        data: products.length > 0 ? { sample: products[0] } : { empty: true }
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Pobiera wszystkie produkty ze stronicowaniem z Sellasist.
 * Wyciąga EAN, wagę oraz informacje o kanałach/integracjach.
 */
async function fetchAllProductsForSync(progressCallback = null) {
  let allItems = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  let seenIds = new Set();
  let pageNum = 0;
  let totalProductsEstimate = 0;
  
  while (hasMore) {
    pageNum++;
    console.log(`[Sellasist] Fetching products batch ${pageNum} (offset: ${offset}, limit: ${limit})...`);
    try {
      // Sellasist API uses limit/offset pagination (per API docs)
      const data = await fetchApi(`/products?limit=${limit}&offset=${offset}`);
      const products = Array.isArray(data) ? data : (data.items || data.data || data.products || []);
      
      if (pageNum === 1 && data && (data.total || data.count)) {
        totalProductsEstimate = data.total || data.count;
      }
      
      if (!products || products.length === 0) {
        hasMore = false;
        break;
      }
      
      if (progressCallback) {
        progressCallback(offset, totalProductsEstimate || 1000, `Pobieranie listy produktów (batch ${pageNum})...`);
      }
      
      let newCount = 0;
      
      // Map relevant fields and fetch extended info for weight & integrations
      const mapped = [];
      const batchSize = 5; // Small batches to avoid Sellasist rate limiting
      let extendedOk = 0, extendedFailed = 0, withWeight = 0;
      
      for (let i = 0; i < products.length; i += batchSize) {
        const chunk = products.slice(i, i + batchSize);
        
        // Small delay between batches to avoid API rate limiting
        if (i > 0) await new Promise(r => setTimeout(r, 200));
        
        // Fetch extended details concurrently for the chunk
        const chunkResults = await Promise.all(chunk.map(async (p) => {
          let extended = p;
          let gotExtended = false;
          if (p.id) {
            try {
              if (progressCallback) progressCallback(offset + i, totalProductsEstimate || 1000, `Pobieranie detali: ${p.name || p.id}...`);
              extended = await fetchApi(`/products/${p.id}`);
              gotExtended = true;
              extendedOk++;
            } catch(e) {
              extendedFailed++;
              // Fallback to basic info (which has no weight!)
            }
          }
          
          // Collect marketplace integrations (same for all variants of this product)
          let integrations = [];
          if (Array.isArray(extended.external_marketplaces)) {
            integrations.push(...extended.external_marketplaces.map(m => typeof m === 'string' ? m : m.marketplace || m.name || m.code || m.id));
          }
          if (Array.isArray(extended.external_offers_settings)) {
            integrations.push(...extended.external_offers_settings.map(m => typeof m === 'string' ? m : m.marketplace || m.name || m.code || m.id));
          }
          if (extended.integrations && typeof extended.integrations === 'object') {
            integrations.push(...Object.keys(extended.integrations).filter(k => extended.integrations[k]));
          }
          // Dynamically find any keys ending with _offers that have active listings (e.g., allegro_offers, erli_offers)
          for (const key of Object.keys(extended)) {
            if (key.endsWith('_offers') && Array.isArray(extended[key]) && extended[key].length > 0) {
              const platformName = key.replace('_offers', '');
              
              extended[key].forEach(offer => {
                // Ignore disabled/inactive offers
                if (offer.status !== 'active') return;

                const accountName = offer[`${platformName}_account_name`] || offer.account_name || offer.account || 'Nieznane';
                const acc = accountName.toLowerCase().trim();
                
                let company = 'Inne';
                if (['idealpc', 'new ideał', 'ideal_pc', 'outlet_idealpc', 'sklep_orico', 'twojeit', 'ideał', 'idealpc.pl', 'unitek-polska', 'inpost buy - idealpc', 'inpost buy - ideal'].includes(acc)) {
                  company = 'IDEAŁ';
                } else if (['prymus.store', 'empik prymus', 'panflash', 'pankabelek', 'prymus_store'].includes(acc)) {
                  company = 'Prymus';
                }
                
                // Format the platform nicely
                let displayPlatform = platformName.charAt(0).toUpperCase() + platformName.slice(1);
                if (platformName === 'external_marketplace') {
                  if (acc.includes('empik') || acc.includes('ideał')) displayPlatform = 'Empik';
                  else if (acc.includes('inpost')) displayPlatform = 'InPost';
                  else if (acc.includes('.pl') || acc.includes('store') || acc.includes('unitek')) displayPlatform = 'Sklep zewn.';
                  else displayPlatform = 'Platforma zewn.';
                }
                
                integrations.push(`[${company}] ${displayPlatform}/${accountName}`);
              });
            }
          }
          // Fallback root level flags
          const commonInt = ['allegro', 'ebay', 'shopee', 'erli', 'amazon', 'empik', 'morele', 'olx', 'arena'];
          if (integrations.length === 0) {
            for (const key of commonInt) {
              if (extended[key] || extended[`price_${key}`] || extended[`is_on_${key}`]) {
                integrations.push(key);
              }
            }
          }
          integrations = [...new Set(integrations.filter(Boolean))];
          
          // Product-level EAN & weight
          let mainEan = (extended.ean || extended.barcode || p.ean || p.barcode || '').toString().trim();
          let mainWeight = parseWeight(extended.weight || extended.weight_kg || p.weight || p.weight_kg || 0);
          
          let categories = [];
          if (Array.isArray(extended.categories)) {
            categories = extended.categories.map(c => ({ id: c.id, title: c.title, parent: c.parent }));
          }

          // Build result entries — one per variant EAN
          const entries = [];
          
          if (extended.variants && Array.isArray(extended.variants) && extended.variants.length > 0) {
            for (const v of extended.variants) {
              const vEan = (v.ean || v.barcode || '').toString().trim();
              if (!vEan) continue;
              const vWeight = parseWeight(v.weight || v.weight_kg) || mainWeight;
              entries.push({
                id: p.id,
                name: v.name || extended.name || p.name || '',
                ean: vEan,
                weight: vWeight,
                integrations,
                categories
              });
            }
          }
          
          // Also add the main product EAN if it has one and isn't already covered by variants
          if (mainEan && !entries.some(e => e.ean === mainEan)) {
            entries.push({
              id: p.id,
              name: extended.name || extended.title || p.name || '',
              ean: mainEan,
              weight: mainWeight,
              integrations,
              categories
            });
          }
          
          // Also add entries for additional_eans (products may have their
          // catalog_master EAN here instead of as the main EAN)
          const additionalEans = [
            ...(Array.isArray(extended.additional_eans) ? extended.additional_eans : []),
            ...(Array.isArray(p.additional_eans) ? p.additional_eans : [])
          ];
          for (const ae of additionalEans) {
            const aeStr = (typeof ae === 'object' ? (ae.ean || ae.barcode || ae.code || '') : ae).toString().trim();
            if (aeStr && !entries.some(e => e.ean === aeStr)) {
              entries.push({
                id: p.id,
                name: extended.name || extended.title || p.name || '',
                ean: aeStr,
                weight: mainWeight,
                integrations,
                categories
              });
            }
          }
          
          if (p.id) {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              newCount++;
            }
          } else {
            newCount++;
          }
          
          return entries;
        }));
        
        // Flatten: chunkResults is array of arrays
        for (const entries of chunkResults) {
          mapped.push(...entries.filter(r => r.ean));
        }
      }
      
      allItems = allItems.concat(mapped);
      const mappedWithWeight = mapped.filter(m => m.weight > 0).length;
      console.log(`[Sellasist] Batch ${pageNum}: ${products.length} products → ${mapped.length} EAN entries (${mappedWithWeight} with weight). Extended: ${extendedOk} ok, ${extendedFailed} failed.`);
      
      if (products.length < limit || newCount === 0) {
        hasMore = false;
        if (newCount === 0 && products.length >= limit) console.log(`[Sellasist] Stopped due to pagination infinite loop safeguard (no new IDs at offset ${offset}).`);
      } else {
        offset += products.length;
      }
    } catch(e) {
      console.error(`[Sellasist] Error fetching batch ${pageNum}:`, e.message);
      if (allItems.length === 0) throw e;
      hasMore = false; // Stop but return what we got
    }
  }
  
  return allItems;
}

module.exports = {
  getApiKey,
  getAccountName,
  getBaseUrl,
  testConnection,
  fetchApi,
  fetchAllProductsForSync
};
