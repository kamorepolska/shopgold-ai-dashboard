// Quick xlsx reader - outputs to JSON file
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const wb = XLSX.readFile(path.join(__dirname, 'documentation', 'elko cechy.xlsx'));
const results = {};

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
  results[sheetName] = {
    rowCount: data.length,
    firstRows: data.slice(0, 5)
  };
}

fs.writeFileSync(
  path.join(__dirname, 'elko_xlsx_peek.json'),
  JSON.stringify(results, null, 2),
  'utf8'
);
console.log('Done - wrote elko_xlsx_peek.json');
