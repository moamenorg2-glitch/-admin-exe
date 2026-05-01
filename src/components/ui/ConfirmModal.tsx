import { X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  type = 'info',
  isLoading = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const colors = {
    danger: 'bg-red-600 hover:bg-red-700 shadow-red-200 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 text-white',
    info: 'bg-gray-900 hover:bg-gray-800 shadow-gray-200 text-white'
  };

  const iconColors = {
    danger: 'text-red-600 bg-red-50',
    warning: 'text-amber-600 bg-amber-50',
    info: 'text-blue-600 bg-blue-50'
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#000000B3] ">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100"
          dir="rtl"
        >
          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div className={cn("p-4 rounded-2xl", iconColors[type])}>
                <AlertTriangle className="w-8 h-8" />
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">
              {title}
            </h3>
            <p className="text-gray-500 text-lg leading-relaxed font-medium">
              {message}
            </p>

            <div className="grid grid-cols-2 gap-4 mt-10">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="py-4 px-6 bg-gray-50 text-gray-600 rounded-2xl font-bold hover:bg-gray-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={cn(
                  "py-4 px-6 rounded-2xl font-black text-lg transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2",
                  colors[type]
                )}
              >
                {isLoading && (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {confirmText}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
