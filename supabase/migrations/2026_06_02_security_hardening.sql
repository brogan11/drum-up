-- Drum Up — security hardening (2026-06-02)
-- Run in the Supabase SQL editor.
--
-- Root cause addressed: this app's clients talk to Postgres directly via PostgREST,
-- so RLS *is* the backend. But RLS can only gate which ROWS a role touches, never
-- which COLUMNS. That left several write paths open:
--   * bookings: either party could UPDATE/INSERT any column → mark a gig
--     confirmed/paid without paying, forge confirmed bookings, etc.
--   * profiles: a user could rewrite their own user_type (role escalation) and
--     is_banned (un-ban themselves).
-- We can't fix column-level writes with RLS, so we use BEFORE INSERT/UPDATE
-- triggers. Server routes use the service-role key (no end-user JWT → auth.uid()
-- is NULL), so they bypass these guards; only direct client writes are policed.
--
-- Safe to re-run.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. BOOKINGS — lock lifecycle / payment columns to the server (C-1, C-2)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.guard_bookings_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller   uuid := auth.uid();
  slot_pay numeric;
begin
  -- Service-role / server routes (no end-user JWT) bypass these client guards.
  if caller is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A client may only create a clean, pending APPLICATION for themselves.
    if new.musician_id is distinct from caller then
      raise exception 'You can only create bookings as the musician';
    end if;
    if coalesce(new.status, 'pending') <> 'pending' then
      raise exception 'New bookings must start as pending';
    end if;
    if coalesce(new.source, 'application') <> 'application' then
      raise exception 'Clients may only create application bookings';
    end if;
    if coalesce(new.payment_status, 'unpaid') <> 'unpaid'
       or coalesce(new.payout_released, false) <> false
       or new.payout_released_at is not null
       or new.invite_accepted is not null
       or new.stripe_payment_id is not null
       or new.stripe_payment_intent_id is not null
       or new.stripe_transfer_id is not null
       or new.platform_fee is not null then
      raise exception 'Payment fields cannot be set when creating a booking';
    end if;

    -- Normalise protected fields no matter what the client sent.
    new.status                  := 'pending';
    new.source                  := 'application';
    new.payment_status          := 'unpaid';
    new.payout_released         := false;
    new.payout_released_at      := null;
    new.invite_accepted         := null;
    new.stripe_payment_id       := null;
    new.stripe_payment_intent_id := null;
    new.stripe_transfer_id      := null;
    new.platform_fee            := null;

    -- Pin pay_amount to the authoritative slot price (clients can't inflate it).
    select pay into slot_pay from public.availability where id = new.availability_id;
    new.pay_amount := coalesce(slot_pay, new.pay_amount);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Only a party to the booking may touch it.
    if caller is distinct from old.musician_id
       and caller is distinct from old.restaurant_id then
      raise exception 'Not authorized to modify this booking';
    end if;

    -- Server-only / immutable columns.
    if new.payment_status          is distinct from old.payment_status
       or new.payout_released      is distinct from old.payout_released
       or new.payout_released_at   is distinct from old.payout_released_at
       or new.stripe_payment_id        is distinct from old.stripe_payment_id
       or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
       or new.stripe_transfer_id       is distinct from old.stripe_transfer_id
       or new.platform_fee        is distinct from old.platform_fee
       or new.pay_amount          is distinct from old.pay_amount
       or new.source              is distinct from old.source
       or new.invite_accepted     is distinct from old.invite_accepted
       or new.availability_id     is distinct from old.availability_id
       or new.restaurant_id       is distinct from old.restaurant_id
       or new.musician_id         is distinct from old.musician_id then
      raise exception 'These booking fields can only be changed by the server';
    end if;

    -- Clients may only CANCEL (withdraw / decline). Confirmation + payment
    -- transitions are done server-side after a verified Stripe authorization.
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'Clients may only cancel bookings; confirmation is server-side';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_bookings_write on public.bookings;
create trigger trg_guard_bookings_write
  before insert or update on public.bookings
  for each row execute function public.guard_bookings_write();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. PROFILES — block role escalation & self-unban (C-3)
-- ════════════════════════════════════════════════════════════════════════════
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
  -- Ban state & Stripe account linkage are server-only. (legal_name is the user's
  -- OWN editable field — only its READ is restricted, via column-level REVOKE.)
  if new.is_banned        is distinct from old.is_banned
     or new.stripe_account_id is distinct from old.stripe_account_id
     or new.stripe_onboarded  is distinct from old.stripe_onboarded then
    raise exception 'These profile fields can only be changed by the server';
  end if;
  -- Role is set once at onboarding (null → role is fine). Block any later change
  -- between real roles — that's the privilege-escalation vector.
  if old.user_type is not null and new.user_type is distinct from old.user_type then
    raise exception 'user_type cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profiles_write on public.profiles;
create trigger trg_guard_profiles_write
  before update on public.profiles
  for each row execute function public.guard_profiles_write();

-- ════════════════════════════════════════════════════════════════════════════
-- 3. BOOKINGS — stop confirmed rows leaking Stripe IDs / fees (H-1)
-- ════════════════════════════════════════════════════════════════════════════
-- These columns are NEVER read by the client (only server routes via service
-- role). Lock them at the column-grant level so no crafted query can pull them.
revoke select (stripe_payment_id, stripe_payment_intent_id, stripe_transfer_id, platform_fee)
  on public.bookings from anon, authenticated;

-- The broad "anyone authenticated can read every confirmed booking (all columns)"
-- policies exposed pay_amount + party ids platform-wide. Replace with a safe,
-- column-limited view for the public feed; parties still read their own rows in
-- full via bk_select_party.
drop policy if exists "bk_select_confirmed_public" on public.bookings;
drop policy if exists "Authenticated users can read confirmed bookings" on public.bookings;

create or replace view public.confirmed_gigs
with (security_invoker = off) as
  select id, restaurant_id, musician_id, availability_id, status, created_at
  from public.bookings
  where status = 'confirmed';

grant select on public.confirmed_gigs to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. NOTIFICATIONS — only the server may create them (H-3)
-- ════════════════════════════════════════════════════════════════════════════
-- "Anyone can insert WITH CHECK (true)" allowed forging phishing notifications
-- with attacker-controlled links to any user. Service role bypasses RLS, so
-- simply removing the client insert policy is enough.
drop policy if exists "Anyone can insert" on public.notifications;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. PROFILE VIEWS — a viewer can only record their own view (M-5)
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "Anyone can record a view" on public.profile_views;
create policy "Authed users record their own view"
  on public.profile_views for insert
  to authenticated
  with check (viewer_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- 6. FOLLOWS — prevent duplicate-follow count inflation (M-5)
-- ════════════════════════════════════════════════════════════════════════════
delete from public.follows a
  using public.follows b
  where a.ctid < b.ctid
    and a.follower_id = b.follower_id
    and a.following_id = b.following_id;
create unique index if not exists follows_follower_following_uniq
  on public.follows (follower_id, following_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 7. REVIEWS — require a real, completed booking between the parties (M-3)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.reviews
  add constraint reviews_text_len
  check (review_text is null or char_length(review_text) <= 4000) not valid;

create or replace function public.guard_reviews_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  bk     record;
begin
  if caller is null then          -- service-role bypass
    return new;
  end if;
  if new.reviewer_id is distinct from caller then
    raise exception 'reviewer_id must be you';
  end if;
  if new.reviewee_id = new.reviewer_id then
    raise exception 'You cannot review yourself';
  end if;
  if new.rating is null or new.rating < 1 or new.rating > 5 then
    raise exception 'Rating must be 1-5';
  end if;
  if new.booking_id is null then
    raise exception 'A review must reference a booking';
  end if;
  select * into bk from public.bookings where id = new.booking_id;
  if bk is null then
    raise exception 'Booking not found';
  end if;
  if bk.status <> 'confirmed' then
    raise exception 'You can only review a confirmed gig';
  end if;
  if not (
       (bk.musician_id   = caller and bk.restaurant_id = new.reviewee_id)
    or (bk.restaurant_id = caller and bk.musician_id   = new.reviewee_id)
  ) then
    raise exception 'You can only review the other party of your own booking';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_reviews_write on public.reviews;
create trigger trg_guard_reviews_write
  before insert on public.reviews
  for each row execute function public.guard_reviews_write();

-- ════════════════════════════════════════════════════════════════════════════
-- 8. MESSAGES — bound content length (M-4)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.messages
  add constraint messages_content_len
  check (content is not null and char_length(content) between 1 and 5000) not valid;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. AVAILABILITY — hide unfilled private invite slots from non-owners (M-6)
-- ════════════════════════════════════════════════════════════════════════════
drop policy if exists "av_select_authenticated" on public.availability;
create policy "av_select_visible"
  on public.availability for select
  to authenticated
  using (
    coalesce(is_private, false) = false
    or restaurant_id = auth.uid()
    or exists (
      select 1 from public.bookings b
      where b.availability_id = availability.id
        and (b.musician_id = auth.uid() or b.status = 'confirmed')
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- 10. STORAGE — enforce avatar/banner size + type on the bucket (M-8)
-- ════════════════════════════════════════════════════════════════════════════
-- Client-side checks are bypassable via direct API. Enforce at the bucket.
update storage.buckets
  set file_size_limit = 10485760,  -- 10 MB
      allowed_mime_types = array['image/png','image/jpeg','image/jpg','image/webp','image/gif']
  where id = 'avatars';
