import * as React from 'react';
import { 
  Bot, 
  Send, 
  X, 
  Minimize2, 
  Maximize2, 
  Sparkles,
  MessageSquare,
  Loader2,
  Database
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { askGemini } from '../../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export default function ReportsAIAssistant() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hasOpened, setHasOpened] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [isFullScreen, setIsFullScreen] = React.useState(true);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<Message[]>([
    {
      role: 'ai',
      content: 'مرحباً بك! أنا مساعدك الذكي في زاجل إكسبريس. كيف يمكنني مساعدتك في تحليل التقارير اليوم؟',
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    if (isOpen && !hasOpened) {
      setHasOpened(true);
    }
  }, [isOpen, hasOpened]);

  React.useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  // Function to gather context for the AI
  const getSystemContext = async () => {
    try {
      // Initialize an object to hold our comprehensive context
      const contextData: any = { timestamp: new Date().toISOString() };

      // 1. Orders Data
      try {
        const { data: ordersStatus } = await (supabase as any).from('master_orders').select('status');
        if (ordersStatus) {
          contextData.orders = {
            total: ordersStatus.length,
            pending: ordersStatus.filter((o: any) => o.status === 'Pending').length,
            active: ordersStatus.filter((o: any) => o.status === 'Active').length,
            delivered: ordersStatus.filter((o: any) => o.status === 'Completed').length,
            cancelled: ordersStatus.filter((o: any) => o.status === 'Cancelled' || o.status === 'Rejected').length,
          };
        }
      } catch (e) {
        console.warn("AI Context: Failed to fetch orders", e);
      }

      // 2. Users (Drivers, Customers, Vendors)
      try {
        const { data: profiles } = await (supabase as any).from('profiles').select('user_type, is_verified');
        if (profiles) {
          contextData.users = {
            total: profiles.length,
            drivers: profiles.filter((p: any) => p.user_type === 'driver').length,
            customers: profiles.filter((p: any) => p.user_type === 'customer').length,
            vendors: profiles.filter((p: any) => p.user_type === 'vendor').length,
            admins: profiles.filter((p: any) => p.user_type === 'admin').length,
            verified: profiles.filter((p: any) => p.is_verified).length,
          };
        }
      } catch (e) {
        console.warn("AI Context: Failed to fetch profiles", e);
      }

      // 3. Transactions / Finances (Summary)
      try {
        const { data: transactions } = await (supabase as any).from('wallets_transaction').select('transaction_type, amount');
        if (transactions) {
          contextData.finances = {
            total_transactions: transactions.length,
            total_deposits: transactions.filter((t: any) => t.transaction_type === 'Deposit').reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
            total_withdrawals: transactions.filter((t: any) => t.transaction_type === 'Withdrawal').reduce((sum: number, t: any) => sum + (t.amount || 0), 0),
          };
        }
      } catch (e) {
        console.warn("AI Context: Failed to fetch transactions", e);
      }

      // 4. Disputes & Support
      try {
        const { data: disputes } = await (supabase as any).from('dispute_resolution').select('status');
        if (disputes) {
          contextData.disputes = {
            total: disputes.length,
            open: disputes.filter((d: any) => d.status === 'open').length,
            resolved: disputes.filter((d: any) => d.status === 'resolved').length,
          };
        }
      } catch (e) {
        console.warn("AI Context: Failed to fetch disputes", e);
      }
      
      // 5. Recent Activity (Last 5 Orders)
      try {
        const { data: recentOrders } = await (supabase as any).from('master_orders')
          .select('order_number, status, grand_total, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (recentOrders) {
          contextData.recent_orders = recentOrders;
        }
      } catch (e) {
        console.warn("AI Context: Failed to fetch recent orders", e);
      }

      return contextData;
    } catch (error) {
      console.warn("Failed to gather system context:", error);
      return {};
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const context = await getSystemContext();
      const response = await askGemini(userMessage, context);
      setMessages(prev => [...prev, { role: 'ai', content: response, timestamp: new Date() }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'ai', content: error.message || 'حدث خطأ غير متوقع.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-8 left-8 z-[100] w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center transition-all",
          isOpen && "scale-0 opacity-0 pointer-events-none"
        )}
      >
        <Bot className="w-8 h-8" />
        <div className={cn(
          "absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white",
          !hasOpened && "animate-pulse",
          hasOpened ? "bg-green-500" : "bg-red-500"
        )} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.8 }}
            animate={{ 
              y: 0, 
              opacity: 1, 
              scale: 1,
              width: isFullScreen ? '100vw' : '400px',
              height: isFullScreen ? '100vh' : (isMinimized ? '80px' : '600px'),
              left: isFullScreen ? '0' : '2rem',
              bottom: isFullScreen ? '0' : '2rem'
            }}
            exit={{ y: 100, opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className={cn(
              "fixed z-[100] bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden transition-colors",
              isFullScreen ? "rounded-none max-w-full" : "rounded-3xl border border-gray-100 dark:border-slate-800 max-w-[calc(100vw-4rem)]"
            )}
            dir="rtl"
          >
            {/* Header */}
            <div className="bg-blue-600 p-4 flex items-center justify-between text-white shadow-lg shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FFFFFF80] rounded-xl">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-sm">المساعد الشخصي الذكي</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[11px] font-bold text-blue-100 uppercase tracking-tighter">متصل الآن</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-2 hover:bg-[#FFFFFF80] rounded-lg transition-colors hidden md:block"
                  title={isFullScreen ? "تصغير" : "ملء الشاشة"}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    if (isFullScreen) setIsFullScreen(false);
                    setIsMinimized(!isMinimized);
                  }}
                  className="p-2 hover:bg-[#FFFFFF80] rounded-lg transition-colors"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-[#FFFFFF80] rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content (only if not minimized) */}
            {!isMinimized && (
              <>
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900 transition-colors">
                  {messages.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        "flex flex-col animate-in slide-in-from-bottom-2 duration-300",
                        msg.role === 'user' ? "mr-auto items-end max-w-[85%]" : "w-[96%] mx-auto"
                      )}
                    >
                      <div className={cn(
                        "p-4 rounded-2xl text-sm leading-relaxed shadow-sm prose prose-sm max-w-none prose-p:leading-relaxed prose-table:w-full prose-table:min-w-full prose-img:rounded-xl overflow-x-auto prose-th:text-right prose-td:text-right prose-table:text-right text-right transition-colors w-full [&_td]:text-right [&_th]:text-right [&_td]:dir-rtl [&_th]:dir-rtl",
                        msg.role === 'user' 
                          ? "bg-blue-600 text-white rounded-tl-none prose-headings:text-white prose-p:text-white prose-strong:text-white prose-ul:text-white prose-ol:text-white prose-li:text-white prose-a:text-white" 
                          : "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-slate-700 prose-neutral dark:prose-invert overflow-hidden"
                      )}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      <span className="text-[11px] text-gray-400 mt-1 font-medium px-2">
                        {msg.timestamp.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 animate-pulse bg-blue-50 dark:bg-blue-900 w-fit p-3 rounded-2xl transition-colors">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-bold">جاري التفكير وتحليل البيانات...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="اطلب تقريراً أو اسأل عن الأداء..."
                        className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
                      />
                      <Database className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={isLoading || !input.trim()}
                      className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100 dark:shadow-none"
                    >
                      <Send className="w-5 h-5 rotate-180" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>مدعوم بتقنية الذكاء الاصطناعي لإدارة زاجل</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
