import { supabase } from '../../config/supabase';
import type { IAdminService, PendingDriverVerification } from '../interfaces/IAdminService';
import type {
  DriverProfile,
  DriverDocument,
  UserProfile,
  Vehicle,
  Town,
  Route,
  DemandAnalyticsResult,
  AdminTownInput,
  AdminRouteInput,
} from '../../types/domain';

export class SupabaseAdminService implements IAdminService {
  async getPendingDrivers(): Promise<PendingDriverVerification[]> {
    // 1. Fetch driver profiles that are pending
    const { data: drivers, error: driversErr } = await supabase
      .from('driver_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (driversErr || !drivers) return [];

    const results: PendingDriverVerification[] = [];

    for (const d of drivers) {
      // Fetch associated profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', d.user_id)
        .maybeSingle();

      // Fetch documents
      const { data: documents } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('driver_id', d.id);

      // Fetch vehicles
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('*')
        .eq('primary_driver_id', d.id);

      results.push({
        driver: d as unknown as DriverProfile,
        profile: (profile || {
          id: d.user_id,
          first_name: 'Driver',
          last_name: '',
          phone: '',
          email: '',
          profile_photo_url: null,
          account_status: 'active',
          created_at: d.created_at,
          updated_at: d.created_at,
        }) as UserProfile,
        documents: (documents || []) as unknown as DriverDocument[],
        vehicles: (vehicles || []) as unknown as Vehicle[],
      });
    }

    return results;
  }

  async updateDriverStatus(driverId: string, status: 'verified' | 'rejected' | 'pending'): Promise<boolean> {
    const { error } = await supabase
      .from('driver_profiles')
      .update({ verification_status: status })
      .eq('id', driverId);

    return !error;
  }

  async updateDocumentStatus(
    documentId: string,
    status: 'verified' | 'rejected',
    rejectionReason?: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from('driver_documents')
      .update({
        verification_status: status,
        reject_reason: rejectionReason || null,
        verified_at: status === 'verified' ? new Date().toISOString() : null,
      })
      .eq('id', documentId);

    return !error;
  }

  async getSignedDocumentUrl(filePath: string): Promise<string | null> {
    // Generate a secure signed URL valid for 1 hour to preview private KYC docs
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(filePath, 3600);

    if (error || !data) return null;
    return data.signedUrl;
  }

  // ==========================================================================
  // PHASE 5: DEMAND ANALYTICS & ROUTE/TOWN OPERATIONS
  // ==========================================================================

  async getDemandAnalytics(days: number = 30): Promise<DemandAnalyticsResult | null> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_demand_analytics', {
        p_days: days,
      });

      if (error || !data) {
        console.error('Error fetching demand analytics RPC:', error);
        return null;
      }

      return data as DemandAnalyticsResult;
    } catch (err) {
      console.error('Exception fetching demand analytics:', err);
      return null;
    }
  }

  async getAllTowns(): Promise<Town[]> {
    try {
      const { data, error } = await supabase
        .from('towns')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching towns:', error);
        return [];
      }

      return (data || []) as Town[];
    } catch (err) {
      console.error('Exception fetching towns:', err);
      return [];
    }
  }

  async upsertTown(input: AdminTownInput): Promise<Town | null> {
    try {
      const action = input.id ? 'update' : 'create';
      const { data, error } = await (supabase.rpc as any)('admin_manage_town', {
        p_action: action,
        p_id: input.id || null,
        p_name: input.name,
        p_region: input.region || null,
        p_lat: input.lat || null,
        p_lng: input.lng || null,
        p_is_active: input.is_active ?? true,
      });

      if (error || !data) {
        console.error('Error managing town RPC:', error);
        return null;
      }

      return data as Town;
    } catch (err) {
      console.error('Exception managing town:', err);
      return null;
    }
  }

  async toggleTownStatus(townId: string): Promise<boolean> {
    try {
      const { error } = await (supabase.rpc as any)('admin_manage_town', {
        p_action: 'toggle_active',
        p_id: townId,
      });

      return !error;
    } catch (err) {
      console.error('Exception toggling town status:', err);
      return false;
    }
  }

  async getAllRoutes(): Promise<Route[]> {
    try {
      const { data, error } = await supabase
        .from('routes')
        .select(`
          *,
          origin_town:towns!routes_origin_town_id_fkey(*),
          destination_town:towns!routes_destination_town_id_fkey(*),
          stops:route_stops(
            *,
            town:towns(*),
            pickup_point:pickup_points(*)
          )
        `)
        .order('name');

      if (error) {
        console.error('Error fetching routes with stops:', error);
        return [];
      }

      // Sort stops by sequence
      return (data || []).map((r: any) => ({
        ...r,
        stops: (r.stops || []).sort((a: any, b: any) => a.sequence - b.sequence),
      })) as Route[];
    } catch (err) {
      console.error('Exception fetching routes:', err);
      return [];
    }
  }

  async upsertRoute(input: AdminRouteInput): Promise<Route | null> {
    try {
      const action = input.id ? 'update' : 'create';
      const { data, error } = await (supabase.rpc as any)('admin_manage_route', {
        p_action: action,
        p_id: input.id || null,
        p_name: input.name,
        p_origin_town_id: input.origin_town_id,
        p_destination_town_id: input.destination_town_id,
        p_distance_km: input.distance_km || null,
        p_duration_mins: input.estimated_duration_minutes || null,
        p_status: input.status || 'active',
        p_stops: input.stops || [],
      });

      if (error || !data) {
        console.error('Error managing route RPC:', error);
        return null;
      }

      return data as Route;
    } catch (err) {
      console.error('Exception managing route:', err);
      return null;
    }
  }

  async deleteRoute(routeId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('routes')
        .delete()
        .eq('id', routeId);

      return !error;
    } catch (err) {
      console.error('Exception deleting route:', err);
      return false;
    }
  }
}

export const adminService = new SupabaseAdminService();

