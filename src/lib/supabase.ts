import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { Preferences } from '@capacitor/preferences';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is missing. Auth features will not work.');
}

// Capacitor storage adapter for mobile
const capacitorStorage = {
  getItem: (key: string) => {
    return Preferences.get({ key }).then(result => result.value);
  },
  setItem: (key: string, value: string) => {
    return Preferences.set({ key, value });
  },
  removeItem: (key: string) => {
    return Preferences.remove({ key });
  },
};

const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createClient<Database>> | undefined
}

export const supabase = globalForSupabase.supabase ?? createClient<Database>(
  supabaseUrl, 
  supabaseAnonKey || 'dummy_key_please_add_vite_supabase_anon_key_to_github_secrets', 
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: (typeof window !== 'undefined' && window.location.origin.includes('localhost') && !window.location.port) ? capacitorStorage : undefined
    },
  }
);

if (import.meta.env.DEV) {
  globalForSupabase.supabase = supabase;
}
