export type UserRoleType = 'passenger' | 'driver' | 'operator' | 'admin' | 'support_agent';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type PickupPointKind = 'terminal' | 'stage' | 'landmark' | 'custom';

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
  document_type: string; // 'license', 'national_id', 'permit'
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
}
