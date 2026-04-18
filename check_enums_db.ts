
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnums() {
  console.log('Checking enums in database...');
  // We can't directly query pg_type easily via supabase-js without an RPC
  // But we can try to insert a record with a known value and see if it fails
  
  const { error } = await supabase
    .from('audit_logs')
    .insert({
      action_type: 'INSERT',
      table_name: 'test',
      record_id: '00000000-0000-0000-0000-000000000000'
    });

  if (error) {
    console.error('Insert failed:', error.message);
    if (error.message.includes('type')) {
       console.log('It seems action_type is an enum and INSERT might not be in it, or the enum name is different.');
    }
  } else {
    console.log('Insert successful with action_type: INSERT');
  }
}

checkEnums();
