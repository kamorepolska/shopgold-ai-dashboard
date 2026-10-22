const fs = require('fs');
const filePath = 'frontend/js/sourcing.js';
let c = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// 1. Add condition and warranty to CMP_COL_DEFS (compare table) - first occurrence
const cmpColDefs1 = "{key:'signal', label:'Sygnał'}\n    ];";
let idx1 = c.indexOf(cmpColDefs1);
if (idx1 >= 0) {
  c = c.substring(0, idx1) + "{key:'signal', label:'Sygnał'},\n      {key:'condition', label:'Stan'},\n      {key:'warranty', label:'Gwarancja'}\n    ];" + c.substring(idx1 + cmpColDefs1.length);
  changes++;
  console.log('1. First CMP_COL_DEFS');
}

// 2. Second CMP_COL_DEFS (in cmp-cols-btn handler)
const cmpColDefs2 = "{key:'signal', label:'Sygnał'}\n      ];";
let idx2 = c.indexOf(cmpColDefs2);
if (idx2 >= 0) {
  c = c.substring(0, idx2) + "{key:'signal', label:'Sygnał'},\n        {key:'condition', label:'Stan'},\n        {key:'warranty', label:'Gwarancja'}\n      ];" + c.substring(idx2 + cmpColDefs2.length);
  changes++;
  console.log('2. Second CMP_COL_DEFS');
}

// 3. Add condition/warranty cell rendering to cmpCell - find the default case
const cmpDefault = "        default: \n          if (key.startsWith('sup_'))";
if (c.includes(cmpDefault)) {
  c = c.replace(cmpDefault, `        case 'condition': {
          const cond = r.condition || 'new';
          if (cond === 'used') return \`<td style="text-align:center"><span style="display:inline-flex;align-items:center;gap:3px;background:#f59e0b22;color:#f59e0b;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap">\u{1F536} Używany</span></td>\`;
          return '<td style="text-align:center;color:var(--text-muted);font-size:.72rem">Nowy</td>';
        }
        case 'warranty': return \`<td style="font-size:.78rem;color:var(--text-secondary)">\${r.warranty ? escHtml(r.warranty) : '—'}</td>\`;
        default: 
          if (key.startsWith('sup_'))`);
  changes++;
  console.log('3. cmpCell condition/warranty');
}

// 4. Add to PROMO_COL_DEFS
const promoLast = "    { key:'sell_price',   label:'C. sprzedaży' },\n  ];";
if (c.includes(promoLast)) {
  c = c.replace(promoLast, "    { key:'sell_price',   label:'C. sprzedaży' },\n    { key:'condition',    label:'Stan'         },\n    { key:'warranty',     label:'Gwarancja'    },\n  ];");
  changes++;
  console.log('4. PROMO_COL_DEFS');
}

// 5. Add to MISSING_COL_DEFS
const misLast = "        { key:'availability', label:'Dostepnosc'          },\n      ];";
if (c.includes(misLast)) {
  c = c.replace(misLast, "        { key:'availability', label:'Dostepnosc'          },\n        { key:'condition',    label:'Stan'                  },\n        { key:'warranty',     label:'Gwarancja'             },\n      ];");
  changes++;
  console.log('5. MISSING_COL_DEFS');
}

// 6. Add to misCell 
const misCellDefault = "          default:             return '<td></td>';";
const misCellIdx = c.indexOf(misCellDefault);
if (misCellIdx >= 0) {
  const condWar = `          case 'condition': {
            const cond = r.condition || 'new';
            if (cond === 'used') return \`<td style="text-align:center"><span style="display:inline-flex;align-items:center;gap:3px;background:#f59e0b22;color:#f59e0b;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap">\u{1F536} Używany</span></td>\`;
            return '<td style="text-align:center;color:var(--text-muted);font-size:.72rem">Nowy</td>';
          }
          case 'warranty':     return \`<td style="font-size:.78rem;color:var(--text-secondary)">\${r.warranty ? escHtml(r.warranty) : '—'}</td>\`;
`;
  // Check if already there
  if (!c.substring(misCellIdx - 100, misCellIdx).includes("case 'condition'")) {
    c = c.substring(0, misCellIdx) + condWar + c.substring(misCellIdx);
    changes++;
    console.log('6. misCell condition/warranty');
  }
}

fs.writeFileSync(filePath, c);
console.log(`\nDone! Applied ${changes} frontend changes.`);
