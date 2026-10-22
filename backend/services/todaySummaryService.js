'use strict';

/**
 * todaySummaryService.js
 * Service for gathering real-time dashboard data (CRM, Sourcing, PIM)
 * to build a "plan of the day" context for the AI assistant.
 */

const path = require('path');
const crmService = require('./crmService');
const localDb = require('../models/localDb');
const sourcingService = require('./sourcingService');

/**
 * Gather all real-time metrics and format them as a Polish markdown block.
 * @param {string} [username] Currently logged in user (optional)
 * @returns {string} Text context for LLM
 */
function getSummaryContext(username = '') {
  try {
    const todayStr = new Date().toLocaleDateString('pl-PL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const crmDb = crmService.getDb();
    const pimDb = localDb.getDb();
    const sourcDb = sourcingService.getDb();

    // ─── 1. CRM TASKS ────────────────────────────────────────────────────────
    let overdueTasks = [];
    let todayTasks = [];
    let otherOpenTasks = [];

    try {
      overdueTasks = crmDb.prepare(`
        SELECT t.id, t.title, t.description, t.priority, t.deadline, 
               s.name as status_name, tm.display_name as assignee_name
        FROM crm_tasks t
        LEFT JOIN crm_task_statuses s ON t.status_id = s.id
        LEFT JOIN crm_team tm ON t.assignee_id = tm.id
        WHERE t.deadline < date('now') AND t.completed_at IS NULL
        ORDER BY t.deadline ASC, t.priority DESC
      `).all();
    } catch (e) {
      console.error('[Summary] Error fetching overdue tasks:', e.message);
    }

    try {
      todayTasks = crmDb.prepare(`
        SELECT t.id, t.title, t.description, t.priority, t.deadline, 
               s.name as status_name, tm.display_name as assignee_name
        FROM crm_tasks t
        LEFT JOIN crm_task_statuses s ON t.status_id = s.id
        LEFT JOIN crm_team tm ON t.assignee_id = tm.id
        WHERE t.deadline BETWEEN date('now') AND date('now', '+1 day') AND t.completed_at IS NULL
        ORDER BY t.priority DESC
      `).all();
    } catch (e) {
      console.error('[Summary] Error fetching today tasks:', e.message);
    }

    try {
      otherOpenTasks = crmDb.prepare(`
        SELECT t.id, t.title, t.description, t.priority, t.deadline, 
               s.name as status_name, tm.display_name as assignee_name
        FROM crm_tasks t
        LEFT JOIN crm_task_statuses s ON t.status_id = s.id
        LEFT JOIN crm_team tm ON t.assignee_id = tm.id
        WHERE t.completed_at IS NULL AND (t.deadline IS NULL OR t.deadline >= date('now', '+1 day'))
        ORDER BY 
          CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END,
          t.created_at DESC
        LIMIT 10
      `).all();
    } catch (e) {
      console.error('[Summary] Error fetching other open tasks:', e.message);
    }

    // ─── 2. CRM NOTIFICATIONS ───────────────────────────────────────────────
    let unreadCrmNotifs = [];
    let totalUnreadNotifs = 0;
    try {
      if (username) {
        unreadCrmNotifs = crmDb.prepare(`
          SELECT message, type, created_at FROM crm_notifications 
          WHERE recipient_username = ? AND is_read = 0 
          ORDER BY created_at DESC LIMIT 5
        `).all(username);
        totalUnreadNotifs = crmDb.prepare(`
          SELECT COUNT(*) as c FROM crm_notifications WHERE recipient_username = ? AND is_read = 0
        `).get(username).c;
      }
    } catch (e) {
      console.error('[Summary] Error fetching unread notifications:', e.message);
    }

    // ─── 3. PIM APPROVAL QUEUE ──────────────────────────────────────────────
    let approvalStats = { pending: 0, approved: 0, rejected: 0 };
    let pendingApprovals = [];
    try {
      const stats = pimDb.prepare('SELECT status, COUNT(*) as count FROM approval_queue GROUP BY status').all();
      for (const row of stats) {
        if (row.status === 'pending') approvalStats.pending = row.count;
        else if (row.status === 'approved') approvalStats.approved = row.count;
        else if (row.status === 'rejected') approvalStats.rejected = row.count;
      }

      pendingApprovals = pimDb.prepare(`
        SELECT id, product_name, field_name, value_before, value_after, created_at 
        FROM approval_queue WHERE status = 'pending' 
        ORDER BY created_at DESC LIMIT 5
      `).all();
    } catch (e) {
      console.error('[Summary] Error fetching approval queue details:', e.message);
    }

    // ─── 4. SOURCING LOG ERRORS (LAST 48 HOURS) ──────────────────────────────
    let sourcingErrors = [];
    try {
      sourcingErrors = sourcDb.prepare(`
        SELECT l.action, l.details, l.created_at, s.name as supplier_name
        FROM sourcing_logs l
        LEFT JOIN suppliers s ON l.supplier_id = s.id
        WHERE l.status = 'error' AND l.created_at >= datetime('now', '-2 days')
        ORDER BY l.created_at DESC LIMIT 5
      `).all();
    } catch (e) {
      console.error('[Summary] Error fetching sourcing errors:', e.message);
    }

    // ─── 5. SUPPLIERS SYNC STATUS ───────────────────────────────────────────
    let activeSuppliers = [];
    try {
      activeSuppliers = sourcDb.prepare(`
        SELECT name, source_type, last_refresh, product_count, schedule_enabled
        FROM suppliers WHERE is_active = 1
        ORDER BY last_refresh DESC
      `).all();
    } catch (e) {
      console.error('[Summary] Error fetching suppliers status:', e.message);
    }

    // ─── ASSEMBLE MARKDOWN CONTEXT ──────────────────────────────────────────
    let md = `Oto aktualne podsumowanie stanu systemu pobrane bezpośrednio z bazy danych dla użytkownika "${username || 'Właściciel'}" na dzień: **${todayStr}**.\n\n`;

    // Add Section 1: CRM Tasks
    md += `### 1. ZADANIA CRM\n`;
    if (overdueTasks.length === 0 && todayTasks.length === 0 && otherOpenTasks.length === 0) {
      md += `* Brak otwartych zadań w CRM! Wszystko zrobione.\n\n`;
    } else {
      if (overdueTasks.length > 0) {
        md += `#### ZALEGŁE ZADANIA (Piluś/Overdue):\n`;
        overdueTasks.forEach(t => {
          md += `- **[Zaległe]** ID: ${t.id} | *${t.title}* (Priorytet: **${t.priority}**, Przypisane do: *${t.assignee_name || 'brak'}*, Termin: *${t.deadline}*, Status: *${t.status_name}*)\n`;
          if (t.description) md += `  *Opis:* ${t.description.substring(0, 150)}\n`;
        });
        md += `\n`;
      }

      if (todayTasks.length > 0) {
        md += `#### ZADANIA NA DZIŚ:\n`;
        todayTasks.forEach(t => {
          md += `- **[Na dziś]** ID: ${t.id} | *${t.title}* (Priorytet: **${t.priority}**, Przypisane do: *${t.assignee_name || 'brak'}*, Status: *${t.status_name}*)\n`;
          if (t.description) md += `  *Opis:* ${t.description.substring(0, 150)}\n`;
        });
        md += `\n`;
      }

      if (otherOpenTasks.length > 0) {
        md += `#### INNE OWARTE ZADANIA (W toku / Przyszłe):\n`;
        otherOpenTasks.forEach(t => {
          const deadlineInfo = t.deadline ? `, Termin: *${t.deadline}*` : ', Brak terminu';
          md += `- ID: ${t.id} | *${t.title}* (Priorytet: **${t.priority}**, Przypisane do: *${t.assignee_name || 'brak'}*${deadlineInfo}, Status: *${t.status_name}*)\n`;
          if (t.description) md += `  *Opis:* ${t.description.substring(0, 100)}\n`;
        });
        md += `\n`;
      }
    }

    // Add Section 2: Notifications
    if (totalUnreadNotifs > 0) {
      md += `### 2. POWIADOMIENIA CRM (Nieprzeczytane: ${totalUnreadNotifs})\n`;
      unreadCrmNotifs.forEach(n => {
        md += `- [${n.created_at}] [Typ: ${n.type}] ${n.message}\n`;
      });
      md += `\n`;
    }

    // Add Section 3: PIM Queue
    md += `### 3. KOLEJKA ZATWIERDZEŃ PIM (MAPPINGI PRODUKTÓW)\n`;
    md += `- Status kolejki: **${approvalStats.pending}** oczekujących na zatwierdzenie, **${approvalStats.approved}** zatwierdzonych, **${approvalStats.rejected}** odrzuconych.\n`;
    if (pendingApprovals.length > 0) {
      md += `#### Ostatnie oczekujące zmiany w kolejce:\n`;
      pendingApprovals.forEach(a => {
        md += `- Produkt: *${a.product_name}* | Pole: **${a.field_name}** | Zmiana z: "${a.value_before || '(brak)'}" na: "${a.value_after || '(brak)'}" (Dodano: *${a.created_at}*)\n`;
      });
    }
    md += `\n`;

    // Add Section 4: Sourcing Errors
    md += `### 4. SOURCING I AKTUALIZACJA HURTOWNI\n`;
    if (sourcingErrors.length === 0) {
      md += `- **[OK]** Brak błędów aktualizacji hurtowni w ciągu ostatnich 48 godzin.\n\n`;
    } else {
      md += `#### ⚠️ BŁĘDY IMPORTÓW HURTOWNI (Z OSTATNICH 48 GODZIN):\n`;
      sourcingErrors.forEach(e => {
        md += `- Hurtownia: **${e.supplier_name || 'Nieznana'}** | Akcja: *${e.action}* | Błąd: *${e.details}* (Czas: *${e.created_at}*)\n`;
      });
      md += `\n`;
    }

    // Add Section 5: Wholesalers sync status
    if (activeSuppliers.length > 0) {
      md += `#### STATUS INTEGRACJI Z HURTOWNIAMI:\n`;
      activeSuppliers.forEach(s => {
        const cronInfo = s.schedule_enabled ? `[Automatyczny: ${s.schedule_enabled === 1 ? 'Włączony' : 'Wyłączony'}]` : '[Brak harmonogramu]';
        md += `- **${s.name}** (${s.source_type}) | Liczba produktów: **${s.product_count}** | Ostatnia aktualizacja: *${s.last_refresh || 'Nigdy'}* ${cronInfo}\n`;
      });
      md += `\n`;
    }

    return md;
  } catch (err) {
    console.error('[SummaryService] Failed to gather summary:', err);
    return `Błąd krytyczny podczas pobierania planu dnia: ${err.message}`;
  }
}

module.exports = {
  getSummaryContext
};
