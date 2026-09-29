-- ============================================================================
-- MIGRATION: PAYMENT STATUS HELPER RPC (SECURITY DEFINER)
-- ============================================================================

create or replace function get_payment_by_id(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
begin
  select * into v_p from payments where id = p_payment_id;
  if v_p.id is null then
    return null;
  end if;
  return row_to_json(v_p)::jsonb;
end;
$$;
