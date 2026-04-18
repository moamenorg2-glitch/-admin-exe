import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, MessageSquare, Clock, CheckCircle, AlertCircle, X, User, Phone, Hash, Calendar, Scale, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import PenaltyFormModal from '../../components/penalties/PenaltyFormModal';

interface SupportTicket {
  id: string;
  ticket_number: string;
  order_id: string | null;
  user_id: string | null;
  chat_room_id: string | null;
  subject: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
  profile: {
    full_name: string;
    primary_phone: string;
  } | null;
  order: {
    order_number: number;
  } | null;
  dispute: { id: string }[] | null;
}

export default function SupportTickets() {
  const [searchParams] = useSearchParams();
  const initialTicketId = searchParams.get('ticketId');

  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [penaltyTarget, setPenaltyTarget] = useState<{ id: string, name: string, reason: string } | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['support_tickets', statusFilter, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          profile:profiles!support_tickets_user_id_fkey(full_name, primary_phone),
          order:master_orders!support_tickets_order_id_fkey(order_number),
          dispute:dispute_resolution(id)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery) {
        const isNumeric = /^\d+$/.test(searchQuery);
        if (isNumeric) {
          // Search by ticket number OR order number
          // We'll fetch the order IDs for this order number first
          const { data: orders } = await supabase
            .from('master_orders')
            .select('id')
            .eq('order_number', parseInt(searchQuery));
          
          const orderIds = orders?.map(o => o.id) || [];
          
          if (orderIds.length > 0) {
            query = query.or(`ticket_number.ilike.%${searchQuery}%,order_id.in.(${orderIds.join(',')})`);
          } else {
            query = query.ilike('ticket_number', `%${searchQuery}%`);
          }
        } else {
          query = query.ilike('ticket_number', `%${searchQuery}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any) as SupportTicket[];
    },
  });

  useEffect(() => {
    if (initialTicketId && data) {
      const ticket = data.find(t => t.id === initialTicketId);
      if (ticket) {
        setSelectedTicket(ticket);
      }
    }
  }, [initialTicketId, data]);

  useEffect(() => {
    const channel = supabase
      .channel('support-tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        queryClient.invalidateQueries({ queryKey: ['support_tickets'] }).catch(console.error);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(err => {
        console.error('Error removing tickets channel:', err);
      });
    };
  }, [queryClient]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('support_tickets')
        .update({ status })
        .eq('id', id)
        .select();
      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] }).catch(console.error);
      toast.success('تم تحديث حالة التذكرة بنجاح');
      setSelectedTicket(null);
    },
    onError: (error: any) => {
      toast.error('خطأ في تحديث الحالة: ' + error.message);
    }
  });

  const escalateToDisputeMutation = useMutation({
    mutationFn: async (ticket: SupportTicket) => {
      // 1. Check if dispute already exists
      const { data: existingDispute } = await supabase
        .from('dispute_resolution')
        .select('id')
        .eq('ticket_id', ticket.id)
        .single();

      if (existingDispute) {
        throw new Error('هذه التذكرة محولة بالفعل إلى نزاع');
      }

      // 2. Create dispute record
      const { error: disputeError } = await supabase
        .from('dispute_resolution')
        .insert({
          ticket_id: ticket.id,
          order_id: ticket.order_id,
          status: 'Under_Review',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (disputeError) throw disputeError;

      // 3. Update ticket status
      const { error: ticketError } = await supabase
        .from('support_tickets')
        .update({ 
          status: 'In_Progress'
        })
        .eq('id', ticket.id);

      if (ticketError) throw ticketError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['disputes'] }).catch(console.error);
      toast.success('تم تحويل التذكرة إلى قسم فض النزاعات بنجاح');
      setSelectedTicket(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'خطأ في تحويل التذكرة');
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Open':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">مفتوح</span>;
      case 'In_Progress':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">قيد المعالجة</span>;
      case 'Resolved':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">تم الحل</span>;
      case 'Closed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">مغلق</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">الدعم الفني والشكاوى</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="بحث برقم التذكرة..."
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full sm:w-64 pr-10 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border py-2 px-3"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full sm:w-48 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border py-2 px-3"
          >
            <option value="All">جميع الحالات</option>
            <option value="Open">مفتوح</option>
            <option value="In_Progress">قيد المعالجة</option>
            <option value="Resolved">تم الحل</option>
            <option value="Closed">مغلق</option>
          </select>
        </div>
      </div>

      <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50/50 border-b border-gray-100 text-right">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">رقم التذكرة</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المستخدم</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الطلب المرتبط</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الموضوع</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الأولوية</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الحالة</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">التاريخ</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">إجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center">جاري التحميل...</td></tr>
              ) : data?.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">لا يوجد تذاكر دعم حالياً</td></tr>
              ) : (
                data?.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{ticket.ticket_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ticket.profile?.full_name}</div>
                      <div className="text-xs text-gray-500">{ticket.profile?.primary_phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {ticket.order ? (
                        <Link 
                          to={`/orders?orderId=${ticket.order_id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 transition-colors"
                        >
                          <Hash className="w-3 h-3" />
                          طلب #{ticket.order.order_number}
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">---</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{ticket.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        ticket.priority === 'High' ? 'bg-red-100 text-red-800' :
                        ticket.priority === 'Medium' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-blue-100 text-blue-800'
                      )}>
                        {ticket.priority === 'High' ? 'عالية' : ticket.priority === 'Medium' ? 'متوسطة' : 'منخفضة'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(ticket.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(ticket.created_at), 'PPp', { locale: ar })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <button 
                        onClick={() => setSelectedTicket(ticket)}
                        className="text-emerald-600 hover:text-emerald-900 bg-emerald-50 px-3 py-1 rounded-md"
                      >
                        عرض التفاصيل
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden text-right">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">تفاصيل التذكرة #{selectedTicket.ticket_number}</h2>
              <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">المستخدم</p>
                      <p className="text-sm font-medium">{selectedTicket.profile?.full_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">رقم الهاتف</p>
                      <p className="text-sm font-medium">{selectedTicket.profile?.primary_phone}</p>
                    </div>
                  </div>
                  {selectedTicket.order ? (
                    <div className="flex items-center gap-3">
                      <Hash className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">رقم الطلب المرتبط</p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-emerald-600">#{selectedTicket.order.order_number}</p>
                          <Link 
                            to={`/orders?orderId=${selectedTicket.order_id}`}
                            className="text-xs bg-emerald-600 text-white px-3 py-1 rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            فتح تفاصيل الطلب
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <div className="flex items-center gap-3 mb-3">
                        <Hash className="w-5 h-5 text-amber-600" />
                        <p className="text-sm font-bold text-amber-900">ربط بطلب</p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="رقم الطلب..."
                          className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          id="link-order-input"
                        />
                        <button
                          onClick={async () => {
                            const input = document.getElementById('link-order-input') as HTMLInputElement;
                            const orderNumber = parseInt(input.value);
                            if (!orderNumber) return toast.error('يرجى إدخال رقم طلب صحيح');
                            
                            try {
                              const { data: order } = await supabase
                                .from('master_orders')
                                .select('id')
                                .eq('order_number', orderNumber)
                                .single();
                              
                              if (!order) return toast.error('الطلب غير موجود');
                              
                              const { error } = await supabase
                                .from('support_tickets')
                                .update({ order_id: order.id })
                                .eq('id', selectedTicket.id);
                              
                              if (error) throw error;
                              toast.success('تم ربط الطلب بنجاح');
                              queryClient.invalidateQueries({ queryKey: ['support_tickets'] }).catch(console.error);
                              setSelectedTicket(prev => prev ? { ...prev, order_id: order.id, order: { order_number: orderNumber } as any } : null);
                            } catch (err: any) {
                              toast.error('خطأ في ربط الطلب: ' + err.message);
                            }
                          }}
                          className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors"
                        >
                          ربط
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">تاريخ الإنشاء</p>
                      <p className="text-sm font-medium">
                        {format(new Date(selectedTicket.created_at), 'PPPPp', { locale: ar })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">الأولوية</p>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        selectedTicket.priority === 'High' ? 'bg-red-100 text-red-800' :
                        selectedTicket.priority === 'Medium' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-blue-100 text-blue-800'
                      )}>
                        {selectedTicket.priority === 'High' ? 'عالية' : selectedTicket.priority === 'Medium' ? 'متوسطة' : 'منخفضة'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 mb-2">الموضوع</p>
                <p className="text-sm font-bold text-gray-900 mb-4">{selectedTicket.subject}</p>
                <p className="text-xs text-gray-500 mb-2">الوصف</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedTicket.description || 'لا يوجد وصف'}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">الإجراءات:</p>
                  <div className="flex items-center gap-2">
                    {selectedTicket.chat_room_id && (
                      <Link
                        to={`/support/chats?roomId=${selectedTicket.chat_room_id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        فتح المحادثة
                      </Link>
                    )}
                    {selectedTicket.user_id && (
                      <button
                        onClick={() => {
                          setPenaltyTarget({
                            id: selectedTicket.user_id!,
                            name: selectedTicket.profile?.full_name || '',
                            reason: `بناءً على تذكرة الدعم رقم #${selectedTicket.ticket_number}`
                          });
                          setIsPenaltyModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        إصدار جزاء
                      </button>
                    )}
                    {selectedTicket.dispute && selectedTicket.dispute.length > 0 ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium">
                        <Scale className="w-4 h-4" />
                        محولة لنزاع
                      </div>
                    ) : (
                      <button
                        onClick={() => escalateToDisputeMutation.mutate(selectedTicket)}
                        disabled={escalateToDisputeMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
                      >
                        <Scale className="w-4 h-4" />
                        تحويل إلى نزاع
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm font-medium text-gray-700">تحديث الحالة:</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Open', 'In_Progress', 'Resolved', 'Closed'].map((status) => (
                    <button
                      key={status}
                      onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status })}
                      disabled={updateStatusMutation.isPending || selectedTicket.status === status}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        selectedTicket.status === status
                          ? "bg-emerald-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {status === 'Open' ? 'مفتوح' : 
                       status === 'In_Progress' ? 'قيد المعالجة' : 
                       status === 'Resolved' ? 'تم الحل' : 'مغلق'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
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
