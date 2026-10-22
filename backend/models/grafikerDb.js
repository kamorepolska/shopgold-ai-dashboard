const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/database.sqlite');

// Upewnij się, że katalog data istnieje
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: null });

// Upewnij się, że katalog uploads istnieje
const uploadsDir = path.join(__dirname, '../../frontend/grafiker-uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Inicjalizacja tabeli
db.exec(`
  CREATE TABLE IF NOT EXISTS saved_graphics (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    prompt TEXT,
    model TEXT,
    format TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const grafikerOps = {
  findAll: (limit = 100, offset = 0) => {
    return db.prepare(`SELECT * FROM saved_graphics ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
  },

  findById: (id) => {
    return db.prepare(`SELECT * FROM saved_graphics WHERE id = ?`).get(id);
  },

  add: (data) => {
    const stmt = db.prepare(`
      INSERT INTO saved_graphics (id, filename, prompt, model, format, created_at)
      VALUES (@id, @filename, @prompt, @model, @format, @created_at)
    `);
    const id = require('crypto').randomUUID();
    const created_at = new Date().toISOString();
    stmt.run({ id, created_at, ...data });
    return this.findById ? this.findById(id) : grafikerOps.findById(id);
  },

  remove: (id) => {
    const record = db.prepare(`SELECT * FROM saved_graphics WHERE id = ?`).get(id);
    if (record) {
      const filePath = path.join(uploadsDir, record.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      db.prepare(`DELETE FROM saved_graphics WHERE id = ?`).run(id);
    }
    return true;
  }
};

module.exports = { grafikerOps };
