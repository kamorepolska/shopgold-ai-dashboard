const fs = require('fs');
const logs = fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\f37a8d24-74ee-4d87-b0ce-1e0d852fdb0a\\.system_generated\\logs\\overview.txt', 'utf8');

const matches = [...logs.matchAll(/function bindSupplierActions\(list\) \{[\s\S]{1,8000}\}\);\s+\}/g)];
if (matches.length > 0) {
  const lastMatch = matches[matches.length - 1][0];
  let unescaped = lastMatch.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"');
  fs.writeFileSync('restored_block.txt', unescaped);
  console.log('Saved restored_block.txt, size:', unescaped.length);
} else {
  console.log('Could not match full function');
}
