import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // استخدام مفتاح الأدمن لرؤية الهيكل

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('--- Checking DB Schema ---');
  
  const tables = ['master_orders', 'sub_orders', 'profiles', 'wallets', 'wallets_transaction', 'zones', 'vendor_details', 'order_delivery_team'];
  
  for (const table of tables) {
    console.log(`\nTable: ${table}`);
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`Error fetching ${table}:`, error.message);
      } else if (data && data.length > 0) {
        console.log(`Columns for ${table}:`, Object.keys(data[0]));
      } else {
        console.log(`Table ${table} exists but is empty.`);
        // Try information_schema as fallback
        const { data: schemaData } = await supabase
          .from('information_schema.columns' as any)
          .select('column_name')
          .eq('table_name', table);
        if (schemaData) {
          console.log(`Columns (from info_schema):`, schemaData.map((c: any) => c.column_name));
        }
      }
    } catch (err: any) {
      console.log(`Exception for ${table}:`, err.message);
    }
  }

  console.log('\nChecking sub_status values in sub_orders...');
  const { data: subStatusData } = await supabase.from('sub_orders').select('sub_status');
  if (subStatusData) {
    const subStatuses = new Set(subStatusData.map(s => s.sub_status));
    console.log('Unique sub_statuses in sub_orders:', Array.from(subStatuses));
  }

  console.log('\nChecking status values in master_orders...');
  const { data: masterStatusData } = await supabase.from('master_orders').select('status');
  if (masterStatusData) {
    const masterStatuses = new Set(masterStatusData.map(s => s.status));
    console.log('Unique statuses in master_orders:', Array.from(masterStatuses));
  }

  console.log('\nChecking all custom RPCs...');
  try {
    const { data: pgData, error: pgError } = await supabase
      .from('pg_proc' as any)
      .select('proname')
      .limit(50);
      
    if (pgData) {
      console.log('Sample functions found:', pgData.map((r: any) => r.proname));
    }
  } catch (err: any) {
    console.log('Error fetching RPCs:', err.message);
  }

  console.log('\nChecking user_type values in profiles...');
  const { data: userTypeData } = await supabase.from('profiles').select('user_type').limit(100);
  if (userTypeData) {
    const userTypes = new Set(userTypeData.map(p => p.user_type));
    console.log('Unique user_types in profiles:', Array.from(userTypes));
  }

  console.log('\nChecking transaction_type values in wallets_transaction...');
  const { data: txTypeData } = await supabase.from('wallets_transaction').select('transaction_type');
  if (txTypeData) {
    const txTypes = new Set(txTypeData.map(t => t.transaction_type));
    console.log('Unique transaction_types in wallets_transaction:', Array.from(txTypes));
  }
}

checkSchema();
