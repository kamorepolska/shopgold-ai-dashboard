const express = require('express');
const router = express.Router();
const { generateImage, generateImageVariations, getEffectiveProvider, getEffectiveModel } = require('../services/aiService');

// POST /api/grafiker/generate
router.post('/generate', async (req, res) => {
  try {
    const { prompt, n, size, provider } = req.body;
    
    if (!prompt) return res.status(400).json({ error: 'Brak promptu' });

    const effectiveProvider = provider || getEffectiveProvider();
    // we don't know the exact image model for openwebui, usually it uses the default one set in webui
    // but we can pass 'dall-e-3' as fallback
    const model = 'dall-e-3'; 
    
    const images = await generateImage(prompt, { model, n, size, provider: effectiveProvider });

    // Unified Notifications trigger
    try {
      const notificationService = require('../services/notificationService');
      const promptSnippet = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;
      const count = images ? images.length : 1;
      const username = req.user?.username || req.headers['x-user'] || '';
      notificationService.addNotification(
        'Wygenerowano grafikę AI',
        `Pomyślnie wygenerowano ${count} grafik(ę/i) dla promptu: "${promptSnippet}"`,
        'success',
        'grafiker',
        username
      );
    } catch (err) {
      console.error('[grafiker] Failed to trigger generate notification:', err.message);
    }

    res.json({ success: true, images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/grafiker/variations
router.post('/variations', async (req, res) => {
  try {
    const { imageBase64, prompt, n, size, provider } = req.body;
    
    if (!imageBase64) return res.status(400).json({ error: 'Brak obrazu referencyjnego' });

    const effectiveProvider = provider || getEffectiveProvider();
    const model = 'dall-e-3';
    
    const images = await generateImageVariations(imageBase64, { model, n, size, provider: effectiveProvider, prompt });

    // Unified Notifications trigger
    try {
      const notificationService = require('../services/notificationService');
      const promptSnippet = (prompt || 'wariacja bez promptu').length > 50 ? (prompt || 'wariacja bez promptu').substring(0, 50) + '...' : (prompt || 'wariacja bez promptu');
      const count = images ? images.length : 1;
      const username = req.user?.username || req.headers['x-user'] || '';
      notificationService.addNotification(
        'Wygenerowano warianty grafiki',
        `Pomyślnie wygenerowano ${count} wariant(y/ów) dla promptu: "${promptSnippet}"`,
        'success',
        'grafiker',
        username
      );
    } catch (err) {
      console.error('[grafiker] Failed to trigger variations notification:', err.message);
    }

    res.json({ success: true, images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/grafiker/models
router.get('/models', async (req, res) => {
  try {
    const owui = require('../services/openwebuiService');
    // Pobierz modele z OWUI (używając globalnego API Key z ustawień)
    const rawModels = await owui.listModels();
    const models = rawModels.map(m => m.id || m.name || m);
    res.json({ success: true, models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const { grafikerOps } = require('../models/grafikerDb');
const fs = require('fs');
const path = require('path');

// POST /api/grafiker/save
router.post('/save', (req, res) => {
  try {
    const { base64, prompt, model, format } = req.body;
    if (!base64) return res.status(400).json({ error: 'Brak danych obrazu' });
    
    const ext = format === 'jpeg' ? 'jpg' : (format || 'png');
    const filename = `grafika_${Date.now()}.${ext}`;
    const uploadsDir = path.join(__dirname, '../../frontend/grafiker-uploads');
    
    // Convert base64 to buffer and save
    const rawData = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(rawData, 'base64');
    fs.writeFileSync(path.join(uploadsDir, filename), buffer);

    const record = grafikerOps.add({ filename, prompt, model, format: ext });
    res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/grafiker/saved
router.get('/saved', (req, res) => {
  try {
    const items = grafikerOps.findAll();
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/grafiker/saved/:id
router.delete('/saved/:id', (req, res) => {
  try {
    grafikerOps.remove(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/grafiker/remove-bg
router.post('/remove-bg', async (req, res) => {
  try {
    const { settingsOps } = require('../models/localDb');
    const apiKey = settingsOps.get('grafiker_removebg_key');
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Brak klucza API remove.bg w ustawieniach.' });
    }

    const { base64 } = req.body;
    if (!base64) return res.status(400).json({ error: 'Brak obrazu' });
    
    const rawData = base64.includes(',') ? base64.split(',')[1] : base64;

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        image_file_b64: rawData,
        size: 'auto'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Błąd remove.bg: ${response.status} ${errText}`);
    }

    const result = await response.json();
    if (result.data && result.data.result_b64) {
      res.json({ success: true, base64: result.data.result_b64 });
    } else {
      throw new Error('Nieprawidłowa odpowiedź z remove.bg');
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
