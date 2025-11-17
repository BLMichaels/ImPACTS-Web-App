const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.REACT_APP_BIGQUERY_PROJECT_ID || 'impacts-tracker',
  credentials: process.env.REACT_APP_BIGQUERY_CREDENTIALS ? 
    JSON.parse(process.env.REACT_APP_BIGQUERY_CREDENTIALS) : 
    require('./peccactivitylog-c17bfeb5047c.json')
});

async function addDefaultResourcesForNewUser() {
  try {
    const dataset = bigquery.dataset('impacts_data');
    const table = dataset.table('resources');
    
    const now = new Date().toISOString();
    const defaultResources = [
      {
        resource_id: 'default-1-new',
        user_id: 'SpaSdLsgcLR6e0rrcxjwKvNU2ng2', // This is the Firebase UID for test2@impacts.com
        title: 'Pediatric Readiness Toolkit',
        description: 'Comprehensive toolkit for improving pediatric readiness',
        url: 'https://emscimprovement.center/domains/pediatric-readiness-project/readiness-toolkit/',
        category: 'Guidelines',
        tags: ['toolkit', 'pediatric', 'readiness'],
        is_public: false,
        created_at: now,
        updated_at: now,
        last_sync_at: now
      },
      {
        resource_id: 'default-2-new',
        user_id: 'SpaSdLsgcLR6e0rrcxjwKvNU2ng2', // This is the Firebase UID for test2@impacts.com
        title: 'PECC Role Guidelines',
        description: 'Guidelines for Pediatric Emergency Care Coordinators',
        url: 'https://emscimprovement.center/domains/pediatric-readiness-project/readiness-toolkit/readiness-toolkit-checklist/pecc/',
        category: 'Guidelines',
        tags: ['guidelines', 'pecc', 'coordination'],
        is_public: false,
        created_at: now,
        updated_at: now,
        last_sync_at: now
      }
    ];
    
    console.log('Adding default resources to BigQuery for test2@impacts.com...');
    await table.insert(defaultResources);
    console.log('✅ Default resources added successfully!');
    
    // Verify the resources were added
    const query = `SELECT * FROM \`impacts-tracker.impacts_data.resources\` WHERE user_id = 'SpaSdLsgcLR6e0rrcxjwKvNU2ng2'`;
    const [rows] = await bigquery.query(query);
    console.log(`\n📋 Found ${rows.length} resources for test2@impacts.com:`);
    rows.forEach(resource => {
      console.log(`  - ${resource.title} (${resource.category})`);
    });
    
  } catch (error) {
    console.error('❌ Error adding default resources:', error);
  }
}

addDefaultResourcesForNewUser();




