-- ============================================================================
-- MIGRATION: PHASE 4 — MOBILE MONEY WEBHOOK VERIFICATION & AUDIT TRAIL
-- ============================================================================
-- Adds:
--   1. webhook_verification_log    — immutable audit trail of every webhook event
--   2. signature_verified col      — whether the HMAC / token check passed
--   3. provider_verified_at col    — when the back-channel provider check ran
--   4. provider_verified_status    — what the provider actually said
--   5. record_webhook_attempt()    — internal helper used by the Edge Function
-- ============================================================================

-- 1. New columns on payments (idempotent)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'signature_verified'
  ) then
    alter table public.payments
      add column signature_verified boolean,
      add column provider_verified_at timestamptz,
      add column provider_verified_status text;
  end if;
end; $$;

-- 2. Webhook audit log
create table if not exists public.webhook_verification_log (
  id                    uuid primary key default gen_random_uuid(),
  payment_id            uuid references public.payments(id) on delete set null,
  provider              text not null,
  event_type            text,
  raw_payload           jsonb not null default '{}',
  signature_header      text,
  signature_valid       boolean,
  back_channel_status   text,
  back_channel_response jsonb,
  resolved_payment_status text,
  idempotency_key       text,
  processed_at          timestamptz not null default now(),
  ip_address            text
);

create index if not exists idx_wvl_payment_id
  on public.webhook_verification_log(payment_id);
create index if not exists idx_wvl_idempotency
  on public.webhook_verification_log(idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_wvl_processed_at
  on public.webhook_verification_log(processed_at desc);

alter table public.webhook_verification_log enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'webhook_verification_log'
      and policyname = 'service_role_full_access'
  ) then
    create policy service_role_full_access on public.webhook_verification_log
      for all to service_role using (true) with check (true);
  end if;
end; $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'webhook_verification_log'
      and policyname = 'admin_read_log'
  ) then
    create policy admin_read_log on public.webhook_verification_log
      for select to authenticated
      using (
        exists (
          select 1 from public.user_roles
          where user_id = auth.uid() and role = 'admin'
        )
      );
  end if;
end; $$;

-- 3. Helper: record_webhook_attempt()
create or replace function public.record_webhook_attempt(
  p_payment_id            uuid,
  p_provider              text,
  p_event_type            text,
  p_raw_payload           jsonb,
  p_signature_header      text,
  p_signature_valid       boolean,
  p_back_channel_status   text,
  p_back_channel_response jsonb,
  p_resolved_status       text,
  p_idempotency_key       text    default null,
  p_ip_address            text    default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
begin
  insert into public.webhook_verification_log (
    payment_id, provider, event_type, raw_payload,
    signature_header, signature_valid, back_channel_status,
    back_channel_response, resolved_payment_status,
    idempotency_key, ip_address
  ) values (
    p_payment_id, p_provider, p_event_type, p_raw_payload,
    p_signature_header, p_signature_valid, p_back_channel_status,
    p_back_channel_response, p_resolved_status,
    p_idempotency_key, p_ip_address
  ) returning id into v_log_id;
  return v_log_id;
end;
$$;

-- 4. process_payment_webhook: augmented with verification metadata columns
create or replace function public.process_payment_webhook(
  p_payment_id              uuid,
  p_status                  text,
  p_provider_ref            text        default null,
  p_raw_callback            jsonb       default '{}'::jsonb,
  p_signature_verified      boolean     default null,
  p_provider_verified_at    timestamptz default null,
  p_provider_verified_status text       default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_leads_count int := 10;
begin
  perform pg_advisory_xact_lock(hashtext('payment:' || p_payment_id::text));

  select * into v_payment from payments where id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_payment.status = 'successful' and v_payment.applied then
    return jsonb_build_object(
      'success',         true,
      'already_applied', true,
      'payment_id',      v_payment.id,
      'status',          'successful'
    );
  end if;

  if lower(p_status) in ('successful', 'completed', 'success') then
    update payments
       set status                   = 'successful',
           completed_at             = now(),
           provider_ref             = coalesce(p_provider_ref, provider_ref),
           raw_callback             = coalesce(p_raw_callback, raw_callback),
           signature_verified       = coalesce(p_signature_verified, signature_verified),
           provider_verified_at     = coalesce(p_provider_verified_at, provider_verified_at),
           provider_verified_status = coalesce(p_provider_verified_status, provider_verified_status)
     where id = p_payment_id;

    if v_payment.purpose = 'subscription' then
      perform activate_subscription(p_payment_id);
    elsif v_payment.purpose = 'lead_topup' then
      v_leads_count := coalesce((v_payment.raw_callback->>'leads_count')::int, 10);
      perform credit_lead_topup(p_payment_id, v_leads_count);
    end if;

    return jsonb_build_object(
      'success',    true,
      'payment_id', p_payment_id,
      'status',     'successful',
      'purpose',    v_payment.purpose,
      'applied',    true
    );
  else
    update payments
       set status                   = 'failed',
           completed_at             = now(),
           raw_callback             = coalesce(p_raw_callback, raw_callback),
           signature_verified       = coalesce(p_signature_verified, signature_verified),
           provider_verified_at     = coalesce(p_provider_verified_at, provider_verified_at),
           provider_verified_status = coalesce(p_provider_verified_status, provider_verified_status)
     where id = p_payment_id;

    return jsonb_build_object(
      'success',    false,
      'payment_id', p_payment_id,
      'status',     'failed'
    );
  end if;
end;
$$;

-- 5. Admin view: webhook verification summary per payment
create or replace view public.v_payment_webhook_audit as
select
  p.id                              as payment_id,
  p.driver_id,
  p.purpose::text,
  p.amount_ugx,
  p.status::text                    as payment_status,
  p.provider,
  p.provider_ref,
  p.signature_verified,
  p.provider_verified_at,
  p.provider_verified_status,
  p.initiated_at,
  p.completed_at,
  count(wvl.id)                     as webhook_attempts,
  count(*) filter (
    where wvl.signature_valid = true
  )                                 as verified_attempts,
  count(*) filter (
    where wvl.back_channel_status = 'successful'
  )                                 as back_channel_successes,
  max(wvl.processed_at)             as last_webhook_at
from public.payments p
left join public.webhook_verification_log wvl on wvl.payment_id = p.id
group by p.id;

grant select on public.v_payment_webhook_audit to authenticated;
