import { supabase } from '../../config/supabase';
import type { ITripService } from '../interfaces/ITripService';
import type { Route, RouteStop, Trip, TripStatus, TripManifest, ManifestPassenger } from '../../types/domain';

export class SupabaseTripService implements ITripService {
  async getRoutes(): Promise<Route[]> {
    const { data, error } = await supabase
      .from('routes')
      .select('*, origin_town:towns!routes_origin_town_id_fkey(*), destination_town:towns!routes_destination_town_id_fkey(*)')
      .eq('status', 'active')
      .order('name');

    if (error || !data) return [];
    return data as unknown as Route[];
  }

  async getRouteStops(routeId: string): Promise<RouteStop[]> {
    const { data, error } = await supabase
      .from('route_stops')
      .select('*, town:towns(*), pickup_point:pickup_points(*)')
      .eq('route_id', routeId)
      .order('sequence');

    if (error || !data) return [];
    return data as unknown as RouteStop[];
  }

  async publishTrip(params: {
    driverId: string;
    vehicleId: string;
    routeId: string;
    departsAt: string;
    baseFareUgx: number;
    notes?: string;
  }): Promise<{ tripId: string | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('publish_trip', {
        p_driver_id: params.driverId,
        p_vehicle_id: params.vehicleId,
        p_route_id: params.routeId,
        p_departs_at: params.departsAt,
        p_base_fare_ugx: params.baseFareUgx,
        p_notes: params.notes || undefined,
      });

      if (error) {
        return { tripId: null, error: new Error(error.message) };
      }
      return { tripId: data as string, error: null };
    } catch (err: any) {
      return { tripId: null, error: new Error(err.message || 'Failed to publish trip') };
    }
  }

  async getDriverTrips(driverId: string): Promise<Trip[]> {
    const { data, error } = await supabase
      .from('trips')
      .select('*, route:routes(*), vehicle:vehicles(*), stops:trip_stops(*, pickup_point:pickup_points(*))')
      .eq('driver_id', driverId)
      .order('departs_at', { ascending: false });

    if (error || !data) return [];
    return data as unknown as Trip[];
  }

  async getTripManifest(tripId: string): Promise<TripManifest | null> {
    // 1. Fetch trip
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('*, route:routes(*), vehicle:vehicles(*)')
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) return null;

    // 2. Fetch booking segments on this trip
    const { data: segments, error: segErr } = await supabase
      .from('booking_segments')
      .select(`
        id,
        seat_count,
        fare_ugx,
        status,
        origin_sequence,
        destination_sequence,
        booking:bookings!booking_segments_booking_id_fkey(
          id,
          booking_reference,
          status,
          passenger:profiles!bookings_passenger_id_fkey(
            first_name,
            last_name,
            phone
          )
        ),
        origin_stop:trip_stops!booking_segments_origin_trip_stop_id_fkey(
          pickup_point:pickup_points(name)
        ),
        destination_stop:trip_stops!booking_segments_destination_trip_stop_id_fkey(
          pickup_point:pickup_points(name)
        )
      `)
      .eq('trip_id', tripId)
      .in('status', ['held', 'confirmed', 'completed']);

    if (segErr || !segments) {
      return {
        trip: trip as unknown as Trip,
        passengers: [],
        total_boarded: 0,
        total_expected_fare_ugx: 0,
      };
    }

    const passengers: ManifestPassenger[] = segments.map((s: any) => {
      const passengerProfile = s.booking?.passenger;
      const originName = s.origin_stop?.pickup_point?.name || 'Origin';
      const destName = s.destination_stop?.pickup_point?.name || 'Destination';

      return {
        booking_id: s.booking?.id || '',
        booking_reference: s.booking?.booking_reference || 'REF',
        passenger_name: passengerProfile ? `${passengerProfile.first_name || ''} ${passengerProfile.last_name || ''}`.trim() : 'Passenger',
        passenger_phone: passengerProfile?.phone || 'No phone',
        seats: s.seat_count,
        fare_ugx: s.fare_ugx,
        origin_stage: originName,
        origin_sequence: s.origin_sequence,
        dest_stage: destName,
        dest_sequence: s.destination_sequence,
        status: s.status,
      };
    });

    const totalExpectedFare = passengers
      .filter((p) => p.status === 'confirmed' || p.status === 'held')
      .reduce((acc, curr) => acc + curr.fare_ugx, 0);

    const totalBoarded = passengers
      .filter((p) => p.status === 'confirmed')
      .reduce((acc, curr) => acc + curr.seats, 0);

    return {
      trip: trip as unknown as Trip,
      passengers,
      total_boarded: totalBoarded,
      total_expected_fare_ugx: totalExpectedFare,
    };
  }

  async updateTripStatus(tripId: string, status: TripStatus): Promise<boolean> {
    const updates: any = { status };
    if (status === 'boarding') updates.actual_departs_at = new Date().toISOString();
    if (status === 'completed') updates.actual_arrives_at = new Date().toISOString();

    const { error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', tripId);

    return !error;
  }
}

export const tripService = new SupabaseTripService();
