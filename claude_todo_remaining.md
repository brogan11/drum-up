# Task: Finish the last two items of the Drum Up dashboard audit

Read `CLAUDE.md` first for conventions (brand colors graphite/chestnut/snow/teal/charcoal,
shadows-not-borders, rounded-xl/2xl, Inter; `@/lib/supabase` anon vs `@/lib/supabase-admin`
service-role; PostGIS strategy; NO direct-connection driver; dated migrations in
`supabase/migrations/`). Everything else from the original 6-phase audit is already done and
committed — only the two items below remain.

Work in logical commits (one theme per commit). Run `npx tsc --noEmit -p tsconfig.json` after
each item and a full `npm run build` before finishing. Deliver any schema changes as NEW dated
migration files in `supabase/migrations/` (the user applies them in Supabase manually — do not
try to run them). Do not push unless asked. Match the existing design system exactly.

Targets:
- app/dashboard/MusicianDashboard.tsx
- app/dashboard/RestaurantDashboard.tsx
- app/dashboard/FanDashboard.tsx

---

## ITEM 1 (feature) — Phase 4.7: Musician block-out dates + calendar import

The musician availability system is positive-only (they post dates they're FREE via
`musician_availability`). Add the ability to mark dates UNAVAILABLE, and to import an external
calendar so conflicts are visible.

Sub-tasks:
1. **Block-out dates.** Let a musician mark specific dates (or date ranges) as unavailable.
   - Add a migration creating `musician_blackouts` (id uuid pk default gen_random_uuid(),
     created_at timestamptz default now(), musician_id uuid fk -> profiles.id on delete cascade,
     date date not null, reason text, unique(musician_id, date)). Enable RLS; policies: the
     musician manages only their own rows (auth.uid() = musician_id) for select/insert/delete.
   - In MusicianDashboard, surface blackout dates in the confirmed-gigs calendar view (it already
     exists — reuse it) with a distinct muted/struck style, and add UI to add/remove a blackout.
   - Wire the existing double-booking guard (`conflictsWith` / `respondingId` in MusicianDashboard)
     so accepting an invite/applying that falls on a blackout date triggers the same
     confirm-anyway dialog.
2. **Calendar import (scope last; biggest lift).** Allow importing an .ics file or a public
   iCal/Google URL so external commitments show as blackout-style busy blocks. Parse client-side
   (no new heavy deps — a small inline VEVENT/DTSTART parser is fine; `lib/ics.ts` already has
   export helpers to mirror). Store imported busy dates as blackouts (or a separate
   `source='import'` column on the same table). Keep it resilient to malformed input.

Confirm the migration is idempotent (`create table if not exists`, `if not exists` columns,
`drop policy if exists` before create).

---

## ITEM 2 (refactor only — no behavior change) — Phase 1.2: extract shared dashboard components

These sub-components are copy-pasted near-identically across the three dashboards. Extract them
into a new `components/dashboard/` directory and replace every call site, deleting the local
duplicates. GOAL: remove ~1,000 duplicate lines with ZERO rendered-output change.

Extract (support the optional props noted, which some variants already use):
- `SectionHeader` (Fan's variant has a `live` boolean -> pulsing teal dot)
- `EmptyState` (Fan's variant has a `twoActions` prop)
- `StatCard` (supports `highlight`)
- `TabButton` (supports `badge`, `animation`)
- `ProfileField`
- `DashboardHeader` (logo + live dot + `NotificationBell` + avatar dropdown: View Profile /
  Settings / Log Out) -> props: profileName, avatarUrl, userId, onLogout
- `DashboardTabBar` -> props: items: {icon,label,active,onClick,badge?,animation?}[]
- `SocialLinks` (Instagram/YouTube/Spotify via `buildSocialUrl`, repeated ~5x in Restaurant) ->
  props: instagram, youtube, spotify, size?
- `EqPanel` (graphite eq-bar panel chrome: radial glows + `eqBarStyle` bars from `@/lib/eq`)

Approach: diff the three implementations of each before extracting; make the shared version a
superset via optional props; migrate one component type at a time with a typecheck between each so
regressions are easy to localize. Verify the three dashboards render identically (spot-check the
header, tab bar, stat cards, and profile tab in `npm run dev`).

---

When both are done: run `npm run build`, give me a summary of the commits and list any NEW
migration files I need to apply in Supabase (in order), and STOP without pushing.
