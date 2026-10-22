const fs=require('fs');
const lines=fs.readFileSync('frontend/js/pim.js','utf8').split('\n');
let depth=0;
lines.forEach((l,i)=>{
  const o=(l.match(/<div/g)||[]).length;
  const c=(l.match(/<\/div>/g)||[]).length;
  depth+=o-c;
  if(l.includes('pim-tab-panel')) {
    console.log((i+1)+' [DEPTH BEFORE: '+(depth-o+c)+', AFTER: '+depth+']: '+l.trim());
  }
});
