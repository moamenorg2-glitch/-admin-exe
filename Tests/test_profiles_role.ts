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
  console.log('Testing RPC to fix is_admin...');
  
  // We can't run arbitrary SQL from the client, but we can try to see if there's an RPC for it.
  // Let's just try to fetch audit_logs using a known admin email if we can get a token.
  // Actually, let's just check if we can fetch profiles to see if `role` exists.
  const { data, error } = await supabase.from('profiles').select('role').limit(1);
  if (error) {
    console.error('Error fetching role from profiles:', error);
  } else {
    console.log('Profiles role column exists:', data);
  }
}

test();
