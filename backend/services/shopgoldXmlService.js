const { parseStringPromise, Builder } = require('xml2js');
const { normaliseAttributes } = require('./baseXmlService');
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

async function scrapeWebsiteLinks(websiteUrl) {
  if (!websiteUrl) return [];
  try {
    console.log(`[ShopGold XML] Analizowanie strony WWW: ${websiteUrl}`);
    const normalizedUrl = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
    const base = new URL(normalizedUrl);
    
    const { data } = await axios.get(normalizedUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
      },
      validateStatus: () => true
    });

    const $ = cheerio.load(data);
    const linksMap = new Map();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim();
      if (!href) return;

      // Resolve relative URLs
      let absoluteUrl;
      try {
        absoluteUrl = new URL(href, normalizedUrl).toString();
      } catch {
        return;
      }

      // Only keep links on the same host/domain
      const targetHost = new URL(absoluteUrl).host;
      if (targetHost !== base.host) return;

      // Clean anchor text
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      
      // Filter out empty or generic texts
      if (!text || text.length < 3 || text.length > 50) return;
      const lowerText = text.toLowerCase();
      const genericTexts = [
        'zaloguj', 'rejestracja', 'koszyk', 'szukaj', 'kontakt', 'o nas', 'regulamin', 
        'polityka', 'dostawa', 'płatność', 'strona główna', 'zobacz', 'więcej', 'czytaj',
        'home', 'login', 'cart', 'checkout', 'menu', 'moje konto', 'pl', 'en'
      ];
      if (genericTexts.some(g => lowerText.includes(g) || g.includes(lowerText))) return;

      // Avoid hash links or administrative links
      if (absoluteUrl.includes('#') || absoluteUrl.includes('?') || absoluteUrl.includes('account') || absoluteUrl.includes('cart')) return;

      linksMap.set(absoluteUrl, text);
    });

    const links = Array.from(linksMap.entries()).map(([url, text]) => ({ url, text }));
    console.log(`[ShopGold XML] Wykryto ${links.length} unikalnych linków ze strony.`);
    return links.slice(0, 40); // limit to top 40 links to avoid blowing prompt context
  } catch (err) {
    console.error(`[ShopGold XML] Błąd skrobania strony ${websiteUrl}:`, err.message);
    return [];
  }
}

async function processShopGoldXml(xmlBuffer, aiService, onProgress, websiteUrl = null) {
  const xmlStr = xmlBuffer.toString('utf-8');
  let parsed;
  try {
    // parse with default settings to preserve structure (explicitArray: true)
    parsed = await parseStringPromise(xmlStr);
  } catch (e) {
    throw new Error('Nieprawidłowy plik XML: ' + e.message);
  }

  // Scrape website links if websiteUrl is provided
  let links = [];
  if (websiteUrl) {
    onProgress({ processed: 0, total: 1, currentName: 'Analizowanie strony WWW...' });
    links = await scrapeWebsiteLinks(websiteUrl);
  }

  // Find products array
  let productsArr = null;
  if (parsed?.products?.product) productsArr = parsed.products.product;
  else if (parsed?.offer?.products?.product) productsArr = parsed.offer.products.product;
  else if (parsed?.root?.product) productsArr = parsed.root.product;
  else if (parsed?.Products?.Product) productsArr = parsed.Products.Product;

  if (!productsArr) {
    throw new Error('Nie znaleziono produktów w XML. Sprawdź format pliku.');
  }

  // Process each product
  for (let i = 0; i < productsArr.length; i++) {
    const p = productsArr[i];
    
    // Extract basic info for prompt
    const name = txt(p.name || p.nazwa || p.Name || p.title || '');
    const desc = txt(p.description || p.opis || p.Description || p.desc || '').replace(/<[^>]+>/g, '').slice(0, 800);
    // BaseLinker/ShopGold używa manufacturer_name i category_name
    const category = txt(p.category_name || p.category || p.Category || p.kategoria || '');
    const producer = txt(p.manufacturer_name || p.producer || p.producent || p.manufacturer || p.brand || '');
    
    // Attempt to extract features
    const attrs = extractAttrs(p);
    const attrsStr = Object.entries(attrs).map(([k,v]) => `${k}: ${v}`).join(', ').slice(0, 600);

    onProgress({ processed: i, total: productsArr.length, currentName: name });

    if (aiService && name) {
      try {
        const generated = await generateShopGoldCopy(name, producer, category, desc, attrsStr, aiService, links);
        
        // Build JSON-LD script
        const ldJsonStr = `<script type="application/ld+json">\n${JSON.stringify(generated.ldJson, null, 2)}\n</script>\n\n`;
        const fullDesc = ldJsonStr + generated.htmlDescription;
        
        // Inject back into XML
        if (p.description) {
          p.description[0] = { _: fullDesc };
        } else if (p.opis) {
          p.opis[0] = { _: fullDesc };
        } else {
          p.description = [{ _: fullDesc }];
        }
      } catch (err) {
        console.error(`Błąd generowania dla ${name}:`, err.message);
        onProgress({ error: `Błąd dla ${name}: ${err.message}` });
      }
    }
  }

  onProgress({ processed: productsArr.length, total: productsArr.length, currentName: 'Kompilacja XML...' });

  // Rebuild XML
  const builder = new Builder({ cdata: true });
  return builder.buildObject(parsed);
}

function txt(val) {
  if (!val) return '';
  if (Array.isArray(val)) val = val[0];
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val._) return String(val._);
    // xml2js może zwrócić pusty obiekt dla pustego tagu
    return '';
  }
  return String(val);
}

/**
 * Wyciąga cechy/parametry produktu ze wszystkich znanych formatów XML:
 * - BaseLinker/ShopGold: <attributes><attribute><name>...</name><value>...</value></attribute></attributes>
 * - Też obsługuje atrybuty XML: <attribute name="X" value="Y"/>
 * - Starsze formaty: <features><feature name="X" value="Y"/>
 * - Oraz: <parameters><parameter>...</parameter></parameters>
 */
function extractAttrs(p) {
  const attrs = {};

  // Kandydaci węzłów zawierających cechy
  const candidates = [
    p.attributes, p.Attributes,
    p.features,   p.Features,
    p.parameters, p.Parameters,
    p.params,     p.attrs,
  ];

  for (const cand of candidates) {
    if (!cand) continue;
    const node = Array.isArray(cand) ? cand[0] : cand;
    if (!node || typeof node !== 'object') continue;

    // Możliwe nazwy dzieci: attribute, feature, parameter, param
    const childArr = node.attribute || node.Attribute ||
                     node.feature   || node.Feature   ||
                     node.parameter || node.Parameter ||
                     node.param     || null;

    if (childArr && Array.isArray(childArr)) {
      for (const f of childArr) {
        // Forma 1: <attribute><name>X</name><value>Y</value></attribute>
        let name  = txt(f.name  || f.Name);
        let value = txt(f.value || f.Value || f._);

        // Forma 2: <attribute name="X" value="Y"/> (atrybuty XML w $)
        if (!name && f.$) {
          name  = txt(f.$.name  || f.$.Name);
          value = txt(f.$.value || f.$.Value || f._);
        }

        if (name && value) attrs[name] = value;
      }
    }
  }

  return attrs;
}

async function generateShopGoldCopy(name, producer, category, desc, attrsStr, aiService, links = []) {
  let linkingInstructions = '';
  if (links && links.length > 0) {
    linkingInstructions = `
6. LINKOWANIE WEWNĘTRZNE (SEO): W opisie HTML musisz naturalnie wpleść aktywne linki (tagi <a href="...">) prowadzące do powiązanych kategorii lub produktów z poniższej listy strony WWW.
Wybierz od 2 do 5 najbardziej pasujących słów/fraz kluczowych w tekście opisu i zamień je na linki HTML korzystając z podanych URLi.
DOPUSZCZALNE LINKI DO UŻYCIA (Użyj tylko linków z poniższej listy):
${links.map(l => `- Słowo/Fraza: "${l.text}" -> URL: "${l.url}"`).join('\n')}
Uwaga: Linki wplataj w naturalny sposób (np. "...nasz nowy <a href="https://domena.pl/plecaki">plecak bambusowy</a> sprawdzi się..."). Używaj dokładnie takich adresów URL, jakie podano!`;
  }

  const system = `Jesteś profesjonalnym copywriterem e-commerce i specjalistą SEO.
Twoim zadaniem jest stworzenie rozbudowanego, perswazyjnego i profesjonalnego opisu produktu oraz znacznika JSON-LD dla sklepu opartego na ShopGold.

MUSISZ ZWRÓCIĆ DANE W FORMACIE JSON O DOKŁADNIE TAKIEJ STRUKTURZE (UZYJ DOKŁADNIE TYCH KLUCZY, BEZ ZNAKU @ W KLUCZACH):
{
  "ldJson": {
    "context": "https://schema.org/",
    "type": "Product",
    "name": "Pełna nazwa produktu",
    "description": "Krótki opis czystym tekstem (max 160 znaków) do schema",
    "brand": {
      "type": "Brand",
      "name": "Nazwa producenta"
    }
  },
  "htmlDescription": "Tutaj wpisz kompletny, rozbudowany i sformatowany w HTML kod opisu"
}

ZASADY OPISU I STYLIZACJI:
1. Ikony i Emoji: MUSISZ używać w tekście następujących ikon/emoji aby go uatrakcyjnić: ▶️ ✅ ❗️ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 🔥 ❓ ⚡ ⭐️ ✔️ ✴️ ♻️ ♨️ (ABSOLUTNY ZAKAZ używania jakichkolwiek innych emoji, używaj wyłącznie tych dozwolonych). Umieszczaj je np. przy nagłówkach lub na listach.
2. Formatowanie HTML: Opis must być sformatowany czystym HTML (używaj wyłącznie: <h2>, <h3>, <p>, <ul>, <li>, <b>, <a>). ZAKAZ używania zewnętrznych kontenerów typu <section>, <div> lub jakichkolwiek klas CSS i styli inline.
3. Pisownia nagłówków i tytułów (H2, H3): Pisz zgodnie z polskimi zasadami gramatycznymi. ZABRANIA SIĘ pisania całych nagłówków/tytułów WIELKIMI LITERAMI (np. ZAKAZANE JEST "SZCZEGÓŁY PLECAKA" lub "ZALETY"). Pisz normalnie: wielka litera na początku zdania/nagłówka + nazwy własne (np. "Szczegóły plecaka", "Wyjątkowe zalety", "Parametry techniczne", "Nawiązanie do kolekcji").
4. Struktura opisu produktowego (Musi zawierać te sekcje sformatowane jako nagłówki H2/H3):
   - Wstęp opisowy zawierający nawiązanie do danej kolekcji lub serii produktów (np. kolekcja ekologiczna, linia bambusowa, kolekcja wiosenna itp. - w zależności od kontekstu produktu).
   - Sekcja opisowa zatytułowana "Szczegóły [rodzaj_produktu]" (np. "Szczegóły plecaka", "Szczegóły stacji ładowania" - dynamicznie zastąp rodzaj produktu właściwym typem na podstawie jego nazwy).
   - Sekcja "Zalety" w postaci wypunktowanej listy HTML (<ul>, <li>) - użyj np. ✅ lub ✔️ jako punktory.
   - Sekcja "Parametry" zawierająca tabelę specyfikacji lub specyfikację techniczną.
5. Język: Profesjonalny, perswazyjny, poprawny gramatycznie po polsku. Zoptymalizowany pod kątem SEO (nagłówki H2/H3 powinny zawierać naturalne słowa kluczowe związane z produktem).${linkingInstructions}
6. Zwracasz wyłącznie poprawny format JSON o strukturze podanej wyżej i absolutnie nic więcej poza nim.`;

  const user = `Produkt do opracowania:
Nazwa: ${name}
Producent: ${producer || 'brak'}
Kategoria: ${category || 'brak'}
Opis oryginalny: ${desc || 'brak'}
Parametry: ${attrsStr || 'brak'}

Zwróć poniższy JSON:
{
  "ldJson": {
    "context": "https://schema.org/",
    "type": "Product",
    "name": "tutaj pełna nazwa",
    "description": "krótki opis czystym tekstem (max 160 znaków) dla schema",
    "brand": {
      "type": "Brand",
      "name": "tutaj nazwa producenta"
    }
  },
  "htmlDescription": "Tutaj wpisz kompletny, rozbudowany i sformatowany w HTML kod opisu (np. <h2>...</h2><p>...</p><ul><li>...</li></ul>)"
}`;

  const provider = aiService.getEffectiveProvider();
  let model = aiService.getEffectiveModel(provider, 'pim_generate') || aiService.getEffectiveModel(provider, 'pim_qa');
  
  if (!model && provider === 'owui') {
    const owuiSvc = require('./openwebuiService');
    const models = await owuiSvc.listModels();
    if (models?.length) model = models[0].id || models[0].name;
  }
  if (!model) throw new Error(`Brak modelu AI dla dostawcy "${provider}".`);

  const responseSchema = {
    type: "OBJECT",
    properties: {
      ldJson: {
        type: "OBJECT",
        properties: {
          context: { type: "STRING" },
          type: { type: "STRING" },
          name: { type: "STRING" },
          description: { type: "STRING" },
          brand: {
            type: "OBJECT",
            properties: {
              type: { type: "STRING" },
              name: { type: "STRING" }
            },
            required: ["type", "name"]
          }
        },
        required: ["context", "type", "name", "description", "brand"]
      },
      htmlDescription: { type: "STRING" }
    },
    required: ["ldJson", "htmlDescription"]
  };

  console.log('[DEBUG] Calling aiService.complete with system prompt:\n', system);
  console.log('[DEBUG] Calling aiService.complete with user prompt:\n', user);
  const result = await aiService.complete(system, user, {
    provider, model, featureId: 'pim_generate', temperature: 0.7, maxTokens: 4096, skipBrandKb: true, responseSchema
  });

  const raw = (result.text || '')
    .replace(/```json?\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/\*\*([\s\S]*?)\*\*/g, '<b>$1</b>')
    .trim();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[DEBUG] Raw AI Text failed to match JSON:', raw);
    throw new Error('Brak poprawnego JSON w odpowiedzi AI');
  }
  
  console.log('[DEBUG] Raw AI text length:', raw.length);
  console.log('[DEBUG] Matched JSON text:', jsonMatch[0]);
  const parsedObj = JSON.parse(jsonMatch[0]);
  console.log('[DEBUG] Parsed object keys:', Object.keys(parsedObj));

  // Transform keys to correct schema.org syntax (with @ symbols)
  if (parsedObj && parsedObj.ldJson) {
    const ld = parsedObj.ldJson;
    const cleanLd = {};

    cleanLd['@context'] = ld.context || ld['@context'] || 'https://schema.org/';
    cleanLd['@type'] = ld.type || ld['@type'] || 'Product';
    if (ld.name) cleanLd['name'] = ld.name;
    if (ld.description) cleanLd['description'] = ld.description;

    if (ld.brand) {
      cleanLd.brand = {};
      cleanLd.brand['@type'] = ld.brand.type || ld.brand['@type'] || 'Brand';
      if (ld.brand.name) cleanLd.brand.name = ld.brand.name;
    }

    parsedObj.ldJson = cleanLd;
  }

  // Clean htmlDescription: strip inline styles, convert markdown bold, filter emojis
  if (parsedObj.htmlDescription) {
    const ALLOWED_EMOJI = new Set([
      '▶️','✅','❗️','1️⃣','2️⃣','3️⃣','4️⃣','🔥','❓','⚡','⭐️','✔️','✴️','♻️','♨️'
    ]);
    const EMOJI_RE = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})(\uFE0F|\u20E3)?(\u200D(\p{Emoji_Presentation}|\p{Extended_Pictographic})(\uFE0F|\u20E3)?)*/gu;

    parsedObj.htmlDescription = parsedObj.htmlDescription
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/__([^_\n]+)__/g, '<b>$1</b>')
      .replace(/<(\w+)\s+[^>]*>/gi, (match, tag) => `<${tag}>`)
      .replace(EMOJI_RE, (match) => ALLOWED_EMOJI.has(match) ? match : '');
  }

  return parsedObj;
}


/**
 * Parse ShopGold XML and return product list (no AI, just extraction).
 * Returns array of { id, ean, name, producer, category, price, description, attrs, _rawIndex }
 */
async function parseShopGoldXml(xmlBuffer) {
  const xmlStr = xmlBuffer.toString('utf-8');
  let parsed;
  try {
    parsed = await parseStringPromise(xmlStr);
  } catch (e) {
    throw new Error('Nieprawidłowy plik XML: ' + e.message);
  }

  let productsArr = null;
  if (parsed?.products?.product) productsArr = parsed.products.product;
  else if (parsed?.offer?.products?.product) productsArr = parsed.offer.products.product;
  else if (parsed?.root?.product) productsArr = parsed.root.product;
  else if (parsed?.Products?.Product) productsArr = parsed.Products.Product;

  if (!productsArr) throw new Error('Nie znaleziono produktów w XML. Sprawdź format pliku.');

  const products = productsArr.map((p, idx) => {
    const attrs = extractAttrs(p);
    return {
      id:          txt(p.product_id || p.id || p.ID || p.sku || '') || String(idx + 1),
      ean:         txt(p.ean || p.EAN || p.barcode || ''),
      name:        txt(p.name || p.nazwa || p.Name || p.title || ''),
      // BaseLinker/ShopGold używa manufacturer_name i category_name
      producer:    txt(p.manufacturer_name || p.producer || p.producent || p.manufacturer || p.brand || p.Manufacturer || ''),
      category:    txt(p.category_name || p.category || p.Category || p.kategoria || p.cat || ''),
      price:       parseFloat(txt(p.price || p.Price || p.cena || '')) || 0,
      description: txt(p.description || p.opis || p.Description || p.desc || '').replace(/<[^>]+>/g, '').slice(0, 400),
      attrCount:   Object.keys(attrs).length,
      attrs,
      _rawIndex:   idx,
    };
  });

  return { products, _parsed: parsed, _productsKey: productsArr === parsed?.products?.product ? 'products.product'
    : productsArr === parsed?.offer?.products?.product ? 'offer.products.product'
    : productsArr === parsed?.root?.product ? 'root.product' : 'Products.Product' };
}

/**
 * Generate descriptions for selected products (by index) and rebuild XML.
 * selectedIndices: array of _rawIndex values
 */
async function generateShopGoldSelected(xmlBuffer, selectedIndices, aiService, onProgress, websiteUrl = null) {
  const xmlStr = xmlBuffer.toString('utf-8');
  let parsed;
  try {
    parsed = await parseStringPromise(xmlStr);
  } catch (e) {
    throw new Error('Nieprawidłowy plik XML: ' + e.message);
  }

  // Scrape website links if websiteUrl is provided
  let links = [];
  if (websiteUrl) {
    onProgress({ processed: 0, total: selectedIndices.length, currentName: 'Analizowanie strony WWW...' });
    links = await scrapeWebsiteLinks(websiteUrl);
  }

  let productsArr = null;
  if (parsed?.products?.product) productsArr = parsed.products.product;
  else if (parsed?.offer?.products?.product) productsArr = parsed.offer.products.product;
  else if (parsed?.root?.product) productsArr = parsed.root.product;
  else if (parsed?.Products?.Product) productsArr = parsed.Products.Product;

  if (!productsArr) throw new Error('Nie znaleziono produktów w XML.');

  const idxSet = new Set(selectedIndices.map(Number));
  const toProcess = productsArr.filter((_, i) => idxSet.has(i));
  const results = [];
  let errors = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i];
    const rawIdx = productsArr.indexOf(p);
    const name = txt(p.name || p.nazwa || p.Name || p.title || '');
    const desc = txt(p.description || p.opis || p.Description || p.desc || '').replace(/<[^>]+>/g, '').slice(0, 800);
    // BaseLinker/ShopGold używa manufacturer_name i category_name
    const category = txt(p.category_name || p.category || p.Category || p.kategoria || '');
    const producer = txt(p.manufacturer_name || p.producer || p.producent || p.manufacturer || p.brand || '');
    const attrs = extractAttrs(p);
    const attrsStr = Object.entries(attrs).map(([k,v]) => `${k}: ${v}`).join(', ').slice(0, 600);

    onProgress({ processed: i, total: toProcess.length, currentName: name });

    if (aiService && name) {
      try {
        const generated = await generateShopGoldCopy(name, producer, category, desc, attrsStr, aiService, links);
        const ldJsonStr = `<script type="application/ld+json">\n${JSON.stringify(generated.ldJson, null, 2)}\n</script>\n\n`;
        const fullDesc = ldJsonStr + generated.htmlDescription;

        if (p.description) p.description[0] = { _: fullDesc };
        else if (p.opis) p.opis[0] = { _: fullDesc };
        else p.description = [{ _: fullDesc }];

        results.push({ rawIndex: rawIdx, name, ean: txt(p.ean || ''), htmlDescription: generated.htmlDescription, ldJson: generated.ldJson });
      } catch (err) {
        errors++;
        console.error(`Błąd generowania dla ${name}:`, err.message);
        onProgress({ processed: i + 1, total: toProcess.length, name, error: err.message });
        results.push({ rawIndex: rawIdx, name, ean: txt(p.ean || ''), error: err.message });
        continue;
      }
    }

    onProgress({ processed: i + 1, total: toProcess.length, name });
  }

  onProgress({ processed: toProcess.length, total: toProcess.length, currentName: 'Kompilacja XML...' });

  // Filter products in parsed XML to only contain the processed/selected ones before building XML
  if (parsed?.products?.product) parsed.products.product = toProcess;
  else if (parsed?.offer?.products?.product) parsed.offer.products.product = toProcess;
  else if (parsed?.root?.product) parsed.root.product = toProcess;
  else if (parsed?.Products?.Product) parsed.Products.Product = toProcess;

  const builder = new Builder({ cdata: true });
  const updatedXml = builder.buildObject(parsed);

  return { xml: updatedXml, results, errors, processed: toProcess.length };
}

module.exports = { processShopGoldXml, parseShopGoldXml, generateShopGoldSelected, scrapeWebsiteLinks };

