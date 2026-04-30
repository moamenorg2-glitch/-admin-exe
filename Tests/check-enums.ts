import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dXlneGdwZW9memVnempxamllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU0OTQsImV4cCI6MjA4ODU5MTQ5NH0.rBEctptz1pBaAlaY-V4_RQjLgzf2uNpr4TDiW5XJxjU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkEnums() {
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'report_type_enum' });
  if (error) {
    // If RPC doesn't exist, try to guess or use a raw query if possible (but we can't)
    console.error('RPC error:', error.message);
    
    // Try to fetch all records and see unique report_types
    const { data: reports } = await supabase.from('performance_reports').select('report_type');
    if (reports) {
      const types = [...new Set(reports.map(r => r.report_type))];
      console.log('Existing report types:', types);
    }
  } else {
    console.log('Enum values:', data);
  }
}

checkEnums();
