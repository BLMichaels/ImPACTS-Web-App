/**
 * Hospital Import Script
 * 
 * This script imports hospitals from a CSV file into Supabase.
 * 
 * Usage:
 *   1. Create a .env file with SUPABASE_URL and SUPABASE_SERVICE_KEY
 *   2. Run the hospitals table SQL in Supabase first
 *   3. Run: node import-hospitals.js [optional-csv-path]
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
}

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ftpifgzzfwpujlvbqqhu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_KEY is required.');
  console.error('Create a .env file with:');
  console.error('  SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_SERVICE_KEY=your-service-role-key');
  console.error('\nGet the service_role key from: Supabase Dashboard > Settings > API');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Path to your CSV file (can be overridden via command line argument)
const CSV_PATH = process.argv[2] || '/Volumes/4TB Ext HD/BenjaminMichaels-EXT/Downloads/All Hospitals.csv';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

async function importHospitals() {
  console.log('Reading CSV file...');
  
  const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  // Parse header
  const headers = parseCSVLine(lines[0]);
  console.log('Headers:', headers);
  
  // Parse data rows
  const hospitals = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= 10) {
      const hospital = {
        facility_id: values[0] || null,
        company_name: values[1] || null,
        name: values[2] || 'Unknown Hospital',
        address: values[3] || null,
        city: values[4] || null,
        state: values[5] || null,
        zip: values[6] || null,
        county: values[7] || null,
        phone: values[8] || null,
        hospital_type: values[9] || null,
        ownership: values[10] || null,
        has_emergency_services: values[11]?.toLowerCase() === 'yes',
        birthing_friendly: values[12] || null,
        overall_rating: values[13] || null,
        is_active: true
      };
      hospitals.push(hospital);
    }
  }
  
  console.log(`Parsed ${hospitals.length} hospitals`);
  
  // Insert in batches of 500
  const batchSize = 500;
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < hospitals.length; i += batchSize) {
    const batch = hospitals.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('hospitals')
      .upsert(batch, { onConflict: 'facility_id' });
    
    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} (${inserted}/${hospitals.length} hospitals)`);
    }
  }
  
  console.log('\n=== Import Complete ===');
  console.log(`Total hospitals: ${hospitals.length}`);
  console.log(`Successfully inserted: ${inserted}`);
  console.log(`Batches with errors: ${errors}`);
}

importHospitals().catch(console.error);
