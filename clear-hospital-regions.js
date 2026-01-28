/**
 * Clear region for all hospitals so you can define regions manually in the CRM.
 * Run: node clear-hospital-regions.js
 * Requires .env with SUPABASE_URL and SUPABASE_SERVICE_KEY.
 */

const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '.env');
if (require('fs').existsSync(envPath)) {
  const envContent = require('fs').readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
}

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ftpifgzzfwpujlvbqqhu.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

async function clearRegions() {
  const { error } = await supabase.from('hospitals').update({ region: null });
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  console.log('Cleared region for all hospitals. Define regions in the CRM via the Region dropdown (select or add new).');
}

clearRegions().catch((e) => {
  console.error(e);
  process.exit(1);
});
