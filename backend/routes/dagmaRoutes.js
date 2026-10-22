const express = require('express');
const router = express.Router();
const dagmaService = require('../services/dagmaService');

// Get ESET products
router.get('/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const products = await dagmaService.getProducts(page);
        res.json(products);
    } catch (error) {
        console.error('[dagmaRoutes] GET /products error:', error);
        res.status(500).json({ error: 'Failed to fetch ESET products' });
    }
});

// Create ESET order
router.post('/orders', async (req, res) => {
    try {
        const orderData = req.body;
        if (!orderData) {
            return res.status(400).json({ error: 'Order data is required' });
        }
        
        const result = await dagmaService.createOrder(orderData);
        res.json(result);
    } catch (error) {
        console.error('[dagmaRoutes] POST /orders error:', error);
        if (error.isPermanent) {
            res.status(400).json({ error: 'Permanent error from DAGMA API. Do not retry automatically.', details: error.details });
        } else {
            res.status(500).json({ error: 'Failed to create ESET order' });
        }
    }
});

// ESET Schedule Status
router.get('/schedule/status', (req, res) => {
    try {
        const scheduler = require('../services/schedulerService');
        if (typeof scheduler.getEsetScheduleStatus === 'function') {
            res.json(scheduler.getEsetScheduleStatus());
        } else {
            res.json({ enabled: true, running: true, cron: '*/15 * * * *' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ESET Schedule Toggle (Enable / Disable)
router.post('/schedule/toggle', (req, res) => {
    try {
        const { enabled, cron: cronExpr } = req.body;
        const { settingsOps } = require('../models/localDb');
        const scheduler = require('../services/schedulerService');

        if (enabled !== undefined) {
            settingsOps.set('eset_sync_enabled', enabled ? '1' : '0');
        }
        if (cronExpr !== undefined && typeof cronExpr === 'string') {
            settingsOps.set('eset_sync_cron', cronExpr.trim());
        }

        scheduler.reloadEsetOrderMonitorSchedule();
        res.json({ success: true, status: scheduler.getEsetScheduleStatus() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ESET Schedule Trigger Now
router.post('/schedule/trigger', async (req, res) => {
    try {
        const esetSyncService = require('../services/esetSyncService');
        await esetSyncService.processNewOrders();
        res.json({ success: true, message: 'Synchronizacja zamówień ESET zakończona pomyślnie.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
