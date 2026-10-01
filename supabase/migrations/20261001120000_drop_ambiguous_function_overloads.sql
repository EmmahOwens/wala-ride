-- Drop obsolete overloaded functions to resolve PostgREST ambiguity (Postgres 42725 error)

-- 1. Drop old 9-argument admin_manage_route (superseded by 11-argument version with overview_polyline and bounding_box)
drop function if exists public.admin_manage_route(text, uuid, text, uuid, uuid, numeric, integer, text, jsonb);

-- 2. Drop old 4-argument process_payment_webhook (superseded by 7-argument version with webhook verification audit fields)
drop function if exists public.process_payment_webhook(uuid, text, text, jsonb);
