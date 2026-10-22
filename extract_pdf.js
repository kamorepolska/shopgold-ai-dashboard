const fs = require('fs');
const path = require('path');

// Simple PDF text extraction - look for text between BT and ET operators
const pdfPath = path.join(__dirname, 'documentation', 'DokumentacjaRESTAPIv1.10IMPAKT.pdf');
const buf = fs.readFileSync(pdfPath);
const text = buf.toString('latin1');

// Extract readable strings
const readable = [];
const lines = text.split('\n');
for (const line of lines) {
  // Look for text in parentheses (PDF text objects)
  const matches = line.match(/\(([^)]+)\)/g);
  if (matches) {
    for (const m of matches) {
      const inner = m.slice(1, -1);
      if (inner.length > 2 && /[a-zA-Z]/.test(inner)) {
        readable.push(inner);
      }
    }
  }
}

// Also try to find URL patterns
const urlMatches = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/g);
if (urlMatches) {
  console.log('=== URLs found ===');
  [...new Set(urlMatches)].forEach(u => console.log(u));
}

console.log('\n=== Readable text ===');
console.log(readable.join('\n'));
