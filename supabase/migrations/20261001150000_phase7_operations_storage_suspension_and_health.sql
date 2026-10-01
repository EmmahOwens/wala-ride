-- ============================================================================
-- MIGRATION: BACKEND IMPLEMENTATION PLAN PHASE 7 & OPERATIONS
-- Modules 1.4, 3.2, 3.3, 9.3, 10.2
-- ============================================================================

-- 1. Storage Buckets Creation & Storage RLS Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('driver-documents', 'driver-documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('vehicle-documents', 'vehicle-documents', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('ticket-attachments', 'ticket-attachments', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DO $$
BEGIN
  -- Driver documents policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload driver documents' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users can upload driver documents" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users and admins can view driver documents' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users and admins can view driver documents" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'driver-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users and admins can delete driver documents' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users and admins can delete driver documents" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'driver-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin()));
  END IF;

  -- Vehicle documents policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload vehicle documents' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users can upload vehicle documents" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'vehicle-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users and admins can view vehicle documents' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users and admins can view vehicle documents" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'vehicle-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users and admins can delete vehicle documents' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users and admins can delete vehicle documents" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'vehicle-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR is_admin()));
  END IF;

  -- Ticket attachments policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload ticket attachments' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users can upload ticket attachments" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ticket-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users and staff can view ticket attachments' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Users and staff can view ticket attachments" ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'ticket-attachments' 
      AND (
        (storage.foldername(name))[1] = auth.uid()::text 
        OR is_admin() 
        OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'support_agent'))
      )
    );
  END IF;
END $$;

-- 2. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all audit logs' AND tablename = 'audit_logs') THEN
    CREATE POLICY "Admins can view all audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated insert audit logs' AND tablename = 'audit_logs') THEN
    CREATE POLICY "Allow authenticated insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- 3. Module 1.4: Telemetry Pruning Function
CREATE OR REPLACE FUNCTION public.prune_stale_trip_locations(
    p_days integer DEFAULT 7
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_deleted_count integer := 0;
    v_cutoff_time timestamptz;
BEGIN
    v_cutoff_time := now() - (coalesce(p_days, 7) || ' days')::interval;

    WITH deleted AS (
        DELETE FROM public.trip_locations tl
        WHERE tl.recorded_at < v_cutoff_time
          AND EXISTS (
              SELECT 1 FROM public.trips t
              WHERE t.id = tl.trip_id
                AND t.status IN ('completed', 'cancelled')
          )
        RETURNING tl.id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'cutoff_time', v_cutoff_time,
        'retention_days', coalesce(p_days, 7)
    );
END;
$$;

-- 4. Module 3.2: Driver Application Submission RPC
CREATE OR REPLACE FUNCTION public.submit_driver_application(
    p_license_number text,
    p_license_class text,
    p_national_id text,
    p_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_user_id uuid;
    v_driver public.driver_profiles%ROWTYPE;
BEGIN
    v_user_id := coalesce(auth.uid(), p_user_id);
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'USER_ID_REQUIRED';
    END IF;

    IF p_license_number IS NULL OR trim(p_license_number) = '' THEN
        RAISE EXCEPTION 'LICENSE_NUMBER_REQUIRED';
    END IF;

    IF p_national_id IS NULL OR trim(p_national_id) = '' THEN
        RAISE EXCEPTION 'NIN_REQUIRED';
    END IF;

    INSERT INTO public.driver_profiles (
        user_id,
        license_number,
        license_class,
        national_id,
        verification_status
    ) VALUES (
        v_user_id,
        trim(p_license_number),
        trim(p_license_class),
        trim(p_national_id),
        'pending'::public.verification_status_enum
    )
    ON CONFLICT (user_id) DO UPDATE SET
        license_number = coalesce(trim(p_license_number), driver_profiles.license_number),
        license_class = coalesce(trim(p_license_class), driver_profiles.license_class),
        national_id = coalesce(trim(p_national_id), driver_profiles.national_id),
        verification_status = 'pending'::public.verification_status_enum,
        updated_at = now()
    RETURNING * INTO v_driver;

    -- Audit log
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        v_user_id,
        'driver_application_submitted',
        'driver',
        v_driver.id,
        jsonb_build_object(
            'license_number', p_license_number,
            'national_id', p_national_id,
            'status', 'pending'
        )
    );

    RETURN row_to_json(v_driver)::jsonb;
END;
$$;

-- 5. Module 3.3: Admin Verification Workflow RPCs
CREATE OR REPLACE FUNCTION public.admin_verify_driver(
    p_driver_id uuid,
    p_status text,
    p_notes text DEFAULT NULL,
    p_admin_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_admin_id uuid;
    v_new_status public.verification_status_enum;
    v_driver public.driver_profiles%ROWTYPE;
    v_log_id uuid;
BEGIN
    v_admin_id := coalesce(auth.uid(), p_admin_id);
    IF v_admin_id IS NULL THEN
        SELECT id INTO v_admin_id FROM profiles LIMIT 1;
    END IF;

    IF p_status NOT IN ('verified', 'rejected', 'pending', 'suspended') THEN
        RAISE EXCEPTION 'INVALID_STATUS: %', p_status;
    END IF;

    v_new_status := p_status::public.verification_status_enum;

    UPDATE public.driver_profiles
    SET verification_status = v_new_status,
        updated_at = now()
    WHERE id = p_driver_id
    RETURNING * INTO v_driver;

    IF v_driver.id IS NULL THEN
        RAISE EXCEPTION 'DRIVER_NOT_FOUND: %', p_driver_id;
    END IF;

    -- Insert audit log
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        v_admin_id,
        'driver_status_' || p_status,
        'driver',
        p_driver_id,
        jsonb_build_object(
            'new_status', p_status,
            'notes', p_notes,
            'admin_id', v_admin_id
        )
    ) RETURNING id INTO v_log_id;

    -- Send notification to driver
    INSERT INTO public.notifications (user_id, channel, type, title, body, data)
    VALUES (
        v_driver.user_id,
        'in_app'::notification_channel_enum,
        'driver_verification_update',
        CASE 
            WHEN p_status = 'verified' THEN 'Driver Account Verified!'
            WHEN p_status = 'rejected' THEN 'Driver Verification Rejected'
            ELSE 'Driver Verification Status Updated'
        END,
        coalesce(p_notes, 'Your driver verification status is now ' || p_status || '.'),
        jsonb_build_object('status', p_status, 'driver_id', p_driver_id)
    );

    RETURN jsonb_build_object(
        'success', true,
        'driver_id', v_driver.id,
        'verification_status', v_driver.verification_status,
        'audit_log_id', v_log_id,
        'notes', p_notes,
        'updated_at', v_driver.updated_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verify_vehicle(
    p_vehicle_id uuid,
    p_status text,
    p_notes text DEFAULT NULL,
    p_admin_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_admin_id uuid;
    v_vehicle public.vehicles%ROWTYPE;
    v_log_id uuid;
    v_new_status public.vehicle_status_enum;
BEGIN
    v_admin_id := coalesce(auth.uid(), p_admin_id);
    IF v_admin_id IS NULL THEN
        SELECT id INTO v_admin_id FROM profiles LIMIT 1;
    END IF;

    IF p_status NOT IN ('active', 'maintenance', 'inactive', 'pending_verification', 'rejected') THEN
        RAISE EXCEPTION 'INVALID_VEHICLE_STATUS: %', p_status;
    END IF;

    v_new_status := p_status::public.vehicle_status_enum;

    UPDATE public.vehicles
    SET status = v_new_status,
        updated_at = now()
    WHERE id = p_vehicle_id
    RETURNING * INTO v_vehicle;

    IF v_vehicle.id IS NULL THEN
        RAISE EXCEPTION 'VEHICLE_NOT_FOUND: %', p_vehicle_id;
    END IF;

    -- Insert audit log
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        v_admin_id,
        'vehicle_status_' || p_status,
        'vehicle',
        p_vehicle_id,
        jsonb_build_object(
            'new_status', p_status,
            'notes', p_notes,
            'admin_id', v_admin_id
        )
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object(
        'success', true,
        'vehicle_id', v_vehicle.id,
        'status', v_vehicle.status,
        'audit_log_id', v_log_id,
        'notes', p_notes,
        'updated_at', v_vehicle.updated_at
    );
END;
$$;

-- 6. Module 9.3: Driver Suspension & Dispute Resolution RPCs
CREATE OR REPLACE FUNCTION public.admin_suspend_driver(
    p_driver_id uuid,
    p_reason text,
    p_admin_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_admin_id uuid;
    v_driver public.driver_profiles%ROWTYPE;
    v_cancelled_trips_count integer := 0;
    v_cancelled_bookings_count integer := 0;
    v_affected_trip record;
    v_booking record;
    v_log_id uuid;
BEGIN
    v_admin_id := coalesce(auth.uid(), p_admin_id);
    IF v_admin_id IS NULL THEN
        SELECT id INTO v_admin_id FROM profiles LIMIT 1;
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'SUSPENSION_REASON_REQUIRED';
    END IF;

    -- Freeze driver account
    UPDATE public.driver_profiles
    SET verification_status = 'suspended'::public.verification_status_enum,
        online_status = false,
        updated_at = now()
    WHERE id = p_driver_id
    RETURNING * INTO v_driver;

    IF v_driver.id IS NULL THEN
        RAISE EXCEPTION 'DRIVER_NOT_FOUND: %', p_driver_id;
    END IF;

    -- Find active/scheduled trips and cancel them
    FOR v_affected_trip IN
        SELECT id, route_id, departs_at
        FROM public.trips
        WHERE driver_id = p_driver_id
          AND status IN ('scheduled', 'boarding', 'in_progress')
    LOOP
        UPDATE public.trips
        SET status = 'cancelled',
            notes = coalesce(notes, '') || ' [Cancelled due to driver suspension: ' || trim(p_reason) || ']',
            updated_at = now()
        WHERE id = v_affected_trip.id;

        v_cancelled_trips_count := v_cancelled_trips_count + 1;

        -- Cancel all passenger bookings on this trip
        FOR v_booking IN
            SELECT b.id, b.passenger_id, b.booking_reference
            FROM public.bookings b
            WHERE b.trip_id = v_affected_trip.id
              AND b.status IN ('held', 'confirmed')
        LOOP
            UPDATE public.bookings
            SET status = 'cancelled',
                cancel_reason = 'Trip cancelled due to driver suspension: ' || trim(p_reason),
                cancelled_at = now()
            WHERE id = v_booking.id;

            v_cancelled_bookings_count := v_cancelled_bookings_count + 1;

            -- Notify stranded passenger
            INSERT INTO public.notifications (user_id, channel, type, title, body, data)
            VALUES (
                v_booking.passenger_id,
                'in_app'::notification_channel_enum,
                'booking_cancelled_driver_suspended',
                'Important: Trip #' || coalesce(v_booking.booking_reference, '') || ' Cancelled',
                'Your scheduled trip has been cancelled due to driver unavailability. Please search and book another ride.',
                jsonb_build_object(
                    'booking_id', v_booking.id,
                    'booking_reference', v_booking.booking_reference,
                    'trip_id', v_affected_trip.id,
                    'reason', p_reason
                )
            );
        END LOOP;
    END LOOP;

    -- Insert audit log
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        v_admin_id,
        'driver_suspended',
        'driver',
        p_driver_id,
        jsonb_build_object(
            'reason', trim(p_reason),
            'cancelled_trips_count', v_cancelled_trips_count,
            'cancelled_bookings_count', v_cancelled_bookings_count,
            'admin_id', v_admin_id
        )
    ) RETURNING id INTO v_log_id;

    -- Notify the driver
    INSERT INTO public.notifications (user_id, channel, type, title, body, data)
    VALUES (
        v_driver.user_id,
        'in_app'::notification_channel_enum,
        'driver_suspended',
        'Your Driver Account Has Been Suspended',
        'Your driver account has been suspended by operations. Reason: ' || trim(p_reason) || '. Contact support for dispute resolution.',
        jsonb_build_object('reason', p_reason, 'driver_id', p_driver_id)
    );

    RETURN jsonb_build_object(
        'success', true,
        'driver_id', p_driver_id,
        'status', 'suspended',
        'reason', trim(p_reason),
        'cancelled_trips_count', v_cancelled_trips_count,
        'cancelled_bookings_count', v_cancelled_bookings_count,
        'audit_log_id', v_log_id,
        'suspended_at', now()
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unsuspend_driver(
    p_driver_id uuid,
    p_notes text DEFAULT NULL,
    p_admin_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_admin_id uuid;
    v_driver public.driver_profiles%ROWTYPE;
    v_log_id uuid;
BEGIN
    v_admin_id := coalesce(auth.uid(), p_admin_id);
    IF v_admin_id IS NULL THEN
        SELECT id INTO v_admin_id FROM profiles LIMIT 1;
    END IF;

    UPDATE public.driver_profiles
    SET verification_status = 'verified'::public.verification_status_enum,
        updated_at = now()
    WHERE id = p_driver_id
    RETURNING * INTO v_driver;

    IF v_driver.id IS NULL THEN
        RAISE EXCEPTION 'DRIVER_NOT_FOUND: %', p_driver_id;
    END IF;

    -- Re-activate upcoming cancelled trips for this driver
    WITH restored AS (
        UPDATE public.trips
        SET status = 'scheduled',
            updated_at = now()
        WHERE driver_id = p_driver_id
          AND status = 'cancelled'
          AND departs_at > now()
        RETURNING id
    )
    SELECT count(*) INTO v_restored_trips_count FROM restored;

    -- Insert audit log
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        v_admin_id,
        'driver_unsuspended',
        'driver',
        p_driver_id,
        jsonb_build_object(
            'notes', p_notes,
            'restored_trips_count', v_restored_trips_count,
            'admin_id', v_admin_id
        )
    ) RETURNING id INTO v_log_id;

    -- Notify the driver
    INSERT INTO public.notifications (user_id, channel, type, title, body, data)
    VALUES (
        v_driver.user_id,
        'in_app'::notification_channel_enum,
        'driver_unsuspended',
        'Account Reactivated',
        'Your driver account suspension has been lifted. You can now publish trips.',
        jsonb_build_object('driver_id', p_driver_id, 'notes', p_notes)
    );

    RETURN jsonb_build_object(
        'success', true,
        'driver_id', p_driver_id,
        'status', 'verified',
        'restored_trips_count', v_restored_trips_count,
        'audit_log_id', v_log_id,
        'notes', p_notes,
        'unsuspended_at', now()
    );
END;
$$;
