/**
 * MySQL Adapter — bezpośrednie połączenie z bazą danych ShopGold
 * Ustawienia są pobierane dynamicznie z localDb (settingsOps),
 * co pozwala na zmianę połączenia przez Panel Ustawień bez restartu.
 */
const mysql = require('mysql2/promise');
const config = require('../config');

let pool = null;

/** Pobierz aktywne ustawienia MySQL (DB overrides .env) */
function getMysqlConfig() {
  // Lazy require to avoid circular deps
  const { settingsOps } = require('../models/localDb');
  return {
    host:       settingsOps.get('mysql_host')         || config.mysql.host,
    port:       parseInt(settingsOps.get('mysql_port') || config.mysql.port) || 3306,
    user:       settingsOps.get('mysql_user')         || config.mysql.user,
    password:   settingsOps.get('mysql_pass')         || config.mysql.password,
    database:   settingsOps.get('mysql_database')     || config.mysql.database,
    tablePrefix: settingsOps.get('mysql_table_prefix') || config.mysql.tablePrefix || 'sg_',
    languageId: parseInt(settingsOps.get('mysql_language_id') || config.mysql.languageId || 1),
  };
}

function getPool() {
  if (!pool) {
    const cfg = getMysqlConfig();
    pool = mysql.createPool({
      host:             cfg.host,
      port:             cfg.port,
      user:             cfg.user,
      password:         cfg.password,
      database:         cfg.database,
      waitForConnections: true,
      connectionLimit:  5,
      connectTimeout:   10000,
    });
  }
  return pool;
}

/** Reset pool — wywołaj po zmianie ustawień w UI */
async function resetPool() {
  if (pool) {
    try { await pool.end(); } catch {}
    pool = null;
  }
  _tablesCache = null;
  _tablesCacheTime = 0;
}

async function testConnection() {
  // Force new pool with current settings
  await resetPool();
  try {
    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();
    const cfg = getMysqlConfig();
    // Discover tables for diagnostics
    let tableInfo = '';
    try {
      const tables = await discoverTables();
      const productTable = detectTable(tables, cfg.tablePrefix, PRODUCT_TABLE_CANDIDATES);
      const catTable = detectTable(tables, cfg.tablePrefix, CATEGORY_TABLE_CANDIDATES);
      tableInfo = ` | Tabel: ${tables.length}`;
      if (productTable) tableInfo += ` | Produkty: ${productTable}`;
      else tableInfo += ` | ⚠️ Nie znaleziono tabeli produktów`;
      if (catTable) tableInfo += ` | Kategorie: ${catTable}`;
    } catch(_) {}
    return { success: true, message: `Połączenie z MySQL OK — ${cfg.host}/${cfg.database}${tableInfo}` };
  } catch (err) {
    return { success: false, message: `Błąd połączenia MySQL: ${err.message}` };
  }
}

/** Discover table structure — helps map ShopGold tables */
let _tablesCache = null;
let _tablesCacheTime = 0;
const TABLES_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function discoverTables() {
  const now = Date.now();
  if (_tablesCache && (now - _tablesCacheTime) < TABLES_CACHE_TTL) return _tablesCache;
  const [rows] = await getPool().execute('SHOW TABLES');
  _tablesCache = rows.map(r => Object.values(r)[0]);
  _tablesCacheTime = now;
  return _tablesCache;
}

async function getTableColumns(tableName) {
  const [rows] = await getPool().execute(`DESCRIBE \`${tableName}\``);
  return rows;
}

/**
 * Fetch products from ShopGold MySQL database
 */
async function fetchProducts({ limit = 100, offset = 0, category = '', search = '' } = {}) {
  const cfg = getMysqlConfig();
  const pool = getPool();

  const tables = await discoverTables();
  const productTable = detectTable(tables, cfg.tablePrefix, PRODUCT_TABLE_CANDIDATES);

  if (!productTable) {
    throw new Error(`Nie znaleziono tabeli produktów. Dostępne tabele: ${tables.slice(0, 20).join(', ')}. Ustaw prefiks tabel poprawnie.`);
  }

  const columns = await getTableColumns(productTable);
  const colNames = columns.map(c => c.Field);

  // ShopGold/osCommerce split data into products and products_description
  const descTableCandidates = [`${productTable}_description`, `${productTable}y_opisy`, `${productTable}_opis`];
  let descTable = tables.find(t => descTableCandidates.includes(t)) || null;
  
  let descColNames = [];
  if (descTable) {
    const descColumns = await getTableColumns(descTable);
    descColNames = descColumns.map(c => c.Field);
  }

  // ShopGold stores category relationships in products_to_categories junction table
  const ptcTable = detectTable(tables, cfg.tablePrefix, ['products_to_categories']);
  const catDescTable = detectTable(tables, cfg.tablePrefix, ['categories_description', 'kategorie_opisy']);

  const allColNames = [...colNames, ...descColNames];

  const colMap = mapColumns(allColNames, {
    shop_id:          ['id', 'product_id', 'towar_id', 'p_id', 'id_produktu', 'products_id'],
    name:             ['name', 'nazwa', 'title', 'tytul', 'n', 'nazwa_produktu', 'products_name'],
    description:      ['description', 'opis', 'desc', 'pelny_opis', 'long_desc', 'opis_produktu', 'products_description'],
    meta_title:       ['meta_title', 'seo_title', 'page_title', 'products_meta_title_tag', 'products_head_title_tag'],
    meta_description: ['meta_description', 'meta_desc', 'seo_desc', 'products_meta_desc_tag', 'products_head_desc_tag'],
    price:            ['price', 'cena', 'koszt', 'cena_produktu', 'products_price'],
    ean:              ['ean', 'EAN', 'barcode', 'products_ean', 'kod_ean', 'gtin', 'products_model', 'products_barcode'],
  });

  const selectCols = [];
  for (const [key, col] of Object.entries(colMap)) {
    if (!col) continue;
    if (colNames.includes(col)) selectCols.push(`p.\`${col}\` AS \`${key}\``);
    else if (descTable && descColNames.includes(col)) selectCols.push(`pd.\`${col}\` AS \`${key}\``);
  }
  // Resolve category name from junction table
  if (ptcTable && catDescTable) {
    selectCols.push(`COALESCE(cd.\`categories_name\`, '') AS \`category\``);
  } else {
    selectCols.push(`'' AS \`category\``);
  }

  if (selectCols.length === 0 || (!colMap.shop_id && !colMap.name)) {
    throw new Error(`Nie udało się zmapować kolumn. Główna: ${colNames.slice(0, 10).join(', ')}... Opisy: ${descColNames.slice(0, 10).join(', ')}...`);
  }

  const idCol = colMap.shop_id || 'products_id';
  
  const manTable = detectTable(tables, cfg.tablePrefix, ['manufacturers', 'producenci']);
  if (manTable && colNames.includes('manufacturers_id')) {
    selectCols.push(`COALESCE(m.\`manufacturers_name\`, '') AS \`group_tag\``);
  } else {
    selectCols.push(`'' AS \`group_tag\``);
  }

  let query = `SELECT ${selectCols.join(', ')} FROM \`${productTable}\` p`;
  if (descTable) {
    const joinCol = ['products_id', 'product_id', 'id_produktu', 'id'].find(c => colNames.includes(c) && descColNames.includes(c));
    if (joinCol) {
      // Filter by configured language_id (default=1, Polish) to avoid NULL rows from secondary languages
      const hasLangCol = descColNames.includes('language_id');
      if (hasLangCol) {
        query += ` LEFT JOIN \`${descTable}\` pd ON p.\`${joinCol}\` = pd.\`${joinCol}\` AND pd.\`language_id\` = ${cfg.languageId}`;
      } else {
        query += ` LEFT JOIN \`${descTable}\` pd ON p.\`${joinCol}\` = pd.\`${joinCol}\``;
      }
    }
  }
  // Join categories via products_to_categories junction table
  if (ptcTable && catDescTable) {
    query += ` LEFT JOIN \`${ptcTable}\` ptc ON p.\`${idCol}\` = ptc.\`products_id\``;
    query += ` LEFT JOIN \`${catDescTable}\` cd ON ptc.\`categories_id\` = cd.\`categories_id\` AND cd.\`language_id\` = ${cfg.languageId}`;
  }
  if (manTable && colNames.includes('manufacturers_id')) {
    query += ` LEFT JOIN \`${manTable}\` m ON p.\`manufacturers_id\` = m.\`manufacturers_id\``;
  }
  query += ` WHERE 1=1`;
  const params = [];

  if (search && colMap.name) {
    const tableAlias = colNames.includes(colMap.name) ? 'p' : 'pd';
    query += ` AND ${tableAlias}.\`${colMap.name}\` LIKE ?`;
    params.push(`%${search}%`);
  }
  if (category) {
    if (ptcTable && catDescTable) {
      query += ` AND cd.\`categories_name\` = ?`;
    }
    params.push(category);
  }

  // GROUP BY to deduplicate multi-category products
  query += ` GROUP BY p.\`${idCol}\``;
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const [rows] = await pool.execute(query, params);

  return rows.map(row => ({
    shop_id:          String(row.shop_id || ''),
    name:             row.name || '',
    category:         row.category || '',
    group_tag:        row.group_tag || '',
    description:      row.description || '',
    meta_title:       row.meta_title || '',
    meta_description: row.meta_description || '',
    price:            parseFloat(row.price) || 0,
    ean:              row.ean ? String(row.ean) : '',
    images:           [],
    attributes:       {},
    raw_data:         row,
  }));
}

/**
 * Update product fields in MySQL (approved changes)
 */
async function updateProduct(shopId, fields) {
  const cfg = getMysqlConfig();
  const pool = getPool();
  const tables = await discoverTables();
  const productTable = detectTable(tables, cfg.tablePrefix, PRODUCT_TABLE_CANDIDATES);
  if (!productTable) throw new Error('Nie znaleziono tabeli produktów.');

  const columns = await getTableColumns(productTable);
  const colNames = columns.map(c => c.Field);

  // Check for description table (ShopGold/osCommerce pattern)
  const descTableCandidates = [`${productTable}_description`, `${productTable}y_opisy`, `${productTable}_opis`];
  let descTable = tables.find(t => descTableCandidates.includes(t)) || null;
  let descColNames = [];
  if (descTable) {
    const descColumns = await getTableColumns(descTable);
    descColNames = descColumns.map(c => c.Field);
  }

  const allColNames = [...colNames, ...descColNames];

  // Handle relations
  if (fields.relations) {
    try {
      const rels = typeof fields.relations === 'string' ? JSON.parse(fields.relations) : fields.relations;
      await updateRelations(shopId, rels, pool, tables, cfg.tablePrefix, productTable, colNames);
    } catch (err) {
      console.warn('[MySQL] Error updating relations:', err);
    }
    delete fields.relations;
  }

  const colMap = mapColumns(allColNames, {
    shop_id:          ['id', 'product_id', 'towar_id', 'p_id', 'id_produktu', 'products_id'],
    name:             ['name', 'nazwa', 'title', 'tytul', 'products_name'],
    description:      ['description', 'opis', 'desc', 'pelny_opis', 'long_desc', 'products_description'],
    meta_title:       ['meta_title', 'seo_title', 'page_title', 'products_meta_title_tag', 'products_head_title_tag'],
    meta_description: ['meta_description', 'meta_desc', 'seo_desc', 'products_meta_desc_tag', 'products_head_desc_tag'],
    price:            ['price', 'cena', 'koszt', 'products_price'],
  });

  // Separate updates for main table and description table
  const mainClauses = [];
  const mainParams = [];
  const descClauses = [];
  const descParams = [];

  for (const [key, value] of Object.entries(fields)) {
    const col = colMap[key];
    if (!col) continue;
    
    if (colNames.includes(col)) {
      mainClauses.push(`\`${col}\` = ?`);
      mainParams.push(value);
    } else if (descTable && descColNames.includes(col)) {
      descClauses.push(`\`${col}\` = ?`);
      descParams.push(value);
    }
  }

  // Find the ID column for joining
  const idCol = colMap.shop_id;
  if (!idCol) throw new Error('Nie znaleziono kolumny ID produktu.');

  // Update main table if needed
  if (mainClauses.length > 0) {
    mainParams.push(shopId);
    await pool.execute(
      `UPDATE \`${productTable}\` SET ${mainClauses.join(', ')} WHERE \`${idCol}\` = ?`,
      mainParams
    );
    console.log(`[MySQL] Updated ${mainClauses.length} fields in ${productTable} for product ${shopId}`);
  }

  // Update description table if needed
  if (descClauses.length > 0 && descTable) {
    // Find the join column in description table
    const descIdCol = ['products_id', 'product_id', 'id_produktu', 'id'].find(c => descColNames.includes(c));
    if (descIdCol) {
      descParams.push(shopId);
      await pool.execute(
        `UPDATE \`${descTable}\` SET ${descClauses.join(', ')} WHERE \`${descIdCol}\` = ?`,
        descParams
      );
      console.log(`[MySQL] Updated ${descClauses.length} fields in ${descTable} for product ${shopId}`);
    } else {
      console.warn(`[MySQL] Cannot update description table — no ID column found in ${descTable}`);
    }
  }

  if (mainClauses.length === 0 && descClauses.length === 0) {
    console.warn(`[MySQL] No matching columns found for update. Fields: ${Object.keys(fields).join(', ')}. Available: ${allColNames.slice(0, 15).join(', ')}`);
  }
}

/** Fetch product categories */
async function fetchCategories() {
  const cfg = getMysqlConfig();
  const tables = await discoverTables();
  const catTable = detectTable(tables, cfg.tablePrefix, CATEGORY_TABLE_CANDIDATES);
  if (!catTable) return [];
  // Try to find the name column
  const cols = await getTableColumns(catTable);
  const colNames = cols.map(c => c.Field);
  const nameCol = ['name', 'nazwa', 'title', 'kategoria', 'cat_name', 'category_name'].find(c => colNames.includes(c)) || colNames[1] || colNames[0];
  const [rows] = await getPool().execute(`SELECT DISTINCT \`${nameCol}\` AS name FROM \`${catTable}\` ORDER BY \`${nameCol}\``);
  return rows.map(r => r.name).filter(Boolean);
}

// --- Table name candidates for ShopGold ---
const PRODUCT_TABLE_CANDIDATES = [
  'products', 'product', 'produkt', 'produkty', 'towar', 'towary', 'items',
  'shop_products', 'shop_product', 'products_description',
  // ShopGold-specific
  'sg_products', 'sg_produkty',
];

const CATEGORY_TABLE_CANDIDATES = [
  'categories', 'category', 'kategorie', 'kategoria', 'cat', 'kat',
  'shop_categories', 'categories_description',
  'sg_categories', 'sg_kategorie',
];

// --- Helpers ---
function detectTable(tables, prefix, candidates) {
  // 1. Exact match with prefix
  if (prefix) {
    for (const candidate of candidates) {
      const withPrefix = `${prefix}${candidate}`;
      if (tables.includes(withPrefix)) return withPrefix;
    }
  }
  // 2. Exact match without prefix
  for (const candidate of candidates) {
    if (tables.includes(candidate)) return candidate;
  }
  // 3. Partial match (table name contains candidate)
  const lower = tables.map(t => t.toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.findIndex(t => t.includes(candidate));
    if (idx >= 0) return tables[idx];
  }
  return null;
}

function mapColumns(colNames, mapping) {
  const result = {};
  for (const [key, candidates] of Object.entries(mapping)) {
    result[key] = candidates.find(c => colNames.includes(c)) || null;
  }
  return result;
}

async function closePool() {
  if (pool) { await pool.end(); pool = null; }
}

async function updateRelations(shopId, rels, pool, tables, prefix, productTable, colNames) {
  // Warianty - products_reference_number_1
  if (rels.warianty && rels.warianty.length > 0) {
    if (colNames.includes('products_reference_number_1')) {
      const refCol = colNames.includes('products_id') ? 'products_id' : (colNames.includes('id_produktu') ? 'id_produktu' : 'id');
      // Set the reference number to a common value, e.g. the target product's ID
      const refVal = `VAR-${shopId}`;
      const ids = [shopId, ...rels.warianty.map(w => w.shop_id)];
      const placeholders = ids.map(() => '?').join(',');
      await pool.execute(`UPDATE \`${productTable}\` SET \`products_reference_number_1\` = ? WHERE \`${refCol}\` IN (${placeholders})`, [refVal, ...ids]);
      console.log(`[MySQL] Updated variants reference for IDs: ${ids.join(', ')}`);
    } else {
      console.warn('[MySQL] Nie znaleziono kolumny products_reference_number_1 dla wariantów.');
    }
  }

  // Akcesoria - products_accesories
  if (rels.akcesoria && rels.akcesoria.length > 0) {
    const accTable = detectTable(tables, prefix, ['products_accesories', 'products_accessories']);
    if (accTable) {
      for (const acc of rels.akcesoria) {
        // Assume pacc_products_id_master is target, pacc_products_id_slave is related
        try {
          await pool.execute(`INSERT IGNORE INTO \`${accTable}\` (pacc_products_id_master, pacc_products_id_slave, pacc_type, pacc_sort_order) VALUES (?, ?, 0, 0)`, [shopId, acc.shop_id]);
        } catch(e) { console.warn(`[MySQL] Błąd zapisu akcesorium: ${e.message}`); }
      }
    }
  }

  // Podobne / Polecane - products_related_products
  if (rels.podobne && rels.podobne.length > 0) {
    const relTable = detectTable(tables, prefix, ['products_related_products']);
    if (relTable) {
      for (const rel of rels.podobne) {
        try {
          await pool.execute(`INSERT IGNORE INTO \`${relTable}\` (prp_products_id_master, prp_products_id_slave) VALUES (?, ?)`, [shopId, rel.shop_id]);
        } catch(e) { console.warn(`[MySQL] Błąd zapisu prod. podobnego: ${e.message}`); }
      }
    }
  }
}

/**
 * Fetch parameters dictionary from DB
 */
async function getParameters(categoryName = null) {
  const cfg = getMysqlConfig();
  const pool = getPool();
  const tables = await discoverTables();
  
  const extTable = detectTable(tables, cfg.tablePrefix, ['products_extra_fields']);
  const valTable = detectTable(tables, cfg.tablePrefix, ['products_to_products_extra_fields']);
  
  if (!extTable || !valTable) throw new Error('Nie znaleziono tabel cech (products_extra_fields).');

  let joinStr = '';
  let whereStr = `WHERE v.products_extra_fields_value IS NOT NULL AND v.products_extra_fields_value != ''`;
  const params = [];

  if (categoryName) {
    const p2cTable = detectTable(tables, cfg.tablePrefix, ['products_to_categories']);
    const catDescTable = detectTable(tables, cfg.tablePrefix, ['categories_description', 'kategorie_opisy']);
    if (p2cTable && catDescTable) {
      joinStr = `JOIN \`${p2cTable}\` p2c ON p2c.products_id = v.products_id
                 JOIN \`${catDescTable}\` cd ON cd.categories_id = p2c.categories_id AND cd.language_id = ${cfg.languageId || 1}`;
      whereStr += ` AND cd.categories_name = ?`;
      params.push(categoryName);
    }
  }

  const query = `
    SELECT 
      f.products_extra_fields_id as feature_id,
      f.products_extra_fields_name as feature_name,
      v.products_extra_fields_value as feature_value,
      COUNT(DISTINCT v.products_id) as product_count
    FROM \`${valTable}\` v
    JOIN \`${extTable}\` f ON f.products_extra_fields_id = v.products_extra_fields_id
    ${joinStr}
    ${whereStr}
    GROUP BY f.products_extra_fields_id, f.products_extra_fields_name, v.products_extra_fields_value
    ORDER BY f.products_extra_fields_name, v.products_extra_fields_value
    LIMIT 5000
  `;
  
  const [rows] = await pool.execute(query, params);
  return rows;
}

/**
 * Standardize parameter value in DB
 */
async function updateParameterValue(featureId, oldVal, newVal) {
  const cfg = getMysqlConfig();
  const pool = getPool();
  const tables = await discoverTables();
  const valTable = detectTable(tables, cfg.tablePrefix, ['products_to_products_extra_fields']);
  const bookTable = detectTable(tables, cfg.tablePrefix, ['products_extra_fields_book']);

  if (valTable) {
    await pool.execute(
      `UPDATE \`${valTable}\` SET products_extra_fields_value = ? WHERE products_extra_fields_id = ? AND products_extra_fields_value = ?`,
      [newVal, featureId, oldVal]
    );
  }

  if (bookTable) {
    await pool.execute(
      `UPDATE \`${bookTable}\` SET products_extra_fields_book_text = ? WHERE products_extra_fields_id = ? AND products_extra_fields_book_text = ?`,
      [newVal, featureId, oldVal]
    );
  }
}

/**
 * Merge/Rename parameter in DB
 */
async function mergeParameterName(featureId, newName) {
  const cfg = getMysqlConfig();
  const pool = getPool();
  const tables = await discoverTables();
  const extTable = detectTable(tables, cfg.tablePrefix, ['products_extra_fields']);

  if (extTable) {
    await pool.execute(
      `UPDATE \`${extTable}\` SET products_extra_fields_name = ? WHERE products_extra_fields_id = ?`,
      [newName, featureId]
    );
  }
}

/**
 * Fetch CMS Entities for PIM (Categories, Pages, Manufacturers)
 */
async function fetchCmsEntities(type) {
  const cfg = getMysqlConfig();
  const pool = getPool();
  const tables = await discoverTables();
  
  const results = [];
  
  if (type === 'category' || type === 'all') {
    const catTable = detectTable(tables, cfg.tablePrefix, CATEGORY_TABLE_CANDIDATES);
    const catDescTable = detectTable(tables, cfg.tablePrefix, ['categories_description']);
    if (catTable && catDescTable) {
      const query = `
        SELECT c.categories_id AS id, cd.categories_name AS title, cd.categories_description AS description, 
               cd.categories_meta_title_tag AS meta_title, cd.categories_meta_desc_tag AS meta_desc
        FROM \`${catTable}\` c
        JOIN \`${catDescTable}\` cd ON c.categories_id = cd.categories_id AND cd.language_id = ?
      `;
      const [rows] = await pool.execute(query, [cfg.languageId]);
      rows.forEach(r => results.push({ type: 'category', ...r }));
    }
  }

  if (type === 'page' || type === 'all') {
    const pageTable = detectTable(tables, cfg.tablePrefix, ['pages']);
    const pageDescTable = detectTable(tables, cfg.tablePrefix, ['pages_description']);
    if (pageTable && pageDescTable) {
      const query = `
        SELECT p.pages_id AS id, pd.pages_title AS title, pd.pages_text AS description, 
               pd.meta_title_tag AS meta_title, pd.meta_desc_tag AS meta_desc
        FROM \`${pageTable}\` p
        JOIN \`${pageDescTable}\` pd ON p.pages_id = pd.pages_id AND pd.language_id = ?
      `;
      const [rows] = await pool.execute(query, [cfg.languageId]);
      rows.forEach(r => results.push({ type: 'page', ...r }));
    }
  }

  if (type === 'manufacturer' || type === 'all') {
    const manTable = detectTable(tables, cfg.tablePrefix, ['manufacturers']);
    const manInfoTable = detectTable(tables, cfg.tablePrefix, ['manufacturers_info']);
    if (manTable && manInfoTable) {
      const query = `
        SELECT m.manufacturers_id AS id, m.manufacturers_name AS title, mi.manufacturers_description AS description, 
               mi.manufacturers_meta_title_tag AS meta_title, mi.manufacturers_meta_desc_tag AS meta_desc
        FROM \`${manTable}\` m
        JOIN \`${manInfoTable}\` mi ON m.manufacturers_id = mi.manufacturers_id AND mi.languages_id = ?
      `;
      const [rows] = await pool.execute(query, [cfg.languageId]);
      rows.forEach(r => results.push({ type: 'manufacturer', ...r }));
    }
  }

  // Homepage — stored in ShopGold configuration table
  if (type === 'homepage' || type === 'all') {
    const confTable = detectTable(tables, cfg.tablePrefix, ['configuration']);
    if (confTable) {
      try {
        const keys = ['STORE_NAME', 'HEADING_TITLE_TAG', 'META_TAG_TITLE', 'META_TAG_DESCRIPTION', 'DEFINE_MAINPAGE'];
        const placeholders = keys.map(() => '?').join(',');
        const [confRows] = await pool.execute(
          `SELECT configuration_key, configuration_value FROM \`${confTable}\` WHERE configuration_key IN (${placeholders})`,
          keys
        );
        const conf = {};
        confRows.forEach(r => { conf[r.configuration_key] = r.configuration_value; });
        
        // Try to get mainpage content from define_mainpage table
        let mainpageContent = conf['DEFINE_MAINPAGE'] || '';
        const defTable = detectTable(tables, cfg.tablePrefix, ['define_mainpage']);
        if (defTable) {
          try {
            const [defRows] = await pool.execute(
              `SELECT define_mainpage_text AS content FROM \`${defTable}\` WHERE language_id = ? LIMIT 1`,
              [cfg.languageId]
            );
            if (defRows.length && defRows[0].content) mainpageContent = defRows[0].content;
          } catch(_) {}
        }

        results.push({
          type: 'homepage',
          id: 0,
          title: conf['STORE_NAME'] || 'Strona Główna',
          description: mainpageContent,
          meta_title: conf['META_TAG_TITLE'] || conf['HEADING_TITLE_TAG'] || '',
          meta_desc: conf['META_TAG_DESCRIPTION'] || '',
        });
      } catch(_) {}
    }
  }

  return results;
}

/**
 * Update CMS Entity in MySQL
 */
async function updateCmsEntity(type, id, fields) {
  const cfg = getMysqlConfig();
  const pool = getPool();
  const tables = await discoverTables();
  
  if (type === 'category') {
    const catDescTable = detectTable(tables, cfg.tablePrefix, ['categories_description']);
    if (!catDescTable) throw new Error('Brak tabeli opisów kategorii');
    
    const updates = [];
    const params = [];
    if (fields.description !== undefined) { updates.push('categories_description = ?'); params.push(fields.description); }
    if (fields.meta_title !== undefined) { updates.push('categories_meta_title_tag = ?'); params.push(fields.meta_title); }
    if (fields.meta_desc !== undefined) { updates.push('categories_meta_desc_tag = ?'); params.push(fields.meta_desc); }
    
    if (updates.length) {
      params.push(id, cfg.languageId);
      await pool.execute(`UPDATE \`${catDescTable}\` SET ${updates.join(', ')} WHERE categories_id = ? AND language_id = ?`, params);
    }
  } else if (type === 'page') {
    const pageDescTable = detectTable(tables, cfg.tablePrefix, ['pages_description']);
    if (!pageDescTable) throw new Error('Brak tabeli opisów stron');
    
    const updates = [];
    const params = [];
    if (fields.description !== undefined) { updates.push('pages_text = ?'); params.push(fields.description); }
    if (fields.meta_title !== undefined) { updates.push('meta_title_tag = ?'); params.push(fields.meta_title); }
    if (fields.meta_desc !== undefined) { updates.push('meta_desc_tag = ?'); params.push(fields.meta_desc); }
    
    if (updates.length) {
      params.push(id, cfg.languageId);
      await pool.execute(`UPDATE \`${pageDescTable}\` SET ${updates.join(', ')} WHERE pages_id = ? AND language_id = ?`, params);
    }
  } else if (type === 'manufacturer') {
    const manInfoTable = detectTable(tables, cfg.tablePrefix, ['manufacturers_info']);
    if (!manInfoTable) throw new Error('Brak tabeli info producentów');
    
    const updates = [];
    const params = [];
    if (fields.description !== undefined) { updates.push('manufacturers_description = ?'); params.push(fields.description); }
    if (fields.meta_title !== undefined) { updates.push('manufacturers_meta_title_tag = ?'); params.push(fields.meta_title); }
    if (fields.meta_desc !== undefined) { updates.push('manufacturers_meta_desc_tag = ?'); params.push(fields.meta_desc); }
    
    if (updates.length) {
      params.push(id, cfg.languageId);
      await pool.execute(`UPDATE \`${manInfoTable}\` SET ${updates.join(', ')} WHERE manufacturers_id = ? AND languages_id = ?`, params);
    }
  } else {
    throw new Error('Nieznany typ CMS');
  }
}

/**
 * Duplicate a product in ShopGold MySQL DB
 */
async function duplicateProductInShopgold(shopId, newName) {
  const cfg = getMysqlConfig();
  const pool = getPool();
  const tables = await discoverTables();
  const productTable = detectTable(tables, cfg.tablePrefix, PRODUCT_TABLE_CANDIDATES);
  if (!productTable) throw new Error('Nie znaleziono tabeli produktów.');

  const columns = await getTableColumns(productTable);
  const colNames = columns.map(c => c.Field);
  const idCol = ['products_id', 'product_id', 'id_produktu', 'id'].find(c => colNames.includes(c)) || 'products_id';

  // Get original product
  const [rows] = await pool.execute(`SELECT * FROM \`${productTable}\` WHERE \`${idCol}\` = ?`, [shopId]);
  if (!rows || rows.length === 0) throw new Error(`Produkt ${shopId} nie istnieje w ShopGold.`);
  const row = rows[0];

  // Remove primary key
  delete row[idCol];
  
  // Set new name if applicable in main table
  const nameCol = ['name', 'nazwa', 'title', 'tytul', 'products_name'].find(c => colNames.includes(c));
  if (nameCol && newName) row[nameCol] = newName;

  // Modify model/SKU to avoid UNIQUE constraints
  const modelCol = ['products_model', 'model', 'sku'].find(c => colNames.includes(c));
  if (modelCol && row[modelCol]) row[modelCol] = row[modelCol] + '-COPY';

  const keys = Object.keys(row);
  const values = Object.values(row);
  const placeholders = keys.map(() => '?').join(', ');
  
  const [result] = await pool.execute(
    `INSERT INTO \`${productTable}\` (\`${keys.join('`, `')}\`) VALUES (${placeholders})`,
    values
  );
  
  const newShopId = result.insertId;

  // Duplicate descriptions
  const descTableCandidates = [`${productTable}_description`, `${productTable}y_opisy`, `${productTable}_opis`];
  const descTable = tables.find(t => descTableCandidates.includes(t));
  if (descTable) {
    const descCols = await getTableColumns(descTable);
    const descColNames = descCols.map(c => c.Field);
    const descIdCol = ['products_id', 'product_id', 'id_produktu', 'id'].find(c => descColNames.includes(c));
    if (descIdCol) {
      const [descRows] = await pool.execute(`SELECT * FROM \`${descTable}\` WHERE \`${descIdCol}\` = ?`, [shopId]);
      for (const dRow of descRows) {
        dRow[descIdCol] = newShopId;
        const dNameCol = ['name', 'nazwa', 'title', 'products_name'].find(c => descColNames.includes(c));
        if (dNameCol && newName) dRow[dNameCol] = newName;
        
        const dKeys = Object.keys(dRow);
        const dValues = Object.values(dRow);
        const dPlaceholders = dKeys.map(() => '?').join(', ');
        try {
          await pool.execute(`INSERT INTO \`${descTable}\` (\`${dKeys.join('`, `')}\`) VALUES (${dPlaceholders})`, dValues);
        } catch(e) { console.warn('Błąd kopiowania opisu:', e.message); }
      }
    }
  }

  // Duplicate categories junction
  const ptcTable = detectTable(tables, cfg.tablePrefix, ['products_to_categories']);
  if (ptcTable) {
    const ptcCols = await getTableColumns(ptcTable);
    const ptcColNames = ptcCols.map(c => c.Field);
    const ptcIdCol = ['products_id', 'product_id', 'id_produktu', 'id'].find(c => ptcColNames.includes(c));
    if (ptcIdCol) {
      const [ptcRows] = await pool.execute(`SELECT * FROM \`${ptcTable}\` WHERE \`${ptcIdCol}\` = ?`, [shopId]);
      for (const ptcRow of ptcRows) {
        ptcRow[ptcIdCol] = newShopId;
        const ptcKeys = Object.keys(ptcRow);
        const ptcValues = Object.values(ptcRow);
        const ptcPlaceholders = ptcKeys.map(() => '?').join(', ');
        try {
          await pool.execute(`INSERT INTO \`${ptcTable}\` (\`${ptcKeys.join('`, `')}\`) VALUES (${ptcPlaceholders})`, ptcValues);
        } catch(e) {}
      }
    }
  }

  // Duplicate extra fields (parameters)
  const extTable = detectTable(tables, cfg.tablePrefix, ['products_to_products_extra_fields']);
  if (extTable) {
    const extCols = await getTableColumns(extTable);
    const extColNames = extCols.map(c => c.Field);
    const extIdCol = ['products_id', 'product_id', 'id_produktu', 'id'].find(c => extColNames.includes(c));
    if (extIdCol) {
      const [extRows] = await pool.execute(`SELECT * FROM \`${extTable}\` WHERE \`${extIdCol}\` = ?`, [shopId]);
      for (const extRow of extRows) {
        extRow[extIdCol] = newShopId;
        const extKeys = Object.keys(extRow);
        const extValues = Object.values(extRow);
        const extPlaceholders = extKeys.map(() => '?').join(', ');
        try {
          await pool.execute(`INSERT INTO \`${extTable}\` (\`${extKeys.join('`, `')}\`) VALUES (${extPlaceholders})`, extValues);
        } catch(e) {}
      }
    }
  }

  return String(newShopId);
}

module.exports = { testConnection, fetchProducts, updateProduct, fetchCategories, discoverTables, getTableColumns, resetPool, closePool, getParameters, updateParameterValue, mergeParameterName, fetchCmsEntities, updateCmsEntity, duplicateProductInShopgold };
