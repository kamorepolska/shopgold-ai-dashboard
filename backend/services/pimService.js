/**
 * PIM Service — zarządzanie produktami i SEO
 * Obsługuje pobieranie danych, generowanie treści AI, standaryzację parametrów
 */
const { complete, parseJsonResponse, estimateTokens, estimateCost, getEffectiveProvider, getEffectiveModel } = require('./aiService');
const { productOps, approvalOps, presetOps, settingsOps } = require('../models/localDb');
const xmlAdapter = require('../adapters/xmlAdapter');
const csvAdapter = require('../adapters/csvAdapter');
const mysqlAdapter = require('../adapters/mysqlAdapter');
const config = require('../config');

/**
 * Sync products from ShopGold into local cache
 */
async function syncProducts({ connectionType, xmlUrl, xmlContent, csvContent } = {}) {
  const type = connectionType || settingsOps.get('connection_type') || config.shopgold.connectionType;
  let products = [];

  let imported = 0;
  let skipped = 0;
  const { syncLogOps } = require('../models/localDb');
  
  try {
    switch (type) {
      case 'xml':
        if (xmlContent) {
          products = await xmlAdapter.parseUploadedXml(xmlContent);
        } else {
          const url = xmlUrl || settingsOps.get('xml_feed_url') || config.shopgold.xmlFeedUrl;
          products = await xmlAdapter.fetchProducts(url);
        }
        break;
      case 'csv':
        if (!csvContent) throw new Error('Brak zawartości pliku CSV do zaimportowania.');
        products = csvAdapter.parseCsv(csvContent);
        break;
      case 'mysql': {
        // Paginate through all products (shopgold can have thousands)
        const BATCH = 500;
        let offset = 0;
        while (true) {
          const batch = await mysqlAdapter.fetchProducts({ limit: BATCH, offset });
          if (!batch.length) break;
          products.push(...batch);
          if (batch.length < BATCH) break;
          offset += BATCH;
        }
        break;
      }
      default:
        throw new Error(`Nieznany typ połączenia: ${type}`);
    }

    // Upsert into local cache
    for (const p of products) {
      if (!p.shop_id) { skipped++; continue; }
      productOps.upsert(p);
      imported++;
    }

    syncLogOps.add({ module: 'pim', status: 'success', details: `Pobrano ${imported} produktów (pominięto ${skipped}) [tryb: ${type}]` });
    return { imported, skipped, total: products.length };
  } catch (err) {
    syncLogOps.add({ module: 'pim', status: 'error', details: `Błąd synchronizacji PIM: ${err.message}` });
    throw err;
  }
}

/**
 * Generate AI content for a single product
 */
async function generateForProduct(productId, presetId, options = {}) {
  const product = productOps.findById(productId);
  if (!product) throw new Error(`Produkt ${productId} nie znaleziony w cache.`);

  const preset = presetId
    ? presetOps.findById(presetId)
    : presetOps.findAll().find(p => p.is_default);

  if (!preset) throw new Error('Brak presetu promptu. Utwórz preset w Ustawieniach.');

  const userPrompt = buildUserPrompt(preset.user_prompt_template, product);
  const provider = options.provider || getEffectiveProvider();
  const model = options.model || getEffectiveModel(provider);

  let systemPrompt = preset.system_prompt;
  systemPrompt += "\n\nWAŻNE: Optymalizuj tekst pod kątem LLM (Semantic SEO, AI Search - ChatGPT, SGE). Na samym początku wygenerowanego pola `description` dodaj poprawny, rozbudowany i zminifikowany blok <script type=\"application/ld+json\"> (Product Schema) bazujący na danych, nazwie, opisie i atrybutach produktu.";

  // Cost estimation
  const inputTokens = estimateTokens(systemPrompt + userPrompt);
  const estimatedCost = estimateCost(inputTokens, 600, provider, model);

  const result = await complete(systemPrompt, userPrompt, { featureId: 'pim_generate' });
  const parsed = parseJsonResponse(result.text);

  // Validate and clamp
  const generated = {
    description: parsed.description ? parsed.description.substring(0, 3000) : '',
    meta_title: toSentenceCase((parsed.meta_title || '').substring(0, 60), product.name),
    meta_description: (parsed.meta_description || '').substring(0, 155),
    attributes_suggestions: parsed.attributes_suggestions || [],
    keywords: parsed.keywords || [],
  };

  // Build LD+JSON scripts safely from native JSON objects
  let ldJsonScripts = '';
  if (parsed.ld_json_product && typeof parsed.ld_json_product === 'object') {
    ldJsonScripts += '\n<script type="application/ld+json">\n' + JSON.stringify(parsed.ld_json_product, null, 2) + '\n</script>';
  }
  if (parsed.ld_json_faq && typeof parsed.ld_json_faq === 'object') {
    ldJsonScripts += '\n<script type="application/ld+json">\n' + JSON.stringify(parsed.ld_json_faq, null, 2) + '\n</script>';
  }
  // Fallback for older ld_json_scripts format if AI used it
  if (parsed.ld_json_scripts && typeof parsed.ld_json_scripts === 'string') {
    ldJsonScripts += '\n\n' + parsed.ld_json_scripts;
  }

  // If AI generated LD+JSON scripts, append it to the original description
  if (ldJsonScripts) {
    // If the AI didn't generate a new description, use the original one
    if (!generated.description) {
      generated.description = product.description || '';
    }
    generated.description += '\n' + ldJsonScripts;
  }

  // Queue approval items
  const approvalItems = [];
  
  let requestedFields = ['description', 'meta_title', 'meta_description', 'attributes_suggestions'];
  if (options.selectedFields && Array.isArray(options.selectedFields)) {
    requestedFields = options.selectedFields;
  } else if (preset.fields) {
    try { requestedFields = JSON.parse(preset.fields); } catch(e) {}
  }
  
  if (ldJsonScripts && !requestedFields.includes('description')) {
    requestedFields.push('description');
  }
  
  const standardFields = ['description', 'meta_title', 'meta_description'];

  for (const field of standardFields) {
    if (requestedFields.includes(field) && generated[field] && generated[field] !== product[field]) {
      approvalItems.push({
        product_id: product.id,
        shop_id: product.shop_id,
        product_name: product.name,
        field_name: field,
        value_before: product[field] || '',
        value_after: generated[field],
        ai_provider: provider,
        ai_model: model,
        prompt_preset: preset.name,
      });
    }
  }

  // Queue attribute suggestions
  if (requestedFields.includes('attributes_suggestions') && generated.attributes_suggestions && generated.attributes_suggestions.length > 0) {
    approvalItems.push({
      product_id: product.id,
      shop_id: product.shop_id,
      product_name: product.name,
      field_name: 'attributes_suggestions',
      value_before: JSON.stringify(product.attributes),
      value_after: JSON.stringify(generated.attributes_suggestions),
      ai_provider: provider,
      ai_model: model,
      prompt_preset: preset.name,
    });
  }

  if (approvalItems.length > 0) {
    approvalOps.add(approvalItems);
  }

  return {
    product,
    generated,
    approvalItems: approvalItems.length,
    usage: result.usage,
    estimatedCost,
    provider,
    model,
  };
}

/**
 * Batch generate for multiple products
 */
async function generateBatch(productIds, presetId, options = {}, onProgress = null) {
  const results = [];
  let processed = 0;
  let errors = 0;

  for (const id of productIds) {
    try {
      const result = await generateForProduct(id, presetId, options);
      results.push({ id, success: true, approvalItems: result.approvalItems });
    } catch (err) {
      results.push({ id, success: false, error: err.message });
      errors++;
    }
    processed++;
    if (onProgress) onProgress({ processed, total: productIds.length, errors });

    // Rate limiting — delay between requests
    if (processed < productIds.length) {
      await sleep(options.delayMs || 500);
    }
  }

  return { results, processed, errors };
}

/**
 * Standardize attributes for a product (analyze inconsistencies)
 */
async function standardizeAttributes(productId) {
  const product = productOps.findById(productId);
  if (!product) throw new Error(`Produkt ${productId} nie znaleziony.`);

  const systemPrompt = `Jesteś ekspertem ds. e-commerce PIM (Product Information Management). 
Analizujesz atrybuty produktów i sugerujesz ujednolicenia. Odpowiadaj WYŁĄCZNIE w JSON.`;

  const userPrompt = `Przeanalizuj poniższe atrybuty produktu i zaproponuj ujednolicenia:

Nazwa produktu: ${product.name}
Atrybuty: ${JSON.stringify(product.attributes, null, 2)}

Zwróć JSON:
{
  "issues": [
    {
      "attribute": "nazwa atrybutu",
      "current_value": "aktualna wartość",
      "issue_type": "unit_inconsistency | typo | missing_unit | wrong_format",
      "suggested_value": "poprawna wartość",
      "reason": "wyjaśnienie"
    }
  ],
  "missing_attributes": [
    {
      "name": "nazwa brakującego atrybutu",
      "suggested_value": "sugerowana wartość na podstawie opisu/nazwy",
      "importance": "high | medium | low"
    }
  ]
}`;

  const result = await complete(systemPrompt, userPrompt, { featureId: 'pim_standardize' });
  return parseJsonResponse(result.text);
}

/**
 * Estimate cost for batch processing
 */
function estimateBatchCost(productIds, presetId) {
  const preset = presetId
    ? presetOps.findById(presetId)
    : presetOps.findAll().find(p => p.is_default);

  if (!preset) return { error: 'Brak presetu' };

  const products = productIds.map(id => productOps.findById(id)).filter(Boolean);
  let totalInputTokens = 0;
  for (const p of products) {
    const userPrompt = buildUserPrompt(preset.user_prompt_template, p);
    let sysPrompt = preset.system_prompt;
    sysPrompt += "\n\nWAŻNE: Optymalizuj tekst pod kątem LLM (Semantic SEO, AI Search - ChatGPT, SGE). Na samym początku wygenerowanego pola `description` dodaj poprawny, rozbudowany i zminifikowany blok <script type=\"application/ld+json\"> (Product Schema) bazujący na danych, nazwie, opisie i atrybutach produktu.";
    totalInputTokens += estimateTokens(sysPrompt + userPrompt);
  }

  const estimatedOutputTokens = products.length * 600;
  const cost = estimateCost(totalInputTokens, estimatedOutputTokens, provider, model);

  return {
    products: products.length,
    inputTokens: totalInputTokens,
    outputTokens: estimatedOutputTokens,
    totalTokens: totalInputTokens + estimatedOutputTokens,
    estimatedCostUSD: cost.toFixed(4),
    provider,
    model,
  };
}

function buildUserPrompt(template, product) {
  return template
    .replace('{{name}}', product.name || '')
    .replace('{{category}}', product.category || '')
    .replace('{{description}}', product.description || '')
    .replace('{{attributes}}', JSON.stringify(product.attributes || {}))
    .replace('{{price}}', String(product.price || 0));
}

/**
 * Normalize a string to sentence case, preserving:
 *   - proper nouns extracted from the product name (brand, model)
 *   - all-caps acronyms (USB, RAM, ANC)
 *   - mixed-case tech tokens (MacBook, Wi-Fi, eMMC, HyperSmooth)
 *   - number/unit tokens (16GB, 4K, M3, 5.3K)
 *
 * @param {string} str      - The string to normalise (e.g. AI-generated meta_title)
 * @param {string} [source] - Optional source text (e.g. product name) whose
 *                            capitalised words are treated as proper nouns.
 */
function toSentenceCase(str, source) {
  if (!str) return str;

  // Build a set of proper nouns from source (product name)
  // A token is a proper noun if it starts with uppercase in the source
  const properNouns = new Set();
  if (source) {
    source.split(/\s+/).forEach(w => {
      const core = w.replace(/[^a-zA-Z0-9\'\"\-]/g, '');
      if (core.length > 1 && /^[A-Z]/.test(core)) {
        properNouns.add(core.toLowerCase()); // store lowercase key for lookup
      }
    });
  }

  const seps = [];
  const tmpRe = /\s*[\u2013\u2014]\s*/g;
  let m;
  while ((m = tmpRe.exec(str)) !== null) seps.push(m[0]);
  const segments = str.split(/\s*[\u2013\u2014]\s*/);

  const processSegment = (seg, isFirst) => {
    return seg.split(' ').map((word, idx) => {
      if (!word) return word;
      const trail = word.match(/[.,;:!?]+$/) ? word.match(/[.,;:!?]+$/)[0] : '';
      const core = trail ? word.slice(0, -trail.length) : word;

      // First word of segment: always sentence-start capital
      if (idx === 0) {
        return core[0].toUpperCase() + core.slice(1) + trail;
      }

      // All-caps acronym (USB, RAM, ANC, SSD, AI, PC) — keep
      if (/^[A-Z]{2,}$/.test(core)) return word;

      // Tech model codes: letters + digits combo (WH-1000XM5, M3, 4K, 16GB, HERO12)
      if (/^[A-Z0-9][A-Z0-9\-\.]*[0-9][A-Z0-9\-\.]*$/.test(core)) return word;

      // Starts with digit (16", 5.3K, 4th)
      if (/^\d/.test(core)) return word;

      // Mixed-case proper noun (MacBook, HyperSmooth, eMMC, Wi-Fi)
      if (/[a-z][A-Z]/.test(core)) return word;

      // Known proper noun from product name (Wenger, Sony, Samsonite, Pro, Black…)
      const coreKey = core.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (properNouns.has(coreKey)) return word;

      // Everything else: lowercase
      return core[0].toLowerCase() + core.slice(1) + trail;
    }).join(' ');
  };

  const result = segments.map((seg, i) => processSegment(seg, i === 0));
  return result.reduce((acc, seg, i) => i === 0 ? seg : acc + (seps[i - 1] || ' \u2013 ') + seg, '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getPresets() {
  return presetOps.findAll();
}

async function generateRelations(productIds, relationTypes = ['podobne', 'powiazane', 'akcesoria', 'warianty']) {
  if (!productIds || !productIds.length) return { proposals: 0 };
  
  const allProducts = productOps.findAll({ limit: 5000 });
  const catalogContext = allProducts.map(p => ({
    id: p.shop_id,
    name: p.name,
    category: p.category
  }));

  const targetProducts = productIds.map(id => productOps.findById(id)).filter(Boolean);
  if (!targetProducts.length) throw new Error('Nie znaleziono wybranych produktów');
  // Map each ShopGold relation type → AI prompt description + JSON key
  const TYPE_DEFS = {
    podobne: {
      label: 'Produkty podobne',
      desc: 'Alternatywne produkty tej samej kategorii lub o podobnym przeznaczeniu. Klient trafia tu gdy główny produkt mu nie pasuje (inny rozmiar, inna cena). Zwróć tablicę {shop_id, name}.',
      json: '"podobne": [ {"shop_id": "ID", "name": "nazwa"} ]',
    },
    powiazane: {
      label: 'Produkty powiązane',
      desc: 'Cross-sell — produkty, które klient może chcieć kupić RAZEM z produktem głównym (np. torba + kłódka, telefon + słuchawki). Zwróć tablicę {shop_id, name, reason}.',
      json: '"powiazane": [ {"shop_id": "ID", "name": "nazwa", "reason": "dlaczego warto kupić razem"} ]',
    },
    akcesoria: {
      label: 'Akcesoria dodatkowe',
      desc: 'Dedykowane akcesoria do tego konkretnego produktu (etui, ładowarka, pokrowiec, kabel). Muszą być kompatybilne. Zwróć tablicę {shop_id, name}.',
      json: '"akcesoria": [ {"shop_id": "ID", "name": "nazwa akcesorium"} ]',
    },
    linki: {
      label: 'Powiązane linki',
      desc: 'Linki zewnętrzne powiązane z produktem — strona producenta, instrukcja PDF, certyfikat, film instruktażowy. Zwróć tablicę {url, title}. Jeśli nie wiesz URL — pomiń.',
      json: '"linki": [ {"url": "https://...", "title": "Tytuł linku"} ]',
    },
    warianty: {
      label: 'Inne warianty produktu',
      desc: 'Ten sam produkt w innym kolorze, rozmiarze, pojemności lub wersji (np. ta sama koszulka ale rozmiar XL, ten sam plecak ale czarny). Muszą mieć BARDZO podobną nazwę. Zwróć tablicę {shop_id, name, variant_feature}.',
      json: '"warianty": [ {"shop_id": "ID", "name": "nazwa", "variant_feature": "np. kolor: czarny"} ]',
    },
  };

  const activeTypes = relationTypes.filter(t => TYPE_DEFS[t]); // 'akceptacja' is frontend-only filter
  if (!activeTypes.length) return { proposals: 0 };

  const typesDesc = activeTypes.map((t, i) => `${i+1}. **${TYPE_DEFS[t].label}**: ${TYPE_DEFS[t].desc}`);
  const jsonDesc  = activeTypes.map(t => `         ${TYPE_DEFS[t].json}`);

  const systemPrompt = `Jesteś ekspertem e-commerce ds. merchandisingu i budowy katalogu produktowego.
Otrzymasz "Katalog Sklepu" (lista produktów) oraz "Produkty Docelowe". 
Twoim zadaniem jest dla każdego produktu docelowego dobrać odpowiednie relacje z produktów w katalogu.

Typy relacji do wygenerowania:
${typesDesc.join('\n')}

Zwróć wynik jako JSON:
{
  "proposals": [
    {
      "product_id": "ID_systemowe_produktu_docelowego",
      "shop_id": "ID_sklepu_produktu_docelowego",
      "product_name": "Nazwa produktu docelowego",
      "relations": {
${jsonDesc.join(',\n')}
      }
    }
  ]
}
Zasady:
- Używaj shop_id z Katalogu Sklepu, nie wymyślaj własnych
- Jeśli nic sensownego nie znajdziesz dla danego typu — zwróć pustą tablicę []
- Jeden produkt katalogowy może być relacją do wielu produktów docelowych`;

  const userPrompt = `
Katalog Sklepu:
${JSON.stringify(catalogContext)}

Produkty Docelowe:
${JSON.stringify(targetProducts.map(p => ({
  product_id: p.id,
  shop_id: p.shop_id,
  name: p.name,
  category: p.category,
  description: p.description
})))}

Zwróć wynik w wymaganym formacie JSON.`;

  const result = await complete(systemPrompt, userPrompt, { featureId: 'pim_relations' });
  const parsed = parseJsonResponse(result.text);

  if (!parsed || !parsed.proposals) {
    throw new Error('AI nie zwróciło poprawnego formatu propozycji relacji.');
  }

  const approvalItems = [];
  for (const prop of parsed.proposals) {
    const r = prop.relations || {};
    for (const t of activeTypes) {
      if (r[t] && r[t].length > 0) {
        approvalItems.push({
          product_id: prop.product_id,
          shop_id: prop.shop_id,
          product_name: prop.product_name,
          field_name: 'relation_' + t,
          value_before: '',
          value_after: JSON.stringify(r[t]),
          ai_provider: provider,
          ai_model: model,
          prompt_preset: `Relacje AI — ${TYPE_DEFS[t].label}`,
        });
      }
    }
  }

  if (approvalItems.length > 0) {
    approvalOps.add(approvalItems);
  }

  return { proposals: approvalItems.length };
}

/**
 * Standardize bulk parameter values
 */
async function standardizeParameters(featureId, featureName, values) {
  if (!values || !values.length) return { proposals: 0 };
  const systemPrompt = `Jesteś ekspertem ds. czystości danych (Data Cleansing) w e-commerce.
Twoim zadaniem jest ujednolicenie rozbieżnych wartości parametrów (cech) dla produktów.
Dostaniesz nazwę parametru (np. "Długość", "Materiał") oraz listę wszystkich unikalnych wartości, które aktualnie występują w bazie sklepu (z błędami, spacjami, itp.).

Zwróć wynik jako JSON reprezentujący mapę poprawek (stara wartość -> nowa ujednolicona wartość).
Zwracaj TYLKO wartości, które faktycznie wymagają poprawy/ujednolicenia na coś innego. 
Ignoruj wartości poprawne lub takie, których nie da się w żaden sensowny sposób połączyć.

Przykład wejścia: "15cm", "15 cm", "15", "Brak", "brak danych"
Przykładowy wynik JSON:
{
  "mappings": {
    "15cm": "15 cm",
    "15": "15 cm",
    "Brak": "brak",
    "brak danych": "brak"
  }
}
Odpowiadaj czystym JSON bez dodatkowego formatowania.`;

  const userPrompt = `
Parametr (Cecha): ${featureName}
Zarejestrowane w sklepie wartości:
${JSON.stringify(values, null, 2)}
`;

  const result = await complete(systemPrompt, userPrompt, { featureId: 'pim_standardize_bulk' });
  const parsed = parseJsonResponse(result.text);

  if (!parsed || !parsed.mappings) {
    throw new Error('AI nie zwróciło poprawnego formatu mapowania.');
  }

  const mappings = parsed.mappings;
  const approvalItems = [];
  
  // Each mapping is a proposal to change "oldValue" to "newValue" globally for this feature
  for (const [oldVal, newVal] of Object.entries(mappings)) {
    if (oldVal === newVal) continue;
    
    // Create an approval queue item for this parameter change
    // Since it's a global change, we can use a generic "product_id" or "shop_id" = 'GLOBAL'
    // and store featureId in product_id
    approvalItems.push({
      product_id: featureId, // Use product_id field for featureId
      shop_id: 'PARAM',      // Mark as parameter update
      product_name: `Parametr: ${featureName}`,
      field_name: 'parameter_standardize',
      value_before: oldVal,
      value_after: newVal,
      ai_provider: provider,
      ai_model: model,
      prompt_preset: 'Ujednolicanie Parametrów',
    });
  }

  if (approvalItems.length > 0) {
    approvalOps.add(approvalItems);
  }

  return { proposals: approvalItems.length };
}

async function manualMergeValues(featureId, featureName, sourceValues, targetValue) {
  const approvalItems = [];
  
  for (const oldVal of sourceValues) {
    if (oldVal === targetValue) continue;
    
    approvalItems.push({
      product_id: null,
      shop_id: `PARAM_${featureId}`,
      product_name: `Parametr: ${featureName}`,
      field_name: 'parameter_standardize',
      value_before: oldVal,
      value_after: targetValue,
      ai_provider: 'manual',
      ai_model: 'user',
      prompt_preset: 'Ręczne scalanie'
    });
  }

  if (approvalItems.length > 0) {
    approvalOps.add(approvalItems);
  }

  return { proposals: approvalItems.length };
}

async function mergeParameterNames(featureIds, targetName) {
  const approvalItems = [];
  
  for (const id of featureIds) {
    approvalItems.push({
      product_id: null,
      shop_id: `PARAM_NAME_${id}`,
      product_name: `Zmień i Scal Nazwę Parametru`,
      field_name: 'parameter_merge_name',
      value_before: `feature_id: ${id}`,
      value_after: targetName,
      ai_provider: 'manual',
      ai_model: 'user',
      prompt_preset: 'Scalanie nazw'
    });
  }

  if (approvalItems.length > 0) {
    approvalOps.add(approvalItems);
  }

  return { proposals: approvalItems.length };
}

module.exports = { syncProducts, generateForProduct, generateBatch, standardizeAttributes, estimateBatchCost, getPresets, generateRelations, standardizeParameters, manualMergeValues, mergeParameterNames };


