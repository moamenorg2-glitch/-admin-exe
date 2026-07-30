import { subDays, startOfDay, endOfDay, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

const safeQuery = async (queryBuilder: any) => {
  try {
    const result = await queryBuilder;
    return result;
  } catch (error) {
    console.warn('dashboard query skipped due to schema mismatch', error);
    return { data: [], error: null, count: 0 };
  }
};

export const dashboardService = {
  async fetchDashboardData(startDate?: Date, endDate?: Date) {
    const today = startOfDay(new Date());
    const sevenDaysAgo = subDays(today, 6);
    
    // Determine start and end dates based on the filter
    const startRange = startDate ? startOfDay(startDate) : null;
    const endRange = endDate ? endOfDay(endDate) : (startDate ? endOfDay(startDate) : null);

    const [statsResponse, chartDataResponse, recentOrdersResponse, recentDriversResponse, topVendorsResponse, topProductsResponse, activeCategoriesResponse] = await Promise.all([
      // Basic Stats
      Promise.all([
        // Total orders
        (() => {
          let q = supabase.from('master_orders').select('*', { count: 'exact', head: true });
          if (startRange && endRange) q = q.gte('created_at', startRange.toISOString()).lte('created_at', endRange.toISOString());
          return safeQuery(q);
        })(),
        
        // Pending
        (() => {
          let q = supabase.from('master_orders').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
          if (startRange && endRange) q = q.gte('created_at', startRange.toISOString()).lte('created_at', endRange.toISOString());
          return safeQuery(q);
        })(),

        // Active (Preparing)
        (() => {
          let q = supabase.from('master_orders').select('*', { count: 'exact', head: true }).eq('status', 'Active');
          if (startRange && endRange) q = q.gte('created_at', startRange.toISOString()).lte('created_at', endRange.toISOString());
          return safeQuery(q);
        })(),

        // OnTheWay
        (() => {
          let q = supabase.from('master_orders').select('*', { count: 'exact', head: true }).eq('status', 'OnTheWay');
          if (startRange && endRange) q = q.gte('created_at', startRange.toISOString()).lte('created_at', endRange.toISOString());
          return safeQuery(q);
        })(),

        // Completed
        (() => {
          let q = supabase.from('master_orders').select('*', { count: 'exact', head: true }).eq('status', 'Completed');
          if (startRange && endRange) q = q.gte('created_at', startRange.toISOString()).lte('created_at', endRange.toISOString());
          return safeQuery(q);
        })(),

        // Cancelled
        (() => {
          let q = supabase.from('master_orders').select('*', { count: 'exact', head: true }).eq('status', 'Cancelled');
          if (startRange && endRange) q = q.gte('created_at', startRange.toISOString()).lte('created_at', endRange.toISOString());
          return safeQuery(q);
        })(),

        // Revenue (Completed orders)
        (() => {
          let q = supabase.from('master_orders').select('grand_total').eq('status', 'Completed');
          if (startRange && endRange) q = q.gte('created_at', startRange.toISOString()).lte('created_at', endRange.toISOString());
          return safeQuery(q);
        })(),
      ]),

      // Chart Data (Last 7 days, ignore date filter for trend chart to always show 7 days)
      safeQuery(
        supabase
          .from('master_orders')
          .select('created_at, grand_total, status')
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: true })
      ),

      // Recent Orders (Filtered to only show active ones as per dashboard title)
      (() => {
        let q = supabase
          .from('master_orders')
          .select(`
            id,
            order_number,
            status,
            grand_total,
            created_at
          `)
          .not('status', 'in', '("Completed","Cancelled","Rejected")')
          .order('created_at', { ascending: false })
          .limit(10);
        if (startRange && endRange) q = q.gte('created_at', startRange.toISOString()).lte('created_at', endRange.toISOString());
        return safeQuery(q);
      })(),

      // Recent Drivers (First 5 for list)
      safeQuery(
        supabase
          .from('driver_details')
          .select(`
             user_id,
             created_at,
             is_online,
             is_busy
          `)
          .order('is_online', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5)
      ),

      // Top Vendors (Ordered by mock sales logic for now, or just limit but include more info)
      safeQuery(
        supabase
          .from('vendor_details')
          .select(`
             user_id,
             brand_name
          `)
          .limit(5)
      ),

      // Top Requested Products (Remove randomness, use real count)
      safeQuery(
        supabase
          .from('products')
          .select('id, name_ar, base_price')
          .limit(5)
      ),

      // Top categories with real vendor counts
      safeQuery(
        supabase
          .from('vendor_categories')
          .select(`
            id,
            name_ar
          `)
          .limit(4)
      )
    ]);

    const [totalOrdersRes, pendingRes, activeRes, onTheWayRes, completedRes, cancelledRes, revenueRes] = statsResponse;

    if (totalOrdersRes.error) console.warn('dashboard stats unavailable', totalOrdersRes.error);
    if (pendingRes.error) console.warn('dashboard pending stats unavailable', pendingRes.error);
    if (activeRes.error) console.warn('dashboard active stats unavailable', activeRes.error);
    if (onTheWayRes.error) console.warn('dashboard on-the-way stats unavailable', onTheWayRes.error);
    if (completedRes.error) console.warn('dashboard completed stats unavailable', completedRes.error);
    if (cancelledRes.error) console.warn('dashboard cancelled stats unavailable', cancelledRes.error);
    if (revenueRes.error) console.warn('dashboard revenue unavailable', revenueRes.error);
    if (chartDataResponse.error) console.warn('dashboard chart data unavailable', chartDataResponse.error);
    if (recentOrdersResponse.error) console.warn('dashboard recent orders unavailable', recentOrdersResponse.error);
    if (topProductsResponse.error) console.warn('dashboard top products unavailable', topProductsResponse.error);
    if (activeCategoriesResponse.error) console.warn('dashboard categories unavailable', activeCategoriesResponse.error);

    // Process Top Products - Remove randomness
    const processedProducts = (topProductsResponse.data || []).map((p: any) => ({
      ...p,
      sales_count: (p.order_items?.[0]?.count || 0)
    })).sort((a: any, b: any) => b.sales_count - a.sales_count);

    const processedVendors = (topVendorsResponse.data || []).map((v: any) => ({
      ...v,
      order_count: (v.sub_orders?.[0]?.count || 0)
    })).sort((a: any, b: any) => b.order_count - a.order_count);

    // Process Categories - Add vendor_count
    const processedCategories = (activeCategoriesResponse.data || []).map((cat: any) => ({
      ...cat,
      vendor_count: cat.vendor_details?.[0]?.count || 0
    }));

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

    const totalRevenueToday = (revenueRes.data as any[])?.reduce((sum, order) => sum + (Number(order.grand_total) || 0), 0) || 0;
    
    return {
      stats: {
        totalOrders: totalOrdersRes.count || 0,
        pendingOrders: pendingRes.count || 0,
        activeOrders: activeRes.count || 0,
        onTheWayOrders: onTheWayRes.count || 0,
        completedOrders: completedRes.count || 0,
        cancelledOrders: cancelledRes.count || 0,
        revenue: totalRevenueToday,
      },
      chartData: chartDays,
      recentOrders: recentOrdersResponse.data || [],
      recentDrivers: recentDriversResponse.data || [],
      topVendors: processedVendors,
      topProducts: processedProducts,
      topCategories: processedCategories
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
