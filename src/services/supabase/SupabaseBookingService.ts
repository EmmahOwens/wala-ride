import { supabase } from '../../config/supabase';
import type { IBookingService } from '../interfaces/IBookingService';
import type { SearchResultTrip, BookingTicket, BookingType } from '../../types/domain';

export class SupabaseBookingService implements IBookingService {
  async searchTrips(params: {
    originTownId: string;
    destTownId: string;
    date: string;
    seats?: number;
  }): Promise<SearchResultTrip[]> {
    try {
      const { data, error } = await supabase.rpc('search_available_trips', {
        p_origin_town_id: params.originTownId,
        p_dest_town_id: params.destTownId,
        p_date: params.date,
        p_required_seats: params.seats || 1,
      });

      if (error) {
        console.error('search_available_trips error:', error);
        return [];
      }
      return (data || []) as unknown as SearchResultTrip[];
    } catch (err) {
      console.error('Search failed:', err);
      return [];
    }
  }

  async bookSegment(params: {
    tripId: string;
    passengerId: string;
    originTripStopId: string;
    destTripStopId: string;
    seatCount: number;
    fareUgx: number;
    bookingType?: BookingType;
    holdMinutes?: number;
  }): Promise<{
    bookingId: string | null;
    bookingSegmentId: string | null;
    expiresAt: string | null;
    error: Error | null;
  }> {
    try {
      const { data, error } = await supabase.rpc('book_segment', {
        p_trip_id: params.tripId,
        p_passenger_id: params.passengerId,
        p_origin_trip_stop_id: params.originTripStopId,
        p_destination_trip_stop_id: params.destTripStopId,
        p_seat_count: params.seatCount,
        p_fare_ugx: params.fareUgx,
        p_booking_type: params.bookingType || 'seat',
        p_hold_minutes: params.holdMinutes || 15,
      });

      if (error) {
        return { bookingId: null, bookingSegmentId: null, expiresAt: null, error: new Error(error.message) };
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        return { bookingId: null, bookingSegmentId: null, expiresAt: null, error: new Error('Booking failed') };
      }

      return {
        bookingId: row.booking_id,
        bookingSegmentId: row.booking_segment_id,
        expiresAt: row.expires_at,
        error: null,
      };
    } catch (err: any) {
      return { bookingId: null, bookingSegmentId: null, expiresAt: null, error: err };
    }
  }

  async confirmBooking(bookingId: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase.rpc('confirm_booking', {
        p_booking_id: bookingId,
      });
      return { success: !error, error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { success: false, error: err };
    }
  }

  async cancelBooking(bookingId: string, reason?: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase.rpc('cancel_booking', {
        p_booking_id: bookingId,
        p_reason: reason || 'Cancelled by passenger',
      });
      return { success: !error, error: error ? new Error(error.message) : null };
    } catch (err: any) {
      return { success: false, error: err };
    }
  }

  async getBookingTicket(bookingId: string): Promise<BookingTicket | null> {
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_reference,
        status,
        total_seats,
        total_fare_ugx,
        passenger:profiles!bookings_passenger_id_fkey(
          first_name,
          last_name,
          phone
        ),
        trip:trips!bookings_trip_id_fkey(
          departs_at,
          vehicle:vehicles(
            make,
            model,
            license_plate
          ),
          driver:driver_profiles(
            rating_average,
            user:profiles(
              first_name,
              last_name,
              phone
            )
          )
        ),
        segments:booking_segments(
          id,
          expires_at,
          origin_stop:trip_stops!booking_segments_origin_trip_stop_id_fkey(
            pickup_point:pickup_points(name, town:towns(name))
          ),
          dest_stop:trip_stops!booking_segments_destination_trip_stop_id_fkey(
            pickup_point:pickup_points(name, town:towns(name))
          )
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bErr || !booking) return null;

    const b = booking as any;
    const seg = b.segments?.[0];
    const trip = b.trip;
    const driverUser = trip?.driver?.user;
    const passenger = b.passenger;

    return {
      booking_id: b.id,
      booking_reference: b.booking_reference,
      status: b.status,
      total_seats: b.total_seats,
      total_fare_ugx: b.total_fare_ugx,
      passenger_name: passenger ? `${passenger.first_name || ''} ${passenger.last_name || ''}`.trim() : 'Passenger',
      passenger_phone: passenger?.phone || '',
      trip_departs_at: trip?.departs_at || '',
      origin_town: seg?.origin_stop?.pickup_point?.town?.name || 'Origin',
      origin_stage: seg?.origin_stop?.pickup_point?.name || 'Stage',
      dest_town: seg?.dest_stop?.pickup_point?.town?.name || 'Destination',
      dest_stage: seg?.dest_stop?.pickup_point?.name || 'Stage',
      driver_name: driverUser ? `${driverUser.first_name || ''} ${driverUser.last_name || ''}`.trim() : 'Wala Driver',
      driver_phone: driverUser?.phone || '',
      driver_rating: trip?.driver?.rating_average || 5.0,
      vehicle_info: trip?.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model}` : 'Vehicle',
      vehicle_plate: trip?.vehicle?.license_plate || '',
      expires_at: seg?.expires_at || null,
    };
  }

  async getPassengerTickets(passengerId: string): Promise<BookingTicket[]> {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('passenger_id', passengerId)
      .order('created_at', { ascending: false });

    if (error || !bookings) return [];

    const tickets: BookingTicket[] = [];
    for (const b of bookings) {
      const ticket = await this.getBookingTicket(b.id);
      if (ticket) tickets.push(ticket);
    }
    return tickets;
  }
}

export const bookingService = new SupabaseBookingService();
