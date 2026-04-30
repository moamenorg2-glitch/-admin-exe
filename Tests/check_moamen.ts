
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMoamenProfile() {
  console.log('Checking profile for moamen.org2@gmail.com...');
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'moamen.org2@gmail.com')
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
  } else {
    console.log('Profile:', data);
  }
}

checkMoamenProfile();
