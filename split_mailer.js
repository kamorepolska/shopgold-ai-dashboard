const fs = require('fs');
const h = fs.readFileSync('frontend/MAILER.html', 'utf8');

const startTag = '<script type="text/babel" data-presets="react">';
const endTag = '</script>';
const start = h.indexOf(startTag);
const end = h.lastIndexOf(endTag);
const before = h.slice(0, start);
const after = h.slice(end + endTag.length);
const babelContent = h.slice(start + startTag.length, end);

// Split into chunks at comment section markers
const sectionMarkers = [
  '// ICONS',
  '// UTILITIES',
  '// CAMPAIGN WIZARD',
  '// DASHBOARD',
  '// CAMPAIGNS VIEW',
  '// AUTOMATIONS',
  '// CONTACT DRAWER',
  '// CONTACTS VIEW',
  '// EMAIL OPENS VIEW',
  '// FUNNEL',
  '// TEMPLATES VIEW',
  '// SIDEBAR',
  '// MAIN APP',
  '// GLOBAL STYLES',
];

let result = before;
let remaining = babelContent;

for (const sec of sectionMarkers) {
  // Find the full line with the section marker (with the === lines)
  const divider = '// ============================================================\n' + sec;
  const idx = remaining.indexOf(divider);
  if (idx > 0) {
    const chunk = remaining.slice(0, idx).trim();
    if (chunk) {
      result += '\n<script type="text/babel" data-presets="react">\n' + chunk + '\n</script>\n';
    }
    remaining = remaining.slice(idx);
  }
}

// Last chunk
const lastChunk = remaining.trim();
if (lastChunk) {
  result += '\n<script type="text/babel" data-presets="react">\n' + lastChunk + '\n</script>';
}
result += after;

fs.writeFileSync('frontend/MAILER.html', result, 'utf8');
const scriptCount = (result.match(/type="text\/babel"/g) || []).length;
console.log('Done. Babel script tags:', scriptCount, 'Total size:', result.length);
