import * as functions from 'firebase-functions';

// Simple health check function
export const healthCheck = functions.https.onRequest((req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({ status: 'ok', message: 'Sync server is running' });
});

// Placeholder for sync activities - will implement BigQuery integration later
export const syncActivities = functions.https.onRequest((req, res) => {
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
export const getActivities = functions.https.onRequest((req, res) => {
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