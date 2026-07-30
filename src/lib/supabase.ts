import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is missing. Auth features will not work.');
}

const globalForSupabase = globalThis as unknown as {
  supabase: ReturnType<typeof createClient<Database>> | undefined
}

const isMissingTableError = (message: string) =>
  /could not find the table/i.test(message) ||
  /could not find the column/i.test(message) ||
  /schema cache/i.test(message);

export const createCompatQueryBuilder = <T = any>(tableName: string, query: any) => {
  const handleMissingTable = (error: any) => {
    if (error?.message && isMissingTableError(error.message)) {
      return { data: [] as T[], error: null, count: 0 };
    }
    throw error;
  };

  const wrapResult = (result: any) => {
    if (!result || typeof result.then !== 'function') {
      return result;
    }

    return new Promise((resolve, reject) => {
      result.then((data: any) => {
        if (data && data.error && isMissingTableError(String(data.error?.message || data.error))) {
          resolve({ ...data, data: data.data ?? null, error: null, count: data.count ?? 0 });
          return;
        }
        resolve(data);
      }, (error: any) => {
        try {
          resolve(handleMissingTable(error));
        } catch (e) {
          reject(e);
        }
      });
    });
  };

  let safeQuery: any;
  safeQuery = new Proxy(query, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args: any[]) => {
        const result = value.apply(target, args);
        if (result === target) {
          return safeQuery;
        }
        return wrapResult(result);
      };
    }
  });

  return new Proxy(safeQuery, {
    get(target, prop, receiver) {
      if (prop === 'then') return undefined;
      if (prop === 'catch') {
        return (handler: any) => Promise.resolve().then(() => handleMissingTable(new Error('missing-table'))).catch(handler);
      }
      return Reflect.get(target, prop, receiver);
    }
  });
};

const baseSupabase = globalForSupabase.supabase ?? createClient<Database>(
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

export const supabase = new Proxy(baseSupabase, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value !== 'function' || prop !== 'from') {
      return value;
    }

    return (tableName: string) => {
      const query = value.call(target, tableName);
      return createCompatQueryBuilder(tableName, query);
    };
  }
});

export const compatSupabase = supabase;
export const supabaseClient = baseSupabase;

if (import.meta.env.DEV) {
  globalForSupabase.supabase = baseSupabase;
}
