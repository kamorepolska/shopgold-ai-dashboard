const express = require('express');
const router = express.Router();
const { productOps, qaOps, productCategoryOps, pimCategoryOps } = require('../models/localDb');
const { syncProducts, generateForProduct, generateBatch, standardizeAttributes, estimateBatchCost } = require('../services/pimService');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/products — list with filters
router.get('/', (req, res) => {
  try {
    const { search = '', category = '', group_tag = '', limit = 50, offset = 0, sort = '', order = 'desc' } = req.query;
    const products = productOps.findAll({ search, category, group_tag, limit: parseInt(limit), offset: parseInt(offset), sort, order });
    const total = productOps.count({ search, category, group_tag });
    const categories = productOps.categories();
    const groups = productOps.groups();
    res.json({ products, total, categories, groups, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products — create new product manually
router.post('/', (req, res) => {
  try {
    const { name, category, group_tag, description, meta_title, meta_description, price, attributes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa produktu jest wymagana' });
    const id = productOps.create({ name, category, group_tag, description, meta_title, meta_description, price, attributes });
    const product = productOps.findById(id);
    res.json({ success: true, id, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/export — export products to XML or CSV
router.get('/export', (req, res) => {
  try {
    const { format = 'csv', ids, category, group_tag, ai_only } = req.query;
    let products;

    if (ids) {
      const idList = ids.split(',').map(s => s.trim()).filter(Boolean);
      products = productOps.findByIds(idList);
    } else {
      // Export all with filters (no pagination limit)
      products = productOps.findAll({
        category: category || '',
        group_tag: group_tag || '',
        limit: 99999,
        offset: 0,
      });
    }

    // Optionally filter only AI-generated
    if (ai_only === '1') products = products.filter(p => p.ai_generated);

    if (format === 'csv') {
      const rows = [
        ['id', 'shop_id', 'name', 'category', 'group_tag', 'price', 'description', 'meta_title', 'meta_description'].join(';'),
        ...products.map(p => [
          csvEsc(p.id), csvEsc(p.shop_id), csvEsc(p.name), csvEsc(p.category || ''),
          csvEsc(p.group_tag || ''), p.price || '', csvEsc(p.description || ''),
          csvEsc(p.meta_title || ''), csvEsc(p.meta_description || ''),
        ].join(';')),
      ];
      const bom = '\uFEFF'; // UTF-8 BOM for Excel
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pim_export_${Date.now()}.csv"`);
      res.send(bom + rows.join('\r\n'));
    } else {
      // XML
      const xmlRows = products.map(p => {
        let attrsXml = '';
        try {
          const attrs = typeof p.attributes === 'string' ? JSON.parse(p.attributes) : (p.attributes || {});
          if (Object.keys(attrs).length > 0) {
            attrsXml = '\n    <attributes>\n' + Object.entries(attrs).map(([k, v]) => `      <attribute>\n        <attribute_name>${xmlEsc(k)}</attribute_name>\n        <attribute_value><![CDATA[${String(v)}]]></attribute_value>\n      </attribute>`).join('\n') + '\n    </attributes>';
          }
        } catch (e) {}

        let imgsXml = '';
        try {
          const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []);
          if (Array.isArray(imgs) && imgs.length > 0) {
            imgsXml = `\n    <image>${xmlEsc(imgs[0])}</image>`;
            for (let i = 1; i < imgs.length; i++) {
              imgsXml += `\n    <image_extra_${i}>${xmlEsc(imgs[i])}</image_extra_${i}>`;
            }
          }
        } catch (e) {}

        return `
  <product>
    <id>${xmlEsc(p.id)}</id>
    <shop_id>${xmlEsc(p.shop_id)}</shop_id>
    <name>${xmlEsc(p.name)}</name>
    <category>${xmlEsc(p.category || '')}</category>
    <group_tag>${xmlEsc(p.group_tag || '')}</group_tag>
    <price>${p.price || ''}</price>
    <description><![CDATA[${String(p.description || '')}]]></description>
    <meta_title>${xmlEsc(p.meta_title || '')}</meta_title>
    <meta_description>${xmlEsc(p.meta_description || '')}</meta_description>${imgsXml}${attrsXml}
  </product>`;
      }).join('');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<products>${xmlRows}\n</products>`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pim_export_${Date.now()}.xml"`);
      res.send(xml);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/sync — sync from ShopGold
router.post('/sync', upload.single('file'), async (req, res) => {
  try {
    const { connectionType, xmlUrl } = req.body;
    let xmlContent, csvContent;

    if (req.file) {
      const filename = req.file.originalname.toLowerCase();
      if (filename.endsWith('.xml')) xmlContent = req.file.buffer;
      else if (filename.endsWith('.csv')) csvContent = req.file.buffer;
      else return res.status(400).json({ error: 'Obsługiwane formaty pliku: XML, CSV' });
    }

    const result = await syncProducts({ connectionType, xmlUrl, xmlContent, csvContent });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/batch/generate — batch AI generation (SSE stream)
router.post('/batch/generate', async (req, res) => {
  try {
    const { productIds, presetId, provider, model, delayMs, selectedFields } = req.body;
    if (!productIds?.length) return res.status(400).json({ error: 'Brak listy productIds' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const onProgress = (progress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    };

    const result = await generateBatch(productIds, presetId, { provider, model, delayMs, selectedFields }, onProgress);
    res.write(`data: ${JSON.stringify({ done: true, ...result })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// POST /api/products/batch/estimate — estimate cost before generation
router.post('/batch/estimate', (req, res) => {
  try {
    const { productIds, presetId } = req.body;
    if (!productIds?.length) return res.status(400).json({ error: 'Brak productIds' });
    const estimate = estimateBatchCost(productIds, presetId);
    res.json(estimate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/relations/generate — generate AI relations for multiple products
router.post('/relations/generate', async (req, res) => {
  try {
    const { productIds, relationTypes } = req.body;
    if (!productIds || !Array.isArray(productIds)) return res.status(400).json({ error: 'Brak productIds' });
    
    // Import pimService lazily to avoid circular deps if any
    const { generateRelations } = require('../services/pimService');
    const result = await generateRelations(productIds, relationTypes);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/parameters — get all parameters from ShopGold
router.get('/parameters/all', async (req, res) => {
  try {
    const { category } = req.query;
    const mysqlAdapter = require('../adapters/mysqlAdapter');
    const params = await mysqlAdapter.getParameters(category);
    res.json({ success: true, items: params });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/parameters/standardize-bulk — standardize values via AI
router.post('/parameters/standardize-bulk', async (req, res) => {
  try {
    const { featureId, featureName, values } = req.body;
    const { standardizeParameters } = require('../services/pimService');
    const result = await standardizeParameters(featureId, featureName, values);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/parameters/manual-merge
router.post('/parameters/manual-merge', async (req, res) => {
  try {
    const { featureId, featureName, sourceValues, targetValue } = req.body;
    const { manualMergeValues } = require('../services/pimService');
    const result = await manualMergeValues(featureId, featureName, sourceValues, targetValue);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/parameters/merge-names
router.post('/parameters/merge-names', async (req, res) => {
  try {
    const { featureIds, targetName } = req.body;
    const { mergeParameterNames } = require('../services/pimService');
    const result = await mergeParameterNames(featureIds, targetName);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── BASE XML Import & Description Generator ──────────────────────────────────

// POST /api/products/base-xml/parse — parse uploaded BASE XML, return product list (no AI)
router.post('/base-xml/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Wymagany plik XML' });
    const { parseBaseXml } = require('../services/baseXmlService');
    const products = await parseBaseXml(req.file.buffer);
    res.json({ success: true, count: products.length, products });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/products/base-xml/generate-descriptions — generate HTML descriptions for parsed products
// Body: { products: [...], sessionPhotoUrl: "https://..." }
// Returns array of { id, name, description_html, attributes_normalised }
router.post('/base-xml/generate-descriptions', async (req, res) => {
  try {
    const { products, sessionPhotoUrl, useAi = true } = req.body;
    if (!Array.isArray(products) || !products.length) {
      return res.status(400).json({ error: 'Brak listy produktów (products)' });
    }

    const { generateDescription } = require('../services/baseXmlService');

    // AI service — optional (only if useAi is true and configured)
    let aiService = null;
    if (useAi) {
      try {
        aiService = require('../services/aiService');
        // Quick check — if no provider configured, skip AI silently
        const p = aiService.getEffectiveProvider();
        const m = aiService.getEffectiveModel(p, 'pim_generate') || aiService.getEffectiveModel(p, 'pim_qa');
        if (!m) aiService = null;
      } catch (e) { aiService = null; }
    }

    // Set up SSE for streaming progress
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const results = [];
    let errors = 0;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      try {
        const descHtml = await generateDescription(p, aiService, sessionPhotoUrl);
        results.push({
          id: p.id,
          ean: p.ean,
          name: p.name,
          description_html: descHtml,
          attributes_normalised: p.attributes,
          new_attributes: p.newAttributes || {},
          images: p.images,
          price: p.price,
          category: p.category,
          producer: p.producer,
        });
        res.write(`data: ${JSON.stringify({ processed: i + 1, total: products.length, name: p.name })}\n\n`);
      } catch (e) {
        errors++;
        res.write(`data: ${JSON.stringify({ processed: i + 1, total: products.length, name: p.name, error: e.message })}\n\n`);
      }

      // Small delay between AI calls
      if (aiService && i < products.length - 1) await new Promise(r => setTimeout(r, 400));
    }

    res.write(`data: ${JSON.stringify({ done: true, results, errors })}\n\n`);
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ─── ShopGold XML ─────────────────────────────────────────────────────────────
// All routes MUST be before /:id to avoid Express capturing "shopgold-xml" as id

// POST /api/products/shopgold-xml/parse — parse uploaded XML, return product list (no AI)
router.post('/shopgold-xml/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Wymagany plik XML' });
    const { parseShopGoldXml } = require('../services/shopgoldXmlService');
    const result = await parseShopGoldXml(req.file.buffer);
    res.json({ success: true, count: result.products.length, products: result.products });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/products/shopgold-xml/generate-selected — generate for selected indices (SSE)
// Body: multipart with file + JSON field selectedIndices
router.post('/shopgold-xml/generate-selected', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Wymagany plik XML' });

    let selectedIndices = [];
    try { selectedIndices = JSON.parse(req.body.selectedIndices || '[]'); } catch {}
    if (!selectedIndices.length) return res.status(400).json({ error: 'Brak wybranych produktów' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let aiService = null;
    try { aiService = require('../services/aiService'); } catch {}

    const { generateShopGoldSelected } = require('../services/shopgoldXmlService');
    const onProgress = (data) => res.write('data: ' + JSON.stringify(data) + '\n\n');

    const websiteUrl = req.body.websiteUrl || null;
    const result = await generateShopGoldSelected(req.file.buffer, selectedIndices, aiService, onProgress, websiteUrl);
    res.write('data: ' + JSON.stringify({ done: true, ...result }) + '\n\n');
    res.end();
  } catch (err) {
    res.write('data: ' + JSON.stringify({ error: err.message }) + '\n\n');
    res.end();
  }
});

// POST /api/products/shopgold-xml/generate — legacy: generate all at once (SSE)
router.post('/shopgold-xml/generate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Wymagany plik XML' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let aiService = null;
    try { aiService = require('../services/aiService'); } catch (e) { console.warn('AI Service not available', e); }

    const { processShopGoldXml } = require('../services/shopgoldXmlService');
    const onProgress = (data) => res.write('data: ' + JSON.stringify(data) + '\n\n');

    const websiteUrl = req.body.websiteUrl || null;
    const updatedXml = await processShopGoldXml(req.file.buffer, aiService, onProgress, websiteUrl);
    res.write('data: ' + JSON.stringify({ done: true, xml: updatedXml }) + '\n\n');
    res.end();
  } catch (err) {
    res.write('data: ' + JSON.stringify({ error: err.message }) + '\n\n');
    res.end();
  }
});

// GET /api/products/store-categories
// GET /api/products/shopgold/categories
router.get('/shopgold/categories', async (req, res) => {
  try {
    const shopgoldDb = require('../services/shopgoldDbService');
    const categories = await shopgoldDb.getShopgoldCategories();
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/shopgold/categories/:id
router.delete('/shopgold/categories/:id', async (req, res) => {
  try {
    const { action, targetCategoryId } = req.body;
    const shopgoldDb = require('../services/shopgoldDbService');
    await shopgoldDb.deleteCategory(req.params.id, action, targetCategoryId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/store-categories', async (req, res) => {
  try {
    const mysqlAdapter = require('../adapters/mysqlAdapter');
    const entities = await mysqlAdapter.fetchCmsEntities('category');
    const names = entities.map(e => e.title).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const uniqueNames = [...new Set(names)];
    res.json({ success: true, categories: uniqueNames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/meta/categories
router.get('/meta/categories', (req, res) => {
  try {
    const items = pimCategoryOps.findAll();
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/meta/categories
router.post('/meta/categories', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nazwa kategorii jest wymagana' });
    const result = pimCategoryOps.add(name);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ success: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/meta/categories
router.delete('/meta/categories', (req, res) => {
  try {
    const { categories, product_action, target_category } = req.body;
    if (!Array.isArray(categories) || !categories.length) {
      return res.status(400).json({ error: 'Brak listy kategorii' });
    }
    if (product_action === 'move') {
      if (!target_category) return res.status(400).json({ error: 'Brak kategorii docelowej' });
      productOps.moveProductsCategories(categories, target_category);
    } else if (product_action === 'delete_products') {
      productOps.deleteProductsByCategories(categories);
    }
    // Also remove assignments in pim_product_categories if any
    const db = require('../models/localDb').getDb();
    const placeholders = categories.map(() => '?').join(',');
    db.prepare(`DELETE FROM pim_product_categories WHERE category_name IN (${placeholders})`).run(...categories);

    pimCategoryOps.delete(categories);
    res.json({ success: true, count: categories.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id — single product

router.get('/:id', (req, res) => {
  const product = productOps.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Produkt nie znaleziony' });
  res.json(product);
});

// PATCH /api/products/:id — update product fields
router.patch('/:id', (req, res) => {
  try {
    const product = productOps.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produkt nie znaleziony' });
    productOps.update(req.params.id, req.body);
    const updated = productOps.findById(req.params.id);
    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id — delete product
// Query: ?deleteFromShop=1  ->  also removes product from ShopGold MySQL + FTP images
router.delete('/:id', async (req, res) => {
  try {
    const product = productOps.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produkt nie znaleziony' });
    const deleteFromShop = req.query.deleteFromShop === '1';
    if (deleteFromShop && product.shop_id) {
      const shopgoldDb = require('../services/shopgoldDbService');
      await shopgoldDb.deleteProductFromShop(product.shop_id);
    }
    productOps.delete(req.params.id);
    res.json({ success: true, deletedFromShop: deleteFromShop && !!product.shop_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/:id/generate — generate AI content for one product
router.post('/:id/generate', async (req, res) => {
  try {
    const { presetId, provider, model, selectedFields } = req.body;
    const result = await generateForProduct(req.params.id, presetId, { provider, model, selectedFields });
    // Mark as AI-generated
    productOps.update(req.params.id, { ai_generated: 1 });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/:id/duplicate - duplicate a product
router.post('/:id/duplicate', async (req, res) => {
  try {
    const product = productOps.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produkt nie znaleziony' });
    
    const newId = productOps.duplicate(req.params.id);
    const duplicated = productOps.findById(newId);

    // If using MySQL connection, sync to ShopGold immediately
    const { settingsOps } = require('../models/localDb');
    const config = require('../config');
    const type = settingsOps.get('connection_type') || config.shopgold?.connectionType || 'mysql';
    
    if (type === 'mysql' && product.shop_id && !String(product.shop_id).startsWith('manual-')) {
      try {
        const mysqlAdapter = require('../adapters/mysqlAdapter');
        const newShopId = await mysqlAdapter.duplicateProductInShopgold(product.shop_id, duplicated.name);
        productOps.update(newId, { shop_id: newShopId });
        duplicated.shop_id = newShopId;
      } catch (err) {
        console.error('[MySQL] Błąd podczas duplikowania w bazie sklepu:', err);
        duplicated.sync_warning = err.message;
      }
    }

    res.json({ success: true, id: newId, product: duplicated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/:id/generate-similar — generate similar products based on theme and reference product
router.post('/:id/generate-similar', async (req, res) => {
  try {
    const referenceId = req.params.id;
    const { count = 10, promptTheme } = req.body;

    if (!promptTheme || !promptTheme.trim()) {
      return res.status(400).json({ error: 'Tematyka (promptTheme) jest wymagana' });
    }

    const product = productOps.findById(referenceId);
    if (!product) return res.status(404).json({ error: 'Produkt referencyjny nie znaleziony' });

    const aiService = require('../services/aiService');
    const provider = aiService.getEffectiveProvider();
    const model = aiService.getEffectiveModel(provider, 'pim_generate') || aiService.getEffectiveModel(provider, 'pim_qa');
    if (!model) {
      throw new Error('Brak skonfigurowanego modelu AI. Skonfiguruj go w Ustawieniach AI.');
    }

    const systemPrompt = `Jesteś ekspertem ds. e-commerce i copywritingu. Wygenerujesz listę dokładnie ${count} nowych produktów zainspirowanych podanym produktem referencyjnym oraz podaną tematyką.
Nowe produkty muszą być całkowicie unikalne, ale powinny mieć:
- Podobny poziom cenowy (możesz lekko wahać ceny w granicach +/- 20% względem referencyjnego).
- Taką samą kategorię i ten sam zestaw parametrów/atrybutów (ale z wartościami dopasowanymi do tematyki).
- Opisy w języku polskim, napisane w sposób angażujący, profesjonalny i zoptymalizowany pod kątem SEO.

Zwróć WYŁĄCZNIE poprawny JSON będący tablicą obiektów o następującej strukturze (żadnego tekstu przed ani po JSONIE):
[
  {
    "name": "Pełna nazwa nowego produktu",
    "category": "${product.category || ''}",
    "group_tag": "${product.group_tag || ''}",
    "price": 123.45,
    "description": "Szczegółowy i profesjonalny opis produktu w formacie HTML lub czystego tekstu (min. 300 znaków).",
    "meta_title": "Tytuł meta SEO (do 60 znaków)",
    "meta_description": "Opis meta SEO (do 155 znaków)",
    "attributes": {
      // te same klucze parametrów co w produkcie referencyjnym, ale z wartościami odpowiadającymi nowej tematyce
    }
  },
  ...
]`;

    const referenceAttrs = JSON.stringify(product.attributes || {});
    const userPrompt = `PRODUKT REFERENCYJNY:
Nazwa: ${product.name}
Kategoria: ${product.category || 'brak'}
Cena: ${product.price || 'brak'} zł
Opis: ${product.description ? product.description.replace(/<[^>]+>/g, '').substring(0, 600) : 'brak'}
Parametry: ${referenceAttrs}

TEMATYKA NOWYCH PRODUKTÓW:
"${promptTheme}"

Wygeneruj dokładnie ${count} nowych produktów opartych na powyższych wytycznych i tematyce. Zwroć tablicę JSON z obiektami.`;

    const result = await aiService.complete(systemPrompt, userPrompt, {
      provider,
      model,
      temperature: 0.8,
      maxTokens: 16384,
      skipBrandKb: false,
    });

    const text = result.text || '';
    if (!text.trim()) {
      throw new Error('AI zwróciło pustą odpowiedź. Spróbuj zmienić model lub dostawcę w Ustawieniach.');
    }

    const parsed = aiService.parseJsonResponse(text);
    const productsArray = Array.isArray(parsed) ? parsed : (parsed.products || []);

    if (!Array.isArray(productsArray) || !productsArray.length) {
      throw new Error('Nie udało się wyodrębnić poprawnej tablicy produktów z odpowiedzi AI. Otrzymano: ' + text.substring(0, 300));
    }

    const createdIds = [];
    const db = require('../models/localDb').getDb();

    db.transaction(() => {
      for (const p of productsArray.slice(0, count)) {
        const attributes = p.attributes || {};
        const id = require('uuid').v4();
        const shopId = `manual-${id.substring(0, 8)}`;

        db.prepare(`
          INSERT INTO products (id, shop_id, name, category, group_tag, description, meta_title, meta_description,
          price, attributes, images, raw_data, synced_at, ai_generated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
        `).run(
          id,
          shopId,
          p.name || 'Wygenerowany produkt AI',
          p.category || product.category || '',
          p.group_tag || product.group_tag || '',
          p.description || '',
          p.meta_title || '',
          p.meta_description || '',
          p.price || product.price || null,
          JSON.stringify(attributes),
          JSON.stringify([]),
          JSON.stringify({ ai_reference_id: referenceId, prompt_theme: promptTheme })
        );

        createdIds.push(id);
      }
    })();

    res.json({ success: true, count: createdIds.length, ids: createdIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/:id/standardize — standardize attributes
router.post('/:id/standardize', async (req, res) => {
  try {
    const result = await standardizeAttributes(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Q&A ──────────────────────────────────────────────────────────────────────

// GET /api/products/:id/qa
router.get('/:id/qa', (req, res) => {
  try {
    const qa = qaOps.findByProduct(req.params.id);
    res.json({ qa });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/:id/qa — generate Q&A via aiService (Gemini/OpenAI/OWUI/Anthropic)
router.post('/:id/qa', async (req, res) => {
  try {
    const product = productOps.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produkt nie znaleziony' });
    const { count = 5 } = req.body;

    const aiService = require('../services/aiService');

    const provider = aiService.getEffectiveProvider();
    let useModel = aiService.getEffectiveModel(provider, 'pim_qa');
    if (!useModel) throw new Error('Brak modelu AI dla dostawcy "' + provider + '". Ustaw go w Ustawienia > AI > Mapowanie modeli.');

    // GUARD: detect embedding models that do NOT support chat completions
    const EMBEDDING_PATTERNS = [
      'bge', 'nomic-embed', 'embed', 'sentence-', 'all-minilm',
      'e5-', 'jina-embed', 'mxbai-embed', 'text-embedding',
    ];
    const modelLower = useModel.toLowerCase();
    const isEmbeddingModel = EMBEDDING_PATTERNS.some(p => modelLower.includes(p));
    if (isEmbeddingModel) {
      throw new Error(
        'Model "' + useModel + '" to model embeddingowy (wektory tekstu) — nie obsługuje generowania FAQ.' +
        ' Zmień przypisanie modelu w Ustawienia → AI → Mapowanie Funkcji → "Katalog: Generowanie Q&A"' +
        ' i wybierz model językowy (LLM) np. llama3, mistral, qwen, gemma, gemini-flash itp.'
      );
    }

    const systemPrompt = 'Jestes ekspertem e-commerce. Tworzysz sekcje FAQ dla produktow w polskim sklepie internetowym. Generujesz realistyczne pytania klientow i wyczerpujace odpowiedzi. Zwracaj WYLACZNIE poprawny JSON bez zadnych dodatkowych komentarzy.';
    const descClean = product.description ? product.description.replace(/<[^>]+>/g, '').slice(0, 600) : 'brak opisu';
    const attrsStr = JSON.stringify(product.attributes || {}).slice(0, 400);
    const userPrompt = [
      'Wygeneruj ' + count + ' pytan i odpowiedzi FAQ dla produktu:',
      '',
      'Nazwa: ' + product.name,
      'Kategoria: ' + (product.category || 'brak'),
      'Opis: ' + descClean,
      'Parametry: ' + attrsStr,
      '',
      'Zwroc JSON (i nic wiecej):',
      '[{"question": "...", "answer": "..."}, ...]'
    ].join('\n');

    let result;
    try {
      result = await aiService.complete(systemPrompt, userPrompt, {
        provider,
        model: useModel,
        featureId: 'pim_qa',
        temperature: 0.7,
        maxTokens: 4096,
        skipBrandKb: true,
      });
    } catch (aiErr) {
      throw new Error('Blad AI (' + provider + '/' + useModel + '): ' + aiErr.message);
    }

    const text = result.text || '';
    if (!text) throw new Error('AI zwrocilo pusta odpowiedz dla modelu "' + useModel + '". Sprawdz czy jest to pelny model jezykowy (LLM), nie model embeddingowy.');

    // Parse JSON tolerantly
    let parsedArr = null;
    const cleaned = text.replace(/```(?:json)?/gi, '').trim();
    
    try {
      // Find the first '[' and the last ']'
      const startIdx = cleaned.indexOf('[');
      const endIdx = cleaned.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const jsonStr = cleaned.substring(startIdx, endIdx + 1);
        parsedArr = JSON.parse(jsonStr);
      } else {
        parsedArr = JSON.parse(cleaned);
      }
    } catch (e) {
      throw new Error('Nie udało się sparsować JSON z odpowiedzi AI. Upewnij się, że model zwraca tylko JSON. Fragment: ' + text.slice(0, 150));
    }

    if (!Array.isArray(parsedArr) || !parsedArr.length) throw new Error('AI zwróciło pustą listę pytań');

    qaOps.addMany(req.params.id, product.shop_id || null, parsedArr.slice(0, count));
    const saved = qaOps.findByProduct(req.params.id);
    res.json({ success: true, qa: saved, count: parsedArr.length, modelUsed: result.model || useModel, provider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/qa/:qaId — update status
router.patch('/qa/:qaId', (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft','approved','rejected'].includes(status)) return res.status(400).json({ error: 'Nieprawidłowy status' });
    qaOps.updateStatus(req.params.qaId, status);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/qa/:qaId — delete one Q&A
router.delete('/qa/:qaId', (req, res) => {
  try {
    qaOps.delete(req.params.qaId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/qa/:qaId/approve — send approved Q&A to ShopGold
router.post('/qa/:qaId/approve', async (req, res) => {
  try {
    const { getDb } = require('../models/localDb');
    const db = getDb();
    const qa = db.prepare('SELECT * FROM pim_qa WHERE id = ?').get(req.params.qaId);
    if (!qa) return res.status(404).json({ error: 'Nie znaleziono Q&A' });
    const product = productOps.findById(qa.product_id);
    if (!product) return res.status(404).json({ error: 'Produkt nie znaleziony' });
    
    // TODO: integrate with ShopGold API when endpoint available
    // For now, mark as approved in local DB
    qaOps.updateStatus(req.params.qaId, 'approved');
    res.json({ success: true, note: 'Zatwierdzono lokalnie. Synchronizacja z ShopGold w toku.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PIM Global Categories ───────────────────────────────────────────────────



// ─── Multi-Categories ──────────────────────────────────────────────────────────

// GET /api/products/:id/categories
router.get('/:id/categories', (req, res) => {
  try {
    const assigned = productCategoryOps.findByProduct(req.params.id);
    res.json({ assigned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products/:id/categories — save multi-category assignment
router.post('/:id/categories', (req, res) => {
  try {
    const product = productOps.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produkt nie znaleziony' });
    const { categories } = req.body;
    if (!Array.isArray(categories)) return res.status(400).json({ error: 'Oczekiwano tablicy categories' });
    productCategoryOps.set(req.params.id, categories);
    res.json({ success: true, count: categories.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Helpers ---
function csvEsc(str) {
  const s = String(str || '').replace(/"/g, '""');
  return `"${s}"`;
}
function xmlEsc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


module.exports = router;
