/* =====================================================================
 * schedulerService.js — Auto-refresh scheduler for wholesalers (node-cron)
 * ===================================================================== */
'use strict';

const cron = require('node-cron');
const svc  = require('./sourcingService');

// Map: supplier_id (number) → cron.ScheduledTask
const _jobs = new Map();
// Map: file_id (number) → cron.ScheduledTask
const _fileJobs = new Map();
let _sellasistJob = null;
let _esetSyncJob = null;

/**
 * Validate a cron expression (5 or 6 parts, standard node-cron syntax).
 */
function isValidCron(expr) {
  if (!expr || typeof expr !== 'string') return false;
  return cron.validate(expr);
}

/**
 * Register / re-register a cron job for a supplier.
 * Silently skips if cron expression is invalid.
 */
function registerJob(supplier) {
  const id   = supplier.id;
  const expr = (supplier.schedule_cron || '').trim();

  // Remove any existing job first
  removeJob(id);

  if (!supplier.schedule_enabled || !expr) return;
  if (!isValidCron(expr)) {
    console.warn(`[scheduler] Nieprawidłowe wyrażenie CRON dla hurtowni "${supplier.name}" (ID ${id}): "${expr}"`);
    return;
  }

  const task = cron.schedule(expr, async () => {
    console.log(`[scheduler] ▶ Auto-refresh hurtowni "${supplier.name}" (ID ${id}) ...`);
    try {
      const result = await svc.refreshSupplier(id);
      svc.markScheduledRun(id);
      svc.addLog({ supplier_id: id, action: 'auto_refresh', status: 'ok',
        details: `Harmonogram: wczytano ${result.imported} SKU` });
      console.log(`[scheduler] ✅ "${supplier.name}" — ${result.imported} SKU`);
    } catch (err) {
      svc.addLog({ supplier_id: id, action: 'auto_refresh', status: 'error', details: err.message });
      console.error(`[scheduler] ❌ "${supplier.name}": ${err.message}`);
    }
  }, { timezone: 'Europe/Warsaw' });

  _jobs.set(id, task);
  console.log(`[scheduler] ⏰ Zarejestrowano harmonogram dla "${supplier.name}" → "${expr}"`);
}

/**
 * Remove and destroy the cron job for a supplier.
 */
function removeJob(supplierId) {
  const existing = _jobs.get(supplierId);
  if (existing) {
    existing.stop();
    existing.destroy();
    _jobs.delete(supplierId);
  }
}

/**
 * Register / re-register a cron job for a single file.
 */
function registerFileJob(file) {
  const fid  = file.id;
  const expr = (file.schedule_cron || '').trim();

  removeFileJob(fid);

  if (!file.schedule_enabled || !expr) return;
  if (!isValidCron(expr)) {
    console.warn(`[scheduler] Nieprawidłowe wyrażenie CRON dla pliku (ID ${fid}): "${expr}"`);
    return;
  }

  const task = cron.schedule(expr, async () => {
    console.log(`[scheduler] ▶ Auto-refresh pliku (ID ${fid}) ...`);
    try {
      const result = await svc.refreshOneSupplierFile(fid);
      svc.markFileScheduledRun(fid);
      svc.addLog({ supplier_id: file.supplier_id, action: 'auto_refresh', status: 'ok',
        details: `Harmonogram pliku (${file.label}): wczytano ${result.products.length} SKU` });
      console.log(`[scheduler] ✅ Plik ID ${fid} — ${result.products.length} SKU`);
    } catch (err) {
      svc.addLog({ supplier_id: file.supplier_id, action: 'auto_refresh', status: 'error', details: `Plik ID ${fid}: ${err.message}` });
      console.error(`[scheduler] ❌ Plik ID ${fid}: ${err.message}`);
    }
  }, { timezone: 'Europe/Warsaw' });

  _fileJobs.set(fid, task);
  console.log(`[scheduler] ⏰ Zarejestrowano harmonogram dla pliku ID ${fid} → "${expr}"`);
}

/**
 * Remove and destroy the cron job for a file.
 */
function removeFileJob(fileId) {
  const existing = _fileJobs.get(fileId);
  if (existing) {
    existing.stop();
    existing.destroy();
    _fileJobs.delete(fileId);
  }
}

/**
 * (Re)load the schedule for a single supplier from DB.
 * Called after PATCH /suppliers/:id/schedule.
 */
function reloadSchedule(supplierId) {
  try {
    const suppliers = svc.getScheduledSuppliers();
    const s = suppliers.find(x => x.id === supplierId);
    // If not in the scheduled list, just remove any existing job
    if (!s) { removeJob(supplierId); return; }
    registerJob(s);
  } catch (err) {
    console.error('[scheduler] reloadSchedule error:', err.message);
  }
}

/**
 * (Re)load the schedule for a single file from DB.
 */
function reloadFileSchedule(fileId) {
  try {
    const files = svc.getScheduledFiles();
    const f = files.find(x => x.id === fileId);
    if (!f) { removeFileJob(fileId); return; }
    registerFileJob(f);
  } catch (err) {
    console.error('[scheduler] reloadFileSchedule error:', err.message);
  }
}

/**
 * Initialize the scheduler: load all enabled schedules from DB.
 * Called once on server start.
 */
function initScheduler() {
  try {
    const suppliers = svc.getScheduledSuppliers();
    for (const s of suppliers) {
      registerJob(s);
    }
    const files = svc.getScheduledFiles();
    for (const f of files) {
      registerFileJob(f);
    }
    console.log(`[scheduler] 🚀 Scheduler zainicjowany — ${suppliers.length} hurtowni, ${files.length} plików`);
    reloadSellasistSchedule();
    reloadEmailMonitorSchedule();
    reloadEsetOrderMonitorSchedule();
    reloadSgSyncSchedules();

  } catch (err) {
    console.error('[scheduler] Błąd inicjalizacji schedulera:', err.message);
  }
}

/**
 * Reload Sellasist auto sync schedule
 */
function reloadSellasistSchedule() {
  if (_sellasistJob) {
    _sellasistJob.stop();
    _sellasistJob.destroy();
    _sellasistJob = null;
  }
  const { settingsOps } = require('../models/localDb');
  const autoSync = settingsOps.get('sellasist_auto_sync');
  if (autoSync === '1' || autoSync === 'true') {
    _sellasistJob = cron.schedule('0 * * * *', async () => {
      console.log('[scheduler] 🔄 Auto-sync Sellasist (co godzinę)...');
      try {
        const sellasistService = require('./sellasistService');
        const products = await sellasistService.fetchAllProductsForSync();
        if (products && products.length > 0) {
          const result = await svc.updateSellasistData(products);
          console.log(`[scheduler] ✅ Sellasist: zaktualizowano wagę dla ${result.weightsUpdated} produktów, ${result.listingsUpdated} wystawień`);
        }
      } catch(e) {
        console.error('[scheduler] ❌ Sellasist auto-sync błąd:', e.message);
      }
    }, { timezone: 'Europe/Warsaw' });
    console.log('[scheduler] ⏰ Zarejestrowano harmonogram Sellasist (co 1 godzinę)');
  }
}

/**
 * Reload Email Monitor schedule.
 * Default: every 30 minutes (cron: "star/30 * * * *")
 */
let _emailMonitorJob = null;
function reloadEmailMonitorSchedule() {
  if (_emailMonitorJob) {
    _emailMonitorJob.stop();
    _emailMonitorJob.destroy();
    _emailMonitorJob = null;
  }
  const { settingsOps } = require('../models/localDb');
  const enabled = settingsOps.get('email_monitor_enabled');
  if (enabled !== '1' && enabled !== 'true') return;

  const cronExpr = settingsOps.get('email_monitor_cron') || '*/30 * * * *';
  if (!cron.validate(cronExpr)) {
    console.warn('[scheduler] Nieprawidłowy CRON dla Email Monitor:', cronExpr);
    return;
  }

  _emailMonitorJob = cron.schedule(cronExpr, async () => {
    console.log('[scheduler] 📬 Auto-check skrzynki pocztowej...');
    try {
      const emailSvc = require('./emailMonitorService');
      const { settingsOps: sOps } = require('../models/localDb');
      const keys = [
        'email_monitor_host','email_monitor_port','email_monitor_user',
        'email_monitor_pass','email_monitor_tls','email_monitor_folder',
        'email_monitor_subject_filter','email_monitor_sender_filter',
        'email_monitor_ai_model',
      ];
      const settings = {};
      for (const k of keys) settings[k] = sOps.get(k) || '';
      const result = await emailSvc.checkEmails(settings);
      console.log(`[scheduler] 📬 Email Monitor: przetworzono ${result.processed}, zaimportowano ${result.imported}, błędy ${result.errors}`);
    } catch(e) {
      console.error('[scheduler] ❌ Email Monitor error:', e.message);
    }
  }, { timezone: 'Europe/Warsaw' });

  console.log(`[scheduler] 📬 Zarejestrowano harmonogram Email Monitor → "${cronExpr}"`);
}

/**
 * Reload ESET Order Monitor schedule.
 * Runs every 15 minutes (or custom cron) to check Sellasist for paid ESET orders.
 */
function reloadEsetOrderMonitorSchedule() {
  if (_esetSyncJob) {
    _esetSyncJob.stop();
    _esetSyncJob.destroy();
    _esetSyncJob = null;
  }
  const { settingsOps } = require('../models/localDb');
  const enabled = settingsOps.get('eset_sync_enabled');
  // Default to enabled ('1') if not explicitly set to '0' or 'false'
  if (enabled === '0' || enabled === 'false') {
    console.log('[scheduler] 🛑 Harmonogram ESET jest zatrzymany.');
    return;
  }

  const cronExpr = settingsOps.get('eset_sync_cron') || '*/15 * * * *';
  if (!cron.validate(cronExpr)) {
    console.warn('[scheduler] Nieprawidłowy CRON dla ESET Sync:', cronExpr);
    return;
  }

  _esetSyncJob = cron.schedule(cronExpr, async () => {
    try {
      console.log('[scheduler] 🛡️ Auto-check zamówień ESET w Sellasist...');
      const esetSyncService = require('./esetSyncService');
      await esetSyncService.processNewOrders();
    } catch(e) {
      console.error('[scheduler] ❌ ESET Sync błąd:', e.message);
    }
  }, { timezone: 'Europe/Warsaw' });

  console.log(`[scheduler] 🛡️ Zarejestrowano harmonogram ESET → "${cronExpr}"`);
}

function getEsetScheduleStatus() {
  const { settingsOps } = require('../models/localDb');
  const enabled = settingsOps.get('eset_sync_enabled');
  const isEnabled = enabled !== '0' && enabled !== 'false';
  return {
    enabled: isEnabled,
    running: _esetSyncJob !== null,
    cron: settingsOps.get('eset_sync_cron') || '*/15 * * * *'
  };
}

/**
 * ── ShopGold Sync Schedules ──────────────────────────────────────────
 * Map: instanceId → cron.ScheduledTask
 */
const _sgSyncJobs = new Map();

function reloadSgSyncSchedules() {
  // Stop & destroy all current sg-sync jobs
  for (const [iid, task] of _sgSyncJobs.entries()) {
    try { task.stop(); task.destroy(); } catch (_) {}
    _sgSyncJobs.delete(iid);
  }

  try {
    const sgSync = require('./sgSyncService');
    const configs = sgSync.getScheduledSyncConfigs();
    for (const cfg of configs) {
      const expr = (cfg.schedule_cron || '').trim();
      if (!expr || !isValidCron(expr)) {
        console.warn(`[scheduler] Nieprawidłowy CRON dla SG Sync instancji "${cfg.instance_name}" (ID ${cfg.instance_id}): "${expr}"`);
        continue;
      }
      const task = cron.schedule(expr, async () => {
        console.log(`[scheduler] 🔄 Auto-sync ShopGold "${cfg.instance_name}" (ID ${cfg.instance_id})...`);
        try {
          const result = await sgSync.runSync(cfg.instance_id, cfg.supplier_id, {
            dry_run: false,
            update_stock: cfg.update_stock === 1,
            update_price: cfg.update_price === 1,
            subiekt_priority: cfg.subiekt_priority === 1,
          });
          console.log(`[scheduler] ✅ SG Sync "${cfg.instance_name}" — zaktualizowano ${result.updatedCount} SKU`);
        } catch (err) {
          console.error(`[scheduler] ❌ SG Sync "${cfg.instance_name}": ${err.message}`);
        }
      }, { timezone: 'Europe/Warsaw' });
      _sgSyncJobs.set(cfg.instance_id, task);
      console.log(`[scheduler] ⏰ Zarejestrowano SG Sync dla "${cfg.instance_name}" → "${expr}"`);
    }
    console.log(`[scheduler] 🔄 SG Sync: ${configs.length} harmonogramów załadowanych`);
  } catch (err) {
    console.error('[scheduler] reloadSgSyncSchedules error:', err.message);
  }
}

/**
 * Returns a list of currently active job supplier IDs.
 */
function getActiveJobs() {
  return Array.from(_jobs.keys());
}

module.exports = { initScheduler, reloadSchedule, removeJob, registerJob, getActiveJobs, isValidCron, reloadSellasistSchedule, reloadEmailMonitorSchedule, reloadEsetOrderMonitorSchedule, getEsetScheduleStatus, reloadFileSchedule, removeFileJob, registerFileJob, reloadSgSyncSchedules };

