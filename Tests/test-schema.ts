import { supabase } from './src/lib/supabase';

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.log(data);
}
run();
