const fs = require('fs');

['ntt', 'mx', 'ntc', 'incom'].forEach(name => {
  if (!fs.existsSync(`data/snippet_${name}.xml`)) return;
  const data = fs.readFileSync(`data/snippet_${name}.xml`, 'utf8');
  console.log(`\n\n--- ${name} ---`);
  
  // Find first <produkt>, <product>, or <item>
  let startTag = '<produkt';
  if (data.indexOf(startTag) === -1) startTag = '<product';
  if (data.indexOf(startTag) === -1) startTag = '<item';
  if (data.indexOf(startTag) === -1) startTag = '<oferta';
  
  if (data.indexOf(startTag) > -1) {
    const startIdx = data.indexOf(startTag);
    const endTag = '</' + startTag.substring(1) + '>';
    let endIdx = data.indexOf(endTag, startIdx);
    if (endIdx === -1) endIdx = startIdx + 2000;
    console.log(data.substring(startIdx, endIdx + endTag.length));
  } else {
    console.log('No generic tag found. First 1000 chars:');
    console.log(data.substring(0, 1000));
  }
});
