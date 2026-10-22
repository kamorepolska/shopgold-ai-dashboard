/**
 * AI Service — abstrakcja nad OpenAI i Google Gemini API
 * Zapewnia jednolity interfejs niezależnie od wybranego dostawcy
 */
const config = require('../config');
const { settingsOps } = require('../models/localDb');

// Lazy-load clients to avoid errors if keys not set
let openaiClient = null;
let geminiClient = null;

function getOpenAI() {
  if (!openaiClient) {
    const { OpenAI } = require('openai');
    const key = getEffectiveKey('openai') || 'sk-none'; // Fallback for local proxies that don't need a key
    const baseURL = settingsOps.get('openai_base_url') || undefined;
    
    openaiClient = new OpenAI({ 
      apiKey: key,
      baseURL: baseURL
    });
  }
  return openaiClient;
}

let owuiClient = null;
function getOwui() {
  if (!owuiClient) {
    const { OpenAI } = require('openai');
    const baseURL = settingsOps.get('owui_url') ? settingsOps.get('owui_url').replace(/\/+$/, '') + '/api' : undefined;
    const key = settingsOps.get('owui_api_key') || 'sk-none';
    if (!baseURL) throw new Error('Brak adresu Open WebUI. Skonfiguruj go w Ustawieniach.');
    owuiClient = new OpenAI({ 
      apiKey: key,
      baseURL: baseURL
    });
  }
  return owuiClient;
}

function getGemini() {
  if (!geminiClient) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const key = getEffectiveKey('gemini');
    if (!key) throw new Error('Brak klucza Gemini API. Skonfiguruj go w Ustawieniach.');
    geminiClient = new GoogleGenerativeAI(key);
  }
  return geminiClient;
}

function getEffectiveKey(provider) {
  // Settings DB overrides .env
  const dbKey = settingsOps.get(`${provider}_api_key`);
  if (dbKey) return dbKey;
  return provider === 'openai' ? config.ai.openai.apiKey : config.ai.gemini.apiKey;
}

function getEffectiveProvider() {
  return settingsOps.get('ai_provider') || config.ai.provider || 'openai';
}

function getEffectiveModel(provider, featureId) {
  if (featureId) {
    const mappedModel = settingsOps.get(`ai_map_${featureId}`);
    if (mappedModel) return mappedModel;
  }
  
  const dbModel = settingsOps.get(`${provider}_model`);
  if (dbModel) return dbModel;
  
  if (provider === 'owui') return 'gemma4:e4b';
  if (provider === 'openai') return config.ai.openai.model;
  if (provider === 'gemini') return config.ai.gemini.model;
  return '';
}

function detectProviderForModel(model, defaultProvider) {
  if (!model) return defaultProvider;
  const mLower = model.toLowerCase();
  
  // If model contains a colon (local ollama models usually do, e.g. gemma4:e4b)
  // or starts with typical local model prefixes
  if (model.includes(':') || mLower.startsWith('gemma') || mLower.startsWith('llama') || mLower.startsWith('qwen') || mLower.startsWith('phi') || mLower.startsWith('ollama/')) {
    return 'owui';
  }
  
  if (mLower.startsWith('gemini-')) return 'gemini';
  if (mLower.startsWith('gpt-') || mLower.startsWith('o1-') || mLower.startsWith('o3-') || mLower.startsWith('text-davinci-')) return 'openai';
  if (mLower.startsWith('claude-')) return 'anthropic';
  if (mLower.startsWith('deepseek-')) return 'deepseek';
  
  return defaultProvider;
}

/**
 * Main completion function — routes to correct provider
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} options - { provider, model, temperature, maxTokens }
 * @returns {Promise<{text: string, usage: object, provider: string, model: string}>}
 */
async function complete(systemPrompt, userPrompt, options = {}) {
  let provider = options.provider || getEffectiveProvider();
  
  let model = options.model;
  if (!model) {
    const mappedModel = options.featureId ? settingsOps.get(`ai_map_${options.featureId}`) : null;
    if (mappedModel && options.provider) {
      const detected = detectProviderForModel(mappedModel, options.provider);
      if (detected === options.provider) {
        model = mappedModel;
      } else {
        model = getEffectiveModel(provider, null);
      }
    } else {
      model = getEffectiveModel(provider, options.featureId);
    }
  }
  
  // Dynamically determine the provider based on the model name
  provider = detectProviderForModel(model, provider);
  
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 8192;

  // === Brand Knowledge Injection ===
  // Automatically prepend brand identity to every system prompt (unless disabled)
  if (!options.skipBrandKb) {
    try {
      const { brandKbOps } = require('../models/localDb');
      const brandBlock = brandKbOps.buildPromptBlock();
      if (brandBlock) {
        systemPrompt = `=== TOŻSAMOŚĆ I WYTYCZNE MARKI ===\n${brandBlock}\n\n=== INSTRUKCJE ZADANIA ===\n${systemPrompt}`;
      }
    } catch (_) { /* brand KB optional */ }
  }

  if (provider === 'gemini') return completeGemini(systemPrompt, userPrompt, { model, temperature, maxTokens, responseSchema: options.responseSchema });
  if (provider === 'owui') return completeOWUI(systemPrompt, userPrompt, { model, temperature, maxTokens });
  if (provider === 'anthropic') return completeAnthropic(systemPrompt, userPrompt, { model, temperature, maxTokens });
  
  if (['xai', 'deepseek', 'groq', 'mistral'].includes(provider)) {
    return completeOpenAICompatible(provider, systemPrompt, userPrompt, { model, temperature, maxTokens });
  }
  
  return completeOpenAI(systemPrompt, userPrompt, { model, temperature, maxTokens });
}

async function completeOWUI(systemPrompt, userPrompt, { model, temperature, maxTokens }) {
  const client = getOwui();
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });
    const text = response.choices[0].message.content;
    return { text, usage: response.usage, provider: 'owui', model };
  } catch (err) {
    throw new Error(`Błąd Open WebUI: ${err.message}`);
  }
}



async function completeAnthropic(systemPrompt, userPrompt, { model, temperature, maxTokens }) {
  const fetch = require('node-fetch');
  const key = settingsOps.get('anthropic_api_key');
  if (!key) throw new Error('Brak klucza API dla Anthropic');
  
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(`Błąd Anthropic: ${data.error?.message || res.statusText}`);
  
  return {
    text: data.content[0].text,
    usage: { total_tokens: data.usage.input_tokens + data.usage.output_tokens },
    provider: 'anthropic',
    model
  };
}

async function completeOpenAICompatible(provider, systemPrompt, userPrompt, { model, temperature, maxTokens }) {
  const { OpenAI } = require('openai');
  const key = settingsOps.get(`${provider}_api_key`);
  if (!key) throw new Error(`Brak klucza API dla ${provider}`);
  
  let baseURL = '';
  if (provider === 'xai') baseURL = 'https://api.x.ai/v1';
  if (provider === 'deepseek') baseURL = 'https://api.deepseek.com/v1';
  if (provider === 'groq') baseURL = 'https://api.groq.com/openai/v1';
  if (provider === 'mistral') baseURL = 'https://api.mistral.ai/v1';

  const client = new OpenAI({ apiKey: key, baseURL });
  
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });
    return { text: response.choices[0].message.content, usage: response.usage, provider, model };
  } catch (err) {
    throw new Error(`Błąd ${provider}: ${err.message}`);
  }
}

async function completeOpenAI(systemPrompt, userPrompt, { model, temperature, maxTokens }) {
  const client = getOpenAI();
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    });
    const text = response.choices[0].message.content;
    return { text, usage: response.usage, provider: 'openai', model };
  } catch (err) {
    // 429 = quota exceeded — provide clear billing guidance
    if (err?.status === 429 || err?.code === 'insufficient_quota' || (err?.message || '').includes('quota')) {
      throw new Error(
        '⚠️ Przekroczono limit OpenAI API (błąd 429). ' +
        'Sprawdź saldo i doładuj konto na: https://platform.openai.com/account/billing — ' +
        'nowe konta wymagają dodania metody płatności przed pierwszym użyciem.'
      );
    }
    throw err;
  }
}

async function completeGemini(systemPrompt, userPrompt, { model, temperature, maxTokens, responseSchema }) {
  const client = getGemini();

  async function _callModel(m) {
    const generationConfig = {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
    };
    if (responseSchema) {
      generationConfig.responseSchema = responseSchema;
    }

    const genModel = client.getGenerativeModel({
      model: m,
      systemInstruction: systemPrompt,
      generationConfig,
    });
    const result = await genModel.generateContent(userPrompt);
    const text = result.response.text();
    return {
      text,
      usage: { total_tokens: result.response.usageMetadata?.totalTokenCount || 0 },
      provider: 'gemini',
      model: m,
    };
  }

  try {
    return await _callModel(model);
  } catch (err) {
    const msg = err?.message || '';
    const is429 = err?.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests');

    // Auto-fallback: if pro model hit quota, try flash
    if (is429 && model !== 'gemini-2.5-flash') {
      console.warn(`[AI] Gemini model "${model}" quota exceeded — falling back to gemini-2.5-flash`);
      try {
        const fallbackResult = await _callModel('gemini-2.5-flash');
        fallbackResult._fallback = true;
        fallbackResult._originalModel = model;
        return fallbackResult;
      } catch (fallbackErr) {
        // Fallback also failed — throw clear message
        throw new Error(
          `⚠️ Przekroczono limit API Gemini dla modelu "${model}" i zapasowego "gemini-2.5-flash". ` +
          'Sprawdź plan i billing na: https://ai.google.dev/gemini-api/docs/rate-limits — ' +
          'model gemini-2.5-pro wymaga płatnego planu. Użyj gemini-2.5-flash (darmowy) w Ustawieniach → AI.'
        );
      }
    }

    if (is429) {
      throw new Error(
        `⚠️ Przekroczono limit API Gemini (błąd 429) dla modelu "${model}". ` +
        'Poczekaj chwilę i spróbuj ponownie, lub sprawdź billing: https://ai.google.dev/gemini-api/docs/rate-limits'
      );
    }
    throw err;
  }
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 chars)
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost in USD
 */
function estimateCost(inputTokens, outputTokens, provider, model) {
  const pricing = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gemini-2.5-pro': { input: 0.00125, output: 0.01 },
    'gemini-2.5-flash': { input: 0.00015, output: 0.0006 },
    'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
  };
  const p = pricing[model] || { input: 0.001, output: 0.002 };
  return ((inputTokens / 1000) * p.input) + ((outputTokens / 1000) * p.output);
}

/**
 * Parse JSON from AI response safely.
 * Attempts to repair truncated JSON (e.g. from maxTokens cutoff).
 */
function parseJsonResponse(text) {
  // Strip markdown code fences if present
  let cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();

  // 1st attempt: parse as-is
  try { return JSON.parse(cleaned); } catch (_firstErr) { /* continue to repair */ }

  // 2nd attempt: try to repair truncated JSON
  try {
    let repaired = cleaned;

    // Close any unclosed string (odd number of unescaped quotes)
    const quotes = (repaired.match(/(?<!\\)"/g) || []).length;
    if (quotes % 2 !== 0) repaired += '"';

    // Close unclosed brackets/braces
    const opens  = { '{': 0, '[': 0 };
    const closes = { '}': '{', ']': '[' };
    let inStr = false;
    for (let i = 0; i < repaired.length; i++) {
      const c = repaired[i];
      if (c === '"' && (i === 0 || repaired[i-1] !== '\\')) { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{' || c === '[') opens[c]++;
      if (c === '}' || c === ']') opens[closes[c]]--;
    }
    // Remove trailing comma before we close
    repaired = repaired.replace(/,\s*$/, '');
    // Close arrays then objects
    for (let i = 0; i < opens['[']; i++) repaired += ']';
    for (let i = 0; i < opens['{']; i++) repaired += '}';

    const result = JSON.parse(repaired);
    console.warn('[AI] Naprawiono obcięty JSON z odpowiedzi AI (zwiększ maxTokens jeśli problem się powtarza)');
    return result;
  } catch (_repairErr) {
    // 3rd attempt: aggressive truncation (cut off the last incomplete item)
    try {
      let agg = cleaned;
      const lastBrace = agg.lastIndexOf('}');
      if (lastBrace > 0) {
        agg = agg.substring(0, lastBrace + 1);
        const opens  = { '{': 0, '[': 0 };
        const closes = { '}': '{', ']': '[' };
        let inStr = false;
        for (let i = 0; i < agg.length; i++) {
          const c = agg[i];
          if (c === '"' && (i === 0 || agg[i-1] !== '\\')) { inStr = !inStr; continue; }
          if (inStr) continue;
          if (c === '{' || c === '[') opens[c]++;
          if (c === '}' || c === ']') opens[closes[c]]--;
        }
        for (let i = 0; i < opens['[']; i++) agg += ']';
        for (let i = 0; i < opens['{']; i++) agg += '}';
        const result = JSON.parse(agg);
        console.warn('[AI] Agresywnie naprawiono obcięty JSON (odcięto uszkodzoną końcówkę)');
        return result;
      }
    } catch (_aggErr) {}

    throw new Error(`AI zwróciło nieprawidłowy JSON (odpowiedź mogła zostać obcięta — limit tokenów): ${cleaned.substring(0, 250)}...`);
  }
}

// ==========================================
// FUNKCJE DO GENEROWANIA OBRAZÓW (GRAFIKER)
// ==========================================

async function generateImage(prompt, { model, n = 1, size = '1024x1024', provider = 'openwebui' }) {
  try {
    const activeProvider = provider === 'auto' ? getActiveProvider() : provider;
    
    if (activeProvider === 'openai' || activeProvider === 'openwebui') {
      const client = activeProvider === 'openai' ? getOpenAI() : new (require('openai').OpenAI)({
        baseURL: db.settingsOps.get('openwebui_url') + '/v1',
        apiKey: getApiKey('openwebui') || 'sk-1234'
      });
      
      const response = await client.images.generate({
        model: model || 'dall-e-3',
        prompt: prompt,
        n: parseInt(n) || 1,
        size: size || '1024x1024',
        response_format: 'b64_json'
      });
      
      return response.data.map(img => img.b64_json);
    } else {
      throw new Error(`Provider ${activeProvider} nie obsługuje generowania obrazów.`);
    }
  } catch (err) {
    console.error('[AI] generateImage error:', err.message);
    throw err;
  }
}

async function generateImageVariations(imageBase64, { model, n = 1, size = '1024x1024', provider = 'openwebui', prompt = '' }) {
  try {
    const activeProvider = provider === 'auto' ? getActiveProvider() : provider;
    
    if (activeProvider === 'openai' || activeProvider === 'openwebui') {
      const { OpenAI } = require('openai');
      const client = activeProvider === 'openai' ? getOpenAI() : new OpenAI({
        baseURL: db.settingsOps.get('openwebui_url') + '/v1',
        apiKey: getApiKey('openwebui') || 'sk-1234'
      });

      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const buffer = Buffer.from(imageBase64, 'base64');
      const tempFilePath = path.join(os.tmpdir(), `grafiker_ref_${Date.now()}.png`);
      fs.writeFileSync(tempFilePath, buffer);
      
      let response;
      try {
        if (prompt && activeProvider === 'openwebui') {
           response = await client.images.edit({
             image: fs.createReadStream(tempFilePath),
             mask: fs.createReadStream(tempFilePath),
             prompt: prompt,
             n: parseInt(n) || 1,
             size: size || '1024x1024',
             response_format: 'b64_json'
           });
        } else {
           response = await client.images.createVariation({
             image: fs.createReadStream(tempFilePath),
             n: parseInt(n) || 1,
             size: size || '1024x1024',
             response_format: 'b64_json'
           });
        }
      } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      }

      return response.data.map(img => img.b64_json);
    } else {
      throw new Error(`Provider ${activeProvider} nie obsługuje wariacji obrazów.`);
    }
  } catch (err) {
    console.error('[AI] generateImageVariations error:', err.message);
    throw err;
  }
}

/**
 * Reset cached clients (e.g., after key change in settings)
 */
function resetClients() {
  openaiClient = null;
  geminiClient = null;
  owuiClient = null;
}

module.exports = { complete, estimateTokens, estimateCost, parseJsonResponse, resetClients, getEffectiveProvider, getEffectiveModel, generateImage, generateImageVariations };
