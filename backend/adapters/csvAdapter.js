/**
 * CSV Adapter — import/eksport produktów ShopGold w formacie CSV
 */
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Mapowanie kolumn CSV ShopGold → wewnętrzny format
const HEADER_MAP = {
  'id': 'shop_id', 'ID': 'shop_id', 'product_id': 'shop_id',
  'name': 'name', 'nazwa': 'name', 'Name': 'name',
  'category': 'category', 'kategoria': 'category', 'kat': 'category',
  'ean': 'ean', 'EAN': 'ean', 'kod kreskowy': 'ean', 'barcode': 'ean',
  'producent': 'group_tag', 'producer': 'group_tag', 'marka': 'group_tag', 'brand': 'group_tag',
  'description': 'description', 'opis': 'description', 'desc': 'description',
  'meta_title': 'meta_title', 'seo_title': 'meta_title',
  'meta_description': 'meta_description', 'seo_desc': 'meta_description',
  'price': 'price', 'cena': 'price',
};

/**
 * Parse CSV content (Buffer or string) into internal product format
 */
function parseCsv(content) {
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : content;

  let records;
  try {
    records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      delimiter: [',', ';'], // ShopGold often uses semicolons
    });
  } catch (e) {
    throw new Error(`Błąd parsowania CSV: ${e.message}`);
  }

  return records.map(row => {
    const mapped = {};
    const extra_attrs = {};

    for (const [key, val] of Object.entries(row)) {
      const internalKey = HEADER_MAP[key] || HEADER_MAP[key.toLowerCase()];
      if (internalKey) {
        mapped[internalKey] = val;
      } else {
        // Treat unknown columns as product attributes
        extra_attrs[key] = val;
      }
    }

    return {
      shop_id: String(mapped.shop_id || ''),
      name: mapped.name || '',
      category: mapped.category || '',
      group_tag: mapped.group_tag || '',
      ean: mapped.ean || '',
      description: mapped.description || '',
      meta_title: mapped.meta_title || '',
      meta_description: mapped.meta_description || '',
      price: parseFloat(mapped.price) || 0,
      images: [],
      attributes: extra_attrs,
      raw_data: row,
    };
  });
}

/**
 * Generate CSV for import into ShopGold from approved changes
 */
function generateUpdateCsv(products) {
  const rows = products.map(p => ({
    id: p.shop_id,
    name: p.name,
    description: p.description,
    meta_title: p.meta_title || '',
    meta_description: p.meta_description || '',
    price: p.price,
    ...p.attributes,
  }));

  return stringify(rows, {
    header: true,
    delimiter: ';',
    bom: true, // UTF-8 BOM for Excel compatibility
  });
}

/**
 * Generate campaign export CSV for Google Ads Editor
 */
function generateGoogleAdsCsv(campaignData) {
  const rows = [];
  for (const ad of campaignData.ads || []) {
    rows.push({
      'Campaign': campaignData.campaignName || 'AI Campaign',
      'Ad Group': ad.adGroup || ad.productName,
      'Headline 1': (ad.headlines[0] || '').substring(0, 30),
      'Headline 2': (ad.headlines[1] || '').substring(0, 30),
      'Headline 3': (ad.headlines[2] || '').substring(0, 30),
      'Description 1': (ad.descriptions[0] || '').substring(0, 90),
      'Description 2': (ad.descriptions[1] || '').substring(0, 90),
      'Final URL': ad.url || '',
      'Keywords': (ad.keywords || []).join('; '),
    });
  }
  return stringify(rows, { header: true, delimiter: ',', bom: true });
}

module.exports = { parseCsv, generateUpdateCsv, generateGoogleAdsCsv };
