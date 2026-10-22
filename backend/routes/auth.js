'use strict';
const express = require('express');
const router  = express.Router();
const svc     = require('../services/userService');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Podaj login i hasło' });
    const user = svc.login(username, password);
    svc.addLog({ user_id: user.id, username: user.username, company: req.headers['x-company']||'idealpc', action: 'login', module: 'auth', detail: 'Zalogowano' });
    
    // Auto-login to Open WebUI (if configured)
    let owuiToken = null;
    try {
      const owui = require('../services/openwebuiService');
      const base = owui.getBaseUrl();
      if (base) {
        // Use the same credentials — email = username (user can also use email format)
        const owuiResult = await owui.login(username, password);
        owuiToken = owuiResult.token || null;
      }
    } catch(owuiErr) {
      console.warn('[Auth] Open WebUI auto-login failed:', owuiErr.message);
    }
    
    res.json({ ok: true, user, owui_token: owuiToken });
  } catch(e) { res.status(401).json({ error: e.message }); }
});

// GET /api/auth/me  (validate session)
router.get('/me', (req, res) => {
  const username = req.headers['x-user'] || '';
  if (!username) return res.status(401).json({ error: 'Brak sesji' });
  try {
    const user = svc.getUserByUsername(username);
    if (!user || !user.active) return res.status(401).json({ error: 'Sesja wygasła' });
    res.json(user);
  } catch(e) { res.status(401).json({ error: e.message }); }
});

// ─── Users CRUD (admin only) ──────────────────────────────────────────────────

router.get('/users', (req, res) => {
  try { res.json(svc.listUsers()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/users', (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Brak uprawnień' });
    const r = svc.createUser(req.body);
    svc.addLog({ username: req.user?.username, company: req.company, action: 'create', module: 'users', detail: `Dodano użytkownika: ${req.body.username}` });
    res.json({ ok: true, ...r });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.patch('/users/:id', (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Brak uprawnień' });
    svc.updateUser(parseInt(req.params.id), req.body);
    svc.addLog({ username: req.user?.username, company: req.company, action: 'update', module: 'users', detail: `Edytowano użytkownika ID ${req.params.id}` });
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

router.delete('/users/:id', (req, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Brak uprawnień' });
    svc.deleteUser(parseInt(req.params.id));
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// ─── Logs ─────────────────────────────────────────────────────────────────────

router.get('/logs', (req, res) => {
  try {
    const r = svc.getLogs({
      username: req.query.username || '',
      company:  req.query.company  || '',
      module:   req.query.module   || '',
      limit:    parseInt(req.query.limit)  || 200,
      offset:   parseInt(req.query.offset) || 0,
    });
    res.json(r);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/sections  — return available sections
router.get('/sections', (req, res) => res.json({ sections: svc.SECTIONS, companies: svc.COMPANIES }));

module.exports = router;
