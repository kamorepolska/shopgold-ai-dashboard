const fs = require('fs');
const filePath = 'frontend/js/sourcing.js';
let c = fs.readFileSync(filePath, 'utf8');

const i1 = c.indexOf('let _resizeState = null;');
const i2 = c.indexOf('let _resizeState = null;', i1 + 1);

if (i1 >= 0 && i2 > i1) {
  // Let's find the start of the block 2
  const block2Start = c.lastIndexOf('/* ═══════════════════════════════════════════════════════', i2);
  // Find the end of block 2. 
  // It ends where the getColOrder function ends or before the next unique function
  const nextUnique = c.indexOf('function bindDrag', i2); // Wait, bindDrag was also duplicated? No, bindDrag was before the duplicate blocks.
  
  // The block 1 ends where block 2 starts
  const block1End = block2Start;
  
  // What is right after block 1? Block 2! So they are contiguous!
  console.log('block1 ends at', block1End);
  
  // Let's just remove everything from block2Start up to the end of block2.
  // We know block2 contains exactly the same code as block 1.
  const blockLength = block2Start - c.lastIndexOf('/* ═══════════════════════════════════════════════════════', i1);
  console.log('Block length seems to be:', blockLength);
  
  // Wait, if block2 is an exact copy of block1, we can just remove `blockLength` characters starting from `block2Start`
  // Let's verify
  const b1 = c.substring(block2Start - blockLength, block2Start);
  const b2 = c.substring(block2Start, block2Start + blockLength);
  
  if (b1 === b2) {
     console.log('Blocks are EXACT duplicates! Removing block 2.');
     c = c.substring(0, block2Start) + c.substring(block2Start + blockLength);
     fs.writeFileSync(filePath, c);
     console.log('Done!');
  } else {
     console.log('Blocks are NOT exact duplicates. Let me find where to cut.');
     // Find the end of block2 by looking for the next section comment
     const nextSection = c.indexOf('/* ═══════════════════════════════════════════════════════', i2 + 100);
     if (nextSection > i2) {
       console.log('Found next section at', nextSection, '. Slicing from', block2Start, 'to', nextSection);
       c = c.substring(0, block2Start) + c.substring(nextSection);
       fs.writeFileSync(filePath, c);
       console.log('Done (cut to next section)!');
     }
  }
} else {
  console.log('Duplicate not found');
}
