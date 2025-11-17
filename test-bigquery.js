#!/usr/bin/env node

/**
 * BigQuery Integration Test Script
 * 
 * This script tests the BigQuery integration without running the full React app.
 * Run this after setting up your environment variables.
 */

const { BigQuery } = require('@google-cloud/bigquery');

// Load environment variables
require('dotenv').config();

async function testBigQueryConnection() {
  console.log('🔍 Testing BigQuery connection...');
  
  // Check environment variables
  const projectId = process.env.REACT_APP_BIGQUERY_PROJECT_ID;
  const datasetId = process.env.REACT_APP_BIGQUERY_DATASET_ID || 'impacts_data';
  const location = process.env.REACT_APP_BIGQUERY_LOCATION || 'US';
  
  if (!projectId) {
    console.error('❌ REACT_APP_BIGQUERY_PROJECT_ID is not set');
    return false;
  }
  
  let credentials;
  try {
    credentials = JSON.parse(process.env.REACT_APP_BIGQUERY_CREDENTIALS || '{}');
  } catch (error) {
    console.error('❌ REACT_APP_BIGQUERY_CREDENTIALS is not valid JSON');
    return false;
  }
  
  if (!credentials.client_email || !credentials.private_key) {
    console.error('❌ BigQuery credentials are incomplete');
    return false;
  }
  
  console.log(`📊 Project ID: ${projectId}`);
  console.log(`📊 Dataset ID: ${datasetId}`);
  console.log(`📊 Location: ${location}`);
  console.log(`📊 Service Account: ${credentials.client_email}`);
  
  try {
    // Initialize BigQuery client
    const bigquery = new BigQuery({
      projectId,
      credentials,
      location
    });
    
    // Test basic connection
    console.log('🔌 Testing connection...');
    const [datasets] = await bigquery.getDatasets();
    console.log(`✅ Connected successfully! Found ${datasets.length} datasets.`);
    
    // Check if our dataset exists
    const dataset = bigquery.dataset(datasetId);
    const [exists] = await dataset.exists();
    
    if (exists) {
      console.log(`✅ Dataset '${datasetId}' already exists.`);
      
      // List tables in the dataset
      const [tables] = await dataset.getTables();
      console.log(`📋 Found ${tables.length} tables:`);
      tables.forEach(table => {
        console.log(`   - ${table.id}`);
      });
    } else {
      console.log(`⚠️  Dataset '${datasetId}' does not exist. It will be created on first use.`);
    }
    
    // Test a simple query
    console.log('🔍 Testing query execution...');
    const query = 'SELECT 1 as test_value';
    const [rows] = await bigquery.query(query);
    console.log(`✅ Query executed successfully: ${JSON.stringify(rows[0])}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ BigQuery connection failed:', error.message);
    return false;
  }
}

async function testTableCreation() {
  console.log('\n🏗️  Testing table creation...');
  
  const projectId = process.env.REACT_APP_BIGQUERY_PROJECT_ID;
  const datasetId = process.env.REACT_APP_BIGQUERY_DATASET_ID || 'impacts_data';
  
  try {
    const bigquery = new BigQuery({
      projectId,
      credentials: JSON.parse(process.env.REACT_APP_BIGQUERY_CREDENTIALS),
      location: process.env.REACT_APP_BIGQUERY_LOCATION || 'US'
    });
    
    const dataset = bigquery.dataset(datasetId);
    
    // Create dataset if it doesn't exist
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) {
      await dataset.create({
        location: process.env.REACT_APP_BIGQUERY_LOCATION || 'US',
        description: 'ImPACTS application data'
      });
      console.log(`✅ Created dataset '${datasetId}'`);
    }
    
    // Test creating a simple table
    const tableId = 'test_table';
    const table = dataset.table(tableId);
    
    const [tableExists] = await table.exists();
    if (!tableExists) {
      await table.create({
        schema: [
          { name: 'id', type: 'STRING', mode: 'REQUIRED' },
          { name: 'name', type: 'STRING', mode: 'REQUIRED' },
          { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
        ],
        description: 'Test table for ImPACTS'
      });
      console.log(`✅ Created test table '${tableId}'`);
    } else {
      console.log(`✅ Test table '${tableId}' already exists`);
    }
    
    // Test inserting data
    console.log('📝 Testing data insertion...');
    const testData = [{
      id: 'test-1',
      name: 'Test Record',
      created_at: new Date().toISOString()
    }];
    
    await table.insert(testData);
    console.log('✅ Data inserted successfully');
    
    // Test querying data
    console.log('🔍 Testing data retrieval...');
    const query = `SELECT * FROM \`${projectId}.${datasetId}.${tableId}\` LIMIT 1`;
    const [rows] = await bigquery.query(query);
    console.log(`✅ Data retrieved: ${JSON.stringify(rows[0])}`);
    
    // Clean up test table
    await table.delete();
    console.log('🧹 Cleaned up test table');
    
    return true;
    
  } catch (error) {
    console.error('❌ Table creation test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting BigQuery Integration Test\n');
  
  const connectionTest = await testBigQueryConnection();
  if (!connectionTest) {
    console.log('\n❌ Connection test failed. Please check your configuration.');
    process.exit(1);
  }
  
  const tableTest = await testTableCreation();
  if (!tableTest) {
    console.log('\n❌ Table creation test failed. Please check your permissions.');
    process.exit(1);
  }
  
  console.log('\n🎉 All tests passed! BigQuery integration is ready.');
  console.log('\n📋 Next steps:');
  console.log('   1. Start your React app: cd client && npm start');
  console.log('   2. Check browser console for "BigQuery service initialized successfully"');
  console.log('   3. Test creating user profiles and activities');
  console.log('   4. Verify data appears in BigQuery console');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testBigQueryConnection, testTableCreation };





