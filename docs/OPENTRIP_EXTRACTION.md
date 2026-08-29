# Open-source extraction audit: OpenTrip and Cairn

> Audit date: 2026-08-28  
> Scope: source review for the local ZouZou V4 demo. This note records what was
> actually read, what is safe to adapt, and what must not be copied wholesale.

## Provenance and reproducibility

The requested repositories were first attempted with `git clone`. The runtime
could reach GitHub through `gh api`, but the direct Git transport failed with a
connection reset. To keep the audit grounded in the exact repository source, the
same repositories were fetched as GitHub API tarball snapshots at the latest
commit available during this audit. The extracted directories intentionally do
not contain a `.git` directory and are therefore **source snapshots, not fake
clones**. Do not describe them as Git clones in product or legal copy.

| Repository | Snapshot directory | Archive | Commit observed | License observed |
| --- | --- | --- | --- | --- |
| [stvlynn/OpenTrip](https://github.com/stvlynn/OpenTrip) | [`_research/opentrip`](../_research/opentrip) | `_research/archives/opentrip2.tar.gz` | `cfc78a04d0eeba3daaec4b755b110d89938ae4fc` | Apache-2.0 (`LICENSE`, `package.json`) |
| [thkleinert/cairn](https://github.com/thkleinert/cairn) | [`_research/cairn`](../_research/cairn) | `_research/archives/cairn.tar.gz` | `e75db6a6aabad914fb31cfcd3cb224256ca61269` | MIT (`LICENSE`, `package.json`) |

The snapshots were read directly from their source files. The runnable UI
snapshots were also checked where their own dependency graphs could be installed
locally: Cairn's `pnpm run build` passed and Bloub's `pnpm test` (211 tests) plus
`pnpm run build` passed. The react-masonry-css package's upstream build script
was attempted and stopped on its old dependency graph (`@babel/types` missing in
the generated install); its checked-in `dist/` and source were still audited.
OpenTrip, Lucide, Simple Icons, and Better Auth are large monorepos or asset
packages, so this pass uses source inspection and package manifests rather than
claiming a full monorepo build. The extraction decisions below are based on
source and first-party repository documentation, not on screenshots alone.

## Executive decision

OpenTrip is the strongest source for ZouZou's trip-domain contract: its planner
already separates map, schedule, reservations, budget, collaboration, and an
approval-gated AI companion. Cairn is the strongest source for a mobile-friendly
place model: stop/spot nesting, visited-route semantics, realtime collaboration,
and an outline that survives reordering.

The reusable boundary for ZouZou is **data contracts and interaction patterns**,
not a wholesale UI import. OpenTrip is React + Tailwind + MapLibre + a Hono/API
backend; Cairn is React + Supabase + Mapbox. ZouZou's visual system, local-first
store, and V4 map-provider decision remain independent. In particular, OpenTrip
and Cairn's map implementations must not silently reintroduce OSM/MapLibre or
Mapbox when the production adapter is configured for AMap.

## Capability audit

| Capability requested by V4 | Source actually read | Mature unit worth adapting | ZouZou destination | Decision |
| --- | --- | --- | --- | --- |
| Planner composition | [`apps/web/src/pages/travel-planner/TravelPlannerPage.tsx`](../_research/opentrip/apps/web/src/pages/travel-planner/TravelPlannerPage.tsx), [`docs/user/plan-a-trip.mdx`](../_research/opentrip/docs/user/plan-a-trip.mdx) | Four-mode planner contract and page-private feature boundary | `src/pages/TripPages.tsx`, `src/demo-data/trips.ts` | Adapt the contract and state transitions; do not copy Tailwind page shell. |
| Map itinerary, stop search, picking, geolocation | [`apps/web/src/shared/ui/map/TripMap.tsx`](../_research/opentrip/apps/web/src/shared/ui/map/TripMap.tsx), [`apps/web/src/pages/travel-planner/ui/TripMapView.tsx`](../_research/opentrip/apps/web/src/pages/travel-planner/ui/TripMapView.tsx), [`docs/frontend/map.md`](../_research/opentrip/docs/frontend/map.md) | `TripMap` prop boundary, fit/selection/pick/context behavior, route GeoJSON layering | `src/components/RealRouteMap.tsx`, future `src/services/amap/` | Adapt the API shape. Keep provider-specific code behind AMap/MapLibre adapter. |
| Day schedule and drag/reorder | [`apps/web/src/pages/travel-planner/ui/ScheduleBoard.tsx`](../_research/opentrip/apps/web/src/pages/travel-planner/ui/ScheduleBoard.tsx), [`apps/web/src/entities/stop/model.ts`](../_research/opentrip/apps/web/src/entities/stop/model.ts), [`apps/web/src/entities/trip/model.ts`](../_research/opentrip/apps/web/src/entities/trip/model.ts) | Stop fields, day-level mutations, transit entries, optimistic reorder | `src/demo-data/trips.ts`, `src/pages/TravelPages.tsx` | Adapt only the type/mutation ideas; our demo intentionally uses local data. |
| Reservations | [`apps/web/src/pages/travel-planner/ui/ReservationsBoard.tsx`](../_research/opentrip/apps/web/src/pages/travel-planner/ui/ReservationsBoard.tsx), [`apps/web/src/entities/reservation/model.ts`](../_research/opentrip/apps/web/src/entities/reservation/model.ts), [`apps/api/src/application/reservation/reservation-service.ts`](../_research/opentrip/apps/api/src/application/reservation/reservation-service.ts) | Typed reservation lifecycle, status, revision guard, idempotent create | `src/pages/TripPages.tsx` (future reservation sheet) | Adapt the state model if reservations are expanded; do not import server persistence. |
| Shared budget and settle-up | [`apps/web/src/pages/travel-planner/ui/BudgetBoard.tsx`](../_research/opentrip/apps/web/src/pages/travel-planner/ui/BudgetBoard.tsx), [`apps/api/src/domain/trip/settlement.ts`](../_research/opentrip/apps/api/src/domain/trip/settlement.ts), [`apps/web/src/entities/expense/model.ts`](../_research/opentrip/apps/web/src/entities/expense/model.ts) | Deterministic debtor/creditor settlement and multi-currency display model | `src/demo-data/trips.ts` | Adapt the pure settlement algorithm; no API/database coupling. |
| Invite, roles, votes, comments | [`apps/web/src/pages/travel-planner/ui/InviteDialog.tsx`](../_research/opentrip/apps/web/src/pages/travel-planner/ui/InviteDialog.tsx), [`apps/api/src/application/invite-service.ts`](../_research/opentrip/apps/api/src/application/invite-service.ts), [`apps/web/src/pages/travel-planner/model/useTripActions.ts`](../_research/opentrip/apps/web/src/pages/travel-planner/model/useTripActions.ts), [`docs/user/collaborate.mdx`](../_research/opentrip/docs/user/collaborate.mdx) | Tokenized invite lifecycle, role checks, vote/comment mutations, cache-safe updates | `src/pages/TripPages.tsx`, `src/stores/appStore.ts` | Adapt behavior and copy; keep local-only mock adapter. |
| AI companion and approval | [`apps/web/src/pages/travel-planner/model/useAgentChat.ts`](../_research/opentrip/apps/web/src/pages/travel-planner/model/useAgentChat.ts), [`apps/web/src/pages/travel-planner/model/useAgentEvents.ts`](../_research/opentrip/apps/web/src/pages/travel-planner/model/useAgentEvents.ts), [`apps/api/src/application/agent/agent-service.ts`](../_research/opentrip/apps/api/src/application/agent/agent-service.ts), [`apps/api/src/application/trip/ops/catalog.ts`](../_research/opentrip/apps/api/src/application/trip/ops/catalog.ts), [`apps/api/src/application/agent/sequential-trip-patch-applier.ts`](../_research/opentrip/apps/api/src/application/agent/sequential-trip-patch-applier.ts) | Shared session, streaming buffer vs persisted history, explicit write-tool approval, serialized trip patches | `src/services/ai.ts`, `src/pages/TravelPages.tsx`, `src/components/ui.tsx` | Adapt approval semantics and operation catalog. Keep ZouZou's local simulated response and Bloub renderer. |
| Weather | [`apps/web/src/features/weather/useWeather.ts`](../_research/opentrip/apps/web/src/features/weather/useWeather.ts), [`apps/api/src/application/weather/weather-service.ts`](../_research/opentrip/apps/api/src/application/weather/weather-service.ts), [`apps/api/src/infrastructure/weather/openweather-client.ts`](../_research/opentrip/apps/api/src/infrastructure/weather/openweather-client.ts) | Query key includes coordinates/date/time/language; bounded hourly/daily normalization | `src/services/weather.ts`, `src/demo-data/trips.ts` | Adapt caching/failure semantics; do not copy OpenWeather credentials or proxy. |
| Auth and WeChat | [`apps/web/src/features/auth/AuthForm.tsx`](../_research/opentrip/apps/web/src/features/auth/AuthForm.tsx), [`apps/web/src/shared/auth/index.ts`](../_research/opentrip/apps/web/src/shared/auth/index.ts), [`apps/api/src/infrastructure/auth/auth.ts`](../_research/opentrip/apps/api/src/infrastructure/auth/auth.ts), [`apps/api/src/infrastructure/auth/wechat-mini-program.ts`](../_research/opentrip/apps/api/src/infrastructure/auth/wechat-mini-program.ts) | Better Auth React client composition, OTP/2FA hooks, provider-agnostic avatar projection, WeChat mini-program endpoint | `src/services/auth/`, `src/pages/AccountPages.tsx` | Adapt the adapter contract; no server secrets or production provider calls in local demo. |
| Mobile onboarding | [`apps/web/src/features/mobile-onboarding/model/onboarding.ts`](../_research/opentrip/apps/web/src/features/mobile-onboarding/model/onboarding.ts), [`apps/web/src/features/mobile-onboarding/ui/MobileOnboarding.tsx`](../_research/opentrip/apps/web/src/features/mobile-onboarding/ui/MobileOnboarding.tsx) | Install/notification/location permission state persisted independently | `src/pages/AccountPages.tsx`, `src/stores/appStore.ts` | Adapt local permission state only if needed. |
| Architecture boundary | [`docs/frontend/layers.md`](../_research/opentrip/docs/frontend/layers.md), [`apps/web/src/app/router.tsx`](../_research/opentrip/apps/web/src/app/router.tsx) | Page-owned composition, shared UI primitives, entity-only pure models | `src/pages`, `src/components`, `src/services` | Use as an extraction map; do not reproduce the full FSD tree. |

## OpenTrip: source-level findings

### 1. Planner and schedule

`TravelPlannerPage.tsx` composes the single trip workspace and explicitly owns
tab selection, day selection, selected stop, map-pick state, schedule compose
state, and optimistic mutation boundaries. `ScheduleBoard.tsx` exposes a useful
draft contract (`day`, `index`, `name`, `time`, `duration`, coordinates, category,
cost, note) and delegates persistence through callbacks. This separation is
valuable for ZouZou's create flow because the map can fill coordinates while the
schedule sheet retains the draft.

The entity models are deliberately transport-free. `entities/stop/model.ts`
keeps location, category, transit, votes, comments, and Markdown note together;
`entities/trip/model.ts` owns days/stops/budget helpers. The extraction target is
the contract, not the JSX classes or Tailwind styles.

### 2. Map behavior

OpenTrip's `TripMap` keeps the map instance mounted, installs a GeoJSON route
source/layers, updates markers separately, and exposes a small API:
`stops`, `day`, `activeStopId`, `onSelectStop`, `picking`, `onPick`, `onContext`,
`fallbackCenter`, `userAvatar`, and `locateSignal`. Its docs also describe fit
bounds, day-filtered route lines, selected-stop focus, user geolocation, and a
mobile itinerary pill. Those behaviors map cleanly to ZouZou's route card and
arrival/deviation states.

The implementation itself is MapLibre/CARTO-specific (`shared/ui/map/TripMap.tsx`)
and the source docs call out Photon reverse geocoding. V4's AMap requirement
means only the prop boundary and behavior should be adapted; basemap URLs,
MapLibre classes, and external geocoding policy must stay in a provider module.

### 3. Reservations and budget

The reservation model has explicit type/status fields, provider and confirmation
number, time zone, location, optional coordinates, day/stop/expense links, amount,
notes, timestamps, and a `revision`. The service validates linked day/stop/expense
records and returns a conflict when the revision changed. Creation accepts an
idempotency key. This is a better foundation than a string-only booking card if
ZouZou grows beyond the demo.

`domain/trip/settlement.ts` computes total/per-person balances and greedily matches
largest debtors with largest creditors. It is deterministic and produces a
minimal transfer list. `BudgetBoard.tsx` mirrors the algorithm for traceable UI
explanations and offers FX display without rewriting stored amounts. This pure
algorithm can be copied under ZouZou's own namespace with attribution; the API
repository code and currency provider cannot.

### 4. Collaboration and AI

OpenTrip's `useTripActions.ts` writes successful server responses directly into a
query cache and cancels stale reads before applying them. This guards a local UI
against an older read erasing a just-added stop. The invite service hashes tokens,
supports restricted emails, role/can-invite flags, expiry, revocation, and
acceptance. `docs/user/collaborate.mdx` confirms that votes and stop comments are
trip-local and that `@agent` can be used in a stop thread.

The AI path is unusually reusable as a product pattern: `useAgentChat.ts` keeps a
streaming `useChat` buffer separate from persisted history, `useAgentEvents.ts`
polls a shared session, `agent-service.ts` persists messages and pauses for write
tool approval, and `catalog.ts` defines typed operations such as insert/update
stop, reorder days, and add/update expense. The sequential patch applier avoids
parallel AI tool calls overwriting each other. ZouZou should preserve the explicit
approval state and operation vocabulary even while using a local deterministic
simulator.

### 5. Weather and auth

The weather hook only enables a query when latitude, longitude, and date are
present; its key includes time and language and uses a one-hour stale window. The
API service bounds supported forecast dates and normalizes hourly/daily data. This
is useful for honest loading/empty states in the plan card.

The web auth client uses `better-auth/react`, the email OTP and 2FA client plugins,
and `inferAdditionalFields` for typed profile fields. The server config adds
Google/WeChat providers when configured and includes a dedicated WeChat
mini-program `code2session` endpoint. ZouZou's local adapter should expose the
same conceptual methods (sign-in, sign-up, OTP, sign-out, session, avatar) without
bundling any API secrets.

## Cairn: source-level findings

### 1. Data model worth reusing

`src/types/index.ts` defines a compact collaborative model: `Trip`, `Tag`,
`PlaceImage`, `PlaceComment`, flat `TripNote` bullets with `depth`, `PlaceKind`
(`stop` or `spot`), and `PlaceVisit` date windows. `Place` stores coordinates,
parent place, status (`planned`/`visited`), visit time, image, tags, and position.
This makes a stop/spot hierarchy explicit instead of inferring it from card
labels.

`supabase/schema.sql` enforces bounded coordinates, coherent visited timestamps,
same-trip parent references, one-level stop/spot nesting, and a database trigger
that rejects cycles or turning a parent into a child while it still contains
spots. Those invariants are directly applicable to a future persistent ZouZou
trip store, but the Supabase SQL is not a local demo dependency.

### 2. Reorder and outliner behavior

`hooks/useDragReorder.ts` is a manual pointer-based reorder hook with vertical
offset previews and optional sideways nesting. `lib/placeTree.ts` resolves a
horizontal threshold (`INDENT_PX = 36`) into a parent change, keeps a spot in its
parent's run unless the user actually crosses the threshold, and handles folded
children. The list view does not blindly sort by card height; it preserves the
user's order and sends a single atomic ordered-id write.

`lib/outline.ts` treats notes as a flat ordered list plus depth. It provides
subtree boundaries, indent/outdent guards, sibling moves, fold visibility, and
promotion of children after deletion. That is a mature interaction model for
future itinerary notes, but it is too broad to import into the V4 demo without a
real notes editor.

### 3. Map and visits

`components/MapView.tsx` keeps Mapbox lazy-loaded until a trip opens, renders
emoji/tag markers, supports map long-press point picking, keeps selected marker
focus, fits bounds, and draws a visited route in visit timestamp order. It first
requests real road geometry and falls back to a dashed straight line for ferry or
unroutable legs. `hooks/usePlaceVisits.ts` persists date windows rather than
pretending every visit is a single timestamp.

The map/route behavior is an excellent reference for ZouZou's arrival replay,
but Mapbox token/style code must remain out of the provider-neutral UI.

### 4. Collaboration, search, and auth

`hooks/useCollaborators.ts` loads member rows and pending invites, invokes an
invite edge function, and exposes revoke/remove operations. `hooks/usePlaces.ts`
subscribes to Supabase realtime changes, applies optimistic local edits, writes
tags/images/parents, and sends a single reorder RPC. `components/PlaceSearch.tsx`
uses Google Places autocomplete/detail with a session token and returns a
coordinate-bearing place, which is the right abstraction for a provider adapter.
`components/AuthScreen.tsx` keeps sign-in, sign-up, reset, and invite-context
states in one flow.

## Extraction boundary and legal handling

The exact license and copied/adapted status for every requested repository is
tracked in [`THIRD_PARTY.md`](./THIRD_PARTY.md). In this audit pass no source file
was copied into production `src`; the table records candidates and the intended
destination so the implementation agent can make a deliberate, attributed
adaptation. When code is eventually copied or materially adapted, preserve the
source copyright/license notice in the destination or in `THIRD_PARTY.md`.

Do not copy OpenTrip's screenshots, brand assets, OpenWeather/Mapbox/Google keys,
or Cairn's Supabase project configuration. The local demo may use its own seed
photos and local adapters. The Bloub, Lucide, Simple Icons, Better Auth, and
react-masonry-css audits are documented in the companion third-party ledger.
