import { supabase } from '../lib/supabase';

export interface City {
  id: string;
  name_ar: string;
  name_en: string;
  is_active: boolean;
  zoom_level: number;
}

export interface Zone {
  zone_id: string;
  name_ar: string;
  name_en: string;
  city_id: string;
  base_delivery_fee: number;
  base_distance_km: number;
  extra_fee_per_km: number;
  driver_payout_fixed: number;
  driver_commission_pct: number;
  additional_vendor_fee: number;
  is_active: boolean;
  is_surge_active: boolean;
  surge_multiplier: number;
  cities?: {
    name_ar: string;
  };
}

export const locationService = {
  // Cities
  async fetchCities(search?: string) {
    let query = supabase
      .from('cities')
      .select('*')
      .order('name_ar', { ascending: true });

    if (search) {
      query = query.or(`name_ar.ilike.%${search}%,name_en.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as City[];
  },

  async createCity(city: Omit<City, 'id'>) {
    const { data, error } = await supabase
      .from('cities')
      .insert([city])
      .select()
      .single();
    if (error) throw error;
    return data as City;
  },

  async updateCity(id: string, updates: Partial<City>) {
    const { data, error } = await supabase
      .from('cities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as City;
  },

  async deleteCity(id: string) {
    const { error } = await supabase
      .from('cities')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Zones
  async fetchZones(page: number, pageSize: number, filters: { search?: string; status?: 'All' | 'Active' | 'Inactive' }) {
    let query = supabase
      .from('zones')
      .select(`
        *,
        cities:city_id (name_ar)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (filters.search) {
      query = query.or(`name_ar.ilike.%${filters.search}%,name_en.ilike.%${filters.search}%`);
    }

    if (filters.status && filters.status !== 'All') {
      query = query.eq('is_active', filters.status === 'Active');
    }

    const { data, count, error } = await query;
    if (error) throw error;
    return { zones: data as any[], count };
  },

  async upsertZone(zone: any) {
    if (zone.zone_id) {
      const { zone_id, cities, ...updates } = zone;
      const { data, error } = await supabase
        .from('zones')
        .update(updates)
        .eq('zone_id', zone_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('zones')
        .insert([zone])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async updateZoneStatus(id: string, isActive: boolean) {
    const { error } = await supabase
      .from('zones')
      .update({ is_active: isActive })
      .eq('zone_id', id);
    if (error) throw error;
  },

  async deleteZone(id: string) {
    const { error } = await supabase
      .from('zones')
      .delete()
      .eq('zone_id', id);
    if (error) throw error;
  }
};
