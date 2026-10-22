/* =====================================================================
 * emailMonitor.js — REST routes dla monitorowania maili z ofertami
 * ===================================================================== */
'use strict';

const express = require('express');
const router  = express.Router();
const svc     = require('../services/emailMonitorService');

function getSettings() {
  const { settingsOps } = require('../models/localDb');
  const keys = [
    'email_monitor_host','email_monitor_port','email_monitor_user',
    'email_monitor_pass','email_monitor_tls','email_monitor_folder',
    'email_monitor_enabled','email_monitor_subject_filter','email_monitor_sender_filter',
    'email_monitor_ai_model',
  ];
  const s = {};
  for (const k of keys) s[k] = settingsOps.get(k) || '';
  return s;
}

// ── POST /api/email-monitor/check ─────────────────────────────────────
// Ręczne sprawdzenie skrzynki
router.post('/check', async (req, res) => {
  try {
    const settings = getSettings();
    const aiModel  = req.body.ai_model || settings.email_monitor_ai_model || '';
    const result   = await svc.checkEmails(settings, aiModel);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/email-monitor/test ──────────────────────────────────────
// Test połączenia IMAP
router.post('/test', async (req, res) => {
  try {
    // Allow passing settings directly from the form (not yet saved)
    const settings = {
      email_monitor_host:   req.body.host   || getSettings().email_monitor_host,
      email_monitor_port:   req.body.port   || getSettings().email_monitor_port || '993',
      email_monitor_user:   req.body.user   || getSettings().email_monitor_user,
      email_monitor_pass:   req.body.pass   || getSettings().email_monitor_pass,
      email_monitor_tls:    req.body.tls !== undefined ? req.body.tls : (getSettings().email_monitor_tls || '1'),
      email_monitor_folder: req.body.folder || getSettings().email_monitor_folder || 'INBOX',
    };
    const result = await svc.testConnection(settings);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/email-monitor/mails ─────────────────────────────────────
// Lista odebranych maili
router.get('/mails', (req, res) => {
  try {
    svc.ensureTable();
    const status = req.query.status || '';
    const limit  = Math.min(parseInt(req.query.limit  || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);
    const data   = svc.listMails({ status: status || undefined, limit, offset });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/email-monitor/mails/:id ─────────────────────────────────
// Szczegóły maila z produktami
router.get('/mails/:id', (req, res) => {
  try {
    const mail = svc.getMailProducts(parseInt(req.params.id, 10));
    if (!mail) return res.status(404).json({ error: 'Mail nie znaleziony' });
    res.json(mail);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/email-monitor/mails/:id/import ─────────────────────────
// Import produktów z maila do wybranej hurtowni
router.post('/mails/:id/import', (req, res) => {
  try {
    const mailId     = parseInt(req.params.id, 10);
    const supplierId = parseInt(req.body.supplier_id, 10);
    if (!supplierId) return res.status(400).json({ error: 'Podaj supplier_id' });
    const result = svc.importMailProducts(mailId, supplierId);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/email-monitor/mails/:id/status ────────────────────────
// Zmień status maila
router.patch('/mails/:id/status', (req, res) => {
  try {
    const allowed = ['pending','imported','skipped','error'];
    const { status } = req.body;
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Nieprawidłowy status' });
    svc.updateStatus(parseInt(req.params.id, 10), status);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/email-monitor/mails/:id ──────────────────────────────
router.delete('/mails/:id', (req, res) => {
  try {
    svc.deleteMail(parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
