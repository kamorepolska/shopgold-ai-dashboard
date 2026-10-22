/**
 * baseXmlService.js
 * Parses BaseLinker/BASE XML product export files and generates SEO-optimised HTML descriptions.
 * 
 * BaseLinker XML format (typical):
 *   <products>
 *     <product>
 *       <id>, <ean>, <name>, <description>, <price>, <category>, <producer>, <quantity>
 *       <images><image url="..."/></images>
 *       <features><feature name="..." value="..."/></features>
 *     </product>
 *   </products>
 */

const { parseStringPromise } = require('xml2js');

// ─── Parameter normaliser ────────────────────────────────────────────────────
// Normalises values like "15cm" → "15 cm", "5gbps" → "5 Gbps", etc.
const UNIT_MAP = [
  { re: /(\d+)\s*gbps/gi,  rep: '$1 Gbps' },
  { re: /(\d+)\s*mbps/gi,  rep: '$1 Mbps' },
  { re: /(\d+)\s*mb/gi,    rep: '$1 MB' },
  { re: /(\d+)\s*gb/gi,    rep: '$1 GB' },
  { re: /(\d+)\s*tb/gi,    rep: '$1 TB' },
  { re: /(\d+(?:[.,]\d+)?)\s*cm/gi,  rep: (_, n) => n + ' cm' },
  { re: /(\d+(?:[.,]\d+)?)\s*mm/gi,  rep: (_, n) => n + ' mm' },
  { re: /(\d+(?:[.,]\d+)?)\s*m\b/gi, rep: (_, n) => n + ' m' },
  { re: /(\d+(?:[.,]\d+)?)\s*kg/gi,  rep: (_, n) => n + ' kg' },
  { re: /(\d+(?:[.,]\d+)?)\s*g\b/gi, rep: (_, n) => n + ' g' },
  { re: /(\d+)\s*w\b/gi,   rep: '$1 W' },
  { re: /(\d+)\s*v\b/gi,   rep: '$1 V' },
  { re: /(\d+)\s*mah/gi,   rep: '$1 mAh' },
  { re: /(\d+)\s*hz/gi,    rep: '$1 Hz' },
  { re: /(\d+)\s*mhz/gi,   rep: '$1 MHz' },
  { re: /(\d+)\s*ghz/gi,   rep: '$1 GHz' },
  { re: /(\d+)\s*"(?!\w)/g, rep: '$1"' },
];

function normaliseValue(val, key = '') {
  if (!val || typeof val !== 'string') return val;
  let v = val.trim();
  for (const { re, rep } of UNIT_MAP) {
    v = v.replace(re, rep);
  }
  // Normalise comma-decimal to dot: "15,5 cm" → "15.5 cm"
  v = v.replace(/(\d+),(\d+)/g, '$1.$2');

  // Specific key-based normalisation
  const kLow = key.toLowerCase();
  if (kLow.includes('przekątna') || kLow.includes('matryc') || kLow.includes('ekran') || kLow.includes('wyświetlacz')) {
    // Strip existing inch marks first to unify
    v = v.replace(/["″'']+\s*$/, '').trim();
    // If it's just a number like "16" or "15.6", append '"'
    if (/^\d+(?:\.\d+)?$/.test(v)) {
      v += '"';
    }
  }

  return v;
}

function normaliseAttributes(attrs) {
  const out = {};
  for (const [k, v] of Object.entries(attrs || {})) {
    out[k] = normaliseValue(v, k);
  }
  return out;
}

// ─── XML Parser ──────────────────────────────────────────────────────────────
async function parseBaseXml(xmlBuffer) {
  const xmlStr = xmlBuffer.toString('utf-8');
  
  let parsed;
  try {
    parsed = await parseStringPromise(xmlStr, {
      explicitArray: false,
      mergeAttrs: false,
      trim: true,
      normalize: true,
    });
  } catch (e) {
    throw new Error('Nieprawidłowy plik XML: ' + e.message);
  }

  // Navigate to products list — BaseLinker puts it at parsed.products.product OR parsed.offer.products.product
  let rawProducts =
    parsed?.products?.product ||
    parsed?.offer?.products?.product ||
    parsed?.root?.product ||
    parsed?.Products?.Product ||
    null;

  if (!rawProducts) {
    throw new Error('Nie znaleziono produktów w XML. Sprawdź format pliku — oczekiwany export BaseLinker/BASE.');
  }

  if (!Array.isArray(rawProducts)) rawProducts = [rawProducts];

  // Debug: pokaż klucze surowego XML pierwszego produktu
  if (rawProducts[0]) {
    console.log('[BaseXML] Raw product keys:', Object.keys(rawProducts[0]).join(', '));
    // Pokaż też strukturę images i features
    const p0 = rawProducts[0];
    if (p0.images) console.log('[BaseXML] images type:', typeof p0.images, Array.isArray(p0.images) ? 'array' : (p0.images.image ? 'has .image' : 'other'), JSON.stringify(p0.images).slice(0, 300));
    if (p0.features) console.log('[BaseXML] features type:', typeof p0.features, JSON.stringify(p0.features).slice(0, 300));
    if (p0.parameters) console.log('[BaseXML] parameters:', JSON.stringify(p0.parameters).slice(0, 300));
  }

  return rawProducts.map(p => parseProduct(p));
}

function txt(val) {
  if (!val) return '';
  if (typeof val === 'object' && val._) return String(val._);
  return String(val);
}

function parseProduct(p) {
  // ── Diagnostyka: zbierz klucze surowego XML dla debug ──
  const rawKeys = Object.keys(p || {});

  // ── IMAGES ─────────────────────────────────────────────────────────────
  let images = [];

  // NAJPIERW: główne zdjęcie BaseLinker <image>url</image>
  if (p.image) {
    const mainUrl = txt(p.image);
    if (mainUrl && mainUrl.startsWith('http')) images.push(mainUrl);
  }

  // Wariant 1: <images><image url="..."/> lub <image>url</image></images>
  const imgNode = p.images || p.Images || p.gallery || p.Gallery;
  if (imgNode) {
    if (imgNode.main) {
      const u = txt(imgNode.main);
      if (u && u.startsWith('http') && !images.includes(u)) images.push(u);
    }
    const imgSource = imgNode.image || imgNode.Image || imgNode.item || imgNode.url;
    if (imgSource) {
      const imgArr = Array.isArray(imgSource) ? imgSource : [imgSource];
      for (const img of imgArr) {
        let u = '';
        if (typeof img === 'string') u = img.trim();
        else if (img && img.$ && img.$.url) u = img.$.url;
        else if (img && img.$ && img.$.src) u = img.$.src;
        else if (img && img.url) u = txt(img.url);
        else if (img && img.src) u = txt(img.src);
        else if (img && img._) u = img._;
        if (u && u.startsWith('http') && !images.includes(u)) images.push(u);
      }
    }
  }

  // Wariant 2: BaseLinker: <image_extra_1>...<image_extra_15>
  for (let i = 1; i <= 20; i++) {
    for (const prefix of ['image_extra_', 'image_']) {
      const key = `${prefix}${i}`;
      if (p[key]) {
        const u = txt(p[key]);
        if (u && u.startsWith('http') && !images.includes(u)) images.push(u);
      }
    }
  }
  // Wariant 3: inne nazwy pól ze zdjęciem
  for (const k of ['image_url', 'photo', 'zdjecie', 'picture', 'main_image', 'thumbnail']) {
    if (p[k]) {
      const u = txt(p[k]);
      if (u && u.startsWith('http') && !images.includes(u)) images.push(u);
    }
  }
  // Wariant 4: Tekst z wieloma URL (oddzielone ; lub | lub \n)
  if (typeof imgNode === 'string' && imgNode.includes('http')) {
    const urls = imgNode.split(/[;|\n]/).map(s => s.trim()).filter(s => s.startsWith('http'));
    for (const u of urls) if (!images.includes(u)) images.push(u);
  }

  images = images.filter(Boolean);

  // ── FEATURES / PARAMETERS ────────────────────────────────────────────
  const attrs = {};

  // Wariant 1: <features><feature name="..." value="..."/> lub <feature><name>...</name><value>...</value></feature>
  const featNode = p.features || p.Features || p.parameters || p.Parameters || p.cechy || p.Cechy || p.attributes || p.Attributes;
  if (featNode && typeof featNode === 'object') {
    const featArr = featNode.feature || featNode.Feature || featNode.parameter || featNode.Parameter || featNode.cecha || featNode.attribute;
    if (featArr) {
      const arr = Array.isArray(featArr) ? featArr : [featArr];
      for (const f of arr) {
        if (!f) continue;
        // BaseLinker: <attribute><attribute_name>X</attribute_name><attribute_value>Y</attribute_value></attribute>
        // Lub: <feature name="X" value="Y"/> (atrybuty XML)
        // Lub: <feature><name>X</name><value>Y</value></feature>
        const name  = txt(
          (f.$ && f.$.name)  || f.attribute_name || f.name || f.Name || f.nazwa || ''
        );
        const value = txt(
          (f.$ && f.$.value) || f.attribute_value || f.value || f.Value || f.wartosc || f._ || ''
        );
        if (name && value) attrs[name] = value;
      }
    }
    // Wariant 2: Bezpośrednie klucze w <features>: <features><Kolor>Czarny</Kolor><Material>Poliester</Material></features>
    for (const [k, v] of Object.entries(featNode)) {
      if (['feature', 'Feature', 'parameter', 'Parameter', 'cecha', 'attribute', '$'].includes(k)) continue;
      if (typeof v === 'string' || typeof v === 'number') {
        attrs[k] = String(v);
      } else if (v && v._) {
        attrs[k] = String(v._);
      }
    }
  }

  // Wariant 3: Inline XML <extra_field_1>, <extra_field_2>...
  for (const [k, v] of Object.entries(p)) {
    if (k.startsWith('extra_field_') || k.startsWith('param_') || k.startsWith('feature_')) {
      const val = txt(v);
      if (val) attrs[k] = val;
    }
  }

  // ── PRODUCER ─────────────────────────────────────────────────────────
  const producer = txt(
    p.producer || p.Producer || p.producent || p.Producent ||
    p.manufacturer_name || p.man_name || p.manufacturer || p.Manufacturer ||
    p.brand || p.Brand || p.brand_name || p.marka || p.Marka || ''
  );

  // ── PRICE ────────────────────────────────────────────────────────────
  const priceRaw = txt(
    p.price || p.Price || p.cena || p.Cena ||
    p.price_brutto || p.price_gross || p.price_netto || p.price_net ||
    p.price_wholesale || p.cena_brutto || p.cena_netto || '0'
  );
  const price = parseFloat(priceRaw.replace(',', '.')) || 0;

  // ── ID ───────────────────────────────────────────────────────────────
  const id = txt(p.id || p.ID || p.product_id || p.productId || p.kod || p.sku || p.SKU || '');

  // ── EAN ──────────────────────────────────────────────────────────────
  const ean = txt(p.ean || p.EAN || p.barcode || p.Barcode || p.gtin || p.GTIN || '');

  // ── CATEGORY ─────────────────────────────────────────────────────────
  const category = txt(
    p.category || p.Category || p.kategoria || p.Kategoria ||
    p.category_name || p.cat || ''
  );

  // ── Skonsolidowany produkt ──────────────────────────────────────────
  return {
    id,
    ean,
    name:        txt(p.name || p.nazwa || p.Name || p.Nazwa || p.title || p.Title || ''),
    description: txt(p.description || p.opis || p.Description || p.Opis || p.desc || ''),
    price,
    category,
    producer,
    quantity:    parseInt(txt(p.quantity || p.stock || p.qty || p.stan || p.ilosc || '0')) || 0,
    images,
    attributes:  normaliseAttributes(attrs),
    _rawKeys:    rawKeys,  // debug: klucze surowego XML
  };
}

// ─── HTML Description Generator ─────────────────────────────────────────────
const SESSION_PHOTO_URL = 'https://kamore.pl/images/produkty/mini/images.png';

/**
 * Generates an SEO HTML description from a parsed BASE product object.
 * Uses the provided AI service to write copy if configured; falls back to template.
 */
async function generateDescription(product, aiService, sessionPhotoUrl) {
  const photoUrl = sessionPhotoUrl || SESSION_PHOTO_URL;
  const imgs = product.images || [];
  const attrs = product.attributes || {};

  // ── AI-generated copy ───────────────────────────────────────────────────
  let aiCopy = null;
  if (aiService) {
    try {
      aiCopy = await generateAiCopy(product, aiService);
    } catch (e) {
      console.warn('[BaseXML] AI copy failed, using template:', e.message);
    }
  }

  const copy = aiCopy || buildTemplateCopy(product);

  // Dodaj nowo odkryte parametry przez AI do produktu, aby można je było wyeksportować
  product.newAttributes = copy.newAttributes || {};
  
  if (copy.title) {
    product.name = copy.title;
  }
  
  // ── Build sections ──────────────────────────────────────────────────────
  const sections = [];

  // Zaktualizuj atrybuty (jeśli AI zwróciło zunifikowaną wersję)
  if (copy.attributes && Object.keys(copy.attributes).length > 0) {
    product.attributes = normaliseAttributes(copy.attributes); // Podmiana na ujednolicone + normalizacja
  } else {
    product.attributes = normaliseAttributes(product.attributes || attrs);
  }

  // Auto-detect laptop screen size from product name for bags/backpacks
  const nameLow = (product.name || '').toLowerCase();
  const isBagForLaptop = /(?:torba|plecak|pokrowiec|etui|futerał|walizka|neseser)/.test(nameLow) && /(?:laptop|notebook|komputer)/.test(nameLow);
  if (isBagForLaptop) {
    const hasMatryca = Object.keys(product.attributes).some(k => k.toLowerCase().includes('matryc') || k.toLowerCase().includes('przekątna'));
    if (!hasMatryca) {
      // Try to extract size like 16, 15.6, 17'', etc. from product name
      const sizeMatch = (product.name || '').match(/(\d+[.,]?\d*)\s*['"″’]*/); 
      if (sizeMatch) {
        const size = sizeMatch[1].replace(',', '.');
        product.attributes['Wielkość matrycy'] = size + '"';
      }
    }
  }

  const combinedAttrs = product.attributes;

  // Section 1 — hero image + tagline (image alternates left/right)
  if (imgs[0]) {
    sections.push(buildSection(
      `<section class="image-item"><img src="${imgs[0]}"></section>`,
      `<section class="text-item"><h1>${escHtml(product.name)}</h1>${copy.hook}</section>`
    ));
  } else {
    sections.push(buildSection(
      `<section class="text-item"><h1>${escHtml(product.name)}</h1>${copy.hook}</section>`,
      null, 12
    ));
  }

  // Section 2 — benefit 1 + benefit 2 + image 2
  const textSec2 = `<section class="text-item">${copy.benefit1}${copy.benefit2}</section>`;
  if (imgs[1]) {
    sections.push(buildSection(textSec2, `<section class="image-item"><img src="${imgs[1]}"></section>`, 6, true));
  } else {
    sections.push(buildSection(textSec2, null, 12));
  }



  // Section 3 — benefit 3 + image 3
  if (copy.benefit3) {
    const textSec3 = `<section class="text-item">${copy.benefit3}${copy.compat || ''}</section>`;
    if (imgs[3] || imgs[2]) {
      sections.push(buildSection(
        `<section class="image-item"><img src="${imgs[3] || imgs[2]}"></section>`,
        textSec3
      ));
    } else {
      sections.push(buildSection(textSec3, null, 12));
    }
  }

  // Section "Dlaczego [brand]" — full width
  sections.push(`<section class="section">
    <div class="item item-12">
        <section class="text-item">
            ${copy.brand}
        </section>
    </div>
</section>`);

  // Section — specs + image
  const specList = buildSpecList(combinedAttrs, product);
  const specSec = `<section class="text-item"><h2>Specyfikacja techniczna</h2>${specList}</section>`;
  if (imgs[4] || imgs[1]) {
    sections.push(buildSection(
      `<section class="image-item"><img src="${imgs[4] || imgs[1]}"></section>`,
      specSec
    ));
  } else {
    sections.push(buildSection(specSec, null, 12));
  }

  // Final pass: convert any remaining markdown bold and strip stray styles
  let finalHtml = sections.join('');
  finalHtml = finalHtml.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  finalHtml = finalHtml.replace(/__([^_\n]+)__/g, '<b>$1</b>');
  return finalHtml;
}

// ─── AI copy generation ──────────────────────────────────────────────────────
async function generateAiCopy(product, aiService) {
  const descClean = (product.description || '').replace(/<[^>]+>/g, '').slice(0, 1500);
  const attrsStr  = Object.entries(product.attributes || {}).map(([k,v]) => `${k}: ${v}`).join(', ').slice(0, 600);

  const system = `Jesteś copywriterem e-commerce i specjalistą SEO. Piszesz opisy produktów po POLSKU. Używasz emocjonalnego języka korzyści.
ZASADY OBOWIĄZKOWE:
1. MUSISZ używać tagów <b>tekst</b> do pogrubień kluczowych słów i fraz w każdej sekcji. Bez pogrubień odpowiedź jest niepoprawna.
2. Używaj ikon/emoji spośród tej listy: ▶️ ✅ ❗️ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 🔥 ❓ ⚡ ⭐️ ✔️ ✴️ ♻️ ♨️ — TYLKO tych, żadnych innych.
3. Nazwy marek i producentów (np. ${product.producer || ''}) zawsze z wielkiej litery.
4. Odpowiadaj wyłącznie poprawnym JSON, bez żadnych dodatkowych komentarzy.`;

  const user = `Napisz sekcje copywriterskie dla produktu e-commerce:

Nazwa: ${product.name}
Producent: ${product.producer || 'brak'}
Kategoria: ${product.category || 'brak'}
Opis źródłowy: ${descClean || 'brak'}
Parametry: ${attrsStr || 'brak'}

Przeanalizuj podane "Parametry" oraz "Opis źródłowy". Zwróć JEDEN, zunifikowany obiekt "attributes", który będzie zawierał wszystkie parametry (te oryginalne z listy i nowo odkryte w opisie).
Bezwzględnie ujednolić ich zapis dla całego zestawienia (np. zamień "15cm" na "15 cm", "5w" na "5 W", "16" w wielkości matrycy na "16\"" itd.).

Popraw także formatowanie nazwy (title) oraz wszystkich nagłówków sekcji (hook, benefit1, benefit2, benefit3, compat, brand) - wyłącznie pierwsza litera zdania oraz nazwy własne mają być wielką literą, a pozostałe słowa małą (zabronione jest zaczynanie każdego wyrazu wielką literą).

Zwróć JSON z polami:
{
  "title": "Sformatowana nazwa produktu (pierwsza litera i nazwy własne z wielkiej, reszta małymi)",
  "hook": "<h2>⚡ Chwytliwy nagłówek</h2><p>Tekst z <b>pogrubionym słowem kluczowym</b> i <b>kolejnym ważnym słowem</b>. Użyj ❗️ w tekście.</p>",
  "benefit1": "<h2>🔥 Nagłówek korzyści 1</h2><p>✅ Tekst z <b>pogrubieniem</b> i <b>kolejnym pogrubieniem</b> najważniejszych cech.</p>",
  "benefit2": "<h2>⭐️ Nagłówek korzyści 2</h2><p>▶️ Tekst z <b>pogrubionym słowem</b> opisującym korzyść.</p>",
  "benefit3": "<h2>✔️ Nagłówek korzyści 3</h2><p>✅ Tekst z <b>pogrubieniem</b> kluczowego argumentu.</p>",
  "compat": "<h2>♻️ Kompatybilność</h2><p>Tekst z <b>pogrubieniem</b> pasujących urządzeń/systemów.</p>",
  "brand": "<h2>❓ Dlaczego ${product.producer || 'ten producent'}?</h2><p>Tekst z <b>pogrubieniem</b> kluczowych zalet marki.</p>",
  "attributes": {
    "Nazwa Parametru": "Znormalizowana Wartość (dla wszystkich parametrów)"
  }
}`;

  // IMPORTANT: Each HTML section MUST contain at least 2 <b>...</b> tags with bolded key words.

  const provider = aiService.getEffectiveProvider();
  // Try feature-specific mapping first, then fallback chain for OWUI
  let model = aiService.getEffectiveModel(provider, 'pim_generate') ||
              aiService.getEffectiveModel(provider, 'pim_qa') ||
              '';

  // For OWUI: if no feature mapping set, auto-discover first available model
  if (!model && provider === 'owui') {
    try {
      const { settingsOps } = require('../models/localDb');
      // Check explicit setting first
      model = settingsOps.get('owui_default_model') || settingsOps.get('owui_model') || '';

      // If still empty, fetch models list from OWUI and take first available
      if (!model) {
        const owuiSvc = require('./openwebuiService');
        const models  = await owuiSvc.listModels();
        if (models && models.length) {
          model = models[0].id || models[0].name || models[0].model || '';
          console.log(`[BaseXML] Auto-selected OWUI model: ${model}`);
        }
      }
    } catch (e) {
      console.warn('[BaseXML] OWUI model auto-discovery failed:', e.message);
    }
  }

  if (!model) throw new Error(`Brak modelu AI dla dostawcy "${provider}". Skonfiguruj model w Ustawienia → AI → Mapowanie Funkcji lub ustaw domyślny model Open WebUI.`);

  const result = await aiService.complete(system, user, {
    provider, model, featureId: 'pim_generate', temperature: 0.75, maxTokens: 8192, skipBrandKb: true,
  });

  const raw = (result.text || '')
    .replace(/```json?\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Debug: log raw AI response
  console.log('[BaseXML] RAW AI RESPONSE (first 500 chars):', raw.slice(0, 500));
    
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Brak JSON w odpowiedzi AI');
  
  const parsed = JSON.parse(jsonMatch[0]);

  const producer = product.producer || '';

  function cleanHtml(str) {
    if (!str || typeof str !== 'string') return str;
    let s = str
      // Convert markdown bold **text** → <b>text</b>
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      // Convert __text__ → <b>text</b>
      .replace(/__([^_\n]+)__/g, '<b>$1</b>')
      // Strip ALL inline style/class attributes from any HTML tag
      .replace(/<(\w+)\s+[^>]*>/gi, (match, tag) => `<${tag}>`);

    // Ensure producer name is always capitalized correctly
    if (producer) {
      const escapedProducer = producer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const producerRe = new RegExp(escapedProducer, 'gi');
      s = s.replace(producerRe, producer);
    }

    return s;
  }

  const htmlFields = ['hook', 'benefit1', 'benefit2', 'benefit3', 'compat', 'brand'];
  for (const f of htmlFields) {
    if (parsed[f]) parsed[f] = cleanHtml(parsed[f]);
  }

  return parsed;
}

// ─── Template copy fallback ───────────────────────────────────────────────────
// Helper: cut text at last sentence boundary (. ! ?) within maxLen
function sliceAtSentence(text, maxLen = 400) {
  if (!text || text.length <= maxLen) return text;
  const chunk = text.slice(0, maxLen);
  // Find last sentence-ending punctuation
  const lastDot = Math.max(chunk.lastIndexOf('. '), chunk.lastIndexOf('! '), chunk.lastIndexOf('? '), chunk.lastIndexOf('.\n'), chunk.lastIndexOf('!\n'), chunk.lastIndexOf('?\n'));
  if (lastDot > maxLen * 0.4) {
    return chunk.slice(0, lastDot + 1).trim();
  }
  // Fallback: cut at last space
  const lastSpace = chunk.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.5) {
    return chunk.slice(0, lastSpace).trim() + '…';
  }
  return chunk.trim() + '…';
}

function buildTemplateCopy(product) {
  const name     = product.name || '';
  const producer = product.producer || '';
  const rawDesc  = (product.description || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const desc     = sliceAtSentence(rawDesc, 400);
  const attrs    = product.attributes || {};

  const words = name.split(' ').slice(0, 4).join(' ');

  return {
    hook: `<h2>⚡ ${words} – wybór z głową</h2><p>${desc || `<b>${name}</b> to produkt, który łączy jakość z wygodą użytkowania.`}</p>`,
    benefit1: `<h2>🔥 Wydajność, która robi różnicę</h2><p>✅ Doskonałe parametry techniczne gwarantują <b>niezawodne działanie</b> w każdych warunkach.</p>`,
    benefit2: `<h2>⭐️ Łatwe w użyciu</h2><p>▶️ Intuicyjna obsługa i <b>Plug &amp; Play</b> – działa od razu po podłączeniu, bez instalacji sterowników.</p>`,
    benefit3: `<h2>✔️ Trwałość na lata</h2><p>✅ <b>Solidne wykonanie</b> i sprawdzone materiały to gwarancja jakości, która przetrwa lata intensywnego użytkowania.</p>`,
    compat:   `<h2>♻️ Szeroka kompatybilność</h2><p>Działa z <b>Windows, Mac OS, Linux</b> oraz wszystkimi popularnymi systemami i urządzeniami.</p>`,
    brand:    `<h2>❓ Dlaczego ${producer || 'ten producent'}?</h2><p>Producent z <b>wieloletnią tradycją</b>, <b>innowacyjnym podejściem do wzornictwa</b> i rygorystyczną kontrolą jakości na każdym etapie produkcji.</p>`,
    attributes: attrs
  };
}

// ─── Spec list builder ────────────────────────────────────────────────────────
function buildSpecList(attrs, product) {
  const items = [];
  const addedKeys = new Set();

  const add = (k, v) => {
    if (!v) return;
    let kl = String(k).toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]/g, '');
    
    // Skip non-technical parameters
    if (kl === 'kategoria' || kl === 'category' || kl === 'cat') return;

    // Normalize common duplicates
    if (kl.startsWith('ean')) kl = 'ean';
    if (kl === 'producent' || kl === 'producer' || kl === 'marka' || kl === 'brand') kl = 'producent';

    if (!addedKeys.has(kl)) {
      items.push([k, v]);
      addedKeys.add(kl);
    }
  };

  if (product.ean)      add('EAN', product.ean);
  if (product.producer) add('Producent', product.producer);

  for (const [k, v] of Object.entries(attrs)) {
    add(k, normaliseValue(v, k));
  }

  if (!items.length) return '<p>Brak danych technicznych</p>';

  return `<ul>${items.map(([k, v]) => `<li><b>${escHtml(k)}:</b>&nbsp;${escHtml(String(v))}</li>`).join('')}</ul>`;
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────
function buildSection(left, right, itemClass = 6, swapped = false) {
  if (!right) {
    return `<section class="section">
    <div class="item item-${itemClass || 12}">
        ${left}
    </div>
</section>`;
  }
  return `<section class="section">
    <div class="item item-6">
        ${left}
    </div>

    <div class="item item-6">
        ${right}
    </div>
</section>`;
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// escAttr — do atrybutów HTML (src, href) — NIE escapuje & w URL (zapobiega łamaniu linków)
function escAttr(s) {
  return String(s || '')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { parseBaseXml, generateDescription, normaliseAttributes, normaliseValue };
