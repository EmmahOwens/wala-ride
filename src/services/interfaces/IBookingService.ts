import type { SearchResultTrip, BookingTicket, BookingType } from '../../types/domain';

export interface IBookingService {
  searchTrips(params: {
    originTownId: string;
    destTownId: string;
    date: string;
    seats?: number;
  }): Promise<SearchResultTrip[]>;

  bookSegment(params: {
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
  }>;

  confirmBooking(bookingId: string): Promise<{ success: boolean; error: Error | null }>;

  cancelBooking(bookingId: string, reason?: string): Promise<{ success: boolean; error: Error | null }>;

  getBookingTicket(bookingId: string): Promise<BookingTicket | null>;

  getPassengerTickets(passengerId: string): Promise<BookingTicket[]>;
}
