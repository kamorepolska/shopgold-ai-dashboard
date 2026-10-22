/**
 * backlinkChecker.js — Automatyczny sprawdzacz statusu backlinków
 * Uruchamiany co 6 godzin przez node-cron
 */
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const { backlinkOps } = require('../models/localDb');

const TIMEOUT_MS = 15000;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ShopGoldBot/1.0; +https://shopgold.pl)',
  'Accept': 'text/html,application/xhtml+xml',
};

async function checkSingleBacklink(bl) {
  try {
    const { data, status } = await axios.get(bl.source_url, {
      timeout: TIMEOUT_MS,
      headers: HEADERS,
      maxRedirects: 5,
    });
    if (status < 200 || status >= 400) {
      backlinkOps.updateStatus(bl.id, 'lost');
      return { id: bl.id, status: 'lost', reason: `HTTP ${status}` };
    }
    const $ = cheerio.load(data);
    let found = false;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes(bl.target_url) || bl.target_url.includes(href.replace(/\/$/, ''))) {
        found = true;
        // Also check if it's still dofollow (not rel=nofollow)
        const rel = ($(el).attr('rel') || '').toLowerCase();
        if (rel.includes('nofollow') && bl.type === 'dofollow') {
          backlinkOps.updateStatus(bl.id, 'nofollow_changed');
        } else {
          backlinkOps.updateStatus(bl.id, 'active');
        }
        return false; // break
      }
    });
    if (!found) {
      backlinkOps.updateStatus(bl.id, 'lost');
      return { id: bl.id, status: 'lost', reason: 'Link not found on page' };
    }
    return { id: bl.id, status: 'active' };
  } catch (err) {
    backlinkOps.updateStatus(bl.id, 'lost');
    return { id: bl.id, status: 'lost', reason: err.message };
  }
}

async function checkAllBacklinks() {
  const links = backlinkOps.findAll();
  if (!links.length) return;
  console.log(`[BacklinkChecker] Sprawdzam ${links.length} backlinków...`);
  const results = [];
  for (const bl of links) {
    const r = await checkSingleBacklink(bl);
    results.push(r);
    // Small delay to be polite to servers
    await new Promise(res => setTimeout(res, 500));
  }
  const lost = results.filter(r => r.status === 'lost').length;
  console.log(`[BacklinkChecker] Gotowe. Utracone: ${lost}/${links.length}`);
  return results;
}

function startBacklinkCron() {
  // Run every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[BacklinkChecker] Cron: start sprawdzania backlinków...');
    await checkAllBacklinks();
  });
  console.log('[BacklinkChecker] Zaplanowany cron co 6 godzin.');
}

module.exports = { startBacklinkCron, checkAllBacklinks, checkSingleBacklink };
