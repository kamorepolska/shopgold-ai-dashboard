const fs = require('fs');
const path = require('path');
const db = require('./backend/services/sourcingService').getDb();

console.log('Fetching unique raw attributes from supplier_products...');
const allKeysMap = new Map(); // key -> usage count
const allRows = db.prepare("SELECT attributes FROM supplier_products WHERE attributes IS NOT NULL AND attributes != '{}' AND attributes != ''").all();

for (const r of allRows) {
  try {
    const obj = JSON.parse(r.attributes);
    Object.keys(obj).forEach(k => {
      const trimmed = k.trim();
      if (trimmed.length >= 2) {
        allKeysMap.set(trimmed, (allKeysMap.get(trimmed) || 0) + 1);
      }
    });
  } catch(_) {}
}

console.log(`Found ${allKeysMap.size} unique attribute keys in supplier_products.`);

// Fetch from category_attributes
const catAttrs = db.prepare("SELECT DISTINCT attr_name FROM category_attributes").all().map(r => r.attr_name);
console.log(`Found ${catAttrs.length} unique attribute names in category_attributes.`);

// Fetch existing aliases
const existingAliases = db.prepare("SELECT alias, canonical_name FROM attr_aliases").all();
console.log(`Found ${existingAliases.length} existing alias entries in attr_aliases.`);

// We want to find clusters of similar attributes
const allUniqueNames = new Set([...allKeysMap.keys(), ...catAttrs, ...existingAliases.map(a => a.alias), ...existingAliases.map(a => a.canonical_name)]);
const nameList = [...allUniqueNames].sort();

console.log(`Total unique names to analyze: ${nameList.length}`);

// Simple similarity clustering
const groups = {};

function cleanWord(w) {
  return w.toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
    .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ż/g,'z').replace(/ź/g,'z')
    .replace(/[^a-z0-9]+/g, '');
}

// Find potential clusters of Polish attributes
const keywords = [
  { key: 'dlugosc', words: ['długość', 'dlugosc', 'długości', 'dł.'] },
  { key: 'szerokosc', words: ['szerokość', 'szerokosc', 'szerokości', 'szer.'] },
  { key: 'wysokosc', words: ['wysokość', 'wysokosc', 'wysokości', 'wys.'] },
  { key: 'glebokosc', words: ['głębokość', 'glebokosc', 'głębokości', 'głęb.'] },
  { key: 'waga', words: ['waga', 'ciężar', 'ciezar', 'weight', 'masa'] },
  { key: 'kabel', words: ['kabel', 'kabla', 'przewód', 'przewodu', 'cable', 'cord'] },
  { key: 'kolor', words: ['kolor', 'barwa', 'color', 'colour'] },
  { key: 'taktowanie', words: ['taktowanie', 'częstotliwość', 'czestotliwosc', 'clock', 'frequency'] },
  { key: 'socket', words: ['socket', 'gniazdo', 'podstawka', 'lga'] },
  { key: 'rdzen', words: ['rdzeń', 'rdzenie', 'rdzeni', 'cores', 'core'] },
  { key: 'pamiec', words: ['pamięć', 'pamiec', 'ram', 'memory'] },
  { key: 'napiecie', words: ['napięcie', 'napiecie', 'voltage'] },
  { key: 'moc', words: ['moc', 'power', 'watts'] },
  { key: 'pojemnosc', words: ['pojemność', 'pojemnosc', 'capacity'] },
  { key: 'interfejs', words: ['interfejs', 'interface', 'złącze', 'zlacze', 'port'] }
];

const clusters = {};
keywords.forEach(kw => {
  clusters[kw.key] = {
    canonical: kw.words[0],
    matches: []
  };
});

nameList.forEach(name => {
  const lower = name.toLowerCase();
  keywords.forEach(kw => {
    const isMatch = kw.words.some(word => {
      if (word.length <= 3) {
        return lower.startsWith(word) || new RegExp(`\\b${word}`).test(lower);
      }
      return lower.includes(word);
    });
    if (isMatch) {
      const usage = allKeysMap.get(name) || 0;
      clusters[kw.key].matches.push({ name, usage });
    }
  });
});

// Let's generate a markdown report
let report = `# Analiza Cech i Sugestie Scalania w Katalogu\n\n`;
report += `Analiza przeprowadzona automatycznie na podstawie unikalnych atrybutów w bazie danych \`shopgold_cache.db\`.\n\n`;
report += `* **Unikalne cechy z hurtowni (supplier_products):** ${allKeysMap.size}\n`;
report += `* **Ujednolicone cechy kategorii (category_attributes):** ${catAttrs.length}\n`;
report += `* **Zdefiniowane aliasy (attr_aliases):** ${existingAliases.length}\n\n`;

report += `## Propozycje Grup Scalania\n\n`;
report += `Poniżej przedstawiono zidentyfikowane grupy cech o wysokim prawdopodobieństwie pokrewieństwa semantycznego, które mogą zostać ze sobą scalone (lub zmapowane jako aliasy do jednej nazwy kanonicznej).\n\n`;

keywords.forEach(kw => {
  const cluster = clusters[kw.key];
  if (cluster.matches.length > 1) {
    report += `### 📂 Grupa: ${kw.key.toUpperCase()} (np. *${cluster.canonical}*)\n`;
    report += `Poniższe cechy można zmapować do wspólnej nazwy, np. **\`${cluster.canonical.charAt(0).toUpperCase() + cluster.canonical.slice(1)}\`** (lub bardziej szczegółowej, np. **\`Długość kabla\`** dla połączenia cech *kabel* i *długość*):\n\n`;
    
    cluster.matches.sort((a, b) => b.usage - a.usage);
    
    report += `| Nazwa cechy | Liczba użyć w bazie | Status / Sugestia |\n`;
    report += `| :--- | :---: | :--- |\n`;
    cluster.matches.forEach(m => {
      let status = '';
      const isAlias = existingAliases.find(a => a.alias === m.name);
      if (isAlias) {
        status = `✓ Alias do *${isAlias.canonical_name}*`;
      } else {
        status = `⚠️ Surowa cecha -> **Scalić**`;
      }
      report += `| \`${m.name}\` | ${m.usage} | ${status} |\n`;
    });
    report += `\n`;
  }
});

report += `## 🔌 Szczegółowa Analiza: Długość vs Długość kabla\n\n`;
report += `Użytkownik wskazał na potrzebę scalenia cech takich jak **Długość** oraz **Długość kabla** (lub **Długość przewodu**).\n\n`;
report += `W branży IT/elektroniki cechy te mają znaczenie zależne od kontekstu (kategorii produktu):\n`;
report += `1. **W kategoriach typu obudowy, karty graficzne, płyty główne:** *Długość* (lub *Długość karty*, *Głębokość*) oznacza wymiar fizyczny urządzenia.\n`;
report += `2. **W kategoriach typu kable, przedłużacze, myszki, słuchawki, zasilacze:** *Długość* (często podawana jako po prostu "Długość" w specyfikacji kabla) oznacza faktycznie **Długość kabla**.\n\n`;

report += `> [!IMPORTANT]\n`;
report += `> **Rekomendacja scalania kontekstowego:**\n`;
report += `> W Menedżerze Cech (Feature Manager) możemy scalić te cechy globalnie lub przypisać je jako aliasy do odpowiednich cech w konkretnych kategoriach.\n`;
report += `> Sugerujemy scalenie:\n`;
report += `> - \`Długość kabla\`, \`Długość kabla (m)\`, \`Długość przewodu\`, \`Długość kabla (cm)\`, \`Długość\` (w kategoriach okablowania/peryferiów) -> **\`Długość kabla\`**\n`;
report += `> - \`Długość\`, \`Długość (mm)\`, \`Długość produktu\` (w kategoriach podzespołów) -> **\`Długość\`** (wymiar gabarytowy)\n\n`;

report += `## ⚙️ Jak wykonać scalenie w Menedżerze Cech?\n\n`;
report += `1. Otwórz panel **Sourcing** -> **Katalog Master**.\n`;
report += `2. Kliknij przycisk **🤖 Filtry** (lub przejdź do Menedżera Cech).\n`;
report += `3. Zaznacz pozycje (np. \`Długość kabla\` oraz \`Długość przewodu\`).\n`;
report += `4. W panelu scalania u dołu wpisz docelową nazwę kanoniczną: **\`Długość kabla\`**.\n`;
report += `5. Kliknij przycisk **🔗 Scal**.\n\n`;

fs.writeFileSync('C:/Users/USER/.gemini/antigravity/brain/cb531b07-aab6-4efd-aa49-329c83be1597/analiza_cech_hurtowni.md', report, 'utf8');
console.log('Report written successfully!');
