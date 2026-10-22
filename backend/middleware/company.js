'use strict';
const path = require('path');

const COMPANIES = {
  idealpc: { id: 'idealpc', name: 'IdealPC' },
  prymus:  { id: 'prymus',  name: 'Prymus.store' },
  kamore:  { id: 'kamore',  name: 'Kamore' },
};

module.exports = function companyMiddleware(req, res, next) {
  const raw = (req.headers['x-company'] || 'idealpc').toLowerCase().replace(/[^a-z0-9]/g, '');
  const company = COMPANIES[raw] ? raw : 'idealpc';
  req.company = company;
  req.companyName = COMPANIES[company].name;
  req.dataDir = path.join(__dirname, '../../data', company);
  next();
};
