const fs = require('fs');
const lines = fs.readFileSync('frontend/js/pim.js', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('bx-gen-btn')) console.log(`${i+1}: ${l}`);
});
