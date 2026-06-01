-- Drum Up — allow logged-out (anon) reads for public profile pages (2026-06-01)
-- Run in the Supabase SQL editor.
--
-- Shareable "Book me on Drum Up" links must render for the public (a musician's
-- Instagram audience who aren't users yet). The public profile shows reviews and
-- follower counts, so anon needs SELECT on those two tables.
--
-- Deliberately NOT opened to anon:
--   * bookings  — rows carry pay_amount / platform_fee / stripe_* and RLS cannot
--                 hide columns, so the gig-history section is skipped for anon
--                 viewers in the page instead.
--   * messages / notifications — private, never public.
-- PostgreSQL ORs SELECT policies, so adding an anon path does not weaken the
-- existing authenticated policies.

-- Reviews are public reputation data (rating, text, aspects, tags) — safe to expose.
grant select on public.reviews to anon;
drop policy if exists "rv_select_anon" on public.reviews;
create policy "rv_select_anon"
  on public.reviews for select
  to anon
  using (true);

-- Follows back the public follower/following counts. Only holds two profile ids.
grant select on public.follows to anon;
drop policy if exists "fl_select_anon" on public.follows;
create policy "fl_select_anon"
  on public.follows for select
  to anon
  using (true);
