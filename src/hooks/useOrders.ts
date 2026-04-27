import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { orderService } from '../services/orderService';
import { handleGlobalError } from '../utils/errorHandler';
import toast from 'react-hot-toast';

export function useOrders(page: number, pageSize: number, filters: any) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());

  // Real-time local "now" update for indicators
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Use a ref to batch query invalidations
  const invalidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const invalidateOrders = useCallback(() => {
    if (invalidationTimeoutRef.current) {
      clearTimeout(invalidationTimeoutRef.current);
    }
    invalidationTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
    }, 1500); // Wait 1.5 seconds after the LAST event before refetching to batch updates
  }, [queryClient]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime-comprehensive')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'master_orders' }, (payload) => {
        console.log('New order detected:', payload);
        toast.success(`طلب جديد رقم #${payload.new.order_number}`, {
          icon: '🛍️',
          duration: 5000,
          position: 'top-right'
        });
        invalidateOrders();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'master_orders' }, (payload) => {
        console.log('Order update detected:', payload);
        if (payload.old.status !== payload.new.status) {
          toast(`تغيرت حالة الطلب #${payload.new.order_number} إلى ${payload.new.status}`, {
            icon: '📋'
          });
        }
        invalidateOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_orders' }, () => {
        invalidateOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_delivery_team' }, (payload) => {
        console.log('Delivery team change detected:', payload);
        if (payload.eventType === 'INSERT') {
          toast.success('تم تعيين مندوب للطلب', { icon: '🛵' });
        }
        invalidateOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        invalidateOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history' }, () => {
        invalidateOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_details' }, () => {
        invalidateOrders();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to comprehensive orders updates');
        }
      });

    return () => {
      if (invalidationTimeoutRef.current) {
        clearTimeout(invalidationTimeoutRef.current);
      }
      supabase.removeChannel(channel).catch(err => {
        console.error('Error removing orders channel:', err);
      });
    };
  }, [invalidateOrders]);

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
    // Technical Stability Improvements for React Query
    placeholderData: (previousData) => previousData,
    staleTime: 10000, // Data remains fresh for 10 seconds (don't refetch on window focus immediately)
    // gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes (default in v5 is 5 mins anyway)
    retry: 2, // Retry failed requests twice
    refetchOnWindowFocus: true, // Keep updated when user returns to app
  });

  return {
    ...query,
    now,
  };
}
