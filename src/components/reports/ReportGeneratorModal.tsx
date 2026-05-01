import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { X, FileText, Calendar, Loader2, CheckCircle2, Download, Eye, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '../../lib/utils';

interface ReportGeneratorModalProps {
  onClose: () => void;
}

type ReportType = 'Financial' | 'Driver_Performance' | 'Vendor_Performance' | 'User_Activity' | 'Driver_Payouts' | 'Vendor_Payouts';

export default function ReportGeneratorModal({ onClose }: ReportGeneratorModalProps) {
  const queryClient = useQueryClient();
  const [reportType, setReportType] = React.useState<ReportType>('Financial');
  const [startDate, setStartDate] = React.useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = React.useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<any[] | null>(null);
  const [reportSummary, setReportSummary] = React.useState('');

  const generateMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('غير مصرح لك');

      let reportData: any[] = [];
      let summary = '';

      // Fetch data based on type
      if (reportType === 'Financial') {
        const { data, error } = await supabase
          .from('master_orders')
          .select('*')
          .eq('status', 'Completed')
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        
        if (error) throw error;
        const safeData = data || [];
        reportData = safeData;
        const total = safeData.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0);
        summary = `إجمالي الإيرادات (الطلبات المكتملة): ${total.toFixed(2)} ج.م لعدد ${safeData.length} طلب`;
      } else if (reportType === 'Driver_Performance') {
        const { data, error } = await (supabase as any)
          .from('order_status_history')
          .select(`
            *,
            driver:driver_details(user_id, profile:profiles(full_name))
          `)
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        
        if (error) throw error;
        reportData = data || [];
        summary = `تم تحليل أداء المناديب لعدد ${reportData.length} عملية تحديث حالة`;
      } else if (reportType === 'Vendor_Performance') {
        const { data, error } = await (supabase as any)
          .from('sub_orders')
          .select(`
            *,
            vendor:vendor_details(brand_name)
          `)
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        
        if (error) throw error;
        reportData = data || [];
        summary = `تم تحليل أداء التجار لعدد ${reportData.length} طلب فرعي`;
      } else if (reportType === 'Driver_Payouts') {
        const { data, error } = await supabase
          .from('wallets_transaction')
          .select(`
            amount,
            created_at,
            transaction_type,
            reference_id,
            profiles:profiles(full_name)
          `)
          .eq('transaction_type', 'delivery_earnings')
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        
        if (error) throw error;
        
        reportData = (data as any[] || []).map(item => ({
          'اسم المندوب': item.profiles?.full_name || 'غير معروف',
          'نوع الحركة': 'أرباح توصيل',
          'رقم المرجع': item.reference_id || '-',
          'المبلغ': item.amount,
          'التاريخ': item.created_at ? format(new Date(item.created_at), 'yyyy-MM-dd HH:mm') : '-'
        }));
        
        const totalDue = reportData.reduce((sum, item) => sum + Number(item['المبلغ']), 0);
        summary = `مستحقات المناديب: إجمالي ${totalDue.toFixed(2)} ج.م لعدد ${reportData.length} عملية`;
      } else if (reportType === 'Vendor_Payouts') {
        const { data, error } = await supabase
          .from('sub_orders')
          .select(`
            sub_total,
            vendor_commission,
            created_at,
            sub_status,
            vendor:vendor_details(brand_name, commission_rate),
            order:master_orders(order_number, status)
          `)
          .eq('sub_status', 'Delivered')
          .gte('created_at', startDate)
          .lte('created_at', endDate);
        
        if (error) throw error;
        
        reportData = (data as any[] || []).map(item => {
          const commRate = Number(item.vendor?.commission_rate || 0);
          const comm = Number(item.vendor_commission) || 
            ((Number(item.sub_total) * commRate) / 100);

          return {
            'اسم المتجر': item.vendor?.brand_name,
            'رقم الطلب': item.order?.order_number,
            'حالة الطلب فرعي': item.sub_status,
            'إجمالي الطلب': item.sub_total,
            'العمولة المحسوبة': comm,
            ' صافي التاجر': (Number(item.sub_total) || 0) - comm,
            'التاريخ': item.created_at ? format(new Date(item.created_at), 'yyyy-MM-dd HH:mm') : '-'
          };
        });
        
        const totalNet = reportData.reduce((sum, item) => sum + item[' صافي التاجر'], 0);
        summary = `مستحقات التجار (الطلبات المسلمة): إجمالي ${totalNet.toFixed(2)} ج.م لعدد ${reportData.length} طلب فرعي`;
      } else if (reportType === 'User_Activity') {
        const { data, error } = await (supabase as any)
          .from('audit_logs')
          .select(`
            *,
            admin:profiles(full_name)
          `)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        reportData = (data as any[] || []).map(item => ({
          'المسؤول': item.admin?.full_name || 'النظام',
          'نوع الإجراء': item.action_type,
          'الجدول': item.table_name,
          'رقم السجل': item.record_id,
          'التاريخ': item.created_at ? format(new Date(item.created_at), 'yyyy-MM-dd HH:mm') : '-'
        }));
        
        summary = `نشاط النظام: تم تسجيل ${data.length} إجراء خلال الفترة المحددة`;
      }

      if (!reportData || reportData.length === 0) {
        throw new Error('لا توجد بيانات متاحة لهذه الفترة المحددة');
      }

      setPreviewData(reportData);
      setReportSummary(summary);

      // Save report record to DB
      const { error: insertError } = await supabase
        .from('performance_reports')
        .insert({
          report_type: 'custom',
          period_start: startDate,
          period_end: endDate,
          generated_by: user.id,
          summary: summary,
          data: { 
            count: reportData.length,
            sub_type: reportType 
          },
          file_url: '#' // Placeholder
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('تم جلب بيانات التقرير بنجاح');
      queryClient.invalidateQueries({ queryKey: ['reports'] }).catch(console.error);
    },
    onError: (error: any) => {
      toast.error(error.message || 'فشل جلب البيانات');
    },
    onSettled: () => {
      setIsGenerating(false);
    }
  });

  const downloadExcel = async () => {
    if (!previewData) return;
    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(previewData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      const fileName = `report_${reportType}_${Date.now()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('تم تحميل الملف بنجاح');
    } catch (error: any) {
      console.error('Error exporting to Excel:', error);
      toast.error('حدث خطأ أثناء تصدير الملف');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000B3] " dir="rtl">
      <div className={cn(
        "bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300",
        previewData ? "w-full max-w-5xl h-[80vh]" : "w-full max-w-lg"
      )}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-[#111827B3]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-xl">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {previewData ? `معاينة: ${reportSummary}` : 'إنشاء تقرير أداء جديد'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!previewData ? (
            <div className="space-y-6">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">نوع التقرير</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'Financial', label: 'تقرير مالي', icon: '💰' },
                    { id: 'Driver_Payouts', label: 'مستحقات المناديب', icon: '💸' },
                    { id: 'Vendor_Payouts', label: 'مستحقات التجار', icon: '🏦' },
                    { id: 'Driver_Performance', label: 'أداء المناديب', icon: '🚚' },
                    { id: 'Vendor_Performance', label: 'أداء التجار', icon: '🏪' },
                    { id: 'User_Activity', label: 'نشاط النظام', icon: '📊' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setReportType(type.id as ReportType)}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2",
                        reportType === type.id 
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400 shadow-sm" 
                          : "border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:border-emerald-200"
                      )}
                    >
                      <span className="text-2xl">{type.icon}</span>
                      <span className="text-sm font-bold">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">من تاريخ</label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full pr-10 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">إلى تاريخ</label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full pr-10 py-2.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-2xl border border-blue-100 dark:border-blue-900 flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  سيتم عرض البيانات أولاً للمراجعة، ثم يمكنك تحميلها كملف Excel.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex justify-between items-center">
                <button 
                  onClick={() => setPreviewData(null)}
                  className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                >
                  <ArrowRight className="w-4 h-4" />
                  العودة للإعدادات
                </button>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900 px-3 py-1 rounded-full">
                  {previewData.length} سجل تم العثور عليه
                </div>
              </div>
              
              <div className="flex-1 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden overflow-x-auto bg-white dark:bg-gray-900 shadow-inner transition-colors">
                <table className="w-full text-right text-sm border-collapse">
                  <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 ">
                    <tr>
                      {Object.keys(previewData[0] || {}).map((key) => (
                        <th key={key} className="px-6 py-4 font-black text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {previewData.map((row, i) => (
                      <tr key={i} className="hover:bg-emerald-50 dark:hover:bg-emerald-900 transition-colors">
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium whitespace-nowrap">
                            {val === null || val === undefined ? '-' : 
                             typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-all"
          >
            إغلاق
          </button>
          
          {!previewData ? (
            <button
              onClick={() => generateMutation.mutate()}
              disabled={isGenerating}
              className="px-8 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري جلب البيانات...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  عرض التقرير
                </>
              )}
            </button>
          ) : (
            <button
              onClick={downloadExcel}
              className="px-8 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              تحميل كملف Excel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

