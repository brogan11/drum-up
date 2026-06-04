-- Drum Up — musician block-out dates (2026-06-10)
-- Run in the Supabase SQL editor.
--
-- The musician availability system is positive-only (musicians post dates they are
-- FREE via musician_availability). This adds the inverse: dates a musician is
-- UNAVAILABLE. Two sources:
--   * source = 'manual' — the musician hand-marks a date (or range) as blocked.
--   * source = 'import' — pulled from an imported .ics / iCal feed of external
--     commitments, so conflicts surface against gig invites/applications.
-- Blackouts feed the same double-booking guard as confirmed gigs.

create table if not exists public.musician_blackouts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  musician_id uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  reason      text,
  source      text not null default 'manual' check (source in ('manual', 'import')),
  unique (musician_id, date)
);

-- Idempotent column add for environments where the table predates the source column.
alter table public.musician_blackouts
  add column if not exists source text not null default 'manual';

create index if not exists musician_blackouts_musician_idx
  on public.musician_blackouts (musician_id, date);

alter table public.musician_blackouts enable row level security;

drop policy if exists "blackout_select_own" on public.musician_blackouts;
drop policy if exists "blackout_insert_own" on public.musician_blackouts;
drop policy if exists "blackout_delete_own" on public.musician_blackouts;

-- A musician manages only their own blackout rows.
create policy "blackout_select_own"
  on public.musician_blackouts for select
  to authenticated
  using (auth.uid() = musician_id);

create policy "blackout_insert_own"
  on public.musician_blackouts for insert
  to authenticated
  with check (auth.uid() = musician_id);

create policy "blackout_delete_own"
  on public.musician_blackouts for delete
  to authenticated
  using (auth.uid() = musician_id);
