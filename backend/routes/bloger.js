'use strict';
const express = require('express');
const router = express.Router();
const { blogPostOps, productOps } = require('../models/localDb');
const owui = require('../services/openwebuiService');
const aiService = require('../services/aiService');

// ─── CRUD ────────────────────────────────────────────────────────────────────────

// GET /api/bloger/posts — list articles
router.get('/posts', (req, res) => {
  try {
    const { status = '', search = '', limit = 50, offset = 0 } = req.query;
    const posts = blogPostOps.findAll({ status, search, limit: parseInt(limit), offset: parseInt(offset) });
    const total = blogPostOps.count({ status, search });
    res.json({ posts, total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/bloger/posts — create new post
router.post('/posts', (req, res) => {
  try {
    const id = blogPostOps.create(req.body);
    const post = blogPostOps.findById(id);
    res.json({ success: true, id, post });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/bloger/posts/:id — get single post
router.get('/posts/:id', (req, res) => {
  try {
    const post = blogPostOps.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Artykuł nie znaleziony' });
    res.json(post);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/bloger/posts/:id — update post
router.patch('/posts/:id', (req, res) => {
  try {
    const post = blogPostOps.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Artykuł nie znaleziony' });
    blogPostOps.update(req.params.id, req.body);
    res.json({ success: true, post: blogPostOps.findById(req.params.id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/bloger/posts/:id — delete post
router.delete('/posts/:id', (req, res) => {
  try {
    blogPostOps.delete(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Product Search (from local cache) ───────────────────────────────────────────

router.get('/products/search', (req, res) => {
  try {
    const { q = '', category = '', limit = 30 } = req.query;
    const products = productOps.findAll({ search: q, category, limit: parseInt(limit), offset: 0 });
    res.json({ products: products.map(p => ({ id: p.id, shop_id: p.shop_id, name: p.name, category: p.category, price: p.price })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/products/categories', (req, res) => {
  try {
    res.json({ categories: productOps.categories() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── AI Article Generation & Analysis ──────────────────────────────────────────────

router.post('/analyze-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Brak URL do analizy.' });

    const axios = require('axios');
    const cheerio = require('cheerio');
    
    // Fetch the HTML
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
    const html = response.data;
    const $ = cheerio.load(html);

    // Extract meta title and description
    const metaTitle = $('title').text() || '';
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    
    // Try to extract main content
    // Fallback order: <article>, main content blocks, or body text
    let contentHtml = '';
    
    // If the user specifies a specific class in the future we can use it here
    if ($('article').length > 0) {
      contentHtml = $('article').html();
    } else if ($('.blog-content').length > 0) {
      contentHtml = $('.blog-content').html();
    } else if ($('.post-content').length > 0) {
      contentHtml = $('.post-content').html();
    } else if ($('main').length > 0) {
      contentHtml = $('main').html();
    } else {
      // Fallback: extract all headers and paragraphs
      contentHtml = $('body').find('h1, h2, h3, p, ul, ol').map((i, el) => $.html(el)).get().join('\n');
    }

    if (!contentHtml) {
      return res.status(400).json({ error: 'Nie udało się wyodrębnić treści z tego adresu URL.' });
    }
    
    // Basic cleanup of extracted HTML (remove scripts, styles, iframes)
    const $content = cheerio.load(contentHtml);
    $content('script, style, iframe, nav, footer, .sidebar').remove();
    
    const cleanHtml = $content.html();

    res.json({
      html: cleanHtml,
      metaTitle: metaTitle.trim(),
      metaDescription: metaDescription.trim()
    });

  } catch (e) {
    console.error('[BLOGER] Analyze URL error:', e.message);
    res.status(500).json({ error: 'Błąd podczas pobierania artykułu: ' + e.message });
  }
});


router.post('/generate', async (req, res) => {
  try {
    const {
      products = [],        // [{ name, url, price }]
      category = '',
      customService = '',
      focusKeyword = '',
      storeUrl = '',
      sourceUrl = '',
      model = '',
      useOwui = false,
      tone = 'expert',      // expert | friendly | sales
      articleLength = 'long' // short (~600w) | medium (~1000w) | long (~1500w)
    } = req.body;

    if (!focusKeyword && !category && !customService && !products.length) {
      return res.status(400).json({ error: 'Podaj frazę kluczową, produkty lub kategorię.' });
    }

    const wordTarget = { short: 600, medium: 1000, long: 1500 }[articleLength] || 1200;
    const toneDesc = {
      expert: 'ekspercki i autorytatywny — pisz jak specjalista branżowy',
      friendly: 'przyjazny i przystępny — pisz jak doradca klienta',
      sales: 'sprzedażowy i perswazyjny — nastawiaj na konwersję i CTA'
    }[tone] || 'ekspercki';

    // Build product links context
    let productContext = '';
    if (products.length > 0) {
      productContext = products.map((p, i) => {
        const fullUrl = p.url ? (p.url.startsWith('http') ? p.url : `${storeUrl}${p.url}`) : '';
        return `${i + 1}. "${p.name}"${fullUrl ? ` — URL: ${fullUrl}` : ''}${p.price ? ` — Cena: ${p.price} zł` : ''}`;
      }).join('\n');
    }

    // Source URL instruction
    let sourceInstruction = '';
    if (sourceUrl) {
      sourceInstruction = `\n\nINSPIRACJA: Czerp merytoryczną wiedzę i fakty z tej strony: ${sourceUrl}. NIE kopiuj treści dosłownie — przetwórz informacje własnymi słowami i wzbogać o unikalne spostrzeżenia.`;
    }

    const systemPrompt = `Jesteś ekspertem ds. Content Marketingu i SEO z 10-letnim doświadczeniem w pisaniu artykułów blogowych dla polskich sklepów internetowych.

ZASADY GENEROWANIA:
1. Pisz WYŁĄCZNIE w języku polskim.
2. Ton komunikacji: ${toneDesc}.
3. Tekst musi mieć około ${wordTarget} słów.
4. Odpowiedź MUSI być w formacie JSON z kluczami: html, metaTitle, metaDescription, slug.
5. Pole "html" zawiera CZYSTY KOD HTML artykułu z tagami: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>.
6. NIE używaj znaczników markdown. NIE opakowuj HTML w code blocks.
7. Artykuł MUSI zawierać dokładnie JEDEN tag <h1> na początku.
8. Użyj minimum 3 nagłówków <h2> i 2 nagłówków <h3>.
9. Pierwszy akapit <p> po <h1> musi zawierać główną frazę kluczową.
10. Keyword Density (zagęszczenie frazy kluczowej) powinno wynosić 1.5-2.5% w całym tekście.
11. Meta Title: max 60 znaków, zawiera frazę kluczową.
12. Meta Description: max 155 znaków, zachęca do kliknięcia, zawiera CTA.
13. Slug: przyjazny URL w formie "fraza-kluczowa-temat" (małe litery, myślniki, bez polskich znaków).`;

    let userPrompt = `GŁÓWNA FRAZA KLUCZOWA: "${focusKeyword || category || customService}"
${category ? `\nKATEGORIA PRODUKTÓW: ${category}` : ''}
${customService ? `\nUSŁUGA/TEMAT: ${customService}` : ''}`;

    if (productContext) {
      userPrompt += `\n\nPRODUKTY DO WPLECENIA W ARTYKUŁ (SMART LINK BUILDING):
Poniższe produkty MUSISZ naturalnie wpleść w treść artykułu jako linki wewnętrzne.
Użyj ich nazw jako naturalnych kotwic (anchor text) z tagami <a href="URL">Nazwa produktu</a>.
Linki powinny być organicznie wplecione w kontekst artykułu — NIE rób listy linków na końcu.

${productContext}`;
    }

    if (storeUrl) {
      userPrompt += `\n\nADRES SKLEPU: ${storeUrl}`;
    }

    userPrompt += sourceInstruction;

    userPrompt += `\n\nZwróć odpowiedź WYŁĄCZNIE jako JSON:
{
  "html": "<h1>Tytuł artykułu z frazą kluczową</h1><p>Wstęp z frazą kluczową...</p><h2>...</h2>...",
  "metaTitle": "Meta Title (max 60 znaków)",
  "metaDescription": "Meta Description (max 155 znaków)",
  "slug": "fraza-kluczowa-temat"
}`;

    // Use built-in AI Service (which now handles OWUI natively)
    const result = await aiService.complete(systemPrompt, userPrompt, {
      model: model || undefined,
      provider: useOwui ? 'owui' : undefined,
      maxTokens: 8192,
      temperature: 0.7,
      skipBrandKb: false,
      featureId: 'blog_draft'
    });

    // Parse the AI response
    let parsed;
    try {
      parsed = aiService.parseJsonResponse(result.text);
    } catch (parseErr) {
      // If JSON parsing fails, try to extract HTML directly
      const htmlMatch = result.text.match(/<h1[\s>][\s\S]*$/i);
      if (htmlMatch) {
        parsed = {
          html: htmlMatch[0],
          metaTitle: focusKeyword,
          metaDescription: '',
          slug: slugify(focusKeyword),
        };
      } else {
        throw new Error('AI nie zwróciło prawidłowego formatu. Spróbuj ponownie.');
      }
    }

    // Calculate word count
    const plainText = (parsed.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;

    // Calculate SEO score
    const seoScore = calculateSeoScore(parsed.html || '', focusKeyword, parsed.metaTitle, parsed.metaDescription);

    res.json({
      html: parsed.html || '',
      metaTitle: parsed.metaTitle || '',
      metaDescription: parsed.metaDescription || '',
      slug: parsed.slug || slugify(focusKeyword),
      wordCount,
      seoScore,
      provider: result.provider,
      model: result.model,
    });
  } catch (e) {
    console.error('[BLOGER] Generate error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

function calculateSeoScore(html, focusKeyword, metaTitle, metaDescription) {
  if (!focusKeyword) return 0;
  let score = 0;
  const kw = focusKeyword.toLowerCase();
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // 1. Keyword in H1 (15 pts)
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1].toLowerCase().includes(kw)) score += 15;

  // 2. Keyword in first paragraph (10 pts)
  const firstP = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (firstP && firstP[1].toLowerCase().includes(kw)) score += 10;

  // 3. Keyword density 1-3% (15 pts)
  if (wordCount > 0) {
    const kwWords = kw.split(/\s+/).length;
    let kwCount = 0;
    for (let i = 0; i <= words.length - kwWords; i++) {
      if (words.slice(i, i + kwWords).join(' ').includes(kw)) kwCount++;
    }
    const density = (kwCount / wordCount) * 100;
    if (density >= 1 && density <= 3) score += 15;
    else if (density > 0 && density < 1) score += 8;
    else if (density > 3 && density <= 5) score += 5;
  }

  // 4. Internal links present (15 pts)
  const links = (html.match(/<a\s[^>]*href/gi) || []).length;
  if (links >= 3) score += 15;
  else if (links >= 1) score += 8;

  // 5. Word count >= 800 (10 pts)
  if (wordCount >= 1200) score += 10;
  else if (wordCount >= 800) score += 7;
  else if (wordCount >= 500) score += 4;

  // 6. H2/H3 headings (10 pts)
  const h2Count = (html.match(/<h2/gi) || []).length;
  const h3Count = (html.match(/<h3/gi) || []).length;
  if (h2Count >= 3 && h3Count >= 2) score += 10;
  else if (h2Count >= 2) score += 6;
  else if (h2Count >= 1) score += 3;

  // 7. Meta Title (10 pts)
  if (metaTitle) {
    const mtl = metaTitle.length;
    if (mtl > 0 && mtl <= 60 && metaTitle.toLowerCase().includes(kw)) score += 10;
    else if (mtl > 0 && mtl <= 70) score += 5;
  }

  // 8. Meta Description (10 pts)
  if (metaDescription) {
    const mdl = metaDescription.length;
    if (mdl > 0 && mdl <= 155) score += 10;
    else if (mdl > 0 && mdl <= 200) score += 5;
  }

  // 9. Lists present (5 pts)
  if (/<ul|<ol/i.test(html)) score += 5;

  return Math.min(score, 100);
}

module.exports = router;
