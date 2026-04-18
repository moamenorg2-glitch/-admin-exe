import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dXlneGdwZW9memVnempxamllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU0OTQsImV4cCI6MjA4ODU5MTQ5NH0.rBEctptz1pBaAlaY-V4_RQjLgzf2uNpr4TDiW5XJxjU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpdate() {
  const { data: settings } = await supabase.from('system_settings').select('*').limit(1).single();
  if (settings) {
    console.log('Current settings:', settings);
    const { error } = await supabase.from('system_settings').update(settings).eq('id', settings.id);
    if (error) {
      console.error('Update error:', error.message);
    } else {
      console.log('Update successful!');
    }
  }
}

testUpdate();
