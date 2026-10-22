const fs = require('fs');
let css = fs.readFileSync('frontend/css/mailer.css', 'utf8');

const replacements = {
  '#fff': 'var(--bg-surface)',
  '#ffffff': 'var(--bg-surface)',
  '#f1f5f9': 'var(--bg-base)',
  '#e2e8f0': 'var(--border)',
  '#f8fafc': 'var(--bg-elevated)',
  '#0f172a': 'var(--text-primary)',
  '#334155': 'var(--text-primary)',
  '#374151': 'var(--text-primary)',
  '#64748b': 'var(--text-secondary)',
  '#94a3b8': 'var(--text-muted)',
  '#cbd5e1': 'var(--border-med)',
  '#185FA5': 'var(--accent)',
  '#eff6ff': 'var(--accent-glow)',
  '#16a34a': 'var(--green)',
  '#dcfce7': 'var(--green-bg)',
  '#ea580c': 'var(--yellow)',
  '#fff7ed': 'var(--yellow-bg)',
  '#1d4ed8': 'var(--blue)',
  '#dbeafe': 'var(--blue-bg)',
  '#dc2626': 'var(--red)',
  '#fff1f2': 'var(--red-bg)',
  '#f0fdf4': 'var(--green-bg)'
};

for (const [hex, variable] of Object.entries(replacements)) {
  const regex = new RegExp(hex + '(?![0-9a-fA-F])', 'gi');
  css = css.replace(regex, variable);
}

fs.writeFileSync('frontend/css/mailer.css', css);
console.log('Colors replaced.');
