import * as React from 'react';
import { supabase } from '../../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { 
  Download, 
  Calendar, 
  ShoppingBag,
  Users,
  Car,
  Wallet,
  Store,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import ReportsAIAssistant from '../../components/reports/ReportsAIAssistant';

interface DateRange {
  start: Date;
  end: Date;
}

export default function ReportsDashboard() {
  const [dateRange, setDateRange] = React.useState<DateRange>({
    start: startOfDay(subDays(new Date(), 30)),
    end: endOfDay(new Date())
  });
  const [selectedVendor, setSelectedVendor] = React.useState<string>('all');
  const [selectedDriver, setSelectedDriver] = React.useState<string>('all');
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Fetch Vendors for Filter
  const { data: vendors } = useQuery({
    queryKey: ['filter-vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendor_details').select('user_id, brand_name').order('brand_name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch Drivers for Filter
  const { data: drivers } = useQuery({
    queryKey: ['filter-drivers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name').eq('user_type', 'driver').order('full_name');
      if (error) throw error;
      return data;
    }
  });

  // 1. Platform Profit Stats (Direct Query to bypass broken RPC)
  const { data: profitStats, isLoading: loadingProfits } = useQuery({
    queryKey: ['platform-profits', dateRange, selectedVendor, selectedDriver, refreshKey],
    queryFn: async () => {
      try {
        let query = supabase
          .from('master_orders')
          .select(`
            id, 
            service_fee, 
            platform_discount, 
            delivery_discount,
            sub_orders:sub_orders!sub_orders_master_order_id_fkey(
              sub_total,
              vendor_commission,
              vendor:vendor_details!sub_orders_vendor_id_fkey(commission_rate)
            )
          `)
          .eq('status', 'Completed')
          .gte('created_at', format(dateRange.start, "yyyy-MM-dd'T'HH:mm:ss"))
          .lte('created_at', format(dateRange.end, "yyyy-MM-dd'T'HH:mm:ss"));

        if (selectedVendor !== 'all') {
            // Filter is applied later in the reduction if needed or we could add join filter
        }

        const { data, error } = await query;
        if (error) throw error;

        const ordersData = (data as any[]) || [];
        const stats = {
          total_orders: ordersData.length,
          total_commissions: ordersData.reduce((sum, o) => {
            const subOrders = o.sub_orders as any[] || [];
            return sum + subOrders.reduce((s: number, sub: any) => {
              // Calculate for past orders if 0 or use vendor value
              const commRate = Number(sub.vendor?.commission_rate || 0);
              const comm = Number(sub.vendor_commission) || 
                ((Number(sub.sub_total) * commRate) / 100);
              return s + comm;
            }, 0);
          }, 0),
          total_service_fees: ordersData.reduce((sum, o) => sum + (Number(o.service_fee) || 0), 0),
          total_discounts: ordersData.reduce((sum, o) => sum + (Number(o.platform_discount) || 0) + (Number(o.delivery_discount) || 0), 0),
          net_profit: 0
        };
        stats.net_profit = stats.total_commissions + stats.total_service_fees - stats.total_discounts;

        return stats;
      } catch (err) {
        console.error("Platform Profits Exception:", err);
        return { total_orders: 0, total_commissions: 0, total_service_fees: 0, total_discounts: 0, net_profit: 0 };
      }
    }
  });

  // 2. Vendor Report (Direct Query)
  const { data: vendorReport, isLoading: loadingVendors } = useQuery({
    queryKey: ['vendor-dues', dateRange, selectedVendor, refreshKey],
    queryFn: async () => {
      try {
        let query = supabase
          .from('sub_orders')
          .select(`
            vendor_id,
            sub_total,
            vendor_commission,
            vendor:vendor_details!sub_orders_vendor_id_fkey(brand_name, commission_rate),
            master_order:master_orders!sub_orders_master_order_id_fkey(payment_method)
          `)
          .eq('sub_status', 'Delivered')
          .gte('created_at', format(dateRange.start, "yyyy-MM-dd'T'HH:mm:ss"))
          .lte('created_at', format(dateRange.end, "yyyy-MM-dd'T'HH:mm:ss"));

        if (selectedVendor !== 'all') {
          query = query.eq('vendor_id', selectedVendor);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Group by vendor
        const grouped = (data as any[]).reduce((acc, curr) => {
          const vId = curr.vendor_id;
          if (!acc[vId]) {
            acc[vId] = { 
              vendor_id: vId, 
              brand_name: curr.vendor?.brand_name || 'غير معروف',
              cash_sales_amount: 0,
              digital_sales_amount: 0,
              cash_orders_count: 0,
              digital_orders_count: 0,
              total_sales: 0,
              total_commission: 0,
              net_due: 0
            };
          }
          
          // Calculate for past orders if 0 or use vendor value
          const commRate = Number(curr.vendor?.commission_rate || 0);
          const comm = Number(curr.vendor_commission) || 
            ((Number(curr.sub_total) * commRate) / 100);

          const subTotal = Number(curr.sub_total) || 0;
          if (curr.master_order?.payment_method === 'cash') {
            acc[vId].cash_sales_amount += subTotal;
            acc[vId].cash_orders_count++;
          } else {
            acc[vId].digital_sales_amount += subTotal;
            acc[vId].digital_orders_count++;
          }
          acc[vId].total_sales += subTotal;
          acc[vId].total_commission += comm;
          acc[vId].net_due = acc[vId].digital_sales_amount - acc[vId].total_commission;
          return acc;
        }, {});

        return Object.values(grouped);
      } catch (err) {
        console.error("Vendor Report Exception:", err);
        return [];
      }
    }
  });

  // 3. Driver Report (Fetched from order activity + transactions for accuracy)
  const { data: driverReport, isLoading: loadingDrivers } = useQuery({
    queryKey: ['driver-performance', dateRange, selectedDriver, refreshKey],
    queryFn: async () => {
      try {
        // Fetch all drivers to ensure names are available
        const { data: driversList } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .eq('user_type', 'driver');
        
        const driversMap: Record<string, string> = {};
        driversList?.forEach(d => {
          driversMap[d.user_id] = d.full_name || 'غير معروف';
        });

        // Fetch activity from order_delivery_team (Performance)
        let activityQuery = supabase
          .from('order_delivery_team')
          .select(`
            driver_id,
            master_order:master_orders!fk_order_delivery_team_master_order!inner(
              status,
              delivery_fee,
              driver_tip,
              created_at
            )
          `)
          .eq('master_order.status', 'Completed')
          .gte('master_order.created_at', dateRange.start.toISOString())
          .lte('master_order.created_at', dateRange.end.toISOString());

        if (selectedDriver !== 'all') {
          activityQuery = activityQuery.eq('driver_id', selectedDriver);
        }

        const { data: activity, error: activityError } = await activityQuery;
        if (activityError) throw activityError;

        // Group activity by driver to identify active drivers
        const groupedMap: Record<string, any> = {};
        for (const item of (activity as any[])) {
          const dId = item.driver_id;
          if (!dId) continue;
          if (!groupedMap[dId]) {
            groupedMap[dId] = { 
              driver_id: dId, 
              driver_name: driversMap[dId] || 'سائق #' + dId.slice(0,4),
              delivery_count: 0,
              actual_paid_earnings: 0
            };
          }
          groupedMap[dId].delivery_count++;
        }

        // Fetch actual earnings from wallets (Financial Dues) for identified drivers
        const driverIds = Object.keys(groupedMap);
        let walletData: any[] = [];
        if (driverIds.length > 0) {
          const { data: wallets } = await supabase
            .from('wallets')
            .select('user_id, current_balance')
            .in('user_id', driverIds);
          walletData = wallets || [];
        }

        // 2. Process financial balances from wallets
        for (const w of (walletData as any[])) {
          const dId = w.user_id;
          if (!groupedMap[dId]) continue; 
          groupedMap[dId].actual_paid_earnings = Number(w.current_balance) || 0;
        }

        return Object.values(groupedMap);
      } catch (err) {
        console.error("Driver Report Exception:", err);
        return [];
      }
    }
  });

  // 4. Penalties Report
  const { data: penaltiesReport } = useQuery({
    queryKey: ['penalties-report', dateRange, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_penalties')
        .select('*, profile:profiles!target_user_id(user_type)')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });
      if (error) {
        console.error("Penalties Query Error:", error);
        return [];
      }
      return data;
    }
  });

  // 5. Support Tickets Report
  const { data: supportTickets } = useQuery({
    queryKey: ['support-tickets-report', dateRange, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });
      if (error) {
        console.error("Support Tickets Error:", error);
        return [];
      }
      return data;
    }
  });

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const header = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(','));
    const csvContent = "\uFEFF" + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  return (
    <div className="space-y-8 pb-20 p-4 md:p-8 bg-gray-50/30 min-h-screen" dir="rtl">
      {/* Header & Main Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-100/50 dark:shadow-none">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">مركز القيادة والتقارير المالية</h2>
              <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">تقارير لحظية دقيقة بناءً على أحدث بيانات النظام.</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
             <button 
               onClick={handleRefresh}
               className="p-3 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-all active:scale-95"
               title="تحديث البيانات"
             >
               <RefreshCw className={cn("w-5 h-5", (loadingProfits || loadingVendors) && "animate-spin")} />
             </button>
             
             <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20">
               <Calendar className="w-4 h-4 text-gray-400" />
               <input 
                 type="date"
                 value={format(dateRange.start, 'yyyy-MM-dd')}
                 onChange={(e) => setDateRange(prev => ({ ...prev, start: startOfDay(new Date(e.target.value)) }))}
                 className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 dark:text-gray-200"
               />
               <span className="text-gray-300">|</span>
               <input 
                 type="date"
                 value={format(dateRange.end, 'yyyy-MM-dd')}
                 onChange={(e) => setDateRange(prev => ({ ...prev, end: endOfDay(new Date(e.target.value)) }))}
                 className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 dark:text-gray-200"
               />
             </div>

             <select 
               value={selectedVendor}
               onChange={(e) => setSelectedVendor(e.target.value)}
               className="px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
             >
                <option value="all">كل المتاجر</option>
                {vendors?.map(v => <option key={v.user_id} value={v.user_id}>{v.brand_name}</option>)}
             </select>

             <select 
               value={selectedDriver}
               onChange={(e) => setSelectedDriver(e.target.value)}
               className="px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
             >
                <option value="all">كل السائقين</option>
                {drivers?.map(d => <option key={d.user_id} value={d.user_id}>{d.full_name}</option>)}
             </select>
          </div>
        </div>
      </div>

      {/* Profit Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group transition-colors">
          <div className="relative z-10">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform">
              <ShoppingBag className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">إجمالي الطلبات</p>
            <h4 className="text-2xl font-black text-gray-900 dark:text-white mt-1">{profitStats?.total_orders || 0}</h4>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-50/30 dark:bg-blue-900/10 rounded-full blur-2xl" />
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group transition-colors">
          <div className="relative z-10">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform">
              <Store className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">عمولات المتاجر</p>
            <h4 className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">{profitStats?.total_commissions || 0} ج.م</h4>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-50/30 dark:bg-emerald-900/10 rounded-full blur-2xl" />
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group transition-colors">
          <div className="relative z-10">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform">
              <Wallet className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">رسوم الخدمة</p>
            <h4 className="text-2xl font-black text-purple-700 dark:text-purple-400 mt-1">{profitStats?.total_service_fees || 0} ج.م</h4>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-purple-50/30 dark:bg-purple-900/10 rounded-full blur-2xl" />
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group transition-colors">
          <div className="relative z-10">
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 w-fit rounded-xl mb-4 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">إجمالي الخصومات</p>
            <h4 className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1">{profitStats?.total_discounts || 0} ج.م</h4>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-rose-50/30 dark:bg-rose-900/10 rounded-full blur-2xl" />
        </div>

        <div className="bg-emerald-600 dark:bg-emerald-700 p-6 rounded-3xl shadow-xl shadow-emerald-100 dark:shadow-none relative overflow-hidden group">
          <div className="relative z-10">
            <div className="p-3 bg-white/20 w-fit rounded-xl mb-4">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm font-bold text-emerald-100 dark:text-emerald-200">صافي الربح</p>
            <h4 className="text-3xl font-black text-white mt-1">{profitStats?.net_profit || 0} ج.م</h4>
          </div>
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <CheckCircle2 className="w-24 h-24 text-white" />
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Vendor Dues Table */}
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col transition-colors">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 sticky top-0 z-10 transition-colors">
             <div className="flex items-center gap-3">
               <Store className="w-5 h-5 text-emerald-500" />
               <h3 className="font-black text-lg text-gray-900 dark:text-white">مستحقات وأداء المتاجر</h3>
             </div>
             <button 
               onClick={() => exportToCSV(vendorReport || [], 'vendor_dues')}
               className="text-emerald-700 dark:text-emerald-400 font-bold text-sm hover:underline flex items-center gap-1"
             >
                <Download className="w-4 h-4" /> تصدير
             </button>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
             <table className="w-full text-right text-sm">
                <thead className="bg-gray-100 dark:bg-gray-700/50 sticky top-0 z-10 transition-colors">
                   <tr className="text-gray-900 dark:text-gray-400 font-bold">
                      <th className="px-6 py-4">المتجر</th>
                      <th className="px-6 py-4">طلبات كاش</th>
                      <th className="px-6 py-4">مبيعات كاش</th>
                      <th className="px-6 py-4">طلبات إلكتروني</th>
                      <th className="px-6 py-4">مبيعات إلكتروني</th>
                      <th className="px-6 py-4">المبيعات</th>
                      <th className="px-6 py-4">العمولة</th>
                      <th className="px-6 py-4">الصافي للمتجر</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                   {vendorReport?.map((row: any) => (
                     <tr key={row.vendor_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{row.brand_name}</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-gray-300 font-black">{row.cash_orders_count}</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-gray-300 font-black">{row.cash_sales_amount.toFixed(2)} ج.م</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-gray-300 font-black">{row.digital_orders_count}</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-gray-300 font-black">{row.digital_sales_amount.toFixed(2)} ج.م</td>
                        <td className="px-6 py-4 font-black text-gray-900 dark:text-gray-100">{row.total_sales.toFixed(2)} ج.م</td>
                        <td className="px-6 py-4 text-rose-700 dark:text-rose-400 font-black">{row.total_commission.toFixed(2)} ج.م</td>
                        <td className="px-6 py-4 text-emerald-800 dark:text-emerald-400 font-black">{row.net_due.toFixed(2)} ج.م</td>
                     </tr>
                   ))}
                   {(!vendorReport || vendorReport.length === 0) && (
                     <tr><td colSpan={8} className="py-10 text-center text-gray-500 dark:text-gray-400 italic">لا توجد بيانات متاحة</td></tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>

        {/* Driver Dues Table */}
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col transition-colors">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 sticky top-0 z-10 transition-colors">
             <div className="flex items-center gap-3">
               <Car className="w-5 h-5 text-blue-500" />
               <h3 className="font-black text-lg text-gray-900 dark:text-white">مستحقات وأداء السائقين</h3>
             </div>
             <button 
               onClick={() => exportToCSV(driverReport || [], 'driver_dues')}
               className="text-blue-700 dark:text-blue-400 font-bold text-sm hover:underline flex items-center gap-1"
             >
                <Download className="w-4 h-4" /> تصدير
             </button>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
             <table className="w-full text-right text-sm">
                <thead className="bg-gray-100 dark:bg-gray-700/50 sticky top-0 z-10 transition-colors">
                   <tr className="text-gray-900 dark:text-gray-400 font-bold">
                      <th className="px-6 py-4">السائق</th>
                      <th className="px-6 py-4">عدد التوصيلات</th>
                      <th className="px-6 py-4">إجمالي الأرباح</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                   {driverReport?.map((row: any) => (
                     <tr key={row.driver_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{row.driver_name}</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-gray-300 font-black">{row.delivery_count}</td>
                        <td className="px-6 py-4 text-blue-800 dark:text-blue-400 font-black">{row.actual_paid_earnings} ج.م</td>
                     </tr>
                   ))}
                   {(!driverReport || driverReport.length === 0) && (
                     <tr><td colSpan={3} className="py-10 text-center text-gray-500 dark:text-gray-400 italic">لا توجد بيانات متاحة</td></tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>

        {/* Penalties & Support Section */}
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col xl:col-span-1 transition-colors">
           <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <h3 className="font-black text-lg dark:text-white">الجزاءات المالية</h3>
              </div>
           </div>
           <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase mb-1">جزاءات السائقين</p>
                    <h5 className="text-xl font-black text-gray-900 dark:text-white">
                       {penaltiesReport?.filter((p: any) => p.profile?.user_type === 'driver').reduce((sum: number, p: any) => sum + (p.penalty_amount || 0), 0) || 0} ج.م
                    </h5>
                 </div>
                 <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-900/30">
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase mb-1">جزاءات المتاجر</p>
                    <h5 className="text-xl font-black text-gray-900 dark:text-white">
                       {penaltiesReport?.filter((p: any) => p.profile?.user_type === 'vendor').reduce((sum: number, p: any) => sum + (p.penalty_amount || 0), 0) || 0} ج.م
                    </h5>
                 </div>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-right text-xs">
                    <thead>
                       <tr className="text-gray-600 dark:text-gray-400 font-bold border-b border-gray-100 dark:border-gray-700">
                          <th className="py-3">الفئة</th>
                          <th className="py-3">النوع</th>
                          <th className="py-3 text-left">المبلغ</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                       {penaltiesReport?.slice(0, 5).map((p: any, idx: number) => (
                         <tr key={p.id || idx}>
                            <td className="py-3 font-medium dark:text-gray-300">{p.penalty_category}</td>
                            <td className="py-3 dark:text-gray-400">{p.profile?.user_type === 'driver' ? 'سائق' : 'متجر'}</td>
                            <td className="py-3 text-left font-black text-rose-500 dark:text-rose-400">{p.penalty_amount} ج.م</td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>

        {/* Support Tickets Table */}
        <div className="bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col xl:col-span-1 transition-colors">
          <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 sticky top-0 z-10">
             <div className="flex items-center gap-3">
               <Users className="w-5 h-5 text-purple-500" />
               <h3 className="font-black text-lg dark:text-white">الشكاوي والنزاعات</h3>
             </div>
             <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-3 py-1 rounded-full text-xs font-bold">
                {supportTickets?.length || 0} تذكرة
             </span>
          </div>
          <div className="overflow-x-auto max-h-[300px]">
             <table className="w-full text-right text-xs">
                <thead className="bg-gray-100 dark:bg-gray-700/50 sticky top-0 z-10 transition-colors">
                   <tr className="text-gray-900 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-700">
                      <th className="px-6 py-4">الموضوع</th>
                      <th className="px-6 py-4">الحالة</th>
                      <th className="px-6 py-4">الأولوية</th>
                      <th className="px-6 py-4">التاريخ</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                   {supportTickets?.map((t: any) => (
                     <tr key={t.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 font-black text-gray-900 dark:text-gray-200 max-w-[200px] truncate">{t.subject}</td>
                        <td className="px-6 py-4 text-center">
                           <span className={cn(
                             "px-2 py-0.5 rounded-full font-black text-[10px]",
                             t.status === 'resolved' ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-orange-100 text-orange-900 dark:bg-orange-900/20 dark:text-orange-400"
                           )}>
                              {t.status === 'resolved' ? 'تم الحل' : 'قيد المعالجة'}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <span className={cn(
                             "font-black",
                             t.priority === 'urgent' ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-gray-500"
                           )}>
                              {t.priority}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-gray-900 dark:text-gray-400 font-black">{format(new Date(t.created_at), 'MM/dd')}</td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </div>

      </div>

      {/* AI Assistant */}
      <ReportsAIAssistant />
    </div>
  );
}
