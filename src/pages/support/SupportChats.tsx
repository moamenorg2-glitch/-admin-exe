
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { 
  MessageSquare, 
  Search, 
  Clock, 
  User, 
  Loader2, 
  AlertCircle
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
          master_orders:order_id (order_number),
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
      case 'Order_Chat': return 'محادثة طلب (عميل/سائق)';
      case 'Support_Chat': return 'محادثة دعم فني';
      default: return type;
    }
  };

  if (error) {
    return (
      <div id="error-state" className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">خطأ في تحميل المحادثات</h3>
        <p className="text-gray-500">{(error as any).message}</p>
      </div>
    );
  }

  return (
    <div id="support-chats-page" className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">محادثات الدعم</h1>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sidebar: Chat List */}
        <div id="chat-sidebar" className={`flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${selectedRoomId ? 'hidden md:flex md:w-1/3' : 'flex w-full md:w-1/3'}`}>
          {/* Filters */}
          <div className="p-4 border-b border-gray-100 space-y-4 bg-gray-50/30">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="search-order-input"
                type="text"
                placeholder="بحث برقم الطلب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {(['All', 'Active', 'Inactive'] as const).map((filter) => (
                  <button
                    id={`filter-${filter.toLowerCase()}-btn`}
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      activeFilter === filter
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
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
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      typeFilter === type
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    {type === 'All' ? 'جميع الأنواع' : type === 'Support_Chat' ? 'الدعم الفني' : 'المندوبين'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          <div id="chat-rooms-list" className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : data?.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>لا توجد محادثات تطابق البحث</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data?.map((room) => (
                  <button
                    id={`room-${room.id}-btn`}
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors text-right border-r-4 ${
                      selectedRoomId === room.id ? 'bg-primary/5 border-primary' : 'border-transparent'
                    }`}
                  >
                    <div className="p-2 bg-gray-100 rounded-full shrink-0">
                      <User className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-gray-900 text-sm truncate">
                          {getRoomTypeLabel(room.room_type)}
                        </span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">
                          {format(new Date(room.updated_at), 'HH:mm', { locale: ar })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>طلب #{room.master_orders?.order_number || '---'}</span>
                        </div>
                        {room.is_active && (
                          <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
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
        <div id="chat-main-content" className={`flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${!selectedRoomId ? 'hidden md:flex items-center justify-center bg-gray-50/50' : 'flex'}`}>
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
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center p-8"
              >
                <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-10 h-10 text-primary/30" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">اختر محادثة للبدء</h3>
                <p className="text-gray-500 text-sm">يمكنك متابعة المحادثات النشطة وحل مشاكل المستخدمين</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

