const fs = require('fs');
const js = fs.readFileSync('frontend/js/sourcing.js','utf8');
const lines = js.split('\n');
const total = lines.length;
// Remove lines from end until no error — then the last removed section contains the bug
let lo = 1, hi = total;
while (lo < hi) {
  const mid = Math.floor((lo + hi) / 2);
  try {
    new Function(lines.slice(0, mid).join('\n'));
    lo = mid + 1; // no error with this many lines → error is further down
  } catch(e) {
    hi = mid;     // error present → error is within these lines
  }
}
// lo = first line count at which error appears
const errLine = lo;
console.log('Error first appears when including line:', errLine);
const from = Math.max(0, errLine - 8);
const to   = Math.min(total, errLine + 3);
lines.slice(from, to).forEach((l, i) => console.log((from+i+1)+': '+l));
