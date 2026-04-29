import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { format, differenceInMinutes } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Search, Filter, Eye, AlertCircle, Clock, Motorbike, User, Store, MessageSquare, X, Download, RefreshCw, History, Settings, Phone, CheckCircle2, MapPin, ChevronDown, ArrowUp, ArrowDown, UserPlus, Zap, Trash2, Hash } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getDelayStatus } from '../../utils/orderUtils';
import OrderDetailsPanel from '../../components/orders/OrderDetailsPanel';
import AssignDriverModal from '../../components/orders/AssignDriverModal';
import LiveMap from '../zones/LiveMap';
import { orderService } from '../../services/orderService';
import { handleGlobalError } from '../../utils/errorHandler';
import toast from 'react-hot-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useInfiniteOrders } from '../../hooks/useOrders';
import { useInView } from 'react-intersection-observer';
import { useDebounce } from '../../hooks/useDebounce';
import { OrderStats } from '../../components/orders/OrderStats';

type OrderStatus = 'Pending' | 'Active' | 'OnTheWay' | 'Completed' | 'Cancelled' | 'Rejected';

const statusColors: Record<OrderStatus, string> = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-100',
  Active: 'bg-blue-50 text-blue-700 border-blue-100',
  OnTheWay: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Cancelled: 'bg-gray-50 text-gray-700 border-gray-100',
  Rejected: 'bg-red-50 text-red-700 border-red-100',
};

const statusNames: Record<OrderStatus, string> = {
  Pending: 'قيد الانتظار',
  Active: 'نشط (جاري التحضير)',
  OnTheWay: 'في الطريق',
  Completed: 'مكتمل',
  Cancelled: 'ملغي',
  Rejected: 'مرفوض',
};

const paymentStatusNames: Record<string, string> = {
  Paid: 'مدفوع',
  Unpaid: 'غير مدفوع',
  Refunded: 'مسترجع',
  Failed: 'فاشل',
};

const paymentMethodStyles: Record<string, string> = {
  'نقداً': 'bg-red-100 text-red-700',
  'Cash': 'bg-red-100 text-red-700',
  'بطاقة': 'bg-purple-100 text-purple-700',
  'Card': 'bg-purple-100 text-purple-700',
  'محفظة': 'bg-green-100 text-green-700',
  'Wallet': 'bg-green-100 text-green-700',
};

const statusOrder: Record<OrderStatus, number> = {
  Pending: 1,
  Active: 2,
  OnTheWay: 3,
  Completed: 4,
  Rejected: 5,
  Cancelled: 6,
};


const CURRENT_AVAILABLE_STATUSES: OrderStatus[] = ['Pending', 'Active', 'OnTheWay'];
const COMPLETED_AVAILABLE_STATUSES: OrderStatus[] = ['Completed'];
const CANCELLED_AVAILABLE_STATUSES: OrderStatus[] = ['Cancelled', 'Rejected'];

export default function OrdersList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const initialOrderId = searchParams.get('orderId');

  const [selectedStatuses, setSelectedStatuses] = useState<OrderStatus[]>([]);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom' | 'all'>('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Apply debounce to the search query to prevent excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 600);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [trackingTarget, setTrackingTarget] = useState<{type: 'order' | 'driver' | 'vendor', id: string, name?: string} | null>(null);
  const [assigningDriverOrderId, setAssigningDriverOrderId] = useState<string | null>(null);
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'current' | 'completed' | 'cancelled'>('current');
  
  // Thresholds state
  const [prepThreshold, setPrepThreshold] = useState(() => {
    const saved = localStorage.getItem('PREP_THRESHOLD');
    return saved ? parseInt(saved) : 30;
  });
  const [deliveryThreshold, setDeliveryThreshold] = useState(() => {
    const saved = localStorage.getItem('DELIVERY_THRESHOLD');
    return saved ? parseInt(saved) : 45;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<{
    type: 'customer' | 'vendor' | 'driver';
    data: any;
  } | null>(null);
  const [openVendorDropdownId, setOpenVendorDropdownId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const pageSize = 20;

  const availableStatusesToShow = useMemo(() => {
    if (activeTab === 'current') return CURRENT_AVAILABLE_STATUSES;
    if (activeTab === 'completed') return COMPLETED_AVAILABLE_STATUSES;
    return CANCELLED_AVAILABLE_STATUSES;
  }, [activeTab]);

  const resolvedStatusesForQuery = useMemo(() => 
    selectedStatuses.length > 0 ? selectedStatuses : availableStatusesToShow,
    [selectedStatuses, availableStatusesToShow]
  );

  const filters = useMemo(() => ({
    selectedStatuses: resolvedStatusesForQuery,
    dateRange,
    customDateRange,
    searchQuery: debouncedSearchQuery
  }), [resolvedStatusesForQuery, dateRange, customDateRange, debouncedSearchQuery]);

  const { 
    data, 
    isLoading, 
    isFetching, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    refetch, 
    now 
  } = useInfiniteOrders(pageSize, filters);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allOrders = useMemo(() => {
    return data?.pages.flatMap(page => page.orders) || [];
  }, [data]);


  const removeDriverMutation = useMutation({
    mutationFn: async ({ teamId, driverId }: { teamId: string, driverId: string }) => {
      await orderService.removeDriver(teamId, driverId);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم إزالة السائق بنجاح');
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Remove Driver');
    }
  });

  const assignDriverMutation = useMutation({
    mutationFn: async ({ orderId, driverId }: { orderId: string, driverId: string }) => {
      await orderService.assignDriver(orderId, driverId);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم تعيين السائق بنجاح');
      setAssigningDriverOrderId(null);
    },
    onError: (error: any) => {
      if (error.message === 'هذا المندوب معين بالفعل لهذا الطلب') {
        toast(error.message, { icon: '⚠️', style: { background: '#FEF3C7', color: '#92400E', fontWeight: 'bold' } });
      } else {
        handleGlobalError(error, 'Assign Driver');
      }
    }
  });

  const autoAssignDriverMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Get current assigned drivers for this order
      const { data: currentTeam } = await supabase
        .from('order_delivery_team')
        .select('driver_id')
        .eq('master_order_id', orderId);
      
      const assignedIds = currentTeam?.map(dt => dt.driver_id) || [];

      // 1. Try to find a free online driver first
      let query = supabase
        .from('driver_details')
        .select('user_id')
        .eq('is_online', true)
        .eq('is_busy', false);

      if (assignedIds.length > 0) {
        query = query.not('user_id', 'in', assignedIds);
      }

      let { data: drivers, error: driversError } = await query.limit(1);
      if (driversError) throw driversError;

      // 2. If no free driver, pick any online driver
      if (!drivers || drivers.length === 0) {
        let anyQuery = supabase
          .from('driver_details')
          .select('user_id')
          .eq('is_online', true);

        if (assignedIds.length > 0) {
          anyQuery = anyQuery.not('user_id', 'in', assignedIds);
        }

        const { data: anyOnlineDrivers, error: anyError } = await anyQuery.limit(1);
        if (anyError) throw anyError;
        drivers = anyOnlineDrivers;
      }

      if (!drivers || drivers.length === 0) {
        throw new Error('لا يوجد سائقين متصلين حالياً أو جميع السائقين المتصلين معينين بالفعل لهذا الطلب.');
      }

      await orderService.assignDriver(orderId, drivers[0].user_id);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم التعيين التلقائي للسائق بنجاح');
    },
    onError: (error: any) => {
      if (error.message.includes('لا يوجد سائقين متصلين')) {
        toast(error.message, { icon: '⚠️', style: { background: '#FEF3C7', color: '#92400E', fontWeight: 'bold' } });
      } else {
        handleGlobalError(error, 'Auto Assign Driver');
      }
    }
  });

  useEffect(() => {
    if (initialOrderId) {
      setSelectedOrderId(initialOrderId);
    }
  }, [initialOrderId]);

  const handleQuickAccept = async (orderId: string) => {
    try {
      await orderService.updateOrderStatus(orderId, 'Active');
      toast.success('تم قبول الطلب بنجاح وتحويله للتحضير');
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
    } catch (error) {
      handleGlobalError(error, 'Quick Accept Order');
    }
  };

  const handleExport = async () => {
    if (!allOrders.length) return;
    
    const exportData = allOrders.map(order => ({
      'رقم الطلب': order.order_number,
      'العميل': order.customer?.full_name || 'غير معروف',
      'رقم الهاتف': order.customer?.primary_phone || '',
      'المتاجر': order.sub_orders?.map((so: any) => so.vendor?.brand_name).join(', ') || '',
      'الحالة': statusNames[order.status as OrderStatus] || order.status,
      'الإجمالي': order.grand_total,
      'تاريخ الإنشاء': format(new Date(order.created_at), 'yyyy/MM/dd HH:mm', { locale: ar }),
      'طريقة الدفع': order.payment_method || 'نقداً',
      'حالة الدفع': paymentStatusNames[order.payment_status] || order.payment_status,
      'المندوبين': order.sub_orders?.flatMap((so: any) => so.delivery_team?.map((dt: any) => dt.driver?.user?.full_name)).filter(Boolean).join(', ') || 'لم يتم التعيين'
    }));

    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      XLSX.writeFile(wb, `orders_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    } catch (error) {
      console.error('Error generating Excel file:', error);
      toast.error('حدث خطأ أثناء تصدير الملف');
    }
  };

  const toggleStatusFilter = useCallback((status: OrderStatus) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedStatuses([]);
    setDateRange('all');
    setCustomDateRange({ start: '', end: '' });
    setSearchQuery('');
  }, []);

  const getDelayStatusForOrder = useCallback((order: any) => {
    return getDelayStatus(order, now, prepThreshold, deliveryThreshold);
  }, [now, prepThreshold, deliveryThreshold]);

  const handleSort = useCallback((key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    setSortConfig(currentConfig => {
      if (currentConfig && currentConfig.key === key && currentConfig.direction === 'asc') {
        direction = 'desc';
      }
      return { key, direction };
    });
  }, []);

  const sortedOrders = useMemo(() => {
    if (!allOrders.length) return [];
    if (!sortConfig) return allOrders;

    return [...allOrders].sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof typeof a];
      let bValue: any = b[sortConfig.key as keyof typeof b];

      // Handle nested or special fields
      if (sortConfig.key === 'customer') {
        aValue = a.customer?.full_name || '';
        bValue = b.customer?.full_name || '';
      } else if (sortConfig.key === 'date') {
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
      } else if (sortConfig.key === 'total') {
        aValue = Number(a.grand_total) || 0;
        bValue = Number(b.grand_total) || 0;
      } else if (sortConfig.key === 'vendors') {
        aValue = a.sub_orders?.length || 0;
        bValue = b.sub_orders?.length || 0;
      } else if (sortConfig.key === 'driver') {
        aValue = a.delivery_team?.[0]?.driver?.user?.full_name || '';
        bValue = b.delivery_team?.[0]?.driver?.user?.full_name || '';
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [allOrders, sortConfig]);

  useEffect(() => {
    if (infoModal && (infoModal.type === 'vendor' || infoModal.type === 'driver')) {
      const id = infoModal.type === 'vendor' ? infoModal.data.user_id : infoModal.data.user_id;
      if (id && infoModal.data.completed_today === undefined) {
        orderService.fetchEntityDailyStats(infoModal.type, id)
          .then(stats => {
            setInfoModal(prev => {
              if (prev && prev.data.user_id === id) {
                return { ...prev, data: { ...prev.data, ...stats } };
              }
              return prev;
            });
          })
          .catch(console.error);
      }
    }
  }, [infoModal]);

  const statsData = useMemo(() => {
    const orders = allOrders || [];
    return {
      count: data?.pages[0]?.count || 0,
      pendingCount: orders.filter(o => o.status === 'Pending').length || 0,
      delayedCount: orders.filter(o => getDelayStatusForOrder(o).isDelayed).length || 0,
      totalSales: orders.filter(o => o.status === 'Completed').reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0).toFixed(2) || '0.00'
    };
  }, [allOrders, data?.pages, getDelayStatusForOrder]);

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-emerald-100 rounded-2xl shadow-sm relative">
              <RefreshCw className="w-7 h-7 text-emerald-600" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">إدارة الطلبات</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 animate-pulse">
                  مباشر
                </span>
              </div>
              <p className="mt-1 text-gray-500 font-medium">متابعة ومعالجة جميع الطلبات في الوقت الفعلي.</p>
            </div>
          </div>
        

      </div>

      {/* Summary Stats */}
      <OrderStats 
        count={statsData.count}
        pendingCount={statsData.pendingCount}
        delayedCount={statsData.delayedCount}
        totalSales={statsData.totalSales}
      />

      {/* Unified Orders Control Center */}
      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700 overflow-visible mb-6 z-10 relative">
        
        {/* Top Header: Tabs */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center p-4 xl:p-5 border-b border-gray-100/80 dark:border-slate-700/80 bg-gray-50/30 dark:bg-slate-800/50 gap-4">
          {/* Tabs */}
          <div className="flex bg-gray-100/80 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-gray-200/50 dark:border-slate-700/50 w-full xl:w-fit">
            <button
              onClick={() => {
                setActiveTab('current');
                setSelectedStatuses([]);
              }}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer flex-1 xl:flex-none text-center",
                activeTab === 'current' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-800"
              )}
            >
              الطلبات الحالية
            </button>
            <button
              onClick={() => {
                setActiveTab('completed');
                setSelectedStatuses([]);
              }}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer flex-1 xl:flex-none text-center",
                activeTab === 'completed' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-800"
              )}
            >
              الطلبات المكتملة
            </button>
            <button
              onClick={() => {
                setActiveTab('cancelled');
                setSelectedStatuses([]);
              }}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer flex-1 xl:flex-none text-center",
                activeTab === 'cancelled' 
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "text-gray-500 dark:text-gray-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-800"
              )}
            >
              الطلبات الملغية
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-2 text-gray-400 text-xs font-bold">
            <Hash className="w-3.5 h-3.5" />
            <span>عرض {sortedOrders.length} من {statsData.count} طلب</span>
          </div>
        </div>

        {/* Middle Body: Search & Filters */}
        <div className="p-4 xl:p-5 space-y-5">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-emerald-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="بحث برقم الطلب، اسم العميل، رقم الهاتف، أو اسم المتجر..."
                value={searchQuery || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pr-12 pl-4 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 text-sm font-bold transition-all shadow-inner dark:text-white"
              />
            </div>

            <div className="w-full lg:w-56 relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <Filter className="h-4 w-4 text-gray-400 dark:text-gray-500 group-focus-within:text-emerald-500 transition-colors" />
              </div>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="block w-full pr-11 pl-4 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 text-sm font-bold appearance-none transition-all shadow-inner dark:text-white"
              >
                <option value="all">جميع التواريخ</option>
                <option value="today">اليوم</option>
                <option value="week">هذا الأسبوع</option>
                <option value="month">هذا الشهر</option>
                <option value="custom">تاريخ مخصص</option>
              </select>
            </div>
            
            {(selectedStatuses.length > 0 || dateRange !== 'all' || searchQuery) && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={clearFilters}
                className="inline-flex items-center justify-center px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-black text-xs rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-red-100 dark:border-red-900/30 cursor-pointer lg:w-auto w-full shrink-0"
              >
                <X className="w-4 h-4 ml-1.5" />
                مسح الفلاتر
              </motion.button>
            )}
          </div>

          <AnimatePresence>
            {dateRange === 'custom' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-4 items-center p-3.5 bg-gray-50/50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400">من:</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm dark:text-white dark:color-scheme-dark"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-black text-gray-500 dark:text-gray-400">إلى:</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-2 focus:ring-emerald-500 transition-all shadow-sm dark:text-white dark:color-scheme-dark"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unified Actions Row: Status, Sort, and Quick Actions */}
          <div className="flex flex-col xl:flex-row xl:items-end gap-5 p-5 bg-gray-50/80 dark:bg-slate-800/80 rounded-2xl border border-gray-200/50 dark:border-slate-700/50">
            {activeTab === 'current' && (
              <>
                <div className="flex-1 space-y-2.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest pl-1">
                    <Filter className="w-3.5 h-3.5" /> تصفية حسب الحالة
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(statusNames)
                      .filter(([key]) => availableStatusesToShow.includes(key as OrderStatus))
                      .map(([key, value]) => (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        key={key}
                        onClick={() => toggleStatusFilter(key as OrderStatus)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl text-[11px] font-black border transition-all tracking-wide cursor-pointer",
                          selectedStatuses.includes(key as OrderStatus)
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-500/20"
                            : "bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-slate-600 hover:text-emerald-700 dark:hover:text-emerald-400 shadow-sm"
                        )}
                      >
                        {value}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="w-px h-12 bg-gray-200 dark:bg-slate-600 hidden xl:block mx-1"></div>
              </>
            )}

            <div className="space-y-2.5 flex-1 xl:flex-none">
              <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest pl-1">
                <ArrowDown className="w-3.5 h-3.5" /> ترتيب بواسطة
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'order_number', label: 'رقم' },
                  { key: 'date', label: 'التاريخ' },
                  { key: 'total', label: 'الإجمالي' },
                  { key: 'status', label: 'الحالة' }
                ].map(col => (
                  <motion.button
                    key={col.key}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border flex items-center gap-1 cursor-pointer",
                      sortConfig?.key === col.key 
                        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
                        : "bg-white dark:bg-slate-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-slate-600 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-700 shadow-sm"
                    )}
                  >
                    {col.label}
                    {sortConfig?.key === col.key && (
                      sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="w-px h-12 bg-gray-200 dark:bg-slate-600 hidden xl:block mx-1"></div>

            <div className="space-y-2.5 flex-1 xl:flex-none">
              <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest pl-1">
                <Settings className="w-3.5 h-3.5" /> إجراءات
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleExport}
                  className="inline-flex items-center justify-center px-4 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 shadow-sm text-[10px] font-black rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 hover:border-gray-300 transition-all cursor-pointer h-[34px]"
                >
                  <Download className="w-3.5 h-3.5 ml-1.5 text-blue-500 dark:text-blue-400" />
                  تصدير
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsSettingsOpen(true)}
                  className="inline-flex items-center justify-center px-4 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 shadow-sm text-[10px] font-black rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 hover:border-gray-300 transition-all cursor-pointer h-[34px]"
                >
                  <Clock className="w-3.5 h-3.5 ml-1.5 text-amber-500 dark:text-amber-400" />
                  الوقت
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => refetch().catch(console.error)}
                  className="inline-flex items-center justify-center w-[34px] h-[34px] bg-emerald-600 border border-emerald-500 shadow-md shadow-emerald-500/20 text-white rounded-xl hover:bg-emerald-700 hover:border-emerald-600 transition-all cursor-pointer"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", (isFetching || isLoading) && "animate-spin")} />
                </motion.button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Cards Grid */}
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 transition-opacity duration-300", isFetching && !isLoading ? "opacity-60" : "")}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={`orders-skeleton-${index}`} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 animate-pulse flex flex-col gap-4">
              <div className="flex justify-between items-center"><div className="h-6 bg-gray-200 rounded-xl w-24"></div><div className="h-6 bg-gray-200 rounded-full w-20"></div></div>
              <div className="h-10 bg-gray-200 rounded-2xl w-full"></div>
              <div className="h-20 bg-gray-200 rounded-2xl w-full"></div>
            </div>
          ))
        ) : sortedOrders.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center text-gray-500 rounded-3xl border border-gray-100">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-gray-50 rounded-full">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <span className="font-bold text-gray-400">لا توجد طلبات تطابق معايير البحث</span>
            </div>
          </div>
        ) : (
          sortedOrders.map((order) => {
            const delay = getDelayStatusForOrder(order);
            return (
              <div 
                key={order.id} 
                className={cn(
                  "bg-white dark:bg-slate-800 rounded-3xl border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden relative group/card",
                  delay.isDelayed ? "border-red-200 dark:border-red-900/50" : "border-gray-100 dark:border-slate-700"
                )}
              >
                
                {/* Header Section */}
                <div className={cn(
                  "p-3.5 border-b flex items-start justify-between backdrop-blur-md",
                  delay.isDelayed 
                    ? "bg-gradient-to-r from-red-50/80 to-white dark:from-red-900/20 dark:to-slate-800 border-red-50 dark:border-red-900/30" 
                    : "bg-gradient-to-r from-gray-50/80 to-white dark:from-slate-800/80 dark:to-slate-800 border-gray-50 dark:border-slate-700/50"
                )}>
                  <div className="flex items-center gap-3">
                    {true && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-gray-900 dark:text-white bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-3 py-1.5 rounded-xl shadow-sm">#{order.order_number}</span>
                        {order.notes && (
                          <div className="group/note relative">
                            <MessageSquare className="w-4 h-4 text-emerald-500 dark:text-emerald-400 cursor-help drop-shadow-sm" />
                            <div className="hidden group-hover/note:block absolute z-20 w-64 p-4 bg-gray-900 dark:bg-gray-950 text-white text-xs rounded-2xl shadow-2xl top-full right-0 mt-2 leading-relaxed border border-gray-800">
                              <div className="font-black mb-1 text-emerald-400 uppercase tracking-widest">ملاحظات العميل:</div>
                              {order.notes}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {true && (
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHistoryOrder(order);
                        }}
                        className={cn(
                          "px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-black rounded-xl border uppercase tracking-[0.1em] hover:opacity-80 transition-all cursor-pointer shadow-sm relative overflow-hidden",
                          statusColors[order.status as OrderStatus],
                          "dark:bg-opacity-20 dark:shadow-none"
                        )}
                      >
                        <span className="relative z-10">{statusNames[order.status as OrderStatus]}</span>
                      </motion.button>
                    )}
                    {true && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-bold flex items-center gap-1 opacity-80">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(order.created_at), 'PPpp', { locale: ar })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Section */}
                <div className="p-3.5 flex-1 flex flex-col gap-3.5">
                  {true && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest pl-1">العميل</span>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setInfoModal({ 
                          type: 'customer', 
                          data: { ...order.customer, address: order.address, masterOrderId: order.id } 
                        })}
                        className="flex items-center text-right group/info bg-gray-50 hover:bg-emerald-50 dark:bg-slate-700/30 dark:hover:bg-slate-700 p-2 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-emerald-100 dark:hover:border-slate-600"
                      >
                        <div className="h-8 w-8 rounded-full bg-white dark:bg-slate-600 flex items-center justify-center border border-gray-200 dark:border-slate-500 group-hover/info:border-emerald-200 dark:group-hover/info:border-emerald-500/50 shadow-sm overflow-hidden shrink-0 transition-colors">
                          {order.customer?.avatar_url ? (
                            <img 
                              src={order.customer.avatar_url} 
                              alt="" 
                              className="h-full w-full object-cover rounded-full"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </div>
                        <div className="mr-2.5 overflow-hidden flex-1 flex flex-row items-center justify-between gap-2">
                          <div className="text-sm font-bold text-gray-800 dark:text-gray-200 group-hover/info:text-emerald-700 dark:group-hover/info:text-emerald-400 truncate">{order.customer?.full_name || 'غير معروف'}</div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-md font-bold" title="طلبات مكتملة">
                              ✓ {order.customer?.order_history?.filter((h: any) => h.status === 'Completed').length || 0}
                            </span>
                            <span className="text-[10px] bg-red-100/50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded-md font-bold" title="طلبات ملغية">
                              ✗ {order.customer?.order_history?.filter((h: any) => ['Cancelled', 'Rejected'].includes(h.status)).length || 0}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    </div>
                  )}

                  {true && (
                    <div className="flex flex-col gap-1.5 border-t border-gray-100/60 dark:border-slate-700/60 pt-3">
                      <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest pl-1">المتاجر</span>
                      {order.sub_orders?.length > 1 ? (
                        <div className="relative">
                          <motion.button
                            onClick={() => setOpenVendorDropdownId(openVendorDropdownId === order.id ? null : order.id)}
                            className="flex items-center justify-between w-full text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer shadow-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Store className="w-3.5 h-3.5" />
                              <span>{order.sub_orders.length} متاجر</span>
                            </div>
                            <ChevronDown className={cn("w-4 h-4 transition-transform", openVendorDropdownId === order.id && "rotate-180")} />
                          </motion.button>
                          
                          <AnimatePresence>
                            {openVendorDropdownId === order.id && (
                              <motion.div
                                initial={{ opacity: 0, y: -5, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -5, height: 0 }}
                                className="overflow-hidden bg-white dark:bg-slate-800 rounded-b-xl border-x border-b border-emerald-100 dark:border-emerald-800/50 flex flex-col shadow-lg absolute w-full z-10"
                              >
                                {order.sub_orders.map((so: any) => (
                                  <motion.button 
                                    key={so.id} 
                                    onClick={() => { setInfoModal({ type: 'vendor', data: { ...so.vendor, masterOrderId: order.id } }); setOpenVendorDropdownId(null); }}
                                    className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 px-3 py-2.5 transition-colors w-full text-right cursor-pointer border-t border-gray-50 dark:border-slate-700/50"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-5 h-5 rounded bg-white dark:bg-slate-700 flex items-center justify-center shrink-0 border border-gray-100 dark:border-slate-600 overflow-hidden shadow-sm">
                                        {so.vendor?.profile?.avatar_url ? (
                                          <img src={so.vendor.profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                          <Store className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                                        )}
                                      </div>
                                      <span className="truncate max-w-[120px]">{so.vendor?.brand_name || 'غير معروف'}</span>
                                    </div>
                                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-lg border border-emerald-100/50 dark:border-emerald-800/50">
                                      {so.order_items?.length || 0} منتج
                                    </span>
                                  </motion.button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {order.sub_orders?.map((so: any) => (
                            <motion.button 
                              key={so.id} 
                              onClick={() => setInfoModal({ type: 'vendor', data: { ...so.vendor, masterOrderId: order.id } })}
                              className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-700/30 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-slate-700/60 w-full hover:bg-emerald-50 dark:hover:bg-slate-700 hover:border-emerald-200 dark:hover:border-slate-600 transition-all group/vinfo cursor-pointer shadow-sm"
                            >
                              <div className="w-6 h-6 rounded bg-white dark:bg-slate-600 flex items-center justify-center shrink-0 border border-gray-200 dark:border-slate-500 overflow-hidden shadow-sm">
                                {so.vendor?.profile?.avatar_url ? (
                                  <img src={so.vendor.profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <Store className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 group-hover/vinfo:scale-110 transition-transform" />
                                )}
                              </div>
                              <span className="group-hover/vinfo:text-emerald-700 dark:group-hover/vinfo:text-emerald-400 flex-1 text-right truncate">{so.vendor?.brand_name || 'متجر غير معروف'}</span>
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-lg font-bold border border-emerald-200/50 dark:border-emerald-800/50 shrink-0">
                                {so.order_items?.length || 0} منتج
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {true && (
                    <div className="flex flex-col gap-1.5 border-t border-gray-100/60 pt-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">المندوب</span>
                      {order.delivery_team && order.delivery_team.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {order.delivery_team.map((teamMember: any) => {
                            const activeMasterOrderIds = new Set(
                              teamMember.driver?.active_orders
                                ?.filter((ao: any) => ao.master_order && !['Completed', 'Cancelled'].includes(ao.master_order.status))
                                .map((ao: any) => ao.master_order.id)
                            );
                            const activeCount = activeMasterOrderIds.size;
                            return (
                              <div key={teamMember.id} className="flex items-center justify-between p-2 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                                <motion.button 
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setInfoModal({ 
                                    type: 'driver', 
                                    data: { 
                                      ...teamMember.driver?.user, 
                                      location_gps: teamMember.driver?.driver_location?.location,
                                      zone_id: teamMember.driver?.zone_id 
                                    } 
                                  })}
                                  className="flex items-center text-right group/dinfo cursor-pointer transition-all flex-1 overflow-hidden min-w-0"
                                >
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden shrink-0 border border-indigo-200">
                                    {teamMember.driver?.user?.avatar_url ? (
                                      <img 
                                        src={teamMember.driver.user.avatar_url} 
                                        alt="" 
                                        className="h-full w-full object-cover rounded-full"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <Motorbike className="w-4 h-4 text-indigo-600 group-hover/dinfo:scale-110 transition-transform" />
                                    )}
                                  </div>
                                  <div className="mr-3 flex flex-row items-center gap-2 overflow-hidden w-full">
                                    <span className="text-sm font-black text-gray-900 group-hover/dinfo:text-indigo-700 truncate">{teamMember.driver?.user?.full_name}</span>
                                    {activeCount > 0 && !['Completed', 'Cancelled', 'Rejected'].includes(order.status) && (
                                      <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold shrink-0 shadow-sm">
                                        {activeCount} طلب
                                      </span>
                                    )}
                                  </div>
                                </motion.button>
                                {!['Completed', 'Cancelled', 'Rejected'].includes(order.status) && (
                                  <div className="flex items-center gap-1.5 shrink-0 pr-2">
                                    <motion.button 
                                      whileHover={{ scale: 1.1 }}
                                      onClick={(e) => { e.stopPropagation(); setAssigningDriverOrderId(order.id); }}
                                      className="p-1.5 bg-white text-indigo-600 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 cursor-pointer shadow-sm transition-colors"
                                    >
                                      <UserPlus className="w-3.5 h-3.5" />
                                    </motion.button>
                                    <motion.button 
                                      whileHover={{ scale: 1.1 }}
                                      onClick={(e) => { e.stopPropagation(); removeDriverMutation.mutate({ teamId: teamMember.id, driverId: teamMember.driver_id }); }}
                                      className="p-1.5 bg-white text-red-500 rounded-lg border border-gray-100 hover:border-red-200 hover:bg-red-50 cursor-pointer shadow-sm transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </motion.button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        !['Completed', 'Cancelled', 'Rejected'].includes(order.status) && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => { e.stopPropagation(); autoAssignDriverMutation.mutate(order.id); }}
                              disabled={autoAssignDriverMutation.isPending}
                              className="flex items-center justify-center gap-1.5 flex-1 py-1.5 bg-zap-gradient text-white rounded-xl text-[11px] font-black shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>تلقائي</span>
                            </motion.button>
                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => { e.stopPropagation(); setAssigningDriverOrderId(order.id); }}
                              className="flex items-center justify-center gap-1.5 flex-1 py-1.5 bg-white text-gray-700 border border-gray-200 rounded-xl text-[11px] font-black shadow-sm hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>يدوي</span>
                            </motion.button>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100/60 dark:border-slate-700/60 pt-2 mt-1">
                    {true && (
                      <div className="flex flex-col gap-0.5 flex-1 min-w-[30%]">
                        <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-tight">الإجمالي</span>
                        <div className="flex items-baseline flex-wrap gap-1.5">
                          <span className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">{order.grand_total} <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">ج.م</span></span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider border shadow-sm",
                            paymentMethodStyles[order.payment_method] || 'bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-600'
                          )}>
                            {order.payment_method || 'نقداً'}
                          </span>
                        </div>
                      </div>
                    )}
                    {true && (
                      <div className="flex flex-col gap-0.5 flex-1 min-w-[25%]">
                        <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-tight">التوصيل</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight">{order.delivery_fee?.toFixed(2) || '0.00'}</span>
                      </div>
                    )}
                    {true && (
                      <div className="flex flex-col gap-0.5 flex-1 min-w-[25%]">
                        <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-tight">المسافة</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight flex items-center gap-0.5">
                           {order.total_distance ? order.total_distance.toFixed(1) : '0.0'} <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                        </span>
                      </div>
                    )}
                  </div>

                  {true && (
                    <div className="flex flex-row flex-wrap items-center gap-2 border-t border-gray-100/60 dark:border-slate-700/60 pt-2">
                      {order.status !== 'Pending' && (
                        <div className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-xl border font-black text-xs w-fit tracking-wider shadow-sm transition-colors",
                          delay.isDelayed && delay.type === 'prep' 
                            ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/50 animate-pulse" 
                            : "bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-700/80"
                        )}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>تحضير: {delay.prepElapsed} د</span>
                          {delay.isDelayed && delay.type === 'prep' && <AlertCircle className="w-3.5 h-3.5" />}
                        </div>
                      )}
                      {['OnTheWay', 'Completed', 'Cancelled', 'Rejected'].includes(order.status) && (
                        <div className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-xl border font-black text-xs w-fit tracking-wider shadow-sm transition-colors",
                          delay.isDelayed && delay.type === 'delivery' 
                            ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/50 animate-pulse" 
                            : "bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-slate-700/80"
                        )}>
                          <Motorbike className="w-3.5 h-3.5" />
                          <span>توصيل: {delay.deliveryElapsed} د</span>
                          {delay.isDelayed && delay.type === 'delivery' && <AlertCircle className="w-3.5 h-3.5" />}
                        </div>
                      )}
                      {order.status === 'Pending' && (
                        <span className="text-xs text-gray-400 dark:text-slate-500 font-bold italic tracking-widest pl-1">في انتظار القبول...</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                {true && (
                  <div className="p-3 bg-gray-50/80 dark:bg-slate-800/80 backdrop-blur-md flex items-center justify-end gap-2 mt-auto border-t border-gray-100 dark:border-slate-700/50 group-hover/card:bg-gray-100/50 dark:group-hover/card:bg-slate-700/30 transition-colors">
                    {order.status === 'Pending' && (
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAccept(order.id);
                        }}
                        className="text-white bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 px-3 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer flex-1 justify-center"
                      >
                        <Store className="w-4 h-4" />
                        <span>قبول</span>
                      </motion.button>
                    )}
                    {order.status !== 'Pending' && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="تتبع مباشر"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTrackingTarget({ type: 'order', id: order.id, name: `طلب #${order.order_number}` });
                        }}
                        className="text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/40 px-3 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer flex-1 justify-center"
                      >
                        <MapPin className="w-4 h-4" />
                        <span>تتبع</span>
                      </motion.button>
                    )}
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedOrderId(order.id)}
                      className="text-emerald-700 dark:text-emerald-300 hover:text-white dark:hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-2 rounded-xl font-black text-xs transition-all border border-emerald-200/50 dark:border-emerald-800/50 inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer flex-1 group/btn"
                    >
                      <Eye className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                      <span>التفاصيل</span>
                    </motion.button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Infinite Scroll Loader */}
      <div ref={loadMoreRef} className="py-8 flex justify-center">
        {isFetchingNextPage ? (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-6 py-3 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700">
            <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />
            <span className="text-sm font-black text-gray-600 dark:text-gray-300">جاري تحميل المزيد من الطلبات...</span>
          </div>
        ) : hasNextPage ? (
          <div className="h-10" />
        ) : allOrders.length > 0 ? (
          <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
            <div className="h-px w-8 bg-gray-200 dark:bg-slate-700"></div>
            <span className="text-xs font-bold uppercase tracking-widest">لقد وصلت لنهاية القائمة</span>
            <div className="h-px w-8 bg-gray-200 dark:bg-slate-700"></div>
          </div>
        ) : null}
      </div>

      {/* Assign Driver Modal */}
      <AssignDriverModal 
        isOpen={!!assigningDriverOrderId}
        onClose={() => setAssigningDriverOrderId(null)}
        onAssign={(driverId) => {
          if (assigningDriverOrderId) {
            assignDriverMutation.mutate({ orderId: assigningDriverOrderId, driverId });
          }
        }}
        isAssigning={assignDriverMutation.isPending}
        excludeDriverIds={(() => {
          const order = allOrders.find(o => o.id === assigningDriverOrderId);
          return order?.delivery_team?.map((dt: any) => dt.driver_id) || [];
        })()}
      />

      {/* Info Modal */}
      {infoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                  {infoModal.type === 'customer' ? 'بيانات العميل' : 
                   infoModal.type === 'vendor' ? 'بيانات المتجر' : 
                   'بيانات المندوب'}
                </h3>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setInfoModal(null)} className="p-2 hover:bg-gray-100 rounded-2xl transition-colors cursor-pointer">
                  <X className="w-6 h-6 text-gray-400" />
                </motion.button>
              </div>

              <div className="space-y-6">
                {(infoModal.type === 'driver' || infoModal.type === 'vendor') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-100 flex flex-col items-center">
                      <div className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">مكتمل اليوم</div>
                      <div className="text-2xl font-black text-emerald-700">
                        {infoModal.data.completed_today ?? '0'}
                      </div>
                    </div>
                    <div className="p-4 bg-red-50 rounded-3xl border border-red-100 flex flex-col items-center">
                      <div className="text-xs font-black text-red-600 uppercase tracking-widest mb-1">ملغي اليوم</div>
                      <div className="text-2xl font-black text-red-700">
                        {infoModal.data.cancelled_today ?? '0'}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center overflow-hidden">
                    {infoModal.type === 'customer' ? (
                      infoModal.data.avatar_url ? (
                        <img src={infoModal.data.avatar_url} alt="" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <User className="w-8 h-8 text-emerald-600" />
                      )
                    ) : infoModal.type === 'vendor' ? (
                      infoModal.data.profile?.avatar_url ? (
                        <img src={infoModal.data.profile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <Store className="w-8 h-8 text-emerald-600" />
                      )
                    ) : (
                      infoModal.data.avatar_url ? (
                        <img src={infoModal.data.avatar_url} alt="" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <Motorbike className="w-8 h-8 text-emerald-600" />
                      )
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">الاسم</div>
                    <div className="text-lg font-black text-gray-900">
                      {infoModal.type === 'customer' ? infoModal.data.full_name : 
                       infoModal.type === 'vendor' ? infoModal.data.brand_name : 
                       infoModal.data.full_name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <Phone className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">رقم الهاتف</div>
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-black text-gray-900" dir="ltr">
                        {infoModal.type === 'customer' ? infoModal.data.primary_phone : 
                         infoModal.type === 'vendor' ? infoModal.data.profile?.primary_phone : 
                         infoModal.data.primary_phone}
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={`https://wa.me/${(infoModal.type === 'customer' ? infoModal.data.primary_phone : 
                                 infoModal.type === 'vendor' ? infoModal.data.profile?.primary_phone : 
                                 infoModal.data.primary_phone)?.toString().replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 group/wa flex items-center justify-center"
                          title="واتساب"
                        >
                          <MessageSquare className="w-5 h-5 group-hover/wa:scale-110 transition-transform" />
                        </a>
                        <a 
                          href={`tel:${infoModal.type === 'customer' ? infoModal.data.primary_phone : 
                                 infoModal.type === 'vendor' ? infoModal.data.profile?.primary_phone : 
                                 infoModal.data.primary_phone}`}
                          className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 group/call flex items-center justify-center"
                          title="اتصال"
                        >
                          <Phone className="w-5 h-5 group-hover/call:rotate-12 transition-transform" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {(infoModal.type === 'customer' || infoModal.type === 'vendor') && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                      <Filter className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">العنوان / العلامة المميزة</div>
                      <div className="text-sm font-bold text-gray-900 leading-relaxed">
                        {infoModal.type === 'customer' ? (
                          infoModal.data.address ? `${infoModal.data.address.city}، ${infoModal.data.address.district}، ${infoModal.data.address.street_name}` : 'غير متوفر'
                        ) : (
                          infoModal.data.landmark || 'غير متوفر'
                        )}
                      </div>
                      {(infoModal.type === 'customer' ? infoModal.data.address?.location_gps : infoModal.data.location_gps) && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            const zoneId = infoModal.type === 'customer' ? infoModal.data.address?.zone_id : infoModal.data.zone_id;
                            const id = infoModal.type === 'customer' ? infoModal.data.masterOrderId : (infoModal.data.user_id || infoModal.data.id);
                            const type = infoModal.type === 'customer' ? 'order' : 'vendor';
                            const name = infoModal.type === 'customer' ? infoModal.data.full_name : infoModal.data.brand_name;
                            
                            setTrackingTarget({ type, id, name });
                            setInfoModal(null);
                          }}
                          className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors text-xs font-bold cursor-pointer"
                        >
                          <MapPin className="w-4 h-4" />
                          تتبع الموقع داخلياً
                        </motion.button>
                      )}
                    </div>
                  </div>
                )}
                
                {infoModal.type === 'driver' && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">الموقع المباشر</div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          const zoneId = infoModal.data.zone_id;
                          const id = infoModal.data.user_id || infoModal.data.id;
                          const name = infoModal.data.full_name;
                          setTrackingTarget({ type: 'driver', id, name });
                          setInfoModal(null);
                        }}
                        className="mt-1 inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors text-xs font-bold cursor-pointer"
                      >
                        <MapPin className="w-4 h-4" />
                        تتبع السائق داخلياً
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setInfoModal(null)}
                className="w-full mt-8 py-4 bg-gray-900 text-white rounded-2xl font-black tracking-widest hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 cursor-pointer"
              >
                إغلاق
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Panel */}
      <OrderDetailsPanel 
        orderId={selectedOrderId} 
        onClose={() => setSelectedOrderId(null)} 
        prepThreshold={prepThreshold}
        deliveryThreshold={deliveryThreshold}
      />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-10 border border-gray-100">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 rounded-2xl">
                  <Clock className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">إعدادات الوقت</h3>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="block text-sm font-black text-gray-700 uppercase tracking-widest">
                  وقت التحضير الافتراضي (دقيقة)
                </label>
                <input
                  type="number"
                  value={prepThreshold}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      setPrepThreshold(val);
                      localStorage.setItem('PREP_THRESHOLD', val.toString());
                    }
                  }}
                  className="block w-full bg-gray-50 border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
                <p className="text-xs text-gray-400 font-bold leading-relaxed">يستخدم هذا الوقت كمرجع للتأخير في حال لم يقم المتجر بتحديد وقت تحضير خاص به.</p>
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-black text-gray-700 uppercase tracking-widest">
                  وقت التوصيل المستهدف (دقيقة)
                </label>
                <input
                  type="number"
                  value={deliveryThreshold}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      setDeliveryThreshold(val);
                      localStorage.setItem('DELIVERY_THRESHOLD', val.toString());
                    }
                  }}
                  className="block w-full bg-gray-50 border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
                <p className="text-xs text-gray-400 font-bold leading-relaxed">الوقت الأقصى المتوقع لوصول المندوب للعميل بعد استلام الطلب من المتجر.</p>
              </div>
            </div>
            
            <div className="mt-10">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsSettingsOpen(false)}
                className="w-full bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all cursor-pointer"
              >
                حفظ الإعدادات
              </motion.button>
            </div>
          </div>
        </div>
      )}
      {/* Status History Modal */}
      <AnimatePresence>
        {selectedHistoryOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900">سجل الحالات</h3>
                    <p className="text-sm text-gray-500 font-medium">طلب #{selectedHistoryOrder.order_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedHistoryOrder(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {(() => {
                  const history = selectedHistoryOrder.sub_orders?.flatMap((so: any) => so.order_status_history || []) || [];
                  const sortedHistory = [...history].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  
                  if (sortedHistory.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">لا يوجد سجل متاح لهذا الطلب</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                      {sortedHistory.map((h: any, idx: number) => (
                        <div key={h.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm",
                            idx === 0 ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"
                          )}>
                            {idx === 0 ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                          </div>
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-black text-gray-900">
                                {statusNames[h.status as OrderStatus] || h.status}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              {format(new Date(h.created_at), 'PPpp', { locale: ar })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Map Tracking Drawer */}
      <AnimatePresence>
        {trackingTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTrackingTarget(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-gray-50 z-50 flex flex-col shadow-2xl border-l border-gray-200"
            >
              <div className="p-6 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900">تتبع مباشر</h2>
                    <p className="text-sm text-gray-500 font-bold mt-1">
                      {trackingTarget.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTrackingTarget(null)}
                  className="p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 p-6 relative overflow-hidden">
                <LiveMap 
                  embedded 
                  initialType={trackingTarget.type} 
                  initialId={trackingTarget.id} 
                  hideControls 
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

