export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      booking_passengers: {
        Row: {
          booking_id: string
          created_at: string
          full_name: string
          id: string
          phone: string | null
          seat_count: number
        }
        Insert: {
          booking_id: string
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          seat_count?: number
        }
        Update: {
          booking_id?: string
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          seat_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_passengers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_segments: {
        Row: {
          booking_id: string
          created_at: string
          destination_sequence: number
          destination_trip_stop_id: string
          expires_at: string | null
          fare_ugx: number
          id: string
          origin_sequence: number
          origin_trip_stop_id: string
          seat_count: number
          status: Database["public"]["Enums"]["segment_status_enum"]
          trip_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          destination_sequence: number
          destination_trip_stop_id: string
          expires_at?: string | null
          fare_ugx: number
          id?: string
          origin_sequence: number
          origin_trip_stop_id: string
          seat_count: number
          status?: Database["public"]["Enums"]["segment_status_enum"]
          trip_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          destination_sequence?: number
          destination_trip_stop_id?: string
          expires_at?: string | null
          fare_ugx?: number
          id?: string
          origin_sequence?: number
          origin_trip_stop_id?: string
          seat_count?: number
          status?: Database["public"]["Enums"]["segment_status_enum"]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_segments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_segments_destination_trip_stop_id_fkey"
            columns: ["destination_trip_stop_id"]
            isOneToOne: false
            referencedRelation: "trip_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_segments_origin_trip_stop_id_fkey"
            columns: ["origin_trip_stop_id"]
            isOneToOne: false
            referencedRelation: "trip_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_reference: string
          booking_type: Database["public"]["Enums"]["booking_type_enum"]
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          confirmed_at: string | null
          contact_phone: string | null
          created_at: string
          id: string
          passenger_id: string
          status: Database["public"]["Enums"]["booking_status_enum"]
          total_fare_ugx: number
          total_seats: number
          trip_id: string
        }
        Insert: {
          booking_reference?: string
          booking_type?: Database["public"]["Enums"]["booking_type_enum"]
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          passenger_id: string
          status?: Database["public"]["Enums"]["booking_status_enum"]
          total_fare_ugx: number
          total_seats: number
          trip_id: string
        }
        Update: {
          booking_reference?: string
          booking_type?: Database["public"]["Enums"]["booking_type_enum"]
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          passenger_id?: string
          status?: Database["public"]["Enums"]["booking_status_enum"]
          total_fare_ugx?: number
          total_seats?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          created_at: string
          document_number: string | null
          document_type: string
          driver_id: string
          expiry_date: string | null
          file_path: string
          id: string
          issue_date: string | null
          reject_reason: string | null
          verification_status: Database["public"]["Enums"]["verification_status_enum"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          document_type: string
          driver_id: string
          expiry_date?: string | null
          file_path: string
          id?: string
          issue_date?: string | null
          reject_reason?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status_enum"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          document_number?: string | null
          document_type?: string
          driver_id?: string
          expiry_date?: string | null
          file_path?: string
          id?: string
          issue_date?: string | null
          reject_reason?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status_enum"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_profiles: {
        Row: {
          created_at: string
          id: string
          license_class: string | null
          license_expiry: string | null
          license_number: string | null
          national_id: string | null
          online_status: boolean
          operator_id: string | null
          rating_average: number
          total_trips: number
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["verification_status_enum"]
        }
        Insert: {
          created_at?: string
          id?: string
          license_class?: string | null
          license_expiry?: string | null
          license_number?: string | null
          national_id?: string | null
          online_status?: boolean
          operator_id?: string | null
          rating_average?: number
          total_trips?: number
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["verification_status_enum"]
        }
        Update: {
          created_at?: string
          id?: string
          license_class?: string | null
          license_expiry?: string | null
          license_number?: string | null
          national_id?: string | null
          online_status?: boolean
          operator_id?: string | null
          rating_average?: number
          total_trips?: number
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "driver_profiles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_subscriptions: {
        Row: {
          created_at: string
          driver_id: string
          ends_at: string
          id: string
          payment_id: string | null
          plan_id: string
          starts_at: string
          status: Database["public"]["Enums"]["subscription_status_enum"]
        }
        Insert: {
          created_at?: string
          driver_id: string
          ends_at: string
          id?: string
          payment_id?: string | null
          plan_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status_enum"]
        }
        Update: {
          created_at?: string
          driver_id?: string
          ends_at?: string
          id?: string
          payment_id?: string | null
          plan_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "driver_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_driver_sub_payment"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          relationship: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
          relationship?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          relationship?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          booking_id: string | null
          created_at: string
          description: string | null
          handled_by: string | null
          id: string
          kind: Database["public"]["Enums"]["incident_kind_enum"]
          lat: number | null
          lng: number | null
          reported_by: string
          resolved_at: string | null
          status: string
          trip_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          description?: string | null
          handled_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["incident_kind_enum"]
          lat?: number | null
          lng?: number | null
          reported_by: string
          resolved_at?: string | null
          status?: string
          trip_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          description?: string | null
          handled_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["incident_kind_enum"]
          lat?: number | null
          lng?: number | null
          reported_by?: string
          resolved_at?: string | null
          status?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_views: {
        Row: {
          driver_id: string
          id: string
          trip_alert_id: string
          viewed_at: string
        }
        Insert: {
          driver_id: string
          id?: string
          trip_alert_id: string
          viewed_at?: string
        }
        Update: {
          driver_id?: string
          id?: string
          trip_alert_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_views_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_views_trip_alert_id_fkey"
            columns: ["trip_alert_id"]
            isOneToOne: false
            referencedRelation: "trip_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel_enum"]
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["notification_channel_enum"]
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel_enum"]
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          created_at: string
          description: string | null
          email: string | null
          id: string
          name: string
          owner_user_id: string | null
          phone: string | null
          status: string
          type: Database["public"]["Enums"]["operator_type_enum"]
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status_enum"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name: string
          owner_user_id?: string | null
          phone?: string | null
          status?: string
          type?: Database["public"]["Enums"]["operator_type_enum"]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status_enum"]
        }
        Update: {
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          name?: string
          owner_user_id?: string | null
          phone?: string | null
          status?: string
          type?: Database["public"]["Enums"]["operator_type_enum"]
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "operators_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_ugx: number
          applied: boolean
          completed_at: string | null
          driver_id: string
          id: string
          idempotency_key: string | null
          initiated_at: string
          method: Database["public"]["Enums"]["payment_method_enum"]
          plan_id: string | null
          provider: string | null
          provider_ref: string | null
          purpose: Database["public"]["Enums"]["payment_purpose_enum"]
          raw_callback: Json | null
          status: Database["public"]["Enums"]["payment_status_enum"]
        }
        Insert: {
          amount_ugx: number
          applied?: boolean
          completed_at?: string | null
          driver_id: string
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          method: Database["public"]["Enums"]["payment_method_enum"]
          plan_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          purpose: Database["public"]["Enums"]["payment_purpose_enum"]
          raw_callback?: Json | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
        }
        Update: {
          amount_ugx?: number
          applied?: boolean
          completed_at?: string | null
          driver_id?: string
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          method?: Database["public"]["Enums"]["payment_method_enum"]
          plan_id?: string | null
          provider?: string | null
          provider_ref?: string | null
          purpose?: Database["public"]["Enums"]["payment_purpose_enum"]
          raw_callback?: Json | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_points: {
        Row: {
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["pickup_point_kind_enum"]
          lat: number | null
          lng: number | null
          name: string
          town_id: string
        }
        Insert: {
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["pickup_point_kind_enum"]
          lat?: number | null
          lng?: number | null
          name: string
          town_id: string
        }
        Update: {
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["pickup_point_kind_enum"]
          lat?: number | null
          lng?: number | null
          name?: string
          town_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_points_town_id_fkey"
            columns: ["town_id"]
            isOneToOne: false
            referencedRelation: "towns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          profile_photo_url: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          profile_photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotion_redemptions: {
        Row: {
          booking_id: string | null
          created_at: string
          discount_amount: number | null
          id: string
          promotion_id: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          discount_amount?: number | null
          id?: string
          promotion_id: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          discount_amount?: number | null
          id?: string
          promotion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_redemptions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_redemptions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string | null
          discount_value: number | null
          end_date: string | null
          id: string
          is_active: boolean
          maximum_discount: number | null
          minimum_amount: number | null
          name: string | null
          start_date: string | null
          usage_limit: number | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          maximum_discount?: number | null
          minimum_amount?: number | null
          name?: string | null
          start_date?: string | null
          usage_limit?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          maximum_discount?: number | null
          minimum_amount?: number | null
          name?: string | null
          start_date?: string | null
          usage_limit?: number | null
        }
        Relationships: []
      }
      push_notifications: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          booking_id: string | null
          comment: string | null
          created_at: string
          id: string
          reviewee_id: string
          reviewer_id: string
          score: number
          trip_id: string | null
        }
        Insert: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          reviewee_id: string
          reviewer_id: string
          score: number
          trip_id?: string | null
        }
        Update: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          reviewee_id?: string
          reviewer_id?: string
          score?: number
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          distance_from_origin_km: number | null
          dropoff_allowed: boolean
          estimated_minutes_from_origin: number | null
          id: string
          pickup_allowed: boolean
          pickup_point_id: string | null
          route_id: string
          sequence: number
          town_id: string
        }
        Insert: {
          distance_from_origin_km?: number | null
          dropoff_allowed?: boolean
          estimated_minutes_from_origin?: number | null
          id?: string
          pickup_allowed?: boolean
          pickup_point_id?: string | null
          route_id: string
          sequence: number
          town_id: string
        }
        Update: {
          distance_from_origin_km?: number | null
          dropoff_allowed?: boolean
          estimated_minutes_from_origin?: number | null
          id?: string
          pickup_allowed?: boolean
          pickup_point_id?: string | null
          route_id?: string
          sequence?: number
          town_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_town_id_fkey"
            columns: ["town_id"]
            isOneToOne: false
            referencedRelation: "towns"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          created_by: string | null
          destination_town_id: string
          distance_km: number | null
          estimated_duration_minutes: number | null
          id: string
          name: string | null
          origin_town_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination_town_id: string
          distance_km?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          name?: string | null
          origin_town_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination_town_id?: string
          distance_km?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          name?: string | null
          origin_town_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_destination_town_id_fkey"
            columns: ["destination_town_id"]
            isOneToOne: false
            referencedRelation: "towns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_origin_town_id_fkey"
            columns: ["origin_town_id"]
            isOneToOne: false
            referencedRelation: "towns"
            referencedColumns: ["id"]
          },
        ]
      }
      search_events: {
        Row: {
          created_at: string
          destination_town_id: string | null
          id: string
          origin_town_id: string | null
          result_count: number
          seats_needed: number | null
          travel_date: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          destination_town_id?: string | null
          id?: string
          origin_town_id?: string | null
          result_count?: number
          seats_needed?: number | null
          travel_date?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          destination_town_id?: string | null
          id?: string
          origin_town_id?: string | null
          result_count?: number
          seats_needed?: number | null
          travel_date?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_events_destination_town_id_fkey"
            columns: ["destination_town_id"]
            isOneToOne: false
            referencedRelation: "towns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_events_origin_town_id_fkey"
            columns: ["origin_town_id"]
            isOneToOne: false
            referencedRelation: "towns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_features: {
        Row: {
          feature_key: string
          feature_value: string
          id: string
          plan_id: string
        }
        Insert: {
          feature_key: string
          feature_value: string
          id?: string
          plan_id: string
        }
        Update: {
          feature_key?: string
          feature_value?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_leads_per_period: number
          max_trips_per_period: number
          name: string
          period_days: number
          price_ugx: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_leads_per_period: number
          max_trips_per_period: number
          name: string
          period_days: number
          price_ugx: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_leads_per_period?: number
          max_trips_per_period?: number
          name?: string
          period_days?: number
          price_ugx?: number
        }
        Relationships: []
      }
      subscription_usage: {
        Row: {
          driver_id: string
          extra_leads: number
          extra_trips: number
          id: string
          leads_viewed: number
          period_start: string
          trips_posted: number
        }
        Insert: {
          driver_id: string
          extra_leads?: number
          extra_trips?: number
          id?: string
          leads_viewed?: number
          period_start: string
          trips_posted?: number
        }
        Update: {
          driver_id?: string
          extra_leads?: number
          extra_trips?: number
          id?: string
          leads_viewed?: number
          period_start?: string
          trips_posted?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_usage_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachment_url: string | null
          created_at: string
          id: string
          message: string
          sender_id: string
          ticket_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          message: string
          sender_id: string
          ticket_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          booking_id: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          booking_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          booking_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      towns: {
        Row: {
          district: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          region: string | null
        }
        Insert: {
          district?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          region?: string | null
        }
        Update: {
          district?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          region?: string | null
        }
        Relationships: []
      }
      trip_alerts: {
        Row: {
          created_at: string
          destination_town_id: string
          id: string
          origin_town_id: string
          passenger_id: string
          seats_needed: number
          status: string
          travel_date: string
        }
        Insert: {
          created_at?: string
          destination_town_id: string
          id?: string
          origin_town_id: string
          passenger_id: string
          seats_needed?: number
          status?: string
          travel_date: string
        }
        Update: {
          created_at?: string
          destination_town_id?: string
          id?: string
          origin_town_id?: string
          passenger_id?: string
          seats_needed?: number
          status?: string
          travel_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_alerts_destination_town_id_fkey"
            columns: ["destination_town_id"]
            isOneToOne: false
            referencedRelation: "towns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_alerts_origin_town_id_fkey"
            columns: ["origin_town_id"]
            isOneToOne: false
            referencedRelation: "towns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_alerts_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          lat: number | null
          lng: number | null
          metadata: Json | null
          pickup_point_id: string | null
          trip_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          pickup_point_id?: string | null
          trip_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          lat?: number | null
          lng?: number | null
          metadata?: Json | null
          pickup_point_id?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_locations: {
        Row: {
          accuracy: number | null
          driver_id: string
          heading: number | null
          id: number
          lat: number
          lng: number
          recorded_at: string
          speed: number | null
          trip_id: string
        }
        Insert: {
          accuracy?: number | null
          driver_id: string
          heading?: number | null
          id?: number
          lat: number
          lng: number
          recorded_at?: string
          speed?: number | null
          trip_id: string
        }
        Update: {
          accuracy?: number | null
          driver_id?: string
          heading?: number | null
          id?: number
          lat?: number
          lng?: number
          recorded_at?: string
          speed?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_locations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_shares: {
        Row: {
          booking_id: string
          created_at: string
          expires_at: string
          id: string
          share_token: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          expires_at: string
          id?: string
          share_token?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_shares_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_stops: {
        Row: {
          actual_arrival: string | null
          actual_departure: string | null
          fare_from_origin_ugx: number | null
          id: string
          pickup_point_id: string
          route_stop_id: string | null
          scheduled_arrival: string | null
          scheduled_departure: string | null
          sequence: number
          status: string
          trip_id: string
        }
        Insert: {
          actual_arrival?: string | null
          actual_departure?: string | null
          fare_from_origin_ugx?: number | null
          id?: string
          pickup_point_id: string
          route_stop_id?: string | null
          scheduled_arrival?: string | null
          scheduled_departure?: string | null
          sequence: number
          status?: string
          trip_id: string
        }
        Update: {
          actual_arrival?: string | null
          actual_departure?: string | null
          fare_from_origin_ugx?: number | null
          id?: string
          pickup_point_id?: string
          route_stop_id?: string | null
          scheduled_arrival?: string | null
          scheduled_departure?: string | null
          sequence?: number
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_stops_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_stops_route_stop_id_fkey"
            columns: ["route_stop_id"]
            isOneToOne: false
            referencedRelation: "route_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_stops_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          actual_arrives_at: string | null
          actual_departs_at: string | null
          base_fare_ugx: number
          cancel_reason: string | null
          created_at: string
          departs_at: string
          driver_id: string
          estimated_arrives_at: string | null
          id: string
          max_fare_ugx: number | null
          min_fare_ugx: number | null
          notes: string | null
          operator_id: string
          published_at: string | null
          route_id: string
          seats_total: number
          status: Database["public"]["Enums"]["trip_status_enum"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          actual_arrives_at?: string | null
          actual_departs_at?: string | null
          base_fare_ugx: number
          cancel_reason?: string | null
          created_at?: string
          departs_at: string
          driver_id: string
          estimated_arrives_at?: string | null
          id?: string
          max_fare_ugx?: number | null
          min_fare_ugx?: number | null
          notes?: string | null
          operator_id: string
          published_at?: string | null
          route_id: string
          seats_total: number
          status?: Database["public"]["Enums"]["trip_status_enum"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          actual_arrives_at?: string | null
          actual_departs_at?: string | null
          base_fare_ugx?: number
          cancel_reason?: string | null
          created_at?: string
          departs_at?: string
          driver_id?: string
          estimated_arrives_at?: string | null
          id?: string
          max_fare_ugx?: number | null
          min_fare_ugx?: number | null
          notes?: string | null
          operator_id?: string
          published_at?: string | null
          route_id?: string
          seats_total?: number
          status?: Database["public"]["Enums"]["trip_status_enum"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["user_role_enum"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["user_role_enum"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["user_role_enum"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_documents: {
        Row: {
          created_at: string
          document_number: string | null
          document_type: string
          expiry_date: string | null
          file_path: string
          id: string
          issue_date: string | null
          vehicle_id: string
          verification_status: Database["public"]["Enums"]["verification_status_enum"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          document_number?: string | null
          document_type: string
          expiry_date?: string | null
          file_path: string
          id?: string
          issue_date?: string | null
          vehicle_id: string
          verification_status?: Database["public"]["Enums"]["verification_status_enum"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          document_number?: string | null
          document_type?: string
          expiry_date?: string | null
          file_path?: string
          id?: string
          issue_date?: string | null
          vehicle_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status_enum"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          color: string | null
          created_at: string
          id: string
          inspection_expiry: string | null
          insurance_expiry: string | null
          make: string | null
          model: string | null
          operator_id: string
          photo_path: string | null
          primary_driver_id: string | null
          registration_number: string
          seat_capacity: number
          status: Database["public"]["Enums"]["vehicle_status_enum"]
          updated_at: string
          vehicle_type: string | null
          year: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          inspection_expiry?: string | null
          insurance_expiry?: string | null
          make?: string | null
          model?: string | null
          operator_id: string
          photo_path?: string | null
          primary_driver_id?: string | null
          registration_number: string
          seat_capacity: number
          status?: Database["public"]["Enums"]["vehicle_status_enum"]
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          inspection_expiry?: string | null
          insurance_expiry?: string | null
          make?: string | null
          model?: string | null
          operator_id?: string
          photo_path?: string | null
          primary_driver_id?: string | null
          registration_number?: string
          seat_capacity?: number
          status?: Database["public"]["Enums"]["vehicle_status_enum"]
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_primary_driver_id_fkey"
            columns: ["primary_driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string | null
          id: string | null
          keys: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint?: string | null
          id?: string | null
          keys?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string | null
          id?: string | null
          keys?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_subscription: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      book_segment: {
        Args: {
          p_booking_type?: Database["public"]["Enums"]["booking_type_enum"]
          p_destination_trip_stop_id: string
          p_fare_ugx: number
          p_hold_minutes?: number
          p_origin_trip_stop_id: string
          p_passenger_id: string
          p_seat_count: number
          p_trip_id: string
        }
        Returns: {
          booking_id: string
          booking_segment_id: string
          expires_at: string
        }[]
      }
      cancel_booking: {
        Args: { p_booking_id: string; p_reason?: string }
        Returns: undefined
      }
      check_subscription_expiry: {
        Args: { p_grace_days?: number }
        Returns: undefined
      }
      confirm_booking: { Args: { p_booking_id: string }; Returns: undefined }
      credit_lead_topup: {
        Args: { p_leads_count?: number; p_payment_id: string }
        Returns: undefined
      }
      current_driver_id: { Args: never; Returns: string }
      expire_stale_holds: { Args: never; Returns: undefined }
      get_or_create_driver_operator: {
        Args: { p_user_id: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_driver: { Args: never; Returns: boolean }
      is_support: { Args: never; Returns: boolean }
      process_payment_callback: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      publish_trip: {
        Args: {
          p_base_fare_ugx: number
          p_departs_at: string
          p_driver_id: string
          p_notes?: string
          p_route_id: string
          p_vehicle_id: string
        }
        Returns: string
      }
      reveal_lead: {
        Args: { p_driver_id: string; p_trip_alert_id: string }
        Returns: {
          passenger_phone: string
        }[]
      }
      search_available_trips: {
        Args: {
          p_date: string
          p_dest_town_id: string
          p_origin_town_id: string
          p_required_seats?: number
        }
        Returns: {
          departs_at: string
          dest_pickup_name: string
          dest_town_name: string
          dest_trip_stop_id: string
          driver_name: string
          driver_phone: string
          driver_rating: number
          estimated_arrives_at: string
          fare_ugx: number
          origin_pickup_name: string
          origin_town_name: string
          origin_trip_stop_id: string
          seats_available: number
          seats_total: number
          trip_id: string
          vehicle_info: string
          vehicle_plate: string
        }[]
      }
    }
    Enums: {
      booking_status_enum:
        | "held"
        | "confirmed"
        | "cancelled"
        | "expired"
        | "completed"
      booking_type_enum: "seat" | "private_vehicle"
      incident_kind_enum:
        | "sos"
        | "accident"
        | "breakdown"
        | "harassment"
        | "other"
      notification_channel_enum: "sms" | "push" | "in_app"
      operator_type_enum: "individual" | "fleet" | "company"
      payment_method_enum: "momo" | "airtel" | "card" | "manual"
      payment_purpose_enum: "subscription" | "lead_topup"
      payment_status_enum: "pending" | "successful" | "failed" | "refunded"
      pickup_point_kind_enum: "terminal" | "stage" | "landmark" | "custom"
      segment_status_enum:
        | "held"
        | "confirmed"
        | "cancelled"
        | "expired"
        | "completed"
      subscription_status_enum:
        | "trialing"
        | "active"
        | "grace"
        | "expired"
        | "cancelled"
      trip_status_enum:
        | "draft"
        | "scheduled"
        | "boarding"
        | "in_progress"
        | "completed"
        | "cancelled"
      user_role_enum:
        | "passenger"
        | "driver"
        | "operator"
        | "admin"
        | "support_agent"
      vehicle_status_enum: "active" | "maintenance" | "inactive"
      verification_status_enum: "pending" | "verified" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      booking_status_enum: [
        "held",
        "confirmed",
        "cancelled",
        "expired",
        "completed",
      ],
      booking_type_enum: ["seat", "private_vehicle"],
      incident_kind_enum: [
        "sos",
        "accident",
        "breakdown",
        "harassment",
        "other",
      ],
      notification_channel_enum: ["sms", "push", "in_app"],
      operator_type_enum: ["individual", "fleet", "company"],
      payment_method_enum: ["momo", "airtel", "card", "manual"],
      payment_purpose_enum: ["subscription", "lead_topup"],
      payment_status_enum: ["pending", "successful", "failed", "refunded"],
      pickup_point_kind_enum: ["terminal", "stage", "landmark", "custom"],
      segment_status_enum: [
        "held",
        "confirmed",
        "cancelled",
        "expired",
        "completed",
      ],
      subscription_status_enum: [
        "trialing",
        "active",
        "grace",
        "expired",
        "cancelled",
      ],
      trip_status_enum: [
        "draft",
        "scheduled",
        "boarding",
        "in_progress",
        "completed",
        "cancelled",
      ],
      user_role_enum: [
        "passenger",
        "driver",
        "operator",
        "admin",
        "support_agent",
      ],
      vehicle_status_enum: ["active", "maintenance", "inactive"],
      verification_status_enum: ["pending", "verified", "rejected"],
    },
  },
} as const
