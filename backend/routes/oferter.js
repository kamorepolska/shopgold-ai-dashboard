const express = require('express');
const router = express.Router();
const { complete } = require('../services/aiService');
const { eanVariants, normalizeEan } = require('../services/eanUtil');
const attrSync = require('../services/catalogAttrSync');

function getDb() {
  const svc = require('../services/sourcingService');
  return svc.getDb();
}

function offerMatchSql(alias, catalogEanExpr = 'cm.canonical_ean') {
  return `(COALESCE(NULLIF(${alias}.normalized_ean, ''), normalize_ean(${alias}.ean)) = normalize_ean(${catalogEanExpr}))`;
}

function subiektJoinSql(alias = 'sp') {
  return `LEFT JOIN subiekt_products ${alias} ON ${alias}.id = (
    SELECT sp2.id FROM subiekt_products sp2
    WHERE COALESCE(NULLIF(sp2.normalized_ean, ''), normalize_ean(sp2.ean)) = normalize_ean(cm.canonical_ean)
    ORDER BY (sp2.stock IS NULL), sp2.stock DESC
    LIMIT 1
  )`;
}

function expandEans(eans) {
  const set = new Set();
  for (const e of eans || []) {
    if (!e) continue;
    eanVariants(e).forEach(v => set.add(v));
    const n = normalizeEan(e);
    if (n) set.add(n);
  }
  return [...set];
}

function firstMapHit(map, ean) {
  if (!map) return undefined;
  if (ean && map[ean]) return map[ean];
  for (const k of expandEans([ean])) {
    if (map[k]) return map[k];
  }
  return undefined;
}

function normalizeStr(s) {
  return (s || '').toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
    .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
    .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ä/g,'a').replace(/ß/g,'ss');
}

// POST /api/oferter/setup/seed-attributes
// Seeds category_attributes for all PC component categories found in product_categories
router.post('/setup/seed-attributes', (req, res) => {
  try {
    const db = getDb();
    const catalogSvc = require('../services/catalogService');
    const cats = db.prepare('SELECT id, name FROM product_categories').all();
    const results = [];

    const doSeed = db.transaction(() => {
      for (const cat of cats) {
        const schemaKey = attrSync.matchAttrMapKey(cat.name, catalogSvc.CATEGORY_ATTR_MAP);
        if (!schemaKey) continue;
        const added = attrSync.seedCategoryAttrSchema(db, cat.id, cat.name, catalogSvc.CATEGORY_ATTR_MAP);
        if (added > 0) results.push({ category: cat.name, id: cat.id, added, schema: schemaKey });
      }
    });

    doSeed();

    let sync = { products: 0, filled: 0, raw_updated: 0 };
    try {
      const catalogSvc = require('../services/catalogService');
      sync = catalogSvc.syncCatalogAttributes(db, { seedSchemas: true });
    } catch (e) {
      console.warn('[oferter] sync attributes after seed:', e.message);
    }

    const totalAdded = results.reduce((s, r) => s + r.added, 0);
    res.json({
      ok: true,
      seeded: results,
      totalAdded,
      sync,
      message: `Dodano ${totalAdded} atrybutów w ${results.length} kategoriach. Uzupełniono ${sync.filled} cech z hurtowni (${sync.raw_updated} produktów z raw_attributes).`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oferter/setup/status — show current attribute coverage
router.get('/setup/status', (req, res) => {
  try {
    const db = getDb();
    const cats = db.prepare(`
      SELECT pc.id, pc.name, COUNT(ca.id) as attr_count
      FROM product_categories pc
      LEFT JOIN category_attributes ca ON ca.category_id = pc.id
      GROUP BY pc.id
      ORDER BY pc.name
    `).all();

    const pcCats = cats.filter(c => {
      const n = normalizeStr(c.name);
      return ['procesor', 'plyta', 'chlodzenie', 'wentylator', 'cooler', 'pamiec', 'dysk', 'karta', 'zasilacz', 'obudowa', 'system', 'cpu', 'mainboard', 'kuhler', 'arbeitsspeicher', 'festplatten', 'grafikkarten', 'netzteile', 'gehause', 'ssd', 'hdd'].some(k => n.includes(k));
    });

    res.json({ ok: true, pc_categories: pcCats, total: pcCats.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oferter/setup/categories — list all categories with PC flag
router.get('/setup/categories', (req, res) => {
  try {
    const db = getDb();
    const cats = db.prepare(`
      SELECT pc.id, pc.name, pc.product_count, COUNT(ca.id) as attr_count
      FROM product_categories pc
      LEFT JOIN category_attributes ca ON ca.category_id = pc.id
      GROUP BY pc.id
      ORDER BY pc.name
    `).all();

    const result = cats.map(c => ({
      ...c,
      is_pc_component: ['procesor', 'plyta', 'chlodzenie', 'wentylator', 'cooler', 'pamiec', 'dysk', 'karta', 'zasilacz', 'obudowa', 'system', 'cpu', 'mainboard', 'kuhler', 'arbeitsspeicher', 'festplatten', 'grafikkarten', 'netzteile', 'gehause', 'ssd', 'hdd'].some(k => normalizeStr(c.name).includes(k)),
    }));

    res.json({ ok: true, categories: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/setup/sync-attributes', (req, res) => {
  try {
    const db = getDb();
    const catalogSvc = require('../services/catalogService');
    const sync = catalogSvc.syncCatalogAttributes(db, { seedSchemas: true });
    res.json({
      ok: true,
      ...sync,
      message: `Uzupełniono ${sync.filled} cech w katalogu Master (${sync.raw_updated} produktów z raw_attributes).`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oferter/setup/attributes/:catId — list attributes for a category
router.get('/setup/attributes/:catId', (req, res) => {
  try {
    const db = getDb();
    const attrs = db.prepare(
      'SELECT * FROM category_attributes WHERE category_id = ? ORDER BY sort_order, attr_name'
    ).all(parseInt(req.params.catId));
    const cat = db.prepare('SELECT id, name FROM product_categories WHERE id = ?').get(parseInt(req.params.catId));
    res.json({ ok: true, category: cat, attributes: attrs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/oferter/setup/attributes/:catId — add attribute to category
router.post('/setup/attributes/:catId', (req, res) => {
  try {
    const db = getDb();
    const { attr_name, attr_type = 'text', attr_unit = null } = req.body;
    if (!attr_name) return res.status(400).json({ error: 'attr_name wymagane' });
    const r = db.prepare(
      'INSERT OR IGNORE INTO category_attributes (category_id, attr_name, attr_type, attr_unit) VALUES (?,?,?,?)'
    ).run(parseInt(req.params.catId), attr_name, attr_type, attr_unit || null);
    res.json({ ok: true, inserted: r.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/oferter/setup/attributes/:attrId — remove attribute definition
router.delete('/setup/attributes/:attrId', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM category_attributes WHERE id = ?').run(parseInt(req.params.attrId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oferter/components/:catId — list products in category with their attributes
router.get('/components/:catId', (req, res) => {
  try {
    const db = getDb();
    const catId = parseInt(req.params.catId);
    const { search = '', limit = 50, offset = 0 } = req.query;
    const scopeIds = attrSync.expandCategoryIds(db, [catId]);
    const catScope = scopeIds.length ? scopeIds : [catId];

    try {
      const catalogSvc = require('../services/catalogService');
      const scopeCats = db.prepare(
        `SELECT id, name FROM product_categories WHERE id IN (${catScope.map(() => '?').join(',')})`
      ).all(...catScope);
      for (const cat of scopeCats) {
        attrSync.seedCategoryAttrSchema(db, cat.id, cat.name, catalogSvc.CATEGORY_ATTR_MAP);
      }
    } catch (e) {
      console.warn('[oferter] seed schema:', e.message);
    }

    let where = `cm.category_id IN (${catScope.map(() => '?').join(',')})`;
    const params = [...catScope];
    if (search) { where += ' AND (cm.name LIKE ? OR cm.manufacturer LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    // Tylko oferty hurtowni z ceną — sama cena Subiekta nie wystarcza
    where += ` AND EXISTS (
      SELECT 1 FROM supplier_products sup
      WHERE ${offerMatchSql('sup')} AND sup.price_pln > 0
    )`;

    const products = db.prepare(`
      SELECT
        cm.id, cm.canonical_ean, cm.name, cm.manufacturer, cm.manufacturer_code,
        cm.category_id, cm.category_name, cm.raw_attributes,
        sp.stock AS subiekt_stock,
        sp.buy_price AS subiekt_buy_price,
        sp.sell_price AS subiekt_sell_price,
        COALESCE(
          (SELECT MIN(price_pln) FROM supplier_products sup WHERE ${offerMatchSql('sup')} AND sup.price_pln > 0 AND sup.stock_quantity > 0),
          (SELECT MIN(price_pln) FROM supplier_products sup6 WHERE ${offerMatchSql('sup6')} AND sup6.price_pln > 0)
        ) AS best_supplier_price,
        COALESCE(
          sp.buy_price, 
          (SELECT MIN(price_pln) FROM supplier_products sup2 WHERE ${offerMatchSql('sup2')} AND sup2.price_pln > 0 AND sup2.stock_quantity > 0),
          (SELECT MIN(price_pln) FROM supplier_products sup5 WHERE ${offerMatchSql('sup5')} AND sup5.price_pln > 0)
        ) AS effective_buy_price,
        (SELECT SUM(stock_quantity) FROM supplier_products sup3 WHERE ${offerMatchSql('sup3')}) AS supplier_stock
      FROM catalog_master cm
      ${subiektJoinSql('sp')}
      WHERE ${where}
      ORDER BY 
        CASE WHEN (sp.stock > 0 OR (SELECT SUM(stock_quantity) FROM supplier_products sup4 WHERE ${offerMatchSql('sup4')}) > 0) THEN 1 ELSE 2 END ASC,
        cm.name ASC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), parseInt(offset));

    const total = db.prepare(`
      SELECT COUNT(*) as cnt 
      FROM catalog_master cm 
      ${subiektJoinSql('sp')}
      WHERE ${where}
    `).get(...params).cnt;

    const productIds = products.map(p => p.id);
    const eans = products.map(p => p.canonical_ean);

    const manualAttrsMap = {};
    if (productIds.length > 0) {
      const manualRows = db.prepare(`
        SELECT pa.catalog_id, ca.attr_name, ca.attr_type, ca.attr_unit, pa.value_text, pa.value_numeric
        FROM product_attributes pa
        JOIN category_attributes ca ON ca.id = pa.attribute_id
        WHERE pa.catalog_id IN (${productIds.map(() => '?').join(',')})
      `).all(...productIds);
      for (const row of manualRows) {
        if (!manualAttrsMap[row.catalog_id]) manualAttrsMap[row.catalog_id] = {};
        manualAttrsMap[row.catalog_id][row.attr_name] = row;
      }
    }

    const aliasMap = attrSync.loadAliasMaps(db);
    try { attrSync.hydrateProductsRaw(db, products, aliasMap); } catch (e) {
      console.warn('[oferter] hydrate raw:', e.message);
    }

    const catAttrDefs = db.prepare(
      `SELECT attr_name, attr_type, attr_unit FROM category_attributes
       WHERE category_id IN (${catScope.map(() => '?').join(',')})
       ORDER BY sort_order, attr_name`
    ).all(...catScope);
    const seenDefs = new Set();
    const uniqueDefs = [];
    for (const def of catAttrDefs) {
      const k = def.attr_name.toLowerCase();
      if (seenDefs.has(k)) continue;
      seenDefs.add(k);
      uniqueDefs.push(def);
    }

    // 3. Batch suppliers (1 query zamiast N queries)
    const suppliersMap = {}; // ean -> [{supplier_name, price_pln, stock_quantity, availability}]
    if (eans.length > 0) {
      const expanded = expandEans(eans);
      const norms = eans.map(normalizeEan).filter(Boolean);
      const offerWhere = [`sup.price_pln > 0`];
      const offerParams = [];
      if (expanded.length) {
        offerWhere.push(`sup.ean IN (${expanded.map(() => '?').join(',')})`);
        offerParams.push(...expanded);
      }
      if (norms.length) {
        offerWhere.push(`sup.normalized_ean IN (${norms.map(() => '?').join(',')})`);
        offerParams.push(...norms);
      }
      const suppRows = db.prepare(`
        SELECT s.name AS supplier_name, sup.price_pln, sup.stock_quantity, sup.availability, sup.ean, sup.normalized_ean
        FROM supplier_products sup
        JOIN suppliers s ON s.id = sup.supplier_id
        WHERE (${offerWhere.slice(1).join(' OR ')}) AND sup.price_pln > 0
        ORDER BY sup.price_pln ASC
      `).all(...offerParams);
      for (const row of suppRows) {
        for (const k of expandEans([row.ean, row.normalized_ean])) {
          if (!suppliersMap[k]) suppliersMap[k] = [];
          if (!suppliersMap[k].some(x => x.supplier_name === row.supplier_name && x.ean === row.ean)) {
            suppliersMap[k].push(row);
          }
        }
      }
    }

    const enriched = products
      .map(p => {
        const suppliers = firstMapHit(suppliersMap, p.canonical_ean) || [];

        // Pomiń produkty bez żadnego dostawcy z ceną > 0
        if (suppliers.length === 0) return null;

        // Oblicz effective_buy_price i supplier_stock
        const cheapestInStock = suppliers.find(s => (s.stock_quantity || 0) > 0);
        const effectiveSupplier = cheapestInStock || suppliers[0];
        const effective_buy_price = effectiveSupplier?.price_pln || 0;
        const supplier_stock = suppliers.reduce((s, r) => s + (r.stock_quantity || 0), 0);

        const manualForProd = manualAttrsMap[p.id] || {};
        let raw = {};
        try { raw = JSON.parse(p.raw_attributes || '{}'); } catch { raw = {}; }
        const attributes = attrSync.buildAttributeList(raw, manualForProd, uniqueDefs, aliasMap);

        const { raw_attributes, ...rest } = p;
        return {
          ...rest,
          in_subiekt: p.subiekt_stock != null,
          effective_buy_price,
          supplier_stock,
          attributes,
          suppliers: suppliers.slice(0, 5),
        };
      })
      .filter(Boolean); // usuń null (produkty bez ceny)

    res.json({ ok: true, products: enriched, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/oferter/product-attrs/:id — get all attributes for a single product
router.get('/product-attrs/:id', (req, res) => {
  try {
    const db = getDb();
    const id = parseInt(req.params.id);
    const product = db.prepare('SELECT id, name, canonical_ean, category_id FROM catalog_master WHERE id = ?').get(id);
    if (!product) return res.status(404).json({ error: 'Nie znaleziono' });

    const attrs = db.prepare(`
      SELECT ca.id AS attr_def_id, ca.attr_name, ca.attr_type, ca.attr_unit, ca.visible,
             pa.id AS val_id, pa.value_text, pa.value_numeric,
             (
               SELECT spa.attr_value
               FROM supplier_product_attrs spa
               JOIN attr_aliases aa ON LOWER(aa.alias) = LOWER(spa.attr_name)
               WHERE (spa.ean IN (${eanVariants(product.canonical_ean).map(() => '?').join(',') || '?'})
                      OR spa.normalized_ean = ?)
                 AND LOWER(aa.canonical_name) = LOWER(ca.attr_name)
               LIMIT 1
             ) AS supplier_value
      FROM category_attributes ca
      LEFT JOIN product_attributes pa ON pa.attribute_id = ca.id AND pa.catalog_id = ?
      WHERE ca.category_id = ?
      ORDER BY ca.sort_order, ca.attr_name
    `).all(
      ...(eanVariants(product.canonical_ean).length ? eanVariants(product.canonical_ean) : [product.canonical_ean]),
      normalizeEan(product.canonical_ean),
      id,
      product.category_id
    );

    res.json({ ok: true, product, attributes: attrs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/oferter/product-attrs/:id — set attribute value for a product
router.post('/product-attrs/:id', (req, res) => {
  try {
    const db = getDb();
    const catalogId = parseInt(req.params.id);
    const { attribute_id, value_text, value_numeric } = req.body;
    if (!attribute_id) return res.status(400).json({ error: 'attribute_id wymagane' });

    attrSync.ensureProductAttrSource(db);
    try {
      db.prepare(`
        INSERT INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric, source)
        VALUES (?, ?, ?, ?, 'manual')
        ON CONFLICT(catalog_id, attribute_id) DO UPDATE SET
          value_text=excluded.value_text, value_numeric=excluded.value_numeric, source='manual'
      `).run(catalogId, attribute_id, value_text || null, value_numeric != null ? parseFloat(value_numeric) : null);
    } catch (_) {
      db.prepare(`
        INSERT INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(catalog_id, attribute_id) DO UPDATE SET value_text=excluded.value_text, value_numeric=excluded.value_numeric
      `).run(catalogId, attribute_id, value_text || null, value_numeric != null ? parseFloat(value_numeric) : null);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/oferter/product-attrs/:id/bulk — set multiple attributes at once
router.post('/product-attrs/:id/bulk', (req, res) => {
  try {
    const db = getDb();
    const catalogId = parseInt(req.params.id);
    const { attributes } = req.body; // [{attribute_id, value_text, value_numeric}]
    if (!Array.isArray(attributes)) return res.status(400).json({ error: 'attributes musi byc tablica' });

    attrSync.ensureProductAttrSource(db);
    let upsert;
    try {
      upsert = db.prepare(`
        INSERT INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric, source)
        VALUES (?, ?, ?, ?, 'manual')
        ON CONFLICT(catalog_id, attribute_id) DO UPDATE SET
          value_text=excluded.value_text, value_numeric=excluded.value_numeric, source='manual'
      `);
    } catch (_) {
      upsert = db.prepare(`
        INSERT INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(catalog_id, attribute_id) DO UPDATE SET value_text=excluded.value_text, value_numeric=excluded.value_numeric
      `);
    }

    const doAll = db.transaction(() => {
      for (const a of attributes) {
        upsert.run(catalogId, a.attribute_id, a.value_text || null, a.value_numeric != null ? parseFloat(a.value_numeric) : null);
      }
    });
    doAll();

    res.json({ ok: true, updated: attributes.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oferter/setup/coverage — how many products have attrs filled per PC category
router.get('/setup/coverage', (req, res) => {
  try {
    const db = getDb();
    const cats = db.prepare(`
      SELECT pc.id, pc.name, pc.product_count,
        COUNT(DISTINCT ca.id) as attr_definitions,
        COUNT(DISTINCT pa.catalog_id) as products_with_attrs
      FROM product_categories pc
      LEFT JOIN category_attributes ca ON ca.category_id = pc.id
      LEFT JOIN product_attributes pa ON pa.attribute_id = ca.id
      GROUP BY pc.id
      HAVING attr_definitions > 0
      ORDER BY pc.name
    `).all();

    const result = cats.map(c => ({
      ...c,
      is_pc_component: ['procesor', 'plyta', 'chlodzenie', 'wentylator', 'cooler', 'pamiec', 'dysk', 'karta', 'zasilacz', 'obudowa', 'system', 'cpu', 'mainboard', 'kuhler', 'arbeitsspeicher', 'festplatten', 'grafikkarten', 'netzteile', 'gehause', 'ssd', 'hdd'].some(k => normalizeStr(c.name).includes(k)),
      coverage_pct: c.product_count > 0 ? Math.round((c.products_with_attrs / c.product_count) * 100) : 0,
    }));

    res.json({ ok: true, categories: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── OFERTY (QUOTES) CRUD ───────────────────────────────────────────────────

// GET /api/oferter/offers
router.get('/offers', (req, res) => {
  try {
    const db = getDb();
    const offers = db.prepare(`SELECT * FROM oferter_quotes ORDER BY updated_at DESC LIMIT 100`).all();
    res.json({ ok: true, quotes: offers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oferter/offers/:id
router.get('/offers/:id', (req, res) => {
  try {
    const db = getDb();
    const offer = db.prepare(`SELECT * FROM oferter_quotes WHERE id = ?`).get(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Oferta nie znaleziona' });
    res.json({ ok: true, offer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/oferter/offers
router.post('/offers', (req, res) => {
  try {
    const db = getDb();
    const {
      title, client_name, client_email, client_phone, client_company,
      notes_client, notes_internal, preferences, components, services,
      skipped_components, total_buy_price, margin_value, discount_value, discount_pct, status, parent_id, variant_label
    } = req.body;
    
    if (!title) return res.status(400).json({ error: 'Tytuł jest wymagany' });

    const info = db.prepare(`
      INSERT INTO oferter_quotes (
        title, client_name, client_email, client_phone, client_company,
        notes_client, notes_internal, preferences, components, services,
        skipped_components, total_buy_price, margin_value, discount_value, discount_pct, status, parent_id, variant_label
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, client_name, client_email, client_phone, client_company,
      notes_client, notes_internal, 
      preferences ? JSON.stringify(preferences) : null, 
      components ? JSON.stringify(components) : null, 
      services ? JSON.stringify(services) : null,
      skipped_components ? JSON.stringify(skipped_components) : null, 
      total_buy_price || 0, margin_value || 0, discount_value || 0,
      discount_pct || 0, status || 'draft', parent_id || null, variant_label
    );

    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/oferter/offers/:id
router.put('/offers/:id', (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;
    const {
      title, client_name, client_email, client_phone, client_company,
      notes_client, notes_internal, preferences, components, services,
      skipped_components, total_buy_price, margin_value, discount_value,
      discount_pct, status, variant_label
    } = req.body;

    db.prepare(`
      UPDATE oferter_quotes SET
        title = ?, client_name = ?, client_email = ?, client_phone = ?, client_company = ?,
        notes_client = ?, notes_internal = ?, preferences = ?, components = ?, services = ?,
        skipped_components = ?, total_buy_price = ?, margin_value = ?, discount_value = ?,
        discount_pct = ?, status = ?, variant_label = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title, client_name, client_email, client_phone, client_company,
      notes_client, notes_internal,
      preferences ? JSON.stringify(preferences) : null,
      components ? JSON.stringify(components) : null,
      services ? JSON.stringify(services) : null,
      skipped_components ? JSON.stringify(skipped_components) : null,
      total_buy_price || 0, margin_value || 0, discount_value || 0,
      discount_pct || 0, status || 'draft', variant_label, id
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/oferter/offers/:id
router.delete('/offers/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`DELETE FROM oferter_quotes WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SERVICES (USŁUGI) ──────────────────────────────────────────────────────

// GET /api/oferter/services
router.get('/services', (req, res) => {
  try {
    const db = getDb();
    const services = db.prepare(`SELECT * FROM oferter_services ORDER BY name`).all();
    res.json({ ok: true, services });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/oferter/services
router.post('/services', (req, res) => {
  try {
    const db = getDb();
    const { name, price, is_active } = req.body;
    if (!name) return res.status(400).json({ error: 'Nazwa wymagana' });
    const info = db.prepare(`INSERT INTO oferter_services (name, price, is_active) VALUES (?, ?, ?)`).run(name, price || 0, is_active !== undefined ? is_active : 1);
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── COMPATIBILITY ENGINE ───────────────────────────────────────────────────

router.post('/compatibility', (req, res) => {
  try {
    const { components } = req.body; 
    // components to tablica ID z catalog_master
    if (!components || !Array.isArray(components)) return res.json({ ok: true, messages: [], isValid: true });
    
    const db = getDb();
    const aliasMap = attrSync.loadAliasMaps(db);
    const catalogRows = db.prepare(`
      SELECT cm.id, cm.canonical_ean, cm.category_id, cm.category_name, cm.raw_attributes
      FROM catalog_master cm
      WHERE cm.id IN (${components.map(() => '?').join(',')})
    `).all(...components);

    const compMap = {};
    for (const item of catalogRows) {
      const catName = item.category_name || '';
      if (!compMap[catName]) compMap[catName] = {};
      const defs = item.category_id
        ? db.prepare('SELECT attr_name, attr_type, attr_unit FROM category_attributes WHERE category_id = ?').all(item.category_id)
        : [];
      const attrs = attrSync.attributesFromCatalog(db, item, defs, aliasMap);
      for (const a of attrs) {
        const val = a.value_numeric != null ? a.value_numeric : a.value_text;
        if (val != null && val !== '') {
          if (compMap[catName][a.attr_name] == null) compMap[catName][a.attr_name] = val;
        }
      }
    }
    
    const messages = [];
    let isValid = true;
    
    // Helper function
    const norm = (s) => (s||'').toString().toLowerCase().trim();

    const compactToken = (s) => attrSync.fold(s).replace(/[\s\-_]/g, '');
    const socketsCompatible = (haystack, needle) => {
      const cpuN = compactToken(needle);
      if (!cpuN) return true;
      const parts = String(haystack || '').split(/[,;/|+]| i /i).map(compactToken).filter(Boolean);
      const pool = parts.length ? parts : [compactToken(haystack)].filter(Boolean);
      return pool.some(p => p === cpuN || p.includes(cpuN) || cpuN.includes(p));
    };
    const ramTypesCompatible = (mbType, ramType) => {
      const a = compactToken(mbType);
      const b = compactToken(ramType);
      if (!a || !b) return true;
      const gen = (s) => (s.match(/ddr[0-9]/) || [null])[0];
      const ga = gen(a), gb = gen(b);
      if (ga && gb) return ga === gb;
      return a.includes(b) || b.includes(a);
    };
    const FORM_RANK = [
      ['eeatx', 6], ['extendedatx', 6], ['eatx', 6],
      ['microatx', 3], ['matx', 3],
      ['miniitx', 2], ['itx', 2],
      ['ministx', 1],
      ['atx', 4],
    ];
    const formRank = (s) => {
      const n = compactToken(s);
      let best = null;
      for (const [k, v] of FORM_RANK) {
        if (n.includes(k) && (!best || k.length > best.key.length)) best = { key: k, v };
      }
      return best ? best.v : null;
    };

    const pickComp = (...keys) => {
      const folded = keys.map(k => attrSync.fold(k));
      const lookingRam = folded.some(k => k.includes('pamiec') || k === 'ram' || k.includes('dimm'));
      const specific = folded.filter(k => k.length >= 8);
      const generic = folded.filter(k => k.length < 8);
      let best = null, bestScore = 0;
      for (const [name, attrs] of Object.entries(compMap)) {
        const n = attrSync.fold(name);
        if (/wentylator/.test(n) && /obudow|vga|case/.test(n)) continue;
        if (lookingRam && /masow|flash|pendrive|czytnik/.test(n)) continue;
        let score = 0;
        if (specific.some(k => n.includes(k))) score = 5 + n.length / 100;
        else if (generic.some(k => n.includes(k))) score = 1;
        if (score > bestScore) { bestScore = score; best = attrs; }
      }
      return best;
    };
    const attrOf = (obj, ...names) => {
      if (!obj) return null;
      for (const n of names) {
        if (obj[n] != null && obj[n] !== '') return obj[n];
        const hit = Object.keys(obj).find(k => attrSync.namesMatch(k, n));
        if (hit) return obj[hit];
      }
      return null;
    };

    // 1. Zgodnosc CPU <-> Plyta
    const cpu = pickComp('procesor', 'cpu');
    const mb = pickComp('plyta', 'mainboard', 'motherboard');
    if (cpu && mb) {
      const cpuSock = attrOf(cpu, 'Socket');
      const mbSock = attrOf(mb, 'Socket');
      if (cpuSock && mbSock && compactToken(cpuSock) && compactToken(mbSock) && compactToken(cpuSock) !== compactToken(mbSock)) {
        isValid = false;
        messages.push({ type: 'error', text: `Niezgodny Socket! Procesor wymaga ${cpuSock}, a wybrana płyta posiada ${mbSock}.` });
      }
    }

    // 2. RAM <-> Plyta
    const ram = pickComp('pamiec ram', 'pamieci ram', 'moduly ram', 'dimm', 'so-dimm');
    if (mb && ram) {
      const mbType = attrOf(mb, 'Typ pamięci RAM', 'Typ');
      const ramType = attrOf(ram, 'Typ', 'Typ pamięci RAM');
      if (mbType && ramType && !ramTypesCompatible(mbType, ramType)) {
         isValid = false;
         messages.push({ type: 'error', text: `Niezgodny typ pamięci! Płyta obsługuje ${mbType}, wybrano pamięć ${ramType}.` });
      }
      const slots = attrOf(mb, 'Sloty RAM');
      const sticks = attrOf(ram, 'Liczba kości', 'Liczba kosci');
      if (slots && sticks && Number(sticks) > Number(slots)) {
         isValid = false;
         messages.push({ type: 'error', text: `Zbyt dużo kości RAM (${sticks}). Płyta posiada tylko ${slots} slotów.` });
      }
    }

    // 3. CPU <-> Chłodzenie (TDP)
    const cooler = pickComp('wentylatory do procesor', 'chlodzenie procesor', 'chlodzenie cpu', 'cpu cooler', 'kuhler', 'heatsink', 'chlodzenie wodne', 'chlodzen');
    if (cpu && cooler) {
      const maxTdp = attrOf(cooler, 'Max TDP', 'TDP');
      const cpuTdp = attrOf(cpu, 'TDP');
      if (maxTdp && cpuTdp && Number(maxTdp) < Number(cpuTdp)) {
         messages.push({ type: 'warning', text: `Chłodzenie może być zbyt słabe. Max TDP chłodzenia (${maxTdp}W) jest mniejsze niż TDP procesora (${cpuTdp}W).` });
      }
      const coolerSock = attrOf(cooler, 'Kompatybilne sockety', 'Socket');
      const cpuSock = attrOf(cpu, 'Socket');
      if (coolerSock && cpuSock && !socketsCompatible(coolerSock, cpuSock)) {
         isValid = false;
         messages.push({ type: 'error', text: `Chłodzenie nie pasuje do gniazda procesora (${cpuSock}).` });
      }
    }

    // 4. Płyta <-> Obudowa
    const casePc = pickComp('obudow', 'case');
    if (mb && casePc) {
      const caseFmt = attrOf(casePc, 'Format płyty', 'Format');
      const mbFmt = attrOf(mb, 'Format', 'Format płyty');
      const caseRank = formRank(caseFmt);
      const mbRank = formRank(mbFmt);
      if (caseRank != null && mbRank != null && mbRank > caseRank) {
        isValid = false;
        messages.push({ type: 'error', text: `Płyta główna (${mbFmt}) nie zmieści się w obudowie (wspiera ${caseFmt}).` });
      }
    }

    // 5. Chłodzenie <-> Obudowa
    if (cooler && casePc) {
      const coolerType = attrOf(cooler, 'Typ chłodzenia', 'Typ');
      const coolerH = attrOf(cooler, 'Wysokość', 'Wysokosc');
      const caseH = attrOf(casePc, 'Maks. wys. chłodzenia', 'Wysokość');
      if (coolerType && norm(coolerType).includes('powietrz') && coolerH && caseH) {
        if (Number(coolerH) > Number(caseH)) {
          isValid = false;
          messages.push({ type: 'error', text: `Chłodzenie jest za wysokie (${coolerH}mm). Obudowa mieści max ${caseH}mm.` });
        }
      }
    }

    // 6. Karta graficzna <-> Obudowa
    const gpu = pickComp('graficzn', 'gpu', 'vga');
    if (gpu && casePc) {
      const gpuL = attrOf(gpu, 'Długość karty', 'Dlugosc karty');
      const caseL = attrOf(casePc, 'Maks. dł. karty graficznej', 'Długość karty');
      if (gpuL && caseL && Number(gpuL) > Number(caseL)) {
        isValid = false;
        messages.push({ type: 'error', text: `Karta graficzna jest za długa (${gpuL}mm). Obudowa mieści max ${caseL}mm.` });
      }
    }

    // 7. Zasilacz moc vs (CPU + GPU + 50W zapasu)
    const psu = pickComp('zasilacz', 'psu', 'netzteil');
    if (psu && cpu && gpu) {
      const needed = (Number(attrOf(cpu, 'TDP')) || 100) + (Number(attrOf(gpu, 'TDP')) || 250) + 50;
      const psuW = attrOf(psu, 'Moc');
      if (psuW && Number(psuW) < needed) {
        messages.push({ type: 'warning', text: `Moc zasilacza (${psuW}W) może być niewystarczająca. Sugerowana moc dla zestawu to min. ${needed}W.` });
      }
    }

    res.json({ ok: true, messages, isValid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



const batchStatus = {};

// GET /api/oferter/product-attrs/batch-status/:catId
router.get('/product-attrs/batch-status/:catId', (req, res) => {
  const catId = parseInt(req.params.catId);
  const st = batchStatus[catId] || { running: false, total: 0, done: 0 };
  res.json(st);
});

// POST /api/oferter/product-attrs/batch-extract/:catId
router.post('/product-attrs/batch-extract/:catId', async (req, res) => {
  const catId = parseInt(req.params.catId);
  if (batchStatus[catId] && batchStatus[catId].running) {
    return res.json({ ok: false, error: 'Proces już działa w tle dla tej kategorii.' });
  }

  const db = getDb();
  const products = db.prepare(`
    SELECT cm.id, cm.name, cm.manufacturer,
      (SELECT sp.description FROM supplier_products sp
       WHERE ${offerMatchSql('sp')} AND sp.description IS NOT NULL AND trim(sp.description) != ''
       LIMIT 1) AS description
    FROM catalog_master cm
    WHERE cm.category_id = ?
      AND (
        SELECT COUNT(*) FROM category_attributes ca WHERE ca.category_id = ?
      ) > (
        SELECT COUNT(DISTINCT pa.attribute_id)
        FROM product_attributes pa
        JOIN category_attributes ca ON ca.id = pa.attribute_id AND ca.category_id = ?
        WHERE pa.catalog_id = cm.id
      )
  `).all(catId, catId, catId);

  batchStatus[catId] = { running: true, total: products.length, done: 0 };
  res.json({ ok: true, message: `Uruchomiono zadanie w tle. Do pobrania: ${products.length} produktów.` });

  (async () => {
    try {
      const attrsDef = db.prepare('SELECT id, attr_name, attr_type FROM category_attributes WHERE category_id = ?').all(catId);
      if(!attrsDef.length) { batchStatus[catId].running = false; return; }

      attrSync.ensureProductAttrSource(db);
      let insVal;
      try {
        insVal = db.prepare("INSERT OR REPLACE INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric, source) VALUES (?, ?, ?, ?, 'supplier')");
      } catch (_) {
        insVal = db.prepare('INSERT OR REPLACE INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric) VALUES (?, ?, ?, ?)');
      }

      for(const p of products) {
        if(!batchStatus[catId].running) break;

        const prompt = `Jesteś ekspertem ds. sprzętu PC. Wyodrębnij specyfikację techniczną produktu z opisu.
Produkt: ${p.name}
Producent: ${p.manufacturer}
Opis: ${(p.description || '').substring(0, 1500)}

Zwróć wynik WYŁĄCZNIE w formacie JSON, klucz to nazwa parametru, wartość to wyodrębniona wartość:
${attrsDef.map(a => `- ${a.attr_name} (${a.attr_type})`).join('\n')}

Wartości numeryczne (np. 105W) zwracaj jako liczby (np. 105). Dla brakujących przypisz null. Nie pisz nic poza JSON.`;

        const replyData = await complete(
          "Jesteś ekspertem ds. sprzętu PC. Twoim zadaniem jest wyodrębnienie specyfikacji technicznej.",
          prompt
        );
        const reply = replyData.text;
        try {
          const cleanJson = reply.replace(/\x60\x60\x60json/g, '').replace(/\x60\x60\x60/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          
          db.transaction(() => {
            for(const a of attrsDef) {
              const val = parsed[a.attr_name];
              if(val !== undefined && val !== null) {
                const existing = db.prepare('SELECT source FROM product_attributes WHERE catalog_id = ? AND attribute_id = ?').get(p.id, a.id);
                if (existing && existing.source === 'manual') continue;
                if(a.attr_type === 'numeric') {
                  insVal.run(p.id, a.id, null, parseFloat(val) || null);
                } else {
                  insVal.run(p.id, a.id, String(val), null);
                }
              }
            }
          })();
        } catch(e) {
          console.error("AI parse error for product", p.id, e.message);
        }

        batchStatus[catId].done++;
      }
    } catch(e) {
      console.error(e);
    }
    batchStatus[catId].running = false;
  })();
});

// POST /api/oferter/product-attrs/extract/:id
router.post('/product-attrs/extract/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const db = getDb();
    const p = db.prepare(`
      SELECT cm.id, cm.category_id, cm.name, cm.manufacturer,
        (SELECT sp.description FROM supplier_products sp
         WHERE ${offerMatchSql('sp')} AND sp.description IS NOT NULL AND trim(sp.description) != ''
         LIMIT 1) AS description
      FROM catalog_master cm WHERE cm.id = ?
    `).get(id);
    if(!p) return res.status(404).json({ error: 'Nie znaleziono produktu' });

    const attrsDef = db.prepare('SELECT id, attr_name, attr_type FROM category_attributes WHERE category_id = ?').all(p.category_id);
    if(!attrsDef.length) return res.json({ ok: false, error: 'Brak zdefiniowanych atrybutów dla kategorii.' });

    const prompt = `Jesteś ekspertem ds. sprzętu PC. Wyodrębnij specyfikację techniczną produktu.
Produkt: ${p.name}
Producent: ${p.manufacturer}
Opis: ${(p.description || '').substring(0, 1500)}

Zwróć wynik WYŁĄCZNIE w formacie JSON, klucz to nazwa parametru:
${attrsDef.map(a => `- ${a.attr_name} (${a.attr_type})`).join('\n')}

Wartości numeryczne (np. 105W) zwracaj jako liczby. Dla brakujących przypisz null. Odpowiedz TYLKO JSON.`;

    const replyData = await complete(
      "Jesteś ekspertem ds. sprzętu PC. Twoim zadaniem jest wyodrębnienie specyfikacji technicznej.",
      prompt
    );
    const reply = replyData.text;
    const cleanJson = reply.replace(/\x60\x60\x60json/g, '').replace(/\x60\x60\x60/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    
    attrSync.ensureProductAttrSource(db);
    let insVal;
    try {
      insVal = db.prepare("INSERT OR REPLACE INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric, source) VALUES (?, ?, ?, ?, 'supplier')");
    } catch (_) {
      insVal = db.prepare('INSERT OR REPLACE INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric) VALUES (?, ?, ?, ?)');
    }
    db.transaction(() => {
      for(const a of attrsDef) {
        const val = parsed[a.attr_name];
        if(val !== undefined && val !== null) {
          const existing = db.prepare('SELECT source FROM product_attributes WHERE catalog_id = ? AND attribute_id = ?').get(p.id, a.id);
          if (existing && existing.source === 'manual') continue;
          if(a.attr_type === 'numeric') {
            insVal.run(p.id, a.id, null, parseFloat(val) || null);
          } else {
            insVal.run(p.id, a.id, String(val), null);
          }
        }
      }
    })();

    res.json({ ok: true, message: 'Wyodrębniono', parsed });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
