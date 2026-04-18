import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  Filter, 
  FileText, 
  Download, 
  Calendar, 
  Plus, 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Activity,
  ArrowUpRight,
  Clock,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import ReportGeneratorModal from '../../components/reports/ReportGeneratorModal';

export default function ReportsDashboard() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const pageSize = 10;

  // Fetch Reports List
  const { data, isLoading } = useQuery({
    queryKey: ['reports', page, searchQuery, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('performance_reports')
        .select(`
          *,
          profiles:generated_by (full_name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (searchQuery) {
        query = query.or(`summary.ilike.%${searchQuery}%`);
      }

      if (typeFilter !== 'All') {
        query = query.eq('report_type', 'custom').contains('data', { sub_type: typeFilter });
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { reports: data as any[], count };
    },
  });

  // Fetch Stats for KPIs
  const { data: stats } = useQuery({
    queryKey: ['reports-stats'],
    queryFn: async () => {
      const { data: reports, error } = await supabase
        .from('performance_reports')
        .select('report_type, created_at, data');
      
      if (error) throw error;
      if (!reports) return null;

      const total = reports.length;
      const financial = reports.filter(r => (r.data as any)?.sub_type === 'Financial' || (r.data as any)?.sub_type === 'Driver_Payouts' || (r.data as any)?.sub_type === 'Vendor_Payouts').length;
      const performance = reports.filter(r => (r.data as any)?.sub_type === 'Driver_Performance' || (r.data as any)?.sub_type === 'Vendor_Performance').length;
      
      // Group by month for chart
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(new Date(), 5 - i);
        return {
          name: format(date, 'MMM', { locale: ar }),
          count: reports.filter(r => {
            const d = new Date(r.created_at);
            return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
          }).length
        };
      });

      return { total, financial, performance, chartData: last6Months };
    }
  });

  const getReportTypeLabel = (report: any) => {
    const type = report.report_type;
    const subType = report.data?.sub_type;
    
    const types: Record<string, string> = {
      Financial: 'تقرير مالي',
      Driver_Payouts: 'مستحقات المناديب',
      Vendor_Payouts: 'مستحقات التجار',
      Driver_Performance: 'أداء السائقين',
      Vendor_Performance: 'أداء التجار',
      User_Activity: 'نشاط المستخدمين',
      System_Health: 'حالة النظام',
    };
    
    return types[subType] || types[type] || type;
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Delete Single Report
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('performance_reports')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['reports-stats'] }).catch(console.error);
      toast.success('تم حذف التقرير بنجاح');
    },
    onError: (error: any) => {
      toast.error('خطأ في حذف التقرير: ' + error.message);
    }
  });

  // Delete All Reports
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('performance_reports')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['reports-stats'] }).catch(console.error);
      toast.success('تم حذف جميع التقارير بنجاح');
    },
    onError: (error: any) => {
      toast.error('خطأ في حذف التقارير: ' + error.message);
    }
  });

  const confirmDeleteAll = () => {
    setIsDeletingAll(true);
  };

  const confirmDelete = (id: string) => {
    setReportToDelete(id);
  };

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Delete Confirmation Modal */}
      {(reportToDelete || isDeletingAll) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center w-16 h-16 bg-red-50 rounded-2xl mb-6 mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h3 className="text-2xl font-black text-gray-900 text-center mb-2">
              {isDeletingAll ? 'حذف جميع التقارير؟' : 'حذف التقرير؟'}
            </h3>
            <p className="text-gray-500 text-center mb-8 leading-relaxed">
              {isDeletingAll 
                ? 'هل أنت متأكد من رغبتك في حذف جميع التقارير المسجلة؟ لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.'
                : 'هل أنت متأكد من رغبتك في حذف هذا التقرير؟ سيتم إزالة كافة البيانات المرتبطة به نهائياً.'}
            </p>
            
            <div className="flex gap-3">
              <button
                disabled={deleteAllMutation.isPending || deleteMutation.isPending}
                onClick={() => {
                  if (isDeletingAll) {
                    deleteAllMutation.mutate();
                    setIsDeletingAll(false);
                  } else if (reportToDelete) {
                    deleteMutation.mutate(reportToDelete);
                    setReportToDelete(null);
                  }
                }}
                className="flex-1 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {(deleteAllMutation.isPending || deleteMutation.isPending) && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                تأكيد الحذف
              </button>
              <button
                onClick={() => {
                  setReportToDelete(null);
                  setIsDeletingAll(false);
                }}
                className="flex-1 py-4 bg-gray-50 text-gray-600 font-bold rounded-2xl hover:bg-gray-100 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">مركز التقارير والتحليلات</h2>
          <p className="text-gray-500 mt-2 text-lg">استخرج البيانات، حلل الأداء، واتخذ قرارات مبنية على الأرقام.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={confirmDeleteAll}
            disabled={deleteAllMutation.isPending || !data?.count}
            className="inline-flex items-center justify-center px-6 py-3 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-100 hover:bg-red-100 transition-all disabled:opacity-50"
          >
            <Trash2 className="w-5 h-5 ml-2" />
            حذف الكل
          </button>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-5 h-5 ml-2" />
            إنشاء تقرير جديد
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-blue-50 rounded-2xl">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400">إجمالي التقارير</p>
            <h4 className="text-2xl font-black text-gray-900">{stats?.total || 0}</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-emerald-50 rounded-2xl">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400">تقارير مالية</p>
            <h4 className="text-2xl font-black text-gray-900">{stats?.financial || 0}</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
          <div className="p-4 bg-purple-50 rounded-2xl">
            <Activity className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400">تقارير الأداء</p>
            <h4 className="text-2xl font-black text-gray-900">{stats?.performance || 0}</h4>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              نشاط توليد التقارير
            </h3>
            <span className="text-xs font-bold text-gray-400">آخر 6 أشهر</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={stats?.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40}>
                  {stats?.chartData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5 text-emerald-500" />
            تصفية النتائج
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">البحث بالنص</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ابحث في الملخص..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 py-3 border border-gray-100 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">نوع التقرير</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all outline-none appearance-none"
              >
                <option value="All">جميع الأنواع</option>
                <option value="Financial">تقرير مالي</option>
                <option value="Driver_Payouts">مستحقات المناديب</option>
                <option value="Vendor_Payouts">مستحقات التجار</option>
                <option value="Driver_Performance">أداء السائقين</option>
                <option value="Vendor_Performance">أداء التجار</option>
                <option value="User_Activity">نشاط المستخدمين</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-50">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>إجمالي السجلات: {data?.count || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-xs font-bold uppercase tracking-widest">
                <th className="px-8 py-5">التقرير والمسؤول</th>
                <th className="px-8 py-5">الفترة الزمنية</th>
                <th className="px-8 py-5">الملخص التنفيذي</th>
                <th className="px-8 py-5">تاريخ الإصدار</th>
                <th className="px-8 py-5 text-center">الملف</th>
                <th className="px-8 py-5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`report-skeleton-${i}`} className="animate-pulse">
                    <td colSpan={6} className="px-8 py-6"><div className="h-12 bg-gray-50 rounded-2xl w-full"></div></td>
                  </tr>
                ))
              ) : data?.reports?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="w-12 h-12 text-gray-200" />
                      <p className="text-gray-400 font-bold">لا توجد تقارير متاحة حالياً</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.reports?.map((report, idx) => (
                  <tr key={report.id || `report-${idx}`} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                          ((report.data as any)?.sub_type === 'Financial' || (report.data as any)?.sub_type === 'Driver_Payouts' || (report.data as any)?.sub_type === 'Vendor_Payouts') ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
                        )}>
                          <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900">{getReportTypeLabel(report)}</p>
                          <p className="text-xs text-gray-400 mt-1">بواسطة: {report.profiles?.full_name || 'النظام'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                          <Calendar className="w-3 h-3 text-emerald-500" />
                          <span>من: {format(new Date(report.period_start), 'dd MMM yyyy', { locale: ar })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                          <Calendar className="w-3 h-3 text-red-400" />
                          <span>إلى: {format(new Date(report.period_end), 'dd MMM yyyy', { locale: ar })}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm text-gray-600 leading-relaxed max-w-xs line-clamp-2">
                        {report.summary || 'لا يوجد ملخص متاح'}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
                        <Clock className="w-4 h-4" />
                        {format(new Date(report.created_at), 'PPp', { locale: ar })}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {report.file_url ? (
                          <button 
                            onClick={() => window.open(report.file_url!, '_system')}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-black rounded-xl hover:bg-emerald-100 transition-all"
                          >
                            <Download className="w-4 h-4" />
                            تحميل EXCEL
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs font-bold ml-2">غير متاح</span>
                        )}
                        
                        <button
                          onClick={() => confirmDelete(report.id)}
                          disabled={deleteMutation.isPending}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="حذف التقرير"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.count && data.count > pageSize && (
          <div className="px-8 py-5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500 font-medium">
              عرض <span className="text-gray-900 font-black">{page * pageSize + 1}</span> - <span className="text-gray-900 font-black">{Math.min((page + 1) * pageSize, data.count)}</span> من <span className="text-gray-900 font-black">{data.count}</span> تقرير
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                السابق
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= data.count}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {isModalOpen && (
        <ReportGeneratorModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}

