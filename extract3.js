const fs = require('fs');
const logs = fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\f37a8d24-74ee-4d87-b0ce-1e0d852fdb0a\\.system_generated\\logs\\overview.txt', 'utf8');

const lines = logs.split('\n');
let bestContent = '';

for (const line of lines) {
  if (line.includes('function bindSupplierActions(list) {')) {
    // try to parse JSON
    try {
      const parsed = JSON.parse(line);
      const text = parsed.content || parsed.output || parsed.args?.CodeContent || '';
      if (text.includes('function bindSupplierActions(list) {') && text.includes("document.getElementById('sup-add-btn').addEventListener('click'")) {
        // extract the function
        const start = text.indexOf('function bindSupplierActions(list) {');
        const end = text.indexOf("document.getElementById('sup-add-btn').addEventListener('click'", start);
        if (start > -1 && end > -1) {
           bestContent = text.substring(start, end);
        }
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
