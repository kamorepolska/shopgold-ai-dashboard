/**
 * Campaign Service v2 — AI Media Planner, Ad Generator, Optimizer
 */
const { complete, parseJsonResponse, getEffectiveProvider, getEffectiveModel } = require('./aiService');
const { productOps, campaignOps } = require('../models/localDb');
const { generateGoogleAdsCsv } = require('../adapters/csvAdapter');

const SYSTEM_PROMPT_ADS = `Jesteś ekspertem ds. performance marketingu i copywritingu reklamowego dla polskiego rynku e-commerce.
Twoje teksty są chwytliwe, skupione na korzyściach i przestrzegają zasad platform reklamowych.
Odpowiadaj WYŁĄCZNIE w JSON. Nie używaj gwiazdek ani markdown w treściach reklam.`;

const SYSTEM_PROMPT_STRATEGY = `Jesteś doświadczonym Performance Marketing Managerem i Media Plannerem dla polskiego rynku e-commerce.
Twoja wiedza obejmuje: Google Ads, Meta Ads (Facebook/Instagram), TikTok Ads oraz marketingową analizę danych.
Tworzysz kompleksowe, realistyczne strategie marketingowe oparte na celach biznesowych i budżetach.
Odpowiadaj WYŁĄCZNIE w JSON bez żadnego markdown. Wszystko po polsku.`;

const SYSTEM_PROMPT_OPTIMIZER = `Jesteś analitykiem kampanii reklamowych i ekspertem ds. optymalizacji ROI.
Analizujesz dane kampanii z Google Ads i Meta Ads i podajesz konkretne, actionable rekomendacje.
Skupiasz się na metrykach: ROAS, CPC, CTR, CPM, CPA. Odpowiadasz WYŁĄCZNIE w JSON po polsku.`;

// ─── STRATEGY GENERATOR ─────────────────────────────────────────────────────

async function generateStrategy({ goal, budget, industry, targetInfo, platforms, options = {} }) {
  const provider = options.provider || getEffectiveProvider();
  const model = options.model || getEffectiveModel(provider);

  const userPrompt = `Stwórz kompleksową strategię kampanii marketingowej dla polskiego sklepu e-commerce.

CEL KAMPANII: ${goal}
CAŁKOWITY BUDŻET: ${budget} PLN
BRANŻA/KATEGORIA: ${industry || 'e-commerce ogólny'}
DODATKOWE INFO O GRUPIE DOCELOWEJ: ${targetInfo || 'brak'}
PREFEROWANE PLATFORMY: ${platforms || 'wszystkie dostępne'}

Wygeneruj pełną strategię w formacie JSON:
{
  "strategy_summary": "Krótkie podsumowanie strategii (2-3 zdania)",
  "campaign_objective": "Przetłumaczony cel na język marketingowy",
  "target_audience": {
    "age_range": "np. 25-45",
    "gender": "np. Kobiety (60%) / Mężczyźni (40%)",
    "interests": ["zainteresowanie 1", "zainteresowanie 2", "zainteresowanie 3", "zainteresowanie 4", "zainteresowanie 5"],
    "behaviors": ["zachowanie 1", "zachowanie 2", "zachowanie 3"],
    "location": "np. Polska, miasta 50k+",
    "income_level": "np. Średnie-wyższe",
    "persona_description": "Opis idealnego klienta (2-3 zdania)"
  },
  "budget_allocation": [
    {
      "platform": "Google Ads",
      "percentage": 40,
      "amount": 0,
      "campaign_types": ["Search", "Performance Max"],
      "rationale": "Dlaczego ta platforma i taki podział"
    },
    {
      "platform": "Meta Ads (Facebook/Instagram)",
      "percentage": 35,
      "amount": 0,
      "campaign_types": ["Conversion", "Retargeting"],
      "rationale": "Uzasadnienie"
    },
    {
      "platform": "Remarketing (wszystkie kanały)",
      "percentage": 25,
      "amount": 0,
      "campaign_types": ["Dynamic Remarketing"],
      "rationale": "Uzasadnienie"
    }
  ],
  "timeline": {
    "phase1": {"name": "Faza 1: Testowa", "duration": "1-2 tygodnie", "description": "Opis działań"},
    "phase2": {"name": "Faza 2: Skalowanie", "duration": "3-6 tygodni", "description": "Opis działań"},
    "phase3": {"name": "Faza 3: Optymalizacja", "duration": "Ongoing", "description": "Opis działań"}
  },
  "kpis": [
    {"metric": "ROAS", "target": "np. min. 400%", "description": "Opis"},
    {"metric": "CPA", "target": "np. max. 35 PLN", "description": "Opis"},
    {"metric": "CTR", "target": "np. min. 2.5%", "description": "Opis"},
    {"metric": "Konwersje/mies.", "target": "np. min. 150", "description": "Opis"}
  ],
  "recommendations": [
    "Konkretna rekomendacja 1",
    "Konkretna rekomendacja 2",
    "Konkretna rekomendacja 3"
  ]
}

WAŻNE: W budget_allocation oblicz "amount" jako procent z budżetu ${budget} PLN.`;

  const result = await complete(SYSTEM_PROMPT_STRATEGY, userPrompt, { maxTokens: 3000, featureId: 'campaign_strategy' });
  const parsed = parseJsonResponse(result.text);

  // Calculate amounts from percentages
  for (const alloc of parsed.budget_allocation || []) {
    alloc.amount = Math.round((alloc.percentage / 100) * budget);
  }

  return { strategy: parsed, provider, model };
}

// ─── AD COPY GENERATOR (A/B Variants) ────────────────────────────────────────

async function generateAdCopy({ productIds, campaignName, platform, goal, targetAudience, options = {} }) {
  const products = productIds.map(id => productOps.findById(id)).filter(Boolean);
  if (!products.length) throw new Error('Nie znaleziono wybranych produktów w cache.');

  const provider = options.provider || getEffectiveProvider();
  const model = options.model || getEffectiveModel(provider);

  const productContext = products.map(p =>
    `ID: ${p.shop_id} | Nazwa: ${p.name} | Kategoria: ${p.category} | Cena: ${p.price} zł | Opis: ${(p.description || '').substring(0, 300)}`
  ).join('\n');

  let userPrompt = '';

  if (platform === 'google_ads') {
    userPrompt = `Wygeneruj treści Google Ads RSA z testami A/B dla produktów:

${productContext}

CEL KAMPANII: ${goal || 'sprzedaż'}
GRUPA DOCELOWA: ${targetAudience || 'ogólna'}

Dla każdego produktu wygeneruj 2 warianty A/B (A = skupiony na cenie/promocji, B = skupiony na emocjach/korzyściach).

Zwróć JSON:
{
  "platform": "google_ads",
  "campaignName": "${campaignName}",
  "ads": [
    {
      "productId": "id",
      "productName": "nazwa",
      "adGroup": "nazwa grupy reklam",
      "variants": [
        {
          "variant": "A",
          "focus": "cena i promocja",
          "headlines": ["nagłówek 1 (max 30 zn)", "nagłówek 2", "nagłówek 3", "nagłówek 4", "nagłówek 5"],
          "descriptions": ["opis 1 (max 90 zn)", "opis 2"],
          "keywords": ["słowo 1", "+słowo +2", "[dokładne]"]
        },
        {
          "variant": "B",
          "focus": "emocje i korzyści",
          "headlines": ["nagłówek 1", "nagłówek 2", "nagłówek 3", "nagłówek 4", "nagłówek 5"],
          "descriptions": ["opis 1", "opis 2"],
          "keywords": ["słowo 1", "+słowo +2", "[dokładne]"]
        }
      ]
    }
  ]
}`;
  } else {
    userPrompt = `Wygeneruj treści Facebook/Instagram Ads z testami A/B dla produktów:

${productContext}

CEL KAMPANII: ${goal || 'sprzedaż'}
GRUPA DOCELOWA: ${targetAudience || 'ogólna'}

Wariant A = skupiony na cenie/promocji/okazji
Wariant B = skupiony na emocjach, korzyściach, storytellingu

Zwróć JSON:
{
  "platform": "facebook_ads",
  "campaignName": "${campaignName}",
  "ads": [
    {
      "productId": "id",
      "productName": "nazwa",
      "variants": [
        {
          "variant": "A",
          "focus": "cena i promocja",
          "primary_text_short": "tekst max 125 zn",
          "primary_text_full": "pełny post max 500 zn z emoji",
          "headline": "nagłówek max 40 zn",
          "link_description": "opis max 30 zn",
          "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
          "cta": "SHOP_NOW"
        },
        {
          "variant": "B",
          "focus": "emocje i korzyści",
          "primary_text_short": "tekst max 125 zn",
          "primary_text_full": "pełny post z emoji i storytellingiem",
          "headline": "nagłówek emocjonalny max 40 zn",
          "link_description": "opis max 30 zn",
          "hashtags": ["#tag1", "#tag2", "#tag6", "#tag7"],
          "cta": "LEARN_MORE"
        }
      ]
    }
  ]
}`;
  }

  const result = await complete(SYSTEM_PROMPT_ADS, userPrompt, { maxTokens: 4096, featureId: 'campaign_ads' });
  const parsed = parseJsonResponse(result.text);

  // Clamp lengths
  for (const ad of parsed.ads || []) {
    for (const v of ad.variants || []) {
      if (v.headlines) v.headlines = v.headlines.map(h => String(h).substring(0, 30));
      if (v.descriptions) v.descriptions = v.descriptions.map(d => String(d).substring(0, 90));
      if (v.headline) v.headline = String(v.headline).substring(0, 40);
      if (v.link_description) v.link_description = String(v.link_description).substring(0, 30);
      if (v.primary_text_short) v.primary_text_short = String(v.primary_text_short).substring(0, 125);
    }
  }

  return { ads: parsed, provider, model };
}

// ─── AI OPTIMIZER ────────────────────────────────────────────────────────────

async function optimizeCampaign({ rawData, campaignName, platform, options = {} }) {
  const provider = options.provider || getEffectiveProvider();
  const model = options.model || getEffectiveModel(provider);

  const userPrompt = `Przeanalizuj surowe wyniki kampanii reklamowej i podaj konkretne rekomendacje optymalizacyjne.

NAZWA KAMPANII: ${campaignName || 'Kampania'}
PLATFORMA: ${platform || 'mieszana'}

SUROWE DANE Z PLATFORMY:
${rawData}

Zwróć analizę w JSON:
{
  "overall_assessment": "Ogólna ocena kampanii (1 zdanie)",
  "performance_score": 75,
  "key_findings": [
    {"type": "positive", "finding": "Co działa dobrze"},
    {"type": "negative", "finding": "Co wymaga poprawy"},
    {"type": "neutral", "finding": "Obserwacja"}
  ],
  "recommendations": [
    {
      "priority": "high",
      "action": "Konkretna akcja do podjęcia",
      "reason": "Dlaczego",
      "expected_impact": "Oczekiwany efekt"
    },
    {
      "priority": "medium",
      "action": "Akcja 2",
      "reason": "Dlaczego",
      "expected_impact": "Efekt"
    },
    {
      "priority": "low",
      "action": "Akcja 3",
      "reason": "Dlaczego",
      "expected_impact": "Efekt"
    }
  ],
  "ab_test_winner": {
    "winner": "A lub B lub brak danych",
    "confidence": "np. 85%",
    "recommendation": "Co dalej zrobić z A/B testem"
  },
  "budget_suggestion": "Konkretna sugestia dot. budżetu",
  "next_steps": ["krok 1", "krok 2", "krok 3"]
}`;

  const result = await complete(SYSTEM_PROMPT_OPTIMIZER, userPrompt, { maxTokens: 2500, featureId: 'campaign_optimizer' });
  return { analysis: parseJsonResponse(result.text), provider, model };
}

// ─── LEGACY FUNCTIONS (backward compatibility) ────────────────────────────────

async function generateGoogleAds(productIds, campaignName, options = {}) {
  const products = productIds.map(id => productOps.findById(id)).filter(Boolean);
  if (!products.length) throw new Error('Nie znaleziono wybranych produktów w cache.');
  const provider = options.provider || getEffectiveProvider();
  const model = options.model || getEffectiveModel(provider);
  const productList = products.map(p =>
    `- ID: ${p.shop_id} | Nazwa: ${p.name} | Kategoria: ${p.category} | Cena: ${p.price} zł`
  ).join('\n');
  const userPrompt = `Wygeneruj treści reklamowe Google Ads RSA dla produktów:\n${productList}\n\nZwróć JSON:\n{"campaignName":"${campaignName}","ads":[{"productId":"id","productName":"nazwa","adGroup":"Ad Group","headlines":["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15"],"descriptions":["d1","d2","d3","d4"],"keywords":["kw1","kw2"]}]}`;
  const result = await complete(SYSTEM_PROMPT_ADS, userPrompt, { maxTokens: 4096, featureId: 'campaign_ads' });
  const parsed = parseJsonResponse(result.text);
  for (const ad of parsed.ads || []) {
    ad.headlines = (ad.headlines || []).slice(0, 15).map(h => String(h).substring(0, 30));
    ad.descriptions = (ad.descriptions || []).slice(0, 4).map(d => String(d).substring(0, 90));
    ad.keywords = (ad.keywords || []).slice(0, 20);
  }
  return parsed;
}

async function generateFacebookAds(productIds, campaignName, options = {}) {
  const products = productIds.map(id => productOps.findById(id)).filter(Boolean);
  if (!products.length) throw new Error('Nie znaleziono wybranych produktów w cache.');
  const provider = options.provider || getEffectiveProvider();
  const model = options.model || getEffectiveModel(provider);
  const productList = products.map(p =>
    `- ${p.name} | ${p.category} | ${p.price} zł | Opis: ${(p.description || '').substring(0, 200)}`
  ).join('\n');
  const userPrompt = `Wygeneruj treści Facebook/Instagram Ads z wariantami A/B:\n${productList}\n\nZwróć JSON:\n{"campaignName":"${campaignName}","ads":[{"productId":"id","productName":"nazwa","variants":[{"variant":"A","primary_text_short":"tekst","primary_text_full":"pełny tekst","headline":"nagłówek","link_description":"opis","hashtags":["#tag"],"cta":"SHOP_NOW"},{"variant":"B","primary_text_short":"alt","primary_text_full":"alt pełny","headline":"alt nagłówek","link_description":"alt opis","hashtags":["#tag2"],"cta":"LEARN_MORE"}]}]}`;
  const result = await complete(SYSTEM_PROMPT_ADS, userPrompt, { maxTokens: 4096, featureId: 'campaign_ads' });
  const parsed = parseJsonResponse(result.text);
  for (const ad of parsed.ads || []) {
    for (const v of ad.variants || []) {
      v.headline = (v.headline || '').substring(0, 40);
      v.link_description = (v.link_description || '').substring(0, 30);
      v.primary_text_short = (v.primary_text_short || '').substring(0, 125);
    }
  }
  return parsed;
}

async function createCampaign(productIds, campaignName, type, options = {}) {
  let content;
  if (type === 'google_ads') content = await generateGoogleAds(productIds, campaignName, options);
  else if (type === 'facebook_ads') content = await generateFacebookAds(productIds, campaignName, options);
  else throw new Error(`Nieznany typ kampanii: ${type}`);
  const id = campaignOps.create({ name: campaignName, type, product_ids: productIds, generated_content: content });
  return { id, content };
}

function exportCampaign(campaign, format) {
  const content = campaign.generated_content;
  if (format === 'json') return { contentType: 'application/json', filename: `kampania_${campaign.id}.json`, data: JSON.stringify(content, null, 2) };
  if (format === 'csv' && campaign.type === 'google_ads') return { contentType: 'text/csv', filename: `google_ads_${campaign.id}.csv`, data: generateGoogleAdsCsv(content) };
  if (format === 'txt') {
    let text = `KAMPANIA: ${content.campaignName}\nTyp: ${campaign.type}\nData: ${campaign.created_at}\n\n${'='.repeat(60)}\n\n`;
    for (const ad of content.ads || []) {
      text += `PRODUKT: ${ad.productName}\n${'-'.repeat(40)}\n`;
      if (ad.headlines) { text += 'NAGŁÓWKI:\n'; (ad.headlines || []).forEach((h, i) => { text += `  ${i + 1}. ${h}\n`; }); text += '\nOPISY:\n'; (ad.descriptions || []).forEach((d, i) => { text += `  ${i + 1}. ${d}\n`; }); text += '\nSŁOWA KLUCZOWE:\n'; (ad.keywords || []).forEach(k => { text += `  - ${k}\n`; }); }
      if (ad.variants) { for (const v of ad.variants) { text += `\nWARIANT ${v.variant}:\n  Primary: ${v.primary_text_full}\n  Nagłówek: ${v.headline}\n  CTA: ${v.cta}\n  Hashtagi: ${(v.hashtags || []).join(' ')}\n`; } }
      text += '\n';
    }
    return { contentType: 'text/plain', filename: `kampania_${campaign.id}.txt`, data: text };
  }
  throw new Error(`Nieznany format eksportu: ${format}`);
}

module.exports = { generateGoogleAds, generateFacebookAds, createCampaign, exportCampaign, generateStrategy, generateAdCopy, optimizeCampaign };

