-- Drum Up — server-side distance feeds (PostGIS RPCs)
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Replaces the client-side "pull whole table, filter by haversine in JS" loaders
-- with PostGIS ST_DWithin queries that filter + sort + limit in Postgres. All
-- functions are SECURITY INVOKER, so the caller's RLS still applies (they read
-- the same rows the old direct queries did). Columns are cast to the declared
-- return types so the functions don't break if a column's stored type differs.

-- ── 0. Cover charge on a gig (powers fan "Free entry" filter + card display) ──
alter table public.availability add column if not exists cover_charge numeric;

-- ── 1. Fan feed — confirmed gigs near the fan in the next `days` days ──────────
create or replace function public.fan_feed(fan_lat float8, fan_lon float8, radius_m float8, days int)
returns table (
  booking_id uuid, restaurant_id uuid, musician_id uuid,
  venue_name text, venue_avatar text, venue_location text,
  musician_name text, musician_avatar text, performer_type text, band_members int,
  genres text[], gig_date date, start_time time, end_time time, cover_charge numeric,
  venue_lat numeric, venue_lon numeric, distance_m float8
) language sql stable security invoker as $$
  select b.id, b.restaurant_id, b.musician_id,
         coalesce(v.role_metadata->>'venue_name', v.full_name)::text,
         v.avatar_url::text, v.location_text::text,
         m.full_name::text, m.avatar_url::text, m.performer_type::text, m.band_members::int,
         array(select jsonb_array_elements_text(coalesce(m.role_metadata->'genres', '[]'::jsonb))),
         a.date, a.start_time, a.end_time, a.cover_charge,
         v.latitude, v.longitude,
         case when fan_lat is null or v.latitude is null then null
              else st_distance(st_makepoint(v.longitude, v.latitude)::geography,
                               st_makepoint(fan_lon, fan_lat)::geography) end
  from public.confirmed_gigs b
  join public.availability a on a.id = b.availability_id
  join public.profiles v on v.id = b.restaurant_id
  join public.profiles m on m.id = b.musician_id
  where a.date between current_date and current_date + days
    and (fan_lat is null or v.latitude is null or st_dwithin(
      st_makepoint(v.longitude, v.latitude)::geography,
      st_makepoint(fan_lon, fan_lat)::geography, radius_m))
  order by a.date, a.start_time
  limit 200;
$$;

-- ── 2. Musicians near a venue (Restaurant browse) ─────────────────────────────
create or replace function public.musicians_near(lat float8, lon float8, radius_m float8)
returns table (
  id uuid, full_name text, avatar_url text, bio text, location_text text,
  instagram_url text, youtube_url text, spotify_url text,
  role_metadata jsonb, performer_type text, band_members int, distance_m float8
) language sql stable security invoker as $$
  select p.id, p.full_name::text, p.avatar_url::text, p.bio::text, p.location_text::text,
         p.instagram_url::text, p.youtube_url::text, p.spotify_url::text,
         p.role_metadata, p.performer_type::text, p.band_members::int,
         case when lat is null or p.latitude is null then null
              else st_distance(st_makepoint(p.longitude, p.latitude)::geography,
                               st_makepoint(lon, lat)::geography) end as distance_m
  from public.profiles p
  where p.user_type = 'musician'
    and p.latitude is not null and p.longitude is not null
    and (lat is null or st_dwithin(
      st_makepoint(p.longitude, p.latitude)::geography,
      st_makepoint(lon, lat)::geography, radius_m))
  order by distance_m nulls last
  limit 200;
$$;

-- ── 3. Profiles near a fan (Discover: restaurants + musicians) ────────────────
create or replace function public.profiles_near(lat float8, lon float8, radius_m float8, types text[])
returns table (
  id uuid, full_name text, user_type text, avatar_url text, bio text,
  location_text text, role_metadata jsonb, distance_m float8
) language sql stable security invoker as $$
  select p.id, p.full_name::text, p.user_type::text, p.avatar_url::text, p.bio::text,
         p.location_text::text, p.role_metadata,
         st_distance(st_makepoint(p.longitude, p.latitude)::geography,
                     st_makepoint(lon, lat)::geography) as distance_m
  from public.profiles p
  where p.user_type = any(types)
    and p.latitude is not null and p.longitude is not null
    and st_dwithin(st_makepoint(p.longitude, p.latitude)::geography,
                   st_makepoint(lon, lat)::geography, radius_m)
  order by distance_m
  limit 200;
$$;

-- ── 4. Open public gigs near a musician (Musician browse) ─────────────────────
create or replace function public.open_gigs_near(lat float8, lon float8, radius_m float8)
returns table (
  id uuid, restaurant_id uuid, gig_date date, start_time time, end_time time,
  description text, pay numeric, genres text[],
  venue_name text, venue_type text, venue_avatar text, distance_m float8
) language sql stable security invoker as $$
  select a.id, a.restaurant_id, a.date, a.start_time, a.end_time,
         a.description::text, a.pay, a.genres,
         coalesce(v.role_metadata->>'venue_name', v.full_name)::text,
         (v.role_metadata->>'cuisine_type')::text,
         v.avatar_url::text,
         case when lat is null or a.latitude is null then null
              else st_distance(st_makepoint(a.longitude, a.latitude)::geography,
                               st_makepoint(lon, lat)::geography) end as distance_m
  from public.availability a
  join public.profiles v on v.id = a.restaurant_id
  where a.status = 'open' and coalesce(a.is_private, false) = false
    and a.date >= current_date
    and a.latitude is not null and a.longitude is not null
    and (lat is null or st_dwithin(
      st_makepoint(a.longitude, a.latitude)::geography,
      st_makepoint(lon, lat)::geography, radius_m))
  order by a.date, distance_m nulls last
  limit 200;
$$;

grant execute on function public.fan_feed(float8, float8, float8, int) to anon, authenticated;
grant execute on function public.musicians_near(float8, float8, float8) to anon, authenticated;
grant execute on function public.profiles_near(float8, float8, float8, text[]) to anon, authenticated;
grant execute on function public.open_gigs_near(float8, float8, float8) to anon, authenticated;
