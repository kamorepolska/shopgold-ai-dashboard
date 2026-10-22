const fs = require('fs');
const filePath = 'frontend/js/sourcing.js';
let c = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// Add condition/warranty columns to restock table rows
const restockAvailCell = `              <td><span class="avail-dot \${r.availability||'unknown'}"></span>\${r.availability==='available'?'Tak':r.availability==='unavailable'?'Nie':'?'}</td>\n            </tr>\``;
if (c.includes(restockAvailCell)) {
  const condWarCells = `              <td><span class="avail-dot \${r.availability||'unknown'}"></span>\${r.availability==='available'?'Tak':r.availability==='unavailable'?'Nie':'?'}</td>
              <td style="text-align:center">\${(r.condition||'new')==='used'?'<span style="display:inline-flex;align-items:center;gap:3px;background:#f59e0b22;color:#f59e0b;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap">\u{1F536} Używany</span>':'<span style="color:var(--text-muted);font-size:.72rem">Nowy</span>'}</td>
              <td style="font-size:.78rem;color:var(--text-secondary)">\${r.warranty ? escHtml(r.warranty) : '—'}</td>
            </tr>\``;
  c = c.replace(restockAvailCell, condWarCells);
  changes++;
  console.log('1. Added condition/warranty cells to restock rows');
}

// Add headers in restock table
const restockHeader = `<th>Dost.</th>\n</tr></thead>`;
if (c.includes(restockHeader)) {
  c = c.replace(restockHeader, `<th>Dost.</th><th>Stan</th><th>Gwarancja</th>\n</tr></thead>`);
  changes++;
  console.log('2. Added condition/warranty headers to restock table');
}

fs.writeFileSync(filePath, c);
console.log(`\nDone! Applied ${changes} restock changes.`);
