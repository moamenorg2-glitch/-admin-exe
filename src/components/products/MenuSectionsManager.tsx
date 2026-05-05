import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { X, Plus, Trash2, GripVertical, Save, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../ui/ConfirmModal';

interface MenuSectionsManagerProps {
  vendorId: string;
  onClose: () => void;
}

export default function MenuSectionsManager({ vendorId, onClose }: MenuSectionsManagerProps) {
  const [newSectionName, setNewSectionName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const { data: sections, isLoading } = useQuery({
    queryKey: ['menu-sections', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_sections')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!vendorId
  });

  const addSectionMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('menu_sections')
        .insert({
          vendor_id: vendorId,
          name_ar: name,
          sort_order: (sections?.length || 0) + 1
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-sections', vendorId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['sections-list', vendorId] }).catch(console.error);
      setNewSectionName('');
      toast.success('تم إضافة القسم بنجاح');
    },
    onError: (error: any) => {
      toast.error(`خطأ في إضافة القسم: ${error.message}`);
    }
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string, name: string }) => {
      const { error } = await supabase
        .from('menu_sections')
        .update({ name_ar: name })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-sections', vendorId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['sections-list', vendorId] }).catch(console.error);
      setEditingId(null);
      toast.success('تم تحديث القسم بنجاح');
    },
    onError: (error: any) => {
      toast.error(`خطأ في تحديث القسم: ${error.message}`);
    }
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_sections')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-sections', vendorId] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['sections-list', vendorId] }).catch(console.error);
      toast.success('تم حذف القسم بنجاح');
      setSectionToDelete(null);
    },
    onError: (error: any) => {
      toast.error(`خطأ في حذف القسم: ${error.message}`);
    }
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[#111827B3] " onClick={onClose}></div>
      <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-gray-100">
        <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-xl font-black text-gray-900">إدارة أقسام القائمة</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Add New Section */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="اسم القسم الجديد..."
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
            />
            <button
              onClick={() => addSectionMutation.mutate(newSectionName)}
              disabled={!newSectionName || addSectionMutation.isPending}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-black disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Sections List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-4 text-gray-400">جاري التحميل...</div>
            ) : sections?.length === 0 ? (
              <div className="text-center py-4 text-gray-400 italic">لا توجد أقسام مضافة</div>
            ) : (
              sections?.map((section) => (
                <div key={section.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 group">
                  <GripVertical className="w-4 h-4 text-gray-300 cursor-move" />
                  
                  {editingId === section.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 font-bold text-gray-700">{section.name_ar}</span>
                  )}

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingId === section.id ? (
                      <button
                        onClick={() => updateSectionMutation.mutate({ id: section.id, name: editName })}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(section.id);
                          setEditName(section.name_ar);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setSectionToDelete(section.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <ConfirmModal
          isOpen={!!sectionToDelete}
          onClose={() => setSectionToDelete(null)}
          onConfirm={() => sectionToDelete && deleteSectionMutation.mutate(sectionToDelete)}
          title="حذف القسم"
          message="هل أنت متأكد من حذف هذا القسم؟ سيتم حذف جميع المنتجات المرتبطة به."
          confirmText="حذف"
          cancelText="إلغاء"
          type="danger"
        />
      </div>
    </div>
  );
}
