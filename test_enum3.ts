import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(url, key);

async function run() {
  const { data: q1, error: e1 } = await supabase.from('wallets_transaction')
    .insert({
      wallet_id: '00000000-0000-0000-0000-000000000000',
      amount: 0,
      balance_after: 0,
      transaction_type: 'deposit_rejected'
    });
  console.log("deposit_rejected =>", e1 ? e1.message : "Success");

  const { data: q2, error: e2 } = await supabase.from('wallets_transaction')
    .insert({
      wallet_id: '00000000-0000-0000-0000-000000000000',
      amount: 0,
      balance_after: 0,
      transaction_type: 'deposit_approved'
    });
  console.log("deposit_approved =>", e2 ? e2.message : "Success");

  const { data: q3, error: e3 } = await supabase.from('wallets_transaction')
    .insert({
      wallet_id: '00000000-0000-0000-0000-000000000000',
      amount: 0,
      balance_after: 0,
      transaction_type: 'topup'
    });
  console.log("topup =>", e3 ? e3.message : "Success");
}

run();
