# Graph Report - wala-ride  (2026-10-01)

## Corpus Check
- 113 files · ~122,541 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 541 nodes · 927 edges · 46 communities (26 shown, 20 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e3bcc5e9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 45|Community 45]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 21 edges
2. `SupabaseAuthService` - 18 edges
3. `compilerOptions` - 18 edges
4. `SupabaseTrackingService` - 17 edges
5. `compilerOptions` - 15 edges
6. `Town` - 14 edges
7. `supabase` - 13 edges
8. `SupabaseAdminService` - 13 edges
9. `BookingTicket` - 13 edges
10. `UserRoleType` - 11 edges

## Surprising Connections (you probably didn't know these)
- `AppContent()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/context/AuthContext.tsx
- `BookingHoldModal()` --calls--> `useAuth()`  [EXTRACTED]
  src/components/booking/BookingHoldModal.tsx → src/context/AuthContext.tsx
- `ETicketModalProps` --references--> `BookingTicket`  [EXTRACTED]
  src/components/booking/ETicketModal.tsx → src/types/domain.ts
- `TripManifestModalProps` --references--> `Trip`  [EXTRACTED]
  src/components/driver/TripManifestModal.tsx → src/types/domain.ts
- `PassengerViewProps` --references--> `BookingTicket`  [EXTRACTED]
  src/components/passenger/PassengerView.tsx → src/types/domain.ts

## Import Cycles
- None detected.

## Communities (46 total, 20 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (25): AccountModal(), AccountModalProps, AuthModal(), AuthModalProps, NotificationBell(), NotificationBellProps, AuthContext, AuthContextType (+17 more)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (13): BookingHoldModal(), BookingHoldModalProps, ETicketModal(), ETicketModalProps, IBookingService, PassengerViewProps, bookingService, SupabaseBookingService (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (16): AdminDemandAnalytics(), AdminDemandAnalyticsProps, AdminRouteManager(), AdminVerificationQueue(), IAdminService, PendingDriverVerification, IDriverService, adminService (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (18): AdminIncidentConsole(), TripManifestModal(), ITrackingService, SupabaseTrackingService, trackingService, EmergencyContactsModal(), EmergencyContactsModalProps, PublicTrackingView() (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (36): Border Radius Scale, Brand & Accent, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors, Components (+28 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (26): DriverRadarDashboard(), DriverRadarDashboardProps, DriverSubscriptionView(), DriverSubscriptionViewProps, IRadarService, ISubscriptionService, SupabaseRadarService, subscriptionService (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (11): AddPickupPointModal(), AddPickupPointModalProps, IGeographyService, TripAlertModal(), TripAlertModalProps, geographyService, SupabaseGeographyService, radarService (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (16): isSupabaseConfigured, supabase, INotificationService, notificationService, SupabaseNotificationService, CompositeTypes, Constants, Database (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (23): dependencies, lucide-react, react, react-dom, @supabase/supabase-js, devDependencies, oxlint, @types/deno (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.20
Nodes (10): AdminSupportQueue(), CreateTicketParams, ISupportService, SupabaseSupportService, supportService, SupportMessage, SupportTicket, SupportTicketPriority (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (8): AutocompleteRequest, ComputeRouteRequest, corsHeaders, DistanceMatrixRequest, GeocodeRequest, LatLng, PlaceDetailsRequest, SnapToRoadsRequest

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (10): 1. Vision, 2. Users & Roles, 3. Core Concepts, 4. V1 Features by Role, 5. Payment & Subscription Model (V1), 6. Non-Functional Requirements, 7. Out of Scope for V1 (explicitly deferred), 8. Database Schema Reference (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck, target, types (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.20
Nodes (9): deno.config, deno.enable, deno.enablePaths, deno.importMap, deno.lint, deno.path, deno.suggest.imports.hosts, https://deno.land (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.22
Nodes (8): Deferred (build only if V1 traction justifies it), Phase 0 — Foundations, Phase 1 — Core Trip Loop (cash only), Phase 2 — Driver Subscriptions & Radar, Phase 3 — Mobile Money for Subscriptions, Phase 4 — Tracking & Safety, Phase 5 — Admin, Support, Notifications, Work Plan — Intercity Ride Platform

### Community 17 - "Community 17"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, imports, @supabase/supabase-js, lint, rules, exclude

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (5): corsHeaders, FlwVerifyResult, hexToBytes(), PesapalVerifyResult, verifyHmacSha256()

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): imports, @supabase/supabase-js, lint, rules, exclude

### Community 23 - "Community 23"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 45 - "Community 45"
Cohesion: 0.19
Nodes (10): TripManifestModalProps, ITripService, SupabaseTripService, tripService, ManifestPassenger, Route, RouteStop, Trip (+2 more)

## Knowledge Gaps
- **194 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `recommendations` (+189 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SupabaseAdminService` connect `Community 2` to `Community 6`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _194 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08200290275761973 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09986504723346828 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09407665505226481 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.0797979797979798 - nodes in this community are weakly interconnected._