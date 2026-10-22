/**
 * XML Adapter — pobiera dane produktów z XML feed ShopGold (format Ceneo/porównywarkowy)
 * i mapuje je na wewnętrzny format aplikacji.
 */
const xml2js = require('xml2js');
const config = require('../config');

async function fetchProducts(xmlUrl) {
  const url = xmlUrl || config.shopgold.xmlFeedUrl;
  if (!url) throw new Error('Brak URL do XML feed. Skonfiguruj SHOPGOLD_XML_FEED_URL w .env lub ustawieniach.');

  let xmlText;
  try {
    // Node 18+ has native fetch; fallback to node-fetch
    if (typeof fetch !== 'undefined') {
      const res = await fetch(url);
      xmlText = await res.text();
    } else {
      const nodeFetch = (await import('node-fetch')).default;
      const res = await nodeFetch(url);
      xmlText = await res.text();
    }
  } catch (err) {
    throw new Error(`Błąd pobierania XML feed: ${err.message}`);
  }

  return parseXml(xmlText);
}

async function parseXml(xmlText) {
  const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
  let result;
  try {
    result = await parser.parseStringPromise(xmlText);
  } catch (err) {
    throw new Error(`Błąd parsowania XML: ${err.message}`);
  }

  // ShopGold Ceneo feed structure: <offers><o ...> or <products><product>
  const products = [];

  // Try Ceneo/ShopGold XML format
  const root = result.offers || result.products || result.root || result;
  const items = root.o || root.offer || root.product || root.item;

  if (!items) {
    throw new Error('Nieznany format XML. Obsługiwane formaty: Ceneo (offers/o), standard (products/product).');
  }

  const itemArr = Array.isArray(items) ? items : [items];

  for (const item of itemArr) {
    const attrs = extractAttributes(item.attrs || item.parameters || item.params || {});
    
    // Fallback getter from attributes (case-insensitive)
    const getAttr = (keys) => {
      for (const k of keys) {
        const match = Object.keys(attrs).find(a => a.toLowerCase() === k.toLowerCase());
        if (match) return attrs[match];
      }
      return '';
    };

    products.push({
      shop_id: String(item.id || item._ || item.sku || ''),
      name: clean(item.name || item.title || item.n || ''),
      category: clean(item.category || item.cat || item.categoryPath || item.kategoria || item.Kategoria || getAttr(['kategoria', 'category'])),
      group_tag: clean(item.producer || item.manufacturer || item.brand || item.producent || item.Producent || getAttr(['producent', 'producer', 'marka', 'brand'])),
      ean: clean(item.ean || item.EAN || item.barcode || item.kod_ean || item.kod || getAttr(['ean', 'kod kreskowy', 'barcode', 'model'])),
      description: clean(item.desc || item.description || item.longDesc || item.opis || item.Opis || ''),
      meta_title: clean(item.metaTitle || ''),
      meta_description: clean(item.metaDesc || ''),
      price: parseFloat(item.price || item.p || 0),
      images: extractImages(item.imgs || item.images || item.photo || item.url_photo || ''),
      attributes: attrs,
      raw_data: item,
    });
  }

  return products;
}

function extractAttributes(attrsNode) {
  if (!attrsNode) return {};
  const result = {};

  // <attrs><a name="Kolor">Niebieski</a></attrs>
  const aItems = attrsNode.a || attrsNode.attr || attrsNode.param || attrsNode.p;
  if (aItems) {
    const arr = Array.isArray(aItems) ? aItems : [aItems];
    for (const a of arr) {
      const name = a.name || a.n || (a.$ && a.$.name) || '';
      const value = a._ || a.value || a.v || (typeof a === 'string' ? a : '');
      if (name) result[name] = value;
    }
    return result;
  }

  // Flat key-value
  if (typeof attrsNode === 'object') {
    for (const [k, v] of Object.entries(attrsNode)) {
      if (k !== '$' && k !== '_') result[k] = typeof v === 'object' ? (v._ || JSON.stringify(v)) : v;
    }
  }
  return result;
}

function extractImages(imgsNode) {
  if (!imgsNode) return [];
  if (typeof imgsNode === 'string') return imgsNode ? [imgsNode] : [];
  const imgItems = imgsNode.i || imgsNode.img || imgsNode.image || imgsNode.main || imgsNode.url;
  if (!imgItems) return [];
  const arr = Array.isArray(imgItems) ? imgItems : [imgItems];
  return arr.map(i => (typeof i === 'string' ? i : (i.url || i._ || ''))).filter(Boolean);
}

function clean(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/<[^>]+>/g, '').trim();
}

/**
 * Parse locally uploaded XML file content (Buffer or string)
 */
async function parseUploadedXml(content) {
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : content;
  return parseXml(text);
}

/**
 * Generate XML for reimporting updated products into ShopGold
 */
function generateImportXml(products) {
  const builder = new xml2js.Builder({ rootName: 'products', xmldec: { version: '1.0', encoding: 'UTF-8' } });
  const obj = {
    product: products.map(p => ({
      id: p.shop_id,
      name: p.name,
      description: p.description,
      meta_title: p.meta_title || '',
      meta_description: p.meta_description || '',
      price: p.price,
      attrs: {
        a: Object.entries(p.attributes || {}).map(([name, value]) => ({ $: { name }, _: value })),
      },
    })),
  };
  return builder.buildObject(obj);
}

module.exports = { fetchProducts, parseUploadedXml, parseXml, generateImportXml };
