-- Drum Up — bookings (applications) wiring
-- Run in Supabase SQL editor.

-- 1. Add a `note` column for the musician's pitch when applying.
alter table public.bookings
  add column if not exists note text;

-- 2. Restaurant typo guard — same kind of column-name mismatch we hit on
--    availability. Rename to canonical names if the misspellings exist.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='bookings' and column_name='restauraunt_id') then
    alter table public.bookings rename column restauraunt_id to restaurant_id;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='bookings' and column_name='musican_id') then
    alter table public.bookings rename column musican_id to musician_id;
  end if;
end $$;

-- 3. RLS: enable + clean any prior policies, then create owner-aware policies.
alter table public.bookings enable row level security;

do $$
declare r record;
begin
  for r in (select policyname from pg_policies
            where schemaname='public' and tablename='bookings') loop
    execute format('drop policy %I on public.bookings', r.policyname);
  end loop;
end $$;

-- Either party (musician or restaurant) can read the booking.
create policy "bk_select_party"
  on public.bookings for select
  using (auth.uid() = musician_id or auth.uid() = restaurant_id);

-- Musicians create their own pending applications.
create policy "bk_insert_musician"
  on public.bookings for insert
  with check (auth.uid() = musician_id);

-- Either party can update (musician can cancel, restaurant can accept/decline).
create policy "bk_update_party"
  on public.bookings for update
  using (auth.uid() = musician_id or auth.uid() = restaurant_id)
  with check (auth.uid() = musician_id or auth.uid() = restaurant_id);

-- Lookup helpers for the queries we'll run.
create index if not exists bookings_musician_idx     on public.bookings(musician_id);
create index if not exists bookings_availability_idx on public.bookings(availability_id);
