# Historia Zmian (Changelog)

W tym pliku prowadzona jest ewidencja wszystkich istotnych zmian, aktualizacji i poprawek w systemie ShopGold AI Dashboard.

## [v1.3.0] - 2026-05-05
### Dodano
- **Zunifikowany Katalog Produktów (Master Catalog)**: Nowa tabela `catalog_master` automatycznie agreguje produkty ze wszystkich hurtowni, deduplikuje po EAN (z obsługą wiodącego zera + weryfikacją po kodzie producenta) i zbiera w jednym miejscu: kody EAN, producenta, wagę, wymiary, listę hurtowni, najlepszą cenę i sumaryczny stan.
- **Auto-aktualizacja**: Katalog master przebudowuje się automatycznie po każdym odświeżeniu hurtowni (`refreshSupplier()` hook).
- **Normalizacja wymiarów**: Parser obsługujący formaty `120x10x15`, `120 x 10 x 15 mm`, `wysokość: 120mm`, `30x20x10 cm` — przelicza do jednolitego formatu w mm.
- **Nowa zakładka "📚 Katalog Master"** w module Smart Sourcing: statystyki, przeglądanie z paginacją, filtrowanie po producencie/hurtowni/EAN, sortowanie po kolumnach.
- **Nowe endpointy API**: `GET /api/sourcing/catalog`, `GET /api/sourcing/catalog/stats`, `GET /api/sourcing/catalog/manufacturers`.
- **Migracja DB**: Nowe kolumny w `supplier_products` (manufacturer_code, dimensions_raw, width/height/depth_mm).

## [v1.2.0] - 2026-05-05
### Dodano
- **Integracja z Sellasist API (Podstawy)**: Dodano panel konfiguracyjny klucza API Sellasist w zakładce Ustawienia -> Integracje. 
- **Zarządzanie połączeniem Sellasist**: Dodano przycisk "Testuj API Key" wraz z backendowym serwisem odpytującym `api.sellasist.pl` i sprawdzającym poprawność autoryzacji (pod przygotowanie pobierania kategorii i wag).

## [v1.1.0] - 2026-05-05
### Dodano
- **Multimodalne Czaty AI**: Możliwość przesyłania obrazów do modeli obsługujących wizję (np. `gpt-4o`, `llava`) z poziomu czatu (przycisk w toolbarze, przeciągnij i upuść, wklejanie ze schowka `Ctrl+V`).
- **Pobieranie kontekstu z WWW**: Nowa funkcja w czacie (ikona globusa 🌐) umożliwia wpisanie adresu URL. System automatycznie pobiera tekst ze strony, czyści go z reklam/nawigacji i dodaje jako kontekst do rozmowy.
- **Lokalne Notatki**: Dodano nowy boczny panel "Moje Notatki" (ikona 📝). Pozwala na szybkie tworzenie, kolorowanie i organizowanie notatek w lokalnej bazie SQLite z opcją wstrzykiwania ich bezpośrednio do kontekstu czatu.
- **Baza Wiedzy (Open WebUI)**: Podłączono boczny panel (ikona 📚), który integruje się bezpośrednio z Bazą Wiedzy/Dokumentami instancji Open WebUI. Dokumenty tam wgrane pojawiają się w panelu z opcją dodania ich do kontekstu czatu.

### Zmieniono
- **Przebudowa interfejsu czatu**: Całkowity refaktoryzacja `chats.css` i `chats.js`. Wprowadzono ciemniejszy, bardziej spójny motyw, zoptymalizowano wybór modeli (poprawa kontrastu kolorów) oraz dodano boczne panele dla notatek i wiedzy.
- **Optymalizacja statycznych plików (Cache)**: Dodano wymuszanie nagłówków `Cache-Control: no-cache` w trybie deweloperskim dla serwowania zasobów frontendowych przez Express, zapobiegając problemom ze starym kodem w przeglądarce.
- **Silnik zapytań Open WebUI**: Rozbudowano routing dla wywołań API modeli, czatów i bazy wiedzy. Mechanizm dynamicznie testuje wiele ścieżek dostępowych (np. `/api/v1/chats`, `/api/v1/chats/` itp.), co gwarantuje kompatybilność z różnymi wersjami Open WebUI oraz Ollama.

### Naprawiono
- Błędy logowania 404 w najnowszych wersjach Open WebUI poprzez przejście na autoryzację z użyciem kluczy API (API Key) z zachowaniem kompatybilności wstecznej (Token JWT).
- Utraty nagłówków uwierzytelniających podczas przekierowań (Trailing Slashes) przez bibliotekę Node.js Fetch, co powodowało wyświetlanie pustej listy czatów.
