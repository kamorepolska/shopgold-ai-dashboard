const fs = require('fs');

['ntt', 'mx', 'ntc', 'incom'].forEach(name => {
  if (!fs.existsSync(`data/snippet_${name}.xml`)) return;
  const data = fs.readFileSync(`data/snippet_${name}.xml`, 'utf8');
  console.log(`\n\n=== ${name.toUpperCase()} ===`);
  
  // Find first <produkt>, <product>, <item>, <oferta>
  const match = data.match(/<(produkt|product|item|oferta)[\s>][\s\S]*?<\/\1>/i);
  if (match) {
    console.log(match[0].substring(0, 1500));
  } else {
    console.log('No generic product tag found.');
  }
});
