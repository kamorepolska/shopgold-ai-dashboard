const fs=require('fs');
const c=fs.readFileSync('frontend/js/sourcing.js','utf8');
const lines=c.split('\n');

let bt=0, sq=0, dq=0;
for(let i=0; i<856; i++) {
  for(let j=0; j<lines[i].length; j++) {
    const ch = lines[i][j];
    if (ch==='`') bt++;
    else if (ch==='\'') sq++;
    else if (ch==='"') dq++;
  }
}
console.log('Backticks:', bt, bt%2===0?'even':'odd');
console.log('Single quotes:', sq, sq%2===0?'even':'odd');
console.log('Double quotes:', dq, dq%2===0?'even':'odd');
