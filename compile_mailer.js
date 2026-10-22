// compile_mailer.js — extracts JSX from MAILER.html, compiles it, outputs standalone HTML
const fs = require('fs');
const babel = require('@babel/core');

const html = fs.readFileSync('frontend/MAILER.html', 'utf8');
const start = html.indexOf('<script type="text/babel"');
const end = html.lastIndexOf('</script>');
const before = html.slice(0, start);
const after = html.slice(end + 9);
const jsxContent = html.slice(html.indexOf('>', start) + 1, end);

console.log('Compiling', jsxContent.length, 'bytes of JSX...');

const result = babel.transformSync(jsxContent, {
  presets: [
    ['@babel/preset-react', { runtime: 'classic' }],
    ['@babel/preset-env', { targets: { chrome: '90' }, modules: false }]
  ]
});

console.log('Compiled to', result.code.length, 'bytes of JS');

// Remove the 'use strict' if it causes issues
const finalJs = result.code;

const output = before
  .replace(/<script src="https:\/\/unpkg\.com\/@babel[^"]*"><\/script>/, '')
  + '<script>\n' + finalJs + '\n</script>'
  + after;

fs.writeFileSync('frontend/MAILER.html', output, 'utf8');
console.log('Written frontend/MAILER.html,', output.length, 'bytes, no Babel needed!');
