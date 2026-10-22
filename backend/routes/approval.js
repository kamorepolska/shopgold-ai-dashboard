const express = require('express');
const router = express.Router();
const { approvalOps } = require('../models/localDb');
const { syncApproved, exportApprovedAsXml, exportApprovedAsCsv } = require('../services/approvalService');

// GET /api/approval — list queue items
router.get('/', (req, res) => {
  try {
    const { status = '', product_id = '', limit = 100, offset = 0 } = req.query;
    const items = approvalOps.findAll({ status, product_id, limit: parseInt(limit), offset: parseInt(offset) });
    const stats = approvalOps.stats();
    res.json({ items, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/approval/:id — update single item status
router.patch('/:id', (req, res) => {
  try {
    const { status, userNote, editedValue } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Status musi być: approved | rejected | pending' });
    }
    approvalOps.updateStatus(req.params.id, status, userNote, editedValue ?? null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/approval/bulk — bulk status update
router.post('/bulk', (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids?.length) return res.status(400).json({ error: 'Brak ids' });
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Nieprawidłowy status' });
    }
    approvalOps.bulkUpdateStatus(ids, status);
    res.json({ success: true, updated: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/approval/sync — push approved to ShopGold
router.post('/sync', async (req, res) => {
  try {
    const result = await syncApproved();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/approval/export/xml — export approved as XML
router.get('/export/xml', (req, res) => {
  try {
    const xml = exportApprovedAsXml();
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="shopgold_import.xml"');
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/approval/export/csv — export approved as CSV
router.get('/export/csv', (req, res) => {
  try {
    const csv = exportApprovedAsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="shopgold_import.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
