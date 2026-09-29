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
