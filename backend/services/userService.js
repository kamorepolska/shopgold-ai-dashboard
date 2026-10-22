'use strict';
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '../../data/users.db');
let _db = null;

function getDb() {
  if (_db) return _db;
  const Database = require('better-sqlite3');
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  initSchema(_db);
  return _db;
}

const SECTIONS = ['dashboard','pim','approval','campaigns','settings','seo','sourcing','profitability','chats','bloger','grafiker','mailer','oferter','unlisted'];
const COMPANIES = ['idealpc','prymus','kamore'];

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      display_name  TEXT    NOT NULL DEFAULT '',
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'user',
      permissions   TEXT    NOT NULL DEFAULT '[]',
      company_access TEXT   NOT NULL DEFAULT '["idealpc","prymus","kamore"]',
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    DEFAULT (datetime('now')),
      updated_at    TEXT    DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      username   TEXT,
      company    TEXT,
      action     TEXT,
      module     TEXT,
      detail     TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_logs_user ON user_logs(username);
    CREATE INDEX IF NOT EXISTS idx_logs_ts   ON user_logs(created_at);
  `);

  // Seed admin if no users
  const count = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  if (count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    const allPerms = JSON.stringify(SECTIONS);
    const allCo   = JSON.stringify(COMPANIES);
    db.prepare(`INSERT INTO users (username,display_name,password_hash,role,permissions,company_access)
                VALUES (?,?,?,?,?,?)`).run('admin','Administrator',hash,'admin',allPerms,allCo);
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function login(username, password) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(username);
  if (!user) throw new Error('Nieprawidłowy login lub hasło');
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) throw new Error('Nieprawidłowy login lub hasło');
  return sanitize(user);
}

function getUserById(id) {
  const u = getDb().prepare('SELECT * FROM users WHERE id=?').get(id);
  return u ? sanitize(u) : null;
}

function getUserByUsername(username) {
  const u = getDb().prepare('SELECT * FROM users WHERE username=?').get(username);
  return u ? sanitize(u) : null;
}

function sanitize(u) {
  const { password_hash, ...rest } = u;
  rest.permissions   = parseJSON(rest.permissions,   []);
  rest.company_access= parseJSON(rest.company_access, COMPANIES);
  return rest;
}

function parseJSON(v, def) {
  try { return JSON.parse(v); } catch { return def; }
}

// ─── Users CRUD ───────────────────────────────────────────────────────────────

function listUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY username').all().map(sanitize);
}

function createUser({ username, display_name, password, role = 'user', permissions = [], company_access = COMPANIES }) {
  if (!username || !password) throw new Error('Login i hasło są wymagane');
  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);
  const res = db.prepare(`INSERT INTO users (username,display_name,password_hash,role,permissions,company_access)
    VALUES (?,?,?,?,?,?)`).run(
    username.trim(), display_name || username,
    hash, role,
    JSON.stringify(permissions),
    JSON.stringify(company_access)
  );
  return { id: res.lastInsertRowid };
}

function updateUser(id, data) {
  const db = getDb();
  const fields = [], vals = [];
  if (data.display_name !== undefined) { fields.push('display_name=?'); vals.push(data.display_name); }
  if (data.role         !== undefined) { fields.push('role=?');         vals.push(data.role); }
  if (data.active       !== undefined) { fields.push('active=?');       vals.push(data.active ? 1 : 0); }
  if (data.permissions  !== undefined) { fields.push('permissions=?');  vals.push(JSON.stringify(data.permissions)); }
  if (data.company_access !== undefined) { fields.push('company_access=?'); vals.push(JSON.stringify(data.company_access)); }
  if (data.password) {
    fields.push('password_hash=?');
    vals.push(bcrypt.hashSync(data.password, 10));
  }
  if (!fields.length) return;
  fields.push("updated_at=datetime('now')");
  db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).run(...vals, id);
}

function deleteUser(id) {
  getDb().prepare('DELETE FROM users WHERE id=?').run(id);
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

function addLog({ user_id, username, company, action, module, detail }) {
  getDb().prepare(`INSERT INTO user_logs (user_id,username,company,action,module,detail)
    VALUES (?,?,?,?,?,?)`).run(user_id||null, username||'?', company||'', action||'', module||'', detail||'');
}

function getLogs({ username, company, module, limit = 200, offset = 0 } = {}) {
  const db = getDb();
  const conds = [], params = [];
  if (username) { conds.push('username=?'); params.push(username); }
  if (company)  { conds.push('company=?');  params.push(company); }
  if (module)   { conds.push('module=?');   params.push(module); }
  const where = conds.length ? 'WHERE '+conds.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) as n FROM user_logs ${where}`).get(...params).n;
  const rows  = db.prepare(`SELECT * FROM user_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  return { rows, total };
}

module.exports = { login, getUserById, getUserByUsername, listUsers, createUser, updateUser, deleteUser, addLog, getLogs, SECTIONS, COMPANIES };
