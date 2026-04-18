import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { X, Scale, Search, ShoppingBag } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';

interface DisputeFormModalProps {
  onClose: () => void;
}

export default function DisputeFormModal({ onClose }: DisputeFormModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [reason, setReason] = useState('');

  // Search orders
  const { data: orders, isLoading: isSearching } = useQuery({
    queryKey: ['orders-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 3) return [];
      const { data, error } = await (supabase as any)
        .from('master_orders')
        .select('id, order_number, status, grand_total, profiles:customer_id(full_name)')
        .eq('order_number', Number(searchQuery))
        .limit(5);
      
      if (error) {
        // If it's not a number, try searching by customer name (requires a join, but let's keep it simple and just search by order number for now)
        return [];
      }
      return data;
    },
    enabled: searchQuery.length >= 3 && !isNaN(Number(searchQuery)),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error('يجب اختيار طلب');
      if (!reason) throw new Error('يجب كتابة سبب النزاع');

      // 1. Create a support ticket first since disputes require a ticket_id
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          ticket_number: `TKT-${Math.floor(Math.random() * 1000000)}`,
          order_id: selectedOrder.id,
          subject: `نزاع إداري: طلب #${selectedOrder.order_number}`,
          description: reason,
          status: 'In_Progress',
          priority: 'High'
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // 2. Create the dispute
      const { error: disputeError } = await supabase
        .from('dispute_resolution')
        .insert({
          ticket_id: ticket.id,
          order_id: selectedOrder.id,
          status: 'Under_Review'
        });

      if (disputeError) throw disputeError;
    },
    onSuccess: () => {
      toast.success('تم فتح النزاع بنجاح');
      queryClient.invalidateQueries({ queryKey: ['disputes'] }).catch(console.error);
      onClose();
    },
    onError: (error: any) => {
      console.error('Error creating dispute:', error);
      toast.error(error.message || 'حدث خطأ أثناء فتح النزاع');
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Scale className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">فتح نزاع جديد</h2>
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
          
          {/* Order Selection */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">رقم الطلب المرتبط *</label>
            {!selectedOrder ? (
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث برقم الطلب (مثال: 1001)..."
                  className="block w-full pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                
                {/* Search Results */}
                {searchQuery.length >= 3 && !isNaN(Number(searchQuery)) && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {isSearching ? (
                      <div className="p-4 text-center text-sm text-gray-500">جاري البحث...</div>
                    ) : orders && orders.length > 0 ? (
                      <ul className="divide-y divide-gray-100">
                        {orders.map((order) => (
                          <li 
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className="p-3 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors"
                          >
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <ShoppingBag className="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                              <div className="text-sm font-bold text-gray-900">طلب #{order.order_number}</div>
                              <div className="text-xs text-gray-500">{order.profiles?.full_name} - {order.grand_total} ج.م</div>
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
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">طلب #{selectedOrder.order_number}</div>
                    <div className="text-xs text-gray-500">{selectedOrder.profiles?.full_name} - {selectedOrder.grand_total} ج.م</div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedOrder(null);
                    setSearchQuery('');
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  تغيير
                </button>
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">سبب النزاع والملاحظات *</label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              placeholder="اكتب تفاصيل النزاع وسبب فتحه إدارياً..."
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
            disabled={submitMutation.isPending || !selectedOrder || !reason}
            className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50"
          >
            {submitMutation.isPending ? 'جاري الحفظ...' : 'فتح النزاع'}
          </button>
        </div>
      </div>
    </div>
  );
}
