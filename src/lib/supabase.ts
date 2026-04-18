import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

// Using the provided Supabase URL and Anon Key as fallbacks
const supabaseUrl = (typeof process !== 'undefined' && process.env.VITE_SUPABASE_URL) || (import.meta as any).env?.VITE_SUPABASE_URL || 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = (typeof process !== 'undefined' && process.env.VITE_SUPABASE_ANON_KEY) || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dXlneGdwZW9memVnempxamllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU0OTQsImV4cCI6MjA4ODU5MTQ5NH0.rBEctptz1pBaAlaY-V4_RQjLgzf2uNpr4TDiW5XJxjU';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
});
