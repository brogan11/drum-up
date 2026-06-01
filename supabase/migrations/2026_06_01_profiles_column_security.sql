-- Drum Up — lock down sensitive `profiles` columns (2026-06-01)
-- Run in the Supabase SQL editor.
--
-- Problem: RLS can gate which *rows* a role can read, but NOT which *columns*.
-- The profiles SELECT policy lets anon/authenticated read a row, which means a
-- crafted PostgREST query (e.g. ?select=stripe_account_id,legal_name) could pull
-- those private fields for ANY user. Lock them at the column-grant level.
--
-- Caveat: column grants are not row-aware, so a plain REVOKE would also block the
-- app's own legitimate "read my own private fields" calls. We restore those via a
-- SECURITY DEFINER function scoped to auth.uid().

-- 1. Revoke direct column reads of the two sensitive fields from client roles.
--    (Service-role / server routes are unaffected — they bypass column grants.)
--    stripe_onboarded is intentionally LEFT readable: the restaurant dashboard
--    reads other musicians' stripe_onboarded to show whether they can be paid,
--    and a bare boolean is not sensitive.
revoke select (legal_name)        on public.profiles from anon, authenticated;
revoke select (stripe_account_id) on public.profiles from anon, authenticated;

-- 2. Let a signed-in user read ONLY their own private fields.
create or replace function public.get_my_private_profile()
returns table (legal_name text, stripe_account_id text, stripe_onboarded boolean)
language sql
security definer
set search_path = public
as $$
  select legal_name, stripe_account_id, stripe_onboarded
  from public.profiles
  where id = auth.uid()
$$;

revoke all on function public.get_my_private_profile() from public, anon;
grant execute on function public.get_my_private_profile() to authenticated;
