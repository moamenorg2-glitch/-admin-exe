import * as React from 'react';
import { supabase } from '../../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { 
  Download, 
  Calendar, 
  Car,
  Store,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  User,
  DollarSign,
  MessageSquare,
  Bot
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion } from 'framer-motion';
import ReportsAIAssistant from '../../components/reports/ReportsAIAssistant';
import EntityOrdersModal from '../../components/reports/EntityOrdersModal';
import { Eye } from 'lucide-react';

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
  const [activeModal, setActiveModal] = React.useState<{ type: 'vendor' | 'driver', id: string, name: string } | null>(null);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = React.useState(false);
  const [technicalError, setTechnicalError] = React.useState<{ message: string; details: any; type: string } | null>(null);

  const handleError = (type: string, error: any) => {
    // Avoid double logging if same error
    if (technicalError?.type === type && technicalError?.message === error.message) return null;
    
    console.error(`Technical Error [${type}]:`, error);
    setTechnicalError({
      type,
      message: error.message || 'Unknown Error',
      details: {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        environment: {
          onLine: navigator.onLine,
          memory: (navigator as any).deviceMemory,
          connection: (navigator as any).connection ? {
            effectiveType: (navigator as any).connection.effectiveType,
            saveData: (navigator as any).connection.saveData
          } : 'N/A'
        },
        type: type,
        message: error.message,
        hint: error.hint,
        details: error.details,
        code: error.code
      }
    });
    // Removed throw error to prevent global Error Boundary trigger
    return null;
  };

  // Safe Date Formatting helper
  const safeFormat = (date: any, formatStr: string, options?: any) => {
    try {
      if (!date) return '-';
      const d = typeof date === 'string' ? parseISO(date) : date;
      if (isNaN(d.getTime())) return '-';
      return format(d, formatStr, options);
    } catch (e) {
      return '-';
    }
  };

  // Fetch Vendors for Filter
  const { data: vendors } = useQuery({
    queryKey: ['filter-vendors'],
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('vendor_details').select('user_id, brand_name').order('brand_name');
      if (error) {
        handleError('Filter Vendors', error);
        return [];
      }
      return data;
    }
  });

  // Fetch Drivers for Filter
  const { data: drivers } = useQuery({
    queryKey: ['filter-drivers'],
    retry: 2,
    retryDelay: 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name').eq('user_type', 'driver').order('full_name');
      if (error) {
        handleError('Filter Drivers', error);
        return [];
      }
      return data;
    }
  });

  // 1. Platform Profit Stats (Direct Query to bypass broken RPC)
  const { data: profitStats, isLoading: loadingProfits, error: profitError } = useQuery({
    queryKey: ['platform-profits', dateRange, selectedVendor, selectedDriver, refreshKey],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    queryFn: async () => {
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
          .gte('created_at', safeFormat(dateRange.start, "yyyy-MM-dd'T'HH:mm:ss"))
          .lte('created_at', safeFormat(dateRange.end, "yyyy-MM-dd'T'HH:mm:ss"));

        const { data, error } = await query;
        if (error) return handleError('Platform Profits', error);

        const ordersData = (data as any[]) || [];
        const stats = {
          total_orders: ordersData.length,
          totalSales: ordersData.reduce((sum, o) => {
            const subOrders = o.sub_orders as any[] || [];
            return sum + subOrders.reduce((s: number, sub: any) => s + (Number(sub.sub_total) || 0), 0);
          }, 0),
          total_commissions: ordersData.reduce((sum, o) => {
            const subOrders = o.sub_orders as any[] || [];
            return sum + subOrders.reduce((s: number, sub: any) => {
              const commRate = Number(sub.vendor?.commission_rate || 0);
              const comm = Number(sub.vendor_commission) || 
                ((Number(sub.sub_total) * commRate) / 100);
              return s + comm;
            }, 0);
          }, 0),
          total_service_fees: ordersData.reduce((sum, o) => sum + (Number(o.service_fee) || 0), 0),
          total_discounts: ordersData.reduce((sum, o) => sum + (Number(o.platform_discount) || 0) + (Number(o.delivery_discount) || 0), 0),
          platformProfit: 0,
          vendorDues: 0,
          driverDues: 0
        };
        stats.platformProfit = stats.total_commissions + stats.total_service_fees - stats.total_discounts;
        stats.vendorDues = stats.totalSales * 0.85; 
        stats.driverDues = stats.total_orders * 15; 

        return stats;
    }
  });

  // 2. Vendor Report (Direct Query)
  const { data: vendorReport, isLoading: loadingVendors, error: vendorError } = useQuery({
    queryKey: ['vendor-dues', dateRange, selectedVendor, refreshKey],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: !loadingProfits, // STAGGERED LOADING
    queryFn: async () => {
        let query = supabase
          .from('sub_orders')
          .select(`
            vendor_id,
            sub_total,
            vendor_commission,
            vendor:vendor_details!sub_orders_vendor_id_fkey(brand_name, commission_rate, profile:profiles!vendor_details_user_id_fkey(avatar_url)),
            master_order:master_orders!sub_orders_master_order_id_fkey(payment_method)
          `)
          .eq('sub_status', 'Delivered')
          .gte('created_at', safeFormat(dateRange.start, "yyyy-MM-dd'T'HH:mm:ss"))
          .lte('created_at', safeFormat(dateRange.end, "yyyy-MM-dd'T'HH:mm:ss"));

        if (selectedVendor !== 'all') {
          query = query.eq('vendor_id', selectedVendor);
        }

        const { data, error } = await query;
        if (error) return handleError('Vendor Report', error);

        const grouped = (data || []).reduce((acc: any, curr: any) => {
          const vId = curr.vendor_id;
          if (!acc[vId]) {
            acc[vId] = { 
              vendor_id: vId, 
              brand_name: curr.vendor?.brand_name || 'غير معروف',
              avatar_url: curr.vendor?.profile?.avatar_url || '',
              cash_sales_amount: 0,
              digital_sales_amount: 0,
              cash_orders_count: 0,
              digital_orders_count: 0,
              total_sales: 0,
              total_commission: 0,
              net_due: 0
            };
          }
          
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

        return Object.keys(grouped).map(key => grouped[key]);
    }
  });

  // 3. Driver Report (Fetched from order activity + transactions for accuracy)
  const { data: driverReport, isLoading: loadingDrivers, error: driverError } = useQuery({
    queryKey: ['driver-performance', dateRange, selectedDriver, refreshKey],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    enabled: !loadingVendors && !loadingProfits, // STAGGERED LOADING
    queryFn: async () => {
        const { data: driversList, error: pError } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .eq('user_type', 'driver');
        
        if (pError) return handleError('Driver Profiles', pError);

        const driversMap: Record<string, {name: string, avatar_url: string}> = {};
        driversList?.forEach(d => {
          driversMap[d.user_id] = { name: d.full_name || 'غير معروف', avatar_url: d.avatar_url || '' };
        });

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
        if (activityError) return handleError('Driver Activity', activityError);

        const groupedMap: Record<string, any> = {};
        for (const item of (activity || [])) {
          const dId = item.driver_id;
          if (!dId) continue;
          if (!groupedMap[dId]) {
            groupedMap[dId] = { 
              driver_id: dId, 
              driver_name: driversMap[dId]?.name || 'سائق #' + dId.slice(0,4),
              avatar_url: driversMap[dId]?.avatar_url || '',
              delivery_count: 0,
              actual_paid_earnings: 0
            };
          }
          groupedMap[dId].delivery_count++;
        }

        const driverIds = Object.keys(groupedMap);
        let walletData: any[] = [];
        if (driverIds.length > 0) {
          const { data: wallets, error: wError } = await supabase
            .from('wallets')
            .select('user_id, current_balance')
            .in('user_id', driverIds);
          
          if (wError) return handleError('Driver Wallets', wError);
          walletData = wallets || [];
        }

        for (const w of (walletData || [])) {
          const dId = w.user_id;
          if (!groupedMap[dId]) continue; 
          groupedMap[dId].actual_paid_earnings = Number(w.current_balance) || 0;
        }

        return Object.keys(groupedMap).map(key => groupedMap[key]);
    }
  });

  // 4. Penalties Report
  const { data: penaltiesReport, isLoading: loadingPenalties } = useQuery({
    queryKey: ['penalties-report', dateRange, refreshKey],
    retry: 2,
    retryDelay: 2000,
    enabled: !loadingDrivers && !loadingVendors, // STAGGERED
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_penalties')
        .select('*, profile:profiles!target_user_id(user_type)')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });
      if (error) return handleError('Penalties Report', error);
      return data;
    }
  });

  // 5. Support Tickets Report
  const { data: supportTickets, isLoading: loadingSupport, error: supportError } = useQuery({
    queryKey: ['support-tickets-report', dateRange, refreshKey],
    retry: 2,
    retryDelay: 2000,
    enabled: !loadingPenalties && !loadingDrivers, // STAGGERED
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });
      if (error) return handleError('Support Tickets', error);
      return data;
    }
  });

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const header = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.keys(obj).map(key => `"${obj[key]}"`).join(','));
    const csvContent = "\uFEFF" + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${safeFormat(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  return (
    <div className="w-full pb-10" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4 border-b border-slate-100 pb-6 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white leading-none mb-1">مركز القيادة والتقارير المالية</h2>
          <p className="text-[13px] text-slate-400 font-medium tracking-wide">تقارير لحظية دقيقة بناءً على أحدث بيانات النظام</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAIAssistantOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
          >
            <Bot className="w-4 h-4" />
            <span>المساعد الذكي</span>
          </button>

          <button 
            onClick={handleRefresh}
            className="flex items-center justify-center w-[42px] h-[42px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 transition-all shrink-0 shadow-sm active:scale-95"
            title="تحديث البيانات"
          >
            <RefreshCw className={cn("w-4 h-4", (loadingProfits || loadingVendors) && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Technical Error Monitor - Detailed Breakdown for Android Debugging */}
      {technicalError && (
        <div className="mb-6 p-5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-3xl overflow-hidden shadow-xl shadow-rose-200/20" dir="rtl">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/30 animate-pulse">
                 <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-lg font-black text-rose-900 dark:text-rose-100">حدث خطأ تقني في: {technicalError.type}</h3>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-1">المشكلة: {technicalError.message}</p>
              </div>
            </div>
            <button 
              onClick={() => setTechnicalError(null)}
              className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition-colors text-rose-500"
            >
              إغلاق
            </button>
          </div>

          <div className="bg-slate-900 rounded-2xl p-4 border border-rose-500/20">
             <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                <span className="text-[10px] font-black text-rose-500 tracking-widest uppercase">مخرجات النظام التقني (Debug Log)</span>
                <div className="flex gap-2">
                   <button 
                    onClick={() => {
                        const logs = JSON.stringify(technicalError.details, null, 2);
                        navigator.clipboard.writeText(logs);
                        alert('تم نسخ السجل التقني، أرسله للمطور');
                    }}
                    className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-black transition-all"
                   >
                     نسخ السجل للتحليل
                   </button>
                   <button 
                    onClick={() => window.location.reload()}
                    className="text-[10px] bg-white text-slate-900 px-3 py-1.5 rounded-lg font-black transition-all"
                   >
                     تحديث الصفحة
                   </button>
                </div>
             </div>
             <pre className="text-[11px] font-mono text-rose-400 overflow-x-auto overflow-y-auto max-h-[300px] leading-relaxed">
               {JSON.stringify(technicalError.details, null, 2)}
             </pre>
          </div>
        </div>
      )}

      {/* Unified Filter Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Start */}
          <div className="relative flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 mr-1 uppercase tracking-wider">من تاريخ</label>
            <div className="relative flex items-center bg-slate-50 dark:bg-slate-900/50 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-emerald-500/30 transition-colors cursor-pointer">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 mr-2 truncate">
                {safeFormat(dateRange.start, "dd MMM yyyy", { locale: ar })}
              </span>
              <input 
                type="date" 
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={safeFormat(dateRange.start, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  if (!isNaN(d.getTime())) {
                    setDateRange(prev => ({ ...prev, start: startOfDay(d) }));
                  }
                }}
              />
            </div>
          </div>

          {/* Date End */}
          <div className="relative flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 mr-1 uppercase tracking-wider">إلى تاريخ</label>
            <div className="relative flex items-center bg-slate-50 dark:bg-slate-900/50 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-emerald-500/30 transition-colors cursor-pointer">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 mr-2 truncate">
                {safeFormat(dateRange.end, "dd MMM yyyy", { locale: ar })}
              </span>
              <input 
                type="date" 
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={safeFormat(dateRange.end, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  if (!isNaN(d.getTime())) {
                    setDateRange(prev => ({ ...prev, end: endOfDay(d) }));
                  }
                }}
              />
            </div>
          </div>

          {/* Vendor Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 mr-1 uppercase tracking-wider">المتجر</label>
            <div className="relative flex items-center">
              <Store className="absolute right-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select 
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl text-xs font-black shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white transition-all appearance-none"
              >
                <option value="all">كل المتاجر</option>
                {vendors?.map(v => <option key={v.user_id} value={v.user_id}>{v.brand_name}</option>)}
              </select>
            </div>
          </div>

          {/* Driver Filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 mr-1 uppercase tracking-wider">السائق</label>
            <div className="relative flex items-center">
              <User className="absolute right-3 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select 
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl text-xs font-black shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white transition-all appearance-none"
              >
                <option value="all">كل السائقين</option>
                {drivers?.map(d => <option key={d.user_id} value={d.user_id}>{d.full_name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Profit Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            name: "إجمالي المبيعات",
            value: profitStats?.totalSales || 0,
            icon: DollarSign,
            color: "emerald",
            desc: "القيمة الإجمالية للطلبات"
          },
          {
            name: "أرباح المنصة",
            value: profitStats?.platformProfit || 0,
            icon: TrendingUp,
            color: "blue",
            desc: "صافي ربح التطبيق"
          },
          {
            name: "مستحقات المتاجر",
            value: profitStats?.vendorDues || 0,
            icon: Store,
            color: "amber",
            desc: "بانتظار التحويل للمتاجر"
          },
          {
            name: "مستحقات المناديب",
            value: profitStats?.driverDues || 0,
            icon: Car,
            color: "purple",
            desc: "أرباح السائقين"
          }
        ].map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                card.color === 'emerald' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" :
                card.color === 'blue' ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10" :
                card.color === 'amber' ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10" :
                "bg-purple-50 text-purple-600 dark:bg-purple-500/10"
              )}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">{card.name}</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-none">
                  {loadingProfits ? "..." : `${card.value.toLocaleString()} ج.م`}
                </h3>
              </div>
            </div>
            <div className="pt-4 border-t border-slate-50 dark:border-slate-700/50 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium">{card.desc}</span>
              <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-bold">
                <span>لحظي</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        
        {/* Vendor Dues Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col transition-colors">
          <div className="p-5 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
                 <Store className="w-4 h-4 text-emerald-600" />
               </div>
               <h3 className="font-black text-sm text-slate-900 dark:text-white">مستحقات وأداء المتاجر</h3>
             </div>
             <button 
               onClick={() => exportToCSV(vendorReport || [], 'vendor_dues')}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors"
             >
                <Download className="w-3.5 h-3.5" /> 
                <span>تصدير البيانات</span>
             </button>
          </div>
          <div className="overflow-x-auto max-h-[400px] no-scrollbar text-right">
             <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-20 border-y border-slate-200 dark:border-slate-700">
                   <tr className="text-slate-600 dark:text-slate-100 font-black uppercase tracking-wider">
                      <th className="px-6 py-4">المتجر</th>
                      <th className="px-6 py-4">طلبات كاش</th>
                      <th className="px-6 py-4 text-rose-500">مبيعات كاش</th>
                      <th className="px-6 py-4">طلبات فيزا</th>
                      <th className="px-6 py-4 text-emerald-500">مبيعات فيزا</th>
                      <th className="px-6 py-4 font-black">إجمالي المبيعات</th>
                      <th className="px-6 py-4 text-amber-600">العمولة المستقطعة</th>
                      <th className="px-6 py-4 bg-emerald-50/50 dark:bg-emerald-500/5">المبلغ المستحق للمتجر</th>
                      <th className="px-6 py-4 text-center">الإجراءات</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                   {vendorReport?.map((row: any) => (
                     <tr key={row.vendor_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-600 group-hover:scale-110 transition-transform">
                              {row.avatar_url ? (
                                <img src={row.avatar_url} alt={row.brand_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Store className="w-4 h-4 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <span className="font-black text-slate-900 dark:text-white whitespace-nowrap">{row.brand_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-bold">{row.cash_orders_count}</td>
                        <td className="px-6 py-4 text-rose-600 dark:text-rose-400 font-black">{row.cash_sales_amount.toLocaleString()} ج.م</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-bold">{row.digital_orders_count}</td>
                        <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-black">{row.digital_sales_amount.toLocaleString()} ج.م</td>
                        <td className="px-6 py-4 font-black text-slate-900 dark:text-white uppercase tracking-tighter">{row.total_sales.toLocaleString()} ج.م</td>
                        <td className="px-6 py-4 text-amber-600 font-black">{row.total_commission.toLocaleString()} ج.م</td>
                        <td className="px-6 py-4 bg-emerald-50/30 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-black text-sm tracking-tighter border-x border-slate-50 dark:border-white/5">
                          {row.net_due.toLocaleString()} ج.م
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex justify-center">
                             <button 
                               onClick={() => setActiveModal({ type: 'vendor', id: row.vendor_id, name: row.brand_name })}
                               className="p-2 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-500 hover:text-white rounded-lg shadow-sm transition-all active:scale-95 group-hover:shadow-md"
                               title="عرض التفاصيل"
                             >
                                <Eye className="w-4 h-4" />
                             </button>
                           </div>
                        </td>
                     </tr>
                   ))}
                   {(!vendorReport || vendorReport.length === 0) && (
                     <tr><td colSpan={9} className="py-20 text-center text-slate-400 italic font-medium">لا توجد بيانات متاحة لهذا المدى الزمني</td></tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>

        {/* Driver Dues Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col transition-colors">
          <div className="p-5 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                 <Car className="w-4 h-4 text-blue-600" />
               </div>
               <h3 className="font-black text-sm text-slate-900 dark:text-white">مستحقات وأداء السائقين</h3>
             </div>
             <button 
               onClick={() => exportToCSV(driverReport || [], 'driver_dues')}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors"
             >
                <Download className="w-3.5 h-3.5" /> 
                <span>تصدير البيانات</span>
             </button>
          </div>
          <div className="overflow-x-auto max-h-[400px] no-scrollbar text-right">
             <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-20 border-y border-slate-200 dark:border-slate-700">
                   <tr className="text-slate-600 dark:text-slate-100 font-black uppercase tracking-wider">
                      <th className="px-6 py-4">السائق</th>
                      <th className="px-6 py-4">عدد التوصيلات</th>
                      <th className="px-6 py-4 bg-blue-50/50 dark:bg-blue-500/5">إجمالي الأرباح المستحقة</th>
                      <th className="px-6 py-4 text-center">الإجراءات</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                   {driverReport?.map((row: any) => (
                     <tr key={row.driver_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-600 group-hover:scale-110 transition-transform">
                              {row.avatar_url ? (
                                <img src={row.avatar_url} alt={row.driver_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <span className="font-black text-slate-900 dark:text-white whitespace-nowrap">{row.driver_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-bold">{row.delivery_count}</td>
                        <td className="px-6 py-4 bg-blue-50/30 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400 font-black text-sm tracking-tighter border-x border-slate-50 dark:border-white/5">
                          {row.actual_paid_earnings.toLocaleString()} ج.م
                        </td>
                        <td className="px-6 py-4 text-center">
                           <button 
                             onClick={() => setActiveModal({ type: 'driver', id: row.driver_id, name: row.driver_name })}
                             className="p-2 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-500 hover:text-white rounded-lg shadow-sm transition-all active:scale-95 group-hover:shadow-md"
                             title="عرض التفاصيل"
                           >
                              <Eye className="w-4 h-4" />
                           </button>
                        </td>
                     </tr>
                   ))}
                   {(!driverReport || driverReport.length === 0) && (
                     <tr><td colSpan={4} className="py-20 text-center text-slate-400 italic font-medium">لا توجد بيانات متاحة لهذا المدى الزمني</td></tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>
      </div>

      {/* Final Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Penalties section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col transition-colors">
          <div className="p-5 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <div className="p-2 bg-rose-50 dark:bg-rose-500/10 rounded-lg">
                 <AlertCircle className="w-4 h-4 text-rose-600" />
               </div>
               <h3 className="font-black text-sm text-slate-900 dark:text-white">الجزاءات المالية</h3>
             </div>
          </div>
          <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-600">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">جزاءات السائقين</p>
                    <h5 className="text-xl font-black text-slate-900 dark:text-white">
                       {(penaltiesReport?.filter((p: any) => p.profile?.user_type === 'driver')?.reduce((sum: number, p: any) => sum + (p.penalty_amount || 0), 0) || 0).toLocaleString()} ج.م
                    </h5>
                 </div>
                 <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-600">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">جزاءات المتاجر</p>
                    <h5 className="text-xl font-black text-slate-900 dark:text-white">
                       {(penaltiesReport?.filter((p: any) => p.profile?.user_type === 'vendor')?.reduce((sum: number, p: any) => sum + (p.penalty_amount || 0), 0) || 0).toLocaleString()} ج.م
                    </h5>
                 </div>
              </div>
              <div className="overflow-x-auto no-scrollbar">
                 <table className="w-full text-right text-[11px]">
                    <thead>
                       <tr className="text-slate-500 font-black border-b border-slate-200 dark:border-slate-700 tracking-wider">
                          <th className="py-3">الفئة</th>
                          <th className="py-3">النوع</th>
                          <th className="py-3 text-left">المبلغ</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                       {penaltiesReport?.slice(0, 5)?.map((p: any, idx: number) => (
                         <tr key={p.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 font-bold text-slate-900 dark:text-white">{p.penalty_category}</td>
                            <td className="py-3 text-slate-500 font-medium">{p.profile?.user_type === 'driver' ? 'سائق' : 'متجر'}</td>
                            <td className="py-3 text-left font-black text-rose-500">{(p.penalty_amount || 0).toLocaleString()} ج.م</td>
                         </tr>
                       ))}
                       {(!penaltiesReport || penaltiesReport.length === 0) && (
                         <tr><td colSpan={3} className="py-10 text-center text-slate-400 italic font-medium">لا توجد جزاءات مسجلة</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
          </div>
        </div>

        {/* Support Tickets Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col transition-colors">
          <div className="p-5 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                 <MessageSquare className="w-4 h-4 text-blue-600" />
               </div>
               <h3 className="font-black text-sm text-slate-900 dark:text-white">الشكاوي والنزاعات</h3>
             </div>
             <span className="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-[10px] font-black">
                {supportTickets?.length || 0} تذكرة
             </span>
          </div>
          <div className="overflow-x-auto no-scrollbar max-h-[400px]">
             <table className="w-full text-right text-[11px]">
                <thead className="bg-slate-50 dark:bg-slate-700/30 sticky top-0 z-10 transition-colors">
                   <tr className="text-slate-500 font-black border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider">
                      <th className="px-6 py-4">الموضوع</th>
                      <th className="px-6 py-4">الحالة</th>
                      <th className="px-6 py-4">الأولوية</th>
                      <th className="px-6 py-4">التاريخ</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                   {supportTickets?.slice(0, 8)?.map((t: any) => (
                     <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-900 dark:text-white max-w-[200px] truncate">{t.subject}</td>
                        <td className="px-6 py-4">
                           <span className={cn(
                             "px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-tighter",
                             t.status === 'resolved' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                           )}>
                              {t.status === 'resolved' ? 'تم الحل' : 'قيد المعالجة'}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           <span className={cn(
                             "font-black text-[10px]",
                             t.priority === 'urgent' ? "text-rose-600" : "text-slate-400"
                           )}>
                              {t.priority === 'urgent' ? 'عاجل' : 'عادي'}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-bold">{safeFormat(t.created_at, 'dd/MM/yyyy')}</td>
                     </tr>
                   ))}
                   {(!supportTickets || supportTickets.length === 0) && (
                     <tr><td colSpan={4} className="py-20 text-center text-slate-400 italic text-xs">لا توجد شكاوي مسجلة</td></tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <ReportsAIAssistant 
        isOpen={isAIAssistantOpen} 
        onClose={() => setIsAIAssistantOpen(false)} 
      />

      {/* Entity Orders Modal */}
      {activeModal && (
        <EntityOrdersModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          type={activeModal.type}
          entityId={activeModal.id}
          entityName={activeModal.name}
          dateRange={dateRange}
        />
      )}
    </div>
  );
}
