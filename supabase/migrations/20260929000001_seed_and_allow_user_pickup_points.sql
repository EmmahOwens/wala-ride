-- ============================================================================
-- MIGRATION: SEED CORE GEOGRAPHY, SUBSCRIPTION PLANS & ENABLE USER PICKUP POINTS
-- ============================================================================

-- 1. Add created_by to pickup_points with default auth.uid() to support user-added stages
alter table pickup_points add column if not exists created_by uuid references profiles(id);
alter table pickup_points alter column created_by set default auth.uid();

-- 2. Add unique constraints so duplicates aren't created
alter table towns drop constraint if exists uq_towns_name;
alter table towns add constraint uq_towns_name unique (name);

alter table pickup_points drop constraint if exists uq_pickup_points_town_name;
alter table pickup_points add constraint uq_pickup_points_town_name unique (town_id, name);

-- 3. RLS Policies: Allow any authenticated user (passenger, driver, operator) to add pickup points
drop policy if exists pickup_points_insert_authenticated on pickup_points;
create policy pickup_points_insert_authenticated on pickup_points 
  for insert 
  to authenticated 
  with check (true);

drop policy if exists pickup_points_update_creator on pickup_points;
create policy pickup_points_update_creator on pickup_points
  for update
  to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

-- ============================================================================
-- SEED DATA: TOWNS
-- ============================================================================
insert into towns (name, region, lat, lng, is_active) values
  ('Kampala', 'Central', 0.347596, 32.582520, true),
  ('Mbarara', 'Western', -0.607160, 30.654502, true),
  ('Jinja', 'Eastern', 0.447857, 33.202612, true),
  ('Mbale', 'Eastern', 1.078440, 34.175510, true),
  ('Gulu', 'Northern', 2.772404, 32.299015, true),
  ('Soroti', 'Eastern', 1.714638, 33.611130, true),
  ('Masaka', 'Central', -0.341120, 31.736040, true)
on conflict (name) do update set 
  region = excluded.region,
  lat = excluded.lat,
  lng = excluded.lng,
  is_active = excluded.is_active;

-- ============================================================================
-- SEED DATA: PICKUP POINTS / STAGES (System-curated)
-- ============================================================================
with t as (select id, name from towns)
insert into pickup_points (town_id, name, kind, lat, lng, description, is_active, created_by)
values
  -- Kampala
  ((select id from t where name = 'Kampala'), 'Qualicel Bus Terminal', 'terminal', 0.3129, 32.5732, 'Downtown hub for Western and South-Western buses', true, null),
  ((select id from t where name = 'Kampala'), 'Kisenyi Bus Terminal', 'terminal', 0.3094, 32.5711, 'Terminal for Rwanda, Western Uganda, and DRC coaches', true, null),
  ((select id from t where name = 'Kampala'), 'Namayiba Bus Terminal', 'terminal', 0.3235, 32.5702, 'Old Kampala terminal for Northern and West Nile routes', true, null),
  ((select id from t where name = 'Kampala'), 'Busega Roundabout Stage', 'stage', 0.3032, 32.5186, 'Expressway and Masaka Road interchange boarding point', true, null),
  ((select id from t where name = 'Kampala'), 'Banda / Kireka Shell Stage', 'stage', 0.3491, 32.6341, 'Jinja Road highway exit point for Eastern routes', true, null),
  ((select id from t where name = 'Kampala'), 'Bwaise Northern Bypass Stage', 'stage', 0.3541, 32.5583, 'Bombo Road junction for Gulu and Northern corridor departures', true, null),

  -- Mbarara
  ((select id from t where name = 'Mbarara'), 'Mbarara Bus & Taxi Park', 'terminal', -0.6052, 30.6581, 'Central transportation park in downtown Mbarara', true, null),
  ((select id from t where name = 'Mbarara'), 'Independence Park / High St Stage', 'stage', -0.6091, 30.6534, 'Town center boarding stage along High Street', true, null),
  ((select id from t where name = 'Mbarara'), 'Mile 2 Shell Stage (Masaka Rd)', 'landmark', -0.5982, 30.6698, 'Highway pick-up spot heading toward Masaka/Kampala', true, null),

  -- Jinja
  ((select id from t where name = 'Jinja'), 'Jinja Main Taxi & Bus Park', 'terminal', 0.4281, 33.2064, 'Central Jinja terminal', true, null),
  ((select id from t where name = 'Jinja'), 'Amber Court Roundabout', 'landmark', 0.4412, 33.1956, 'Major junction for departures toward Kampala and Kamuli', true, null),
  ((select id from t where name = 'Jinja'), 'New Nile Bridge Stage', 'stage', 0.4350, 33.1870, 'Boarding point near the Source of the Nile bridge', true, null),

  -- Mbale
  ((select id from t where name = 'Mbale'), 'Mbale Main Taxi Park', 'terminal', 1.0792, 34.1771, 'Central park for taxis and coasters to Tororo, Kampala, and Soroti', true, null),
  ((select id from t where name = 'Mbale'), 'Republic Street Clock Tower', 'landmark', 1.0760, 34.1745, 'Downtown landmark stage in Mbale city center', true, null),
  ((select id from t where name = 'Mbale'), 'Naboa Road Stage', 'stage', 1.0821, 34.1802, 'Convenient boarding point on Naboa Road', true, null),

  -- Gulu
  ((select id from t where name = 'Gulu'), 'Gulu Main Bus Park', 'terminal', 2.7751, 32.2982, 'Primary bus terminal for coaches to Kampala and South Sudan', true, null),
  ((select id from t where name = 'Gulu'), 'Layibi Stage (Kampala Rd)', 'stage', 2.7534, 32.3012, 'Southern exit point heading toward Karuma and Kampala', true, null),
  ((select id from t where name = 'Gulu'), 'Cereleno Market Stage', 'stage', 2.7680, 32.3045, 'Busy pickup stage by Cereleno market', true, null),

  -- Soroti
  ((select id from t where name = 'Soroti'), 'Soroti Main Bus Park', 'terminal', 1.7132, 33.6105, 'Main hub for buses to Mbale, Lira, and Kampala', true, null),
  ((select id from t where name = 'Soroti'), 'Moroto Road Stage', 'stage', 1.7190, 33.6180, 'Departure stage towards Karamoja region', true, null),
  ((select id from t where name = 'Soroti'), 'Lira Road Junction', 'landmark', 1.7165, 33.6042, 'Pickup junction heading towards Northern Uganda', true, null),

  -- Masaka
  ((select id from t where name = 'Masaka'), 'Masaka Main Taxi Park', 'terminal', -0.3395, 31.7371, 'Central terminal in Masaka city', true, null),
  ((select id from t where name = 'Masaka'), 'Nyendo Stage', 'stage', -0.3280, 31.7520, 'Vibrant transportation hub on Kampala-Masaka highway', true, null),
  ((select id from t where name = 'Masaka'), 'Total Highway Junction', 'landmark', -0.3440, 31.7330, 'Western highway branch point to Mbarara & Mutukula border', true, null)
on conflict (town_id, name) do update set
  kind = excluded.kind,
  lat = excluded.lat,
  lng = excluded.lng,
  description = excluded.description,
  is_active = excluded.is_active;

-- ============================================================================
-- SEED DATA: SUBSCRIPTION PLANS & FEATURES
-- ============================================================================
insert into subscription_plans (id, name, price_ugx, period_days, max_trips_per_period, max_leads_per_period, is_active)
values
  ('11111111-1111-1111-1111-111111111111', 'Trial (7 Days)', 0, 7, 3, 5, true),
  ('22222222-2222-2222-2222-222222222222', 'Standard Driver', 15000, 7, 12, 20, true),
  ('33333333-3333-3333-3333-333333333333', 'Pro Fleet', 50000, 30, 999, 100, true)
on conflict (id) do update set
  name = excluded.name,
  price_ugx = excluded.price_ugx,
  period_days = excluded.period_days,
  max_trips_per_period = excluded.max_trips_per_period,
  max_leads_per_period = excluded.max_leads_per_period,
  is_active = excluded.is_active;

insert into subscription_features (plan_id, feature_key, feature_value)
values
  ('11111111-1111-1111-1111-111111111111', 'trial_duration', '7 days'),
  ('11111111-1111-1111-1111-111111111111', 'radar_access', 'basic'),
  ('22222222-2222-2222-2222-222222222222', 'verified_badge', 'true'),
  ('22222222-2222-2222-2222-222222222222', 'radar_access', 'standard'),
  ('22222222-2222-2222-2222-222222222222', 'support_level', 'standard'),
  ('33333333-3333-3333-3333-333333333333', 'verified_badge', 'true'),
  ('33333333-3333-3333-3333-333333333333', 'priority_listing', 'true'),
  ('33333333-3333-3333-3333-333333333333', 'fleet_management', 'true'),
  ('33333333-3333-3333-3333-333333333333', 'radar_access', 'unlimited_alerts'),
  ('33333333-3333-3333-3333-333333333333', 'support_level', 'priority_24_7')
on conflict (plan_id, feature_key) do update set
  feature_value = excluded.feature_value;
