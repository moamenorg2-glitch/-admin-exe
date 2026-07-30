import { describe, expect, it } from 'vitest';
import { createCompatQueryBuilder } from '../src/lib/supabase';

describe('Supabase compatibility wrapper', () => {
  it('returns empty results for missing tables instead of crashing', async () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      range: () => builder,
      then: (_resolve: any, reject: any) => reject(new Error("Could not find the table 'public.profiles' in the schema cache"))
    };

    const wrapped = createCompatQueryBuilder('profiles', builder as any);
    const result = await wrapped.select('*');

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('returns empty results for missing columns instead of crashing', async () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      range: () => builder,
      then: (_resolve: any, reject: any) => reject(new Error("Could not find the column 'public.master_orders.delivery_fee' in the schema cache"))
    };

    const wrapped = createCompatQueryBuilder('master_orders', builder as any);
    const result = await wrapped.select('*');

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('handles single() responses that resolve with a schema error object', async () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      single: () => Promise.resolve({
        data: null,
        error: new Error("Could not find the table 'public.permissions' in the schema cache")
      })
    };

    const wrapped = createCompatQueryBuilder('permissions', builder as any);
    const result = await wrapped.select('*').eq('module', 'all_access').single();

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });
});
