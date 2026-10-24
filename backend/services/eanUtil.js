'use strict';

/**
 * Shared EAN / GTIN identity helpers.
 * One canonical form so Subiekt, hurtownie and catalog_master join the same product.
 */

function normalizeEan(ean) {
  if (!ean) return '';
  let clean = String(ean).trim().replace(/\s+/g, '').replace(/[^0-9]/g, '');
  if (!clean) return '';
  // EAN-14 with a leading zero → EAN-13
  if (clean.length === 14 && clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  return clean;
}

function eanVariants(ean) {
  const n = normalizeEan(ean);
  if (!n) return [];
  const set = new Set([n]);
  const raw = String(ean).trim().replace(/\s+/g, '').replace(/[^0-9]/g, '');
  if (raw) set.add(raw);
  if (n.length === 13) {
    set.add('0' + n);
    if (n.startsWith('0')) set.add(n.slice(1));
  } else if (n.length === 12) {
    set.add('0' + n);
  }
  return [...set];
}

function eanMatch(ean1, ean2) {
  const n1 = normalizeEan(ean1);
  const n2 = normalizeEan(ean2);
  if (!n1 || !n2) return false;
  if (n1 === n2) return true;
  if (n1 === '0' + n2 || n2 === '0' + n1) return true;
  if (n1.length === 12 && n2.length === 13 && n2.startsWith('0') && n2.substring(1) === n1) return true;
  if (n2.length === 12 && n1.length === 13 && n1.startsWith('0') && n1.substring(1) === n2) return true;
  return false;
}

function registerNormalizeEan(db) {
  if (!db || typeof db.function !== 'function') return;
  try {
    db.function('normalize_ean', { deterministic: true }, (value) => normalizeEan(value));
  } catch (_) {
    // already registered on this connection
  }
}

function sqlInVariants(column, ean) {
  const vars = eanVariants(ean);
  if (!vars.length) return { sql: '0', params: [] };
  return {
    sql: `${column} IN (${vars.map(() => '?').join(',')})`,
    params: vars,
  };
}

/**
 * Build a map: normalized EAN → Set of all normalized EANs that belong to the same catalog product.
 */
function buildCatalogEanGroups(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const group = new Set();
    const canon = normalizeEan(row.canonical_ean);
    if (canon) group.add(canon);
    let extras = [];
    try { extras = JSON.parse(row.all_eans || '[]'); } catch { extras = []; }
    if (Array.isArray(extras)) {
      for (const e of extras) {
        const n = normalizeEan(e);
        if (n) group.add(n);
      }
    }
    if (!group.size) continue;
    for (const e of group) {
      const existing = map.get(e);
      if (existing) {
        for (const x of group) existing.add(x);
      } else {
        map.set(e, new Set(group));
      }
    }
  }
  return map;
}

function groupKeyForEan(ean, catalogGroups) {
  const key = normalizeEan(ean);
  if (!key) return '';
  if (!catalogGroups) return key;
  const group = catalogGroups.get(key);
  if (!group || !group.size) return key;
  return [...group].sort()[0];
}

module.exports = {
  normalizeEan,
  eanVariants,
  eanMatch,
  registerNormalizeEan,
  sqlInVariants,
  buildCatalogEanGroups,
  groupKeyForEan,
};
