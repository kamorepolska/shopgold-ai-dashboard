const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('../scratch/morele.html', 'utf8');
const $ = cheerio.load(html);

let csv = 'platforma;kategoria;prowizja_pct;min_oplata\n';
let count = 0;

$('table tr').each((i, el) => {
    const tds = $(el).find('td');
    if (tds.length >= 3) {
        let groupCat = $(tds[0]).text().trim();
        let cat = $(tds[1]).text().trim();
        let rateText = $(tds[2]).text().trim();
        
        if (cat && !cat.toLowerCase().includes('nazwa kategorii')) {
            let rate = parseFloat(rateText.replace(',', '.'));
            if (!isNaN(rate)) {
                let fullCat = groupCat + ' > ' + cat;
                csv += 'Morele;' + fullCat.replace(/;/g, ',') + ';' + rate + ';0\n';
                count++;
            }
        }
    }
});

fs.writeFileSync('../scratch/morele_import.csv', csv);
console.log('Morele CSV created. Count:', count);
