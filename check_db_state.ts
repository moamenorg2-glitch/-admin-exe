
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkSchema() {
  console.log('Checking profiles columns...');
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Profiles columns:', Object.keys(data[0] || {}));
  }

  console.log('\nChecking is_admin function result for moamen.org2@gmail.com...');
  // We can't easily call a function that uses auth.uid() from here without a token
  // But we can check if the user exists and what their user_type is.
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'moamen.org2@gmail.com')
    .single();
  
  console.log('Moamen Profile:', userProfile);
}

checkSchema();
