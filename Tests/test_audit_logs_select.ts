import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing audit_logs query without join...');
  const { data, error, count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .limit(5);

  if (error) {
    console.error('Error fetching audit logs:', error);
  } else {
    console.log(`Successfully fetched ${data.length} logs. Total count: ${count}`);
    if (data.length > 0) {
      console.log('Sample log:', JSON.stringify(data[0], null, 2));
    }
  }

  console.log('\nTesting audit_logs query WITH join...');
  const { data: data2, error: error2 } = await supabase
    .from('audit_logs')
    .select(`
      *,
      admin:profiles(full_name)
    `)
    .limit(5);

  if (error2) {
    console.error('Error fetching audit logs with join:', error2);
  } else {
    console.log(`Successfully fetched ${data2.length} logs with join.`);
  }
  
  console.log('\nTesting audit_logs query WITH explicit foreign key join...');
  const { data: data3, error: error3 } = await supabase
    .from('audit_logs')
    .select(`
      *,
      admin:profiles!audit_logs_admin_id_fkey(full_name)
    `)
    .limit(5);

  if (error3) {
    console.error('Error fetching audit logs with explicit join:', error3);
  } else {
    console.log(`Successfully fetched ${data3.length} logs with explicit join.`);
  }
}

test();
