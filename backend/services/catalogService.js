/* =====================================================================
 * catalogService.js — Zunifikowany Katalog Produktów (Master Catalog)
 * Agreguje produkty ze wszystkich hurtowni, deduplikuje po EAN,
 * normalizuje wymiary i automatycznie aktualizuje się po refreshu.
 * ===================================================================== */
'use strict';

const { normalizeEan, eanMatch, eanVariants, registerNormalizeEan } = require('./eanUtil');
const attrSync = require('./catalogAttrSync');

// ─── Product Name Cleaning ─────────────────────────────────────────────────────

/**
 * Agresywnie czyści nazwę produktu z HTML entities, tagów i artefaktów enkodera.
 * Zwraca null jeśli nazwa jest bezużyteczna (za krótka, same cyfry, garbled).
 */
function cleanProductName(raw) {
  if (!raw) return null;
  let s = String(raw);

  // 1) Usuń HTML tagi
  s = s.replace(/<[^>]+>/g, ' ');

  // 2) Dekoduj HTML entities (pełne)
  s = s.replace(/&nbsp;/gi, ' ');
  s = s.replace(/&amp;/gi, '&');
  s = s.replace(/&lt;/gi, '<');
  s = s.replace(/&gt;/gi, '>');
  s = s.replace(/&quot;/gi, '"');
  s = s.replace(/&apos;/gi, "'");
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = parseInt(n, 10);
    return code > 31 && code < 127 ? String.fromCharCode(code) : ' ';
  });
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const code = parseInt(hex, 16);
    return code > 31 && code < 65535 ? String.fromCharCode(code) : ' ';
  });
  s = s.replace(/&[a-z]+;/gi, ' '); // remaining unknown entities → space

  // 3) Usuń artefakty enkodera (np. "& bsp;" zamiast "&nbsp;")
  s = s.replace(/&\s*[a-z]*\s*;/gi, ' ');

  // 4) Normalizacja białych znaków
  s = s.replace(/[\r\n\t]+/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // 5) Skracanie zbyt długich opisów (błąd hurtowni, np. MCM, gdzie w nazwie ląduje pełny opis)
  if (s.length > 150) {
    const match = s.match(/^(.{20,120}?[.?!])(?:\s|$)/);
    if (match) {
      s = match[1];
    } else {
      s = s.substring(0, 120).trim() + '...';
    }
  }

  // 6) Sprawdź jakość nazwy
  if (s.length < 3) return null;

  // Odrzuć jeśli to same cyfry (prawdopodobnie EAN/SKU użyte jako nazwa)
  if (/^\d+$/.test(s.replace(/[\s\-./]/g, ''))) return null;

  // Sprawdź czy nazwa jest garbled (za dużo POJEDYNCZYCH liter oddzielonych spacjami)
  // np. "I telige t e i elega ckie" → wiele 1-literowych słów
  // UWAGA: nie odrzucaj 2-literowych słów (MK, II, EU, UK, TB, HP, LG itp.) — są typowe w nazwach tech
  const words = s.split(/\s+/);
  if (words.length >= 6) {
    const singleCharWords = words.filter(w => w.length <= 1 && /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]$/.test(w));
    const ratio = singleCharWords.length / words.length;
    if (ratio > 0.4) return null; // ponad 40% to pojedyncze litery → garbled
  }

  return s;
}

// ─── Manufacturer Normalization ─────────────────────────────────────────────────

const MANUFACTURER_ALIASES = {
  'hewlett-packard': 'HP', 'hewlett packard': 'HP', 'h-p': 'HP', 'hp inc': 'HP', 'hp inc.': 'HP',
  'hpe': 'HPE', 'hewlett packard enterprise': 'HPE',
  'dell technologies': 'Dell', 'dell inc': 'Dell', 'dell inc.': 'Dell',
  'lenovo group': 'Lenovo', 'lenovo group limited': 'Lenovo',
  'western digital': 'Western Digital', 'wd': 'Western Digital',
  'seagate technology': 'Seagate', 'seagate technology llc': 'Seagate',
  'kingston technology': 'Kingston', 'kingston tech': 'Kingston',
  'transcend information': 'Transcend', 'transcend info': 'Transcend',
  'samsung electronics': 'Samsung', 'samsung semiconductor': 'Samsung',
  'sandisk': 'SanDisk', 'san disk': 'SanDisk', 'western digital/sandisk': 'SanDisk',
  'tp-link technologies': 'TP-Link', 'tp link': 'TP-Link', 'tplink': 'TP-Link',
  'asus computer': 'ASUS', 'asustek': 'ASUS', 'asus tek': 'ASUS', 'asustek computer': 'ASUS',
  'acer inc': 'Acer', 'acer inc.': 'Acer',
  'microsoft corporation': 'Microsoft', 'microsoft corp': 'Microsoft',
  'logitech international': 'Logitech', 'logitech inc': 'Logitech',
  'brother industries': 'Brother', 'brother international': 'Brother',
  'canon inc': 'Canon', 'canon inc.': 'Canon',
  'epson': 'Epson', 'seiko epson': 'Epson',
  'lg electronics': 'LG', 'lg display': 'LG',
  'intel corporation': 'Intel', 'intel corp': 'Intel',
  'amd': 'AMD', 'advanced micro devices': 'AMD',
  'nvidia': 'NVIDIA', 'nvidia corporation': 'NVIDIA',
  'toshiba': 'Toshiba', 'toshiba corporation': 'Toshiba', 'kioxia': 'Kioxia',
  'panasonic corporation': 'Panasonic', 'panasonic corp': 'Panasonic',
  'sony corporation': 'Sony', 'sony corp': 'Sony',
  'philips': 'Philips', 'philips electronics': 'Philips', 'signify': 'Philips',
  'xerox corporation': 'Xerox', 'xerox corp': 'Xerox',
  'xiaomi': 'Xiaomi', 'xiaomi inc': 'Xiaomi', 'xiaomi corporation': 'Xiaomi',
  'crucial': 'Crucial', 'crucial/micron': 'Crucial', 'micron': 'Micron',
  'corsair': 'Corsair', 'corsair memory': 'Corsair', 'corsair components': 'Corsair',
  'g.skill': 'G.Skill', 'gskill': 'G.Skill', 'g skill': 'G.Skill',
  'patriot': 'Patriot', 'patriot memory': 'Patriot', 'viper': 'Patriot',
  'msi': 'MSI', 'micro-star': 'MSI', 'micro star': 'MSI',
  'gigabyte': 'Gigabyte', 'gigabyte technology': 'Gigabyte',
  'asrock': 'ASRock', 'as rock': 'ASRock',
  'evga': 'EVGA', 'evga corporation': 'EVGA',
  'razer': 'Razer', 'razer inc': 'Razer',
  'steelseries': 'SteelSeries', 'steel series': 'SteelSeries',
  'hyperx': 'HyperX',
  'intenso': 'Intenso', 'intenso international': 'Intenso',
  'mediarange': 'MediaRange', 'media range': 'MediaRange',
  'fellowes': 'Fellowes', 'fellowes inc': 'Fellowes',
  'trust': 'Trust', 'trust international': 'Trust',
  'adata': 'ADATA', 'a-data': 'ADATA', 'a data': 'ADATA',
  'verbatim': 'Verbatim', 'verbatim corporation': 'Verbatim',
  'akyga': 'Akyga',
  'platinet': 'Platinet',
};

/**
 * Normalizuje nazwę producenta: Title Case + aliasy.
 */
function normalizeManufacturer(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!s) return '';

  // Usuń niepotrzebne sufiksy
  s = s.replace(/\s*(sp\.?\s*z\s*o\.?\s*o\.?|s\.?a\.?|ltd\.?|inc\.?|corp\.?|gmbh|b\.?v\.?|co\.?\s*ltd\.?)\s*$/i, '').trim();

  // Sprawdź aliasy (case-insensitive)
  const lower = s.toLowerCase();
  if (MANUFACTURER_ALIASES[lower]) return MANUFACTURER_ALIASES[lower];

  // Sprawdź częściowe dopasowanie aliasów
  for (const [alias, canonical] of Object.entries(MANUFACTURER_ALIASES)) {
    if (lower === alias || lower.replace(/[.\-\s]/g, '') === alias.replace(/[.\-\s]/g, '')) {
      return canonical;
    }
  }

  // Krótkie nazwy (<=4 znaków) — zachowaj wielkie litery (np. HP, AMD, LG, MSI)
  if (s.length <= 4 && s === s.toUpperCase()) return s;

  // Title Case
  return s.split(/\s+/).map(w => {
    if (w.length <= 2 && w === w.toUpperCase()) return w; // np. "HP", "LG"
    if (/^[A-Z]{2,}$/.test(w)) return w; // zachowaj akronimy
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}


// ─── Dimensions Parser ──────────────────────────────────────────────────────────

/**
 * Parsuje wymiary z różnych formatów hurtowni.
 * 
 * Obsługiwane formaty:
 *   "120x10x15"          → {w:120, h:10, d:15}
 *   "120 x 10 x 15 mm"   → {w:120, h:10, d:15}
 *   "30x20x10 cm"        → {w:300, h:200, d:100}
 *   "wysokość: 120mm"     → {h:120}
 *   "szer. 10 cm"         → {w:100}
 *   "Waga: 1.5kg Wymiary: 30x20x10" → {weight:1500, w:30, h:20, d:10}
 * 
 * Zwraca wymiary w mm, wagę w gramach.
 */
function parseDimensions(raw) {
  const result = { width_mm: 0, height_mm: 0, depth_mm: 0, weight_g: 0 };
  if (!raw) return result;

  const text = String(raw).toLowerCase().trim();

  // Spróbuj wyciągnąć wagę
  const weightPatterns = [
    /waga\s*[:=]?\s*([\d.,]+)\s*(kg|g)/i,
    /([\d.,]+)\s*(kg|g)\b/i,
  ];
  for (const pat of weightPatterns) {
    const m = text.match(pat);
    if (m) {
      let val = parseFloat(m[1].replace(',', '.'));
      if (m[2].toLowerCase() === 'kg') val *= 1000;
      result.weight_g = val;
      break;
    }
  }

  // Format "AxBxC" (z opcjonalną jednostką)
  const dimPattern = /([\d.,]+)\s*[x×]\s*([\d.,]+)\s*[x×]\s*([\d.,]+)\s*(mm|cm|m)?\b/i;
  const dimMatch = text.match(dimPattern);
  if (dimMatch) {
    let d1 = parseFloat(dimMatch[1].replace(',', '.'));
    let d2 = parseFloat(dimMatch[2].replace(',', '.'));
    let d3 = parseFloat(dimMatch[3].replace(',', '.'));
    const unit = (dimMatch[4] || 'mm').toLowerCase();

    const multiplier = unit === 'cm' ? 10 : unit === 'm' ? 1000 : 1;
    result.width_mm = d1 * multiplier;
    result.height_mm = d2 * multiplier;
    result.depth_mm = d3 * multiplier;
    return result;
  }

  // Format "AxB" (2 wymiary)
  const dim2Pattern = /([\d.,]+)\s*[x×]\s*([\d.,]+)\s*(mm|cm|m)?\b/i;
  const dim2Match = text.match(dim2Pattern);
  if (dim2Match) {
    let d1 = parseFloat(dim2Match[1].replace(',', '.'));
    let d2 = parseFloat(dim2Match[2].replace(',', '.'));
    const unit = (dim2Match[3] || 'mm').toLowerCase();
    const multiplier = unit === 'cm' ? 10 : unit === 'm' ? 1000 : 1;
    result.width_mm = d1 * multiplier;
    result.height_mm = d2 * multiplier;
    return result;
  }

  // Polskie nazwy wymiarów (osobno)
  const namedPatterns = [
    { keys: ['wysoko', 'wys', 'height', 'h'], field: 'height_mm' },
    { keys: ['szeroko', 'szer', 'width', 'w'], field: 'width_mm' },
    { keys: ['g\\u0142[eę]boko', 'g\\u0142[eę]b', 'd\\u0142ugo', 'd\\u0142', 'depth', 'length', 'dl'], field: 'depth_mm' },
  ];
  for (const np of namedPatterns) {
    for (const key of np.keys) {
      const re = new RegExp(key + '[^\\d]*([\\.\\d,]+)\\s*(mm|cm|m)?', 'i');
      const m = text.match(re);
      if (m) {
        let val = parseFloat(m[1].replace(',', '.'));
        const unit = (m[2] || 'mm').toLowerCase();
        const multiplier = unit === 'cm' ? 10 : unit === 'm' ? 1000 : 1;
        result[np.field] = val * multiplier;
      }
    }
  }

  return result;
}

// ─── Category Normalization ─────────────────────────────────────────────────────

// Predefiniowane mapowanie kategorii -> domyślne filtry (atrybuty)
const CATEGORY_ATTR_MAP = {
  // Storage
  'dyski': ['Pojemność', 'Interfejs', 'Format', 'Prędkość odczytu', 'Prędkość zapisu'],
  'ssd': ['Pojemność', 'Interfejs', 'Format', 'Prędkość odczytu', 'Prędkość zapisu', 'Typ pamięci'],
  'hdd': ['Pojemność', 'Interfejs', 'Obroty', 'Cache', 'Format'],
  'pendrive': ['Pojemność', 'Interfejs', 'Prędkość odczytu'],
  'kart pamięci': ['Pojemność', 'Typ', 'Klasa prędkości'],
  'nas': ['Zatoki', 'Procesor', 'RAM', 'Interfejs sieciowy'],
  // Memory
  'pamięć': ['Pojemność', 'Typ', 'Taktowanie', 'Latencja', 'Liczba kości', 'RGB'],
  'ram': ['Pojemność', 'Typ', 'Taktowanie', 'Latencja', 'Liczba kości', 'RGB'],
  'ddr': ['Pojemność', 'Typ', 'Taktowanie', 'Latencja', 'Liczba kości', 'RGB'],
  // CPUs
  'procesor': ['Rodzina', 'Rdzenie', 'Wątki', 'Taktowanie', 'Socket', 'TDP', 'Typ pamięci RAM', 'Zintegrowana grafika'],
  // Laptops / PCs
  'notebook': ['Procesor', 'RAM', 'Dysk', 'Ekran', 'GPU', 'System', 'Waga'],
  'laptop': ['Procesor', 'RAM', 'Dysk', 'Ekran', 'GPU', 'System', 'Waga'],
  'ultrabook': ['Procesor', 'RAM', 'Dysk', 'Ekran', 'GPU', 'System', 'Waga'],
  'netbook': ['Procesor', 'RAM', 'Dysk', 'Ekran', 'System'],
  'komputer': ['Procesor', 'RAM', 'Dysk', 'GPU', 'System'],
  'aio': ['Procesor', 'RAM', 'Dysk', 'Ekran', 'System'],
  'stacja robocza': ['Procesor', 'RAM', 'Dysk', 'GPU'],
  // Displays
  'monitor': ['Przekątna', 'Rozdzielczość', 'Typ matrycy', 'Odświeżanie', 'Złącza'],
  'led': ['Przekątna', 'Rozdzielczość', 'Typ matrycy', 'Odświeżanie', 'Złącza'],
  'lcd': ['Przekątna', 'Rozdzielczość', 'Typ matrycy', 'Odświeżanie'],
  'telewiz': ['Przekątna', 'Rozdzielczość', 'Smart TV', 'HDR'],
  // GPUs
  'karta graficzna': ['Chipset', 'Pamięć', 'Interfejs', 'TDP', 'Długość karty', 'RGB'],
  'gpu': ['Chipset', 'Pamięć', 'Interfejs', 'TDP', 'Długość karty', 'RGB'],
  'grafikkarten': ['Chipset', 'Pamięć', 'Interfejs', 'TDP', 'Długość karty', 'RGB'],
  // Motherboards
  'płyta główna': ['Socket', 'Chipset', 'Format', 'Typ pamięci RAM', 'Sloty RAM', 'Sloty M.2', 'WiFi'],
  // PSU
  'zasilacz': ['Moc', 'Certyfikat', 'Modularność', 'Standard'],
  // UPS
  'ups': ['Moc VA', 'Moc W', 'Typ', 'Czas podtrzymania'],
  'listw': ['Gniazda', 'Długość kabla', 'Zabezpieczenia'],
  // Printers
  'drukark': ['Typ druku', 'Format', 'Prędkość druku', 'Rozdzielczość', 'Duplex'],
  'skaner': ['Typ', 'Rozdzielczość', 'Format', 'Interfejs'],
  'wielofunkcyj': ['Typ druku', 'Skaner', 'Duplex', 'WiFi'],
  'niszczark': ['Typ cięcia', 'Poziom bezpieczeństwa', 'Pojemność kosza'],
  // Consumables
  'toner': ['Kolor', 'Wydajność', 'Kompatybilność'],
  'tusz': ['Kolor', 'Wydajność', 'Kompatybilność'],
  'atrament': ['Kolor', 'Wydajność', 'Kompatybilność'],
  'bęben': ['Wydajność', 'Kompatybilność'],
  'eksploat': ['Typ', 'Kolor', 'Wydajność', 'Kompatybilność'],
  // Networking
  'switch': ['Porty', 'Prędkość', 'Zarządzalność', 'PoE'],
  'przełącznik': ['Porty', 'Prędkość', 'Zarządzalność', 'PoE'],
  'router': ['Standard WiFi', 'Porty LAN', 'Prędkość', 'Pasma'],
  'access point': ['Standard WiFi', 'Pasma', 'PoE', 'Prędkość'],
  'sieciow': ['Typ', 'Prędkość', 'Standard', 'Interfejs'],
  'kabel sieciow': ['Kategoria', 'Długość', 'Ekranowanie'],
  'panel krosow': ['Porty', 'Kategoria'],
  'gniazdo sieciow': ['Kategoria', 'Typ montażu'],
  'modem': ['Technologia', 'Prędkość', 'Porty'],
  'kvm': ['Porty', 'Interfejs', 'Rozdzielczość'],
  'firewall': ['Przepustowość', 'Porty', 'VPN'],
  'homeplug': ['Prędkość', 'Standard', 'Porty'],
  // Cables
  'kabel': ['Typ', 'Długość', 'Standard'],
  'adapter': ['Typ', 'Interfejs wejście', 'Interfejs wyjście'],
  'przejściówk': ['Typ', 'Interfejs wejście', 'Interfejs wyjście'],
  'hub': ['Porty', 'Interfejs', 'Zasilanie'],
  'stacja dokuj': ['Interfejs', 'Porty', 'Zasilanie', 'Rozdzielczość'],
  // Input devices
  'mysz': ['Typ', 'Sensor', 'DPI', 'Połączenie', 'Ilość przycisków'],
  'trackball': ['Typ', 'Sensor', 'DPI', 'Połączenie'],
  'klawiatur': ['Typ', 'Połączenie', 'Przełączniki', 'Podświetlenie'],
  'gamepad': ['Połączenie', 'Wibracje', 'Kompatybilność'],
  'podkładk': ['Rozmiar', 'Materiał', 'Podświetlenie'],
  'rysik': ['Czułość nacisku', 'Kompatybilność'],
  // Audio
  'słuchawk': ['Typ', 'Połączenie', 'Impedancja', 'Mikrofon'],
  'głośnik': ['Moc', 'Typ', 'Połączenie', 'Kanały'],
  'mikrofon': ['Typ', 'Połączenie', 'Charakterystyka'],
  'soundbar': ['Moc', 'Kanały', 'Subwoofer', 'Połączenie'],
  // Mobile
  'telefon': ['System', 'Ekran', 'Procesor', 'RAM', 'Pamięć', 'Aparat', 'Bateria'],
  'smartfon': ['System', 'Ekran', 'Procesor', 'RAM', 'Pamięć', 'Aparat', 'Bateria'],
  'smartwatch': ['Ekran', 'Bateria', 'GPS', 'Wodoodporność'],
  'zegarek': ['Ekran', 'Bateria', 'Funkcje', 'Połączenie'],
  'tablet': ['System', 'Ekran', 'Procesor', 'RAM', 'Pamięć'],
  'etui': ['Typ', 'Kompatybilność', 'Materiał'],
  'nakładk': ['Kompatybilność', 'Materiał', 'Typ'],
  'pokrowc': ['Kompatybilność', 'Materiał', 'Rozmiar'],
  'folia': ['Kompatybilność', 'Typ', 'Rozmiar'],
  'szkło hartowane': ['Kompatybilność', 'Twardość'],
  'ładowark': ['Moc', 'Złącze', 'Szybkie ładowanie'],
  // Cases / Cooling
  'obudow': ['Format', 'Maks. wys. chłodzenia', 'Obsługa AIO', 'Maks. dł. karty graficznej', 'Kolor', 'RGB'],
  'wentylatory do procesor': ['Typ chłodzenia', 'Socket', 'TDP', 'Wysokość', 'RGB', 'Głośność'],
  'chłodzenie procesor': ['Typ chłodzenia', 'Socket', 'TDP', 'Wysokość', 'RGB', 'Głośność'],
  'cpu cooler': ['Typ chłodzenia', 'Socket', 'TDP', 'Wysokość', 'RGB'],
  'chłodzeni': ['Typ chłodzenia', 'Socket', 'TDP', 'Wysokość', 'RGB', 'Głośność'],
  'kuhler': ['Typ chłodzenia', 'Socket', 'TDP', 'Wysokość', 'RGB'],
  'wentylator': ['Rozmiar', 'Obroty', 'Głośność', 'RGB'],
  'pasta termiczn': ['Typ', 'Przewodność'],
  // Power
  'baterie': ['Typ', 'Napięcie', 'Pojemność', 'Rozmiar'],
  'akumulator': ['Typ', 'Napięcie', 'Pojemność'],
  'powerbank': ['Pojemność', 'Złącza', 'Szybkie ładowanie'],
  // Video / Photo
  'kamera': ['Rozdzielczość', 'Typ', 'Połączenie', 'IR', 'Zasilanie'],
  'kamerka': ['Rozdzielczość', 'Mikrofon', 'Interfejs'],
  'projektor': ['Jasność', 'Rozdzielczość', 'Technologia', 'Kontrast'],
  'aparat': ['Matryca', 'Rozdzielczość', 'Obiektyw', 'Stabilizacja'],
  // Servers
  'serwer': ['Procesor', 'RAM', 'Dyski', 'Format', 'Zasilanie'],
  'rack': ['Wysokość U', 'Głębokość', 'Nośność'],
  // Software / Licenses
  'licencj': ['Typ', 'Okres', 'Liczba stanowisk'],
  'systemy operacyjn': ['Wersja', 'Typ licencji'],
  'system operacyjn': ['Wersja', 'Typ licencji'],
  'oprogramowan': ['Typ', 'System', 'Wersja'],
  'antywirus': ['Urządzenia', 'Okres', 'System'],
  'gwarancj': ['Okres', 'Typ', 'Kompatybilność'],
  'serwisow': ['Okres', 'Typ', 'Kompatybilność'],
  // Home appliances
  'agd': ['Typ', 'Moc', 'Pojemność'],
  'czajnik': ['Pojemność', 'Moc', 'Materiał'],
  'odkurzacz': ['Typ', 'Moc', 'Pojemność worka'],
  'ekspres': ['Typ', 'Ciśnienie', 'Funkcje'],
  'żelazk': ['Moc', 'Typ', 'Stopa'],
  'suszark': ['Moc', 'Jonizacja', 'Dyfuzor'],
  'goliark': ['Typ', 'Zasilanie', 'Wodoodporność'],
  'szczoteczk': ['Typ', 'Technologia', 'Tryby'],
  'waga': ['Typ', 'Zakres', 'Dokładność'],
  'mikser': ['Moc', 'Pojemność', 'Prędkości'],
  'blender': ['Moc', 'Pojemność', 'Prędkości'],
  'robot kuchenn': ['Moc', 'Pojemność', 'Funkcje'],
  'toster': ['Moc', 'Komory', 'Funkcje'],
  'grill': ['Moc', 'Powierzchnia', 'Typ'],
  'frytownic': ['Pojemność', 'Moc', 'Typ'],
  // Games
  'konsol': ['Pamięć', 'Rozdzielczość', 'Kontrolery'],
  'gry': ['Platforma', 'Gatunek', 'PEGI'],
  // Other
  'torb': ['Rozmiar', 'Materiał', 'Kompatybilność'],
  'plecak': ['Rozmiar', 'Materiał', 'Kompatybilność'],
  'uchwyt': ['Typ montażu', 'Kompatybilność', 'VESA'],
  'nawigacj': ['Ekran', 'Mapy', 'Aktualizacje'],
};

/**
 * Wyciąga ostatni segment ze ścieżki kategorii.
 * np. "Peryferia / Kable | Przejściówki / Kable USB" → "Kable USB"
 */
function extractCategorySegment(rawName) {
  if (!rawName) return '';
  // Rozdzielaj po / | > \
  const parts = rawName.split(/[/|>\\]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  // Weź ostatni segment (najbardziej szczegółowy)
  return parts[parts.length - 1];
}

// ─── German → Polish category name translation ──────────────────────────────────
const GERMAN_TO_POLISH = {
  // Komputery / Laptopy
  'notebook':               'Notebooki',
  'notebooks':              'Notebooki',
  'laptop':                 'Laptopy',
  'laptops':                'Laptopy',
  'ultrabook':              'Ultrabooki',
  'desktop':                'Komputery stacjonarne',
  'desktops':               'Komputery stacjonarne',
  'workstation':            'Stacje robocze',
  'workstations':           'Stacje robocze',
  'all-in-one':             'Komputery AIO',
  'all in one':             'Komputery AIO',
  'server':                 'Serwery',
  'server & netzwerkequipment': 'Serwery i urządzenia sieciowe',
  // Monitory
  'monitor':                'Monitory',
  'monitore':               'Monitory',
  // Druk
  'drucker':                'Drukarki',
  'multifunktionsdrucker':  'Urządzenia wielofunkcyjne',
  'drucker & scanner':      'Drukarki i skanery',
  'scanner':                'Skanery',
  'toner':                  'Tonery',
  'tintenpatronen':         'Wkłady atramentowe',
  // Magazyn danych
  'speicher':               'Pamięci RAM',
  'festplatte':             'Dyski twarde',
  'festplatten':            'Dyski twarde',
  'ssd':                    'Dyski SSD',
  'ssds':                   'Dyski SSD',
  'usb sticks':             'Pendrivy',
  'usb stick':              'Pendrivy',
  'usb-stick':              'Pendrivy',
  'speicherkarte':          'Karty pamięci',
  'speicherkarten':         'Karty pamięci',
  'nas':                    'Macierze NAS',
  // Sieć
  'netzwerk':               'Sieć',
  'netzwerkkomponenten':    'Komponenty sieciowe',
  'switch':                 'Switche',
  'switches':               'Switche',
  'router':                 'Routery',
  'access point':           'Access Pointy',
  'access points':          'Access Pointy',
  'netzwerkkabel':          'Kable sieciowe',
  'patchkabel':             'Patchkordy',
  'firewall':               'Firewalle',
  'modem':                  'Modemy',
  // Peryferia
  'tastatur':               'Klawiatury',
  'tastaturen':             'Klawiatury',
  'maus':                   'Myszy',
  'mäuse':                  'Myszy',
  'headset':                'Zestawy słuchawkowe',
  'webcam':                 'Kamery internetowe',
  'lautsprecher':           'Głośniki',
  'kopfhörer':              'Słuchawki',
  // Zasilanie
  'netzteil':               'Zasilacze',
  'netzteile':              'Zasilacze',
  'usv':                    'UPS',
  'akku':                   'Akumulatory',
  'akkus':                  'Akumulatory',
  'batterie':               'Baterie',
  'batterien':              'Baterie',
  // Telefonia
  'smartphone':             'Smartfony',
  'smartphones':            'Smartfony',
  'mobiltelefon':           'Telefony komórkowe',
  'tablet':                 'Tablety',
  'tablets':                'Tablety',
  // Akcesoria / Kable
  'kabel':                  'Kable',
  'adapter':                'Adaptery',
  'zubehör':                'Akcesoria',
  'zubehör & verbrauchsm.': 'Akcesoria i materiały eksploatacyjne',
  'verbrauchsmaterialien':  'Materiały eksploatacyjne',
  'gehäuse':                'Obudowy',
  'kühlung':                'Chłodzenie',
  'grafikkarte':            'Karty graficzne',
  'grafikkarten':           'Karty graficzne',
  'prozessor':              'Procesory',
  'prozessoren':            'Procesory',
  'mainboard':              'Płyty główne',
  'hauptplatine':           'Płyty główne',
  // Software
  'software':               'Oprogramowanie',
  'betriebssystem':         'Systemy operacyjne',
  'lizenz':                 'Licencje',
  'lizenzen':               'Licencje',
  'antivirus':              'Programy antywirusowe',
  'sicherheit':             'Bezpieczeństwo',
  // Torby
  'tasche':                 'Torby',
  'taschen':                'Torby',
  'rucksack':               'Plecaki',
  'koffer':                 'Walizki',
  // Inne
  'sonstiges':              'Pozostałe',
  'sonstiges zubehör':      'Akcesoria różne',
  'verschiedenes':          'Różne',
  'büroartikel':            'Artykuły biurowe',
  'beleuchtung':            'Oświetlenie',
  'smart home':             'Smart Home',
  'gaming':                 'Gaming',
  'beamer':                 'Projektory',
  'projektor':              'Projektory',
  'kamera':                 'Kamery',
  'kameras':                'Kamery',
};

/**
 * Sprawdza czy ciąg wygląda jak język niemiecki (wiele słów DE, brak PL znaków).
 */
function _isGerman(str) {
  if (!str) return false;
  const lo = str.toLowerCase();
  // Has typical German words or umlauts
  if (/[äöüß]/.test(lo)) return true;
  // Has Polish characters → definitely not German
  if (/[ąćęłńóśźż]/i.test(lo)) return false;
  // Check against German keyword list
  for (const de of Object.keys(GERMAN_TO_POLISH)) {
    if (lo === de || lo.startsWith(de + ' ') || lo.endsWith(' ' + de)) return true;
  }
  return false;
}

/**
 * Tłumaczy nazwę kategorii z niemieckiego na polski jeśli jest taka potrzeba.
 * Najpierw sprawdza pełne dopasowanie, potem częściowe.
 */
function _translateGermanCategory(raw) {
  const lo = raw.toLowerCase().trim();
  // 1. Pełne dopasowanie
  if (GERMAN_TO_POLISH[lo]) return GERMAN_TO_POLISH[lo];
  // 2. Częściowe dopasowanie — szukaj czy DE słowo jest częścią nazwy
  for (const [de, pl] of Object.entries(GERMAN_TO_POLISH)) {
    if (lo.includes(de)) {
      // Replace the German part, keep the rest (if any extra words)
      return raw.replace(new RegExp(de, 'i'), pl).trim();
    }
  }
  return raw; // nie znaleziono tłumaczenia
}

/**
 * Normalizuje nazwę kategorii i zwraca/tworzy wpis w product_categories.
 * Używa tabeli category_aliases do mapowania surowych nazw hurtowni na zunifikowane kategorie.
 * Ujednolica kategorie ze wszystkich hurtowni wyciągając ostatni segment ścieżki.
 */
function resolveCategory(db, rawName) {
  if (!rawName || !rawName.trim()) return null;
  let clean = rawName.trim()
    .replace(/<[^>]+>/g, '')     // strip HTML tags
    .replace(/&\w+;/g, ' ')      // strip HTML entities
    .replace(/\s+/g, ' ')
    .trim();
  
  // Ignoruj kategorie, które składają się z samych cyfr
  if (/^\d+$/.test(clean)) return null;

  // ─── Tłumaczenie DE→PL (zanim zapiszemy do aliasu/kategorii) ───────────────
  if (_isGerman(clean)) {
    clean = _translateGermanCategory(clean);
  }
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Normalizuj surową nazwę do klucza aliasu
  const aliasKey = clean.toLowerCase().replace(/[\s\/\\|>]+/g, ' ').trim();
  if (!aliasKey) return null;

  // 1) Sprawdź alias
  const alias = db.prepare('SELECT category_id FROM category_aliases ca JOIN product_categories pc ON pc.id = ca.category_id WHERE ca.raw_name = ?').get(aliasKey);
  if (alias) return alias.category_id;

  // 2) Wyciągnij ostatni segment (ujednolicony tytuł kategorii)
  const segment = extractCategorySegment(clean);
  if (!segment || /^\d+$/.test(segment)) return null;
  
  // Canonical key: without Polish chars, lowercase (for DB comparison)
  const segCanon = _canonicalCatKey(segment);
  if (!segCanon) return null;

  // 3) Szukaj istniejącej kategorii po canonical key (robustne porównanie polskich znaków)
  // We store canonical in slug field, OR compare by stripping Polish from both sides
  const allCatsLike = db.prepare(
    'SELECT id, name FROM product_categories WHERE name LIKE ? LIMIT 5'
  ).all('%' + segment.split(' ')[0] + '%');
  
  const matchedCat = allCatsLike.find(c => _canonicalCatKey(c.name) === segCanon);
  if (matchedCat) {
    try { db.prepare('INSERT OR IGNORE INTO category_aliases (raw_name, category_id) VALUES (?, ?)').run(aliasKey, matchedCat.id); } catch(_) {}
    return matchedCat.id;
  }

  // 3b) Fallback - SQLite LOWER (for ASCII-only categories)
  const segLower = segment.toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM product_categories WHERE LOWER(name) = ?').get(segLower);
  if (existing) {
    try { db.prepare('INSERT OR IGNORE INTO category_aliases (raw_name, category_id) VALUES (?, ?)').run(aliasKey, existing.id); } catch(_) {}
    return existing.id;
  }

  // 4) Szukaj podobnej po segmencie (prefiks o długości >= 4)
  if (segLower.length >= 4) {
    const similar = db.prepare("SELECT id, name FROM product_categories WHERE LOWER(name) LIKE ? OR ? LIKE LOWER(name) || '%' LIMIT 1").get(segLower + '%', segLower);
    if (similar) {
      try { db.prepare('INSERT OR IGNORE INTO category_aliases (raw_name, category_id) VALUES (?, ?)').run(aliasKey, similar.id); } catch(_) {}
      return similar.id;
    }
  }

  // 5) Utwórz nową kategorię z ujednoliconą nazwą (Title Case — PRESERVE Polish chars)
  // IMPORTANT: Do NOT call .toLowerCase() on the rest of the word — it would mangle Polish chars
  // stored as UTF-8 in the file but compared via LOWER() in SQLite
  const titleCase = segment.trim().split(/\s+/).map(w => {
    if (!w) return w;
    return w.charAt(0).toUpperCase() + w.slice(1); // preserve rest AS-IS, no toLowerCase()
  }).join(' ');
  
  const slug = segCanon.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  
  let catId;
  try {
    const res = db.prepare('INSERT INTO product_categories (name, slug) VALUES (?, ?)').run(titleCase, slug);
    catId = Number(res.lastInsertRowid);
  } catch (e) {
    // Jeśli nazwa już istnieje (race condition), pobierz ją
    const ex = db.prepare('SELECT id FROM product_categories WHERE name = ?').get(titleCase);
    if (ex) catId = ex.id;
    else return null;
  }
  try { db.prepare('INSERT OR IGNORE INTO category_aliases (raw_name, category_id) VALUES (?, ?)').run(aliasKey, catId); } catch(_) {}
  
  // 6) Automatycznie wygeneruj domyślne atrybuty (filtry) dla nowej kategorii
  seedCategoryAttrSchema(db, catId, titleCase);
  
  return catId;
}

/**
 * Automatycznie generuje filtry (atrybuty) dla kategorii na podstawie CATEGORY_ATTR_MAP.
 */
function seedCategoryAttrSchema(db, categoryId, categoryName) {
  return attrSync.seedCategoryAttrSchema(db, categoryId, categoryName, CATEGORY_ATTR_MAP) > 0;
}

// ─── Catalog Rebuild ────────────────────────────────────────────────────────────

/**
 * Przebudowuje wpisy w catalog_master po odświeżeniu konkretnej hurtowni.
 * Wywoływana automatycznie na końcu refreshSupplier().
 * 
 * @param {object} db - instancja better-sqlite3 
 * @param {number} supplierId - ID hurtowni, która właśnie się odświeżyła
 */
function loadLiveOffersForEan(db, canonical) {
  const variants = eanVariants(canonical);
  const placeholders = variants.map(() => '?').join(',') || '?';
  const norm = normalizeEan(canonical) || canonical;
  const sql = `
    SELECT sp.ean, sp.name, sp.manufacturer, sp.manufacturer_code, sp.price_pln, sp.stock_quantity,
           sp.weight_g, sp.supplier_id, sp.category, sp.attributes, s.name as supplier_name
    FROM supplier_products sp
    JOIN suppliers s ON s.id = sp.supplier_id
    WHERE ${hasNormalizedEanColumn(db)
      ? `(sp.normalized_ean = ? OR sp.ean IN (${placeholders}))`
      : `sp.ean IN (${placeholders})`}
  `;
  const params = hasNormalizedEanColumn(db)
    ? [norm, ...(variants.length ? variants : [canonical])]
    : (variants.length ? variants : [canonical]);
  return db.prepare(sql).all(...params);
}

function hasNormalizedEanColumn(db) {
  if (!db._hasNormalizedEan) {
    try {
      const cols = db.prepare('PRAGMA table_info(supplier_products)').all().map(c => c.name);
      db._hasNormalizedEan = cols.includes('normalized_ean');
    } catch (_) {
      db._hasNormalizedEan = false;
    }
  }
  return db._hasNormalizedEan;
}

function pruneStaleSupplierOffers(db, supplierId, currentCanonicalSet) {
  let pruned = 0;
  let listed = [];
  try {
    listed = db.prepare(`
      SELECT id, canonical_ean, all_eans, original_names
      FROM catalog_master
      WHERE EXISTS (
        SELECT 1 FROM json_each(supplier_ids) WHERE CAST(value AS INTEGER) = ?
      )
    `).all(supplierId);
  } catch (_) {
    return 0;
  }
  if (!listed.length) return 0;

  const update = db.prepare(`
    UPDATE catalog_master
    SET supplier_ids = ?, supplier_names = ?, best_price_pln = ?, avg_price_pln = ?,
        total_stock = ?, original_names = ?, last_updated = datetime('now')
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    for (const row of listed) {
      const keys = new Set(eanVariants(row.canonical_ean).map(normalizeEan));
      try {
        const extra = JSON.parse(row.all_eans || '[]');
        if (Array.isArray(extra)) extra.forEach(e => { const n = normalizeEan(e); if (n) keys.add(n); });
      } catch (_) {}
      let stillHere = false;
      for (const k of keys) {
        if (currentCanonicalSet.has(k)) { stillHere = true; break; }
      }
      if (stillHere) continue;

      const live = loadLiveOffersForEan(db, row.canonical_ean);
      const supplierMap = new Map();
      let totalStock = 0, priceSum = 0, priceCount = 0, bestPrice = Infinity;
      for (const sp of live) {
        supplierMap.set(sp.supplier_id, sp.supplier_name);
        if (sp.stock_quantity > 0) totalStock += sp.stock_quantity;
        if (sp.price_pln > 0) {
          priceSum += sp.price_pln;
          priceCount++;
          if (sp.price_pln < bestPrice) bestPrice = sp.price_pln;
        }
      }
      let orig = {};
      try { orig = JSON.parse(row.original_names || '{}'); } catch (_) {}
      const keepNames = new Set([...supplierMap.values()]);
      for (const k of Object.keys(orig)) {
        if (!keepNames.has(k)) delete orig[k];
      }
      update.run(
        JSON.stringify([...supplierMap.keys()]),
        JSON.stringify([...supplierMap.values()]),
        bestPrice === Infinity ? 0 : bestPrice,
        priceCount ? priceSum / priceCount : 0,
        totalStock,
        JSON.stringify(orig),
        row.id
      );
      pruned++;
    }
  });
  tx();
  return pruned;
}

function rebuildCatalogForSupplier(db, supplierId) {
  // Pobierz nazwę hurtowni
  const supplier = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(supplierId);
  if (!supplier) return { updated: 0, created: 0, pruned: 0 };

  // Pobierz wszystkie produkty tej hurtowni
  const products = db.prepare('SELECT * FROM supplier_products WHERE supplier_id = ?').all(supplierId);
  const currentCanonicalSet = new Set();
  for (const p of products) {
    const canonical = normalizeEan(p.ean);
    if (canonical) currentCanonicalSet.add(canonical);
  }
  if (!products.length) {
    const pruned = pruneStaleSupplierOffers(db, supplierId, currentCanonicalSet);
    return { updated: 0, created: 0, pruned, total: pruned };
  }

  // Przygotuj statements
  const findByEan = db.prepare('SELECT * FROM catalog_master WHERE canonical_ean = ?');
  const findByMfrCode = db.prepare("SELECT * FROM catalog_master WHERE manufacturer_code = ? AND manufacturer_code IS NOT NULL AND manufacturer_code != ''");
  const insertMaster = db.prepare(`
    INSERT INTO catalog_master (canonical_ean, all_eans, manufacturer_code, manufacturer, name, weight_g, 
      width_mm, height_mm, depth_mm, dimensions_raw, supplier_ids, supplier_names, best_price_pln, avg_price_pln, total_stock, category_id, category_name, original_names, raw_attributes, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const updateMaster = db.prepare(`
    UPDATE catalog_master SET 
      all_eans = ?, manufacturer_code = COALESCE(NULLIF(?, ''), manufacturer_code),
      manufacturer = COALESCE(NULLIF(?, ''), manufacturer), 
      name = CASE WHEN length(?) > length(COALESCE(name,'')) THEN ? ELSE name END,
      weight_g = CASE WHEN weight_source = 'sellasist' THEN weight_g WHEN ? > 0 THEN ? ELSE weight_g END,
      width_mm = CASE WHEN ? > 0 THEN ? ELSE width_mm END,
      height_mm = CASE WHEN ? > 0 THEN ? ELSE height_mm END,
      depth_mm = CASE WHEN ? > 0 THEN ? ELSE depth_mm END,
      dimensions_raw = COALESCE(NULLIF(?, ''), dimensions_raw),
      supplier_ids = ?, supplier_names = ?,
      best_price_pln = ?, avg_price_pln = ?, total_stock = ?,
      category_id = COALESCE(?, category_id),
      category_name = COALESCE(NULLIF(?, ''), category_name),
      original_names = ?,
      raw_attributes = ?,
      last_updated = datetime('now')
    WHERE id = ?
  `);

  let created = 0, updated = 0;

  // Grupuj produkty po znormalizowanym EAN
  const groupedByEan = new Map();
  for (const p of products) {
    const canonical = normalizeEan(p.ean);
    if (!canonical) continue;
    if (!groupedByEan.has(canonical)) groupedByEan.set(canonical, []);
    groupedByEan.get(canonical).push(p);
  }

  const transaction = db.transaction(() => {
    for (const [canonical, prods] of groupedByEan) {
      const firstProd = prods[0];
      let mfrCode = firstProd.manufacturer_code || '';
      
      // Szukaj istniejącego wpisu (canonical + warianty EAN)
      let existing = findByEan.get(canonical);
      if (!existing) {
        for (const v of eanVariants(canonical)) {
          if (v === canonical) continue;
          existing = findByEan.get(v);
          if (existing) break;
        }
      }

      // Jeśli nie znaleziono po EAN, spróbuj po kodzie producenta
      if (!existing && mfrCode) {
        const byMfr = findByMfrCode.get(mfrCode);
        if (byMfr) {
          // Sprawdź czy EAN-y pasują (z zerem / bez)
          const existingEans = JSON.parse(byMfr.all_eans || '[]');
          const anyMatch = existingEans.some(e => eanMatch(e, firstProd.ean));
          if (anyMatch) {
            existing = byMfr;
          }
        }
      }

      // Pobierz aktualne oferty ze wszystkich hurtowni (bez trzymania starych supplier_ids)
      const allWithEan = loadLiveOffersForEan(db, canonical);

      // Zbierz unikalne hurtownie + oryginalne nazwy
      const supplierMap = new Map();
      const origNames = {};
      let totalStock = 0;
      let priceSum = 0, priceCount = 0;
      let bestPrice = Infinity;
      const allEanSet = new Set();

      // Merge attributes (flatten + canonical keys; first canonical value wins)
      const mergedAttrs = {};
      const rebuildAliasMap = attrSync.loadAliasMaps(db);
      if (existing && existing.raw_attributes) {
        try {
          const prev = JSON.parse(existing.raw_attributes);
          if (prev && typeof prev === 'object') attrSync.ingestFlatAttrs(mergedAttrs, prev, rebuildAliasMap);
        } catch(e){}
      }
      
      for (const sp of allWithEan) {
        supplierMap.set(sp.supplier_id, sp.supplier_name);
        allEanSet.add(sp.ean);
        // Zachowaj oryginalną nazwę z każdej hurtowni
        if (sp.name && sp.supplier_name) {
          origNames[sp.supplier_name] = sp.name.replace(/[\r\n]+/g, ' ').trim();
        }
        // Merge attributes
        if (sp.attributes) {
          try {
            const parsed = typeof sp.attributes === 'string' ? JSON.parse(sp.attributes) : sp.attributes;
            attrSync.ingestFlatAttrs(mergedAttrs, parsed, rebuildAliasMap);
          } catch(e) {}
        }
        // Zbierz manufacturer_code z dowolnej hurtowni (jeśli brak w pierwszej)
        if (sp.manufacturer_code && !mfrCode) {
          mfrCode = sp.manufacturer_code;
        }
        if (sp.stock_quantity > 0) totalStock += sp.stock_quantity;
        if (sp.price_pln > 0) {
          priceSum += sp.price_pln;
          priceCount++;
          if (sp.price_pln < bestPrice) bestPrice = sp.price_pln;
        }
      }

      // Zachowaj znane warianty EAN, ale NIE doklejaj hurtowni, których już nie ma w feedzie
      if (existing) {
        try {
          const existingEans = JSON.parse(existing.all_eans || '[]');
          existingEans.forEach(e => allEanSet.add(e));
        } catch (_) {}
      }

      const allEans = JSON.stringify([...allEanSet]);
      const sids = JSON.stringify([...supplierMap.keys()]);
      const snames = JSON.stringify([...supplierMap.values()]);
      const rawAttrsStr = Object.keys(mergedAttrs).length > 0 ? JSON.stringify(mergedAttrs) : '{}';
      if (bestPrice === Infinity) bestPrice = 0;
      const avgPrice = priceCount > 0 ? priceSum / priceCount : 0;

      // Parsuj wymiary
      const dims = parseDimensions(firstProd.dimensions_raw || '');
      const weightG = firstProd.weight_g || dims.weight_g || 0;

      // Najlepsza nazwa — używa cleanProductName z filtrowaniem garbled
      let bestName = '';
      const candidateNames = [];
      for (const sp of allWithEan) {
        if (!sp.name) continue;
        const clean = cleanProductName(sp.name);
        if (clean && clean.length <= 200) {
          candidateNames.push(clean);
        }
      }
      // Sortuj: preferuj dłuższe nazwy (ale nie za długie), unikaj tych z EAN w nazwie
      if (candidateNames.length > 0) {
        candidateNames.sort((a, b) => {
          // Penalizuj nazwy zawierające sam EAN/kod
          const aHasEan = /^\d{8,14}$/.test(a.replace(/\s/g, ''));
          const bHasEan = /^\d{8,14}$/.test(b.replace(/\s/g, ''));
          if (aHasEan && !bHasEan) return 1;
          if (!aHasEan && bHasEan) return -1;
          // Preferuj nazwy 20-150 znaków
          const aOk = a.length >= 10 && a.length <= 150;
          const bOk = b.length >= 10 && b.length <= 150;
          if (aOk && !bOk) return -1;
          if (!aOk && bOk) return 1;
          return b.length - a.length;
        });
        bestName = candidateNames[0];
      }

      // Normalizuj producenta
      const normalizedMfg = normalizeManufacturer(firstProd.manufacturer || '');

      // Resolve category: skip Impakt id|id, prefer AB tree, then longest readable name
      let categoryId = null, categoryName = '';
      let bestCat = null;
      for (const sp of allWithEan) {
        const raw = (sp.category || '').trim();
        if (!raw || /^\d+\|\d+/.test(raw) || raw.startsWith('<')) continue;
        const cid = resolveCategory(db, raw);
        if (!cid) continue;
        const cat = db.prepare('SELECT id, name, is_ab_category FROM product_categories WHERE id = ?').get(cid);
        if (!cat) continue;
        let score = 1 + Math.min(String(cat.name || '').length, 40) / 40;
        if (cat.is_ab_category) score += 5;
        if (bestCat == null || score > bestCat.score) bestCat = { id: cat.id, name: cat.name, score };
      }
      if (bestCat) {
        categoryId = bestCat.id;
        categoryName = bestCat.name || '';
      } else if (existing && existing.category_id) {
        categoryId = existing.category_id;
        categoryName = existing.category_name || '';
      }

      const origNamesJson = JSON.stringify(origNames);

      if (existing) {
        // Merge existing original_names with new
        let mergedOrig = origNames;
        try {
          const prev = JSON.parse(existing.original_names || '{}');
          const keepNames = new Set([...supplierMap.values()]);
          mergedOrig = {};
          for (const [k, v] of Object.entries(prev)) {
            if (keepNames.has(k)) mergedOrig[k] = v;
          }
          Object.assign(mergedOrig, origNames);
        } catch {}

        updateMaster.run(
          allEans, mfrCode,
          normalizedMfg,
          bestName, bestName,
          weightG, weightG,
          dims.width_mm, dims.width_mm,
          dims.height_mm, dims.height_mm,
          dims.depth_mm, dims.depth_mm,
          firstProd.dimensions_raw || '',
          sids, snames,
          bestPrice, avgPrice, totalStock,
          categoryId, categoryName,
          JSON.stringify(mergedOrig),
          rawAttrsStr,
          existing.id
        );
        updated++;
      } else {
        insertMaster.run(
          canonical, allEans, mfrCode,
          normalizedMfg, bestName, weightG,
          dims.width_mm, dims.height_mm, dims.depth_mm,
          firstProd.dimensions_raw || '',
          sids, snames,
          bestPrice, avgPrice, totalStock,
          categoryId, categoryName,
          origNamesJson,
          rawAttrsStr
        );
        created++;
      }
    }
  });

  transaction();

  const pruned = pruneStaleSupplierOffers(db, supplierId, currentCanonicalSet);
  let attrs = { products: 0, filled: 0, raw_updated: 0 };
  try {
    attrs = attrSync.syncCatalogAttributes(db, {
      eans: [...currentCanonicalSet],
      seedSchemas: true,
      attrMap: CATEGORY_ATTR_MAP,
    });
  } catch (e) {
    console.warn('[catalog] sync attributes:', e.message);
  }
  return { created, updated, pruned, attrs, total: created + updated };
}

/**
 * Pełna przebudowa katalogu ze wszystkich hurtowni.
 */
function rebuildEntireCatalog(db) {
  // Wyczyść i przebuduj
  db.prepare('DELETE FROM catalog_master').run();

  const suppliers = db.prepare('SELECT id FROM suppliers').all();
  let totalCreated = 0, totalUpdated = 0;

  for (const s of suppliers) {
    const r = rebuildCatalogForSupplier(db, s.id);
    totalCreated += r.created;
    totalUpdated += r.updated;
  }

  return { created: totalCreated, updated: totalUpdated };
}

/**
 * Statystyki katalogu master.
 */
function getCatalogStats(db) {
  const total = db.prepare('SELECT COUNT(*) as cnt FROM catalog_master').get()?.cnt || 0;
  const withWeight = db.prepare('SELECT COUNT(*) as cnt FROM catalog_master WHERE weight_g > 0').get()?.cnt || 0;
  const withDimensions = db.prepare('SELECT COUNT(*) as cnt FROM catalog_master WHERE width_mm > 0 OR height_mm > 0').get()?.cnt || 0;
  const multiSupplier = db.prepare("SELECT COUNT(*) as cnt FROM catalog_master WHERE json_array_length(supplier_ids) > 1").get()?.cnt || 0;
  const multiEan = db.prepare("SELECT COUNT(*) as cnt FROM catalog_master WHERE json_array_length(all_eans) > 1").get()?.cnt || 0;

  // Top producenci
  const topManufacturers = db.prepare(`
    SELECT manufacturer, COUNT(*) as cnt 
    FROM catalog_master 
    WHERE manufacturer IS NOT NULL AND manufacturer != '' 
    GROUP BY manufacturer COLLATE NOCASE ORDER BY cnt DESC LIMIT 15
  `).all();

  // Rozkład per hurtownia
  const suppliers = db.prepare('SELECT id, name, product_count FROM suppliers ORDER BY product_count DESC').all();

  return {
    total,
    withWeight,
    withDimensions,
    multiSupplier,
    multiEan,
    topManufacturers,
    suppliers
  };
}

/**
 * Wyszukiwanie / przeglądanie katalogu z paginacją.
 */
function searchCatalog(db, { search = '', manufacturer = '', manufacturerSearch = '', supplierName = '', supplierIds = [], categoryId = null, inSubiekt = null, availability = null, attrFilters = {}, condition = 'new', page = 1, limit = 50, sort = 'name', order = 'asc' } = {}) {
  registerNormalizeEan(db);
  let where = 'WHERE 1=1';
  const params = [];
  let joinSubiekt = '';
  let joinAttrs = '';
  let joinSupplierCondition = '';
  const liveOfferMatch = hasNormalizedEanColumn(db)
    ? `COALESCE(NULLIF(sp_x.normalized_ean, ''), normalize_ean(sp_x.ean)) = normalize_ean(cm.canonical_ean)`
    : `normalize_ean(sp_x.ean) = normalize_ean(cm.canonical_ean)`;

  if (availability) {
    where += ` AND EXISTS (SELECT 1 FROM supplier_products sp_x WHERE ${liveOfferMatch} AND sp_x.availability = ?)`;
    params.push(availability);
  }

  if (condition) {
    where += ` AND EXISTS (SELECT 1 FROM supplier_products sp_x WHERE ${liveOfferMatch} AND sp_x.condition = ?)`;
    params.push(condition);
  }

  if (search) {
    where += ' AND (cm.canonical_ean LIKE ? OR cm.name LIKE ? OR cm.normalized_name LIKE ? OR cm.manufacturer_code LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (manufacturer) {
    where += ' AND cm.manufacturer COLLATE NOCASE = ?';
    params.push(manufacturer);
  }
  if (manufacturerSearch) {
    where += ' AND cm.manufacturer LIKE ?';
    params.push(`%${manufacturerSearch}%`);
  }
  // Multi-supplier filter (array of supplier names)
  if (supplierIds && supplierIds.length > 0) {
    const conditions = supplierIds.map(() => 'cm.supplier_names LIKE ?');
    where += ` AND (${conditions.join(' OR ')})`;
    for (const sn of supplierIds) {
      params.push(`%${sn}%`);
    }
  } else if (supplierName) {
    where += ' AND cm.supplier_names LIKE ?';
    params.push(`%${supplierName}%`);
  }
  let withCte = '';
  if (categoryId === 'unmapped') {
    where += ' AND (cm.category_id IS NULL OR cm.category_id IN (SELECT id FROM product_categories WHERE (ab_category_id IS NULL OR ab_category_id = 0) AND is_ab_category = 0))';
  } else if (categoryId) {
    withCte = `
      WITH RECURSIVE descendants(id) AS (
        SELECT ?
        UNION ALL
        SELECT pc.id FROM product_categories pc JOIN descendants d ON pc.parent_id = d.id
      )
    `;
    where += ' AND (cm.category_id IN (SELECT id FROM descendants) OR cm.category_id IN (SELECT id FROM product_categories WHERE ab_category_id IN (SELECT id FROM descendants)))';
    // The CTE takes one parameter (the root category ID). We will prepend it to the params array later.
  }
  // Dynamic attribute filters: { attrId: value }
  const attrJoinParams = [];
  if (attrFilters && Object.keys(attrFilters).length > 0) {
    let attrIdx = 0;
    for (const [attrId, value] of Object.entries(attrFilters)) {
      if (!value) continue;
      const alias = `paf${attrIdx++}`;
      if (value.includes('|')) {
        // Range filter: min|max
        const [min, max] = value.split('|');
        let rangeCond = '';
        if (min !== '') { rangeCond += ` AND ${alias}.value_numeric >= ?`; attrJoinParams.push(parseFloat(min)); }
        if (max !== '') { rangeCond += ` AND ${alias}.value_numeric <= ?`; attrJoinParams.push(parseFloat(max)); }
        joinAttrs += ` INNER JOIN product_attributes ${alias} ON ${alias}.catalog_id = cm.id AND ${alias}.attribute_id = ?${rangeCond}`;
        attrJoinParams.splice(attrJoinParams.length - (min !== '' ? 1 : 0) - (max !== '' ? 1 : 0), 0, parseInt(attrId)); // Insert attrId before min/max
      } else if (value.includes(',')) {
        // Multi-select
        const vals = value.split(',');
        const placeholders = vals.map(() => '?').join(',');
        joinAttrs += ` INNER JOIN product_attributes ${alias} ON ${alias}.catalog_id = cm.id AND ${alias}.attribute_id = ? AND ${alias}.value_text IN (${placeholders})`;
        attrJoinParams.push(parseInt(attrId), ...vals);
      } else {
        // Exact match
        joinAttrs += ` INNER JOIN product_attributes ${alias} ON ${alias}.catalog_id = cm.id AND ${alias}.attribute_id = ? AND ${alias}.value_text = ?`;
        attrJoinParams.push(parseInt(attrId), value);
      }
    }
  }
  // Filtr Subiekt: 'yes' = tylko w Subiekt, 'no' = tylko brak w Subiekt
  if (inSubiekt === 'yes' || inSubiekt === 'no') {
    joinSubiekt = hasNormalizedEanColumn(db)
      ? ` LEFT JOIN subiekt_products sp_f ON COALESCE(NULLIF(sp_f.normalized_ean, ''), normalize_ean(sp_f.ean)) = normalize_ean(cm.canonical_ean)`
      : ` LEFT JOIN subiekt_products sp_f ON normalize_ean(sp_f.ean) = normalize_ean(cm.canonical_ean)`;
    if (inSubiekt === 'yes') where += ' AND sp_f.ean IS NOT NULL';
    else where += ' AND sp_f.ean IS NULL';
  }

  // Dozwolone kolumny sortowania
  const allowedSort = ['name', 'manufacturer', 'canonical_ean', 'best_price_pln', 'total_stock', 'weight_g', 'last_updated'];
  const sortCol = allowedSort.includes(sort) ? sort : 'name';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

  // Join params go first (for JOIN ON clauses), then WHERE params
  // Wait, if withCte is present, its parameters (the root categoryId) must be the VERY FIRST parameters bound!
  let cteParams = [];
  if (withCte) {
    // The CTE has 2 placeholders: SELECT ? UNION ALL ... and the other SELECT ? UNION ALL ...
    // Because I put two WITH RECURSIVE ? Ah no, SQLite only allows ONE WITH clause.
    // Let me check my withCte definition.
    // It is just one WITH RECURSIVE descendants(id) AS (SELECT ? UNION ALL ...)
    // So it takes 1 parameter.
    cteParams = [categoryId];
  }

  const allParams = [...cteParams, ...attrJoinParams, ...params];

  const countRow = db.prepare(`${withCte} SELECT COUNT(DISTINCT cm.id) as cnt FROM catalog_master cm${joinAttrs}${joinSubiekt} ${where}`).get(...allParams);
  const total = countRow?.cnt || 0;
  const offset = (page - 1) * limit;

  const rows = db.prepare(`
    ${withCte}
    SELECT DISTINCT cm.* FROM catalog_master cm${joinAttrs}${joinSubiekt}
    ${where} 
    ORDER BY CASE WHEN cm.${sortCol} IS NULL OR cm.${sortCol} = '' THEN 1 ELSE 0 END, cm.${sortCol} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...allParams, limit, offset);


  // Prepare subiekt lookup (canonical + warianty EAN)
  let findSubiekt;
  try {
    findSubiekt = (ean) => {
      const vars = eanVariants(ean);
      if (!vars.length) return null;
      const norm = normalizeEan(ean);
      if (hasNormalizedEanColumn(db)) {
        return db.prepare(
          `SELECT ean, stock, name, buy_price, sell_price FROM subiekt_products
           WHERE normalized_ean = ? OR ean IN (${vars.map(() => '?').join(',')}) LIMIT 1`
        ).get(norm, ...vars);
      }
      return db.prepare(
        `SELECT ean, stock, name, buy_price, sell_price FROM subiekt_products WHERE ean IN (${vars.map(() => '?').join(',')}) LIMIT 1`
      ).get(...vars);
    };
  } catch(_) {}

  // Prepare best supplier lookup
  let findBestSupplier;
  try {
    findBestSupplier = (ean, price) => {
      const vars = eanVariants(ean);
      if (!vars.length) return null;
      const norm = normalizeEan(ean);
      const where = hasNormalizedEanColumn(db)
        ? `(sp.normalized_ean = ? OR sp.ean IN (${vars.map(() => '?').join(',')}))`
        : `sp.ean IN (${vars.map(() => '?').join(',')})`;
      const params = hasNormalizedEanColumn(db) ? [norm, ...vars, price] : [...vars, price];
      return db.prepare(`
        SELECT s.name FROM supplier_products sp
        JOIN suppliers s ON s.id = sp.supplier_id
        WHERE ${where} AND sp.price_pln = ?
        LIMIT 1
      `).get(...params);
    };
  } catch(_) {}

  // Parse JSON fields + enrich with Subiekt info + best supplier name
  for (const row of rows) {
    try { row.all_eans = JSON.parse(row.all_eans || '[]'); } catch { row.all_eans = []; }
    try { row.supplier_ids = JSON.parse(row.supplier_ids || '[]'); } catch { row.supplier_ids = []; }
    try { row.supplier_names = JSON.parse(row.supplier_names || '[]'); } catch { row.supplier_names = []; }

    // Subiekt enrichment
    row.in_subiekt = false;
    row.subiekt_stock = null;
    row.subiekt_buy_price = null;
    row.subiekt_sell_price = null;
    if (findSubiekt) {
      try {
        const sub = findSubiekt(row.canonical_ean);
        if (sub) {
          row.in_subiekt = true;
          row.subiekt_stock = sub.stock ?? null;
          row.subiekt_buy_price = sub.buy_price ?? null;
          row.subiekt_sell_price = sub.sell_price ?? null;
        }
      } catch(_) {}
    }

    // Best supplier name
    row.best_supplier_name = null;
    if (findBestSupplier && row.best_price_pln > 0 && row.supplier_ids.length > 0) {
      try {
        const best = findBestSupplier(row.canonical_ean, row.best_price_pln);
        if (best) row.best_supplier_name = best.name;
      } catch(_) {}
    }
  }

  return {
    items: rows,
    total,
    page,
    pages: Math.ceil(total / limit),
    limit
  };
}

/**
 * Lista producentów w katalogu master.
 */
function getCatalogManufacturers(db) {
  return db.prepare(`
    SELECT manufacturer, COUNT(*) as cnt 
    FROM catalog_master 
    WHERE manufacturer IS NOT NULL AND manufacturer != '' 
    GROUP BY manufacturer COLLATE NOCASE ORDER BY manufacturer COLLATE NOCASE ASC
  `).all();
}

/**
 * Pobiera ceny ze wszystkich hurtowni dla danego EAN-u katalogu master.
 * Sortowane od najtańszej.
 */
function getCatalogEanPrices(db, ean) {
  if (!ean) return [];
  const variants = eanVariants(ean);
  const placeholders = variants.map(() => '?').join(',') || '?';
  const params = variants.length ? variants : [ean];
  const norm = normalizeEan(ean);
  const where = hasNormalizedEanColumn(db)
    ? `(sp.normalized_ean = ? OR sp.ean IN (${placeholders}))`
    : `sp.ean IN (${placeholders})`;
  const whereParams = hasNormalizedEanColumn(db) ? [norm, ...params] : params;
  const rows = db.prepare(`
    SELECT sp.price_pln, sp.availability, sp.stock_quantity,
           sp.manufacturer_code AS sku, sp.category AS supplier_category, sp.manufacturer AS supplier_manufacturer,
           sp.name AS supplier_product_name, sp.attributes AS supplier_attributes,
           s.name AS supplier_name, s.id AS supplier_id, s.currency
    FROM supplier_products sp
    JOIN suppliers s ON s.id = sp.supplier_id
    WHERE ${where}
    ORDER BY CASE WHEN sp.price_pln > 0 THEN 0 ELSE 1 END, sp.price_pln ASC
  `).all(...whereParams);
  
  // Parse attributes
  rows.forEach(r => {
    try { r.supplier_attributes = JSON.parse(r.supplier_attributes || '{}'); } 
    catch { r.supplier_attributes = {}; }
  });

  // Enrich with Subiekt data
  let subiekt = null;
  try {
    const subVariants = eanVariants(ean);
    const subParams = subVariants.length ? subVariants : [ean];
    const sub = hasNormalizedEanColumn(db)
      ? db.prepare(
          `SELECT ean, stock, name, buy_price, sell_price FROM subiekt_products
           WHERE normalized_ean = ? OR ean IN (${subParams.map(() => '?').join(',')}) LIMIT 1`
        ).get(normalizeEan(ean), ...subParams)
      : db.prepare(
          `SELECT ean, stock, name, buy_price, sell_price FROM subiekt_products WHERE ean IN (${subParams.map(() => '?').join(',')}) LIMIT 1`
        ).get(...subParams);
    if (sub) subiekt = sub;
  } catch(_) {}

  return { prices: rows, subiekt };
}


// ─── Categories & Duplicates API ────────────────────────────────────────────────────────

function getCategories(db) {
  return db.prepare('SELECT * FROM product_categories WHERE product_count > 0 ORDER BY name ASC').all();
}

/**
 * Wyszukiwanie kategorii po nazwie (tekstowo).
 */
function searchCategories(db, query) {
  if (!query || !query.trim()) return getCategories(db);
  const q = `%${query.trim()}%`;
  return db.prepare('SELECT * FROM product_categories WHERE name LIKE ? AND product_count > 0 ORDER BY product_count DESC, name ASC LIMIT 50').all(q);
}

/**
 * Zwraca drzewo kategorii AB do wyświetlenia w panelu bocznym Katalogu Master.
 * 
 * Logika hierarchii:
 * 1. Kategorie oznaczone is_ab_category=1 → węzły główne drzewa AB
 * 2. Kategorie z ab_category_id → liście przypisane do AB
 * 3. Kategorie bez ab_category_id i bez is_ab_category → "Nieprzypisane"
 * 
 * Zwraca: { abTree: [...], unmappedCount, unmappedCategories: [...] }
 */
/**
 * FALLBACK: Auto-generate categories from manufacturer names in catalog_master.
 * Called when no supplier provides category data and product_categories is empty.
 * Groups products by manufacturer and creates a flat category tree.
 */
function _autoGenerateCategoriesFromManufacturers(db) {
  // Ensure product_categories table exists
  try {
    db.prepare(`CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT,
      parent_id INTEGER,
      product_count INTEGER DEFAULT 0,
      is_ab_category INTEGER DEFAULT 0,
      ab_category_id INTEGER,
      source_supplier_id INTEGER
    )`).run();
  } catch(_) {}

  // Get top manufacturers by product count
  const manufacturers = db.prepare(`
    SELECT manufacturer, COUNT(*) as cnt
    FROM catalog_master
    WHERE manufacturer IS NOT NULL AND manufacturer != ''
    GROUP BY manufacturer COLLATE NOCASE
    ORDER BY cnt DESC
    LIMIT 200
  `).all();

  if (manufacturers.length === 0) return;

  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO product_categories (name, slug, is_ab_category, product_count)
    VALUES (?, ?, 1, ?)
  `);

  const updateProduct = db.prepare(`
    UPDATE catalog_master SET category_id = ?, category_name = ?
    WHERE manufacturer COLLATE NOCASE = ? AND (category_id IS NULL OR category_id = 0)
  `);

  const transaction = db.transaction(() => {
    for (const m of manufacturers) {
      const name = m.manufacturer;
      const slug = name.toLowerCase().replace(/[^a-z0-9ąćęłńóśżź]+/g, '-').replace(/^-|-$/g, '');
      
      // Insert category
      insertCat.run(name, slug, m.cnt);
      
      // Get the category ID
      const cat = db.prepare('SELECT id FROM product_categories WHERE name = ? LIMIT 1').get(name);
      if (cat) {
        // Assign products to this category
        updateProduct.run(cat.id, name, name);
      }
    }
  });

  transaction();

  // Refresh counts
  try {
    db.prepare('UPDATE product_categories SET product_count = (SELECT COUNT(*) FROM catalog_master WHERE category_id = product_categories.id)').run();
  } catch(_) {}
}

function getCategoryTree(db) {
  // Note: product_count is computed inline via LEFT JOIN below, no need for UPDATE

  // Total products in catalog
  const totalCount = db.prepare('SELECT COUNT(*) as cnt FROM catalog_master').get()?.cnt || 0;

  // Check if we have ANY AB categories
  const hasAb = db.prepare('SELECT 1 FROM product_categories WHERE is_ab_category = 1 LIMIT 1').get();

  if (!hasAb) {
    // SAFE FALLBACK: Check if product_categories already has entries with products.
    // Mark them as AB without destroying parent_id or rebuilding from supplier.
    // markSupplierAsAb() is intentionally NOT called here automatically —
    // it is destructive and should only run on explicit user action (⚙ button).
    const existingCats = db.prepare(`
      SELECT id FROM product_categories WHERE product_count > 0 LIMIT 1
    `).get();

    if (existingCats) {
      // Non-destructive: mark existing populated categories as AB
      db.prepare('UPDATE product_categories SET is_ab_category = 1 WHERE product_count > 0').run();
    } else {
      // Try to find a supplier with category data and run markSupplierAsAb only
      // if there are no existing categories at all
      const noCats = db.prepare('SELECT COUNT(*) as c FROM product_categories').get()?.c === 0;
      if (noCats) {
        const abSupplier = db.prepare(`
          SELECT s.id 
          FROM suppliers s
          JOIN supplier_products sp ON sp.supplier_id = s.id
          WHERE sp.category IS NOT NULL AND sp.category != '' AND trim(sp.category) != ''
          GROUP BY s.id
          ORDER BY COUNT(sp.id) DESC 
          LIMIT 1
        `).get();
        if (abSupplier) {
          markSupplierAsAb(db, abSupplier.id);
        } else {
          _autoGenerateCategoriesFromManufacturers(db);
        }
      }
    }
  }

  // 1. Get ALL AB categories with direct product count column (extremely fast!)
  const abCats = db.prepare(`
    SELECT pc.id, pc.name, pc.slug, 
           pc.product_count,
           pc.parent_id, pc.is_ab_category, pc.sort_order
    FROM product_categories pc
    WHERE pc.is_ab_category = 1
    ORDER BY COALESCE(pc.sort_order, 9999) ASC, pc.name ASC
  `).all();

  // 2. Get mapped categories with direct product count column (extremely fast!)
  const mappedCats = db.prepare(`
    SELECT pc.id, pc.name, pc.slug, pc.product_count, pc.ab_category_id
    FROM product_categories pc
    WHERE pc.ab_category_id IS NOT NULL AND pc.ab_category_id > 0 AND pc.is_ab_category = 0
    ORDER BY pc.name ASC
  `).all();

  // 3. Build tree
  const catMap = new Map();
  for (const cat of abCats) {
    catMap.set(cat.id, {
      ...cat,
      children: [], 
      total_count: cat.product_count || 0,
      expanded: false
    });
  }

  // Attach mapped categories to their AB parents
  for (const mc of mappedCats) {
    const parent = catMap.get(mc.ab_category_id);
    if (parent) {
      parent.children.push({
        id: mc.id,
        name: mc.name,
        slug: mc.slug,
        product_count: mc.product_count || 0,
        parent_id: mc.ab_category_id,
        is_mapped: true
      });
    }
  }

  const roots = [];
  // Build hierarchy
  for (const cat of catMap.values()) {
    if (cat.parent_id) {
      const parent = catMap.get(cat.parent_id);
      if (parent) {
        parent.children.push(cat);
      } else {
        roots.push(cat);
      }
    } else {
      roots.push(cat);
    }
  }

  // Sort children by sort_order (custom), then alphabetically
  for (const cat of catMap.values()) {
    cat.children.sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.name.localeCompare(b.name));
  }

  // Calculate total counts recursively
  function calcCount(node) {
    let sum = node.product_count || 0;
    for (const child of node.children) {
      if (child.is_mapped) sum += (child.product_count || 0);
      else sum += calcCount(child);
    }
    node.total_count = sum;
    return sum;
  }
  for (const root of roots) calcCount(root);

  // Unmapped categories
  const unmapped = db.prepare(`
    SELECT id, name, product_count
    FROM product_categories
    WHERE (ab_category_id IS NULL OR ab_category_id = 0)
      AND is_ab_category = 0
      AND product_count > 0
    ORDER BY name ASC
  `).all();

  const noCatCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM catalog_master WHERE category_id IS NULL AND name IS NOT NULL AND name != ''"
  ).get()?.cnt || 0;

  return {
    tree: roots,
    totalCount,
    unmappedCategories: unmapped,
    unmappedCount: unmapped.reduce((s, c) => s + (c.product_count || 0), 0) + noCatCount,
    noCategoryCount: noCatCount,
  };
}

/**
 * Oznacza wskazaną hurtownię jako "AB" — jej kategorie stają się korzeniami drzewa.
 * Buduje pełną hierarchię na podstawie ścieżek z supplier_products.category.
 */
function markSupplierAsAb(db, supplierId) {
  const fs = require('fs');
  fs.appendFileSync('mark_ab_debug.log', `[${new Date().toISOString()}] markSupplierAsAb called for supplierId: ${supplierId}\n`);
  
  // Clear previous AB marks
  db.prepare('UPDATE product_categories SET is_ab_category = 0, parent_id = NULL').run();

  // Get all raw categories from this supplier's products
  const supplierCats = db.prepare(`
    SELECT DISTINCT sp.category
    FROM supplier_products sp
    WHERE sp.supplier_id = ? AND sp.category IS NOT NULL AND sp.category != ''
  `).all(supplierId);

  fs.appendFileSync('mark_ab_debug.log', `[${new Date().toISOString()}] Found ${supplierCats.length} distinct categories for supplier\n`);

  let marked = 0;
  for (const row of supplierCats) {
    if (!row.category) continue;
    
    // Split by " > " or "/"
    const parts = row.category.split(/[/|>\\]+/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) continue;

    let currentParentId = null;
    let leafCatId = null;

    try {
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // Preserve Polish chars — only uppercase first letter, keep rest as-is
        const name = part.charAt(0).toUpperCase() + part.slice(1);
        const slug = part.toLowerCase()
          .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
          .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
          .replace(/ś/g,'s').replace(/ż/g,'z').replace(/ź/g,'z')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        let existing = db.prepare('SELECT id, parent_id FROM product_categories WHERE LOWER(name) = LOWER(?)').get(name);
        let catId;
        if (existing) {
          catId = existing.id;
          if (currentParentId && existing.parent_id !== currentParentId) {
            db.prepare('UPDATE product_categories SET parent_id = ? WHERE id = ?').run(currentParentId, catId);
          }
        } else {
          try {
            const res = db.prepare('INSERT INTO product_categories (name, slug, parent_id) VALUES (?, ?, ?)').run(name, slug, currentParentId);
            catId = Number(res.lastInsertRowid);
          } catch(e) {
            const ex = db.prepare('SELECT id, parent_id FROM product_categories WHERE LOWER(name) = LOWER(?)').get(name);
            if (ex) {
               catId = ex.id;
               if (currentParentId && ex.parent_id !== currentParentId) {
                  db.prepare('UPDATE product_categories SET parent_id = ? WHERE id = ?').run(currentParentId, catId);
               }
            } else {
               throw e;
            }
          }
        }
        
        db.prepare('UPDATE product_categories SET is_ab_category = 1, source_supplier_id = ? WHERE id = ?').run(supplierId, catId);
        currentParentId = catId;
        leafCatId = catId;
      }
      if (leafCatId) marked++;
    } catch (e) {
      fs.appendFileSync('mark_ab_debug.log', `[${new Date().toISOString()}] ERROR processing category "${row.category}": ${e.message}\n${e.stack}\n`);
    }
  }
  
  fs.appendFileSync('mark_ab_debug.log', `[${new Date().toISOString()}] Marked ${marked} categories\n`);
  return { marked };
}

/**
 * Przypisuje kategorię produktu (nie-AB) do kategorii AB.
 * Aktualizuje catalog_master.category_id dla produktów z tej kategorii.
 */
function remapCategoryToAb(db, categoryId, abCategoryId) {
  db.prepare('UPDATE product_categories SET ab_category_id = ? WHERE id = ?').run(abCategoryId, categoryId);
  // Opcjonalnie: przepnij produkty z tej kategorii do kategorii AB
  // (Alternatywnie kategoria zostaje, ale jest "pod" AB)
  return { ok: true };
}

/**
 * Zwraca listę hurtowni dla selecta "Hurtownia AB".
 */
function getSupplierList(db) {
  return db.prepare('SELECT id, name, product_count FROM suppliers WHERE is_active = 1 ORDER BY name ASC').all();
}

/**
 * Zwraca kategorie bez przypisania do AB — do wsadu dla AI remappera.
 */
function getUnmappedCategories(db) {
  db.prepare('UPDATE product_categories SET product_count = (SELECT COUNT(*) FROM catalog_master WHERE category_id = product_categories.id)').run();
  return db.prepare(`
    SELECT id, name, product_count
    FROM product_categories
    WHERE (ab_category_id IS NULL OR ab_category_id = 0)
      AND is_ab_category = 0
      AND product_count > 0
    ORDER BY product_count DESC
  `).all();
}


function getCategoryAttributes(db, categoryId) {
  return db.prepare('SELECT * FROM category_attributes WHERE category_id = ? AND visible = 1 ORDER BY sort_order ASC, attr_name ASC').all(categoryId);
}

/**
 * Przełącza widoczność atrybutu kategorii.
 */
function toggleCategoryAttribute(db, attrId, visible) {
  db.prepare('UPDATE category_attributes SET visible = ? WHERE id = ?').run(visible ? 1 : 0, attrId);
  return { success: true };
}

// ─── Product Details & Attributes ──────────────────────────────────────────────

/**
 * Ujednolica cechy surowe za pomocą AI na podstawie atrybutów kategorii
 */
async function unifyProductAttributes(db, catalogId) {
  const prod = db.prepare('SELECT id, category_id, raw_attributes FROM catalog_master WHERE id = ?').get(catalogId);
  if (!prod) throw new Error('Produkt nie istnieje');
  if (!prod.category_id) throw new Error('Produkt nie ma przypisanej kategorii');

  const catAttrs = db.prepare('SELECT id, attr_name FROM category_attributes WHERE category_id = ?').all(prod.category_id);
  if (catAttrs.length === 0) throw new Error('Kategoria nie ma zdefiniowanych standardowych atrybutów');

  let rawAttrs;
  try { rawAttrs = JSON.parse(prod.raw_attributes || '{}'); } catch(e) { rawAttrs = {}; }
  if (Object.keys(rawAttrs).length === 0) throw new Error('Brak surowych danych od dostawców do unifikacji');

  const owui = require('./openwebuiService');
  const token = owui.getApiKey();
  if (!token) throw new Error('Brak konfiguracji AI (wymagane klucze OpenWebUI)');

  const prompt = `Masz za zadanie ujednolicić techniczne parametry produktu.
Twoje docelowe atrybuty (które możesz wypełnić) to: ${catAttrs.map(a => `"${a.attr_name}"`).join(', ')}.

Oto surowe dane o produkcie pobrane z różnych hurtowni:
${JSON.stringify(rawAttrs, null, 2)}

Przeanalizuj surowe dane i przyporządkuj właściwe wartości do docelowych atrybutów.
Wartości powinny być krótkie i zwięzłe (np. "500 GB", "SATA III", "Czarny").
Jeśli nie potrafisz znaleźć wartości dla jakiegoś docelowego atrybutu, pomiń go.

Zwróć wynik TYLKO jako poprawny obiekt JSON, gdzie kluczem jest dokładna nazwa docelowego atrybutu (z listy docelowej), a wartością znaleziona wartość (jako string). Żadnego innego tekstu.`;

  try {
    const result = await owui.sendMessage(token, null, [
      { role: 'system', content: 'Jesteś ekspertem Master Data Management. Zwracasz wyłącznie poprawny obiekt JSON.' },
      { role: 'user', content: prompt }
    ]);
    const text = result?.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*?\}/);
    
    if (match) {
      const unifiedData = JSON.parse(match[0]);
      const ins = db.prepare('INSERT OR REPLACE INTO product_attributes (catalog_id, attribute_id, value_text) VALUES (?, ?, ?)');
      let added = 0;
      
      db.transaction(() => {
        for (const catAttr of catAttrs) {
          const val = unifiedData[catAttr.attr_name];
          if (val) {
            ins.run(catalogId, catAttr.id, String(val).trim());
            added++;
          }
        }
      })();
      
      return { success: true, unified_count: added, message: `Zunifikowano ${added} atrybutów` };
    } else {
      throw new Error('AI nie zwróciło poprawnego formatu JSON');
    }
  } catch (e) {
    throw new Error('Błąd unifikacji AI: ' + e.message);
  }
}

/**
 * Pobiera pełne szczegóły produktu z katalogu master + atrybuty + ceny hurtowni.
 */
function getProductDetails(db, productId) {
  const product = db.prepare('SELECT * FROM catalog_master WHERE id = ?').get(productId);
  if (!product) return null;

  // Parse JSON fields
  try { product.all_eans = JSON.parse(product.all_eans || '[]'); } catch { product.all_eans = []; }
  try { product.supplier_ids = JSON.parse(product.supplier_ids || '[]'); } catch { product.supplier_ids = []; }
  try { product.supplier_names = JSON.parse(product.supplier_names || '[]'); } catch { product.supplier_names = []; }
  try { product.original_names = JSON.parse(product.original_names || '{}'); } catch { product.original_names = {}; }
  try { product.raw_attributes = JSON.parse(product.raw_attributes || '{}'); } catch { product.raw_attributes = {}; }

  // Get attributes
  const attributes = getProductAttributes(db, productId, product.category_id);

  // Get all prices from suppliers
  const prices = (getCatalogEanPrices(db, product.canonical_ean).prices) || [];

  // Subiekt info
  let subiekt = null;
  try {
    const subVars = eanVariants(product.canonical_ean);
    if (subVars.length) {
      const norm = normalizeEan(product.canonical_ean);
      subiekt = hasNormalizedEanColumn(db)
        ? db.prepare(`SELECT * FROM subiekt_products WHERE normalized_ean = ? OR ean IN (${subVars.map(() => '?').join(',')}) LIMIT 1`).get(norm, ...subVars)
        : db.prepare(`SELECT * FROM subiekt_products WHERE ean IN (${subVars.map(() => '?').join(',')}) LIMIT 1`).get(...subVars);
    }
  } catch(_) {}

  // Category info
  let category = null;
  if (product.category_id) {
    category = db.prepare('SELECT * FROM product_categories WHERE id = ?').get(product.category_id);
  }

  // Supplier-specific raw attributes — detect correct column name
  let supplierAttributes = [];
  try {
    const spCols = db.prepare("PRAGMA table_info(supplier_products)").all().map(c => c.name);
    const attrCol = spCols.includes('raw_attributes') ? 'raw_attributes'
                  : spCols.includes('attributes')     ? 'attributes'
                  : null;
    if (attrCol) {
      supplierAttributes = db.prepare(`
        SELECT s.name as supplier_name, sp.${attrCol} as raw_attributes
        FROM supplier_products sp
        JOIN suppliers s ON s.id = sp.supplier_id
        WHERE (${hasNormalizedEanColumn(db) ? 'sp.normalized_ean = ? OR ' : ''}sp.ean IN (${eanVariants(product.canonical_ean).map(() => '?').join(',') || '?'}))
          AND sp.${attrCol} IS NOT NULL AND sp.${attrCol} != '{}' AND sp.${attrCol} != ''
      `).all(
        ...(hasNormalizedEanColumn(db)
          ? [normalizeEan(product.canonical_ean), ...eanVariants(product.canonical_ean)]
          : (eanVariants(product.canonical_ean).length ? eanVariants(product.canonical_ean) : [product.canonical_ean]))
      ).map(row => {
        try {
          const raw = row.raw_attributes;
          row.raw_attributes = (typeof raw === 'string') ? JSON.parse(raw) : (raw || {});
        } catch(e) { row.raw_attributes = {}; }
        return row;
      }).filter(row => Object.keys(row.raw_attributes).length > 0);
    }
  } catch(e) {}

  return { product, attributes, prices, subiekt, category, supplierAttributes };
}

/**
 * Pobiera atrybuty (parametry) przypisane do produktu.
 */
function getProductAttributes(db, catalogId, categoryId) {
  // Check if 'visible' column exists in category_attributes
  const caCols = db.prepare("PRAGMA table_info(category_attributes)").all().map(c => c.name);
  const hasVisible = caCols.includes('visible');
  const visibleFilter = hasVisible ? 'AND (ca.visible = 1 OR ca.visible IS NULL)' : '';

  let rows;
  if (categoryId) {
    rows = db.prepare(`
      SELECT pa.id, pa.value_text, pa.value_numeric,
             ca.id as attr_id, ca.attr_name, ca.attr_type, ca.attr_unit, ca.is_filter, ca.sort_order
      FROM category_attributes ca
      LEFT JOIN product_attributes pa ON pa.attribute_id = ca.id AND pa.catalog_id = ?
      WHERE ca.category_id = ? ${visibleFilter}
      ORDER BY ca.sort_order ASC, ca.attr_name ASC
    `).all(catalogId, categoryId);
  } else {
    rows = db.prepare(`
      SELECT pa.id, pa.value_text, pa.value_numeric,
             ca.id as attr_id, ca.attr_name, ca.attr_type, ca.attr_unit, ca.is_filter, ca.sort_order
      FROM product_attributes pa
      JOIN category_attributes ca ON ca.id = pa.attribute_id
      WHERE pa.catalog_id = ?
      ORDER BY ca.sort_order ASC, ca.attr_name ASC
    `).all(catalogId);
  }

  const product = db.prepare('SELECT id, raw_attributes FROM catalog_master WHERE id = ?').get(catalogId);
  if (!product || !rows.length) return rows;
  const defs = rows.map(r => ({ attr_name: r.attr_name, attr_type: r.attr_type, attr_unit: r.attr_unit }));
  let filled = [];
  try { filled = attrSync.attributesFromCatalog(db, product, defs); } catch (_) { return rows; }
  const byName = new Map(filled.map(a => [attrSync.fold(a.attr_name), a]));
  for (const r of rows) {
    if ((r.value_text == null || r.value_text === '') && r.value_numeric == null) {
      const hit = byName.get(attrSync.fold(r.attr_name));
      if (hit) {
        r.value_text = hit.value_text;
        r.value_numeric = hit.value_numeric;
      }
    }
  }
  return rows;
}

/**
 * Ustawia wartość parametru produktu. Tworzy wpis jeśli nie istnieje.
 */
function setProductAttribute(db, catalogId, attrId, valueText, valueNumeric = null) {
  // Auto-detect numeric
  if (valueNumeric === null && valueText) {
    const num = parseFloat(String(valueText).replace(',', '.').replace(/[^0-9.-]/g, ''));
    if (!isNaN(num)) valueNumeric = num;
  }

  attrSync.ensureProductAttrSource(db);
  const existing = db.prepare('SELECT id FROM product_attributes WHERE catalog_id = ? AND attribute_id = ?').get(catalogId, attrId);
  if (existing) {
    try {
      db.prepare("UPDATE product_attributes SET value_text = ?, value_numeric = ?, source = 'manual' WHERE id = ?")
        .run(valueText, valueNumeric, existing.id);
    } catch (_) {
      db.prepare('UPDATE product_attributes SET value_text = ?, value_numeric = ? WHERE id = ?')
        .run(valueText, valueNumeric, existing.id);
    }
  } else {
    try {
      db.prepare("INSERT INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric, source) VALUES (?, ?, ?, ?, 'manual')")
        .run(catalogId, attrId, valueText, valueNumeric);
    } catch (_) {
      db.prepare('INSERT INTO product_attributes (catalog_id, attribute_id, value_text, value_numeric) VALUES (?, ?, ?, ?)')
        .run(catalogId, attrId, valueText, valueNumeric);
    }
  }
  return { success: true };
}

/**
 * Usuwa wartość parametru produktu.
 */
function removeProductAttribute(db, catalogId, attrId) {
  db.prepare('DELETE FROM product_attributes WHERE catalog_id = ? AND attribute_id = ?').run(catalogId, attrId);
  return { success: true };
}

// ─── Category Filters ──────────────────────────────────────────────────────────

/**
 * Pobiera WSZYSTKIE atrybuty kategorii (włącznie z niewidocznymi), z flagą is_filter.
 */
function getAllCategoryAttributes(db, categoryId) {
  return db.prepare(`
    SELECT ca.*, 
      (SELECT COUNT(*) FROM product_attributes pa WHERE pa.attribute_id = ca.id) as usage_count
    FROM category_attributes ca 
    WHERE ca.category_id = ? 
    ORDER BY ca.sort_order ASC, ca.attr_name ASC
  `).all(categoryId);
}

/**
 * Pobiera filtry kategorii — atrybuty z is_filter=1 + ich unikalne wartości.
 */
function getCategoryFilters(db, categoryId) {
  const filterAttrs = db.prepare(`
    SELECT ca.id, ca.attr_name, ca.attr_unit, ca.attr_type
    FROM category_attributes ca
    WHERE ca.category_id = ? AND ca.is_filter = 1 AND ca.visible = 1
    ORDER BY ca.sort_order ASC, ca.attr_name ASC
  `).all(categoryId);

  // For each filter, get unique values
  for (const attr of filterAttrs) {
    const values = db.prepare(`
      SELECT DISTINCT pa.value_text 
      FROM product_attributes pa
      JOIN catalog_master cm ON cm.id = pa.catalog_id
      WHERE pa.attribute_id = ? AND pa.value_text IS NOT NULL AND pa.value_text != ''
        AND cm.category_id = ?
      ORDER BY pa.value_text ASC
    `).all(attr.id, categoryId);
    attr.values = values.map(v => v.value_text);
  }

  return filterAttrs;
}

/**
 * Aktualizuje konfigurację filtrów — które atrybuty są filtrami.
 * @param {number[]} filterAttrIds — lista ID atrybutów, które mają być filtrami
 */
function updateCategoryAttributeFilters(db, categoryId, filterAttrIds) {
  // Reset all
  db.prepare('UPDATE category_attributes SET is_filter = 0 WHERE category_id = ?').run(categoryId);
  // Set selected
  if (filterAttrIds && filterAttrIds.length) {
    const stmt = db.prepare('UPDATE category_attributes SET is_filter = 1 WHERE id = ? AND category_id = ?');
    for (const id of filterAttrIds) {
      stmt.run(id, categoryId);
    }
  }
  return { success: true, count: filterAttrIds?.length || 0 };
}

/**
 * Dodaje nowy atrybut (parametr) do kategorii.
 */
function addCategoryAttribute(db, categoryId, name, unit = null) {
  if (!name || !name.trim()) throw new Error('Nazwa parametru nie może być pusta');
  const maxOrder = db.prepare('SELECT MAX(sort_order) as mx FROM category_attributes WHERE category_id = ?').get(categoryId)?.mx || 0;
  try {
    const r = db.prepare('INSERT INTO category_attributes (category_id, attr_name, attr_unit, sort_order) VALUES (?, ?, ?, ?)').run(categoryId, name.trim(), unit || null, maxOrder + 1);
    return { success: true, id: Number(r.lastInsertRowid) };
  } catch (e) {
    if (e.message.includes('UNIQUE')) return { success: false, message: 'Parametr o tej nazwie już istnieje w tej kategorii' };
    throw e;
  }
}

/**
 * Usuwa atrybut kategorii (i powiązane wartości produktów).
 */
function removeCategoryAttribute(db, attrId) {
  db.prepare('DELETE FROM product_attributes WHERE attribute_id = ?').run(attrId);
  db.prepare('DELETE FROM category_attributes WHERE id = ?').run(attrId);
  return { success: true };
}

/**
 * Aktualizuje atrybut kategorii (nazwa, jednostka, kolejność).
 */
function updateCategoryAttribute(db, attrId, { attr_name, attr_unit, sort_order, visible } = {}) {
  const updates = [];
  const params = [];
  if (attr_name !== undefined) { updates.push('attr_name = ?'); params.push(attr_name); }
  if (attr_unit !== undefined) { updates.push('attr_unit = ?'); params.push(attr_unit); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
  if (visible !== undefined) { updates.push('visible = ?'); params.push(visible ? 1 : 0); }
  if (!updates.length) return { success: false, message: 'Brak zmian' };
  params.push(attrId);
  db.prepare(`UPDATE category_attributes SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return { success: true };
}

/**
 * Generuje filtry AI via Open WebUI.
 */
async function aiGenerateAttributes(categoryName, samplePrompt = '') {
  try {
    const owui = require('./openwebuiService');
    const token = owui.getApiKey();
    if (!token) return null;
    const prompt = `Dla kategorii produktów IT/elektroniki "${categoryName}" podaj 3-6 najważniejszych parametrów filtrowania. Odpowiedz TYLKO JSON array stringów, np: ["Param1","Param2"]. Bez innego tekstu. ${samplePrompt}`;
    const result = await owui.sendMessage(token, null, [
      { role: 'system', content: 'Jesteś ekspertem IT. Odpowiadasz wyłącznie JSON.' },
      { role: 'user', content: prompt }
    ]);
    const text = result?.choices?.[0]?.message?.content || '';
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      const attrs = JSON.parse(match[0]);
      if (Array.isArray(attrs) && attrs.length && attrs.every(a => typeof a === 'string')) return attrs.slice(0, 8);
    }
  } catch(e) { console.error(`[CatalogAI] Błąd AI dla "${categoryName}":`, e.message); }
  return null;
}

/**
 * Analizuje raw_attributes produktów z danej kategorii i wyciąga najczęstsze parametry.
 * Służy do automatycznego budowania filtrów na podstawie plików z hurtowni.
 */
function autoGenerateAttributesFromRaw(db, categoryId, categoryName) {
  const products = db.prepare("SELECT raw_attributes FROM catalog_master WHERE category_id = ? AND raw_attributes != '{}'").all(categoryId);
  if (!products.length) return false;

  const counts = {};
  for (const p of products) {
    try {
      const raw = JSON.parse(p.raw_attributes);
      for (const key of Object.keys(raw)) {
        if (!key || key.trim() === '-' || key.trim() === '') continue;
        const cleanKey = key.trim();
        counts[cleanKey] = (counts[cleanKey] || 0) + 1;
      }
    } catch(e) {}
  }

  // Sort by frequency descending
  const sortedKeys = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count >= 1); // at least 1 product has it
    
  if (!sortedKeys.length) return false;

  // Take top 15 most common keys
  const topKeys = sortedKeys.slice(0, 15).map(x => x[0]);
  
  const ins = db.prepare('INSERT OR IGNORE INTO category_attributes (category_id, attr_name, sort_order, is_filter, visible) VALUES (?, ?, ?, ?, ?)');
  
  let inserted = 0;
  db.transaction(() => {
    for (let i = 0; i < topKeys.length; i++) {
      // First 5 attributes will be set as filters by default
      const isFilter = i < 5 ? 1 : 0;
      try {
        const r = ins.run(categoryId, topKeys[i], i, isFilter, 1);
        if (r.changes > 0) inserted++;
      } catch(_) {}
    }
  })();
  
  return inserted > 0;
}

/**
 * Generuje filtry dla kategorii — keyword map + AI fallback.
 */
function populateProductAttributesFromRaw(db, categoryId) {
  const ids = db.prepare('SELECT id FROM catalog_master WHERE category_id = ?').all(categoryId).map(r => r.id);
  if (!ids.length) return 0;
  const result = attrSync.syncCatalogAttributes(db, {
    catalogIds: ids,
    seedSchemas: false,
    attrMap: CATEGORY_ATTR_MAP,
  });
  return result.filled;
}

async function generateAttributesForCategory(db, categoryId, useAi = true) {
  const cat = db.prepare('SELECT name FROM product_categories WHERE id = ?').get(categoryId);
  if (!cat) return { generated: 0 };
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM category_attributes WHERE category_id = ?').get(categoryId);
  
  let generated = 0;
  let source = 'existing';

  if (existing.cnt === 0) {
    const matched = seedCategoryAttrSchema(db, categoryId, cat.name) || autoGenerateAttributesFromRaw(db, categoryId, cat.name);
    if (matched) {
      const cnt = db.prepare('SELECT COUNT(*) as cnt FROM category_attributes WHERE category_id = ?').get(categoryId);
      generated = cnt.cnt;
      source = 'keyword';
    } else if (useAi) {
      // Get a sample of raw attributes to help AI
      const sampleProd = db.prepare("SELECT raw_attributes FROM catalog_master WHERE category_id = ? AND raw_attributes != '{}' LIMIT 1").get(categoryId);
      let samplePrompt = '';
      if (sampleProd) {
        try {
          const raw = JSON.parse(sampleProd.raw_attributes);
          const keys = Object.keys(raw).slice(0, 10).join(', ');
          if (keys) samplePrompt = `(Przykładowe atrybuty z hurtowni: ${keys})`;
        } catch(e) {}
      }

      const aiAttrs = await aiGenerateAttributes(cat.name, samplePrompt);
      if (aiAttrs && aiAttrs.length) {
        const ins = db.prepare('INSERT OR IGNORE INTO category_attributes (category_id, attr_name, sort_order) VALUES (?, ?, ?)');
        for (let i = 0; i < aiAttrs.length; i++) { try { ins.run(categoryId, aiAttrs[i], i); } catch(_) {} }
        const cnt = db.prepare('SELECT COUNT(*) as cnt FROM category_attributes WHERE category_id = ?').get(categoryId);
        generated = cnt.cnt;
        source = 'ai';
      }
    }
  }

  // Populate products
  const populatedCount = populateProductAttributesFromRaw(db, categoryId);

  if (existing.cnt > 0) {
    return { generated: 0, message: `Atrybuty już istnieją. Zaktualizowano ${populatedCount} wartości w produktach.` };
  } else if (generated > 0) {
    return { generated, source, message: `Wygenerowano schemat. Zaktualizowano ${populatedCount} wartości w produktach.` };
  } else {
    return { generated: 0, message: 'Brak dopasowania i AI niedostępne' };
  }
}

/**
 * Batch: generuje filtry dla WSZYSTKICH kategorii bez atrybutów.
 */
async function batchGenerateAttributes(db, useAi = false) {
  const cats = db.prepare('SELECT pc.id, pc.name FROM product_categories pc WHERE NOT EXISTS (SELECT 1 FROM category_attributes ca WHERE ca.category_id = pc.id)').all();
  let keywordGen = 0, aiGen = 0, failed = 0;
  for (const cat of cats) {
    const matched = seedCategoryAttrSchema(db, cat.id, cat.name) || autoGenerateAttributesFromRaw(db, cat.id, cat.name);
    if (matched) { 
      populateProductAttributesFromRaw(db, cat.id);
      keywordGen++; 
      continue; 
    }
    if (useAi) {
      try {
        const aiAttrs = await aiGenerateAttributes(cat.name);
        if (aiAttrs && aiAttrs.length) {
          const ins = db.prepare('INSERT OR IGNORE INTO category_attributes (category_id, attr_name, sort_order) VALUES (?, ?, ?)');
          for (let i = 0; i < aiAttrs.length; i++) { try { ins.run(cat.id, aiAttrs[i], i); } catch(_) {} }
          populateProductAttributesFromRaw(db, cat.id);
          aiGen++;
        } else { failed++; }
      } catch(e) { failed++; }
    } else { failed++; }
  }
  return { total: cats.length, keywordGenerated: keywordGen, aiGenerated: aiGen, failed };
}

function getDuplicatesList(db, { page = 1, limit = 50 }) {
  const offset = (page - 1) * limit;
  const countRow = db.prepare("SELECT COUNT(*) as cnt FROM catalog_duplicates WHERE status = 'pending'").get();
  
  const rows = db.prepare(`
    SELECT d.*, 
           c1.name as a_name, c1.manufacturer as a_manufacturer, c1.manufacturer_code as a_code, c1.canonical_ean as a_ean,
           c2.name as b_name, c2.manufacturer as b_manufacturer, c2.manufacturer_code as b_code, c2.canonical_ean as b_ean
    FROM catalog_duplicates d
    JOIN catalog_master c1 ON c1.id = d.product_a_id
    JOIN catalog_master c2 ON c2.id = d.product_b_id
    WHERE d.status = 'pending'
    ORDER BY d.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  
  return {
    items: rows,
    total: countRow.cnt,
    page,
    pages: Math.ceil(countRow.cnt / limit)
  };
}

function scanForDuplicates(db) {
  // Szuka produktów z tym samym manufacturer_code i manufacturer, ale różnym EAN
  const candidates = db.prepare(`
    SELECT c1.id as id_a, c2.id as id_b
    FROM catalog_master c1
    JOIN catalog_master c2 ON c1.manufacturer_code = c2.manufacturer_code AND LOWER(TRIM(c1.manufacturer)) = LOWER(TRIM(c2.manufacturer))
    WHERE c1.id < c2.id 
      AND c1.manufacturer_code IS NOT NULL AND c1.manufacturer_code != ''
      AND NOT EXISTS (
        SELECT 1 FROM catalog_duplicates d 
        WHERE (d.product_a_id = c1.id AND d.product_b_id = c2.id) 
           OR (d.product_a_id = c2.id AND d.product_b_id = c1.id)
      )
  `).all();
  
  const insert = db.prepare("INSERT INTO catalog_duplicates (product_a_id, product_b_id, match_type) VALUES (?, ?, 'manufacturer_code')");
  let added = 0;
  
  db.transaction(() => {
    for (const c of candidates) {
      try { insert.run(c.id_a, c.id_b); added++; } catch(_) {}
    }
  })();
  
  return { added };
}

function resolveDuplicate(db, duplicateId, action) {
  const dup = db.prepare('SELECT * FROM catalog_duplicates WHERE id = ?').get(duplicateId);
  if (!dup) throw new Error('Nie znaleziono duplikatu');
  
  if (action === 'different') {
    db.prepare("UPDATE catalog_duplicates SET status = 'different', resolved_at = datetime('now') WHERE id = ?").run(duplicateId);
    return { success: true };
  }
  
  if (action === 'merge') {
    const keepId = dup.product_a_id;
    const dropId = dup.product_b_id;
    
    db.transaction(() => {
      // 1. Scal all_eans
      const pKeep = db.prepare('SELECT all_eans, supplier_ids, supplier_names FROM catalog_master WHERE id = ?').get(keepId);
      const pDrop = db.prepare('SELECT canonical_ean, all_eans, supplier_ids, supplier_names FROM catalog_master WHERE id = ?').get(dropId);
      
      const eansKeep = new Set(JSON.parse(pKeep.all_eans || '[]'));
      const eansDrop = new Set(JSON.parse(pDrop.all_eans || '[]'));
      eansKeep.add(pDrop.canonical_ean);
      for (const e of eansDrop) eansKeep.add(e);
      
      const sidsKeep = JSON.parse(pKeep.supplier_ids || '[]');
      const snamesKeep = JSON.parse(pKeep.supplier_names || '[]');
      const sidsDrop = JSON.parse(pDrop.supplier_ids || '[]');
      const snamesDrop = JSON.parse(pDrop.supplier_names || '[]');
      
      for (let i=0; i<sidsDrop.length; i++) {
        if (!sidsKeep.includes(sidsDrop[i])) {
          sidsKeep.push(sidsDrop[i]);
          snamesKeep.push(snamesDrop[i]);
        }
      }
      
      db.prepare(`UPDATE catalog_master 
                  SET all_eans = ?, supplier_ids = ?, supplier_names = ? 
                  WHERE id = ?`).run(
        JSON.stringify([...eansKeep]), JSON.stringify(sidsKeep), JSON.stringify(snamesKeep), keepId
      );
      
      // 2. Przepnij produkty z hurtowni na nowy EAN
      db.prepare('UPDATE supplier_products SET ean = ? WHERE ean = ?').run(pKeep.canonical_ean, pDrop.canonical_ean);
      
      // 3. Usuń gorszy wpis
      db.prepare('DELETE FROM catalog_master WHERE id = ?').run(dropId);
      
      // 4. Oznacz jako rozwiązane
      db.prepare("UPDATE catalog_duplicates SET status = 'merged', resolved_at = datetime('now') WHERE id = ?").run(duplicateId);
    })();
    
    return { success: true };
  }
  
  throw new Error('Nieznana akcja');
}

// ─── Naming Schema CRUD ─────────────────────────────────────────────────────────

function getNamingSchema(db, categoryId) {
  const row = db.prepare('SELECT * FROM category_naming_schema WHERE category_id = ?').get(categoryId);
  if (!row) return { category_id: categoryId, params: [], approved: false };
  return {
    id: row.id,
    category_id: row.category_id,
    params: JSON.parse(row.params || '[]'),
    approved: !!row.approved,
    updated_at: row.updated_at,
  };
}

function saveNamingSchema(db, categoryId, params) {
  const existing = db.prepare('SELECT id FROM category_naming_schema WHERE category_id = ?').get(categoryId);
  if (existing) {
    db.prepare('UPDATE category_naming_schema SET params = ?, updated_at = datetime("now") WHERE category_id = ?')
      .run(JSON.stringify(params), categoryId);
  } else {
    db.prepare('INSERT INTO category_naming_schema (category_id, params) VALUES (?, ?)')
      .run(categoryId, JSON.stringify(params));
  }
  return getNamingSchema(db, categoryId);
}

function approveNamingSchema(db, categoryId, approved = true) {
  db.prepare('UPDATE category_naming_schema SET approved = ?, updated_at = datetime("now") WHERE category_id = ?')
    .run(approved ? 1 : 0, categoryId);
  return getNamingSchema(db, categoryId);
}

// ─── AI Name Normalization ──────────────────────────────────────────────────────

async function normalizeProductName(db, productId, options = {}) {
  const product = db.prepare('SELECT * FROM catalog_master WHERE id = ?').get(productId);
  if (!product) throw new Error('Produkt nie znaleziony');
  if (product.name_locked && !options.force) return { id: productId, normalized_name: product.normalized_name, skipped: true };

  const origNames = JSON.parse(product.original_names || '{}');
  const category = product.category_name || 'Nieznana';
  const manufacturer = product.manufacturer || '';

  // Pobierz schemat nazwy dla kategorii
  let schemaPrompt = '';
  if (product.category_id) {
    const schema = getNamingSchema(db, product.category_id);
    if (schema.params.length > 0) {
      schemaPrompt = `\nSchemat nazwy dla kategorii "${category}": ${schema.params.join(' - ')}\nUżyj tego schematu — parametry w podanej kolejności, oddzielone myślnikiem.`;
    }
  }

  // Zbuduj listę nazw
  const nameLines = Object.entries(origNames)
    .map(([sup, name]) => `  [${sup}]: "${name}"`)
    .join('\n');

  if (!nameLines && !product.name) {
    return { id: productId, normalized_name: null, error: 'Brak nazw źródłowych' };
  }

  const prompt = `Znormalizuj nazwę produktu.

Kategoria: ${category}
Producent: ${manufacturer}
Kod producenta: ${product.manufacturer_code || 'brak'}
${schemaPrompt}

Nazwy z hurtowni:
${nameLines || `  [główna]: "${product.name}"`}

Zasady:
1. Nazwa po POLSKU (wyjątki: nazwy własne, skróty techniczne jak USB, HDMI, SSD, NVMe, LCD itp.)
2. Format: Co to jest - kluczowe parametry w kolejności wg schematu - producent - seria/model
3. Krótka, rzeczowa, łatwa do wyszukania. Maksymalnie 120 znaków.
4. BEZ opisu produktu, BEZ specyfikacji technicznej — tylko identyfikująca nazwa.
5. Pierwsza litera wielka, reszta małe (chyba że akronim/marka).

Odpowiedz TYLKO znormalizowaną nazwą. Nic więcej.`;

  try {
    const owuiService = require('./openwebuiService');
    const token = owuiService.getApiKey();
    const models = await owuiService.listModels(token);
    const modelId = models[0]?.id || 'llama3';

    const response = await owuiService.sendMessage(token, modelId, [
      { role: 'system', content: 'Jesteś ekspertem od nazewnictwa produktów IT/elektroniki. Odpowiadasz TYLKO znormalizowaną nazwą produktu — bez wyjaśnień.' },
      { role: 'user', content: prompt }
    ]);

    let normalized = (response.choices?.[0]?.message?.content || response.content || response.message?.content || '').trim();
    // Wyczyść ewentualne cudzysłowy
    normalized = normalized.replace(/^["'`]+|["'`]+$/g, '').trim();
    if (normalized.length > 150) normalized = normalized.substring(0, 150);

    if (normalized) {
      db.prepare('UPDATE catalog_master SET normalized_name = ? WHERE id = ? AND name_locked = 0')
        .run(normalized, productId);
      return { id: productId, normalized_name: normalized, success: true };
    }
    return { id: productId, error: 'AI zwróciło pustą odpowiedź' };
  } catch (e) {
    console.error(`[NormalizeName] Error for product ${productId}:`, e.message);
    return { id: productId, error: e.message };
  }
}

function updateProductName(db, productId, name, lock = false) {
  if (!name || typeof name !== 'string') throw new Error('Nazwa jest wymagana');
  const clean = name.replace(/[\r\n]+/g, ' ').trim();
  if (clean.length < 5) throw new Error('Nazwa zbyt krótka');

  const s = db.prepare(`SELECT name, manufacturer, original_names FROM catalog_master WHERE id = ?`).get(productId);
  if (!s) throw new Error('Produkt nie istnieje');

  const orig = JSON.parse(s.original_names || '{}');
  orig['Ręczna nazwa'] = clean;

  db.prepare(`
    UPDATE catalog_master 
    SET normalized_name = ?, name_locked = ?, original_names = ?, last_updated = datetime('now', 'localtime')
    WHERE id = ?
  `).run(clean, lock ? 1 : 0, JSON.stringify(orig), productId);

  return { success: true, name: clean };
}

/**
 * Ręczna aktualizacja wagi i kodu producenta produktu.
 */
function updateProductDetails(db, productId, details) {
  const { manufacturer_code, weight_g } = details;
  const updates = [];
  const params = [];
  if (manufacturer_code !== undefined) {
    updates.push('manufacturer_code = ?');
    params.push(manufacturer_code);
  }
  if (weight_g !== undefined) {
    updates.push('weight_g = ?');
    params.push(weight_g);
  }
  
  if (updates.length > 0) {
    updates.push("last_updated = datetime('now', 'localtime')");
    params.push(productId);
    db.prepare(`UPDATE catalog_master SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }
  return { success: true };
}

async function batchNormalizeNames(db, options = {}) {
  const limit = options.limit || 50;
  const categoryId = options.categoryId || null;
  
  let where = 'WHERE normalized_name IS NULL AND name_locked = 0';
  const params = [];
  if (categoryId) {
    where += ' AND category_id = ?';
    params.push(categoryId);
  } else {
    // Priorytet: produkty z kategorią i wieloma hurtowniami
    where += ' AND category_id IS NOT NULL';
  }

  const products = db.prepare(`SELECT id FROM catalog_master ${where} ORDER BY total_stock DESC LIMIT ?`)
    .all(...params, limit);

  let success = 0, failed = 0, skipped = 0;
  for (const p of products) {
    try {
      const result = await normalizeProductName(db, p.id);
      if (result.success) success++;
      else if (result.skipped) skipped++;
      else failed++;
      // Throttle AI requests
      if (success > 0 && success % 5 === 0) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch {
      failed++;
    }
  }

  return { processed: products.length, success, failed, skipped };
}

function updateProductName(db, productId, name, lock = false) {
  db.prepare('UPDATE catalog_master SET normalized_name = ?, name_locked = ? WHERE id = ?')
    .run(name, lock ? 1 : 0, productId);
  return db.prepare('SELECT id, normalized_name, name_locked FROM catalog_master WHERE id = ?').get(productId);
}

// ─── AI Schema Suggestion ───────────────────────────────────────────────────────

async function suggestNamingSchema(db, categoryId) {
  const cat = db.prepare('SELECT name FROM product_categories WHERE id = ?').get(categoryId);
  if (!cat) throw new Error('Kategoria nie znaleziona');

  // Pobierz przykładowe produkty z tej kategorii
  const samples = db.prepare(`
    SELECT name, manufacturer, original_names FROM catalog_master 
    WHERE category_id = ? AND name IS NOT NULL 
    ORDER BY total_stock DESC LIMIT 5
  `).all(categoryId);

  const samplesText = samples.map((s, i) => {
    const orig = JSON.parse(s.original_names || '{}');
    const origStr = Object.entries(orig).map(([k,v]) => `[${k}]: ${v}`).join('; ');
    return `${i+1}. "${s.name}" (${s.manufacturer || '?'}) — Oryginały: ${origStr || 'brak'}`;
  }).join('\n');

  const prompt = `Dla kategorii produktów: "${cat.name}"

Przykładowe produkty:
${samplesText}

Zaproponuj schemat nazewnictwa — uporządkowaną listę parametrów, które powinny wystąpić w znormalizowanej nazwie produktu.
Format odpowiedzi: JSON array stringów, np: ["Typ", "Standard", "Pojemność", "Producent", "Seria"]

Zasady:
- Pierwszym parametrem jest zawsze "Typ" (co to za produkt, np. "Kabel", "Dysk", "Monitor")
- Dalej kluczowe cechy pozwalające łatwo odróżnić produkty w tej kategorii
- Producent i seria/model na końcu
- 4-8 parametrów
- Nazwy parametrów po polsku (wyjątki: skróty techniczne)

Odpowiedz TYLKO tablicą JSON.`;

  try {
    const owuiService = require('./openwebuiService');
    const token = owuiService.getApiKey();
    const models = await owuiService.listModels(token);
    const modelId = models[0]?.id || 'llama3';

    const response = await owuiService.sendMessage(token, modelId, [
      { role: 'system', content: 'Odpowiadasz TYLKO w formacie JSON array. Bez wyjaśnień.' },
      { role: 'user', content: prompt }
    ]);

    let text = (response.choices?.[0]?.message?.content || response.content || response.message?.content || '').trim();
    // Wyciągnij JSON array
    const match = text.match(/\[.*\]/s);
    if (match) {
      const params = JSON.parse(match[0]);
      if (Array.isArray(params) && params.length > 0) {
        return saveNamingSchema(db, categoryId, params);
      }
    }
    throw new Error('AI nie zwróciło prawidłowej tablicy parametrów');
  } catch (e) {
    console.error(`[SuggestSchema] Error for category ${categoryId}:`, e.message);
    throw e;
  }
}


/**
 * Generuje klucz kanonicznego nazwy kategorii do porównywania.
 * Usuwa: HTML tagi, diakrytyki, wielkie litery, znaki specjalne, nadmiar spacji.
 * Np: "Gry i Zabawki" == "gry i zabawki" == "Gry, Zabawki" == "Gry&Zabawki"
 */
function _canonicalCatKey(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')        // strip HTML
    .replace(/&\w+;/g, ' ')         // strip entities
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
    .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
    .replace(/[^a-z0-9\s]/g, ' ')   // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Scal i znormalizuj zduplikowane kategorie.
 * 
 * Logika:
 * 1. Grupuje wszystkie kategorie po kluczu kanonicznym (case-insensitive, bez diakrytyków, bez interpunkcji)
 * 2. Dla każdej grupy > 1 element: wybiera "master" (tę z największą product_count)
 * 3. Migruje produkty i aliasy z duplikatów do mastera
 * 4. Usuwa puste kategorie (duplikaty)
 *
 * @returns {{ merged: number, removed: number, kept: number }}
 */
function mergeAndNormalizeCategories(db) {
  // Update counts
  try {
    db.prepare('UPDATE product_categories SET product_count = (SELECT COUNT(*) FROM catalog_master WHERE category_id = product_categories.id)').run();
  } catch(_) {}

  const allCats = db.prepare('SELECT id, name, slug, product_count, is_ab_category, parent_id, ab_category_id FROM product_categories').all();
  
  // Group by canonical key
  const groups = new Map(); // canonicalKey → [cat, ...]
  for (const cat of allCats) {
    const key = _canonicalCatKey(cat.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cat);
  }

  let merged = 0, removed = 0;

  const doMerge = db.transaction((group) => {
    // Sort: prefer AB categories first, then by product_count DESC
    group.sort((a, b) => {
      if (a.is_ab_category !== b.is_ab_category) return b.is_ab_category - a.is_ab_category;
      return (b.product_count || 0) - (a.product_count || 0);
    });
    const master = group[0];
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      if (dup.id === master.id) continue;
      
      // Move products from dup to master
      db.prepare('UPDATE catalog_master SET category_id = ?, category_name = ? WHERE category_id = ?')
        .run(master.id, master.name, dup.id);
      
      // Move category_aliases
      try {
        db.prepare('UPDATE OR IGNORE category_aliases SET category_id = ? WHERE category_id = ?')
          .run(master.id, dup.id);
      } catch(_) {}
      
      // Move child categories (parent_id)
      try {
        db.prepare('UPDATE product_categories SET parent_id = ? WHERE parent_id = ?')
          .run(master.id, dup.id);
      } catch(_) {}

      // Move mapped categories (ab_category_id)
      try {
        db.prepare('UPDATE product_categories SET ab_category_id = ? WHERE ab_category_id = ?')
          .run(master.id, dup.id);
      } catch(_) {}

      // If dup was AB and master is not — promote master to AB
      if (dup.is_ab_category && !master.is_ab_category) {
        db.prepare('UPDATE product_categories SET is_ab_category = 1, source_supplier_id = ? WHERE id = ?')
          .run(dup.source_supplier_id, master.id);
      }

      // Delete the duplicate
      try {
        db.prepare('DELETE FROM product_categories WHERE id = ?').run(dup.id);
        removed++;
      } catch(_) {}
      merged++;
    }

    // Normalize master name (Title Case, clean HTML)
    const cleanName = String(master.name)
      .replace(/<[^>]+>/g, '')
      .replace(/&\w+;/g, '')
      .trim()
      .replace(/\s+/g, ' ');
    const titleName = cleanName.split(/\s+/).map((w, i) => {
      // Uppercase first letter, preserve rest (important for Polish/brand names)
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');

    if (titleName !== master.name && titleName.length > 0) {
      try {
        db.prepare('UPDATE product_categories SET name = ? WHERE id = ?').run(titleName, master.id);
        // Also sync catalog_master.category_name
        db.prepare('UPDATE catalog_master SET category_name = ? WHERE category_id = ?').run(titleName, master.id);
      } catch(_) {}
    }
  });

  for (const group of groups.values()) {
    if (group.length > 1) {
      try { doMerge(group); } catch(e) { console.error('[mergeCategories] error:', e.message); }
    }
  }

  // Final count refresh
  try {
    db.prepare('UPDATE product_categories SET product_count = (SELECT COUNT(*) FROM catalog_master WHERE category_id = product_categories.id)').run();
    // Remove now-empty categories (not AB)
    db.prepare('DELETE FROM product_categories WHERE product_count = 0 AND is_ab_category = 0').run();
  } catch(_) {}

  const kept = db.prepare('SELECT COUNT(*) as cnt FROM product_categories').get()?.cnt || 0;
  return { merged, removed, kept };
}

/**
 * Dopasowuje produkty bez kategorii AB do najbliższej kategorii AB.
 * 
 * Krok 1: Keyword matching (szybki, bez AI)
 * Krok 2: Dla pozostałych → AI (Gemini/OWUI) batch matching
 * 
 * @param {object} db - better-sqlite3
 * @param {object} opts
 * @param {boolean} opts.useAi - czy używać AI (false = tylko keyword)
 * @param {number} opts.limit - max produktów do przetworzenia
 * @returns {{ assigned: number, total: number, aiUsed: number }}
 */
async function aiAssignUnmappedProducts(db, { useAi = true, limit = 5000 } = {}) {
  // Ensure counts are up to date
  try {
    db.prepare('UPDATE product_categories SET product_count = (SELECT COUNT(*) FROM catalog_master WHERE category_id = product_categories.id)').run();
  } catch(_) {}

  // Get all AB categories
  const abCats = db.prepare(`
    SELECT id, name, slug FROM product_categories WHERE is_ab_category = 1 ORDER BY name ASC
  `).all();

  if (!abCats.length) return { assigned: 0, total: 0, aiUsed: 0, error: 'Brak kategorii AB' };

  // ────────────────────────────────────────────────────────────────────────────
  // Build keyword → AB category map
  // IMPORTANT: ALL keywords must go through _canonicalCatKey so they can be
  // compared against other canonicalised strings (no Polish chars, lowercase)
  // ────────────────────────────────────────────────────────────────────────────
  const KEYWORD_STOP = new Set(['i', 'w', 'z', 'do', 'na', 'dla', 'oraz', 'and', 'or', 'to', 'the', 'a', 'z', 'ze', 'po', 'przy', 'pod', 'dla', 'bez', 'przez']);

  // Extra keyword groups — ALL strings will be run through _canonicalCatKey before use
  // so Polish characters here are intentional and will be normalised correctly
  const EXTRA_GROUPS = [
    { keys: ['laptop', 'lapop', 'laptopy', 'notebook', 'ultrabook', 'netbook'], extras: ['laptop', 'laptopy', 'notebook', 'ultrabook', 'netbook'] },
    { keys: ['komputer', 'pc', 'desktop', 'stacjonarny', 'aio', 'all in one', 'mini pc'], extras: ['komputer', 'komputer pc', 'desktop', 'stacjonarny', 'aio', 'all in one', 'mini pc', 'tower'] },
    { keys: ['monitor', 'wyswietlacz', 'displej', 'ekran'], extras: ['monitor', 'wyswietlacz', 'displej', 'ekran led', 'ekran lcd', 'telewizor'] },
    { keys: ['klawiatura', 'keyboard', 'klawiatury'], extras: ['klawiatura', 'keyboard', 'klawiatury'] },
    { keys: ['mysz', 'myszka', 'mouse'], extras: ['mysz', 'myszka', 'mouse', 'gaming mouse', 'trackpad'] },
    { keys: ['drukarka', 'printer', 'ploter', 'druk'], extras: ['drukarka', 'printer', 'ploter', 'laserjet', 'inkjet', 'druk wielofunkcyjny'] },
    { keys: ['skaner', 'scanner'], extras: ['skaner', 'scanner', 'skaner dokumentow', 'skaner ploaski'] },
    { keys: ['router', 'wifi', 'wireless', 'access point', 'bezprzewodowy'], extras: ['router', 'wifi', 'access point', 'wireless', 'ap', 'bezprzewodowy'] },
    { keys: ['switch', 'przelacznik', 'hub sieciowy', 'ethernet switch'], extras: ['switch', 'przelacznik sieciowy', 'hub sieciowy', 'ethernet switch', 'switche', 'hub'] },
    { keys: ['dysk', 'hdd', 'ssd', 'nvme', 'pendrive', 'flash', 'storage', 'nosnik'], extras: ['dysk', 'hdd', 'ssd', 'nvme', 'pendrive', 'flash drive', 'storage', 'nosnik', 'dysk zewnetrzny', 'dysk wewnetrzny', 'card reader', 'sd card'] },
    { keys: ['pamiec', 'ram', 'ddr', 'dimm', 'sodimm'], extras: ['pamiec', 'ram', 'ddr', 'dimm', 'sodimm', 'pamiec ram', 'pamiec operacyjna', 'moduly pamieci'] },
    { keys: ['procesor', 'cpu', 'processor', 'intel', 'amd ryzen'], extras: ['procesor', 'cpu', 'processor', 'intel', 'amd', 'ryzen', 'core i5', 'core i7', 'core i9'] },
    { keys: ['graficzna', 'gpu', 'geforce', 'radeon', 'gtx', 'rtx', 'rx'], extras: ['karta graficzna', 'gpu', 'geforce', 'radeon', 'gtx', 'rtx', 'rx', 'graphic card'] },
    { keys: ['tablet', 'ipad', 'tablety'], extras: ['tablet', 'ipad', 'tablety', 'tablet android'] },
    { keys: ['telefon', 'smartfon', 'smartphone', 'iphone', 'galaxy', 'mobile'], extras: ['telefon', 'smartfon', 'smartphone', 'iphone', 'galaxy', 'mobile', 'telefonia'] },
    { keys: ['zasilacz', 'psu', 'power supply', 'zasilanie'], extras: ['zasilacz', 'psu', 'power supply', 'zasilanie', 'zasilacze'] },
    { keys: ['bateria', 'akumulator', 'powerbank', 'ladowarka', 'ubc c', 'akulumulator', 'battery', 'batteries', 'accumulator', 'accumulators', 'solar panel', 'panel solarny', 'einhell', 'zestaw startowy'], extras: ['bateria', 'akumulator', 'powerbank', 'ladowarka', 'ladowarki', 'adapter zasilania', 'power bank', 'battery', 'batteries', 'accumulator', 'accumulators'] },
    { keys: ['sluchawki', 'headphones', 'headset', 'earphones', 'earbuds', 'audio'], extras: ['sluchawki', 'headphones', 'headset', 'earphones', 'earbuds', 'bezprzewodowe sluchawki'] },
    { keys: ['glosniki', 'glosnik', 'speakers', 'soundbar', 'kolumny'], extras: ['glosniki', 'glosnik', 'speakers', 'soundbar', 'kolumny', 'audio pc'] },
    { keys: ['kamera', 'webcam', 'kamerka', 'cctv', 'ip kamera'], extras: ['kamera', 'webcam', 'kamerka', 'cctv', 'ip cam', 'kamera ip', 'kamera internetowa'] },
    { keys: ['toner', 'tusz', 'cartridge', 'atrament', 'beben', 'wklad'], extras: ['toner', 'tusz', 'cartridge', 'atrament', 'beben', 'wklad', 'kaseta', 'tusz do drukarki', 'toner laserowy', 'materialy eksploatacyjne', 'eksploatacyjne'] },
    { keys: ['ups', 'zasilacz awaryjny', 'awaryjny'], extras: ['ups', 'zasilacz awaryjny', 'podtrzymywanie', 'niezawodny'] },
    { keys: ['serwer', 'server', 'rack', 'nas'], extras: ['serwer', 'server', 'rack', 'nas', 'blade', 'storage server'] },
    { keys: ['torba', 'plecak', 'case laptop', 'pokrowiec laptopa'], extras: ['torba', 'plecak', 'case laptop', 'pokrowiec', 'torba na laptop', 'futeraly'] },
    { keys: ['gry', 'konsola', 'zabawki', 'gaming', 'playstation', 'xbox', 'nintendo'], extras: ['gry', 'konsola', 'gaming', 'playstation', 'xbox', 'nintendo', 'gry komputerowe'] },
    { keys: ['agd', 'ekspres', 'czajnik', 'kuchnia', 'zmywarka', 'pralka'], extras: ['agd', 'ekspres do kawy', 'czajnik', 'kuchnia', 'zmywarka', 'pralka', 'lodowka'] },
    { keys: ['licencja', 'oprogramowanie', 'software', 'antywirus', 'windows', 'office'], extras: ['licencja', 'oprogramowanie', 'software', 'antywirus', 'windows', 'office', 'subskrypcja'] },
    { keys: ['kabel', 'adapter', 'przejsciowka', 'hdmi', 'usb', 'displayport', 'jack', 'rj45'], extras: ['kabel', 'adapter', 'przejsciowka', 'kabel hdmi', 'kabel usb', 'displayport', 'jack', 'rj45', 'okablowanie', 'przejsciowki'] },
    { keys: ['obudowa', 'chassis', 'chlodzenie', 'wentylator', 'radiator', 'cooler'], extras: ['obudowa', 'chassis', 'chlodzenie', 'wentylator', 'radiator', 'cooler', 'chlodziwo', 'pasta termiczna'] },
    { keys: ['druk', '3d', 'filament', 'drukarka 3d'], extras: ['druk 3d', 'filament', 'drukarka 3d', 'printer 3d'] },
    { keys: ['projektor', 'beamer', 'rzutnik'], extras: ['projektor', 'beamer', 'rzutnik', 'projekcja'] },
    { keys: ['tablet graficzny', 'digitizer', 'rysik'], extras: ['tablet graficzny', 'digitizer', 'rysik', 'drawing tablet'] },
    { keys: ['smart home', 'iot', 'inteligentny dom', 'smart'], extras: ['smart home', 'iot', 'inteligentny dom', 'smart switch', 'smart plug'] },
    { keys: ['antena', 'sygnaly', 'gsm', 'lte', '4g', '5g'], extras: ['antena', 'sygnaly', 'gsm', 'lte', '4g', '5g', 'antena wifi'] },
    { keys: ['urządzenie', 'urzadzenie', 'sprzet', 'hardware'], extras: [] }, // generic catch
    { targetName: 'Akcesoria GSM', keys: ['etui', 'case', 'nakładka', 'szkło hartowane', 'folia ochronna', 'pokrowiec', 'wsuwka', 'matt oppo', 'matt xiaomi', 'matt motorola', 'matt samsung'], extras: ['etui', 'case', 'nakladka', 'szklo hartowane', 'folia ochronna', 'pokrowiec', 'wsuwka'] },
    { targetName: 'Zabawki', keys: ['zabawki', 'lalka', 'figurka', 'klocki', 'puzzle', 'maskotka', 'pluszak', 'zabawka', 'sammelspielzeug', 'figuren', 'struny', 'gitara', 'gitary', 'elixir', 'martin', 'skrzypce'], extras: ['zabawki', 'lalka', 'figurka', 'klocki', 'puzzle', 'maskotka', 'pluszak', 'zabawka'] },
    { targetName: 'Narzędzia', keys: ['wiertarka', 'młotek', 'wkrętarka', 'szlifierka', 'kosiarka', 'klucz', 'wkrętak', 'narzędzia', 'handwerkzeug'], extras: ['wiertarka', 'mlotek', 'wkretarka', 'szlifierka', 'kosiarka', 'klucz', 'wkretak', 'narzedzia'] },
    { targetName: 'Dom i ogród', keys: ['odstraszacz', 'kretów', 'nawadnianie', 'opryskiwacz', 'opryskiwanie', 'basen', 'grill', 'zahrada', 'volta hager', 'rozdzielnica', 'nasiona', 'seeds', 'nozyczki', 'lyzka', 'widelec', 'noz', 'noze', 'patelnia', 'patelnie', 'garnek', 'garnki', 'berlinger', 'blaumann', 'mosquito', 'lapka na owady'], extras: ['odstraszacz', 'kretow', 'nawadnianie', 'opryskiwacz', 'opryskiwanie', 'basen', 'grill', 'nasiona', 'seeds'] },
    { targetName: 'Sport i Outdoor', keys: ['rower', 'kolarstwo', 'hulajnoga', 'bieganie', 'outdoor', 'survival', 'militarny', 'sport', 'walizka', 'walizki', 'suitcase', 'carry on', 'wenger', 'camping', 'bed', 'matress', 'materac', 'kombinezon ochronny', 'kombinezon', 'overall', 'ochronny'], extras: ['rower', 'kolarstwo', 'hulajnoga', 'bieganie', 'outdoor', 'survival', 'militarny', 'sport', 'walizka', 'walizki', 'suitcase', 'carry on', 'camping', 'bed', 'matress', 'materac'] },
    { targetName: 'Biurowe', keys: ['niszczarka', 'kalkulator', 'segregator', 'biurko', 'tablica', 'akcesoria biurowe', 'büro', 'tasma pakowa', 'tasma', 'pakowa', 'laminator', 'shredder', 'fellowes', 'compressed air', 'duster', 'sprezone powietrze'], extras: ['niszczarka', 'kalkulator', 'segregator', 'biurko', 'tablica', 'tasma pakowa'] },
    { targetName: 'Nośniki optyczne', keys: ['cd r', 'dvd r', 'pudelko cd', 'pudelko dvd', 'nosnik optyczny', 'nosniki optyczne', 'cd r', 'dvd r', 'dvd r', 'cd rw', 'dvd rw', 'cdrw', 'dvdrw', 'tray'], extras: ['cd r', 'dvd r', 'pudelko cd', 'pudelko dvd', 'nosnik optyczny', 'nosniki optyczne', 'cd rw', 'dvd rw', 'cdrw', 'dvdrw', 'tray'] },
    { targetName: 'Oświetlenie', keys: ['zarowka', 'lampa', 'bulb', 'lamp', 'led bulb', 'floor lamp', 'ring lamp', 'ring light', 'oswietlenie', 'latarka', 'czołówka', 'taschenlampe', 'stirnlampe'], extras: ['zarowka', 'lampa', 'bulb', 'lamp', 'led bulb', 'floor lamp', 'ring lamp', 'ring light', 'latarka', 'czolowka'] },
    { targetName: 'Okablowanie sieciowe', keys: ['patchcord', 'swiatlowodowy', 'swiatlowod', 'rj45', 'lan cable', 'kabel sieciowy', 'skretka', 'uchwyt odciagowy', 'wspornik slupowy'], extras: ['patchcord', 'swiatlowodowy', 'swiatlowod', 'rj45', 'lan cable', 'kabel sieciowy', 'skretka', 'uchwyt odciagowy', 'wspornik slupowy'] },
    { targetName: 'AGD drobne', keys: ['blender', 'juicer', 'wyciskarka', 'purifier', 'humidifier', 'oczyszczacz', 'nawilzac', 'nawilzacz', 'cleaner', 'mikser', 'toster', 'gofrownica'], extras: ['blender', 'juicer', 'wyciskarka', 'purifier', 'humidifier', 'oczyszczacz', 'nawilzacz', 'cleaner'] },
    { targetName: 'Zasilanie i UPS', keys: ['stabilizator napiecia', 'stabilizator', 'avr', 'licznik pradu', 'miernik zuzycia'], extras: ['stabilizator napiecia', 'avr', 'licznik pradu', 'miernik zuzycia'] },
    { targetName: 'Urządzenia peryferyjne', keys: ['filtr prywatyzujacy', 'rodo', 'privacy filter', 'podkladka pod', 'podstawka pod', 'uchwyt biurkowy'], extras: ['filtr prywatyzujacy', 'rodo', 'privacy filter'] }
  ];

  // Build normalised extra groups (all through _canonicalCatKey)
  const normExtraGroups = EXTRA_GROUPS.map(g => ({
    targetName: g.targetName,
    keys: g.keys.map(k => _canonicalCatKey(k)).filter(Boolean),
    extras: g.extras.map(e => _canonicalCatKey(e)).filter(Boolean),
  }));

  const abKeywordMap = [];
  for (const cat of abCats) {
    const catLow = _canonicalCatKey(cat.name);
    const words = catLow.split(' ').filter(w => w.length > 2 && !KEYWORD_STOP.has(w));
    const keywords = new Set([catLow, ...words]);

    // Add extra keywords from groups that match this AB category name
    for (const group of normExtraGroups) {
      let match = false;
      if (group.targetName) {
        match = (cat.name.toLowerCase() === group.targetName.toLowerCase());
      } else {
        match = group.keys.some(k => catLow.includes(k) || (k.length > 3 && k.includes(catLow)));
      }
      if (match) {
        group.extras.forEach(e => keywords.add(e));
        group.keys.forEach(k => keywords.add(k));
      }
    }
    abKeywordMap.push({ id: cat.id, name: cat.name, keywords: [...keywords] });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 1: Assign unmapped NON-AB categories to AB via ab_category_id
  // This is the MAIN source of the "16,000 unmapped" problem
  // Process ALL non-AB categories (with or without products currently)
  // ────────────────────────────────────────────────────────────────────────────
  let catAssigned = 0;

  const allNonAbCats = db.prepare(`
    SELECT pc.id, pc.name 
    FROM product_categories pc
    WHERE pc.is_ab_category = 0 AND (pc.ab_category_id IS NULL OR pc.ab_category_id = 0)
  `).all();

  // Helper to check if text contains exact word (boundary check)
  function hasWord(text, word) {
    const index = text.indexOf(word);
    if (index === -1) return false;
    
    if (index > 0) {
      const before = text.charAt(index - 1);
      if (/[a-z0-9]/i.test(before)) return false;
    }
    const afterIndex = index + word.length;
    if (afterIndex < text.length) {
      const after = text.charAt(afterIndex);
      if (/[a-z0-9]/i.test(after)) return false;
    }
    return true;
  }

  // Build a fallback: find AB category with longest name substring match
  function _findBestAbCat(text) {
    const textNorm = _canonicalCatKey(text);
    if (!textNorm) return null;

    // Fast-pass brand/model resolver for high-concentration unmatched products
    if (textNorm.includes('dicota')) {
      return { id: 3685, name: 'Komputery i Laptopy' };
    }
    if (textNorm.includes('apc')) {
      if (textNorm.includes('ups') || /\bsu\d/i.test(textNorm) || /\bsy\d/i.test(textNorm) || textNorm.includes('symmetra') || textNorm.includes('sbp') || textNorm.includes('smart ups')) {
        if (textNorm.includes('bt') || textNorm.includes('battery') || textNorm.includes('akumulator')) {
          return { id: 3759, name: 'Baterie i akumulatory' };
        }
        return { id: 3756, name: 'UPS' };
      }
      if (textNorm.includes('pdu') || textNorm.includes('strip') || textNorm.includes('listwa') || textNorm.includes('listwy') || /\bap[9754]\d/i.test(textNorm)) {
        if (textNorm.includes('kvm') || textNorm.includes('switch')) {
          return { id: 3689, name: 'Serwery' };
        }
        return { id: 3757, name: 'Listwy zasilające' };
      }
      if (textNorm.includes('rack') || textNorm.includes('cabinet') || textNorm.includes('enclosure') || textNorm.includes('szafa') || textNorm.includes('polka') || /\bar[81]\d/i.test(textNorm) || textNorm.includes('acf')) {
        return { id: 3689, name: 'Serwery' };
      }
      return { id: 3756, name: 'UPS' }; // Catch-all for APC
    }
    if (textNorm.includes('cisco')) {
      if (textNorm.includes('cab ') || textNorm.includes('cab-') || textNorm.includes('cable') || textNorm.includes('kabel')) {
        return { id: 3709, name: 'Okablowanie sieciowe' };
      }
      if (textNorm.includes('pwr ') || textNorm.includes('pwr-') || textNorm.includes('power') || textNorm.includes('zasilacz')) {
        return { id: 3758, name: 'Zasilacze' };
      }
      if (textNorm.includes('spa') || textNorm.includes('cp ') || textNorm.includes('cp-') || textNorm.includes('phone') || textNorm.includes('telefon')) {
        return { id: 3710, name: 'VoIP i telefony' };
      }
      if (textNorm.includes('sfp') || textNorm.includes('gbic') || textNorm.includes('transceiver') || textNorm.includes('glc ') || textNorm.includes('glc-') || textNorm.includes('mgbl') || textNorm.includes('mgbs') || textNorm.includes('modul') || textNorm.includes('xfp') || textNorm.includes('x2 ')) {
        return { id: 3704, name: 'Sieci i Komunikacja' };
      }
      if (textNorm.includes('switch') || textNorm.includes('ws c') || textNorm.includes('przelacznik')) {
        return { id: 3706, name: 'Switche' };
      }
      if (textNorm.includes('router')) {
        return { id: 3705, name: 'Routery' };
      }
      return { id: 3704, name: 'Sieci i Komunikacja' }; // Catch-all for Cisco
    }
    if (textNorm.includes('eaton')) {
      if (textNorm.includes('ups') || textNorm.includes('9px') || textNorm.includes('5px') || textNorm.includes('3s')) {
        return { id: 3756, name: 'UPS' };
      }
      if (textNorm.includes('pdu') || textNorm.includes('strip') || textNorm.includes('listwa') || textNorm.includes('listwy')) {
        return { id: 3757, name: 'Listwy zasilające' };
      }
      return { id: 3756, name: 'UPS' }; // Catch-all for Eaton
    }
    if (textNorm.includes('corsair')) {
      if (/\b(cmx|cmz|cmk|cms|cmd|cmw|cmv|cmy|vs)\w*/.test(textNorm) || textNorm.includes('vengeance') || textNorm.includes('dominator') || textNorm.includes('valueselect') || textNorm.includes('sodimm')) {
        return { id: 3692, name: 'Pamięci RAM' };
      }
      if (/\bcssd\w*/.test(textNorm) || textNorm.includes('force') || textNorm.includes('neutron') || textNorm.includes('mp510') || textNorm.includes('mp600') || textNorm.includes('ssd')) {
        return { id: 3693, name: 'Dyski i SSD' };
      }
      if (/\bcc \d+/.test(textNorm) || textNorm.includes('cc') || textNorm.includes('carbide') || textNorm.includes('obsidian') || textNorm.includes('graphite') || textNorm.includes('crystal') || textNorm.includes('case') || textNorm.includes('obudowa')) {
        return { id: 3697, name: 'Obudowy' };
      }
      if (/\bcmf\w*/.test(textNorm) || textNorm.includes('voyager') || textNorm.includes('survivor') || textNorm.includes('flash')) {
        return { id: 3739, name: 'Pendrive' };
      }
      if (textNorm.includes('harpoon') || textNorm.includes('scimitar') || textNorm.includes('ironclaw') || textNorm.includes('glaive') || textNorm.includes('k55') || textNorm.includes('k70') || textNorm.includes('k95') || textNorm.includes('mouse') || textNorm.includes('keyboard') || textNorm.includes('mysz') || textNorm.includes('klawiatura')) {
        return { id: 3743, name: 'Akcesoria gamingowe' };
      }
    }
    if (textNorm.includes('hpe') || textNorm.includes('hp enterprise')) {
      if (textNorm.includes('care pack') || textNorm.includes('support') || textNorm.includes('warranty') || textNorm.includes('gwarancja') || textNorm.includes('wsparcie') || /\bu\d{4,5}[a-z]?/i.test(textNorm) || textNorm.startsWith('u') && /\bu\d+/.test(textNorm)) {
        return { id: 3774, name: 'Pozostałe' };
      }
      return { id: 3689, name: 'Serwery' }; // HPE option cards, rails, parts
    }
    if (textNorm.includes('lenovo')) {
      return { id: 3685, name: 'Komputery i Laptopy' }; // Lenovo accessories/parts
    }
    if (textNorm.includes('hp poly') || textNorm.includes('polycom')) {
      return { id: 3726, name: 'Słuchawki i głośniki' };
    }
    if (textNorm.includes('green cell')) {
      if (textNorm.includes('charger') || textNorm.includes('ladowarka') || textNorm.includes('powerbank') || textNorm.includes('kab') || textNorm.includes('cable') || /\bad\d+/i.test(textNorm)) {
        return { id: 3731, name: 'Ładowarki i PowerBanki' };
      }
      return { id: 3759, name: 'Baterie i akumulatory' };
    }

    // LEXMARK / EPSON / BROTHER / CANON / XEROX / OKI
    if (textNorm.includes('lexmark') || textNorm.includes('epson') || textNorm.includes('brother') || textNorm.includes('canon') || textNorm.includes('xerox') || textNorm.includes('oki')) {
      if (textNorm.includes('printer') || textNorm.includes('skaner') || textNorm.includes('drukarka') || textNorm.includes('druk') || textNorm.includes('skan') || textNorm.includes('urzadzenie wielofunkcyjne')) {
        return { id: 3722, name: 'Drukarki' };
      }
      return { id: 3724, name: 'Tonery i tusze' };
    }

    // HP
    if (textNorm.includes('hp') && !textNorm.includes('hpe') && !textNorm.includes('hp enterprise') && !textNorm.includes('hp poly')) {
      if (/\bu\d{4,5}[a-z]?\b/i.test(textNorm) || textNorm.includes('care pack') || textNorm.includes('support') || textNorm.includes('warranty') || textNorm.includes('gwarancja') || textNorm.includes('wsparcie')) {
        return { id: 3774, name: 'Pozostałe' };
      }
      if (textNorm.includes('laptop') || textNorm.includes('notebook') || textNorm.includes('probook') || textNorm.includes('elitebook') || textNorm.includes('pavilion') || textNorm.includes('desktop') || textNorm.includes('workstation') || textNorm.includes('prodesk') || textNorm.includes('elitedesk') || textNorm.includes('thin client')) {
        return { id: 3685, name: 'Komputery i Laptopy' };
      }
      if (textNorm.includes('monitor') || textNorm.includes('display') || textNorm.includes('wyswietlacz') || textNorm.includes('ekran')) {
        return { id: 3700, name: 'Monitory' };
      }
      if (textNorm.includes('printer') || textNorm.includes('laserjet') || textNorm.includes('pagewide') || textNorm.includes('designjet') || textNorm.includes('officejet') || textNorm.includes('smart tank') || textNorm.includes('drukarka') || textNorm.includes('druk')) {
        return { id: 3722, name: 'Drukarki' };
      }
      if (/\b(q|c|cb|ce|cd|cf|cn|cr|ch)\d{3,4}[a-z]?\b/.test(textNorm) || textNorm.includes('toner') || textNorm.includes('tusz') || textNorm.includes('ink ') || textNorm.includes('cartridge') || textNorm.includes('atrament') || textNorm.includes('beben') || textNorm.includes('wklad') || textNorm.includes('glowica')) {
        return { id: 3724, name: 'Tonery i tusze' };
      }
      return { id: 3724, name: 'Tonery i tusze' }; // Default unassigned for HP
    }

    // MICROSOFT
    if (textNorm.includes('microsoft')) {
      return { id: 3736, name: 'Licencje ESD' };
    }

    // MSI
    if (textNorm.includes('msi')) {
      if (textNorm.includes('clutch') || textNorm.includes('vigor') || textNorm.includes('agility') || textNorm.includes('mouse') || textNorm.includes('mysz') || textNorm.includes('keyboard') || textNorm.includes('klawiatura')) {
        return { id: 3743, name: 'Akcesoria gamingowe' };
      }
      if (textNorm.includes('gtx') || textNorm.includes('rtx') || textNorm.includes('radeon') || textNorm.includes('rx ') || textNorm.includes('geforce') || /\bgt \d+\b/.test(textNorm) || textNorm.includes('kart') || textNorm.includes('graficz')) {
        return { id: 3694, name: 'Karty graficzne' };
      }
      if (textNorm.includes('cubi') || textNorm.includes('desktop') || textNorm.includes('creator') || textNorm.includes('workstation') || textNorm.includes('infinite') || textNorm.includes('aegis') || textNorm.includes('codex') || textNorm.includes('laptop')) {
        return { id: 3685, name: 'Komputery i Laptopy' };
      }
      if (/\b(b\d{3,4}|z\d{3,4}|x\d{3,4}|h\d{3,4}|a\d{3,4})\w*\b/.test(textNorm) || textNorm.includes('motherboard') || textNorm.includes('plyta glowna')) {
        return { id: 3695, name: 'Płyty główne' };
      }
      if (textNorm.includes('sekira') || textNorm.includes('gungnir') || textNorm.includes('vampiric') || textNorm.includes('chassis') || textNorm.includes('obudowa')) {
        return { id: 3697, name: 'Obudowy' };
      }
    }

    // ASUS
    if (textNorm.includes('asus')) {
      if (/\b(rt|dsl|rp|zenwifi)\b/.test(textNorm) || textNorm.includes('rapture') || textNorm.includes('router') || textNorm.includes('lyra')) {
        return { id: 3705, name: 'Routery' };
      }
      if (textNorm.includes('pce ') || textNorm.includes('pce') || textNorm.includes('usb ac') || textNorm.includes('usb n') || textNorm.includes('usb ax') || textNorm.includes('karta sieciowa') || textNorm.includes('dongle') || textNorm.includes('switch') || textNorm.includes('adapter wifi')) {
        return { id: 3704, name: 'Sieci i Komunikacja' };
      }
      if (textNorm.includes('prime') || textNorm.includes('tuf') || textNorm.includes('rog crosshair') || textNorm.includes('rog maximus') || textNorm.includes('rog strix') || /\b(b\d{3,4}|z\d{3,4}|x\d{3,4}|h\d{3,4}|a\d{3,4})\w*\b/.test(textNorm) || textNorm.includes('motherboard') || textNorm.includes('plyta glowna')) {
        if (textNorm.includes('gtx') || textNorm.includes('rtx') || textNorm.includes('radeon') || textNorm.includes('geforce') || textNorm.includes('rx ') || textNorm.includes('graphics') || textNorm.includes('karta graficzna')) {
          return { id: 3694, name: 'Karty graficzne' };
        }
        return { id: 3695, name: 'Płyty główne' };
      }
    }

    // ACER
    if (textNorm.includes('acer')) {
      if (textNorm.includes('bag') || textNorm.includes('backpack') || textNorm.includes('torba') || textNorm.includes('plecak')) {
        return { id: 3766, name: 'Sport i Outdoor' };
      }
      if (textNorm.includes('mce') || textNorm.includes('msp') || textNorm.includes('mouse') || textNorm.includes('mysz')) {
        return { id: 3721, name: 'Myszy i podkładki' };
      }
    }

    // GIGABYTE
    if (textNorm.includes('gigabyte') || textNorm.includes('aorus')) {
      if (textNorm.includes('gv ') || textNorm.includes('gv') || textNorm.includes('gtx') || textNorm.includes('rtx') || textNorm.includes('radeon') || textNorm.includes('geforce') || textNorm.includes('rx ')) {
        return { id: 3694, name: 'Karty graficzne' };
      }
      if (textNorm.includes('ga ') || textNorm.includes('ga') || /\b(b\d{3,4}|z\d{3,4}|x\d{3,4}|h\d{3,4}|a\d{3,4})\w*\b/.test(textNorm) || textNorm.includes('motherboard') || textNorm.includes('plyta glowna')) {
        return { id: 3695, name: 'Płyty główne' };
      }
      if (textNorm.includes('gb ') || textNorm.includes('gb') || textNorm.includes('brix') || textNorm.includes('desktop')) {
        return { id: 3685, name: 'Komputery i Laptopy' };
      }
    }

    // GEMBIRD
    if (textNorm.includes('gembird')) {
      if (textNorm.includes('mouse') || textNorm.includes('mysz') || textNorm.includes('podkladka')) {
        return { id: 3721, name: 'Myszy i podkładki' };
      }
      if (textNorm.includes('keyboard') || textNorm.includes('klawiatura')) {
        return { id: 3720, name: 'Klawiatury' };
      }
      return { id: 3712, name: 'Kable i Adaptery' };
    }

    // FSAS (Fujitsu Siemens)
    if (textNorm.includes('fsas') || textNorm.includes('fujitsu')) {
      return { id: 3689, name: 'Serwery' };
    }

    // TRANSCEND
    if (textNorm.includes('transcend')) {
      if (textNorm.includes('micro') || textNorm.includes('sd') || textNorm.includes('sdhc') || textNorm.includes('sdxc') || textNorm.includes('card') || textNorm.includes('karta')) {
        return { id: 3738, name: 'Karty pamięci' };
      }
      if (textNorm.includes('jetflash') || textNorm.includes('usb stick') || textNorm.includes('pendrive')) {
        return { id: 3739, name: 'Pendrive' };
      }
      if (textNorm.includes('storejet') || textNorm.includes('dysk') || textNorm.includes('ssd') || textNorm.includes('hdd') || textNorm.includes('extern')) {
        return { id: 3740, name: 'Dyski zewnętrzne' };
      }
      return { id: 3737, name: 'Pamięci i nośniki' };
    }

    // LOWEPRO
    if (textNorm.includes('lowepro')) {
      return { id: 3766, name: 'Sport i Outdoor' };
    }

    // SAMSUNG
    if (textNorm.includes('samsung')) {
      if (textNorm.includes('evo') || textNorm.includes('pro') || textNorm.includes('pm9a1') || textNorm.includes('pm893') || textNorm.includes('pm983') || textNorm.includes('ssd') || textNorm.includes('dysk')) {
        return { id: 3693, name: 'Dyski i SSD' };
      }
      if (textNorm.includes('monitor') || textNorm.includes('display') || textNorm.includes('ekran') || textNorm.includes('wyswietlacz')) {
        return { id: 3700, name: 'Monitory' };
      }
    }

    // SUPER MICRO COMPUTER / SUPERMICRO
    if (textNorm.includes('super micro') || textNorm.includes('supermicro')) {
      return { id: 3689, name: 'Serwery' };
    }

    // KINGSTON
    if (textNorm.includes('kingston')) {
      if (/\b(kvr|valueram|hyperx|fury)\b/.test(textNorm) || textNorm.includes('ram') || textNorm.includes('ddr') || textNorm.includes('sodimm')) {
        return { id: 3692, name: 'Pamięci RAM' };
      }
      if (textNorm.includes('ssd') || textNorm.includes('a400') || textNorm.includes('kc600') || textNorm.includes('nv2') || textNorm.includes('nv1') || textNorm.includes('dysk')) {
        return { id: 3693, name: 'Dyski i SSD' };
      }
      if (textNorm.includes('datatraveler') || textNorm.includes('pendrive') || textNorm.includes('usb stick') || textNorm.includes('canvas')) {
        return { id: 3739, name: 'Pendrive' };
      }
    }

    // DELL
    if (textNorm.includes('dell')) {
      if (textNorm.includes('care pack') || textNorm.includes('support') || textNorm.includes('warranty') || textNorm.includes('gwarancja') || textNorm.includes('wsparcie')) {
        return { id: 3774, name: 'Pozostałe' };
      }
      if (/^\s*\b400\b/.test(textNorm) || textNorm.includes('dysk') || textNorm.includes('ssd') || textNorm.includes('hdd')) {
        return { id: 3693, name: 'Dyski i SSD' };
      }
      if (/^\s*\b470\b/.test(textNorm) || textNorm.includes('cable') || textNorm.includes('kabel') || textNorm.includes('adapter')) {
        return { id: 3712, name: 'Kable i Adaptery' };
      }
      if (/^\s*\b770\b/.test(textNorm) || textNorm.includes('rail') || textNorm.includes('serwer') || textNorm.includes('szyna')) {
        return { id: 3689, name: 'Serwery' };
      }
    }

    // MACLEAN
    if (textNorm.includes('maclean')) {
      if (textNorm.includes('wykrywacz') || textNorm.includes('lopatka') || textNorm.includes('lutownica') || textNorm.includes('klej') || textNorm.includes('pistolet') || textNorm.includes('narzedz')) {
        return { id: 3753, name: 'Narzędzia' };
      }
      if (textNorm.includes('plafon') || textNorm.includes('oprawka') || textNorm.includes('klosz') || textNorm.includes('lampa') || textNorm.includes('naswietlac') || textNorm.includes('statyw podlogowy') || textNorm.includes('uchwyt roboczy')) {
        return { id: 3752, name: 'Oświetlenie' };
      }
      return { id: 3754, name: 'Dom i ogród' };
    }

    // ZYXEL
    if (textNorm.includes('zyxel')) {
      if (/^\s*\b(xgs|gs|mgs)\d+/.test(textNorm) || textNorm.includes('switch') || textNorm.includes('przelacznik')) {
        return { id: 3706, name: 'Switche' };
      }
      if (/^\s*\busg\d+/.test(textNorm) || textNorm.includes('zywall') || textNorm.includes('firewall')) {
        return { id: 3711, name: 'Firewall i PoE' };
      }
      if (/^\s*\b(wac|nwa|wax)\d+/.test(textNorm) || textNorm.includes('access point') || textNorm.includes('punkt dostepowy')) {
        return { id: 3707, name: 'Access Pointy' };
      }
      if (/^\s*\bnwd\d+/.test(textNorm)) {
        return { id: 3704, name: 'Sieci i Komunikacja' };
      }
      if (textNorm.includes('lic ') || textNorm.includes('lic-') || textNorm.includes('licence') || textNorm.includes('licencja')) {
        return { id: 3736, name: 'Licencje ESD' };
      }
      return { id: 3704, name: 'Sieci i Komunikacja' };
    }

    // TP-LINK / D-LINK
    if (textNorm.includes('tp link') || textNorm.includes('tplink') || textNorm.includes('d link') || textNorm.includes('dlink')) {
      if (textNorm.includes('switch') || textNorm.includes('przelacznik') || /\b(tl[- ]sg|tl[- ]sf|dgs|des)\d*/.test(textNorm)) {
        return { id: 3706, name: 'Switche' };
      }
      if (textNorm.includes('router') || textNorm.includes('deco') || textNorm.includes('archer') || /\b(tl[- ]wr|tl[- ]mr|dwr|dir)\d*/.test(textNorm)) {
        return { id: 3705, name: 'Routery' };
      }
      if (textNorm.includes('access point') || textNorm.includes('ap') || /\b(eap|cpe|dap)\d*/.test(textNorm)) {
        return { id: 3707, name: 'Access Pointy' };
      }
      return { id: 3704, name: 'Sieci i Komunikacja' };
    }

    // ASROCK
    if (textNorm.includes('asrock')) {
      return { id: 3695, name: 'Płyty główne' };
    }

    // SEAGATE
    if (textNorm.includes('seagate')) {
      return { id: 3693, name: 'Dyski i SSD' };
    }

    // BENQ
    if (textNorm.includes('benq')) {
      if (textNorm.includes('projector') || textNorm.includes('beamer') || textNorm.includes('projektor')) {
        return { id: 3701, name: 'Projektory' };
      }
      return { id: 3700, name: 'Monitory' };
    }

    // A4TECH
    if (textNorm.includes('a4tech') || textNorm.includes('bloody')) {
      if (textNorm.includes('mouse') || textNorm.includes('mysz') || textNorm.includes('podkladka')) {
        return { id: 3721, name: 'Myszy i podkładki' };
      }
      if (textNorm.includes('keyboard') || textNorm.includes('klawiatura')) {
        return { id: 3720, name: 'Klawiatury' };
      }
      return { id: 3743, name: 'Akcesoria gamingowe' };
    }

    // KENSINGTON
    if (textNorm.includes('kensington')) {
      if (textNorm.includes('dock') || /\bsd5\d{3}\b/.test(textNorm)) {
        return { id: 3716, name: 'Stacje dokujące' };
      }
      return { id: 3719, name: 'Urządzenia peryferyjne' };
    }

    // ICY BOX
    if (textNorm.includes('icy box') || textNorm.includes('icybox')) {
      if (textNorm.includes('cable') || textNorm.includes('kabel') || textNorm.includes('adapter')) {
        return { id: 3712, name: 'Kable i Adaptery' };
      }
      return { id: 3719, name: 'Urządzenia peryferyjne' };
    }

    // DYNABOOK
    if (textNorm.includes('dynabook')) {
      if (textNorm.includes('bag') || textNorm.includes('backpack') || textNorm.includes('torba') || textNorm.includes('plecak') || textNorm.includes('case')) {
        return { id: 3766, name: 'Sport i Outdoor' };
      }
      if (textNorm.includes('power') || textNorm.includes('zasilacz') || textNorm.includes('charger') || textNorm.includes('ladowarka')) {
        return { id: 3758, name: 'Zasilacze' };
      }
      return { id: 3685, name: 'Komputery i Laptopy' };
    }

    // EDIMAX
    if (textNorm.includes('edimax')) {
      return { id: 3704, name: 'Sieci i Komunikacja' };
    }

    // RAZER
    if (textNorm.includes('razer')) {
      return { id: 3743, name: 'Akcesoria gamingowe' };
    }

    // IBOX
    if (textNorm.includes('ibox')) {
      if (textNorm.includes('case') || textNorm.includes('chassis') || textNorm.includes('obudowa')) {
        return { id: 3697, name: 'Obudowy' };
      }
      if (textNorm.includes('zasilacz') || textNorm.includes('psu') || textNorm.includes('power')) {
        return { id: 3696, name: 'Zasilacze PC' };
      }
      if (textNorm.includes('mouse') || textNorm.includes('mysz') || textNorm.includes('keyboard') || textNorm.includes('klawiatura')) {
        return { id: 3721, name: 'Myszy i podkładki' };
      }
      return { id: 3719, name: 'Urządzenia peryferyjne' };
    }

    // EVER
    if (textNorm.includes('ever')) {
      if (textNorm.includes('listwa') || textNorm.includes('strip') || textNorm.includes('filtr')) {
        return { id: 3757, name: 'Listwy zasilające' };
      }
      return { id: 3756, name: 'UPS' };
    }

    // HUAWEI
    if (textNorm.includes('huawei')) {
      if (textNorm.includes('router') || textNorm.includes('modem') || textNorm.includes('lte') || textNorm.includes('4g') || textNorm.includes('5g') || /\b(b535|b311|e5576)\b/.test(textNorm)) {
        return { id: 3705, name: 'Routery' };
      }
      return { id: 3704, name: 'Sieci i Komunikacja' };
    }

    let bestCat = null;
    let bestScore = 0;

    // Primary: keyword score with word boundary & inflection matching
    for (const cat of abKeywordMap) {
      let score = 0;
      for (const kw of cat.keywords) {
        if (hasWord(textNorm, kw)) {
          score += kw.length;
        } else {
          // Prefix/Polish inflection matching: check if text has any word sharing a prefix of length >= 4 with keyword
          const words = textNorm.split(' ');
          for (const w of words) {
            if (w.length >= 4 && kw.length >= 4 && w.slice(0, 4) === kw.slice(0, 4) && !KEYWORD_STOP.has(w)) {
              score += 2;
              break;
            }
          }
        }
      }
      if (score > bestScore) { bestScore = score; bestCat = cat; }
    }
    if (bestScore >= 3) return bestCat;

    // Secondary: word-level overlap (strict boundary or inflected match)
    const textWords = textNorm.split(' ').filter(w => w.length >= 3 && !KEYWORD_STOP.has(w));
    bestScore = 0;
    for (const cat of abKeywordMap) {
      for (const kw of cat.keywords) {
        if (textWords.some(w => kw === w || (w.length >= 4 && kw.length >= 4 && w.slice(0, 4) === kw.slice(0, 4)))) {
          bestScore = 1;
          bestCat = cat;
          break;
        }
      }
    }
    if (bestScore >= 1) return bestCat;

    // Tertiary: find AB category with name most similar to text (longest common word)
    for (const cat of abKeywordMap) {
      const catWords = _canonicalCatKey(cat.name).split(' ').filter(w => w.length >= 3);
      for (const cw of catWords) {
        for (const tw of textWords) {
          if (cw === tw || (cw.length >= 4 && tw.startsWith(cw.slice(0, 4)))) {
            return cat; // first match is good enough at this level
          }
        }
      }
    }

    return null; // truly unmatchable
  }

  const updateCatAbId = db.prepare('UPDATE product_categories SET ab_category_id = ? WHERE id = ?');
  
  db.transaction(() => {
    for (const nonAbCat of allNonAbCats) {
      const best = _findBestAbCat(nonAbCat.name);
      if (best) {
        try {
          updateCatAbId.run(best.id, nonAbCat.id);
          catAssigned++;
        } catch(_) {}
      }
    }
  })();

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 2: Assign PRODUCTS that have no category or are in unmapped categories
  // ────────────────────────────────────────────────────────────────────────────
  const unmapped = db.prepare(`
    SELECT cm.id, cm.name, cm.normalized_name, cm.manufacturer, cm.category_id, cm.category_name
    FROM catalog_master cm
    WHERE (
      cm.category_id IS NULL
      OR cm.category_id = 0
      OR cm.category_id IN (
        SELECT pc.id FROM product_categories pc
        WHERE pc.is_ab_category = 0 AND (pc.ab_category_id IS NULL OR pc.ab_category_id = 0)
      )
    )
    AND cm.name IS NOT NULL AND cm.name != ''
    ORDER BY cm.name ASC
    LIMIT ?
  `).all(limit);

  const updateProduct = db.prepare('UPDATE catalog_master SET category_id = ?, category_name = ? WHERE id = ?');

  let prodAssigned = 0;
  let remaining = [];

  db.transaction(() => {
    for (const prod of unmapped) {
      const productText = _canonicalCatKey(
        (prod.normalized_name || prod.name || '') + ' ' + (prod.manufacturer || '') + ' ' + (prod.category_name || '')
      );

      const best = _findBestAbCat(productText);
      if (best) {
        updateProduct.run(best.id, best.name, prod.id);
        prodAssigned++;
      } else {
        remaining.push(prod);
      }
    }
  })();

  let aiUsed = 0;

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3: AI fallback for products that couldn't be keyword-matched
  // ────────────────────────────────────────────────────────────────────────────
  if (useAi && remaining.length > 0) {
    try {
      const owui = require('./openwebuiService');
      const { settingsOps } = require('../models/localDb');
      const token = owui.getApiKey();
      const baseUrl = owui.getBaseUrl();
      const modelId = settingsOps.get('ai_map_catalog') || settingsOps.get('owui_default_model') || '';
      const models = modelId ? null : await owui.listModels(token).catch(() => []);
      const useModel = modelId || models?.[0]?.id || models?.[0]?.name;

      if (token && useModel && baseUrl) {
        const BATCH = 30;
        const abListStr = abCats.map((c, i) => `${i + 1}. [id:${c.id}] ${c.name}`).join('\n');

        for (let i = 0; i < remaining.length; i += BATCH) {
          const batch = remaining.slice(i, i + BATCH);
          const productListStr = batch.map(p =>
            `- Nazwa: ${p.normalized_name || p.name || ''}, Producent: ${p.manufacturer || ''}`
          ).join('\n');

          const prompt = `Jesteś ekspertem kategoryzacji produktów IT i elektroniki.

DOSTĘPNE KATEGORIE (format: [id:X] Nazwa):
${abListStr}

PRODUKTY DO SKATEGORYZOWANIA:
${productListStr}

Dla każdego produktu wybierz ID kategorii AB do której NAJLEPIEJ pasuje.
Odpowiedz TYLKO JSON array [{\"name\": \"...\", \"category_id\": X}, ...]`;

          try {
            const paths = ['/api/chat/completions', '/v1/chat/completions'];
            let raw = null;
            for (const p of paths) {
              try {
                const r = await fetch(`${baseUrl}${p}`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ model: useModel, messages: [{ role: 'user', content: prompt }], temperature: 0.05 }),
                });
                const j = await r.json();
                raw = j?.choices?.[0]?.message?.content || j?.message?.content || j?.response || '';
                if (raw) break;
              } catch(_) {}
            }

            const match = raw?.match(/\[[\s\S]*?\]/);
            if (match) {
              const mappings = JSON.parse(match[0]);
              for (const m of mappings) {
                if (!m.category_id) continue;
                const prod = batch.find(p => {
                  const pName = _canonicalCatKey(p.normalized_name || p.name || '');
                  const mName = _canonicalCatKey(m.name || '');
                  return pName.includes(mName.slice(0, 15)) || mName.includes(pName.slice(0, 15));
                });
                if (prod) {
                  const abCat = abCats.find(c => c.id === m.category_id);
                  if (abCat) {
                    updateProduct.run(abCat.id, abCat.name, prod.id);
                    prodAssigned++;
                    aiUsed++;
                  }
                }
              }
            }
          } catch(e) {
            console.error('[aiAssignUnmapped] batch AI error:', e.message);
          }
        }
      }
    } catch(e) {
      console.error('[aiAssignUnmapped] AI setup error:', e.message);
    }
  }

  // Final count refresh
  try {
    db.prepare('UPDATE product_categories SET product_count = (SELECT COUNT(*) FROM catalog_master WHERE category_id = product_categories.id)').run();
  } catch(_) {}

  const stillUnmapped = db.prepare(`
    SELECT COUNT(*) as cnt FROM product_categories 
    WHERE is_ab_category = 0 AND (ab_category_id IS NULL OR ab_category_id = 0)
  `).get()?.cnt || 0;

  return {
    total: (unmapped.length + allNonAbCats.length),
    categoriesAssigned: catAssigned,
    productsAssigned: prodAssigned,
    assigned: catAssigned + prodAssigned,
    keywordAssigned: catAssigned + prodAssigned - aiUsed,
    aiUsed,
    remaining: remaining.length - aiUsed,
    stillUnmappedCategories: stillUnmapped,
  };
}

/**
 * Buduje drzewo kategorii AB z feedu hurtowni i przypisuje produkty.
 * Nie zeruje istniejących category_id — nadpisuje tylko tam, gdzie AB ma ścieżkę,
 * a keyword matching dotyczy wyłącznie produktów bez kategorii.
 */
function generateAbCategoryTree(db) {
  registerNormalizeEan(db);

  function makeSlug(str) {
    return (str || '').toLowerCase()
      .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
      .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
      .replace(/ś/g,'s').replace(/ż/g,'z').replace(/ź/g,'z')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function norm(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s || s.startsWith('<') || s.length < 2) return null;
    if (/^\d+\|\d+/.test(s)) return null;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function tokenize(str) {
    return (str || '').toLowerCase()
      .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
      .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
      .replace(/ś/g,'s').replace(/ż/g,'z').replace(/ź/g,'z')
      .split(/[^a-z0-9]+/).filter(w => w.length > 2);
  }

  function isSameCategory(a, b) {
    const ta = tokenize(a);
    const tb = tokenize(b);
    if (ta.length === 0 || tb.length === 0) return false;
    const shared = ta.filter(w => tb.includes(w)).length;
    const minLen = Math.min(ta.length, tb.length);
    return shared >= minLen * 0.6 && shared >= 1;
  }

  try {
    db.prepare('UPDATE product_categories SET is_ab_category = 0, parent_id = NULL').run();
    db.prepare(`DELETE FROM product_categories WHERE
      name LIKE '%:%' OR name LIKE '%>%' OR name LIKE '%|%'
      OR name LIKE '<%' OR length(trim(name)) < 2`).run();
  } catch (_) {}

  const abSupplier = db.prepare(`
    SELECT supplier_id, COUNT(DISTINCT category) as cnt
    FROM supplier_products
    WHERE category IS NOT NULL AND trim(category) != '' AND category NOT LIKE '<%'
      AND category NOT LIKE '%|%'
    GROUP BY supplier_id ORDER BY cnt DESC LIMIT 1
  `).get();

  if (!abSupplier) {
    const mfrs = db.prepare(`
      SELECT manufacturer, COUNT(*) as cnt FROM catalog_master
      WHERE manufacturer IS NOT NULL AND manufacturer != ''
      GROUP BY manufacturer ORDER BY cnt DESC LIMIT 200
    `).all();
    if (!mfrs.length) return { ok: false, created: 0, assignedAB: 0, assignedOther: 0, message: 'Brak danych kategorii i producentów.' };
    let fc = 0, fa = 0;
    for (const m of mfrs) {
      const slug = makeSlug(m.manufacturer);
      db.prepare('INSERT OR IGNORE INTO product_categories (name,slug,is_ab_category,product_count) VALUES(?,?,1,?)').run(m.manufacturer, slug, m.cnt);
      const cat = db.prepare('SELECT id FROM product_categories WHERE name=? LIMIT 1').get(m.manufacturer);
      if (cat) {
        db.prepare('UPDATE product_categories SET is_ab_category=1 WHERE id=?').run(cat.id);
        fa += db.prepare('UPDATE catalog_master SET category_id=?,category_name=? WHERE manufacturer=? AND (category_id IS NULL OR category_id = 0)').run(cat.id, m.manufacturer, m.manufacturer).changes;
        fc++;
      }
    }
    db.prepare('UPDATE product_categories SET product_count=(SELECT COUNT(*) FROM catalog_master WHERE category_id=product_categories.id)').run();
    return { ok: true, created: fc, assignedAB: fa, assignedOther: 0, message: `Wygenerowano ${fc} kategorii z producentów, przypisano ${fa} produktów bez kategorii.` };
  }

  const idMap = new Map();
  let created = 0;

  const abPaths = db.prepare(`
    SELECT DISTINCT category FROM supplier_products
    WHERE supplier_id = ? AND category IS NOT NULL AND trim(category) != '' AND category NOT LIKE '<%'
      AND category NOT LIKE '%|%'
    ORDER BY category
  `).all(abSupplier.supplier_id);

  for (const row of abPaths) {
    const parts = row.category.split(/\s*[>\/\\|:]\s*/).map(norm).filter(Boolean);
    if (!parts.length) continue;

    let parentId = null;
    for (const name of parts) {
      const normKey = tokenize(name).sort().join('-');
      const mapKey = `${parentId}|${normKey}`;

      if (idMap.has(mapKey)) {
        parentId = idMap.get(mapKey);
        continue;
      }

      const siblings = db.prepare(`
        SELECT id, name FROM product_categories
        WHERE ${parentId === null ? 'parent_id IS NULL' : 'parent_id = ?'}
        AND is_ab_category = 1
      `).all(...(parentId === null ? [] : [parentId]));

      let catId = null;
      for (const sib of siblings) {
        if (isSameCategory(sib.name, name)) { catId = sib.id; break; }
      }

      if (!catId) {
        try {
          const r = db.prepare(
            'INSERT INTO product_categories (name,slug,parent_id,is_ab_category) VALUES(?,?,?,1)'
          ).run(name, makeSlug(name), parentId);
          catId = Number(r.lastInsertRowid);
          created++;
        } catch (e) {
          const ex = db.prepare(
            'SELECT id FROM product_categories WHERE lower(name)=lower(?) AND (parent_id IS ? OR parent_id=?)'
          ).get(name, parentId, parentId);
          catId = ex ? ex.id : null;
        }
      }

      if (catId) {
        db.prepare('UPDATE product_categories SET is_ab_category=1, parent_id=? WHERE id=?').run(parentId, catId);
        idMap.set(mapKey, catId);
        parentId = catId;
      }
    }
  }

  const pathToLeaf = new Map();
  for (const row of abPaths) {
    const parts = row.category.split(/\s*[>\/\\|:]\s*/).map(norm).filter(Boolean);
    if (!parts.length) continue;
    let parentId = null;
    let leafId = null;
    for (const name of parts) {
      const normKey = tokenize(name).sort().join('-');
      const mapKey = `${parentId}|${normKey}`;
      leafId = idMap.get(mapKey) || null;
      parentId = leafId;
    }
    if (leafId) pathToLeaf.set(row.category, leafId);
  }

  const updByNorm = db.prepare('UPDATE catalog_master SET category_id=?, category_name=? WHERE normalize_ean(canonical_ean) = normalize_ean(?)');
  const spRows = db.prepare(
    `SELECT ean, normalized_ean, category FROM supplier_products WHERE supplier_id=? AND category IS NOT NULL AND category!=''`
  ).all(abSupplier.supplier_id);

  let assignedAB = 0;
  for (const sp of spRows) {
    const leafId = pathToLeaf.get(sp.category);
    if (!leafId) continue;
    const cat = db.prepare('SELECT name FROM product_categories WHERE id=?').get(leafId);
    assignedAB += updByNorm.run(leafId, cat?.name || '', sp.normalized_ean || sp.ean).changes;
  }

  const leafCats = db.prepare(`
    SELECT pc.id, pc.name,
      COALESCE((SELECT p2.name FROM product_categories p2 WHERE p2.id=pc.parent_id),'') as parent_name
    FROM product_categories pc
    WHERE pc.is_ab_category=1
      AND NOT EXISTS (SELECT 1 FROM product_categories c2 WHERE c2.parent_id=pc.id)
  `).all();

  const leafTokens = leafCats.map(lc => ({
    id: lc.id,
    name: lc.name,
    tokens: [...tokenize(lc.name), ...tokenize(lc.parent_name)]
  }));

  function bestMatch(productName, manufacturer) {
    const pTokens = [...new Set([...tokenize(productName), ...tokenize(manufacturer || '')])];
    let best = null, bestScore = 0;
    for (const lc of leafTokens) {
      let score = 0;
      for (const pw of pTokens) {
        for (const cw of lc.tokens) {
          if (cw === pw) score += 3;
          else if (cw.length > 3 && pw.length > 3 && (cw.includes(pw) || pw.includes(cw))) score += 1;
        }
      }
      if (score > bestScore) { bestScore = score; best = lc; }
    }
    return bestScore >= 2 ? best : null;
  }

  const unassigned = db.prepare(`
    SELECT id, canonical_ean, name, manufacturer
    FROM catalog_master
    WHERE (category_id IS NULL OR category_id = 0) AND name IS NOT NULL AND name != ''
  `).all();

  const updOtherStmt = db.prepare('UPDATE catalog_master SET category_id=?,category_name=? WHERE id=?');
  let assignedOther = 0;
  for (const prod of unassigned) {
    const match = bestMatch(prod.name, prod.manufacturer);
    if (match) {
      updOtherStmt.run(match.id, match.name, prod.id);
      assignedOther++;
    }
  }

  db.prepare(`UPDATE product_categories SET product_count=(
    SELECT COUNT(*) FROM catalog_master WHERE category_id=product_categories.id
  )`).run();

  return {
    ok: true, created, assignedAB, assignedOther,
    message: `Zbudowano ${created} kategorii AB · ${assignedAB} produktów AB · ${assignedOther} bez kategorii (keyword matching)`
  };
}

module.exports = {
  CATEGORY_ATTR_MAP,
  normalizeEan,
  eanMatch,
  eanVariants,
  seedCategoryAttrSchema,
  syncCatalogAttributes: (db, opts = {}) => attrSync.syncCatalogAttributes(db, { attrMap: CATEGORY_ATTR_MAP, ...opts }),
  parseDimensions,
  rebuildCatalogForSupplier,
  rebuildEntireCatalog,
  getCatalogStats,
  searchCatalog,
  getCatalogManufacturers,
  getCatalogEanPrices,
  getCategories,
  searchCategories,
  getCategoryAttributes,
  toggleCategoryAttribute,
  generateAttributesForCategory,
  batchGenerateAttributes,
  getDuplicatesList,
  scanForDuplicates,
  resolveDuplicate,
  // Name normalization
  getNamingSchema,
  saveNamingSchema,
  approveNamingSchema,
  suggestNamingSchema,
  normalizeProductName,
  batchNormalizeNames,
  updateProductName,
  updateProductDetails,
  // Katalog Master Full
  getProductDetails,
  getProductAttributes,
  setProductAttribute,
  removeProductAttribute,
  getAllCategoryAttributes,
  getCategoryFilters,
  updateCategoryAttributeFilters,
  addCategoryAttribute,
  removeCategoryAttribute,
  updateCategoryAttribute,
  unifyProductAttributes,
  // AB Category Tree
  getCategoryTree,
  markSupplierAsAb,
  remapCategoryToAb,
  getSupplierList,
  getUnmappedCategories,
  generateAbCategoryTree,
  // Category normalization & AI assignment
  mergeAndNormalizeCategories,
  aiAssignUnmappedProducts,
};

