-- Drum Up — availability RLS
-- Run in Supabase SQL editor.
-- Fixes: "new row violates row-level security policy for table availability"

alter table public.availability enable row level security;

-- Drop any prior policies cleanly before recreating.
do $$
declare r record;
begin
  for r in (select policyname from pg_policies
            where schemaname='public' and tablename='availability') loop
    execute format('drop policy %I on public.availability', r.policyname);
  end loop;
end $$;

-- Any authenticated user can read open slots (musicians browsing, fans discovering).
create policy "av_select_authenticated"
  on public.availability for select
  to authenticated
  using (true);

-- Restaurants can only insert slots for themselves.
create policy "av_insert_restaurant"
  on public.availability for insert
  to authenticated
  with check (auth.uid() = restaurant_id);

-- Restaurants can update their own slots (e.g. mark filled/cancelled).
create policy "av_update_restaurant"
  on public.availability for update
  to authenticated
  using (auth.uid() = restaurant_id)
  with check (auth.uid() = restaurant_id);

-- Restaurants can delete their own slots.
create policy "av_delete_restaurant"
  on public.availability for delete
  to authenticated
  using (auth.uid() = restaurant_id);

-- Index to speed up per-restaurant slot lookups.
create index if not exists availability_restaurant_idx on public.availability(restaurant_id);
