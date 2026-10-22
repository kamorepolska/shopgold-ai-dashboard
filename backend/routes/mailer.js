const express = require('express');
const router = express.Router();
const { mailerContactsOps, mailerCampaignsOps, mailerAutomationsOps, mailerRulesOps, settingsOps } = require('../models/localDb');
const mailerService = require('../services/mailerService');

// --- CONTACTS ---
router.get('/contacts', (req, res) => {
  const contacts = mailerContactsOps.findAll();
  res.json(contacts);
});

router.post('/contacts/sync', async (req, res) => {
  const result = await mailerService.syncContacts();
  if (result.success) {
    res.json({ message: `Pomyślnie zsynchronizowano ${result.synced} kontaktów.`, synced: result.synced });
  } else {
    res.status(500).json({ error: result.error });
  }
});

router.post('/contacts', (req, res) => {
  const id = mailerContactsOps.upsert(req.body);
  res.json({ id });
});

router.delete('/contacts/:id', (req, res) => {
  mailerContactsOps.delete(req.params.id);
  res.json({ success: true });
});

// --- CAMPAIGNS ---
router.get('/campaigns', (req, res) => {
  const campaigns = mailerCampaignsOps.findAll();
  res.json(campaigns);
});

router.post('/campaigns', (req, res) => {
  const id = mailerCampaignsOps.create(req.body);
  res.json({ id });
});

router.put('/campaigns/:id', (req, res) => {
  mailerCampaignsOps.update(req.params.id, req.body);
  res.json({ success: true });
});

router.delete('/campaigns/:id', (req, res) => {
  mailerCampaignsOps.delete(req.params.id);
  res.json({ success: true });
});

// --- AUTOMATIONS ---
router.get('/automations', (req, res) => {
  const automations = mailerAutomationsOps.findAll();
  res.json(automations);
});

router.post('/automations', (req, res) => {
  const id = mailerAutomationsOps.create(req.body);
  res.json({ id });
});

router.put('/automations/:id', (req, res) => {
  mailerAutomationsOps.update(req.params.id, req.body);
  res.json({ success: true });
});

router.delete('/automations/:id', (req, res) => {
  mailerAutomationsOps.delete(req.params.id);
  res.json({ success: true });
});

// --- RULES ---
router.get('/rules', (req, res) => {
  const rules = mailerRulesOps.findAll();
  res.json(rules);
});

router.post('/rules', (req, res) => {
  mailerRulesOps.upsert(req.body);
  res.json({ success: true });
});

router.delete('/rules/:id', (req, res) => {
  mailerRulesOps.delete(req.params.id);
  res.json({ success: true });
});

// --- SMTP SETTINGS ---
router.get('/smtp', (req, res) => {
  const smtp = settingsOps.get('mailer_smtp') || { host: '', port: '', user: '', pass: '', from: '' };
  res.json(smtp);
});

router.post('/smtp', (req, res) => {
  settingsOps.set('mailer_smtp', req.body);
  res.json({ success: true });
});

module.exports = router;
