/* =====================================================================
 * emailMonitorService.js — Monitoring skrzynki IMAP dla ofert hurtowni
 * Parsuje załączniki (CSV/Excel) i treść maila (tabele HTML / AI)
 * ===================================================================== */
'use strict';

const { ImapFlow }   = require('imapflow');
const { simpleParser } = require('mailparser');
const path  = require('path');
const fs    = require('fs');

/* ── DB helpers ────────────────────────────────────────────────────── */
function getDb() {
  return require('./sourcingService').getDb();
}

/* ── Ensure table exists ────────────────────────────────────────────── */
function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_promo_mails (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id       TEXT UNIQUE,
      from_addr        TEXT,
      subject          TEXT,
      received_at      TEXT,
      supplier_id      INTEGER,
      status           TEXT DEFAULT 'pending',
      source           TEXT DEFAULT 'email',
      attachments_count INTEGER DEFAULT 0,
      body_products_count INTEGER DEFAULT 0,
      raw_products     TEXT DEFAULT '[]',
      error_msg        TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    )
  `);
}

/* ── Build IMAP config from settings ──────────────────────────────── */
function buildImapConfig(s) {
  const host = s.email_monitor_host || '';
  const port = parseInt(s.email_monitor_port || '993', 10);
  const tls  = s.email_monitor_tls !== '0';
  if (!host || !s.email_monitor_user || !s.email_monitor_pass) {
    throw new Error('Brak konfiguracji IMAP. Uzupełnij Ustawienia → System → Monitoring Maili.');
  }
  return {
    host,
    port,
    secure: tls,
    auth: {
      user: s.email_monitor_user,
      pass: s.email_monitor_pass,
    },
    logger: false,
    tls: { rejectUnauthorized: false },
  };
}

/* ── Common column aliases ─────────────────────────────────────────── */
const NAME_ALIASES  = ['nazwa','nazwa towaru','name','produkt','title','opis','opis krotki','opis krótki','description','artname'];
const SKU_ALIASES   = ['index','indeks','sku','symbol','p/n','pn','kod producenta','mpn','part','part number','kod','numer katalogowy','nr katalogowy','manufacturer code','artnr','herstnr'];
const EAN_ALIASES   = ['ean','gtin','barcode','kod kreskowy','bar code','isbn'];
const PRICE_ALIASES = ['cena netto','cena net','cena','price','netto','pricenet','preis','alscena','cena pln','net/szt','hek'];
const QTY_ALIASES   = ['stan','qty','quantity','ilosc','ilość','dostepnosc','dostępność','stock','stok','menge','available','szt','ilość','stk'];

function colIdx(headers, aliases) {
  for (const a of aliases) {
    const i = headers.findIndex(h => h === a || h.includes(a));
    if (i >= 0) return i;
  }
  return -1;
}

/* ── Parse CSV buffer ──────────────────────────────────────────────── */
function parseCsvProducts(buffer) {
  try {
    const iconv = require('iconv-lite');
    const raw   = iconv.decode(buffer, 'win1250');
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delim).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

    const nameI  = colIdx(headers, NAME_ALIASES);
    const skuI   = colIdx(headers, SKU_ALIASES);
    const eanI   = colIdx(headers, EAN_ALIASES);
    const priceI = colIdx(headers, PRICE_ALIASES);
    const qtyI   = colIdx(headers, QTY_ALIASES);

    const products = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delim).map(c => c.replace(/^"|"$/g, '').trim());
      const p = {
        name:  nameI  >= 0 ? cols[nameI]  : '',
        sku:   skuI   >= 0 ? cols[skuI]   : '',
        ean:   eanI   >= 0 ? cols[eanI]   : '',
        price: priceI >= 0 ? parseFloat((cols[priceI] || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0 : 0,
        qty:   qtyI   >= 0 ? parseInt(cols[qtyI])   || 0 : 0,
        source_row: i,
      };
      if (p.name || p.sku || p.ean) products.push(p);
    }
    return products;
  } catch (e) {
    console.error('[emailMonitor] CSV parse error:', e.message);
    return [];
  }
}

/* ── Parse Excel buffer ────────────────────────────────────────────── */
function parseXlsxProducts(buffer) {
  try {
    const XLSX = require('xlsx');
    const wb   = XLSX.read(buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) return [];

    const headers = (rows[0] || []).map(h => String(h).toLowerCase().trim());

    const nameI  = colIdx(headers, NAME_ALIASES);
    const skuI   = colIdx(headers, SKU_ALIASES);
    const eanI   = colIdx(headers, EAN_ALIASES);
    const priceI = colIdx(headers, PRICE_ALIASES);
    const qtyI   = colIdx(headers, QTY_ALIASES);

    const products = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const p = {
        name:  nameI  >= 0 ? String(cols[nameI]  || '') : '',
        sku:   skuI   >= 0 ? String(cols[skuI]   || '') : '',
        ean:   eanI   >= 0 ? String(cols[eanI]   || '') : '',
        price: priceI >= 0 ? parseFloat(String(cols[priceI] || '0').replace(',', '.')) || 0 : 0,
        qty:   qtyI   >= 0 ? parseInt(cols[qtyI]) || 0 : 0,
        source_row: i,
      };
      if (p.name || p.sku || p.ean) products.push(p);
    }
    return products;
  } catch (e) {
    console.error('[emailMonitor] XLSX parse error:', e.message);
    return [];
  }
}

/* ── Extract products from HTML tables ─────────────────────────────── */
function extractFromHtmlTable(html) {
  try {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const tables = $('table');
    if (!tables.length) return [];

    const allProducts = [];
    tables.each((_, table) => {
      const rows = $(table).find('tr');
      if (rows.length < 3) return; // need header + at least 2 data rows

      // First row = headers
      const headers = [];
      $(rows[0]).find('th, td').each((_, cell) => {
        headers.push($(cell).text().trim().replace(/\s+/g, ' ').toLowerCase());
      });

      const nameI  = colIdx(headers, NAME_ALIASES);
      const skuI   = colIdx(headers, SKU_ALIASES);
      const eanI   = colIdx(headers, EAN_ALIASES);
      const priceI = colIdx(headers, PRICE_ALIASES);
      const qtyI   = colIdx(headers, QTY_ALIASES);

      // Skip tables that don't look like product data
      if (nameI < 0 && skuI < 0 && eanI < 0 && priceI < 0) return;

      rows.each((idx, row) => {
        if (idx === 0) return; // skip header
        const cells = [];
        $(row).find('td').each((_, cell) => cells.push($(cell).text().trim().replace(/\s+/g, ' ')));
        const p = {
          name:  nameI  >= 0 ? cells[nameI]  || '' : '',
          sku:   skuI   >= 0 ? cells[skuI]   || '' : '',
          ean:   eanI   >= 0 ? cells[eanI]   || '' : '',
          price: priceI >= 0 ? parseFloat((cells[priceI] || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0 : 0,
          qty:   qtyI   >= 0 ? parseInt(String(cells[qtyI] || '').replace(/[^\d]/g, '')) || 0 : 0,
        };
        if (p.name || p.sku || p.ean) allProducts.push(p);
      });
    });
    return allProducts;
  } catch (e) {
    console.error('[emailMonitor] HTML table parse error:', e.message);
    return [];
  }
}

/* ── Extract products via AI ────────────────────────────────────────── */
async function extractViaAI(text, model) {
  try {
    const aiService = require('./aiService');
    const provider = aiService.getEffectiveProvider();
    const useModel = model || aiService.getEffectiveModel(provider, 'chat_default');
    if (!useModel) throw new Error('Brak modelu AI');

    const systemPrompt = 'Jesteś asystentem analizującym oferty hurtowni. Ekstrahujesz listę produktów z tekstu maila. Zwracasz TYLKO poprawny JSON bez żadnych komentarzy.';
    const userPrompt = `Przeanalizuj poniższy tekst oferty hurtowni i wyekstrahuj wszystkie produkty z cenami. Zwróć JSON:
[{"name":"nazwa produktu","sku":"kod/indeks lub ''","ean":"ean lub ''","price":0.00,"qty":0}]

Jeśli nie możesz określić wartości, użyj '' lub 0.

Tekst oferty:
${text.slice(0, 4000)}`;

    const result = await aiService.complete(systemPrompt, userPrompt, {
      provider,
      model: useModel,
      featureId: 'chat_default',
      temperature: 0.2,
      maxTokens: 2048,
      skipBrandKb: true,
    });

    const raw = (result.text || '').replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
    const match = raw.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  } catch (e) {
    console.error('[emailMonitor] AI extraction error:', e.message);
    return [];
  }
}

/* ── Save mail record to DB ─────────────────────────────────────────── */
function saveMail(data) {
  const db = getDb();
  ensureTable();
  try {
    const existing = db.prepare('SELECT id FROM email_promo_mails WHERE message_id = ?').get(data.message_id);
    if (existing) return { id: existing.id, duplicate: true };

    const r = db.prepare(`
      INSERT INTO email_promo_mails
        (message_id, from_addr, subject, received_at, status, attachments_count, body_products_count, raw_products)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.message_id,
      data.from_addr,
      data.subject,
      data.received_at,
      data.status || 'pending',
      data.attachments_count || 0,
      data.body_products_count || 0,
      JSON.stringify(data.raw_products || []),
    );
    return { id: Number(r.lastInsertRowid), duplicate: false };
  } catch (e) {
    if (e.message.includes('UNIQUE')) return { id: null, duplicate: true };
    throw e;
  }
}

/* ── Main: check mailbox ────────────────────────────────────────────── */
async function checkEmails(settings, aiModel) {
  ensureTable();
  const cfg = buildImapConfig(settings);
  cfg.socketTimeout = 120000; // 120s socket timeout for large mailboxes
  const folder = settings.email_monitor_folder || 'INBOX';
  const subjectFilter = (settings.email_monitor_subject_filter || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const senderFilter  = (settings.email_monitor_sender_filter  || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

  const stats = { processed: 0, imported: 0, duplicates: 0, errors: 0 };

  // Phase 1: Fetch raw messages from IMAP (fast — no parsing)
  const rawMessages = [];
  const client = new ImapFlow(cfg);
  client.on('error', (err) => {
    console.warn('[emailMonitor] IMAP error event:', err.message);
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const allUids = await client.search({ all: true });
      if (!allUids.length) {
        return { ...stats, message: 'Brak maili w folderze' };
      }
      // Take last 200 (most recent)
      const uids = allUids.slice(-200);

      for await (const msg of client.fetch(uids, { envelope: true, source: true })) {
        rawMessages.push({ uid: msg.uid, source: msg.source });
      }
      // Mark all fetched as seen in one batch
      if (rawMessages.length > 0) {
        try {
          const fetchedUids = rawMessages.map(m => m.uid);
          await client.messageFlagsAdd(fetchedUids, ['\\Seen']);
        } catch(_) {}
      }
    } finally {
      lock.release();
    }
  } catch(connErr) {
    console.error('[emailMonitor] IMAP connection error:', connErr.message);
    // Continue processing whatever we already fetched
  } finally {
    try { await client.logout(); } catch(_) {}
  }

  // Phase 2: Parse and process messages offline (no IMAP timeout risk)
  for (const raw of rawMessages) {
    try {
      const parsed = await simpleParser(raw.source);
      const messageId = parsed.messageId || `uid-${raw.uid}`;
      const fromAddr  = parsed.from?.text || '';
      const subject   = parsed.subject || '';
      const dateStr   = (parsed.date || new Date()).toISOString();

      // Skip already processed (duplicate check)
      const existingCheck = getDb().prepare('SELECT id FROM email_promo_mails WHERE message_id = ?').get(messageId);
      if (existingCheck) { stats.duplicates++; stats.processed++; continue; }

      // Apply filters
      if (subjectFilter.length) {
        const subjL = subject.toLowerCase();
        if (!subjectFilter.some(f => subjL.includes(f))) continue;
      }
      if (senderFilter.length) {
        const fromL = fromAddr.toLowerCase();
        if (!senderFilter.some(f => fromL.includes(f))) continue;
      }

      let allProducts = [];
      let attachmentsCount = 0;

      // ── Process attachments ──────────────────────────────────
      for (const att of (parsed.attachments || [])) {
        const name = (att.filename || '').toLowerCase();
        const ext  = path.extname(name);
        let prods  = [];

        if (ext === '.csv' || ext === '.txt') {
          prods = parseCsvProducts(att.content);
        } else if (ext === '.xlsx' || ext === '.xls') {
          prods = parseXlsxProducts(att.content);
        } else if (ext === '.htm' || ext === '.html') {
          // Forwarded HTML attachments with product tables
          const htmlStr = att.content.toString('utf-8');
          prods = extractFromHtmlTable(htmlStr);
        }

        if (prods.length) {
          allProducts = allProducts.concat(prods.map(p => ({ ...p, source: `attachment:${att.filename}` })));
          attachmentsCount++;
        }
      }

      // ── Process body (always try, merge with attachment results) ──
      let bodyProductsCount = 0;
      // Try HTML tables from the email body
      if (parsed.html) {
        const htmlProds = extractFromHtmlTable(parsed.html);
        if (htmlProds.length) {
          allProducts = allProducts.concat(htmlProds.map(p => ({ ...p, source: 'html_table' })));
          bodyProductsCount += htmlProds.length;
        }
      }

      // Note: AI extraction is skipped during batch check (too slow)
      // User can trigger AI via individual mail re-parse if needed

      // Save to DB
      const saveResult = saveMail({
        message_id: messageId,
        from_addr: fromAddr,
        subject,
        received_at: dateStr,
        status: allProducts.length ? 'pending' : 'empty',
        attachments_count: attachmentsCount,
        body_products_count: bodyProductsCount,
        raw_products: allProducts,
      });

      if (saveResult.duplicate) {
        stats.duplicates++;
      } else {
        stats.imported++;
      }
      stats.processed++;

    } catch (msgErr) {
      console.error('[emailMonitor] Error processing message:', msgErr.message);
      stats.errors++;
    }
  }

  return stats;
}

/* ── Test connection ────────────────────────────────────────────────── */
async function testConnection(settings) {
  const cfg = buildImapConfig(settings);
  const folder = settings.email_monitor_folder || 'INBOX';
  const client = new ImapFlow(cfg);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    let count = 0;
    try {
      const status = await client.status(folder, { messages: true, unseen: true });
      count = status.messages || 0;
    } finally {
      lock.release();
    }
    await client.logout();
    return { ok: true, messages: count, folder };
  } catch (e) {
    try { await client.logout(); } catch (_) {}
    throw new Error('Połączenie IMAP nieudane: ' + e.message);
  }
}

/* ── List mails ─────────────────────────────────────────────────────── */
function listMails({ status, limit = 100, offset = 0 } = {}) {
  ensureTable();
  const db = getDb();
  let q = 'SELECT id, message_id, from_addr, subject, received_at, status, attachments_count, body_products_count, created_at FROM email_promo_mails';
  const params = [];
  if (status) { q += ' WHERE status = ?'; params.push(status); }
  q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const rows = db.prepare(q).all(...params);
  const total = db.prepare(`SELECT COUNT(*) as c FROM email_promo_mails${status ? ' WHERE status=?' : ''}`).get(...(status ? [status] : [])).c;
  return { rows, total };
}

/* ── Get mail products ──────────────────────────────────────────────── */
function getMailProducts(id) {
  ensureTable();
  const db = getDb();
  const row = db.prepare('SELECT * FROM email_promo_mails WHERE id = ?').get(id);
  if (!row) return null;
  try { row.products = JSON.parse(row.raw_products || '[]'); } catch { row.products = []; }
  return row;
}

/* ── Update mail status ─────────────────────────────────────────────── */
function updateStatus(id, status, errorMsg) {
  ensureTable();
  const db = getDb();
  db.prepare('UPDATE email_promo_mails SET status=?, error_msg=? WHERE id=?').run(status, errorMsg || null, id);
}

/* ── Delete mail ────────────────────────────────────────────────────── */
function deleteMail(id) {
  ensureTable();
  const db = getDb();
  db.prepare('DELETE FROM email_promo_mails WHERE id=?').run(id);
}

/* ── Import mail products into a supplier ───────────────────────────── */
function importMailProducts(mailId, supplierId) {
  ensureTable();
  const db = getDb();
  const mail = db.prepare('SELECT * FROM email_promo_mails WHERE id=?').get(mailId);
  if (!mail) throw new Error('Mail nie znaleziony');

  let products = [];
  try { products = JSON.parse(mail.raw_products || '[]'); } catch {}
  if (!products.length) throw new Error('Brak produktów w tym mailu');

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id=?').get(supplierId);
  if (!supplier) throw new Error('Hurtownia nie znaleziona');

  let imported = 0;
  const stmt = db.prepare(`
    INSERT INTO supplier_products
      (supplier_id, ean, name, price, stock_quantity, manufacturer_code, attributes, refreshed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(supplier_id, ean) DO UPDATE SET
      price=excluded.price, stock_quantity=excluded.stock_quantity,
      name=excluded.name, attributes=excluded.attributes, refreshed_at=datetime('now')
  `);

  const insertNoEan = db.prepare(`
    INSERT INTO supplier_products
      (supplier_id, ean, name, price, stock_quantity, manufacturer_code, attributes, refreshed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  for (const p of products) {
    try {
      const ean  = (p.ean || '').toString().trim();
      const attrs = JSON.stringify({ sku: p.sku, source_row: p.source_row, source: p.source });
      if (ean) {
        stmt.run(supplierId, ean, p.name || '', p.price || 0, p.qty || 0, p.sku || '', attrs);
      } else {
        // no EAN — use unique key
        const fakeEan = `EMAIL-${mailId}-${p.sku || imported}`;
        insertNoEan.run(supplierId, fakeEan, p.name || '', p.price || 0, p.qty || 0, p.sku || '', attrs);
      }
      imported++;
    } catch (e) {
      console.warn('[emailMonitor] import row error:', e.message);
    }
  }

  updateStatus(mailId, 'imported');
  return { imported, total: products.length };
}

module.exports = {
  ensureTable,
  checkEmails,
  testConnection,
  listMails,
  getMailProducts,
  updateStatus,
  deleteMail,
  importMailProducts,
};
