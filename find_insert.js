const fs = require('fs');
const lines = fs.readFileSync('backend/services/sourcingService.js', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('insert') && l.toLowerCase().includes('supplier_products')) {
    console.log(`Line ${i + 1}: ${l}`);
  }
});
