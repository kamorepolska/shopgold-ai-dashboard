const fs = require('fs');
const h = fs.readFileSync('frontend/MAILER.html', 'utf8');
const sc = h.lastIndexOf('<script>');
const ec = h.lastIndexOf('</script>');
const js = h.slice(h.indexOf('>', sc) + 1, ec);

// Find the syntax error - look for unmatched braces near the replacement
const lines = js.split('\n');
let depth = 0;
let errLine = -1;
for (let i = 0; i < lines.length; i++) {
  for (const c of lines[i]) {
    if (c === '{' || c === '(' || c === '[') depth++;
    if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth < 0) { errLine = i; break; }
    }
  }
  if (errLine >= 0) break;
}
console.log('Error near line:', errLine + 1);
if (errLine >= 0) {
  console.log('Context:');
  lines.slice(Math.max(0, errLine-3), errLine+5).forEach((l, i) => 
    console.log(errLine-3+i+1, ':', l.slice(0, 120))
  );
}
// Also try Node to get actual error
try {
  new Function(js);
  console.log('Syntax OK!');
} catch(e) {
  console.log('Syntax error:', e.message);
}
