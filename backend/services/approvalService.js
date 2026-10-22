/**
 * Approval Service — zarządzanie kolejką akceptacji zmian AI
 */
const { approvalOps, productOps, syncLogOps, settingsOps } = require('../models/localDb');
const xmlAdapter = require('../adapters/xmlAdapter');
const csvAdapter = require('../adapters/csvAdapter');
const mysqlAdapter = require('../adapters/mysqlAdapter');
const config = require('../config');

/**
 * Push approved changes to ShopGold
 */
async function syncApproved() {
  const approved = approvalOps.findAll({ status: 'approved' });
  if (!approved.length) return { synced: 0, errors: [] };

  const productsToSync = [];
  const parametersToSync = [];

  for (const item of approved) {
    if (item.field_name === 'parameter_standardize' || item.field_name === 'parameter_merge_name') {
      parametersToSync.push(item);
    } else {
      productsToSync.push(item);
    }
  }

  const connectionType = settingsOps.get('connection_type') || config.shopgold.connectionType;
  const errors = [];
  let synced = 0;

  // Process Parameters
  if (parametersToSync.length > 0) {
    for (const p of parametersToSync) {
      try {
        if (connectionType === 'mysql') {
          if (p.field_name === 'parameter_standardize') {
            const featureId = p.shop_id.replace('PARAM_', '');
            await mysqlAdapter.updateParameterValue(featureId, p.value_before, p.value_after);
          } else if (p.field_name === 'parameter_merge_name') {
            const featureId = p.shop_id.replace('PARAM_NAME_', '');
            await mysqlAdapter.mergeParameterName(featureId, p.value_after);
          }
        }
        approvalOps.updateStatus(p.id, 'synced', '', '');
        synced++;
      } catch (err) {
        errors.push({ shop_id: p.shop_id, error: err.message });
        approvalOps.updateStatus(p.id, 'error', '', '');
      }
    }
  }

  // Group regular products by shop_id
  const byShopId = {};
  for (const item of productsToSync) {
    if (!byShopId[item.shop_id]) byShopId[item.shop_id] = { shop_id: item.shop_id, product_id: item.product_id, changes: {} };
    if (item.field_name !== 'attributes_suggestions') {
      byShopId[item.shop_id].changes[item.field_name] = item.value_after;
    }
  }

  const products = Object.values(byShopId);

  for (const p of products) {
    try {
      if (connectionType === 'mysql') {
        await mysqlAdapter.updateProduct(p.shop_id, p.changes);
        const localProduct = productOps.findById(p.product_id);
        if (localProduct) productOps.upsert({ ...localProduct, ...p.changes });
      } else {
        const localProduct = productOps.findById(p.product_id);
        if (localProduct) productOps.upsert({ ...localProduct, ...p.changes });
      }
      const ids = approved.filter(a => a.shop_id === p.shop_id).map(a => a.id);
      approvalOps.bulkUpdateStatus(ids, 'synced');
      synced++;
    } catch (err) {
      errors.push({ shop_id: p.shop_id, error: err.message });
      const ids = approved.filter(a => a.shop_id === p.shop_id).map(a => a.id);
      approvalOps.bulkUpdateStatus(ids, 'error');
    }
  }

  syncLogOps.add({
    action: 'sync_approved',
    product_ids: products.map(p => p.shop_id),
    result: { synced, errors: errors.length },
    error: errors.length ? JSON.stringify(errors) : null,
  });

  return { synced, errors, connectionType };
}

/**
 * Export approved changes as XML (for manual ShopGold import)
 */
function exportApprovedAsXml() {
  const approved = approvalOps.findAll({ status: 'approved' });
  const byProduct = {};

  for (const item of approved) {
    if (!byProduct[item.product_id]) {
      const p = productOps.findById(item.product_id);
      if (p) byProduct[item.product_id] = { ...p };
    }
    if (byProduct[item.product_id] && item.field_name !== 'attributes_suggestions') {
      byProduct[item.product_id][item.field_name] = item.value_after;
    }
  }

  const products = Object.values(byProduct);
  return xmlAdapter.generateImportXml(products);
}

/**
 * Export approved changes as CSV (for manual ShopGold import)
 */
function exportApprovedAsCsv() {
  const approved = approvalOps.findAll({ status: 'approved' });
  const byProduct = {};

  for (const item of approved) {
    if (!byProduct[item.product_id]) {
      const p = productOps.findById(item.product_id);
      if (p) byProduct[item.product_id] = { ...p };
    }
    if (byProduct[item.product_id] && item.field_name !== 'attributes_suggestions') {
      byProduct[item.product_id][item.field_name] = item.value_after;
    }
  }

  return csvAdapter.generateUpdateCsv(Object.values(byProduct));
}

module.exports = { syncApproved, exportApprovedAsXml, exportApprovedAsCsv };
