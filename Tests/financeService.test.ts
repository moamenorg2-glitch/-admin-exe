import { describe, it, expect, vi, beforeEach } from 'vitest';
import { financeService } from './financeService';
import { supabase } from '../lib/supabase';

// Mock the Supabase client
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('financeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('adjustWalletBalance', () => {
    it('should successfully add amount to wallet and record transaction', async () => {
      const mockUserId = '123';
      const initialBalance = 100;
      const adjustmentAmount = 50;
      const newBalance = initialBalance + adjustmentAmount;

      // Mock chain for fetching wallet balance
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({ data: { current_balance: initialBalance }, error: null });

      // Mock chain for insert transaction
      const insertMock = vi.fn().mockReturnThis();
      const insertSelectMock = vi.fn().mockReturnThis();
      const insertSingleMock = vi.fn().mockResolvedValue({ data: { id: 'tx-1' }, error: null });

      // Mock chain for wallet update
      const updateMock = vi.fn().mockReturnThis();
      const updateEqMock = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'wallets') {
          return {
            select: selectMock,
            eq: eqMock,
            single: singleMock,
            update: updateMock,
          };
        }
        if (table === 'wallets_transaction') {
          return {
            insert: insertMock,
            select: insertSelectMock,
            single: insertSingleMock,
          };
        }
      });

      // Bind the mocked methods locally based on how they are chained
      selectMock.mockImplementation(() => ({ eq: eqMock }));
      eqMock.mockImplementation(() => ({ single: singleMock }));

      insertMock.mockImplementation(() => ({ select: insertSelectMock }));
      insertSelectMock.mockImplementation(() => ({ single: insertSingleMock }));

      updateMock.mockImplementation(() => ({ eq: updateEqMock }));

      await financeService.adjustWalletBalance(
        mockUserId,
        adjustmentAmount,
        'topup',
        'Test topup'
      );

      // Verify fetching wallet balance
      expect(supabase.from).toHaveBeenCalledWith('wallets');
      expect(selectMock).toHaveBeenCalledWith('current_balance');
      expect(eqMock).toHaveBeenCalledWith('user_id', mockUserId);

      // Verify transaction insertion
      expect(supabase.from).toHaveBeenCalledWith('wallets_transaction');
      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
        wallet_id: mockUserId,
        amount: adjustmentAmount,
        balance_after: newBalance,
        transaction_type: 'topup',
        description_ar: 'Test topup'
      }));

      // Verify wallet update
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          current_balance: newBalance
        })
      );
      expect(updateEqMock).toHaveBeenCalledWith('user_id', mockUserId);
    });

    it('should throw an error if fetching wallet fails', async () => {
      const mockError = new Error('Database error');
      
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({ data: null, error: mockError });

      (supabase.from as any).mockReturnValue({
        select: selectMock,
      });
      selectMock.mockReturnValue({ eq: eqMock });
      eqMock.mockReturnValue({ single: singleMock });

      await expect(
        financeService.adjustWalletBalance('123', 50, 'topup', 'desc')
      ).rejects.toThrow('Database error');
    });
  });

  describe('toggleWalletFreeze', () => {
    it('should update wallet is_frozen status', async () => {
      const updateMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as any).mockReturnValue({ update: updateMock });
      updateMock.mockReturnValue({ eq: eqMock });

      await financeService.toggleWalletFreeze('123', true);

      expect(supabase.from).toHaveBeenCalledWith('wallets');
      expect(updateMock).toHaveBeenCalledWith({ is_frozen: true });
      expect(eqMock).toHaveBeenCalledWith('user_id', '123');
    });

    it('should throw an error if update fails', async () => {
      const updateMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockResolvedValue({ error: new Error('Update failed') });

      (supabase.from as any).mockReturnValue({ update: updateMock });
      updateMock.mockReturnValue({ eq: eqMock });

      await expect(
        financeService.toggleWalletFreeze('123', false)
      ).rejects.toThrow('Update failed');
    });
  });
});
