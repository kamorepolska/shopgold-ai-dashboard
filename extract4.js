const fs = require('fs');
const logs = fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\f37a8d24-74ee-4d87-b0ce-1e0d852fdb0a\\.system_generated\\logs\\overview.txt', 'utf8');

const lines = logs.split('\n');
let bestContent = '';

for (const line of lines) {
  if (line.includes('view_file')) {
    try {
      const parsed = JSON.parse(line);
      const content = parsed.output || parsed.content;
      if (content && typeof content === 'string' && content.includes('function bindSupplierActions(list) {')) {
        bestContent = content;
        break; // Found it!
      }
    } catch(e) {}
  }
}

if (bestContent) {
  fs.writeFileSync('restored_block.txt', bestContent);
  console.log('Saved to restored_block.txt, size:', bestContent.length);
} else {
  console.log('Still not found');
}
