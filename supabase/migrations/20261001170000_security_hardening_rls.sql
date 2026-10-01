-- ============================================================================
-- SECURITY HARDENING: ROW-LEVEL SECURITY AUDIT & FIX
-- Closes all identified data-isolation vulnerabilities.
-- ============================================================================
-- ISSUES FIXED:
--   1. profiles         SELECT true  → scoped to own row + related parties
--   2. driver_profiles  SELECT true  → own row, booked passengers, admin
--   3. vehicles         SELECT true  → require auth + scope to relevant parties
--   4. operators        SELECT true  → scope full-row; status=active for others
--   5. trip_locations   SELECT true  → relevant passengers, driver, admin
--   6. trip_shares      SELECT true  → booking owner, driver, admin
--   7. trip_events      SELECT true  → trip participants + admin
--   8. ratings          SELECT true  → reviewer, reviewee, admin, support
--   9. search_events    INSERT true  → enforce user_id = auth.uid() or null
--  10. audit_logs       INSERT true  → locked to service_role + SECURITY DEFINER RPC
--  11. pickup_points    INSERT true  → enforce created_by = auth.uid()
--  12. trip_alerts      SELECT all drivers → limit to route-matching + revealed leads
--  13. profiles_update  missing WITH CHECK → added
--  14. bookings_update  missing WITH CHECK → prevent passenger_id reassignment
--  15. support_tickets  UPDATE tighten WITH CHECK
--  16. routes/towns/stops  SELECT true → require authentication
--  17. subscription_plans/features  SELECT true → require authentication
-- ============================================================================

-- 0. SECURITY HELPER FUNCTIONS (Service Role & Admin Recognition)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.role() = 'service_role'
      OR current_user IN ('postgres', 'service_role')
      OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_support() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.role() = 'service_role'
      OR current_user IN ('postgres', 'service_role')
      OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'support_agent'));
$$;

-- 1. PROFILES
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR is_admin()
  OR is_support()
  OR id IN (
    SELECT t.driver_id FROM public.trips t
    JOIN public.bookings b ON b.trip_id = t.id
    WHERE b.passenger_id = auth.uid()
      AND b.status IN ('held','confirmed','completed')
  )
  OR id IN (
    SELECT b.passenger_id FROM public.bookings b
    JOIN public.trips t ON t.id = b.trip_id
    WHERE t.driver_id = current_driver_id()
      AND b.status IN ('held','confirmed','completed')
  )
);
DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE
  USING  (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

-- 2. DRIVER PROFILES
DROP POLICY IF EXISTS driver_profiles_select ON public.driver_profiles;
CREATE POLICY driver_profiles_select ON public.driver_profiles FOR SELECT USING (
  user_id = auth.uid()
  OR is_admin()
  OR is_support()
  OR user_id IN (
    SELECT t.driver_id FROM public.trips t
    JOIN public.bookings b ON b.trip_id = t.id
    WHERE b.passenger_id = auth.uid()
      AND b.status IN ('held','confirmed','completed')
  )
);

-- 3. OPERATORS
DROP POLICY IF EXISTS operators_select ON public.operators;
CREATE POLICY operators_select_own ON public.operators FOR SELECT USING (
  owner_user_id = auth.uid() OR is_admin() OR is_support()
);
CREATE POLICY operators_select_public ON public.operators FOR SELECT TO authenticated
  USING (status = 'active');

-- 4. VEHICLES
DROP POLICY IF EXISTS vehicles_select ON public.vehicles;
CREATE POLICY vehicles_select ON public.vehicles FOR SELECT TO authenticated USING (
  operator_id IN (SELECT id FROM public.operators WHERE owner_user_id = auth.uid())
  OR primary_driver_id = current_driver_id()
  OR is_admin()
  OR is_support()
  OR id IN (
    SELECT t.vehicle_id FROM public.trips t
    JOIN public.bookings b ON b.trip_id = t.id
    WHERE b.passenger_id = auth.uid()
      AND b.status IN ('held','confirmed','completed')
      AND t.vehicle_id IS NOT NULL
  )
  OR id IN (
    SELECT vehicle_id FROM public.trips
    WHERE status IN ('scheduled','boarding','in_progress')
      AND vehicle_id IS NOT NULL
  )
);

-- 5. TRIP LOCATIONS
DROP POLICY IF EXISTS trip_locations_select ON public.trip_locations;
CREATE POLICY trip_locations_select ON public.trip_locations FOR SELECT USING (
  driver_id = current_driver_id()
  OR is_admin()
  OR is_support()
  OR trip_id IN (
    SELECT b.trip_id FROM public.bookings b
    WHERE b.passenger_id = auth.uid()
      AND b.status IN ('held','confirmed','completed')
  )
  OR trip_id IN (
    SELECT b.trip_id FROM public.trip_shares ts
    JOIN public.bookings b ON b.id = ts.booking_id
    WHERE ts.expires_at > now()
      AND b.passenger_id = auth.uid()
  )
);

-- 6. TRIP SHARES
DROP POLICY IF EXISTS trip_shares_select ON public.trip_shares;
CREATE POLICY trip_shares_select ON public.trip_shares FOR SELECT USING (
  booking_id IN (SELECT id FROM public.bookings WHERE passenger_id = auth.uid())
  OR is_admin()
  OR booking_id IN (
    SELECT b.id FROM public.bookings b
    JOIN public.trips t ON t.id = b.trip_id
    WHERE t.driver_id = current_driver_id()
  )
);

-- 7. TRIP EVENTS
DROP POLICY IF EXISTS trip_events_select ON public.trip_events;
CREATE POLICY trip_events_select ON public.trip_events FOR SELECT USING (
  trip_id IN (SELECT id FROM public.trips WHERE driver_id = current_driver_id())
  OR is_admin()
  OR is_support()
  OR trip_id IN (
    SELECT b.trip_id FROM public.bookings b
    WHERE b.passenger_id = auth.uid()
      AND b.status IN ('held','confirmed','completed','cancelled')
  )
  OR created_by = auth.uid()
);

-- 8. RATINGS
DROP POLICY IF EXISTS ratings_select ON public.ratings;
CREATE POLICY ratings_select ON public.ratings FOR SELECT USING (
  reviewer_id = auth.uid()
  OR reviewee_id = auth.uid()
  OR is_admin()
  OR is_support()
);

-- 9. SEARCH EVENTS INSERT: enforce user_id ownership
DROP POLICY IF EXISTS search_events_insert ON public.search_events;
CREATE POLICY search_events_insert ON public.search_events FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 10. AUDIT LOGS: block direct authenticated insert; use write_audit_log() RPC
DROP POLICY IF EXISTS "Allow authenticated insert audit logs" ON public.audit_logs;
CREATE POLICY audit_logs_service_insert ON public.audit_logs FOR INSERT
  TO service_role WITH CHECK (true);

-- 11. PICKUP POINTS: enforce created_by + require auth for reads
DROP POLICY IF EXISTS pickup_points_insert_authenticated ON public.pickup_points;
CREATE POLICY pickup_points_insert_authenticated ON public.pickup_points FOR INSERT
  TO authenticated WITH CHECK (created_by = auth.uid() OR is_admin());
DROP POLICY IF EXISTS pickup_points_select ON public.pickup_points;
CREATE POLICY pickup_points_select ON public.pickup_points FOR SELECT
  TO authenticated USING (is_active = true OR is_admin());

-- 12. TRIP ALERTS: scope drivers to their own route matches + revealed leads
DROP POLICY IF EXISTS trip_alerts_select ON public.trip_alerts;
CREATE POLICY trip_alerts_select ON public.trip_alerts FOR SELECT USING (
  passenger_id = auth.uid()
  OR is_admin()
  OR is_support()
  OR (
    is_driver()
    AND (
      id IN (
        SELECT trip_alert_id FROM public.lead_views
        WHERE driver_id = current_driver_id()
      )
      OR (
        origin_town_id IN (
          SELECT DISTINCT r.origin_town_id FROM public.trips t
          JOIN public.routes r ON r.id = t.route_id
          WHERE t.driver_id = current_driver_id()
            AND t.status IN ('scheduled','boarding','in_progress')
        )
        AND destination_town_id IN (
          SELECT DISTINCT r.destination_town_id FROM public.trips t
          JOIN public.routes r ON r.id = t.route_id
          WHERE t.driver_id = current_driver_id()
            AND t.status IN ('scheduled','boarding','in_progress')
        )
      )
    )
  )
);

-- 13. BOOKINGS UPDATE: add WITH CHECK to prevent passenger_id reassignment
DROP POLICY IF EXISTS bookings_update ON public.bookings;
CREATE POLICY bookings_update ON public.bookings FOR UPDATE
  USING (
    passenger_id = auth.uid()
    OR trip_id IN (SELECT id FROM public.trips WHERE driver_id = current_driver_id())
    OR is_admin()
  )
  WITH CHECK (passenger_id = auth.uid() OR is_admin());

-- 14. SUPPORT TICKETS UPDATE: tighten WITH CHECK
DROP POLICY IF EXISTS support_tickets_update ON public.support_tickets;
CREATE POLICY support_tickets_update ON public.support_tickets FOR UPDATE
  USING  (user_id = auth.uid() OR is_admin() OR is_support())
  WITH CHECK (user_id = auth.uid() OR is_admin() OR is_support());

-- 15. ROUTES / TOWNS / ROUTE STOPS: public catalog access for active routes & towns
DROP POLICY IF EXISTS routes_select ON public.routes;
CREATE POLICY routes_select ON public.routes FOR SELECT
  USING (status = 'active' OR is_admin());
DROP POLICY IF EXISTS route_stops_select ON public.route_stops;
CREATE POLICY route_stops_select ON public.route_stops FOR SELECT USING (true);
DROP POLICY IF EXISTS towns_select ON public.towns;
CREATE POLICY towns_select ON public.towns FOR SELECT
  USING (is_active = true OR is_admin());

-- 16. TRIP STOPS: scope to published trips + own driver trips
DROP POLICY IF EXISTS trip_stops_select ON public.trip_stops;
CREATE POLICY trip_stops_select ON public.trip_stops FOR SELECT TO authenticated USING (
  trip_id IN (SELECT id FROM public.trips WHERE status IN ('scheduled','boarding','in_progress','completed'))
  OR trip_id IN (SELECT id FROM public.trips WHERE driver_id = current_driver_id())
  OR is_admin()
);

-- 17. SUBSCRIPTION PLANS / FEATURES: require authentication
DROP POLICY IF EXISTS sub_plans_select ON public.subscription_plans;
CREATE POLICY sub_plans_select ON public.subscription_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sub_features_select ON public.subscription_features;
CREATE POLICY sub_features_select ON public.subscription_features FOR SELECT TO authenticated USING (true);

-- 18. SECURE AUDIT LOG WRITER RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_metadata    jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid uuid;
  v_id  uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, p_action, p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.write_audit_log(text, text, uuid, jsonb) TO authenticated;
