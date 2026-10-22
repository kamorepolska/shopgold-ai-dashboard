const { settingsOps, shopgoldInstanceOps } = require('./backend/models/localDb');

const db = require('./backend/models/localDb').getDb();

// Popraw ftp_user w settings
db.prepare("UPDATE settings SET value=?, updated_at=datetime('now') WHERE key=?").run('technik@idealpc.pl', 'ftp_user');

// Popraw ftp_user w instancji #2 (Ideał)
db.prepare("UPDATE shopgold_instances SET ftp_user=?, updated_at=datetime('now') WHERE id=2").run('technik@idealpc.pl');

console.log('Zaktualizowano! Aktualne ustawienia FTP:');
console.log(db.prepare("SELECT key, value FROM settings WHERE key LIKE 'ftp_%'").all());
console.log('Instancja #2 FTP:', db.prepare("SELECT ftp_host, ftp_user, ftp_pass, ftp_port FROM shopgold_instances WHERE id=2").get());
