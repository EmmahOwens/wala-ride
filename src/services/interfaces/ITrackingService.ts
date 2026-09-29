import type {
  TripLocation,
  Incident,
  IncidentKind,
  IncidentStatus,
  PublicTripTracking,
  EmergencyContact,
  Rating,
} from '../../types/domain';

export interface ITrackingService {
  // Driver GPS Location broadcast
  recordLocation(params: {
    tripId: string;
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
  }): Promise<{ success: boolean; error?: Error }>;

  getLatestTripLocation(tripId: string): Promise<TripLocation | null>;
  getTripLocationsHistory(tripId: string, limit?: number): Promise<TripLocation[]>;
  subscribeToTripLocations(tripId: string, onLocation: (loc: TripLocation) => void): () => void;

  // Incident & SOS
  reportIncident(params: {
    tripId?: string;
    bookingId?: string;
    kind: IncidentKind;
    lat?: number;
    lng?: number;
    description?: string;
    reportedBy?: string;
  }): Promise<{ incidentId: string | null; error?: Error }>;

  getAdminIncidents(): Promise<Incident[]>;
  resolveIncident(incidentId: string, status: IncidentStatus, handlerId?: string): Promise<{ success: boolean; error?: Error }>;
  subscribeToIncidents(onIncidentChange: (incident: Incident) => void): () => void;

  // Trip sharing
  createTripShare(bookingId: string, hoursValid?: number): Promise<{ shareToken: string; expiresAt: string; shareUrl: string } | null>;
  getPublicTripTracking(shareToken: string): Promise<PublicTripTracking | null>;

  // Emergency contacts
  getEmergencyContacts(userId: string): Promise<EmergencyContact[]>;
  addEmergencyContact(contact: { userId: string; name: string; phone: string; relationship?: string }): Promise<EmergencyContact | null>;
  deleteEmergencyContact(contactId: string): Promise<boolean>;

  // Ratings
  submitRating(params: {
    tripId?: string;
    bookingId?: string;
    score: number;
    comment?: string;
    reviewerId?: string;
    revieweeId?: string;
  }): Promise<{ success: boolean; error?: Error }>;
  getTripRatings(tripId: string): Promise<Rating[]>;
}
