import { subDays, startOfDay, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

export const dashboardService = {
  async fetchDashboardData() {
    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 6);

    const [statsResponse, chartDataResponse, recentOrdersResponse, driversByStatusResponse] = await Promise.all([
      // Basic Stats
      Promise.all([
        // Total orders today
        supabase
          .from('master_orders')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today.toISOString()),
        
        // Revenue today (Completed orders)
        supabase
          .from('master_orders')
          .select('grand_total')
          .eq('status', 'Completed')
          .gte('created_at', today.toISOString()),

        // Available drivers (Online & NOT Busy)
        supabase
          .from('driver_details')
          .select('*', { count: 'exact', head: true })
          .eq('is_online', true)
          .eq('is_busy', false),

        // Pending orders
        supabase
          .from('master_orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Pending'),
      ]),

      // Chart Data (Last 7 days)
      supabase
        .from('master_orders')
        .select('created_at, grand_total, status')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true }),

      // Recent Orders
      supabase
        .from('master_orders')
        .select(`
          id,
          order_number,
          status,
          grand_total,
          created_at,
          customer:profiles!master_orders_customer_id_fkey(full_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(8),

      // Drivers Status Counts
      Promise.all([
        supabase.from('driver_details').select('*', { count: 'exact', head: true }).eq('is_online', true).eq('is_busy', false),
        supabase.from('driver_details').select('*', { count: 'exact', head: true }).eq('is_online', true).eq('is_busy', true),
        supabase.from('driver_details').select('*', { count: 'exact', head: true }).eq('is_online', false),
      ])
    ]);

    const [ordersTodayRes, revenueTodayRes, availableDriversRes, pendingRes] = statsResponse;
    const [onlineAvailableRes, onlineBusyRes, offlineRes] = driversByStatusResponse;

    if (ordersTodayRes.error) throw ordersTodayRes.error;
    if (revenueTodayRes.error) throw revenueTodayRes.error;
    if (availableDriversRes.error) throw availableDriversRes.error;
    if (pendingRes.error) throw pendingRes.error;
    if (chartDataResponse.error) throw chartDataResponse.error;
    if (recentOrdersResponse.error) throw recentOrdersResponse.error;
    if (onlineAvailableRes.error) throw onlineAvailableRes.error;
    if (onlineBusyRes.error) throw onlineBusyRes.error;
    if (offlineRes.error) throw offlineRes.error;

    // Process Chart Data
    const chartDays = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i);
      return {
        date: format(date, 'yyyy-MM-dd'),
        label: format(date, 'EEEE', { locale: ar }),
        orders: 0,
        revenue: 0,
      };
    });

    const allOrders = (chartDataResponse.data as any[]) || [];
    allOrders.forEach(order => {
      const orderDate = format(new Date(order.created_at), 'yyyy-MM-dd');
      const dayData = chartDays.find(d => d.date === orderDate);
      if (dayData) {
        dayData.orders += 1;
        if (order.status === 'Completed') {
          dayData.revenue += Number(order.grand_total) || 0;
        }
      }
    });

    const totalRevenueToday = (revenueTodayRes.data as any[])?.reduce((sum, order) => sum + (Number(order.grand_total) || 0), 0) || 0;
    
    return {
      stats: {
        ordersToday: ordersTodayRes.count || 0,
        revenueToday: totalRevenueToday,
        availableDrivers: onlineAvailableRes.count || 0,
        busyDrivers: onlineBusyRes.count || 0,
        offlineDrivers: offlineRes.count || 0,
        totalDrivers: (onlineAvailableRes.count || 0) + (onlineBusyRes.count || 0) + (offlineRes.count || 0),
        pendingOrders: pendingRes.count || 0
      },
      chartData: chartDays,
      recentOrders: recentOrdersResponse.data || []
    };
  },

  async fetchPermissions(userId: string, isSuperAdmin: boolean) {
    if (!userId || isSuperAdmin) return null;
    
    const [userPermsRes, managerPermsRes] = await Promise.all([
      (supabase as any)
        .from('user_permissions')
        .select('permissions(module)')
        .eq('user_id', userId),
      (supabase as any)
        .from('permissions')
        .select('module')
        .eq('manager_id', userId)
    ]);

    if (userPermsRes.error) throw userPermsRes.error;
    if (managerPermsRes.error) throw managerPermsRes.error;

    const userModules = (userPermsRes.data as any[]).map(up => up.permissions?.module).filter(Boolean);
    const managerModules = (managerPermsRes.data as any[]).map(p => p.module) || [];

    return [...new Set([...userModules, ...managerModules])];
  }
};
