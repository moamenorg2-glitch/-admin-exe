import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Search, Star, User, ShoppingBag, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '../../lib/utils';

export default function ReviewsList() {
  const [page, setPage] = useState(0);
  const [ratingFilter, setRatingFilter] = useState<'All' | '1' | '2' | '3' | '4' | '5'>('All');
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', page, ratingFilter],
    queryFn: async () => {
      let query = supabase
        .from('reviews')
        .select(`
          *,
          master_orders:order_id (
            order_number,
            customer_id,
            profiles:customer_id (full_name)
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (ratingFilter !== 'All') {
        const rating = parseInt(ratingFilter);
        query = query.or(`vendor_rating.eq.${rating},driver_rating.eq.${rating}`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      return { reviews: data as any[], count };
    },
  });

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "w-4 h-4",
              star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">تقييمات العملاء</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Star className="h-4 w-4 text-gray-400" />
            </div>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value as any)}
              className="block w-full sm:w-48 pr-10 border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm border py-2 pl-3"
            >
              <option value="All">جميع التقييمات</option>
              <option value="5">5 نجوم</option>
              <option value="4">4 نجوم</option>
              <option value="3">3 نجوم</option>
              <option value="2">2 نجوم</option>
              <option value="1">نجمة واحدة</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))
        ) : data?.reviews?.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
            لا توجد تقييمات حالياً
          </div>
        ) : (
          data?.reviews?.map((review) => (
            <div key={review.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-100 p-2 rounded-full">
                    <User className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">
                      {review.master_orders?.profiles?.full_name || 'عميل مجهول'}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3" />
                      <span>طلب #{review.master_orders?.order_number}</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{format(new Date(review.created_at), 'dd MMM yyyy', { locale: ar })}</span>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">تقييم المتجر:</span>
                  {renderStars(review.vendor_rating)}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">تقييم السائق:</span>
                  {renderStars(review.driver_rating)}
                </div>
              </div>

              {review.comment && (
                <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700 italic border-r-4 border-emerald-400">
                  "{review.comment}"
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {data?.count && data.count > pageSize && (
        <div className="flex justify-center mt-8">
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              السابق
            </button>
            <div className="px-4 py-2 border-t border-b border-gray-300 bg-gray-50 text-sm font-medium text-gray-700">
              صفحة {page + 1}
            </div>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * pageSize >= data.count}
              className="relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              التالي
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
