import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { X, Search, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  onAdd: (product: any) => void;
}

export default function AddProductModal({ isOpen, onClose, vendorId, onAdd }: AddProductModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: products, isLoading } = useQuery({
    queryKey: ['vendor-products', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_available', true);
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!vendorId,
  });

  const filteredProducts = products?.filter(p => 
    p.name_ar.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
        >
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-black text-lg text-gray-900">إضافة منتج</h3>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="ابحث عن منتج..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500 font-bold">جاري التحميل...</div>
            ) : filteredProducts?.length === 0 ? (
              <div className="p-8 text-center text-gray-500 font-bold">لا توجد منتجات مطابقة</div>
            ) : (
              <div className="space-y-2">
                {filteredProducts?.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-colors">
                    <div>
                      <h4 className="font-bold text-gray-900">{product.name_ar}</h4>
                      <p className="text-sm text-emerald-600 font-black">{product.base_price} ج.م</p>
                    </div>
                    <button
                      onClick={() => onAdd(product)}
                      className="p-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
