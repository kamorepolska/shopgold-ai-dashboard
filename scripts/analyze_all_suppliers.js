// Deep analysis of all supplier files to find untapped attribute columns
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');
const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, '..', 'data', 'idealpc', 'shopgold_cache.db'));

const uploadsDir = path.join(__dirname, '..', 'data', 'sourcing_uploads');

function findLatestFile(supplierId) {
  if (!fs.existsSync(uploadsDir)) return null;
  const files = fs.readdirSync(uploadsDir)
    .filter(f => f.startsWith(`ftp_${supplierId}_`) || f.startsWith(`url_${supplierId}_`))
    .sort().reverse();
  return files.length ? path.join(uploadsDir, files[0]) : null;
}

function analyzeCSV(filePath, maxRows = 5) {
  const buf = fs.readFileSync(filePath);
  // Try UTF-8 first, then win1250
  let text;
  try {
    text = buf.toString('utf8');
    if (text.includes('�')) throw new Error('garbled');
  } catch(_) {
    text = iconv.decode(buf, 'win1250');
  }
  
  const lines = text.split('\n').filter(l => l.trim());
  const firstLine = lines[0];
  const delim = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';
  const headers = firstLine.split(delim).map(h => h.trim().replace(/^"|"$/g, ''));
  
  const samples = [];
  for (let i = 1; i <= Math.min(maxRows, lines.length - 1); i++) {
    const vals = lines[i].split(delim).map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    samples.push(row);
  }
  
  return { headers, samples, totalLines: lines.length - 1, delim: delim === '\t' ? 'TAB' : delim };
}

function analyzeXML(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').substring(0, 50000);
  // Find unique tag names
  const tagPattern = /<([a-zA-Z_][a-zA-Z0-9_:.-]*)/g;
  const tags = new Set();
  let m;
  while ((m = tagPattern.exec(text)) !== null) {
    tags.add(m[1]);
  }
  return { tags: [...tags].slice(0, 80), previewLength: Math.min(text.length, 2000) };
}

// ─── Main Analysis ───
const suppliers = db.prepare('SELECT id, name, source_type, file_path, ftp_host, ftp_path FROM suppliers WHERE is_active = 1').all();

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║          ANALIZA ATRYBUTÓW HURTOWNI                           ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

for (const sup of suppliers) {
  const total = db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ?').get(sup.id).c;
  const withAttrs = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").get(sup.id).c;
  
  let sample = null;
  try {
    const row = db.prepare("SELECT attributes FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != '' LIMIT 1").get(sup.id);
    if (row) sample = JSON.parse(row.attributes);
  } catch(_) {}
  
  const sampleKeys = sample ? Object.keys(sample) : [];
  const pct = total > 0 ? ((withAttrs / total) * 100).toFixed(1) : '0.0';
  const status = withAttrs === 0 ? '❌' : pct === '100.0' ? '✅' : '⚠️';
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${status} ${sup.name} (ID: ${sup.id}) | ${sup.source_type}`);
  console.log(`   Produkty: ${total} | Z cechami: ${withAttrs} (${pct}%)`);
  console.log(`   Klucze (${sampleKeys.length}): ${sampleKeys.slice(0, 8).join(', ')}`);
  
  // Find the actual file
  let filePath = sup.file_path || findLatestFile(sup.id);
  if (!filePath || !fs.existsSync(filePath)) {
    filePath = findLatestFile(sup.id);
  }
  
  if (filePath && fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const size = (fs.statSync(filePath).size / 1024).toFixed(1);
    console.log(`   Plik: ${path.basename(filePath)} (${size} KB)`);
    
    if (ext === '.csv' || ext === '.txt') {
      try {
        const analysis = analyzeCSV(filePath);
        console.log(`   Kolumny (${analysis.headers.length}): ${analysis.headers.join(' | ')}`);
        
        // Identify mapped vs potential attribute columns
        const mappedKeys = ['ean', 'EAN', 'name', 'nazwa', 'price', 'cena', 'stock', 'quantity', 'stan', 'manufacturer', 'producent', 'sku', 'kod'];
        const potentialAttrs = analysis.headers.filter(h => {
          const lh = h.toLowerCase();
          return !mappedKeys.some(mk => lh.includes(mk.toLowerCase())) && h.length > 1;
        });
        
        if (potentialAttrs.length > 0) {
          console.log(`   💡 POTENCJALNE CECHY (${potentialAttrs.length}):`);
          potentialAttrs.forEach(h => {
            const sampleVals = analysis.samples.map(s => s[h]).filter(Boolean).slice(0, 3);
            console.log(`      • ${h}: ${sampleVals.join(' | ') || '(puste)'}`);
          });
        }
      } catch(e) {
        console.log(`   ⚠️ Błąd analizy CSV: ${e.message}`);
      }
    } else if (ext === '.xml') {
      try {
        const analysis = analyzeXML(filePath);
        console.log(`   Tagi XML (${analysis.tags.length}): ${analysis.tags.slice(0, 20).join(', ')}`);
      } catch(e) {
        console.log(`   ⚠️ Błąd analizy XML: ${e.message}`);
      }
    } else if (ext === '.zip') {
      console.log(`   📦 Plik ZIP — wymaga rozpakowania`);
    }
  } else {
    console.log(`   ⚠️ Brak pliku na dysku`);
  }
}

// Summary
console.log(`\n${'═'.repeat(60)}`);
console.log('PODSUMOWANIE:');
const noAttrs = suppliers.filter(s => {
  const c = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").get(s.id).c;
  return c === 0;
});
console.log(`Hurtownie bez atrybutów: ${noAttrs.map(s => s.name).join(', ') || 'BRAK'}`);
