import { supabase } from '../lib/supabase';
import { supabaseAdmin, isAdminKeyAvailable } from '../lib/supabaseAdmin';

export type AuditActionType = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'System_Error' | 'OTHER';

export const logAuditAction = async (
  actionType: AuditActionType,
  tableName: string,
  recordId: string,
  oldValue?: any,
  newValue?: any
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const client = isAdminKeyAvailable ? supabaseAdmin : supabase;

    await client.from('audit_logs').insert({
      admin_id: user.id,
      action_type: actionType,
      table_name: tableName,
      record_id: recordId,
      old_value: oldValue || null,
      new_value: newValue || null,
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
  }
};
