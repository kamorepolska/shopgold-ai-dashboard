'use strict';
const express = require('express');
const router  = express.Router();
const { notesOps, knowledgeOps } = require('../models/localDb');

// ─── NOTES CRUD ─────────────────────────────────────────────────────────────────

router.get('/notes', (req, res) => {
  try {
    const userId = req.headers['x-user'] || 'default';
    res.json(notesOps.findAll(userId));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/notes', (req, res) => {
  try {
    const userId = req.headers['x-user'] || 'default';
    const { title, content, color } = req.body;
    const id = notesOps.create(userId, title, content, color);
    res.json({ id, ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/notes/:id', (req, res) => {
  try {
    notesOps.update(req.params.id, req.body);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/notes/:id', (req, res) => {
  try {
    notesOps.delete(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── KNOWLEDGE BASE CRUD ────────────────────────────────────────────────────────

router.get('/knowledge', (req, res) => {
  try {
    const userId = req.headers['x-user'] || 'default';
    const search = req.query.q || '';
    const items = search
      ? knowledgeOps.search(userId, search)
      : knowledgeOps.findAll(userId);
    res.json(items);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/knowledge/:id', (req, res) => {
  try {
    const item = knowledgeOps.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Nie znaleziono' });
    res.json(item);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/knowledge', (req, res) => {
  try {
    const userId = req.headers['x-user'] || 'default';
    const { title, content, file_type, file_size, tags } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title i content wymagane' });
    const id = knowledgeOps.create(userId, title, content, file_type, file_size, tags);
    res.json({ id, ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/knowledge/:id', (req, res) => {
  try {
    knowledgeOps.update(req.params.id, req.body);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/knowledge/:id', (req, res) => {
  try {
    knowledgeOps.delete(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── FETCH URL CONTENT ──────────────────────────────────────────────────────────

router.post('/fetch-url', async (req, res) => {
  try {
    let { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL wymagany' });
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    
    // Simple HTML to text conversion
    let text = html
      // Remove script and style blocks
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      // Extract title
      .replace(/<title[^>]*>([\s\S]*?)<\/title>/i, (_, t) => `TYTUŁ: ${t.trim()}\n\n`)
      // Convert headers
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_, t) => `\n## ${t.replace(/<[^>]+>/g, '').trim()}\n`)
      // Convert paragraphs and divs
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `${t.replace(/<[^>]+>/g, '').trim()}\n\n`)
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `• ${t.replace(/<[^>]+>/g, '').trim()}\n`)
      .replace(/<br\s*\/?>/gi, '\n')
      // Remove remaining tags
      .replace(/<[^>]+>/g, ' ')
      // Clean up whitespace
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
    
    // Limit text length
    if (text.length > 15000) text = text.substring(0, 15000) + '\n\n[... treść skrócona do 15000 znaków]';
    
    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;
    
    res.json({
      ok: true,
      title,
      url,
      content: text,
      length: text.length,
    });
  } catch(e) {
    res.status(400).json({ error: `Nie udało się pobrać strony: ${e.message}` });
  }
});

module.exports = router;
