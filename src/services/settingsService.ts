import { supabase } from '../lib/supabase';

export interface SystemSettings {
  id?: number;
  app_name: string;
  support_contact: string;
  driver_max_debt: number;
  cancel_penalty: number;
  min_app_version: string;
  is_under_maintenance: boolean;
  tax_rate: number;
  appLogo?: string;
  deposit_instructions?: string;
}

export const settingsService = {
  async fetchSettings() {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as SystemSettings | null;
  },

  async updateSettings(settings: SystemSettings) {
    if (settings.id) {
      const { error } = await supabase
        .from('system_settings')
        .update(settings as any)
        .eq('id', settings.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('system_settings')
        .insert([settings as any]);
      if (error) throw error;
    }
  }
};
