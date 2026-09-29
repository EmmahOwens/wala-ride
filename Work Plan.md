# Work Plan — Intercity Ride Platform

Sequenced so each phase produces something testable end-to-end, before
layering on the next. See `PRD.md` for feature detail and `schema.sql` for
table definitions.

## Phase 0 — Foundations
**Goal:** auth works, roles exist, an admin can verify a driver.
- Tables: `profiles`, `user_roles`, `operators`, `driver_profiles`,
  `driver_documents`, `vehicles`, `vehicle_documents`
- Set up Supabase Auth (phone OTP), private storage bucket for documents
- RLS on `profiles` and `driver_documents` from day one — don't defer this
- Admin screen: list pending drivers/documents, approve/reject
- **Exit criteria:** a driver can sign up, upload documents, and get
  verified by an admin; RLS confirmed to block cross-user document access

## Phase 1 — Core Trip Loop (cash only)
**Goal:** a driver can publish a trip; a passenger can search, book a
segment, and get a confirmed booking — no money moves through the app yet.
- Tables: `towns`, `pickup_points`, `routes`, `route_stops`, `trips`,
  `trip_stops`, `bookings`, `booking_segments`, `booking_passengers`
- Functions: `book_segment()`, `confirm_booking()`, `cancel_booking()`,
  `expire_stale_holds()` (wire to `pg_cron`, every minute)
- Passenger flow: search → trip detail → book seat or whole vehicle → hold
  → confirm (manual "I've paid the driver" confirmation for now)
- Driver flow: create route/trip → set stops and price → view bookings
- **Exit criteria:** two passengers can book overlapping-but-non-conflicting
  segments on the same trip (e.g. Kampala→Jinja and Jinja→Mbale) without
  double-booking a seat; a same-segment double-booking attempt correctly
  fails with `SEATS_UNAVAILABLE`

## Phase 2 — Driver Subscriptions & Radar
**Goal:** a driver must have an active subscription to publish a trip;
passengers can alert on unmatched searches; drivers can reveal leads.
- Tables: `subscription_plans`, `subscription_features`,
  `driver_subscriptions`, `subscription_usage`, `search_events`,
  `trip_alerts`, `lead_views`
- Functions: `enforce_trip_quota()` trigger, `reveal_lead()`
- Seed 2–3 plans (e.g. free trial, standard, pro) manually via admin for
  the pilot — no self-serve plan management needed yet
- **Exit criteria:** a driver with no active subscription cannot publish a
  trip; a driver at their trip cap gets a clear error; revealing the same
  lead twice only charges once

## Phase 3 — Mobile Money for Subscriptions
**Goal:** drivers pay for their subscription without admin intervention.
- Tables: `payments`
- Functions: `activate_subscription()`
- Integrate one aggregator (Flutterwave/Pesapal) for MTN + Airtel collection
- Edge Function webhook → verify status with the provider (never trust the
  callback payload alone) → call `activate_subscription()`
- Reminders 3 days and 1 day before `driver_subscriptions.ends_at`; grace
  period before downgrade
- **Exit criteria:** a real MoMo payment in sandbox activates a
  subscription exactly once, even if the webhook fires twice

## Phase 4 — Tracking & Safety
**Goal:** passengers can follow a trip live and reach help if needed.
- Tables: `trip_locations`, `trip_events`, `emergency_contacts`,
  `trip_shares`, `incidents`, `ratings`
- Driver app pings location every 15–30s while a trip is `in_progress`
- Passenger can share a live-tracking link; SOS button creates an
  `incidents` row visible on the admin console immediately
- **Exit criteria:** an admin sees a new incident within seconds of a
  passenger pressing SOS in a test

## Phase 5 — Admin, Support, Notifications
**Goal:** the operational tooling needed to actually run this day to day.
- Tables: `notifications`, `push_subscriptions`, `support_tickets`,
  `support_messages`
- Admin: route/town management UI, demand analytics from `search_events`
- **Exit criteria:** a support ticket raised by a passenger reaches an
  admin queue and can be responded to

## Deferred (build only if V1 traction justifies it)
- `promotions` / `promotion_redemptions` — discount codes
- Named seats (`trip_seats`) if an operator needs assigned seating
- A direct MoMo/Airtel integration to replace the aggregator, if volume
  makes the aggregator's per-transaction fee worth avoiding
- Migrating the Supabase-backed repository implementations to the
  Node.js/Express backend — do this behind the existing repository
  interfaces so the React app doesn't need to change
