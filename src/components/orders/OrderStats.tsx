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
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
        <div className="p-3 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-2xl flex-shrink-0">
          <RefreshCw className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-500 dark:text-slate-400 truncate">إجمالي الطلبات</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white truncate">{count}</p>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
        <div className="p-3 bg-amber-50 dark:bg-amber-900 text-amber-600 dark:text-amber-400 rounded-2xl flex-shrink-0">
          <Clock className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-500 dark:text-slate-400 truncate">قيد الانتظار</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white truncate">{pendingCount}</p>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm flex items-center gap-4 transition-colors">
        <div className="p-3 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-2xl flex-shrink-0">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-500 dark:text-slate-400 truncate">طلبات متأخرة</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white truncate">{delayedCount}</p>
        </div>
      </div>
      <div className="bg-gray-900 dark:bg-emerald-900 p-5 rounded-3xl border border-gray-800 dark:border-emerald-800 shadow-md flex items-center gap-4 relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFFFFF80] rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="p-3 bg-[#FFFFFF80] dark:bg-emerald-800 text-white rounded-2xl flex-shrink-0 relative z-10 ">
          <Store className="w-6 h-6" />
        </div>
        <div className="min-w-0 relative z-10">
          <p className="text-sm font-bold text-gray-300 dark:text-emerald-100 truncate">إجمالي المبيعات (مكتملة)</p>
          <p className="text-2xl font-black text-white truncate">{totalSales} ج.م</p>
        </div>
      </div>
    </div>
  );
};
