import { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { orderService } from '../services/orderService';
import { handleGlobalError } from '../utils/errorHandler';
import toast from 'react-hot-toast';

// Helper for notification sound
let audioContextUnlocked = false;
const playNotificationSound = () => {
  try {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0.6;
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Audio playback blocked or failed:', err);
      });
    }
  } catch (err) {
    console.error('Failed to play notification sound:', err);
  }
};

// Global click listener to unlock audio on first interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (audioContextUnlocked) return;
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0;
    audio.play().then(() => {
      audioContextUnlocked = true;
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      console.log('Audio system unlocked');
    }).catch(() => {});
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('touchstart', unlockAudio);
}

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
      queryClient.invalidateQueries({ queryKey: ['infinite-orders'] }).catch(console.error);
    }, 300); // Batched short timeout for instant updates
  }, [queryClient]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime-comprehensive')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'master_orders' }, (payload) => {
        console.log('Realtime INSERT master_orders:', payload);
        playNotificationSound();
        toast.success(`طلب جديد رقم #${payload.new.order_number}`, {
          icon: '🛍️',
          duration: 5000,
          position: 'top-right'
        });
        invalidateOrders();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'master_orders' }, (payload) => {
        console.log('Realtime UPDATE master_orders:', payload);
        if (payload.old.status !== payload.new.status) {
          toast(`تغيرت حالة الطلب #${payload.new.order_number} إلى ${payload.new.status}`, {
            icon: '📋'
          });
        }
        invalidateOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_orders' }, (payload) => {
        console.log('Realtime change sub_orders:', payload.eventType);
        invalidateOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_delivery_team' }, (payload) => {
        console.log('Realtime change delivery_team:', payload.eventType);
        if (payload.eventType === 'INSERT') {
          toast.success('تم تعيين مندوب للطلب', { icon: '🛵' });
        }
        invalidateOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => invalidateOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history' }, () => invalidateOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_details' }, () => invalidateOrders())
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime: Subscribed to orders successfully');
        }
        if (status === 'CLOSED') {
          console.warn('⚠️ Realtime: Connection closed');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime: Subscription error:', err);
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
    staleTime: 0, // Instant refresh
    // gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes (default in v5 is 5 mins anyway)
    retry: 2, // Retry failed requests twice
    refetchOnWindowFocus: true, // Keep updated when user returns to app
  });

  return {
    ...query,
    now,
  };
}

export function useInfiniteOrders(pageSize: number, filters: any) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const invalidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const invalidateOrders = useCallback(() => {
    if (invalidationTimeoutRef.current) {
      clearTimeout(invalidationTimeoutRef.current);
    }
    invalidationTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['infinite-orders'] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
    }, 300);
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel('infinite-orders-comprehensive')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'master_orders' }, (payload) => {
        console.log('Infinite Realtime INSERT:', payload);
        playNotificationSound();
        toast.success(`طلب جديد رقم #${payload.new.order_number}`, { icon: '🛍️', duration: 5000 });
        invalidateOrders();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'master_orders' }, (payload) => {
        console.log('Infinite Realtime UPDATE:', payload);
        if (payload.old.status !== payload.new.status) {
           toast(`تغيرت حالة الطلب #${payload.new.order_number} إلى ${payload.new.status}`, { icon: '📋' });
        }
        invalidateOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_orders' }, () => invalidateOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_delivery_team' }, () => invalidateOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => invalidateOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_status_history' }, () => invalidateOrders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_details' }, () => invalidateOrders())
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Infinite Realtime: Subscribed successfully');
        }
        if (err) {
          console.error('❌ Infinite Realtime Error:', err);
        }
      });

    return () => {
      if (invalidationTimeoutRef.current) clearTimeout(invalidationTimeoutRef.current);
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [invalidateOrders]);

  const query = useInfiniteQuery({
    queryKey: ['infinite-orders', filters],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await orderService.fetchOrders(pageParam, pageSize, filters);
      return { 
        orders: result.data, 
        count: result.count,
        nextPage: (pageParam + 1) * pageSize < result.count ? pageParam + 1 : undefined
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 0,
    retry: 2,
    refetchOnWindowFocus: true,
  });

  return { ...query, now };
}
