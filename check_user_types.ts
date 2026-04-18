
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserTypes() {
  console.log('Checking user_type values in profiles...');
  const { data, error } = await supabase
    .from('profiles')
    .select('user_type')
    .limit(100);

  if (error) {
    console.error('Error fetching user_types:', error);
  } else {
    const types = [...new Set(data?.map(p => p.user_type))];
    console.log('Distinct user_type values:', types);
  }
}

checkUserTypes();
