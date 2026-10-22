const fs = require('fs');
let code = fs.readFileSync('backend/services/sourcingService.js', 'utf8');

const missingFns = `// ═══ ATTRIBUTE ALIAS CRUD ═══════════════════════════════════════════════════

function listAttrAliases() {
  try { return getDb().prepare('SELECT * FROM attr_aliases ORDER BY canonical_name, alias').all(); }
  catch(_) { return []; }
}

function addAttrAlias(alias, canonical_name) {
  if (!alias || !canonical_name) throw new Error('Alias i nazwa kanoniczna są wymagane');
  getDb().prepare('INSERT OR REPLACE INTO attr_aliases (alias, canonical_name) VALUES (?, ?)').run(alias.trim(), canonical_name.trim());
  invalidateAttrAliasCache();
  return { ok: true };
}

function deleteAttrAlias(id) {
  getDb().prepare('DELETE FROM attr_aliases WHERE id = ?').run(id);
  invalidateAttrAliasCache();
  return { ok: true };
}

function mergeAttrAliases(aliases, canonical_name) {
  if (!aliases || !Array.isArray(aliases) || aliases.length === 0 || !canonical_name) {
    throw new Error('Tablica aliasów i nazwa kanoniczna są wymagane');
  }
  
  const db = getDb();
  const insertAlias = db.prepare('INSERT OR REPLACE INTO attr_aliases (alias, canonical_name) VALUES (?, ?)');
  
  db.transaction(() => {
    for (const alias of aliases) {
      const trimmedAlias = String(alias).trim();
      const trimmedCanon = String(canonical_name).trim();
      if (!trimmedAlias) continue;
      
      if (trimmedAlias.toLowerCase() !== trimmedCanon.toLowerCase()) {
        insertAlias.run(trimmedAlias, trimmedCanon);
      }
    }
  })();
  
  invalidateAttrAliasCache();
  return { ok: true };
}

module.exports = {`;

code = code.replace('module.exports = {', missingFns);
fs.writeFileSync('backend/services/sourcingService.js', code);
console.log('Restored ATTRIBUTE ALIAS CRUD');
