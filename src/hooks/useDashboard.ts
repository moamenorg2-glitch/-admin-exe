import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { subDays } from 'date-fns';
import { dashboardService } from '../services/dashboardService';
import { useAuthStore } from '../store/authStore';
import { handleGlobalError } from '../utils/errorHandler';
import { supabase } from '../lib/supabase';

export type FilterType = 'all' | 'today' | 'week' | 'month';

export function useDashboard() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.email === 'moamen.org2@gmail.com';

  const [quickFilter, setQuickFilter] = useState<FilterType>('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (dateFilter) return { start: dateFilter, end: dateFilter };
    
    switch (quickFilter) {
      case 'today': return { start: now, end: now };
      case 'week': return { start: subDays(now, 7), end: now };
      case 'month': return { start: subDays(now, 30), end: now };
      default: return { start: undefined, end: undefined };
    }
  }, [dateFilter, quickFilter]);

  const { data: dashboardData, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard-data', dateRange.start?.toISOString(), dateRange.end?.toISOString()],
    queryFn: async () => {
      try {
        return await dashboardService.fetchDashboardData(dateRange.start, dateRange.end);
      } catch (error) {
        handleGlobalError(error, 'Fetch Dashboard Data');
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  const { data: permissions } = useQuery({
    queryKey: ['permissions', profile?.user_id],
    queryFn: async () => {
      try {
        return await dashboardService.fetchPermissions(profile?.user_id || '', isSuperAdmin);
      } catch (error) {
        handleGlobalError(error, 'Fetch Permissions');
        throw error;
      }
    },
    enabled: !!profile?.user_id && !isSuperAdmin,
  });

  const hasFullAccess = isSuperAdmin || permissions?.includes('all_access');

  // Real-time subscription
  useEffect(() => {
    const ordersChannel = supabase
      .channel('dashboard-live-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'master_orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard-data'] }).catch(console.error);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel).catch(err => {
        console.error('Error removing dashboard channel:', err);
      });
    };
  }, [queryClient]);

  // Derived Data
  const categoryData = useMemo(() => {
    const raw = dashboardData?.topCategories || [];
    const totalVendors = raw.reduce((sum: number, cat: any) => sum + (cat.vendor_count || 0), 0);
    
    return raw.map((cat: any, i: number) => ({
      name: cat.name_ar,
      // Percentage relative to total vendors in these top categories, or relative to max for bar scaling
      value: totalVendors > 0 ? Math.round(((cat.vendor_count || 0) / totalVendors) * 100) : 0,
      color: ['#8b5cf6', '#3b82f6', '#f59e0b', '#10b981'][i % 4]
    }));
  }, [dashboardData?.topCategories]);

  const productData = useMemo(() => {
    const raw = dashboardData?.topProducts || [];
    return raw.map((p: any, i: number) => ({
      name: p.name_ar,
      value: p.sales_count || 0,
      color: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ec4899'][i % 5]
    }));
  }, [dashboardData?.topProducts]);

  const vendorData = useMemo(() => {
    const raw = dashboardData?.topVendors || [];
    const maxOrders = raw.length > 0 ? Math.max(...raw.map((v: any) => v.order_count || 0), 1) : 1;
    
    return raw.map((v: any, i: number) => ({
      name: v.brand_name,
      value: Math.round(((v.order_count || 0) / maxOrders) * 100),
      color: ['#10b981', '#8b5cf6', '#f59e0b', '#3b82f6', '#ef4444'][i % 5]
    }));
  }, [dashboardData?.topVendors]);

  const conflicts = useMemo(() => {
    if (!dashboardData?.recentOrders) return [];
    return dashboardData.recentOrders.filter((order: any) => {
      const isSuspect = order.grand_total > 5000 && ['Pending', 'Active'].includes(order.status);
      return isSuspect;
    }).slice(0, 3);
  }, [dashboardData?.recentOrders]);

  return {
    dashboardData,
    isLoading,
    isError,
    error,
    quickFilter,
    setQuickFilter,
    dateFilter,
    setDateFilter,
    hasFullAccess,
    categoryData,
    productData,
    vendorData,
    conflicts,
    isSuperAdmin
  };
}
