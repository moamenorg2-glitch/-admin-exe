
import { supabase } from '../lib/supabase';

export const financeService = {
  async adjustWalletBalance(userId: string, amount: number, type: 'admin_adjustment' | 'topup' | 'refund' | 'penalty' | 'delivery_earnings' | 'driver_collection_from_customer' | 'driver_payment_to_vendor' | 'vendor_cash_payment', description: string, referenceId?: string) {
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('current_balance')
      .eq('user_id', userId)
      .single();

    if (walletError) throw walletError;

    const newBalance = (Number(wallet.current_balance) || 0) + amount;

    // Start a transaction-like process
    // 1. Create transaction record
    const { data: tx, error: txError } = await supabase.from('wallets_transaction').insert({
      wallet_id: userId,
      amount: amount,
      balance_after: newBalance,
      transaction_type: type,
      description_ar: description,
      ...(referenceId ? { reference_id: referenceId } : {})
    }).select().single();

    if (txError) throw txError;

    // 2. Update wallet balance
    const { error: updateError } = await supabase
      .from('wallets')
      .update({ 
        current_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return tx;
  },

  async toggleWalletFreeze(userId: string, isFrozen: boolean) {
    const { error } = await supabase
      .from('wallets')
      .update({ is_frozen: isFrozen })
      .eq('user_id', userId);
    
    if (error) throw error;
  }
};
