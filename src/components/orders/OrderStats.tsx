import React from 'react';
import { RefreshCw, Clock, AlertCircle, Store } from 'lucide-react';

interface OrderStatsProps {
  count: number;
  pendingCount: number;
  delayedCount: number;
  totalSales: string;
}

export const OrderStats: React.FC<OrderStatsProps> = ({ count, pendingCount, delayedCount, totalSales }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <RefreshCw className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-400">إجمالي الطلبات</p>
          <p className="text-2xl font-black text-gray-900">{count}</p>
        </div>
      </div>
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-400">قيد الانتظار</p>
          <p className="text-2xl font-black text-gray-900">{pendingCount}</p>
        </div>
      </div>
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-400">طلبات متأخرة</p>
          <p className="text-2xl font-black text-gray-900">{delayedCount}</p>
        </div>
      </div>
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
          <Store className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-400">إجمالي المبيعات (مكتملة)</p>
          <p className="text-2xl font-black text-gray-900">{totalSales} ج.م</p>
        </div>
      </div>
    </div>
  );
};
