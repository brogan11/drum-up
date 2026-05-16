-- Drum Up — allow fans to read confirmed bookings for the feed
-- Run in Supabase SQL editor.
-- The existing bk_select_party policy only lets the musician/restaurant see
-- their own bookings. Fans need to read confirmed gigs to populate the feed.
-- PostgreSQL ORs multiple SELECT policies, so this does not weaken the
-- existing policy — it only adds a new path for confirmed rows.

create policy "bk_select_confirmed_public"
  on public.bookings for select
  to authenticated
  using (status = 'confirmed');
