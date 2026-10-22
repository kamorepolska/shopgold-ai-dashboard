const fs = require('fs');

const logs = fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\f37a8d24-74ee-4d87-b0ce-1e0d852fdb0a\\.system_generated\\logs\\overview.txt', 'utf8');

// Find the last diff block for multi_replace_file_content that failed.
const lines = logs.split('\n');
let diffStart = -1;
let diffEnd = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('[diff_block_start]')) {
    if (lines[i+1] && lines[i+1].includes('@@ -275,50 +275,59 @@')) {
      diffStart = i;
      break;
    }
  }
}

if (diffStart !== -1) {
  for (let i = diffStart; i < lines.length; i++) {
    if (lines[i].includes('[diff_block_end]')) {
      diffEnd = i;
      break;
    }
  }
  
  const diffLines = lines.slice(diffStart + 1, diffEnd);
  const deletedLines = [];
  let inSecondChunk = false;
  
  for (let l of diffLines) {
    if (l.startsWith('@@ -343,199 +343,76 @@')) {
      inSecondChunk = true;
      continue;
    }
    if (inSecondChunk) {
      if (l.startsWith('-')) {
        deletedLines.push(l.substring(1)); // Remove the '-'
      }
    }
  }
  
  console.log('Found', deletedLines.length, 'deleted lines');
  
  // Now reconstruct the block
  const missingText = deletedLines.join('\n');
  fs.writeFileSync('missing_code.txt', missingText);
  console.log('Saved to missing_code.txt');
  
} else {
  console.log('Could not find the diff block');
}
