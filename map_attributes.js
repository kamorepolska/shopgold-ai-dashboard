const Database = require('better-sqlite3');
const db = new Database('data/shopgold_cache.db');

const PC_ATTR_SCHEMA = {
  'cpu': [
    { name: 'Socket', type: 'text', unit: null },
    { name: 'TDP', type: 'numeric', unit: 'W' },
    { name: 'Liczba rdzeni', type: 'numeric', unit: null },
    { name: 'Zintegrowana grafika', type: 'text', unit: null },
    { name: 'Typ pamieci RAM', type: 'text', unit: null },
    { name: 'Maks. taktowanie RAM', type: 'numeric', unit: 'MHz' },
  ],
  'mainboard': [
    { name: 'Socket', type: 'text', unit: null },
    { name: 'Chipset', type: 'text', unit: null },
    { name: 'Format', type: 'text', unit: null },
    { name: 'Typ pamieci RAM', type: 'text', unit: null },
    { name: 'Sloty RAM', type: 'numeric', unit: null },
    { name: 'Sloty M.2', type: 'numeric', unit: null },
    { name: 'WiFi', type: 'text', unit: null },
  ],
  'kühler': [
    { name: 'Typ chlodzenia', type: 'text', unit: null },
    { name: 'Max TDP', type: 'numeric', unit: 'W' },
    { name: 'Kompatybilne sockety', type: 'text', unit: null },
    { name: 'Wysokosc', type: 'numeric', unit: 'mm' },
    { name: 'Rozmiar radiatora', type: 'text', unit: 'mm' },
    { name: 'RGB', type: 'text', unit: null },
  ],
  'arbeitsspeicher': [
    { name: 'Typ', type: 'text', unit: null },
    { name: 'Pojemnosc', type: 'numeric', unit: 'GB' },
    { name: 'Taktowanie', type: 'numeric', unit: 'MHz' },
    { name: 'Liczba kosci', type: 'numeric', unit: null },
    { name: 'RGB', type: 'text', unit: null },
  ],
  'festplatten': [
    { name: 'Typ dysku', type: 'text', unit: null },
    { name: 'Pojemnosc', type: 'numeric', unit: 'GB' },
    { name: 'Interfejs', type: 'text', unit: null },
  ],
  'grafikkarten': [
    { name: 'Chip', type: 'text', unit: null },
    { name: 'VRAM', type: 'numeric', unit: 'GB' },
    { name: 'TDP', type: 'numeric', unit: 'W' },
    { name: 'Dlugosc karty', type: 'numeric', unit: 'mm' },
    { name: 'RGB', type: 'text', unit: null },
  ],
  'netzteile': [
    { name: 'Moc', type: 'numeric', unit: 'W' },
    { name: 'Certyfikacja', type: 'text', unit: null },
    { name: 'Modularnosc', type: 'text', unit: null },
  ],
  'gehäuse': [
    { name: 'Format plyty', type: 'text', unit: null },
    { name: 'Maks. wys. chlodzenia', type: 'numeric', unit: 'mm' },
    { name: 'Obsluga AIO', type: 'text', unit: null },
    { name: 'Maks. dl. karty graficznej', type: 'numeric', unit: 'mm' },
    { name: 'Kolor', type: 'text', unit: null },
    { name: 'RGB', type: 'text', unit: null },
    { name: 'Szyba hartowana', type: 'text', unit: null },
  ]
};

const cats = db.prepare('SELECT id, name FROM product_categories').all();

console.log('Seeding category attributes...');
let added = 0;
const insAttr = db.prepare('INSERT INTO category_attributes (category_id, attr_name, attr_type, attr_unit) VALUES (?, ?, ?, ?)');
const checkAttr = db.prepare('SELECT id FROM category_attributes WHERE category_id = ? AND attr_name = ?');

db.transaction(() => {
  for (const cat of cats) {
    const cName = cat.name.toLowerCase();
    for (const [key, attrs] of Object.entries(PC_ATTR_SCHEMA)) {
      if (cName.includes(key)) {
        for (const a of attrs) {
          const ex = checkAttr.get(cat.id, a.name);
          if (!ex) {
            insAttr.run(cat.id, a.name, a.type, a.unit);
            added++;
          }
        }
      }
    }
  }
})();
console.log(`Seeded ${added} category attributes.`);

const allAttributes = db.prepare(`SELECT id, category_id, attr_name FROM category_attributes`).all();
function getAttrId(categoryId, attrName) {
  const found = allAttributes.find(a => a.category_id === categoryId && a.attr_name === attrName);
  return found ? found.id : null;
}

const products = db.prepare(`
  SELECT cm.id, cm.category_id, cm.name, cm.manufacturer, sp.description
  FROM catalog_master cm
  LEFT JOIN supplier_products sp ON cm.canonical_ean = sp.ean
`).all();

console.log(`Starting attribute mapping for ${products.length} products...`);

let mappedCount = 0;
const insertVal = db.prepare(`INSERT OR IGNORE INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric) VALUES (?, ?, ?, ?)`);

db.transaction(() => {
  for (const p of products) {
    const textToSearch = `${p.name} ${p.manufacturer} ${p.description || ''}`.toUpperCase();
    
    const extract = (regex) => { const m = textToSearch.match(regex); return m ? m[1] : null; };
    const extractMatch = (regex) => { const m = textToSearch.match(regex); return m ? m[0] : null; };

    // Socket
    const socketId = getAttrId(p.category_id, 'Socket') || getAttrId(p.category_id, 'Kompatybilne sockety');
    if (socketId) {
      let socket = null;
      if (textToSearch.includes('AM5')) socket = 'AM5';
      else if (textToSearch.includes('AM4')) socket = 'AM4';
      else if (textToSearch.includes('LGA1700') || textToSearch.includes('LGA 1700')) socket = 'LGA1700';
      else if (textToSearch.includes('LGA1200') || textToSearch.includes('LGA 1200')) socket = 'LGA1200';
      else if (textToSearch.includes('1151')) socket = 'LGA1151';
      else if (textToSearch.includes('TR4')) socket = 'TR4';
      if (socket) { insertVal.run(p.id, socketId, socket, null); mappedCount++; }
    }

    // RAM
    const ramId = getAttrId(p.category_id, 'Typ pamieci RAM') || getAttrId(p.category_id, 'Typ');
    if (ramId) {
      let ram = null;
      if (textToSearch.includes('DDR5')) ram = 'DDR5';
      else if (textToSearch.includes('DDR4')) ram = 'DDR4';
      else if (textToSearch.includes('DDR3')) ram = 'DDR3';
      if (ram) { insertVal.run(p.id, ramId, ram, null); mappedCount++; }
    }

    // TDP
    const tdpId = getAttrId(p.category_id, 'TDP') || getAttrId(p.category_id, 'Max TDP');
    if (tdpId) {
      const tdp = extract(/(\d{2,3})\s*W/);
      if (tdp) { insertVal.run(p.id, tdpId, null, parseFloat(tdp)); mappedCount++; }
    }

    // Format
    const formatId = getAttrId(p.category_id, 'Format') || getAttrId(p.category_id, 'Format plyty');
    if (formatId) {
      let format = null;
      if (textToSearch.includes('MICRO-ATX') || textToSearch.includes('MATX') || textToSearch.includes('MICRO ATX')) format = 'Micro-ATX';
      else if (textToSearch.includes('MINI-ITX') || textToSearch.includes('MINI ITX')) format = 'Mini-ITX';
      else if (textToSearch.includes('E-ATX') || textToSearch.includes('EATX')) format = 'E-ATX';
      else if (textToSearch.includes('ATX')) format = 'ATX';
      if (format) { insertVal.run(p.id, formatId, format, null); mappedCount++; }
    }

    // Moc
    const psuMocId = getAttrId(p.category_id, 'Moc');
    if (psuMocId) {
      const moc = extract(/(\d{3,4})\s*W/);
      if (moc) { insertVal.run(p.id, psuMocId, null, parseFloat(moc)); mappedCount++; }
    }

    // Certyfikacja
    const certId = getAttrId(p.category_id, 'Certyfikacja');
    if (certId) {
      const cert = extractMatch(/80\s*PLUS\s*(BRONZE|GOLD|PLATINUM|TITANIUM|SILVER)?/);
      if (cert) { insertVal.run(p.id, certId, cert, null); mappedCount++; }
    }
    
    // Pojemnosc RAM
    const pojId = getAttrId(p.category_id, 'Pojemnosc');
    if (pojId) {
      const poj = extract(/(\d{1,4})\s*GB/);
      if (poj) { insertVal.run(p.id, pojId, null, parseFloat(poj)); mappedCount++; }
    }
  }
})();

console.log(`Mapping complete. Inserted ${mappedCount} attributes.`);
