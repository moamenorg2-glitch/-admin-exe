import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dXlneGdwZW9memVnempxamllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU0OTQsImV4cCI6MjA4ODU5MTQ5NH0.rBEctptz1pBaAlaY-V4_RQjLgzf2uNpr4TDiW5XJxjU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersResponse, revenueResponse, driversResponse] = await Promise.all([
    supabase
      .from('master_orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today.toISOString()),
    
    supabase
      .from('master_orders')
      .select('grand_total')
      .eq('status', 'Completed')
      .gte('created_at', today.toISOString()),

    supabase
      .from('driver_details')
      .select('user_id', { count: 'exact', head: true })
      .eq('is_online', true)
      .eq('is_busy', false)
  ]);

  console.log('Orders error:', ordersResponse.error?.message);
  console.log('Revenue error:', revenueResponse.error?.message);
  console.log('Drivers error:', driversResponse.error?.message);
  
  console.log('Orders count:', ordersResponse.count);
  console.log('Revenue data:', revenueResponse.data);
  console.log('Drivers count:', driversResponse.count);
}

testDashboard();
