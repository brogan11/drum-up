-- Timestamp of when a payout was captured/released to the musician. Set by the daily
-- release-payout cron (app/api/stripe/release-payout/route.tsx) at the moment it captures
-- the held PaymentIntent. Lets the payments ledger & receipts show the real payout date
-- instead of inferring it from the gig date. Rows released before this column existed
-- stay null and simply omit the date. Safe to re-run.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payout_released_at timestamptz;
