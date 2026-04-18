import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, AlertCircle, CheckCircle, Clock, Eye, Scale, ChevronLeft, ChevronRight, User, Plus, ShieldAlert, MessageSquare } from 'lucide-react';
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

  const { data, isLoading } = useQuery({
    queryKey: ['disputes', page, searchQuery, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('dispute_resolution')
        .select(`
          *,
          support_tickets:ticket_id (ticket_number, subject, chat_room_id),
          master_orders:order_id (order_number),
          arbitrator:arbitrator_id (full_name)
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
      case 'Escalated': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
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
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-100 rounded-2xl shadow-sm">
            <Scale className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">فض النزاعات</h2>
            <p className="mt-1 text-gray-500 font-medium">إدارة وحل الشكاوى والنزاعات بين الأطراف لضمان العدالة.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <button 
            onClick={() => setIsFormModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-bold rounded-2xl shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all"
          >
            <Plus className="w-5 h-5 ml-2" />
            فتح نزاع جديد
          </button>

          <div className="relative group flex-1 sm:w-72">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="بحث في النزاعات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium transition-all"
            />
          </div>

          <div className="relative flex-1 sm:w-56">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold appearance-none transition-all"
            >
              <option value="All">جميع الحالات</option>
              <option value="Under_Review">قيد المراجعة</option>
              <option value="Resolved">تم الحل</option>
              <option value="Rejected">مرفوض</option>
              <option value="Escalated">تم التصعيد</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-xs font-bold uppercase tracking-widest">
                <th className="px-8 py-5">رقم التذكرة / الطلب</th>
                <th className="px-8 py-5">المحكم</th>
                <th className="px-8 py-5">المبلغ المسترد</th>
                <th className="px-8 py-5">خصم من</th>
                <th className="px-8 py-5">الحالة</th>
                <th className="px-8 py-5">التاريخ</th>
                <th className="px-8 py-5">إجراءات</th>
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
                  <td colSpan={7} className="px-8 py-16 text-center text-gray-400 font-medium">
                    لا توجد نزاعات حالياً تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                data?.disputes?.map((dispute) => (
                  <tr key={dispute.id} className="group hover:bg-gray-50/50 transition-colors cursor-default">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">تذكرة: {dispute.support_tickets?.ticket_number || 'N/A'}</span>
                        <span className="text-xs text-gray-400 font-medium mt-0.5">طلب: #{dispute.master_orders?.order_number || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-gray-700">{dispute.arbitrator?.full_name || 'غير معين'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-black text-emerald-600">
                        {dispute.refund_amount?.toFixed(2) || '0.00'} ج.م
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-gray-500">
                        {dispute.deducted_from === 'Vendor' ? 'المطعم' : dispute.deducted_from === 'Driver' ? 'المندوب' : dispute.deducted_from === 'Platform' ? 'المنصة' : '-'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border",
                        getStatusColor(dispute.status)
                      )}>
                        {getStatusLabel(dispute.status)}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-sm text-gray-400 font-medium">
                      {format(new Date(dispute.created_at), 'PP', { locale: ar })}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setSelectedDispute(dispute)}
                          className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                          title="عرض التفاصيل والحل"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {dispute.status === 'Under_Review' && (
                          <>
                            <button 
                              onClick={() => updateStatusMutation.mutate({ id: dispute.id, status: 'Resolved' })}
                              className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="حل النزاع"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => updateStatusMutation.mutate({ id: dispute.id, status: 'Rejected' })}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
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
          <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500 font-medium">
              عرض <span className="font-bold text-gray-900">{page * pageSize + 1}</span> إلى <span className="font-bold text-gray-900">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-bold text-gray-900">{data.count}</span> نزاع
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= data.count}
                className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
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
