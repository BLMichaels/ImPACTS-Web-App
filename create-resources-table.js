const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

const bigquery = new BigQuery({
  projectId: process.env.REACT_APP_BIGQUERY_PROJECT_ID || 'impacts-tracker',
  credentials: process.env.REACT_APP_BIGQUERY_CREDENTIALS ? 
    JSON.parse(process.env.REACT_APP_BIGQUERY_CREDENTIALS) : 
    require('./peccactivitylog-c17bfeb5047c.json')
});

async function createResourcesTable() {
  try {
    const dataset = bigquery.dataset('impacts_data');
    
    // Check if dataset exists
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) {
      console.log('Creating dataset impacts_data...');
      await dataset.create();
    }
    
    // Define the resources table schema
    const schema = [
      { name: 'resource_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'title', type: 'STRING', mode: 'REQUIRED' },
      { name: 'description', type: 'STRING', mode: 'NULLABLE' },
      { name: 'url', type: 'STRING', mode: 'REQUIRED' },
      { name: 'category', type: 'STRING', mode: 'REQUIRED' },
      { name: 'tags', type: 'STRING', mode: 'REPEATED' },
      { name: 'is_public', type: 'BOOLEAN', mode: 'REQUIRED' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'last_sync_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ];
    
    // Check if table exists
    const table = dataset.table('resources');
    const [tableExists] = await table.exists();
    
    if (!tableExists) {
      console.log('Creating resources table...');
      await table.create({ schema });
      console.log('✅ Resources table created successfully!');
    } else {
      console.log('✅ Resources table already exists');
    }
    
    // List all tables in the dataset
    const [tables] = await dataset.getTables();
    console.log('\n📋 Tables in impacts_data dataset:');
    tables.forEach(table => {
      console.log(`  - ${table.id}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating resources table:', error);
  }
}

createResourcesTable();