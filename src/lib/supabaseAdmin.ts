/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

/**
 * WARNING: This key provides administrative access to your Supabase project.
 * It is highly sensitive. Using it in a client-side bundle is generally discouraged.
 * 
 * For your personal Admin App build:
 * Replace the empty string below with your actual Service Role Key from Supabase Dashboard.
 * 
 * Settings -> API -> service_role (secret)
 */
const SUPABASE_SERVICE_ROLE_KEY = ''; 

// Using import.meta.env for Vite compatibility in the browser
// Added a more robust check for development environment variables
const envServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
                         (typeof window !== 'undefined' && (window as any).VITE_SUPABASE_SERVICE_ROLE_KEY) || 
                         '';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dvuygxgpeofzegzjqjie.supabase.co';

// Use the hardcoded key if provided, otherwise fallback to environment variable
export const finalServiceRoleKey = SUPABASE_SERVICE_ROLE_KEY || envServiceRoleKey;

// Validation check: ensure the key isn't empty or a placeholder
export const isAdminKeyAvailable = !!finalServiceRoleKey && 
                                   finalServiceRoleKey.length > 20 && 
                                   finalServiceRoleKey !== 'placeholder-key';

export const supabaseAdmin = createClient<Database>(
  supabaseUrl, 
  isAdminKeyAvailable ? finalServiceRoleKey : 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
