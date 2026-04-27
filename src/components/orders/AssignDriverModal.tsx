import React from 'react';
import { X, Motorbike, Phone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { handleGlobalError } from '../../utils/errorHandler';

interface AssignDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (driverId: string) => void;
  isAssigning: boolean;
  excludeDriverIds?: string[];
}

export default function AssignDriverModal({ isOpen, onClose, onAssign, isAssigning, excludeDriverIds = [] }: AssignDriverModalProps) {
  const { data: availableDrivers, isLoading } = useQuery({
    queryKey: ['available-drivers', excludeDriverIds],
    queryFn: async () => {
      try {
        let query = supabase
          .from('driver_details')
          .select(`
            user_id,
            vehicle_type,
            is_busy,
            user:profiles!driver_details_user_id_fkey(full_name, primary_phone, avatar_url),
            active_orders:order_delivery_team(
              master_order:master_orders!fk_order_delivery_team_master_order(status, id)
            )
          `)
          .eq('is_online', true);

        if (excludeDriverIds && excludeDriverIds.length > 0) {
          query = query.not('user_id', 'in', excludeDriverIds);
        }

        const { data, error } = await query.order('is_busy', { ascending: true });
          
        if (error) throw error;
        return data;
      } catch (error) {
        handleGlobalError(error, 'Fetch Available Drivers');
        throw error;
      }
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden text-right relative z-[10000]">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">تعيين مندوب توصيل</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : availableDrivers && availableDrivers.length > 0 ? (
            availableDrivers.map((driver: any) => (
              <div 
                key={driver.user_id}
                onClick={() => !isAssigning && onAssign(driver.user_id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer ${isAssigning ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-gray-200">
                    {driver.user?.avatar_url ? (
                      <img 
                        src={driver.user.avatar_url} 
                        alt="" 
                        className="w-full h-full object-cover rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Motorbike className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{driver.user?.full_name}</p>
                      {driver.is_busy && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-sm font-medium">
                          مشغول
                        </span>
                      )}
                      {(() => {
                        const activeMasterOrderIds = new Set(
                          (driver as any).active_orders
                            ?.filter((ao: any) => ao.master_order && !['Completed', 'Cancelled'].includes(ao.master_order.status))
                            .map((ao: any) => ao.master_order.id)
                        );
                        const activeCount = activeMasterOrderIds.size;
                        return activeCount > 0 && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-sm font-medium">
                            {activeCount} طلب نشط
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <a 
                  href={`tel:${driver.user?.primary_phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 bg-emerald-100 text-emerald-600 rounded-full hover:bg-emerald-200 transition-colors shrink-0"
                  title="اتصال"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">لا يوجد سائقين متاحين حالياً</p>
            </div>
          )}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <button 
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-600 font-medium"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
