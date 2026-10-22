// Deep analysis of attribute extraction issues per supplier
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, '..', 'data', 'idealpc', 'shopgold_cache.db'));

// Check what files are on disk for file-based suppliers
const sups = db.prepare('SELECT * FROM suppliers WHERE is_active = 1').all();

console.log('=== FILE-BASED SUPPLIERS (checking actual file content) ===\n');

for (const s of sups) {
  if (s.source_type === 'file' && s.file_path) {
    const exists = fs.existsSync(s.file_path);
    let size = 0;
    if (exists) {
      size = fs.statSync(s.file_path).size;
    }
    console.log(`  ${s.id} ${s.name}: file_path=${s.file_path}, exists=${exists}, size=${(size/1024/1024).toFixed(2)}MB`);
    
    // Peek at file content if XML
    if (exists && s.file_path.endsWith('.xml') && size > 0) {
      const buf = fs.readFileSync(s.file_path);
      const txt = buf.toString('utf-8').substring(0, 2000);
      console.log('    Preview (first 2000 chars):');
      console.log('    ' + txt.replace(/\n/g, '\n    ').substring(0, 1000));
      
      // Check for attribute-like structures
      const hasParams = txt.includes('<parameters') || txt.includes('<attributes') || txt.includes('<properties');
      const hasFeatures = txt.includes('<features') || txt.includes('<parametry') || txt.includes('<cechy');
      const hasSpecs = txt.includes('<specification') || txt.includes('<specs') || txt.includes('<shortdata');
      console.log(`    Has attr-like tags: parameters=${hasParams}, features=${hasFeatures}, specs=${hasSpecs}`);
    }
    
    // Also check if it's an Excel
    if (exists && (s.file_path.endsWith('.xlsx') || s.file_path.endsWith('.xls'))) {
      const XLSX = require('xlsx');
      const wb = XLSX.read(fs.readFileSync(s.file_path));
      const firstSheet = wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1 });
      if (data.length > 0) {
        console.log(`    Excel headers: ${JSON.stringify(data[0]).substring(0, 300)}`);
        if (data.length > 1) {
          console.log(`    Row 1 sample: ${JSON.stringify(data[1]).substring(0, 300)}`);
        }
      }
    }
    console.log('');
  }
}

// Check FTP-based suppliers
console.log('\n=== FTP SUPPLIERS ===\n');
for (const s of sups) {
  if (s.source_type === 'ftp') {
    console.log(`  ${s.id} ${s.name}: ftp_host=${s.ftp_host}, ftp_path=${s.ftp_path}, ftp_port=${s.ftp_port}`);
    // Check if there's a cached file on disk
    const uploadDir = path.join(__dirname, '..', 'data', 'sourcing_uploads');
    if (fs.existsSync(uploadDir)) {
      const cached = fs.readdirSync(uploadDir).filter(f => f.startsWith(`ftp_${s.id}_`));
      console.log(`    Cached files: ${cached.length > 0 ? cached.join(', ') : 'none'}`);
      if (cached.length > 0) {
        const lastFile = path.join(uploadDir, cached[cached.length - 1]);
        const sz = fs.statSync(lastFile).size;
        console.log(`    Latest cached: ${lastFile}, size=${(sz/1024).toFixed(1)}KB`);
        
        // Peek at content
        const buf = fs.readFileSync(lastFile);
        const txt = buf.toString('utf-8').substring(0, 500);
        console.log(`    Preview: ${txt.substring(0, 300)}`);
      }
    }
    console.log('');
  }
}

// Check URL suppliers with 0 attrs
console.log('\n=== URL SUPPLIERS WITH 0 ATTRS ===\n');
for (const s of sups) {
  if (s.source_type === 'url') {
    const withAttrs = db.prepare("SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").get(s.id).c;
    const total = db.prepare('SELECT COUNT(*) as c FROM supplier_products WHERE supplier_id = ?').get(s.id).c;
    if (withAttrs === 0 && total > 0) {
      console.log(`  ${s.id} ${s.name}: ${total} products, 0 attrs. URL: ${(s.source_url || '').substring(0, 100)}`);
    }
  }
}

// Investigate sample attrs quality
console.log('\n=== NOISY ATTR ANALYSIS (attrs that are just internal codes) ===\n');
const noisyCheck = [
  { id: 9, name: 'EdSystem' },
  { id: 16, name: 'MCM' },
  { id: 18, name: 'Akyga' },
  { id: 23, name: 'MX' },
  { id: 24, name: 'Platinet' },
  { id: 26, name: 'Incom' },
  { id: 30, name: 'Elko' },
  { id: 35, name: 'multioffice' },
  { id: 37, name: 'NTT' },
];
for (const s of noisyCheck) {
  const sample = db.prepare("SELECT attributes FROM supplier_products WHERE supplier_id = ? AND attributes IS NOT NULL AND attributes != '{}' AND attributes != '' LIMIT 1").get(s.id);
  if (sample) {
    console.log(`  ${s.name}: ${sample.attributes.substring(0, 300)}`);
  }
}
