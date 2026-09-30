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

  async findNearestPickupPoints(
    lat: number,
    lng: number,
    radiusMeters: number = 50000,
    limit: number = 10
  ): Promise<(PickupPoint & { distance_km: number; distance_meters: number; town_name: string })[]> {
    const { data, error } = await (supabase.rpc as any)('find_nearest_pickup_points', {
      p_lat: lat,
      p_lng: lng,
      p_radius_meters: radiusMeters,
      p_limit: limit,
    });

    if (error || !data) {
      console.error('Error finding nearest pickup points:', error);
      return [];
    }
    return data as (PickupPoint & { distance_km: number; distance_meters: number; town_name: string })[];
  }

  async findNearestTown(lat: number, lng: number): Promise<(Town & { distance_km: number }) | null> {
    const { data, error } = await (supabase.rpc as any)('find_nearest_town', {
      p_lat: lat,
      p_lng: lng,
    });

    if (error || !data || data.length === 0) {
      return null;
    }
    return data[0] as (Town & { distance_km: number });
  }

  async computeRoute(
    origin: { lat: number; lng: number } | string,
    destination: { lat: number; lng: number } | string,
    waypoints?: ({ lat: number; lng: number } | string)[]
  ) {
    const { data, error } = await supabase.functions.invoke('maps-proxy', {
      body: {
        action: 'compute_route',
        origin,
        destination,
        waypoints,
      },
    });

    if (error) {
      console.error('Error computing route from maps-proxy:', error);
      throw error;
    }
    return data;
  }

  async autocompletePlaces(query: string, sessionToken?: string) {
    const { data, error } = await supabase.functions.invoke('maps-proxy', {
      body: {
        action: 'autocomplete',
        query,
        sessionToken,
      },
    });

    if (error) {
      console.error('Error autocompleting places from maps-proxy:', error);
      return [];
    }
    return data?.predictions || [];
  }
}

export const geographyService = new SupabaseGeographyService();

