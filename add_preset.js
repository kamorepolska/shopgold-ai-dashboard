const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data/shopgold_cache.db');
const db = new Database(DB_PATH);

const existingSeo = db.prepare("SELECT id FROM prompt_presets WHERE name = 'SEO: Tylko Meta Tagi i LD+JSON'").get();
if (!existingSeo) {
  db.prepare(`
    INSERT INTO prompt_presets (id, name, system_prompt, user_prompt_template, fields, is_default)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(
    uuidv4(),
    'SEO: Tylko Meta Tagi i LD+JSON',
    `Jesteś ekspertem ds. SEO technicznego. Wygenerujesz tylko zoptymalizowane meta tagi oraz ustrukturyzowane dane schema.org (LD+JSON) dla podanego produktu. 
Zwracaj WYŁĄCZNIE czysty JSON. Żadnego dodatkowego tekstu.`,
    `Na podstawie poniższych danych produktu:
Nazwa: {{name}}
Kategoria: {{category}}
Parametry: {{attributes}}
Cena: {{price}} zł
Opis źródłowy: {{description}}

INSTRUKCJE:
1. Skopiuj tekst z sekcji "Opis źródłowy" i nie zmieniaj w nim ani jednego słowa marketingowego.
2. Na samym końcu skopiowanego opisu doklej zminifikowany blok <script type="application/ld+json"> ze schematem Product (w tym nazwa, krótki opis, cechy i offer z price).
3. Wygeneruj nowe, zoptymalizowane meta_title (max 60 znaków) oraz meta_description (max 155 znaków, wzywające do akcji).

Zwróć w formacie JSON:
{
  "meta_title": "...",
  "meta_description": "...",
  "description": "<skopiowany_oryginalny_opis> <script type=\\"application/ld+json\\">{...}</script>"
}`,
    JSON.stringify(['description', 'meta_title', 'meta_description'])
  );
  console.log("Preset dodany pomyślnie.");
} else {
  console.log("Preset już istnieje.");
}
