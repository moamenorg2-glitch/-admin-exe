import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { X, MapPin, Phone, User, Clock, CheckCircle, AlertCircle, Motorbike, Truck, Heart, Calculator, Banknote, UserPlus, Star, Scale, Plus, Minus, Trash2, CreditCard, ReceiptText, Printer, History, Zap, Edit2, ShoppingBag, Store, ChevronDown, Quote, Tag, Wallet, Settings2, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

import { getDelayStatus } from '../../utils/orderUtils';
import AssignDriverModal from './AssignDriverModal';
import AddProductModal from './AddProductModal';
import { EditModifiersModal } from './EditModifiersModal';
import PromptModal from '../ui/PromptModal';
import ChatWindow from '../support/ChatWindow';
import { orderService } from '../../services/orderService';
import { handleGlobalError } from '../../utils/errorHandler';
import { supabase } from '../../lib/supabase';
import ConfirmModal from '../ui/ConfirmModal';

interface OrderDetailsPanelProps {
  orderId: string | null;
  onClose: () => void;
  prepThreshold: number;
  deliveryThreshold: number;
}

const statusNames: Record<string, string> = {
  Pending: 'قيد الانتظار',
  Active: 'نشط (جاري التحضير)',
  OnTheWay: 'في الطريق',
  Completed: 'مكتمل',
  Cancelled: 'ملغي',
  Rejected: 'مرفوض',
};

export default function OrderDetailsPanel({ orderId, onClose, prepThreshold, deliveryThreshold }: OrderDetailsPanelProps) {
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState<'Pending' | 'Active' | 'OnTheWay' | 'Completed' | 'Cancelled' | 'Rejected' | ''>('');
  const [isAssigningDriver, setIsAssigningDriver] = useState(false);
  const [driverToRemove, setDriverToRemove] = useState<{ teamId: string, driverId: string } | null>(null);
  const [activeChatRoomId, setActiveChatRoomId] = useState<string | null>(null);
  const [addProductModal, setAddProductModal] = useState<{ isOpen: boolean, subOrderId: string, vendorId: string } | null>(null);
  const [editModifiersModal, setEditModifiersModal] = useState<{ isOpen: boolean, itemId: string, productId: string, currentModifiers: any } | null>(null);

  // Prompt Modal State
  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    placeholder?: string;
    type: 'text' | 'number' | 'textarea';
    confirmText: string;
    action: (value: string) => void;
    isConfirmOnly?: boolean;
    initialValue?: string;
  }>({
    isOpen: false,
    title: '',
    type: 'text',
    confirmText: 'تأكيد',
    action: () => {},
  });

  const openPrompt = (config: Omit<typeof promptConfig, 'isOpen'>) => {
    setPromptConfig({ ...config, isOpen: true });
  };

  const closePrompt = () => {
    setPromptConfig(prev => ({ ...prev, isOpen: false }));
  };

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-details', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('master_orders')
          .select(`
            *,
            customer:profiles!master_orders_customer_id_fkey(full_name, primary_phone, avatar_url),
            address:customer_details!master_orders_address_id_fkey(*),
            sub_orders (
              *,
              vendor:vendor_details!sub_orders_vendor_id_fkey(
                brand_name, 
                preparation_time_avg,
                profile:profiles!vendor_details_user_id_fkey(avatar_url)
              ),
              items:order_items(*),
              order_status_history (
                status,
                created_at,
                driver_id
              )
            ),
            delivery_team:order_delivery_team(
              *,
              driver:driver_details!order_delivery_team_driver_id_fkey(
                user:profiles!driver_details_user_id_fkey(full_name, primary_phone, avatar_url),
                active_orders:order_delivery_team(
                  master_order:master_orders!fk_order_delivery_team_master_order(status, id)
                )
              )
            )
          `)
          .eq('id', orderId)
          .single();

        if (error) throw error;
        return data as any;
      } catch (error) {
        handleGlobalError(error, 'Fetch Order Details');
        throw error;
      }
    },
  });

  const assignDriverMutation = useMutation({
    mutationFn: async ({ driverId }: { driverId: string }) => {
      console.log('Assigning driver in OrderDetailsPanel:', { orderId, driverId });
      await orderService.assignDriver(orderId!, driverId);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم تعيين السائق بنجاح');
      setIsAssigningDriver(false);
    },
    onError: (error: any) => {
      console.log('Assign Driver Mutation Error:', { message: error.message, fullError: error });
      if (error.message === 'هذا المندوب معين بالفعل لهذا الطلب' || error.message === 'لا يوجد سائقين متصلين حالياً أو جميع السائقين المتصلين معينين بالفعل لهذا الطلب.') {
        toast(error.message, { icon: '⚠️', style: { background: '#FEF3C7', color: '#92400E', fontWeight: 'bold' } });
      } else {
        handleGlobalError(error, 'Assign Driver');
      }
    }
  });

  const removeDriverMutation = useMutation({
    mutationFn: async ({ teamId, driverId }: { teamId: string; driverId: string }) => {
      await orderService.removeDriver(teamId, driverId);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم إزالة المندوب بنجاح');
      setDriverToRemove(null);
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Remove Driver');
    }
  });

  const updatePrepTimeMutation = useMutation({
    mutationFn: async ({ subOrderId, prepTime }: { subOrderId: string; prepTime: number }) => {
      await orderService.updatePrepTime(subOrderId, prepTime);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      toast.success('تم تحديث وقت التحضير بنجاح');
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Update Prep Time');
    }
  });

  const timeStats = useMemo(() => {
    if (!order) return null;
    const now = new Date();
    const delay = getDelayStatus(order, now, prepThreshold, deliveryThreshold);

    return {
      prepElapsed: delay.prepElapsed,
      deliveryElapsed: delay.deliveryElapsed,
      maxVendorPrep: delay.maxVendorPrep,
      isPrepDelayed: delay.type === 'prep',
      isDeliveryDelayed: delay.type === 'delivery'
    };
  }, [order, prepThreshold, deliveryThreshold]);

  const assignedDriverIds = useMemo(() => {
    if (!order?.delivery_team) return [];
    return order.delivery_team.map((dt: any) => dt.driver_id).filter(Boolean);
  }, [order]);

  useEffect(() => {
    if (order?.status) {
      setNewStatus(order.status);
    }
  }, [order?.status]);

  // Fetch reviews for this order
  const { data: reviews } = useQuery({
    queryKey: ['order-reviews', orderId],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .eq('order_id', orderId);
        if (error) throw error;
        return data;
      } catch (error) {
        handleGlobalError(error, 'Fetch Reviews');
        throw error;
      }
    },
    enabled: !!orderId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: 'Pending' | 'Active' | 'OnTheWay' | 'Completed' | 'Cancelled' | 'Rejected') => {
      await orderService.updateOrderStatus(orderId!, status);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم تحديث حالة الطلب بنجاح');
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Update Order Status');
    },
  });

  const updateSubOrderStatusMutation = useMutation({
    mutationFn: async ({ subOrderId, status }: { subOrderId: string, status: string }) => {
      await orderService.updateSubOrderStatus(subOrderId, status as any);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم تحديث حالة الطلب الفرعي بنجاح');
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Update Sub-Order Status');
    }
  });

  const handleUpdateStatus = () => {
    if (newStatus && newStatus !== order?.status) {
      // Business logic validation
      const statusOrderMap: Record<string, number> = {
        Pending: 1,
        Active: 2,
        OnTheWay: 3,
        Completed: 4,
        Rejected: 5,
        Cancelled: 6,
      };

      const currentOrder = statusOrderMap[order.status];
      const nextOrder = statusOrderMap[newStatus];

      // Prevent backwards transition for normal flow
      if (currentOrder < 5 && nextOrder < 5 && nextOrder < currentOrder) {
        toast.error('لا يمكن إرجاع حالة الطلب للخلف');
        return;
      }

      // Check sub-orders status for specific transitions (Removed strict validation to allow forcing status)
      // The backend service will automatically update sub-orders to match the master order status.

      updateStatusMutation.mutate(newStatus as any);
    }
  };

  const cancelOrderMutation = useMutation({
    mutationFn: async (reason: string) => {
      await orderService.cancelOrder(
        orderId!,
        reason,
        order.customer_id,
        order.grand_total,
        order.payment_status,
        order.notes
      );
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم إلغاء الطلب بنجاح');
    },
    onError: (error: any) => {
      handleGlobalError(error, 'Cancel Order');
    }
  });

  const addDiscountMutation = useMutation({
    mutationFn: async (discount: number) => {
      const newGrandTotal = Math.max(0, order.grand_total - discount);
      const { error } = await supabase
        .from('master_orders')
        .update({ 
          grand_total: newGrandTotal,
          notes: order.notes ? `${order.notes}\nتم إضافة خصم يدوي بقيمة ${discount} ج.م` : `تم إضافة خصم يدوي بقيمة ${discount} ج.م`
        })
        .eq('id', orderId);
      
      if (error) throw error;
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم إضافة الخصم بنجاح');
    },
    onError: (error: any) => {
      toast.error(`خطأ في إضافة الخصم: ${error.message}`);
    }
  });

  const notifyCustomerMutation = useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          user_id: order.customer_id,
          title: `تحديث بخصوص طلبك #${order.order_number}`,
          content: message,
          data: { order_id: orderId }
        }]);
      
      if (error) throw error;
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      toast.success('تم إرسال الإشعار للعميل');
    },
    onError: (error: any) => {
      toast.error(`خطأ في إرسال الإشعار: ${error.message}`);
    }
  });

  const openDisputeMutation = useMutation({
    mutationFn: async () => {
      // 1. Check if dispute already exists for this order
      const { data: existingDispute } = await supabase
        .from('dispute_resolution')
        .select('id')
        .eq('order_id', orderId)
        .is('ticket_id', null) // Only check for disputes created directly from order
        .single();

      if (existingDispute) {
        throw new Error('يوجد نزاع مفتوح بالفعل لهذا الطلب');
      }

      // 2. Create dispute record
      const { error: disputeError } = await supabase
        .from('dispute_resolution')
        .insert({
          order_id: orderId,
          status: 'Under_Review',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (disputeError) throw disputeError;
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute_resolution'] }).catch(console.error);
      toast.success('تم فتح نزاع لهذا الطلب بنجاح');
    },
    onError: (error: any) => {
      toast.error(error.message || 'خطأ في فتح النزاع');
    }
  });

  const autoAssignDriverMutation = useMutation({
    mutationFn: async () => {
      // 1. Try to find a free online driver first, excluding already assigned ones
      let query = supabase
        .from('driver_details')
        .select('user_id')
        .eq('is_online', true)
        .eq('is_busy', false);

      if (assignedDriverIds.length > 0) {
        query = query.not('user_id', 'in', assignedDriverIds);
      }

      let { data: drivers, error: driversError } = await query.limit(1);
      
      if (driversError) throw driversError;

      // 2. If no free driver, pick any online driver excluding already assigned ones
      if (!drivers || drivers.length === 0) {
        let anyQuery = supabase
          .from('driver_details')
          .select('user_id')
          .eq('is_online', true);

        if (assignedDriverIds.length > 0) {
          anyQuery = anyQuery.not('user_id', 'in', assignedDriverIds);
        }

        const { data: anyOnlineDrivers, error: anyError } = await anyQuery.limit(1);
        
        if (anyError) throw anyError;
        drivers = anyOnlineDrivers;
      }

      if (!drivers || drivers.length === 0) {
        throw new Error('لا يوجد سائقين متصلين حالياً أو جميع السائقين المتصلين معينين بالفعل لهذا الطلب.');
      }

      const driverId = drivers[0].user_id;

      // Use orderService to handle assignment and status update
      await orderService.assignDriver(orderId!, driverId);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم التعيين التلقائي للسائق بنجاح');
    },
    onError: (error: any) => {
      if (error.message === 'هذا المندوب معين بالفعل لهذا الطلب' || error.message === 'لا يوجد سائقين متصلين حالياً أو جميع السائقين المتصلين معينين بالفعل لهذا الطلب.') {
        toast(error.message, { icon: '⚠️', style: { background: '#FEF3C7', color: '#92400E', fontWeight: 'bold' } });
      } else {
        handleGlobalError(error, 'Auto Assign Driver');
      }
    }
  });

  const removeSubOrderMutation = useMutation({
    mutationFn: async (subOrderId: string) => {
      await orderService.removeSubOrder(subOrderId, orderId!);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم إزالة المتجر من الطلب بنجاح');
    },
    onError: (error: any) => handleGlobalError(error, 'Remove SubOrder')
  });

  const removeOrderItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await orderService.removeOrderItem(itemId, orderId!);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم إزالة المنتج بنجاح');
    },
    onError: (error: any) => handleGlobalError(error, 'Remove Item')
  });

  const updateOrderItemQuantityMutation = useMutation({
    mutationFn: async ({ itemId, qty }: { itemId: string, qty: number }) => {
      await orderService.updateOrderItemQuantity(itemId, qty, orderId!);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم تحديث الكمية بنجاح');
    },
    onError: (error: any) => handleGlobalError(error, 'Update Quantity')
  });

  const updateOrderAddressMutation = useMutation({
    mutationFn: async (addressData: any) => {
      await orderService.updateOrderAddress(orderId!, addressData);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      toast.success('تم تحديث العنوان بنجاح');
    },
    onError: (error: any) => handleGlobalError(error, 'Update Address')
  });

  const updateCustomerPhoneMutation = useMutation({
    mutationFn: async ({ customerId, phone }: { customerId: string, phone: string }) => {
      await orderService.updateCustomerPhone(customerId, phone);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      toast.success('تم تحديث رقم الهاتف بنجاح');
    },
    onError: (error: any) => handleGlobalError(error, 'Update Phone')
  });

  const addOrderItemMutation = useMutation({
    mutationFn: async ({ subOrderId, productId }: { subOrderId: string, productId: string }) => {
      await orderService.addOrderItem(subOrderId, productId, orderId!);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم إضافة المنتج بنجاح');
      setAddProductModal(null);
    },
    onError: (error: any) => handleGlobalError(error, 'Add Item')
  });

  const updateOrderItemModifiersMutation = useMutation({
    mutationFn: async ({ itemId, modifiers }: { itemId: string, modifiers: any }) => {
      await orderService.updateOrderItemModifiers(itemId, modifiers, orderId!);
    },
    meta: { suppressGlobalError: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['orders'] }).catch(console.error);
      toast.success('تم تحديث الإضافات بنجاح');
      setEditModifiersModal(null);
    },
    onError: (error: any) => handleGlobalError(error, 'Update Modifiers')
  });

  if (!orderId) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-25 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed inset-y-0 left-0 w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-r border-gray-200 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-none rotate-3 group-hover:rotate-0 transition-transform">
              <ReceiptText className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  طلب <span className="text-emerald-600">#{order?.order_number || '...'}</span>
                </h2>
                {order?.payment_status === 'Paid' && (
                  <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-black px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30">مدفوع</span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {order?.created_at ? format(new Date(order.created_at), 'PPp', { locale: ar }) : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.print()}
              className="p-2.5 text-gray-400 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-all border border-transparent hover:border-emerald-100 dark:hover:border-emerald-500/20"
              title="طباعة الطلب"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all border border-transparent hover:border-gray-200 dark:hover:border-slate-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-gray-50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-emerald-100 rounded-full animate-spin border-t-emerald-600"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-emerald-600 animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-gray-900 font-black text-lg">جاري جلب البيانات</p>
                <p className="text-gray-400 text-sm font-medium mt-1">يرجى الانتظار لحظات...</p>
              </div>
            </div>
          ) : order ? (
            <>
              {/* Main Grid Layout */}
              <div className="grid grid-cols-1 gap-6">
                
                {/* Status & Quick Info Bento */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={cn(
                    "p-5 rounded-3xl border shadow-sm flex flex-col justify-between transition-all",
                    order.status === 'Completed' ? "bg-green-50 border-green-100 text-green-700" :
                    order.status === 'Cancelled' || order.status === 'Rejected' ? "bg-red-50 border-red-100 text-red-700" :
                    "bg-emerald-600 border-emerald-500 text-white shadow-emerald-100"
                  )}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-black uppercase tracking-widest opacity-80">حالة الطلب</span>
                      {order.status === 'Completed' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <span className="text-2xl font-black tracking-tight">{statusNames[order.status]}</span>
                  </div>

                  <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">طريقة الدفع</span>
                      <CreditCard className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <span className="text-xl font-black text-gray-900">{order.payment_method === 'Wallet' ? 'المحفظة' : 'نقداً'}</span>
                      <p className={cn(
                        "text-[11px] font-bold mt-1",
                        order.payment_status === 'Paid' ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {order.payment_status === 'Paid' ? 'تم التحصيل' : 'بانتظار التحصيل'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Customer & Address Card */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        <User className="w-4 h-4 text-emerald-600" />
                        بيانات العميل والتوصيل
                      </h3>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => openPrompt({
                            title: 'تعديل رقم الهاتف',
                            type: 'text',
                            confirmText: 'تحديث الرقم',
                            initialValue: (order.customer as any)?.primary_phone,
                            action: (val) => updateCustomerPhoneMutation.mutate({ customerId: order.customer_id, phone: val })
                          })}
                          className="p-2 bg-gray-50 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-gray-100"
                          title="تعديل الهاتف"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => openPrompt({
                              title: 'تعديل عنوان التوصيل',
                              type: 'textarea',
                              confirmText: 'تحديث العنوان',
                              initialValue: `${(order.address as any)?.city || ''}، ${(order.address as any)?.district || ''}، ${(order.address as any)?.street_name || ''}\nمبنى ${(order.address as any)?.building_number || ''}، طابق ${(order.address as any)?.floor_number || ''}، شقة ${(order.address as any)?.apartment_num || ''}`,
                              action: (val) => {
                                const lines = val.split('\n');
                                const part1 = lines[0] || '';
                                const part2 = lines[1] || '';
                                const addrParts = part1.split('،').map(s => s.trim());
                                
                                const updates: any = {
                                  city: addrParts[0] || (order.address as any)?.city,
                                  district: addrParts[1] || (order.address as any)?.district,
                                  street_name: addrParts[2] || (order.address as any)?.street_name
                                };

                                if (part2) {
                                  const detailParts = part2.split('،').map(s => s.trim());
                                  detailParts.forEach(p => {
                                    if (p.includes('مبنى')) updates.building_number = p.replace('مبنى', '').trim();
                                    else if (p.includes('طابق')) updates.floor_number = p.replace('طابق', '').trim();
                                    else if (p.includes('شقة')) updates.apartment_num = p.replace('شقة', '').trim();
                                  });
                                }

                                updateOrderAddressMutation.mutate(updates);
                              }
                            })}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-100 font-black text-xs"
                            title="تعديل العنوان"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            تعديل العنوان
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0 shadow-inner overflow-hidden">
                        {(order.customer as any)?.avatar_url ? (
                          <img 
                            src={(order.customer as any).avatar_url} 
                            alt="" 
                            className="w-full h-full object-cover rounded-full"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-10 h-10" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-gray-900">{(order.customer as any)?.full_name}</h4>
                        <p className="text-gray-500 font-bold mt-1 flex items-center gap-2" dir="ltr">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          {(order.customer as any)?.primary_phone}
                        </p>
                      </div>
                    </div>

                    {order.notes && (
                      <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2 text-amber-700">
                          <Quote className="w-4 h-4" />
                          <span className="text-xs font-black uppercase tracking-widest">تعليق العميل</span>
                        </div>
                        <p className="text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">
                          {order.notes}
                        </p>
                      </div>
                    )}

                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div className="text-sm leading-relaxed">
                        <p className="font-black text-gray-900 mb-1">{(order.address as any)?.address_label || 'عنوان التوصيل'}</p>
                        <p className="text-gray-600 font-medium">
                          {(order.address as any)?.city}، {(order.address as any)?.district}، {(order.address as any)?.street_name}
                          <br />
                          مبنى {(order.address as any)?.building_number}، طابق {(order.address as any)?.floor_number}، شقة {(order.address as any)?.apartment_num}
                        </p>
                        { (order.address as any)?.landmark && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 w-fit px-2 py-1 rounded-lg">
                            <Zap className="w-3 h-3" />
                            علامة مميزة: {(order.address as any)?.landmark}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Team (Master Order Level) */}
                <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
                  <div className="p-5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                        <Motorbike className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">فريق التوصيل</h3>
                        <p className="text-[11px] text-emerald-600 font-bold">إدارة المناديب وتعيينهم</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => autoAssignDriverMutation.mutate()}
                        disabled={autoAssignDriverMutation.isPending}
                        className="p-2.5 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all border border-blue-100 shadow-sm disabled:opacity-50"
                        title="تعيين تلقائي"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setIsAssigningDriver(true)}
                        className="p-2.5 bg-white text-emerald-600 rounded-xl hover:bg-emerald-50 transition-all border border-emerald-100 shadow-sm"
                        title="تعيين يدوي"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-5 space-y-3">
                    {order.delivery_team && order.delivery_team.length > 0 ? (
                      order.delivery_team.map((team: any) => (
                        <div key={team.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl border border-gray-100 group/driver">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-sm border border-gray-100 overflow-hidden">
                              {team.driver?.user?.avatar_url ? (
                                <img 
                                  src={team.driver.user.avatar_url} 
                                  alt="" 
                                  className="w-full h-full object-cover rounded-full"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <User className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-gray-900">{team.driver?.user?.full_name}</p>
                                {(team.driver?.active_orders?.filter((ao: any) => ao.master_order && !['Completed', 'Cancelled', 'Rejected'].includes(ao.master_order.status)).length || 0) > 0 && (
                                  <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter">
                                    {new Set(team.driver.active_orders.filter((ao: any) => ao.master_order && !['Completed', 'Cancelled', 'Rejected'].includes(ao.master_order.status)).map((ao: any) => ao.master_order.id)).size} طلب نشط
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-400 font-bold mt-0.5" dir="ltr">{team.driver?.user?.primary_phone}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setDriverToRemove({ teamId: team.id, driverId: team.driver_id })}
                            className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover/driver:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-emerald-100 rounded-[2rem] bg-emerald-50">
                        <Motorbike className="w-8 h-8 text-emerald-200 mx-auto mb-2" />
                        <p className="text-[11px] text-emerald-400 font-black uppercase tracking-widest">بانتظار تعيين مندوب</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tracking & Timeline Bento */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Time Stats */}
                  <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-600" />
                        مؤشرات الوقت
                      </h3>
                      <span className="text-[11px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                        إجمالي: {(timeStats?.prepElapsed || 0) + (timeStats?.deliveryElapsed || 0)} د
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <div className="flex justify-between text-[11px] font-black text-gray-400 uppercase mb-2">
                          <span>التحضير</span>
                          <span>{timeStats?.prepElapsed} / {timeStats?.maxVendorPrep} د</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, ((timeStats?.prepElapsed || 0) / (timeStats?.maxVendorPrep || 1)) * 100)}%` }}
                            className={cn(
                              "h-full rounded-full transition-all",
                              timeStats?.isPrepDelayed ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-emerald-500"
                            )}
                          />
                        </div>
                      </div>

                      <div className="relative">
                        <div className="flex justify-between text-[11px] font-black text-gray-400 uppercase mb-2">
                          <span>التوصيل</span>
                          <span>{['OnTheWay', 'Completed'].includes(order.status) ? `${timeStats?.deliveryElapsed} / ${deliveryThreshold} د` : '--'}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${['OnTheWay', 'Completed'].includes(order.status) ? Math.min(100, ((timeStats?.deliveryElapsed || 0) / deliveryThreshold) * 100) : 0}%` }}
                            className={cn(
                              "h-full rounded-full transition-all",
                              timeStats?.isDeliveryDelayed ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-emerald-500"
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* History Timeline */}
                  <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2 mb-6">
                      <History className="w-4 h-4 text-emerald-600" />
                      سجل الحالات
                    </h3>
                    <div className="flex-1 overflow-y-auto max-h-[180px] pr-2 space-y-4 scrollbar-hide">
                      {(() => {
                        const history = order.sub_orders?.flatMap((so: any) => so.order_status_history || []) || [];
                        const sortedHistory = [...history].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                        return { sortedHistory };
                      })().sortedHistory.length === 0 ? (
                        <div className="text-center py-4 text-gray-400 italic text-xs font-bold">لا يوجد سجل متاح</div>
                      ) : (
                        (() => {
                          const history = order.sub_orders?.flatMap((so: any) => so.order_status_history || []) || [];
                          return [...history]
                            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            .map((h: any, idx: number) => (
                              <div key={idx} className="flex gap-4 relative">
                                <div className={cn(
                                  "w-2.5 h-2.5 rounded-full mt-1.5 shrink-0",
                                  idx === 0 ? "bg-emerald-500 ring-4 ring-emerald-50" : "bg-gray-200"
                                )} />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className={cn("text-xs font-black", idx === 0 ? "text-emerald-600" : "text-gray-700")}>
                                      {statusNames[h.status] || h.status}
                                    </span>
                                    <span className="text-[9px] text-gray-400 font-bold">
                                      {format(new Date(h.created_at), 'p', { locale: ar })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ));
                        })()
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub Orders & Items */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                      محتويات الطلب
                    </h3>
                    <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                      {order.sub_orders?.length || 0} متاجر
                    </span>
                  </div>

                  <div className="space-y-8">
                    {order.sub_orders?.map((subOrder: any) => (
                      <div key={subOrder.id} className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        {/* Vendor Header */}
                        <div className="p-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center relative group">
                          <button
                            onClick={() => {
                              removeSubOrderMutation.mutate(subOrder.id);
                            }}
                            className="absolute -top-2 -right-2 w-8 h-8 bg-white text-red-500 shadow-sm border border-red-50 rounded-full flex items-center justify-center hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 z-10"
                            title="إزالة المتجر"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 shrink-0 overflow-hidden">
                              {subOrder.vendor?.profile?.avatar_url ? (
                                <img 
                                  src={subOrder.vendor.profile.avatar_url} 
                                  alt="" 
                                  className="w-full h-full object-cover rounded-full"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <Store className="w-6 h-6 text-emerald-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-lg font-black text-gray-900">{subOrder.vendor?.brand_name}</h4>
                                <button
                                  onClick={() => setAddProductModal({ isOpen: true, subOrderId: subOrder.id, vendorId: subOrder.vendor_id })}
                                  className="text-[11px] bg-emerald-600 text-white hover:bg-emerald-700 px-2 py-1 rounded-lg font-bold transition-all flex items-center gap-1 shadow-sm shadow-emerald-100"
                                >
                                  <Plus className="w-3 h-3" />
                                  إضافة
                                </button>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-gray-400 font-bold uppercase">التحضير:</span>
                                  <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2 py-0.5">
                                    <input
                                      type="number"
                                      defaultValue={subOrder.preparation_time_override || subOrder.vendor?.preparation_time_avg}
                                      className="w-8 text-center text-[11px] font-black outline-none"
                                      onBlur={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (!isNaN(val) && val !== (subOrder.preparation_time_override || subOrder.vendor?.preparation_time_avg)) {
                                          updatePrepTimeMutation.mutate({ subOrderId: subOrder.id, prepTime: val });
                                        }
                                      }}
                                    />
                                    <span className="text-[11px] text-gray-400 font-bold ml-1">د</span>
                                  </div>
                                </div>
                                <div className="w-1 h-1 bg-gray-200 rounded-full" />
                                <span className="text-[11px] text-emerald-600 font-bold">
                                  {subOrder.items?.length || 0} أصناف
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="relative">
                            <select
                              value={subOrder.sub_status}
                              onChange={(e) => updateSubOrderStatusMutation.mutate({ subOrderId: subOrder.id, status: e.target.value })}
                              className={cn(
                                "pl-8 pr-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest border outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer appearance-none transition-all",
                                subOrder.sub_status === 'Delivered' ? "bg-green-50 border-green-100 text-green-600" :
                                subOrder.sub_status === 'Ready' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                                subOrder.sub_status === 'Preparing' ? "bg-blue-50 border-blue-100 text-blue-600" :
                                "bg-white border-gray-200 text-gray-500"
                              )}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Preparing">Preparing</option>
                              <option value="Ready">Ready</option>
                              <option value="PickedUp">PickedUp</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Cancelled">Cancelled</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                            <ChevronDown className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-current pointer-events-none" />
                          </div>
                        </div>
                        
                        {/* Items */}
                        <div className="p-2 space-y-1">
                          {subOrder.items?.map((item: any) => (
                            <div key={item.id} className="group/item relative bg-white hover:bg-gray-50 rounded-2xl p-4 transition-all flex gap-4 border border-transparent hover:border-gray-100">
                              <button
                                onClick={() => {
                                  removeOrderItemMutation.mutate(item.id);
                                }}
                                className="absolute -top-1 -right-1 w-6 h-6 bg-white text-red-500 shadow-sm border border-red-50 rounded-full flex items-center justify-center hover:bg-red-50 transition-all opacity-0 group-hover/item:opacity-100 z-10"
                                title="إزالة المنتج"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>

                              <div className="flex flex-col items-center justify-center gap-1 shrink-0 bg-gray-50 rounded-xl p-1 border border-gray-100">
                                <button 
                                  onClick={() => updateOrderItemQuantityMutation.mutate({ itemId: item.id, qty: (item.requested_qty || 0) + 1 })}
                                  className="w-7 h-7 flex items-center justify-center bg-white hover:bg-emerald-600 text-gray-400 hover:text-white rounded-lg transition-all shadow-sm"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <div className="w-7 h-8 flex items-center justify-center text-sm font-black text-gray-900">
                                  {item.requested_qty}
                                </div>
                                <button 
                                  onClick={() => updateOrderItemQuantityMutation.mutate({ itemId: item.id, qty: Math.max(0, (item.requested_qty || 0) - 1) })}
                                  className="w-7 h-7 flex items-center justify-center bg-white hover:bg-red-600 text-gray-400 hover:text-white rounded-lg transition-all shadow-sm"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className="flex items-center flex-wrap gap-2">
                                      <p className="text-sm font-black text-gray-900 leading-tight">
                                        {typeof item.product_name_snapshot === 'object' ? (item.product_name_snapshot?.name_ar || item.product_name_snapshot?.name || JSON.stringify(item.product_name_snapshot)) : item.product_name_snapshot}
                                      </p>
                                      {(item.variant_name_snapshot || item.variant?.variant_name) && (
                                        <span className="text-[9px] text-emerald-600 font-black bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100 uppercase">
                                          {(() => {
                                            const v = item.variant_name_snapshot || item.variant?.variant_name;
                                            return typeof v === 'object' && v !== null 
                                              ? (v.name_ar || v.name || v.variant_name || JSON.stringify(v))
                                              : v;
                                          })()}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className="text-[11px] text-gray-400 font-bold">
                                        {(item.unit_price_snapshot || 0).toFixed(2)} ج.م / وحدة
                                      </span>
                                      <button
                                        onClick={() => setEditModifiersModal({
                                          isOpen: true,
                                          itemId: item.id,
                                          productId: item.product_id,
                                          currentModifiers: item.selected_modifiers
                                        })}
                                        className="text-[11px] text-emerald-600 hover:underline font-black flex items-center gap-1"
                                      >
                                        <Edit2 className="w-2.5 h-2.5" />
                                        تعديل الإضافات
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-left">
                                    <p className="text-[9px] text-gray-400 font-black uppercase tracking-tighter mb-0.5">الإجمالي</p>
                                    <p className="text-sm font-black text-emerald-600">
                                      {Number(item.total_line_price) > 0 
                                        ? Number(item.total_line_price).toFixed(2)
                                        : (
                                            (Number(item.unit_price_snapshot) || 0) * (Number(item.requested_qty) || 0) + 
                                            (item.selected_modifiers && typeof item.selected_modifiers === 'object'
                                              ? Number((Object.values(item.selected_modifiers) as any[]).reduce((acc: number, m: any) => acc + (Number(m?.price || 0) * (Number(item.requested_qty) || 0)), 0))
                                              : 0)
                                          ).toFixed(2)
                                      } <span className="text-[11px]">ج.م</span>
                                    </p>
                                  </div>
                                </div>

                                {item.selected_modifiers && Object.keys(item.selected_modifiers).length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {Object.values(item.selected_modifiers).map((m: any, idx: number) => {
                                      let name = '';
                                      let price = '';
                                      if (typeof m === 'string') name = m;
                                      else if (typeof m === 'object' && m !== null) {
                                        name = m.name_ar || m.name || m.title_ar || m.title || m.option_name || JSON.stringify(m);
                                        if (m.price && Number(m.price) > 0) price = ` (+${Number(m.price).toFixed(2)})`;
                                      } else name = String(m);
                                      
                                      return (
                                        <span key={idx} className="bg-gray-50 text-[9px] text-gray-500 font-bold px-2 py-1 rounded-lg border border-gray-100 flex items-center gap-1">
                                          <Plus className="w-2 h-2 text-emerald-400" />
                                          {name}{price}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>


                </section>

              {/* Reviews Section */}
              {reviews && reviews.length > 0 && (
                <section className="bg-amber-50 border border-amber-100 rounded-[2rem] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500 fill-current" />
                      <h3 className="text-sm font-black text-amber-700 uppercase tracking-widest">تقييم العميل</h3>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {reviews.map((review: any) => (
                      <div key={review.id} className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm">
                        <div className="grid grid-cols-2 gap-6 mb-4">
                          <div className="space-y-1">
                            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">المطعم</span>
                            <div className="flex items-center gap-1 text-amber-500">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={cn("w-3.5 h-3.5", i < review.vendor_rating ? "fill-current" : "text-gray-200")} />
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">المندوب</span>
                            <div className="flex items-center gap-1 text-amber-500">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={cn("w-3.5 h-3.5", i < review.driver_rating ? "fill-current" : "text-gray-200")} />
                              ))}
                            </div>
                          </div>
                        </div>
                        {review.comment && (
                          <div className="relative pt-4 border-t border-amber-50">
                            <Quote className="w-8 h-8 text-amber-100 absolute -top-2 -right-2 rotate-180" />
                            <p className="text-sm text-gray-700 font-medium leading-relaxed relative z-10 italic">
                              {review.comment}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Financial Summary */}
              <section className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm font-sans relative overflow-hidden">
                <div className="flex justify-start items-center mb-6 gap-2">
                  <ReceiptText className="w-5 h-5 text-[#EA580C]" />
                  <h3 className="text-lg font-bold text-[#1E293B]">ملخص الطلب</h3>
                </div>
                
                <div className="space-y-4 text-sm font-medium">
                  {/* Items */}
                  <div className="flex justify-between items-center text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-gray-400" />
                      <span>مجموع المنتجات</span>
                    </div>
                    <span className="font-bold text-gray-900" dir="ltr">EGP {(order.items_total || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center text-gray-600">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-gray-400" />
                      <span>رسوم التوصيل</span>
                    </div>
                    <span className="font-bold text-gray-900" dir="ltr">EGP {(order.delivery_fee || 0).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>فرق المسافة</span>
                    </div>
                    <span className="font-bold text-gray-900" dir="ltr">EGP {(order.distance_fee || 0).toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-gray-600">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="w-4 h-4 text-gray-400" />
                      <span>الضريبة ({(order.total_tax > 0 ? '14' : '0')}%)</span>
                    </div>
                    <span className="font-bold text-gray-900" dir="ltr">EGP {(order.total_tax || 0).toFixed(2)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-gray-600">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-gray-400" />
                      <span>بقشيش السائق</span>
                    </div>
                    <span className="font-bold text-gray-900" dir="ltr">EGP 0.00</span>
                  </div>

                  {(order.delivery_discount > 0 || order.platform_discount > 0) && (
                    <div className="flex justify-between items-center text-[#10B981]">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        <span>الخصم</span>
                      </div>
                      <span className="font-bold text-[#10B981]" dir="ltr">EGP -{((order.delivery_discount || 0) + (order.platform_discount || 0)).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-dashed border-gray-200 my-6"></div>

                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-6 h-6 text-[#EA580C]" />
                    <span className="text-xl font-bold text-gray-900">الإجمالي الكلي</span>
                  </div>
                  <span className="text-2xl font-black text-[#EA580C]" dir="ltr">EGP {order.grand_total.toFixed(2)}</span>
                </div>

                <div className="flex justify-center border-none">
                  <div className="bg-slate-100 text-slate-500 px-6 py-3 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 mx-auto">
                    طريقة الدفع: {order.payment_method === 'Wallet' ? 'محفظة' : 'الدفع عند الاستلام'}
                  </div>
                </div>
              </section>

              {/* Quick Actions */}
              <section className="space-y-4 pb-12">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  إجراءات إدارية سريعة
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => openPrompt({
                      title: 'إلغاء الطلب',
                      message: 'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ سيتم استرجاع المبلغ للمحفظة في حال كان مدفوعاً.',
                      placeholder: 'اكتب سبب الإلغاء هنا...',
                      type: 'textarea',
                      confirmText: 'تأكيد الإلغاء',
                      action: (reason) => cancelOrderMutation.mutate(reason)
                    })}
                    disabled={cancelOrderMutation.isPending || ['Completed', 'Cancelled', 'Rejected'].includes(order.status)}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-white border border-red-100 rounded-[2rem] text-red-600 hover:bg-red-50 transition-all disabled:opacity-50 group shadow-sm"
                  >
                    <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <X className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">إلغاء الطلب</span>
                  </button>

                  <button
                    onClick={() => openPrompt({
                      title: 'إضافة خصم يدوي',
                      message: 'سيتم خصم هذا المبلغ من إجمالي الفاتورة النهائي.',
                      placeholder: 'أدخل قيمة الخصم (مثلاً: 50)',
                      type: 'number',
                      confirmText: 'تطبيق الخصم',
                      action: (val) => addDiscountMutation.mutate(Number(val))
                    })}
                    disabled={addDiscountMutation.isPending || ['Completed', 'Cancelled', 'Rejected'].includes(order.status)}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-white border border-blue-100 rounded-[2rem] text-blue-600 hover:bg-blue-50 transition-all disabled:opacity-50 group shadow-sm"
                  >
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Tag className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">خصم يدوي</span>
                  </button>

                  <button
                    onClick={() => openPrompt({
                      title: 'إرسال إشعار للعميل',
                      message: 'سيتم إرسال رسالة تنبيه فورية للعميل عبر التطبيق.',
                      placeholder: 'اكتب نص الرسالة هنا...',
                      type: 'textarea',
                      confirmText: 'إرسال الإشعار',
                      action: (msg) => notifyCustomerMutation.mutate(msg)
                    })}
                    disabled={notifyCustomerMutation.isPending}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-white border border-emerald-100 rounded-[2rem] text-emerald-600 hover:bg-emerald-50 transition-all group shadow-sm"
                  >
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Bell className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">إشعار العميل</span>
                  </button>

                  <button
                    onClick={() => openPrompt({
                      title: 'فتح نزاع إداري',
                      message: 'هل ترغب في فتح تذكرة نزاع لهذا الطلب للتحقيق في مشكلة معينة؟',
                      isConfirmOnly: true,
                      type: 'text',
                      confirmText: 'فتح النزاع',
                      action: () => openDisputeMutation.mutate()
                    })}
                    disabled={openDisputeMutation.isPending}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-white border border-amber-100 rounded-[2rem] text-amber-600 hover:bg-amber-50 transition-all group shadow-sm"
                  >
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Scale className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">فتح نزاع</span>
                  </button>
                </div>
              </section>
            </div>
          </>
        ) : (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 space-y-4">
              <AlertCircle className="w-16 h-16 opacity-20" />
              <p className="font-bold">لم يتم العثور على تفاصيل الطلب</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 bg-white sticky bottom-0 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm font-black appearance-none transition-all"
              >
                {Object.entries(statusNames).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Clock className="h-4 w-4 text-gray-400" />
              </div>
            </div>
            <button 
              onClick={handleUpdateStatus}
              disabled={updateStatusMutation.isPending || newStatus === order?.status}
              className="bg-emerald-600 text-white px-8 py-3 rounded-xl text-sm font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none whitespace-nowrap"
            >
              {updateStatusMutation.isPending ? 'جاري التحديث...' : 'تحديث الحالة'}
            </button>
          </div>
        </div>
      </div>

      {/* Chat Window Overlay */}
      <AnimatePresence>
        {activeChatRoomId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#000000B3] ">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl h-[80vh] bg-white rounded-3xl shadow-2xl overflow-hidden relative"
            >
              <ChatWindow 
                roomId={activeChatRoomId} 
                onClose={() => setActiveChatRoomId(null)} 
                orderId={orderId}
                orderNumber={order?.order_number?.toString()}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Prompt Modal */}
      <PromptModal
        isOpen={promptConfig.isOpen}
        onClose={closePrompt}
        onConfirm={(val) => {
          promptConfig.action(val);
          closePrompt();
        }}
        title={promptConfig.title}
        message={promptConfig.message}
        placeholder={promptConfig.placeholder}
        type={promptConfig.type}
        confirmText={promptConfig.confirmText}
        isConfirmOnly={promptConfig.isConfirmOnly}
        initialValue={promptConfig.initialValue}
        isLoading={cancelOrderMutation.isPending || addDiscountMutation.isPending || notifyCustomerMutation.isPending || openDisputeMutation.isPending}
      />

      {/* Driver Assignment Modal */}
      <AssignDriverModal
        isOpen={isAssigningDriver}
        onClose={() => setIsAssigningDriver(false)}
        isAssigning={assignDriverMutation.isPending}
        excludeDriverIds={assignedDriverIds}
        onAssign={(driverId) => {
          assignDriverMutation.mutate({ driverId });
        }}
      />

      {/* Remove Driver Confirmation Modal */}
      <ConfirmModal
        isOpen={!!driverToRemove}
        onClose={() => setDriverToRemove(null)}
        onConfirm={() => driverToRemove && removeDriverMutation.mutate(driverToRemove)}
        title="تأكيد إزالة المندوب"
        message="هل أنت متأكد من رغبتك في إزالة هذا المندوب من الطلب؟ سيتم تحديث حالة انشغال المندوب تلقائياً."
        type="danger"
        confirmText="إزالة المندوب"
        isLoading={removeDriverMutation.isPending}
      />

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={!!addProductModal?.isOpen}
        onClose={() => setAddProductModal(null)}
        vendorId={addProductModal?.vendorId || ''}
        onAdd={(product) => {
          if (addProductModal) {
            addOrderItemMutation.mutate({ subOrderId: addProductModal.subOrderId, productId: product.id });
          }
        }}
      />

      {/* Edit Modifiers Modal */}
      {editModifiersModal && (
        <EditModifiersModal
          isOpen={editModifiersModal.isOpen}
          onClose={() => setEditModifiersModal(null)}
          itemId={editModifiersModal.itemId}
          productId={editModifiersModal.productId}
          currentModifiers={editModifiersModal.currentModifiers}
          onUpdate={(modifiers) => updateOrderItemModifiersMutation.mutate({ itemId: editModifiersModal.itemId, modifiers })}
          isUpdating={updateOrderItemModifiersMutation.isPending}
        />
      )}
    </>
  );
}
