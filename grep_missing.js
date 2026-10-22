const fs = require('fs');
['frontend/js/sourcing.js', 'backend/routes/sourcing.js', 'backend/services/sourcingService.js'].forEach(file => {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (l.toLowerCase().includes('brakuj') || l.toLowerCase().includes('missing') || l.toLowerCase().includes('not_in_shop')) {
      console.log(`${file}:${i+1}: ${l.trim()}`);
    }
  });
});
