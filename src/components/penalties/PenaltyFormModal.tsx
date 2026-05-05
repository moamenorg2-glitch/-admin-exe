import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { X, ShieldAlert, Search, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { financeService } from '../../services/financeService';

interface PenaltyFormModalProps {
  onClose: () => void;
  initialUserId?: string;
  initialUserName?: string;
  initialReason?: string;
}

export default function PenaltyFormModal({ onClose, initialUserId, initialUserName, initialReason }: PenaltyFormModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState(initialUserName || '');
  const [selectedUser, setSelectedUser] = useState<any>(initialUserId ? { user_id: initialUserId, full_name: initialUserName || 'مستخدم محدد' } : null);
  const [category, setCategory] = useState('سلوك غير لائق');
  const [amount, setAmount] = useState(0);
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspensionDays, setSuspensionDays] = useState(1);
  const [reason, setReason] = useState(initialReason || '');

  // Search users
  const { data: users, isLoading: isSearching } = useQuery({
    queryKey: ['users-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 3) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, primary_phone, user_type, avatar_url')
        .or(`full_name.ilike.%${searchQuery}%,primary_phone.ilike.%${searchQuery}%`)
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: searchQuery.length >= 3,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error('يجب اختيار مستخدم');
      if (!reason) throw new Error('يجب كتابة سبب الجزاء');

      // 1. Insert penalty
      const { error: penaltyError } = await supabase
        .from('admin_penalties')
        .insert({
          target_user_id: selectedUser.user_id,
          penalty_category: category,
          penalty_amount: amount,
          is_account_suspended: isSuspended,
          suspension_days: isSuspended ? suspensionDays : null,
          official_reason: reason
        })
        .select()
        .single();

      if (penaltyError) throw penaltyError;

      // 2. Process wallet deduction if amount > 0
      if (amount > 0) {
        try {
          await financeService.adjustWalletBalance(
            selectedUser.user_id,
            -amount, // Negative for deduction
            'penalty',
            `خصم جزاء إداري: ${category}`
          );
        } catch (walletError: any) {
          console.error('Wallet transaction failed:', walletError);
          toast.error('تم تسجيل الجزاء ولكن فشل خصم المبلغ من المحفظة');
        }
      }

      // 3. Update user status if suspended
      if (isSuspended) {
        const { error: userError } = await supabase
          .from('profiles')
          .update({ status: 'موقوف' })
          .eq('user_id', selectedUser.user_id);
          
        if (userError) console.error('Failed to suspend user:', userError);
      }
    },
    onSuccess: () => {
      toast.success('تم تسجيل الجزاء بنجاح');
      queryClient.invalidateQueries({ queryKey: ['penalties'] }).catch(console.error);
      onClose();
    },
    onError: (error: any) => {
      console.error('Error creating penalty:', error);
      toast.error(error.message || 'حدث خطأ أثناء تسجيل الجزاء');
    }
  });

  const categories = [
    { id: 'سلوك غير لائق', label: 'سلوك غير لائق' },
    { id: 'تأخير متكرر', label: 'تأخير متكرر' },
    { id: 'تلاعب باللوكيشن', label: 'تلاعب باللوكيشن' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000B3] " dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">إضافة جزاء جديد</h2>
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
          
          {/* User Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">المستخدم المستهدف *</label>
            {!selectedUser ? (
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الهاتف (3 أحرف على الأقل)..."
                  className="block w-full pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                
                {/* Search Results */}
                {searchQuery.length >= 3 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {isSearching ? (
                      <div className="p-4 text-center text-sm text-gray-500">جاري البحث...</div>
                    ) : users && users.length > 0 ? (
                      <ul className="divide-y divide-gray-100">
                        {users.map((user) => (
                          <li 
                            key={user.user_id}
                            onClick={() => setSelectedUser(user)}
                            className="p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors"
                          >
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <User className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">{user.full_name}</div>
                              <div className="text-xs text-gray-500">{user.primary_phone} - {user.user_type}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-center text-sm text-gray-500">لا توجد نتائج</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center overflow-hidden border border-emerald-200">
                    {selectedUser.avatar_url ? (
                      <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{selectedUser.full_name}</div>
                    <div className="text-xs text-gray-500">{selectedUser.primary_phone} - {selectedUser.user_type}</div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery('');
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  تغيير
                </button>
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">فئة الجزاء *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">مبلغ الغرامة (ج.م)</label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="0.00"
            />
            <p className="mt-1 text-xs text-gray-500">اتركه 0 إذا كان الجزاء إداري فقط بدون غرامة مالية.</p>
          </div>

          {/* Suspension */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isSuspended}
                onChange={(e) => setIsSuspended(e.target.checked)}
                className="w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
              />
              <span className="text-sm font-bold text-gray-900">تعليق الحساب (إيقاف مؤقت)</span>
            </label>
            
            {isSuspended && (
              <div className="pl-8">
                <label className="block text-xs font-medium text-gray-700 mb-1">مدة التعليق (بالأيام)</label>
                <input
                  type="number"
                  min="1"
                  value={suspensionDays}
                  onChange={(e) => setSuspensionDays(Number(e.target.value))}
                  className="block w-full md:w-1/2 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">السبب الرسمي (يظهر للمستخدم) *</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              placeholder="اكتب تفاصيل المخالفة وسبب الجزاء..."
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !selectedUser || !reason}
            className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95 disabled:opacity-50"
          >
            {submitMutation.isPending ? 'جاري الحفظ...' : 'اعتماد الجزاء'}
          </button>
        </div>
      </div>
    </div>
  );
}
