
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvuygxgpeofzegzjqjie.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2dXlneGdwZW9memVnempxamllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU0OTQsImV4cCI6MjA4ODU5MTQ5NH0.rBEctptz1pBaAlaY-V4_RQjLgzf2uNpr4TDiW5XJxjU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerError() {
  // Try to fetch existing penalties first
  const { data: existing, error: fetchError } = await supabase
    .from('admin_penalties')
    .select('penalty_category')
    .limit(5);
  
  if (existing && existing.length > 0) {
    console.log('Existing penalty categories:', existing.map(e => e.penalty_category));
  } else {
    console.log('No existing penalties found.');
  }

  const valuesToTry = [
    'Policy_Violation', 'Late_Delivery', 'Order_Cancellation', 'Customer_Complaint', 'Fraud_Attempt',
    'Late_delivery', 'Order_cancellation', 'Customer_complaint', 'Policy_violation', 'Fraud_attempt',
    'late_delivery', 'order_cancellation', 'customer_complaint', 'policy_violation', 'fraud_attempt'
  ];
  
  for (const val of valuesToTry) {
    console.log(`Trying value: ${val}`);
    const { error } = await supabase
      .from('admin_penalties')
      .insert({
        target_user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        penalty_category: val,
        official_reason: 'Testing enum values'
      });
    
    if (error) {
      console.log(`Error for ${val}: ${error.message}`);
    } else {
      console.log(`SUCCESS for ${val}!`);
      return;
    }
  }
}

triggerError();
