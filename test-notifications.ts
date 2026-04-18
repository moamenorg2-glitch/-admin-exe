import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dXlneGdwZW9memVnempxamllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU0OTQsImV4cCI6MjA4ODU5MTQ5NH0.rBEctptz1pBaAlaY-V4_RQjLgzf2uNpr4TDiW5XJxjU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      profiles:user_id (full_name, user_type)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(1);

  console.log('Notifications error:', error?.message);
  console.log('Notifications data:', data);
}

testNotifications();
