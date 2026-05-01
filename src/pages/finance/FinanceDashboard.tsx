import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, Wallet, ArrowUpRight, ArrowDownRight, Lock, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { financeService } from '../../services/financeService';
import { toast } from 'react-hot-toast';
import { handleGlobalError } from '../../utils/errorHandler';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { Link } from 'react-router-dom';

export default function FinanceDashboard() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'All' | 'customer' | 'driver' | 'vendor'>('All');
  const pageSize = 20;

  // Modal States
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [freezeModal, setFreezeModal] = useState<{ isOpen: boolean; userId: string; currentStatus: boolean }>({
    isOpen: false,
    userId: '',
    currentStatus: false
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['wallet-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('current_balance, locked_balance');
      
      if (error) throw error;

      const total = data.reduce((acc, w) => acc + (Number(w.current_balance) || 0), 0);
      const pending = data.reduce((acc, w) => acc + (Number(w.locked_balance) || 0), 0);

      return { total, pending };
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['wallets', page, searchQuery, userTypeFilter],
    queryFn: async () => {
      let userIds: string[] = [];
      let query = supabase
        .from('wallets')
        .select(`
          *,
          profiles!inner (
            full_name,
            user_type,
            primary_phone
          )
        `, { count: 'exact' })
        .order('current_balance', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (userTypeFilter !== 'All') {
        query = query.eq('profiles.user_type', userTypeFilter);
      }

      if (searchQuery) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id')
          .or(`full_name.ilike.%${searchQuery}%,primary_phone.ilike.%${searchQuery}%`);
        
        if (profiles && profiles.length > 0) {
          userIds = profiles.map(p => p.user_id);
          query = query.in('user_id', userIds);
        } else {
          return { wallets: [], count: 0 };
        }
      }

      const { data, count, error } = await query;
      if (error) throw error;

      return { wallets: data as any[], count };
    },
  });

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet || !adjustmentAmount || !adjustmentReason) return;

    setIsAdjusting(true);
    try {
      const amount = Number(adjustmentAmount);
      const finalAmount = adjustmentType === 'withdrawal' ? -amount : amount;
      
      await financeService.adjustWalletBalance(
        selectedWallet.user_id,
        finalAmount,
        'admin_adjustment',
        adjustmentReason
      );

      toast.success('تم تعديل الرصيد بنجاح');
      queryClient.invalidateQueries({ queryKey: ['wallets'] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['wallet-stats'] }).catch(console.error);
      setSelectedWallet(null);
      setAdjustmentAmount('');
      setAdjustmentReason('');
    } catch (error: any) {
      handleGlobalError(error, 'تعديل رصيد المحفظة');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleToggleFreeze = async () => {
    const { userId, currentStatus } = freezeModal;
    const action = currentStatus ? 'إلغاء تجميد' : 'تجميد';

    try {
      await financeService.toggleWalletFreeze(userId, !currentStatus);
      
      toast.success(`تم ${action} المحفظة بنجاح`);
      queryClient.invalidateQueries({ queryKey: ['wallets'] }).catch(console.error);
      setFreezeModal({ ...freezeModal, isOpen: false });
    } catch (error: any) {
      handleGlobalError(error, `${action} المحفظة`);
    }
  };

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case 'customer': return 'عميل';
      case 'driver': return 'سائق';
      case 'vendor': return 'تاجر';
      case 'admin': return 'مسؤول';
      default: return type;
    }
  };

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-100 rounded-2xl shadow-sm">
            <Wallet className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">المالية والمحافظ</h2>
            <p className="mt-1 text-gray-500 font-medium">إدارة أرصدة المستخدمين ومراقبة السيولة المالية.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative group flex-1 sm:w-72">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="بحث بالاسم أو الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium transition-all"
            />
          </div>

          <div className="relative flex-1 sm:w-56">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={userTypeFilter}
              onChange={(e) => setUserTypeFilter(e.target.value as any)}
              className="block w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold appearance-none transition-all"
            >
              <option value="All">جميع المستخدمين</option>
              <option value="customer">العملاء</option>
              <option value="driver">السائقين</option>
              <option value="vendor">التجار</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-emerald-50 rounded-2xl group-hover:scale-110 transition-transform">
              <Wallet className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">إجمالي الأرصدة</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">
                {isStatsLoading ? '...' : `${(stats?.total || 0).toLocaleString()} ج.م`}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-red-50 rounded-2xl group-hover:scale-110 transition-transform">
              <Lock className="h-8 w-8 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">الأرصدة المعلقة</p>
              <h3 className="text-2xl font-black text-gray-900 mt-1">
                {isStatsLoading ? '...' : `${(stats?.pending || 0).toLocaleString()} ج.م`}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-sm overflow-hidden sm:rounded-3xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  المستخدم
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  نوع المستخدم
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  الرصيد الحالي
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  الرصيد المعلق
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  حالة المحفظة
                </th>
                <th scope="col" className="px-8 py-5 text-center text-xs font-bold text-gray-500 uppercase tracking-widest">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-gray-500 font-medium">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    </div>
                  </td>
                </tr>
              ) : data?.wallets?.length === 0 ? (
                <tr key="empty-wallets">
                  <td colSpan={6} className="px-8 py-12 text-center text-gray-500 font-medium">
                    لا توجد محافظ تطابق معايير البحث
                  </td>
                </tr>
              ) : (
                data?.wallets?.map((wallet, idx) => (
                  <tr key={wallet.user_id || `wallet-${idx}`} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform border border-gray-100">
                          <span className="text-gray-600 font-black text-lg">
                            {wallet.profiles?.full_name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-bold text-gray-900">{wallet.profiles?.full_name || 'مستخدم غير معروف'}</div>
                          <div className="text-xs text-gray-400 font-medium mt-0.5" dir="ltr">{wallet.profiles?.primary_phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                        {getUserTypeLabel(wallet.profiles?.user_type)}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className={cn(
                        "text-sm font-black",
                        wallet.current_balance > 0 ? "text-green-600" : wallet.current_balance < 0 ? "text-red-600" : "text-gray-900"
                      )}>
                        {wallet.current_balance.toFixed(2)} {wallet.currency}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-700">
                        {wallet.locked_balance.toFixed(2)} {wallet.currency}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border",
                        wallet.is_frozen ? "bg-red-100 text-red-700 border-red-200" : "bg-green-100 text-green-700 border-green-200"
                      )}>
                        {wallet.is_frozen ? 'مجمدة' : 'نشطة'}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-center space-x-2 space-x-reverse">
                      <button 
                        onClick={() => setSelectedWallet(wallet)}
                        className="inline-flex items-center px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all border border-emerald-100"
                      >
                        تعديل الرصيد
                      </button>
                      <button 
                        onClick={() => setFreezeModal({ isOpen: true, userId: wallet.user_id, currentStatus: wallet.is_frozen })}
                        className={cn(
                          "inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                          wallet.is_frozen 
                            ? "bg-green-50 text-green-600 border-green-100 hover:bg-green-100" 
                            : "bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
                        )}
                      >
                        {wallet.is_frozen ? 'إلغاء التجميد' : 'تجميد'}
                      </button>
                      <Link 
                        to={`/finance/transactions?userId=${wallet.user_id}`}
                        className="inline-flex items-center px-4 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl text-xs font-bold transition-all border border-gray-100"
                      >
                        عرض المعاملات
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {data?.count && data.count > pageSize && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                السابق
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= data.count}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                التالي
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  عرض <span className="font-medium">{page * pageSize + 1}</span> إلى <span className="font-medium">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-medium">{data.count}</span> محفظة
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    السابق
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * pageSize >= data.count}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    التالي
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={freezeModal.isOpen}
        onClose={() => setFreezeModal({ ...freezeModal, isOpen: false })}
        onConfirm={handleToggleFreeze}
        title={freezeModal.currentStatus ? 'إلغاء تجميد المحفظة' : 'تجميد المحفظة'}
        message={freezeModal.currentStatus 
          ? 'هل أنت متأكد من رغبتك في إلغاء تجميد هذه المحفظة؟ سيتمكن المستخدم من إجراء المعاملات مرة أخرى.' 
          : 'هل أنت متأكد من رغبتك في تجميد هذه المحفظة؟ لن يتمكن المستخدم من إجراء أي معاملات حتى يتم إلغاء التجميد.'
        }
        type={freezeModal.currentStatus ? 'info' : 'danger'}
        confirmText={freezeModal.currentStatus ? 'إلغاء التجميد' : 'تجميد'}
      />

      {/* Adjustment Modal */}
      {selectedWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000B3] ">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-black text-gray-900">تعديل رصيد المحفظة</h3>
              <button onClick={() => setSelectedWallet(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAdjustment} className="p-6 space-y-5">
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                <p className="text-xs font-bold text-emerald-700 mb-1">المستخدم الحالي</p>
                <p className="text-sm font-black text-emerald-900">{selectedWallet.profiles?.full_name}</p>
                <p className="text-xs text-emerald-600 mt-1">الرصيد الحالي: {selectedWallet.current_balance.toFixed(2)} ج.م</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">نوع التعديل</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('deposit')}
                    className={cn(
                      "py-3 px-4 rounded-xl text-sm font-bold border transition-all",
                      adjustmentType === 'deposit' 
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200" 
                        : "bg-white text-gray-600 border-gray-200 hover:border-emerald-200"
                    )}
                  >
                    إيداع (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('withdrawal')}
                    className={cn(
                      "py-3 px-4 rounded-xl text-sm font-bold border transition-all",
                      adjustmentType === 'withdrawal' 
                        ? "bg-red-600 text-white border-red-600 shadow-lg shadow-red-200" 
                        : "bg-white text-gray-600 border-gray-200 hover:border-red-200"
                    )}
                  >
                    سحب (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">سبب التعديل</label>
                <textarea
                  required
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="block w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium h-24 resize-none"
                  placeholder="اكتب سبب التعديل هنا..."
                />
              </div>

              <button
                type="submit"
                disabled={isAdjusting}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-lg hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 disabled:opacity-50"
              >
                {isAdjusting ? 'جاري المعالجة...' : 'تأكيد التعديل'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
