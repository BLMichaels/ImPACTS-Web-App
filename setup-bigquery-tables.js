const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

// Initialize BigQuery with explicit credentials
const bigquery = new BigQuery({
  projectId: process.env.REACT_APP_BIGQUERY_PROJECT_ID,
  credentials: JSON.parse(process.env.REACT_APP_BIGQUERY_CREDENTIALS)
});

async function setupBigQueryTables() {
  try {
    console.log('🚀 Setting up BigQuery tables for ImPACTS...');
    
    const dataset = bigquery.dataset('impacts_data');
    
    // Create activities table
    console.log('📋 Creating activities table...');
    const activitiesSchema = [
      { name: 'activity_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'title', type: 'STRING', mode: 'REQUIRED' },
      { name: 'description', type: 'STRING' },
      { name: 'activity_type', type: 'STRING', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'priority', type: 'STRING', mode: 'REQUIRED' },
      { name: 'due_date', type: 'STRING' },
      { name: 'completed_date', type: 'STRING' },
      { name: 'hospital_id', type: 'STRING' },
      { name: 'hospital_name', type: 'STRING' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'last_sync_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ];
    
    const [activitiesTable] = await dataset.createTable('activities', {
      schema: { fields: activitiesSchema }
    });
    console.log('✅ Activities table created successfully');
    
    // Create user profiles table
    console.log('📋 Creating user_profiles table...');
    const userProfilesSchema = [
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'email', type: 'STRING', mode: 'REQUIRED' },
      { name: 'first_name', type: 'STRING', mode: 'REQUIRED' },
      { name: 'last_name', type: 'STRING', mode: 'REQUIRED' },
      { name: 'phone', type: 'STRING' },
      { name: 'tier', type: 'STRING', mode: 'REQUIRED' },
      { name: 'department', type: 'STRING' },
      { name: 'hospital_name', type: 'STRING' },
      { name: 'hospital_type', type: 'STRING' },
      { name: 'hospital_address', type: 'STRING' },
      { name: 'hospital_city', type: 'STRING' },
      { name: 'hospital_state', type: 'STRING' },
      { name: 'hospital_zip', type: 'STRING' },
      { name: 'hospital_phone', type: 'STRING' },
      { name: 'emergency_department', type: 'STRING' },
      { name: 'pediatric_volume', type: 'STRING' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'last_sync_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ];
    
    const [userProfilesTable] = await dataset.createTable('user_profiles', {
      schema: { fields: userProfilesSchema }
    });
    console.log('✅ User profiles table created successfully');
    
    // Create gap plans table
    console.log('📋 Creating gap_plans table...');
    const gapPlansSchema = [
      { name: 'gap_plan_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'title', type: 'STRING', mode: 'REQUIRED' },
      { name: 'description', type: 'STRING' },
      { name: 'category', type: 'STRING', mode: 'REQUIRED' },
      { name: 'priority', type: 'STRING', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'rank', type: 'INTEGER' },
      { name: 'due_date', type: 'STRING' },
      { name: 'completion_date', type: 'STRING' },
      { name: 'notes', type: 'STRING' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'last_sync_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ];
    
    const [gapPlansTable] = await dataset.createTable('gap_plans', {
      schema: { fields: gapPlansSchema }
    });
    console.log('✅ Gap plans table created successfully');
    
    // Create milestones table
    console.log('📋 Creating milestones table...');
    const milestonesSchema = [
      { name: 'milestone_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'title', type: 'STRING', mode: 'REQUIRED' },
      { name: 'description', type: 'STRING' },
      { name: 'stage', type: 'STRING', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'due_date', type: 'STRING' },
      { name: 'completion_date', type: 'STRING' },
      { name: 'notes', type: 'STRING' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'last_sync_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ];
    
    const [milestonesTable] = await dataset.createTable('milestones', {
      schema: { fields: milestonesSchema }
    });
    console.log('✅ Milestones table created successfully');
    
    console.log('🎉 All BigQuery tables created successfully!');
    console.log('📋 Tables created:');
    console.log('   - activities');
    console.log('   - user_profiles');
    console.log('   - gap_plans');
    console.log('   - milestones');
    
  } catch (error) {
    console.error('❌ Error setting up BigQuery tables:', error);
    throw error;
  }
}

// Run the setup
setupBigQueryTables()
  .then(() => {
    console.log('✅ BigQuery setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ BigQuery setup failed:', error);
    process.exit(1);
  });





