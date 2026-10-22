/**
 * routes/seo.js — API dla modułu SEO i Pozycjonowanie
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { brandKbOps, seoKeywordOps, backlinkOps, auditLogOps } = require('../models/localDb');
const { complete, parseJsonResponse } = require('../services/aiService');
const { checkAllBacklinks } = require('../services/backlinkChecker');

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ShopGoldSEOBot/1.0)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.7',
};

// ===========================
// BRAND KNOWLEDGE BASE
// ===========================

// GET /api/seo/brand
router.get('/brand', (req, res) => {
  try {
    res.json(brandKbOps.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seo/brand
router.post('/brand', (req, res) => {
  try {
    const allowed = ['brand_name', 'tone_of_voice', 'target_audience', 'brand_values', 'excluded_words', 'extra_context'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) brandKbOps.set(key, req.body[key]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// URL AUDITOR (Technical SEO)
// ===========================

// POST /api/seo/audit-url
router.post('/audit-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Brak URL' });
  try {
    const { data: html, status: httpStatus } = await axios.get(url, {
      timeout: 20000,
      headers: FETCH_HEADERS,
      maxRedirects: 5,
    });
    const $ = cheerio.load(html);
    const results = {};

    // --- Title ---
    const title = $('title').first().text().trim();
    const titleLen = title.length;
    results.title = {
      value: title,
      length: titleLen,
      status: titleLen === 0 ? 'missing' : titleLen > 60 ? 'too_long' : titleLen < 30 ? 'too_short' : 'ok',
      hint: titleLen === 0 ? 'Brak meta title!' : titleLen > 60 ? `Za długi (${titleLen} zn., max 60)` : titleLen < 30 ? `Za krótki (${titleLen} zn., min 30)` : `OK (${titleLen} zn.)`
    };

    // --- Meta Description ---
    const desc = $('meta[name="description"]').attr('content') || '';
    const descLen = desc.length;
    results.meta_description = {
      value: desc,
      length: descLen,
      status: descLen === 0 ? 'missing' : descLen > 160 ? 'too_long' : descLen < 70 ? 'too_short' : 'ok',
      hint: descLen === 0 ? 'Brak meta description!' : descLen > 160 ? `Za długi (${descLen} zn., max 160)` : descLen < 70 ? `Za krótki (${descLen} zn., min 70)` : `OK (${descLen} zn.)`
    };

    // --- H1 ---
    const h1s = $('h1').map((_, el) => $(el).text().trim()).get();
    results.h1 = {
      count: h1s.length,
      values: h1s,
      status: h1s.length === 0 ? 'missing' : h1s.length > 1 ? 'multiple' : 'ok',
      hint: h1s.length === 0 ? 'Brak H1!' : h1s.length > 1 ? `Wiele H1 (${h1s.length}) — zostaw tylko jeden` : `OK: "${h1s[0]}"`
    };

    // --- Headings structure ---
    const headings = { h2: [], h3: [], h4: [] };
    ['h2', 'h3', 'h4'].forEach(tag => {
      $(tag).each((_, el) => headings[tag].push($(el).text().trim().substring(0, 80)));
    });
    results.headings = headings;

    // --- Images without alt ---
    const imgs = $('img');
    const imgTotal = imgs.length;
    const imgNoAlt = imgs.filter((_, el) => !$(el).attr('alt') || $(el).attr('alt').trim() === '').length;
    results.images = {
      total: imgTotal,
      without_alt: imgNoAlt,
      status: imgNoAlt === 0 ? 'ok' : 'warning',
      hint: imgNoAlt === 0 ? `Wszystkie ${imgTotal} obrazy mają alt` : `${imgNoAlt} z ${imgTotal} obrazów bez alt-tekstu`
    };

    // --- Canonical ---
    const canonical = $('link[rel="canonical"]').attr('href') || '';
    results.canonical = {
      value: canonical,
      status: canonical ? 'ok' : 'missing',
      hint: canonical ? `Canonical: ${canonical}` : 'Brak tagu canonical'
    };

    // --- Schema.org / JSON-LD ---
    const jsonLdScripts = $('script[type="application/ld+json"]').length;
    results.structured_data = {
      count: jsonLdScripts,
      status: jsonLdScripts > 0 ? 'ok' : 'missing',
      hint: jsonLdScripts > 0 ? `${jsonLdScripts} blok(ów) JSON-LD` : 'Brak danych strukturalnych JSON-LD'
    };

    // --- Keyword density (basic) ---
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    results.word_count = { value: bodyText.split(' ').filter(Boolean).length };

    // --- Open Graph ---
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    results.open_graph = {
      title: ogTitle,
      description: ogDesc,
      image: ogImage,
      status: (ogTitle && ogDesc && ogImage) ? 'ok' : 'incomplete',
      hint: (ogTitle && ogDesc && ogImage) ? 'Open Graph kompletny' : 'Niekompletny Open Graph (brakuje: ' + [!ogTitle && 'og:title', !ogDesc && 'og:description', !ogImage && 'og:image'].filter(Boolean).join(', ') + ')'
    };

    // --- Score calculation ---
    let score = 100;
    if (results.title.status !== 'ok') score -= 20;
    if (results.meta_description.status !== 'ok') score -= 20;
    if (results.h1.status !== 'ok') score -= 15;
    if (results.images.without_alt > 0) score -= Math.min(10, results.images.without_alt * 2);
    if (results.canonical.status === 'missing') score -= 10;
    if (results.structured_data.status === 'missing') score -= 10;
    if (results.open_graph.status === 'incomplete') score -= 10;
    score = Math.max(0, score);

    results.http_status = httpStatus;
    auditLogOps.add({ url, score, results });
    res.json({ url, score, results });
  } catch (err) {
    res.status(500).json({ error: `Nie można pobrać URL: ${err.message}` });
  }
});

// ===========================
// SERP ANALYZER (AI)
// ===========================

// POST /api/seo/analyze-serp
router.post('/analyze-serp', async (req, res) => {
  const { keyword, url } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Brak słowa kluczowego' });
  try {
    const systemPrompt = `Jesteś ekspertem SEO specjalizującym się w polskim e-commerce. 
Analizujesz słowa kluczowe i planujesz strukturę treści zoptymalizowanej pod Google.
Zawsze odpowiadaj w języku polskim. Zwracaj WYŁĄCZNIE czysty JSON.`;

    const userPrompt = `Przeprowadź analizę SEO dla frazy: "${keyword}"
${url ? `URL strony produktowej: ${url}` : ''}

Zwróć JSON o strukturze:
{
  "keyword_analysis": {
    "intent": "informational|navigational|transactional|commercial",
    "difficulty": "low|medium|high",
    "recommended_volume_tier": "niche|medium|high",
    "description": "krótki opis intencji użytkownika"
  },
  "content_structure": {
    "recommended_h1": "propozycja H1",
    "sections": [
      { "h2": "Tytuł sekcji", "description": "co powinno zawierać", "target_length": "100-200 słów" }
    ]
  },
  "lsi_keywords": [
    { "phrase": "fraza LSI", "usage_tip": "jak użyć" }
  ],
  "meta_suggestions": {
    "title": "propozycja meta title (max 60 zn.)",
    "description": "propozycja meta description (max 155 zn.)"
  },
  "quick_tips": ["wskazówka 1", "wskazówka 2", "wskazówka 3"]
}`;

    const { text } = await complete(systemPrompt, userPrompt, { temperature: 0.6, featureId: 'seo_analyzer' });
    const data = parseJsonResponse(text);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// META GENERATOR (AI)
// ===========================

// POST /api/seo/generate-meta
router.post('/generate-meta', async (req, res) => {
  const { keyword, product_name, category, current_description } = req.body;
  if (!keyword && !product_name) return res.status(400).json({ error: 'Podaj keyword lub nazwę produktu' });
  try {
    const systemPrompt = `Jesteś ekspertem ds. SEO i copywritingu e-commerce. 
Tworzysz meta title i meta description perfekcyjnie zoptymalizowane pod kątem CTR i pozycjonowania.
Zawsze odpowiadaj w języku polskim. Zwracaj WYŁĄCZNIE czysty JSON.`;

    const userPrompt = `Wygeneruj Meta Title i Meta Description dla:
Produkt: ${product_name || keyword}
Kategoria: ${category || 'e-commerce'}
Słowo kluczowe: ${keyword || product_name}
${current_description ? `Obecny opis: ${current_description.substring(0, 300)}` : ''}

ZASADY:
- Meta Title: max 60 znaków, zawiera główne słowo kluczowe, brand na końcu (oddzielony " | ")
- Meta Description: max 155 znaków, zawiera CTA, zachęca do kliknięcia, naturalne słowa kluczowe
- Wygeneruj 3 warianty każdego

Zwróć JSON:
{
  "meta_titles": [
    { "text": "...", "length": 55, "keyword_included": true },
    { "text": "...", "length": 58, "keyword_included": true },
    { "text": "...", "length": 60, "keyword_included": true }
  ],
  "meta_descriptions": [
    { "text": "...", "length": 145, "has_cta": true },
    { "text": "...", "length": 153, "has_cta": true },
    { "text": "...", "length": 155, "has_cta": true }
  ]
}`;

    const { text } = await complete(systemPrompt, userPrompt, { temperature: 0.75, featureId: 'seo_meta' });
    const data = parseJsonResponse(text);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// CONTENT WRITER (AI)
// ===========================

// POST /api/seo/generate-content
router.post('/generate-content', async (req, res) => {
  const { keyword, product_name, category, attributes, price } = req.body;
  if (!product_name) return res.status(400).json({ error: 'Podaj nazwę produktu' });
  try {
    const systemPrompt = `Jesteś Senior Copywriterem e-commerce specjalizującym się w SEO. 
Tworzysz unikalne, angażujące opisy produktów w architekturze blokowej: akapit + nagłówki H2.
Pisz zawsze po polsku. Unikaj ogólników. Zwracaj WYŁĄCZNIE czysty JSON.`;

    const userPrompt = `Napisz opis produktu dla:
Nazwa: ${product_name}
Kategoria: ${category || 'e-commerce'}
Słowa kluczowe: ${keyword || product_name}
${attributes ? `Parametry: ${JSON.stringify(attributes)}` : ''}
${price ? `Cena: ${price} zł` : ''}

Architektura blokowa:
1. Akapit wprowadzający (główna korzyść + słowo kluczowe)
2-4. Sekcje H2 (cechy, zastosowania, specyfikacja)
5. Akapit zamykający z CTA

Zwróć JSON:
{
  "intro": "Akapit wprowadzający (min 100 zn.)",
  "blocks": [
    { "h2": "Tytuł sekcji H2", "content": "Treść akapitu (min 80 zn.)" }
  ],
  "outro": "Akapit zamykający z CTA",
  "keywords_used": ["słowo 1", "słowo 2"],
  "total_chars": 1200
}`;

    const { text } = await complete(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 3000, featureId: 'seo_content' });
    const data = parseJsonResponse(text);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// KEYWORD RANK TRACKER
// ===========================

// GET /api/seo/keywords
router.get('/keywords', (req, res) => {
  try {
    res.json({ keywords: seoKeywordOps.findAll() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seo/keywords
router.post('/keywords', (req, res) => {
  try {
    const { keyword, url, position, volume } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Brak słowa kluczowego' });
    const id = seoKeywordOps.add({ keyword, url, position: position || 0, volume: volume || 0 });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/seo/keywords/:id
router.patch('/keywords/:id', (req, res) => {
  try {
    const { position, volume } = req.body;
    seoKeywordOps.update(req.params.id, { position: position || 0, volume: volume || 0 });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/seo/keywords/:id
router.delete('/keywords/:id', (req, res) => {
  try {
    seoKeywordOps.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// BACKLINK TRACKER
// ===========================

// GET /api/seo/backlinks
router.get('/backlinks', (req, res) => {
  try {
    res.json({ backlinks: backlinkOps.findAll() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seo/backlinks
router.post('/backlinks', (req, res) => {
  try {
    const { source_url, target_url, anchor, cost, type } = req.body;
    if (!source_url || !target_url) return res.status(400).json({ error: 'Podaj source_url i target_url' });
    const id = backlinkOps.add({ source_url, target_url, anchor, cost: cost || 0, type: type || 'dofollow' });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/seo/backlinks/:id
router.delete('/backlinks/:id', (req, res) => {
  try {
    backlinkOps.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seo/backlinks/check — manual trigger
router.post('/backlinks/check', async (req, res) => {
  try {
    const results = await checkAllBacklinks();
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/seo/audit-history
router.get('/audit-history', (req, res) => {
  try {
    res.json({ history: auditLogOps.findRecent(10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
