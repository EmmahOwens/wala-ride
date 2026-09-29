import { supabase } from '../../config/supabase';
import type { IRadarService } from '../interfaces/IRadarService';
import type { RadarLead, TripAlert } from '../../types/domain';

export class SupabaseRadarService implements IRadarService {
  async createTripAlert(params: {
    passengerId: string;
    originTownId: string;
    destinationTownId: string;
    travelDate: string;
    seatsNeeded?: number;
  }): Promise<string | null> {
    const { data, error } = await supabase.rpc('create_trip_alert' as any, {
      p_passenger_id: params.passengerId,
      p_origin_town_id: params.originTownId,
      p_destination_town_id: params.destinationTownId,
      p_travel_date: params.travelDate,
      p_seats_needed: params.seatsNeeded || 1,
    });

    if (error || !data) {
      console.error('Error creating trip alert:', error);
      return null;
    }

    return data as string;
  }

  async getDriverRadarLeads(driverId: string): Promise<RadarLead[]> {
    const { data, error } = await supabase.rpc('get_driver_radar_leads' as any, {
      p_driver_id: driverId,
    });

    if (error || !data) {
      console.error('Error fetching radar leads:', error);
      return [];
    }

    return data as RadarLead[];
  }

  async revealLead(
    driverId: string,
    tripAlertId: string
  ): Promise<{ passenger_phone: string; passenger_name: string; alert_id: string } | null> {
    const { data, error } = await supabase.rpc('reveal_lead' as any, {
      p_driver_id: driverId,
      p_trip_alert_id: tripAlertId,
    });

    if (error || !data || data.length === 0) {
      console.error('Error revealing lead:', error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return row as { passenger_phone: string; passenger_name: string; alert_id: string };
  }

  async getPassengerAlerts(passengerId: string): Promise<TripAlert[]> {
    const { data, error } = await supabase
      .from('trip_alerts')
      .select('*')
      .eq('passenger_id', passengerId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('Error fetching passenger alerts:', error);
      return [];
    }

    return data as unknown as TripAlert[];
  }
}

export const radarService = new SupabaseRadarService();
