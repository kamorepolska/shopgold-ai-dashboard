/**
 * Patch executor: adds /api/run-patch endpoint to the server temporarily
 * OR run this directly: node run_patch_now.js
 */
'use strict';
const { execSync } = require('child_process');
const path = require('path');

console.log('Running patch_mapping_modal.js...');
try {
  const result = execSync('node patch_mapping_modal.js', {
    cwd: path.join(__dirname),
    encoding: 'utf8',
    timeout: 30000
  });
  console.log(result);
} catch(e) {
  console.error('patch_mapping_modal failed:', e.message);
}

console.log('Running patch_wholesaler_mapping.js...');
try {
  const result2 = execSync('node patch_wholesaler_mapping.js', {
    cwd: path.join(__dirname),
    encoding: 'utf8',
    timeout: 30000
  });
  console.log(result2);
} catch(e) {
  console.error('patch_wholesaler_mapping failed:', e.message);
}

console.log('Done. Restart the server for changes to take effect.');
