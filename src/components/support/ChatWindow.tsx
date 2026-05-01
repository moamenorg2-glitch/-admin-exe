
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Send, User, Loader2, X, FileText, Scale } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import ConfirmModal from '../ui/ConfirmModal';

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: string;
  message_content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface ChatWindowProps {
  roomId: string;
  onClose: () => void;
  orderNumber?: string;
  isActive?: boolean;
  ticketId?: string;
  orderId?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ roomId, onClose, orderNumber, isActive = true, ticketId, orderId }) => {
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showConfirmEscalate, setShowConfirmEscalate] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);
      } catch (error) {
        console.error('Error fetching user for chat:', error);
      }
    };
    fetchUser();
  }, []);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat-messages', roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id, room_id, sender_id, message_type, message_content, is_read, created_at,
          sender:profiles!chat_messages_sender_id_fkey(full_name, avatar_url)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as unknown as Message[];
    },
  });

  const handleEscalateToDispute = async () => {
    if (!ticketId && !orderId) {
      toast.error('لا يمكن تحويل هذه المحادثة إلى نزاع لعدم وجود رقم طلب أو تذكرة مرتبطة');
      return;
    }
    setIsEscalating(true);
    try {
      // 1. Check if dispute already exists
      let query = supabase.from('dispute_resolution').select('id');
      if (ticketId) {
        query = query.eq('ticket_id', ticketId);
      } else {
        query = query.eq('order_id', orderId);
      }
      
      const { data: existingDispute } = await query.maybeSingle();

      if (existingDispute) {
        throw new Error('هذه الحالة محولة بالفعل إلى نزاع');
      }

      // 2. Create dispute record
      const { error: disputeError } = await supabase
        .from('dispute_resolution')
        .insert({
          ticket_id: ticketId || null,
          order_id: orderId || null,
          status: 'Under_Review',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (disputeError) throw disputeError;

      // 3. Update ticket status if exists
      if (ticketId) {
        const { error: ticketError } = await supabase
          .from('support_tickets')
          .update({ status: 'In_Progress' })
          .eq('id', ticketId);

        if (ticketError) throw ticketError;
      }

      toast.success('تم التحويل إلى قسم فض النزاعات بنجاح');
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['disputes'] }).catch(console.error);
      setShowConfirmEscalate(false);
    } catch (error: any) {
      toast.error('خطأ في التحويل: ' + error.message);
    } finally {
      setIsEscalating(false);
    }
  };

  const handleCloseChat = async () => {
    setIsClosing(true);
    try {
      const { error } = await supabase
        .from('chat_rooms')
        .update({ is_active: false })
        .eq('id', roomId);

      if (error) throw error;
      toast.success('تم إغلاق المحادثة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['support-chats'] }).catch(console.error);
      setShowConfirmClose(false);
      onClose();
    } catch (error: any) {
      toast.error('خطأ في إغلاق المحادثة: ' + error.message);
    } finally {
      setIsClosing(false);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', roomId] }).catch(console.error);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(err => {
        console.error('Error removing chat channel:', err);
      });
    };
  }, [roomId, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending || !currentUserId) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        room_id: roomId,
        sender_id: currentUserId,
        message_content: newMessage.trim(),
        message_type: 'Text',
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error: any) {
      toast.error('خطأ في إرسال الرسالة: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const otherParticipant = messages.find(m => m.sender_id !== currentUserId)?.sender;

  return (
    <motion.div 
      id="chat-window-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200"
    >
      {/* Header */}
      <div id="chat-header" className="p-4 bg-primary text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FFFFFF80] flex items-center justify-center overflow-hidden">
            {otherParticipant?.avatar_url ? (
              <img 
                src={otherParticipant.avatar_url} 
                alt="" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-lg">
              {otherParticipant?.full_name ? `محادثة مع ${otherParticipant.full_name}` : 'محادثة الدعم'} 
              {orderNumber && ` (طلب #${orderNumber})`}
            </h3>
            <p className="text-xs text-gray-200">{isActive ? 'نشط الآن' : 'مغلق'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(ticketId || orderId) && (
            <div className="flex items-center gap-2">
              {ticketId && (
                <Link
                  to={`/support?ticketId=${ticketId}`}
                  className="flex items-center gap-1 px-3 py-1 bg-[#FFFFFF80] hover:bg-[#FFFFFF80] text-white text-xs font-bold rounded-lg border border-white/20 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  التذكرة
                </Link>
              )}
              <button
                onClick={() => setShowConfirmEscalate(true)}
                className="flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-500 text-white text-xs font-bold rounded-lg border border-white/20 transition-colors"
                title="تحويل إلى نزاع"
              >
                <Scale className="w-4 h-4" />
                تحويل لنزاع
              </button>
            </div>
          )}
          {isActive && (
            <button 
              onClick={() => setShowConfirmClose(true)}
              disabled={isClosing}
              className="px-3 py-1 bg-red-500 hover:bg-red-500 text-white text-xs font-bold rounded-lg border border-white/20 transition-colors"
            >
              {isClosing ? 'جاري الإغلاق...' : 'إغلاق المحادثة'}
            </button>
          )}
          <button 
            id="close-chat-btn"
            onClick={onClose}
            className="p-2 hover:bg-[#FFFFFF80] rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div id="chat-messages-viewport" className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <User className="w-12 h-12 mb-2 opacity-20" />
            <p>لا توجد رسائل بعد</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
                      {msg.sender?.avatar_url ? (
                        <img 
                          src={msg.sender.avatar_url} 
                          alt="" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm ${
                      isMe
                        ? 'bg-primary text-white rounded-tr-none'
                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                    }`}
                  >
                    {!isMe && (
                      <p className="text-[10px] font-bold mb-1 opacity-70">
                        {msg.sender?.full_name || 'مستخدم'}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{msg.message_content}</p>
                    <p
                      className={`text-[10px] mt-1 text-right ${
                        isMe ? 'text-gray-200' : 'text-gray-400'
                      }`}
                    >
                      {format(new Date(msg.created_at), 'HH:mm', { locale: ar })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form id="chat-input-form" onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <input
            id="chat-message-input"
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="اكتب رسالتك هنا..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            disabled={isSending}
          />
          <button
            id="send-message-btn"
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="p-2 bg-primary text-white rounded-full hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5 -rotate-45" />
            )}
          </button>
        </div>
      </form>

      <ConfirmModal
        isOpen={showConfirmEscalate}
        onClose={() => setShowConfirmEscalate(false)}
        onConfirm={handleEscalateToDispute}
        title="تحويل إلى نزاع"
        message="هل أنت متأكد من رغبتك في تحويل هذه التذكرة إلى قسم فض النزاعات؟ سيتمكن المحكمون من مراجعة الحالة واتخاذ قرار مالي."
        type="warning"
        confirmText="تحويل الآن"
        isLoading={isEscalating}
      />

      <ConfirmModal
        isOpen={showConfirmClose}
        onClose={() => setShowConfirmClose(false)}
        onConfirm={handleCloseChat}
        title="إغلاق المحادثة"
        message="هل أنت متأكد من رغبتك في إغلاق هذه المحادثة؟ لن يتمكن العميل من إرسال رسائل جديدة في هذه الغرفة."
        type="warning"
        confirmText="إغلاق المحادثة"
        isLoading={isClosing}
      />
    </motion.div>
  );
};

export default ChatWindow;
