const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize BigQuery
const bigquery = new BigQuery({
  projectId: process.env.REACT_APP_BIGQUERY_PROJECT_ID || 'impacts-tracker',
  credentials: process.env.REACT_APP_BIGQUERY_CREDENTIALS ? 
    JSON.parse(process.env.REACT_APP_BIGQUERY_CREDENTIALS) : 
    require('./peccactivitylog-c17bfeb5047c.json')
});

// Sync activities to BigQuery with conflict resolution
app.post('/api/sync-activities', async (req, res) => {
  try {
    const { userId, activities } = req.body;
    
    if (!userId || !activities || !Array.isArray(activities)) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId and activities array are required' 
      });
    }
    
    const dataset = bigquery.dataset('impacts_data');
    const table = dataset.table('activities');
    
    // First, get existing activities from BigQuery to check for conflicts
    const existingQuery = `
      SELECT activity_id, updated_at, last_sync_at
      FROM \`impacts-tracker.impacts_data.activities\`
      WHERE user_id = @userId
    `;
    
    const existingOptions = {
      query: existingQuery,
      params: { userId: userId }
    };
    
    const [existingRows] = await bigquery.query(existingOptions);
    const existingActivities = new Map();
    existingRows.forEach(row => {
      existingActivities.set(row.activity_id, {
        updated_at: new Date(row.updated_at.value),
        last_sync_at: new Date(row.last_sync_at.value)
      });
    });
    
    // Prepare rows for insertion with conflict resolution
    const currentTime = new Date();
    const rows = activities.map((activity) => {
      const activityUpdatedAt = activity.updated_at ? new Date(activity.updated_at) : currentTime;
      const existingActivity = existingActivities.get(activity.id);
      
      // If activity exists in BigQuery, check timestamps for conflict resolution
      if (existingActivity) {
        const bigQueryUpdatedAt = existingActivity.updated_at;
        
        // If BigQuery version is newer, don't update (BigQuery wins)
        if (bigQueryUpdatedAt > activityUpdatedAt) {
          console.log(`⚠️ Skipping activity ${activity.id} - BigQuery version is newer`);
          return null; // Skip this activity
        }
      }
      
      return {
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
        created_at: activity.created_at || currentTime.toISOString(),
        updated_at: activityUpdatedAt.toISOString(),
        last_sync_at: currentTime.toISOString()
      };
    }).filter(row => row !== null); // Remove skipped activities
    
    // Use MERGE with conflict resolution
    let syncedCount = 0;
    for (const row of rows) {
      try {
        const mergeQuery = `
          MERGE \`impacts-tracker.impacts_data.activities\` T
          USING (
            SELECT 
              @activity_id as activity_id,
              @user_id as user_id,
              @title as title,
              @description as description,
              @activity_type as activity_type,
              @status as status,
              @priority as priority,
              @due_date as due_date,
              @completed_date as completed_date,
              @hospital_id as hospital_id,
              @hospital_name as hospital_name,
              TIMESTAMP(@created_at) as created_at,
              TIMESTAMP(@updated_at) as updated_at,
              TIMESTAMP(@last_sync_at) as last_sync_at
          ) S
          ON T.activity_id = S.activity_id AND T.user_id = S.user_id
          WHEN MATCHED AND TIMESTAMP(S.updated_at) > T.updated_at THEN
            UPDATE SET
              title = S.title,
              description = S.description,
              activity_type = S.activity_type,
              status = S.status,
              priority = S.priority,
              due_date = S.due_date,
              completed_date = S.completed_date,
              hospital_id = S.hospital_id,
              hospital_name = S.hospital_name,
              updated_at = TIMESTAMP(S.updated_at),
              last_sync_at = TIMESTAMP(S.last_sync_at)
          WHEN NOT MATCHED THEN
            INSERT (activity_id, user_id, title, description, activity_type, status, priority, due_date, completed_date, hospital_id, hospital_name, created_at, updated_at, last_sync_at)
            VALUES (S.activity_id, S.user_id, S.title, S.description, S.activity_type, S.status, S.priority, S.due_date, S.completed_date, S.hospital_id, S.hospital_name, TIMESTAMP(S.created_at), TIMESTAMP(S.updated_at), TIMESTAMP(S.last_sync_at))
        `;
        
        const mergeOptions = {
          query: mergeQuery,
          params: {
            activity_id: row.activity_id,
            user_id: row.user_id,
            title: row.title,
            description: row.description,
            activity_type: row.activity_type,
            status: row.status,
            priority: row.priority,
            due_date: row.due_date,
            completed_date: row.completed_date,
            hospital_id: row.hospital_id,
            hospital_name: row.hospital_name,
            created_at: row.created_at,
            updated_at: row.updated_at,
            last_sync_at: row.last_sync_at
          }
        };
        
        await bigquery.query(mergeOptions);
        syncedCount++;
      } catch (mergeError) {
        console.error(`❌ Error upserting activity ${row.activity_id}:`, mergeError);
      }
    }
    
    console.log(`✅ Upserted ${syncedCount} activities for user ${userId} (${activities.length - syncedCount} skipped due to conflicts)`);
    res.json({ 
      success: true, 
      syncedCount: syncedCount,
      skippedCount: activities.length - syncedCount,
      message: `Successfully upserted ${syncedCount} activities to BigQuery (${activities.length - syncedCount} skipped due to conflicts)`
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
    const { userId } = req.params;
    
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

// Sync resources to BigQuery with conflict resolution
app.post('/api/sync-resources', async (req, res) => {
  try {
    const { userId, resources } = req.body;
    
    if (!userId || !resources || !Array.isArray(resources)) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId and resources array are required' 
      });
    }
    
    const dataset = bigquery.dataset('impacts_data');
    const table = dataset.table('resources');
    
    // First, get existing resources from BigQuery to check for conflicts
    const existingQuery = `
      SELECT resource_id, updated_at, last_sync_at
      FROM \`impacts-tracker.impacts_data.resources\`
      WHERE user_id = @userId
    `;
    
    const existingOptions = {
      query: existingQuery,
      params: { userId: userId }
    };
    
    const [existingRows] = await bigquery.query(existingOptions);
    const existingResources = new Map();
    existingRows.forEach(row => {
      existingResources.set(row.resource_id, {
        updated_at: new Date(row.updated_at.value),
        last_sync_at: new Date(row.last_sync_at.value)
      });
    });
    
    // Prepare rows for insertion with conflict resolution
    const currentTime = new Date();
    console.log(`🔄 Processing ${resources.length} resources for user ${userId}`);
    const rows = resources.map(resource => {
      const resourceUpdatedAt = resource.updatedAt ? new Date(resource.updatedAt) : currentTime;
      const existingResource = existingResources.get(resource.id);
      
      // If resource exists in BigQuery, check timestamps for conflict resolution
      if (existingResource) {
        const bigQueryUpdatedAt = existingResource.updated_at;
        
        // If BigQuery version is newer, don't update (BigQuery wins)
        if (bigQueryUpdatedAt > resourceUpdatedAt) {
          console.log(`⚠️ Skipping resource ${resource.id} - BigQuery version is newer`);
          return null; // Skip this resource
        }
      }
      
      return {
        resource_id: resource.id,
        user_id: userId,
        title: resource.title,
        description: resource.description || '',
        url: resource.url,
        category: resource.category || 'General',
        tags: Array.isArray(resource.tags) ? resource.tags : [],
        is_public: resource.isPublic || false,
        created_at: resource.createdAt || currentTime.toISOString(),
        updated_at: resourceUpdatedAt.toISOString(),
        last_sync_at: currentTime.toISOString()
      };
    }).filter(row => row !== null); // Remove skipped resources
    
    // Use MERGE with conflict resolution
    let syncedCount = 0;
    for (const row of rows) {
      try {
        // Validate row data before processing
        if (!row.resource_id) {
          console.error('❌ Skipping resource with undefined resource_id:', row);
          continue;
        }
        
        const mergeQuery = `
          MERGE \`impacts-tracker.impacts_data.resources\` T
          USING (
            SELECT 
              @resource_id as resource_id,
              @user_id as user_id,
              @title as title,
              @description as description,
              @url as url,
              @category as category,
              @tags as tags,
              @is_public as is_public,
              TIMESTAMP(@created_at) as created_at,
              TIMESTAMP(@updated_at) as updated_at,
              TIMESTAMP(@last_sync_at) as last_sync_at
          ) S
          ON T.resource_id = S.resource_id AND T.user_id = S.user_id
          WHEN MATCHED AND TIMESTAMP(S.updated_at) > T.updated_at THEN
            UPDATE SET
              title = S.title,
              description = S.description,
              url = S.url,
              category = S.category,
              tags = S.tags,
              is_public = S.is_public,
              updated_at = TIMESTAMP(S.updated_at),
              last_sync_at = TIMESTAMP(S.last_sync_at)
          WHEN NOT MATCHED THEN
            INSERT (resource_id, user_id, title, description, url, category, tags, is_public, created_at, updated_at, last_sync_at)
            VALUES (S.resource_id, S.user_id, S.title, S.description, S.url, S.category, S.tags, S.is_public, TIMESTAMP(S.created_at), TIMESTAMP(S.updated_at), TIMESTAMP(S.last_sync_at))
        `;
        
        const mergeOptions = {
          query: mergeQuery,
          params: {
            resource_id: row.resource_id,
            user_id: row.user_id,
            title: row.title,
            description: row.description,
            url: row.url,
            category: row.category,
            tags: row.tags,
            is_public: row.is_public,
            created_at: row.created_at,
            updated_at: row.updated_at,
            last_sync_at: row.last_sync_at
          }
        };
        
        await bigquery.query(mergeOptions);
        syncedCount++;
      } catch (mergeError) {
        console.error(`❌ Error upserting resource ${row.resource_id}:`, mergeError);
      }
    }
    
    console.log(`✅ Upserted ${syncedCount} resources for user ${userId} (${resources.length - syncedCount} skipped due to conflicts)`);
    res.json({ 
      success: true, 
      syncedCount: syncedCount,
      skippedCount: resources.length - syncedCount,
      message: `Successfully upserted ${syncedCount} resources to BigQuery (${resources.length - syncedCount} skipped due to conflicts)`
    });
    
  } catch (error) {
    console.error('❌ Error syncing resources:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get resources from BigQuery
app.get('/api/resources/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = `
      SELECT 
        resource_id,
        user_id,
        title,
        description,
        url,
        category,
        tags,
        is_public,
        created_at,
        updated_at,
        last_sync_at
      FROM \`impacts-tracker.impacts_data.resources\`
      WHERE user_id = @userId
      ORDER BY updated_at DESC
    `;
    
    const options = {
      query: query,
      params: { userId: userId }
    };
    
    const [rows] = await bigquery.query(options);
    
    console.log(`✅ Retrieved ${rows.length} resources for user ${userId}`);
    res.json({ 
      success: true, 
      resources: rows,
      count: rows.length
    });
    
  } catch (error) {
    console.error('❌ Error retrieving resources:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Sync server is running',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`🚀 Sync server running on port ${port}`);
  console.log(`📡 Health check: http://localhost:${port}/api/health`);
  console.log(`🔄 Sync activities: http://localhost:${port}/api/sync-activities`);
  console.log(`📋 Get activities: http://localhost:${port}/api/activities/:userId`);
  console.log(`🔄 Sync resources: http://localhost:${port}/api/sync-resources`);
  console.log(`📚 Get resources: http://localhost:${port}/api/resources/:userId`);
});
