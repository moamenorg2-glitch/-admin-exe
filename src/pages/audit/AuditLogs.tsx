import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, History, User, Table, Info, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { handleGlobalError } from '../../utils/errorHandler';
import { toast } from 'react-hot-toast';
import { supabaseAdmin, isAdminKeyAvailable } from '../../lib/supabaseAdmin';

export default function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [tableFilter, setTableFilter] = useState('All');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemsPerPage = 15;
  const queryClient = useQueryClient();

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, tableFilter]);

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['audit_logs', searchQuery, tableFilter, currentPage],
    queryFn: async () => {
      try {
        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        let query = supabase
          .from('audit_logs')
          .select(`
            id,
            admin_id,
            action_type,
            table_name,
            record_id,
            old_value,
            new_value,
            ip_address,
            created_at,
            updated_at,
            profiles!admin_id(full_name, avatar_url)
          `, { count: 'exact' });

        if (tableFilter !== 'All') {
          query = query.eq('table_name', tableFilter);
        }

        if (searchQuery) {
          query = query.or(`table_name.ilike.%${searchQuery}%,action_type.ilike.%${searchQuery}%`);
        }

        const { data, error, count } = await query
          .order('created_at', { ascending: false })
          .range(from, to);
        if (error) throw error;
        return { logs: data as any[], totalCount: count || 0 };
      } catch (error) {
        console.error('AuditLogs fetch error:', error);
        throw error;
      }
    },
  });

  const logs = data?.logs || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const deleteMutation = useMutation({
    mutationFn: async ({ id, all }: { id?: string; all?: boolean }) => {
      setIsDeleting(true);
      const loadingToast = toast.loading(all ? 'جاري مسح السجل...' : 'جاري حذف السجل...');
      
      try {
        if (!isAdminKeyAvailable) {
          throw new Error("لا يمكن إتمام العملية، مفتاح المسؤول (Service Role Key) غير متوفر.");
        }

        if (all) {
          const { error } = await supabaseAdmin.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error) throw error;
        } else if (id) {
          const { error } = await supabaseAdmin.from('audit_logs').delete().eq('id', id);
          if (error) throw error;
        }

        toast.success(all ? 'تم مسح السجل بالكامل' : 'تم حذف السجل بنجاح', { id: loadingToast, duration: 2500 });
        return { success: true };
      } catch (err: any) {
        toast.error(err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف', { id: loadingToast, duration: 4000 });
        throw err;
      } finally {
        setIsDeleting(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit_logs'] }).catch(console.error);
    },
    meta: { suppressGlobalError: true }
  });

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    toast.dismiss(); // Clear any previous toasts
    
    // We'll use a double-toast approach since window.confirm might be blocked
    toast((t) => (
      <div className="flex flex-col gap-3" dir="rtl">
        <p className="text-sm font-bold text-gray-800">هل أنت متأكد من حذف هذا السجل نهائياً؟</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              toast.dismiss(t.id);
              deleteMutation.mutate({ id });
            }}
            className="px-3 py-1.5 bg-rose-500 text-white text-xs rounded-lg font-bold"
          >
            تأكيد الحذف
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg font-bold"
          >
            تراجع
          </button>
        </div>
      </div>
    ), { duration: 4000 });
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    toast.dismiss(); // Clear any previous toasts

    toast((t) => (
      <div className="flex flex-col gap-3" dir="rtl">
        <p className="text-sm font-bold text-gray-800">تحذير! هل أنت متأكد من مسح جميع السجلات؟</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              toast.dismiss(t.id);
              deleteMutation.mutate({ all: true });
            }}
            className="px-3 py-1.5 bg-rose-500 text-white text-xs rounded-lg font-bold"
          >
            مسح السجل بالكامل
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg font-bold"
          >
            تراجع
          </button>
        </div>
      </div>
    ), { duration: 4000 });
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1.5"></span>
            إضافة
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-1.5"></span>
            تعديل
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ml-1.5"></span>
            حذف
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-700 border border-gray-100">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500 ml-1.5"></span>
            {action}
          </span>
        );
    }
  };

  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});
  const [isResolving, setIsResolving] = useState(false);

  // Helper to resolve IDs to names
  useEffect(() => {
    if (!selectedLog) return;

    const resolveIds = async () => {
      setIsResolving(true);
      const idsToResolve: Record<string, Set<string>> = {
        profiles: new Set(),
        vendor_details: new Set(),
        master_orders: new Set(),
        cities: new Set(),
        zones: new Set(),
        products: new Set(),
        support_tickets: new Set(),
      };

      const scanObject = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
            if (
              key.includes('customer') || 
              key.includes('driver') || 
              key.includes('admin') || 
              key.includes('user_id') || 
              key === 'sender_id' || 
              key === 'assigned_to' || 
              key === 'arbitrator_id' ||
              key === 'target_user_id' ||
              key === 'participant_id'
            ) {
              idsToResolve.profiles.add(value);
            } else if (key.includes('vendor')) {
              idsToResolve.vendor_details.add(value);
            } else if (key.includes('order') && !key.includes('item')) {
              idsToResolve.master_orders.add(value);
            } else if (key.includes('city')) {
              idsToResolve.cities.add(value);
            } else if (key.includes('zone')) {
              idsToResolve.zones.add(value);
            } else if (key.includes('product')) {
              idsToResolve.products.add(value);
            } else if (key === 'ticket_id') {
              idsToResolve.support_tickets.add(value);
            }
          }
        });
      };

      scanObject(selectedLog.old_value);
      scanObject(selectedLog.new_value);
      scanObject({ record_id: selectedLog.record_id });
      if (selectedLog.admin_id) idsToResolve.profiles.add(selectedLog.admin_id);

      const newNames: Record<string, string> = { ...resolvedNames };

      try {
        // Resolve Profiles
        if (idsToResolve.profiles.size > 0) {
          const { data } = await supabase.from('profiles').select('user_id, full_name').in('user_id', Array.from(idsToResolve.profiles));
          data?.forEach(p => newNames[p.user_id] = p.full_name);
        }
        // Resolve Vendors
        if (idsToResolve.vendor_details.size > 0) {
          const { data } = await supabase.from('vendor_details').select('user_id, brand_name').in('user_id', Array.from(idsToResolve.vendor_details));
          data?.forEach(v => newNames[v.user_id] = v.brand_name);
        }
        // Resolve Orders
        if (idsToResolve.master_orders.size > 0) {
          const { data } = await supabase.from('master_orders').select('id, order_number').in('id', Array.from(idsToResolve.master_orders));
          data?.forEach(o => newNames[o.id] = `طلب #${o.order_number}`);
        }
        // Resolve Tickets
        if (idsToResolve.support_tickets.size > 0) {
          const { data } = await supabase.from('support_tickets').select('id, ticket_number').in('id', Array.from(idsToResolve.support_tickets));
          data?.forEach(t => newNames[t.id] = `تذكرة #${t.ticket_number}`);
        }
        // Resolve Cities/Zones/Products
        if (idsToResolve.cities.size > 0) {
          const { data } = await supabase.from('cities').select('id, name_ar').in('id', Array.from(idsToResolve.cities));
          data?.forEach(c => newNames[c.id] = c.name_ar);
        }
        if (idsToResolve.zones.size > 0) {
          const { data } = await supabase.from('zones').select('zone_id, name_ar').in('zone_id', Array.from(idsToResolve.zones));
          data?.forEach(z => newNames[z.zone_id] = z.name_ar);
        }
        if (idsToResolve.products.size > 0) {
          const { data } = await supabase.from('products').select('id, name_ar').in('id', Array.from(idsToResolve.products));
          data?.forEach(p => newNames[p.id] = p.name_ar);
        }

        setResolvedNames(newNames);
      } catch (err) {
        console.error('Resolution error:', err);
      } finally {
        setIsResolving(false);
      }
    };

    resolveIds();
  }, [selectedLog]);

  const formatValue = (val: any) => {
    if (val === null || val === undefined) return <span className="text-gray-300 italic">لا يوجد</span>;
    if (typeof val === 'boolean') return val ? <span className="text-emerald-600 font-bold">نعم</span> : <span className="text-rose-600 font-bold">لا</span>;
    
    if (typeof val === 'string' && resolvedNames[val]) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-emerald-600 font-bold">{resolvedNames[val]}</span>
          <span className="text-[10px] text-gray-400 font-mono">({val.substring(0, 5)}...)</span>
        </span>
      );
    }
    return String(val);
  };

  const getRecordDisplayName = (log: any) => {
    if (resolvedNames[log.record_id]) return resolvedNames[log.record_id];
    
    const data = log.new_value || log.old_value;
    if (!data) return log.record_id.substring(0, 8);

    if (log.table_name === 'master_orders') return `طلب #${data.order_number || log.record_id.substring(0, 8)}`;
    if (log.table_name === 'sub_orders') return `طلب فرعي #${log.record_id.substring(0, 8)}`;
    if (log.table_name === 'support_tickets') return `تذكرة #${data.ticket_number || log.record_id.substring(0, 8)}`;
    if (log.table_name === 'admin_penalties') return `جزاء للمستخدم ${resolvedNames[data.target_user_id] || data.target_user_id?.substring(0, 8)}`;
    
    return data.full_name || data.brand_name || data.name_ar || data.title_ar || data.ticket_number || log.record_id.substring(0, 8);
  };

  const fieldNamesAr: Record<string, string> = {
    full_name: 'الاسم الكامل',
    user_type: 'نوع المستخدم',
    status: 'الحالة',
    is_online: 'متصل',
    is_busy: 'مشغول',
    brand_name: 'اسم العلامة التجارية',
    is_open: 'مفتوح',
    sub_status: 'حالة الطلب الفرعي',
    payment_status: 'حالة الدفع',
    grand_total: 'الإجمالي الكلي',
    delivery_fee: 'رسوم التوصيل',
    preparation_time_avg: 'متوسط وقت التحضير',
    is_featured: 'مميز',
    primary_phone: 'الهاتف الأساسي',
    email: 'البريد الإلكتروني',
    is_lead: 'قائد الفريق',
    driver_id: 'السائق',
    target_user_id: 'المستخدم المستهدف',
    assigned_to: 'تم التعيين إلى',
    arbitrator_id: 'المحكم',
    sender_id: 'المرسل',
    user_id: 'المستخدم',
    tip_share: 'حصة البقشيش',
    delivery_share: 'حصة التوصيل',
    master_order_id: 'الطلب الرئيسي',
    created_at: 'تاريخ الإنشاء',
    updated_at: 'تاريخ التحديث',
    id: 'المعرف',
    amount: 'المبلغ',
    transaction_type: 'نوع المعاملة',
    balance_after: 'الرصيد بعد العملية',
    reference_id: 'المرجع',
    description_ar: 'الوصف',
    zone_id: 'المنطقة',
    category_id: 'التصنيف',
    items_total: 'إجمالي العناصر',
    total_tax: 'إجمالي الضريبة',
    service_fee: 'رسوم الخدمة',
    distance_fee: 'رسوم المسافة',
    driver_tip: 'بقشيش السائق',
    total_distance: 'المسافة الإجمالية',
    notes: 'ملاحظات',
    address_id: 'عنوان التوصيل',
  };

  const renderDataGrid = (data: any) => {
    if (!data || typeof data !== 'object') return null;
    
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex flex-col p-3 bg-gray-50/50 rounded-xl border border-gray-100">
            <span className="text-[10px] font-black text-gray-400 uppercase mb-1">
              {fieldNamesAr[key] || key}
            </span>
            <div className="text-sm font-bold text-gray-700 break-all">
              {formatValue(value)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderChangesSummary = (log: any) => {
    if (log.action_type === 'INSERT') return <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm font-medium">تم إنشاء سجل جديد بكافة البيانات الموضحة أدناه.</div>;
    if (log.action_type === 'DELETE') return <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm font-medium">تم حذف السجل بالكامل.</div>;
    
    if (!log.old_value || !log.new_value) return null;
    
    const changes: { key: string; old: any; new: any }[] = [];
    const oldVal = log.old_value;
    const newVal = log.new_value;
    
    Object.keys(newVal).forEach(key => {
      if (JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key])) {
        changes.push({ key, old: oldVal[key], new: newVal[key] });
      }
    });
    
    if (changes.length === 0) return <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-500 text-sm italic">لا توجد تغييرات فعلية في البيانات.</div>;
    
    return (
      <div className="space-y-3">
        <h4 className="font-bold text-gray-900 text-sm">ملخص التغييرات:</h4>
        <div className="space-y-2">
          {changes.map(change => (
            <div key={change.key} className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-xs font-black text-gray-400 uppercase mb-2">
                {fieldNamesAr[change.key] || change.key}
              </span>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex-1 line-clamp-1 text-gray-500 line-through decoration-red-300">
                  {formatValue(change.old)}
                </div>
                <div className="text-gray-300">←</div>
                <div className="flex-1 line-clamp-1 text-emerald-600 font-bold">
                  {formatValue(change.new)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const tableNamesAr: Record<string, string> = {
    profiles: 'المستخدمين',
    master_orders: 'الطلبات الرئيسية',
    sub_orders: 'الطلبات الفرعية',
    vendor_details: 'المتاجر',
    driver_details: 'السائقين',
    wallets_transaction: 'المعاملات المالية',
    wallets: 'المحافظ المالية',
    support_tickets: 'تذاكر الدعم',
    dispute_resolution: 'فض النزاعات',
    chat_messages: 'رسائل الدردشة',
    admin_penalties: 'الجزاءات الإدارية',
    system_settings: 'إعدادات النظام',
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-500 p-3.5 rounded-2xl shadow-lg shadow-emerald-200/50">
            <History className="h-7 w-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">سجل العمليات</h2>
            <p className="text-gray-500 text-sm font-medium mt-0.5">تتبع جميع التغييرات في النظام</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
          <button
            type="button"
            onClick={(e) => handleClearAll(e)}
            disabled={isDeleting || logs.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-200/50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:scale-95 cursor-pointer z-10"
          >
            <Trash2 className="h-5 w-5" />
            حذف الكل
          </button>
          
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder="بحث برقم السجل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-72 pr-12 pl-4 py-3 bg-white border-2 border-gray-100 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none font-medium text-gray-700 placeholder:text-gray-400 shadow-sm"
            />
          </div>

          <div className="relative group flex-1 sm:flex-none">
            <Filter className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="w-full sm:w-64 pr-12 pl-4 py-3 bg-white border-2 border-gray-100 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none font-bold text-gray-700 appearance-none shadow-sm cursor-pointer"
            >
              <option value="All">جميع العمليات المسجلة</option>
              <optgroup label="الجداول المراقبة (الأهم)">
                <option value="dispute_resolution">فض النزاعات</option>
                <option value="support_tickets">تذاكر الدعم</option>
                <option value="admin_penalties">الجزاءات الإدارية</option>
                <option value="wallets_transaction">المعاملات المالية</option>
                <option value="wallets">المحافظ المالية</option>
                <option value="chat_messages">رسائل الدردشة</option>
              </optgroup>
              <optgroup label="الطلبات والمستخدمين">
                <option value="master_orders">الطلبات الرئيسية</option>
                <option value="sub_orders">الطلبات الفرعية</option>
                <option value="profiles">الملفات الشخصية</option>
                <option value="vendor_details">المتاجر</option>
                <option value="driver_details">السائقين</option>
              </optgroup>
              <optgroup label="إعدادات النظام">
                <option value="system_settings">إعدادات النظام</option>
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white shadow-xl shadow-gray-200/50 overflow-hidden sm:rounded-[2.5rem] border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-6 text-right text-xs font-black text-gray-500 uppercase tracking-[0.2em]">التاريخ</th>
                <th className="px-8 py-6 text-right text-xs font-black text-gray-500 uppercase tracking-[0.2em]">المسؤول</th>
                <th className="px-8 py-6 text-right text-xs font-black text-gray-500 uppercase tracking-[0.2em]">العملية</th>
                <th className="px-8 py-6 text-right text-xs font-black text-gray-500 uppercase tracking-[0.2em]">الجدول</th>
                <th className="px-8 py-6 text-right text-xs font-black text-gray-500 uppercase tracking-[0.2em]">المستهدف</th>
                <th className="px-8 py-6 text-right text-xs font-black text-gray-500 uppercase tracking-[0.2em]">IP</th>
                <th className="px-8 py-6 text-center text-xs font-black text-gray-500 uppercase tracking-[0.2em]">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                      <span className="text-gray-500 font-bold">جاري التحميل...</span>
                    </div>
                  </td>
                </tr>
              ) : queryError ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-red-50 p-4 rounded-full">
                        <X className="h-10 w-10 text-red-500" />
                      </div>
                      <span className="text-red-500 font-bold text-lg">حدث خطأ أثناء جلب السجلات</span>
                      <p className="text-red-400 text-sm max-w-md text-center">{queryError instanceof Error ? queryError.message : String(queryError)}</p>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-gray-50 p-4 rounded-full">
                        <History className="h-10 w-10 text-gray-300" />
                      </div>
                      <span className="text-gray-400 font-bold text-lg">لا يوجد سجلات عمليات حالياً</span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">
                          {format(new Date(log.created_at), 'p', { locale: ar })}
                        </span>
                        <span className="text-xs font-medium text-gray-500">
                          {format(new Date(log.created_at), 'PP', { locale: ar })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                          {log.profiles?.avatar_url ? (
                            <img 
                              src={log.profiles.avatar_url} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="text-gray-500 font-bold text-sm">
                              {log.profiles?.full_name?.[0] || 'ن'}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-gray-900">{log.profiles?.full_name || 'نظام'}</div>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">{getActionBadge(log.action_type)}</td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold border border-gray-200">
                        {tableNamesAr[log.table_name] || log.table_name}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                          {getRecordDisplayName(log)}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-500">{log.ip_address || '-'}</span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors border border-emerald-100/50"
                        >
                          <Info className="h-4 w-4" />
                          عرض
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => handleDelete(log.id, e)}
                          disabled={isDeleting}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50 cursor-pointer active:scale-90 z-10"
                          title="حذف السجل"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="text-sm text-gray-500 font-medium">
              إجمالي السجلات: <span className="font-bold text-gray-900">{totalCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                السابق
              </button>
              <span className="text-sm font-bold text-gray-700 mx-2">
                صفحة {currentPage} من {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-900">تفاصيل السجل</h3>
                {isResolving && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold animate-pulse">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
                    جاري ترجمة المعرفات...
                  </div>
                )}
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="block text-sm text-gray-500 mb-1">المسؤول</span>
                  <span className="font-bold text-gray-900">{selectedLog.profiles?.full_name || 'غير معروف'}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="block text-sm text-gray-500 mb-1">نوع الإجراء</span>
                  <span className="font-bold text-gray-900">{getActionBadge(selectedLog.action_type)}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="block text-sm text-gray-500 mb-1">الجدول</span>
                  <span className="font-bold text-gray-900">{tableNamesAr[selectedLog.table_name] || selectedLog.table_name}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="block text-sm text-gray-500 mb-1">المستهدف</span>
                  <span className="font-bold text-gray-900">{getRecordDisplayName(selectedLog)}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="block text-sm text-gray-500 mb-1">رقم السجل (ID)</span>
                  <span className="font-mono text-xs text-gray-600">{selectedLog.record_id}</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="block text-sm text-gray-500 mb-1">التاريخ</span>
                  <span className="font-bold text-gray-900">{format(new Date(selectedLog.created_at), 'PPpp', { locale: ar })}</span>
                </div>
              </div>

              {renderChangesSummary(selectedLog)}

              {selectedLog.old_value && (
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 border-r-4 border-gray-300 pr-3">البيانات السابقة (قبل التعديل)</h4>
                  {renderDataGrid(selectedLog.old_value)}
                </div>
              )}

              {selectedLog.new_value && (
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900 border-r-4 border-emerald-500 pr-3">البيانات الجديدة (بعد التعديل)</h4>
                  {renderDataGrid(selectedLog.new_value)}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
