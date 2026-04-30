
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dXlneGdwZW9memVnempxamllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU0OTQsImV4cCI6MjA4ODU5MTQ5NH0.rBEctptz1pBaAlaY-V4_RQjLgzf2uNpr4TDiW5XJxjU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnums() {
  const { data, error } = await supabase.from('wallets_transaction').select('transaction_type').limit(1);
  console.log('Sample row:', data);

  // Try to get enum values using a raw SQL approach via RPC if possible, 
  // but since we don't have the RPC, let's try to fetch all distinct values from the table
  const { data: distinctValues, error: distinctError } = await supabase
    .from('wallets_transaction')
    .select('transaction_type');
  
  if (distinctError) {
    console.error('Error fetching distinct values:', distinctError);
  } else {
    const types = [...new Set(distinctValues.map(d => d.transaction_type))];
    console.log('All distinct transaction types in table:', types);
  }
}

checkEnums();
