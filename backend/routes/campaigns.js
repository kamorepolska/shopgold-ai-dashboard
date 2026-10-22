const express = require('express');
const router = express.Router();
const { campaignOps } = require('../models/localDb');
const {
  createCampaign, exportCampaign,
  generateStrategy, generateAdCopy, optimizeCampaign,
} = require('../services/campaignService');

// Mock stats data (ready for Google/Meta API integration)
const MOCK_STATS = [
  { id:'m1', name:'Kampania Wiosna 2025', platform:'Google Ads', status:'active', budget:5000, spent:3240, impressions:142500, clicks:4275, conversions:128, revenue:18432, cpc:0.76, ctr:3.0, cpa:25.31, roas:568.9 },
  { id:'m2', name:'Retargeting — Koszyk', platform:'Meta Ads', status:'active', budget:2000, spent:1890, impressions:98300, clicks:2210, conversions:87, revenue:9847, cpc:0.86, ctr:2.25, cpa:21.72, roas:521.0 },
  { id:'m3', name:'Branding — Nowa Kolekcja', platform:'Meta Ads', status:'paused', budget:3000, spent:2975, impressions:210000, clicks:3780, conversions:62, revenue:5890, cpc:0.79, ctr:1.8, cpa:47.98, roas:198.0 },
  { id:'m4', name:'Google Search — Branded', platform:'Google Ads', status:'active', budget:1500, spent:1120, impressions:18700, clicks:2240, conversions:198, revenue:22410, cpc:0.5, ctr:11.98, cpa:5.66, roas:2000.9 },
];

router.get('/', (req, res) => {
  try { res.json({ campaigns: campaignOps.findAll() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/mock-stats', (req, res) => res.json({ campaigns: MOCK_STATS }));

router.get('/:id', (req, res) => {
  try {
    const c = campaignOps.findById(req.params.id);
    if (!c) return res.status(404).json({ error: 'Kampania nie znaleziona' });
    res.json(c);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/strategy', async (req, res) => {
  try {
    const { goal, budget, industry, targetInfo, platforms, provider, model } = req.body;
    if (!goal) return res.status(400).json({ error: 'Podaj cel kampanii' });
    if (!budget || budget <= 0) return res.status(400).json({ error: 'Podaj budżet > 0' });
    const result = await generateStrategy({ goal, budget: Number(budget), industry, targetInfo, platforms, options: { provider, model } });
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/generate-ads', async (req, res) => {
  try {
    const { productIds, campaignName, platform, goal, targetAudience, provider, model } = req.body;
    if (!productIds?.length) return res.status(400).json({ error: 'Wybierz co najmniej 1 produkt' });
    if (!platform) return res.status(400).json({ error: 'Podaj platformę: google_ads | facebook_ads' });
    const result = await generateAdCopy({ productIds, campaignName: campaignName || 'Kampania AI', platform, goal, targetAudience, options: { provider, model } });
    const id = campaignOps.create({ name: campaignName || 'Kampania AI', type: platform, product_ids: productIds, generated_content: result.ads });
    res.json({ success: true, id, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/optimize', async (req, res) => {
  try {
    const { rawData, campaignName, platform, provider, model } = req.body;
    if (!rawData?.trim()) return res.status(400).json({ error: 'Wklej dane kampanii do analizy' });
    const result = await optimizeCampaign({ rawData, campaignName, platform, options: { provider, model } });
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { productIds, campaignName, type, provider, model } = req.body;
    if (!productIds?.length) return res.status(400).json({ error: 'Brak productIds' });
    if (!type) return res.status(400).json({ error: 'Brak type' });
    const result = await createCampaign(productIds, campaignName || 'Kampania AI', type, { provider, model });
    res.json({ success: true, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/export/:format', (req, res) => {
  try {
    const c = campaignOps.findById(req.params.id);
    if (!c) return res.status(404).json({ error: 'Kampania nie znaleziona' });
    const ex = exportCampaign(c, req.params.format);
    res.setHeader('Content-Type', ex.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${ex.filename}"`);
    res.send(ex.data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try { campaignOps.delete(req.params.id); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
