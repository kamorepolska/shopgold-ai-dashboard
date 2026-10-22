/* ═══════════════════════════════════════════════════════════════════════════
   crmService.js — CRM Database Service Layer
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const path = require('path');
const Database = require('better-sqlite3');

let _db = null;

function getDb() {
  if (_db) return _db;
  const dbPath = path.join(__dirname, '../../data.db');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initDb(_db);
  return _db;
}

/* ── Schema ──────────────────────────────────────────────────────────────── */
function initDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nip TEXT,
      address TEXT,
      city TEXT,
      postal_code TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crm_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      position TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS crm_team (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'member',
      avatar_color TEXT DEFAULT '#6366f1',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crm_task_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS crm_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status_id INTEGER DEFAULT 1,
      priority TEXT DEFAULT 'normal',
      progress INTEGER DEFAULT 0,
      assignee_id INTEGER,
      company_id INTEGER,
      contact_id INTEGER,
      deadline DATETIME,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      custom_fields TEXT DEFAULT '[]',
      FOREIGN KEY (status_id) REFERENCES crm_task_statuses(id),
      FOREIGN KEY (assignee_id) REFERENCES crm_team(id) ON DELETE SET NULL,
      FOREIGN KEY (company_id) REFERENCES crm_companies(id) ON DELETE SET NULL,
      FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS crm_time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      team_member_id INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      description TEXT,
      started_at DATETIME,
      ended_at DATETIME,
      is_manual INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES crm_tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (team_member_id) REFERENCES crm_team(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS crm_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_username TEXT NOT NULL,
      type TEXT DEFAULT 'mention',
      message TEXT NOT NULL,
      task_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crm_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crm_custom_field_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      field_type TEXT DEFAULT 'text',
      options TEXT DEFAULT '[]',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe migrations for columns added over time
  const migrations = [
    `ALTER TABLE crm_tasks ADD COLUMN custom_fields TEXT DEFAULT '[]'`,
    `ALTER TABLE crm_tasks ADD COLUMN project_id INTEGER REFERENCES crm_projects(id) ON DELETE SET NULL`,
    `ALTER TABLE crm_tasks ADD COLUMN time_from TEXT`,
    `ALTER TABLE crm_tasks ADD COLUMN time_to TEXT`,
    `ALTER TABLE crm_tasks ADD COLUMN location_type TEXT DEFAULT 'remote'`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch(e) { /* column already exists */ }
  }

  // Seed default statuses if empty
  const cnt = db.prepare('SELECT COUNT(*) as c FROM crm_task_statuses').get().c;
  if (cnt === 0) {
    const ins = db.prepare('INSERT INTO crm_task_statuses (name, color, sort_order, is_default) VALUES (?,?,?,?)');
    ins.run('Do zrobienia', '#6b7280', 0, 1);
    ins.run('W trakcie', '#3b82f6', 1, 0);
    ins.run('Czeka na klienta', '#f59e0b', 2, 0);
    ins.run('Zakończone', '#10b981', 3, 0);
  }

  // Seed default project if empty and migrate orphaned tasks
  const pCnt = db.prepare('SELECT COUNT(*) as c FROM crm_projects').get().c;
  if (pCnt === 0) {
    const r = db.prepare("INSERT INTO crm_projects (name, color, description, sort_order) VALUES (?,?,?,?)").run(
      'Główny Projekt', '#6366f1', 'Domyślny projekt CRM', 0
    );
    // Migrate existing tasks that have no project assigned
    db.prepare('UPDATE crm_tasks SET project_id=? WHERE project_id IS NULL').run(r.lastInsertRowid);
  } else {
    // Make sure all old tasks are in some project
    const firstProject = db.prepare('SELECT id FROM crm_projects ORDER BY sort_order ASC, id ASC LIMIT 1').get();
    if (firstProject) {
      db.prepare('UPDATE crm_tasks SET project_id=? WHERE project_id IS NULL').run(firstProject.id);
    }
  }
}

/* ── Companies CRUD ──────────────────────────────────────────────────────── */
function listCompanies({ search = '', page = 1, limit = 50 } = {}) {
  const db = getDb();
  let where = '1=1';
  const params = [];
  if (search) {
    where += ` AND (c.name LIKE ? OR c.nip LIKE ? OR c.email LIKE ? OR c.phone LIKE ?
      OR EXISTS (SELECT 1 FROM crm_contacts ct WHERE ct.company_id=c.id AND (ct.first_name||' '||ct.last_name LIKE ? OR ct.email LIKE ? OR ct.phone LIKE ?)))`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s, s);
  }
  const total = db.prepare(`SELECT COUNT(*) as c FROM crm_companies c WHERE ${where}`).get(...params).c;
  const offset = (page - 1) * limit;
  const rows = db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM crm_contacts WHERE company_id=c.id) as contact_count,
      (SELECT COUNT(*) FROM crm_tasks WHERE company_id=c.id) as task_count
    FROM crm_companies c WHERE ${where} ORDER BY c.name ASC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  return { companies: rows, total, page, limit };
}

function getCompany(id) {
  const db = getDb();
  const company = db.prepare('SELECT * FROM crm_companies WHERE id=?').get(id);
  if (!company) return null;
  company.contacts = db.prepare('SELECT * FROM crm_contacts WHERE company_id=? ORDER BY last_name').all(id);
  company.tasks = db.prepare(`
    SELECT t.*, s.name as status_name, s.color as status_color,
      tm.display_name as assignee_name
    FROM crm_tasks t
    LEFT JOIN crm_task_statuses s ON t.status_id=s.id
    LEFT JOIN crm_team tm ON t.assignee_id=tm.id
    WHERE t.company_id=? ORDER BY t.created_at DESC LIMIT 20
  `).all(id);
  return company;
}

function createCompany(data) {
  const db = getDb();
  const r = db.prepare(`INSERT INTO crm_companies (name, nip, address, city, postal_code, phone, email, website, notes)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    data.name, data.nip || null, data.address || null, data.city || null,
    data.postal_code || null, data.phone || null, data.email || null,
    data.website || null, data.notes || null
  );
  return { id: Number(r.lastInsertRowid) };
}

function updateCompany(id, data) {
  const db = getDb();
  db.prepare(`UPDATE crm_companies SET name=?, nip=?, address=?, city=?, postal_code=?,
    phone=?, email=?, website=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
    data.name, data.nip || null, data.address || null, data.city || null,
    data.postal_code || null, data.phone || null, data.email || null,
    data.website || null, data.notes || null, id
  );
  return { ok: true };
}

function deleteCompany(id) {
  const db = getDb();
  db.prepare('DELETE FROM crm_companies WHERE id=?').run(id);
  return { ok: true };
}

/* ── Contacts CRUD ───────────────────────────────────────────────────────── */
function listContacts({ search = '', company_id, page = 1, limit = 50 } = {}) {
  const db = getDb();
  let where = '1=1';
  const params = [];
  if (company_id) { where += ' AND ct.company_id=?'; params.push(company_id); }
  if (search) {
    where += ` AND (ct.first_name||' '||ct.last_name LIKE ? OR ct.email LIKE ? OR ct.phone LIKE ? OR ct.position LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  const total = db.prepare(`SELECT COUNT(*) as c FROM crm_contacts ct WHERE ${where}`).get(...params).c;
  const offset = (page - 1) * limit;
  const rows = db.prepare(`
    SELECT ct.*, c.name as company_name
    FROM crm_contacts ct LEFT JOIN crm_companies c ON ct.company_id=c.id
    WHERE ${where} ORDER BY ct.last_name ASC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  return { contacts: rows, total, page, limit };
}

function createContact(data) {
  const db = getDb();
  const r = db.prepare(`INSERT INTO crm_contacts (company_id, first_name, last_name, email, phone, position, notes)
    VALUES (?,?,?,?,?,?,?)`).run(
    data.company_id || null, data.first_name, data.last_name,
    data.email || null, data.phone || null, data.position || null, data.notes || null
  );
  return { id: Number(r.lastInsertRowid) };
}

function updateContact(id, data) {
  const db = getDb();
  db.prepare(`UPDATE crm_contacts SET company_id=?, first_name=?, last_name=?, email=?, phone=?, position=?, notes=? WHERE id=?`).run(
    data.company_id || null, data.first_name, data.last_name,
    data.email || null, data.phone || null, data.position || null, data.notes || null, id
  );
  return { ok: true };
}

function deleteContact(id) {
  const db = getDb();
  db.prepare('DELETE FROM crm_contacts WHERE id=?').run(id);
  return { ok: true };
}

/* ── Team CRUD ───────────────────────────────────────────────────────────── */
function listTeam() {
  const db = getDb();
  return db.prepare(`SELECT t.*,
    (SELECT COUNT(*) FROM crm_tasks WHERE assignee_id=t.id AND completed_at IS NULL) as open_tasks,
    (SELECT COALESCE(SUM(duration_minutes),0) FROM crm_time_entries WHERE team_member_id=t.id) as total_minutes
  FROM crm_team t WHERE t.is_active=1 ORDER BY t.display_name`).all();
}

function createTeamMember(data) {
  const db = getDb();
  const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const r = db.prepare('INSERT INTO crm_team (username, display_name, email, role, avatar_color) VALUES (?,?,?,?,?)').run(
    data.username, data.display_name, data.email || null, data.role || 'member', color
  );
  return { id: Number(r.lastInsertRowid) };
}

function updateTeamMember(id, data) {
  const db = getDb();
  db.prepare('UPDATE crm_team SET display_name=?, email=?, role=?, is_active=? WHERE id=?').run(
    data.display_name, data.email || null, data.role || 'member', data.is_active ?? 1, id
  );
  return { ok: true };
}

function deleteTeamMember(id) {
  const db = getDb();
  db.prepare('UPDATE crm_team SET is_active=0 WHERE id=?').run(id);
  return { ok: true };
}

/* ── Task Statuses ───────────────────────────────────────────────────────── */
function listStatuses() {
  return getDb().prepare('SELECT * FROM crm_task_statuses ORDER BY sort_order').all();
}
function createStatus(data) {
  const db = getDb();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM crm_task_statuses').get().m || 0;
  const r = db.prepare('INSERT INTO crm_task_statuses (name, color, sort_order) VALUES (?,?,?)').run(
    data.name, data.color || '#6366f1', maxOrder + 1
  );
  return { id: Number(r.lastInsertRowid) };
}
function updateStatus(id, data) {
  getDb().prepare('UPDATE crm_task_statuses SET name=?, color=?, sort_order=? WHERE id=?').run(
    data.name, data.color || '#6366f1', data.sort_order ?? 0, id
  );
  return { ok: true };
}
function deleteStatus(id) {
  const db = getDb();
  const fallback = db.prepare('SELECT id FROM crm_task_statuses WHERE id != ? ORDER BY is_default DESC, sort_order ASC LIMIT 1').get(id);
  if (fallback) {
    db.prepare('UPDATE crm_tasks SET status_id=? WHERE status_id=?').run(fallback.id, id);
  }
  db.prepare('DELETE FROM crm_task_statuses WHERE id=?').run(id);
  return { ok: true };
}

/* ── Tasks CRUD ──────────────────────────────────────────────────────────── */
function listTasks({ search = '', status_id, priority, assignee_id, project_id, assignee_username, page = 1, limit = 50 } = {}) {
  const db = getDb();
  let where = '1=1';
  const params = [];
  if (search) { where += ' AND (t.title LIKE ? OR t.description LIKE ?)'; const s = `%${search}%`; params.push(s, s); }
  if (status_id) { where += ' AND t.status_id=?'; params.push(status_id); }
  if (priority) { where += ' AND t.priority=?'; params.push(priority); }
  if (assignee_id) { where += ' AND t.assignee_id=?'; params.push(assignee_id); }
  if (project_id) { where += ' AND t.project_id=?'; params.push(project_id); }
  if (assignee_username) {
    where += ' AND t.assignee_id = (SELECT id FROM crm_team WHERE username = ?)';
    params.push(assignee_username);
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM crm_tasks t WHERE ${where}`).get(...params).c;
  const offset = (page - 1) * limit;
  const rows = db.prepare(`
    SELECT t.*, s.name as status_name, s.color as status_color,
      tm.display_name as assignee_name, tm.avatar_color as assignee_color,
      c.name as company_name,
      ct.first_name||' '||ct.last_name as contact_name,
      p.name as project_name, p.color as project_color,
      (SELECT COALESCE(SUM(duration_minutes),0) FROM crm_time_entries WHERE task_id=t.id) as total_minutes
    FROM crm_tasks t
    LEFT JOIN crm_task_statuses s ON t.status_id=s.id
    LEFT JOIN crm_team tm ON t.assignee_id=tm.id
    LEFT JOIN crm_companies c ON t.company_id=c.id
    LEFT JOIN crm_contacts ct ON t.contact_id=ct.id
    LEFT JOIN crm_projects p ON t.project_id=p.id
    WHERE ${where}
    ORDER BY
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END,
      t.deadline ASC NULLS LAST, t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  return { tasks: rows, total, page, limit };
}

function getTask(id) {
  const db = getDb();
  const task = db.prepare(`
    SELECT t.*, s.name as status_name, s.color as status_color,
      tm.display_name as assignee_name, tm.avatar_color as assignee_color, tm.username as assignee_username,
      c.name as company_name, ct.first_name||' '||ct.last_name as contact_name,
      (SELECT COALESCE(SUM(duration_minutes),0) FROM crm_time_entries WHERE task_id=t.id) as total_minutes
    FROM crm_tasks t
    LEFT JOIN crm_task_statuses s ON t.status_id=s.id
    LEFT JOIN crm_team tm ON t.assignee_id=tm.id
    LEFT JOIN crm_companies c ON t.company_id=c.id
    LEFT JOIN crm_contacts ct ON t.contact_id=ct.id
    WHERE t.id=?
  `).get(id);
  if (!task) return null;
  task.time_entries = db.prepare(`
    SELECT te.*, tm.display_name as member_name
    FROM crm_time_entries te
    LEFT JOIN crm_team tm ON te.team_member_id=tm.id
    WHERE te.task_id=? ORDER BY te.created_at DESC
  `).all(id);
  return task;
}

function createTask(data) {
  const db = getDb();
  const customFields = typeof data.custom_fields === 'string' ? data.custom_fields : JSON.stringify(data.custom_fields || []);
  const r = db.prepare(`INSERT INTO crm_tasks (title, description, status_id, priority, assignee_id, company_id, contact_id, deadline, created_by, custom_fields, project_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    data.title, data.description || null,
    data.status_id || 1, data.priority || 'normal',
    data.assignee_id || null, data.company_id || null, data.contact_id || null,
    data.deadline || null, data.created_by || null,
    customFields, data.project_id || null
  );
  const taskId = Number(r.lastInsertRowid);

  // Process @mentions in description
  if (data.description) {
    processMentions(data.description, taskId, data.created_by);
  }

  // Notify assignee
  if (data.assignee_id) {
    const member = db.prepare('SELECT username FROM crm_team WHERE id=?').get(data.assignee_id);
    if (member && member.username !== data.created_by) {
      db.prepare('INSERT INTO crm_notifications (recipient_username, type, message, task_id) VALUES (?,?,?,?)').run(
        member.username, 'assignment', `Przypisano Ci zadanie: "${data.title}"`, taskId
      );
      try {
        const globalNotif = require('./notificationService');
        globalNotif.addNotification(
          'Przypisano zadanie CRM',
          `Przypisano Ci zadanie: "${data.title}"`,
          'info',
          'crm',
          member.username
        );
      } catch (err) {
        console.error('[CRM Assignment] Failed to trigger global notification:', err);
      }
    }
  }

  return { id: taskId };
}

function updateTask(id, data) {
  const db = getDb();
  const old = db.prepare('SELECT * FROM crm_tasks WHERE id=?').get(id);
  if (!old) return { ok: false };

  const completedAt = data.status_id
    ? (function() {
        const st = db.prepare('SELECT name FROM crm_task_statuses WHERE id=?').get(data.status_id);
        return st && st.name.toLowerCase().includes('zakończon') ? new Date().toISOString() : old.completed_at;
      })()
    : old.completed_at;

  const customFields = data.custom_fields !== undefined
    ? (typeof data.custom_fields === 'string' ? data.custom_fields : JSON.stringify(data.custom_fields || []))
    : old.custom_fields;

  db.prepare(`UPDATE crm_tasks SET title=?, description=?, status_id=?, priority=?, progress=?,
    assignee_id=?, company_id=?, contact_id=?, deadline=?, updated_at=CURRENT_TIMESTAMP, completed_at=?, custom_fields=?, project_id=? WHERE id=?`).run(
    data.title ?? old.title, data.description ?? old.description,
    data.status_id ?? old.status_id, data.priority ?? old.priority,
    data.progress ?? old.progress,
    data.assignee_id ?? old.assignee_id, data.company_id ?? old.company_id,
    data.contact_id ?? old.contact_id, data.deadline ?? old.deadline,
    completedAt, customFields, data.project_id ?? old.project_id, id
  );

  // Process new @mentions
  if (data.description && data.description !== old.description) {
    processMentions(data.description, id, data.updated_by);
  }

  return { ok: true };
}

function updateTaskProgress(id, progress) {
  getDb().prepare('UPDATE crm_tasks SET progress=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(progress, id);
  return { ok: true };
}

function deleteTask(id) {
  getDb().prepare('DELETE FROM crm_tasks WHERE id=?').run(id);
  return { ok: true };
}

/* ── Time Entries ────────────────────────────────────────────────────────── */
function listTimeEntries(taskId) {
  return getDb().prepare(`
    SELECT te.*, tm.display_name as member_name, tm.avatar_color
    FROM crm_time_entries te
    LEFT JOIN crm_team tm ON te.team_member_id=tm.id
    WHERE te.task_id=? ORDER BY te.created_at DESC
  `).all(taskId);
}

function createTimeEntry(data) {
  const db = getDb();
  const r = db.prepare(`INSERT INTO crm_time_entries (task_id, team_member_id, duration_minutes, description, started_at, ended_at, is_manual)
    VALUES (?,?,?,?,?,?,?)`).run(
    data.task_id, data.team_member_id, data.duration_minutes,
    data.description || null, data.started_at || null, data.ended_at || null,
    data.is_manual ? 1 : 0
  );
  return { id: Number(r.lastInsertRowid) };
}

function deleteTimeEntry(id) {
  getDb().prepare('DELETE FROM crm_time_entries WHERE id=?').run(id);
  return { ok: true };
}

/* ── Notifications ───────────────────────────────────────────────────────── */
function listNotifications(username) {
  return getDb().prepare(
    'SELECT * FROM crm_notifications WHERE recipient_username=? ORDER BY created_at DESC LIMIT 50'
  ).all(username);
}

function markNotificationRead(id) {
  getDb().prepare('UPDATE crm_notifications SET is_read=1 WHERE id=?').run(id);
  return { ok: true };
}

function markAllNotificationsRead(username) {
  getDb().prepare('UPDATE crm_notifications SET is_read=1 WHERE recipient_username=?').run(username);
  return { ok: true };
}

function getUnreadCount(username) {
  return getDb().prepare('SELECT COUNT(*) as c FROM crm_notifications WHERE recipient_username=? AND is_read=0').get(username).c;
}

/* ── @Mention parser ─────────────────────────────────────────────────────── */
function processMentions(text, taskId, authorUsername) {
  const db = getDb();
  const mentions = text.match(/@(\w+)/g);
  if (!mentions) return;
  const task = db.prepare('SELECT title FROM crm_tasks WHERE id=?').get(taskId);
  const seen = new Set();
  for (const m of mentions) {
    const username = m.slice(1);
    if (seen.has(username) || username === authorUsername) continue;
    seen.add(username);
    const member = db.prepare('SELECT id FROM crm_team WHERE username=?').get(username);
    if (member) {
      db.prepare('INSERT INTO crm_notifications (recipient_username, type, message, task_id) VALUES (?,?,?,?)').run(
        username, 'mention', `${authorUsername || 'Ktoś'} oznaczył Cię w zadaniu: "${task?.title || 'Zadanie #'+taskId}"`, taskId
      );
      try {
        const globalNotif = require('./notificationService');
        globalNotif.addNotification(
          'Oznaczono Cię w zadaniu CRM',
          `${authorUsername || 'Ktoś'} oznaczył Cię w zadaniu: "${task?.title || 'Zadanie #'+taskId}"`,
          'info',
          'crm',
          username
        );
      } catch (err) {
        console.error('[CRM Mentions] Failed to trigger global notification:', err);
      }
    }
  }
}

/* ── Dashboard stats ─────────────────────────────────────────────────────── */
function getDashboardStats(username) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  
  let teamMemberId = null;
  if (username) {
    const member = db.prepare('SELECT id FROM crm_team WHERE username=?').get(username);
    if (member) teamMemberId = member.id;
  }

  const baseStats = {
    total_companies: db.prepare('SELECT COUNT(*) as c FROM crm_companies').get().c,
    total_contacts: db.prepare('SELECT COUNT(*) as c FROM crm_contacts').get().c,
    total_tasks: db.prepare('SELECT COUNT(*) as c FROM crm_tasks').get().c,
    open_tasks: db.prepare('SELECT COUNT(*) as c FROM crm_tasks WHERE completed_at IS NULL').get().c,
    tasks_due_today: db.prepare('SELECT COUNT(*) as c FROM crm_tasks WHERE deadline BETWEEN ? AND ? AND completed_at IS NULL').get(today, tomorrow).c,
    overdue_tasks: db.prepare('SELECT COUNT(*) as c FROM crm_tasks WHERE deadline < ? AND completed_at IS NULL').get(today).c,
    total_hours: Math.round((db.prepare('SELECT COALESCE(SUM(duration_minutes),0) as m FROM crm_time_entries').get().m || 0) / 60 * 10) / 10,
    team_count: db.prepare('SELECT COUNT(*) as c FROM crm_team WHERE is_active=1').get().c,
  };

  if (teamMemberId !== null) {
    baseStats.my_open_tasks = db.prepare('SELECT COUNT(*) as c FROM crm_tasks WHERE assignee_id=? AND completed_at IS NULL').get(teamMemberId).c;
    baseStats.my_tasks_due_today = db.prepare('SELECT COUNT(*) as c FROM crm_tasks WHERE assignee_id=? AND deadline BETWEEN ? AND ? AND completed_at IS NULL').get(teamMemberId, today, tomorrow).c;
    baseStats.my_overdue_tasks = db.prepare('SELECT COUNT(*) as c FROM crm_tasks WHERE assignee_id=? AND deadline < ? AND completed_at IS NULL').get(teamMemberId, today).c;
  } else {
    baseStats.my_open_tasks = 0;
    baseStats.my_tasks_due_today = 0;
    baseStats.my_overdue_tasks = 0;
  }

  return baseStats;
}

/* ── Global search ───────────────────────────────────────────────────────── */
function globalSearch(query) {
  const db = getDb();
  const s = `%${query}%`;
  const companies = db.prepare(`SELECT id, name, nip, phone, email, 'company' as type FROM crm_companies
    WHERE name LIKE ? OR nip LIKE ? OR email LIKE ? OR phone LIKE ? LIMIT 10`).all(s, s, s, s);
  const contacts = db.prepare(`SELECT ct.id, ct.first_name||' '||ct.last_name as name, ct.phone, ct.email,
    ct.position, c.name as company_name, ct.company_id, 'contact' as type
    FROM crm_contacts ct LEFT JOIN crm_companies c ON ct.company_id=c.id
    WHERE ct.first_name||' '||ct.last_name LIKE ? OR ct.email LIKE ? OR ct.phone LIKE ? LIMIT 10`).all(s, s, s);
  const tasks = db.prepare(`SELECT id, title as name, priority, 'task' as type FROM crm_tasks
    WHERE title LIKE ? OR description LIKE ? LIMIT 10`).all(s, s);
  return { companies, contacts, tasks };
}

/* ── Projects CRUD ───────────────────────────────────────────────────────── */
function listProjects() {
  return getDb().prepare('SELECT p.*, (SELECT COUNT(*) FROM crm_tasks WHERE project_id=p.id) as task_count FROM crm_projects p ORDER BY p.sort_order ASC, p.id ASC').all();
}

function createProject(data) {
  const db = getDb();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM crm_projects').get().m;
  const r = db.prepare('INSERT INTO crm_projects (name, color, description, sort_order) VALUES (?,?,?,?)').run(
    data.name, data.color || '#6366f1', data.description || null, maxOrder + 1
  );
  return { id: Number(r.lastInsertRowid) };
}

function updateProject(id, data) {
  getDb().prepare('UPDATE crm_projects SET name=?, color=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(
    data.name, data.color || '#6366f1', data.description || null, id
  );
  return { ok: true };
}

function deleteProject(id) {
  const db = getDb();
  // Move tasks to another project before deleting
  const fallback = db.prepare('SELECT id FROM crm_projects WHERE id != ? ORDER BY sort_order ASC, id ASC LIMIT 1').get(id);
  if (fallback) {
    db.prepare('UPDATE crm_tasks SET project_id=? WHERE project_id=?').run(fallback.id, id);
  } else {
    db.prepare('DELETE FROM crm_tasks WHERE project_id=?').run(id);
  }
  db.prepare('DELETE FROM crm_projects WHERE id=?').run(id);
  return { ok: true };
}

/* ── Custom Field Definitions CRUD ──────────────────────────────────────── */
function listCustomFieldDefs() {
  return getDb().prepare('SELECT * FROM crm_custom_field_definitions ORDER BY sort_order ASC, id ASC').all();
}

function createCustomFieldDef(data) {
  const db = getDb();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM crm_custom_field_definitions').get().m;
  const r = db.prepare(
    'INSERT INTO crm_custom_field_definitions (name, field_type, options, sort_order) VALUES (?,?,?,?)'
  ).run(
    data.name,
    data.field_type || 'text',
    typeof data.options === 'string' ? data.options : JSON.stringify(data.options || []),
    maxOrder + 1
  );
  return { id: Number(r.lastInsertRowid) };
}

function updateCustomFieldDef(id, data) {
  getDb().prepare(
    'UPDATE crm_custom_field_definitions SET name=?, field_type=?, options=?, sort_order=? WHERE id=?'
  ).run(
    data.name,
    data.field_type || 'text',
    typeof data.options === 'string' ? data.options : JSON.stringify(data.options || []),
    data.sort_order ?? 0,
    id
  );
  return { ok: true };
}

function deleteCustomFieldDef(id) {
  getDb().prepare('DELETE FROM crm_custom_field_definitions WHERE id=?').run(id);
  return { ok: true };
}

function ensureUserInTeam(username) {
  if (!username) return;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM crm_team WHERE username=?').get(username);
  if (existing) return;

  try {
    const userSvc = require('./userService');
    const user = userSvc.getUserByUsername(username);
    if (user) {
      const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      db.prepare('INSERT OR IGNORE INTO crm_team (username, display_name, role, avatar_color) VALUES (?,?,?,?)').run(
        user.username,
        user.display_name || user.username,
        user.role === 'admin' ? 'admin' : 'member',
        color
      );
      console.log(`[CRM Sync] Pomyślnie zsynchronizowano użytkownika: ${username} z ekipą CRM`);
    }
  } catch (err) {
    console.error(`[CRM Sync] Błąd automatycznej synchronizacji ekipy dla użytkownika ${username}:`, err);
  }
}

/* ── Import / Export ─────────────────────────────────────────────────────── */
function importCompanies(rows, mode = 'upsert') {
  const db = getDb();
  let inserted = 0, updated = 0, skipped = 0;
  const insertStmt = db.prepare(`INSERT INTO crm_companies (name, nip, address, city, postal_code, phone, email, website, notes) VALUES (?,?,?,?,?,?,?,?,?)`);
  const updateStmt = db.prepare(`UPDATE crm_companies SET name=?, address=?, city=?, postal_code=?, phone=?, email=?, website=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE nip=?`);
  const findByNip   = db.prepare('SELECT id FROM crm_companies WHERE nip=?');
  const findByName  = db.prepare('SELECT id FROM crm_companies WHERE LOWER(TRIM(name))=LOWER(TRIM(?))');

  const runImport = db.transaction(() => {
    for (const row of rows) {
      const name = (row.name || '').trim();
      if (!name) { skipped++; continue; }
      const nip  = (row.nip  || '').toString().replace(/[^0-9]/g, '') || null;
      const notes = [row.notes, row.summary].filter(Boolean).join('\n\n').trim() || null;

      // Try to find existing record
      let existing = null;
      if (nip) existing = findByNip.get(nip);
      if (!existing) existing = findByName.get(name);

      if (existing && mode === 'skip') { skipped++; continue; }

      if (existing && (mode === 'upsert' || mode === 'update')) {
        updateStmt.run(name, row.address||null, row.city||null, row.postal_code||null,
          row.phone||null, row.email||null, row.website||null, notes, nip || name);
        updated++;
      } else if (!existing) {
        insertStmt.run(name, nip, row.address||null, row.city||null, row.postal_code||null,
          row.phone||null, row.email||null, row.website||null, notes);
        inserted++;
      }
    }
  });
  runImport();
  return { inserted, updated, skipped, total: rows.length };
}

function exportCompanies() {
  const db = getDb();
  return db.prepare(`
    SELECT c.id, c.name, c.nip, c.address, c.city, c.postal_code, c.phone, c.email, c.website, c.notes,
      c.created_at, c.updated_at,
      COUNT(DISTINCT ct.id) as contact_count,
      COUNT(DISTINCT t.id)  as task_count
    FROM crm_companies c
    LEFT JOIN crm_contacts ct ON ct.company_id=c.id
    LEFT JOIN crm_tasks t ON t.company_id=c.id
    GROUP BY c.id ORDER BY c.name ASC
  `).all();
}

function exportContacts() {
  const db = getDb();
  return db.prepare(`
    SELECT ct.id, ct.first_name, ct.last_name, ct.email, ct.phone, ct.position, ct.notes,
      c.name as company_name, c.nip as company_nip, ct.created_at
    FROM crm_contacts ct
    LEFT JOIN crm_companies c ON ct.company_id=c.id
    ORDER BY ct.last_name ASC
  `).all();
}

module.exports = {
  getDb, initDb,
  listCompanies, getCompany, createCompany, updateCompany, deleteCompany,
  listContacts, createContact, updateContact, deleteContact,
  listTeam, createTeamMember, updateTeamMember, deleteTeamMember,
  listStatuses, createStatus, updateStatus, deleteStatus,
  listProjects, createProject, updateProject, deleteProject,
  listTasks, getTask, createTask, updateTask, updateTaskProgress, deleteTask,
  listTimeEntries, createTimeEntry, deleteTimeEntry,
  listNotifications, markNotificationRead, markAllNotificationsRead, getUnreadCount,
  getDashboardStats, globalSearch,
  listCustomFieldDefs, createCustomFieldDef, updateCustomFieldDef, deleteCustomFieldDef,
  ensureUserInTeam,
  importCompanies, exportCompanies, exportContacts,
};
