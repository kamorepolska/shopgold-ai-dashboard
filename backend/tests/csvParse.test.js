'use strict';

const assert = require('assert');
const { parseSupplierCsv } = require('../services/sourcingService');

const alsoTsv = [
  'DES-1008D/E\t0\t47.02\tD-LINK\t\tN\t13427\t0790069217715\tSieci\tLAN\tSwitch',
  'C13S041068\t0\t161.72\tEPSON\t\tN\t13534\t0010343812031\tDrukarki\tPapier\tFoto',
].join('\n');

const noMap = parseSupplierCsv(Buffer.from(alsoTsv, 'utf8'), {});
assert.strictEqual(noMap.length, 2, 'headerless TSV must parse without col_settings');
assert.strictEqual(noMap[0].ean, '0790069217715');
assert.ok(Math.abs(noMap[0].price - 47.02) < 0.001);

const mapped = parseSupplierCsv(Buffer.from(alsoTsv, 'utf8'), {
  ean_field: 7,
  price_field: 2,
  name_field: 0,
  mfg_field: 3,
  avail_field: 5,
  mfg_code_field: 6,
  cat_field: 8,
});
assert.strictEqual(mapped[0].name, 'DES-1008D/E');
assert.strictEqual(mapped[0].manufacturer, 'D-LINK');
assert.strictEqual(mapped[0].manufacturer_code, '13427');
assert.ok(String(mapped[0].category || '').includes('Sieci'));

const headed = parseSupplierCsv(Buffer.from('EAN;Cena;Nazwa\n5901234567897;12.50;Kabel\n', 'utf8'), {});
assert.strictEqual(headed.length, 1);
assert.strictEqual(headed[0].ean, '5901234567897');

console.log('csvParse.test.js ok');
