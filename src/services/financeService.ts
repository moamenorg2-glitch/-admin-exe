
import { supabase } from '../lib/supabase';

const isMissingTableError = (error: any) => error?.message && /could not find the table|schema cache/i.test(error.message);

export const financeService = {
  async adjustWalletBalance(userId: string, amount: number, type: 'admin_adjustment' | 'topup' | 'refund' | 'penalty' | 'delivery_earnings' | 'driver_collection_from_customer' | 'driver_payment_to_vendor' | 'vendor_cash_payment', description: string, referenceId?: string) {
    try {
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('current_balance')
        .eq('user_id', userId)
        .single();

      if (walletError) {
        if (isMissingTableError(walletError)) {
          return { success: false, skipped: true, message: 'wallet tables are not available in this Supabase schema' };
        }
        throw walletError;
      }

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

      if (txError) {
        if (isMissingTableError(txError)) {
          return { success: false, skipped: true, message: 'wallet transaction table is not available in this Supabase schema' };
        }
        throw txError;
      }

      // 2. Update wallet balance
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ 
          current_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        if (isMissingTableError(updateError)) {
          return { success: false, skipped: true, message: 'wallet table is not available in this Supabase schema' };
        }
        throw updateError;
      }

      return tx;
    } catch (error) {
      if (isMissingTableError(error)) {
        return { success: false, skipped: true, message: 'wallet tables are not available in this Supabase schema' };
      }
      throw error;
    }
  },

  async toggleWalletFreeze(userId: string, isFrozen: boolean) {
    try {
      const { error } = await supabase
        .from('wallets')
        .update({ is_frozen: isFrozen })
        .eq('user_id', userId);
      
      if (error) {
        if (isMissingTableError(error)) {
          return { success: false, skipped: true, message: 'wallet table is not available in this Supabase schema' };
        }
        throw error;
      }

      return { success: true };
    } catch (error) {
      if (isMissingTableError(error)) {
        return { success: false, skipped: true, message: 'wallet table is not available in this Supabase schema' };
      }
      throw error;
    }
  }
};
