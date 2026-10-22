const fs = require('fs');
const filePath = 'backend/services/sourcingService.js';
let c = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// 1. Add CONDITION and WARRANTY patterns to _parseTabular 
// Find after CUR_PATS line
const curPatsEnd = "const CUR_PATS   = ['currency', 'waluta', 'cur', 'curr'];";
if (c.includes(curPatsEnd)) {
  c = c.replace(curPatsEnd, curPatsEnd + "\r\n  const COND_PATS  = ['condition', 'stan', 'stan_produktu', 'state', 'nowy_uzywany', 'kondycja'];\r\n  const WARR_PATS  = ['warranty', 'gwarancja', 'guarantee', 'warranty_months', 'gwarancja_miesiace', 'okres_gwarancji'];");
  changes++;
  console.log('1. Added COND_PATS and WARR_PATS');
}

// 2. Add condIdx and warrIdx after curIdx
const curIdxLine = "  const curIdx   = findCol(CUR_PATS,   colSettings.cur_field);";
if (c.includes(curIdxLine)) {
  c = c.replace(curIdxLine, curIdxLine + "\r\n  const condIdx  = findCol(COND_PATS,  colSettings.cond_field);\r\n  const warrIdx  = findCol(WARR_PATS,  colSettings.warr_field);");
  changes++;
  console.log('2. Added condIdx and warrIdx');
}

// 3. Update product push in _parseTabular to include condition and warranty
const oldPush = "    products.push({\r\n      ean,\r\n      name:         nameIdx >= 0  ? String(row[nameIdx] ?? '').trim() : '',\r\n      manufacturer: mfgIdx >= 0   ? String(row[mfgIdx] ?? '').trim()  : '',\r\n      price,\r\n      currency:     rowCurrency || null,  // will be converted to PLN later\r\n      availability: availIdx >= 0 ? resolveAvailability(row[availIdx]) : 'unknown',\r\n    });";
if (c.includes(oldPush)) {
  c = c.replace(oldPush, "    products.push({\r\n      ean,\r\n      name:         nameIdx >= 0  ? String(row[nameIdx] ?? '').trim() : '',\r\n      manufacturer: mfgIdx >= 0   ? String(row[mfgIdx] ?? '').trim()  : '',\r\n      price,\r\n      currency:     rowCurrency || null,  // will be converted to PLN later\r\n      availability: availIdx >= 0 ? resolveAvailability(row[availIdx]) : 'unknown',\r\n      condition:    condIdx >= 0  ? resolveCondition(row[condIdx])    : 'new',\r\n      warranty:     warrIdx >= 0  ? String(row[warrIdx] ?? '').trim() || null : null,\r\n    });");
  changes++;
  console.log('3. Updated _parseTabular product push');
}

// 4. Update INSERT into supplier_products to include condition and warranty
const oldInsert = "'INSERT INTO supplier_products (supplier_id, ean, name, manufacturer, price, price_pln, availability) VALUES (?, ?, ?, ?, ?, ?, ?)'";
if (c.includes(oldInsert)) {
  c = c.replace(oldInsert, "'INSERT INTO supplier_products (supplier_id, ean, name, manufacturer, price, price_pln, availability, condition, warranty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'");
  changes++;
  console.log('4. Updated INSERT statement');
}

// 5. Update ins.run to pass condition and warranty
const oldInsRun = "      ins.run(id, p.ean, p.name, p.manufacturer, p.price, p.price_pln, p.availability);";
if (c.includes(oldInsRun)) {
  c = c.replace(oldInsRun, "      ins.run(id, p.ean, p.name, p.manufacturer, p.price, p.price_pln, p.availability, p.condition || 'new', p.warranty || null);");
  changes++;
  console.log('5. Updated ins.run call');
}

// 6. Add condition and warranty to buildComparison offer query
const oldOfferSelect = "SELECT sp.ean, sp.price, COALESCE(sp.price_pln, sp.price) as price_pln,\r\n           sp.availability, sp.name as sp_name, sp.manufacturer,\r\n           s.id as supplier_id, s.name as supplier_name, s.currency";
if (c.includes(oldOfferSelect)) {
  c = c.replace(oldOfferSelect, "SELECT sp.ean, sp.price, COALESCE(sp.price_pln, sp.price) as price_pln,\r\n           sp.availability, sp.name as sp_name, sp.manufacturer,\r\n           sp.condition as sp_condition, sp.warranty as sp_warranty,\r\n           s.id as supplier_id, s.name as supplier_name, s.currency");
  changes++;
  console.log('6. Updated buildComparison offer SELECT');
}

// 7. Add condition/warranty to supplierPrices map in buildComparison  
const oldSupPrices = "        supplierPrices[o.supplier_id] = { price: o.price_pln, orig_price: o.price, currency: o.currency, availability: o.availability };";
if (c.includes(oldSupPrices)) {
  c = c.replace(oldSupPrices, "        supplierPrices[o.supplier_id] = { price: o.price_pln, orig_price: o.price, currency: o.currency, availability: o.availability, condition: o.sp_condition || 'new', warranty: o.sp_warranty || null };");
  changes++;
  console.log('7. Updated supplierPrices map');
}

// 8. Add condition/warranty to comparison row push
const oldRowPush = "      manufacturer: rowMfg,\r\n      savings, savings_pct: savingsPct, signal,\r\n      offers_count: offers.length,\r\n      supplier_prices: supplierPrices,";
if (c.includes(oldRowPush)) {
  c = c.replace(oldRowPush, "      manufacturer: rowMfg,\r\n      condition: best ? (best.sp_condition || 'new') : 'new',\r\n      warranty: best ? (best.sp_warranty || null) : null,\r\n      savings, savings_pct: savingsPct, signal,\r\n      offers_count: offers.length,\r\n      supplier_prices: supplierPrices,");
  changes++;
  console.log('8. Updated comparison row push');
}

// 9. Add condition/warranty to buildPromotions offer SELECT
const promoSelect = "SELECT sp.ean, COALESCE(sp.price_pln, sp.price) as price_pln, sp.price,\r\n           sp.availability, sp.name as sp_name, sp.manufacturer as sp_manufacturer,\r\n           s.id as supplier_id, s.name as supplier_name, s.currency";
if (c.includes(promoSelect)) {
  c = c.replace(promoSelect, "SELECT sp.ean, COALESCE(sp.price_pln, sp.price) as price_pln, sp.price,\r\n           sp.availability, sp.name as sp_name, sp.manufacturer as sp_manufacturer,\r\n           sp.condition as sp_condition, sp.warranty as sp_warranty,\r\n           s.id as supplier_id, s.name as supplier_name, s.currency");
  changes++;
  console.log('9. Updated buildPromotions SELECT');
}

// 10. Add condition/warranty to promotions row push
const promoRowPush = "      availability: best.availability, in_subiekt: !!sub,\r\n      stock: sub?.stock ?? null, sell_price: sub?.sell_price ?? null, sold_30d: sub?.sold_30d ?? null,";
if (c.includes(promoRowPush)) {
  c = c.replace(promoRowPush, "      availability: best.availability, in_subiekt: !!sub,\r\n      condition: best.sp_condition || 'new', warranty: best.sp_warranty || null,\r\n      stock: sub?.stock ?? null, sell_price: sub?.sell_price ?? null, sold_30d: sub?.sold_30d ?? null,");
  changes++;
  console.log('10. Updated promotions row push');
}

// 11. Add condition/warranty to getMissingProducts offer SELECT
const missingSelect = "SELECT sp.ean, sp.name as sp_name, COALESCE(sp.price_pln, sp.price) as price_pln,\r\n           sp.price, sp.availability, sp.manufacturer,\r\n           s.id as supplier_id, s.name as supplier_name";
if (c.includes(missingSelect)) {
  c = c.replace(missingSelect, "SELECT sp.ean, sp.name as sp_name, COALESCE(sp.price_pln, sp.price) as price_pln,\r\n           sp.price, sp.availability, sp.manufacturer,\r\n           sp.condition as sp_condition, sp.warranty as sp_warranty,\r\n           s.id as supplier_id, s.name as supplier_name");
  changes++;
  console.log('11. Updated getMissing SELECT');
}

// 12. Add condition/warranty to missing eanMap
const missingEanMap = "    eanMap[ean] = {\r\n      ean, name: best.sp_name || '',\r\n      manufacturer: best.manufacturer || '',\r\n      best_price: best.price_pln,\r\n      best_supplier: best.supplier_name, best_supplier_id: best.supplier_id,\r\n      availability: best.availability,\r\n    };";
if (c.includes(missingEanMap)) {
  c = c.replace(missingEanMap, "    eanMap[ean] = {\r\n      ean, name: best.sp_name || '',\r\n      manufacturer: best.manufacturer || '',\r\n      best_price: best.price_pln,\r\n      best_supplier: best.supplier_name, best_supplier_id: best.supplier_id,\r\n      availability: best.availability,\r\n      condition: best.sp_condition || 'new', warranty: best.sp_warranty || null,\r\n    };");
  changes++;
  console.log('12. Updated missing eanMap');
}

// 13. Add condition/warranty to buildRestockList offer SELECT
const restockSelect = "SELECT sp.ean, COALESCE(sp.price_pln, sp.price) as price_pln, sp.price,\r\n           sp.availability, sp.manufacturer,\r\n           s.id as supplier_id, s.name as supplier_name";
if (c.includes(restockSelect)) {
  c = c.replace(restockSelect, "SELECT sp.ean, COALESCE(sp.price_pln, sp.price) as price_pln, sp.price,\r\n           sp.availability, sp.manufacturer,\r\n           sp.condition as sp_condition, sp.warranty as sp_warranty,\r\n           s.id as supplier_id, s.name as supplier_name");
  changes++;
  console.log('13. Updated restock SELECT');
}

// 14. Add condition/warranty to restock row push
const restockRowPush = "      availability: best ? best.availability : 'none',\r\n      manufacturer: best ? (best.manufacturer || '') : '',";
if (c.includes(restockRowPush)) {
  c = c.replace(restockRowPush, "      availability: best ? best.availability : 'none',\r\n      manufacturer: best ? (best.manufacturer || '') : '',\r\n      condition: best ? (best.sp_condition || 'new') : 'new',\r\n      warranty: best ? (best.sp_warranty || null) : null,");
  changes++;
  console.log('14. Updated restock row push');
}

// 15. Filter price > 0 in buildComparison offer query (add WHERE clause)
const oldOfferOrder = "    ORDER BY COALESCE(sp.price_pln, sp.price) ASC";
// We need the one in buildComparison context - find the first occurrence
const cmpOfferIdx = c.indexOf(oldOfferOrder);
if (cmpOfferIdx >= 0) {
  // Check if there's already a WHERE before ORDER BY
  const before = c.substring(Math.max(0, cmpOfferIdx - 200), cmpOfferIdx);
  if (!before.includes('price > 0') && !before.includes('price_pln > 0')) {
    // Need to add price > 0 filter
    // The query has optional WHERE clause, so we add AND or WHERE
    if (before.includes('WHERE sp.supplier_id')) {
      // supplier_id filter exists, add AND
      c = c.substring(0, cmpOfferIdx) + "    AND COALESCE(sp.price_pln, sp.price) > 0\r\n  " + c.substring(cmpOfferIdx);
    } else {
      // No WHERE yet, but we need it at all times
      // Actually the WHERE is conditional. Let's add it after the conditional WHERE.
      // The offerQuery is built dynamically so let's just add a note
      console.log('15. SKIPPED - buildComparison uses dynamic WHERE, price>0 handled at parse time');
    }
  }
}

fs.writeFileSync(filePath, c);
console.log(`\nDone! Applied ${changes} changes.`);
