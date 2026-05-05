import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { X, Plus, Trash2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import ConfirmModal from '../ui/ConfirmModal';

interface ModifiersManagerProps {
  productId: string;
  vendorId: string;
  sectionId?: string;
  onClose: () => void;
}

interface ModifierOption {
  id: string;
  group_id: string;
  name_ar: string;
  price: number;
}

interface ModifierGroup {
  id: string;
  vendor_id: string;
  product_id: string | null;
  section_id: string | null;
  title_ar: string;
  min_selection: number;
  max_selection: number;
  options: ModifierOption[];
}

export default function ModifiersManager({ productId, vendorId, sectionId, onClose }: ModifiersManagerProps) {
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupScope, setNewGroupScope] = useState<'product' | 'section' | 'vendor'>('product');
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState(0);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['modifier-groups', productId, sectionId, vendorId],
    queryFn: async () => {
      // Build filters
      let query = supabase
        .from('modifier_groups')
        .select(`
          *,
          options:modifier_options(*)
        ` as any);

      // We want groups that are:
      // 1. Specific to this product
      // 2. OR Global for this section (if sectionId provided)
      // 3. OR Global for this vendor (where section/product are null)
      
      const filters = [`product_id.eq.${productId}`];
      if (sectionId) {
        filters.push(`and(section_id.eq.${sectionId},product_id.is.null)`);
      }
      filters.push(`and(vendor_id.eq.${vendorId},section_id.is.null,product_id.is.null)`);

      const { data, error } = await query
        .or(filters.join(','))
        .order('created_at');

      if (error) throw error;
      return data as any as ModifierGroup[];
    },
    enabled: !!productId
  });

  const addGroupMutation = useMutation({
    mutationFn: async ({ title, scope }: { title: string, scope: 'product' | 'section' | 'vendor' }) => {
      const insertData: any = {
        vendor_id: vendorId,
        title_ar: title,
        min_selection: 0,
        max_selection: 1
      };

      if (scope === 'product') {
        insertData.product_id = productId;
      } else if (scope === 'section' && sectionId) {
        insertData.section_id = sectionId;
      }
      // If vendor scope, both product_id and section_id remain null

      const { error } = await supabase
        .from('modifier_groups')
        .insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups'] }).catch(console.error);
      setNewGroupName('');
      toast.success('تم إضافة مجموعة الإضافات بنجاح');
    },
    onError: (error: any) => {
      toast.error(`خطأ في إضافة المجموعة: ${error.message}`);
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('modifier_groups')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', productId] }).catch(console.error);
      toast.success('تم حذف المجموعة بنجاح');
      setGroupToDelete(null);
    },
    onError: (error: any) => {
      toast.error(`خطأ في حذف المجموعة: ${error.message}`);
    }
  });

  const addOptionMutation = useMutation({
    mutationFn: async ({ groupId, name, price }: { groupId: string, name: string, price: number }) => {
      const { error } = await supabase
        .from('modifier_options')
        .insert({
          group_id: groupId,
          name_ar: name,
          price: price
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', productId] }).catch(console.error);
      setNewOptionName('');
      setNewOptionPrice(0);
      toast.success('تم إضافة الخيار بنجاح');
    },
    onError: (error: any) => {
      toast.error(`خطأ في إضافة الخيار: ${error.message}`);
    }
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('modifier_options')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modifier-groups', productId] }).catch(console.error);
      toast.success('تم حذف الخيار بنجاح');
    },
    onError: (error: any) => {
      toast.error(`خطأ في حذف الخيار: ${error.message}`);
    }
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[#111827B3] " onClick={onClose}></div>
      <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-gray-100">
        <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Settings2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900">إدارة الإضافات (Add-ons)</h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto max-h-[75vh] custom-scrollbar">
          {/* Add New Group */}
          <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 space-y-4">
            <h4 className="text-sm font-black text-gray-500 uppercase tracking-widest">إضافة مجموعة جديدة</h4>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="مثال: اختر الحجم، إضافات البيتزا..."
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                />
                <button
                  onClick={() => addGroupMutation.mutate({ title: newGroupName, scope: newGroupScope })}
                  disabled={!newGroupName || addGroupMutation.isPending}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black disabled:opacity-50 shadow-lg shadow-emerald-100"
                >
                  إضافة
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setNewGroupScope('product')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                    newGroupScope === 'product' ? "bg-emerald-100 border-emerald-200 text-emerald-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  لهذا المنتج فقط
                </button>
                {sectionId && (
                  <button
                    onClick={() => setNewGroupScope('section')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                      newGroupScope === 'section' ? "bg-amber-100 border-amber-200 text-amber-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                    )}
                  >
                    لكل منتجات الفئة
                  </button>
                )}
                <button
                  onClick={() => setNewGroupScope('vendor')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                    newGroupScope === 'vendor' ? "bg-blue-100 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                  )}
                >
                  لكل منتجات المتجر
                </button>
              </div>
            </div>
          </div>

          {/* Groups List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">جاري التحميل...</div>
            ) : groups?.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200 text-gray-400 italic">
                لا توجد مجموعات إضافات مضافة لهذا المنتج
              </div>
            ) : (
              groups?.map((group) => (
                <div key={group.id} className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-white">
                  <div 
                    className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-black text-gray-900">{group.title_ar}</span>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg font-bold">
                            {group.options?.length || 0} خيارات
                          </span>
                          {!group.product_id && !group.section_id && (
                            <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg font-bold">
                              عام للمتجر
                            </span>
                          )}
                          {group.section_id && (
                            <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg font-bold">
                              عام للفئة
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setGroupToDelete(group.id);
                        }}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {expandedGroupId === group.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {expandedGroupId === group.id && (
                    <div className="px-6 pb-6 pt-2 border-t border-gray-50 space-y-4 bg-gray-50">
                      {/* Add New Option */}
                      <div className="flex items-end gap-2 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex-1 space-y-1">
                          <label className="text-[11px] font-black text-gray-400 mr-1">اسم الخيار</label>
                          <input
                            type="text"
                            value={newOptionName}
                            onChange={(e) => setNewOptionName(e.target.value)}
                            placeholder="مثال: جبنة إضافية"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-bold"
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <label className="text-[11px] font-black text-gray-400 mr-1">السعر</label>
                          <input
                            type="number"
                            value={newOptionPrice}
                            onChange={(e) => setNewOptionPrice(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-black"
                          />
                        </div>
                        <button
                          onClick={() => addOptionMutation.mutate({ groupId: group.id, name: newOptionName, price: newOptionPrice })}
                          disabled={!newOptionName || addOptionMutation.isPending}
                          className="p-2.5 bg-emerald-600 text-white rounded-lg font-black disabled:opacity-50"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Options List */}
                      <div className="space-y-2">
                        {group.options?.map((option: any) => (
                          <div key={option.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 group/opt">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-gray-700">{option.name_ar}</span>
                              <span className="text-xs font-black text-emerald-600">+{option.price} ج.م</span>
                            </div>
                            <button
                              onClick={() => deleteOptionMutation.mutate(option.id)}
                              className="p-1.5 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover/opt:opacity-100 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <ConfirmModal
          isOpen={!!groupToDelete}
          onClose={() => setGroupToDelete(null)}
          onConfirm={() => groupToDelete && deleteGroupMutation.mutate(groupToDelete)}
          title="حذف مجموعة الإضافات"
          message="هل أنت متأكد من حذف هذه المجموعة وجميع خياراتها؟ لا يمكن التراجع عن هذا الإجراء."
          confirmText="حذف"
          cancelText="إلغاء"
          type="danger"
        />
      </div>
    </div>
  );
}
