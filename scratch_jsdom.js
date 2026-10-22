const jsdom = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('frontend/js/pim.js', 'utf8');
const match = html.match(/shell\(\) \{[\s\S]*?return `([\s\S]*?)`;\s*\},/);
if (match) {
  const dom = new jsdom.JSDOM(match[1]);
  const io = dom.window.document.getElementById('pim-tab-io');
  if (io) {
    console.log('IO tab has parent?', io.parentElement ? io.parentElement.tagName : 'none');
    console.log('IO Tab Children count:', io.children.length);
    for (let i = 0; i < io.children.length; i++) {
       console.log(`Child ${i}:`, io.children[i].className || io.children[i].tagName);
    }
    const next = io.nextElementSibling;
    console.log('---');
    console.log('Next sibling:', next ? (next.id || next.className || next.tagName) : 'none');
  } else {
    console.log("no pim-tab-io found");
  }
} else {
  console.log("No shell match");
}
