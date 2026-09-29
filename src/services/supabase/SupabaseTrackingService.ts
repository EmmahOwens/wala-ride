import { supabase } from '../../config/supabase';
import type { ITrackingService } from '../interfaces/ITrackingService';
import type {
  TripLocation,
  Incident,
  IncidentKind,
  IncidentStatus,
  PublicTripTracking,
  EmergencyContact,
  Rating,
} from '../../types/domain';

export class SupabaseTrackingService implements ITrackingService {
  async recordLocation(params: {
    tripId: string;
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
  }): Promise<{ success: boolean; error?: Error }> {
    try {
      const { error } = await (supabase.rpc as any)('record_trip_location', {
        p_trip_id: params.tripId,
        p_lat: params.lat,
        p_lng: params.lng,
        p_speed: params.speed ?? null,
        p_heading: params.heading ?? null,
        p_accuracy: params.accuracy ?? null,
      });

      if (error) {
        console.error('Failed to record trip location:', error);
        return { success: false, error: new Error(error.message) };
      }
      return { success: true };
    } catch (err: any) {
      console.error('Exception recording location:', err);
      return { success: false, error: err };
    }
  }

  async getLatestTripLocation(tripId: string): Promise<TripLocation | null> {
    try {
      const { data, error } = await supabase
        .from('trip_locations')
        .select('*')
        .eq('trip_id', tripId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return data as TripLocation;
    } catch (err) {
      console.error('Error fetching latest trip location:', err);
      return null;
    }
  }

  async getTripLocationsHistory(tripId: string, limit = 25): Promise<TripLocation[]> {
    try {
      const { data, error } = await supabase
        .from('trip_locations')
        .select('*')
        .eq('trip_id', tripId)
        .order('recorded_at', { ascending: false })
        .limit(limit);

      if (error || !data) return [];
      return (data as TripLocation[]).reverse();
    } catch (err) {
      console.error('Error fetching trip location history:', err);
      return [];
    }
  }

  subscribeToTripLocations(tripId: string, onLocation: (loc: TripLocation) => void): () => void {
    const channelName = `trip-loc-${tripId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_locations',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          if (payload.new) {
            onLocation(payload.new as TripLocation);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async reportIncident(params: {
    tripId?: string;
    bookingId?: string;
    kind: IncidentKind;
    lat?: number;
    lng?: number;
    description?: string;
    reportedBy?: string;
  }): Promise<{ incidentId: string | null; error?: Error }> {
    try {
      const { data, error } = await (supabase.rpc as any)('report_incident', {
        p_trip_id: params.tripId || null,
        p_booking_id: params.bookingId || null,
        p_kind: params.kind,
        p_lat: params.lat ?? null,
        p_lng: params.lng ?? null,
        p_description: params.description || null,
        p_reported_by: params.reportedBy || null,
      });

      if (error) {
        console.error('Failed to report incident:', error);
        return { incidentId: null, error: new Error(error.message) };
      }

      const res = data as any;
      return { incidentId: res?.incident_id || null };
    } catch (err: any) {
      console.error('Exception reporting incident:', err);
      return { incidentId: null, error: err };
    }
  }

  async getAdminIncidents(): Promise<Incident[]> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_admin_incidents');
      if (error) {
        console.error('Error fetching admin incidents:', error);
        return [];
      }
      return (data as unknown || []) as Incident[];
    } catch (err) {
      console.error('Exception fetching admin incidents:', err);
      return [];
    }
  }

  async resolveIncident(
    incidentId: string,
    status: IncidentStatus,
    handlerId?: string
  ): Promise<{ success: boolean; error?: Error }> {
    try {
      const { error } = await (supabase.rpc as any)('resolve_incident', {
        p_incident_id: incidentId,
        p_status: status,
        p_handler_id: handlerId || null,
      });

      if (error) {
        console.error('Failed to resolve incident:', error);
        return { success: false, error: new Error(error.message) };
      }
      return { success: true };
    } catch (err: any) {
      console.error('Exception resolving incident:', err);
      return { success: false, error: err };
    }
  }

  subscribeToIncidents(onIncidentChange: (incident: Incident) => void): () => void {
    const channelName = `incidents-realtime-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'incidents',
        },
        async () => {
          // Whenever an incident is inserted/updated, refetch full incident data with joins
          const incidents = await this.getAdminIncidents();
          if (incidents.length > 0) {
            onIncidentChange(incidents[0]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async createTripShare(
    bookingId: string,
    hoursValid = 48
  ): Promise<{ shareToken: string; expiresAt: string; shareUrl: string } | null> {
    try {
      const { data, error } = await (supabase.rpc as any)('create_trip_share', {
        p_booking_id: bookingId,
        p_hours_valid: hoursValid,
      });

      if (error || !data) {
        console.error('Error creating trip share:', error);
        return null;
      }

      const res = data as any;
      const origin = window.location.origin;
      const shareUrl = `${origin}/?track=${res.share_token}`;

      return {
        shareToken: res.share_token,
        expiresAt: res.expires_at,
        shareUrl,
      };
    } catch (err) {
      console.error('Exception creating trip share:', err);
      return null;
    }
  }

  async getPublicTripTracking(shareToken: string): Promise<PublicTripTracking | null> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_public_trip_tracking', {
        p_share_token: shareToken,
      });

      if (error || !data) {
        console.error('Error fetching public trip tracking:', error);
        return null;
      }

      return (data as unknown) as PublicTripTracking;
    } catch (err) {
      console.error('Exception fetching public trip tracking:', err);
      return null;
    }
  }

  async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error || !data) return [];
      return data as EmergencyContact[];
    } catch (err) {
      console.error('Error fetching emergency contacts:', err);
      return [];
    }
  }

  async addEmergencyContact(contact: {
    userId: string;
    name: string;
    phone: string;
    relationship?: string;
  }): Promise<EmergencyContact | null> {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .insert({
          user_id: contact.userId,
          name: contact.name,
          phone: contact.phone,
          relationship: contact.relationship || null,
        })
        .select()
        .single();

      if (error || !data) {
        console.error('Error adding emergency contact:', error);
        return null;
      }
      return data as EmergencyContact;
    } catch (err) {
      console.error('Exception adding emergency contact:', err);
      return null;
    }
  }

  async deleteEmergencyContact(contactId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', contactId);

      return !error;
    } catch (err) {
      console.error('Error deleting emergency contact:', err);
      return false;
    }
  }

  async submitRating(params: {
    tripId?: string;
    bookingId?: string;
    score: number;
    comment?: string;
    reviewerId?: string;
    revieweeId?: string;
  }): Promise<{ success: boolean; error?: Error }> {
    try {
      const { error } = await (supabase.rpc as any)('submit_trip_rating', {
        p_trip_id: params.tripId || null,
        p_booking_id: params.bookingId || null,
        p_score: params.score,
        p_comment: params.comment || null,
        p_reviewer_id: params.reviewerId || null,
        p_reviewee_id: params.revieweeId || null,
      });

      if (error) {
        console.error('Error submitting rating:', error);
        return { success: false, error: new Error(error.message) };
      }
      return { success: true };
    } catch (err: any) {
      console.error('Exception submitting rating:', err);
      return { success: false, error: err };
    }
  }

  async getTripRatings(tripId: string): Promise<Rating[]> {
    try {
      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data as Rating[];
    } catch (err) {
      console.error('Error fetching trip ratings:', err);
      return [];
    }
  }
}

export const trackingService = new SupabaseTrackingService();
