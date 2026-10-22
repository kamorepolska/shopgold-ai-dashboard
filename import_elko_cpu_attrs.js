/**
 * import_elko_cpu_attrs.js
 * 
 * Imports 42 meaningful CPU attributes from "elko cechy.xlsx" 
 * into category_attributes table for the CPU/Procesory category.
 * 
 * Run: node import_elko_cpu_attrs.js
 * Add --dry-run to only preview without writing to DB.
 */
const path = require('path');
const fs   = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data', 'shopgold_cache.db');
const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) console.log('=== DRY RUN MODE — no DB writes ===\n');

const db = new Database(DB_PATH, { readonly: DRY_RUN });

// ── 1. Show available categories (to help find CPU category) ─────────────────
const cats = db.prepare("SELECT id, name, parent_id FROM product_categories ORDER BY name").all();
console.log(`Total categories in DB: ${cats.length}`);

// Find CPU/processor category
const cpuCandidates = cats.filter(c =>
  /procesor|cpu|computer.*component|komponent|desktop.*cpu/i.test(c.name)
);
console.log('\nCPU-related categories found:');
cpuCandidates.forEach(c => console.log(`  id=${c.id} name="${c.name}" parent_id=${c.parent_id}`));

if (cpuCandidates.length === 0) {
  console.log('\nNo CPU category found. All categories:');
  cats.slice(0, 30).forEach(c => console.log(`  id=${c.id} name="${c.name}"`));
}

// ── 2. Define attributes to import ───────────────────────────────────────────
// Curated list: technical specs only, no metadata/logistics
// Format: { name, unit, notes }
const ATTRS_TO_IMPORT = [
  // Core specs
  { name: 'Typ procesora',                                          unit: null  },
  { name: 'Model procesora',                                        unit: null  },
  { name: 'Numer modelu',                                           unit: null  },
  { name: 'Nazwa rodziny procesorów',                               unit: null  },
  { name: 'Generowanie procesora',                                  unit: null  },
  { name: 'Producent procesora',                                    unit: null  },
  { name: 'Gniazdo procesora',                                      unit: null  },
  { name: 'Litografia procesora',                                   unit: 'nm'  },
  { name: 'Liczba rdzeni procesora',                                unit: null  },
  { name: 'Liczba wątków',                                          unit: null  },
  // Clocks
  { name: 'Częstotliwość bazowa procesora',                         unit: 'GHz' },
  { name: 'Maksymalne taktowanie procesora',                        unit: 'GHz' },
  // Cache
  { name: 'Cache procesora',                                        unit: 'MB'  },
  { name: 'Cache L2',                                               unit: 'MB'  },
  { name: 'pamięć podręczna L1',                                    unit: 'MB'  },
  { name: 'Typ pamięci procesora',                                  unit: null  },
  // Memory
  { name: 'Typy pamięci wspierane przez procesor',                  unit: null  },
  { name: 'Taktowanie zegara pamięci wspierane przez procesor',     unit: 'MHz' },
  { name: 'Obsługa kanałów pamięci',                                unit: null  },
  { name: 'Maksymalna pamięć wewnętrzna wspierana przez procesor',  unit: 'GB'  },
  // TDP / Thermal
  { name: 'Termiczny układ zasilania (TDP)',                        unit: 'W'   },
  { name: 'Konfigurowalne niższe TDP',                              unit: 'W'   },
  { name: 'Konfigurowalne wyższe TDP',                              unit: 'W'   },
  { name: 'Maksymalna temperatura eksploatacji',                    unit: '°C'  },
  { name: 'Zawiera system chłodzący',                               unit: null  },
  // Graphics
  { name: 'Karta graficzna on-board',                               unit: null  },
  { name: 'Model karty graficznej on-board',                        unit: null  },
  { name: 'Wbudowana bazowa częstotliwość procesora',               unit: 'MHz' },
  { name: 'Dynamiczne taktowanie wbudowanej karty graficznej (max)', unit: 'MHz' },
  { name: 'Dedykowana karta graficzna',                             unit: null  },
  { name: 'Model dedykowanej karty graficznej',                     unit: null  },
  // Connectivity
  { name: 'Wersja gniazd typu Slot (PCI Express)',                  unit: null  },
  { name: 'Maksymalna liczba linii PCI Express',                    unit: null  },
  { name: 'Wersja USB',                                             unit: null  },
  { name: 'Ilość portów USB',                                       unit: null  },
  // Memory features
  { name: 'Korekcja ECC',                                           unit: null  },
  { name: 'Nie-ECC',                                                unit: null  },
  // Processing
  { name: 'Tryb pracy procesora',                                   unit: null  },
  { name: 'Instrukcje obsługiwania',                                unit: null  },
  { name: 'Technologia Intel® Hyper Threading (Intel® HT Technology)', unit: null },
  // Market
  { name: 'Segment rynku',                                          unit: null  },
  { name: 'Przeznaczenie',                                          unit: null  },
];

console.log(`\nAttributes to import: ${ATTRS_TO_IMPORT.length}`);

// ── 3. Determine target category ─────────────────────────────────────────────
let targetCatId = null;

if (cpuCandidates.length === 1) {
  targetCatId = cpuCandidates[0].id;
  console.log(`\nAuto-selected CPU category: id=${targetCatId} "${cpuCandidates[0].name}"`);
} else if (cpuCandidates.length > 1) {
  // Pick the most specific one (deepest in hierarchy / no children or smallest id)
  targetCatId = cpuCandidates[0].id;
  console.log(`\nMultiple CPU categories — using first: id=${targetCatId} "${cpuCandidates[0].name}"`);
  console.log('  (you can change TARGET_CATEGORY_ID at the top of this script)');
} else {
  // No CPU category found — list all for user to pick
  console.log('\n⚠ No CPU category found. Please check the list above and set TARGET_CATEGORY_ID manually.');
  console.log('  Edit this script: const TARGET_CATEGORY_ID = <id>;');
  // Try to find any electronics/components category
  const fallback = cats.find(c => /elektron|komponent|sprzet|hardware|it /i.test(c.name));
  if (fallback) {
    targetCatId = fallback.id;
    console.log(`  Using fallback: id=${fallback.id} "${fallback.name}"`);
  }
}

// ── Allow manual override ─────────────────────────────────────────────────────
// Uncomment and set to force a specific category:
// targetCatId = 42;

if (!targetCatId) {
  console.error('\n❌ Cannot determine target category. Exiting. Edit script to set targetCatId manually.');
  db.close();
  process.exit(1);
}

// ── 4. Check existing attributes for this category ───────────────────────────
const existing = db.prepare('SELECT attr_name FROM category_attributes WHERE category_id = ?').all(targetCatId);
const existingNames = new Set(existing.map(r => r.attr_name));
console.log(`\nExisting attributes for category ${targetCatId}: ${existingNames.size}`);
if (existingNames.size > 0) {
  console.log('  Existing:', [...existingNames].join(', '));
}

// ── 5. Insert missing attributes ─────────────────────────────────────────────
const toInsert = ATTRS_TO_IMPORT.filter(a => !existingNames.has(a.name));
const alreadyExist = ATTRS_TO_IMPORT.filter(a => existingNames.has(a.name));

console.log(`\nAlready exists: ${alreadyExist.length}`);
if (alreadyExist.length > 0) console.log('  ' + alreadyExist.map(a => a.name).join(', '));

console.log(`\nTo insert: ${toInsert.length}`);
toInsert.forEach((a, i) => console.log(`  ${i+1}. "${a.name}"${a.unit ? ' [' + a.unit + ']' : ''}`));

if (DRY_RUN) {
  console.log('\n=== DRY RUN complete — run without --dry-run to apply ===');
  db.close();
  process.exit(0);
}

if (toInsert.length === 0) {
  console.log('\n✅ All attributes already exist in category_attributes. Nothing to do.');
  db.close();
  process.exit(0);
}

// Execute inserts
const insertStmt = db.prepare(
  'INSERT OR IGNORE INTO category_attributes (category_id, attr_name, attr_unit) VALUES (?, ?, ?)'
);

const insertMany = db.transaction(() => {
  let count = 0;
  for (const attr of toInsert) {
    const result = insertStmt.run(targetCatId, attr.name, attr.unit || null);
    if (result.changes > 0) count++;
  }
  return count;
});

try {
  const inserted = insertMany();
  console.log(`\n✅ Inserted ${inserted} new attributes into category_id=${targetCatId}`);
} catch(e) {
  console.error('❌ Insert failed:', e.message);
  db.close();
  process.exit(1);
}

// ── 6. Also add to attr_aliases so they show up in Attr Manager ──────────────
// Each attr name maps to itself as canonical (so it's "mapped")
const aliasStmt = db.prepare(
  'INSERT OR IGNORE INTO attr_aliases (alias, canonical_name) VALUES (?, ?)'
);
const insertAliases = db.transaction(() => {
  let count = 0;
  for (const attr of toInsert) {
    const result = aliasStmt.run(attr.name, attr.name);
    if (result.changes > 0) count++;
  }
  return count;
});

try {
  const aliasCount = insertAliases();
  console.log(`✅ Added ${aliasCount} entries to attr_aliases`);
} catch(e) {
  console.log('(attr_aliases insert skipped:', e.message, ')');
}

db.close();

// ── 7. Summary ────────────────────────────────────────────────────────────────
console.log('\n════ DONE ════');
console.log(`Category: ${targetCatId}`);
console.log(`Attributes added: ${toInsert.length}`);
console.log('\nRefresh the Attr Manager in the dashboard to see new attributes.');
console.log('Next step: use the Attr Manager to map EAN-based ELKO products to these attributes.');
