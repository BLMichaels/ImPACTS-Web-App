const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

// Initialize BigQuery with explicit credentials
const bigquery = new BigQuery({
  projectId: process.env.REACT_APP_BIGQUERY_PROJECT_ID,
  credentials: JSON.parse(process.env.REACT_APP_BIGQUERY_CREDENTIALS)
});

async function syncActivityToBigQuery(activity) {
  try {
    const dataset = bigquery.dataset('impacts_data');
    const table = dataset.table('activities');
    
    // Convert activity to BigQuery format
    const row = {
      activity_id: activity.id,
      user_id: activity.userId,
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
    };
    
    await table.insert([row]);
    console.log(`✅ Successfully synced activity ${activity.id} to BigQuery`);
    return true;
  } catch (error) {
    console.error(`❌ Error syncing activity ${activity.id}:`, error);
    return false;
  }
}

async function getActivitiesFromBigQuery(userId) {
  try {
    const query = `
      SELECT *
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
    return rows;
  } catch (error) {
    console.error('❌ Error retrieving activities:', error);
    return [];
  }
}

// Export functions for use in other scripts
module.exports = {
  syncActivityToBigQuery,
  getActivitiesFromBigQuery
};

// If run directly, test the functions
if (require.main === module) {
  console.log('🧪 Testing BigQuery sync functions...');
  
  // Test data
  const testActivity = {
    id: 'test-activity-123',
    userId: 'test-user-456',
    activity: 'Test Activity',
    notes: 'This is a test activity',
    date: '2025-09-21',
    category: 'General Administration Tasks',
    hours: 1
  };
  
  syncActivityToBigQuery(testActivity)
    .then(() => getActivitiesFromBigQuery('test-user-456'))
    .then((activities) => {
      console.log('📋 Retrieved activities:', activities);
      console.log('✅ Test completed successfully!');
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
    });
}





