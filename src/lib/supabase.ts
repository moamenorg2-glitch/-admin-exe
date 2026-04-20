import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is missing. Auth features will not work.');
}

export const supabase = createClient<Database>(
  supabaseUrl, 
  supabaseAnonKey || 'dummy_key_please_add_vite_supabase_anon_key_to_github_secrets', 
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
  }
);
