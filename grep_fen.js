const fs = require('fs');
const lines = fs.readFileSync('backend/services/sourcingService.js', 'utf8').split('\n');
let found = [];
lines.forEach((l, i) => { if (l.toLowerCase().includes('fen')) found.push(`${i+1}: ${l}`); });
console.log(found.slice(0, 80).join('\n'));
