-- Drum Up — public event detail page + RSVP ("I'm going")
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Powers app/event/[id]: a public-safe detail view of a single confirmed gig,
-- plus a lightweight RSVP so fans can mark "I'm going" and see a going-count.

-- ── 1. RSVPs ─────────────────────────────────────────────────────────────────
create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unique (booking_id, user_id)
);

alter table public.rsvps enable row level security;

-- Users manage only their own RSVP rows. Aggregate counts are exposed via the
-- SECURITY DEFINER function below so we never expose the full attendee list.
drop policy if exists "rsvps_select_own" on public.rsvps;
drop policy if exists "rsvps_insert_own" on public.rsvps;
drop policy if exists "rsvps_delete_own" on public.rsvps;
create policy "rsvps_select_own" on public.rsvps for select using (auth.uid() = user_id);
create policy "rsvps_insert_own" on public.rsvps for insert with check (auth.uid() = user_id);
create policy "rsvps_delete_own" on public.rsvps for delete using (auth.uid() = user_id);

-- ── 2. Event detail — one confirmed gig, public-safe columns ──────────────────
create or replace function public.event_detail(event_id uuid)
returns table (
  booking_id uuid, restaurant_id uuid, musician_id uuid,
  venue_name text, venue_username text, venue_avatar text, venue_location text,
  venue_lat numeric, venue_lon numeric, venue_bio text,
  musician_name text, musician_username text, musician_avatar text, musician_bio text,
  performer_type text, band_members int, genres text[],
  instagram_url text, youtube_url text, spotify_url text,
  gig_date date, start_time time, end_time time,
  cover_charge numeric, description text
) language sql stable security definer set search_path = public as $$
  select b.id, b.restaurant_id, b.musician_id,
         coalesce(v.role_metadata->>'venue_name', v.full_name)::text,
         v.username::text, v.avatar_url::text, v.location_text::text,
         v.latitude, v.longitude, v.bio::text,
         m.full_name::text, m.username::text, m.avatar_url::text, m.bio::text,
         m.performer_type::text, m.band_members::int,
         array(select jsonb_array_elements_text(coalesce(m.role_metadata->'genres', '[]'::jsonb))),
         m.instagram_url::text, m.youtube_url::text, m.spotify_url::text,
         a.date, a.start_time, a.end_time, a.cover_charge, a.description::text
  from public.bookings b
  join public.availability a on a.id = b.availability_id
  join public.profiles v on v.id = b.restaurant_id
  join public.profiles m on m.id = b.musician_id
  where b.id = event_id and b.status = 'confirmed';
$$;

-- ── 3. Going-count for an event (reads all RSVP rows past RLS) ─────────────────
create or replace function public.event_going_count(event_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.rsvps where booking_id = event_id;
$$;

-- ── 4. Shows the signed-in fan has attended (past gigs they RSVP'd to) ────────
-- No uid param: always scoped to auth.uid() so one fan can't read another's
-- attendance even though the function is SECURITY DEFINER.
create or replace function public.fan_attended()
returns table (booking_id uuid, musician_name text, venue_name text, gig_date date)
language sql stable security definer set search_path = public as $$
  select b.id, m.full_name::text,
         coalesce(v.role_metadata->>'venue_name', v.full_name)::text, a.date
  from public.rsvps r
  join public.bookings b on b.id = r.booking_id
  join public.availability a on a.id = b.availability_id
  join public.profiles v on v.id = b.restaurant_id
  join public.profiles m on m.id = b.musician_id
  where r.user_id = auth.uid() and a.date < current_date
  order by a.date desc
  limit 100;
$$;

grant execute on function public.event_detail(uuid) to anon, authenticated;
grant execute on function public.event_going_count(uuid) to anon, authenticated;
grant execute on function public.fan_attended() to authenticated;
