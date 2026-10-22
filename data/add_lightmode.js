const fs = require('fs');
let data = fs.readFileSync('frontend/css/style.css', 'utf8');
const lightMode = [
  '\n/* ===== LIGHT MODE ===== */',
  'body.light-mode {',
  '  --bg-base:     #f0f2f8;',
  '  --bg-surface:  #ffffff;',
  '  --bg-elevated: #e8eaf2;',
  '  --bg-hover:    #dde0ee;',
  '  --border:      rgba(0,0,0,0.1);',
  '  --border-med:  rgba(0,0,0,0.18);',
  '  --text-primary:   #1a1c2e;',
  '  --text-secondary: #4b5068;',
  '  --text-muted:     #8b90a8;',
  '  --accent:       #6366f1;',
  '  --accent-light: #4f52d4;',
  '  --accent-glow:  rgba(99,102,241,0.15);',
  '  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);',
  '  --shadow:    0 4px 16px rgba(0,0,0,0.12);',
  '  --shadow-lg: 0 8px 32px rgba(0,0,0,0.16);',
  '}',
  '.theme-toggle-btn {',
  '  display:flex; align-items:center; justify-content:center; gap:6px;',
  '  width:100%; padding:8px 12px; background:var(--bg-hover);',
  '  border:1px solid var(--border); border-radius:var(--radius-sm);',
  '  color:var(--text-secondary); font-size:0.8rem; cursor:pointer;',
  '  transition:all var(--transition); margin-bottom:6px;',
  '}',
  '.theme-toggle-btn:hover { background:var(--bg-elevated); color:var(--text-primary); }',
  ''
].join('\n');

data = data.replace('\nhtml { font-size: 14px; }', lightMode + '\nhtml { font-size: 14px; }');
fs.writeFileSync('frontend/css/style.css', data);
console.log('Done, size:', data.length);
