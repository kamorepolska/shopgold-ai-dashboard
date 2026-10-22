const express = require('express');
const router = express.Router();
const { complete } = require('../services/aiService');
const { eanVariants, normalizeEan } = require('../services/eanUtil');

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

// ─── PC COMPONENT ATTRIBUTE DEFINITIONS ───────────────────────────────────────

const PC_ATTR_SCHEMA = {
  'procesor': [
    { name: 'Socket', type: 'text', unit: null },
    { name: 'TDP', type: 'numeric', unit: 'W' },
    { name: 'Liczba rdzeni', type: 'numeric', unit: null },
    { name: 'Zintegrowana grafika', type: 'text', unit: null },
    { name: 'Typ pamieci RAM', type: 'text', unit: null },
    { name: 'Maks. taktowanie RAM', type: 'numeric', unit: 'MHz' },
  ],
  'plyta glowna': [
    { name: 'Socket', type: 'text', unit: null },
    { name: 'Chipset', type: 'text', unit: null },
    { name: 'Format', type: 'text', unit: null },
    { name: 'Typ pamieci RAM', type: 'text', unit: null },
    { name: 'Sloty RAM', type: 'numeric', unit: null },
    { name: 'Sloty M.2', type: 'numeric', unit: null },
    { name: 'WiFi', type: 'text', unit: null },
  ],
  'chlodzenie': [
    { name: 'Typ chlodzenia', type: 'text', unit: null },
    { name: 'Max TDP', type: 'numeric', unit: 'W' },
    { name: 'Kompatybilne sockety', type: 'text', unit: null },
    { name: 'Wysokosc', type: 'numeric', unit: 'mm' },
    { name: 'Rozmiar radiatora', type: 'text', unit: 'mm' },
    { name: 'RGB', type: 'text', unit: null },
  ],
  'pamiec ram': [
    { name: 'Typ', type: 'text', unit: null },
    { name: 'Pojemnosc', type: 'numeric', unit: 'GB' },
    { name: 'Taktowanie', type: 'numeric', unit: 'MHz' },
    { name: 'Liczba kosci', type: 'numeric', unit: null },
    { name: 'RGB', type: 'text', unit: null },
  ],
  'dysk': [
    { name: 'Typ dysku', type: 'text', unit: null },
    { name: 'Pojemnosc', type: 'numeric', unit: 'GB' },
    { name: 'Interfejs', type: 'text', unit: null },
  ],
  'karta graficzna': [
    { name: 'Chip', type: 'text', unit: null },
    { name: 'VRAM', type: 'numeric', unit: 'GB' },
    { name: 'TDP', type: 'numeric', unit: 'W' },
    { name: 'Dlugosc karty', type: 'numeric', unit: 'mm' },
    { name: 'RGB', type: 'text', unit: null },
  ],
  'zasilacz': [
    { name: 'Moc', type: 'numeric', unit: 'W' },
    { name: 'Certyfikacja', type: 'text', unit: null },
    { name: 'Modularnosc', type: 'text', unit: null },
  ],
  'obudowa': [
    { name: 'Format plyty', type: 'text', unit: null },
    { name: 'Maks. wys. chlodzenia', type: 'numeric', unit: 'mm' },
    { name: 'Obsluga AIO', type: 'text', unit: null },
    { name: 'Maks. dl. karty graficznej', type: 'numeric', unit: 'mm' },
    { name: 'Kolor', type: 'text', unit: null },
    { name: 'RGB', type: 'text', unit: null },
    { name: 'Szyba hartowana', type: 'text', unit: null },
  ],
  'system operacyjny': [
    { name: 'Wersja', type: 'text', unit: null },
    { name: 'Typ licencji', type: 'text', unit: null },
  ],
};


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
    const cats = db.prepare('SELECT id, name FROM product_categories').all();
    const results = [];

    const insertAttr = db.prepare(`
      INSERT OR IGNORE INTO category_attributes (category_id, attr_name, attr_type, attr_unit, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    const categoryExactMap = {
      'procesor': 'Procesory',
      'plyta glowna': 'Płyty główne',
      'chlodzenie': 'Chłodzenie',
      'pamiec ram': 'Pamięci RAM',
      'dysk': 'Dyski i SSD',
      'karta graficzna': 'Karty graficzne',
      'zasilacz': 'Zasilacze',
      'obudowa': 'Obudowy',
      'system operacyjny': 'Systemy operacyjne'
    };

    const doSeed = db.transaction(() => {
      for (const cat of cats) {
        const catName = cat.name.trim();
        for (const [keyword, attrs] of Object.entries(PC_ATTR_SCHEMA)) {
          const targetName = categoryExactMap[keyword];
          if (targetName && catName.toLowerCase() === targetName.toLowerCase()) {
            let added = 0;
            attrs.forEach((a, i) => {
              try {
                const r = insertAttr.run(cat.id, a.name, a.type, a.unit, i);
                if (r.changes) added++;
              } catch(_) {}
            });
            if (added > 0) results.push({ category: cat.name, id: cat.id, added });
          }
        }
      }
    });


    doSeed();

    const totalAdded = results.reduce((s, r) => s + r.added, 0);
    res.json({ ok: true, seeded: results, totalAdded, message: `Dodano ${totalAdded} atrybutow w ${results.length} kategoriach` });
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
      return ['procesor', 'plyta', 'chlodzenie', 'pamiec', 'dysk', 'karta', 'zasilacz', 'obudowa', 'system', 'cpu', 'mainboard', 'kuhler', 'arbeitsspeicher', 'festplatten', 'grafikkarten', 'netzteile', 'gehause', 'ssd', 'hdd'].some(k => n.includes(k));
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
      is_pc_component: ['procesor', 'plyta', 'chlodzenie', 'pamiec', 'dysk', 'karta', 'zasilacz', 'obudowa', 'system', 'cpu', 'mainboard', 'kuhler', 'arbeitsspeicher', 'festplatten', 'grafikkarten', 'netzteile', 'gehause', 'ssd', 'hdd'].some(k => normalizeStr(c.name).includes(k)),
    }));

    res.json({ ok: true, categories: result });
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

    let where = 'cm.category_id = ?';
    const params = [catId];
    if (search) { where += ' AND (cm.name LIKE ? OR cm.manufacturer LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    // Exclude completely dead products (no stock and no price)
    where += ` AND (
      sp.stock > 0 
      OR sp.buy_price > 0 
      OR (SELECT SUM(stock_quantity) FROM supplier_products sup WHERE ${offerMatchSql('sup')}) > 0 
      OR (SELECT MIN(price_pln) FROM supplier_products sup2 WHERE ${offerMatchSql('sup2')} AND sup2.price_pln > 0) > 0
    )`;

    const products = db.prepare(`
      SELECT
        cm.id, cm.canonical_ean, cm.name, cm.manufacturer, cm.manufacturer_code,
        cm.category_id, cm.category_name,
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

    // 1. Pobierz cechy manualne (product_attributes) dla wszystkich produktów naraz
    const productIds = products.map(p => p.id);
    const eans = products.map(p => p.canonical_ean);

    const manualAttrsMap = {};
    if (productIds.length > 0) {
      const manualRows = db.prepare(`
        SELECT pa.catalog_id, ca.attr_name, ca.attr_type, ca.attr_unit, pa.value_text, pa.value_numeric
        FROM product_attributes pa
        JOIN category_attributes ca ON ca.id = pa.attribute_id
        WHERE pa.catalog_id IN (${productIds.map(() => '?').join(',')})
          AND ca.category_id = ?
      `).all(...productIds, catId);
      for (const row of manualRows) {
        if (!manualAttrsMap[row.catalog_id]) manualAttrsMap[row.catalog_id] = {};
        manualAttrsMap[row.catalog_id][row.attr_name] = row;
      }
    }

    // 2. JS-side alias mapping (eliminuje wolny LOWER JOIN)
    const catAttrDefs = db.prepare(
      'SELECT attr_name, attr_type, attr_unit FROM category_attributes WHERE category_id = ? ORDER BY sort_order, attr_name'
    ).all(catId);
    const catAttrByLower = {};
    for (const def of catAttrDefs) catAttrByLower[def.attr_name.toLowerCase()] = def;

    const aliasRows = db.prepare('SELECT alias, canonical_name FROM attr_aliases').all();
    const aliasToCanonical = {};
    for (const a of aliasRows) aliasToCanonical[a.alias.toLowerCase()] = a.canonical_name.toLowerCase();

    // Tagi wewnętrzne hurtowni — wyklucz z wyświetlania
    const INTERNAL_TAGS = new Set([
      // Kategorie/grupy
      'podkategoria','nadkategoria','podgrupa towarowa','grupa towarowa',
      'kategoria 1','kategoria 2','kategoria 3','kategoria','kategoria kablowa','kategoria kabla',
      '_kategoria (wewnętrzna)',
      // Kody / ID produktów
      'id produktu','id','nr artykułu','nr. artykułu','numer artykułu','indeks','index',
      'kod producenta','kod produktu','symbol','sku','erp','elkocode','cn code','cncode',
      'nr katalogowy','numer katalogowy','kod towaru','kod ean','kod kreskowy',
      // Ceny i marże
      'cena detaliczna brutto','cena detaliczna netto','cena zakupu','cena',
      'cena brutto','cena netto','cena hurtowa','cena + marża','cena + marza',
      'marża','marza','narzut','rabat',
      // Magazyn / dostępność / stany
      'dostępność','dostepnosc','ilość','ilosc','stan magazynowy','stan mag.',
      'produkt z magazynu','produkt gabarytowy','gabaryt',
      // Opis / dokumentacja
      'opis','nazwa','krótki opis','dane producenta','informacje dodatkowe','uwagi',
      // Logistyczne / opakowanie
      'opakowanie','opakowanie zbiorcze','wymiary opakowania',
      'głębokość opakowania','szerokość opakowania','wysokość opakowania',
      'waga brutto','waga netto',
      // Administracyjne
      'data dodania','producent','data',
    ]);

    // Pobierz raw SPA dla wszystkich EAN-ów (2ms)
    const supplierAttrsMap = {}; // ean -> {canonical_attr_name -> value}
    const rawAttrsMap = {};       // ean -> {attr_name -> first_value} (cechy nie zmapowane do category_attributes)

    if (eans.length > 0) {
      const expanded = expandEans(eans);
      const norms = eans.map(normalizeEan).filter(Boolean);
      const spaWhere = [];
      const spaParams = [];
      if (expanded.length) {
        spaWhere.push(`spa.ean IN (${expanded.map(() => '?').join(',')})`);
        spaParams.push(...expanded);
      }
      if (norms.length) {
        spaWhere.push(`spa.normalized_ean IN (${norms.map(() => '?').join(',')})`);
        spaParams.push(...norms);
      }
      const spaRows = spaWhere.length ? db.prepare(`
        SELECT spa.ean, spa.normalized_ean, spa.attr_name, spa.attr_value
        FROM supplier_product_attrs spa
        WHERE ${spaWhere.join(' OR ')}
      `).all(...spaParams) : [];

      for (const row of spaRows) {
        const lowerName = row.attr_name.toLowerCase();

        // Mapowanie przez alias → category_attributes
        const canonicalLower = aliasToCanonical[lowerName];
        if (canonicalLower) {
          const catDef = catAttrByLower[canonicalLower];
          if (catDef) {
            const attrKeys = expandEans([row.ean, row.normalized_ean]);
            for (const k of attrKeys) {
              if (!supplierAttrsMap[k]) supplierAttrsMap[k] = {};
              if (!supplierAttrsMap[k][catDef.attr_name]) {
                supplierAttrsMap[k][catDef.attr_name] = { ...catDef, attr_value: row.attr_value };
              }
            }
          }
        }

        // Raw SPA fallback — cechy nie zmapowane, nie-wewnętrzne, z wartością
        const isJunk = INTERNAL_TAGS.has(lowerName)
          // Ceny, marże, koszty
          || /cena|marż|marza|brutto|netto|narzut|sprzedaż|kupna|price|rabat|discount/i.test(lowerName)
          // Kody, ID, indeksy
          || /\bid\b|kod\b|code\b|index\b|indeks|sku\b|erp\b|symbol\b|elko|artykuł|artykul|nr\.\s*art|numer art|katalog/i.test(lowerName)
          // Magazyn, dostępność, stany
          || /magazyn|dostępn|dostepn|\bilosc\b|\bilość\b|gabaryt|produkt z mag|stan mag/i.test(lowerName)
          // Opakowanie / logistyczne
          || /opakow|wymiary opak|waga\s+(brutto|netto)/i.test(lowerName)
          // Kategorie, grupy
          || /\bkategor|\bgrupa\b|\bpodkategor|\bnadkategor|\bpodgrupa/i.test(lowerName)
          // Opis, uwagi, dane administracyjne
          || /^(opis|nazwa|uwagi|dane\s+producenta|informacje\s+dodatk|krótki\s+opis|short\s+desc|description)$/i.test(lowerName)
          // Wartości jako nazwy (np. "0.5A", "1 x USB", "A1453") — nazwa atrybutu zaczyna się od cyfry lub wygląda jak wartość
          || /^\d/.test(row.attr_name.trim())
          // Puste lub za krótkie nazwy
          || lowerName.trim().length < 2;

        if (!isJunk && row.attr_value && row.attr_value.trim()) {
          const rawKeys = expandEans([row.ean, row.normalized_ean]);
          for (const k of rawKeys) {
            if (!rawAttrsMap[k]) rawAttrsMap[k] = {};
            if (!rawAttrsMap[k][row.attr_name]) {
              rawAttrsMap[k][row.attr_name] = row.attr_value.trim();
            }
          }
        }
      }
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
        const supplierForEan = firstMapHit(supplierAttrsMap, p.canonical_ean) || {};
        const rawForEan = firstMapHit(rawAttrsMap, p.canonical_ean) || {};

        // Scal mapped attrs: manual > hurtownia (przez category_attributes)
        const mappedAttributes = catAttrDefs
          .map(def => {
            const manual = manualForProd[def.attr_name];
            const supplier = supplierForEan[def.attr_name];
            let value_text = null;
            let value_numeric = null;
            if (manual && (manual.value_text !== null || manual.value_numeric !== null)) {
              value_text = manual.value_text;
              value_numeric = manual.value_numeric;
            } else if (supplier && supplier.attr_value !== null) {
              if (def.attr_type === 'numeric') {
                const parsed = parseFloat(supplier.attr_value);
                value_numeric = isNaN(parsed) ? null : parsed;
              } else {
                value_text = supplier.attr_value;
              }
            }
            return { attr_name: def.attr_name, attr_type: def.attr_type, attr_unit: def.attr_unit || null, value_text, value_numeric, source: 'mapped' };
          })
          .filter(a => a.value_text !== null || a.value_numeric !== null);

        // Raw SPA attrs (fallback dla kategorii bez pełnego mapowania)
        const mappedNames = new Set(mappedAttributes.map(a => a.attr_name.toLowerCase()));
        const rawAttributes = Object.entries(rawForEan)
          .filter(([k]) => !mappedNames.has(k.toLowerCase()))
          .map(([k, v]) => ({ attr_name: k, attr_type: 'text', attr_unit: null, value_text: v, value_numeric: null, source: 'raw' }));

        const attributes = [...mappedAttributes, ...rawAttributes];

        return {
          ...p,
          in_subiekt: p.subiekt_stock != null,
          effective_buy_price,
          supplier_stock,
          attributes,
          suppliers: suppliers.slice(0, 5), // max 5 dostawców
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

    db.prepare(`
      INSERT INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(catalog_id, attribute_id) DO UPDATE SET value_text=excluded.value_text, value_numeric=excluded.value_numeric
    `).run(catalogId, attribute_id, value_text || null, value_numeric != null ? parseFloat(value_numeric) : null);

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

    const upsert = db.prepare(`
      INSERT INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(catalog_id, attribute_id) DO UPDATE SET value_text=excluded.value_text, value_numeric=excluded.value_numeric
    `);

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
      is_pc_component: ['procesor', 'plyta', 'chlodzenie', 'pamiec', 'dysk', 'karta', 'zasilacz', 'obudowa', 'system', 'cpu', 'mainboard', 'kuhler', 'arbeitsspeicher', 'festplatten', 'grafikkarten', 'netzteile', 'gehause', 'ssd', 'hdd'].some(k => normalizeStr(c.name).includes(k)),
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
    
    // Pobierzmy informacje o wszystkich komponentach (EAN, kategoria)
    const catalogItems = db.prepare(`
      SELECT cm.id, cm.canonical_ean, cm.category_id, cm.category_name
      FROM catalog_master cm
      WHERE cm.id IN (${components.map(() => '?').join(',')})
    `).all(...components);

    // Pobierz wszystkie definicje atrybutow dla kategorii komponentow (bez duplikatow)
    const catIds = [...new Set(catalogItems.map(c => c.category_id))];

    // Prepared statement: dla danego komponentu pobierz scalone cechy (manualne + hurtownia)
    const attrForCompStmt = db.prepare(`
      SELECT
        ca.attr_name, ca.attr_type,
        pa.value_text, pa.value_numeric,
        (
          SELECT spa.attr_value
          FROM supplier_product_attrs spa
          JOIN attr_aliases aa ON LOWER(aa.alias) = LOWER(spa.attr_name)
          WHERE (spa.normalized_ean = normalize_ean(?) OR spa.ean = ? OR spa.ean = '0' || ? OR normalize_ean(spa.ean) = normalize_ean(?))
            AND LOWER(aa.canonical_name) = LOWER(ca.attr_name)
          LIMIT 1
        ) AS supplier_value
      FROM category_attributes ca
      LEFT JOIN product_attributes pa ON pa.attribute_id = ca.id AND pa.catalog_id = ?
      WHERE ca.category_id = ?
    `);

    // Organizacja w mapy per kategoria -> atrybuty (manualne z priorytetem, hurtownia fallback)
    const compMap = {};
    for (const item of catalogItems) {
      if (!compMap[item.category_name]) compMap[item.category_name] = {};
      const attrs = attrForCompStmt.all(item.canonical_ean, item.canonical_ean, item.canonical_ean, item.canonical_ean, item.id, item.category_id);
      for (const a of attrs) {
        const hasManual = a.value_text !== null || a.value_numeric !== null;
        let val;
        if (hasManual) {
          val = a.value_numeric !== null ? a.value_numeric : a.value_text;
        } else if (a.supplier_value !== null) {
          val = a.attr_type === 'numeric' ? (parseFloat(a.supplier_value) || a.supplier_value) : a.supplier_value;
        }
        if (val !== null && val !== undefined) {
          compMap[item.category_name][a.attr_name] = val;
        }
      }
    }
    
    const messages = [];
    let isValid = true;
    
    // Helper function
    const norm = (s) => (s||'').toString().toLowerCase().trim();

    // 1. Zgodnosc CPU <-> Plyta
    const cpu = compMap['Procesory'];
    const mb = compMap['Płyty główne'];
    if (cpu && mb) {
      if (norm(cpu['Socket']) && norm(mb['Socket']) && norm(cpu['Socket']) !== norm(mb['Socket'])) {
        isValid = false;
        messages.push({ type: 'error', text: `Niezgodny Socket! Procesor wymaga ${cpu['Socket']}, a wybrana płyta posiada ${mb['Socket']}.` });
      }
    }

    // 2. RAM <-> Plyta
    const ram = compMap['Pamięci RAM'];
    if (mb && ram) {
      if (norm(mb['Typ pamięci RAM']) && norm(ram['Typ']) && !norm(mb['Typ pamięci RAM']).includes(norm(ram['Typ']))) {
         isValid = false;
         messages.push({ type: 'error', text: `Niezgodny typ pamięci! Płyta obsługuje ${mb['Typ pamięci RAM']}, wybrano pamięć ${ram['Typ']}.` });
      }
      if (mb['Sloty RAM'] && ram['Liczba kości'] && ram['Liczba kości'] > mb['Sloty RAM']) {
         isValid = false;
         messages.push({ type: 'error', text: `Zbyt dużo kości RAM (${ram['Liczba kości']}). Płyta posiada tylko ${mb['Sloty RAM']} slotów.` });
      }
    }

    // 3. CPU <-> Chłodzenie (TDP)
    const cooler = compMap['Chłodzenie CPU'] || compMap['Chłodzenie wodne'];
    if (cpu && cooler) {
      if (cooler['Max TDP'] && cpu['TDP'] && cooler['Max TDP'] < cpu['TDP']) {
         messages.push({ type: 'warning', text: `Chłodzenie może być zbyt słabe. Max TDP chłodzenia (${cooler['Max TDP']}W) jest mniejsze niż TDP procesora (${cpu['TDP']}W).` });
      }
      if (cooler['Kompatybilne sockety'] && cpu['Socket'] && !norm(cooler['Kompatybilne sockety']).includes(norm(cpu['Socket']))) {
         isValid = false;
         messages.push({ type: 'error', text: `Chłodzenie nie pasuje do gniazda procesora (${cpu['Socket']}).` });
      }
    }

    // 4. Płyta <-> Obudowa
    const casePc = compMap['Obudowy komputerowe'];
    if (mb && casePc) {
      if (casePc['Format płyty'] && mb['Format'] && !norm(casePc['Format płyty']).includes(norm(mb['Format']))) {
        isValid = false;
        messages.push({ type: 'error', text: `Płyta główna (${mb['Format']}) nie zmieści się w obudowie (wspiera ${casePc['Format płyty']}).` });
      }
    }

    // 5. Chłodzenie <-> Obudowa
    if (cooler && casePc) {
      if (cooler['Typ chłodzenia'] && norm(cooler['Typ chłodzenia']).includes('powietrz') && cooler['Wysokość'] && casePc['Maks. wys. chłodzenia']) {
        if (cooler['Wysokość'] > casePc['Maks. wys. chłodzenia']) {
          isValid = false;
          messages.push({ type: 'error', text: `Chłodzenie jest za wysokie (${cooler['Wysokość']}mm). Obudowa mieści max ${casePc['Maks. wys. chłodzenia']}mm.` });
        }
      }
    }

    // 6. Karta graficzna <-> Obudowa
    const gpu = compMap['Karty graficzne'];
    if (gpu && casePc) {
      if (gpu['Długość karty'] && casePc['Maks. dł. karty graficznej']) {
         if (gpu['Długość karty'] > casePc['Maks. dł. karty graficznej']) {
           isValid = false;
           messages.push({ type: 'error', text: `Karta graficzna jest za długa (${gpu['Długość karty']}mm). Obudowa mieści max ${casePc['Maks. dł. karty graficznej']}mm.` });
         }
      }
    }

    // 7. Zasilacz moc vs (CPU + GPU + 50W zapasu)
    const psu = compMap['Zasilacze'];
    if (psu && cpu && gpu) {
      const needed = (cpu['TDP'] || 100) + (gpu['TDP'] || 250) + 50;
      if (psu['Moc'] && psu['Moc'] < needed) {
        messages.push({ type: 'warning', text: `Moc zasilacza (${psu['Moc']}W) może być niewystarczająca. Sugerowana moc dla zestawu to min. ${needed}W.` });
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
    SELECT cm.id, cm.name, cm.manufacturer, sp.description
    FROM catalog_master cm
    JOIN supplier_products sp ON sp.ean = cm.canonical_ean
    WHERE cm.category_id = ?
      AND cm.id NOT IN (SELECT catalog_id FROM product_attributes)
  `).all(catId);

  batchStatus[catId] = { running: true, total: products.length, done: 0 };
  res.json({ ok: true, message: `Uruchomiono zadanie w tle. Do pobrania: ${products.length} produktów.` });

  (async () => {
    try {
      const attrsDef = db.prepare('SELECT id, attr_name, attr_type FROM category_attributes WHERE category_id = ?').all(catId);
      if(!attrsDef.length) { batchStatus[catId].running = false; return; }

      const insVal = db.prepare('INSERT OR REPLACE INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric) VALUES (?, ?, ?, ?)');

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
    const p = db.prepare('SELECT cm.id, cm.category_id, cm.name, cm.manufacturer, sp.description FROM catalog_master cm JOIN supplier_products sp ON sp.ean = cm.canonical_ean WHERE cm.id = ?').get(id);
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
    
    const insVal = db.prepare('INSERT OR REPLACE INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric) VALUES (?, ?, ?, ?)');
    db.transaction(() => {
      for(const a of attrsDef) {
        const val = parsed[a.attr_name];
        if(val !== undefined && val !== null) {
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
