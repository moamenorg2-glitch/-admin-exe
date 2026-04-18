
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey);

async function listAdmins() {
  console.log('Listing all users with user_type = admin...');
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_type', 'admin');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Admins found:', data);
  }
}

listAdmins();
