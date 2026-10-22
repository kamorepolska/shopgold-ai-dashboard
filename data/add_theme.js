const fs = require('fs');
let data = fs.readFileSync('frontend/js/app.js', 'utf8');
const themeCode = `

// ===== THEME TOGGLE =====
(function initTheme() {
  const saved = localStorage.getItem('sg_theme') || 'dark';
  if (saved === 'light') document.body.classList.add('light-mode');
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle-btn');
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    function applyTheme(mode) {
      if (mode === 'light') {
        document.body.classList.add('light-mode');
        if (icon) icon.textContent = '\u{1F319}';
        if (label) label.textContent = 'Ciemny motyw';
      } else {
        document.body.classList.remove('light-mode');
        if (icon) icon.textContent = '\u2600\uFE0F';
        if (label) label.textContent = 'Jasny motyw';
      }
    }
    applyTheme(saved);
    if (btn) btn.addEventListener('click', () => {
      const cur = localStorage.getItem('sg_theme') || 'dark';
      const next = cur === 'dark' ? 'light' : 'dark';
      localStorage.setItem('sg_theme', next);
      applyTheme(next);
    });
  });
})();
`;
data = data + themeCode;
fs.writeFileSync('frontend/js/app.js', data);
console.log('Theme toggle added, size:', data.length);
