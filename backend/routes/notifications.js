'use strict';
const express = require('express');
const router = express.Router();
const svc = require('../services/notificationService');

// GET /api/notifications
router.get('/', (req, res) => {
  try {
    const username = req.user?.username || req.headers['x-user'] || '';
    const items = svc.listNotifications(username, req.query.module);
    const unread = svc.getUnreadCount(username, req.query.module);
    res.json({ success: true, items, unread });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', (req, res) => {
  try {
    const username = req.user?.username || req.headers['x-user'] || '';
    const count = svc.getUnreadCount(username, req.query.module);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', (req, res) => {
  try {
    svc.markAsRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', (req, res) => {
  try {
    const username = req.user?.username || req.headers['x-user'] || '';
    svc.markAllAsRead(username);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', (req, res) => {
  try {
    svc.deleteNotification(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications
router.delete('/', (req, res) => {
  try {
    const username = req.user?.username || req.headers['x-user'] || '';
    svc.clearAll(username);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
