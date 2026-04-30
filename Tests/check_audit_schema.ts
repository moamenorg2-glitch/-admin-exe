
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuditLogsSchema() {
  console.log('Checking audit_logs schema...');
  // We try to insert a dummy record to see if it fails or what columns it expects
  // Or just try to select and see keys if there's at least one record.
  // Since it's empty, we can try to get column info via RPC or just a select with limit 0
  
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching audit_logs:', error);
  } else {
    console.log('Audit logs columns:', data && data.length > 0 ? Object.keys(data[0]) : 'No data to infer columns');
  }
}

checkAuditLogsSchema();
