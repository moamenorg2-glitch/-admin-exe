import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dXlneGdwZW9memVnempxamllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU0OTQsImV4cCI6MjA4ODU5MTQ5NH0.rBEctptz1pBaAlaY-V4_RQjLgzf2uNpr4TDiW5XJxjU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQueries() {
  console.log('--- Starting Database Tests ---');
  let allPassed = true;

  const runTest = async (name: string, queryFn: () => Promise<any>) => {
    try {
      const result = await queryFn();
      const { data, error } = result;
      if (error) {
        console.error(`❌ [FAILED] ${name}:`, error.message);
        allPassed = false;
      } else {
        console.log(`✅ [PASSED] ${name} (Returned ${Array.isArray(data) ? data.length : 1} records)`);
      }
    } catch (e: any) {
      console.error(`❌ [FAILED] ${name}:`, e.message);
      allPassed = false;
    }
  };

  // 1. Test Profiles
  await runTest('Fetch Profiles', async () => await supabase.from('profiles').select('*').limit(1));

  // 2. Test Master Orders
  await runTest('Fetch Master Orders with relations', async () => 
    await supabase.from('master_orders').select(`
      *,
      customer:profiles!master_orders_customer_id_fkey(full_name, primary_phone),
      address:customer_details!master_orders_address_id_fkey(*)
    `).limit(1)
  );

  // 3. Test Vendors
  await runTest('Fetch Vendors with relations', async () => 
    await supabase.from('vendor_details').select(`
      *,
      profile:profiles!vendor_details_user_id_fkey(full_name, primary_phone, email, status),
      category:vendor_categories!vendor_details_category_id_fkey(name_ar),
      zone:zones!vendor_details_zone_id_fkey(name_ar)
    `).limit(1)
  );

  // 4. Test Drivers
  await runTest('Fetch Drivers with relations', async () => 
    await supabase.from('driver_details').select(`
      *,
      profile:profiles!driver_details_user_id_fkey(full_name, primary_phone, email, status),
      zone:zones!driver_details_zone_id_fkey(name_ar)
    `).limit(1)
  );

  // 5. Test Zones
  await runTest('Fetch Zones', async () => await supabase.from('zones').select('*').limit(1));

  // 6. Test Promotions
  await runTest('Fetch Promotions', async () => await supabase.from('promotions').select('*').limit(1));

  // 7. Test Notifications
  await runTest('Fetch Notifications', async () => await supabase.from('notifications').select('*').limit(1));

  // 8. Test System Settings
  await runTest('Fetch System Settings', async () => await supabase.from('system_settings').select('*').limit(1));

  console.log('-------------------------------');
  if (allPassed) {
    console.log('🎉 All database queries passed successfully!');
  } else {
    console.error('⚠️ Some queries failed. Please check the logs.');
  }
}

testQueries();
