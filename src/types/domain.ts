export type UserRoleType = 'passenger' | 'driver' | 'operator' | 'admin' | 'support_agent';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type PickupPointKind = 'terminal' | 'stage' | 'landmark' | 'custom';

export type TripStatus = 'draft' | 'scheduled' | 'boarding' | 'in_progress' | 'completed' | 'cancelled';

export type BookingStatus = 'held' | 'confirmed' | 'cancelled' | 'expired' | 'completed';

export type BookingType = 'seat' | 'private_vehicle';

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  profile_photo_url: string | null;
  account_status: string;
  created_at: string;
  updated_at: string;
}

export interface DriverProfile {
  id: string;
  user_id: string;
  operator_id: string | null;
  license_number: string | null;
  license_class: string | null;
  license_expiry: string | null;
  national_id: string | null;
  verification_status: VerificationStatus;
  online_status: boolean;
  rating_average: number;
  total_trips: number;
  created_at: string;
}

export interface DriverDocument {
  id: string;
  driver_id: string;
  document_type: string;
  file_path: string;
  verification_status: VerificationStatus;
  rejection_reason?: string | null;
  verified_at?: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  operator_id: string | null;
  primary_driver_id: string | null;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  license_plate: string;
  capacity_seats: number;
  status: string;
  verification_status: VerificationStatus;
  created_at: string;
}

export interface Town {
  id: string;
  name: string;
  region: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
}

export interface PickupPoint {
  id: string;
  town_id: string;
  name: string;
  kind: PickupPointKind;
  lat: number | null;
  lng: number | null;
  description: string | null;
  is_active: boolean;
  created_by?: string | null;
  towns?: Town;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_ugx: number;
  period_days: number;
  max_trips_per_period: number;
  max_leads_per_period: number;
  is_active: boolean;
  features?: { feature_key: string; feature_value: string }[];
  featuresMap?: Record<string, string>;
}

export interface Route {
  id: string;
  name: string;
  origin_town_id: string;
  destination_town_id: string;
  distance_km: number | null;
  estimated_duration_minutes: number | null;
  status: string;
  origin_town?: Town;
  destination_town?: Town;
  stops?: RouteStop[];
}

export interface RouteStop {
  id: string;
  route_id: string;
  town_id: string;
  pickup_point_id: string | null;
  sequence: number;
  distance_from_origin_km: number | null;
  estimated_minutes_from_origin: number | null;
  pickup_allowed: boolean;
  dropoff_allowed: boolean;
  town?: Town;
  pickup_point?: PickupPoint;
}

export interface Trip {
  id: string;
  operator_id: string;
  driver_id: string;
  vehicle_id: string;
  route_id: string;
  departs_at: string;
  estimated_arrives_at: string | null;
  status: TripStatus;
  seats_total: number;
  base_fare_ugx: number;
  notes: string | null;
  created_at: string;
  route?: Route;
  vehicle?: Vehicle;
  driver?: DriverProfile;
  stops?: TripStop[];
}

export interface TripStop {
  id: string;
  trip_id: string;
  route_stop_id: string | null;
  pickup_point_id: string;
  sequence: number;
  scheduled_arrival: string | null;
  scheduled_departure: string | null;
  fare_from_origin_ugx: number | null;
  status: string;
  pickup_point?: PickupPoint;
}

export interface SearchResultTrip {
  trip_id: string;
  driver_name: string;
  driver_phone: string;
  driver_rating: number;
  vehicle_info: string;
  vehicle_plate: string;
  departs_at: string;
  estimated_arrives_at: string | null;
  seats_available: number;
  seats_total: number;
  fare_ugx: number;
  origin_trip_stop_id: string;
  origin_pickup_name: string;
  origin_town_name: string;
  dest_trip_stop_id: string;
  dest_pickup_name: string;
  dest_town_name: string;
}

export interface Booking {
  id: string;
  booking_reference: string;
  passenger_id: string;
  trip_id: string;
  booking_type: BookingType;
  status: BookingStatus;
  total_seats: number;
  total_fare_ugx: number;
  contact_phone: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface BookingTicket {
  booking_id: string;
  booking_reference: string;
  trip_id?: string;
  status: BookingStatus;
  total_seats: number;
  total_fare_ugx: number;
  passenger_name: string;
  passenger_phone: string;
  trip_departs_at: string;
  origin_town: string;
  origin_stage: string;
  dest_town: string;
  dest_stage: string;
  driver_name: string;
  driver_phone: string;
  driver_rating: number;
  vehicle_info: string;
  vehicle_plate: string;
  expires_at?: string | null;
}

export interface ManifestPassenger {
  booking_id: string;
  booking_reference: string;
  passenger_name: string;
  passenger_phone: string;
  seats: number;
  fare_ugx: number;
  origin_stage: string;
  origin_sequence: number;
  dest_stage: string;
  dest_sequence: number;
  status: BookingStatus;
}

export interface TripManifest {
  trip: Trip;
  passengers: ManifestPassenger[];
  total_boarded: number;
  total_expected_fare_ugx: number;
}


export interface DriverSubscriptionSummary {
  subscription_id: string;
  plan_id: string;
  plan_name: string;
  price_ugx: number;
  status: string;
  starts_at: string;
  ends_at: string;
  days_remaining: number;
  trips_posted: number;
  max_trips: number;
  trips_remaining: number;
  leads_viewed: number;
  max_leads: number;
  leads_remaining: number;
}

export interface RadarLead {
  alert_id: string;
  passenger_id: string;
  origin_town_id: string;
  origin_town_name: string;
  destination_town_id: string;
  destination_town_name: string;
  travel_date: string;
  seats_needed: number;
  created_at: string;
  is_unlocked: boolean;
  passenger_name: string;
  passenger_phone: string;
}

export interface TripAlert {
  id: string;
  passenger_id: string;
  origin_town_id: string;
  destination_town_id: string;
  travel_date: string;
  seats_needed: number;
  status: string;
  created_at: string;
}

export interface PaymentRecord {
  payment_id: string;
  purpose: string;
  amount_ugx: number;
  method: string;
  status: string;
  provider: string;
  provider_ref: string;
  plan_name: string;
  initiated_at: string;
  completed_at: string | null;
}

export interface InitiatePaymentResult {
  payment_id: string;
  provider_ref: string;
  amount_ugx: number;
  method: string;
  status: string;
  phone_number: string;
  network: string;
  instructions: string;
}

// ============================================================================
// PHASE 4 — TRACKING & SAFETY DOMAIN TYPES
// ============================================================================

export type IncidentKind = 'sos' | 'accident' | 'breakdown' | 'harassment' | 'other';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';

export interface TripLocation {
  id: number;
  trip_id: string;
  driver_id: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recorded_at: string;
}

export interface EmergencyContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relationship: string | null;
  created_at: string;
}

export interface TripShare {
  id: string;
  booking_id: string;
  share_token: string;
  expires_at: string;
  created_at: string;
}

export interface Incident {
  id: string;
  trip_id: string | null;
  booking_id: string | null;
  reported_by: string;
  kind: IncidentKind;
  lat: number | null;
  lng: number | null;
  description: string | null;
  status: IncidentStatus;
  handled_by: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter?: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  trip?: {
    id: string;
    status: string;
    departs_at: string;
    route_name: string;
    driver_name: string;
    driver_phone: string | null;
    vehicle_plate: string;
    vehicle_model: string;
  } | null;
  booking?: {
    reference: string;
    seats: number;
  } | null;
  handler?: {
    id: string;
    name: string;
  } | null;
}

export interface PublicTripTracking {
  share_token: string;
  expires_at: string;
  error?: string;
  booking?: {
    reference: string;
    passenger_first_name: string;
    seats: number;
    status: string;
  };
  trip?: {
    id: string;
    status: string;
    route_name: string;
    origin_town: string;
    dest_town: string;
    departs_at: string;
    estimated_arrives_at: string | null;
  };
  driver?: {
    name: string;
    phone: string | null;
    rating: number;
    total_trips: number;
  };
  vehicle?: {
    make: string;
    model: string;
    color: string | null;
    license_plate: string;
  };
  latest_location?: {
    lat: number;
    lng: number;
    speed: number | null;
    heading: number | null;
    accuracy: number | null;
    recorded_at: string;
  } | null;
  breadcrumbs?: Array<{
    lat: number;
    lng: number;
    speed: number | null;
    recorded_at: string;
  }>;
  stops?: Array<{
    sequence: number;
    stage_name: string;
    town_name: string;
    status: string;
  }>;
}

export interface Rating {
  id: string;
  trip_id: string | null;
  booking_id: string | null;
  reviewer_id: string;
  reviewee_id: string;
  score: number;
  comment: string | null;
  created_at: string;
}

// ============================================================================
// PHASE 5 — ADMIN, SUPPORT, NOTIFICATIONS & DEMAND ANALYTICS TYPES
// ============================================================================

export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
export type SupportTicketCategory = 'payment_issue' | 'delay_cancellation' | 'safety' | 'luggage' | 'app_bug' | 'general';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  description: string | null;
  category: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assigned_to: string | null;
  trip_id: string | null;
  booking_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  assigned_agent?: {
    id: string;
    name: string;
  } | null;
  booking?: {
    id: string;
    reference: string;
    total_seats: number;
    total_fare_ugx?: number;
    status?: string;
  } | null;
  trip?: {
    id: string;
    status: string;
    departs_at: string;
    route_name: string;
  } | null;
  messages_count?: number;
  last_message?: string | null;
  last_message_at?: string | null;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  attachment_url: string | null;
  created_at: string;
  sender_name?: string;
  is_staff?: boolean;
}

export interface TicketDetailsResult {
  ticket: SupportTicket;
  messages: SupportMessage[];
}

export type NotificationChannel = 'in_app' | 'push' | 'sms';

export interface AppNotification {
  id: string;
  user_id: string;
  channel: NotificationChannel;
  type: string;
  title: string | null;
  body: string | null;
  data: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
}

export interface DemandAnalyticsSummary {
  period_days: number;
  total_searches: number;
  unserved_searches: number;
  unserved_rate_pct: number;
  passengers_demanding: number;
  alert_conversions: number;
}

export interface DemandCorridorMetric {
  origin_town_id: string;
  origin_town_name: string;
  destination_town_id: string;
  destination_town_name: string;
  search_count: number;
  unserved_count: number;
  total_seats_requested: number;
  active_trips_count: number;
  supply_status: 'CRITICAL_SHORTAGE' | 'HIGH_DEMAND' | 'BALANCED';
}

export interface DemandDailyTrend {
  date: string;
  search_count: number;
  unserved_count: number;
}

export interface DemandAnalyticsResult {
  summary: DemandAnalyticsSummary;
  corridors: DemandCorridorMetric[];
  daily_trends: DemandDailyTrend[];
}

export interface AdminTownInput {
  id?: string;
  name: string;
  region?: string;
  lat?: number;
  lng?: number;
  is_active?: boolean;
}

export interface AdminRouteStopInput {
  town_id: string;
  pickup_point_id?: string | null;
  sequence: number;
  distance_from_origin_km?: number | null;
  estimated_minutes_from_origin?: number | null;
  pickup_allowed?: boolean;
  dropoff_allowed?: boolean;
}

export interface AdminRouteInput {
  id?: string;
  name: string;
  origin_town_id: string;
  destination_town_id: string;
  distance_km?: number | null;
  estimated_duration_minutes?: number | null;
  status?: string;
  stops?: AdminRouteStopInput[];
}



