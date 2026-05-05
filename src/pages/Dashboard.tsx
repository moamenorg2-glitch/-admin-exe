import { ShoppingCart, Store, Bike, AlertCircle, Download, Calendar, Filter,
  ChevronDown, MoreHorizontal, Package, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useDashboard } from '../hooks/useDashboard';
import LiveMap from './zones/LiveMap';

export default function Dashboard() {
  const {
    dashboardData,
    isLoading,
    quickFilter,
    setQuickFilter,
    dateFilter,
    setDateFilter,
    categoryData,
    productData,
    vendorData,
    conflicts
  } = useDashboard();

  const handleDownload = async () => {
    try {
      const XLSX = await import('xlsx');
      const exportData = (dashboardData?.recentOrders || []).map((order: any) => ({
        'رقم الطلب': order.order_number,
        'العميل': order.customer?.full_name || '-',
        'إجمالي التكلفة': `${order.grand_total} ج.م`,
        'الحالة': order.status,
        'التاريخ': format(new Date(order.created_at || new Date()), 'dd/MM/yyyy HH:mm', { locale: ar }),
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DashboardData');
      XLSX.writeFile(wb, `dashboard_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    } catch (error) {
      console.error('Error generating Excel file:', error);
    }
  };

  const revenueChartData = dashboardData?.chartData || [];

  const statCards = [
    { 
      name: 'إجمالي الطلبات', 
      value: dashboardData?.stats?.totalOrders || 0, 
      icon: ShoppingCart, 
      iconBg: 'bg-red-50 text-red-500',
      subInfo: dateFilter || quickFilter !== 'all' ? 'النطاق المختار' : 'إجمالي المنصة',
    },
    { 
      name: 'الطلبات المعلقة', 
      value: dashboardData?.stats?.pendingOrders || 0, 
      icon: AlertCircle, 
      iconBg: 'bg-orange-50 text-orange-500',
      subInfo: 'بانتظار الموافقة',
    },
    { 
      name: 'الجاري تجهيزها', 
      value: dashboardData?.stats?.activeOrders || 0, 
      icon: Store, 
      iconBg: 'bg-blue-50 text-blue-500',
      subInfo: 'قيد التحضير بالمتاجر',
    },
    { 
      name: 'الجاري توصيلها', 
      value: dashboardData?.stats?.onTheWayOrders || 0, 
      icon: Bike, 
      iconBg: 'bg-purple-50 text-purple-500',
      subInfo: 'مع المندوبين',
    },
    { 
      name: 'الطلبات المكتملة', 
      value: dashboardData?.stats?.completedOrders || 0, 
      icon: Package, 
      iconBg: 'bg-emerald-50 text-emerald-500',
      subInfo: 'تم التسليم بنجاح',
    },
    { 
      name: 'الطلبات الملغية', 
      value: dashboardData?.stats?.cancelledOrders || 0, 
      icon: XCircle, 
      iconBg: 'bg-red-50 text-red-500',
      subInfo: 'تم إلغاؤها أو رفضها',
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 border-4 border-emerald-100 dark:border-emerald-900 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-sm text-slate-400 font-bold animate-pulse">جاري جلب أحدث البيانات...</p>
      </div>
    );
  }


  return (
    <div className="w-full pb-10" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-100 pb-6 dark:border-slate-800">
        <div>
          <p className="text-[13px] text-slate-400 font-medium tracking-wide">لوحة تحكم إدارة الخدمات اللوجستية</p>
        </div>
        
        <div className="flex flex-row items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar scroll-smooth pb-0.5 sm:pb-0">
          {/* Quick Filters Dropdown */}
          <div className="relative flex items-center bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer shrink-0 min-w-[120px]">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex flex-col items-start leading-none mr-2 flex-grow overflow-hidden">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter block truncate">فلتر سريع</span>
              <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 whitespace-nowrap block truncate">
                {dateFilter ? 'تاريخ مخصص' : (
                  quickFilter === 'today' ? 'اليوم' : 
                  quickFilter === 'week' ? 'الأسبوع' : 
                  quickFilter === 'month' ? 'الشهر' : 'جميع البيانات'
                )}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
            <select
              value={dateFilter ? '' : quickFilter}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== '') {
                  setQuickFilter(val as any);
                  setDateFilter(undefined);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            >
              <option value="all">جميع البيانات</option>
              <option value="today">اليوم</option>
              <option value="week">الأسبوع</option>
              <option value="month">الشهر</option>
            </select>
          </div>

          <div className="relative flex items-center bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer shrink-0 min-w-[120px]">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div className="flex flex-col items-start leading-none mr-2 flex-grow overflow-hidden">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter block truncate">فلتر التاريخ</span>
              <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 whitespace-nowrap block truncate">{dateFilter ? format(dateFilter, "dd MMM yyyy", { locale: ar }) : 'تاريخ مخصص'}</span>
            </div>
            <input 
              type="date" 
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              onChange={(e) => {
                const val = e.target.value ? new Date(e.target.value) : undefined;
                setDateFilter(val);
                if (val) setQuickFilter('all' as any);
              }}
              value={dateFilter ? format(dateFilter, 'yyyy-MM-dd') : ''}
            />
          </div>
          
          <button onClick={handleDownload} className="flex items-center justify-center w-[42px] h-[42px] bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-all shrink-0 shadow-sm group">
            <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Logic Conflict Alerts (Self-Healing) */}
      <AnimatePresence>
        {conflicts.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="bg-amber-50 dark:bg-amber-900 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">تنبيهات جودة البيانات (ذكاء اصطناعي)</h4>
                <div className="space-y-2">
                  {conflicts.map((order: any) => (
                    <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-[#FFFFFF80] dark:bg-[#000000B3] rounded-lg border border-amber-100 dark:border-amber-800">
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">الطلب <span className="font-mono">#{order.order_number || order.id.substring(0, 6)}</span> قيمته مرتفعة جداً ({order.grand_total} ج.م) ولم يتم تأكيده بعد.</p>
                      <button className="text-[11px] font-black bg-amber-600 text-white px-3 py-1 rounded-md hover:bg-amber-700 transition-colors whitespace-nowrap">اقتراح معالجة الـ AI</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Row 1: 6 Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
            <div className="flex items-start gap-4 mb-2">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110", card.iconBg)}>
                <card.icon className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h3 className="text-xl font-black text-slate-900 dark:text-white leading-none mb-1">{card.value.toLocaleString()}</h3>
                <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap block truncate">{card.name}</span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
               <div className="text-[9px] text-slate-400 flex items-center gap-1.5 h-4">
                  <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                  {card.subInfo}
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 2: Full Width Map */}
      <div className="w-full bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm mb-6 h-[500px]">
        <LiveMap embedded={true} hideControls={true} />
      </div>

      {/* Row 3: Most Active Categories & Revenue */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6">
        {/* Most Active Categories (1/3) */}
        <div className="w-full lg:w-1/3 bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">الفئات الأكثر نشاطاً</h3>
            <p className="text-[11px] text-slate-400">تحليل أداء الأقسام</p>
          </div>

          <div className="space-y-6">
            {categoryData.length > 0 ? categoryData.map((cat, i) => (
              <div key={i}>
                <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2">
                  <span>{cat.name}</span>
                  <span className="text-[11px] font-bold text-slate-400" dir="ltr">{cat.value}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                  <div className="h-full" style={{ width: `${cat.value}%`, backgroundColor: cat.color }}></div>
                </div>
              </div>
            )) : (
               <div className="text-center py-10 text-slate-400 text-xs font-medium">لا توجد بيانات متاحة</div>
            )}
          </div>
        </div>

        {/* Total Revenue (2/3) */}
        <div className="w-full lg:w-2/3 bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6 border-b border-slate-50 dark:border-slate-700 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">إجمالي الإيرادات</h3>
              <p className="text-[11px] text-slate-400 leading-tight">ملخص مبيعات المنصة</p>
            </div>
            <div className="text-left" dir="ltr">
               <div className="text-lg font-black text-slate-900 dark:text-white">{dashboardData?.stats?.revenue?.toLocaleString() || 0} ج.م</div>
               <div className="text-[11px] text-slate-400 font-medium">إجمالي المبيعات المكتملة</div>
            </div>
          </div>
          
          <div className="h-64 mt-4 w-full" style={{ minHeight: '256px' }}>
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData} margin={{ top: 10, right: 0, left: 10, bottom: 0 }} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} width={45} tickFormatter={(val) => val.toLocaleString() + ' ج'} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', direction: 'rtl' }}/>
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-medium">لا توجد بيانات للرسم البياني</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Top Vendors, Top Products, Drivers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Top Vendors (1/3) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">المتاجر الأكثر طلباً</h3>
            <p className="text-[11px] text-slate-400">حصة المبيعات لكل متجر</p>
          </div>

          <div className="space-y-6">
            {vendorData.length > 0 ? vendorData.map((vendor, i) => (
              <div key={i}>
                <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2">
                  <span>{vendor.name}</span>
                  <span className="text-[11px] font-bold text-slate-400" dir="ltr">{vendor.value}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                  <div className="h-full" style={{ width: `${vendor.value}%`, backgroundColor: vendor.color }}></div>
                </div>
              </div>
            )) : (
              <div className="text-center py-10 text-slate-400 text-xs font-medium">لا توجد بيانات متاحة</div>
            )}
          </div>
        </div>

        {/* Top Products (1/3) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">المنتجات الأكثر طلباً</h3>
            <p className="text-[11px] text-slate-400">توزيع الطلبات على المنتجات</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-40 h-40 relative mb-6" style={{ minWidth: '160px', minHeight: '160px' }}>
              {productData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={productData} innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value" stroke="none">
                      {productData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full rounded-full border-4 border-slate-50 dark:border-slate-700 flex items-center justify-center">
                   <Package className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                </div>
              )}
            </div>
            <div className="w-full space-y-2">
              {productData.length > 0 ? productData.map((item, i) => (
                <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 rounded-lg p-2 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">{item.name}</span>
                  </div>
                  <span className="text-[11px] font-black text-slate-800 dark:text-white bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-sm leading-none">{item.value}</span>
                </div>
              )) : (
                <div className="text-center py-4 text-slate-400 text-xs font-medium">لا توجد بيانات متاحة</div>
              )}
            </div>
          </div>
        </div>

        {/* Delivery Drivers (1/3) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">مناديب التوصيل</h3>
            <Link to="/drivers" className="text-[11px] font-bold text-slate-400 cursor-pointer hover:text-blue-500">عرض الكل</Link>
          </div>
          <div className="space-y-4">
            {(dashboardData?.recentDrivers?.length ? dashboardData.recentDrivers : []).slice(0, 5).length > 0 ? (dashboardData?.recentDrivers || []).slice(0, 5).map((driver: any, i: number) => {
              const isOnline = driver.is_online;
              return (
              <div key={driver.user_id || i} className="flex items-center justify-between pb-3 border-b border-slate-50 dark:border-slate-800 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                    <img src={driver.profile?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${driver.user_id}`} className="w-full h-full object-cover" alt="driver" referrerPolicy="no-referrer" />
                  </div>
                  <div className="overflow-hidden">
                     <p className="text-[12px] font-bold text-slate-800 dark:text-white truncate">{driver.profile?.full_name || 'سائق غير معروف'}</p>
                     <p className="text-[11px] font-medium text-slate-400">انضم {format(new Date(driver.created_at || new Date()), "d MMM yyyy", { locale: ar })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded">
                   {isOnline ? (
                      <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">متصل</span></>
                   ) : (
                      <><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> <span className="text-[11px] text-slate-400 font-bold">غير متصل</span></>
                   )}
                </div>
              </div>
            )}) : (
              <div className="text-center py-10 text-slate-400 text-xs font-medium">لا يوجد سائقين حالياً</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 5: Active Orders Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">الطلبات النشطة</h3>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-right whitespace-nowrap min-w-max">
            <thead>
              <tr className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-[11px] text-slate-900 dark:text-white font-black">
                <th className="py-4 px-6 text-right">رقم الطلب</th>
                <th className="py-4 px-6 text-right">العميل</th>
                <th className="py-4 px-6 text-right">تاريخ الطلب</th>
                <th className="py-4 px-6 text-right">المبلغ الإجمالي</th>
                <th className="py-4 px-6 text-right">حالة الطلب</th>
                <th className="py-4 px-6 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50 text-xs font-medium">
              {(dashboardData?.recentOrders?.length ? dashboardData.recentOrders : []).map((order: any) => (
                <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors bg-white dark:bg-slate-800">
                  <td className="py-5 px-6 text-slate-400 font-mono">#{order.order_number || order.id.substring(0, 6)}</td>
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                         <img src={order.customer?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${order.id}`} className="w-full h-full object-cover" alt="customer" referrerPolicy="no-referrer" />
                      </div>
                      <span className="text-slate-800 dark:text-slate-200 font-bold">{order.customer?.full_name || 'عميل غير معروف'}</span>
                    </div>
                  </td>
                  <td className="py-5 px-6 text-slate-400">{format(new Date(order.created_at || new Date()), "dd MMMM yyyy", { locale: ar })}</td>
                  <td className="py-5 px-6 text-slate-800 dark:text-white font-bold">{order.grand_total?.toLocaleString() || 0} ج.م</td>
                  <td className="py-5 px-6">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      order.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                      ['OnTheWay', 'Active', 'Arrived'].includes(order.status) ? 'bg-blue-100 text-blue-700' :
                      order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                      order.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {order.status === 'Pending' ? 'قيد الانتظار' :
                       ['OnTheWay', 'Active', 'Arrived'].includes(order.status) ? 'جاري التوصيل' :
                       order.status === 'Completed' ? 'مكتمل' :
                       order.status === 'Cancelled' ? 'ملغي' : order.status || 'غير معروف'}
                    </span>
                  </td>
                  <td className="py-5 px-6 text-center"><MoreHorizontal className="w-5 h-5 text-slate-300 cursor-pointer hover:text-slate-600 inline-block"/></td>
                </tr>
              ))}
              {!(dashboardData?.recentOrders?.length) && (
                <tr className="bg-white dark:bg-slate-800">
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-medium italic">لا توجد طلبات نشطة حالياً</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
