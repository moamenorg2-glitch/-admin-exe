import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ShoppingBag, 
  DollarSign, 
  Users, 
  Clock, 
  TrendingUp, 
  ArrowRight, 
  Package, 
  Truck, 
  Activity,
  ChevronLeft,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area
} from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { cn } from '../lib/utils';
import { dashboardService } from '../services/dashboardService';
import { handleGlobalError } from '../utils/errorHandler';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.email === 'moamen.org2@gmail.com';

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

  // Only super admin or those with 'all_access' permission get full access
  const hasFullAccess = isSuperAdmin || permissions?.includes('all_access');

  // Fetch basic stats and chart data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: async () => {
      try {
        return await dashboardService.fetchDashboardData();
      } catch (error) {
        handleGlobalError(error, 'Fetch Dashboard Data');
        throw error;
      }
    },
    refetchInterval: 30000,
  });

  const { data: healthAlerts } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const alerts: { id: string; type: 'warning' | 'error'; message: string; action?: string }[] = [];
      
      // 1. Orders stuck in Pending
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: stuckOrders } = await supabase
        .from('master_orders')
        .select('order_number')
        .eq('status', 'Pending')
        .lt('created_at', thirtyMinsAgo);
      
      if (stuckOrders && stuckOrders.length > 0) {
        alerts.push({
          id: 'stuck-orders',
          type: 'warning',
          message: `هناك ${stuckOrders.length} طلبات معلقة منذ أكثر من 30 دقيقة.`,
          action: 'عرض الطلبات'
        });
      }

      // 2. Paid orders without driver
      const { data: paidNoDriver } = await supabase
        .from('master_orders')
        .select('id')
        .eq('payment_status', 'Paid')
        .eq('status', 'Pending');
      
      if (paidNoDriver && paidNoDriver.length > 0) {
        alerts.push({
          id: 'paid-no-driver',
          type: 'error',
          message: `يوجد ${paidNoDriver.length} طلبات مدفوعة لم يتم تعيين مندوب لها بعد.`,
          action: 'تعيين الآن'
        });
      }

      // 3. Inactive online drivers
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: inactiveDrivers } = await supabase
        .from('driver_details')
        .select('user_id')
        .eq('is_online', true)
        .lt('updated_at', oneHourAgo);
      
      if (inactiveDrivers && inactiveDrivers.length > 0) {
        alerts.push({
          id: 'inactive-drivers',
          type: 'warning',
          message: `هناك ${inactiveDrivers.length} مناديب "متصلين" لم يحدثوا موقعهم منذ ساعة.`,
        });
      }

      return alerts;
    },
    refetchInterval: 60000
  });

  // Set up real-time subscriptions
  useEffect(() => {
    const ordersChannel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'master_orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-data'] }).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_details' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-data'] }).catch(console.error);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel).catch(err => {
        console.error('Error removing dashboard channel:', err);
      });
    };
  }, [queryClient]);

  const statCards = [
    { 
      name: 'طلبات اليوم', 
      value: dashboardData?.stats?.ordersToday || 0, 
      icon: Package, 
      colorClass: 'bg-blue-50 text-blue-600',
      trend: '+12%',
      description: 'إجمالي الطلبات المستلمة اليوم'
    },
    { 
      name: 'إيرادات اليوم', 
      value: `${dashboardData?.stats?.revenueToday.toFixed(2) || 0} ج.م`, 
      icon: DollarSign, 
      colorClass: 'bg-emerald-50 text-emerald-600',
      trend: '+5%',
      description: 'المبيعات المكتملة بنجاح'
    },
    { 
      name: 'سائقين متاحين', 
      value: dashboardData?.stats?.availableDrivers || 0, 
      icon: Truck, 
      colorClass: 'bg-indigo-50 text-indigo-600',
      trend: 'نشط',
      description: 'المناديب الجاهزون للاستلام'
    },
    { 
      name: 'طلبات معلقة', 
      value: dashboardData?.stats?.pendingOrders || 0, 
      icon: Clock, 
      colorClass: 'bg-amber-50 text-amber-600',
      trend: 'تنبيه',
      description: 'طلبات بانتظار الموافقة'
    },
  ];

  const statusColors: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-700 border-amber-200',
    Active: 'bg-blue-100 text-blue-700 border-blue-200',
    OnTheWay: 'bg-purple-100 text-purple-700 border-purple-200',
    Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Cancelled: 'bg-red-100 text-red-700 border-red-200',
    Rejected: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const statusNames: Record<string, string> = {
    Pending: 'قيد الانتظار',
    Active: 'جاري التحضير',
    OnTheWay: 'في الطريق',
    Completed: 'تم التوصيل',
    Cancelled: 'ملغي',
    Rejected: 'مرفوض',
  };

  const canViewOrders = hasFullAccess || permissions?.includes('الطلبات');

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">نظرة عامة على النظام</h2>
          <p className="mt-2 text-gray-500 text-lg">مرحباً بك مجدداً. إليك ما يحدث في منصتك اليوم.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-gray-600">
              آخر تحديث: {format(new Date(), 'HH:mm:ss')}
            </span>
          </div>
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard-data'] }).catch(console.error)}
            className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 active:scale-95"
          >
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* System Health Alerts */}
      {healthAlerts && healthAlerts.length > 0 && (
        <div className="space-y-3">
          {healthAlerts.map((alert, idx) => (
            <motion.div
              key={alert.id || `alert-${idx}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "p-4 rounded-2xl border flex items-center justify-between shadow-sm",
                alert.type === 'error' 
                  ? "bg-red-50 border-red-100 text-red-800" 
                  : "bg-amber-50 border-amber-100 text-amber-800"
              )}
            >
              <div className="flex items-center gap-3">
                <AlertCircle className={cn("w-5 h-5", alert.type === 'error' ? "text-red-500" : "text-amber-500")} />
                <span className="text-sm font-bold">{alert.message}</span>
              </div>
              {alert.action && (
                <button 
                  onClick={() => {
                    if (alert.id === 'stuck-orders' || alert.id === 'paid-no-driver') {
                      window.location.href = '/orders';
                    }
                  }}
                  className="text-xs font-black underline underline-offset-4 decoration-2 hover:opacity-70 transition-opacity"
                >
                  {alert.action}
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((item, idx) => (
          <div key={`stat-${item.name}-${idx}`} className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-5">
              <div className={cn(`p-3.5 rounded-2xl group-hover:scale-110 transition-transform`, item.colorClass)}>
                <item.icon className="h-6 w-6" />
              </div>
              <div className={cn(`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full`, item.colorClass)}>
                {item.trend}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 mb-1">{item.name}</p>
              <div className="text-3xl font-black text-gray-900 tracking-tight">
                {isLoading ? (
                  <div className="h-9 w-24 bg-gray-100 animate-pulse rounded-lg"></div>
                ) : item.value}
              </div>
              <p className="mt-2 text-xs text-gray-400 font-medium">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Orders Chart */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-bold text-gray-900">تحليل الطلبات</h3>
              <p className="text-sm text-gray-400 mt-1">تطور حجم الطلبات خلال الأسبوع</p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div className="h-80 w-full min-h-[320px]">
            {isLoading ? (
              <div className="w-full h-full bg-gray-50 animate-pulse rounded-2xl"></div>
            ) : dashboardData?.chartData && dashboardData.chartData.length > 0 ? (
              <ResponsiveContainer width="99%" height="100%">
                <BarChart data={dashboardData?.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="orders" fill="#f97316" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">لا توجد بيانات للرسم البياني</div>
            )}
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-bold text-gray-900">نمو الإيرادات</h3>
              <p className="text-sm text-gray-400 mt-1">إجمالي المبيعات المحققة بالجنيه المصري</p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div className="h-80 w-full min-h-[320px]">
            {isLoading ? (
              <div className="w-full h-full bg-gray-50 animate-pulse rounded-2xl"></div>
            ) : dashboardData?.chartData && dashboardData.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboardData?.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">لا توجد بيانات للرسم البياني</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-7 border-b border-gray-50 flex items-center justify-between bg-white">
          <div>
            <h3 className="text-xl font-bold text-gray-900">الطلبات الأخيرة</h3>
            <p className="text-sm text-gray-400 mt-1">متابعة فورية لأحدث العمليات على المنصة</p>
          </div>
          {canViewOrders && (
            <Link to="/orders" className="group inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-100 transition-all">
              عرض كافة الطلبات
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-xs font-bold uppercase tracking-widest">
                <th className="px-8 py-5">رقم الطلب</th>
                <th className="px-8 py-5">العميل</th>
                <th className="px-8 py-5">الحالة التشغيلية</th>
                <th className="px-8 py-5">القيمة الإجمالية</th>
                <th className="px-8 py-5">توقيت الطلب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-row-${i}`} className="animate-pulse">
                    <td className="px-8 py-5"><div className="h-5 w-20 bg-gray-100 rounded-lg"></div></td>
                    <td className="px-8 py-5"><div className="h-5 w-32 bg-gray-100 rounded-lg"></div></td>
                    <td className="px-8 py-5"><div className="h-5 w-24 bg-gray-100 rounded-lg"></div></td>
                    <td className="px-8 py-5"><div className="h-5 w-24 bg-gray-100 rounded-lg"></div></td>
                    <td className="px-8 py-5"><div className="h-5 w-32 bg-gray-100 rounded-lg"></div></td>
                  </tr>
                ))
              ) : dashboardData?.recentOrders?.map((order: any, idx: number) => (
                <tr key={order.id || `order-${idx}`} className="group hover:bg-gray-50/50 transition-colors cursor-default">
                  <td className="px-8 py-5 font-bold text-gray-900">
                    <span className="bg-gray-100 px-2.5 py-1 rounded-lg text-gray-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                      #{order.order_number}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold text-xs">
                        {order.customer?.full_name?.charAt(0) || 'ع'}
                      </div>
                      <span className="text-gray-700 font-medium">{order.customer?.full_name || 'عميل مجهول'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border ${statusColors[order.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ml-2 ${order.status === 'Completed' ? 'bg-emerald-500' : order.status === 'Pending' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                      {statusNames[order.status] || order.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 font-black text-gray-900">{order.grand_total} ج.م</td>
                  <td className="px-8 py-5 text-sm text-gray-400 font-medium">
                    {format(new Date(order.created_at), 'dd MMM yyyy, HH:mm', { locale: ar })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
