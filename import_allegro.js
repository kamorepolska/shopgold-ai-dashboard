const XLSX = require('xlsx');
const db = require('better-sqlite3')('./data/idealpc/profitability.db');

const files = [
  'documentation/marketplace/Stawki_Prowizji_Allegro_Poprawione.xlsx',
  'documentation/marketplace/Stawki_Prowizji_Allegro_Poprawione (1).xlsx',
  'documentation/marketplace/Stawki_Prowizji_Allegro_Poprawione (2).xlsx'
];

const platform = db.prepare('SELECT id FROM prof_platforms WHERE name LIKE \'%Allegro%\'').get();
if (!platform) throw new Error('Allegro not found');
const pid = platform.id;

console.log('Deleting existing commissions for Allegro (pid: ' + pid + ')');
db.prepare('DELETE FROM prof_commissions WHERE platform_id = ?').run(pid);

const ins = db.prepare('INSERT INTO prof_commissions (platform_id, category_name, rate_pct, min_fee, max_fee) VALUES (?, ?, ?, ?, ?)');

let count = 0;
db.transaction(() => {
  for (const file of files) {
    const wb = XLSX.readFile(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);
    
    for (const row of rows) {
      let cat = row['Ścieżka Kategorii'] || row['Kategoria'];
      let text = row['Stawka Prowizji (netto)'] || row['Stawka'];
      if (!cat || !text) continue;
      
      cat = cat.trim();
      text = text.toString().toLowerCase();
      
      let rate = 0;
      let maxFee = null;
      
      const pctMatch = text.match(/([0-9.,]+)\s*%/);
      if (pctMatch) {
        rate = parseFloat(pctMatch[1].replace(',', '.'));
      }
      
      const maxMatch = text.match(/(?:nie wi[ęe]cej ni[żz]|maksymalnie)\s*([0-9.,]+)\s*z[łl]/);
      if (maxMatch) {
        maxFee = parseFloat(maxMatch[1].replace(',', '.'));
      }
      
      if (rate > 0) {
        ins.run(pid, cat, rate, 0, maxFee);
        count++;
      }
    }
  }
})();

console.log('Inserted ' + count + ' commissions for Allegro.');
