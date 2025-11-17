"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivities = exports.syncActivities = exports.healthCheck = void 0;
const functions = require("firebase-functions");
// Simple health check function
exports.healthCheck = functions.https.onRequest((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ status: 'ok', message: 'Sync server is running' });
});
// Placeholder for sync activities - will implement BigQuery integration later
exports.syncActivities = functions.https.onRequest((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    // For now, just return success - we'll implement BigQuery later
    res.json({
        success: true,
        syncedCount: 0,
        skippedCount: 0,
        message: 'Sync endpoint is ready - BigQuery integration pending'
    });
});
// Placeholder for get activities
exports.getActivities = functions.https.onRequest((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    // For now, return empty array - we'll implement BigQuery later
    res.json({
        success: true,
        activities: [],
        count: 0
    });
});
//# sourceMappingURL=index.js.map