import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, AlertCircle, CheckCircle, Clock, Eye, Scale, ChevronLeft, ChevronRight, User, Plus, ShieldAlert, MessageSquare, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import DisputeDetailsModal from '../../components/disputes/DisputeDetailsModal';
import DisputeFormModal from '../../components/disputes/DisputeFormModal';
import PenaltyFormModal from '../../components/penalties/PenaltyFormModal';

export default function DisputesList() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [penaltyTarget, setPenaltyTarget] = useState<{ id: string, name: string, reason: string } | null>(null);
  const pageSize = 15;
  const queryClient = useQueryClient();

  // New query for overall statistics
  const { data: statsData } = useQuery({
    queryKey: ['disputes-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispute_resolution')
        .select('id, status');
      if (error) throw error;

      const total = data.length;
      const underReview = data.filter(d => d.status === 'Under_Review').length;
      const resolved = data.filter(d => d.status === 'Resolved').length;
      const escalated = data.filter(d => d.status === 'Escalated').length;

      return { total, underReview, resolved, escalated };
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['disputes', page, searchQuery, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('dispute_resolution')
        .select(`
          *,
          support_tickets:ticket_id (ticket_number, subject, chat_room_id),
          master_orders:order_id (order_number),
          arbitrator:arbitrator_id (full_name, avatar_url)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (searchQuery) {
        query = query.or(`deducted_from.ilike.%${searchQuery}%`);
      }

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { disputes: data as any[], count };
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase
        .from('dispute_resolution')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة النزاع');
      queryClient.invalidateQueries({ queryKey: ['disputes'] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['disputes-stats'] }).catch(console.error);
    },
    onError: (error) => {
      console.error('Error updating dispute status:', error);
      toast.error('حدث خطأ أثناء تحديث الحالة');
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Under_Review': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'Escalated': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Under_Review': return 'قيد المراجعة';
      case 'Resolved': return 'تم الحل';
      case 'Rejected': return 'مرفوض';
      case 'Escalated': return 'تم التصعيد';
      default: return status;
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-100 rounded-2xl shadow-sm">
            <Scale className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">إدارة النزاعات</h2>
            <p className="mt-1 text-gray-500 font-medium">التحكيم وحل الشكاوى المعقدة لضمان حقوق الأطراف</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <button 
            onClick={() => setIsFormModalOpen(true)}
            className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5 ml-2" />
            فتح نزاع جديد
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-50 to-white rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <div className="relative z-10 flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-500">إجمالي النزاعات</p>
              <p className="text-3xl font-black text-gray-900">
                {statsData?.total || 0}
              </p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Scale className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-50 to-white rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <div className="relative z-10 flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-500">قيد المراجعة</p>
              <p className="text-3xl font-black text-amber-600">
                {statsData?.underReview || 0}
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-red-50 to-white rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <div className="relative z-10 flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-500">تم التصعيد</p>
              <p className="text-3xl font-black text-red-600">
                {statsData?.escalated || 0}
              </p>
            </div>
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-50 to-white rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
          <div className="relative z-10 flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-bold text-gray-500">تم الحل</p>
              <p className="text-3xl font-black text-emerald-600">
                {statsData?.resolved || 0}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions Bar */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 p-1 bg-gray-50 rounded-xl w-full md:w-auto overflow-x-auto">
          {(['All', 'Under_Review', 'Escalated', 'Resolved'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                statusFilter === filter
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              {filter === 'All' ? 'الكل' : filter === 'Under_Review' ? 'قيد المراجعة' : filter === 'Escalated' ? 'تصعيد' : 'تم الحل'}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="بحث (مثال: المطعم)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pr-12 pl-4 py-2.5 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium transition-all"
          />
        </div>
      </div>


      {/* Table Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-100">
                <th className="px-8 py-5">معلومات النزاع</th>
                <th className="px-8 py-5">المحكم</th>
                <th className="px-8 py-5">التعويض المسترد</th>
                <th className="px-8 py-5">الخصم على</th>
                <th className="px-8 py-5">الحالة</th>
                <th className="px-8 py-5">التاريخ</th>
                <th className="px-8 py-5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-8 py-5"><div className="h-5 w-32 bg-gray-100 rounded-lg"></div></td>
                    <td className="px-8 py-5"><div className="h-5 w-24 bg-gray-100 rounded-lg"></div></td>
                    <td className="px-8 py-5"><div className="h-5 w-20 bg-gray-100 rounded-lg"></div></td>
                    <td className="px-8 py-5"><div className="h-5 w-20 bg-gray-100 rounded-lg"></div></td>
                    <td className="px-8 py-5"><div className="h-5 w-24 bg-gray-100 rounded-lg"></div></td>
                    <td className="px-8 py-5"><div className="h-5 w-28 bg-gray-100 rounded-lg"></div></td>
                    <td className="px-8 py-5"><div className="h-5 w-16 bg-gray-100 rounded-lg"></div></td>
                  </tr>
                ))
              ) : data?.disputes?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Scale className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-bold text-lg">لا توجد نزاعات</p>
                      <p className="text-gray-400 mt-1 text-sm">لم يتم العثور على أي نزاعات مسجلة بهذه المعايير.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.disputes?.map((dispute) => (
                  <tr key={dispute.id} className="group hover:bg-indigo-50 transition-colors cursor-default">
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-bold text-gray-900 inline-flex items-center gap-1.5 w-fit bg-gray-50 px-2 py-0.5 rounded-md">
                          <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                          تذكرة: {dispute.support_tickets?.ticket_number || 'N/A'}
                        </span>
                        {dispute.master_orders?.order_number && (
                          <span className="text-xs text-indigo-600 font-bold inline-flex items-center gap-1.5 w-fit bg-indigo-50 px-2 py-0.5 rounded-md">
                            <TrendingUp className="w-3.5 h-3.5" />
                            طلب: #{dispute.master_orders.order_number}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200 shadow-sm shrink-0">
                          {dispute.arbitrator?.avatar_url ? (
                            <img 
                              src={dispute.arbitrator.avatar_url} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <span className="text-sm font-bold text-gray-800">{dispute.arbitrator?.full_name || 'غير معين'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        {dispute.refund_amount ? (
                          <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                            {dispute.refund_amount.toFixed(2)} ج.م
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-gray-600 bg-gray-50 px-3 py-1 rounded-lg">
                        {dispute.deducted_from === 'Vendor' ? 'المطعم' : dispute.deducted_from === 'Driver' ? 'المندوب' : dispute.deducted_from === 'Platform' ? 'المنصة' : '-'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border shadow-sm",
                        getStatusColor(dispute.status)
                      )}>
                        {getStatusLabel(dispute.status)}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-sm text-gray-500 font-medium">
                      {format(new Date(dispute.created_at), 'd MMM yyyy', { locale: ar })}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setSelectedDispute(dispute)}
                          className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="عرض التفاصيل والحل"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {dispute.status === 'Under_Review' && (
                          <>
                            <button 
                              onClick={() => updateStatusMutation.mutate({ id: dispute.id, status: 'Resolved' })}
                              className="p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="حل النزاع"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => updateStatusMutation.mutate({ id: dispute.id, status: 'Rejected' })}
                              className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              title="رفض النزاع"
                            >
                              <AlertCircle className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        {data?.count && data.count > pageSize && (
          <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-500 font-medium">
              عرض <span className="font-bold text-gray-900">{page * pageSize + 1}</span> إلى <span className="font-bold text-gray-900">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-bold text-gray-900">{data.count}</span> نزاع
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-50 transition-all shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= data.count}
                className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-50 transition-all shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dispute Details Modal */}
      {selectedDispute && (
        <DisputeDetailsModal 
          dispute={selectedDispute} 
          onClose={() => setSelectedDispute(null)} 
          onIssuePenalty={(userId, userName, reason) => {
            setPenaltyTarget({ id: userId, name: userName, reason });
            setIsPenaltyModalOpen(true);
          }}
        />
      )}

      {/* Dispute Form Modal */}
      {isFormModalOpen && (
        <DisputeFormModal onClose={() => setIsFormModalOpen(false)} />
      )}

      {/* Penalty Form Modal */}
      {isPenaltyModalOpen && penaltyTarget && (
        <PenaltyFormModal
          onClose={() => {
            setIsPenaltyModalOpen(false);
            setPenaltyTarget(null);
          }}
          initialUserId={penaltyTarget.id}
          initialUserName={penaltyTarget.name}
          initialReason={penaltyTarget.reason}
        />
      )}
    </div>
  );
}
