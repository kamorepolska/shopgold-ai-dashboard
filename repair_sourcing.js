/**
 * repair_sourcing.js - naprawia problemy z kodowaniem w sourcing.js
 * Używa string.replace() zamiast edycji wierszy
 * Uruchom: node repair_sourcing.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/js/sourcing.js');
let src = fs.readFileSync(file, 'utf8');
let changes = 0;

function replace(search, replacement, desc) {
  if (src.includes(search)) {
    src = src.replace(search, replacement);
    console.log('✅', desc);
    changes++;
  } else {
    console.log('⏭️  Już naprawione lub nie znalezione:', desc);
  }
}

// 1. Napraw â–˛/â–Ľ w template HTML (linia ~259)
replace(
  `logsExpanded?'â–˛':'â–Ľ'`,
  `logsExpanded?'&#x25B2;':'&#x25BC;'`,
  'Naprawa strzałek ▲▼ w templatce HTML'
);

// 2. Napraw â–˛/â–Ľ w textContent przypisaniu (linia ~402)
replace(
  `(logsExpanded?'â–˛':'â–Ľ') + ' Logi operacji'`,
  `(logsExpanded?'&#x25B2;':'&#x25BC;') + ' Logi operacji'`,
  'Naprawa strzałek ▲▼ w textContent'
);

// 3. Napraw â†• (broken ↕) w sortIcon
replace(
  `return 'â†•';`,
  `return '&#x2195;';`,
  'Naprawa â†• → &#x2195; w sortIcon'
);

// 4. Napraw â° (broken ⚙) lub â°ï¸ w przycisku Kolumny
const gearPatterns = [
  [`return 'â°ï¸ ' + col`, `return '&#x2699;&#xFE0F; ' + col`, 'Naprawa gear emoji (pattern 1)'],
  [`'â°ï¸ Kolumny'`, `'&#x2699;&#xFE0F; Kolumny'`, 'Naprawa gear emoji (pattern 2)'],
];
gearPatterns.forEach(([s, r, d]) => replace(s, r, d));

// 5. Napraw â­ (broken ⭐) w modalu promo
replace(
  `<td>â\xad `,   // match the mojibake start (â + soft hyphen)
  `<td>&#11088; `,
  'Naprawa ⭐ w promo modal'
);

// 6. Usuń duplikat td &#11088; jeśli istnieje (dodany przez poprzedni patch)
const dupPattern = `    <td>&#11088; \${escHtml(r.best_supplier||'\u2014')}</td>\n    <td>`;
const correctPattern = `    <td>&#11088; \${escHtml(r.best_supplier||'\u2014')}</td>\n    <td class=`;
if (src.includes(dupPattern) && !src.includes(correctPattern)) {
  // There might be a duplicate td
  const dupeCheck = src.match(/<td>&#11088;[^<]+<\/td>\s*<td>[^c]/);
  if (dupeCheck) {
    console.log('⚠️  Potencjalny duplikat td wykryty - sprawdź ręcznie');
  }
}

// Sprawdź składnię
try {
  new Function(src);
  console.log('\n✅ Składnia OK po naprawach');
} catch(e) {
  console.error('\n❌ Błąd składniowy:', e.message);
  const lines = src.split('\n');
  let lo = 1, hi = lines.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    try { new Function(lines.slice(0, mid).join('\n')); lo = mid + 1; }
    catch(_) { hi = mid; }
  }
  console.error('Błąd przy linii ~', lo);
  const from = Math.max(0, lo - 5);
  lines.slice(from, Math.min(lines.length, lo + 3))
       .forEach((l, i) => console.log((from+i+1)+': '+l.slice(0, 120)));
  console.log('\nPLIK NIE ZOSTAŁ NADPISANY — napraw błąd ręcznie');
  process.exit(1);
}

if (changes > 0) {
  fs.writeFileSync(file, src, 'utf8');
  console.log(`\n💾 Zapisano plik (${changes} zmian)`);
} else {
  console.log('\nℹ️  Brak zmian — plik niezmieniony');
}
