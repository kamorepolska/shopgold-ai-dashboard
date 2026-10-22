/**
 * emergency_repair.js - naprawia uszkodzony sourcing.js
 * Usuwa błędnie wstawiony blok kodu (linie ~896-1090) z środka template literal
 * Uruchom: node emergency_repair.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/js/sourcing.js');
let src = fs.readFileSync(file, 'utf8');

// ============================================================
// Strategia: znajdź marker początku korupcji i końca korupcji
// ============================================================

// POPRAWNA sekwencja w pliku powinna być:
//   ${supCols}
//   </tr></thead>          <-- to jest prawidłowe zamknięcie thead
//
// KORUPCJA: po pierwszym ${supCols} wstawiono ogromny blok kodu
// Blok kończy się na:
//   ${supCols}             <-- DRUGIE wystąpienie
//   </tr></thead>          <-- to jest prawidłowe zamknięcie (nadal tam jest)

// Szukamy DRUGIEGO wystąpienia "${supCols}" i usuwamy wszystko
// od PIERWSZEGO do DRUGIEGO (zachowując DRUGIE jako "właściwe")

const MARKER = '    ${supCols}';
const first = src.indexOf(MARKER);
if (first < 0) {
  console.error('Nie znaleziono ${supCols} w pliku!');
  process.exit(1);
}
const second = src.indexOf(MARKER, first + MARKER.length);
if (second < 0) {
  console.log('Tylko jedno wystąpienie ${supCols} — brak korupcji do usunięcia');
  process.exit(0);
}

console.log(`Pierwsze ${MARKER}: pozycja ${first}`);
console.log(`Drugie  ${MARKER}: pozycja ${second}`);

// Usuwamy od (first + MARKER.length) do (second + MARKER.length)
// czyli usuwamy CALĄ korrupcje (wlacznie z duplikatem markera)
const before = src.slice(0, first + MARKER.length);
const after  = src.slice(second + MARKER.length);  // pomijamy takze drugi duplikat

src = before + '\n' + after;

// ============================================================
// Walidacja składni
// ============================================================
try {
  new Function(src);
  console.log('✅ Składnia OK po naprawie');
} catch(e) {
  console.error('❌ Wciąż błąd składniowy:', e.message);
  const lines = src.split('\n');
  let lo = 1, hi = lines.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    try { new Function(lines.slice(0, mid).join('\n')); lo = mid + 1; }
    catch(_) { hi = mid; }
  }
  console.error('Błąd przy ~linii', lo);
  lines.slice(Math.max(0,lo-4), lo+2).forEach((l,i)=>console.log((lo-4+i+1)+': '+l.slice(0,100)));
  console.log('\nZapisuje mimo to — sprawdź plik ręcznie');
}

// Zapisz
fs.writeFileSync(file, src, 'utf8');
const newLines = src.split('\n').length;
console.log(`💾 Plik zapisany (${newLines} linii)`);

// Sprawdź liczbę wystąpień ${supCols} - powinno być 1
const count = (src.match(/\$\{supCols\}/g) || []).length;
console.log(`${MARKER} wystąpień po naprawie: ${count} (powinno być 1)`);
