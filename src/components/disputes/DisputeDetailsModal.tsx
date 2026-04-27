import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
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
  MessageSquare
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-2xl">
              <Scale className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-900">تفاصيل فض النزاع</h2>
              <p className="text-sm text-gray-500 font-medium">تذكرة رقم: {dispute.support_tickets?.ticket_number || 'N/A'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Info */}
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  معلومات النزاع
                </h3>
                <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">رقم الطلب:</span>
                    <span className="font-bold text-gray-900">#{dispute.master_orders?.order_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">تاريخ النزاع:</span>
                    <span className="font-bold text-gray-900">{format(new Date(dispute.created_at), 'PPp', { locale: ar })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-medium">المحكم الحالي:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-300">
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
                      <span className="font-bold text-gray-900">{dispute.arbitrator?.full_name || 'غير معين'}</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-2">موضوع التذكرة:</p>
                    <p className="font-bold text-gray-900 mb-4">{dispute.support_tickets?.subject || 'لا يوجد عنوان'}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {dispute.ticket_id && (
                        <Link
                          to={`/support?ticketId=${dispute.ticket_id}`}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          عرض التذكرة
                        </Link>
                      )}
                      {dispute.support_tickets?.chat_room_id && (
                        <Link
                          to={`/support/chats?roomId=${dispute.support_tickets.chat_room_id}`}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                        >
                          <MessageSquare className="w-4 h-4" />
                          فتح المحادثة
                        </Link>
                      )}
                      {onIssuePenalty && (
                        <button
                          onClick={() => {
                            // We don't have the specific user ID here easily, but we can pass null or prompt
                            // For now, let's just open the modal and let the admin search
                            onIssuePenalty('', '', `بناءً على النزاع رقم #${dispute.id}`);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors"
                        >
                          <ShieldAlert className="w-4 h-4" />
                          إصدار جزاء
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-emerald-500" />
                  الأدلة والمرفقات
                </h3>
                {dispute.evidence_urls && Array.isArray(dispute.evidence_urls) && dispute.evidence_urls.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {dispute.evidence_urls.map((url: string, index: number) => (
                      <button 
                        key={index} 
                        onClick={() => window.open(url, '_system')}
                        className="group relative aspect-square rounded-2xl overflow-hidden border border-gray-200 hover:border-emerald-500 transition-all cursor-pointer"
                      >
                        <img src={url} alt={`Evidence ${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ExternalLink className="w-6 h-6 text-white" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl p-8 text-center border border-dashed border-gray-300">
                    <p className="text-gray-400 font-medium">لا توجد مرفقات أو أدلة صورية</p>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Resolution Form */}
            <div className="space-y-6">
              <section className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  اتخاذ القرار
                </h3>
                
                <div className="space-y-6">
                  {/* Ruling Type */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">نوع الحكم</label>
                    <div className="grid grid-cols-2 gap-3">
                      {rulingOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setRulingType(option.id)}
                          className={cn(
                            "px-4 py-3 rounded-xl text-sm font-bold border transition-all",
                            rulingType === option.id 
                              ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm" 
                              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Refund Amount */}
                  {rulingType !== 'No_Refund' && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-3">المبلغ المسترد (ج.م)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                          <DollarSign className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="number"
                          value={refundAmount}
                          onChange={(e) => setRefundAmount(Number(e.target.value))}
                          className="block w-full pr-12 pl-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  )}

                  {/* Deducted From */}
                  {rulingType !== 'No_Refund' && refundAmount > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">الجهة التي تتحمل التكلفة (خصم من)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {deductionOptions.map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setDeductedFrom(option.id)}
                              className={cn(
                                "flex flex-col items-center gap-2 p-2 rounded-xl border transition-all",
                                deductedFrom === option.id 
                                  ? "bg-red-50 border-red-500 text-red-700 shadow-sm" 
                                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                              )}
                            >
                              <option.icon className="w-4 h-4" />
                              <span className="text-[10px] font-bold">{option.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">الجهة المستفيدة (تعويض إلى)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'Customer', label: 'العميل', icon: User },
                            { id: 'Vendor', label: 'المطعم', icon: Store },
                            { id: 'Driver', label: 'المندوب', icon: Truck },
                          ].map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setCompensatedTo(option.id as any)}
                              className={cn(
                                "flex flex-col items-center gap-2 p-2 rounded-xl border transition-all",
                                compensatedTo === option.id 
                                  ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm" 
                                  : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                              )}
                            >
                              <option.icon className="w-4 h-4" />
                              <span className="text-[10px] font-bold">{option.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">ملاحظات القرار</label>
                    <textarea
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                      placeholder="اشرح سبب اتخاذ هذا القرار..."
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={() => resolveMutation.mutate('Rejected')}
            disabled={resolveMutation.isPending || dispute.status !== 'Under_Review'}
            className="px-6 py-3 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition-all disabled:opacity-50"
          >
            رفض النزاع
          </button>
          <button
            onClick={() => resolveMutation.mutate('Resolved')}
            disabled={resolveMutation.isPending || dispute.status !== 'Under_Review'}
            className="px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 active:scale-95 disabled:opacity-50"
          >
            {resolveMutation.isPending ? 'جاري المعالجة...' : 'اعتماد الحل'}
          </button>
        </div>
      </div>
    </div>
  );
}
