'use strict';
/**
 * Open WebUI Service — proxy layer for Open WebUI REST API
 * Supports two auth modes:
 *   1. API Key (preferred) — generated in Open WebUI Settings → Account
 *   2. Email/Password login (legacy) — returns JWT token
 */

const { settingsOps } = require('../models/localDb');

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getBaseUrl() {
  // Stored in settings as 'owui_url', e.g. http://192.168.1.100:8080
  const url = settingsOps.get('owui_url') || '';
  return url.replace(/\/+$/, ''); // strip trailing slash
}

function getApiKey() {
  return settingsOps.get('owui_api_key') || '';
}

async function owuiFetch(path, token, options = {}) {
  const base = getBaseUrl();
  if (!base) throw new Error('Open WebUI URL nie jest skonfigurowany. Ustaw go w Ustawienia → AI.');
  
  const url = `${base}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  
  const res = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!res.ok) {
    let errMsg;
    try { const e = await res.json(); errMsg = e.detail || e.error || e.message || res.statusText; }
    catch { errMsg = `HTTP ${res.status} ${res.statusText}`; }
    throw new Error(`Open WebUI API error: ${errMsg}`);
  }
  
  return res;
}

// ─── Authentication ─────────────────────────────────────────────────────────────

/**
 * Get a working token — prefers API Key, falls back to email/password login.
 * @param {string} [email]
 * @param {string} [password]
 * @returns {Promise<string>} token or API key
 */
async function getToken(email, password) {
  // 1. If API Key is configured, use it directly (no login needed)
  const apiKey = getApiKey();
  if (apiKey) return apiKey;
  
  // 2. Otherwise try email/password login
  if (!email || !password) {
    throw new Error('Skonfiguruj API Key Open WebUI w Ustawienia → AI, lub podaj email i hasło.');
  }
  
  const result = await login(email, password);
  return result.token;
}

/**
 * Login to Open WebUI and get JWT token.
 * Tries multiple API paths for compatibility with different Open WebUI versions.
 */
async function login(email, password) {
  const base = getBaseUrl();
  if (!base) throw new Error('Open WebUI URL nie jest skonfigurowany. Ustaw go w Ustawienia → AI.');
  
  const paths = [
    '/api/auths/signin',      // Open WebUI 0.3+ (current)
    '/api/v1/auths/signin',   // Open WebUI 0.1-0.2 (legacy)
  ];
  
  const errors = [];
  
  for (const p of paths) {
    try {
      const url = `${base}${p}`;
      console.log(`[OWUI] Trying login at: ${url}`);
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(10000),
      });
      
      if (r.status === 404) {
        errors.push(`${p} → 404`);
        continue;
      }
      
      const data = await r.json();
      
      if (!r.ok) {
        const errMsg = data.detail || data.error || data.message || `HTTP ${r.status}`;
        throw new Error(`Open WebUI: ${errMsg}`);
      }
      
      if (data.token) {
        console.log(`[OWUI] Login success via ${p}`);
        return data;
      }
      
      errors.push(`${p} → brak tokenu w odpowiedzi`);
    } catch (e) {
      if (e.message.startsWith('Open WebUI:')) throw e; // Real auth error
      errors.push(`${p} → ${e.message}`);
    }
  }
  
  throw new Error(
    `Nie udało się zalogować do Open WebUI.\n` +
    `Próbowane endpointy: ${errors.join('; ')}.\n` +
    `Rozwiązanie: Wygeneruj API Key w Open WebUI (Settings → Account → API Keys) i wklej go w Ustawienia → AI → Open WebUI API Key.`
  );
}

// ─── Models ─────────────────────────────────────────────────────────────────────

/**
 * List available models from Open WebUI — tries multiple API paths
 */
async function listModels(token) {
  const effectiveToken = token || getApiKey();
  if (!effectiveToken) throw new Error('Brak tokenu/API Key Open WebUI');
  
  const base = getBaseUrl();
  if (!base) throw new Error('Open WebUI URL nie jest skonfigurowany.');
  
  // Try multiple known model endpoints
  const paths = [
    '/api/models',       // Open WebUI 0.3+
    '/v1/models',        // OpenAI-compatible layer
    '/api/v1/models',    // Some versions
    '/ollama/api/tags',  // Ollama passthrough
  ];
  
  for (const p of paths) {
    try {
      const r = await fetch(`${base}${p}`, {
        headers: {
          'Authorization': `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });
      
      if (r.status === 404) continue;
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${r.status}`);
      }
      
      const data = await r.json();
      // Normalize response — different endpoints return different formats
      let models = [];
      if (Array.isArray(data)) {
        models = data;
      } else if (data.data) {
        models = data.data;
      } else if (data.models) {
        models = data.models;
      }
      
      console.log(`[OWUI] Models loaded via ${p}: ${models.length} models`);
      // Store which path worked for future use
      _workingModelsPath = p;
      return models;
    } catch (e) {
      if (e.message && !e.message.includes('404')) {
        // Real error (auth, timeout, etc.) — don't try next path
        throw new Error(`Open WebUI API error (${p}): ${e.message}`);
      }
    }
  }
  
  throw new Error(
    `Nie znaleziono endpointu modeli w Open WebUI. ` +
    `Przetestowane ścieżki: ${paths.join(', ')}. ` +
    `Sprawdź czy URL (${base}) jest poprawny.`
  );
}

// Cache which models path works
let _workingModelsPath = '/api/models';

// ─── Chats ──────────────────────────────────────────────────────────────────────

async function listChats(token) {
  const effectiveToken = token || getApiKey();
  const paths = ['/api/v1/chats/', '/api/v1/chats', '/api/chats/', '/api/chats', '/api/v1/chats/all/', '/api/v1/chats/all'];
  for (const p of paths) {
    try {
      const res = await owuiFetch(p, effectiveToken);
      return await res.json();
    } catch { continue; }
  }
  return [];
}

async function getChat(token, chatId) {
  const effectiveToken = token || getApiKey();
  const paths = [`/api/v1/chats/${chatId}/`, `/api/v1/chats/${chatId}`, `/api/chats/${chatId}/`, `/api/chats/${chatId}`];
  for (const p of paths) {
    try {
      const res = await owuiFetch(p, effectiveToken);
      return await res.json();
    } catch { continue; }
  }
  throw new Error(`Nie udało się pobrać czatu: ${chatId}`);
}

async function newChat(token, chatData = {}) {
  const effectiveToken = token || getApiKey();
  const paths = ['/api/v1/chats/new/', '/api/v1/chats/new', '/api/chats/new/', '/api/chats/new'];
  for (const p of paths) {
    try {
      const res = await owuiFetch(p, effectiveToken, {
        method: 'POST',
        body: JSON.stringify({ chat: chatData }),
      });
      return await res.json();
    } catch { continue; }
  }
  throw new Error('Nie udało się utworzyć czatu');
}

async function deleteChat(token, chatId) {
  const effectiveToken = token || getApiKey();
  const paths = [`/api/v1/chats/${chatId}/`, `/api/v1/chats/${chatId}`, `/api/chats/${chatId}/`, `/api/chats/${chatId}`];
  for (const p of paths) {
    try {
      const res = await owuiFetch(p, effectiveToken, { method: 'DELETE' });
      return await res.json();
    } catch { continue; }
  }
  throw new Error(`Nie udało się usunąć czatu: ${chatId}`);
}

// ─── Chat Completions (Streaming) ───────────────────────────────────────────────

const COMPLETION_PATHS = [
  '/api/chat/completions',   // Open WebUI standard
  '/v1/chat/completions',    // OpenAI-compatible
  '/api/v1/chat/completions', // Some versions
];

async function sendMessageStream(token, model, messages, chatId = null) {
  const base = getBaseUrl();
  if (!base) throw new Error('Open WebUI URL nie jest skonfigurowany.');
  
  const effectiveToken = token || getApiKey();
  if (!effectiveToken) throw new Error('Brak tokenu/API Key Open WebUI');
  
  const body = {
    model,
    messages,
    stream: true,
  };
  if (chatId) body.chat_id = chatId;
  
  for (const p of COMPLETION_PATHS) {
    const res = await fetch(`${base}${p}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveToken}`,
      },
      body: JSON.stringify(body),
    });
    
    if (res.status === 404) continue; // Try next path
    
    if (!res.ok) {
      let errMsg;
      try { const e = await res.json(); errMsg = e.detail || e.error || res.statusText; }
      catch { errMsg = `HTTP ${res.status}`; }
      throw new Error(`Open WebUI completions error: ${errMsg}`);
    }
    
    console.log(`[OWUI] Completions via ${p}`);
    return res;
  }
  
  throw new Error(`Nie znaleziono endpointu completions. Przetestowane: ${COMPLETION_PATHS.join(', ')}`);
}

async function listDocuments(token) {
  const base = getBaseUrl();
  if (!base) throw new Error('Open WebUI URL nie jest skonfigurowany.');
  const effectiveToken = token || getApiKey();
  
  const endpoint = '/api/v1/knowledge/';
  const maxRetries = 3;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 500 * attempt));
      
      const res = await fetch(`${base}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${effectiveToken}`, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      console.log(`[OWUI listDocs] attempt=${attempt+1} status=${res.status}`);
      
      if (res.status === 401 || res.status === 403) {
        if (attempt < maxRetries - 1) continue; // Retry
        console.log('[OWUI listDocs] Auth failed after retries');
        return []; // Gracefully return empty instead of throwing
      }
      if (res.status === 404) break;
      
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) break;
      
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || data.data || data.documents || data.knowledge || []);
        console.log(`[OWUI listDocs] Got ${items.length} items`);
        return items;
      }
    } catch(e) { 
      console.log(`[OWUI listDocs] attempt=${attempt+1} error: ${e.message}`); 
      if (attempt >= maxRetries - 1) break;
    }
  }
  return [];
}

async function sendMessage(token, model, messages, chatId = null) {
  const effectiveToken = token || getApiKey();
  const base = getBaseUrl();
  if (!base) throw new Error('Open WebUI URL nie jest skonfigurowany.');
  
  const body = {
    model,
    messages,
    stream: false,
  };
  if (chatId) body.chat_id = chatId;
  
  for (const p of COMPLETION_PATHS) {
    try {
      const res = await fetch(`${base}${p}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify(body),
      });
      
      if (res.status === 404) continue;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${res.status}`);
      }
      return res.json();
    } catch (e) {
      if (e.message && !e.message.includes('404')) throw e;
    }
  }
  
  throw new Error(`Nie znaleziono endpointu completions.`);
}

// ─── Prompts ───────────────────────────────────────────────────────────────────────────────────

async function listPrompts(token) {
  const effectiveToken = token || getApiKey();
  let allPrompts = [];
  
  const endpointGroups = [
    ['/api/v1/prompts/', '/api/v1/prompts', '/api/prompts/', '/api/prompts'],
    ['/api/v1/system_prompts/', '/api/v1/system_prompts']
  ];
  
  for (const paths of endpointGroups) {
    for (const p of paths) {
      try {
        const res = await owuiFetch(p, effectiveToken);
        const data = await res.json();
        let extracted = null;
        if (Array.isArray(data)) extracted = data;
        else if (data.data && Array.isArray(data.data)) extracted = data.data;
        else if (data.prompts && Array.isArray(data.prompts)) extracted = data.prompts;
        else if (data.items && Array.isArray(data.items)) extracted = data.items;
        
        if (extracted) {
          allPrompts = allPrompts.concat(extracted);
          break; // Found working path for this group, move to next group
        }
      } catch { continue; }
    }
  }
  return allPrompts;
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────────────────────

/**
 * Probe the Open WebUI instance and return diagnostic info
 */
async function diagnose() {
  const base = getBaseUrl();
  if (!base) return { ok: false, message: 'Brak skonfigurowanego URL', details: {} };
  
  const results = {};
  const endpoints = [
    { name: 'version',    url: `${base}/api/version`,          method: 'GET' },
    { name: 'config',     url: `${base}/api/config`,           method: 'GET' },
    { name: 'health',     url: `${base}/health`,               method: 'GET' },
    { name: 'auth_new',   url: `${base}/api/auths/signin`,     method: 'OPTIONS' },
    { name: 'auth_old',   url: `${base}/api/v1/auths/signin`,  method: 'OPTIONS' },
    { name: 'models',     url: `${base}/api/models`,           method: 'GET' },
  ];
  
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep.url, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      let body = null;
      try { body = await r.json(); } catch {}
      results[ep.name] = { status: r.status, ok: r.status < 400, body };
    } catch (e) {
      results[ep.name] = { status: 0, ok: false, error: e.message };
    }
  }
  
  // Also test with API key if configured
  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const r = await fetch(`${base}/api/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      results['models_with_key'] = { status: r.status, ok: r.status < 400 };
    } catch (e) {
      results['models_with_key'] = { status: 0, ok: false, error: e.message };
    }
  }
  
  const serverReachable = Object.values(results).some(r => r.status > 0);
  const version = results.version?.body?.version || null;
  
  return {
    ok: serverReachable,
    base,
    version,
    apiKeyConfigured: !!apiKey,
    message: serverReachable 
      ? `Open WebUI${version ? ' v' + version : ''} dostępny pod ${base}`
      : `Nie można połączyć z ${base}`,
    details: results,
  };
}

async function transcribeAudio(token, fileBuffer, fileName, mimeType) {
  const base = getBaseUrl();
  if (!base) throw new Error('Open WebUI URL nie jest skonfigurowany.');
  const effectiveToken = token || getApiKey();
  
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, fileName);
  
  const paths = ['/api/v1/audio/transcriptions', '/api/audio/transcriptions'];
  let lastErr = null;
  for (const p of paths) {
    try {
      const res = await fetch(`${base}${p}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveToken}`,
        },
        body: formData,
      });
      
      if (res.status === 404) continue;
      
      if (!res.ok) {
        let errMsg;
        try {
          const e = await res.json();
          errMsg = e.detail || e.error || res.statusText;
        } catch {
          errMsg = `HTTP ${res.status}`;
        }
        throw new Error(`Open WebUI audio error: ${errMsg}`);
      }
      
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (e.message && !e.message.includes('404')) throw e;
    }
  }
  throw lastErr || new Error('Nie znaleziono endpointu transkrypcji w Open WebUI.');
}

module.exports = {
  getBaseUrl,
  getApiKey,
  getToken,
  login,
  listModels,
  listChats,
  getChat,
  newChat,
  deleteChat,
  sendMessageStream,
  sendMessage,
  diagnose,
  listDocuments,
  listPrompts,
  transcribeAudio,
};

