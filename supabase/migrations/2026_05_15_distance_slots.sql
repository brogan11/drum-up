-- Drum Up — distance-based slot discovery
-- Run in Supabase SQL editor.

-- 1. User's max travel distance preference (musicians + fans use this)
alter table public.profiles
  add column if not exists max_distance_miles int default 20;

-- 2. Snapshot the venue's coords onto each availability row.
--    We snapshot (vs. join on profiles each query) so a restaurant moving
--    later doesn't silently relocate every existing posted slot.
alter table public.availability
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision,
  add column if not exists genres    text[] default '{}'::text[];

-- 3. RLS for availability: anyone authenticated can read open slots,
--    only the owning restaurant can insert/update/delete its own.
alter table public.availability enable row level security;

drop policy if exists "Anyone can view availability"          on public.availability;
drop policy if exists "Restaurants can insert own slots"      on public.availability;
drop policy if exists "Restaurants can update own slots"      on public.availability;
drop policy if exists "Restaurants can delete own slots"      on public.availability;

create policy "Anyone can view availability"
  on public.availability for select
  using (true);

create policy "Restaurants can insert own slots"
  on public.availability for insert
  with check (auth.uid() = restaurant_id);

create policy "Restaurants can update own slots"
  on public.availability for update
  using (auth.uid() = restaurant_id)
  with check (auth.uid() = restaurant_id);

create policy "Restaurants can delete own slots"
  on public.availability for delete
  using (auth.uid() = restaurant_id);

-- 4. Helpful index for "open slots near me" queries.
create index if not exists availability_status_idx
  on public.availability(status);
