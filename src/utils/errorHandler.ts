import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

/**
 * Centralized error handler for parsing and displaying errors.
 */
export const handleGlobalError = (error: any, context?: string) => {
  console.error(`[${context || 'Error'}]`, error);

  // Mark error as handled to prevent redundant global listeners from triggering
  if (error && typeof error === 'object') {
    try {
      (error as any).__handled = true;
    } catch (e) {
      // Ignore if error object is frozen
    }
  }

  let message = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';

  if (error instanceof Error) {
    const anyError = error as any;
    if (anyError.code) {
      switch (anyError.code) {
        case '23505': message = 'هذا السجل موجود بالفعل.'; break;
        case '23503': message = 'لا يمكن إتمام العملية لارتباط هذا السجل ببيانات أخرى.'; break;
        case '42501': message = 'ليس لديك صلاحية للقيام بهذه العملية.'; break;
        case 'PGRST116': message = 'لم يتم العثور على البيانات المطلوبة.'; break;
        default: message = error.message;
      }
    } else if (error.message.includes('Failed to fetch') || error.message.includes('Network Error')) {
      message = 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.';
    } else {
      message = error.message;
    }
  } else if (typeof error === 'string') {
    message = error;
  }

  // Show toast safely (suppress for generic unhandled promises to avoid noise)
  if (context !== 'Unhandled Promise' && context !== 'Uncaught Exception') {
    setTimeout(() => {
      try {
        toast.error(message, { id: String(message) });
      } catch (e) {
        console.error('Failed to show toast:', e);
      }
    }, 0);
  }

  // Log to database asynchronously
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { supabaseAdmin, isAdminKeyAvailable } = await import('../lib/supabaseAdmin');
        const client = isAdminKeyAvailable ? supabaseAdmin : supabase;
        
        await client.from('audit_logs').insert({
          admin_id: user.id,
          action_type: 'System_Error',
          table_name: 'system',
          record_id: user.id,
          new_value: { 
            message, 
            context, 
            error: error instanceof Error ? { 
              name: error.name, 
              message: error.message,
              stack: error.stack 
            } : String(error) 
          }
        });
      }
    } catch (err) {
      console.error('Failed to log error to audit_logs:', err);
    }
  })();

  return message;
};
