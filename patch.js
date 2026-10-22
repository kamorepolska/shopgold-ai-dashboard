const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'backend', 'services', 'sourcingService.js');
let content = fs.readFileSync(file, 'utf8');

// The replacement text
const GAM_BL_TEXT = `  // Comprehensive blacklist: internal supplier metadata, NOT real product parameters
  const _GAM_BL = new Set([
    // Basic product fields already stored in dedicated DB columns
    'id', 'name', 'nazwa', 'ean', 'ean_code', 'barcode', 'gtin', 'sku',
    'price', 'cena', 'cena_netto', 'cena_brutto', 'netto', 'brutto',
    'category', 'kategoria', 'grupa', 'group', 'komodita',
    'manufacturer', 'producent', 'brand', 'vendor', 'marka', 'hersteller',
    'stock', 'stan', 'qty', 'quantity', 'ilosc', 'dostepnosc', 'availability',
    'weight', 'waga', 'waga_brutto', 'waga_netto', 'masa',
    'description', 'opis', 'desc',
    'photo', 'image', 'zdjecie', 'photos', 'images',
    'url', 'link', 'product_url', 'currency', 'waluta', 'cur',
    'vat', 'tax', 'podatek', 'warranty', 'gwarancja', 'guarantee',
    'condition', 'stan_produktu', 'zustand',
    // Generic parser metadata
    'twrgid', 'twrcode', 'twrean', 'twrunit', 'weightg', 'categoryid',
    'eocode', 'idmax', 'pn', 'sizefee', 'cn', 'uom', 'shortdescription',
    'elkocode', 'vendorname', 'cncode', 'stockid1', 'kod_ean', 'podatek_vat',
    'promocja', 'cena_netto', 'reference', 'code', 'virtual',
    'grupa_towarowah', 'oferta_specjalna', 'deliverydate', 'artnr', 'herstnr', 'hersturl',
    // Wortmann internal columns
    'kod', 'enduser', 'dealer', 'status', 'vmagazynetext', 'warehouse',
    'index', 'indeks p.', 'cena brutto + marza', 'id produktu', 'kod produktu',
    'jest wiecej', 'jm', 'kod towaru', 'free transit',
    // Action internal shipping/ordering metadata
    'produkt gabarytowy', 'produkt z magazynu zewnętrznego', 'pod zamówienie',
    'nadgrupa drzewo', 'podgrupa drzewo',
    'czas wysyłki', 'czas wysyłki [h]', 'data spodziewanej dostawy',
    'ilość w spodziewanej dostawy', 'ilość w spodziewanej dostawie',
    // NTT internal columns
    'weightn', 'namepl', 'q_r', 'q_n', 'q_a', 'pricepln', 'priceexpeur',
    'pricesugpln', 'photo_1', 'photo_2', 'pcn', 'vol', 'descpl', 'descen',
    'descfr', 'desccz', 'descde', 'namefr', 'namecz', 'namede', 'inbox',
    'codecn', 'pdheight', 'pdwidth', 'pddepth', 'priceretaileuro', 'quan',
    // Elko internal
    'fulldsc',
    // Generic English internal
    'length', 'width', 'height', 'item', 'table',
    // Regulatory/compliance metadata (not useful as product attributes)
    'dane osoby odpowiedzialnej w ue', 'podmiot odpowiedzialny',
    'rozporządzenie data act',
    // Wortmann underscore-style export columns
    'zdjecie_glowne', 'jednostka_miary', 'ilosc_produktow', 'kod_ean_c',
    'kod_ean_mcm', 'kod_ean_b', 'kod_ean_d', 'kod_ean_e', 'cat_pl', 'cat_en',
    // Variant keys (colour/capacity variants stored as attrs)
    'wariant_kolor_ladowarki', 'wariant_kolor_etui', 'wariant_kolor_powerbanki',
    'wariant_pojemnosc_dysk', 'wariant_kolor_gaming', 'wariant_dlugosc_kolor',
    'wariant_ilosc_w_opakowaniu_sieci_bezprzewodowe', 'wariant_porty_poe',
    // Misc commercial
    'sgr code', 'reservedid1',
  ]);

  // Dynamic filter — also catches patterns not covered by exact list
  const _gamBL = (k) => {
    if (_GAM_BL.has(k.toLowerCase())) return true;
    if (/^\\d+$/.test(k)) return true;              // purely numeric IDs like "13427"
    if (k.includes('?')) return true;              // corrupted encoding
    if (/^[BDEFGRW]\\d{3}M$/.test(k)) return true; // warranty codes: F024M, G012M
    if (/^[A-Z][a-z]+[A-Z]{2,}$/.test(k)) return true; // camelCase: NamePL, WeightN
    if (/^[A-Za-z][A-Za-z0-9]+_[A-Za-z0-9_]+$/.test(k)) return true; // underscore_keys
    if (/^[a-z][a-z0-9_.()-]+$/.test(k) && k.length < 30 && !k.includes(' ')) return true;
    return false;
  };`;

// Find getAttrManagerList function bounds
const getAttrIdx = content.indexOf('function getAttrManagerList(categoryId, supplierId)');
if (getAttrIdx === -1) throw new Error("Could not find getAttrManagerList");

// Step 1: Replace ATTR_KEY_BLACKLIST definition INSIDE getAttrManagerList
// (using regex to find the ATTR_KEY_BLACKLIST Set block inside the function)
const regex = /  \/\/ Blacklist: keys that are CSV column names[\s\S]*?\]\);/g;
let match;
let foundBlockStart = -1, foundBlockEnd = -1;
while ((match = regex.exec(content)) !== null) {
  if (match.index > getAttrIdx) {
    foundBlockStart = match.index;
    foundBlockEnd = match.index + match[0].length;
    break;
  }
}
if (foundBlockStart !== -1) {
  content = content.substring(0, foundBlockStart) + GAM_BL_TEXT + content.substring(foundBlockEnd);
} else {
  console.log("Could not find ATTR_KEY_BLACKLIST block to replace inside getAttrManagerList!");
}

// Step 2: Replace ATTR_KEY_BLACKLIST.has(k.toLowerCase()) with _gamBL(k) inside getAttrManagerList
// We need to re-find it because string indexes shifted
const newGetAttrIdx = content.indexOf('function getAttrManagerList(categoryId, supplierId)');
const oldCheckRegex = /\/\/ Skip known non-parameter keys[\s\S]*?if \(ATTR_KEY_BLACKLIST\.has\(k\.toLowerCase\(\)\)\) continue;/g;
let checkMatch;
foundBlockStart = -1; foundBlockEnd = -1;
while ((checkMatch = oldCheckRegex.exec(content)) !== null) {
  if (checkMatch.index > newGetAttrIdx) {
    foundBlockStart = checkMatch.index;
    foundBlockEnd = checkMatch.index + checkMatch[0].length;
    break;
  }
}
if (foundBlockStart !== -1) {
  content = content.substring(0, foundBlockStart) + "              if (_gamBL(k)) continue;" + content.substring(foundBlockEnd);
} else {
  console.log("Could not find condition to replace!");
}

// Step 3: Remove the mistakenly inserted _GAM_BL code from buildRestockList (it was around line 4100-4170)
// The text we injected in the LAST step started with "// Comprehensive blacklist: internal supplier metadata"
// and ended with "return false;\n    };"
const mistakeRegex = /    \/\/ Comprehensive blacklist: internal supplier metadata, NOT real product parameters[\s\S]*?return false;\r?\n    };\r?\n/g;
content = content.replace(mistakeRegex, '');

fs.writeFileSync(file, content, 'utf8');
console.log("Patched successfully.");
