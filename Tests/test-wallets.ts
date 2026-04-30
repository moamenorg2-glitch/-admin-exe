import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dXlneGdwZW9memVnempxamllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU0OTQsImV4cCI6MjA4ODU5MTQ5NH0.rBEctptz1pBaAlaY-V4_RQjLgzf2uNpr4TDiW5XJxjU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testWallets() {
  const { data, error } = await supabase
    .from('wallets')
    .select(`
      *,
      profiles!wallets_user_id_fkey (
        full_name,
        user_type,
        primary_phone
      )
    `, { count: 'exact' })
    .order('current_balance', { ascending: false })
    .limit(1);
    
  if (error) {
    console.error('Wallets error:', error.message);
  } else {
    console.log('Wallets successful!', data);
  }
}

testWallets();
