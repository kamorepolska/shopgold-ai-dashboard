'use strict';

const assert = require('assert');
const router = require('../routes/oferter');

assert.strictEqual(typeof router.isPcComponentName, 'function');
assert.strictEqual(typeof router.pickComponentAttrs, 'function');

assert.ok(router.isPcComponentName('Płyty główne'));
assert.ok(router.isPcComponentName('Procesory'));
assert.ok(router.isPcComponentName('Pamięci RAM'));
assert.ok(!router.isPcComponentName('Obudowy na dyski'));
assert.ok(!router.isPcComponentName('Taśmy LED'));
assert.ok(!router.isPcComponentName('Pamięci masowe'));
assert.ok(!router.isPcComponentName('Karty pamięci'));

const mb = router.pickComponentAttrs({
  'Płyty główne': { Socket: 'AM5' },
  'Obudowy na dyski HDD': { Format: '3.5' },
}, ['plyty glowne', 'plyta glowna', 'mainboard', 'motherboard', 'plyty', 'plyta']);
assert.ok(mb);
assert.strictEqual(mb.Socket, 'AM5');

const diskCase = router.pickComponentAttrs({
  'Obudowy komputerowe': { Format: 'ATX' },
  'Obudowy na dyski HDD': { Format: '3.5' },
  'Wentylatory do obudów': { Rozmiar: '120' },
}, ['obudowy komputerowe', 'obudowy pc', 'gehause', 'obudow', 'case']);
assert.ok(diskCase);
assert.strictEqual(diskCase.Format, 'ATX');

console.log('oferterCompat tests: ok');
