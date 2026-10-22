# ShopGold AI Dashboard

> **Middleware AI dla platformy ShopGold** — automatyzuje zarządzanie treściami produktów, SEO i kampaniami marketingowymi z użyciem OpenAI GPT lub Google Gemini.

---

## 📋 Spis treści
- [Opis projektu](#-opis-projektu)
- [Architektura](#-architektura)
- [Wymagania](#-wymagania)
- [Instalacja i uruchomienie](#-instalacja-i-uruchomienie)
- [Konfiguracja](#-konfiguracja)
- [Moduły aplikacji](#-moduły-aplikacji)
- [Połączenie z ShopGold](#-połączenie-z-shopgold)
- [Przepływ pracy](#-przepływ-pracy)
- [API Backend](#-api-backend)
- [Bezpieczeństwo](#-bezpieczeństwo)

---

## 🎯 Opis projektu

ShopGold AI Dashboard to aplikacja middleware działająca lokalnie na komputerze właściciela sklepu. Łączy się ze sklepem ShopGold przez XML Feed, CSV lub MySQL, wysyła dane produktów do modelu AI (OpenAI / Gemini), a następnie prezentuje wygenerowane treści do ręcznej weryfikacji przed aktualizacją sklepu.

**Zasada "Safety First":** Żadna zmiana nie trafia do sklepu bez Twojej akceptacji.

---

## 🏗 Architektura

```
┌──────────────────────────────────────────────────┐
│                  PRZEGLĄDARKA                    │
│          ShopGold AI Dashboard UI                │
│  Dashboard | PIM&SEO | Akceptacja | Kampanie    │
└────────────────────┬─────────────────────────────┘
                     │ HTTP REST API
┌────────────────────▼─────────────────────────────┐
│              NODE.JS BACKEND (Express)           │
│                                                  │
│  routes/         services/        adapters/      │
│  ├ products.js   ├ pimService     ├ xmlAdapter   │
│  ├ approval.js   ├ aiService      ├ csvAdapter   │
│  ├ campaigns.js  ├ approvalSvc    └ mysqlAdapter │
│  └ settings.js   └ campaignSvc                  │
│                                                  │
│  models/localDb.js (SQLite — cache lokalny)      │
└──────┬──────────────────────────────┬────────────┘
       │                              │
┌──────▼──────┐              ┌────────▼────────┐
│  ShopGold   │              │   AI Provider   │
│  XML / CSV  │              │ OpenAI / Gemini │
│  MySQL DB   │              └─────────────────┘
└─────────────┘
```

---

## ⚙️ Wymagania

| Wymaganie | Minimalna wersja |
|-----------|-----------------|
| Node.js   | 18.x lub nowszy |
| npm       | 9.x lub nowszy  |
| System    | Windows / macOS / Linux |

**Wymagane jedno z:**
- Klucz API OpenAI (https://platform.openai.com/api-keys)
- Klucz API Google Gemini (https://aistudio.google.com/app/apikey)

---

## 🚀 Instalacja i uruchomienie

### Opcja 1: Skrypt BAT (Windows)
```bat
start.bat
```

### Opcja 2: Ręcznie
```bash
# 1. Zainstaluj zależności
npm install

# 2. Skopiuj i uzupełnij plik konfiguracyjny
copy .env.example .env
# Edytuj .env — wpisz klucze API

# 3. Uruchom serwer
npm start

# Tryb deweloperski (auto-restart przy zmianach):
npm run dev
```

### ✅ Aplikacja dostępna pod:
```
http://localhost:3000
```

---

## 🔧 Konfiguracja

### Plik `.env` (opcjonalny — można też ustawić wszystko przez UI)

```env
# ===== AI =====
AI_PROVIDER=openai               # openai | gemini
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini         # gpt-4o-mini | gpt-4o | gpt-4-turbo
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-1.5-flash    # gemini-1.5-flash | gemini-1.5-pro | gemini-2.0-flash

# ===== ShopGold =====
SHOPGOLD_CONNECTION_TYPE=xml     # xml | csv | mysql
SHOPGOLD_XML_FEED_URL=https://twojsklep.pl/xml/ceneo.xml

# ===== MySQL (tylko gdy CONNECTION_TYPE=mysql) =====
MYSQL_HOST=twojsklep.pl
MYSQL_PORT=3306
MYSQL_USER=db_user
MYSQL_PASS=
MYSQL_DATABASE=shopgold_db
MYSQL_TABLE_PREFIX=sg_

# ===== Aplikacja =====
PORT=3000
```

> 💡 **Ustawienia z pliku `.env` można nadpisać przez panel Ustawienia** — zmiany są zapisywane w bazie SQLite i mają wyższy priorytet.

---

## 📦 Moduły aplikacji

### 1. 🏠 Dashboard
Widok główny z podsumowaniem stanu systemu:
- Liczniki: produkty w cache, oczekujące zmiany, kampanie
- Status dostawcy AI i modelu
- Historia ostatnich synchronizacji
- Szybkie akcje (generuj, zatwierdź, kampania)

### 2. 📦 PIM & SEO (Zarządzanie Produktami)
Główny moduł generowania treści:

**Import produktów:**
| Tryb | Opis |
|------|------|
| XML Feed (URL) | Pobiera feed XML z URL (np. Ceneo) automatycznie |
| XML Plik | Wgraj plik XML ręcznie (np. `data/sample_products.xml`) |
| CSV Plik | Wgraj plik CSV (separator `;` lub `,`) |
| MySQL | Bezpośrednie połączenie z bazą ShopGold |

**Generowanie AI:**
1. Zaznacz produkty (checkbox lub "Zaznacz wszystkie")
2. Wybierz preset promptu (lub zostaw domyślny)
3. Sprawdź szacowany koszt API
4. Kliknij **🤖 Generuj AI** — postęp widoczny na pasku
5. Wygenerowane zmiany trafiają do **Kolejki Akceptacji**

**Co generuje AI dla każdego produktu:**
- ✅ Opis produktu (schemat: korzyść → spec → zastosowanie → CTA)
- ✅ Meta Title (max 60 znaków, z SEO)
- ✅ Meta Description (max 155 znaków, z CTA)
- ✅ Sugestie brakujących atrybutów
- ✅ Propozycje ujednolicenia wartości atrybutów

**Standaryzacja atrybutów (🔧 przycisk):**
- Wykrywa niespójności: `"cm"` vs `"centymetry"`, `"16GB"` vs `"16 GB"`
- Proponuje brakujące parametry na podstawie opisu
- Wynik widoczny w modalnym podglądzie

### 3. ✅ Moduł Akceptacji (Safety First)
Widok Przed/Po wszystkich zmian wygenerowanych przez AI:

| Akcja | Opis |
|-------|------|
| ✅ Zatwierdź | Zatwierdza zmianę do synchronizacji |
| ✏️ Edytuj | Edytuje treść przed zatwierdzeniem |
| ❌ Odrzuć | Odrzuca zmianę (nie trafi do sklepu) |
| 🚀 Synchronizuj | Wysyła zatwierdzone zmiany do ShopGold (lub aktualizuje lokalny cache) |
| ⬇️ Eksport XML | Pobiera plik XML do ręcznego importu w ShopGold |
| ⬇️ Eksport CSV | Pobiera plik CSV do ręcznego importu |

**Przepływ statusów:**
```
pending → approved → synced
       ↘ rejected
```

### 4. 📣 Kampanie Marketingowe
Generuje gotowe treści reklamowe dla produktów:

**Google Ads RSA:**
- 15 nagłówków (max 30 znaków)
- 4 opisy (max 90 znaków)
- 10-15 słów kluczowych (exact/phrase/broad)
- Eksport do CSV (Google Ads Editor ready)

**Facebook / Instagram Ads:**
- 2 warianty A/B dla każdego produktu
- Primary text (krótki 125 zn. + pełny 500 zn. z emoji)
- Nagłówek reklamowy (max 40 znaków)
- Hashtagi (#5-8 polskich)
- CTA: SHOP_NOW / LEARN_MORE / GET_OFFER
- Eksport do JSON lub TXT

### 5. ⚙️ Ustawienia
- Konfiguracja dostawcy AI i kluczy API (z maskowaniem i wskaźnikiem statusu)
- Ustawienia połączenia z ShopGold
- Zarządzanie presetami promptów (tworzenie, edytowanie)
- Historia synchronizacji (logi)

---

## 🔌 Połączenie z ShopGold

### Opcja 1: XML Feed (zalecana)
Najprostsze podejście — nie wymaga dostępu do serwera.

1. Zaloguj się do Panelu ShopGold
2. Przejdź do: **Integracje → Porównywarki → Ceneo** (lub Google Shopping)
3. Skopiuj URL generowanego feedu XML
4. Wklej URL w: **Ustawienia → Połączenie → URL XML Feed**
5. W PIM & SEO → Importuj → XML Feed (URL) → Importuj

> 📁 Do testów bez sklepu użyj: `data/sample_products.xml` (8 przykładowych produktów)

### Opcja 2: Plik CSV
1. Wyeksportuj produkty z ShopGold do CSV
2. W PIM & SEO → Importuj → CSV Plik → wybierz plik

**Obsługiwane kolumny CSV (PL/EN):**
`id/ID`, `name/nazwa`, `category/kategoria`, `description/opis`, `meta_title`, `meta_description`, `price/cena`

### Opcja 3: MySQL (zaawansowane)
Wymaga:
- Otwartego zdalnego dostępu MySQL (port 3306) w ustawieniach hostingu
- Danych dostępu do bazy ShopGold

Aplikacja automatycznie wykrywa strukturę tabel na podstawie typowych nazw ShopGold.

---

## 🔄 Przepływ pracy (typowy)

```
1. ⚙️ Ustaw klucz API w Ustawieniach → AI
2. 📦 Importuj produkty (PIM & SEO → Importuj)
3. 🤖 Zaznacz produkty → Generuj AI
4. ✅ Przejrzyj zmiany w Akceptacji (Przed/Po)
5. ✏️ Ewentualnie edytuj wybrane treści
6. ✅ Zatwierdź zaakceptowane zmiany
7. 🚀 Synchronizuj → pobierz XML/CSV i zaimportuj do ShopGold
```

---

## 🌐 API Backend

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/health` | GET | Status serwera |
| `/api/products` | GET | Lista produktów (filtry: search, category, limit, offset) |
| `/api/products/sync` | POST | Import produktów (XML/CSV/MySQL) |
| `/api/products/batch/generate` | POST | Batch generowanie AI (SSE stream) |
| `/api/products/batch/estimate` | POST | Szacowanie kosztu |
| `/api/products/:id/generate` | POST | Generowanie dla 1 produktu |
| `/api/products/:id/standardize` | POST | Standaryzacja atrybutów |
| `/api/approval` | GET | Kolejka akceptacji |
| `/api/approval/:id` | PATCH | Aktualizacja statusu |
| `/api/approval/bulk` | POST | Zbiorcza aktualizacja |
| `/api/approval/sync` | POST | Synchronizacja ze sklepem |
| `/api/approval/export/xml` | GET | Eksport XML |
| `/api/approval/export/csv` | GET | Eksport CSV |
| `/api/campaigns` | GET/POST | Lista/Tworzenie kampanii |
| `/api/campaigns/:id/export/:format` | GET | Eksport (json/csv/txt) |
| `/api/settings` | GET/POST | Odczyt/Zapis ustawień |
| `/api/settings/status` | GET | Podsumowanie dla Dashboard |
| `/api/settings/presets` | GET/POST | Presety promptów |
| `/api/settings/logs` | GET | Logi synchronizacji |
| `/api/settings/test-connection` | POST | Test MySQL |

---

## 🔒 Bezpieczeństwo

- **Klucze API** przechowywane tylko lokalnie w SQLite (`data/shopgold_cache.db`) i `.env`
- **Safety First** — żadna zmiana nie trafia do sklepu bez ręcznej akceptacji
- **Lokalny serwer** — aplikacja nie jest dostępna z Internetu (domyślnie `localhost:3000`)
- **Maskowanie kluczy** — panel ustawień pokazuje tylko `sk-abc...xyz` nigdy pełny klucz
- **Separacja danych** — cache produktów w SQLite, oryginalne dane sklepu nigdy nie są modyfikowane bez zgody

---

## 📁 Struktura projektu

```
shopgold-ai-dashboard/
├── backend/
│   ├── server.js              # Serwer Express
│   ├── config.js              # Konfiguracja z .env
│   ├── routes/
│   │   ├── products.js        # API produktów
│   │   ├── approval.js        # API kolejki akceptacji
│   │   ├── campaigns.js       # API kampanii
│   │   └── settings.js        # API ustawień
│   ├── services/
│   │   ├── aiService.js       # Abstrakcja OpenAI/Gemini
│   │   ├── pimService.js      # Logika PIM i generowania
│   │   ├── approvalService.js # Synchronizacja i eksport
│   │   └── campaignService.js # Generowanie kampanii
│   ├── adapters/
│   │   ├── xmlAdapter.js      # Pobieranie/parsowanie XML
│   │   ├── csvAdapter.js      # Import/eksport CSV
│   │   └── mysqlAdapter.js    # Połączenie MySQL ShopGold
│   └── models/
│       └── localDb.js         # SQLite (cache, kolejka, kampanie)
├── frontend/
│   ├── index.html             # SPA Shell
│   ├── css/style.css          # Design system (dark theme)
│   └── js/
│       ├── app.js             # Router, API client, utilities
│       ├── dashboard.js       # Widok Dashboard
│       ├── pim.js             # Widok PIM & SEO
│       ├── approval.js        # Widok Akceptacji
│       ├── campaigns.js       # Widok Kampanii
│       └── settings.js        # Widok Ustawień
├── data/
│   ├── shopgold_cache.db      # SQLite (tworzone automatycznie)
│   └── sample_products.xml    # 8 przykładowych produktów do testów
├── .env                       # Konfiguracja lokalna (nie commituj!)
├── .env.example               # Szablon konfiguracji
├── package.json
├── start.bat                  # Szybkie uruchomienie (Windows)
└── README.md
```

---

## 💡 Wskazówki

- **Model AI**: Do testów używaj `gpt-4o-mini` lub `gemini-1.5-flash` — są znacznie tańsze (~$0.001/produkt)
- **Batch processing**: Przy dużej liczbie produktów (>50) ustaw `delayMs=500` aby unikać rate limitów API
- **Presety**: Stwórz osobne presety dla różnych kategorii (elektronika, odzież, kosmetyki) — każda kategoria ma inny styl opisu
- **Eksport CSV**: Plik CSV z modułu Akceptacji jest gotowy do importu w ShopGold (separator `;`, UTF-8 BOM)

---

*Wersja 1.0.0 | Zbudowano z Node.js + Express + SQLite + OpenAI/Gemini API*
