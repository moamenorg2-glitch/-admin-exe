import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dXlneGdwZW9memVnempxamllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU0OTQsImV4cCI6MjA4ODU5MTQ5NH0.rBEctptz1pBaAlaY-V4_RQjLgzf2uNpr4TDiW5XJxjU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDaily() {
  const { error } = await supabase
    .from('performance_reports')
    .insert({
      report_type: 'daily',
      period_start: '2026-01-01',
      period_end: '2026-01-01',
      data: { test: true }
    });
  
  if (error) {
    console.log('Daily Error:', error.message);
  } else {
    console.log('Daily Success!');
  }
}

testDaily();
