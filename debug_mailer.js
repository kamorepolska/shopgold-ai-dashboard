const h = require('fs').readFileSync('frontend/MAILER.html', 'utf8');
// Find all script tags
const re = /<script[^>]*>/g;
let m;
while((m = re.exec(h)) !== null) {
  console.log('pos:', m.index, 'tag:', m[0].slice(0, 100));
}

// Check compiled JS block
const sc = h.lastIndexOf('<script>');
const ec = h.lastIndexOf('</script>');
const js = h.slice(h.indexOf('>', sc) + 1, ec);
console.log('\nJS first 300:', js.slice(0, 300));
console.log('\nHas use strict:', js.includes('"use strict"'));
console.log('Uses var:', /^\s*var /m.test(js));
console.log('Uses const:', /^\s*const /m.test(js));

// Try loading as module with fake globals to check for errors
try {
  const vm = require('vm');
  const ctx = {
    React: { createElement: (...a) => a, useState: () => [null, () => {}], useEffect: () => {}, useReducer: () => [null, () => {}], useCallback: f => f, useMemo: f => f(), useRef: () => ({current: null}) },
    ReactDOM: { createRoot: () => ({ render: () => {} }) },
    Recharts: new Proxy({}, { get: () => () => {} }),
    document: { getElementById: () => ({ style: {} }), createElement: () => ({ textContent: '' }), head: { appendChild: () => {} } },
    Array: Array, Math: Math, JSON: JSON, Date: Date, Set: Set, Map: Map, console: console, Number: Number, String: String, Boolean: Boolean, Object: Object
  };
  vm.runInNewContext(js, ctx);
  console.log('\nJS RUNS WITHOUT ERROR!');
} catch(e) {
  console.log('\nRUNTIME ERROR:', e.message.slice(0, 300));
  console.log('Stack:', e.stack ? e.stack.split('\n').slice(0,5).join('\n') : '');
}
