const { getDb, mailerContactsOps } = require('../models/localDb');
const mysqlAdapter = require('../adapters/mysqlAdapter');
const { v4: uuidv4 } = require('uuid');

async function syncContacts() {
  try {
    const tables = await mysqlAdapter.discoverTables();
    const cfg = require('../config');
    const prefix = cfg.mysql.tablePrefix || 'sg_';
    
    const custTableCandidates = [`${prefix}customers`, 'customers'];
    let custTable = tables.find(t => custTableCandidates.includes(t));
    
    let query = '';
    let contactsData = [];

    // Assuming we have customers table
    if (custTable) {
      // Find if newsletter column exists
      const columns = await mysqlAdapter.getTableColumns(custTable);
      const colNames = columns.map(c => c.Field);
      
      const emailCol = colNames.find(c => c.includes('email_address') || c === 'customers_email');
      const fnameCol = colNames.find(c => c.includes('firstname') || c === 'customers_firstname');
      const lnameCol = colNames.find(c => c.includes('lastname') || c === 'customers_lastname');
      const phoneCol = colNames.find(c => c.includes('telephone') || c === 'customers_telephone');
      const idCol = colNames.find(c => c.includes('customers_id') || c === 'id');
      const newsletterCol = colNames.find(c => c.includes('newsletter'));

      if (emailCol) {
        query = `SELECT \`${idCol}\` AS shop_id, \`${emailCol}\` AS email, \`${fnameCol || emailCol}\` AS fn, \`${lnameCol || emailCol}\` AS ln, \`${phoneCol || emailCol}\` AS phone`;
        if (newsletterCol) {
          query += ` FROM \`${custTable}\` WHERE \`${newsletterCol}\` = '1'`;
        } else {
          query += ` FROM \`${custTable}\``;
        }

        const pool = mysqlAdapter.getPool ? mysqlAdapter.getPool() : null;
        if (pool) {
           const [rows] = await pool.execute(query);
           contactsData = rows;
        } else {
            console.error('No MySQL pool available for mailer sync');
        }
      }
    }

    // Try finding separate newsletter table if no customers table found or it yielded 0 contacts
    if (contactsData.length === 0) {
        const newsTableCandidates = [`${prefix}newsletter`, 'newsletter', `${prefix}subscribers`, 'subscribers'];
        let newsTable = tables.find(t => newsTableCandidates.includes(t));
        if (newsTable) {
           const columns = await mysqlAdapter.getTableColumns(newsTable);
           const colNames = columns.map(c => c.Field);
           const emailCol = colNames.find(c => c.includes('email'));
           if (emailCol) {
               const pool = mysqlAdapter.getPool ? mysqlAdapter.getPool() : null;
               if (pool) {
                   const [rows] = await pool.execute(`SELECT \`${emailCol}\` AS email FROM \`${newsTable}\``);
                   contactsData = rows.map(r => ({ shop_id: null, email: r.email, fn: '', ln: '', phone: '' }));
               }
           }
        }
    }

    let synced = 0;
    for (const c of contactsData) {
      if (!c.email) continue;
      mailerContactsOps.upsert({
        shop_id: c.shop_id ? String(c.shop_id) : null,
        fn: c.fn || 'Anonim',
        ln: c.ln !== c.fn ? (c.ln || '') : '',
        email: c.email,
        phone: c.phone !== c.email ? (c.phone || '') : '',
        company: '',
        city: '',
        tags: ['newsletter'],
        score: Math.floor(Math.random() * 20), // Initial score for demo
        last_activity: new Date().toISOString().split('T')[0]
      });
      synced++;
    }

    return { success: true, synced };
  } catch (err) {
    console.error('[MailerService] Sync error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  syncContacts
};
