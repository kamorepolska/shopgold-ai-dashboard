const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');
const db = require('better-sqlite3')(path.join(__dirname, '..', 'data', 'idealpc', 'shopgold_cache.db'));

const sup = db.prepare('SELECT * FROM suppliers WHERE id = 15').get();
console.log('Kosatec file_path:', sup.file_path);

// Find cached files
const uploadsDir = path.join(__dirname, '..', 'data', 'sourcing_uploads');
const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith('ftp_15_') || f.startsWith('url_15_')).sort().reverse();
console.log('Cached files:', files);

// Try the main file_path
let filePath = sup.file_path;
if (!filePath || !fs.existsSync(filePath)) {
  if (files.length) filePath = path.join(uploadsDir, files[0]);
}

if (!filePath || !fs.existsSync(filePath)) {
  console.log('No file found!');
  process.exit(1);
}

console.log(`\nReading: ${filePath}`);
const ext = path.extname(filePath).toLowerCase();
console.log('Extension:', ext);
const stat = fs.statSync(filePath);
console.log('Size:', (stat.size / 1024).toFixed(1), 'KB');

// Read first 3000 bytes
const buf = fs.readFileSync(filePath);
let text;
try {
  text = iconv.decode(buf.slice(0, 5000), 'utf8');
} catch(_) {
  text = iconv.decode(buf.slice(0, 5000), 'win1250');
}

console.log('\n=== First 2000 chars ===');
console.log(text.substring(0, 2000));

// Check if it's XML
if (text.trim().startsWith('<?xml') || text.trim().startsWith('<')) {
  console.log('\n>>> This appears to be XML');
  // Show structure
  const tagPattern = /<([a-zA-Z_][a-zA-Z0-9_:.-]*)/g;
  const tags = new Set();
  let m;
  const fullText = iconv.decode(buf.slice(0, 50000), 'utf8');
  while ((m = tagPattern.exec(fullText)) !== null) tags.add(m[1]);
  console.log('Tags:', [...tags].join(', '));
}

// Check if it's CSV-like
const lines = text.split('\n');
console.log('\n=== First 5 lines ===');
lines.slice(0, 5).forEach((l, i) => console.log(`[${i}] ${l.substring(0, 200)}`));
