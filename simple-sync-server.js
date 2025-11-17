const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize BigQuery
const bigquery = new BigQuery({
  projectId: 'impacts-tracker',
  keyFilename: './peccactivitylog-c17bfeb5047c.json'
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sync server is running' });
});

// Sync activities to BigQuery
app.post('/api/sync-activities', async (req, res) => {
  try {
    const { userId, activities } = req.body;
    
    if (!userId || !activities || !Array.isArray(activities)) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId and activities array are required' 
      });
    }
    
    // Simple insert for now - we'll add conflict resolution later
    const rows = activities.map((activity) => ({
      activity_id: activity.id,
      user_id: userId,
      title: activity.activity,
      description: activity.notes || '',
      activity_type: 'other',
      status: 'completed',
      priority: 'medium',
      due_date: activity.date,
      completed_date: activity.date,
      hospital_id: '',
      hospital_name: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString()
    }));
    
    const dataset = bigquery.dataset('impacts_data');
    const table = dataset.table('activities');
    
    await table.insert(rows);
    
    console.log(`✅ Inserted ${rows.length} activities for user ${userId}`);
    res.json({ 
      success: true, 
      syncedCount: rows.length,
      message: `Successfully inserted ${rows.length} activities to BigQuery`
    });
    
  } catch (error) {
    console.error('❌ Error syncing activities:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get activities from BigQuery
app.get('/api/activities/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const query = `
      SELECT 
        activity_id,
        user_id,
        title,
        description,
        activity_type,
        status,
        priority,
        due_date,
        completed_date,
        hospital_id,
        hospital_name,
        created_at,
        updated_at,
        last_sync_at
      FROM \`impacts-tracker.impacts_data.activities\`
      WHERE user_id = @userId
      ORDER BY created_at DESC
    `;
    
    const options = {
      query: query,
      params: { userId: userId }
    };
    
    const [rows] = await bigquery.query(options);
    
    console.log(`✅ Retrieved ${rows.length} activities for user ${userId}`);
    res.json({ 
      success: true, 
      activities: rows,
      count: rows.length 
    });
    
  } catch (error) {
    console.error('❌ Error retrieving activities:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Sync server running on port ${port}`);
  console.log(`📡 Health check: http://localhost:${port}/api/health`);
  console.log(`🔄 Sync endpoint: http://localhost:${port}/api/sync-activities`);
  console.log(`📋 Get activities: http://localhost:${port}/api/activities/:userId`);
});





