import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Filter, ArrowUpRight, ArrowDownLeft, Clock, Wallet, User, X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { handleGlobalError } from '../../utils/errorHandler';

export default function TransactionsList() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialUserId = searchParams.get('userId') || '';
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{tx: any, action: 'approve' | 'reject'} | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const pageSize = 20;

  const handleActionMutation = useMutation({
    mutationFn: async ({ tx, action, amount }: { tx: any, action: 'approve' | 'reject', amount?: number }) => {
      if (action === 'approve') {
        const approvedAmount = amount || 0;
        // 1. Update status to approved
        const { error: txError } = await supabase
          .from('wallets_transaction')
          .update({ 
            transaction_type: 'topup', 
            description_ar: tx.description_ar + ' (تم القبول)',
            amount: approvedAmount
          })
          .eq('transaction_id', tx.transaction_id);
        if (txError) throw txError;

        // 2. Add to wallet
        const { data: wallet } = await supabase
          .from('wallets')
          .select('current_balance')
          .eq('user_id', tx.wallet_id)
          .single();
        
        const newBalance = (Number(wallet?.current_balance) || 0) + approvedAmount;
        
        const { error: walletError } = await supabase
          .from('wallets')
          .update({ current_balance: newBalance })
          .eq('user_id', tx.wallet_id);
        if (walletError) throw walletError;
      } else {
        // Reject: Remove request (mark as rejected)
        const { error: txError } = await supabase
          .from('wallets_transaction')
          .update({ transaction_type: 'deposit_rejected', description_ar: tx.description_ar + ' (تم الرفض)' })
          .eq('transaction_id', tx.transaction_id);
        if (txError) throw txError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setConfirmAction(null);
      setDepositAmount('');
    },
    onError: (error) => {
      handleGlobalError(error, 'خطأ في تنفيذ الإجراء');
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', page, searchQuery, typeFilter, initialUserId],
    queryFn: async () => {
      try {
        let walletIds: string[] = [];
        if (searchQuery) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id')
            .or(`full_name.ilike.%${searchQuery}%,primary_phone.ilike.%${searchQuery}%`);
          
          if (profiles && profiles.length > 0) {
            walletIds = profiles.map(p => p.user_id);
          }
        }

        let query = supabase
          .from('wallets_transaction')
          .select(`
            *,
            wallets!wallet_id (
              profiles!user_id (full_name, user_type, avatar_url)
            ),
            master_orders!reference_id (order_number)
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (initialUserId) {
          query = query.eq('wallet_id', initialUserId);
        }

        if (searchQuery) {
          if (walletIds.length > 0) {
            query = query.or(`description_ar.ilike.%${searchQuery}%,wallet_id.in.(${walletIds.join(',')})`);
          } else {
            query = query.or(`description_ar.ilike.%${searchQuery}%`);
          }
        }

        if (typeFilter !== 'All') {
          query = query.eq('transaction_type', typeFilter);
        }

        const { data, count, error } = await query;
        if (error) throw error;
        return { transactions: data, count };
      } catch (error) {
        handleGlobalError(error, 'تحميل سجل المعاملات');
        throw error;
      }
    },
  });

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'order_payment': return 'دفع طلب';
      case 'delivery_fee': return 'رسوم توصيل';
      case 'commission': return 'عمولة';
      case 'refund': return 'استرداد';
      case 'topup': return 'شحن رصيد';
      case 'driver_payment_to_vendor': return 'دفع السائق للتاجر';
      case 'driver_collection_from_customer': return 'تحصيل السائق من العميل';
      case 'delivery_earnings': return 'أرباح التوصيل';
      case 'admin_adjustment': return 'تعديل إداري';
      case 'transfer_out': return 'تحويل للخارج';
      case 'transfer_in': return 'تحويل للداخل';
      case 'penalty': return 'جزاء';
      case 'vendor_commission': return 'عمولة تاجر';
      case 'vendor_lock': return 'تجميد رصيد تاجر';
      case 'vendor_unlock': return 'فك تجميد رصيد تاجر';
      case 'cash_debt_platform_to_driver': return 'مديونية نقدية (منصة لسائق)';
      case 'cash_debt_driver_to_platform': return 'مديونية نقدية (سائق لمنصة)';
      case 'cash_settlement': return 'تسوية نقدية';
      case 'cancellation_compensation_vendor': return 'تعويض إلغاء (تاجر)';
      case 'cancellation_compensation_driver': return 'تعويض إلغاء (سائق)';
      case 'vendor_rejection_penalty': return 'غرامة رفض (تاجر)';
      case 'refund_pending': return 'استرداد معلق';
      case 'refund_approved': return 'استرداد معتمد';
      case 'refund_denied': return 'استرداد مرفوض';
      case 'vendor_commission_deduction': return 'خصم عمولة تاجر';
      case 'vendor_online_payment': return 'دفع إلكتروني (تاجر)';
      case 'deposit_pending': return 'إيداع معلق';
      case 'deposit_rejected': return 'إيداع مرفوض';
      case 'vendor_cancellation_deduction': return 'خصم إلغاء (تاجر)';
      case 'vendor_cash_payment': return 'دفع نقدي (تاجر)';
      case 'deposit_approved': return 'إيداع معتمد';
      default: return type;
    }
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (amount > 0) return <ArrowUpRight className="w-4 h-4 text-green-600" />;
    return <ArrowDownLeft className="w-4 h-4 text-red-600" />;
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
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">سجل المعاملات المالية</h2>
            <p className="mt-1 text-gray-500 font-medium">تتبع جميع حركات الأموال في المحافظ.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative group flex-1 sm:w-72">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="بحث بالوصف..."
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium transition-all"
            />
          </div>

          <div className="relative flex-1 sm:w-56">
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-full pr-12 pl-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold appearance-none transition-all"
            >
              <option value="All">جميع الأنواع</option>
              <option value="order_payment">دفع طلب</option>
              <option value="delivery_fee">رسوم توصيل</option>
              <option value="commission">عمولة</option>
              <option value="refund">استرداد</option>
              <option value="topup">شحن رصيد</option>
              <option value="penalty">جزاء</option>
              <option value="admin_adjustment">تعديل إداري</option>
              <option value="cash_settlement">تسوية نقدية</option>
              <option value="deposit_pending">إيداع معلق</option>
            </select>
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
                  النوع
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  المبلغ
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  الرصيد بعد
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  الوصف / المرجع
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  إثبات الدفع
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  التاريخ
                </th>
                <th scope="col" className="px-8 py-5 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-8 py-12 text-center text-gray-500 font-medium">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                    </div>
                  </td>
                </tr>
              ) : data?.transactions?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-8 py-12 text-center text-gray-500 font-medium">
                    لا توجد معاملات مالية حالياً
                  </td>
                </tr>
              ) : (
                data?.transactions?.map((tx) => (
                  <tr key={tx.transaction_id} className="hover:bg-gray-50 transition-colors group even:bg-gray-50">
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden border border-gray-100">
                          {(tx.wallets as any)?.profiles?.avatar_url ? (
                            <img 
                              src={(tx.wallets as any).profiles.avatar_url} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <div className="mr-4">
                          <div className="text-sm font-bold text-gray-900">
                            {(tx.wallets as any)?.profiles?.full_name || 'مستخدم غير معروف'}
                          </div>
                          <div className="text-xs text-gray-400 font-medium mt-0.5">
                            {(tx.wallets as any)?.profiles?.user_type === 'driver' ? 'سائق' : (tx.wallets as any)?.profiles?.user_type === 'vendor' ? 'تاجر' : 'عميل'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {getTransactionTypeLabel(tx.transaction_type)}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className={cn(
                        "text-sm font-black flex items-center gap-1.5",
                        tx.amount > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {getTransactionIcon(tx.transaction_type, tx.amount)}
                        {(tx.amount || 0).toFixed(2)} ج.م
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-gray-900">
                      {(tx.balance_after || 0).toFixed(2)} ج.م
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-sm font-medium text-gray-700 max-w-xs truncate">{tx.description_ar}</div>
                      {tx.master_orders && (
                        <div className="text-xs text-emerald-600 font-bold mt-1 bg-emerald-50 inline-block px-2 py-0.5 rounded-lg">مرجع: طلب #{(tx.master_orders as any).order_number}</div>
                      )}
                      {tx.requested_amount && (
                        <div className="text-xs text-gray-400 font-medium mt-1">المبلغ المطلوب: {tx.requested_amount} ج.م</div>
                      )}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm">
                      {tx.proof_url ? (
                        <a 
                          href={tx.proof_url}
                          target="_system"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 font-bold underline underline-offset-4 decoration-2 cursor-pointer"
                        >
                          عرض الإثبات
                        </a>
                      ) : (
                        <span className="text-gray-300 font-medium">-</span>
                      )}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2 font-medium">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{format(new Date(tx.created_at), 'PPp', { locale: ar })}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-sm">
                      {tx.transaction_type === 'deposit_pending' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setConfirmAction({ tx, action: 'approve' });
                              setDepositAmount(tx.amount > 0 ? tx.amount.toString() : '');
                            }}
                            className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setConfirmAction({ tx, action: 'reject' })}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
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
                  عرض <span className="font-medium">{page * pageSize + 1}</span> إلى <span className="font-medium">{Math.min((page + 1) * pageSize, data.count)}</span> من أصل <span className="font-medium">{data.count}</span> معاملة
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

      {/* Proof Image Modal */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#000000B3] " onClick={() => setSelectedProofUrl(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedProofUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors bg-[#FFFFFF80] rounded-full hover:bg-[#FFFFFF80]"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={selectedProofUrl} 
              alt="إثبات الدفع" 
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                window.open(selectedProofUrl, '_system');
                setSelectedProofUrl(null);
              }}
            />
            <div className="mt-6 flex gap-4">
              <button 
                onClick={() => window.open(selectedProofUrl, '_system')}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg"
              >
                فتح في المتصفح
              </button>
              <button 
                onClick={() => setSelectedProofUrl(null)}
                className="px-6 py-2.5 bg-[#FFFFFF80] text-white rounded-xl font-bold hover:bg-[#FFFFFF80] transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#000000B3] " onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-extrabold text-gray-900 mb-4">
              {confirmAction.action === 'approve' ? 'تأكيد قبول الإيداع' : 'تأكيد رفض الإيداع'}
            </h3>
            <p className="text-gray-500 font-medium mb-6">
              {confirmAction.action === 'approve' 
                ? 'الرجاء إدخال المبلغ النهائي الذي سيتم إيداعه في محفظة المستخدم:'
                : 'هل أنت متأكد من رفض هذا الطلب؟'}
            </p>
            
            {confirmAction.action === 'approve' && (
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">المبلغ المودع (ج.م)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold text-gray-900 text-left"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmAction(null)}
                disabled={handleActionMutation.isPending}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button 
                onClick={() => handleActionMutation.mutate({
                  tx: confirmAction.tx,
                  action: confirmAction.action,
                  amount: confirmAction.action === 'approve' ? Number(depositAmount) : undefined
                })}
                disabled={
                  handleActionMutation.isPending || 
                  (confirmAction.action === 'approve' && (Number(depositAmount) <= 0 || isNaN(Number(depositAmount))))
                }
                className={cn(
                  "flex-1 px-6 py-3 rounded-2xl font-bold transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed",
                  confirmAction.action === 'approve' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                )}
              >
                {handleActionMutation.isPending ? 'جاري...' : (confirmAction.action === 'approve' ? 'قبول وإيداع' : 'رفض')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
