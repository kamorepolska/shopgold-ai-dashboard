const express = require('express');
const router = express.Router();
const mysqlAdapter = require('../adapters/mysqlAdapter');
const aiService = require('../services/aiService');

// GET /api/cms?type=category|page|manufacturer|all
router.get('/', async (req, res) => {
  try {
    const type = req.query.type || 'all';
    const entities = await mysqlAdapter.fetchCmsEntities(type);
    
    // Calculate simple SEO score for each entity
    const scoredEntities = entities.map(ent => {
      let score = 0;
      let issues = [];
      
      const descLen = (ent.description || '').length;
      if (descLen > 2000) score += 40;
      else if (descLen > 500) score += 20;
      else if (descLen > 100) score += 10;
      else issues.push('Krótki lub brak opisu');
      
      if (ent.meta_title && ent.meta_title.length > 20) score += 20;
      else issues.push('Brak lub krótki Meta Title');
      
      if (ent.meta_desc && ent.meta_desc.length > 50) score += 20;
      else issues.push('Brak lub krótki Meta Description');
      
      if ((ent.description || '').includes('application/ld+json')) score += 20;
      else issues.push('Brak JSON-LD (Schema)');

      return { ...ent, seo_score: score, seo_issues: issues };
    });

    res.json({ success: true, entities: scoredEntities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/cms/:type/:id
router.put('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    await mysqlAdapter.updateCmsEntity(type, id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cms/generate
// Body: { type, id, title, currentDescription }
router.post('/generate', async (req, res) => {
  try {
    const { type, title, currentDescription, targetKeyword } = req.body;
    
    const typeNames = { category: 'Kategorii', page: 'Strony Informacyjnej', manufacturer: 'Marki/Producenta' };
    const typeName = typeNames[type] || 'Strony';

    const systemPrompt = `Jesteś ekspertem ds. Semantic SEO i E-commerce.
Twoim zadaniem jest stworzenie silnie zoptymalizowanego opisu dla ${typeName}.
Na początku opisu MUSISZ wstawić poprawny i zminifikowany blok <script type="application/ld+json">.
- Dla kategorii użyj CollectionPage oraz FAQPage Schema.
- Dla strony informacyjnej: WebPage lub Article.
- Dla producenta: Brand i CollectionPage.

Następnie wygeneruj wyczerpujący opis w HTML (używaj <h2>, <h3>, <p>, <ul>).
Opis musi odpowiadać na intencje wyszukiwarek AI (SGE) - musi zawierać sekcję "Najczęściej zadawane pytania" (FAQ) w HTML.

Zwróć odpowiedź WYŁĄCZNIE jako JSON:
{
  "description": "Tutaj kod <script> JSON-LD, a zaraz po nim kod HTML opisu.",
  "meta_title": "Idealny tytuł SEO do 60 znaków",
  "meta_desc": "Idealny opis SEO do 155 znaków zachęcający do kliknięcia (CTA)"
}`;

    let userPrompt = `Tytuł: ${title}\nSłowo kluczowe: ${targetKeyword || title}\nAktualna treść (do ewentualnego rozbudowania/poprawienia):\n${currentDescription || 'Brak tekstu - napisz od zera'}`;

    const result = await aiService.complete(systemPrompt, userPrompt, { featureId: 'pim_cms_generate' });
    const parsed = aiService.parseJsonResponse(result.text);

    res.json({
      success: true,
      description: parsed.description || '',
      meta_title: parsed.meta_title || '',
      meta_desc: parsed.meta_desc || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cms/generate-async
router.post('/generate-async', async (req, res) => {
  try {
    const { type, id, title, currentDescription, targetKeyword } = req.body;
    
    // Return early
    res.json({ success: true, note: 'Optymalizacja uruchomiona w tle' });

    // Run in background
    (async () => {
      try {
        const typeNames = { category: 'Kategorii', page: 'Strony Informacyjnej', manufacturer: 'Marki/Producenta' };
        const typeName = typeNames[type] || 'Strony';

        const systemPrompt = `Jesteś ekspertem ds. Semantic SEO i E-commerce.
Twoim zadaniem jest stworzenie silnie zoptymalizowanego opisu dla ${typeName}.
Na początku opisu MUSISZ wstawić poprawny i zminifikowany blok <script type="application/ld+json">.
- Dla kategorii użyj CollectionPage oraz FAQPage Schema.
- Dla strony informacyjnej: WebPage lub Article.
- Dla producenta: Brand i CollectionPage.

Następnie wygeneruj wyczerpujący opis w HTML (używaj <h2>, <h3>, <p>, <ul>).
Opis musi odpowiadać na intencje wyszukiwarek AI (SGE) - musi zawierać sekcję "Najczęściej zadawane pytania" (FAQ) w HTML.

Zwróć odpowiedź WYŁĄCZNIE jako JSON:
{
  "description": "Tutaj kod <script> JSON-LD, a zaraz po nim kod HTML opisu.",
  "meta_title": "Idealny tytuł SEO do 60 znaków",
  "meta_desc": "Idealny opis SEO do 155 znaków zachęcający do kliknięcia (CTA)"
}`;

        let userPrompt = `Tytuł: ${title}\nSłowo kluczowe: ${targetKeyword || title}\nAktualna treść (do ewentualnego rozbudowania/poprawienia):\n${currentDescription || 'Brak tekstu - napisz od zera'}`;

        const result = await aiService.complete(systemPrompt, userPrompt, { featureId: 'pim_cms_generate' });
        const parsed = aiService.parseJsonResponse(result.text);

        // Update in ShopGold
        await mysqlAdapter.updateCmsEntity(type, id, {
          description: parsed.description || '',
          meta_title: parsed.meta_title || '',
          meta_desc: parsed.meta_desc || ''
        });

        // Add notification
        const notificationService = require('../services/notificationService');
        notificationService.addNotification({
          type: 'success',
          title: 'Optymalizacja CMS Zakończona',
          message: `Pomyślnie wygenerowano i zapisano treść SEO dla ${typeName}: ${title}.`
        });

      } catch (err) {
        const notificationService = require('../services/notificationService');
        notificationService.addNotification({
          type: 'error',
          title: 'Błąd Optymalizacji CMS',
          message: `Nie udało się wygenerować SEO dla ${title}. Powód: ${err.message}`
        });
      }
    })();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
