'use strict';

/**
 * Katalog Master jest jedynym źródłem ujednoliconych cech produktu.
 * Hurtownie → raw_attributes + product_attributes → Oferter / porównanie / katalog.
 */

const { normalizeEan, eanVariants, registerNormalizeEan } = require('./eanUtil');

const JUNK_KEYS = new Set([
  'podkategoria', 'nadkategoria', 'podgrupa towarowa', 'grupa towarowa',
  'kategoria 1', 'kategoria 2', 'kategoria 3', 'kategoria', 'kategoria kablowa', 'kategoria kabla',
  '_kategoria (wewnętrzna)', 'id produktu', 'id', 'nr artykułu', 'nr. artykułu', 'numer artykułu',
  'indeks', 'index', 'kod producenta', 'kod produktu', 'symbol', 'sku', 'erp', 'elkocode',
  'cn code', 'cncode', 'nr katalogowy', 'numer katalogowy', 'kod towaru', 'kod ean', 'kod kreskowy',
  'cena detaliczna brutto', 'cena detaliczna netto', 'cena zakupu', 'cena', 'cena brutto', 'cena netto',
  'cena hurtowa', 'cena + marża', 'cena + marza', 'marża', 'marza', 'narzut', 'rabat',
  'dostępność', 'dostepnosc', 'ilość', 'ilosc', 'stan magazynowy', 'stan mag.',
  'produkt z magazynu', 'produkt gabarytowy', 'gabaryt',
  'opis', 'nazwa', 'krótki opis', 'dane producenta', 'informacje dodatkowe', 'uwagi',
  'opakowanie', 'opakowanie zbiorcze', 'wymiary opakowania',
  'głębokość opakowania', 'szerokość opakowania', 'wysokość opakowania',
  'waga brutto', 'waga netto', 'data dodania', 'producent', 'data',
  'artnr', 'herstnr', 'hersteller', 'artname', 'beschreibung', 'menge', 'verfuegbar',
  'vkbrutto', 'vknetto', 'einkauf', 'kat1', 'kat2', 'kat3', 'indate',
]);

const JUNK_RE = /cena|marż|marza|brutto|netto|narzut|sprzedaż|kupna|price|rabat|discount|\bid\b|kod\b|code\b|index\b|indeks|sku\b|erp\b|symbol\b|elko|artykuł|artykul|nr\.\s*art|numer art|katalog|magazyn|dostępn|dostepn|\bilosc\b|\bilość\b|gabaryt|opakow|wymiary opak|waga\s+(brutto|netto)|\bkategor|\bgrupa\b|\bpodkategor|\bnadkategor|\bpodgrupa/i;

const SYNONYM_GROUPS = [
  ['socket', 'sockel', 'gniazdo', 'gniazdo procesora', 'cpu socket', 'processor socket', 'sockel cpu', 'cpu sockel'],
  ['tdp', 'thermal design power', 'pobor mocy', 'pobór mocy', 'wattage', 'moc cieplna'],
  ['rdzenie', 'liczba rdzeni', 'cores', 'core count', 'anzahl kerne', 'kerne', 'cpu cores'],
  ['watki', 'wątki', 'threads', 'thread count', 'anzahl threads'],
  ['chipset', 'chipset plyty', 'motherboard chipset'],
  ['format', 'form factor', 'formfaktor', 'format plyty', 'format płyty', 'atx form'],
  ['typ pamieci ram', 'typ pamięci ram', 'typ', 'memory type', 'ram type', 'speichertyp', 'typ pamieci', 'ddr'],
  ['pojemnosc', 'pojemność', 'capacity', 'kapazitat', 'kapazität', 'size gb', 'speichergröße'],
  ['taktowanie', 'frequency', 'takt', 'clock', 'mhz', 'speed', 'taktfrequenz', 'memory speed'],
  ['vram', 'pamiec', 'pamięć', 'memory size', 'gpu memory', 'speicher'],
  ['moc', 'power', 'leistung', 'watt', 'psu wattage', 'output power'],
  ['certyfikat', 'certyfikacja', 'certificate', '80 plus', 'efficiency'],
  ['modularnosc', 'modularność', 'modularnosc', 'modular'],
  ['dlugosc karty', 'długość karty', 'length', 'lange', 'länge', 'gpu length', 'card length'],
  ['wysokosc', 'wysokość', 'height', 'hohe', 'höhe', 'cooler height'],
  ['rgb', 'beleuchtung', 'podswietlenie', 'podświetlenie', 'lighting'],
  ['wifi', 'wireless', 'wlan'],
  ['sloty ram', 'ram slots', 'dimm slots', 'liczba slotow ram'],
  ['sloty m.2', 'm.2 slots', 'm2 slots'],
  ['interfejs', 'interface', 'bus', 'pcie'],
  ['chip', 'gpu chip', 'grafikchip'],
  ['max tdp', 'tdp max', 'cooler tdp'],
  ['kompatybilne sockety', 'compatible sockets', 'sockel kompatibel'],
  ['typ chlodzenia', 'typ chłodzenia', 'cooler type', 'cooling type'],
  ['liczba kosci', 'liczba kości', 'modules', 'kit', 'anzahl module'],
  ['typ dysku', 'drive type', 'ssd type'],
];

const NUMERIC_HINT = /tdp|rdzen|w[aą]tk|pojemn|moc\b|taktowan|mhz|ghz|vram|wysoko|d[lł]ugo|sloty|liczba|obroty|cache|watt|\bgb\b|\bmm\b/i;

const PC_ATTR_ALIASES = [
  ['sockel', 'Socket'], ['gniazdo', 'Socket'], ['gniazdo procesora', 'Socket'],
  ['cpu socket', 'Socket'], ['processor socket', 'Socket'], ['sockel cpu', 'Socket'],
  ['thermal design power', 'TDP'], ['pobór mocy', 'TDP'], ['pobor mocy', 'TDP'],
  ['cores', 'Rdzenie'], ['core count', 'Rdzenie'], ['anzahl kerne', 'Rdzenie'],
  ['liczba rdzeni', 'Rdzenie'], ['kerne', 'Rdzenie'],
  ['threads', 'Wątki'], ['thread count', 'Wątki'], ['liczba watkow', 'Wątki'],
  ['form factor', 'Format'], ['formfaktor', 'Format'], ['format płyty', 'Format'],
  ['format plyty', 'Format'],
  ['memory type', 'Typ'], ['ram type', 'Typ'], ['speichertyp', 'Typ'],
  ['typ pamięci ram', 'Typ'], ['typ pamieci ram', 'Typ'], ['typ pamięci', 'Typ'],
  ['capacity', 'Pojemność'], ['kapazität', 'Pojemność'], ['pojemnosc', 'Pojemność'],
  ['taktfrequenz', 'Taktowanie'], ['frequency', 'Taktowanie'], ['clock', 'Taktowanie'],
  ['memory speed', 'Taktowanie'], ['mhz', 'Taktowanie'],
  ['gpu memory', 'Pamięć'], ['vram', 'Pamięć'], ['speicher', 'Pamięć'],
  ['leistung', 'Moc'], ['watt', 'Moc'], ['psu wattage', 'Moc'], ['power', 'Moc'],
  ['80 plus', 'Certyfikat'], ['certificate', 'Certyfikat'], ['certyfikacja', 'Certyfikat'],
  ['modular', 'Modularność'], ['modularnosc', 'Modularność'],
  ['gpu length', 'Długość karty'], ['card length', 'Długość karty'], ['länge', 'Długość karty'],
  ['cooler height', 'Wysokość'], ['höhe', 'Wysokość'], ['wysokosc', 'Wysokość'],
  ['beleuchtung', 'RGB'], ['podświetlenie', 'RGB'], ['podswietlenie', 'RGB'],
  ['wlan', 'WiFi'], ['wireless', 'WiFi'],
  ['ram slots', 'Sloty RAM'], ['dimm slots', 'Sloty RAM'],
  ['m.2 slots', 'Sloty M.2'], ['m2 slots', 'Sloty M.2'],
  ['interface', 'Interfejs'], ['pcie', 'Interfejs'],
  ['chipset', 'Chipset'], ['grafikchip', 'Chip'],
];

function fold(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
    .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
    .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ');
}

const SYNONYM_INDEX = (() => {
  const map = new Map();
  SYNONYM_GROUPS.forEach((group, i) => {
    for (const name of group) map.set(fold(name), i);
  });
  return map;
})();

function isJunkAttrName(name) {
  const raw = String(name || '').trim();
  if (!raw || raw.length < 2) return true;
  if (/^\d/.test(raw)) return true;
  const lower = fold(raw);
  if (JUNK_KEYS.has(lower) || JUNK_KEYS.has(raw.toLowerCase().trim())) return true;
  if (/^(opis|nazwa|uwagi|dane\s+producenta|informacje\s+dodatk|krotki\s+opis|short\s+desc|description)$/i.test(lower)) return true;
  return JUNK_RE.test(raw);
}

function parseNumeric(value) {
  if (value == null) return null;
  const s = String(value).replace(',', '.').replace(/\s+/g, '');
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

function cleanAttrValue(v) {
  if (v == null) return '';
  if (typeof v === 'object') return '';
  const s = String(v).replace(/[\r\n]+/g, ' ').trim();
  if (!s || s === '-' || s === '0' || s === 'n/a' || s === 'N/A' || s === 'null') return '';
  return s.slice(0, 500);
}

function loadAliasMaps(db) {
  const aliasToCanon = new Map();
  try {
    const rows = db.prepare('SELECT alias, canonical_name FROM attr_aliases').all();
    for (const r of rows) {
      if (!r.alias || !r.canonical_name) continue;
      aliasToCanon.set(fold(r.alias), r.canonical_name);
    }
  } catch (_) {}
  for (const [alias, canon] of PC_ATTR_ALIASES) {
    if (!aliasToCanon.has(fold(alias))) aliasToCanon.set(fold(alias), canon);
  }
  return aliasToCanon;
}

function resolveKey(rawKey, aliasMap) {
  const folded = fold(rawKey);
  if (!folded) return '';
  return aliasMap.get(folded) || String(rawKey).trim();
}

function namesMatch(a, b) {
  const fa = fold(a);
  const fb = fold(b);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  const ga = SYNONYM_INDEX.get(fa);
  const gb = SYNONYM_INDEX.get(fb);
  return ga != null && ga === gb;
}

function isNumericAttr(attrName, attrType) {
  if (attrType === 'numeric') return true;
  return NUMERIC_HINT.test(fold(attrName));
}

function ensurePcAttrAliases(db) {
  let ins;
  try {
    ins = db.prepare('INSERT OR IGNORE INTO attr_aliases (alias, canonical_name) VALUES (?, ?)');
  } catch (_) {
    return 0;
  }
  let n = 0;
  const tx = db.transaction(() => {
    for (const [alias, canon] of PC_ATTR_ALIASES) {
      const r = ins.run(alias, canon);
      if (r.changes) n++;
    }
  });
  tx();
  try {
    const sourcing = require('./sourcingService');
    if (typeof sourcing.invalidateAttrAliasCache === 'function') sourcing.invalidateAttrAliasCache();
  } catch (_) {}
  return n;
}

function expandCategoryIds(db, catIds) {
  const out = new Set((catIds || []).map(Number).filter(Boolean));
  for (const id of [...out]) {
    try {
      const kids = db.prepare(`
        WITH RECURSIVE d(id) AS (
          SELECT ?
          UNION ALL
          SELECT pc.id FROM product_categories pc JOIN d ON pc.parent_id = d.id
        )
        SELECT id FROM d
      `).all(id);
      kids.forEach(r => out.add(r.id));
    } catch (_) {}
    try {
      db.prepare('SELECT id FROM product_categories WHERE ab_category_id = ?').all(id)
        .forEach(r => out.add(r.id));
    } catch (_) {}
  }
  return [...out];
}

function productEanKeys(product) {
  const keys = new Set();
  for (const v of eanVariants(product.canonical_ean)) keys.add(v);
  const n = normalizeEan(product.canonical_ean);
  if (n) keys.add(n);
  try {
    const extra = JSON.parse(product.all_eans || '[]');
    if (Array.isArray(extra)) {
      for (const e of extra) {
        const ne = normalizeEan(e);
        if (ne) keys.add(ne);
        eanVariants(e).forEach(v => keys.add(v));
      }
    }
  } catch (_) {}
  return [...keys];
}

function indexSupplierAttributes(db) {
  const byEan = new Map();
  const add = (ean, obj) => {
    const key = normalizeEan(ean);
    if (!key || !obj) return;
    if (!byEan.has(key)) byEan.set(key, {});
    const slot = byEan.get(key);
    for (const [k, v] of Object.entries(obj)) {
      const val = cleanAttrValue(v);
      if (!k || !val || isJunkAttrName(k)) continue;
      if (!slot[k]) slot[k] = val;
    }
  };

  try {
    const rows = db.prepare(`
      SELECT ean, normalized_ean, attributes FROM supplier_products
      WHERE attributes IS NOT NULL AND attributes != '' AND attributes != '{}'
    `).all();
    for (const r of rows) {
      let obj = r.attributes;
      if (typeof obj === 'string') {
        try { obj = JSON.parse(obj); } catch { obj = null; }
      }
      if (!obj || typeof obj !== 'object') continue;
      add(r.normalized_ean || r.ean, obj);
      add(r.ean, obj);
    }
  } catch (_) {}

  try {
    const spa = db.prepare(`
      SELECT ean, normalized_ean, attr_name, attr_value FROM supplier_product_attrs
      WHERE attr_value IS NOT NULL AND attr_value != ''
    `).all();
    for (const r of spa) {
      const obj = { [r.attr_name]: r.attr_value };
      add(r.normalized_ean || r.ean, obj);
      add(r.ean, obj);
    }
  } catch (_) {}

  return byEan;
}

function mergeRawForProduct(product, supplierIndex, aliasMap) {
  const merged = {};
  try {
    const existing = JSON.parse(product.raw_attributes || '{}');
    if (existing && typeof existing === 'object') Object.assign(merged, existing);
  } catch (_) {}
  for (const key of productEanKeys(product)) {
    const extra = supplierIndex.get(normalizeEan(key) || key);
    if (extra) Object.assign(merged, extra);
  }
  const out = {};
  for (const [k, v] of Object.entries(merged)) {
    const val = cleanAttrValue(v);
    if (!k || !val || isJunkAttrName(k)) continue;
    const resolved = resolveKey(k, aliasMap) || k;
    if (isJunkAttrName(resolved)) continue;
    if (!out[resolved]) out[resolved] = val;
  }
  return out;
}

function mapRawToCategoryAttrs(raw, catAttrs, aliasMap) {
  const mapped = [];
  if (!catAttrs || !catAttrs.length) return mapped;
  for (const [rawKey, rawVal] of Object.entries(raw || {})) {
    const resolved = resolveKey(rawKey, aliasMap);
    const cat = catAttrs.find(a => namesMatch(a.attr_name, resolved) || namesMatch(a.attr_name, rawKey));
    if (!cat) continue;
    const numeric = isNumericAttr(cat.attr_name, cat.attr_type);
    mapped.push({
      attribute_id: cat.id,
      attr_name: cat.attr_name,
      value_text: rawVal,
      value_numeric: numeric ? parseNumeric(rawVal) : null,
    });
  }
  return mapped;
}

function seedCategoryAttrSchema(db, categoryId, categoryName, attrMap) {
  if (!attrMap) return 0;
  const nameLower = fold(categoryName);
  let inserted = 0;
  for (const [keyword, attrs] of Object.entries(attrMap)) {
    if (!nameLower.includes(fold(keyword))) continue;
    attrs.forEach((name, i) => {
      const type = isNumericAttr(name) ? 'numeric' : 'text';
      try {
        const r = db.prepare(`
          INSERT OR IGNORE INTO category_attributes (category_id, attr_name, attr_type, attr_unit, sort_order, is_filter, visible)
          VALUES (?, ?, ?, ?, ?, 1, 1)
        `).run(categoryId, name, type, null, i);
        if (r.changes) inserted++;
      } catch (_) {
        try {
          const r = db.prepare('INSERT OR IGNORE INTO category_attributes (category_id, attr_name, sort_order) VALUES (?, ?, ?)')
            .run(categoryId, name, i);
          if (r.changes) inserted++;
        } catch (__) {}
      }
    });
    break;
  }
  return inserted;
}

/**
 * Scal cechy ze wszystkich hurtowni do catalog_master i uzupełnij product_attributes.
 * Nie nadpisuje ręcznie wpisanych wartości w product_attributes.
 */
function syncCatalogAttributes(db, { eans = null, catalogIds = null, seedSchemas = true, attrMap = null } = {}) {
  registerNormalizeEan(db);
  ensurePcAttrAliases(db);
  const aliasMap = loadAliasMaps(db);

  if (seedSchemas && attrMap) {
    try {
      const cats = db.prepare(`
        SELECT DISTINCT pc.id, pc.name
        FROM product_categories pc
        JOIN catalog_master cm ON cm.category_id = pc.id
      `).all();
      for (const cat of cats) {
        const cnt = db.prepare('SELECT COUNT(*) AS c FROM category_attributes WHERE category_id = ?').get(cat.id).c;
        if (cnt === 0) seedCategoryAttrSchema(db, cat.id, cat.name, attrMap);
      }
    } catch (_) {}
  }

  const selectSql = 'SELECT id, canonical_ean, all_eans, category_id, raw_attributes FROM catalog_master';
  let products;
  if (catalogIds && catalogIds.length) {
    const chunk = 400;
    products = [];
    for (let i = 0; i < catalogIds.length; i += chunk) {
      const part = catalogIds.slice(i, i + chunk);
      products.push(...db.prepare(`${selectSql} WHERE id IN (${part.map(() => '?').join(',')})`).all(...part));
    }
  } else {
    products = db.prepare(selectSql).all();
    if (eans && eans.length) {
      const want = new Set();
      for (const e of eans) {
        eanVariants(e).forEach(v => { const n = normalizeEan(v); if (n) want.add(n); });
      }
      products = products.filter(p => {
        if (want.has(normalizeEan(p.canonical_ean))) return true;
        try {
          const extra = JSON.parse(p.all_eans || '[]');
          return Array.isArray(extra) && extra.some(x => want.has(normalizeEan(x)));
        } catch {
          return false;
        }
      });
    }
  }

  const supplierIndex = indexSupplierAttributes(db);
  const catAttrCache = new Map();
  const catAttrs = (catId) => {
    if (!catId) return [];
    if (!catAttrCache.has(catId)) {
      catAttrCache.set(catId, db.prepare('SELECT id, attr_name, attr_type, attr_unit FROM category_attributes WHERE category_id = ?').all(catId));
    }
    return catAttrCache.get(catId);
  };

  const updRaw = db.prepare('UPDATE catalog_master SET raw_attributes = ? WHERE id = ?');
  const existingPa = db.prepare('SELECT id FROM product_attributes WHERE catalog_id = ? AND attribute_id = ?');
  const insPa = db.prepare('INSERT INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric) VALUES (?, ?, ?, ?)');

  let rawUpdated = 0;
  let filled = 0;

  const tx = db.transaction(() => {
    for (const p of products) {
      const merged = mergeRawForProduct(p, supplierIndex, aliasMap);
      const rawJson = JSON.stringify(merged);
      if (rawJson !== (p.raw_attributes || '{}')) {
        updRaw.run(rawJson, p.id);
        rawUpdated++;
      }
      const defs = catAttrs(p.category_id);
      const mapped = mapRawToCategoryAttrs(merged, defs, aliasMap);
      for (const m of mapped) {
        if (existingPa.get(p.id, m.attribute_id)) continue;
        insPa.run(p.id, m.attribute_id, m.value_text, m.value_numeric);
        filled++;
      }
    }
  });
  tx();

  return { products: products.length, filled, raw_updated: rawUpdated };
}

function buildAttributeList(raw, manualByName, catAttrDefs, aliasMap) {
  aliasMap = aliasMap || new Map();
  raw = raw && typeof raw === 'object' ? raw : {};
  manualByName = manualByName || {};
  const mapped = [];
  const used = new Set();
  for (const def of catAttrDefs || []) {
    const man = manualByName[def.attr_name]
      || Object.values(manualByName).find(m => namesMatch(m.attr_name, def.attr_name));
    let value_text = null;
    let value_numeric = null;
    let source = 'mapped';
    if (man && (man.value_text != null || man.value_numeric != null)) {
      value_text = man.value_text;
      value_numeric = man.value_numeric;
      source = 'catalog';
    } else {
      const hit = Object.entries(raw).find(([k]) => namesMatch(k, def.attr_name) || namesMatch(resolveKey(k, aliasMap), def.attr_name));
      if (hit) {
        value_text = hit[1];
        if (isNumericAttr(def.attr_name, def.attr_type)) value_numeric = parseNumeric(hit[1]);
        source = 'raw';
      }
    }
    if (value_text != null || value_numeric != null) {
      mapped.push({
        attr_name: def.attr_name,
        attr_type: def.attr_type || 'text',
        attr_unit: def.attr_unit || null,
        value_text,
        value_numeric,
        source,
      });
      used.add(fold(def.attr_name));
    }
  }

  const extras = [];
  for (const [k, v] of Object.entries(raw)) {
    if (!v || isJunkAttrName(k)) continue;
    const resolved = resolveKey(k, aliasMap);
    if (used.has(fold(k)) || used.has(fold(resolved))) continue;
    extras.push({
      attr_name: resolved || k,
      attr_type: 'text',
      attr_unit: null,
      value_text: String(v),
      value_numeric: null,
      source: 'raw',
    });
  }
  return [...mapped, ...extras];
}

function attributesFromCatalog(db, product, catAttrDefs, aliasMap) {
  aliasMap = aliasMap || loadAliasMaps(db);
  const manual = {};
  if (product.id && catAttrDefs && catAttrDefs.length) {
    try {
      const rows = db.prepare(`
        SELECT ca.attr_name, ca.attr_type, ca.attr_unit, pa.value_text, pa.value_numeric
        FROM product_attributes pa
        JOIN category_attributes ca ON ca.id = pa.attribute_id
        WHERE pa.catalog_id = ?
      `).all(product.id);
      for (const r of rows) manual[r.attr_name] = r;
    } catch (_) {}
  }
  let raw = {};
  try { raw = JSON.parse(product.raw_attributes || '{}'); } catch { raw = {}; }
  return buildAttributeList(raw, manual, catAttrDefs, aliasMap);
}

module.exports = {
  fold,
  isJunkAttrName,
  parseNumeric,
  namesMatch,
  loadAliasMaps,
  resolveKey,
  ensurePcAttrAliases,
  expandCategoryIds,
  seedCategoryAttrSchema,
  syncCatalogAttributes,
  attributesFromCatalog,
  buildAttributeList,
  mapRawToCategoryAttrs,
  mergeRawForProduct,
  indexSupplierAttributes,
  PC_ATTR_ALIASES,
};
