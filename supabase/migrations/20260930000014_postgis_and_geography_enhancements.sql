-- Migration: 20260930000014_postgis_and_geography_enhancements.sql
-- Enables PostGIS and introduces spatial geography types, spatial indexes, and helper RPCs.

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- 1. Helper function to generate geography Point from lat/lng
CREATE OR REPLACE FUNCTION public.make_geog_point(p_lat numeric, p_lng numeric)
RETURNS extensions.geography
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng::double precision, p_lat::double precision), 4326)::extensions.geography;
END;
$$;

-- 2. Trigger function to synchronize lat/lng to geog
CREATE OR REPLACE FUNCTION public.sync_geog_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.geog = public.make_geog_point(NEW.lat, NEW.lng);
  RETURN NEW;
END;
$$;

-- 3. Enhance towns with spatial column & index
ALTER TABLE public.towns ADD COLUMN IF NOT EXISTS geog extensions.geography(Point, 4326);
UPDATE public.towns SET geog = public.make_geog_point(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL AND geog IS NULL;
DROP TRIGGER IF EXISTS trg_sync_towns_geog ON public.towns;
CREATE TRIGGER trg_sync_towns_geog BEFORE INSERT OR UPDATE OF lat, lng ON public.towns FOR EACH ROW EXECUTE FUNCTION public.sync_geog_column();
CREATE INDEX IF NOT EXISTS idx_towns_geog ON public.towns USING GIST (geog);

-- 4. Enhance pickup_points with spatial column & index
ALTER TABLE public.pickup_points ADD COLUMN IF NOT EXISTS geog extensions.geography(Point, 4326);
UPDATE public.pickup_points SET geog = public.make_geog_point(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL AND geog IS NULL;
DROP TRIGGER IF EXISTS trg_sync_pickup_points_geog ON public.pickup_points;
CREATE TRIGGER trg_sync_pickup_points_geog BEFORE INSERT OR UPDATE OF lat, lng ON public.pickup_points FOR EACH ROW EXECUTE FUNCTION public.sync_geog_column();
CREATE INDEX IF NOT EXISTS idx_pickup_points_geog ON public.pickup_points USING GIST (geog);

-- 5. Enhance trip_locations with spatial column & index
ALTER TABLE public.trip_locations ADD COLUMN IF NOT EXISTS geog extensions.geography(Point, 4326);
UPDATE public.trip_locations SET geog = public.make_geog_point(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL AND geog IS NULL;
DROP TRIGGER IF EXISTS trg_sync_trip_locations_geog ON public.trip_locations;
CREATE TRIGGER trg_sync_trip_locations_geog BEFORE INSERT OR UPDATE OF lat, lng ON public.trip_locations FOR EACH ROW EXECUTE FUNCTION public.sync_geog_column();
CREATE INDEX IF NOT EXISTS idx_trip_locations_geog ON public.trip_locations USING GIST (geog);

-- 6. Enhance incidents with spatial column & index
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS geog extensions.geography(Point, 4326);
UPDATE public.incidents SET geog = public.make_geog_point(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL AND geog IS NULL;
DROP TRIGGER IF EXISTS trg_sync_incidents_geog ON public.incidents;
CREATE TRIGGER trg_sync_incidents_geog BEFORE INSERT OR UPDATE OF lat, lng ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.sync_geog_column();
CREATE INDEX IF NOT EXISTS idx_incidents_geog ON public.incidents USING GIST (geog);

-- 7. Enhance routes with Google Maps overview polyline and bounding box
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS overview_polyline text;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS bounding_box jsonb;

-- 8. Spatial RPC: find_nearest_pickup_points
CREATE OR REPLACE FUNCTION public.find_nearest_pickup_points(
  p_lat numeric,
  p_lng numeric,
  p_radius_meters integer DEFAULT 50000,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  town_id uuid,
  name text,
  kind pickup_point_kind_enum,
  lat numeric,
  lng numeric,
  description text,
  town_name text,
  distance_meters double precision,
  distance_km numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    pp.id,
    pp.town_id,
    pp.name,
    pp.kind,
    pp.lat,
    pp.lng,
    pp.description,
    t.name AS town_name,
    extensions.ST_Distance(pp.geog, public.make_geog_point(p_lat, p_lng)) AS distance_meters,
    ROUND((extensions.ST_Distance(pp.geog, public.make_geog_point(p_lat, p_lng)) / 1000.0)::numeric, 1) AS distance_km
  FROM public.pickup_points pp
  JOIN public.towns t ON t.id = pp.town_id
  WHERE pp.is_active = true
    AND pp.geog IS NOT NULL
    AND extensions.ST_DWithin(pp.geog, public.make_geog_point(p_lat, p_lng), p_radius_meters)
  ORDER BY pp.geog <-> public.make_geog_point(p_lat, p_lng)
  LIMIT p_limit;
$$;

-- 9. Spatial RPC: find_nearest_town
CREATE OR REPLACE FUNCTION public.find_nearest_town(
  p_lat numeric,
  p_lng numeric
)
RETURNS TABLE (
  id uuid,
  name text,
  district text,
  region text,
  lat numeric,
  lng numeric,
  distance_km numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    t.id,
    t.name,
    t.district,
    t.region,
    t.lat,
    t.lng,
    ROUND((extensions.ST_Distance(t.geog, public.make_geog_point(p_lat, p_lng)) / 1000.0)::numeric, 1) AS distance_km
  FROM public.towns t
  WHERE t.is_active = true AND t.geog IS NOT NULL
  ORDER BY t.geog <-> public.make_geog_point(p_lat, p_lng)
  LIMIT 1;
$$;

-- 10. Spatial RPC: calculate_straight_line_distance_km
CREATE OR REPLACE FUNCTION public.calculate_straight_line_distance_km(
  p_lat1 numeric,
  p_lng1 numeric,
  p_lat2 numeric,
  p_lng2 numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND((extensions.ST_Distance(
    public.make_geog_point(p_lat1, p_lng1),
    public.make_geog_point(p_lat2, p_lng2)
  ) / 1000.0)::numeric, 1);
$$;
