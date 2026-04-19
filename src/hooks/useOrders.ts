import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { orderService } from '../services/orderService';
import { handleGlobalError } from '../utils/errorHandler';

export function useOrders(page: number, pageSize: number, filters: any) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());

  // Real-time local "now" update for indicators
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'master_orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_delivery_team' }, () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(err => {
        console.error('Error removing orders channel:', err);
      });
    };
  }, [queryClient]);

  const query = useQuery({
    queryKey: ['orders', page, filters],
    queryFn: async () => {
      try {
        const result = await orderService.fetchOrders(page, pageSize, filters);
        return { 
          orders: result.data, 
          count: result.count 
        };
      } catch (error) {
        handleGlobalError(error, 'Fetch Orders Hook');
        throw error;
      }
    },
    placeholderData: (previousData) => previousData,
  });

  return {
    ...query,
    now,
  };
}
