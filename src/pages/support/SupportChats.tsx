
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { 
  MessageSquare, 
  Search, 
  Clock, 
  User, 
  Loader2, 
  AlertCircle,
  Hash
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ChatWindow from '../../components/support/ChatWindow';

export default function SupportChats() {
  const [searchParams] = useSearchParams();
  const initialRoomId = searchParams.get('roomId');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Support_Chat' | 'Order_Chat'>('All');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoomId);

  useEffect(() => {
    if (initialRoomId) {
      setSelectedRoomId(initialRoomId);
    }
  }, [initialRoomId]);

  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('support-chats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
        queryClient.invalidateQueries({ queryKey: ['support-chats'] }).catch(console.error);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(err => {
        console.error('Error removing chats channel:', err);
      });
    };
  }, [queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['support-chats', searchQuery, activeFilter, typeFilter],
    queryFn: async () => {
      let query = (supabase
        .from('chat_rooms' as any) as any)
        .select(`
          id, order_id, room_type, participant_ids, is_active, created_at, updated_at,
          master_orders:order_id (
            order_number,
            customer:profiles!master_orders_customer_id_fkey(full_name, avatar_url)
          ),
          support_tickets (id, ticket_number, order_id)
        `)
        .order('updated_at', { ascending: false });

      if (activeFilter === 'Active') {
        query = query.eq('is_active', true);
      } else if (activeFilter === 'Inactive') {
        query = query.eq('is_active', false);
      }

      if (typeFilter !== 'All') {
        query = query.eq('room_type', typeFilter);
      }

      const { data: rooms, error } = await query;
      if (error) throw error;

      // Filter by search query (order number)
      let filteredRooms = rooms as any[];
      
      if (searchQuery) {
        filteredRooms = filteredRooms.filter(room => {
          const orderNum = room.master_orders?.order_number?.toString() || '';
          const ticketNum = room.support_tickets?.[0]?.ticket_number?.toString() || '';
          return orderNum.includes(searchQuery) || ticketNum.includes(searchQuery);
        });
      }

      return filteredRooms;
    }
  });

  const getRoomTypeLabel = (type: string) => {
    switch (type) {
      case 'Order_Chat': return 'محادثة طلب (سائق/عميل)';
      case 'Support_Chat': return 'محادثة دعم فني';
      default: return type;
    }
  };

  if (error) {
    return (
      <div id="error-state" className="p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-black text-gray-900 mb-2">تعذر تحميل المحادثات</h3>
        <p className="text-gray-500 font-medium">{(error as any).message}</p>
      </div>
    );
  }

  return (
    <div id="support-chats-page" className="h-[calc(100vh-120px)] flex flex-col animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">محادثات الدعم</h2>
          <p className="text-gray-500 mt-1">تتبع المحادثات المباشرة بين المستخدمين والدعم أو السائقين</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* Sidebar: Chat List */}
        <div id="chat-sidebar" className={`flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden ${selectedRoomId ? 'hidden md:flex md:w-[350px] lg:w-[400px]' : 'flex w-full md:w-[350px] lg:w-[400px] shrink-0'}`}>
          {/* Filters */}
          <div className="p-5 border-b border-gray-100 space-y-4 bg-gray-50">
            <div className="relative">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="search-order-input"
                type="text"
                placeholder="بحث برقم الطلب أو التذكرة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-sm transition-all"
              />
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                {(['All', 'Active', 'Inactive'] as const).map((filter) => (
                  <button
                    id={`filter-${filter.toLowerCase()}-btn`}
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                      activeFilter === filter
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {filter === 'All' ? 'الكل' : filter === 'Active' ? 'نشط' : 'مغلق'}
                  </button>
                ))}
              </div>
              
              <div className="flex gap-2">
                {(['All', 'Support_Chat', 'Order_Chat'] as const).map((type) => (
                  <button
                    id={`type-filter-${type.toLowerCase()}-btn`}
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all border ${
                      typeFilter === type
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {type === 'All' ? 'جميع الأنواع' : type === 'Support_Chat' ? 'الدعم الفني' : 'الطلبات'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          <div id="chat-rooms-list" className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-sm font-medium text-gray-500">جاري التحميل...</p>
              </div>
            ) : data?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                   <MessageSquare className="w-8 h-8 text-gray-300" />
                </div>
                <p className="font-bold">لا توجد محادثات</p>
                <p className="text-sm text-gray-400 mt-1">جرب تغيير عوامل التصفية أو البحث</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data?.map((room) => (
                  <button
                    id={`room-${room.id}-btn`}
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`w-full p-5 flex items-start gap-4 transition-all text-right border-r-4 ${
                      selectedRoomId === room.id 
                        ? 'bg-emerald-50 border-emerald-500' 
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200 shadow-sm shrink-0 relative">
                      {room.master_orders?.customer?.avatar_url ? (
                        <img 
                          src={room.master_orders.customer.avatar_url} 
                          alt="" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-6 h-6 text-gray-400" />
                      )}
                      {room.is_active && (
                        <span className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white absolute bottom-0 right-0 shadow-sm" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="font-bold text-gray-900 text-sm truncate pr-2">
                          {room.master_orders?.customer?.full_name || getRoomTypeLabel(room.room_type)}
                        </span>
                        <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap bg-gray-50 px-1.5 py-0.5 rounded">
                          {format(new Date(room.updated_at), 'aa hh:mm', { locale: ar })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {room.master_orders?.order_number && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                            <Hash className="w-3 h-3" />
                            <span>{room.master_orders.order_number}</span>
                          </div>
                        )}
                        {room.support_tickets?.[0]?.ticket_number && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <MessageSquare className="w-3 h-3" />
                            <span>{room.support_tickets[0].ticket_number}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content: Chat Window */}
        <div id="chat-main-content" className={`flex-1 flex flex-col bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden ${!selectedRoomId ? 'hidden md:flex items-center justify-center bg-gray-50' : 'flex'}`}>
          <AnimatePresence mode="wait">
            {selectedRoomId ? (
              <ChatWindow 
                key={selectedRoomId}
                roomId={selectedRoomId} 
                onClose={() => setSelectedRoomId(null)} 
                orderNumber={data?.find(r => r.id === selectedRoomId)?.master_orders?.order_number?.toString()}
                orderId={data?.find(r => r.id === selectedRoomId)?.order_id || data?.find(r => r.id === selectedRoomId)?.support_tickets?.[0]?.order_id}
                isActive={data?.find(r => r.id === selectedRoomId)?.is_active}
                ticketId={data?.find(r => r.id === selectedRoomId)?.support_tickets?.[0]?.id}
              />
            ) : (
              <motion.div 
                id="empty-chat-state"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center p-8 max-w-sm mx-auto"
              >
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-50 to-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-white">
                  <MessageSquare className="w-10 h-10 text-emerald-500 drop-shadow-sm" />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-2">مساحة المحادثات المباشرة</h3>
                <p className="text-gray-500 text-sm leading-relaxed">اختر محادثة من القائمة الجانبية لعرض التفاصيل، متابعة الشكوى وتوجيه الرسائل للمستخدم أو السائق.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

