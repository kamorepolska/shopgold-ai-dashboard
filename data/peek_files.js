// Peek into the raw CSV/Excel file for AB and Action to see actual columns
const fs = require('fs');
const path = require('path');
const db = require('better-sqlite3')('data/idealpc/shopgold_cache.db');

const targets = [10, 11, 15];
for (const id of targets) {
  const s = db.prepare('SELECT name, file_path, source_url FROM suppliers WHERE id=?').get(id);
  const fp = s?.file_path;
  if (!fp || !fs.existsSync(fp)) {
    console.log(`Supplier ${id} (${s?.name}): file not found - ${fp}`);
    continue;
  }

  const ext = path.extname(fp).toLowerCase();
  console.log(`\n=== Supplier ${id} (${s?.name}) ${ext} ===`);
  
  if (ext === '.csv' || ext === '.txt') {
    const raw = fs.readFileSync(fp, 'latin1').slice(0, 2000);
    // Show first 3 lines
    const lines = raw.split('\n').slice(0, 4);
    lines.forEach((l, i) => console.log(`  Line ${i}: ${l.slice(0, 200)}`));
  } else if (ext === '.xlsx') {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(fp, { sheetRows: 3 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0 });
    rows.slice(0, 3).forEach((r, i) => console.log(`  Row ${i}: ${JSON.stringify(r).slice(0, 200)}`));
  }
}
