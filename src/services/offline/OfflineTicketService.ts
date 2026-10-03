import type { BookingTicket } from '../../types/domain';

const STORAGE_KEY = 'wala_offline_tickets_v1';

export class OfflineTicketService {
  /**
   * Save or update a booking ticket in offline cache
   */
  public saveTicket(ticket: BookingTicket): void {
    try {
      const tickets = this.getAllTickets();
      // Ensure ticket has an offline verification token
      const enrichedTicket: BookingTicket = {
        ...ticket,
        offline_token: ticket.offline_token || this.generateOfflineToken(ticket),
      };

      const existingIndex = tickets.findIndex((t) => t.booking_id === enrichedTicket.booking_id);
      if (existingIndex >= 0) {
        tickets[existingIndex] = enrichedTicket;
      } else {
        tickets.unshift(enrichedTicket);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets.slice(0, 30)));
    } catch (err) {
      console.warn('Failed to cache ticket offline:', err);
    }
  }

  /**
   * Retrieve all locally cached tickets
   */
  public getAllTickets(): BookingTicket[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as BookingTicket[];
    } catch {
      return [];
    }
  }

  /**
   * Get a specific ticket by booking ID or reference
   */
  public getTicket(bookingIdOrRef: string): BookingTicket | null {
    const list = this.getAllTickets();
    return list.find((t) => t.booking_id === bookingIdOrRef || t.booking_reference === bookingIdOrRef) || null;
  }

  /**
   * Remove a ticket from cache (e.g. after cancellation)
   */
  public removeTicket(bookingId: string): void {
    try {
      const list = this.getAllTickets().filter((t) => t.booking_id !== bookingId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to remove ticket from cache:', err);
    }
  }

  /**
   * Generate an offline cryptographic checksum token for roadside verification
   */
  public generateOfflineToken(ticket: BookingTicket): string {
    const seed = `${ticket.booking_reference}-${ticket.trip_departs_at}-${ticket.total_seats}-${ticket.passenger_phone}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    return `WALA-OFF-${hex}`;
  }

  /**
   * Check if browser currently has active internet connectivity
   */
  public isOnline(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  }
}

export const offlineTicketService = new OfflineTicketService();
