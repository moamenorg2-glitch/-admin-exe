import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dXlneGdwZW9memVnempxamllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU0OTQsImV4cCI6MjA4ODU5MTQ5NH0.rBEctptz1pBaAlaY-V4_RQjLgzf2uNpr4TDiW5XJxjU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testVendors() {
  const { data, error } = await supabase
    .from('vendor_details')
    .select(`
      *,
      profile:profiles!vendor_details_user_id_fkey(full_name, primary_phone),
      category:vendor_categories!vendor_details_category_id_fkey(name_ar)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(1);

  console.log('Vendors error:', error?.message);
  console.log('Vendors data:', data);
}

testVendors();
