const fs = require('fs');
let c = fs.readFileSync('frontend/js/sourcing.js', 'utf8');

const replacement = `  /* ═══════════════════════════════════════════════════════
     EXPORT API
  ═══════════════════════════════════════════════════════ */
  async function _saveSupConfig(id) {
      const c   = document.getElementById('cfg-currency').value;
      const r   = document.getElementById('cfg-rate').value;
      const cs  = document.getElementById('cfg-cols').value;
      const u   = document.getElementById('cfg-url-user')?.value || '';
      const p   = document.getElementById('cfg-url-pass')?.value || '';
      try {
        if (cs) JSON.parse(cs); // walidacja
        await API.patch(\`/sourcing/suppliers/\${id}\`, {
          currency: c, exchange_rate: r, col_settings: cs,
          url_user: u, url_pass: p
        });
        Toast.success('Zapisano ustawienia');
        Modal.hide();
        renderSuppliers();
      } catch(e) { Toast.error(e.message); }
  }

  function _setSourceType(type) {
      if(typeof _sourceType !== 'undefined') _sourceType = type;
      document.querySelectorAll('#sup-source-tabs button').forEach(b => b.classList.remove('active'));
      const el = document.getElementById(\`st-\${type}\`);
      if(el) el.classList.add('active');
      const w1 = document.getElementById('sup-url-wrap'); if(w1) w1.style.display  = type==='url'?'block':'none';
      const w2 = document.getElementById('sup-url-auth-wrap'); if(w2) w2.style.display = type==='url'?'block':'none';
      const w3 = document.getElementById('sup-file-wrap'); if(w3) w3.style.display = type==='file'?'block':'none';
      const w4 = document.getElementById('sup-ftp-wrap'); if(w4) w4.style.display  = type==='ftp'?'block':'none';
  }

  const api = {
    render,
    _saveSupConfig,
    _setSourceType
  };

  window.SourcingView = api;
  return api;
})();`;

// Find `window.SourcingView = api;`
if (c.includes('window.SourcingView = api;\r\n  return api;\r\n})();')) {
  c = c.replace('window.SourcingView = api;\r\n  return api;\r\n})();', replacement);
} else if (c.includes('window.SourcingView = api;\n  return api;\n})();')) {
  c = c.replace('window.SourcingView = api;\n  return api;\n})();', replacement);
} else {
  console.log("Could not find the target text at the end of the file.");
  process.exit(1);
}

fs.writeFileSync('frontend/js/sourcing.js', c);
console.log('Successfully injected API export');
