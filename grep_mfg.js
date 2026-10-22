const fs = require('fs');
const txt = fs.readFileSync('frontend/js/sourcing.js', 'utf8');
const lines = txt.split('\n');

// Find places where manufacturer selects/dropdowns are populated
lines.forEach((l, i) => {
  if (l.includes('mis-mfg') || l.includes('promo-mfg') || l.includes('manufacturer') && (l.includes('option') || l.includes('select') || l.includes('filter') || l.includes('dropdown'))) {
    console.log(`${i+1}: ${l.trim()}`);
  }
});
