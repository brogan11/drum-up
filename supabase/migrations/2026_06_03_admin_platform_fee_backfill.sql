-- Drum Up — backfill platform_fee for admin revenue reporting (2026-06-03)
-- Run in the Supabase SQL editor.
--
-- platform_fee was computed for Stripe but never written to the booking row, so
-- the admin "Revenue Collected" metric (which sums this column) always read $0.
-- /api/bookings/confirm now persists it on confirmation; this backfills the
-- 8% fee for existing confirmed bookings. Safe to re-run.
update public.bookings
set platform_fee = round((coalesce(pay_amount, 0) * 0.08)::numeric, 2)
where platform_fee is null
  and status = 'confirmed';
