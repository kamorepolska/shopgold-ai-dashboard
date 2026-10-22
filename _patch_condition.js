const fs = require('fs');
const filePath = 'backend/services/sourcingService.js';
let c = fs.readFileSync(filePath, 'utf8');

// Find the resolveAvailability function closing
const marker = "  return 'unknown';\r\n}\r\n";
const firstIdx = c.indexOf(marker);
if (firstIdx < 0) { console.log('ERROR: marker not found'); process.exit(1); }

const inject = "  return 'unknown';\r\n}\r\n\r\nfunction resolveCondition(raw) {\r\n  if (raw === null || raw === undefined) return 'new';\r\n  const s = String(raw).toLowerCase().trim();\r\n  if (['used','uzywany','u\u017cywany','uzywan','refurbished','odnowiony','poleasingowy','b/u','second hand','gebraucht'].includes(s)) return 'used';\r\n  if (['new','nowy','nowe','neu','nuevo','neuf'].includes(s)) return 'new';\r\n  return 'new';\r\n}\r\n";
c = c.substring(0, firstIdx) + inject + c.substring(firstIdx + marker.length);

fs.writeFileSync(filePath, c);
console.log('resolveCondition injected successfully');
