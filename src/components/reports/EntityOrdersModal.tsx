import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { format, parseISO } from 'date-fns';
import { X, Download, Package, Calendar, TrendingUp, DollarSign, Receipt, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

interface EntityOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'vendor' | 'driver';
  entityId: string;
  entityName: string;
  dateRange: { start: Date; end: Date };
}

// Safe Date Formatting helper
const safeFormatDate = (date: any, formatStr: string) => {
  try {
    if (!date) return '-';
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (isNaN(d.getTime())) return '-';
    return format(d, formatStr);
  } catch (e) {
    return '-';
  }
};

export default function EntityOrdersModal({ isOpen, onClose, type, entityId, entityName, dateRange }: EntityOrdersModalProps) {
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data: rawOrders, isLoading } = useQuery({
    queryKey: ['entity-orders', type, entityId, dateRange],
    meta: { suppressGlobalError: true },
    queryFn: async () => {
      try {
        // Fetch orders based on type
        if (type === 'vendor') {
          const { data, error } = await supabase
            .from('sub_orders')
            .select(`
              id,
              master_order_id,
              sub_total,
              vendor_commission,
              sub_status,
              created_at,
              vendor:vendor_details!sub_orders_vendor_id_fkey(commission_rate),
              master_order:master_orders!sub_orders_master_order_id_fkey(
                order_number,
                payment_method,
                customer:profiles!master_orders_customer_id_fkey(full_name)
              )
            `)
            .eq('vendor_id', entityId)
            .gte('created_at', format(dateRange.start, "yyyy-MM-dd'T'00:00:00"))
            .lte('created_at', format(dateRange.end, "yyyy-MM-dd'T'23:59:59"))
            .order('created_at', { ascending: false });

          if (error) throw error;
          return data;
        } else {
          const { data: orderData, error: orderError } = await supabase
            .from('order_delivery_team')
            .select(`
              id,
              master_order_id,
              master_order:master_orders!fk_order_delivery_team_master_order!inner(
                id,
                order_number,
                status,
                payment_method,
                delivery_fee,
                distance_fee,
                driver_tip,
                items_total,
                grand_total,
                platform_discount,
                delivery_discount,
                customer:profiles!master_orders_customer_id_fkey(full_name),
                created_at
              ),
              created_at
            `)
            .eq('driver_id', entityId)
            .gte('created_at', format(dateRange.start, "yyyy-MM-dd'T'00:00:00"))
            .lte('created_at', format(dateRange.end, "yyyy-MM-dd'T'23:59:59"))
            .order('created_at', { ascending: false });

          if (orderError) throw orderError;
          
          return orderData.filter(d => d.master_order) || [];
        }
      } catch (err: any) {
        console.error('Modal Query Error:', err);
        // Instead of throwing and hitting global boundary, return empty and toast
        toast.error('حدث خطأ أثناء تحميل البيانات: ' + (err.message || 'خطأ غير معروف'));
        return [];
      }
    },
    enabled: isOpen && !!entityId
  });

  const orders = useMemo(() => {
    if (!rawOrders) return [];
    return rawOrders.filter((o: any) => {
      const pmRaw = (o.master_order?.payment_method || 'cash').toLowerCase();
      const pmCategory = pmRaw === 'cash' ? 'cash' : 'online';
      const st = type === 'vendor' ? o.sub_status : o.master_order?.status;
      
      const matchPayment = filterPayment === 'all' || pmCategory === filterPayment;
      const matchStatus = filterStatus === 'all' || st === filterStatus || (filterStatus === 'Completed' && st === 'Delivered');
      
      return matchPayment && matchStatus;
    });
  }, [rawOrders, filterPayment, filterStatus, type]);

  const stats = useMemo(() => {
    if (!orders) return { totalOrders: 0, totalSales: 0, totalCommission: 0, totalDeliveryFees: 0 };
    
    // For specific stats calculations, we only count successful orders to match the dashboard exactly
    const vendorDeliveredOrders = orders.filter((o: any) => type === 'vendor' && o.sub_status === 'Delivered');
    const driverCompletedOrders = orders.filter((o: any) => type === 'driver' && o.master_order?.status === 'Completed');

    return {
      totalOrders: orders.length,
      totalSales: vendorDeliveredOrders.reduce((acc, o: any) => acc + (Number(o.sub_total) || 0), 0),
      totalCommission: vendorDeliveredOrders.reduce((acc, o: any) => {
        const commRate = Number(o.vendor?.commission_rate || 0);
        const comm = Number(o.vendor_commission) || ((Number(o.sub_total) * commRate) / 100);
        return acc + comm;
      }, 0),
      totalDeliveryFees: driverCompletedOrders.reduce((acc, o: any) => acc + (Number(o.master_order?.delivery_fee) || 0), 0),
      totalDriverNet: driverCompletedOrders.reduce((acc, o: any) => {
        const deliveryFee = Number(o.master_order?.delivery_fee) || 0;
        const distanceFee = Number(o.master_order?.distance_fee) || 0;
        const driverTip = Number(o.master_order?.driver_tip) || 0;
        const grandTotal = Number(o.master_order?.grand_total) || 0;
        const itemsTotal = Number(o.master_order?.items_total) || 0;
        const earnings = deliveryFee + distanceFee + driverTip;
        const isCash = (o.master_order?.payment_method || '').toLowerCase() === 'cash';
        const deduction = isCash ? (grandTotal - itemsTotal) : 0;
        return acc + (earnings - deduction);
      }, 0),
    };
  }, [orders, type]);

  if (!isOpen) return null;

  const exportToCSV = () => {
    if (!orders || orders.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    const statusTranslations: Record<string, string> = {
      'Pending': 'قيد الانتظار',
      'Accepted': 'مقبول',
      'Preparing': 'قيد التجهيز',
      'Ready': 'جاهز',
      'OnTheWay': 'في الطريق',
      'Completed': 'مكتمل',
      'Delivered': 'مكتمل',
      'Cancelled': 'ملغي',
      'Rejected': 'مرفوض'
    };

    let csvContent = "";
    if (type === 'vendor') {
      const header = "رقم الطلب,طريقة الدفع,حالة الطلب,إجمالي الطلب,العمولة,الصافي للمتجر,تاريخ الطلب";
      const rows = orders.map((o: any) => {
         const orderNum = o.master_order?.order_number || '-';
         const paymentRaw = (o.master_order?.payment_method || 'cash').toLowerCase();
         const payment = paymentRaw === 'cash' ? 'كاش' : 'إلكتروني';
         const status = statusTranslations[o.sub_status] || o.sub_status;
         const subTotal = o.sub_total || 0;
         const commRate = Number(o.vendor?.commission_rate || 0);
         const comm = Number(o.vendor_commission) || ((Number(subTotal) * commRate) / 100);
         const net = Number(subTotal) - comm;
         const date = safeFormatDate(o.created_at, 'yyyy-MM-dd HH:mm');
         return `"${orderNum}","${payment}","${status}","${subTotal}","${comm.toFixed(2)}","${net.toFixed(2)}","${date}"`;
      });
      csvContent = "\uFEFF" + [header, ...rows].join('\n');
    } else {
      const header = "رقم الطلب,طريقة الدفع,حالة الطلب,إجمالي المنتجات,الخصم,الاجمالي الكلي,رسوم التوصيل,فرق المسافة,البقشيش,صافي السائق,تاريخ الطلب";
      const rows = orders.map((o: any) => {
         const orderNum = o.master_order?.order_number || '-';
         const paymentRaw = (o.master_order?.payment_method || 'cash').toLowerCase();
         const payment = paymentRaw === 'cash' ? 'كاش' : 'إلكتروني';
         const status = statusTranslations[o.master_order?.status || ''] || o.master_order?.status || '-';
         const itemsTotal = o.master_order?.items_total || 0;
         const grandTotal = o.master_order?.grand_total || 0;
         const platformDiscount = o.master_order?.platform_discount || 0;
         const deliveryDiscount = o.master_order?.delivery_discount || 0;
         const totalDiscount = platformDiscount + deliveryDiscount;
         const deliveryFee = o.master_order?.delivery_fee || 0;
         const distanceFee = o.master_order?.distance_fee || 0;
         const driverTip = o.master_order?.driver_tip || 0;
         const income = deliveryFee + distanceFee + driverTip;
         const isCash = paymentRaw === 'cash';
         const deduction = isCash ? (grandTotal - itemsTotal) : 0;
         const net = income - deduction;
         
         const date = safeFormatDate(o.created_at, 'yyyy-MM-dd HH:mm');
         return `"${orderNum}","${payment}","${status}","${itemsTotal}","${totalDiscount}","${grandTotal}","${deliveryFee}","${distanceFee}","${driverTip}","${net.toFixed(2)}","${date}"`;
      });
      csvContent = "\uFEFF" + [header, ...rows].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders_${type}_${entityName}_${safeFormatDate(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string, color: string }> = {
      'Pending': { label: 'قيد الانتظار', color: 'bg-amber-100 text-amber-700' },
      'Accepted': { label: 'مقبول', color: 'bg-blue-100 text-blue-700' },
      'Preparing': { label: 'قيد التجهيز', color: 'bg-purple-100 text-purple-700' },
      'Ready': { label: 'جاهز', color: 'bg-cyan-100 text-cyan-700' },
      'OnTheWay': { label: 'في الطريق', color: 'bg-indigo-100 text-indigo-700' },
      'Completed': { label: 'مكتمل', color: 'bg-emerald-100 text-emerald-700' },
      'Delivered': { label: 'مكتمل', color: 'bg-emerald-100 text-emerald-700' },
      'Cancelled': { label: 'ملغي', color: 'bg-rose-100 text-rose-700' },
      'Rejected': { label: 'مرفوض', color: 'bg-red-100 text-red-700' }
    };
    
    // Provide a default for unknown statuses
    const mapped = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    
    return (
      <span className={cn("px-2.5 py-1 rounded-full text-xs font-bold", mapped.color)}>
        {mapped.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-[#F8F9FA] dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col sticky top-0 bg-white dark:bg-gray-900 z-10 shadow-sm">
          <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner",
                type === 'vendor' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
              )}>
                <Package className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  طلبات {type === 'vendor' ? 'المتجر' : 'السائق'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    "font-bold text-sm md:text-base",
                    type === 'vendor' ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
                  )}>
                    {entityName}
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <p className="text-xs md:text-sm font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>من {format(dateRange.start, 'yyyy-MM-dd')} إلى {format(dateRange.end, 'yyyy-MM-dd')}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 self-end sm:self-auto w-full sm:w-auto justify-end">
              <button 
                onClick={exportToCSV}
                disabled={!orders || orders.length === 0}
                className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 flex-1 sm:flex-none text-sm sm:text-base"
              >
                <Download className="w-4 h-4" />
                تصدير إكسل
              </button>
              <button
                onClick={onClose}
                className="p-2.5 bg-white border border-gray-200 text-gray-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:text-rose-400 dark:hover:bg-rose-900/30 rounded-xl transition-all shadow-sm flex items-center justify-center"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex flex-row items-center gap-3 pt-4 pb-2 border-t border-gray-100 dark:border-gray-800/50 w-full overflow-x-auto hide-scrollbar">
            <div className="flex-1 sm:flex-none flex items-center justify-between sm:justify-start gap-2 bg-gray-50 dark:bg-gray-800/80 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 whitespace-nowrap">
              <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <select 
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-gray-700 dark:text-gray-300 focus:ring-0 focus:outline-none cursor-pointer w-full"
              >
                <option value="all">كل طرق الدفع</option>
                <option value="cash">كاش</option>
                <option value="online">إلكتروني</option>
              </select>
            </div>
            
            <div className="flex-1 sm:flex-none flex items-center justify-between sm:justify-start gap-2 bg-gray-50 dark:bg-gray-800/80 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 whitespace-nowrap">
              <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-gray-700 dark:text-gray-300 focus:ring-0 focus:outline-none cursor-pointer w-full"
              >
                <option value="all">كل الحالات</option>
                <option value="Pending">قيد الانتظار</option>
                <option value="Accepted">مقبول</option>
                <option value="Preparing">قيد التجهيز</option>
                <option value="Ready">جاهز</option>
                {type === 'driver' && <option value="OnTheWay">في الطريق</option>}
                <option value="Completed">مكتمل</option>
                <option value="Cancelled">ملغي</option>
                <option value="Rejected">مرفوض</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-emerald-600"></div>
              <p className="text-gray-500 font-medium">جاري تحميل الطلبات...</p>
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="text-center py-24 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
              <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-10 h-10 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">لا توجد طلبات</h3>
              <p className="text-gray-500 mt-2">لم يقم هذا {type === 'vendor' ? 'المتجر' : 'السائق'} بأي طلبات خلال هذه الفترة المحددة.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">إجمالي الطلبات</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalOrders}</p>
                  </div>
                </div>
                
                {type === 'vendor' && (
                  <>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">إجمالي المبيعات</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalSales.toFixed(2)} <span className="text-sm text-gray-500">ج.م</span></p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">إجمالي العمولات</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalCommission.toFixed(2)} <span className="text-sm text-gray-500">ج.م</span></p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">الصافي المستحق</p>
                        <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{(stats.totalSales - stats.totalCommission).toFixed(2)} <span className="text-sm font-bold">ج.م</span></p>
                      </div>
                    </div>
                  </>
                )}

                {type === 'driver' && (
                  <>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">رسوم التوصيل</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.totalDeliveryFees.toFixed(2)} <span className="text-sm font-bold">ج.م</span></p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 flex items-center justify-center">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">صافي أرباح المحفظة</p>
                        <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{stats.totalDriverNet.toFixed(2)} <span className="text-sm font-bold">ج.م</span></p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Data Table */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-[#F8F9FA] dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <tr className="font-bold text-gray-600 dark:text-gray-400">
                        <th className="px-5 py-4 w-24">رقم الطلب</th>
                        <th className="px-5 py-4">الحالة</th>
                        <th className="px-5 py-4">الدفع</th>
                        {type === 'vendor' ? (
                          <>
                            <th className="px-5 py-4">إجمالي الطلب</th>
                            <th className="px-5 py-4">العمولة</th>
                            <th className="px-5 py-4">الصافي للمتجر</th>
                          </>
                        ) : (
                          <>
                            <th className="px-5 py-4">إجمالي المنتجات</th>
                            <th className="px-5 py-4">الخصم</th>
                            <th className="px-5 py-4">الاجمالي الكلي</th>
                            <th className="px-5 py-4">رسوم التوصيل</th>
                            <th className="px-5 py-4">فرق المسافة</th>
                            <th className="px-5 py-4">البقشيش</th>
                            <th className="px-5 py-4 min-w-[120px]">صافي السائق</th>
                          </>
                        )}
                        <th className="px-5 py-4">الوقت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-900 dark:text-gray-300">
                      {orders.map((o: any) => (
                        <tr key={o.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
                          <td className="px-5 py-4 font-black">
                            <span className="text-gray-400 dark:text-gray-500 mr-0.5">#</span>
                            <span className="text-emerald-600 dark:text-emerald-400">{o.master_order?.order_number || 'N/A'}</span>
                          </td>
                          <td className="px-5 py-4">
                            {getStatusBadge(type === 'vendor' ? o.sub_status : o.master_order?.status)}
                          </td>
                          <td className="px-5 py-4 font-bold">
                            {(o.master_order?.payment_method || 'cash').toLowerCase() === 'cash' ? (
                              <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-lg text-xs">كاش</span>
                            ) : (
                              <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg text-xs">إلكتروني</span>
                            )}
                          </td>
                          {type === 'vendor' ? (
                            <>
                              <td className="px-5 py-4 font-black text-gray-900 dark:text-white">
                                {Number(o.sub_total || 0).toFixed(2)}
                              </td>
                              <td className="px-5 py-4 font-black text-rose-500">
                                {(() => {
                                  const commRate = Number(o.vendor?.commission_rate || 0);
                                  const comm = Number(o.vendor_commission) || ((Number(o.sub_total) * commRate) / 100);
                                  return comm.toFixed(2);
                                })()}
                              </td>
                              <td className="px-5 py-4 font-black text-emerald-600 dark:text-emerald-400">
                                {(() => {
                                  const commRate = Number(o.vendor?.commission_rate || 0);
                                  const comm = Number(o.vendor_commission) || ((Number(o.sub_total) * commRate) / 100);
                                  return (Number(o.sub_total || 0) - comm).toFixed(2);
                                })()}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-5 py-4 font-black text-gray-500 dark:text-gray-400">
                                {Number(o.master_order?.items_total || 0).toFixed(2)}
                              </td>
                              <td className="px-5 py-4 font-bold text-rose-500">
                                {Number((o.master_order?.platform_discount || 0) + (o.master_order?.delivery_discount || 0)).toFixed(2)}
                              </td>
                              <td className="px-5 py-4 font-black text-gray-900 dark:text-white">
                                {Number(o.master_order?.grand_total || 0).toFixed(2)}
                              </td>
                              <td className="px-5 py-4 font-black text-emerald-600 dark:text-emerald-400">
                                {Number(o.master_order?.delivery_fee || 0).toFixed(2)}
                              </td>
                              <td className="px-5 py-4 font-black text-indigo-600 dark:text-indigo-400">
                                {Number(o.master_order?.distance_fee || 0).toFixed(2)}
                              </td>
                              <td className="px-5 py-4 font-black text-purple-600 dark:text-purple-400">
                                {Number(o.master_order?.driver_tip || 0).toFixed(2)}
                              </td>
                              <td className="px-5 py-4 font-black">
                                {(() => {
                                  const deliveryFee = Number(o.master_order?.delivery_fee) || 0;
                                  const distanceFee = Number(o.master_order?.distance_fee) || 0;
                                  const driverTip = Number(o.master_order?.driver_tip) || 0;
                                  const grandTotal = Number(o.master_order?.grand_total) || 0;
                                  const itemsTotal = Number(o.master_order?.items_total) || 0;
                                  const earnings = deliveryFee + distanceFee + driverTip;
                                  const isCash = (o.master_order?.payment_method || '').toLowerCase() === 'cash';
                                  const deduction = isCash ? (grandTotal - itemsTotal) : 0;
                                  const net = earnings - deduction;
                                  return (
                                    <span className={net < 0 ? 'text-rose-600' : 'text-blue-600'}>
                                      {net.toFixed(2)}
                                    </span>
                                  );
                                })()}
                              </td>
                            </>
                          )}
                          <td className="px-5 py-4 text-gray-500 dark:text-gray-400 font-bold whitespace-nowrap text-[13px]">
                            <div className="flex flex-col">
                              <span>{safeFormatDate(o.created_at, 'yyyy/MM/dd')}</span>
                              <span className="text-[11px] text-gray-400">{safeFormatDate(o.created_at, 'HH:mm a')}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
