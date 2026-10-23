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
  'gam', 'twrid', 'itemid', 'item_id', 'productid', 'product_id',
]);

const JUNK_RE = /cena|marż|marza|brutto|netto|narzut|sprzedaż|kupna|price|rabat|discount|\bid\b|kod\b|code\b|index\b|indeks|sku\b|erp\b|symbol\b|elko|artykuł|artykul|nr\.\s*art|numer art|katalog|magazyn|dostępn|dostepn|\bilosc\b|\bilość\b|gabaryt|opakow|wymiary opak|waga\s+(brutto|netto)|\bkategor|\bgrupa\b|\bpodkategor|\bnadkategor|\bpodgrupa/i;

const SYNONYM_GROUPS = [
  ['socket', 'sockel', 'gniazdo', 'gniazdo procesora', 'cpu socket', 'processor socket',
    'sockel cpu', 'cpu sockel', 'kompatybilne sockety', 'compatible sockets', 'sockel kompatibel',
    'kompatybilne podstawki', 'podstawka', 'unterstutzte sockel', 'supported sockets', 'socket support'],
  ['tdp', 'thermal design power', 'pobor mocy', 'pobór mocy', 'moc cieplna', 'max tdp', 'tdp max',
    'cooler tdp', 'tdp chlodzenia', 'tdp chłodzenia', 'maksymalne tdp', 'cooling capacity'],
  ['rdzenie', 'liczba rdzeni', 'cores', 'core count', 'anzahl kerne', 'kerne', 'cpu cores'],
  ['watki', 'wątki', 'threads', 'thread count', 'anzahl threads'],
  ['chipset', 'chipset plyty', 'motherboard chipset'],
  ['format', 'form factor', 'formfaktor', 'format plyty', 'format płyty', 'atx form'],
  ['typ pamieci ram', 'typ pamięci ram', 'memory type', 'ram type', 'speichertyp', 'typ pamieci'],
  ['pojemnosc', 'pojemność', 'capacity', 'kapazitat', 'kapazität', 'size gb', 'speichergröße'],
  ['taktowanie', 'frequency', 'takt', 'clock', 'taktfrequenz', 'memory speed'],
  ['vram', 'pamiec', 'pamięć', 'memory size', 'gpu memory', 'speicher'],
  ['moc', 'leistung', 'psu wattage', 'output power'],
  ['certyfikat', 'certyfikacja', 'certificate', '80 plus', 'efficiency'],
  ['modularnosc', 'modularność', 'modularnosc', 'modular'],
  ['dlugosc karty', 'długość karty', 'gpu length', 'card length'],
  ['wysokosc', 'wysokość', 'height', 'hohe', 'höhe', 'cooler height', 'wysokosc chlodzenia',
    'wysokość chłodzenia', 'tower height'],
  ['rgb', 'beleuchtung', 'podswietlenie', 'podświetlenie', 'lighting', 'argb'],
  ['wifi', 'wireless', 'wlan'],
  ['sloty ram', 'ram slots', 'dimm slots', 'liczba slotow ram'],
  ['sloty m.2', 'm.2 slots', 'm2 slots'],
  ['interfejs', 'interface', 'bus', 'pcie'],
  ['chip', 'gpu chip', 'grafikchip'],
  ['typ chlodzenia', 'typ chłodzenia', 'cooler type', 'cooling type', 'rodzaj chlodzenia'],
  ['rozmiar', 'fan size', 'rozmiar wentylatora', 'ventilatorgrosse', 'ventilatorgröße'],
  ['obroty', 'rpm', 'drehzahl', 'predkosc obrotowa', 'prędkość obrotowa'],
  ['glosnosc', 'głośność', 'noise', 'lautstarke', 'lautstärke', 'poziom halasu'],
  ['liczba kosci', 'liczba kości', 'modules', 'kit', 'anzahl module'],
  ['typ dysku', 'drive type', 'ssd type'],
];

const WEAK_ATTR_TOKENS = new Set([
  'watt', 'power', 'size', 'type', 'typ', 'speed', 'mhz', 'ram', 'ddr', 'mm', 'gb', 'w',
]);

/** Zduplikowane etykiety z seedu Ofertera / starych schematów → kanoniczna nazwa katalogu. */
const ATTR_NAME_RENAMES = [
  ['liczba rdzeni', 'Rdzenie'],
  ['liczba watkow', 'Wątki'],
  ['vram', 'Pamięć'],
  ['chip', 'Chipset'],
  ['pojemnosc', 'Pojemność'],
  ['dlugosc karty', 'Długość karty'],
  ['certyfikacja', 'Certyfikat'],
  ['modularnosc', 'Modularność'],
  ['format plyty', 'Format'],
  ['liczba kosci', 'Liczba kości'],
  ['wysokosc', 'Wysokość'],
  ['typ chlodzenia', 'Typ chłodzenia'],
  ['typ pamieci ram', 'Typ pamięci RAM'],
  ['typ pamieci', 'Typ pamięci RAM'],
  ['max tdp', 'TDP'],
  ['kompatybilne sockety', 'Socket'],
  ['maks. wys. chlodzenia', 'Maks. wys. chłodzenia'],
  ['maks. dl. karty graficznej', 'Maks. dł. karty graficznej'],
  ['obsluga aio', 'Obsługa AIO'],
];

const ATTR_UNITS = {
  TDP: 'W',
  Wysokość: 'mm',
  Moc: 'W',
  Pojemność: 'GB',
  Taktowanie: 'MHz',
  'Długość karty': 'mm',
  Obroty: 'RPM',
  Głośność: 'dB',
  Rozmiar: 'mm',
  'Maks. wys. chłodzenia': 'mm',
  'Maks. dł. karty graficznej': 'mm',
  'Maks. taktowanie RAM': 'MHz',
};

const NUMERIC_HINT = /tdp|rdzen|w[aą]tk|pojemn|moc\b|taktowan|mhz|ghz|vram|wysoko|d[lł]ugo|sloty|liczba|obroty|cache|watt|\bgb\b|\bmm\b/i;

const PC_ATTR_ALIASES = [
  ['socket', 'Socket'], ['sockel', 'Socket'], ['gniazdo', 'Socket'], ['gniazdo procesora', 'Socket'],
  ['cpu socket', 'Socket'], ['processor socket', 'Socket'], ['sockel cpu', 'Socket'],
  ['cpu sockel', 'Socket'], ['kompatybilne sockety', 'Socket'], ['compatible sockets', 'Socket'],
  ['sockel kompatibel', 'Socket'], ['kompatybilne podstawki', 'Socket'], ['podstawka', 'Socket'],
  ['supported sockets', 'Socket'], ['unterstutzte sockel', 'Socket'],
  ['tdp', 'TDP'], ['thermal design power', 'TDP'], ['pobór mocy', 'TDP'], ['pobor mocy', 'TDP'],
  ['max tdp', 'TDP'], ['tdp max', 'TDP'], ['cooler tdp', 'TDP'], ['moc cieplna', 'TDP'],
  ['tdp chlodzenia', 'TDP'], ['maksymalne tdp', 'TDP'], ['cooling capacity', 'TDP'],
  ['cores', 'Rdzenie'], ['core count', 'Rdzenie'], ['anzahl kerne', 'Rdzenie'],
  ['liczba rdzeni', 'Rdzenie'], ['kerne', 'Rdzenie'],
  ['threads', 'Wątki'], ['thread count', 'Wątki'], ['liczba watkow', 'Wątki'],
  ['form factor', 'Format'], ['formfaktor', 'Format'], ['format płyty', 'Format'],
  ['format plyty', 'Format'],
  ['memory type', 'Typ'], ['ram type', 'Typ'], ['speichertyp', 'Typ'],
  ['typ pamięci ram', 'Typ'], ['typ pamieci ram', 'Typ'], ['typ pamięci', 'Typ'],
  ['capacity', 'Pojemność'], ['kapazität', 'Pojemność'], ['pojemnosc', 'Pojemność'],
  ['taktfrequenz', 'Taktowanie'], ['frequency', 'Taktowanie'], ['clock', 'Taktowanie'],
  ['memory speed', 'Taktowanie'],
  ['gpu memory', 'Pamięć'], ['vram', 'Pamięć'], ['speicher', 'Pamięć'],
  ['leistung', 'Moc'], ['psu wattage', 'Moc'], ['output power', 'Moc'],
  ['80 plus', 'Certyfikat'], ['certificate', 'Certyfikat'], ['certyfikacja', 'Certyfikat'],
  ['modular', 'Modularność'], ['modularnosc', 'Modularność'],
  ['gpu length', 'Długość karty'], ['card length', 'Długość karty'], ['länge', 'Długość karty'],
  ['cooler height', 'Wysokość'], ['höhe', 'Wysokość'], ['wysokosc', 'Wysokość'],
  ['wysokosc chlodzenia', 'Wysokość'], ['tower height', 'Wysokość'], ['height', 'Wysokość'],
  ['beleuchtung', 'RGB'], ['podświetlenie', 'RGB'], ['podswietlenie', 'RGB'], ['argb', 'RGB'],
  ['wlan', 'WiFi'], ['wireless', 'WiFi'],
  ['ram slots', 'Sloty RAM'], ['dimm slots', 'Sloty RAM'],
  ['m.2 slots', 'Sloty M.2'], ['m2 slots', 'Sloty M.2'],
  ['interface', 'Interfejs'], ['pcie', 'Interfejs'],
  ['chipset', 'Chipset'], ['grafikchip', 'Chipset'], ['chip', 'Chipset'], ['gpu chip', 'Chipset'],
  ['typ chlodzenia', 'Typ chłodzenia'], ['typ chłodzenia', 'Typ chłodzenia'],
  ['cooler type', 'Typ chłodzenia'], ['cooling type', 'Typ chłodzenia'],
  ['rodzaj chlodzenia', 'Typ chłodzenia'],
  ['fan size', 'Rozmiar'], ['rozmiar wentylatora', 'Rozmiar'], ['rozmiar', 'Rozmiar'],
  ['rpm', 'Obroty'], ['drehzahl', 'Obroty'], ['obroty', 'Obroty'],
  ['noise', 'Głośność'], ['lautstarke', 'Głośność'], ['lautstärke', 'Głośność'], ['glosnosc', 'Głośność'],
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
  if (Array.isArray(v)) {
    return v.map(x => cleanAttrValue(x)).filter(Boolean).join(', ').slice(0, 500);
  }
  if (typeof v === 'object') return '';
  const s = String(v).replace(/[\r\n]+/g, ' ').trim();
  if (!s || s === '-' || s === '0' || s === 'n/a' || s === 'N/A' || s === 'null') return '';
  return s.slice(0, 500);
}

const NV_NAME_KEYS = ['name', 'Name', 'NAME', 'parameterName', 'ParameterName', 'key', 'Key', 'label', 'Label', 'title', 'Title', 'nazwaCechy', 'attr_name'];
const NV_VAL_KEYS = ['value', 'Value', 'VALUE', 'parameterValue', 'ParameterValue', 'val', 'Val', '_text', '_cdata', 'content', 'Content', 'wartoscCechy', 'attr_value'];

function flattenAttrObject(obj, out = {}, depth = 0) {
  if (obj == null || depth > 6) return out;
  if (Array.isArray(obj)) {
    for (const item of obj) flattenAttrObject(item, out, depth + 1);
    return out;
  }
  if (typeof obj !== 'object') return out;

  let name = null;
  let val = null;
  for (const k of NV_NAME_KEYS) {
    if (obj[k] != null && typeof obj[k] !== 'object') { name = String(obj[k]).trim(); break; }
  }
  for (const k of NV_VAL_KEYS) {
    if (obj[k] != null && typeof obj[k] !== 'object') { val = obj[k]; break; }
  }
  if (name && val != null) {
    const cleaned = cleanAttrValue(val);
    if (cleaned && !out[name]) out[name] = cleaned;
  }

  for (const [k, v] of Object.entries(obj)) {
    if (NV_NAME_KEYS.includes(k) || NV_VAL_KEYS.includes(k) || k === '$attrs') continue;
    if (v && typeof v === 'object') {
      flattenAttrObject(v, out, depth + 1);
    } else if (v != null && String(k).length >= 2) {
      const cleaned = cleanAttrValue(v);
      if (cleaned && !out[k]) out[k] = cleaned;
    }
  }
  return out;
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

function lookupCanonical(folded, aliasMap) {
  if (!folded) return '';
  if (aliasMap && aliasMap.has(folded)) return aliasMap.get(folded);
  const syn = SYNONYM_INDEX.get(folded);
  if (syn == null) return '';
  const group = SYNONYM_GROUPS[syn];
  if (aliasMap) {
    for (const name of group) {
      const mapped = aliasMap.get(fold(name));
      if (mapped) return mapped;
    }
  }
  return group[0];
}

function resolveKey(rawKey, aliasMap) {
  const original = String(rawKey || '').trim();
  if (!original) return '';
  const folded = fold(original);
  if (!folded) return original;

  const exact = lookupCanonical(folded, aliasMap);
  if (exact) return exact;

  const last = folded.split(/\s*[\/|:]\s+/).map(s => s.trim()).filter(Boolean).pop();
  if (last && last !== folded) {
    const fromLast = lookupCanonical(last, aliasMap);
    if (fromLast) return fromLast;
  }

  let best = '';
  let bestLen = 0;
  const consider = (alias, canon) => {
    if (!alias || alias.length < 5 || WEAK_ATTR_TOKENS.has(alias)) return;
    const re = new RegExp('(?:^|[^a-z0-9])' + alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-z0-9])');
    if (re.test(folded) && alias.length > bestLen) {
      best = canon;
      bestLen = alias.length;
    }
  };
  if (aliasMap) {
    for (const [alias, canon] of aliasMap) consider(alias, canon);
  }
  for (const [alias, gi] of SYNONYM_INDEX) {
    const group = SYNONYM_GROUPS[gi];
    let canon = group[0];
    if (aliasMap) {
      for (const name of group) {
        const mapped = aliasMap.get(fold(name));
        if (mapped) { canon = mapped; break; }
      }
    }
    consider(alias, canon);
  }
  if (best) return best;

  const tokens = folded.split(/[^a-z0-9]+/).filter(t => t && !WEAK_ATTR_TOKENS.has(t));
  for (const t of tokens) {
    const hit = lookupCanonical(t, aliasMap);
    if (hit) return hit;
  }
  return last && last !== folded ? last : original;
}

function containsToken(haystack, needle) {
  const h = fold(haystack);
  const n = fold(needle);
  if (!h || !n) return false;
  if (h === n) return true;
  const re = new RegExp('(?:^|[^a-z0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-z0-9])');
  return re.test(h);
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

function ingestFlatAttrs(slot, obj, aliasMap) {
  const flat = flattenAttrObject(obj);
  for (const [k, v] of Object.entries(flat)) {
    const val = cleanAttrValue(v);
    if (!k || !val || isJunkAttrName(k)) continue;
    const resolved = resolveKey(k, aliasMap);
    if (!resolved || isJunkAttrName(resolved)) continue;
    if (!slot[resolved]) slot[resolved] = val;
  }
}

function indexSupplierAttributes(db, aliasMap = null) {
  aliasMap = aliasMap || new Map();
  const byEan = new Map();
  const add = (ean, obj) => {
    const key = normalizeEan(ean);
    if (!key || !obj) return;
    if (!byEan.has(key)) byEan.set(key, {});
    ingestFlatAttrs(byEan.get(key), obj, aliasMap);
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
    if (existing && typeof existing === 'object') ingestFlatAttrs(merged, existing, aliasMap);
  } catch (_) {}
  for (const key of productEanKeys(product)) {
    const extra = supplierIndex.get(normalizeEan(key) || key);
    if (!extra) continue;
    for (const [k, v] of Object.entries(extra)) {
      if (k && v && !merged[k]) merged[k] = v;
    }
  }
  return merged;
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

function canonicalizeAttrName(name, aliasMap) {
  const resolved = resolveKey(name, aliasMap || new Map());
  const f = fold(resolved);
  for (const [from, to] of ATTR_NAME_RENAMES) {
    if (f === fold(from)) return to;
  }
  return resolved || String(name || '').trim();
}

function ensureProductAttrSource(db) {
  try { db.exec("ALTER TABLE product_attributes ADD COLUMN source TEXT DEFAULT 'supplier'"); } catch (_) {}
}

function migrateDuplicateCategoryAttrs(db) {
  ensureProductAttrSource(db);
  const aliasMap = loadAliasMaps(db);
  let merged = 0;
  let cats;
  try {
    cats = db.prepare('SELECT DISTINCT category_id FROM category_attributes').all();
  } catch (_) {
    return 0;
  }
  const tx = db.transaction(() => {
    for (const { category_id } of cats) {
      const attrs = db.prepare('SELECT * FROM category_attributes WHERE category_id = ?').all(category_id);
      const groups = new Map();
      for (const a of attrs) {
        const canon = canonicalizeAttrName(a.attr_name, aliasMap);
        const key = fold(canon);
        if (!groups.has(key)) {
          groups.set(key, { canon, keep: a, extras: [] });
        } else {
          const g = groups.get(key);
          if (fold(g.keep.attr_name) !== fold(canon) && fold(a.attr_name) === fold(canon)) {
            g.extras.push(g.keep);
            g.keep = a;
          } else {
            g.extras.push(a);
          }
        }
      }
      for (const g of groups.values()) {
        if (fold(g.keep.attr_name) !== fold(g.canon)) {
          try {
            db.prepare('UPDATE category_attributes SET attr_name = ? WHERE id = ?').run(g.canon, g.keep.id);
          } catch (_) {}
        }
        for (const extra of g.extras) {
          const pas = db.prepare('SELECT * FROM product_attributes WHERE attribute_id = ?').all(extra.id);
          for (const pa of pas) {
            const exists = db.prepare('SELECT id FROM product_attributes WHERE catalog_id = ? AND attribute_id = ?')
              .get(pa.catalog_id, g.keep.id);
            if (!exists) {
              db.prepare('UPDATE product_attributes SET attribute_id = ? WHERE id = ?').run(g.keep.id, pa.id);
            } else {
              db.prepare('DELETE FROM product_attributes WHERE id = ?').run(pa.id);
            }
          }
          db.prepare('DELETE FROM category_attributes WHERE id = ?').run(extra.id);
          merged++;
        }
      }
    }
  });
  try { tx(); } catch (e) { console.warn('[catalog] migrate duplicate attrs:', e.message); }
  return merged;
}

function matchAttrMapKey(categoryName, attrMap) {
  if (!attrMap) return null;
  const nameLower = fold(categoryName);
  let bestKey = null;
  let bestLen = 0;
  for (const keyword of Object.keys(attrMap)) {
    const fk = fold(keyword);
    if (!fk || fk.length <= bestLen || !nameLower.includes(fk)) continue;
    if (fk === 'wentylator' && /procesor|cpu|chlodzen|kuhler|heatsink/.test(nameLower)) continue;
    if (fk === 'aio' && /chlodzen|kuhler|wentylator/.test(nameLower)) continue;
    if (fk === 'obudow' && /wentylator/.test(nameLower)) continue;
    if (fk === 'pamiec' && /karta graficzn|gpu|grafik/.test(nameLower)) continue;
    bestKey = keyword;
    bestLen = fk.length;
  }
  return bestKey;
}

function seedCategoryAttrSchema(db, categoryId, categoryName, attrMap) {
  const bestKey = matchAttrMapKey(categoryName, attrMap);
  if (!bestKey) return 0;
  let inserted = 0;
  attrMap[bestKey].forEach((name, i) => {
    const type = isNumericAttr(name) ? 'numeric' : 'text';
    const unit = ATTR_UNITS[name] || null;
    try {
      const r = db.prepare(`
        INSERT OR IGNORE INTO category_attributes (category_id, attr_name, attr_type, attr_unit, sort_order, is_filter, visible)
        VALUES (?, ?, ?, ?, ?, 1, 1)
      `).run(categoryId, name, type, unit, i);
      if (r.changes) inserted++;
    } catch (_) {
      try {
        const r = db.prepare('INSERT OR IGNORE INTO category_attributes (category_id, attr_name, sort_order) VALUES (?, ?, ?)')
          .run(categoryId, name, i);
        if (r.changes) inserted++;
      } catch (__) {}
    }
  });
  return inserted;
}

/**
 * Scal cechy ze wszystkich hurtowni do catalog_master i uzupełnij product_attributes.
 * Nie nadpisuje ręcznie wpisanych wartości w product_attributes.
 */
function syncCatalogAttributes(db, { eans = null, catalogIds = null, seedSchemas = true, attrMap = null } = {}) {
  registerNormalizeEan(db);
  ensurePcAttrAliases(db);
  ensureProductAttrSource(db);
  try { migrateDuplicateCategoryAttrs(db); } catch (e) {
    console.warn('[catalog] migrate attrs:', e.message);
  }
  const aliasMap = loadAliasMaps(db);

  if (seedSchemas && attrMap) {
    try {
      const cats = db.prepare(`
        SELECT DISTINCT pc.id, pc.name
        FROM product_categories pc
        JOIN catalog_master cm ON cm.category_id = pc.id
      `).all();
      for (const cat of cats) {
        seedCategoryAttrSchema(db, cat.id, cat.name, attrMap);
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

  const supplierIndex = indexSupplierAttributes(db, aliasMap);
  const catAttrCache = new Map();
  const catAttrs = (catId) => {
    if (!catId) return [];
    if (!catAttrCache.has(catId)) {
      catAttrCache.set(catId, db.prepare('SELECT id, attr_name, attr_type, attr_unit FROM category_attributes WHERE category_id = ?').all(catId));
    }
    return catAttrCache.get(catId);
  };

  const updRaw = db.prepare('UPDATE catalog_master SET raw_attributes = ? WHERE id = ?');
  let existingPa;
  let insPa;
  let updPa;
  try {
    existingPa = db.prepare('SELECT id, value_text, source FROM product_attributes WHERE catalog_id = ? AND attribute_id = ?');
    insPa = db.prepare('INSERT INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric, source) VALUES (?, ?, ?, ?, ?)');
    updPa = db.prepare("UPDATE product_attributes SET value_text = ?, value_numeric = ? WHERE id = ? AND IFNULL(source, 'supplier') != 'manual'");
  } catch (_) {
    existingPa = db.prepare('SELECT id, value_text FROM product_attributes WHERE catalog_id = ? AND attribute_id = ?');
    insPa = db.prepare('INSERT INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric) VALUES (?, ?, ?, ?)');
    updPa = db.prepare('UPDATE product_attributes SET value_text = ?, value_numeric = ? WHERE id = ?');
  }

  let rawUpdated = 0;
  let filled = 0;
  let refreshed = 0;

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
        const ex = existingPa.get(p.id, m.attribute_id);
        if (!ex) {
          try { insPa.run(p.id, m.attribute_id, m.value_text, m.value_numeric, 'supplier'); }
          catch { insPa.run(p.id, m.attribute_id, m.value_text, m.value_numeric); }
          filled++;
        } else if ((ex.source || 'supplier') !== 'manual' && String(ex.value_text || '') !== String(m.value_text || '')) {
          updPa.run(m.value_text, m.value_numeric, ex.id);
          refreshed++;
        }
      }
    }
  });
  tx();

  return { products: products.length, filled, raw_updated: rawUpdated, refreshed };
}

function hydrateProductsRaw(db, products, aliasMap) {
  if (!products || !products.length) return products;
  aliasMap = aliasMap || loadAliasMaps(db);
  const keySet = new Set();
  for (const p of products) productEanKeys(p).forEach(k => { if (k) keySet.add(k); });
  const unique = [...keySet];
  const byNorm = new Map();
  const addRow = (ean, obj) => {
    const key = normalizeEan(ean);
    if (!key || !obj) return;
    if (!byNorm.has(key)) byNorm.set(key, {});
    ingestFlatAttrs(byNorm.get(key), obj, aliasMap);
  };
  for (let i = 0; i < unique.length; i += 300) {
    const chunk = unique.slice(i, i + 300);
    const ph = chunk.map(() => '?').join(',');
    try {
      const rows = db.prepare(`
        SELECT ean, normalized_ean, attributes FROM supplier_products
        WHERE attributes IS NOT NULL AND attributes != '' AND attributes != '{}'
          AND (ean IN (${ph}) OR normalized_ean IN (${ph}))
      `).all(...chunk, ...chunk);
      for (const r of rows) {
        let obj = r.attributes;
        if (typeof obj === 'string') {
          try { obj = JSON.parse(obj); } catch { obj = null; }
        }
        addRow(r.normalized_ean || r.ean, obj);
        addRow(r.ean, obj);
      }
    } catch (_) {}
    try {
      const spa = db.prepare(`
        SELECT ean, normalized_ean, attr_name, attr_value FROM supplier_product_attrs
        WHERE attr_value IS NOT NULL AND attr_value != ''
          AND (ean IN (${ph}) OR normalized_ean IN (${ph}))
      `).all(...chunk, ...chunk);
      for (const r of spa) addRow(r.normalized_ean || r.ean, { [r.attr_name]: r.attr_value });
    } catch (_) {}
  }

  const persist = db.prepare('UPDATE catalog_master SET raw_attributes = ? WHERE id = ?');
  const writeBack = db.transaction(() => {
    for (const p of products) {
      let existing = {};
      try { existing = JSON.parse(p.raw_attributes || '{}'); } catch { existing = {}; }
      const merged = {};
      if (existing && typeof existing === 'object') ingestFlatAttrs(merged, existing, aliasMap);
      for (const k of productEanKeys(p)) {
        const extra = byNorm.get(normalizeEan(k));
        if (!extra) continue;
        for (const [ek, ev] of Object.entries(extra)) {
          if (ek && ev && !merged[ek]) merged[ek] = ev;
        }
      }
      const prev = p.raw_attributes || '{}';
      const json = JSON.stringify(merged);
      p.raw_attributes = json;
      if (p.id && Object.keys(merged).length && json !== prev) {
        persist.run(json, p.id);
      }
    }
  });
  try { writeBack(); } catch (_) {
    for (const p of products) {
      if (p.raw_attributes && p.id) {
        try { persist.run(p.raw_attributes, p.id); } catch (__) {}
      }
    }
  }
  return products;
}

function buildAttributeList(raw, manualByName, catAttrDefs, aliasMap) {
  aliasMap = aliasMap || new Map();
  if (raw && typeof raw === 'object') {
    const flat = {};
    ingestFlatAttrs(flat, raw, aliasMap);
    raw = flat;
  } else {
    raw = {};
  }
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
  isNumericAttr,
  parseNumeric,
  namesMatch,
  containsToken,
  loadAliasMaps,
  resolveKey,
  flattenAttrObject,
  ingestFlatAttrs,
  canonicalizeAttrName,
  ensurePcAttrAliases,
  expandCategoryIds,
  seedCategoryAttrSchema,
  matchAttrMapKey,
  syncCatalogAttributes,
  migrateDuplicateCategoryAttrs,
  ensureProductAttrSource,
  attributesFromCatalog,
  buildAttributeList,
  mapRawToCategoryAttrs,
  mergeRawForProduct,
  indexSupplierAttributes,
  hydrateProductsRaw,
  PC_ATTR_ALIASES,
  ATTR_NAME_RENAMES,
  ATTR_UNITS,
};
