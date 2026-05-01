import { X, ShieldAlert, User, Clock, DollarSign, FileText, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PenaltyDetailsModalProps {
  penalty: any;
  onClose: () => void;
}

export default function PenaltyDetailsModal({ penalty, onClose }: PenaltyDetailsModalProps) {
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'Late_Delivery': return 'تأخير التوصيل';
      case 'Order_Cancellation': return 'إلغاء الطلب';
      case 'Customer_Complaint': return 'شكوى عميل';
      case 'Policy_Violation': return 'مخالفة السياسات';
      case 'Fraud_Attempt': return 'محاولة احتيال';
      default: return category;
    }
  };

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case 'customer': return 'عميل';
      case 'driver': return 'سائق';
      case 'vendor': return 'تاجر';
      default: return type;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000B3] " dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">تفاصيل الجزاء</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Target User */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              المستخدم المستهدف
            </h3>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-full border border-gray-200 flex items-center justify-center overflow-hidden">
                {penalty.profiles?.avatar_url ? (
                  <img src={penalty.profiles.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <div className="font-bold text-gray-900 text-lg">{penalty.profiles?.full_name}</div>
                <div className="text-sm text-gray-500">
                  {getUserTypeLabel(penalty.profiles?.user_type)} • {penalty.profiles?.primary_phone}
                </div>
              </div>
            </div>
          </section>

          {/* Penalty Info */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
              <div className="text-xs font-bold text-red-600 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                فئة المخالفة
              </div>
              <div className="font-bold text-gray-900 text-lg">
                {getCategoryLabel(penalty.penalty_category)}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                تاريخ التسجيل
              </div>
              <div className="font-bold text-gray-900">
                {format(new Date(penalty.created_at), 'PPp', { locale: ar })}
              </div>
            </div>
          </section>

          {/* Financial & Suspension */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                الغرامة المالية
              </div>
              <div className="font-black text-xl text-red-600">
                {penalty.penalty_amount > 0 ? `-${penalty.penalty_amount.toFixed(2)} ج.م` : 'لا توجد غرامة'}
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                <ShieldAlert className="w-4 h-4" />
                حالة الحساب
              </div>
              <div className="font-bold text-gray-900">
                {penalty.is_account_suspended ? (
                  <span className="text-red-600">معلق لمدة {penalty.suspension_days} يوم</span>
                ) : (
                  <span className="text-emerald-600">نشط (لم يتم التعليق)</span>
                )}
              </div>
            </div>
          </section>

          {/* Reason */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              السبب الرسمي
            </h3>
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <p className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                {penalty.official_reason}
              </p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 active:scale-95"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
