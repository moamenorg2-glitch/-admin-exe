
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// نستخدم مفتاح السيرفر هنا للتأكد من وجود البيانات فعلياً
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('Service role key is not defined in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function forceReadLogs() {
  console.log('--- Reading Audit Logs using Service Role (Bypassing RLS) ---');
  const { data, error, count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .limit(5);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Total logs found in DB: ${count}`);
    console.log('Last 5 entries:', JSON.stringify(data, null, 2));
  }
}

forceReadLogs();
