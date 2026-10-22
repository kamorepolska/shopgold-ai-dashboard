'use strict';
const express = require('express');
const router  = express.Router();
const owui    = require('../services/openwebuiService');
const { Readable } = require('stream');
const todaySummary = require('../services/todaySummaryService');
const multer = require('multer');
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });


// Helper: get OWUI token from request header or API key from settings
function getToken(req) {
  const apiKey = owui.getApiKey();
  const browserToken = req.headers['x-owui-token'];
  const effective = apiKey || (browserToken && browserToken !== '__api_key__' ? browserToken : null);
  if (!effective) throw new Error('Brak tokenu/API Key Open WebUI. Skonfiguruj API Key w Ustawienia → AI.');
  return effective;
}

// ─── Models ─────────────────────────────────────────────────────────────────────

router.get('/models', async (req, res) => {
  try {
    const token = getToken(req);
    const models = await owui.listModels(token);
    res.json({ models });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// ─── Chats ──────────────────────────────────────────────────────────────────────

router.get('/chats', async (req, res) => {
  try {
    const token = getToken(req);
    const chats = await owui.listChats(token);
    res.json(chats);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.get('/chats/:id', async (req, res) => {
  try {
    const token = getToken(req);
    const chat = await owui.getChat(token, req.params.id);
    res.json(chat);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.post('/chats/new', async (req, res) => {
  try {
    const token = getToken(req);
    const chat = await owui.newChat(token, req.body.chat || {});
    res.json(chat);
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.delete('/chats/:id', async (req, res) => {
  try {
    const token = getToken(req);
    await owui.deleteChat(token, req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// ─── Chat Completions (SSE Streaming Proxy) ─────────────────────────────────────

router.post('/chats/:id/message', async (req, res) => {
  try {
    const token = getToken(req);
    const { model, messages } = req.body;
    if (!model || !messages?.length) {
      return res.status(400).json({ error: 'Wymagane: model, messages[]' });
    }
    
    const chatId = req.params.id !== 'new' ? req.params.id : null;
    
    // Check if the last message triggers the "Plan Dnia" context
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && typeof lastMsg.content === 'string') {
      const contentLower = lastMsg.content.trim().toLowerCase();
      const triggers = [
        '/dzis',
        '/dzisiaj',
        'co mam dziś do zrobienia',
        'co mam dzis do zrobienia',
        'plan dnia',
        'jaki plan',
        'co mam do zrobienia',
        'podsumowanie dnia'
      ];
      
      const isTrigger = triggers.some(t => contentLower.startsWith(t) || contentLower.includes(t));
      if (isTrigger) {
        const username = req.headers['x-user'] || '';
        const context = todaySummary.getSummaryContext(username);
        
        const systemInstruction = 
          `Jesteś inteligentnym asystentem AI zintegrowanym z systemem ERP/CRM (Shopgold AI Dashboard).\n` +
          `Oto aktualny, rzeczywisty stan systemu pobrany z bazy danych:\n\n` +
          `${context}\n\n` +
          `Twoim zadaniem jest przedstawić użytkownikowi estetyczny, zorganizowany i priorytetyzowany plan dnia (po polsku).\n` +
          `Podziel odpowiedź na czytelne sekcje. Skup się na rzeczach wymagających uwagi (np. zaległe zadania CRM, błędy Sourcingu, oczekujące zatwierdzenia PIM).\n\n` +
          `CRITICAL INSTRUCTION FOR TASK SUGGESTIONS:\n` +
          `Jeśli na podstawie powyższych danych sugerujesz użytkownikowi wykonanie konkretnego działania (np. poprawienie konkretnego błędu importu z ostatnich 48h, zatwierdzenie mapowań w kolejce PIM, czy nadrobienie konkretnego zaległego zadania w CRM), MUSISZ dodać pod tą sugestią (lub na końcu odpowiedzi) tag zadania w dokładnie takim formacie:\n` +
          `[TASK: Tytuł zadania | Opis zadania | Priorytet]\n` +
          `Gdzie:\n` +
          `- Tytuł zadania: Krótki, zwięzły tytuł po polsku (np. "Napraw błąd importu: Hurtownia Akyga", "Zatwierdź mappingi PIM")\n` +
          `- Opis zadania: Krótki opis co należy zrobić\n` +
          `- Priorytet: Dokładnie jeden z wyrazów: 'normal', 'high', lub 'urgent'\n\n` +
          `Przykłady poprawnego tagu:\n` +
          `[TASK: Napraw błąd importu Akyga | Pobieranie pliku XML zakończyło się błędem 404. Sprawdź konfigurację URL. | high]\n` +
          `[TASK: Zweryfikuj mappingi PIM | W kolejce zatwierdzeń czeka 5 zmian wartości pól produktów. | normal]\n\n` +
          `Pamiętaj, aby pisać w profesjonalnym, ale przystępnym tonie i zachęcać do działania. Używaj emotikon i formatowania markdown.`;

        messages.unshift({
          role: 'system',
          content: systemInstruction
        });
      }
    }
    
    // Stream SSE from Open WebUI to our client
    const upstream = await owui.sendMessageStream(token, model, messages, chatId);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Pipe the upstream body to our response
    const reader = upstream.body;
    if (reader && reader.pipe) {
      // Node.js readable stream
      reader.pipe(res);
    } else if (reader && reader.getReader) {
      // Web ReadableStream (fetch in Node 18+)
      const webReader = reader.getReader();
      const decoder = new TextDecoder();
      
      async function pump() {
        while (true) {
          const { done, value } = await webReader.read();
          if (done) { res.end(); return; }
          res.write(decoder.decode(value, { stream: true }));
        }
      }
      pump().catch(err => {
        console.error('[OWUI Stream] Error:', err.message);
        res.end();
      });
    } else {
      // Fallback: just return the body as text
      const text = await upstream.text();
      res.write(text);
      res.end();
    }
    
    // Cleanup on client disconnect
    req.on('close', () => {
      if (reader?.cancel) reader.cancel();
    });
    
  } catch(e) {
    // If headers not sent yet, send JSON error
    if (!res.headersSent) {
      res.status(400).json({ error: e.message });
    } else {
      res.end();
    }
  }
});

// ─── Audio Transcriptions ──────────────────────────────────────────────────────────

router.post('/audio/transcriptions', upload.single('file'), async (req, res) => {
  try {
    const token = getToken(req);
    if (!req.file) {
      return res.status(400).json({ error: 'Brak pliku audio w żądaniu' });
    }
    const result = await owui.transcribeAudio(
      token,
      req.file.buffer,
      req.file.originalname || 'audio.wav',
      req.file.mimetype || 'audio/wav'
    );
    res.json(result);
  } catch(e) {
    console.error('[OWUI Transcriptions Route Error]:', e.message);
    res.status(400).json({ error: e.message });
  }
});

// ─── Login (manual) ─────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email i password wymagane' });
    const result = await owui.login(email, password);
    res.json({ token: result.token });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// ─── Connection test ────────────────────────────────────────────────────────────

router.post('/test', async (req, res) => {
  try {
    const diag = await owui.diagnose();
    if (!diag.ok && !diag.base) {
      return res.json({ ok: false, message: 'Brak skonfigurowanego URL Open WebUI' });
    }
    res.json({
      ok: diag.ok,
      message: diag.message,
      version: diag.version,
      apiKeyConfigured: diag.apiKeyConfigured,
      details: diag.details,
    });
  } catch(e) {
    res.json({ ok: false, message: `Nie można połączyć: ${e.message}` });
  }
});

// ─── Diagnostics (detailed) ─────────────────────────────────────────────────────

router.get('/diagnose', async (req, res) => {
  try {
    const diag = await owui.diagnose();
    res.json(diag);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Check if API Key or token is valid ─────────────────────────────────────────

router.get('/check-auth', async (req, res) => {
  try {
    const token = getToken(req);
    const base = owui.getBaseUrl();
    if (!base) return res.json({ ok: false, error: 'Brak URL Open WebUI' });
    
    // Try simple endpoints first to validate auth without needing /api/models
    const testPaths = [
      '/api/models',
      '/v1/models',
      '/api/v1/models',
      '/api/config',
      '/api/version',
      '/ollama/api/tags',
    ];
    
    for (const p of testPaths) {
      try {
        const r = await fetch(`${base}${p}`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
        if (r.status === 404) continue;
        if (r.status === 401 || r.status === 403) {
          return res.json({ ok: false, error: `API Key odrzucony (${r.status}) na ${p}` });
        }
        // Any 2xx response means we're connected
        if (r.ok) {
          const data = await r.json().catch(() => ({}));
          const count = data.data?.length || data.models?.length || (Array.isArray(data) ? data.length : 0);
          return res.json({ ok: true, modelsCount: count, path: p, version: data.version });
        }
      } catch { continue; }
    }
    
    res.json({ ok: false, error: `Żaden endpoint Open WebUI nie odpowiedział pod ${base}. Sprawdź URL.` });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// ─── Probe all endpoints (diagnostics) ──────────────────────────────────────────

router.get('/probe', async (req, res) => {
  try {
    const base = owui.getBaseUrl();
    const apiKey = owui.getApiKey();
    if (!base) return res.json({ error: 'Brak URL', results: {} });
    
    const endpoints = [
      '/api/version', '/api/config', '/health',
      '/api/models', '/v1/models', '/api/v1/models',
      '/api/chats', '/api/v1/chats', '/api/v1/chats/all',
      '/api/documents', '/api/v1/documents', '/api/v1/documents/',
      '/api/knowledge', '/api/v1/knowledge', '/api/v1/knowledge/',
    ];
    
    const results = {};
    for (const ep of endpoints) {
      try {
        const headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
        const r = await fetch(`${base}${ep}`, {
          headers,
          signal: AbortSignal.timeout(3000),
        });
        let body = null;
        try { 
          const text = await r.text();
          try {
            const json = JSON.parse(text);
            // If it's a list, keep max 2 items for debugging
            if (Array.isArray(json)) body = json.slice(0, 2);
            else if (json.data && Array.isArray(json.data)) body = { ...json, data: json.data.slice(0, 2) };
            else body = json;
          } catch {
            body = text.substring(0, 200);
          }
        } catch {}
        results[ep] = { status: r.status, ok: r.ok, body };
      } catch (e) {
        results[ep] = { status: 0, error: e.message };
      }
    }
    
    res.json({ base, apiKeySet: !!apiKey, results });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Knowledge / Documents ────────────────────────────────────────────────────────

router.get('/knowledge', async (req, res) => {
  try {
    const token = getToken(req);
    const docs = await owui.listDocuments(token);
    // Map to expected frontend format — handle both knowledge and documents schemas
    const mapped = docs.map(d => ({
      id: d.id,
      title: d.title || d.name || 'Dokument',
      description: d.description || '',
      file_type: d.meta?.type || d.type || (d.data ? 'knowledge' : 'doc'),
      file_size: d.meta?.size || d.size || 0,
      content: d.content || d.text || d.description || `[Dokument: ${d.title || d.name || d.id}]`,
      files: d.files || [],
      updated_at: d.updated_at || d.created_at || null,
    }));
    res.json(mapped);
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});
// ─── Prompts ───────────────────────────────────────────────────────────────────

router.get('/prompts', async (req, res) => {
  try {
    const token = getToken(req);
    const prompts = await owui.listPrompts(token);
    res.json(prompts);
  } catch(e) {
    // Gracefully return empty array if prompts not available
    console.log('[OWUI] Prompts error:', e.message);
    res.json([]);
  }
});

// ─── Today Context (Plan Dnia Diagnostic) ───────────────────────────────────────

router.get('/today-context', async (req, res) => {
  try {
    const username = req.headers['x-user'] || '';
    const context = todaySummary.getSummaryContext(username);
    res.json({ context });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
