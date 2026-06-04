# Task: Fix all audited issues across the three Drum Up dashboards

You are working in the Drum Up codebase (Next.js 16 / React 19 / TypeScript / Supabase / Tailwind). Read `CLAUDE.md` first for conventions (brand colors, shadows-not-borders, `@/lib/supabase` vs `@/lib/supabase-admin`, PostGIS strategy, no direct-connection driver, dated migrations in `supabase/migrations/`).

This is a fix list from a full UX/code audit of the three dashboards:
- `app/dashboard/RestaurantDashboard.tsx` (~2,983 lines)
- `app/dashboard/MusicianDashboard.tsx` (~2,623 lines)
- `app/dashboard/FanDashboard.tsx` (~1,514 lines)
- shared: `components/NotificationBell.tsx`, `components/InviteModal.tsx`, `components/SaveButton.tsx`, `components/ShareButton.tsx`, `components/MessagingTab.tsx`

**Before editing:** re-read each target file/section — line numbers below are from the audit snapshot and may have drifted. Verify each finding still exists. Work in logical commits (one theme per commit), don't bundle unrelated changes, and don't push unless asked. Match the existing design system exactly (graphite/chestnut/snow/teal/charcoal, `rounded-xl`/`rounded-2xl`, shadows over borders, Inter). Run a typecheck/build after each phase.

Tackle in this order (infra first, then per-dashboard, then polish).

---

## PHASE 1 — Shared infrastructure (do these first; later phases depend on them)

### 1.1 Create an accessible `<Modal>` wrapper — `components/Modal.tsx`
None of the ~15 hand-rolled `fixed inset-0 bg-graphite/60` modals across the three dashboards trap focus, close on Escape, lock body scroll, or restore focus; backdrop-click-to-close is inconsistent (Post-Slot, Payment, Apply only close via the X). Build one wrapper and migrate every modal to it.

Requirements: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; Escape closes; Tab/Shift+Tab focus trap; focus first control on open; lock `document.body.overflow`; restore previously-focused element on unmount; backdrop mousedown closes (toggleable via `closeOnBackdrop`); `sheetOnMobile` → `items-end sm:items-center` default; `size: 'sm' | 'md'`.

```tsx
// components/Modal.tsx
'use client'
import { useEffect, useRef } from 'react'

export default function Modal({
  onClose, children, size = 'md', sheetOnMobile = true, closeOnBackdrop = true, labelledBy,
}: {
  onClose: () => void
  children: React.ReactNode
  size?: 'sm' | 'md'
  sheetOnMobile?: boolean
  closeOnBackdrop?: boolean
  labelledBy?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab' || !ref.current) return
      const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])')
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('button,a[href],textarea,input,select')?.focus())
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; prevFocus?.focus() }
  }, [onClose])
  return (
    <div
      className={`fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex justify-center p-4 ${sheetOnMobile ? 'items-end sm:items-center' : 'items-center'}`}
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose() }}
    >
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy}
        className={`bg-snow w-full ${size === 'sm' ? 'max-w-sm' : 'max-w-md'} rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  )
}
```

Then migrate ALL modals to it, giving each titled header an `id` referenced by `labelledBy`:
- Restaurant: PaymentModalInner, Edit-Slot, Cancel-Slot, Cancel-Booking, Invite-Success, Post-Slot, Payment `<Elements>` wrapper, plus `InviteModal`/`InvitePeopleModal` triggers.
- Musician: Apply, Stripe-Explain, Stripe-Success, Cancel-Booking, Stripe-Refresh, PostAvailabilityModal.
- Standalone components: `InviteModal.tsx`, `InvitePeopleModal.tsx`.

### 1.2 Extract duplicated sub-components into `components/dashboard/`
These are copy-pasted near-identically in all three files:
- `SectionHeader`, `EmptyState` (note Fan's variant has an extra `twoActions` prop and `live` on SectionHeader — make the shared versions support those optional props), `StatCard` (supports `highlight`), `TabButton` (supports `badge`, `animation`), `ProfileField`.
- The **header** (logo + live dot + `NotificationBell` + avatar dropdown menu with View Profile / Settings / Log Out) → `<DashboardHeader profileName avatarUrl userId onLogout />`.
- The **bottom tab bar** → `<DashboardTabBar items={[{icon,label,active,onClick,badge,animation}]} />`.
- The **social-links row** (Instagram/YouTube/Spotify via `buildSocialUrl`, repeated ~5× in Restaurant alone) → `<SocialLinks instagram youtube spotify size />`.
- The graphite **eq-bar panel** chrome (radial glows + `eqBarStyle` bars) → `<EqPanel>`.

Replace all call sites; delete the now-duplicate local definitions. Goal: remove >1,000 lines without changing rendered output.

### 1.3 Single currency formatter
Currency is mixed: `${slot.budget}` (→ `$200`) vs `.toFixed(2)` (→ `$200.00`). Use the existing money formatter in `lib/analytics.ts` (or add `formatMoney(n)` there) and apply everywhere money renders in all three dashboards + payment/earnings UIs.

### 1.4 Accessibility quick-hits (all three files)
- Add `aria-label` to every icon-only button (notably the message-icon buttons, e.g. Restaurant ~L1350, ~L1453; calendar nav ‹ › ~L2831). Follow the good example already present: availability cancel uses `aria-label="Cancel slot"`.
- Add `aria-hidden="true"` to purely decorative SVGs.
- Bump touch targets to ≥44px: filter chips (currently `py-1.5`≈28px) and bottom-nav targets (`h-9`=36px → use `h-11`/min-h-[44px]).
- Keep status badges as-is (they already pair color with text — good).

---

## PHASE 2 — Data-fetch scalability (the #1 technical risk; PostGIS RPCs)

CLAUDE.md mandates PostGIS `ST_DWithin` but all distance filtering is client-side haversine over whole-table scans. Add a dated migration `supabase/migrations/<YYYY_MM_DD>_dashboard_feed_rpcs.sql` with `security invoker` RPCs, then swap the loaders to call them with `limit` + server-side date/distance filters.

### 2.1 Fan `loadFeed` — `app/dashboard/FanDashboard.tsx` (~L173–263)
Currently pulls **every confirmed booking platform-wide** (no limit) then 3 follow-up `in()` queries + JS date/distance filtering. Replace with a `fan_feed(fan_lat, fan_lon, radius_m, days)` RPC:

```sql
create or replace function fan_feed(fan_lat float8, fan_lon float8, radius_m float8, days int)
returns table (
  booking_id uuid, restaurant_id uuid, musician_id uuid,
  venue_name text, venue_avatar text, venue_location text,
  musician_name text, musician_avatar text, performer_type text, band_members int,
  gig_date date, start_time time, end_time time, distance_m float8
) language sql stable security invoker as $$
  select b.id, b.restaurant_id, b.musician_id,
         coalesce(v.role_metadata->>'venue_name', v.full_name), v.avatar_url, v.location_text,
         m.full_name, m.avatar_url, m.performer_type, m.band_members,
         a.date, a.start_time, a.end_time,
         case when fan_lat is null or v.latitude is null then null
              else st_distance(st_makepoint(v.longitude,v.latitude)::geography,
                               st_makepoint(fan_lon,fan_lat)::geography) end
  from confirmed_gigs b
  join availability a on a.id = b.availability_id
  join profiles v on v.id = b.restaurant_id
  join profiles m on m.id = b.musician_id
  where a.date between current_date and current_date + days
    and (fan_lat is null or st_dwithin(
      st_makepoint(v.longitude,v.latitude)::geography,
      st_makepoint(fan_lon,fan_lat)::geography, radius_m))
  order by a.date, a.start_time
  limit 200;
$$;
```
Client (keep cross-midnight `gigStartEnd` end-filter, distance in miles = `distance_m/1609.34`):
```tsx
const loadFeed = useCallback(async (lat: number | null, lon: number | null) => {
  const { data, error } = await supabase.rpc('fan_feed', { fan_lat: lat, fan_lon: lon, radius_m: 100*1609.34, days: 30 })
  if (error) { console.error('[Feed]', error.message); return }
  const now = new Date()
  setFeedGigs((data ?? []).flatMap(r => {
    if (gigStartEnd(r.gig_date, r.start_time, r.end_time ?? '23:59:00').end < now) return []
    return [{ /* map to FeedGig exactly as today; distance: r.distance_m!=null ? r.distance_m/1609.34 : null */ } satisfies FeedGig]
  }))
}, [])
```

### 2.2 Restaurant `loadMusicians` — `app/dashboard/RestaurantDashboard.tsx` (~L498–548)
Pulls **every musician** then JS-filters by distance. Replace with a `musicians_near(lat, lon, radius_m)` RPC (returns same columns currently selected + `distance_m`), `limit ~200`. Keep the reputation `groupReputations` follow-up query.

### 2.3 Fan `loadDiscover` — `app/dashboard/FanDashboard.tsx` (~L265–325)
Pulls **every restaurant + musician**. Replace with `profiles_near(lat, lon, radius_m, types text[])` RPC, `limit ~200`.

### 2.4 Musician gig browse — `app/dashboard/MusicianDashboard.tsx` (~L377–445)
Same pattern: open public availability, server-side distance/date, `limit`. Reuse/extend an `open_gigs_near(lat, lon, radius_m)` RPC.

### 2.5 Fan realtime fan-out — `app/dashboard/FanDashboard.tsx` (~L384–398)
Sub on `status=eq.confirmed` fires for EVERY confirmed booking platform-wide → every online fan reloads. Debounce the reload (e.g. trailing 3–5s) and/or only refetch if the changed row is within radius. At minimum, coalesce rapid events.

---

## PHASE 3 — Restaurant dashboard

### 3.1 (CRITICAL) Fix the dead radius control / broken CTA
`saveRadius`/`radiusDraft`/`radiusSaved`/`setRadiusDraft` (~L365–367, L732–753) are dead; the "Update Radius in Profile" empty-state CTA (~L1972) routes to the Profile tab which has **no** radius UI. EITHER render a radius selector in the Browse radius bar (~L1845 "Within {discoveryRadius} miles") wired to `saveRadius`, OR change the CTA to route to `/settings`. Prefer the in-Browse selector (fewer clicks). Remove whatever stays dead.

### 3.2 (CRITICAL) Fix invite-from-availability prefill — ~L1816–1822
`startTime: slot.start_time ? undefined : undefined` always passes `undefined`; the musician's posted time is dropped. Add a raw `HH:mm` field to `MusicianAvailCard` (set it in `loadMusicianAvailability` ~L569–599 before the `fmtT` display formatting) and pass raw start/end into `InviteModal`'s `prefillStartTime`/`prefillEndTime`.

### 3.3 (HIGH) Add "Rebook" to past bookings
Archive past-slot card (~L1701–1709) knows `confirmedApp.musicianId` and only offers Review. Add a **Rebook** button that opens `InviteModal` targeted at that musician.

### 3.4 (HIGH) Add musician shortlist
Restaurant Browse cards (~L2013–2026) only have Message / View Profile. Add `<SaveButton type="musician" />` (component already exists; used by Musician/Fan). Optionally add a "Saved" filter chip.

### 3.5 (HIGH) Browse filters: pay range + available-on-date
Filters are only genre / solo-band / name sort (~L1872–1905). Add a pay-range control and a date filter (data exists: `min_pay`, dated availability).

### 3.6 Decline needs confirmation/undo
`handleApplicationAction(...'decline')` (~L879–918) cancels instantly on one tap. Add an inline confirm or an undo toast (cancel-slot/cancel-booking already have modals — match that bar).

### 3.7 Remove dead inline-edit code
`editingProfile`/`setEditingProfile`/`profileDraft`/`saveProfile`/`ProfileField` (~L359–360, L696–730, L2961) are unused (Profile tab links to `/settings`). Delete (or, if you adopt one editing model in 5.x below, wire it up instead).

### 3.8 Edit-Slot past-date guard
`getDateOptions` lists today→+90d and prepends a stale current value; prevent saving a past date when editing.

---

## PHASE 4 — Musician dashboard

### 4.1 (CRITICAL) Double-booking guard + anti-double-submit
`handleRespondInvite` (~L766–797) and `handleApply` (~L703) never check for overlapping confirmed gigs — a stated JTBD. Add interval-overlap detection using `gigStartEnd`, confirm-anyway dialog, and a `respondingId` in-flight lock; wire `disabled` onto accept/decline buttons (~L1168–1180).

```tsx
const [respondingId, setRespondingId] = useState<string | null>(null)
const conflictsWith = (target: Booking): Booking | null => {
  const t = gigStartEnd(target.gig.rawDate, target.gig.rawStartDatetime.slice(11) || null, target.gig.rawEndDatetime.slice(11) || '23:59')
  return bookings.find(b => b.id !== target.id && b.status === 'confirmed' && (() => {
    const o = gigStartEnd(b.gig.rawDate, b.gig.rawStartDatetime.slice(11) || null, b.gig.rawEndDatetime.slice(11) || '23:59')
    return t.start < o.end && o.start < t.end
  })()) ?? null
}
// in handleRespondInvite('accept') and handleApply: if (clash) window.confirm(...) before proceeding
// guard top of handler: if (respondingId) return; setRespondingId(bookingId); ... finally setRespondingId(null)
```

### 4.2 (CRITICAL) Add a calendar view of confirmed gigs
Musician only has list views (~L1438–1708) despite most needing conflict-spotting. Reuse the Restaurant `SlotCalendar` pattern (extract it to `components/dashboard/` in Phase 1.2 if convenient) for confirmed bookings.

### 4.3 (HIGH) Urgency on pending items
Pending applications/invites (~L1122–1201) show no age/expiry. Surface "invited Xh ago" (and an expiry countdown if invites expire).

### 4.4 (HIGH) Profile-completeness indicator
Add a "Profile N% complete — add genres/bio/media/rate" bar on the Profile tab driven by which fields are set.

### 4.5 (HIGH) Base rate + media editing reachable from dashboard
Add a profile-level base rate (new column via migration if needed) so venues can gauge pricing pre-invite. Surface the media showcase entry (per CLAUDE.md) from the Profile tab (~L1756–1767), not only `/settings`.

### 4.6 (HIGH) Reviews: see all + respond
Avg/count show in stats (~L1892–1919) but reviews are only on the public profile and can't be replied to. Add a reviews list + reply affordance (needs a `review_replies` column/table — add migration).

### 4.7 Availability: block-out dates + confirm on delete + calendar sync
- Availability is positive-only; add a way to mark unavailable dates.
- The `X` delete (~L1963–1974) is instant/destructive — add a confirm.
- Add Google/iCal import (currently only per-gig `.ics` export). (Scope this last; biggest lift.)

### 4.8 Payment dispute path
Earnings (~L1480–1503) have no "something's wrong" entry point. Add a dispute/contact-support link per payout (ties into Stripe disputes already in the admin side).

### 4.9 Earnings "this month"
Home "Earned" (~L1037) is lifetime. Add this-month / upcoming / all-time per the brief.

### 4.10 Remove dead inline-edit code
`editingProfile`/`saveProfile`/`profileDraft`/`ProfileField` (~L184–185, L514–549, L2588) unused — delete or wire to the chosen editing model (5.x).

---

## PHASE 5 — Fan dashboard

### 5.1 (CRITICAL) Event detail page + RSVP + Share + cover charge
- Add `app/event/[id]/page.tsx` (who/what/where/when, venue vibe, musician samples, add-to-calendar, follow buttons). Route gig cards there (currently they only go to venue/artist profiles, ~L661–672).
- Add **RSVP / "I'm going"** (new `rsvps` table via migration; show going-count).
- Add **share link** using the existing `ShareButton` on gig cards/detail.
- Add **cover charge**: new `cover_charge` column on `availability` (or bookings), expose it in the restaurant Post-Slot form, and render on fan cards/detail. ("Free entry" filter depends on this.)
- Show **genre** on event cards (~L854–909) — currently absent.

### 5.2 (CRITICAL) Personalize by genre
Discover-Nearby is distance-only (~L482–487) and favorite-genres from onboarding are unused. Rank/filter feed by favorite genres; add genre + free-entry filters to the Events view (~L799–830).

### 5.3 (CRITICAL) Map view
Add a list/map toggle for events using existing lat/lng. (Pick a lightweight, code-split map; lazy-load it.)

### 5.4 (HIGH) Retention: saved-items screen + attended count
`SaveButton` writes `saved_items` but nothing lists them. Add a "Saved" view and a "shows attended" count/history. Consider light gamification.

### 5.5 Card data completeness
Add genre + neighborhood to feed `GigCard` and event cards.

---

## PHASE 6 — Cross-cutting consistency (do after per-dashboard work)

- **Unify profile-editing model:** Fan edits inline (~L1163–1170); Restaurant & Musician route to `/settings`. Choose ONE and apply to all three (this resolves the dead-code items 3.7 / 4.10 cleanly).
- **Unify modal mobile shape:** some modals are always `items-center` (tiny centered box) — the new `<Modal sheetOnMobile>` default fixes this; verify all adopt bottom-sheet-on-mobile unless intentionally `sm`.
- **Destructive-action policy:** every destructive action gets confirm-or-undo (decline app, cancel app, delete availability, decline invite).
- **Fan nav naming:** bottom-nav "Events" maps to `activeTab === 'discover'` (~L1237) — rename the state to `events` for maintainability (no user-facing change).

---

## Acceptance checklist
- [ ] `components/Modal.tsx` exists; all ~15 modals migrated (Escape, focus trap, scroll-lock, restored focus, labelled).
- [ ] Shared `DashboardHeader`/`DashboardTabBar`/`SectionHeader`/`EmptyState`/`StatCard`/`TabButton`/`ProfileField`/`SocialLinks`/`EqPanel` extracted; per-file duplicates deleted; rendered output unchanged.
- [ ] All money rendered via one formatter.
- [ ] No whole-table-scan loaders remain: `fan_feed`, `musicians_near`, `profiles_near`, `open_gigs_near` RPCs (PostGIS, `security invoker`, `limit`) in a dated migration; loaders call them; fan realtime debounced.
- [ ] Restaurant: radius control works, invite prefill carries time, Rebook + musician SaveButton + pay/date filters added, decline confirmed, dead code gone.
- [ ] Musician: double-booking guard + anti-double-submit, calendar view, urgency, completeness bar, base rate, media link, reviews list+reply, block-out/confirm/sync, dispute path, this-month earnings, dead code gone.
- [ ] Fan: event detail page + RSVP + Share + cover charge + genre, genre personalization + filters, map toggle, saved-items screen + attended count, fuller cards.
- [ ] a11y: icon buttons labelled, decorative SVGs hidden, tap targets ≥44px.
- [ ] One editing model across all three dashboards.
- [ ] Typecheck/build passes; manual smoke test of each dashboard's primary flow.

Use TodoWrite to track phases. Confirm with me before any destructive migration (new columns/tables) and before pushing.

























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
