const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data/shopgold_cache.db');
const db = new Database(DB_PATH);

// Update Domyślny PIM
db.prepare(`
  UPDATE prompt_presets 
  SET user_prompt_template = ?
  WHERE name = 'Domyślny PIM'
`).run(
  `Na podstawie poniższych danych produktu wygeneruj zoptymalizowane treści.

DANE PRODUKTU:
Nazwa: {{name}}
Kategoria: {{category}}
Obecny opis: {{description}}
Parametry: {{attributes}}
Cena: {{price}} zł

INSTRUKCJE:
1. Opis musi być pisany według schematu: [główna korzyść] -> [specyfikacja techniczna] -> [zastosowanie praktyczne] -> [CTA].
2. Ton: profesjonalny, ale przyjazny. Używaj aktywnych form czasownika.
3. Unikaj ogólników ("wysokiej jakości", "doskonały produkt").
4. SEO: naturalne wplecenie słów kluczowych.
5. FORMATOWANIE HTML: Opis MUSI być bogato sformatowany w HTML. Używaj nagłówków (<h2>, <h3>), pogrubień (<strong>) do podkreślania najważniejszych cech (np. "wyróżnione odpowiednie elementy"), akapitów (<p>) oraz list wypunktowanych (<ul><li>), aby tekst był przejrzysty i atrakcyjny wizualnie.

Zwróć JSON o następującej strukturze:
{
  "description": "<h2...>...</h2><p>...</p><ul><li><strong>...</strong>...</li></ul>",
  "meta_title": "Meta Title (max 60 znaków, zawiera główne słowo kluczowe)",
  "meta_description": "Meta Description (max 155 znaków, zachęca do kliknięcia, zawiera CTA)",
  "attributes_suggestions": [
    {"action": "add", "name": "Nazwa parametru", "value": "Proponowana wartość"},
    {"action": "unify", "current": "obecna wartość", "suggested": "ujednolicona wartość", "reason": "powód"}
  ],
  "keywords": ["słowo kluczowe 1", "słowo kluczowe 2", "słowo kluczowe 3"]
}`
);

// Update SEO: Tylko Meta Tagi i LD+JSON
db.prepare(`
  UPDATE prompt_presets 
  SET user_prompt_template = ?
  WHERE name = 'SEO: Tylko Meta Tagi i LD+JSON'
`).run(
  `Na podstawie poniższych danych produktu:
Nazwa: {{name}}
Kategoria: {{category}}
Parametry: {{attributes}}
Cena: {{price}} zł
Opis źródłowy: {{description}}

INSTRUKCJE:
1. Zbuduj natywny obiekt JSON dla ustrukturyzowanych danych schema.org typu Product, używając dostępnych danych (name, description, image, brand, offers, itp.). Zwróć go w polu "ld_json_product".
2. Jeśli z opisu wynika, że produkt odpowiada na konkretne pytania lub można ułożyć z niego listę pytań i odpowiedzi (FAQ), zbuduj natywny obiekt JSON schema.org typu FAQPage. Zwróć go w polu "ld_json_faq". 
3. NIE ZWRACAJ pola "description"! Twój wygenerowany kod LD+JSON zostanie poprawnie doklejony do oryginalnego opisu po stronie serwera, co zapobiegnie utracie formatowania HTML.
4. Wygeneruj nowe, zoptymalizowane meta_title (max 60 znaków) oraz meta_description (max 155 znaków, wzywające do akcji).

Zwróć w formacie JSON:
{
  "meta_title": "...",
  "meta_description": "...",
  "ld_json_product": {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "..."
  },
  "ld_json_faq": {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": []
  }
}`
);

console.log("Presety zaktualizowane pomyślnie.");
