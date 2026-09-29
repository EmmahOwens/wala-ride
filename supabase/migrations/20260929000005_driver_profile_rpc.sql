-- ============================================================================
-- MIGRATION: REGISTER DRIVER PROFILE RPC (SECURITY DEFINER)
-- ============================================================================

create or replace function register_driver_profile(
  p_user_id uuid,
  p_license_number text default null,
  p_license_class text default null,
  p_national_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver record;
  v_user_id uuid;
begin
  v_user_id := coalesce(auth.uid(), p_user_id);
  if v_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  insert into driver_profiles (
    user_id,
    license_number,
    license_class,
    national_id,
    verification_status
  ) values (
    v_user_id,
    p_license_number,
    p_license_class,
    p_national_id,
    'verified'
  )
  on conflict (user_id) do update set
    license_number = coalesce(excluded.license_number, driver_profiles.license_number),
    license_class = coalesce(excluded.license_class, driver_profiles.license_class),
    national_id = coalesce(excluded.national_id, driver_profiles.national_id),
    verification_status = 'verified',
    updated_at = now()
  returning * into v_driver;

  return row_to_json(v_driver)::jsonb;
end;
$$;
