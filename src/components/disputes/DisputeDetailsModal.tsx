import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  X, 
  Scale, 
  AlertCircle, 
  CheckCircle, 
  DollarSign, 
  FileText, 
  ExternalLink,
  User,
  Store,
  Truck,
  ShieldAlert,
  MessageSquare,
  Calendar,
  Hash,
  Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';

import { financeService } from '../../services/financeService';

interface DisputeDetailsModalProps {
  dispute: any;
  onClose: () => void;
  onIssuePenalty?: (userId: string, userName: string, reason: string) => void;
}

export default function DisputeDetailsModal({ dispute, onClose, onIssuePenalty }: DisputeDetailsModalProps) {
  const queryClient = useQueryClient();
  const [rulingType, setRulingType] = useState(dispute.ruling_type || 'Full_Refund');
  const [refundAmount, setRefundAmount] = useState(dispute.refund_amount || 0);
  const [deductedFrom, setDeductedFrom] = useState(dispute.deducted_from || 'Vendor');
  const [compensatedTo, setCompensatedTo] = useState<'Customer' | 'Vendor' | 'Driver'>(dispute.compensated_to || 'Customer');
  const [notes, setNotes] = useState(dispute.notes || '');

  const resolveMutation = useMutation({
    mutationFn: async (status: 'Resolved' | 'Rejected') => {
      const updateData = {
        status,
        ruling_type: status === 'Resolved' ? rulingType : null,
        refund_amount: status === 'Resolved' ? refundAmount : 0,
        deducted_from: status === 'Resolved' ? deductedFrom : null,
        compensated_to: status === 'Resolved' ? compensatedTo : null,
        notes: notes,
        updated_at: new Date().toISOString()
      };

      // 1. Update dispute record
      const { error: updateError } = await supabase
        .from('dispute_resolution')
        .update(updateData)
        .eq('id', dispute.id);

      if (updateError) throw updateError;

      // 2. If Resolved and refund > 0, process wallet transactions
      if (status === 'Resolved' && refundAmount > 0) {
        // Fetch all parties involved in the order
        const { data: orderData } = await supabase
          .from('master_orders')
          .select(`
            id, 
            order_number, 
            customer_id,
            sub_orders (vendor_id),
            order_delivery_team (driver_id)
          `)
          .eq('id', dispute.order_id)
          .single();

        if (!orderData) throw new Error('لم يتم العثور على بيانات الطلب');

        const customerId = orderData.customer_id;
        const vendorId = (orderData as any).sub_orders?.[0]?.vendor_id; // Taking the first vendor for now
        const driverId = (orderData as any).order_delivery_team?.[0]?.driver_id; // Taking the first driver for now

        // A. Deduction (Who bears the cost)
        if (deductedFrom !== 'Platform') {
          const targetDeductionId = deductedFrom === 'Vendor' ? vendorId : driverId;
          if (targetDeductionId) {
            await financeService.adjustWalletBalance(
              targetDeductionId,
              -refundAmount,
              'penalty',
              `خصم ناتج عن قرار نزاع للطلب #${orderData.order_number} - قرار: ${rulingType}`,
              dispute.order_id
            );
          }
        }

        // B. Compensation (Who receives the money)
        const targetCompensationId = compensatedTo === 'Customer' ? customerId : (compensatedTo === 'Vendor' ? vendorId : driverId);
        if (targetCompensationId) {
          await financeService.adjustWalletBalance(
            targetCompensationId,
            refundAmount,
            'refund',
            `تعويض ناتج عن قرار نزاع للطلب #${orderData.order_number} - قرار: ${rulingType}`,
            dispute.order_id
          );
        }
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة النزاع بنجاح');
      queryClient.invalidateQueries({ queryKey: ['disputes'] }).catch(console.error);
      onClose();
    },
    onError: (error: any) => {
      console.error('Error resolving dispute:', error);
      toast.error('حدث خطأ أثناء معالجة النزاع');
    }
  });

  const rulingOptions = [
    { id: 'Full_Refund', label: 'استرجاع كامل المبلغ' },
    { id: 'Partial_Refund', label: 'استرجاع جزئي' },
    { id: 'Credit_Adjustment', label: 'تعديل رصيد' },
    { id: 'No_Refund', label: 'لا يوجد استرجاع' },
  ];

  const deductionOptions = [
    { id: 'Vendor', label: 'المطعم / المتجر', icon: Store },
    { id: 'Driver', label: 'المندوب', icon: Truck },
    { id: 'Platform', label: 'المنصة', icon: Scale },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827B3] " dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 bg-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-white rounded-bl-full -mr-8 -mt-8" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-sm">
              <Scale className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">تفاصيل فض النزاع</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500 font-medium flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                   رقم: {dispute.id.substring(0, 8)}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded-lg text-xs font-bold border",
                  dispute.status === 'Under_Review' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  dispute.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  'bg-red-50 text-red-700 border-red-200'
                )}>
                  {dispute.status === 'Under_Review' ? 'قيد المراجعة' : dispute.status === 'Resolved' ? 'تم الحل' : 'مرفوض'}
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-full transition-all relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Info */}
            <div className="space-y-6">
              <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-5 flex items-center gap-2 border-b border-gray-50 pb-4">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  معلومات النزاع الأساسية
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <span className="text-gray-500 font-medium flex items-center gap-2"><Hash className="w-4 h-4" />رقم الطلب:</span>
                    <span className="font-bold text-gray-900 bg-white px-2.5 py-1 rounded-xl shadow-sm border border-gray-100">#{dispute.master_orders?.order_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <span className="text-gray-500 font-medium flex items-center gap-2"><Calendar className="w-4 h-4" />تاريخ النزاع:</span>
                    <span className="font-bold text-gray-900 text-sm">{format(new Date(dispute.created_at), 'PPp', { locale: ar })}</span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <span className="text-gray-500 font-medium flex items-center gap-2"><User className="w-4 h-4" />المحكم الحالي:</span>
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl shadow-sm border border-gray-100">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                        {dispute.arbitrator?.avatar_url ? (
                          <img 
                            src={dispute.arbitrator.avatar_url} 
                            alt="" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                      <span className="font-bold text-gray-900 text-sm">{dispute.arbitrator?.full_name || 'غير معين'}</span>
                    </div>
                  </div>
                  
                  <div className="pt-4 mt-2">
                    <p className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4" />موضوع التذكرة:</p>
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-4">
                       <p className="font-bold text-gray-900 leading-relaxed">{dispute.support_tickets?.subject || 'لا يوجد عنوان'}</p>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {dispute.ticket_id && (
                        <Link
                          to={`/support?ticketId=${dispute.ticket_id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 border border-indigo-100 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-50 transition-all hover:-translate-y-0.5"
                        >
                          <FileText className="w-4 h-4" />
                          عرض التذكرة
                        </Link>
                      )}
                      {dispute.support_tickets?.chat_room_id && (
                        <Link
                          to={`/support/chats?roomId=${dispute.support_tickets.chat_room_id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-100 transition-all hover:-translate-y-0.5"
                        >
                          <MessageSquare className="w-4 h-4" />
                          فتح المحادثة
                        </Link>
                      )}
                      {onIssuePenalty && (
                        <button
                          onClick={() => {
                            onIssuePenalty('', '', `بناءً على النزاع رقم #${dispute.id}`);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-sm font-bold shadow-sm hover:bg-rose-100 transition-all hover:-translate-y-0.5"
                        >
                          <ShieldAlert className="w-4 h-4" />
                          إصدار جزاء
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-black text-gray-900 mb-5 flex items-center gap-2 border-b border-gray-50 pb-4">
                  <AlertCircle className="w-5 h-5 text-indigo-500" />
                  الأدلة والمرفقات
                </h3>
                {dispute.evidence_urls && Array.isArray(dispute.evidence_urls) && dispute.evidence_urls.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {dispute.evidence_urls.map((url: string, index: number) => (
                      <button 
                        key={index} 
                        onClick={() => window.open(url, '_system')}
                        className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-gray-100 hover:border-indigo-500 transition-all cursor-pointer shadow-sm hover:shadow-md"
                      >
                        <img src={url} alt={`Evidence ${index + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-[#000000B3] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center ">
                          <ExternalLink className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                       <FileText className="w-6 h-6 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-bold">لا توجد مرفقات أو أدلة صورية</p>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Resolution Form */}
            <div className="space-y-6">
              <section className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-3 h-full bg-indigo-500 rounded-r-3xl" />
                <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2 border-b border-gray-50 pb-4 pr-3">
                  <Activity className="w-5 h-5 text-indigo-500" />
                  لوحة القرار والتحكيم
                </h3>
                
                <div className="space-y-6 pr-3">
                  {/* Ruling Type */}
                  <div>
                    <label className="block text-sm font-black text-gray-800 mb-3">نوع الحكم</label>
                    <div className="grid grid-cols-2 gap-3">
                      {rulingOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setRulingType(option.id)}
                          disabled={dispute.status !== 'Under_Review'}
                          className={cn(
                            "px-4 py-3.5 rounded-xl text-sm font-bold border-2 transition-all text-center",
                            rulingType === option.id 
                              ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm" 
                              : "bg-white border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50",
                            dispute.status !== 'Under_Review' && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Refund Amount */}
                  {rulingType !== 'No_Refund' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      <label className="block text-sm font-black text-gray-800 mb-3">المبلغ المسترد (ج.م)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                          <DollarSign className="h-5 w-5 text-indigo-400" />
                        </div>
                        <input
                          type="number"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(Number(e.target.value))}
                          disabled={dispute.status !== 'Under_Review'}
                          className="block w-full pr-12 pl-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold focus:bg-white transition-all disabled:opacity-60"
                          placeholder="0.00"
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* Deducted From */}
                  {rulingType !== 'No_Refund' && refundAmount > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-gray-50 rounded-2xl border border-gray-100"
                    >
                      <div>
                        <label className="block text-sm font-black text-gray-800 mb-3">يُخصم من:</label>
                        <div className="grid grid-cols-3 gap-2">
                          {deductionOptions.map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setDeductedFrom(option.id)}
                              disabled={dispute.status !== 'Under_Review'}
                              className={cn(
                                "flex flex-col items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all",
                                deductedFrom === option.id 
                                  ? "bg-red-50 border-red-500 text-red-700 shadow-sm" 
                                  : "bg-white border-transparent text-gray-500 hover:border-gray-200 shadow-sm",
                                dispute.status !== 'Under_Review' && "opacity-60 cursor-not-allowed"
                              )}
                            >
                              <option.icon className="w-5 h-5 mb-1" />
                              <span className="text-[11px] font-bold text-center">{option.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-black text-gray-800 mb-3">يُعوض إلى:</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'Customer', label: 'العميل', icon: User },
                            { id: 'Vendor', label: 'المطعم', icon: Store },
                            { id: 'Driver', label: 'المندوب', icon: Truck },
                          ].map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setCompensatedTo(option.id as any)}
                              disabled={dispute.status !== 'Under_Review'}
                              className={cn(
                                "flex flex-col items-center justify-center gap-2 p-2.5 rounded-xl border-2 transition-all",
                                compensatedTo === option.id 
                                  ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm" 
                                  : "bg-white border-transparent text-gray-500 hover:border-gray-200 shadow-sm",
                                dispute.status !== 'Under_Review' && "opacity-60 cursor-not-allowed"
                              )}
                            >
                              <option.icon className="w-5 h-5 mb-1" />
                              <span className="text-[11px] font-bold text-center">{option.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-black text-gray-800 mb-3">ملاحظات و بحيثيات القرار</label>
                    <textarea
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={dispute.status !== 'Under_Review'}
                      className="block w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium focus:bg-white transition-all disabled:opacity-60"
                      placeholder="اشرح بشكل مفصل سبب اتخاذ هذا القرار والأدلة التي تم الاستناد عليها..."
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 bg-white flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-50 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-all border border-gray-200"
          >
            إغلاق
          </button>
          
          <div className="flex gap-3">
             <button
              onClick={() => resolveMutation.mutate('Rejected')}
              disabled={resolveMutation.isPending || dispute.status !== 'Under_Review'}
              className="px-6 py-3 bg-white border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              رفض النزاع
            </button>
            <button
              onClick={() => resolveMutation.mutate('Resolved')}
              disabled={resolveMutation.isPending || dispute.status !== 'Under_Review'}
              className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] active:scale-95 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {resolveMutation.isPending ? 'جاري المعالجة...' : 'اعتماد القرار'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
