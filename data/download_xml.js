const axios = require('axios');
const fs = require('fs');

async function downloadSnippets() {
  const urls = {
    'ntt': 'https://online.ntt.pl/export_xml.xhtml?link=241e2087c0c77947e9afe252825f0d92',
    'mx': 'https://online.mxsolution.pl/api/export/products/fd99492488e76d981b9da9c0506e312d/xml',
    'ntc': 'https://xml.qoltec.pl/open/157/xRzMwB3D9JswkP2AoVo7YbRaTB6OeffL.xml',
    'incom': 'https://feed.incomgroup.pl/feedData/ff1974687cd64387849646f1d97c42aa91a382e2e5658feacf14d89fa9a7de084e53d60d7075a540a784e6f52b786d0c7244b0d764a2c73a34591269f8014cd7-3bae217e8903330170820e77b7d540b594d81e6d5f75fdb541c02f82c12e70d2'
  };

  for (const [name, url] of Object.entries(urls)) {
    try {
      console.log(`Downloading ${name}...`);
      const resp = await axios.get(url, { responseType: 'stream' });
      let length = 0;
      let data = '';
      
      for await (const chunk of resp.data) {
        data += chunk.toString('utf8');
        length += chunk.length;
        if (length > 200000) {
          resp.data.destroy();
          break;
        }
      }
      
      fs.writeFileSync(`data/snippet_${name}.xml`, data);
      
      // Try to find one product node
      const match = data.match(/<([^>]+)>[\s\S]*?EAN[\s\S]*?<\/\1>/i);
      if (match) {
        console.log(`--- ${name} ---`);
        console.log(match[0].substring(0, 1500));
      } else {
        console.log(`--- ${name} (No exact match, first 500) ---`);
        console.log(data.substring(0, 500));
      }
      
    } catch(e) {
      console.error('Error on', name, e.message);
    }
  }
}

downloadSnippets();
