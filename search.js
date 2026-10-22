const fs = require('fs');
const lines = fs.readFileSync('backend/services/sourcingService.js', 'latin1').split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('getAttrManager') || lines[i].includes('mergeManagerAttr') || lines[i].includes('updateCategoryAttrUnit')) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
  }
}
