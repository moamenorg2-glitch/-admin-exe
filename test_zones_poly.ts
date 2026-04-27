import { supabase } from './src/lib/supabase.ts';
supabase.from('zones').select('*').limit(1).then(res => console.log(JSON.stringify(res.data, null, 2)));
