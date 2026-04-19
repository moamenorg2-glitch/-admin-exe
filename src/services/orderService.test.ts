import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orderService } from './orderService';
import { supabase } from '../lib/supabase';
import { logAuditAction } from '../utils/auditLogger';

// Mock dependencies
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../utils/auditLogger', () => ({
  logAuditAction: vi.fn(),
}));

describe('orderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateOrderStatus', () => {
    it('should update master order status and log audit action', async () => {
      const orderId = 'order-123';
      const newStatus = 'Active';

      // Mock update master_orders
      const updateMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      
      const selectMock = vi.fn().mockReturnThis();
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const neqMock = vi.fn().mockReturnThis();
      
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'master_orders') {
          return { update: updateMock };
        }
        if (table === 'sub_orders') {
          return { select: selectMock, update: updateMock };
        }
        if (table === 'order_delivery_team') {
          return { select: selectMock };
        }
        if (table === 'order_status_history') {
          return { insert: insertMock };
        }
        return { select: selectMock };
      });

      updateMock.mockReturnValue({ eq: eqMock });
      selectMock.mockReturnValue({ eq: eqMock });
      eqMock.mockReturnValue({ neq: neqMock });
      neqMock.mockReturnValue({ neq: neqMock });

      // Partial mock resolution for sub queries
      selectMock.mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ data: [] })
      }));

      await orderService.updateOrderStatus(orderId, newStatus);

      expect(supabase.from).toHaveBeenCalledWith('master_orders');
      expect(updateMock).toHaveBeenCalledWith({ status: newStatus });
      expect(logAuditAction).toHaveBeenCalledWith('UPDATE', 'master_orders', orderId, null, { status: newStatus });
    });
  });

  describe('assignDriver', () => {
    it('should assign a driver successfully when not previously assigned', async () => {
      const masterOrderId = 'order-1';
      const driverId = 'driver-1';

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
      
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnThis();
      const updateEqMock = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'order_delivery_team') {
          return { select: selectMock, insert: insertMock };
        }
        if (table === 'driver_details') {
          return { update: updateMock };
        }
      });

      selectMock.mockReturnValue({ eq: eqMock });
      eqMock.mockReturnValue({ eq: eqMock, maybeSingle: maybeSingleMock });
      
      updateMock.mockReturnValue({ eq: updateEqMock });

      await orderService.assignDriver(masterOrderId, driverId);

      // Verify we checked for duplicates
      expect(selectMock).toHaveBeenCalledWith('id');
      
      // Verify insertion
      expect(insertMock).toHaveBeenCalledWith({
        master_order_id: masterOrderId,
        driver_id: driverId,
        is_lead: true
      });

      // Verify driver marked as busy
      expect(supabase.from).toHaveBeenCalledWith('driver_details');
      expect(updateMock).toHaveBeenCalledWith({ is_busy: true });
      expect(updateEqMock).toHaveBeenCalledWith('user_id', driverId);
    });

    it('should throw error if driver is already assigned', async () => {
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      // Return existing record to simulate already assigned
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: 'team-1' }, error: null });
      
      (supabase.from as any).mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock });
      eqMock.mockReturnValue({ eq: eqMock, maybeSingle: maybeSingleMock });

      await expect(
        orderService.assignDriver('order-1', 'driver-1')
      ).rejects.toThrow('هذا المندوب معين بالفعل لهذا الطلب');
    });
  });
});
