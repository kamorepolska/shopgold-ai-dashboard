'use strict';
const userSvc = require('../services/userService');

// Truly public routes that don't require auth at all
const PUBLIC = ['/api/auth/login', '/api/auth/me', '/api/auth/sections'];

module.exports = function authMiddleware(req, res, next) {
  if (PUBLIC.includes(req.path)) return next();
  // Static files don't need auth
  if (!req.path.startsWith('/api/')) return next();

  const username = req.headers['x-user'] || '';
  if (!username) return res.status(401).json({ error: 'Wymagane logowanie' });

  try {
    const user = userSvc.getUserByUsername(username);
    if (!user || !user.active) return res.status(401).json({ error: 'Sesja wygasła, zaloguj się ponownie' });
    req.user = user;
    next();
  } catch(e) {
    res.status(401).json({ error: e.message });
  }
};
