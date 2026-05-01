import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

interface EditModifiersModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  productId: string;
  currentModifiers: any;
  onUpdate: (modifiers: any) => void;
  isUpdating: boolean;
}

export const EditModifiersModal: React.FC<EditModifiersModalProps> = ({
  isOpen,
  onClose,
  itemId,
  productId,
  currentModifiers,
  onUpdate,
  isUpdating
}) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<any>(currentModifiers || {});

  useEffect(() => {
    if (isOpen && productId) {
      fetchModifiers();
      setSelectedOptions(currentModifiers || {});
    }
  }, [isOpen, productId, currentModifiers]);

  const fetchModifiers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('modifier_groups')
        .select(`
          *,
          options:modifier_options(*)
        `)
        .eq('product_id', productId);

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching modifiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOption = (group: any, option: any) => {
    const newSelected = { ...selectedOptions };
    const optionKey = option.id;

    if (newSelected[optionKey]) {
      delete newSelected[optionKey];
    } else {
      // Check max selection for the group
      const groupOptions = group.options.map((o: any) => o.id);
      const selectedInGroup = Object.keys(newSelected).filter(id => groupOptions.includes(id));

      if (group.max_selection && selectedInGroup.length >= group.max_selection) {
        if (group.max_selection === 1) {
          // Replace if single selection
          selectedInGroup.forEach(id => delete newSelected[id]);
        } else {
          // Don't allow more
          return;
        }
      }

      newSelected[optionKey] = {
        id: option.id,
        name_ar: option.name_ar,
        price: option.price
      };
    }

    setSelectedOptions(newSelected);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#000000B3] ">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-600 text-white">
            <div>
              <h3 className="text-xl font-black">تعديل الإضافات</h3>
              <p className="text-emerald-100 text-xs mt-1 font-bold">اختر الإضافات المطلوبة للمنتج</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#FFFFFF80] rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                <p className="text-gray-400 font-bold">جاري تحميل الإضافات...</p>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 font-bold">لا توجد إضافات متاحة لهذا المنتج</p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.id} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-gray-900 flex items-center gap-2">
                      {group.title_ar}
                      {group.min_selection > 0 && (
                        <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full">إجباري</span>
                      )}
                    </h4>
                    <span className="text-[10px] text-gray-400 font-bold">
                      {group.max_selection === 1 ? 'اختر واحد' : `بحد أقصى ${group.max_selection || 'غير محدود'}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {group.options?.map((option: any) => {
                      const isSelected = !!selectedOptions[option.id];
                      return (
                        <button
                          key={option.id}
                          onClick={() => toggleOption(group, option)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-right",
                            isSelected 
                              ? "border-emerald-600 bg-emerald-50" 
                              : "border-gray-100 hover:border-emerald-200 bg-white"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors",
                              isSelected ? "bg-emerald-600 border-emerald-600" : "border-gray-200"
                            )}>
                              {isSelected && <Check className="w-4 h-4 text-white" />}
                            </div>
                            <div>
                              <p className={cn("font-bold text-sm", isSelected ? "text-emerald-900" : "text-gray-700")}>
                                {option.name_ar}
                              </p>
                              {option.price > 0 && (
                                <p className="text-xs text-emerald-600 font-black mt-0.5">
                                  +{option.price.toFixed(2)} ج.م
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-4 px-6 rounded-2xl font-black text-gray-500 hover:bg-gray-100 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={() => onUpdate(selectedOptions)}
              disabled={isUpdating || loading}
              className="flex-[2] py-4 px-6 rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              حفظ التعديلات
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
