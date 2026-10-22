const Database = require('better-sqlite3');
const db = new Database('c:/Users/USER/.gemini/antigravity/scratch/shopgold-ai-dashboard/data/shopgold_cache.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS oferter_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    client_name TEXT, client_email TEXT, client_phone TEXT, client_company TEXT,
    notes_client TEXT, notes_internal TEXT, preferences TEXT, components TEXT,
    services TEXT, skipped_components TEXT, total_buy_price REAL DEFAULT 0,
    margin_value REAL DEFAULT 0, discount_value REAL DEFAULT 0, discount_pct REAL DEFAULT 0,
    status TEXT DEFAULT 'draft', parent_id INTEGER, variant_label TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS oferter_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    required_slots TEXT,
    default_services TEXT
  );
  
  CREATE TABLE IF NOT EXISTS oferter_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1
  );

  INSERT INTO oferter_services (name, price) SELECT 'Złożenie komputera z części', 150 WHERE NOT EXISTS (SELECT 1 FROM oferter_services WHERE name = 'Złożenie komputera z części');
  INSERT INTO oferter_services (name, price) SELECT 'Instalacja systemu Windows 11', 100 WHERE NOT EXISTS (SELECT 1 FROM oferter_services WHERE name = 'Instalacja systemu Windows 11');
  INSERT INTO oferter_services (name, price) SELECT 'Aktualizacja BIOS i konfiguracja', 50 WHERE NOT EXISTS (SELECT 1 FROM oferter_services WHERE name = 'Aktualizacja BIOS i konfiguracja');
  INSERT INTO oferter_services (name, price) SELECT 'Pakiet Microsoft Office - Instalacja', 50 WHERE NOT EXISTS (SELECT 1 FROM oferter_services WHERE name = 'Pakiet Microsoft Office - Instalacja');
  INSERT INTO oferter_services (name, price) SELECT 'Instalacja chłodzenia wodnego (AIO)', 100 WHERE NOT EXISTS (SELECT 1 FROM oferter_services WHERE name = 'Instalacja chłodzenia wodnego (AIO)');
`);

console.log('Tables initialized and services seeded.');
