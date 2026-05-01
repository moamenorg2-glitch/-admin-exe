import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
async function run() {
  const { data, error } = await supabase.from('wallets_transaction').select('transaction_type').limit(100);
  const types = new Set((data||[]).map(r => r.transaction_type));
  console.log(Array.from(types));
}
run();
