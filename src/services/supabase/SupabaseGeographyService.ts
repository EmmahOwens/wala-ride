import { supabase } from '../../config/supabase';
import type { IGeographyService } from '../interfaces/IGeographyService';
import type { Town, PickupPoint, PickupPointKind } from '../../types/domain';

export class SupabaseGeographyService implements IGeographyService {
  async getTowns(): Promise<Town[]> {
    const { data, error } = await supabase
      .from('towns')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error || !data) return [];
    return data as Town[];
  }

  async getPickupPoints(townId?: string): Promise<PickupPoint[]> {
    let query = supabase
      .from('pickup_points')
      .select('*, towns(*)')
      .eq('is_active', true)
      .order('name');

    if (townId) {
      query = query.eq('town_id', townId);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as unknown as PickupPoint[];
  }

  async createPickupPoint(data: {
    town_id: string;
    name: string;
    kind: PickupPointKind;
    description?: string;
    lat?: number;
    lng?: number;
  }): Promise<PickupPoint | null> {
    const { data: point, error } = await supabase
      .from('pickup_points')
      .insert({
        town_id: data.town_id,
        name: data.name.trim(),
        kind: data.kind,
        description: data.description,
        lat: data.lat,
        lng: data.lng,
        is_active: true,
      } as any)
      .select('*, towns(*)')
      .single();

    if (error || !point) {
      console.error('Error creating pickup point:', error);
      return null;
    }
    return point as unknown as PickupPoint;
  }
}

export const geographyService = new SupabaseGeographyService();
