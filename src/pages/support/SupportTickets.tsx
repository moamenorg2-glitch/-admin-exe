import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, MessageSquare, Clock, CheckCircle, AlertCircle, X, User, Phone, Hash, Calendar, Scale, ShieldAlert, BarChart3, TrendingUp, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';
import PenaltyFormModal from '../../components/penalties/PenaltyFormModal';
import { motion, AnimatePresence } from 'framer-motion';

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
    avatar_url: string | null;
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
          profile:profiles!support_tickets_user_id_fkey(full_name, primary_phone, avatar_url),
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

  const { data: allTicketsForStats } = useQuery({
    queryKey: ['support_tickets_stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('support_tickets').select('status, priority');
      if (error) throw error;
      return data;
    }
  });

  const stats = useMemo(() => {
    if (!allTicketsForStats) return null;
    const total = allTicketsForStats.length;
    const open = allTicketsForStats.filter(t => t.status === 'Open').length;
    const inProgress = allTicketsForStats.filter(t => t.status === 'In_Progress').length;
    const resolved = allTicketsForStats.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;
    const highPriority = allTicketsForStats.filter(t => t.priority === 'High' && t.status !== 'Closed' && t.status !== 'Resolved').length;

    return { total, open, inProgress, resolved, highPriority };
  }, [allTicketsForStats]);

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
        queryClient.invalidateQueries({ queryKey: ['support_tickets_stats'] }).catch(console.error);
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
      queryClient.invalidateQueries({ queryKey: ['support_tickets_stats'] }).catch(console.error);
      toast.success('تم تحديث حالة التذكرة بنجاح');
      setSelectedTicket(null);
    },
    onError: (error: any) => {
      toast.error('خطأ في تحديث الحالة: ' + error.message);
    }
  });

  const escalateToDisputeMutation = useMutation({
    mutationFn: async (ticket: SupportTicket) => {
      const { data: existingDispute } = await supabase
        .from('dispute_resolution')
        .select('id')
        .eq('ticket_id', ticket.id)
        .single();

      if (existingDispute) {
        throw new Error('هذه التذكرة محولة بالفعل إلى نزاع');
      }

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
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">مفتوح</span>;
      case 'In_Progress':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">قيد المعالجة</span>;
      case 'Resolved':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">تم الحل</span>;
      case 'Closed':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200">مغلق</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">الدعم الفني والشكاوى</h2>
          <p className="text-gray-500 mt-1">إدارة تذاكر الدعم والشكاوى المقدمة من المستخدمين</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <MessageSquare className="w-24 h-24" />
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <HelpCircle className="w-6 h-6 z-10" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">إجمالي التذاكر</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-gray-900">{stats.total}</h3>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Clock className="w-24 h-24 text-amber-500" />
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shadow-sm">
                <Clock className="w-6 h-6 z-10" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">معلقة وقيد المعالجة</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-gray-900">{stats.open + stats.inProgress}</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <AlertCircle className="w-24 h-24 text-red-500" />
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shadow-sm">
                <AlertCircle className="w-6 h-6 z-10" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">عالية الأهمية (نشطة)</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-gray-900">{stats.highPriority}</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <CheckCircle className="w-24 h-24 text-emerald-500" />
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                <CheckCircle className="w-6 h-6 z-10" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">تم الحل</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-gray-900">{stats.resolved}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm overflow-hidden sm:rounded-2xl border border-gray-100">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="بحث برقم التذكرة أو الطلب..."
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-3 pr-10 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-medium transition-shadow placeholder-gray-400"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex-shrink-0 bg-white border border-gray-200 rounded-xl flex items-center px-3 py-2.5">
              <Filter className="w-4 h-4 text-gray-400 ml-2" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 p-0 cursor-pointer"
              >
                <option value="All">جميع الحالات</option>
                <option value="Open">مفتوح</option>
                <option value="In_Progress">قيد المعالجة</option>
                <option value="Resolved">تم الحل</option>
                <option value="Closed">مغلق</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100 text-right">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">التذكرة</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المستخدم</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ارتباط</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الأهمية</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الحالة</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الوقت</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500 font-medium">جاري التحميل...</td></tr>
              ) : data?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium text-lg">لا يوجد تذاكر دعم تطابق البحث</p>
                  </td>
                </tr>
              ) : (
                data?.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 group transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-900">#{ticket.ticket_number}</span>
                        <span className="text-xs text-gray-500 font-medium truncate max-w-[150px]" title={ticket.subject}>{ticket.subject}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
                          {ticket.profile?.avatar_url ? (
                            <img 
                              src={ticket.profile.avatar_url} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{ticket.profile?.full_name}</div>
                          <div className="text-xs font-medium text-gray-500" dir="ltr">{ticket.profile?.primary_phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {ticket.order ? (
                        <Link 
                          to={`/orders?orderId=${ticket.order_id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-100"
                        >
                          <Hash className="w-3.5 h-3.5" />
                          طلب #{ticket.order.order_number}
                        </Link>
                      ) : (
                        <span className="text-xs font-bold text-gray-400 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">---</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-extrabold shadow-sm border",
                        ticket.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' :
                        ticket.priority === 'Medium' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      )}>
                        {ticket.priority === 'High' ? 'عالية' : ticket.priority === 'Medium' ? 'متوسطة' : 'منخفضة'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(ticket.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                      {format(new Date(ticket.created_at), 'dd MMM, HH:mm', { locale: ar })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setSelectedTicket(ticket)}
                          className="p-2 text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-gray-900 rounded-lg transition-colors tooltip-trigger"
                          title="عرض التفاصيل"
                        >
                          <Search className="w-4 h-4" />
                        </button>
                        {ticket.chat_room_id && (
                          <Link
                            to={`/support/chats?roomId=${ticket.chat_room_id}`}
                            className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-900 rounded-lg transition-colors tooltip-trigger"
                            title="المحادثة"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedTicket && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#000000B3] "
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden text-right flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-gray-700" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                      تذكرة #{selectedTicket.ticket_number}
                      {getStatusBadge(selectedTicket.status)}
                    </h2>
                    <p className="text-sm font-medium text-gray-500">{format(new Date(selectedTicket.created_at), 'PPPPp', { locale: ar })}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTicket(null)} 
                  className="p-2 bg-white hover:bg-gray-100 text-gray-500 rounded-xl transition-colors border border-gray-200 shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-8 flex-1">
                {/* User Info & Quick Details Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 grid grid-cols-1 md:grid-cols-2 gap-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full -mr-10 -mt-10 blur-3xl pointer-events-none"></div>
                  
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-md shrink-0">
                        {selectedTicket.profile?.avatar_url ? (
                          <img 
                            src={selectedTicket.profile.avatar_url} 
                            alt="" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">المستخدم المطالب</p>
                        <p className="text-base font-black text-gray-900">{selectedTicket.profile?.full_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 w-max">
                      <Phone className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-bold tracking-wider" dir="ltr">{selectedTicket.profile?.primary_phone}</span>
                    </div>
                  </div>

                  <div className="space-y-4 relative z-10 border-t md:border-t-0 md:border-r border-gray-100 md:pr-6 pt-4 md:pt-0">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">الأولوية</p>
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-extrabold shadow-sm border inline-flex items-center gap-2",
                        selectedTicket.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' :
                        selectedTicket.priority === 'Medium' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      )}>
                        {selectedTicket.priority === 'High' && <AlertCircle className="w-4 h-4" />}
                        {selectedTicket.priority === 'High' ? 'عالية (تدخل سريع)' : selectedTicket.priority === 'Medium' ? 'متوسطة' : 'منخفضة'}
                      </span>
                    </div>
                    
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ارتباط بطلب</p>
                      {selectedTicket.order ? (
                        <div className="flex items-center gap-3">
                          <Link 
                            to={`/orders?orderId=${selectedTicket.order_id}`}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm"
                          >
                            <Hash className="w-4 h-4" />
                            طلب #{selectedTicket.order.order_number}
                          </Link>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="رقم الطلب للربط..."
                            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium shadow-sm transition-all"
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
                            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors shadow-sm"
                          >
                            ربط
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Complaint Details */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-inner">
                  <h3 className="text-sm font-black text-gray-900 mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block"></span>
                    موضوع الشكوى:
                  </h3>
                  <p className="text-lg font-bold text-gray-800 mb-6">{selectedTicket.subject}</p>
                  
                  <h3 className="text-sm font-black text-gray-900 mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full inline-block"></span>
                    الوصف التفصيلي:
                  </h3>
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-700 leading-loose whitespace-pre-wrap font-medium">
                      {selectedTicket.description || 'لا يوجد وصف مضاف.'}
                    </p>
                  </div>
                </div>

                {/* Action Board */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                  {/* Status Update section */}
                  <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-600" />
                      تحديث حالة التذكرة
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {['Open', 'In_Progress', 'Resolved', 'Closed'].map((status) => (
                        <button
                          key={status}
                          onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status })}
                          disabled={updateStatusMutation.isPending || selectedTicket.status === status}
                          className={cn(
                            "px-4 py-2.5 rounded-xl text-sm font-bold transition-all border",
                            selectedTicket.status === status
                              ? "bg-gray-900 text-white border-gray-900 shadow-md ring-2 ring-gray-900 ring-offset-1"
                              : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 outline-none"
                          )}
                        >
                          {status === 'Open' ? 'فتح' : 
                          status === 'In_Progress' ? 'قيد المعالجة' : 
                          status === 'Resolved' ? 'حل' : 'إغلاق'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Administrative Actions */}
                  <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-rose-600" />
                      إجراءات إدارية
                    </h3>
                    <div className="space-y-3">
                      {selectedTicket.chat_room_id ? (
                        <Link
                          to={`/support/chats?roomId=${selectedTicket.chat_room_id}`}
                          className="flex items-center justify-between w-full p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-colors font-bold text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <MessageSquare className="w-5 h-5" />
                            متابعة المحادثة
                          </div>
                          <span className="text-indigo-400">&larr;</span>
                        </Link>
                      ) : (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-400 text-center">
                          لا توجد محادثة مرتبطة
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            if (selectedTicket.user_id) {
                              setPenaltyTarget({
                                id: selectedTicket.user_id,
                                name: selectedTicket.profile?.full_name || '',
                                reason: `بناءً على تذكرة الدعم رقم #${selectedTicket.ticket_number}`
                              });
                              setIsPenaltyModalOpen(true);
                            }
                          }}
                          disabled={!selectedTicket.user_id}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 rounded-xl transition-all font-bold text-sm disabled:opacity-50"
                        >
                          <ShieldAlert className="w-4 h-4" />
                          إصدار جزاء
                        </button>

                        {selectedTicket.dispute && selectedTicket.dispute.length > 0 ? (
                          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 text-slate-500 border border-slate-200 rounded-xl font-bold text-sm cursor-not-allowed">
                            <Scale className="w-4 h-4" />
                            محولة مسبقاً
                          </div>
                        ) : (
                          <button
                            onClick={() => escalateToDisputeMutation.mutate(selectedTicket)}
                            disabled={escalateToDisputeMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-amber-50 text-amber-600 border border-amber-200 hover:border-amber-300 rounded-xl transition-all font-bold text-sm disabled:opacity-50"
                          >
                            <Scale className="w-4 h-4" />
                            تحويل لنزاع
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

