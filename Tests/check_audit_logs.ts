
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuditLogs() {
  console.log('Checking audit_logs table...');
  const { data, error, count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact' });

  if (error) {
    console.error('Error fetching audit_logs:', error);
  } else {
    console.log('Audit logs count:', count);
    console.log('Sample logs:', data?.slice(0, 2));
  }

  console.log('\nChecking profiles table columns...');
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (profileError) {
    console.error('Error fetching profiles:', profileError);
  } else if (profileData && profileData.length > 0) {
    console.log('Profile columns:', Object.keys(profileData[0]));
  } else {
    console.log('No profiles found to check columns.');
  }
}

checkAuditLogs();
