const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../data/shopgold_cache.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      shop_id TEXT,
      store_key TEXT DEFAULT 'ideal_startwnecie',
      name TEXT,
      category TEXT,
      group_tag TEXT,
      ean TEXT,
      description TEXT,
      meta_title TEXT,
      meta_description TEXT,
      price REAL,
      attributes TEXT,
      images TEXT,
      raw_data TEXT,
      synced_at TEXT,
      ai_generated INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(shop_id, store_key)
    );

    CREATE TABLE IF NOT EXISTS approval_queue (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      shop_id TEXT,
      product_name TEXT,
      field_name TEXT,
      value_before TEXT,
      value_after TEXT,
      status TEXT DEFAULT 'pending',
      ai_provider TEXT,
      ai_model TEXT,
      prompt_preset TEXT,
      user_note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      product_ids TEXT,
      generated_content TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prompt_presets (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      system_prompt TEXT,
      user_prompt_template TEXT,
      fields TEXT,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shopgold_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      connection_type TEXT DEFAULT 'mysql',
      mysql_host TEXT,
      mysql_port TEXT DEFAULT '3306',
      mysql_user TEXT,
      mysql_pass TEXT,
      mysql_database TEXT,
      mysql_table_prefix TEXT DEFAULT 'sg_',
      ftp_host TEXT,
      ftp_port TEXT DEFAULT '21',
      ftp_user TEXT,
      ftp_pass TEXT,
      ftp_path TEXT DEFAULT '/public_html',
      shop_url TEXT,
      xml_feed_url TEXT,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id TEXT PRIMARY KEY,
      action TEXT,
      product_ids TEXT,
      result TEXT,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS brand_knowledge (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seo_keywords (
      id TEXT PRIMARY KEY,
      keyword TEXT NOT NULL,
      url TEXT,
      position INTEGER DEFAULT 0,
      position_prev INTEGER DEFAULT 0,
      volume INTEGER DEFAULT 0,
      last_checked TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seo_backlinks (
      id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL,
      target_url TEXT NOT NULL,
      anchor TEXT,
      cost REAL DEFAULT 0,
      type TEXT DEFAULT 'dofollow',
      status TEXT DEFAULT 'active',
      last_checked TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seo_audit_log (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      results_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      title TEXT,
      topic TEXT,
      keywords TEXT,
      html_content TEXT,
      thumbnail_url TEXT,
      thumbnail_path TEXT,
      seo_score INTEGER DEFAULT 0,
      word_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      source_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blog_topics (
      id TEXT PRIMARY KEY,
      source_url TEXT,
      topics TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      color TEXT DEFAULT '#6366f1',
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_knowledge (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      file_type TEXT DEFAULT 'text',
      file_size INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pim_qa (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      shop_id TEXT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      approved_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pim_product_categories (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      category_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(product_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS mailer_contacts (
      id TEXT PRIMARY KEY,
      shop_id TEXT UNIQUE,
      fn TEXT,
      ln TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      company TEXT,
      city TEXT,
      tags TEXT DEFAULT '[]',
      score INTEGER DEFAULT 0,
      last_activity TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mailer_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT,
      subject TEXT,
      from_name TEXT,
      reply_to TEXT,
      segment TEXT,
      status TEXT DEFAULT 'draft',
      sent INTEGER DEFAULT 0,
      opened INTEGER DEFAULT 0,
      clicked INTEGER DEFAULT 0,
      template_id TEXT,
      blocks_json TEXT,
      date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mailer_automations (
      id TEXT PRIMARY KEY,
      name TEXT,
      trigger_event TEXT,
      status TEXT DEFAULT 'draft',
      active_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      steps_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mailer_rules (
      id TEXT PRIMARY KEY,
      action TEXT,
      points INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      module TEXT DEFAULT 'general',
      is_read INTEGER DEFAULT 0,
      recipient_username TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  // Migration: add ean column to products
  try { db.exec('ALTER TABLE products ADD COLUMN ean TEXT'); } catch(_) {}

  // Seed default prompt preset if not exists
  const existing = db.prepare("SELECT id FROM prompt_presets WHERE name = 'Domyślny PIM'").get();
  if (!existing) {
    db.prepare(`
      INSERT INTO prompt_presets (id, name, system_prompt, user_prompt_template, fields, is_default)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(
      uuidv4(),
      'Domyślny PIM',
      `Jesteś ekspertem ds. copywritingu e-commerce i SEO dla polskich sklepów internetowych. 
Twoje opisy są angażujące, rzeczowe i zoptymalizowane pod kątem konwersji i SEO. 
Zawsze odpowiadasz w języku polskim. Zwracaj WYŁĄCZNIE czysty JSON bez żadnych dodatkowych komentarzy.`,
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
  "meta_title": "Meta Title (max 60 znaków, zawiera główne słowo kluczowe; pisany SENTENCE CASE: tylko pierwsze słowo i nazwy własne/marki z wielkiej litery, reszta małą — np. 'Torba na laptopa Wenger BC Pro 16\\' czarna – Niezawodna ochrona i perfekcyjna organizacja')",
  "meta_description": "Meta Description (max 155 znaków, zachęca do kliknięcia, zawiera CTA)",
  "attributes_suggestions": [
    {"action": "add", "name": "Nazwa parametru", "value": "Proponowana wartość"},
    {"action": "unify", "current": "obecna wartość", "suggested": "ujednolicona wartość", "reason": "powód"}
  ],
  "keywords": ["słowo kluczowe 1", "słowo kluczowe 2", "słowo kluczowe 3"]
}`,
      JSON.stringify(['description', 'meta_title', 'meta_description', 'attributes_suggestions'])
    );
  }

  // Seed SEO LD+JSON preset if not exists
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
}`,
      JSON.stringify(['meta_title', 'meta_description', 'ld_json_product', 'ld_json_faq'])
    );
  }

  // Migration: add columns if not exists (safe for existing DBs)
  try { db.exec('ALTER TABLE products ADD COLUMN group_tag TEXT'); } catch(_) {}
  try { db.exec('ALTER TABLE products ADD COLUMN ai_generated INTEGER DEFAULT 0'); } catch(_) {}
  try { db.exec('ALTER TABLE products ADD COLUMN store_key TEXT'); } catch(_) {}
  try { db.exec("UPDATE products SET store_key = 'ideal_startwnecie' WHERE store_key IS NULL OR store_key = 'default' OR store_key = ''"); } catch(_) {}
  try {
    const sqlDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'").get()?.sql || '';
    if (sqlDef.includes('shop_id TEXT UNIQUE') && !sqlDef.includes('UNIQUE(shop_id, store_key)')) {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec(`
        CREATE TABLE IF NOT EXISTS products_new (
          id TEXT PRIMARY KEY,
          shop_id TEXT,
          store_key TEXT DEFAULT 'ideal_startwnecie',
          name TEXT,
          category TEXT,
          group_tag TEXT,
          ean TEXT,
          description TEXT,
          meta_title TEXT,
          meta_description TEXT,
          price REAL,
          attributes TEXT,
          images TEXT,
          raw_data TEXT,
          synced_at TEXT,
          ai_generated INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(shop_id, store_key)
        );
        INSERT OR IGNORE INTO products_new (id, shop_id, store_key, name, category, group_tag, ean, description, meta_title, meta_description, price, attributes, images, raw_data, synced_at, ai_generated, created_at, updated_at)
        SELECT id, shop_id, COALESCE(store_key, 'ideal_startwnecie'), name, category, group_tag, ean, description, meta_title, meta_description, price, attributes, images, raw_data, synced_at, ai_generated, created_at, updated_at FROM products;
        DROP TABLE products;
        ALTER TABLE products_new RENAME TO products;
      `);
      db.exec('PRAGMA foreign_keys = ON;');
    }
  } catch(e) { console.error('Migration products_new error:', e); }

  // Migration: sync_log — add level column and backfill
  try { db.exec("ALTER TABLE sync_log ADD COLUMN level TEXT DEFAULT 'info'"); } catch(_) {}
  // Backfill level for old entries
  try { db.exec("UPDATE sync_log SET level = 'error' WHERE error IS NOT NULL AND error != '' AND (level IS NULL OR level = 'info')"); } catch(_) {}
  try { db.exec("UPDATE sync_log SET level = 'success' WHERE (error IS NULL OR error = '') AND action IS NOT NULL AND (level IS NULL OR level = 'info')"); } catch(_) {}
  // Clean up garbage entries (all NULLs from previous buggy inserts)
  try { db.exec("DELETE FROM sync_log WHERE action IS NULL AND result IS NULL AND error IS NULL"); } catch(_) {}

  // Migration: blog_posts new columns for BLOGER module
  try { db.exec("ALTER TABLE blog_posts ADD COLUMN slug TEXT"); } catch(_) {}
  try { db.exec("ALTER TABLE blog_posts ADD COLUMN focus_keyword TEXT"); } catch(_) {}
  try { db.exec("ALTER TABLE blog_posts ADD COLUMN meta_title TEXT"); } catch(_) {}
  try { db.exec("ALTER TABLE blog_posts ADD COLUMN meta_description TEXT"); } catch(_) {}
  try { db.exec("ALTER TABLE blog_posts ADD COLUMN product_ids TEXT DEFAULT '[]'"); } catch(_) {}
  try { db.exec("ALTER TABLE blog_posts ADD COLUMN store_url TEXT"); } catch(_) {}
  try { db.exec("ALTER TABLE blog_posts ADD COLUMN ai_model TEXT"); } catch(_) {}
  try { db.exec("ALTER TABLE blog_posts ADD COLUMN category TEXT"); } catch(_) {}

  // User settings table for per-user preferences
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, key)
    );

    CREATE TABLE IF NOT EXISTS pim_categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed existing categories from products if pim_categories is empty
  try {
    const catCount = db.prepare('SELECT COUNT(*) as cnt FROM pim_categories').get().cnt;
    if (catCount === 0) {
      const existingCats = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != \'\'').all();
      const insCat = db.prepare('INSERT OR IGNORE INTO pim_categories (id, name) VALUES (?, ?)');
      existingCats.forEach(c => {
        try { insCat.run(uuidv4(), c.category); } catch(e) {}
      });
    }
  } catch (e) {
    console.error('Migration error for pim_categories:', e.message);
  }
}

// Helper to determine active store key
function getActiveStoreKey(dbObj) {
  const db = dbObj || getDb();
  try {
    const activeInst = db.prepare('SELECT id, mysql_database, xml_feed_url FROM shopgold_instances WHERE is_active = 1').get();
    if (activeInst) {
      if (activeInst.mysql_database && activeInst.mysql_database.trim()) return activeInst.mysql_database.trim();
      if (activeInst.xml_feed_url && activeInst.xml_feed_url.trim()) return activeInst.xml_feed_url.trim();
      return `instance_${activeInst.id}`;
    }
    const dbSetting = db.prepare("SELECT value FROM settings WHERE key = 'mysql_database'").get();
    if (dbSetting && dbSetting.value && dbSetting.value.trim()) return dbSetting.value.trim();
    const xmlSetting = db.prepare("SELECT value FROM settings WHERE key = 'xml_feed_url'").get();
    if (xmlSetting && xmlSetting.value && xmlSetting.value.trim()) return xmlSetting.value.trim();
  } catch(e) {}
  return 'ideal_startwnecie';
}

// Product CRUD
const productOps = {
  upsert(product) {
    const db = getDb();
    const storeKey = product.store_key || getActiveStoreKey(db);
    const existing = db.prepare('SELECT id FROM products WHERE shop_id = ? AND store_key = ?').get(product.shop_id, storeKey);
    if (existing) {
      db.prepare(`
        UPDATE products SET store_key=?, name=?, category=?, group_tag=?, ean=?, description=?, meta_title=?, meta_description=?,
        price=?, attributes=?, images=?, raw_data=?, updated_at=datetime('now') WHERE id=?
      `).run(
        storeKey, product.name, product.category, product.group_tag || '', product.ean || '',
        product.description,
        product.meta_title, product.meta_description, product.price,
        JSON.stringify(product.attributes || {}),
        JSON.stringify(product.images || []),
        JSON.stringify(product.raw_data || {}),
        existing.id
      );
      return existing.id;
    } else {
      const id = product.id || uuidv4();
      db.prepare(`
        INSERT INTO products (id, shop_id, store_key, name, category, group_tag, ean, description, meta_title, meta_description,
        price, attributes, images, raw_data, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        id, product.shop_id, storeKey, product.name, product.category, product.group_tag || '',
        product.ean || '', product.description,
        product.meta_title, product.meta_description, product.price,
        JSON.stringify(product.attributes || {}),
        JSON.stringify(product.images || []),
        JSON.stringify(product.raw_data || {})
      );
      return id;
    }
  },

  create(product) {
    const db = getDb();
    const id = uuidv4();
    const storeKey = product.store_key || getActiveStoreKey(db);
    const shopId = product.shop_id || `manual-${id.substring(0, 8)}`;
    db.prepare(`
      INSERT INTO products (id, shop_id, store_key, name, category, group_tag, description, meta_title, meta_description,
      price, attributes, images, raw_data, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id, shopId, storeKey, product.name || 'Nowy produkt', product.category || '',
      product.group_tag || '', product.description || '', product.meta_title || '',
      product.meta_description || '', product.price || null,
      JSON.stringify(product.attributes || {}),
      JSON.stringify(product.images || []),
      JSON.stringify(product.raw_data || {})
    );
    return id;
  },

  update(id, fields) {
    const db = getDb();
    const allowed = ['name', 'category', 'group_tag', 'description', 'meta_title', 'meta_description', 'price', 'attributes', 'ai_generated'];
    const setClauses = [];
    const params = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(key === 'attributes' ? JSON.stringify(fields[key]) : fields[key]);
      }
    }
    if (!setClauses.length) return;
    setClauses.push(`updated_at = datetime('now')`);
    params.push(id);
    db.prepare(`UPDATE products SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
  },

  delete(id) {
    const db = getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM pim_qa WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM pim_product_categories WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM approval_queue WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    })();
  },

  duplicate(id) {
    const db = getDb();
    const original = this.findById(id);
    if (!original) throw new Error('Produkt do sklonowania nie istnieje');
    const newId = uuidv4();
    const newShopId = `manual-${newId.substring(0, 8)}`;
    const storeKey = original.store_key || getActiveStoreKey(db);
    
    db.transaction(() => {
      db.prepare(`
        INSERT INTO products (id, shop_id, store_key, name, category, group_tag, description, meta_title, meta_description,
        price, attributes, images, raw_data, synced_at, ai_generated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        newId,
        newShopId,
        storeKey,
        original.name + ' (Kopia)',
        original.category || '',
        original.group_tag || '',
        original.description || '',
        original.meta_title || '',
        original.meta_description || '',
        original.price || null,
        JSON.stringify(original.attributes || {}),
        JSON.stringify(original.images || []),
        JSON.stringify(original.raw_data || {}),
        original.ai_generated || 0
      );

      // Clone Q&As if any
      const qas = db.prepare('SELECT question, answer FROM pim_qa WHERE product_id = ?').all(id);
      if (qas.length > 0) {
        const insQa = db.prepare('INSERT INTO pim_qa (id, product_id, shop_id, question, answer, status) VALUES (?, ?, ?, ?, ?, ?)');
        qas.forEach(qa => {
          insQa.run(uuidv4(), newId, newShopId, qa.question, qa.answer, 'draft');
        });
      }

      // Clone multi-categories if any
      const cats = db.prepare('SELECT category_id, category_name FROM pim_product_categories WHERE product_id = ?').all(id);
      if (cats.length > 0) {
        const insCat = db.prepare('INSERT INTO pim_product_categories (id, product_id, category_id, category_name) VALUES (?, ?, ?, ?)');
        cats.forEach(c => {
          insCat.run(uuidv4(), newId, c.category_id, c.category_name);
        });
      }
    })();

    return newId;
  },

  findAll({ search = '', category = '', group_tag = '', ids = null, limit = 50, offset = 0, sort = '', order = 'asc' } = {}) {
    const db = getDb();
    const storeKey = getActiveStoreKey(db);
    let query = 'SELECT * FROM products WHERE store_key = ?';
    const params = [storeKey];
    if (search) { query += ' AND (name LIKE ? OR description LIKE ? OR ean LIKE ? OR shop_id LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    if (group_tag) { query += ' AND group_tag = ?'; params.push(group_tag); }
    if (ids && ids.length) { query += ` AND id IN (${ids.map(() => '?').join(',')})` ; params.push(...ids); }
    const ALLOWED_SORTS = { name: 'name', category: 'category', price: 'price', ean: 'ean', group_tag: 'group_tag', updated_at: 'updated_at', ai_generated: 'ai_generated' };
    const sortCol = ALLOWED_SORTS[sort] || 'updated_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const rows = db.prepare(query).all(...params);
    return rows.map(parseProduct);
  },

  findById(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return row ? parseProduct(row) : null;
  },

  findByIds(ids) {
    if (!ids || !ids.length) return [];
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
    return rows.map(parseProduct);
  },

  count({ search = '', category = '', group_tag = '' } = {}) {
    const db = getDb();
    const storeKey = getActiveStoreKey(db);
    let query = 'SELECT COUNT(*) as cnt FROM products WHERE store_key = ?';
    const params = [storeKey];
    if (search) { query += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (category) { query += ' AND category = ?'; params.push(category); }
    if (group_tag) { query += ' AND group_tag = ?'; params.push(group_tag); }
    return db.prepare(query).get(...params).cnt;
  },

  categories() {
    const db = getDb();
    const storeKey = getActiveStoreKey(db);
    // Return all categories from the new pim_categories table, plus any categories that products might have that aren't in the table yet (fallback)
    const tableCats = db.prepare('SELECT name FROM pim_categories ORDER BY name ASC').all().map(r => r.name);
    const prodCats = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != \'\' AND store_key = ? ORDER BY category').all(storeKey).map(r => r.category);
    return [...new Set([...tableCats, ...prodCats])].sort((a,b) => a.localeCompare(b));
  },

  deleteProductsByCategories(categories) {
    if (!categories || !categories.length) return;
    const db = getDb();
    const storeKey = getActiveStoreKey(db);
    const placeholders = categories.map(() => '?').join(',');
    db.prepare(`DELETE FROM products WHERE category IN (${placeholders}) AND store_key = ?`).run(...categories, storeKey);
  },

  moveProductsCategories(categories, targetCategory) {
    if (!categories || !categories.length || typeof targetCategory !== 'string') return;
    const db = getDb();
    const storeKey = getActiveStoreKey(db);
    const placeholders = categories.map(() => '?').join(',');
    db.prepare(`UPDATE products SET category = ? WHERE category IN (${placeholders}) AND store_key = ?`).run(targetCategory, ...categories, storeKey);
  },

  groups() {
    const db = getDb();
    const storeKey = getActiveStoreKey(db);
    return db.prepare("SELECT DISTINCT group_tag FROM products WHERE group_tag IS NOT NULL AND group_tag != '' AND store_key = ? ORDER BY group_tag").all(storeKey).map(r => r.group_tag);
  },
};

// Approval Queue CRUD
const approvalOps = {
  add(items) {
    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO approval_queue (id, product_id, shop_id, product_name, field_name, value_before, value_after, ai_provider, ai_model, prompt_preset)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insert.run(uuidv4(), item.product_id, item.shop_id, item.product_name, item.field_name,
          item.value_before, item.value_after, item.ai_provider, item.ai_model, item.prompt_preset);
      }
    });
    insertMany(items);
  },

  findAll({ status = '', product_id = '', limit = 100, offset = 0 } = {}) {
    const db = getDb();
    let query = 'SELECT * FROM approval_queue WHERE 1=1';
    const params = [];
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (product_id) { query += ' AND product_id = ?'; params.push(product_id); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return db.prepare(query).all(...params);
  },

  updateStatus(id, status, userNote = null, editedValue = null) {
    const db = getDb();
    if (editedValue !== null) {
      db.prepare(`UPDATE approval_queue SET status=?, user_note=?, value_after=?, updated_at=datetime('now') WHERE id=?`).run(status, userNote, editedValue, id);
    } else {
      db.prepare(`UPDATE approval_queue SET status=?, user_note=?, updated_at=datetime('now') WHERE id=?`).run(status, userNote, id);
    }
  },

  bulkUpdateStatus(ids, status) {
    const db = getDb();
    const update = db.prepare(`UPDATE approval_queue SET status=?, updated_at=datetime('now') WHERE id=?`);
    const updateMany = db.transaction((ids) => { for (const id of ids) update.run(status, id); });
    updateMany(ids);
  },

  stats() {
    const db = getDb();
    return db.prepare(`
      SELECT status, COUNT(*) as count FROM approval_queue GROUP BY status
    `).all();
  },
};

// Campaigns CRUD
const campaignOps = {
  create({ name, type, product_ids, generated_content }) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`INSERT INTO campaigns (id, name, type, product_ids, generated_content) VALUES (?, ?, ?, ?, ?)`
    ).run(id, name, type, JSON.stringify(product_ids), JSON.stringify(generated_content));
    return id;
  },

  findAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all().map(r => ({
      ...r,
      product_ids: JSON.parse(r.product_ids || '[]'),
      generated_content: JSON.parse(r.generated_content || '{}'),
    }));
  },

  findById(id) {
    const db = getDb();
    const r = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (!r) return null;
    return { ...r, product_ids: JSON.parse(r.product_ids || '[]'), generated_content: JSON.parse(r.generated_content || '{}') };
  },

  delete(id) {
    const db = getDb();
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
  },
};

// Prompt Presets
const presetOps = {
  findAll() { return getDb().prepare('SELECT * FROM prompt_presets ORDER BY is_default DESC, name').all(); },
  findById(id) { return getDb().prepare('SELECT * FROM prompt_presets WHERE id = ?').get(id); },
  upsert({ id, name, system_prompt, user_prompt_template, fields }) {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM prompt_presets WHERE id = ?').get(id);
    if (existing) {
      db.prepare('UPDATE prompt_presets SET name=?, system_prompt=?, user_prompt_template=?, fields=? WHERE id=?')
        .run(name, system_prompt, user_prompt_template, JSON.stringify(fields), id);
    } else {
      const newId = id || uuidv4();
      db.prepare('INSERT INTO prompt_presets (id, name, system_prompt, user_prompt_template, fields) VALUES (?, ?, ?, ?, ?)')
        .run(newId, name, system_prompt, user_prompt_template, JSON.stringify(fields));
    }
  },
  delete(id) { getDb().prepare('DELETE FROM prompt_presets WHERE id = ?').run(id); },
  setDefault(id) {
    const db = getDb();
    db.prepare('UPDATE prompt_presets SET is_default = 0').run();
    db.prepare('UPDATE prompt_presets SET is_default = 1 WHERE id = ?').run(id);
  },
};

// Settings
const settingsOps = {
  get(key) {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return row.value; }
  },
  set(key, value) {
    getDb().prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  },
  getAll() {
    return getDb().prepare('SELECT key, value FROM settings').all().reduce((acc, r) => {
      try { acc[r.key] = JSON.parse(r.value); } catch { acc[r.key] = r.value; }
      return acc;
    }, {});
  },
};

// Sync Log
const syncLogOps = {
  add({ action, module, product_ids, result, error, status, details, level }) {
    const db = getDb();
    // Map flexible field names: callers may use {module, status, details} or {action, result, error}
    const finalAction = action || module || 'unknown';
    const finalResult = result ? (typeof result === 'object' ? JSON.stringify(result) : String(result)) : (details || null);
    const finalError = error || null;
    const finalLevel = level || status || (error ? 'error' : 'success');
    const finalProductIds = product_ids ? JSON.stringify(product_ids) : null;
    db.prepare('INSERT INTO sync_log (id, action, product_ids, result, error, level) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), finalAction, finalProductIds, finalResult, finalError, finalLevel);
  },
  findRecent(limit = 20) {
    return getDb().prepare('SELECT * FROM sync_log ORDER BY created_at DESC LIMIT ?').all(limit);
  },
  findFiltered({ level, action, limit = 100, offset = 0 } = {}) {
    const db = getDb();
    let query = 'SELECT * FROM sync_log WHERE action IS NOT NULL';
    const params = [];
    if (level) { query += ' AND level = ?'; params.push(level); }
    if (action) { query += ' AND action LIKE ?'; params.push(`%${action}%`); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    return db.prepare(query).all(...params);
  },
  count({ level } = {}) {
    const db = getDb();
    let query = 'SELECT COUNT(*) as cnt FROM sync_log WHERE action IS NOT NULL';
    const params = [];
    if (level) { query += ' AND level = ?'; params.push(level); }
    return db.prepare(query).get(...params).cnt;
  },
  cleanup() {
    // Remove garbage entries where action is NULL (from old buggy inserts)
    const db = getDb();
    const info = db.prepare('DELETE FROM sync_log WHERE action IS NULL AND result IS NULL AND error IS NULL').run();
    return info.changes;
  },
};

// Brand Knowledge Base
const brandKbOps = {
  get(key) {
    const row = getDb().prepare('SELECT value FROM brand_knowledge WHERE key = ?').get(key);
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return row.value; }
  },
  set(key, value) {
    getDb().prepare(`INSERT INTO brand_knowledge (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  },
  getAll() {
    return getDb().prepare('SELECT key, value FROM brand_knowledge').all().reduce((acc, r) => {
      try { acc[r.key] = JSON.parse(r.value); } catch { acc[r.key] = r.value; }
      return acc;
    }, {});
  },
  buildPromptBlock() {
    const all = this.getAll();
    if (!all || Object.keys(all).length === 0) return '';
    const lines = [];
    if (all.brand_name)      lines.push(`Marka: ${all.brand_name}`);
    if (all.tone_of_voice)   lines.push(`Ton komunikacji (Tone of Voice): ${all.tone_of_voice}`);
    if (all.target_audience) lines.push(`Grupa docelowa: ${all.target_audience}`);
    if (all.brand_values)    lines.push(`Kluczowe wartości marki: ${all.brand_values}`);
    if (all.excluded_words)  lines.push(`Słowa i zwroty ABSOLUTNIE WYKLUCZONE (nie używaj ich nigdy): ${all.excluded_words}`);
    if (all.extra_context)   lines.push(`Dodatkowy kontekst: ${all.extra_context}`);
    return lines.length > 0 ? lines.join('\n') : '';
  },
};

// SEO Keywords Tracker
const seoKeywordOps = {
  findAll() { return getDb().prepare('SELECT * FROM seo_keywords ORDER BY created_at DESC').all(); },
  add({ keyword, url, position = 0, volume = 0 }) {
    const id = uuidv4();
    getDb().prepare('INSERT INTO seo_keywords (id, keyword, url, position, position_prev, volume) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, keyword, url || '', position, position, volume);
    return id;
  },
  update(id, { position, volume }) {
    const row = getDb().prepare('SELECT position FROM seo_keywords WHERE id = ?').get(id);
    const prev = row ? row.position : 0;
    getDb().prepare(`UPDATE seo_keywords SET position=?, position_prev=?, volume=?, last_checked=datetime('now') WHERE id=?`)
      .run(position, prev, volume, id);
  },
  delete(id) { getDb().prepare('DELETE FROM seo_keywords WHERE id = ?').run(id); },
};

// SEO Backlink Tracker
const backlinkOps = {
  findAll() { return getDb().prepare('SELECT * FROM seo_backlinks ORDER BY created_at DESC').all(); },
  add({ source_url, target_url, anchor, cost = 0, type = 'dofollow' }) {
    const id = uuidv4();
    getDb().prepare('INSERT INTO seo_backlinks (id, source_url, target_url, anchor, cost, type) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, source_url, target_url, anchor || '', cost, type);
    return id;
  },
  updateStatus(id, status) {
    getDb().prepare(`UPDATE seo_backlinks SET status=?, last_checked=datetime('now') WHERE id=?`).run(status, id);
  },
  delete(id) { getDb().prepare('DELETE FROM seo_backlinks WHERE id = ?').run(id); },
};

// SEO Audit Log
const auditLogOps = {
  add({ url, score, results }) {
    getDb().prepare('INSERT INTO seo_audit_log (id, url, score, results_json) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), url, score, JSON.stringify(results));
  },
  findRecent(limit = 10) {
    return getDb().prepare('SELECT * FROM seo_audit_log ORDER BY created_at DESC LIMIT ?').all(limit)
      .map(r => ({ ...r, results: tryParse(r.results_json, {}) }));
  },
};

function parseProduct(row) {
  return {
    ...row,
    attributes: tryParse(row.attributes, {}),
    images: tryParse(row.images, []),
    raw_data: tryParse(row.raw_data, {}),
  };
}

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// Per-user settings
const userSettingsOps = {
  get(userId, key) {
    const row = getDb().prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?').get(userId, key);
    return row ? row.value : null;
  },
  set(userId, key, value) {
    getDb().prepare(`
      INSERT INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(userId, key, typeof value === 'string' ? value : JSON.stringify(value));
  },
  getAll(userId) {
    const rows = getDb().prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(userId);
    const result = {};
    for (const r of rows) { result[r.key] = r.value; }
    return result;
  },
  delete(userId, key) {
    getDb().prepare('DELETE FROM user_settings WHERE user_id = ? AND key = ?').run(userId, key);
  },
};

// Chat notes operations
const notesOps = {
  findAll(userId) {
    return getDb().prepare('SELECT * FROM chat_notes WHERE user_id = ? ORDER BY pinned DESC, updated_at DESC').all(userId);
  },
  get(id) {
    return getDb().prepare('SELECT * FROM chat_notes WHERE id = ?').get(id);
  },
  create(userId, title, content, color) {
    const id = uuidv4();
    getDb().prepare(`INSERT INTO chat_notes (id, user_id, title, content, color) VALUES (?, ?, ?, ?, ?)`).run(id, userId, title || '', content || '', color || '#6366f1');
    return id;
  },
  update(id, data) {
    const sets = [];
    const vals = [];
    if (data.title !== undefined) { sets.push('title = ?'); vals.push(data.title); }
    if (data.content !== undefined) { sets.push('content = ?'); vals.push(data.content); }
    if (data.color !== undefined) { sets.push('color = ?'); vals.push(data.color); }
    if (data.pinned !== undefined) { sets.push('pinned = ?'); vals.push(data.pinned ? 1 : 0); }
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    getDb().prepare(`UPDATE chat_notes SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  },
  delete(id) {
    getDb().prepare('DELETE FROM chat_notes WHERE id = ?').run(id);
  },
};

// Chat knowledge base operations
const knowledgeOps = {
  findAll(userId) {
    return getDb().prepare('SELECT id, user_id, title, file_type, file_size, tags, created_at, updated_at FROM chat_knowledge WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  },
  get(id) {
    return getDb().prepare('SELECT * FROM chat_knowledge WHERE id = ?').get(id);
  },
  create(userId, title, content, fileType, fileSize, tags) {
    const id = uuidv4();
    getDb().prepare(`INSERT INTO chat_knowledge (id, user_id, title, content, file_type, file_size, tags) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, userId, title, content, fileType || 'text', fileSize || 0, JSON.stringify(tags || []));
    return id;
  },
  update(id, data) {
    const sets = [];
    const vals = [];
    if (data.title !== undefined) { sets.push('title = ?'); vals.push(data.title); }
    if (data.content !== undefined) { sets.push('content = ?'); vals.push(data.content); }
    if (data.tags !== undefined) { sets.push('tags = ?'); vals.push(JSON.stringify(data.tags)); }
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    getDb().prepare(`UPDATE chat_knowledge SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  },
  delete(id) {
    getDb().prepare('DELETE FROM chat_knowledge WHERE id = ?').run(id);
  },
  search(userId, query) {
    return getDb().prepare(`SELECT id, title, file_type, file_size, tags, created_at FROM chat_knowledge WHERE user_id = ? AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC`).all(userId, `%${query}%`, `%${query}%`);
  },
};

// Blog Posts CRUD (BLOGER module)
const blogPostOps = {
  create(data) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO blog_posts (id, title, slug, focus_keyword, meta_title, meta_description, product_ids, category, store_url, source_url, html_content, seo_score, word_count, ai_model, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title || 'Nowy artykuł',
      data.slug || '',
      data.focus_keyword || '',
      data.meta_title || '',
      data.meta_description || '',
      JSON.stringify(data.product_ids || []),
      data.category || '',
      data.store_url || '',
      data.source_url || '',
      data.html_content || '',
      data.seo_score || 0,
      data.word_count || 0,
      data.ai_model || '',
      data.status || 'draft'
    );
    return id;
  },

  update(id, fields) {
    const db = getDb();
    const allowed = ['title', 'slug', 'focus_keyword', 'meta_title', 'meta_description', 'product_ids', 'category', 'store_url', 'source_url', 'html_content', 'seo_score', 'word_count', 'ai_model', 'status'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(key === 'product_ids' ? JSON.stringify(fields[key]) : fields[key]);
      }
    }
    if (!sets.length) return;
    sets.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE blog_posts SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  },

  findAll({ status = '', search = '', limit = 50, offset = 0 } = {}) {
    const db = getDb();
    let q = 'SELECT * FROM blog_posts WHERE 1=1';
    const p = [];
    if (status) { q += ' AND status = ?'; p.push(status); }
    if (search) { q += ' AND (title LIKE ? OR focus_keyword LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    q += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    p.push(limit, offset);
    return db.prepare(q).all(...p).map(r => ({ ...r, product_ids: tryParse(r.product_ids, []) }));
  },

  findById(id) {
    const db = getDb();
    const r = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id);
    if (!r) return null;
    return { ...r, product_ids: tryParse(r.product_ids, []) };
  },

  count({ status = '', search = '' } = {}) {
    const db = getDb();
    let q = 'SELECT COUNT(*) as cnt FROM blog_posts WHERE 1=1';
    const p = [];
    if (status) { q += ' AND status = ?'; p.push(status); }
    if (search) { q += ' AND (title LIKE ? OR focus_keyword LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
    return db.prepare(q).get(...p).cnt;
  },

  delete(id) {
    getDb().prepare('DELETE FROM blog_posts WHERE id = ?').run(id);
  },
};

// PIM Q&A operations
const qaOps = {
  findByProduct(productId) {
    return getDb().prepare('SELECT * FROM pim_qa WHERE product_id = ? ORDER BY created_at ASC').all(productId);
  },
  addMany(productId, shopId, pairs) {
    const db = getDb();
    const ins = db.prepare('INSERT INTO pim_qa (id, product_id, shop_id, question, answer) VALUES (?, ?, ?, ?, ?)');
    db.transaction(() => { pairs.forEach(p => ins.run(uuidv4(), productId, shopId, p.question, p.answer)); })();
  },
  updateStatus(id, status) {
    const db = getDb();
    const approvedAt = status === 'approved' ? `datetime('now')` : 'NULL';
    db.prepare(`UPDATE pim_qa SET status = ?, approved_at = ${approvedAt}, updated_at = datetime('now') WHERE id = ?`).run(status, id);
  },
  delete(id) { getDb().prepare('DELETE FROM pim_qa WHERE id = ?').run(id); },
  deleteByProduct(productId) { getDb().prepare('DELETE FROM pim_qa WHERE product_id = ?').run(productId); },
};

// PIM Multi-Category operations
const productCategoryOps = {
  findByProduct(productId) {
    return getDb().prepare('SELECT * FROM pim_product_categories WHERE product_id = ? ORDER BY category_name').all(productId);
  },
  set(productId, categories) {
    // categories = [{ category_id, category_name }]
    const db = getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM pim_product_categories WHERE product_id = ?').run(productId);
      const ins = db.prepare('INSERT OR IGNORE INTO pim_product_categories (id, product_id, category_id, category_name) VALUES (?, ?, ?, ?)');
      categories.forEach(c => ins.run(uuidv4(), productId, c.category_id, c.category_name || ''));
    })();
  },
  delete(productId, categoryId) {
    getDb().prepare('DELETE FROM pim_product_categories WHERE product_id = ? AND category_id = ?').run(productId, categoryId);
  },
};

// Mailer Contacts
const mailerContactsOps = {
  findAll({ search = '', limit = 1000, offset = 0 } = {}) {
    let q = 'SELECT * FROM mailer_contacts WHERE 1=1';
    const p = [];
    if (search) {
      q += ' AND (fn LIKE ? OR ln LIKE ? OR email LIKE ? OR company LIKE ?)';
      p.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    q += ' ORDER BY score DESC, updated_at DESC LIMIT ? OFFSET ?';
    p.push(limit, offset);
    return getDb().prepare(q).all(...p).map(r => ({ ...r, tags: tryParse(r.tags, []) }));
  },
  upsert(contact) {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM mailer_contacts WHERE email = ?').get(contact.email);
    if (existing) {
      db.prepare(`UPDATE mailer_contacts SET shop_id=?, fn=?, ln=?, phone=?, company=?, city=?, tags=?, score=?, last_activity=?, updated_at=datetime('now') WHERE id=?`)
        .run(contact.shop_id || null, contact.fn, contact.ln, contact.phone, contact.company, contact.city, JSON.stringify(contact.tags || []), contact.score || 0, contact.last_activity, existing.id);
      return existing.id;
    } else {
      const id = uuidv4();
      db.prepare(`INSERT INTO mailer_contacts (id, shop_id, fn, ln, email, phone, company, city, tags, score, last_activity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, contact.shop_id || null, contact.fn, contact.ln, contact.email, contact.phone, contact.company, contact.city, JSON.stringify(contact.tags || []), contact.score || 0, contact.last_activity);
      return id;
    }
  },
  delete(id) { getDb().prepare('DELETE FROM mailer_contacts WHERE id = ?').run(id); },
};

// Mailer Campaigns
const mailerCampaignsOps = {
  findAll() {
    return getDb().prepare('SELECT * FROM mailer_campaigns ORDER BY updated_at DESC').all().map(r => ({
      ...r, blocks_json: tryParse(r.blocks_json, [])
    }));
  },
  create(data) {
    const id = uuidv4();
    getDb().prepare(`INSERT INTO mailer_campaigns (id, name, subject, from_name, reply_to, segment, status, date, blocks_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.name, data.subject, data.from_name, data.reply_to, data.segment, data.status || 'draft', data.date || new Date().toISOString().split('T')[0], JSON.stringify(data.blocks_json || []));
    return id;
  },
  update(id, data) {
    const sets = [];
    const vals = [];
    const allowed = ['name', 'subject', 'from_name', 'reply_to', 'segment', 'status', 'date', 'blocks_json'];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(key === 'blocks_json' ? JSON.stringify(data[key]) : data[key]);
      }
    }
    if (!sets.length) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    getDb().prepare(`UPDATE mailer_campaigns SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  },
  delete(id) { getDb().prepare('DELETE FROM mailer_campaigns WHERE id = ?').run(id); },
};

// Mailer Automations
const mailerAutomationsOps = {
  findAll() {
    return getDb().prepare('SELECT * FROM mailer_automations ORDER BY updated_at DESC').all().map(r => ({
      ...r, steps_json: tryParse(r.steps_json, [])
    }));
  },
  create(data) {
    const id = uuidv4();
    getDb().prepare(`INSERT INTO mailer_automations (id, name, trigger_event, status, steps_json) VALUES (?, ?, ?, ?, ?)`)
      .run(id, data.name, data.trigger_event, data.status || 'draft', JSON.stringify(data.steps_json || []));
    return id;
  },
  update(id, data) {
    const sets = [];
    const vals = [];
    if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name); }
    if (data.trigger_event !== undefined) { sets.push('trigger_event = ?'); vals.push(data.trigger_event); }
    if (data.status !== undefined) { sets.push('status = ?'); vals.push(data.status); }
    if (data.steps_json !== undefined) { sets.push('steps_json = ?'); vals.push(JSON.stringify(data.steps_json)); }
    if (!sets.length) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    getDb().prepare(`UPDATE mailer_automations SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  },
  delete(id) { getDb().prepare('DELETE FROM mailer_automations WHERE id = ?').run(id); },
};

// Mailer Rules
const mailerRulesOps = {
  findAll() { return getDb().prepare('SELECT * FROM mailer_rules ORDER BY points DESC').all(); },
  upsert({ id, action, points }) {
    if (id) {
      getDb().prepare('UPDATE mailer_rules SET action = ?, points = ? WHERE id = ?').run(action, points, id);
    } else {
      getDb().prepare('INSERT INTO mailer_rules (id, action, points) VALUES (?, ?, ?)').run(uuidv4(), action, points);
    }
  },
  delete(id) { getDb().prepare('DELETE FROM mailer_rules WHERE id = ?').run(id); }
};

// PIM Categories
const pimCategoryOps = {
  findAll() {
    return getDb().prepare('SELECT * FROM pim_categories ORDER BY name ASC').all();
  },
  add(name) {
    const db = getDb();
    try {
      const id = uuidv4();
      db.prepare('INSERT INTO pim_categories (id, name) VALUES (?, ?)').run(id, name.trim());
      return { success: true, id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
  delete(names) {
    if (!names || !names.length) return;
    const db = getDb();
    const placeholders = names.map(() => '?').join(',');
    db.prepare(`DELETE FROM pim_categories WHERE name IN (${placeholders})`).run(...names);
  }
};

// Notifications
const notificationOps = {
  findAll(recipientUsername = null, module = null) {
    const db = getDb();
    let query = "SELECT * FROM notifications";
    const conds = [];
    const params = [];
    if (recipientUsername) {
      conds.push("(recipient_username = ? OR recipient_username IS NULL OR recipient_username = '')");
      params.push(recipientUsername);
    }
    if (module) {
      conds.push("module = ?");
      params.push(module);
    }
    if (conds.length) {
      query += " WHERE " + conds.join(" AND ");
    }
    query += " ORDER BY created_at DESC";
    return db.prepare(query).all(...params);
  },
  add({ title, message, type = 'info', module = 'general', recipient_username = null }) {
    const db = getDb();
    const id = uuidv4();
    db.prepare('INSERT INTO notifications (id, title, message, type, module, recipient_username) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, title, message, type, module, recipient_username);
    return { id };
  },
  markRead(id) {
    getDb().prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    return { success: true };
  },
  markAllRead(recipientUsername = null) {
    const db = getDb();
    if (recipientUsername) {
      db.prepare("UPDATE notifications SET is_read = 1 WHERE recipient_username = ? OR recipient_username IS NULL OR recipient_username = ''").run(recipientUsername);
    } else {
      db.prepare('UPDATE notifications SET is_read = 1').run();
    }
    return { success: true };
  },
  delete(id) {
    getDb().prepare('DELETE FROM notifications WHERE id = ?').run(id);
    return { success: true };
  },
  deleteAll(recipientUsername = null) {
    const db = getDb();
    if (recipientUsername) {
      db.prepare("DELETE FROM notifications WHERE recipient_username = ? OR recipient_username IS NULL OR recipient_username = ''").run(recipientUsername);
    } else {
      db.prepare('DELETE FROM notifications').run();
    }
    return { success: true };
  },
  getUnreadCount(recipientUsername = null, module = null) {
    const db = getDb();
    let query = "SELECT COUNT(*) as c FROM notifications WHERE is_read = 0";
    const conds = [];
    const params = [];
    if (recipientUsername) {
      conds.push("(recipient_username = ? OR recipient_username IS NULL OR recipient_username = '')");
      params.push(recipientUsername);
    }
    if (module) {
      conds.push("module = ?");
      params.push(module);
    }
    if (conds.length) {
      query += " AND " + conds.join(" AND ");
    }
    return db.prepare(query).get(...params).c;
  }
};

module.exports = { getDb, productOps, approvalOps, campaignOps, presetOps, settingsOps, syncLogOps, brandKbOps, seoKeywordOps, backlinkOps, auditLogOps, userSettingsOps, notesOps, knowledgeOps, blogPostOps, qaOps, productCategoryOps, mailerContactsOps, mailerCampaignsOps, mailerAutomationsOps, mailerRulesOps, pimCategoryOps, notificationOps };

// ShopGold Named Instances operations
const shopgoldInstanceOps = {
  findAll() {
    return getDb().prepare('SELECT * FROM shopgold_instances ORDER BY is_active DESC, name ASC').all();
  },
  findById(id) {
    return getDb().prepare('SELECT * FROM shopgold_instances WHERE id = ?').get(id);
  },
  findActive() {
    return getDb().prepare('SELECT * FROM shopgold_instances WHERE is_active = 1 LIMIT 1').get();
  },
  create(data) {
    const { name, connection_type, mysql_host, mysql_port, mysql_user, mysql_pass, mysql_database, mysql_table_prefix, ftp_host, ftp_port, ftp_user, ftp_pass, ftp_path, shop_url, xml_feed_url } = data;
    const result = getDb().prepare(`
      INSERT INTO shopgold_instances (name, connection_type, mysql_host, mysql_port, mysql_user, mysql_pass, mysql_database, mysql_table_prefix, ftp_host, ftp_port, ftp_user, ftp_pass, ftp_path, shop_url, xml_feed_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, connection_type || 'mysql', mysql_host || '', mysql_port || '3306', mysql_user || '', mysql_pass || '', mysql_database || '', mysql_table_prefix || 'sg_', ftp_host || '', ftp_port || '21', ftp_user || '', ftp_pass || '', ftp_path || '/public_html', shop_url || '', xml_feed_url || '');
    return result.lastInsertRowid;
  },
  update(id, data) {
    const fields = [];
    const vals = [];
    const allowed = ['name', 'connection_type', 'mysql_host', 'mysql_port', 'mysql_user', 'mysql_pass', 'mysql_database', 'mysql_table_prefix', 'ftp_host', 'ftp_port', 'ftp_user', 'ftp_pass', 'ftp_path', 'shop_url', 'xml_feed_url'];
    for (const k of allowed) { if (data[k] !== undefined) { fields.push(`${k} = ?`); vals.push(data[k]); } }
    if (!fields.length) return;
    fields.push(`updated_at = datetime('now')`);
    vals.push(id);
    getDb().prepare(`UPDATE shopgold_instances SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  },
  delete(id) {
    getDb().prepare('DELETE FROM shopgold_instances WHERE id = ?').run(id);
  },
  setActive(id) {
    const db = getDb();
    db.prepare('UPDATE shopgold_instances SET is_active = 0').run();
    if (id) db.prepare('UPDATE shopgold_instances SET is_active = 1 WHERE id = ?').run(id);
  },
};

module.exports = { getDb, productOps, approvalOps, campaignOps, presetOps, settingsOps, syncLogOps, brandKbOps, seoKeywordOps, backlinkOps, auditLogOps, userSettingsOps, notesOps, knowledgeOps, blogPostOps, qaOps, productCategoryOps, mailerContactsOps, mailerCampaignsOps, mailerAutomationsOps, mailerRulesOps, pimCategoryOps, notificationOps, shopgoldInstanceOps };
