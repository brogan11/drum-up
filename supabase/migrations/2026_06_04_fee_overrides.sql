-- Drum Up — per-user platform-fee overrides (2026-06-04)
-- Run in the Supabase SQL editor.
--
-- Lets an admin waive or reduce the 8% platform fee for selected users, optionally
-- with an expiry ("for a short time"). The fee normally comes out of the musician's
-- payout; the effective rate on a booking is the LOWEST active rate of the two
-- parties, so a waiver on either side reduces it.
--
--   platform_fee_pct  — percent (e.g. 0 = waived, 5 = 5%). NULL = use the default 8%.
--   fee_waiver_until  — when set and in the past, the override is ignored (expired).

alter table public.profiles
  add column if not exists platform_fee_pct numeric,
  add column if not exists fee_waiver_until timestamptz;

-- CRITICAL: these columns set how much WE earn, so clients must never write them.
-- RLS can't gate columns, so extend the existing profiles guard trigger (from
-- 2026_06_02) to block client changes to the fee fields too. Service role bypasses.
create or replace function public.guard_profiles_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then          -- service-role bypass
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception 'Cannot change profile id';
  end if;
  -- Ban state, Stripe linkage, and fee overrides are server-only.
  -- (legal_name is the user's OWN editable field — only its READ is restricted.)
  if new.is_banned        is distinct from old.is_banned
     or new.stripe_account_id is distinct from old.stripe_account_id
     or new.stripe_onboarded  is distinct from old.stripe_onboarded
     or new.platform_fee_pct  is distinct from old.platform_fee_pct
     or new.fee_waiver_until  is distinct from old.fee_waiver_until then
    raise exception 'These profile fields can only be changed by the server';
  end if;
  -- Role is set once at onboarding (null → role is fine). Block later changes
  -- between real roles — the privilege-escalation vector.
  if old.user_type is not null and new.user_type is distinct from old.user_type then
    raise exception 'user_type cannot be changed';
  end if;
  return new;
end;
$$;
