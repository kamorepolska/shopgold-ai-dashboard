const jsdom = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('frontend/js/pim.js', 'utf8');
const match = html.match(/shell\(\) \{[\s\S]*?return `([\s\S]*?)`;\s*\},/);
if (match) {
  const dom = new jsdom.JSDOM(match[1]);
  Array.from(dom.window.document.body.children).forEach(c => {
    console.log(c.id || c.className || c.tagName);
  });
}
